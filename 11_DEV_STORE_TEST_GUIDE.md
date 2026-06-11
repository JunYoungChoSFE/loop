# 11 — 개발 스토어 실동작 테스트 가이드 (Dev Store E2E Test)

> 단위테스트 68개 통과 ≠ 실동작 보장. App Store 심사에서 가장 자주 거절나는 지점이
> "개발 스토어에서 전체 플로우가 실제로 돌아가는가"다. 이 문서는 `shopify app dev`로
> 앱을 띄워 **설치 → 적립 → 교환 → 추천 → 예측 → GDPR → 클린 언인스톨**을 손으로
> 한 번 끝까지 통과시키는 체크리스트다. CLAUDE.md 8절 마지막 항목을 충족한다.

소요: 처음이면 ~40분. 한 번 해두면 심사 거절 리스크가 크게 준다.

---

## 0. 사전 준비 (~10분)

### 0-1. 개발 스토어 + Partner 앱
- Partner Dashboard → **Stores → Add store → Development store** 생성 (Test data 자동 채우기 옵션 켜면 더 편함).
- 앱은 이미 `shopify.app.toml`에 `client_id = "68ceeb..."`로 연결돼 있음.

### 0-2. 환경변수
`.env`를 만들고 최소한 다음을 채운다 (`.env.example` 참고):
```bash
cp .env.example .env
```
- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` — `shopify app dev` 실행 시 자동 주입되므로 비워도 됨.
- `DISABLE_PREDICTION_CRON=1` — **dev에서는 켤 것**. 야간 배치가 멋대로 이메일 보내지 않게.
- `CRON_SECRET=devsecret` — 예측 배치를 손으로 트리거하려면 필요.
- `RESEND_API_KEY` / `EMAIL_FROM` — 비워두면 이메일은 전송 시도 없이 로그로만 확인됨(테스트엔 그게 더 안전). 실제 메일까지 보려면 채운다.

### 0-3. DB 준비
dev는 SQLite (`file:dev.sqlite`):
```bash
npx prisma migrate deploy   # 또는: npm run setup
npx prisma generate
```

### 0-4. 앱 실행
```bash
npm run dev          # = shopify app dev
```
- CLI가 터널 URL을 만들고 `shopify.app.toml`의 `application_url` / `app_proxy.url` / `redirect_urls`를
  **자동으로 터널 주소로 갱신**한다 (`automatically_update_urls_on_dev = true`). 수동 수정 금지.
- 터미널에 뜨는 **Preview URL**(`https://...myshopify.com/admin/...`)로 설치를 시작한다.

---

## 1. 설치 & OAuth (가드레일: OAuth 직접 구현 X)

- [ ] Preview URL 열기 → 앱 설치 동의 화면에서 **요청 scope가 5개인지 확인**:
      `read_orders, write_orders, read_customers, write_customers, write_discounts`.
      (theme/script scope 없음 = 위젯이 Theme App Extension이라는 증거, 가드레일 4·최소권한)
- [ ] 설치 후 임베디드 어드민(Polaris UI)이 뜨고 **대시보드(`app._index`)** 가 로드되는지.
- [ ] 에러 없이 멤버 0 / 발행 포인트 0 상태가 보이면 OK.

> 막히면: 터미널 로그에서 `authenticate.admin` 관련 401/redirect 루프 확인. 보통 `.env`의
> 남은 옛 URL 때문 → `.env`에서 `SHOPIFY_APP_URL` 비우고 재실행.

---

## 2. 설정 화면 — "5분 세팅" 검증 (가드레일 1)

`app.settings.tsx`

- [ ] **적립률(earnRate)**, **가입 보너스(signupBonus)**, **추천 보상(referralReward)** 입력·저장 → 새로고침 후 값 유지.
- [ ] **위젯 색상/위치** 변경·저장.
- [ ] **리워드 추가**: 예) "₩5,000 할인 — 500P / fixed / value=5000" 하나, "10% 할인 — 1000P / percentage / value=10" 하나.
      (위젯·교환 테스트에 최소 1개 active 리워드 필요)
- [ ] **예측 자동 액션 토글 3종**(reminder / winback / highvalue alert)이 **기본 OFF**인지 확인 (가드레일 10-1·3).
      이번 테스트에선 OFF로 두고, 6장에서 수동 트리거로만 확인한다.

---

## 3. 적립 (orders/create) — 핵심 플로우 ①

코드: `webhooks.orders.create.tsx` → `creditPurchasePoints`

> ⚠️ `orders/create` / `customers/create`는 **PCD(Protected Customer Data) 승인** 후에 실제로 전달된다
> (`04_PCD_ACTIVATION.md`). 개발 스토어는 PCD 심사가 필요 없지만, Partner 설정에서 보호 고객 데이터
> 접근을 신청/허용해 둬야 웹훅이 customer 필드를 포함해 들어온다.

