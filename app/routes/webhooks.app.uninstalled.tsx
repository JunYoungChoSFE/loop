import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { purgeShop } from "../models/gdpr.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean uninstall (guardrail 3): completely remove the shop's data so no trace is left behind.
  // The widget is a Theme App Extension, so Shopify removes it automatically on uninstall — no injected scripts.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  await purgeShop(shop);

  return new Response();
};
