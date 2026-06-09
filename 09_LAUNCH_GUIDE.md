# 09 — 출시 가이드 (Launch Guide)

> 앱은 이미 Fly.io 프로덕션(`loop-loyalty.fly.dev`)에 배포되어 동작 중이다.
> 이 문서는 남은 출시 절차의 **상세 단계별 가이드**다. 순서대로 따라가면 App Store 제출까지 끝난다.
> 관련 문서: 정책은 `07`·`08`·`08_EN`(채움 완료), 리스팅 초안은 `06`.

---

## ① 프로덕션 적립 스모크 테스트 (~5분, 권장)

진짜 fly 서버에서 적립 웹훅까지 도는지 한 번 확인한다.

### 1-A. 리워드 추가 (위젯·교환 테스트용)
1. 개발 스토어 어드민 → **Roost 앱** 열기 (이제 fly에서 로딩됨)
2. **Settings → Rewards** → 추가:
   - Reward name: `$5 off`
   - Points cost: `500`
   - Type: `Fixed amount off`
   - Value: `5`
   - **Add reward** → 표에 떠야 함

### 1-B. 테스트 주문으로 적립 확인
1. 어드민 → **Orders → Create order**
2. **Add custom item** → 이름 `Test item`, 가격 `50`, 수량 1
3. 오른쪽 **Customer** → 고객 지정(없으면 새로 생성 — ⚠️ 고객 필수)
4. **Collect payment → Mark as paid**

### 1-C. fly 로그에서 확인
cmd에서 (fly PATH 잡힌 세션):
```cmd
flyctl logs
```
- `Order …: 50pt [credited] → member …` 가 보이면 → **프로덕션 적립 웹훅 완벽** ✅
- 대시보드 **Recent activity** 에도 +50 표시
- (고객을 새로 만들었다면) Settings의 Signup bonus가 0이 아니면 `Signup bonus [awarded]` 도 보임

> 이게 확인되면 v1 전 기능이 프로덕션에서 검증된 것이다.

---

## ②-1. 개인정보처리방침 공개 URL 만들기 (~10분)

App Store 리스팅에 **Privacy policy URL**(공개 접근 가능한 주소)이 필요하다. `08_PRIVACY_POLICY_EN.md` 내용을 공개 페이지로 올린다. 가장 쉬운 3가지:

### 방법 A — GitHub Gist (가장 빠름, GitHub 계정 필요)
1. github.com 로그인 → 우상단 **+** → **New gist**
2. 파일명 `loop-privacy-policy.md`, 내용에 `08_PRIVACY_POLICY_EN.md` 본문(`## Roost Privacy Policy`부터) 붙여넣기
3. **Create public gist** → 생성된 URL이 공개 주소 (마크다운 렌더됨)

### 방법 B — Notion (계정 있으면 더 보기 좋음)
1. 새 페이지에 내용 붙여넣기 → 우상단 **Share → Publish** → **Publish to web**
2. 생성된 공개 링크 사용

### 방법 C — GitHub Pages (이미 레포가 있으면)
1. 레포에 `privacy.md` 추가 → Settings → Pages 활성화 → `https://<user>.github.io/<repo>/privacy` 형태 URL

> ⚠️ 게시 전 `08_PRIVACY_POLICY_EN.md`를 한 번 더 읽고, 법인 설립했다면 운영자명을 사업자명으로 바꾼다.
> 이 주소를 ②-3 리스팅의 "Privacy policy URL"에 넣는다.

---

## ②-2. 스크린샷 촬영 (~20분)

App Store는 스크린샷 **최소 3장**(권장 5장)을 요구한다. 권장 사양: **1600×900 (16:9), PNG/JPG**.

### 데이터 채우고 찍기
스크린샷이 비어 보이지 않게 데이터를 채운다:
- **로컬 dev**로 찍는 게 편하다(시드 데이터 사용): 새 터미널에서 `node scripts/seed-demo.mjs` (멤버 3명 시드) → `shopify app dev` → 어드민에서 촬영
  - ⚠️ dev로 찍은 뒤 프로덕션 복귀하려면 `shopify app dev clean` 다시 실행
- 또는 프로덕션에서 직접 리워드 몇 개·테스트 주문 몇 건 만들어 채운 뒤 촬영

### 5장 구성 (`06` 참고)
1. **Dashboard** — 멤버 수·발행 포인트·Recent activity
2. **Settings** — 적립률·리워드·위젯 색상 (5분 세팅 강조)
3. **스토어프론트 위젯** — 런처 + 리워드 패널 (브랜드 색 반영). 스토어프론트 열어서 위젯 펼친 상태로 캡처
4. **Members** — 목록·검색·포인트 조정
5. **Plan** 또는 **Referrals** — 정직한 단일 가격 / 추천 현황

### 캡처 팁
- 브라우저 창을 16:9 비율로 맞추거나, 캡처 후 1600×900으로 크롭/리사이즈
- 민감정보(실제 이메일 등) 없는 데모 데이터로

---

## ②-3. 리스팅 작성 + 심사 제출

### 어디서 하나
**Dev Dashboard (`dev.shopify.com/dashboard`) → loop 앱 → Distribution / App Store listing** 영역에서 리스팅을 작성하고 제출한다. (메뉴명이 다르면 "listing" / "Submit for review" 키워드를 찾는다.)

### 채울 항목 (초안은 `06_APP_STORE_LISTING.md`에 영어로 준비됨)
- **App name**: Roost — Honest Loyalty & Rewards
- **App icon**: 1200×1200 PNG (별도 제작 필요 — 단순한 로고)
- **Tagline / subtitle**: `06`의 태그라인
- **Detailed description**: `06`의 상세 소개 + 기능 불릿
- **Key benefits (3개)**: 각 제목+설명 (정직 가격 / 코드 0 위젯 / 다크패턴 0)
- **Screenshots**: ②-2에서 만든 5장
- **Pricing**: Free $0 + Pro $19/월 (Billing이 코드로 처리하므로 리스팅엔 설명만)
- **Support email**: liger4903@gmail.com
- **Privacy policy URL**: ②-1의 주소
- **Category**: Loyalty and rewards (Marketing)
- **Demo store / review 자격증명**: 심사관이 설치·테스트할 개발 스토어 + 로그인 정보

### 제출 전 최종 체크 (CLAUDE.md 8절)
- [ ] 필수 웹훅 5종 + GDPR 3종 — 등록됨 (loop-7 버전에서 확인됨) ✅
- [ ] 클린 언인스톨 — 구현됨 ✅
- [ ] Billing API로만 과금 — ✅
- [ ] Polaris 어드민 — ✅
- [ ] 개인정보처리방침 URL — ②-1
- [ ] 스크린샷·아이콘 — ②-2 / 아이콘 제작
- [ ] 데모 스토어 자격증명

### 제출 후
- **Submit for review** → Shopify 심사 **5~10영업일**
- **첫 제출은 보통 수정 요청을 받는다**(정상). 이메일로 피드백이 오면 반영 후 재제출
- 승인되면 App Store에 공개

---

## 부록 — 운영 사이클 메모

- **프로덕션 = 평소 상태**. 앱 URL은 fly를 가리킨다.
- **로컬 개발하려면** `shopify app dev` → URL이 터널로 바뀜. 끝나면 **`shopify app dev clean`** 으로 프로덕션(릴리스 버전) 복귀.
- 코드 바꿔 프로덕션 재배포: `flyctl deploy` (앱 코드) → 필요 시 `shopify app deploy` (Shopify 설정/확장).
- 프로덕션 로그: `flyctl logs`. 상태: `flyctl status`.
