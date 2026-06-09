# 06 — App Store Listing (draft)

> Draft listing copy and assets for review submission. Reflects the honest, simple positioning as-is (no exaggeration, zero dark patterns).
> Polish once more from the merchant's perspective before submitting. Capture screenshots on a real development store.

---

## App name / tagline

- **Name**: Loop — Honest Loyalty & Rewards
- **Tagline (max ~62 chars)**: *Points, rewards & referrals. One flat price. No dark patterns.*

## One-line intro

An honest loyalty app for small merchants — 5-minute setup, one flat price, zero hidden costs and zero dark patterns.

## Detailed description (draft)

Most loyalty apps lock core features behind expensive higher tiers, charge you more as your orders grow, push you for star ratings, and leave code behind even after you uninstall. Loop is built to do the opposite.

- **One flat price.** Start free, then Pro is $19/month flat. No order-volume penalties, no paywalls, no hidden costs.
- **Zero-code widget.** Looks clean and matches your brand colors without any custom CSS. We never force shoppers into a separate popup portal.
- **Zero dark patterns.** No forced star ratings, no in-app upsells. When you uninstall, we completely remove the code and data we injected.
- **A complete core.** Points on purchase, points-to-discount-code redemption, referrals (rewards for both sides), and basic email notifications.

The simplicity and honesty that larger companies structurally can't offer — that's the gap Loop fills.

## Key features

- Earn points on purchase (configurable earn rate), plus an account-signup bonus
- Automatic redemption of points into one-time Shopify discount codes
- Storefront widget (Theme App Extension, inline launcher + panel)
- Referral links — rewards for both the referrer and the referred customer
- Polaris admin: dashboard, members, referral status, and settings
- Transactional emails for earning and rewards (on/off)
- Clean uninstall + GDPR compliance

## Pricing

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | Core earning, redemption, widget, and referrals (up to 200 orders/month) |
| Pro | $19/month flat | All features, unlimited orders. No hidden costs |

---

## Screenshot shot-list (5 recommended)

1. **Dashboard** — member count, points issued, recent earning activity
2. **Settings screen** — earn rate, rewards, widget colors (highlights the 5-minute setup)
3. **Storefront widget** — launcher + rewards panel (reflecting brand colors)
4. **Members list** — search and points adjustment
5. **Referral status** or **Plan screen** (the honest single price)

> Demo data: run `node scripts/seed-demo.mjs` to populate members before shooting, so the screens don't look empty.

## Submission asset checklist

- [ ] 5 screenshots (shot-list above)
- [ ] App icon (1200×1200 recommended)
- [ ] Demo store + review credentials (an installed development store / test account)
- [ ] Support email (template below) — liger4903@gmail.com or a dedicated address
- [ ] Privacy policy URL (consistent with the PCD declaration: we collect only email, points, and transaction history)
- [ ] Category: Loyalty and rewards / Marketing

## Support email — auto-reply template (draft)

> Hi, and thanks for using Loop. A real person will reply to your message within 24 hours on business days.
> Feel free to write in about anything — install, earning, redemption, or the widget. (The same fast support applies to every plan — no upgrade required.)

---

## Review notes

- A first submission usually gets change requests (that's normal). Expect 5–10 business days.
- Required to pass: all 5 webhooks working, clean uninstall, the 3 GDPR webhooks, and billing via the Billing API. (All implemented — do a final check after enabling PCD per `04`.)
