/**
 * bgnbd.ts — BG/NBD (Beta-Geometric / Negative-Binomial-Distribution) model.
 *
 * Reference: Fader, Hardie & Lee (2005),
 *   "Counting Your Customers the Easy Way: An Alternative to the
 *    Pareto/NBD Model", Marketing Science 24(2).
 *
 * Pure functions only — no I/O, no Date.now(), no Math.random().
 * Special functions (lnGamma, hyp2f1) are implemented locally in ./special.
 */

import { lnGamma, hyp2f1 } from "./special";

/**
 * Recency-Frequency-Monetary-style summary for one customer (no monetary here).
 * All times share the SAME unit (e.g. days).
 */
export interface CustomerRFM {
  /** frequency: number of REPEAT purchases (excludes the first purchase). */
  x: number;
  /** recency: time of the last repeat purchase, measured since first purchase. */
  tx: number;
  /** age: observation window length, measured since first purchase. */
  T: number;
}

/** BG/NBD parameters. r, alpha govern the Gamma purchasing process; a, b the Beta dropout process. */
export interface BGNBDParams {
  r: number;
  alpha: number;
  a: number;
  b: number;
}

/**
 * Per-customer BG/NBD log-likelihood (FHL 2005, eq. for ln L).
 *
 * Using the paper's decomposition:
 *   A1 = lnΓ(r+x) - lnΓ(r) + r·ln(alpha)
 *   A2 = lnΓ(a+b) + lnΓ(b+x) - lnΓ(b) - lnΓ(a+b+x)
 *   A3 = -(r+x)·ln(alpha+T)
 *   ln L = A1 + A2 + ln( exp(A3) + [x>0]·(a/(b+x-1))·exp(-(r+x)·ln(alpha+tx)) )
 */
function customerLogLikelihood(p: BGNBDParams, c: CustomerRFM): number {
  const { r, alpha, a, b } = p;
  const { x, tx, T } = c;

  const A1 = lnGamma(r + x) - lnGamma(r) + r * Math.log(alpha);
  const A2 =
    lnGamma(a + b) + lnGamma(b + x) - lnGamma(b) - lnGamma(a + b + x);
  const A3 = -(r + x) * Math.log(alpha + T);

  // Second term inside the log only exists for x > 0.
  let inner = Math.exp(A3);
  if (x > 0) {
    const A4exp = -(r + x) * Math.log(alpha + tx);
    inner += (a / (b + x - 1)) * Math.exp(A4exp);
  }

  return A1 + A2 + Math.log(inner);
}

/**
 * Total BG/NBD log-likelihood over a dataset.
 * Returns -Infinity if any parameter is non-positive (invalid).
 */
export function bgnbdLogLikelihood(
  params: BGNBDParams,
  data: CustomerRFM[],
): number {
  const { r, alpha, a, b } = params;
  if (r <= 0 || alpha <= 0 || a <= 0 || b <= 0) return -Infinity;

  let total = 0;
  for (const c of data) {
    const ll = customerLogLikelihood(params, c);
    if (!Number.isFinite(ll)) return -Infinity;
    total += ll;
  }
  return total;
}

/**
 * P(alive | x, tx, T) — probability the customer has not yet "died".
 * FHL 2005 closed form. If x = 0 the customer is alive with probability 1.
 * Result clamped to [0, 1].
 */
