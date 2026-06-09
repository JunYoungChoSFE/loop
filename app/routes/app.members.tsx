import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { listMembers } from "../models/member.server";
import { adjustMemberPoints } from "../models/points.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const members = await listMembers(shop.id, q);
  return {
    q,
    members: members.map((m) => ({
      id: m.id,
      who: m.email || m.shopifyCustomerId || "—",
      balance: m.pointsBalance,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const form = await request.formData();

  if (form.get("_action") === "adjust") {
    const memberId = String(form.get("memberId"));
    const delta = Number(form.get("delta"));
    if (!Number.isFinite(delta) || delta === 0) {
      return { error: "Enter a non-zero adjustment." };
    }
    const newBalance = await adjustMemberPoints({
      shopId: shop.id,
      memberId,
      delta,
    });
    return { ok: `Balance adjusted to ${newBalance.toLocaleString()} pt.` };
  }
  return { error: "Unknown request." };
};

export default function Members() {
  const { q, members } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Members">
      {actionData && "ok" in actionData && actionData.ok && (
        <s-banner tone="success" heading={actionData.ok} />
      )}
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading={actionData.error} />
      )}

      <s-section heading={`Members (${members.length})`}>
        <Form method="get">
          <s-stack direction="inline" gap="base" alignItems="end">
            <s-search-field
              name="q"
              label="Search"
              value={q}
              placeholder="Email or customer ID"
            />
            <s-button type="submit">Search</s-button>
          </s-stack>
        </Form>

        <s-box paddingBlockStart="base">
          {members.length === 0 ? (
            <s-paragraph>
              {q
                ? "No results."
                : "No members yet. They are added automatically when customers place orders."}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Customer</s-table-header>
                <s-table-header>Balance</s-table-header>
                <s-table-header>Adjust points</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {members.map((m) => (
                  <s-table-row key={m.id}>
                    <s-table-cell>{m.who}</s-table-cell>
                    <s-table-cell>{m.balance.toLocaleString()} pt</s-table-cell>
                    <s-table-cell>
                      <Form method="post">
                        <input type="hidden" name="_action" value="adjust" />
                        <input type="hidden" name="memberId" value={m.id} />
                        <s-stack direction="inline" gap="small" alignItems="end">
                          <s-number-field
                            name="delta"
                            label="± points"
                            value="0"
                            step={1}
                          />
                          <s-button type="submit">Apply</s-button>
                        </s-stack>
                      </Form>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
