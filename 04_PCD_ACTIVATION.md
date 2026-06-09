# 04 — PCD 승인 & 실제 적립 활성화

> 목적: `orders/create`(구매 적립)·`customers/create`(가입 보너스)는 **보호된 고객 데이터(PCD)** 토픽이라
> 승인 전에는 구독이 거부된다. 그래서 두 웹훅은 `shopify.app.toml`에 **주석 처리**되어 있고,
> 핸들러 코드와 테스트는 이미 완성되어 있다. 아래 절차로 승인받고 활성화한다.

---

## 1. 현재 상태

| 항목 | 상태 |
|---|---|
| `app/routes/webhooks.orders.create.tsx` | ✅ 구현·테스트 완료 (적립+추천완료+이메일+무료한도 게이팅) |
| `app/routes/webhooks.customers.create.tsx` | ✅ 구현·테스트 완료 (가입 보너스) |
| `shopify.app.toml`의 두 구독 | ⏳ **주석 처리됨** (PCD 승인 전 활성화 시 dev 기동 실패) |
| 앱 배포 유형 | ✅ Public distribution (PCD 신청 가능 상태) |

---

## 2. PCD 신청 (사람, ~3분 · 개발 스토어는 심사 불필요)

> ⚠️ PCD 설정은 **신규 Dev Dashboard(`dev.shopify.com`)에는 없다.** 오직 별도 사이트인
> **Partner Dashboard(`partners.shopify.com`)** 에만 있다. (Shopify 이전기의 알려진 분리)

1. **`partners.shopify.com`** 접속 → 같은 계정으로 로그인 (Dev Dashboard와 다른 사이트)
2. 좌측 **Apps** → `loop` 선택 (목록이 나뉘어 있으면 **"Dev Dashboard apps"** 섹션 확인)
3. 앱 좌측 사이드바 → **"API access requests"** (← "API access"가 아니라 정확히 이 이름) →
   **Protected customer data access** → **Request access**
3. **Protected customer data** 체크 → 사용 이유 입력
   - 예: *"Loyalty program — identify which customer placed an order / created an account to award points."*
4. **고객 필드(fields)** 중 우리가 쓰는 것만:
   - ✅ **Email** — 이유: *"Identify member and send points notifications."*
   - ⬜ Name / Address / Phone → 선택 안 함 (최소 수집)
5. 데이터 보호 확인 체크박스 동의 → **Save**
   - 개발 스토어에만 설치된 상태면 여기까지로 즉시 적용 (Submit for review 불필요)

---

## 3. 활성화 (Claude가 수행 — "PCD 승인됐어"라고 알려주면)

승인 확인 후 아래를 진행한다:

1. `shopify.app.toml`에서 두 구독의 **주석 해제**:
   ```toml
   [[webhooks.subscriptions]]
   uri = "/webhooks/orders/create"
   topics = [ "orders/create" ]

   [[webhooks.subscriptions]]
   uri = "/webhooks/customers/create"
   topics = [ "customers/create" ]
   ```
2. `shopify app dev` 재시작 → 이번엔 PCD 에러 없이 구독 등록됨
3. **검증 (개발 스토어)**:
   - 어드민 Orders → **Create order** (고객 지정) → dev 로그에 `주문 …: Npt [credited]` + 어드민 대시보드 "최근 적립 활동"에 표시
   - 어드민 Customers → 새 고객 생성 → dev 로그에 `가입 보너스 [awarded]` (설정의 signupBonus > 0일 때)
   - 추천 링크로 가입한 고객의 첫 구매 → 양쪽 적립 확인

---

## 4. 참고

- PCD는 **출시(App Store 제출)의 데이터 보호 선언**과 직결된다. 여기서 한 선언이 그대로 심사 자료가 된다.
- 우리는 이메일·포인트·거래이력만 보관(최소 수집) → 정직 포지셔닝과 일치.
