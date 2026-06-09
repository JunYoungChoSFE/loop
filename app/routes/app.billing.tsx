import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { ensureShop } from "../models/shop.server";
import {
  FREE_ORDER_LIMIT,
  monthlyAccrualCount,
  setPlan,
} from "../models/billing.server";

const isTest = process.env.NODE_ENV !== "production";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PRO_PLAN],
  });

  // Sync plan from the subscription state (single source of truth: Shopify Billing).
  const plan = hasActivePayment ? "pro" : "free";
  if (shop.plan !== plan) await setPlan(shop.id, plan);

  const used = await monthlyAccrualCount(shop.id);

  return {
    plan,
    used,
    limit: FREE_ORDER_LIMIT,
    subscriptionId: appSubscriptions?.[0]?.id ?? null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("_action");
  const appUrl = process.env.SHOPIFY_APP_URL || "";

  if (intent === "upgrade") {
    try {
      // On success this redirects (throws a Response) to the confirmationUrl.
      await billing.request({
        plan: PRO_PLAN,
        isTest,
        returnUrl: `${appUrl}/app/billing`,
      });
    } catch (e) {
      // Re-throw the normal redirect. Otherwise (a BillingError) surface the real cause.
      if (e instanceof Response) throw e;
      const err = e as { message?: string; errorData?: unknown };
      console.error("Billing failed:", err.message, err.errorData);
      return {
        error: `Could not start checkout: ${err.message ?? ""} ${JSON.stringify(err.errorData ?? "")}`,
      };
    }
  }

  if (intent === "cancel") {
    const subscriptionId = String(form.get("subscriptionId") || "");
    if (subscriptionId) {
      await billing.cancel({ subscriptionId, isTest, prorate: true });
      const shop = await ensureShop(session.shop);
      await setPlan(shop.id, "free");
    }
  }

  return { ok: true };
};

export default function Billing() {
  const { plan, used, limit, subscriptionId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const isPro = plan === "pro";
  const overLimit = !isPro && used >= limit;

  return (
    <s-page heading="Plan">
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading="Billing error">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Current plan">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-badge tone={isPro ? "success" : "neutral"}>
              {isPro ? "Pro" : "Free"}
            </s-badge>
            <s-text>{isPro ? "$19/mo · all features, unlimited orders" : "$0 · core features included"}</s-text>
          </s-stack>

          {!isPro && (
            <s-paragraph>
              Orders earning points this month: <s-text>{used.toLocaleString()}</s-text> /{" "}
              {limit.toLocaleString()}
            </s-paragraph>
          )}

          {overLimit && (
            <s-banner tone="warning" heading="You've reached this month's free limit">
              <s-paragraph>
                Your core features keep working. Upgrade to Pro to keep earning
                points on additional orders.
              </s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading={isPro ? "Manage subscription" : "Upgrade to Pro"}>
        {isPro ? (
          <Form method="post">
            <input type="hidden" name="_action" value="cancel" />
            <input type="hidden" name="subscriptionId" value={subscriptionId ?? ""} />
            <s-stack direction="block" gap="base">
              <s-paragraph>Cancel anytime. No hidden costs.</s-paragraph>
              <s-button type="submit" tone="critical" variant="tertiary">
                Cancel subscription
              </s-button>
            </s-stack>
          </Form>
        ) : (
          <Form method="post">
            <input type="hidden" name="_action" value="upgrade" />
            <s-stack direction="block" gap="base">
              <s-paragraph>
                $19/month flat. No order-count penalty, no hidden costs.
              </s-paragraph>
              <s-button type="submit" variant="primary">
                Start Pro
              </s-button>
            </s-stack>
          </Form>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
