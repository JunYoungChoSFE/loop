import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { listReferrals } from "../models/referral.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const referrals = await listReferrals(shop.id);
  return {
    referrals: referrals.map((r) => ({
      id: r.id,
      referrer: r.referrer?.email || r.referrer?.shopifyCustomerId || "—",
      referee: r.referee?.email || r.referee?.shopifyCustomerId || "—",
      status: r.status,
      createdAt: r.createdAt.toISOString().slice(0, 10),
    })),
  };
};

export default function Referrals() {
  const { referrals } = useLoaderData<typeof loader>();
  const completed = referrals.filter((r) => r.status === "completed").length;

  return (
    <s-page heading="Referrals">
      <s-section heading={`Referrals (${completed} completed / ${referrals.length} total)`}>
        {referrals.length === 0 ? (
          <s-paragraph>
            No referrals yet. They show up here once customers share their
            referral link from the widget.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Referrer</s-table-header>
              <s-table-header>Referee</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {referrals.map((r) => (
                <s-table-row key={r.id}>
                  <s-table-cell>{r.referrer}</s-table-cell>
                  <s-table-cell>{r.referee}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={r.status === "completed" ? "success" : "neutral"}>
                      {r.status === "completed" ? "Completed" : "Pending"}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{r.createdAt}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