### 3-A. 고객 생성 → 가입 보너스
- [ ] 스토어 어드민에서 **Customers → Add customer**로 고객 1명 생성.
- [ ] 어드민 **Members** 화면에 해당 고객이 뜨고, `signupBonus`만큼 잔액이 잡히는지
      (`webhooks.customers.create` → `awardSignupBonus`). 안 뜨면 PCD/웹훅 전달 문제.

### 3-B. 주문 생성 → 포인트 적립
- [ ] 어드민 **Orders → Create order**로 그 고객 앞 주문 1건 생성(금액 예: 50,000) → **Mark as paid / 완료**.
- [ ] 터미널 로그에 `Received orders/create webhook for ...` + 적립 로그가 찍히는지.
- [ ] **Members**에서 잔액이 `금액 × earnRate`만큼 증가했는지.
- [ ] **대시보드**의 발행 포인트/최근 트랜잭션에 반영되는지.

### 3-C. 멱등성(중복 웹훅) 확인
- [ ] 같은 주문이 두 번 전달돼도 **중복 적립이 없어야** 한다 (`@@unique([shopId, orderId])`).
      Partner Dashboard → Webhooks에서 동일 이벤트를 재전송하거나, 동일 `order.id`로 아래 4장 수동 전송을 2회 시도해 잔액이 한 번만 오르는지 확인.

### 3-D. 게스트 주문 무시
- [ ] customer 없는 게스트 주문은 적립 스킵 (로그: `skipping accrual (guest checkout)`).

---

## 4. (선택) 웹훅을 CLI로 직접 쏘기

실제 주문 만들기 번거로우면 Shopify CLI로 토픽을 트리거할 수 있다:
```bash
shopify app webhook trigger --topic orders/create --address <터널URL>/webhooks/orders/create
```
- 단, CLI 트리거 페이로드는 customer가 비어 있을 수 있어 **적립까진 확인 불가**(게스트로 스킵됨).
  적립 검증은 3-B의 실제 주문 경로를 권장. CLI 트리거는 **핸들러가 401/500 없이 200을 반환**하는지(라우팅·HMAC) 확인용으로 쓴다.
- [ ] `app/uninstalled`, `customers/redact` 등도 같은 방식으로 200 반환 스모크 가능.

---

## 5. 교환 & 위젯 (스토어프론트) — 핵심 플로우 ②

코드: Theme App Extension `extensions/loyalty-widget/` + `proxy.state/redeem/refer.tsx`
앱 프록시 매핑: 스토어프론트 `/apps/loop/*` → 앱 `/proxy/*`

### 5-A. 위젯 노출
- [ ] 스토어 어드민 **Online Store → Themes → Customize → App embeds**에서 **"Roost loyalty widget"** 토글 ON.
- [ ] 스토어프론트를 **로그인한 고객(3-A에서 만든 고객)** 으로 열기 → 위젯 런처가 설정한 색/위치로 보이는지.
- [ ] 위젯은 **클릭해야 열린다**(강제 팝업 X — 가드레일 2). 열면 현재 포인트 + 리워드 목록이 보이는지 (`/apps/loop/state`).
- [ ] 비로그인 상태에선 포인트 대신 로그인/안내가 깔끔히 처리되는지(에러 노출 X).

### 5-B. 리워드 교환 → 할인 코드 발행
- [ ] 잔액이 충분한 리워드를 교환 → **1회용 할인 코드 발행** 확인 (`discountCodeBasicCreate`, `write_discounts`).
- [ ] **Members/대시보드에서 잔액이 차감**(`PointsTransaction(-)`)됐는지.
- [ ] 잔액 부족 리워드는 교환 거부되는지 (`canRedeem`).
- [ ] 발행된 코드를 실제 체크아웃에 적용해 할인 먹는지(1회용이면 재사용 차단).

### 5-C. 추천 — 핵심 플로우 ③
- [ ] 위젯의 **추천 링크**가 보이고 복사되는지 (`proxy.refer`).
- [ ] 다른 고객(피추천인)으로 그 링크 경유 후 **첫 구매** → 양쪽에 `referralReward` 지급되는지
      (`completeReferralOnPurchase`). **Referrals** 화면에서 status가 `completed`로 바뀌는지.
- [ ] 자기 자신 추천·중복 보상이 막히는지.

---

## 6. 예측 (Roost v2) — 액션으로 닫히는지 확인

코드: `prediction.server.ts` / `predictionActions.server.ts` / `internal.predict.tsx`

