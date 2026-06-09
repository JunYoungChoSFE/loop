import db from "../db.server";

/**
 * Free plan monthly order limit — generous (spec section 7). The only free-to-paid gating point.
 * Core features (earning, redemption, widget) are never locked (guardrails 1 & 2). Only the limit.
 */
export const FREE_ORDER_LIMIT = 200;

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Number of orders credited this month (based on purchase transactions). */
export function monthlyAccrualCount(shopId: string): Promise<number> {
  return db.pointsTransaction.count({
    where: {
      shopId,
      reason: "purchase",
      createdAt: { gte: startOfMonthUtc() },
    },
  });
}

/** Whether earning is allowed — Pro is unlimited, Free is up to the monthly limit. */
export function canAccrue(plan: string, monthlyCount: number): boolean {
  return plan === "pro" || monthlyCount < FREE_ORDER_LIMIT;
}

export function setPlan(shopId: string, plan: "free" | "pro") {
  return db.shop.update({ where: { id: shopId }, data: { plan } });
}
