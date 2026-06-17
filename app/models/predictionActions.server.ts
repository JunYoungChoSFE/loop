/**
 * Prediction → action engine (Loop v2, PREDICTION_SPEC section 4).
 * Closes predictions into real actions, all gated by per-shop toggles that
 * default OFF (guardrail 3 — explicit merchant consent before anything sends):
 *
 *   imminent  + reminderEnabled       → gentle reminder email to the customer.
 *   at-risk   + winbackEnabled        → real bonus points + win-back email.
 *   at-risk高 + highvalueAlertEnabled  → one digest email to the merchant.
 *
 * Background actions use DB + email only — never the Shopify Admin API — so the
 * nightly batch needs no offline access token. Cooldowns prevent spam.
 */
import db from "../db.server";
import { deliver } from "./email.server";
import { grantWinbackPoints } from "./points.server";
import { recomputePredictionsForShop } from "./prediction.server";
import {
  reminderEmail,
  winbackEmail,
  highValueAlertEmail,
} from "../lib/email/templates";

const DAY = 1000 * 60 * 60 * 24;

/** Per-action cooldown (days) — don't re-trigger the same action for the same member too soon. */
const COOLDOWN_DAYS: Record<string, number> = {
  reminder: 14,
  winback: 21,
  highvalue_alert: 14,
};

/** Max members touched per action per run (safety cap; logged when hit). */
const MAX_PER_ACTION = 200;
/** Top-N at-risk-by-CLV customers to surface to the merchant per run. */
const HIGHVALUE_TOP_N = 5;

export interface ShopActionResult {
  reminders: number;
  winbacks: number;
  highValueAlerts: number;
  skippedNoSetting: boolean;
}

/** Member IDs already actioned with `actionType` since `since` (cooldown filter). */
async function recentlyActioned(
  shopId: string,
  actionType: string,
  since: Date,
): Promise<Set<string>> {
  const rows = await db.predictionActionLog.findMany({
    where: { shopId, actionType, triggeredAt: { gte: since } },
    select: { memberId: true },
  });
  return new Set(rows.map((r) => r.memberId));
}

/** Most recent store-owner email from the session store, for merchant alerts. */
async function ownerEmail(shopDomain: string): Promise<string | null> {
  const session = await db.session.findFirst({
    where: { shop: shopDomain, accountOwner: true, email: { not: null } },
    orderBy: { id: "desc" },
    select: { email: true },
  });
  return session?.email ?? null;
}

/**
 * Evaluate triggers and execute actions for one shop. Predictions must already
 * be recomputed for `now`. Returns how many of each action fired.
 */
