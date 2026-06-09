import db from "../db.server";
import { ensureMember } from "./member.server";

export type RecordResult =
  | { ok: true }
  | { ok: false; reason: "invalid_code" | "self" | "already" };

/**
 * Registers a referral — called when a referee visits via the referral link (?ref=CODE) and then logs in.
 * Guards: valid code, no self-referral, once per referee.
 */
export async function recordReferral(
  shopId: string,
  referrerCode: string,
  refereeCustomerId: string,
  refereeEmail: string | null,
): Promise<RecordResult> {
  const referrer = await db.member.findFirst({
    where: { shopId, referralCode: referrerCode },
  });
  if (!referrer) return { ok: false, reason: "invalid_code" };

  const referee = await ensureMember(shopId, refereeCustomerId, refereeEmail);
  if (referee.id === referrer.id) return { ok: false, reason: "self" };

  // A referee can only be referred once.
  const existing = await db.referral.findFirst({
    where: { shopId, refereeMemberId: referee.id },
  });
  if (existing) return { ok: false, reason: "already" };

  await db.referral.create({
    data: {
      shopId,
      referrerMemberId: referrer.id,
      refereeMemberId: referee.id,
      status: "pending",
    },
  });
  return { ok: true };
}

/**
 * Called on the referee's first purchase — completes the pending referral and awards points to both parties.
 * Idempotent: an already-rewarded referral is left untouched.
 *
 * @returns whether it was completed and the points awarded
 */
export async function completeReferralOnPurchase(
  shopId: string,
  refereeMemberId: string,
  referralReward: number,
): Promise<{ completed: boolean; awarded: number }> {
  const ref = await db.referral.findFirst({
    where: { shopId, refereeMemberId, status: "pending", rewarded: false },
  });
  if (!ref || !ref.refereeMemberId) return { completed: false, awarded: 0 };

  const award = Math.max(0, Math.floor(referralReward));
  if (award === 0) {
    await db.referral.update({
      where: { id: ref.id },
      data: { status: "completed", rewarded: true },
    });
    return { completed: true, awarded: 0 };
  }

  await db.$transaction([
    db.referral.update({
      where: { id: ref.id },
      data: { status: "completed", rewarded: true },
    }),
    db.pointsTransaction.create({
      data: { shopId, memberId: ref.referrerMemberId, delta: award, reason: "referral" },
    }),
    db.member.update({
      where: { id: ref.referrerMemberId },
      data: { pointsBalance: { increment: award } },
    }),
    db.pointsTransaction.create({
      data: { shopId, memberId: ref.refereeMemberId, delta: award, reason: "referral" },
    }),
    db.member.update({
      where: { id: ref.refereeMemberId },
      data: { pointsBalance: { increment: award } },
    }),
  ]);
  return { completed: true, awarded: award };
}

/** Referral status list (admin). Scoped by shopId. */
export function listReferrals(shopId: string) {
  return db.referral.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { referrer: true, referee: true },
  });
}
