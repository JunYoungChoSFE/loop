# Roost — Shopify 로열티 앱 킥스타터

소규모 Shopify 상인을 위한 **정직한 로열티 앱**을 Claude Code로 처음부터 빌드하기 위한 묶음.
근거: Smile / Joy / Rivo 등 상위 로열티 앱의 실제 ★1~3 리뷰에서 반복된 4대 불만(약탈적 가격·깨지는 위젯·다크패턴·유료 게이팅 지원)을 정면으로 뒤집는 포지셔닝.

## 파일

| 파일 | 용도 | 읽는 주체 |
|---|---|---|
| `01_기획서_PRODUCT_SPEC.md` | 제품 기획서 (문제·타깃·wedge·기능·가격·리스크) | 사람 |
| `CLAUDE.md` | 프로젝트 "뇌" — 스택·구조·데이터모델·가드레일 | Claude Code (매 세션) |
| `02_BUILD_PROMPTS.md` | Phase 0~8 순차 빌드 프롬프트 | 사람 → Claude Code |

## 쓰는 법

1. 새 폴더에 이 세 파일을 둔다. `CLAUDE.md`는 프로젝트 루트에 그대로 둔다 (Claude Code가 자동으로 읽음).
2. **빌드 전 검증**: 기획서 10번대로, Shopify 커뮤니티에서 소상인에게 불만을 직접 물어 4대 불만이 재현되는지 확인.
3. 선행 준비: Shopify Partner 계정 + 개발 스토어 + Node 18+ + Shopify CLI.
4. `02_BUILD_PROMPTS.md`의 Phase 0부터 **순서대로** Claude Code에 붙여넣는다. 각 Phase 후 개발 스토어에서 실제 동작 확인.

## CitizenCast와 다른 점 (중요)

- **결제**: Polar/Stripe ❌ → **Shopify Billing API 필수** (App Store 정책).
- **스택**: 자유 React ❌ → **Remix + Polaris + App Bridge** (Shopify 표준).
- **배포 깔때기 문제 해결**: 자체 마케팅이 아니라 **App Store 검색**이 배포. 단, 순위는 리뷰 누적이 필요하므로 초반엔 정직하게 쌓는다 (다크패턴 금지).

## 한 줄 마인드셋

> 이 앱의 무기는 기능 수가 아니라 **정직함과 단순함**이다. 대기업이 구조적으로 못 하는 그 자리를, 솔로 개발자라서 차지한다.
