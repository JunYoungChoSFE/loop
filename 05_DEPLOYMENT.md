# 05 — 배포 가이드 (Fly.io / Render)

> 목적: 개발(SQLite + 터널)에서 **프로덕션(Postgres + 고정 도메인)** 으로 올린다.
> App Store 심사를 받으려면 항상 켜져 있는 실제 호스팅 URL이 필요하다.

---

## 0. 개발 ↔ 프로덕션 차이

| 항목 | 개발 | 프로덕션 |
|---|---|---|
| DB | SQLite (`prisma/dev.sqlite`) | **Postgres** |
| 앱 URL | cloudflare 터널(매번 바뀜) | 고정 HTTPS 도메인 |
| 실행 | `shopify app dev` | `npm run docker-start` (= `setup && start`) |

---

## 1. Prisma를 Postgres로 전환

`prisma/schema.prisma`의 datasource를 프로덕션용으로 바꾼다:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

> ⚠️ provider는 sqlite↔postgresql 동시 지원이 안 된다. 로컬 개발도 Postgres로 통일하거나,
> 배포 브랜치에서만 이 값을 postgresql로 둔다. 전환 후 마이그레이션을 새 DB에 적용:
> `npx prisma migrate deploy` (프로덕션은 `migrate dev` 대신 `deploy`).

---

## 2. 환경변수 (호스팅에 secret으로 등록)

| 변수 | 값 |
|---|---|
| `SHOPIFY_API_KEY` | 앱 client id |
| `SHOPIFY_API_SECRET` | 앱 client secret |
| `SHOPIFY_APP_URL` | 프로덕션 도메인 (예: `https://loop.fly.dev`) |
| `SCOPES` | `read_orders,write_orders,read_customers,write_customers,write_discounts` |
| `DATABASE_URL` | Postgres 연결 문자열 |
| `NODE_ENV` | `production` |
| `RESEND_API_KEY` | (선택) 이메일 발송 시 |
| `EMAIL_FROM` | (선택) 예: `Loop <noreply@yourdomain.com>` |

> 비밀값은 절대 커밋 금지. 호스팅 대시보드/CLI의 secret으로만.

---

## 3-A. Fly.io

```bash
# 1) 앱 생성 (Dockerfile 자동 감지)
fly launch --no-deploy

# 2) Postgres 생성 + 연결 (DATABASE_URL 자동 주입)
fly postgres create
fly postgres attach <postgres-app-name>

# 3) secret 등록
fly secrets set SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... \
  SHOPIFY_APP_URL=https://<app>.fly.dev SCOPES="read_orders,write_orders,read_customers,write_customers,write_discounts" \
  NODE_ENV=production

# 4) 배포 (Dockerfile의 docker-start가 prisma migrate deploy 후 start)
fly deploy
```

## 3-B. Render

1. **New → Web Service** → 이 레포 연결 (Docker 런타임)
2. **New → PostgreSQL** 생성 → Internal Database URL 복사
3. Web Service **Environment**에 위 2번 변수들 등록 (`DATABASE_URL`에 붙여넣기)
4. Build/Start는 Dockerfile이 처리 (`npm run docker-start`)

---

## 4. Shopify 앱 설정을 프로덕션 URL로

`shopify.app.toml`:
```toml
application_url = "https://<프로덕션 도메인>"

[app_proxy]
url = "https://<프로덕션 도메인>/proxy"

[auth]
redirect_urls = [ "https://<프로덕션 도메인>/api/auth" ]

[build]
include_config_on_deploy = true   # 프로덕션 배포 시 config 포함
automatically_update_urls_on_dev = true
```
그 다음:
```bash
shopify app deploy   # 프로덕션 URL/scopes/webhooks/proxy/billing을 released 버전에 반영
```

---

## 5. 배포 후 점검

- [ ] 프로덕션 URL로 앱 설치 → 어드민 임베드 로딩
- [ ] App Proxy: 스토어프론트 위젯이 `/apps/loop/state` 받아오는지
- [ ] 웹훅: orders/create(PCD 승인 후) 적립, app/uninstalled 데이터 삭제
- [ ] Billing: Pro 구독 플로우 (실서버에선 isTest=false → 실제 청구)
- [ ] 클린 언인스톨: 삭제 후 DB·테마 흔적 0
