import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { recordReferral } from "../models/referral.server";

/**
 * App Proxy referral endpoint — called by the widget when it detects ?ref=CODE and the visitor is logged in.
 * Storefront /apps/loop/refer is proxied here (/proxy/refer).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const customerId = new URL(request.url).searchParams.get(
    "logged_in_customer_id",
  );
  if (!customerId) {
    return Response.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { ref?: string };
  const ref = String(body.ref ?? "").trim();
  if (!ref) {
    return Response.json({ ok: false, error: "no_code" }, { status: 400 });
  }

  const shop = await ensureShop(session.shop);
  const result = await recordReferral(shop.id, ref, customerId, null);
  return Response.json(result, { status: result.ok ? 200 : 200 });
};
