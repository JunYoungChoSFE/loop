/**
 * RFM aggregation — turns a member's raw purchase events into the
 * Recency / Frequency / Monetary features the prediction layers consume
 * (PREDICTION_SPEC sections 1–3). Pure functions, no I/O — fully testable.
 *
 * Time unit throughout is **days**. All "now" comparisons take an explicit
 * reference date so callers (and tests) stay deterministic.
 */

export interface PurchaseEvent {
  at: Date;
  amount: number | null; // order monetary value, when known
}

export interface MemberRFM {
  /** Total purchases observed. */
  frequency: number;
  /** Repeat purchases excluding the first (BG/NBD's x). */
  repeatCount: number;
  firstAt: Date | null;
  lastAt: Date | null;
  /** Days since the last purchase (now − lastAt). */
  recencyDays: number;
  /** Customer age T: days from first purchase to now. */
  ageDays: number;
  /** BG/NBD recency t_x: days from first to last purchase. */
  txDays: number;
  /** Mean gap between consecutive purchases (the personal cycle). null if < 2 purchases. */
  avgIntervalDays: number | null;
  /** Sample std-dev of the inter-purchase gaps. null if < 3 purchases. */
  intervalStdDays: number | null;
  /** Mean of the known purchase amounts. null if none carry an amount. */
  avgAmount: number | null;
  /** How many purchases carried a monetary amount (Gamma-Gamma input count). */
  monetaryCount: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

/**
 * Aggregate one member's purchase events into RFM features.
 * `events` may be unsorted; only `reason === "purchase"` rows should be passed in.
 */
export function computeRFM(events: PurchaseEvent[], now: Date): MemberRFM {
  const empty: MemberRFM = {
    frequency: 0,
    repeatCount: 0,
    firstAt: null,
    lastAt: null,
    recencyDays: 0,
    ageDays: 0,
    txDays: 0,
    avgIntervalDays: null,
    intervalStdDays: null,
    avgAmount: null,
    monetaryCount: 0,
  };
  if (events.length === 0) return empty;

  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const firstAt = sorted[0].at;
  const lastAt = sorted[sorted.length - 1].at;
  const frequency = sorted.length;

  // Inter-purchase gaps (days) → personal cycle.
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1].at, sorted[i].at));
  }
  const avgIntervalDays =
    gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : null;
  let intervalStdDays: number | null = null;
  if (gaps.length >= 2 && avgIntervalDays != null) {
    const variance =
      gaps.reduce((s, g) => s + (g - avgIntervalDays) ** 2, 0) /
      (gaps.length - 1);
    intervalStdDays = Math.sqrt(variance);
  }

  // Monetary.
  const amounts = sorted
    .map((e) => e.amount)
    .filter((a): a is number => a != null && Number.isFinite(a));
  const avgAmount =
    amounts.length > 0
      ? amounts.reduce((s, a) => s + a, 0) / amounts.length
      : null;

  return {
    frequency,
    repeatCount: frequency - 1,
    firstAt,
    lastAt,
    recencyDays: Math.max(0, daysBetween(lastAt, now)),
    ageDays: Math.max(0, daysBetween(firstAt, now)),
    txDays: Math.max(0, daysBetween(firstAt, lastAt)),
    avgIntervalDays,
    intervalStdDays,
    avgAmount,
    monetaryCount: amounts.length,
  };
}

/**
 * Shop-wide average personal cycle — the mean of avgIntervalDays across members
 * who have at least 2 purchases. Used as the L1 fallback for one-purchase customers.
 * Returns null when no member in the shop has a measurable cycle yet.
 */
export function shopAverageCycleDays(rfms: MemberRFM[]): number | null {
  const cycles = rfms
    .map((r) => r.avgIntervalDays)
    .filter((c): c is number => c != null && c > 0);
  if (cycles.length === 0) return null;
  return cycles.reduce((s, c) => s + c, 0) / cycles.length;
}
