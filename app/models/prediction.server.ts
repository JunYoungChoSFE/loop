/**
 * Prediction service (Loop v2). Turns each member's purchase history into a
 * CustomerPrediction row, choosing the best layer the shop's data supports:
 *
 *   L0_prior  → brand-new shop, 1 purchase: category/default prior cycle.
 *   L1_shopavg → 1 purchase + a shop-wide cycle exists.
 *   L2_personal → ≥ 2 purchases: the member's own cycle.
 *   L3_bgnbd  → shop has ≥ L3_MIN_CUSTOMERS active customers: overlays the
 *               probabilistic P(alive) + CLV (BG/NBD + Gamma-Gamma) on top of
 *               the heuristic next-date.
 *
 * The heuristic next-date/cycle is always computed (it's what drives the
 * "imminent / at-risk" action triggers); L3 enriches it with pAlive + predictedClv
 * and refines the risk flag. Everything is shopId-scoped (multitenancy).
 *
 * Computed on demand (dashboard load) and by the nightly batch — no separate
 * Python worker or scheduler infra (PREDICTION_SPEC section 5, adapted to the
 * single-runtime Fly deploy).
 */
import db from "../db.server";
import { computeRFM, shopAverageCycleDays } from "../lib/predict/rfm";
import { predictHeuristic, type PredictionSource } from "../lib/predict/heuristic";
import { priorDaysFor } from "../lib/predict/categoryPriors";
import {
  fitBGNBD,
  probAlive,
  expectedTransactions,
  type CustomerRFM,
} from "../lib/predict/bgnbd";
import {
  fitGammaGamma,
  conditionalExpectedAverageValue,
  expectedCLV,
  type MonetaryRFM,
} from "../lib/predict/gammagamma";

/** Active customers a shop needs before the probabilistic L3 layer kicks in (spec §3). */
export const L3_MIN_CUSTOMERS = 200;
/** CLV horizon for the BG/NBD expected-transactions estimate. */
const CLV_HORIZON_DAYS = 90;
/** P(alive) below this marks an at-risk customer under L3. */
const PALIVE_RISK_THRESHOLD = 0.3;

interface MemberPurchases {
  memberId: string;
  shopifyCustomerId: string | null;
  events: { at: Date; amount: number | null }[];
}

/** Group a shop's purchase transactions by member. */
async function loadMemberPurchases(shopId: string): Promise<MemberPurchases[]> {
  const [members, txns] = await Promise.all([
    db.member.findMany({
      where: { shopId },
      select: { id: true, shopifyCustomerId: true },
    }),
    db.pointsTransaction.findMany({
      where: { shopId, reason: "purchase" },
      select: { memberId: true, createdAt: true, amount: true },
    }),
  ]);

  const byMember = new Map<string, { at: Date; amount: number | null }[]>();
  for (const t of txns) {
    const list = byMember.get(t.memberId) ?? [];
    list.push({ at: t.createdAt, amount: t.amount });
    byMember.set(t.memberId, list);
  }

  return members.map((m) => ({
    memberId: m.id,
    shopifyCustomerId: m.shopifyCustomerId,
    events: byMember.get(m.id) ?? [],
  }));
}

export interface RecomputeResult {
  shopId: string;
  predicted: number; // members with a prediction written
  imminent: number;
  atRisk: number;
  layer: PredictionSource | "mixed";
  usedL3: boolean;
}

/**
 * Recompute and upsert predictions for every member in a shop.
 * Members with zero purchases are skipped (nothing to predict).
 */
