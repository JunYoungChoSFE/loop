import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { setPlan } from "../models/billing.server";

/**
 * app_subscriptions/update webhook — sync the plan when subscription status changes.
 * ACTIVE means pro; anything else (cancelled/expired/paused, etc.) means free.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const status = (payload as { app_subscription?: { status?: string } })
    .app_subscription?.status;

  const shopRecord = await ensureShop(shop);
  await setPlan(shopRecord.id, status === "ACTIVE" ? "pro" : "free");

  return new Response();
};
