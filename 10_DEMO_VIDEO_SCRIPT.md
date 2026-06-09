# 10 — Demo Video Script (App Store listing + reviewer walkthrough)

> Is a video required? **No — but strongly recommended.** Shopify lets you add a
> "feature video" (a YouTube link) to the listing; it lifts install rates and helps
> reviewers understand the flow. This file has two scripts:
> - **Script A** — a 60–90s listing feature video (marketing, polished).
> - **Script B** — a reviewer walkthrough you can attach in the submission notes
>   (shows the required flows end to end: install → earn → redeem → referral →
>   predictions → clean uninstall).
>
> You can record one take that covers both if you follow Script B and trim a short
> highlight reel for the listing.

---

## Specs & where it goes

- **Format**: MP4, 1080p (1920×1080), landscape. Upload to YouTube (Unlisted is fine), paste the link in the listing's "Feature video" field.
- **Length**: Script A ≤ 90s. Script B 2–4 min.
- **Audio**: optional voiceover or on-screen captions. Captions are safer (reviewers often watch muted) — burn in the narration lines below as text.
- **No music with copyright.** Silence or a royalty-free track.

## Before you record (5 min)

1. Local dev so you can use demo data: `node scripts/seed-demo.mjs` then `shopify app dev` (or record on production with a couple of real test orders).
2. In the Roost admin, make sure there's at least one **Reward** (Settings → Rewards, e.g. "$5 off", 500 pts) so redemption is shown.
3. Open these tabs ahead of time: Roost **Dashboard**, **Predictions**, **Settings**; your storefront with the widget; Shopify **Orders**.
4. Use a clean browser window (no personal bookmarks/emails visible). Hide real customer emails — demo data only.
5. Set the window to 16:9 and zoom so text is readable.
6. When done recording on dev: `shopify app dev clean` to return to production.

---

## Script A — Listing feature video (~75s)

| Time | On screen | Caption / voiceover |
|---|---|---|
| 0:00–0:06 | Roost Dashboard, slow pan over the stat cards | "Roost — an honest loyalty app for small Shopify stores." |
| 0:06–0:16 | Settings screen: set earn rate, add a reward | "Set up points, rewards and referrals in about five minutes. No code." |
| 0:16–0:28 | Storefront: open the widget, show points + reward, click redeem → discount code appears | "Customers earn on every order and redeem points for a one-time discount — right in your storefront, in your brand color." |
| 0:28–0:40 | Referrals screen with referral link / status | "Built-in referrals reward both sides. No second app." |
| 0:40–0:55 | Predictions screen: "🔁 imminent / ⚠️ churn risk" counts + customer list; hover the opt-in toggles | "Roost even predicts who's about to reorder and who's drifting away — and can nudge them with a reminder or bonus points. Every automatic action is off by default." |
| 0:55–1:05 | Plan screen: Free + Pro $19 flat | "One honest flat price. No paywalls on core features, no order-volume penalties." |
| 1:05–1:15 | Dashboard again; then a card reading "Clean uninstall · GDPR · zero dark patterns" | "No dark patterns. Uninstall and we leave nothing behind. That's Roost." |

---

## Script B — Reviewer walkthrough (2–4 min)

Goal: prove the required behaviors work. Narrate each step; keep clicks visible.

| # | Action to perform on screen | Say (caption) |
|---|---|---|
| 1 | Show the app installed in the dev store admin; open Roost (loads embedded). | "Roost is an embedded app using session-token auth — no cookies." |
| 2 | Settings → set earn rate (e.g. $1 = 1pt), add a reward "$5 off / 500 pts". Save. | "Setup is one short screen. Here's the earn rate and a reward." |
| 3 | Shopify Orders → create an order for a customer (or mark a draft as paid). | "I'll place a test order for a customer." |
| 4 | Back to Roost Dashboard → show the new "+points" row in Recent activity; open Members → show the customer's balance. | "The orders/create webhook awarded points — visible here on the dashboard and the member's balance." |
| 5 | Storefront → open the Roost widget → select the reward → redeem. Show the generated one-time discount code. | "The customer redeems points for a single-use Shopify discount code, issued via the Admin API." |
| 6 | Referrals → show the referral link and that a completed referral rewards both sides. | "Referrals reward the referrer and the referred customer once, with self-referral guards." |
| 7 | Predictions → show the imminent / at-risk summary and lists; point at the "off by default" toggles; emphasize the "basis" confidence column. | "Predictions estimate repurchase timing and churn risk. All automatic actions are opt-in and off by default; each prediction shows its confidence." |
| 8 | Plan → show Free + Pro $19; click upgrade to show the Billing API confirmation screen (don't need to complete). | "Billing is the Shopify Billing API only — no external payments." |
| 9 | Settings or a note: mention GDPR webhooks (customers/data_request, customers/redact, shop/redact) are implemented. | "The three GDPR compliance webhooks are implemented." |
| 10 | Uninstall the app from the store → reinstall or show that no widget/script or data remains (storefront widget gone). | "On uninstall, Roost removes the data and storefront blocks it added — zero trace." |

> Reviewer credentials note (put in submission "App testing instructions"): provide the
> dev store URL + a staff/collaborator login, and say: "Demo data is pre-seeded; create a
> test order from Orders to see points accrue. Predictions populate from purchase history."

---

## After recording

- Trim, add burned-in captions (the lines above), export 1080p MP4.
- Upload to YouTube (Unlisted), copy the link.
- Listing → Feature video → paste link. (Screenshots are still required separately — see `06`.)
