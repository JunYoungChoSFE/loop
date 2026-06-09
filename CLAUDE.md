# CLAUDE.md — Roost (소상인용 Shopify 로열티 앱)

> **Claude Code는 매 세션 시작 시 이 파일을 먼저 읽는다.** 새 작업 전 항상 이 문서를 참조하고, 여기 적힌 가드레일을 절대 어기지 않는다.

---

## 0. 제품 한 줄

복잡함과 약탈적 가격에 지친 소규모 Shopify 상인을 위한, 5분 세팅·단일 정액·다크패턴 0의 포인트·추천 로열티 앱.

---

## 1. 절대 원칙 (가드레일 — 절대 위반 금지)

이 앱의 정체성은 코드가 아니라 **태도**다. 아래는 협상 불가:

1. **단순함을 유지하라.** 설정 화면은 5분 안에 끝나야 한다. 기능을 추가하고 싶을 때마다 "소상인이 이걸 진짜 쓰나?"를 먼저 물어라. 애매하면 빼라.
2. **다크패턴 절대 금지.** 별점 요청을 기능과 연동하지 말 것. 인앱 업셀 팝업 금지. 호환되지 않는 연동을 호환된다고 표시 금지. 숨은 비용 금지.
3. **클린 언인스톨.** `APP_UNINSTALLED` 시 주입한 스크립트/블록·가맹점 데이터를 완전히 제거한다. 가게에 흔적을 남기지 않는다.
4. **코드 0 UX.** 위젯은 커스텀 CSS 없이도 가맹점 브랜드 색에 맞춰 깔끔하게 보여야 한다. 기본 상태가 곧 출시 상태.
5. **Polaris를 따르라.** 어드민 UI는 커스텀 컴포넌트 대신 Polaris를 쓴다. Shopify가 요구하고, 더 빠르고, 네이티브하게 보인다.
6. **결제는 Shopify Billing API로만.** Polar/Stripe 등 외부 결제 금지(App Store 정책 위반).

---

## 2. 기술 스택 (확정)

- **프레임워크**: React Router 7 (Shopify 기본 앱 템플릿 `reactRouter`, Shopify CLI 4.x로 스캐폴딩). ※ 구 Remix 템플릿의 후속 — Remix v2가 React Router v7로 합병됨. 폴더/라우트 구조는 동일, import는 `react-router` 사용.
- **어드민 UI**: Polaris + App Bridge (세션 토큰 인증, 쿠키 X)
- **데이터**: GraphQL Admin API (REST 아님)
- **DB/ORM**: Prisma + Postgres (개발은 SQLite 가능)
- **스토어프론트 위젯**: Theme App Extension (App embed block)
- **결제**: Shopify Billing API (`appSubscriptionCreate`)
- **호스팅**: Fly.io 또는 Render
- **언어**: TypeScript

> 인증은 `authenticate.admin` 헬퍼가 OAuth 전 과정을 처리한다. **OAuth를 직접 구현하지 말 것.**

---

## 3. 폴더 구조 (React Router 7 템플릿 기준)

```
app/
  routes/
    app._index.tsx          # 어드민 대시보드 (홈)
    app.settings.tsx        # 적립 규칙 / 리워드 설정
    app.members.tsx         # 멤버 목록 + 검색
    app.referrals.tsx       # 추천 현황
    app.billing.tsx         # 플랜 선택 (Billing API)
    webhooks.orders.tsx     # orders/create → 포인트 적립
    webhooks.uninstall.tsx  # app/uninstalled → 정리
    webhooks.gdpr.tsx       # GDPR 3종
  models/                   # Prisma 접근 로직
  lib/points/               # 적립·교환 엔진 (순수 함수로)
extensions/
  loyalty-widget/           # Theme App Extension (스토어프론트 위젯)
prisma/
  schema.prisma
shopify.app.toml            # 앱 설정 (scopes, webhooks)
```

---

## 4. 데이터 모델 (Prisma)

- **Shop** — 가맹점. 도메인, 액세스 토큰, 플랜(free/pro), 설정(적립률 등).
- **Member** — 로열티 고객. shopId, shopifyCustomerId, 이메일, 포인트 잔액.
- **PointsTransaction** — 적립/차감 이력. memberId, delta(+/-), reason(purchase/signup/redeem/referral), createdAt.
- **Reward** — 교환 가능한 리워드. 필요 포인트, 보상 유형(고정 할인/% 할인/무료배송), 값.
- **Referral** — referrerMemberId, refereeMemberId, status, 보상 지급 여부.
- **Setting** — shopId별 적립률, 위젯 색상/위치, 추천 보상값.

> 모든 모델에 `shopId`로 멀티테넌시 분리. 쿼리에 항상 `shopId` 스코프를 건다.

---

## 5. 핵심 플로우

- **적립**: `orders/create` 웹훅 → 주문 금액 × 적립률 → `PointsTransaction(+)` → Member 잔액 증가 → (선택) 적립 이메일.
- **교환**: 고객이 위젯에서 리워드 선택 → 포인트 충분한지 검증 → Shopify `discountCodeBasicCreate`로 1회용 할인 코드 발행 → `PointsTransaction(-)`.
- **위젯**: Theme App Extension. 스토어프론트에서 현재 포인트·리워드·추천 링크를 보여줌. 가맹점 설정 색/위치 반영. 별도 팝업 포털 강요 금지.
- **추천**: Member에 고유 추천 링크. 피추천인이 그 링크로 첫 구매 시 양쪽에 포인트.

