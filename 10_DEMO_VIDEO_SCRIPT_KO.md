# 10 (KO) — 데모 영상 스크립트 (App Store 리스팅 + 심사관 워크스루)

> 데모 영상 스크립트의 **한국어 번역본**입니다. 실제 리스팅·심사관용 영상은 영어 자막/내레이션을
> 권장하므로(글로벌 심사 기준), 영상에 넣는 문구는 영문 원본 `10_DEMO_VIDEO_SCRIPT.md`를 사용하세요.
> 이 문서는 촬영 흐름을 한국어로 이해·공유하기 위한 참고 번역입니다.
>
> 영상이 필수인가요? **아니요 — 하지만 강력 권장.** Shopify는 리스팅에 "기능 영상"(YouTube 링크)을
> 추가할 수 있게 하며, 설치율을 높이고 심사관의 플로우 이해를 돕습니다. 이 문서엔 두 개의 스크립트가 있습니다:
> - **스크립트 A** — 60~90초 리스팅 기능 영상(마케팅, 다듬어진 버전).
> - **스크립트 B** — 제출 노트에 첨부하는 심사관 워크스루(필수 플로우를 처음부터 끝까지:
>   설치 → 적립 → 교환 → 추천 → 예측 → 클린 언인스톨).
>
> 스크립트 B로 한 번 촬영한 뒤 짧은 하이라이트만 잘라 리스팅용으로 쓰면 한 번에 둘 다 커버됩니다.

---

## 사양 & 게시 위치

- **포맷**: MP4, 1080p (1920×1080), 가로. YouTube 업로드(Unlisted 가능), 리스팅의 "Feature video" 필드에 링크 붙여넣기.
- **길이**: 스크립트 A ≤ 90초. 스크립트 B 2~4분.
- **오디오**: 내레이션 또는 화면 자막(선택). 자막이 더 안전(심사관은 음소거로 보는 경우가 많음) — 아래 내레이션 문구를 자막으로 굽기.
- **저작권 있는 음악 금지.** 무음 또는 로열티 프리 트랙.

## 촬영 전 (5분)

1. 데모 데이터를 쓰도록 로컬 dev: `node scripts/seed-demo.mjs` 후 `shopify app dev` (또는 실제 테스트 주문 몇 건으로 프로덕션에서 촬영).
2. Roost 어드민에서 **리워드**가 최소 1개 있는지 확인(설정 → 리워드, 예: "$5 off", 500pt) — 교환 장면을 위해.
3. 미리 탭 열어두기: Roost **대시보드**, **예측**, **설정**; 위젯이 있는 스토어프론트; Shopify **주문(Orders)**.
4. 깨끗한 브라우저 창 사용(개인 북마크/이메일 비노출). 실제 고객 이메일 가리기 — 데모 데이터만.
5. 창을 16:9로, 텍스트가 읽히도록 확대.
6. dev에서 촬영 완료 후: `shopify app dev clean`으로 프로덕션 복귀.

---

## 스크립트 A — 리스팅 기능 영상 (~75초)

| 시간 | 화면 | 자막 / 내레이션 |
|---|---|---|
| 0:00–0:06 | Roost 대시보드, 통계 카드 위로 천천히 팬 | "Roost — an honest loyalty app for small Shopify stores." |
| 0:06–0:16 | 설정 화면: 적립률 지정, 리워드 추가 | "Set up points, rewards and referrals in about five minutes. No code." |
| 0:16–0:28 | 스토어프론트: 위젯 열기, 포인트+리워드 표시, 교환 클릭 → 할인 코드 표시 | "Customers earn on every order and redeem points for a one-time discount — right in your storefront, in your brand color." |
| 0:28–0:40 | 추천 링크/현황이 있는 추천 화면 | "Built-in referrals reward both sides. No second app." |
| 0:40–0:55 | 예측 화면: "🔁 임박 / ⚠️ 이탈 위험" 카운트 + 고객 목록; 동의 토글에 호버 | "Roost even predicts who's about to reorder and who's drifting away — and can nudge them with a reminder or bonus points. Every automatic action is off by default." |
| 0:55–1:05 | 플랜 화면: Free + Pro $19 정액 | "One honest flat price. No paywalls on core features, no order-volume penalties." |
| 1:05–1:15 | 다시 대시보드; 이후 "Clean uninstall · GDPR · zero dark patterns" 카드 | "No dark patterns. Uninstall and we leave nothing behind. That's Roost." |

---

## 스크립트 B — 심사관 워크스루 (2~4분)

목표: 필수 동작이 작동함을 증명. 각 단계를 내레이션하고 클릭이 보이게.

| # | 화면에서 수행할 동작 | 멘트(자막) |
|---|---|---|
| 1 | dev 스토어 어드민에 앱이 설치돼 있음을 보여주고 Roost 열기(임베디드 로드). | "Roost is an embedded app using session-token auth — no cookies." |
| 2 | 설정 → 적립률 지정(예: $1 = 1pt), 리워드 "$5 off / 500 pts" 추가. 저장. | "Setup is one short screen. Here's the earn rate and a reward." |
| 3 | Shopify 주문 → 고객 앞으로 주문 생성(또는 초안을 결제 완료로). | "I'll place a test order for a customer." |
| 4 | Roost 대시보드로 복귀 → 최근 활동에 새 "+points" 행 표시; 멤버 열기 → 고객 잔액 표시. | "The orders/create webhook awarded points — visible here on the dashboard and the member's balance." |
| 5 | 스토어프론트 → Roost 위젯 열기 → 리워드 선택 → 교환. 생성된 1회용 할인 코드 표시. | "The customer redeems points for a single-use Shopify discount code, issued via the Admin API." |
| 6 | 추천 → 추천 링크와, 완료된 추천이 양쪽에 보상함을 표시. | "Referrals reward the referrer and the referred customer once, with self-referral guards." |
| 7 | 예측 → 임박/이탈 위험 요약·목록 표시; "기본 OFF" 토글 가리키기; "근거(basis)" 신뢰도 컬럼 강조. | "Predictions estimate repurchase timing and churn risk. All automatic actions are opt-in and off by default; each prediction shows its confidence." |
| 8 | 플랜 → Free + Pro $19 표시; 업그레이드 클릭해 Billing API 확인 화면 표시(완료 불필요). | "Billing is the Shopify Billing API only — no external payments." |
| 9 | 설정 또는 메모: GDPR 웹훅(customers/data_request, customers/redact, shop/redact) 구현됨을 언급. | "The three GDPR compliance webhooks are implemented." |
| 10 | 스토어에서 앱 삭제 → 재설치하거나, 위젯/스크립트·데이터가 남지 않음을 표시(스토어프론트 위젯 사라짐). | "On uninstall, Roost removes the data and storefront blocks it added — zero trace." |

> 심사관 자격증명 메모(제출의 "App testing instructions"에 기재): dev 스토어 URL +
> 스태프/협력자 로그인을 제공하고, "데모 데이터는 미리 시드돼 있습니다; 주문(Orders)에서 테스트 주문을
> 생성하면 포인트 적립을 볼 수 있습니다. 예측은 구매 이력에서 채워집니다."라고 안내.

---

## 촬영 후

- 트리밍, 자막 굽기(위 문구), 1080p MP4로 내보내기.
- YouTube 업로드(Unlisted), 링크 복사.
- 리스팅 → Feature video → 링크 붙여넣기. (스크린샷은 여전히 별도 필수 — `06` 참고.)
