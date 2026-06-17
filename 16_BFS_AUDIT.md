# 16 — Built for Shopify (BFS) audit & readiness plan

> Source: Shopify BFS achievement criteria (checked 2026-06-18).
> Bottom line first: **BFS cannot be obtained today — by anyone.** It is gated on
> traction and 28 days of real-merchant performance data that a just-launched app
> does not have yet. This doc separates the *hard gates you must grow into* from
> the *code/UX items we can make pass now* so the application succeeds first try.

---

## A. Hard prerequisite gates — NOT code, need traction + time

| Criterion | Threshold | Roost now | How it clears |
|---|---|---|---|
| Net installs | **≥ 50** from active shops **on paid plans** | ~0 (just launched) | Distribution + marketing over weeks |
| Reviews | **≥ 5** | 0 | Your outsourced review effort |
| Recent rating | minimum rating (Shopify doesn't publish the exact number) | none | Follows from real, happy installs |
| Admin Web Vitals | LCP ≤2.5s, CLS ≤0.1, INP ≤200ms at p75, **≥100 measurements over 28 days** | no traffic to measure | Needs live merchants using the admin |

**Implication:** there is no button I or you can press to "get" the badge now. You
apply in **Partner Dashboard → Apps → Roost → Distribution → "Apply for Built for
Shopify status"** only after the gates above are met (and only an account with
*Manage apps* permission can submit). Shopify's app-review team then evaluates it
manually. Three consecutive failed applications = 3-month cooldown, so we apply
**once, when ready** — not speculatively.

---

## B. Code / UX criteria — what we control. Make these all green before applying.

| Criterion | Status | Note / action |
|---|---|---|
| Session-token auth (no cookies) | ✅ Pass | `authenticate.admin`, App Bridge session tokens |
| App Bridge nav component (`s-app-nav`) | ✅ Pass | `app/routes/app.tsx` |
| Theme App Extension (no Asset API injection) | ✅ Pass | `extensions/loyalty-widget` app embed |
| Clean uninstall (no residual code/data) | ✅ Pass | `app/uninstalled` webhook + cascade deletes |
| Mandatory + GDPR webhooks | ✅ Pass | orders/create, uninstall, 3× compliance |
| Homepage shows setup status + key metrics | ✅ Pass | onboarding checklist + stat cards (added 2026-06-18) |
| No countdown timers / guilt / fake scarcity | ✅ Pass | enforced by product guardrails |
| Plan-gated features shown (not silently hidden) | ✅ Pass | predictions teaser + upgrade CTA |
| Billing via Shopify Billing API only | ✅ Pass | `appSubscriptionCreate`, monthly + annual |
| Latest Admin API version | ⚠️ Verify | currently `ApiVersion.October25` — bump to the latest stable each cycle |
| App Bridge CDN script in `<head>` | ⚠️ Verify | template loads App Bridge via `AppProvider`; confirm `app-bridge.js` is the first head script (BFS wants it explicit) |
| **Contextual Save Bar on forms** | ❌ Gap | `app.settings.tsx` / `app.predictions.tsx` use plain Save buttons. BFS wants App Bridge Contextual Save Bar (`s-save-bar`/`data-save-bar`) that appears on edit and handles discard. |
| Responsive, no horizontal scroll, name no-truncate | ⚠️ Verify | Polaris web components handle most of this; spot-check on mobile admin |

### Recommended code work (makes B all-green)
1. **Contextual Save Bar** on the Settings and Predictions forms (the one real gap).
2. **Confirm the App Bridge `app-bridge.js` head script** is present/first; add explicitly if the framework doesn't.
3. **API version bump** to latest stable before applying.

None of these are blockers for *App Store* listing (the app already passed review
without them) — they're polish that de-risks the eventual BFS application.

---

## C. Sequence

1. **Now:** close the code/UX gaps in section B (small, ~half a day).
2. **Weeks:** drive installs (paid plans) + collect 5+ reviews; let Web Vitals
   accumulate 28 days of data from real admin usage.
3. **When 50 paid installs + 5 reviews + rating are met:** apply once from the
   Partner Dashboard. Maintain via the annual re-review (60-day fix window).

> So the honest answer to "go get the badge": I can get the **code** to BFS
> standard now; the badge itself unlocks only after the app earns the traction.
> The listing reframe (doc 15) + reviews + demo video are what produce that traction.
