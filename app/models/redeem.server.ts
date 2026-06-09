import db from "../db.server";
import { canRedeem } from "../lib/points/redeem";
import type { IssueResult } from "./discount.server";

export type RedeemResult =
  | { ok: true; code: string; reward: { title: string; pointsCost: number } }
  | { ok: false; error: string };

/** One-time code without easily-confused characters (0/O, 1/I). */
function defaultCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `LOOP-${s}`;
}

/**
 * Redeem points for a discount code (CLAUDE.md section 5).
 *
 * Order (compensating transaction):
 *  1) Validate: reward/member exist (shopId-scoped), active, enough balance.
 *  2) Atomic reserve: updateMany(pointsBalance >= cost) deducts — prevents concurrent / double redemption.
 *  3) Issue the discount code (injected issue). On failure, refund the deduction; no incomplete redemption is recorded.
 *  4) On success, record PointsTransaction(-) for the deduction.
 *
 * @param issue code issuer (injected). Real one is issueDiscountCode(admin, ...); tests pass a fake.
 */
export async function redeemReward(params: {
  shopId: string;
  memberId: string;
  rewardId: string;
  issue: (
    code: string,
    reward: { title: string; type: string; value: number },
  ) => Promise<IssueResult>;
  genCode?: () => string;
}): Promise<RedeemResult> {
  const { shopId, memberId, rewardId, issue } = params;

  const reward = await db.reward.findFirst({
    where: { id: rewardId, shopId, active: true },
  });
  if (!reward) return { ok: false, error: "Reward not found." };

  const member = await db.member.findFirst({ where: { id: memberId, shopId } });
  if (!member) return { ok: false, error: "Member not found." };

  if (!canRedeem(member.pointsBalance, reward.pointsCost)) {
    return { ok: false, error: "Not enough points." };
  }

  // Atomic reserve: deduction only succeeds when the balance is sufficient. Only one concurrent request wins.
  const reserved = await db.member.updateMany({
    where: { id: memberId, shopId, pointsBalance: { gte: reward.pointsCost } },
    data: { pointsBalance: { decrement: reward.pointsCost } },
  });
  if (reserved.count === 0) return { ok: false, error: "Not enough points." };

  const code = (params.genCode ?? defaultCode)();
  const issued = await issue(code, {
    title: reward.title,
    type: reward.type,
    value: reward.value,
  });

  if (!issued.ok) {
    // Issuance failed → refund the deduction. Only completed redemptions are recorded in the ledger.
    await db.member.update({
      where: { id: memberId },
      data: { pointsBalance: { increment: reward.pointsCost } },
    });
    return { ok: false, error: issued.error || "Failed to issue discount code." };
  }

  await db.pointsTransaction.create({
    data: { shopId, memberId, delta: -reward.pointsCost, reason: "redeem" },
  });

  return {
    ok: true,
    code,
    reward: { title: reward.title, pointsCost: reward.pointsCost },
  };
}
