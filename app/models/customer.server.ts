/**
 * Fetch a Shopify customer's email by numeric customer ID, via the Admin GraphQL API.
 * Used to backfill a member's email when it was created lazily from the storefront
 * widget (the App Proxy only gives us the customer ID, not the email), so merchants
 * see a recognizable email in the Members list instead of a bare numeric ID.
 * Requires the read_customers scope.
 */
import type { AdminGraphql } from "./discount.server";

const CUSTOMER_EMAIL_QUERY = `#graphql
  query loopCustomerEmail($id: ID!) {
    customer(id: $id) {
      email
    }
  }`;

export async function fetchCustomerEmail(
  admin: AdminGraphql,
  shopifyCustomerId: string,
): Promise<string | null> {
  try {
    const res = await admin.graphql(CUSTOMER_EMAIL_QUERY, {
      variables: { id: `gid://shopify/Customer/${shopifyCustomerId}` },
    });
    const json = (await res.json()) as {
      data?: { customer?: { email?: string | null } | null };
    };
    return json.data?.customer?.email ?? null;
  } catch {
    // Never break the storefront widget over a missing email lookup.
    return null;
  }
}
