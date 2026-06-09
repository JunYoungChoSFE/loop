import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../models/shop.server";
import { redeemReward } from "../models/redeem.server";
import { issueDiscountCode } from "../models/discount.server";

/**
 * App Proxy redeem endpoint — called by the storefront widget (Phase 4).
 * Storefront /apps/loop/redeem is proxied here (/proxy/redeem). Shopify signs the
 * request, and authenticate.public.appProxy validates it + gives the shop session/admin client.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Only logged-in storefront customers can redeem.
  const customerId = new URL(request.url).searchParams.get(
    "logged_in_customer_id",
  );
  if (!customerId) {
    return Response.json(
      { ok: false, error: "Please log in." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { rewardId?: string };
  const rewardId = String(body.rewardId ?? "");
  if (!rewardId) {
    return Response.json(
      { ok: false, error: "Select a reward." },
      { status: 400 },
    );
  }

  const shop = await ensureShop(session.shop);
  const member = await db.member.findFirst({
    where: { shopId: shop.id, shopifyCustomerId: customerId },
  });
  if (!member) {
    return Response.json(
      { ok: false, error: "Member not found." },
      { status: 404 },
    );
  }

  const result = await redeemReward({
    shopId: shop.id,
    memberId: member.id,
    rewardId,
    issue: (code, reward) => issueDiscountCode(admin, { code, reward }),
  });

  return Response.json(result, { status: result.ok ? 200 : 400 });
};
