import db from "../db.server";
import {
  pointsEarnedEmail,
  rewardAvailableEmail,
} from "../lib/email/templates";

/**
 * Sends an email — if no provider is configured, logs to dev (no send); if RESEND_API_KEY is set, sends via Resend.
 * Uses only fetch, no external dependencies. Failures are silent (so the store flow isn't blocked).
 */
async function deliver(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:dev] to=${to} subject="${subject}" (provider not configured — not sent)`);
    return;
  }
  const from = process.env.EMAIL_FROM || "Loop <onboarding@resend.dev>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch (e) {
    console.log("[email] send failed:", e);
  }
}

/**
 * Notification after earning — only when the merchant has emails enabled and the member has an email.
 *  1) Earning notification.
 *  2) If this earning crosses the cheapest reward's redemption threshold for the first time, a "reward available" notification.
 */
export async function notifyAfterEarn(params: {
  shopId: string;
  memberId: string;
  pointsAdded: number;
  storeName: string;
}) {
  const setting = await db.setting.findUnique({
    where: { shopId: params.shopId },
  });
  if (!setting?.emailsEnabled) return;

  const member = await db.member.findFirst({
    where: { id: params.memberId, shopId: params.shopId },
  });
  if (!member?.email) return;

  const balance = member.pointsBalance;
  const earned = pointsEarnedEmail({
    storeName: params.storeName,
    points: params.pointsAdded,
    balance,
  });
  await deliver(member.email, earned.subject, earned.text);

  const cheapest = await db.reward.findFirst({
    where: { shopId: params.shopId, active: true },
    orderBy: { pointsCost: "asc" },
  });
  if (
    cheapest &&
    balance >= cheapest.pointsCost &&
    balance - params.pointsAdded < cheapest.pointsCost
  ) {
    const avail = rewardAvailableEmail({
      storeName: params.storeName,
      balance,
      rewardTitle: cheapest.title,
      rewardCost: cheapest.pointsCost,
    });
    await deliver(member.email, avail.subject, avail.text);
  }
}
