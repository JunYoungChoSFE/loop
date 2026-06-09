/**
 * Redemption engine — pure functions (CLAUDE.md section 9).
 * Actual deduction/issuance happens in the models layer; only the decision logic is split out here to be testable.
 */

/**
 * Validates whether a member can redeem a reward.
 * The balance and required points must be valid numbers, the required points must be at least 1, and the balance must be sufficient.
 */
export function canRedeem(balance: number, pointsCost: number): boolean {
  if (!Number.isFinite(balance) || !Number.isFinite(pointsCost)) return false;
  if (pointsCost <= 0) return false;
  return balance >= pointsCost;
}