실데이터를 빠르게 만들기 위해 **데모 시드**를 쓴다 (예측 엔진이 imminent/at-risk/healthy 섞인 결과를 내도록 날짜가 설계돼 있음):
```bash
node scripts/seed-demo.mjs <your-store>.myshopify.com
# 정리: node scripts/seed-demo.mjs --clean <your-store>.myshopify.com
```
- [ ] **Predictions(`app.predictions`)** 화면 로드 → 화면 진입 시 즉시 재계산되어(stale 방지)
      `imminent`(곧 재구매) / `at-risk`(이탈 위험) 고객이 분류돼 보이는지.
- [ ] 각 예측에 **신뢰도(predictionSource: L0_prior / L1_shopavg / L2_personal / L3_bgnbd)** 가 함께 표시되는지 (가드레일 10-1·5).
- [ ] 모든 예측에 **켤 수 있는 액션**이 붙어 있는지 — 숫자만 있는 화면 금지 (가드레일 10-1·1).
- [ ] 자동 액션 토글이 **기본 OFF**임을 다시 확인 (2장).

### 6-A. 배치 수동 트리거
`CRON_SECRET`을 설정했다면:
```bash
curl -X POST <터널URL>/internal/predict -H "x-cron-secret: $CRON_SECRET"
```
- [ ] `{ ok: true, ... }` 응답 + 배치 결과 카운트.
- [ ] 자동 액션 토글이 **OFF면 이메일이 나가지 않는지**(로그로 확인). 설정에서 reminder만 ON으로 바꾼 뒤
      재트리거 → imminent 대상에게만, **쿨다운 1회만** 발송되는지 (`PredictionActionLog`).
- [ ] 잘못된/누락된 `x-cron-secret` → 401 (`devsecret` 외엔 거부).
- [ ] (graceful degrade) 점수 없는 신규 1회 구매 고객에 단정하지 않는지 — at-risk로 잘못 분류되지 않는지.

---

## 7. GDPR 3종 (심사 필수) — `webhooks.compliance.tsx`

CLI로 트리거하거나 Partner Dashboard에서 compliance 웹훅 재전송:
```bash
shopify app webhook trigger --topic customers/data_request --address <터널URL>/webhooks/compliance
shopify app webhook trigger --topic customers/redact      --address <터널URL>/webhooks/compliance
shopify app webhook trigger --topic shop/redact           --address <터널URL>/webhooks/compliance
```
- [ ] **customers/data_request** → 해당 고객 데이터가 수집·로깅되는지 (`collectCustomerData`), 200 반환.
- [ ] **customers/redact** → 그 Member + 연결된 PointsTransaction/Prediction/Log가 **cascade 삭제**되는지.
      (Members 화면에서 사라지고, Prisma Studio로 잔여 0 확인)
- [ ] **shop/redact** → 상점 전체 데이터 purge.
- [ ] 세 핸들러 모두 HMAC 검증 통과(200). 미검증 요청은 거부.

> 잔여 데이터 확인: `npx prisma studio` 로 테이블을 직접 본다.

---

## 8. 클린 언인스톨 (가드레일 3) — `webhooks.app.uninstalled.tsx`

- [ ] 스토어 어드민 **Settings → Apps → Roost 삭제**.
- [ ] 터미널에 `app/uninstalled` 수신 로그 + `purgeShop` 실행.
- [ ] **Prisma Studio로 해당 shop의 Shop/Member/Transaction/Prediction/Session이 모두 삭제**됐는지
      (cascade). 가게에 흔적 0.
- [ ] 위젯(App embed)도 테마에서 사라지는지(Theme App Extension이므로 앱 삭제 시 자동 비활성).
- [ ] 재설치 시 깨끗한 초기 상태로 다시 시작되는지.

---

## 9. 최종 통과 기준 (이게 다 ✅면 심사 제출 가능)

```
[ ] 설치 + OAuth (scope 5개, Polaris 대시보드)
[ ] 설정 저장 + 리워드 추가 + 예측 토글 기본 OFF
[ ] 적립: 주문→포인트, 가입 보너스, 멱등성, 게스트 스킵
[ ] 교환: 위젯 노출(클릭 오픈)→할인 코드 발행→잔액 차감
[ ] 추천: 링크→첫 구매→양쪽 보상→status completed
[ ] 예측: imminent/at-risk 분류 + 신뢰도 표시 + 액션 존재 + 수동 배치/쿨다운
[ ] GDPR 3종: data_request/redact/shop_redact 동작 + cascade 삭제
[ ] 클린 언인스톨: purgeShop로 흔적 0
```

문제 발견 시 해당 라우트/모델 파일과 터미널 로그를 함께 보고하면 바로 디버깅 들어갈 수 있다.
