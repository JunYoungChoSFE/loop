/**
 * Issues a Shopify discount code (a single-use code on redemption).
 * Takes an injected admin GraphQL client and calls discountCodeBasicCreate /
 * discountCodeFreeShippingCreate. (requires the write_discounts scope)
 */

/** Structurally requires only admin.graphql (makes injecting a fake easy in tests). */
export interface AdminGraphql {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

export interface RewardLike {
  title: string;
  type: string; // fixed | percentage | free_shipping
  value: number;
}

export type IssueResult = { ok: true } | { ok: false; error: string };

const BASIC_MUTATION = `#graphql
  mutation loopDiscountBasic($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

const FREE_SHIPPING_MUTATION = `#graphql
  mutation loopDiscountFreeShipping($input: DiscountCodeFreeShippingInput!) {
    discountCodeFreeShippingCreate(freeShippingCodeDiscount: $input) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

function readUserErrors(
  json: unknown,
  field: string,
): IssueResult {
  const data = json as {
    data?: Record<string, { userErrors?: { message: string }[] }>;
    errors?: { message: string }[];
  };
  if (data.errors?.length) {
    return { ok: false, error: data.errors[0].message };
  }
  const errs = data.data?.[field]?.userErrors;
  if (errs?.length) {
    return { ok: false, error: errs[0].message };
  }
  return { ok: true };
}

export async function issueDiscountCode(
  admin: AdminGraphql,
  params: { code: string; reward: RewardLike; startsAt?: string },
): Promise<IssueResult> {
  const { code, reward } = params;
  const startsAt = params.startsAt ?? new Date().toISOString();

  if (reward.type === "free_shipping") {
    const res = await admin.graphql(FREE_SHIPPING_MUTATION, {
      variables: {
        input: {
          title: reward.title,
          code,
          startsAt,
          customerSelection: { all: true },
          destination: { all: true },
          appliesOncePerCustomer: true,
          usageLimit: 1,
        },
      },
    });
    return readUserErrors(await res.json(), "discountCodeFreeShippingCreate");
  }

  const value =
    reward.type === "percentage"
      ? { percentage: Math.min(1, Math.max(0, reward.value / 100)) }
      : {
          discountAmount: {
            amount: reward.value.toFixed(2),
            appliesOnEachItem: false,
          },
        };

  const res = await admin.graphql(BASIC_MUTATION, {
    variables: {
      input: {
        title: reward.title,
        code,
        startsAt,
        customerSelection: { all: true },
        customerGets: { value, items: { all: true } },
        appliesOncePerCustomer: true,
        usageLimit: 1,
      },
    },
  });
  return readUserErrors(await res.json(), "discountCodeBasicCreate");
}
