# 13 — App Store 제출 패킷 (복붙용)

> Partner Dashboard 의 각 필드에 **그대로 붙여넣는** 최종본. 리스팅 원문은 `06_APP_STORE_LISTING.md`,
> 절차/거절 대비는 `12_APP_STORE_REVIEW_GUIDE.md`, 개인정보방침은 `08_PRIVACY_POLICY_EN.md` 참조.
> 여기 적힌 값(지원 이메일·개인정보방침 URL)은 **확정값**이다.

---

## 0. 확정값 (전 필드 공통)

| 항목 | 값 |
|---|---|
| App name | `Roost — Honest Loyalty & Rewards` |
| Support email | `liger4903@gmail.com` |
| Privacy policy URL | `https://github.com/JunYoungChoSFE/loop/blob/main/08_PRIVACY_POLICY_EN.md` |
| Production URL | `https://loop-loyalty.fly.dev` |
| Category | Loyalty and rewards (보조: Marketing) |
| Pricing | Free $0 / Pro $19 per month flat — **Shopify Billing API only** |

> ⚠️ 개인정보방침 URL 은 **비로그인 시크릿 창에서 200으로 열리는 것**을 확인했다. 제출 직전 한 번 더 확인.

---

## 1. App listing 필드 (복붙)

**Name**
```
Roost — Honest Loyalty & Rewards
```

**Tagline** (≤ ~62자)
```
Points, rewards & referrals. One flat price. No dark patterns.
```

**Intro (one-line)**
```
An honest loyalty app for small merchants — 5-minute setup, one flat price, zero hidden costs and zero dark patterns.
```

**Detailed description** — `06_APP_STORE_LISTING.md` §"Detailed description" 본문을 그대로 사용.

**Key features** — `06` §"Key features" 8개 항목 그대로.

**Pricing**
```
Free  — $0/mo   — Core earning, redemption, widget, and referrals (up to 200 orders/month)
Pro   — $19/mo  — All features, unlimited orders. No hidden costs. Flat price.
```

---

## 2. App setup 필드

| 필드 | 값 |
|---|---|
| App URL | `https://loop-loyalty.fly.dev` |
| Allowed redirection URL(s) | `https://loop-loyalty.fly.dev/auth/callback`, `https://loop-loyalty.fly.dev/auth/shopify/callback`, `https://loop-loyalty.fly.dev/api/auth/callback` |
| GDPR mandatory webhooks | `https://loop-loyalty.fly.dev/webhooks/compliance` (3종 단일 핸들러) |

> 이 값들은 `shopify.app.toml` 과 일치해야 한다. 제출 전 `shopify app deploy` 로 toml(scopes·webhooks·app_proxy)을
> Shopify 에 푸시했는지 확인 — fly 배포(앱 서버)와 별개다.

---

## 3. 심사관용 테스트 노트 (Test instructions — 그대로 복붙)

```
Test store (recommended): we provide a development store with Roost already installed, the
storefront widget enabled, and demo data seeded — so the Dashboard and Predictions screens
are populated and nothing needs setup.
  Store admin: https://loop-yxvyj2nb.myshopify.com/admin
  Login:       <REVIEWER_EMAIL> / <REVIEWER_PASSWORD>   (fill in before submitting)
You may also install on your own review store; the flow below is identical. Note that the
Predictions screen populates from purchase history, so place a few test orders first if you
use an empty store.

1) After install, the Settings screen lets you configure the earn rate and rewards (5-minute setup).
2) Earning: create/pay for an order that has a customer. The orders/create webhook credits points
   (verify the balance on the Members screen).
3) Widget: in Online Store > Themes > App embeds, enable "Roost loyalty widget", then open the
   storefront as a logged-in customer to see points / rewards / referral link (click to open the panel).
4) Redemption: redeeming a reward in the widget issues a one-time discount code and deducts points.
5) Predictions tab: shows estimated repurchase timing and churn risk WITH a confidence/basis indicator
   (we never present predictions as certainties). Automatic actions (reminder / win-back / bonus points)
   are OFF by default and only send after the merchant explicitly enables them.
6) GDPR / Uninstall: uninstalling removes all of that shop's data completely (zero trace). The widget is a
   Theme App Extension, so no injected scripts remain.

Billing: Pro ($19/month flat) is created via the Shopify Billing API only. No external payment processors.

Support: liger4903@gmail.com (a real person replies within 24h on business days).
```

---

## 4. Support email 자동응답 템플릿 (선택)

```
Hi, and thanks for using Roost. A real person will reply to your message within 24 hours on business days.
Feel free to write in about anything — install, earning, redemption, or the widget.
(The same fast support applies to every plan — no upgrade required.)
```

---

## 5. 제출 직전 최종 체크

```
[x] 프로덕션 배포 + 실제 HTTPS URL (loop-loyalty.fly.dev → 200)
[x] PCD 신청
[x] 개인정보처리방침 공개 URL (비로그인 200 확인)
[x] Billing: Free + Pro $19, Billing API only / 외부결제 흔적 0
[x] 필수 웹훅 5종 + GDPR 3종 + 클린 언인스톨 (코드 검증 완료)
[ ] 개발 스토어 E2E 9장 통과 (문서 11)   ← 제출 전 필수
[ ] 스크린샷 3~5장 (06 §shot-list, seed-demo 후 촬영)
[ ] shopify app deploy 로 toml 푸시 확인
[ ] 위 §1~§3 필드 입력 → Submit for review
```
