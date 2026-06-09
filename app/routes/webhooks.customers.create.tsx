import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { ensureMember } from "../models/member.server";
import { awardSignupBonus } from "../models/points.server";

/**
 * customers/create webhook → award account-creation bonus (spec section 5, CLAUDE.md).
 * Ensures the member exists and pays out the shop's signupBonus only once (idempotent).
 *
 * ⚠️ customers/create is also a protected customer data (PCD) topic, so before PCD
 *    approval the toml subscription is commented out (same as orders/create). Activate
 *    them together after approval.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const customer = payload as { id?: number | string; email?: string | null };
  const customerId = customer.id != null ? String(customer.id) : null;
  if (!customerId) return new Response();

  const shopRecord = await ensureShop(shop);
  const member = await ensureMember(
    shopRecord.id,
    customerId,
    customer.email ?? null,
  );
  const result = await awardSignupBonus(
    shopRecord.id,
    member.id,
    shopRecord.setting?.signupBonus ?? 0,
  );

  console.log(`Signup bonus [${result}] → member ${member.id}`);
  return new Response();
};
