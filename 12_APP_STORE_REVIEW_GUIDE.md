# 12 — App Store 심사 가이드 (Submission & Review)

> 이 문서는 **Shopify App Store 심사 제출 절차 + 심사관이 실제로 검사하는 것 + 자주 받는
> 거절 사유 대비**를 다룬다. 전체 플로우 검증은 `11_DEV_STORE_TEST_GUIDE.md`, 리스팅 문구는
> `06_APP_STORE_LISTING.md`, PCD 활성화는 `04_PCD_ACTIVATION.md`, 배포는 `05_DEPLOYMENT.md` 참조.
> 여기는 "심사를 통과하기 위해" 무엇을 준비하고 어떤 함정을 피하는지에 집중한다.

---

## 0. 제출 전 전제조건 (이거 안 되면 제출 의미 없음)

- [ ] **프로덕션 배포 완료** — `application_url`이 실제 접속되는 HTTPS(fly.dev 등). 터널 URL로 제출 금지.
- [ ] **개발 스토어 E2E 통과** — `11` 문서의 9장 체크리스트 전부 ✅.
- [ ] **PCD 신청 완료** — `orders/create`·`customers/create`는 보호 고객 데이터. Partner에서 신청해야
      프로덕션에서 customer 필드가 들어온다 (`04_PCD_ACTIVATION.md`).
- [ ] **개인정보처리방침 공개 URL** — `08_PRIVACY_POLICY_EN.md` 내용을 호스팅한 실제 URL (`09` 가이드 ②-1).
- [ ] **지원 이메일** — 응답 가능한 주소.

---

## 1. 제출 절차 (Partner Dashboard)

1. **Partner Dashboard → Apps → Roost → Distribution → Shopify App Store** 선택 (Public app).
2. **App listing** 작성 — 초안은 `06_APP_STORE_LISTING.md`(영문) 활용:
   - 앱 이름 / 한 줄 소개 / 상세 설명 / 카테고리(Loyalty & rewards 등)
   - **스크린샷 최소 3장**(권장 5장, `09` ②-2 구성). 1280×720 이상.
   - 기능 목록, 가격(Free + Pro $19/mo flat).
3. **App setup**:
   - **URLs**: App URL, Allowed redirection URL(s) — 프로덕션 도메인 기준.
   - **Webhooks / Compliance**: GDPR 3종 엔드포인트 자동 인식 확인.
   - **GDPR mandatory webhooks** 필드에 `/webhooks/compliance` 채워졌는지.
4. **Pricing**: Free / Pro $19 — **Shopify Billing API로만** 과금됨을 명시 (가드레일 6).
5. **Privacy policy URL** 입력.
6. **Test instructions(심사관용 노트)** 작성 — 아래 3장 참고. **여기가 통과율을 크게 좌우한다.**
7. **Submit for review**.

> 심사 기간: 보통 **5~10영업일**. **첫 제출은 거의 수정 요청을 받는다** — 정상이다. 빠르게 고쳐 재제출.

---

## 2. 심사관이 실제로 검사하는 것 (체크리스트 매핑)

Shopify 심사관은 앱을 **테스트 스토어에 직접 설치해서** 다음을 확인한다:

| 심사 항목 | 우리 대응 | 검증 위치 |
|---|---|---|
| 설치/OAuth가 깨지지 않는가 | `authenticate.admin` 헬퍼 (직접 구현 X) | `11` §1 |
| 요청 scope가 기능 대비 과하지 않은가(최소권한) | scope 5개, theme/script 없음 | `shopify.app.toml` |
| **필수 웹훅 5종** 동작 | orders/create, app/uninstalled, GDPR 3종 | `11` §3,7,8 |
| **GDPR 3종**이 실제로 데이터 처리하는가 | `webhooks.compliance.tsx` + cascade 삭제 | `11` §7 |
| **클린 언인스톨** — 데이터/주입 코드 제거 | `purgeShop`, Theme App Extension(잔여 0) | `11` §8 |
| **Billing API로만** 과금 | `appSubscriptionCreate`, 외부결제 X | `app.billing.tsx` |
| 어드민 UI가 네이티브한가 | Polaris + App Bridge | 전 라우트 |
| 다크패턴 없음 | 강제 팝업/별점 게이팅/숨은비용 없음 | 가드레일 1·2 |
| 리스팅이 실제 기능과 일치 | 호환성·기능 과장 금지 | `06` |

