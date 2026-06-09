/**
 * Heuristic repurchase prediction (PREDICTION_SPEC sections 2.0 / 3, layers L0–L2).
 * This is the v2.0 engine — pure arithmetic (means + intervals), no model fitting,
 * which the spec says already captures ~70% of the value. The probabilistic L3
 * (BG/NBD) layer lives in bgnbd.ts and is selected by the service when a shop has
 * enough active customers.
 *
 * All times are in **days**; "now" is passed explicitly for determinism.
 */
import type { MemberRFM } from "./rfm";

export type PredictionSource =
  | "L0_prior"
  | "L1_shopavg"
  | "L2_personal"
  | "L3_bgnbd";

export interface HeuristicInput {
  rfm: MemberRFM;
  /** Shop-wide average cycle (L1 fallback for one-purchase customers). */
  shopAvgIntervalDays: number | null;
  /** L0 fallback when the shop has no measurable cycle yet. */
  priorDays: number;
  now: Date;
  /** ± window (days) within which an expected purchase counts as "imminent". */
  imminentWindowDays?: number;
}

export interface HeuristicPrediction {
  /** null when the member has no purchase to anchor a cycle on. */
  expectedNextDate: Date | null;
  /** The cycle length used (days), or null when unpredictable. */
  cycleDays: number | null;
  source: PredictionSource;
  /** Overdue beyond 1.5× the cycle → churn risk. */
  riskFlag: boolean;
  /** Due within ±window → repurchase imminent (mutually exclusive with risk). */
  imminentFlag: boolean;
  /** Human, action-oriented confidence label for the admin UI (spec section 7). */
  confidenceLabel: string;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const RISK_MULTIPLIER = 1.5; // recency > 1.5× cycle ⇒ at risk (spec section 1)

/**
 * Predict a single member's next purchase using the best layer their data supports:
 *   - L2 personal  : ≥ 2 purchases → use the member's own average cycle.
 *   - L1 shop avg   : exactly 1 purchase + a shop-wide cycle exists.
 *   - L0 prior      : 1 purchase, brand-new shop → category/default prior.
 *   - none          : 0 purchases → not predictable (returns null date).
 */
export function predictHeuristic(input: HeuristicInput): HeuristicPrediction {
  const { rfm, shopAvgIntervalDays, priorDays, now } = input;
  const window = input.imminentWindowDays ?? 3;

  // No purchase to anchor on — nothing to predict yet.
  if (rfm.frequency === 0 || rfm.lastAt == null) {
    return {
      expectedNextDate: null,
      cycleDays: null,
      source: "L0_prior",
      riskFlag: false,
      imminentFlag: false,
      confidenceLabel: "예측 불가 (구매 이력 없음)",
    };
  }

  let cycleDays: number;
  let source: PredictionSource;
  let confidenceLabel: string;

  if (rfm.avgIntervalDays != null && rfm.avgIntervalDays > 0) {
    cycleDays = rfm.avgIntervalDays;
    source = "L2_personal";
    confidenceLabel = `개인화 (구매 ${rfm.frequency}회 기반)`;
  } else if (shopAvgIntervalDays != null && shopAvgIntervalDays > 0) {
    cycleDays = shopAvgIntervalDays;
    source = "L1_shopavg";
    confidenceLabel = "상점 평균 기반";
  } else {
    cycleDays = priorDays;
    source = "L0_prior";
    confidenceLabel = "카테고리 기준값 (데이터 부족)";
  }

  const expectedNextDate = new Date(
    rfm.lastAt.getTime() + cycleDays * MS_PER_DAY,
  );
  const daysUntil =
    (expectedNextDate.getTime() - now.getTime()) / MS_PER_DAY;

  const riskFlag = rfm.recencyDays > RISK_MULTIPLIER * cycleDays;
  const imminentFlag = !riskFlag && daysUntil >= -window && daysUntil <= window;

  return {
    expectedNextDate,
    cycleDays,
    source,
    riskFlag,
    imminentFlag,
    confidenceLabel,
  };
}
