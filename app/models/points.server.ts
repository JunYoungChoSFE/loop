import db from "../db.server";
import { calculateSignupBonus } from "../lib/points/earn";

/**
 * Records points earned from a purchase (idempotent). If the same order (orderId) was already credited, it's ignored as a duplicate.
 * Recording the PointsTransaction(+) and incrementing the Member balance happen in a single transaction.
 */
export async function creditPurchasePoints(params: {
  shopId: string;
  memberId: string;
  points: number;
  orderId: string;
  amount?: number; // 주문 금액 — Gamma-Gamma CLV 입력으로 보관 (Loop v2)
}): Promise<"credited" | "duplicate" | "skipped"> {
  const { shopId, memberId, points, orderId, amount } = params;
  if (points <= 0) return "skipped";

  // Idempotency check #1: if this order was already credited, it's a duplicate.
  const existing = await db.pointsTransaction.findUnique({
    where: { shopId_orderId: { shopId, orderId } },
  });
  if (existing) return "duplicate";

  try {
    await db.$transaction([
      db.pointsTransaction.create({
        data: {
          shopId,
          memberId,
          delta: points,
          reason: "purchase",
          orderId,
          amount: amount != null && Number.isFinite(amount) ? amount : null,
        },
      }),
      db.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: points } },
      }),
    ]);
    return "credited";
  } catch (e: unknown) {
    // Idempotency safeguard #2: if a duplicate webhook causes a unique constraint violation (P2002), it was already credited.
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return "duplicate";
    }
    throw e;
  }
}

/**
 * Awards the account signup bonus (customers/create). Once per member only (idempotent).
 * @returns the outcome
 */
export async function awardSignupBonus(
  shopId: string,
  memberId: string,
  bonusSetting: number,
): Promise<"awarded" | "skipped" | "duplicate"> {
  const bonus = calculateSignupBonus(bonusSetting);
  if (bonus <= 0) return "skipped";

  const existing = await db.pointsTransaction.findFirst({
    where: { shopId, memberId, reason: "signup" },
  });
  if (existing) return "duplicate";

  try {
    await db.$transaction([
      db.pointsTransaction.create({
        data: { shopId, memberId, delta: bonus, reason: "signup" },
      }),
      db.member.update({
        where: { id: memberId },
        data: { pointsBalance: { increment: bonus } },
      }),
    ]);
    return "awarded";
  } catch {
    return "duplicate";
  }
}

/**
 * Grants win-back bonus points to an at-risk member (Loop v2 prediction action).
 * Records a PointsTransaction(reason="winback") and increments the balance.
 * @returns the balance after the grant (unchanged if bonus <= 0).
 */
export async function grantWinbackPoints(
  shopId: string,
  memberId: string,
  bonus: number,
): Promise<number> {
  const member = await db.member.findFirst({ where: { id: memberId, shopId } });
  if (!member) throw new Error("Member not found.");
  if (!Number.isFinite(bonus) || bonus <= 0) return member.pointsBalance;

  const [, updated] = await db.$transaction([
    db.pointsTransaction.create({
      data: { shopId, memberId, delta: bonus, reason: "winback" },
    }),
    db.member.update({
      where: { id: memberId },
      data: { pointsBalance: { increment: bonus } },
    }),
  ]);
  return updated.pointsBalance;
}

/**
 * Manually adjusts a member's points from the admin (+/-). Logs history with reason="adjust".
 * Clamps so the balance never goes negative, and only records the delta actually applied.
 * Scoped by shopId — other merchants' members can't be touched.
 *
 * @returns the balance after adjustment
 */
export async function adjustMemberPoints(params: {
  shopId: string;
  memberId: string;
  delta: number;
}): Promise<number> {
  const { shopId, memberId, delta } = params;
  const member = await db.member.findFirst({ where: { id: memberId, shopId } });
  if (!member) throw new Error("Member not found.");
  if (!Number.isFinite(delta) || delta === 0) return member.pointsBalance;

  const newBalance = Math.max(0, member.pointsBalance + delta);
  const realDelta = newBalance - member.pointsBalance; // reflects the clamp
  if (realDelta === 0) return member.pointsBalance;

  await db.$transaction([
    db.pointsTransaction.create({
      data: { shopId, memberId, delta: realDelta, reason: "adjust" },
    }),
    db.member.update({
      where: { id: memberId },
      data: { pointsBalance: newBalance },
    }),
  ]);
  return newBalance;
}