export async function recomputePredictionsForShop(
  shopId: string,
  now: Date = new Date(),
  l3MinCustomers: number = L3_MIN_CUSTOMERS,
): Promise<RecomputeResult> {
  const purchases = await loadMemberPurchases(shopId);

  // The merchant's declared vertical picks the cold-start reorder prior — so a
  // consumable/replenishment shop with little history still gets a meaningful
  // day-one estimate (path B). Unset → DEFAULT_PRIOR_DAYS via priorDaysFor.
  const setting = await db.setting.findUnique({
    where: { shopId },
    select: { category: true },
  });
  const priorDays = priorDaysFor(setting?.category);

  // RFM per member, keeping only those with at least one purchase.
  const withRfm = purchases
    .map((p) => ({ ...p, rfm: computeRFM(p.events, now) }))
    .filter((p) => p.rfm.frequency > 0);

  const shopAvg = shopAverageCycleDays(withRfm.map((p) => p.rfm));

  // Decide whether the probabilistic L3 layer applies and pre-fit the shop models.
  const usedL3 = withRfm.length >= l3MinCustomers;
  let bgnbd: ReturnType<typeof fitBGNBD> | null = null;
  let gg: ReturnType<typeof fitGammaGamma> | null = null;
  if (usedL3) {
    const bgData: CustomerRFM[] = withRfm.map((p) => ({
      x: p.rfm.repeatCount,
      tx: p.rfm.txDays,
      T: p.rfm.ageDays,
    }));
    bgnbd = fitBGNBD(bgData);

    const ggData: MonetaryRFM[] = withRfm
      .filter((p) => p.rfm.repeatCount > 0 && p.rfm.avgAmount != null)
      .map((p) => ({
        frequency: p.rfm.repeatCount,
        monetaryValue: p.rfm.avgAmount as number,
      }));
    // Gamma-Gamma needs a few customers with repeat + monetary data to fit.
    gg = ggData.length >= 5 ? fitGammaGamma(ggData) : null;
  }

  let imminent = 0;
  let atRisk = 0;
  const sources = new Set<PredictionSource>();

  // Upsert each member's prediction.
  for (const p of withRfm) {
    const h = predictHeuristic({
      rfm: p.rfm,
      shopAvgIntervalDays: shopAvg,
      priorDays,
      now,
    });

    let pAlive: number | null = null;
    let predictedClv: number | null = null;
    let riskFlag = h.riskFlag;
    let source: PredictionSource = h.source;

    if (usedL3 && bgnbd) {
      const c: CustomerRFM = {
        x: p.rfm.repeatCount,
        tx: p.rfm.txDays,
        T: p.rfm.ageDays,
      };
      pAlive = probAlive(bgnbd, c);
      source = "L3_bgnbd";
      // Probabilistic risk: overdue (heuristic) OR low survival probability.
      riskFlag = h.riskFlag || pAlive < PALIVE_RISK_THRESHOLD;

      if (gg && p.rfm.avgAmount != null && p.rfm.repeatCount > 0) {
        const txns = expectedTransactions(bgnbd, c, CLV_HORIZON_DAYS);
        const avgValue = conditionalExpectedAverageValue(gg, {
          frequency: p.rfm.repeatCount,
          monetaryValue: p.rfm.avgAmount,
        });
        predictedClv = expectedCLV(gg, txns, avgValue);
      }
    }

    sources.add(source);
    if (h.imminentFlag) imminent++;
    if (riskFlag) atRisk++;

    await db.customerPrediction.upsert({
      where: { memberId: p.memberId },
      update: {
        shopifyCustomerId: p.shopifyCustomerId,
        pAlive,
        expectedNextDate: h.expectedNextDate,
        predictedClv,
        riskFlag,
        imminentFlag: h.imminentFlag,
        predictionSource: source,
        computedAt: now,
      },
      create: {
        shopId,
        memberId: p.memberId,
        shopifyCustomerId: p.shopifyCustomerId,
        pAlive,
        expectedNextDate: h.expectedNextDate,
        predictedClv,
        riskFlag,
        imminentFlag: h.imminentFlag,
        predictionSource: source,
        computedAt: now,
      },
    });
  }

  const layer: RecomputeResult["layer"] =
    sources.size === 1 ? [...sources][0] : "mixed";

  return {
    shopId,
    predicted: withRfm.length,
    imminent,
    atRisk,
    layer,
    usedL3,
  };
}

export interface PredictionRow {
  memberId: string;
  email: string | null;
  shopifyCustomerId: string | null;
  pointsBalance: number;
  expectedNextDate: string | null;
  pAlive: number | null;
  predictedClv: number | null;
  riskFlag: boolean;
  imminentFlag: boolean;
  source: string;
  confidenceLabel: string;
}

const SOURCE_LABEL: Record<string, string> = {
  L0_prior: "Category baseline (low data)",
  L1_shopavg: "Shop average",
  L2_personal: "Personalized",
  L3_bgnbd: "Probabilistic (BG/NBD)",
};

function toRow(p: {
  memberId: string;
  shopifyCustomerId: string | null;
  pAlive: number | null;
  expectedNextDate: Date | null;
  predictedClv: number | null;
  riskFlag: boolean;
  imminentFlag: boolean;
  predictionSource: string;
  member: { email: string | null; pointsBalance: number };
}): PredictionRow {
  return {
    memberId: p.memberId,
    email: p.member.email,
    shopifyCustomerId: p.shopifyCustomerId,
    pointsBalance: p.member.pointsBalance,
    expectedNextDate: p.expectedNextDate?.toISOString().slice(0, 10) ?? null,
    pAlive: p.pAlive,
    predictedClv: p.predictedClv,
    riskFlag: p.riskFlag,
    imminentFlag: p.imminentFlag,
    source: p.predictionSource,
    confidenceLabel: SOURCE_LABEL[p.predictionSource] ?? p.predictionSource,
  };
}

export interface PredictionSummary {
  predicted: number;
  imminentCount: number;
  riskCount: number;
  imminent: PredictionRow[];
  atRisk: PredictionRow[];
  lastComputedAt: string | null;
}

/** Dashboard read: counts + the imminent / at-risk member lists (spec section 7). */
export async function getPredictionSummary(
  shopId: string,
  limit = 50,
): Promise<PredictionSummary> {
  const [predicted, imminentCount, riskCount, imminentRows, riskRows, latest] =
    await Promise.all([
      db.customerPrediction.count({ where: { shopId } }),
      db.customerPrediction.count({ where: { shopId, imminentFlag: true } }),
      db.customerPrediction.count({ where: { shopId, riskFlag: true } }),
      db.customerPrediction.findMany({
        where: { shopId, imminentFlag: true },
        orderBy: { expectedNextDate: "asc" },
        take: limit,
        include: { member: { select: { email: true, pointsBalance: true } } },
      }),
      db.customerPrediction.findMany({
        where: { shopId, riskFlag: true },
        orderBy: [{ predictedClv: "desc" }, { expectedNextDate: "asc" }],
        take: limit,
        include: { member: { select: { email: true, pointsBalance: true } } },
      }),
      db.customerPrediction.findFirst({
        where: { shopId },
        orderBy: { computedAt: "desc" },
        select: { computedAt: true },
      }),
    ]);

  return {
    predicted,
    imminentCount,
    riskCount,
    imminent: imminentRows.map(toRow),
    atRisk: riskRows.map(toRow),
    lastComputedAt: latest?.computedAt.toISOString() ?? null,
  };
}