export function probAlive(params: BGNBDParams, c: CustomerRFM): number {
  const { r, alpha, a, b } = params;
  const { x, tx, T } = c;

  if (x === 0) return 1;

  const ratio = Math.pow((alpha + T) / (alpha + tx), r + x);
  const p = 1 / (1 + (a / (b + x - 1)) * ratio);

  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

/**
 * E[Y(t) | x, tx, T] — expected number of purchases in the next `tFuture`
 * time units, conditional on the customer's history. FHL 2005 conditional
 * expectation formula (uses ₂F₁).
 *
 * Guard: the formula has a (a - 1) in the denominator of term1. When a <= 1
 * the closed form is undefined / unstable, so we evaluate term1 using a
 * slightly perturbed a' = max(a, 1 + 1e-6). This keeps the result finite and
 * close to the limiting value without blowing up. (Documented guard.)
 */
export function expectedTransactions(
  params: BGNBDParams,
  c: CustomerRFM,
  tFuture: number,
): number {
  const { r, alpha, a, b } = params;
  const { x, tx, T } = c;

  // Guard a <= 1: term1 = (a+b+x-1)/(a-1) diverges. Perturb a upward slightly.
  const aSafe = a > 1 ? a : 1 + 1e-6;

  const term1 = (aSafe + b + x - 1) / (aSafe - 1);

  const z = tFuture / (alpha + T + tFuture);
  const term2 =
    1 -
    Math.pow((alpha + T) / (alpha + T + tFuture), r + x) *
      hyp2f1(r + x, b + x, aSafe + b + x - 1, z);

  const numerator = term1 * term2;

  let denominator = 1;
  if (x > 0) {
    denominator += (a / (b + x - 1)) * Math.pow((alpha + T) / (alpha + tx), r + x);
  }

  const result = numerator / denominator;
  return Number.isFinite(result) && result > 0 ? result : 0;
}

// ---------------------------------------------------------------------------
// Nelder-Mead optimizer (downhill simplex). Minimizes `fn` over R^n.
// Exported so the Gamma-Gamma model can reuse it. No randomness.
// ---------------------------------------------------------------------------

/**
 * Standard Nelder-Mead simplex minimization.
 * @param fn objective to MINIMIZE
 * @param start initial point (length n)
 * @param iters max iterations
 * @param tol convergence tolerance on the simplex spread
 * @returns best point found
 */
export function nelderMead(
  fn: (p: number[]) => number,
  start: number[],
  iters = 500,
  tol = 1e-8,
): number[] {
  const n = start.length;
  const alpha = 1; // reflection
  const gamma = 2; // expansion
  const rho = 0.5; // contraction
  const sigma = 0.5; // shrink

  // Build initial simplex: start + perturbations along each axis.
  const simplex: number[][] = [start.slice()];
  for (let i = 0; i < n; i++) {
    const pt = start.slice();
    const step = pt[i] !== 0 ? 0.05 * pt[i] : 0.00025;
    pt[i] += step;
    simplex.push(pt);
  }

  let fvals = simplex.map(fn);

  const order = () => {
    const idx = fvals.map((_, i) => i).sort((p, q) => fvals[p] - fvals[q]);
    const newSimplex = idx.map((i) => simplex[i]);
    const newF = idx.map((i) => fvals[i]);
    for (let i = 0; i < simplex.length; i++) {
      simplex[i] = newSimplex[i];
      fvals[i] = newF[i];
    }
  };

  for (let iter = 0; iter < iters; iter++) {
    order();

    // Convergence check: spread of function values.
    const spread = Math.abs(fvals[fvals.length - 1] - fvals[0]);
    if (spread < tol) break;

    // Centroid of all but worst.
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j];
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    const worst = simplex[n];
    const fWorst = fvals[n];
    const fBest = fvals[0];
    const fSecondWorst = fvals[n - 1];

    // Reflection.
    const reflected = centroid.map((cj, j) => cj + alpha * (cj - worst[j]));
    const fReflected = fn(reflected);

    if (fReflected < fBest) {
      // Expansion.
      const expanded = centroid.map((cj, j) => cj + gamma * (reflected[j] - cj));
      const fExpanded = fn(expanded);
      if (fExpanded < fReflected) {
        simplex[n] = expanded;
        fvals[n] = fExpanded;
      } else {
        simplex[n] = reflected;
        fvals[n] = fReflected;
      }
    } else if (fReflected < fSecondWorst) {
      simplex[n] = reflected;
      fvals[n] = fReflected;
    } else {
      // Contraction.
      let contracted: number[];
      let fContracted: number;
      if (fReflected < fWorst) {
        // Outside contraction.
        contracted = centroid.map((cj, j) => cj + rho * (reflected[j] - cj));
        fContracted = fn(contracted);
      } else {
        // Inside contraction.
        contracted = centroid.map((cj, j) => cj + rho * (worst[j] - cj));
        fContracted = fn(contracted);
      }

      if (fContracted < Math.min(fReflected, fWorst)) {
        simplex[n] = contracted;
        fvals[n] = fContracted;
      } else {
        // Shrink toward best.
        const best = simplex[0];
        for (let i = 1; i < simplex.length; i++) {
          simplex[i] = best.map((bj, j) => bj + sigma * (simplex[i][j] - bj));
          fvals[i] = fn(simplex[i]);
        }
      }
    }
  }

  order();
  return simplex[0];
}

/**
 * Fit BG/NBD parameters by maximum likelihood (minimize negative LL) using
 * Nelder-Mead. Optimization happens in log-space (params = exp(unconstrained))
 * so r, alpha, a, b stay strictly positive. Several deterministic restarts
 * (no Math.random) guard against local minima.
 */
export function fitBGNBD(
  data: CustomerRFM[],
  opts?: { restarts?: number },
): BGNBDParams {
  const restarts = opts?.restarts ?? 3;

  // Objective in unconstrained log-space.
  const negLL = (u: number[]): number => {
    const p: BGNBDParams = {
      r: Math.exp(u[0]),
      alpha: Math.exp(u[1]),
      a: Math.exp(u[2]),
      b: Math.exp(u[3]),
    };
    const ll = bgnbdLogLikelihood(p, data);
    return Number.isFinite(ll) ? -ll : 1e12;
  };

  // Deterministic starting points: {1,1,1,1} plus fixed-factor jitters.
  const baseStarts: BGNBDParams[] = [
    { r: 1, alpha: 1, a: 1, b: 1 },
    { r: 0.5, alpha: 2, a: 0.5, b: 2 },
    { r: 2, alpha: 4, a: 1.5, b: 0.5 },
    { r: 0.25, alpha: 10, a: 2, b: 3 },
  ];

  let best: BGNBDParams | null = null;
  let bestNeg = Infinity;

  const nStarts = Math.min(restarts + 1, baseStarts.length);
  for (let s = 0; s < nStarts; s++) {
    const st = baseStarts[s];
    const start = [
      Math.log(st.r),
      Math.log(st.alpha),
      Math.log(st.a),
      Math.log(st.b),
    ];
    const sol = nelderMead(negLL, start, 500, 1e-8);
    const val = negLL(sol);
    if (val < bestNeg) {
      bestNeg = val;
      best = {
        r: Math.exp(sol[0]),
        alpha: Math.exp(sol[1]),
        a: Math.exp(sol[2]),
        b: Math.exp(sol[3]),
      };
    }
  }

  return best ?? { r: 1, alpha: 1, a: 1, b: 1 };
}
