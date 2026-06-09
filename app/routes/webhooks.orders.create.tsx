import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { ensureMember } from "../models/member.server";
import { creditPurchasePoints } from "../models/points.server";
import { completeReferralOnPurchase } from "../models/referral.server";
import { notifyAfterEarn } from "../models/email.server";
import {
  FREE_ORDER_LIMIT,
  canAccrue,
  monthlyAccrualCount,
} from "../models/billing.server";
import { calculateEarnedPoints } from "../lib/points/earn";

/**
 * orders/create webhook → award points (CLAUDE.md section 5 earn flow).
 * Order total × shop earn rate → PointsTransaction(+) → increment member balance.
 * Guest orders (no customer) and 0-point orders are safely skipped. Duplicate webhooks are idempotent.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const order = payload as {
    id: number | string;
    total_price?: string;
    customer?: { id?: number | string; email?: string | null } | null;
  };

  // Guest checkout (no customer) is not eligible for points.
  const customerId = order.customer?.id != null ? String(order.customer.id) : null;
  if (!customerId) {
    console.log("Order has no customer; skipping accrual (guest checkout)");
    return new Response();
  }

  const orderId = String(order.id);
  const orderTotal = parseFloat(order.total_price ?? "0");

  // Load shop + settings (create if missing) and compute points from the earn rate.
  const shopRecord = await ensureShop(shop);
  const earnRate = shopRecord.setting?.earnRate ?? 1;
  const points = calculateEarnedPoints(orderTotal, earnRate);
  if (points <= 0) {
    console.log(`0 points (total=${orderTotal}, rate=${earnRate}) — skipping`);
    return new Response();
  }

  // Free plan monthly order-limit gating (the only free→paid boundary). Core features are never locked.
  const monthly = await monthlyAccrualCount(shopRecord.id);
  if (!canAccrue(shopRecord.plan, monthly)) {
    console.log(
      `Free limit (${FREE_ORDER_LIMIT}) reached — accrual paused. Resumes on Pro upgrade.`,
    );
    return new Response();
  }

  // Ensure the member, then award idempotently.
  const member = await ensureMember(
    shopRecord.id,
    customerId,
    order.customer?.email ?? null,
  );
  const result = await creditPurchasePoints({
    shopId: shopRecord.id,
    memberId: member.id,
    points,
    orderId,
  });

  console.log(`Order ${orderId}: ${points}pt [${result}] → member ${member.id}`);

  // Notify only when actually credited (skip duplicate webhooks). Ignore send failures.
  if (result === "credited") {
    try {
      await notifyAfterEarn({
        shopId: shopRecord.id,
        memberId: member.id,
        pointsAdded: points,
        storeName: shop,
      });
    } catch (e) {
      console.log("Earn notification email failed:", e);
    }
  }

  // If a referral is pending for this member's first purchase, complete it + reward both sides (idempotent).
  const referral = await completeReferralOnPurchase(
    shopRecord.id,
    member.id,
    shopRecord.setting?.referralReward ?? 0,
  );
  if (referral.completed) {
    console.log(`Referral completed: ${referral.awarded}pt to each side (referee ${member.id})`);
  }

  return new Response();
};
