import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ensureShop } from "../models/shop.server";

/** Badge color per earn reason. */
const REASON_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  purchase: "success",
  signup: "info",
  referral: "info",
  redeem: "warning",
  adjust: "neutral",
};

function formatWhen(d: Date): string {
  // Format on the server with a fixed format to avoid hydration mismatches.
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const [memberCount, issuedAgg, recent] = await Promise.all([
    db.member.count({ where: { shopId: shop.id } }),
    db.pointsTransaction.aggregate({
      where: { shopId: shop.id, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    db.pointsTransaction.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { member: true },
    }),
  ]);

  return {
    plan: shop.plan,
    memberCount,
    pointsIssued: issuedAgg._sum.delta ?? 0,
    earnRate: shop.setting?.earnRate ?? 1,
    recent: recent.map((t) => ({
      id: t.id,
      when: formatWhen(t.createdAt),
      who: t.member.email || t.member.shopifyCustomerId || "—",
      reason: t.reason,
      delta: t.delta,
    })),
  };
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

export default function Dashboard() {
  const { plan, memberCount, pointsIssued, earnRate, recent } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Roost dashboard">
      <s-button slot="primary-action" href="/app/settings" variant="primary">
        Settings
      </s-button>

      <s-section heading="Overview">
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <StatCard label="Members" value={memberCount.toLocaleString()} />
          <StatCard
            label="Points issued (total)"
            value={pointsIssued.toLocaleString()}
          />
          <StatCard label="Earn rate" value={`$1 = ${earnRate} pt`} />
        </s-grid>
      </s-section>

      <s-section heading="Recent activity">
        {recent.length === 0 ? (
          <s-paragraph>
            No points activity yet. It will show up here once customers place
            orders.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Time (UTC)</s-table-header>
              <s-table-header>Customer</s-table-header>
              <s-table-header>Reason</s-table-header>
              <s-table-header>Points</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {recent.map((t) => (
                <s-table-row key={t.id}>
                  <s-table-cell>{t.when}</s-table-cell>
                  <s-table-cell>{t.who}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={REASON_TONE[t.reason] ?? "neutral"}>
                      {t.reason}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {t.delta > 0 ? `+${t.delta}` : t.delta}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-stack direction="block" gap="small">
          <s-badge tone={plan === "pro" ? "success" : "neutral"}>
            {plan === "pro" ? "Pro" : "Free"}
          </s-badge>
          <s-paragraph>
            One honest flat price. No paywall on core features.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