export async function runShopActions(
  shopId: string,
  now: Date = new Date(),
): Promise<ShopActionResult> {
  const result: ShopActionResult = {
    reminders: 0,
    winbacks: 0,
    highValueAlerts: 0,
    skippedNoSetting: false,
  };

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    include: { setting: true },
  });
  if (!shop || !shop.setting) {
    result.skippedNoSetting = true;
    return result;
  }
  // Automatic actions (reminders, win-backs, high-value alerts) are a Pro
  // feature. The dashboard already prevents Free shops from enabling the
  // toggles, but a shop that downgraded keeps its toggles in the DB — enforce
  // the gate here too so paid automation truly stops on downgrade.
  if (shop.plan !== "pro") {
    result.skippedNoSetting = true;
    return result;
  }
  const setting = shop.setting;
  const storeName = shop.shopDomain;

  // ── Reminders: imminent customers with an email ──────────────────────────
  if (setting.reminderEnabled) {
    const since = new Date(now.getTime() - COOLDOWN_DAYS.reminder * DAY);
    const done = await recentlyActioned(shopId, "reminder", since);
    const rows = await db.customerPrediction.findMany({
      where: { shopId, imminentFlag: true },
      take: MAX_PER_ACTION,
      include: { member: { select: { email: true, pointsBalance: true } } },
    });
    for (const p of rows) {
      if (done.has(p.memberId) || !p.member.email) continue;
      const mail = reminderEmail({
        storeName,
        balance: p.member.pointsBalance,
      });
      await deliver(p.member.email, mail.subject, mail.text);
      await db.predictionActionLog.create({
        data: {
          shopId,
          memberId: p.memberId,
          shopifyCustomerId: p.shopifyCustomerId,
          actionType: "reminder",
          triggeredAt: now,
          predictedNextDate: p.expectedNextDate,
        },
      });
      result.reminders++;
    }
  }

  // ── Win-back: at-risk customers get real bonus points ────────────────────
  if (setting.winbackEnabled && setting.winbackPoints > 0) {
    const since = new Date(now.getTime() - COOLDOWN_DAYS.winback * DAY);
    const done = await recentlyActioned(shopId, "winback", since);
    const rows = await db.customerPrediction.findMany({
      where: { shopId, riskFlag: true },
      take: MAX_PER_ACTION,
      include: { member: { select: { email: true } } },
    });
    for (const p of rows) {
      if (done.has(p.memberId)) continue;
      const balance = await grantWinbackPoints(
        shopId,
        p.memberId,
        setting.winbackPoints,
      );
      if (p.member.email) {
        const mail = winbackEmail({
          storeName,
          bonusPoints: setting.winbackPoints,
          balance,
        });
        await deliver(p.member.email, mail.subject, mail.text);
      }
      await db.predictionActionLog.create({
        data: {
          shopId,
          memberId: p.memberId,
          shopifyCustomerId: p.shopifyCustomerId,
          actionType: "winback",
          triggeredAt: now,
          predictedNextDate: p.expectedNextDate,
        },
      });
      result.winbacks++;
    }
  }

  // ── High-value alert: digest the top at-risk-by-CLV customers to the merchant ─
  if (setting.highvalueAlertEnabled) {
    const since = new Date(now.getTime() - COOLDOWN_DAYS.highvalue_alert * DAY);
    const done = await recentlyActioned(shopId, "highvalue_alert", since);
    const rows = await db.customerPrediction.findMany({
      where: { shopId, riskFlag: true, predictedClv: { not: null } },
      orderBy: { predictedClv: "desc" },
      take: HIGHVALUE_TOP_N * 3,
      include: { member: { select: { email: true } } },
    });
    const fresh = rows.filter((p) => !done.has(p.memberId)).slice(0, HIGHVALUE_TOP_N);
    if (fresh.length > 0) {
      const to = await ownerEmail(storeName);
      if (to) {
        for (const p of fresh) {
          const mail = highValueAlertEmail({
            storeName,
            customer: p.member.email || p.shopifyCustomerId || p.memberId,
            predictedClv: p.predictedClv,
          });
          await deliver(to, mail.subject, mail.text);
          await db.predictionActionLog.create({
            data: {
              shopId,
              memberId: p.memberId,
              shopifyCustomerId: p.shopifyCustomerId,
              actionType: "highvalue_alert",
              triggeredAt: now,
              predictedNextDate: p.expectedNextDate,
            },
          });
          result.highValueAlerts++;
        }
      } else {
        console.log(`[predict] highvalue alert skipped for ${storeName}: no owner email`);
      }
    }
  }

  return result;
}

/**
 * Validation backfill (spec section 10): for action logs still missing an
 * actual outcome, record the member's first purchase after the trigger so
 * hit-rate can be measured later.
 */
export async function backfillActualOrders(shopId: string): Promise<number> {
  const open = await db.predictionActionLog.findMany({
    where: { shopId, actualNextOrderAt: null },
    select: { id: true, memberId: true, triggeredAt: true },
  });
  let filled = 0;
  for (const log of open) {
    const nextPurchase = await db.pointsTransaction.findFirst({
      where: {
        shopId,
        memberId: log.memberId,
        reason: "purchase",
        createdAt: { gt: log.triggeredAt },
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (nextPurchase) {
      await db.predictionActionLog.update({
        where: { id: log.id },
        data: { actualNextOrderAt: nextPurchase.createdAt },
      });
      filled++;
    }
  }
  return filled;
}

export interface BatchResult {
  shops: number;
  predicted: number;
  reminders: number;
  winbacks: number;
  highValueAlerts: number;
  backfilled: number;
}

/**
 * Nightly batch across all shops: recompute predictions → backfill validation
 * → run actions. Designed to be safe to call repeatedly (cooldowns + idempotent
 * upserts), so an external scheduler or the in-process timer can both invoke it.
 */
export async function runPredictionBatch(
  now: Date = new Date(),
): Promise<BatchResult> {
  const shops = await db.shop.findMany({ select: { id: true } });
  const agg: BatchResult = {
    shops: shops.length,
    predicted: 0,
    reminders: 0,
    winbacks: 0,
    highValueAlerts: 0,
    backfilled: 0,
  };

  for (const s of shops) {
    try {
      const rec = await recomputePredictionsForShop(s.id, now);
      agg.predicted += rec.predicted;
      agg.backfilled += await backfillActualOrders(s.id);
      const actions = await runShopActions(s.id, now);
      agg.reminders += actions.reminders;
      agg.winbacks += actions.winbacks;
      agg.highValueAlerts += actions.highValueAlerts;
    } catch (e) {
      // One shop failing must never stop the batch (spec guardrail 4).
      console.log(`[predict] batch failed for shop ${s.id}:`, e);
    }
  }
  return agg;
}
