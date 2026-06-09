/**
 * special.ts — Pure-TypeScript special functions for probabilistic CLV models.
 *
 * No external dependencies; everything implemented from scratch so the BG/NBD
 * and Gamma-Gamma models can run in any JS runtime (incl. Workers).
 */

// Lanczos approximation coefficients (g = 7, n = 9). Standard set from
// Numerical Recipes / Boost. Accurate to ~1e-12 for x > 0.
const LANCZOS_G = 7;
const LANCZOS_COEF = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/**
 * Natural logarithm of the Gamma function, ln Γ(x), via the Lanczos
 * approximation (g = 7, 9 coefficients). Uses the reflection formula for
 * x < 0.5. Accurate to ~1e-12 for x > 0.
 *
 * @param x argument (defined for all real x except non-positive integers)
 * @returns ln Γ(x)
 */
export function lnGamma(x: number): number {
  // Reflection formula: Γ(x)Γ(1-x) = π / sin(πx)
  if (x < 0.5) {
    return (
      Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
    );
  }

  x -= 1;
  let a = LANCZOS_COEF[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_COEF.length; i++) {
    a += LANCZOS_COEF[i] / (x + i);
  }

  return (
    0.5 * Math.log(2 * Math.PI) +
    (x + 0.5) * Math.log(t) -
    t +
    Math.log(a)
  );
}

/**
 * Gaussian hypergeometric function ₂F₁(a, b; c; z) via its power series:
 *
 *   ₂F₁(a,b;c;z) = Σ_{n≥0} ( (a)_n (b)_n / (c)_n ) z^n / n!
 *
 * where (·)_n is the Pochhammer (rising factorial). Converges for |z| < 1,
 * which is all the BG/NBD conditional-expectation formula needs. Terms are
 * accumulated with a ratio recurrence (no factorials computed directly), and
 * summation stops when |term| < 1e-12 or after 10000 terms.
 *
 * @param a parameter a
 * @param b parameter b
 * @param c parameter c (must not be a non-positive integer)
 * @param z argument, |z| < 1
 * @returns ₂F₁(a, b; c; z)
 */
export function hyp2f1(a: number, b: number, c: number, z: number): number {
  let term = 1; // n = 0 term
  let sum = 1;
  const maxIter = 10000;

  for (let n = 0; n < maxIter; n++) {
    // ratio of consecutive terms: t_{n+1}/t_n = (a+n)(b+n) / ((c+n)(n+1)) * z
    const ratio = ((a + n) * (b + n)) / ((c + n) * (n + 1)) * z;
    term *= ratio;
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }

  return sum;
}
