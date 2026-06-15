import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Roost — Honest Loyalty &amp; Rewards</h1>
        <p className={styles.text}>
          Points, rewards &amp; referrals for small Shopify stores. Five-minute
          setup, one flat price, zero hidden costs and zero dark patterns.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Points &amp; rewards</strong>. Customers earn on every order
            and redeem points for a single-use discount, right in your
            storefront — in your brand color, no code.
          </li>
          <li>
            <strong>Built-in referrals</strong>. Reward both the referrer and
            the referred customer once. No second app needed.
          </li>
          <li>
            <strong>Repurchase &amp; churn predictions</strong>. See who is
            about to reorder or drift away, with confidence shown. Every
            automatic action is off by default.
          </li>
        </ul>
      </div>
    </div>
  );
}
