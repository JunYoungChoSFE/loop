/**
 * Earning engine — pure functions (CLAUDE.md section 9: calculations split into testable pure functions).
 * No DB or network dependencies. Input -> output only.
 */

/**
 * Calculates points earned from the order total and the merchant's earn rate.
 *
 * - Points are integers (decimals truncated).
 * - Negative/NaN/non-positive inputs are safely handled as 0 points (never award negative points).
 *
 * @param orderTotal the order total (in currency units, e.g. 49.90)
 * @param earnRate   points earned per unit of currency (e.g. 1 -> 1pt per $1)
 * @returns the integer points to award (>= 0)
 */
export function calculateEarnedPoints(orderTotal: number, earnRate: number): number {
  if (!Number.isFinite(orderTotal) || !Number.isFinite(earnRate)) return 0;
  if (orderTotal <= 0 || earnRate <= 0) return 0;
  return Math.floor(orderTotal * earnRate);
}

/**
 * Account signup bonus points. Negative/NaN are safely handled as 0.
 */
export function calculateSignupBonus(signupBonus: number): number {
  if (!Number.isFinite(signupBonus) || signupBonus <= 0) return 0;
  return Math.floor(signupBonus);
}

/**
 * Calculates the balance after earning (clamped so it never goes negative).
 */
export function applyDelta(currentBalance: number, delta: number): number {
  const next = currentBalance + delta;
  return next < 0 ? 0 : next;
}