---

## 3. 심사관용 테스트 노트 (그대로 복붙해서 다듬어 쓰기)

심사관은 로열티/추천/예측을 어떻게 트리거하는지 모른다. **명확한 단계와 데모 데이터를 제공**하면
"기능을 못 찾음"으로 인한 거절을 막는다. 아래를 Partner의 *Test instructions*에 넣는다:

```
Test account: 별도 자격증명 불필요 — 심사용 개발 스토어에 설치하면 동작합니다.

1) 설치 후 Settings 화면에서 적립률/리워드를 설정할 수 있습니다.
   데모 데이터를 미리 시드해 두었습니다(또는: Admin > Customers/Orders로 직접 생성).
2) 적립: 고객이 있는 주문을 생성/결제하면 orders/create 웹훅으로 포인트가 적립됩니다
   (Members 화면에서 잔액 확인).
3) 위젯: Online Store > Themes > App embeds에서 "Roost loyalty widget"를 켜고,
   로그인한 고객으로 스토어프론트를 열면 포인트/리워드/추천 링크가 보입니다(클릭해서 열림).
4) 교환: 위젯에서 리워드를 교환하면 1회용 할인 코드가 발급되고 포인트가 차감됩니다.
5) 예측(Predictions 탭): 구매 이력 기반 재구매 시점/이탈 위험을 신뢰도와 함께 표시합니다.
   자동 액션(리마인더/윈백)은 기본 OFF이며 상인이 명시적으로 켜야 발송됩니다.
6) GDPR/Uninstall: 앱 삭제 시 해당 상점 데이터가 완전히 제거됩니다(흔적 0).

지원 문의: liger4903@gmail.com
```

> 가능하면 심사용 스토어에 `node scripts/seed-demo.mjs <store>` 로 데모 데이터를 채워두면
> 심사관이 빈 화면을 보지 않는다.

---

## 4. 자주 받는 거절 사유 & 사전 대비

1. **"GDPR webhooks가 응답하지 않음/처리 안 함"**
   → 단순 200 반환이 아니라 실제 데이터 처리까지 확인. `11` §7로 redact가 cascade 삭제되는지 검증.
2. **"언인스톨 후 데이터/스크립트 잔존"**
   → `purgeShop` 동작 + Theme App Extension(주입 스크립트 없음) 확인. `11` §8.
3. **"OAuth/설치 실패"**
   → 프로덕션 URL·redirect_urls 정합성. 터널 URL이 toml에 남아있지 않게.
4. **"기능을 찾을 수 없음"**
   → 3장 테스트 노트 + 데모 시드 제공.
5. **"외부 결제 사용"**
   → Billing API만. Stripe/Polar 흔적 없는지 (가드레일 6).
6. **"리스팅이 기능과 불일치 / 과장"**
   → 호환되지 않는 연동을 호환된다 표기 금지. 예측은 "확정"이 아니라 "추정+신뢰도"로 서술 (가드레일 10-1·5).
7. **"스크린샷 부족/저품질"**
   → 최소 3장, 실제 화면. `09` ②-2.
8. **"과도한 scope 요청"**
   → 5개로 최소화돼 있음 — 리스팅 설명에서 각 scope 사용 이유를 적으면 가산점.

---

## 5. 제출 후

- **수정 요청(Changes requested)** 이 오면 항목별로 고치고, 무엇을 어떻게 고쳤는지 회신에 적어 재제출.
- **승인되면**: 리스팅이 공개됨. PCD가 아직이면 적립 웹훅이 프로덕션에서 비활성일 수 있으니 `04` 확인.
- 첫 설치 상인 모니터링: fly 로그에서 orders/create 적립, 에러율, 언인스톨 정리 동작 관찰.

---

## 6. 한눈에 보는 제출 게이트

```
[ ] 프로덕션 배포 + 실제 HTTPS URL
[ ] 11번 E2E 9장 전부 통과
[ ] PCD 신청
[ ] 개인정보처리방침 공개 URL
[ ] 스크린샷 3~5장
[ ] 리스팅 작성(06 기반) — 과장/허위 호환 없음
[ ] 심사관 테스트 노트 작성(3장) + 데모 시드
[ ] Billing: Free + Pro $19, Billing API only
[ ] GDPR 3종 + 클린 언인스톨 재확인
[ ] Submit → (첫 회 수정요청 가정) → 신속 재제출
```
