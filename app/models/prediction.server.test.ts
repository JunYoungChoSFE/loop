import { describe, it, expect, afterAll, beforeEach } from "vitest";
import db from "../db.server";
import { ensureShop } from "./shop.server";
import { ensureMember } from "./member.server";
import {
  recomputePredictionsForShop,
  getPredictionSummary,
} from "./prediction.server";
import {
  runShopActions,
  backfillActualOrders,
} from "./predictionActions.server";

/**
 * Prediction engine integration test (real SQLite, dev.sqlite).
 * Drives history → recompute → flags → actions → validation backfill,
 * scoped to a dedicated test shop and cleaned up via cascade.
 */
const TEST_SHOP = "loop-predict-test.myshopify.com";
const DAY = 1000 * 60 * 60 * 24;
const NOW = new Date("2026-06-01T00:00:00.000Z");

async function wipe() {
  await db.shop.deleteMany({ where: { shopDomain: TEST_SHOP } });
}

/** Insert a purchase transaction at a controlled timestamp. */
async function purchase(
  shopId: string,
  memberId: string,
  daysAgo: number,
  amount: number,
  orderId: string,
) {
  await db.pointsTransaction.create({
    data: {
      shopId,
      memberId,
      delta: Math.round(amount),
      reason: "purchase",
      orderId,
      amount,
      createdAt: new Date(NOW.getTime() - daysAgo * DAY),
    },
  });
}

beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

describe("prediction service", () => {
  it("flags an imminent repurchase (personal cycle, due now)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const m = await ensureMember(shop.id, "cust-imminent", "a@example.com");
    // 30-day cadence, last purchase 30 days ago → due today.
    await purchase(shop.id, m.id, 60, 50, "o1");
    await purchase(shop.id, m.id, 30, 50, "o2");

    const res = await recomputePredictionsForShop(shop.id, NOW);
    expect(res.predicted).toBe(1);

    const pred = await db.customerPrediction.findUniqueOrThrow({
      where: { memberId: m.id },
    });
    expect(pred.predictionSource).toBe("L2_personal");
    expect(pred.imminentFlag).toBe(true);
    expect(pred.riskFlag).toBe(false);
  });

  it("flags churn risk when overdue beyond 1.5x the cycle", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const m = await ensureMember(shop.id, "cust-risk", "b@example.com");
    // 30-day cadence, last purchase 60 days ago → 60 > 45 → at risk.
    await purchase(shop.id, m.id, 90, 50, "o1");
    await purchase(shop.id, m.id, 60, 50, "o2");

    await recomputePredictionsForShop(shop.id, NOW);
    const pred = await db.customerPrediction.findUniqueOrThrow({
      where: { memberId: m.id },
    });
    expect(pred.riskFlag).toBe(true);
    expect(pred.imminentFlag).toBe(false);
  });

  it("skips members with no purchases and is rerunnable (upsert)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const buyer = await ensureMember(shop.id, "buyer", null);
    await ensureMember(shop.id, "lurker", null); // signup only, no purchase
    await purchase(shop.id, buyer.id, 20, 40, "o1");

    const a = await recomputePredictionsForShop(shop.id, NOW);
    const b = await recomputePredictionsForShop(shop.id, NOW); // rerun
    expect(a.predicted).toBe(1);
    expect(b.predicted).toBe(1);
    const count = await db.customerPrediction.count({ where: { shopId: shop.id } });
    expect(count).toBe(1); // upsert, not duplicated
  });

  it("summary returns imminent / at-risk counts and lists", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const im = await ensureMember(shop.id, "im", "im@example.com");
    const rk = await ensureMember(shop.id, "rk", "rk@example.com");
    await purchase(shop.id, im.id, 60, 50, "i1");
    await purchase(shop.id, im.id, 30, 50, "i2");
    await purchase(shop.id, rk.id, 90, 50, "r1");
    await purchase(shop.id, rk.id, 60, 50, "r2");

    await recomputePredictionsForShop(shop.id, NOW);
    const summary = await getPredictionSummary(shop.id);
    expect(summary.imminentCount).toBe(1);
    expect(summary.riskCount).toBe(1);
    expect(summary.imminent[0].email).toBe("im@example.com");
    expect(summary.atRisk[0].email).toBe("rk@example.com");
  });
});

describe("prediction actions", () => {
  it("winback grants bonus points to at-risk members, respecting cooldown", async () => {
    const shop = await ensureShop(TEST_SHOP);
    await db.setting.update({
      where: { shopId: shop.id },
      data: { winbackEnabled: true, winbackPoints: 100 },
    });
    const m = await ensureMember(shop.id, "atrisk", "c@example.com");
    await purchase(shop.id, m.id, 90, 50, "o1");
    await purchase(shop.id, m.id, 60, 50, "o2");
    await recomputePredictionsForShop(shop.id, NOW);

    const first = await runShopActions(shop.id, NOW);
    expect(first.winbacks).toBe(1);
    const afterFirst = await db.member.findUniqueOrThrow({ where: { id: m.id } });
    // Raw purchase rows above don't touch the balance; only the 100pt winback does.
    expect(afterFirst.pointsBalance).toBe(100);

    // Re-run same day: cooldown blocks a second grant.
    const second = await runShopActions(shop.id, NOW);
    expect(second.winbacks).toBe(0);
    const afterSecond = await db.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(afterSecond.pointsBalance).toBe(100);

    const logs = await db.predictionActionLog.findMany({
      where: { shopId: shop.id, actionType: "winback" },
    });
    expect(logs).toHaveLength(1);
  });

  it("actions are off by default (no consent → nothing fires)", async () => {
    const shop = await ensureShop(TEST_SHOP);
    const m = await ensureMember(shop.id, "atrisk", "d@example.com");
    await purchase(shop.id, m.id, 90, 50, "o1");
    await purchase(shop.id, m.id, 60, 50, "o2");
    await recomputePredictionsForShop(shop.id, NOW);

    const res = await runShopActions(shop.id, NOW);
    expect(res.reminders).toBe(0);
    expect(res.winbacks).toBe(0);
    expect(res.highValueAlerts).toBe(0);
  });

  it("backfill records the actual next order after a trigger", async () => {
    const shop = await ensureShop(TEST_SHOP);
    await db.setting.update({
      where: { shopId: shop.id },
      data: { winbackEnabled: true, winbackPoints: 50 },
    });
    const m = await ensureMember(shop.id, "atrisk", "e@example.com");
    await purchase(shop.id, m.id, 90, 50, "o1");
    await purchase(shop.id, m.id, 60, 50, "o2");
    await recomputePredictionsForShop(shop.id, NOW);
    await runShopActions(shop.id, NOW); // logs a winback at NOW

    // No purchase after the trigger yet → nothing to backfill.
    expect(await backfillActualOrders(shop.id)).toBe(0);

    // Customer comes back the next day.
    await db.pointsTransaction.create({
      data: {
        shopId: shop.id,
        memberId: m.id,
        delta: 30,
        reason: "purchase",
        orderId: "o3",
        amount: 30,
        createdAt: new Date(NOW.getTime() + DAY),
      },
    });
    expect(await backfillActualOrders(shop.id)).toBe(1);
    const log = await db.predictionActionLog.findFirstOrThrow({
      where: { shopId: shop.id, actionType: "winback" },
    });
    expect(log.actualNextOrderAt).not.toBeNull();
  });
});
