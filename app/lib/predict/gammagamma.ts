/**
 * gammagamma.ts — Gamma-Gamma model of monetary value.
 *
 * Reference: Fader & Hardie (2013),
 *   "The Gamma-Gamma Model of Monetary Value".
 *
 * Conditional on the number of transactions, the average transaction value is
 * modeled so that its posterior mean is a convex combination of the population
 * mean and the customer's own observed average. Pure functions only.
 */

import { lnGamma } from "./special";
import { nelderMead } from "./bgnbd";

/** One customer's monetary summary. */
export interface MonetaryRFM {
  /** number of REPEAT transactions (must be > 0 to contribute). */
  frequency: number;
  /** average monetary value per transaction (> 0). */
  monetaryValue: number;
}

/** Gamma-Gamma parameters. v is the Greek gamma (population shape's scale). */
export interface GammaGammaParams {
  p: number;
  q: number;
  v: number;
}

/**
 * Per-customer Gamma-Gamma log-likelihood (Fader-Hardie 2013):
 *
 *   lnΓ(p·x + q) - lnΓ(p·x) - lnΓ(q) + q·ln(v)
 *     + (p·x - 1)·ln(m) + (p·x)·ln(x) - (p·x + q)·ln(v + x·m)
 *
 * where x = frequency, m = monetaryValue.
 */
function customerLogLikelihood(p: GammaGammaParams, c: MonetaryRFM): number {
  const px = p.p * c.frequency;
  const x = c.frequency;
  const m = c.monetaryValue;

  return (
    lnGamma(px + p.q) -
    lnGamma(px) -
    lnGamma(p.q) +
    p.q * Math.log(p.v) +
    (px - 1) * Math.log(m) +
    px * Math.log(x) -
    (px + p.q) * Math.log(p.v + x * m)
  );
}

/**
 * Total Gamma-Gamma log-likelihood. Only customers with frequency > 0 and
 * monetaryValue > 0 contribute. Returns -Infinity for invalid params.
 */
export function gammaGammaLogLikelihood(
  params: GammaGammaParams,
  data: MonetaryRFM[],
): number {
  const { p, q, v } = params;
  if (p <= 0 || q <= 0 || v <= 0) return -Infinity;

  let total = 0;
  for (const c of data) {
    if (c.frequency > 0 && c.monetaryValue > 0) {
      const ll = customerLogLikelihood(params, c);
      if (!Number.isFinite(ll)) return -Infinity;
      total += ll;
    }
  }
  return total;
}

/**
 * Fit Gamma-Gamma parameters by maximum likelihood (minimize negative LL)
 * via Nelder-Mead in log-space (params = exp(unconstrained)) so p, q, v stay
 * positive. Deterministic restarts; no randomness.
 */
export function fitGammaGamma(
  data: MonetaryRFM[],
  opts?: { restarts?: number },
): GammaGammaParams {
  const restarts = opts?.restarts ?? 3;

  const negLL = (u: number[]): number => {
    const params: GammaGammaParams = {
      p: Math.exp(u[0]),
      q: Math.exp(u[1]),
      v: Math.exp(u[2]),
    };
    const ll = gammaGammaLogLikelihood(params, data);
    return Number.isFinite(ll) ? -ll : 1e12;
  };

  const baseStarts: GammaGammaParams[] = [
    { p: 1, q: 1, v: 1 },
    { p: 2, q: 2, v: 5 },
    { p: 0.5, q: 3, v: 10 },
    { p: 4, q: 1.5, v: 50 },
  ];

  let best: GammaGammaParams | null = null;
  let bestNeg = Infinity;

  const nStarts = Math.min(restarts + 1, baseStarts.length);
  for (let s = 0; s < nStarts; s++) {
    const st = baseStarts[s];
    const start = [Math.log(st.p), Math.log(st.q), Math.log(st.v)];
    const sol = nelderMead(negLL, start, 500, 1e-8);
    const val = negLL(sol);
    if (val < bestNeg) {
      bestNeg = val;
      best = {
        p: Math.exp(sol[0]),
        q: Math.exp(sol[1]),
        v: Math.exp(sol[2]),
      };
    }
  }

  return best ?? { p: 1, q: 1, v: 1 };
}

/**
 * E[M | x, m̄] — posterior mean average transaction value for one customer
 * (Fader-Hardie 2013). It is a convex combination of:
 *   - the population mean  v·p / (q - 1)
 *   - the individual mean  m̄
 * weighted by (q-1)/(p·x + q - 1) and (p·x)/(p·x + q - 1) respectively.
 */
export function conditionalExpectedAverageValue(
  params: GammaGammaParams,
  c: MonetaryRFM,
): number {
  const { p, q, v } = params;
  const x = c.frequency;
  const m = c.monetaryValue;

  const populationMean = (v * p) / (q - 1);
  const denom = p * x + q - 1;

  const wPop = (q - 1) / denom;
  const wInd = (p * x) / denom;

  return wPop * populationMean + wInd * m;
}

/**
 * Expected customer lifetime value: a thin multiply of the BG/NBD expected
 * number of transactions by the conditional average transaction value.
 *
 * NOTE: Discounting (DCF / discount rate) is intentionally omitted for v2.0.
 */
export function expectedCLV(
  _ggParams: GammaGammaParams,
  expectedTxns: number,
  avgValue: number,
): number {
  return expectedTxns * avgValue;
}
