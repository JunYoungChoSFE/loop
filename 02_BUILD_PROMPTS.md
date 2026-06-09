# 02 — Claude Code 빌드 프롬프트 (순서대로)

> 사용법: 각 Phase 프롬프트를 **순서대로** Claude Code에 하나씩 붙여넣는다. 한 Phase가 끝나면 **반드시 개발 스토어에서 실제로 동작 확인** 후 다음으로. 매 세션 Claude Code는 `CLAUDE.md`를 먼저 읽는다.

---

## Phase 0 — 환경 & 스캐폴딩

> 선행(사람이 직접): Shopify Partner 계정 생성 → 개발 스토어 1개 생성 → Node 18+ 설치 → `npm i -g @shopify/cli@latest`.

```
이 프로젝트는 CLAUDE.md에 정의된 "Loop" — 소상인용 정직한 Shopify 로열티 앱이다.
먼저 CLAUDE.md를 읽어라. 그 다음:
1. Shopify CLI로 Remix 기반 앱 템플릿을 스캐폴딩한다 (TypeScript).
2. Prisma를 Postgres로 설정한다 (로컬 개발은 SQLite 허용).
3. shopify.app.toml에 필요한 scopes(read/write orders, customers, discounts, 스크립트/테마)와 필수 웹훅을 등록한다.
4. 앱을 개발 스토어에 설치해 임베디드 어드민이 빈 화면으로라도 뜨는 것까지 확인하고 멈춰라.
OAuth는 authenticate.admin 헬퍼를 쓰고 직접 구현하지 마라.
```

## Phase 1 — 데이터 모델 + 적립 엔진

```
CLAUDE.md의 4·5번을 기준으로:
1. Prisma 스키마에 Shop, Member, PointsTransaction, Reward, Referral, Setting 모델을 만든다. 모든 모델에 shopId 스코프.
2. lib/points/ 에 적립·차감 계산을 순수 함수로 작성하고 단위 테스트를 붙인다.
3. orders/create 웹훅 핸들러를 만들어, 주문 금액 × 가맹점 적립률로 포인트를 적립하고 PointsTransaction(+)을 기록한다.
4. 개발 스토어에서 테스트 주문을 만들어 포인트가 실제로 적립되는지 확인하는 방법을 알려줘라.
멀티테넌시: 모든 쿼리에 shopId를 건다.
```

## Phase 2 — 어드민 UI (Polaris)

```
Polaris + App Bridge로 어드민 화면을 만든다 (커스텀 컴포넌트 금지):
1. app._index: 대시보드 — 멤버 수, 발행 포인트, 최근 적립 등 기본 통계.
2. app.settings: 적립률, 리워드(필요 포인트·보상 유형), 위젯 색상·위치 설정. 저장 5분 내 완료 가능하게 단순하게.
3. app.members: 멤버 목록 + 검색 + 개별 포인트 조정.
설정값은 Setting 모델에 저장하고 적립 엔진이 참조하게 연결한다.
```

## Phase 3 — 교환 (포인트 → 할인 코드)

```
교환 플로우를 구현한다:
1. 멤버가 리워드를 선택하면 포인트 잔액을 검증한다.
2. 충분하면 Shopify discountCodeBasicCreate로 1회용 할인 코드를 발행한다.
3. PointsTransaction(-)로 차감 기록한다.
4. 부족하면 명확한 메시지. 동시성/중복 교환 방지 처리.
백엔드 API 라우트로 먼저 만들고, 스토어프론트 연결은 Phase 4에서 한다.
```

## Phase 4 — 스토어프론트 위젯 (Theme App Extension)

```
extensions/loyalty-widget 에 Theme App Extension(App embed block)을 만든다:
1. 스토어프론트에서 현재 포인트·교환 가능한 리워드·추천 링크를 보여준다.
2. 가맹점이 Setting에서 정한 색상·위치를 반영한다. 커스텀 CSS 없이도 깔끔하게 (가드레일 4).
3. 별도 팝업 포털을 강요하지 않는다 — 인라인 런처 + 패널 형태.
4. Phase 3의 교환 API와 연결한다.
개발 스토어 테마에서 위젯이 깨지지 않고 뜨는지 확인하는 법을 알려줘라.
```

## Phase 5 — 추천(Referral)

```
추천 기능을 구현한다:
1. 각 Member에 고유 추천 링크 생성.
2. 피추천인이 그 링크로 방문→첫 구매 시 Referral 기록, 양쪽에 포인트 지급.
3. 어드민 app.referrals에 현황 표시.
자기추천·중복 방지 가드.
```

## Phase 6 — 이메일 알림

```
기본 트랜잭션 이메일을 붙인다:
1. 포인트 적립 시 / 리워드 사용 가능 시 알림.
2. 가맹점이 on/off 가능하게.
간단하고 스팸스럽지 않게. 마케팅 발송 아님.
```

## Phase 7 — 결제 (Billing API)

```
CLAUDE.md 6번대로 Shopify Billing API를 연동한다:
1. Free(주문 N건/월) + Pro($19/월 flat) 두 플랜.
2. appSubscriptionCreate로 Pro 생성, confirmationUrl 리다이렉트.
3. 무료 한도 초과 시에만 업그레이드 유도 — 핵심 기능은 절대 잠그지 마라 (가드레일 1·2).
4. 구독 상태를 확인해 한도를 적용한다.
외부 결제 절대 금지.
```

## Phase 8 — 클린 언인스톨 + GDPR + 제출 준비

```
출시 조건을 마무리한다:
1. app/uninstalled 웹훅: 가맹점 데이터 + 주입한 위젯/블록을 완전히 제거한다 (가드레일 3). 흔적 0.
2. GDPR 웹훅 3종(customers/data_request, customers/redact, shop/redact) 구현.
3. CLAUDE.md 8번 App Store 체크리스트를 하나씩 점검한다.
4. 개발 스토어에서 설치→적립→교환→추천→삭제 전체 플로우를 끝까지 테스트하고, 삭제 후 가게에 아무 흔적도 안 남는지 확인한다.
```

---

## 4주 일정 (참고)

- **1주차**: Phase 0~2 (스캐폴딩, 적립 엔진, 어드민)
- **2주차**: Phase 3~4 (교환, 스토어프론트 위젯)
- **3주차**: Phase 5~7 (추천, 이메일, 결제)
- **4주차**: Phase 8 + 리스팅·스크린샷·제출. 심사 5~10영업일은 별도로 본다.
