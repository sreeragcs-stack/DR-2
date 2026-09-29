# App template

Turborepo monorepo every generated app forks from.

- `apps/api` — NestJS 11 + Drizzle ORM (Postgres). Routes under `/api`.
- `apps/web` — React 19 + Vite + TanStack Query. Dev server proxies `/api` to the API.
- Data model lives in `apps/api/src/db/schema.ts`. Edit it, then run `db:push`.

## Local dev

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres on :5433
cp .env.example .env
pnpm install
pnpm db:push                                      # sync schema -> db
pnpm db:seed                                      # optional sample data
pnpm dev                                          # api :3001, web :5173
```

Open http://localhost:5173.

## Endpoints

- `GET /api/health`
- `GET|POST /api/todos`, `PATCH|DELETE /api/todos/:id`
- `POST /api/auth/register`, `POST /api/auth/login` → `{ accessToken }`
