import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import { updateSettings } from "../models/settings.server";
import {
  recomputePredictionsForShop,
  getPredictionSummary,
  type PredictionRow,
} from "../models/prediction.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const isPro = shop.plan === "pro";

  // Recompute on load so the merchant always sees fresh predictions (the nightly
  // batch handles automatic actions; this keeps the dashboard never-stale).
  await recomputePredictionsForShop(shop.id);
  const summary = await getPredictionSummary(shop.id);

  // Free plan gets the aggregate outlook — real counts, an honest teaser, no fake
  // urgency (guardrail 2). The named customer lists and automatic actions are the
  // Pro value, so strip the lists server-side: they're never shipped to a Free
  // client. The counts above stay so the merchant sees the value they'd unlock.
  if (!isPro) {
    summary.imminent = [];
    summary.atRisk = [];
  }

  const s = shop.setting!;
  return {
    isPro,
    summary,
    actions: {
      reminderEnabled: s.reminderEnabled,
      winbackEnabled: s.winbackEnabled,
      winbackPoints: s.winbackPoints,
      highvalueAlertEnabled: s.highvalueAlertEnabled,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  // Automatic actions are a Pro feature — enforce server-side, not just by hiding
  // the form, so a direct POST can't enable paid automation on a Free plan.
  if (shop.plan !== "pro") {
    return { error: "Automatic actions are part of the Pro plan." };
  }

  const form = await request.formData();

  // Checkboxes are omitted when unchecked, so booleans are derived from presence.
  const winbackPoints = Math.max(
    0,
    Math.floor(Number(form.get("winbackPoints")) || 0),
  );
  await updateSettings(shop.id, {
    reminderEnabled: form.has("reminderEnabled"),
    winbackEnabled: form.has("winbackEnabled"),
    winbackPoints,
    highvalueAlertEnabled: form.has("highvalueAlertEnabled"),
  });
  return { ok: "Automatic actions saved." };
};

function fmtClv(v: number | null): string {
  return v != null ? `$${v.toFixed(0)}` : "—";
}
function fmtAlive(v: number | null): string {
  return v != null ? `${Math.round(v * 100)}%` : "—";
}

function CustomerTable({
  rows,
  showRisk,
}: {
  rows: PredictionRow[];
  showRisk: boolean;
}) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header>Customer</s-table-header>
        <s-table-header>Expected next order</s-table-header>
        {showRisk ? <s-table-header>Alive</s-table-header> : null}
        {showRisk ? <s-table-header>Est. value</s-table-header> : null}
        <s-table-header>Basis</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((r) => (
          <s-table-row key={r.memberId}>
            <s-table-cell>
              {r.email || r.shopifyCustomerId || "—"}
            </s-table-cell>
            <s-table-cell>{r.expectedNextDate ?? "—"}</s-table-cell>
            {showRisk ? <s-table-cell>{fmtAlive(r.pAlive)}</s-table-cell> : null}
            {showRisk ? (
              <s-table-cell>{fmtClv(r.predictedClv)}</s-table-cell>
            ) : null}
            <s-table-cell>
              <s-badge tone="neutral">{r.confidenceLabel}</s-badge>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

export default function Predictions() {
  const { isPro, summary, actions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <s-page heading="Predictions">
      {actionData && "ok" in actionData && actionData.ok && (
        <s-banner tone="success" heading={actionData.ok} />
      )}
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading={actionData.error} />
      )}

      <s-section heading="Repurchase outlook">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-text color="subdued">🔁 Repurchase imminent</s-text>
              <s-heading>{summary.imminentCount.toLocaleString()}</s-heading>
            </s-stack>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="small-200">
              <s-text color="subdued">⚠️ Churn risk</s-text>
              <s-heading>{summary.riskCount.toLocaleString()}</s-heading>
            </s-stack>
          </s-box>
        </s-grid>
        <s-box paddingBlockStart="small">
          <s-text color="subdued">
            {summary.predicted.toLocaleString()} customers scored
            {summary.lastComputedAt
              ? ` · updated ${summary.lastComputedAt.slice(0, 16).replace("T", " ")} UTC`
              : ""}
          </s-text>
        </s-box>
      </s-section>

      {!isPro && (
        <s-section heading="See who they are — and act on it">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Pro unlocks the named customer lists behind these numbers — exactly
              who's due to reorder and who's drifting away — plus automatic
              reminders and point-based win-backs that run for you every night.
              The counts above are real; Pro turns them into action.
            </s-paragraph>
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-button href="/app/billing" variant="primary">
                See the Pro plan
              </s-button>
              <s-text color="subdued">$19/mo flat · cancel anytime</s-text>
            </s-stack>
          </s-stack>
        </s-section>
      )}

      {isPro && (
      <>
      <s-section heading="Automatic actions">
        <s-paragraph>
          All off by default. Roost only acts with your consent, and every nudge
          carries real value — no fake urgency, no fake scarcity.
        </s-paragraph>
        <Form method="post">
          <s-stack direction="block" gap="base">
            <s-checkbox
              name="reminderEnabled"
              label="Send a gentle reminder when a repurchase is due"
              details="One low-key email to the customer around their expected reorder time."
              {...(actions.reminderEnabled ? { checked: true } : {})}
            />
            <s-checkbox
              name="winbackEnabled"
              label="Win back at-risk customers with bonus points"
              details="Grants real points (below) to customers predicted to be drifting away."
              {...(actions.winbackEnabled ? { checked: true } : {})}
            />
            <s-number-field
              name="winbackPoints"
              label="Win-back bonus points"
              value={String(actions.winbackPoints)}
              min={0}
              step={1}
            />
            <s-checkbox
              name="highvalueAlertEnabled"
              label="Email me when a high-value customer is at risk"
              details="A short digest to you (the store owner) — not the customer."
              {...(actions.highvalueAlertEnabled ? { checked: true } : {})}
            />
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Repurchase imminent">
        {summary.imminent.length === 0 ? (
          <s-paragraph>
            No customers are due to reorder right now. This fills in as customers
            build up purchase history.
          </s-paragraph>
        ) : (
          <CustomerTable rows={summary.imminent} showRisk={false} />
        )}
      </s-section>

      <s-section heading="At risk of churning">
        {summary.atRisk.length === 0 ? (
          <s-paragraph>No at-risk customers detected.</s-paragraph>
        ) : (
          <CustomerTable rows={summary.atRisk} showRisk={true} />
        )}
      </s-section>
      </>
      )}

      <s-section slot="aside" heading="How this works">
        <s-paragraph>
          Roost estimates each customer's next order from their own purchase
          rhythm. New shops start from category baselines; once a customer has a
          couple of orders the estimate personalizes automatically. Predictions
          are a convenience, not a guarantee — the basis column shows the
          confidence behind each one.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