---

## 6. 결제 (Billing API)

- 플랜: **Free**(주문 N건/월까지, 핵심 기능 포함) + **Pro $19/월 flat**(전 기능).
- `appSubscriptionCreate` mutation으로 Pro 구독 생성, `confirmationUrl`로 리다이렉트.
- 무료→유료 게이팅은 "주문 한도" 단 하나로만. 핵심 기능을 잠그지 말 것(가드레일 1·2).
- 구독 상태는 웹훅/`appSubscriptions` 쿼리로 확인.

---

## 7. 필수 웹훅 (App Store 통과 조건)

- `orders/create` — 포인트 적립.
- `app/uninstalled` — 가맹점 데이터 + 주입 코드 완전 제거 (가드레일 3).
- `customers/data_request`, `customers/redact`, `shop/redact` — GDPR 필수 3종. 누락 시 심사 거절.

---

## 8. App Store 제출 체크리스트

- [ ] Polaris 컴포넌트로 어드민 UI 구성
- [ ] 필수 웹훅 5종 처리 (위 7번)
- [ ] `app/uninstalled` 시 데이터·코드 정리 확인
- [ ] GDPR 웹훅 3종 동작 확인
- [ ] Billing API로만 과금
- [ ] 개발 스토어에서 설치→적립→교환→삭제 전체 플로우 테스트
- [ ] 리스팅: 스크린샷, 데모 스토어 자격증명, 지원 이메일
- [ ] 심사 5~10영업일 예상, 첫 제출은 보통 수정 요청 받음

---

## 9. 코딩 규칙

- TypeScript strict. 적립·교환 계산은 `lib/points/`에 **순수 함수**로 분리해 테스트 가능하게.
- GraphQL 쿼리는 코드와 함께 두고 타입 생성.
- 모든 DB 쿼리에 `shopId` 스코프.
- 비밀값은 환경변수 (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `DATABASE_URL` 등). 커밋 금지.
- 작은 PR 단위로, 각 단계 후 개발 스토어에서 실제 동작 확인.

---

## 10. Roost v2 — 재구매·이탈 예측 (PREDICTION_SPEC 병합)

상세 기획은 `03_예측기능_기획서_PREDICTION_SPEC.md`. 아래는 코드 작업 시 지켜야 할 핵심만.

### 10-1. 가드레일 (예측 스펙 9절 — 절대 규칙, 1절 가드레일의 연장)
1. **예측을 액션으로 닫는다.** 숫자만 보여주는 화면 금지 — 모든 예측엔 켤 수 있는 액션이 있다.
2. **다크패턴 0.** 넛지는 실제 가치(포인트·리마인더)만. 가짜 긴박감·거짓 재고 금지.
3. **자동 액션 기본 OFF.** 상인 명시 동의(`Setting.reminderEnabled`/`winbackEnabled`/`highvalueAlertEnabled`, 전부 default false) 후에만 발송.
4. **배치 실패가 앱을 멈추지 않는다.** 점수 없으면 graceful degrade — 한 상점 실패가 전체 배치를 막지 않음.
5. **예측을 과신하지 않는다.** UI에 신뢰도(데이터 근거 = `predictionSource`)를 함께 표시. 1회 구매 고객에 단정 금지.
6. **개인정보·GDPR.** 예측 점수도 고객 데이터다. `CustomerPrediction`·`PredictionActionLog`는 Member/Shop **cascade**로 묶여 redact·클린 언인스톨 시 자동 삭제.

### 10-2. 구현 메모 (스펙과의 의도적 차이 포함)
- **데이터 모델**: `CustomerPrediction`(pAlive·expectedNextDate·predictedClv·riskFlag·imminentFlag·predictionSource), `PredictionActionLog`(actionType·triggeredAt·actualNextOrderAt). `PointsTransaction.amount`에 주문 금액 보관(CLV 입력). 전부 shopId 스코프.
- **엔진은 순수 TS, `app/lib/predict/`**: `rfm.ts`(RFM 집계) · `heuristic.ts`(L0 prior/L1 상점평균/L2 개인주기) · `categoryPriors.ts` · `bgnbd.ts`+`gammagamma.ts`+`special.ts`(L3 BG/NBD·Gamma-Gamma, lngamma·2F1·Nelder-Mead 자체구현). 전부 단위테스트.
- **P3는 Python 워커가 아니라 TS로 인-앱 구현** — 스펙이 경고한 Node↔Python 분리·SQLite 공유 리스크를 피하려는 의도적 결정. 모델은 동일, 런타임 하나.
- **서비스/배치**: `app/models/prediction.server.ts`(레이어 선택→upsert, 대시보드 read), `predictionActions.server.ts`(트리거→액션→로그, 쿨다운). 자동 액션은 **DB+이메일만** 사용(오프라인 토큰 불필요). L3는 활성고객 ≥ `L3_MIN_CUSTOMERS`(200)일 때만.
- **스케줄러**: 별도 cron 인프라 없이 `app/cron.server.ts` 인-프로세스 야간 배치(단일 Fly 머신 전제). `/internal/predict`(POST, `CRON_SECRET` 헤더)로 외부/수동 트리거도 가능. 대시보드 로드 시에도 즉시 재계산(stale 방지).
- **검증**: `PredictionActionLog.actualNextOrderAt`를 사후 채워(배치 backfill) 적중 추적. 북극성 지표는 예측 정확도가 아니라 액션 켠 상점의 재구매율 상승분.
