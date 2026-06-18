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
  createReward,
  deleteReward,
  listRewards,
} from "../models/reward.server";

const REWARD_TYPES = [
  { value: "fixed", label: "Fixed amount off" },
  { value: "percentage", label: "Percentage off" },
  { value: "free_shipping", label: "Free shipping" },
];

const POSITIONS = [
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

// What the store sells → cold-start reorder prediction prior (categoryPriors.ts).
// Merchant-facing labels; values must match CATEGORY_PRIOR_DAYS keys.
const CATEGORIES = [
  { value: "", label: "Not sure / mixed" },
  { value: "consumables", label: "Supplements, coffee, household refills" },
  { value: "cosmetics", label: "Skincare & cosmetics" },
  { value: "food", label: "Food & snacks" },
  { value: "fashion", label: "Apparel & fashion" },
  { value: "durables", label: "Electronics & durables" },
];

function num(form: FormData, key: string, fallback = 0): number {
  const n = Number(form.get(key));
  return Number.isFinite(n) ? n : fallback;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const rewards = await listRewards(shop.id);
  return { setting: shop.setting!, rewards };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);
  const form = await request.formData();
  const intent = form.get("_action");

  if (intent === "saveSettings") {
    // Update only the fields that were submitted (per-form partial save).
    const patch: Parameters<typeof updateSettings>[1] = {};
    if (form.has("earnRate")) patch.earnRate = Math.max(0, num(form, "earnRate", 1));
    if (form.has("signupBonus")) patch.signupBonus = Math.max(0, Math.floor(num(form, "signupBonus")));
    if (form.has("referralReward")) patch.referralReward = Math.max(0, Math.floor(num(form, "referralReward")));
    if (form.has("widgetColor")) patch.widgetColor = String(form.get("widgetColor") || "#000000").trim();
    if (form.has("widgetPosition")) patch.widgetPosition = String(form.get("widgetPosition") || "bottom-right");
    // Empty select value clears the vertical (back to the default prior).
    if (form.has("category")) {
      const c = String(form.get("category") || "");
      patch.category = c === "" ? null : c;
    }
    // An unchecked checkbox is omitted from the form, so only decide it when the marker (_emailsForm) is present.
    if (form.has("_emailsForm")) patch.emailsEnabled = form.has("emailsEnabled");
    await updateSettings(shop.id, patch);
    return { ok: "Settings saved." };
  }

  if (intent === "createReward") {
    const title = String(form.get("title") || "").trim();
    if (!title) return { error: "Enter a reward name." };
    await createReward(shop.id, {
      title,
      pointsCost: Math.max(0, Math.floor(num(form, "pointsCost"))),
      type: String(form.get("type") || "fixed"),
      value: Math.max(0, num(form, "value")),
    });
    return { ok: "Reward added." };
  }

  if (intent === "deleteReward") {
    await deleteReward(shop.id, String(form.get("rewardId")));
    return { ok: "Reward deleted." };
  }

  return { error: "Unknown request." };
};

export default function Settings() {
  const { setting, rewards } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  return (
    <s-page heading="Settings">
      {actionData && "ok" in actionData && actionData.ok && (
        <s-banner tone="success" heading={actionData.ok} />
      )}
      {actionData && "error" in actionData && actionData.error && (
        <s-banner tone="critical" heading={actionData.error} />
      )}

      <s-section heading="Your store">
        <Form method="post">
          <input type="hidden" name="_action" value="saveSettings" />
          <s-stack direction="block" gap="base">
            <s-select
              name="category"
              label="What do you sell?"
              value={setting.category ?? ""}
              details="Helps Roost predict when customers are due to reorder — even before you have much history. Most useful for products people buy on a cycle."
            >
              {CATEGORIES.map((c) => (
                <s-option key={c.value} value={c.value}>
                  {c.label}
                </s-option>
              ))}
            </s-select>
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Earning rules">
        <Form method="post">
          <input type="hidden" name="_action" value="saveSettings" />
          <s-stack direction="block" gap="base">
            <s-number-field
              name="earnRate"
              label="Earn rate (points per currency unit)"
              value={String(setting.earnRate)}
              min={0}
              step={0.1}
              suffix="pt / $1"
              details="Example: 1 → 1 point per $1 spent"
            />
            <s-number-field
              name="signupBonus"
              label="Signup bonus points"
              value={String(setting.signupBonus)}
              min={0}
              step={1}
            />
            <s-number-field
              name="referralReward"
              label="Referral reward points (each side)"
              value={String(setting.referralReward)}
              min={0}
              step={1}
            />
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Widget appearance">
        <Form method="post">
          <input type="hidden" name="_action" value="saveSettings" />
          <s-stack direction="block" gap="base">
            <s-text-field
              name="widgetColor"
              label="Brand color (HEX)"
              value={setting.widgetColor}
              placeholder="#000000"
              details="The widget displays neatly in this color — no custom CSS needed."
            />
            <s-select
              name="widgetPosition"
              label="Widget position"
              value={setting.widgetPosition}
            >
              {POSITIONS.map((p) => (
                <s-option key={p.value} value={p.value}>
                  {p.label}
                </s-option>
              ))}
            </s-select>
            <s-button type="submit" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Email notifications">
        <Form method="post">
          <input type="hidden" name="_action" value="saveSettings" />
          <input type="hidden" name="_emailsForm" value="1" />
          <s-stack direction="block" gap="base">
            <s-checkbox
              name="emailsEnabled"
              label="Email customers when they earn points or unlock a reward"
              details="Simple transactional notifications only. Not marketing."
              {...(setting.emailsEnabled ? { checked: true } : {})}
            />
            <s-button type="submit" {...(saving ? { loading: true } : {})}>
              Save
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Rewards">
        {rewards.length === 0 ? (
          <s-paragraph>No rewards yet. Add one below.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Points cost</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Value</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rewards.map((r) => (
                <s-table-row key={r.id}>
                  <s-table-cell>{r.title}</s-table-cell>
                  <s-table-cell>{r.pointsCost.toLocaleString()}</s-table-cell>
                  <s-table-cell>
                    {REWARD_TYPES.find((t) => t.value === r.type)?.label ??
                      r.type}
                  </s-table-cell>
                  <s-table-cell>
                    {r.type === "free_shipping"
                      ? "—"
                      : r.type === "percentage"
                        ? `${r.value}%`
                        : `$${r.value}`}
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="_action" value="deleteReward" />
                      <input type="hidden" name="rewardId" value={r.id} />
                      <s-button type="submit" variant="tertiary" tone="critical">
                        Delete
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        <s-box paddingBlockStart="base">
          <Form method="post">
            <input type="hidden" name="_action" value="createReward" />
            <s-stack direction="block" gap="base">
              <s-text-field name="title" label="Reward name" placeholder="e.g. $5 off" required />
              <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                <s-number-field name="pointsCost" label="Points cost" value="100" min={0} step={1} />
                <s-select name="type" label="Type" value="fixed">
                  {REWARD_TYPES.map((t) => (
                    <s-option key={t.value} value={t.value}>
                      {t.label}
                    </s-option>
                  ))}
                </s-select>
                <s-number-field name="value" label="Value (amount / %)" value="5" min={0} step={0.5} />
              </s-grid>
              <s-button type="submit" variant="primary">
                Add reward
              </s-button>
            </s-stack>
          </Form>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
