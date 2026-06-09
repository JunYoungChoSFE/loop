import db from "../db.server";

/**
 * Data deletion for GDPR / clean uninstall (CLAUDE.md guardrail 3, section 7).
 * Deleting a Shop/Member also cleans up children (settings, points, referrals) via onDelete: Cascade.
 */

/** Deletes a specific customer's data (customers/redact). Removes the member and their points history. */
export async function redactCustomer(
  shopDomain: string,
  shopifyCustomerId: string,
) {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return;
  // Deleting the Member cleans up PointsTransaction (cascade) and Referral (referrer cascade / referee setNull).
  await db.member.deleteMany({
    where: { shopId: shop.id, shopifyCustomerId },
  });
}

/** Completely deletes all of a merchant's data (shop/redact, app/uninstalled). Zero trace. */
export async function purgeShop(shopDomain: string) {
  await db.shop.deleteMany({ where: { shopDomain } });
}

/**
 * For responding to a customer data request (customers/data_request) — the data we retain.
 * Loop retains only email, points balance, and transaction history (minimal collection).
 */
export async function collectCustomerData(
  shopDomain: string,
  shopifyCustomerId: string,
) {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return null;
  const member = await db.member.findFirst({
    where: { shopId: shop.id, shopifyCustomerId },
    include: { transactions: true, prediction: true },
  });
  if (!member) return null;
  return {
    email: member.email,
    pointsBalance: member.pointsBalance,
    transactions: member.transactions.map((t) => ({
      delta: t.delta,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
    // Prediction scores are derived customer data — disclosed on request (deleted on redact via cascade).
    prediction: member.prediction
      ? {
          pAlive: member.prediction.pAlive,
          expectedNextDate: member.prediction.expectedNextDate?.toISOString() ?? null,
          predictedClv: member.prediction.predictedClv,
          riskFlag: member.prediction.riskFlag,
          source: member.prediction.predictionSource,
        }
      : null,
  };
}
