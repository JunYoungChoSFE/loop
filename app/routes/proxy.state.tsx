import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { ensureMember } from "../models/member.server";
import { listRewards } from "../models/reward.server";

/**
 * App Proxy state endpoint — called by the storefront widget on load.
 * Storefront /apps/loop/state is proxied here (/proxy/state).
 * Returns the current points, redeemable rewards, and widget settings (color/position).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const shop = await ensureShop(session.shop);
  const rewards = await listRewards(shop.id);

  const customerId = new URL(request.url).searchParams.get(
    "logged_in_customer_id",
  );
  // Ensure a member for logged-in customers (assigns a referral code) so the widget can share the link right away.
  const member = customerId
    ? await ensureMember(shop.id, customerId, null)
    : null;

  return Response.json({
    ok: true,
    loggedIn: Boolean(customerId),
    points: member?.pointsBalance ?? 0,
    referralCode: member?.referralCode ?? null,
    referralReward: shop.setting?.referralReward ?? 0,
    settings: {
      color: shop.setting?.widgetColor ?? "#000000",
      position: shop.setting?.widgetPosition ?? "bottom-right",
    },
    rewards: rewards
      .filter((r) => r.active)
      .map((r) => ({
        id: r.id,
        title: r.title,
        pointsCost: r.pointsCost,
        type: r.type,
        value: r.value,
      })),
  });
};
