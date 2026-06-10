# SETUP — Roost를 여러 기기에서 개발하기

집 PC, 회사 PC, 휴대폰 어디서든 동일하게 작업하기 위한 가이드.
**핵심 원칙: 코드는 GitHub(`origin`)이 단일 소스. IDE가 아니라 git이 시스템을 "옮긴다".**

---

## 기기별 권장 방식

| 기기 | 방식 | 비고 |
|------|------|------|
| 집 PC | 기존 VS Code (로컬) 또는 Codespaces | 둘 다 같은 repo |
| 회사 PC (설치 제한) | **GitHub Codespaces** (브라우저) | 설치 0, 브라우저만 |
| 휴대폰 | **Claude Code 웹** (claude.ai/code) | 직접 코딩 대신 작업 지시·리뷰·커밋 |

---

## A. GitHub Codespaces (회사 PC / 브라우저)

1. GitHub repo 페이지 → **Code ▸ Codespaces ▸ Create codespace on main**.
2. `.devcontainer/devcontainer.json`을 읽어 Node 20 환경이 자동 구성되고,
   `npm install → prisma generate → migrate deploy`까지 자동 실행된다.
3. 개발 실행:
   ```bash
   npm run dev          # shopify app dev — Partner 로그인 → 키 자동 주입 → 터널 생성
   npm test             # vitest
   npm run typecheck
   ```
   > **`.env` 복사 불필요.** `shopify app dev`가 실행 시 Partner 계정 로그인을 띄우고
   > `SHOPIFY_API_KEY`·`SHOPIFY_API_SECRET`·`SHOPIFY_APP_URL`·`SCOPES`를 자동 주입한다
   > (toml의 `client_id`로 연결). cloudflare 터널도 자동이라 Codespaces 안에서 동작한다.
   > 포워딩된 포트는 필요 시 **Ports** 탭에서 Public으로 바꾼다.
4. (선택) **부가 기능 비밀값** — 이메일/cron을 로컬에서 테스트할 때만 필요:
   - GitHub ▸ Settings ▸ **Codespaces secrets**에 `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` 등록, 또는
   - 터미널에서 `cp .env.example .env` 후 해당 값만 채우기.
   - 안 쓰면 없어도 `npm run dev`는 정상 동작한다.

---

## B. 로컬 VS Code (집 PC)

```bash
git clone https://github.com/JunYoungChoSFE/loop.git
cd loop
# .env는 불필요 — shopify app dev가 Partner 로그인 후 키를 주입한다.
# 이메일/cron 부가 기능을 쓸 때만: cp .env.example .env (PowerShell: copy .env.example .env)
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

> Node는 `package.json` engines 기준 **20.19+ (<22) 또는 22.12+**.

---

## C. 휴대폰 (Claude Code 웹)

1. claude.ai/code 접속 → 이 GitHub repo 연결.
2. 클라우드 샌드박스에서 변경 지시 → 리뷰 → 커밋/PR.
   - 실시간 `shopify app dev`(터널·dev store)는 폰에서 비현실적이라 **권장하지 않음**.
   - 폰은 "작은 수정·리뷰·머지" 용도로, 실제 동작 확인은 PC/Codespaces에서.

---

## 일상 동기화 규칙

- 작업 시작: `git pull`
- 작업 끝: 커밋 후 `git push` — 다음 기기는 항상 최신에서 시작.
- **`.env`는 절대 커밋하지 않는다** (`.gitignore`로 차단됨). 새 기기마다 값을 다시 넣는다.
- `dev.sqlite`도 커밋하지 않는다. 새 환경에선 `prisma migrate deploy`가 빈 DB를 만든다.
  데모 데이터가 필요하면 `node scripts/seed-demo.mjs`로 다시 시드한다.
