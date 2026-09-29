# Production image for the NestJS API. Built from the repo root (context_path ".").
# DATABASE_URL and POSTGRES_* are injected by the fullstack-app Helm chart at runtime.
# main.ts listens on process.env.PORT (set to 8000) with the global "api" prefix;
# the ingress sends /api/* here.
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm --filter @app/api build      # nest build -> apps/api/dist/main.js

FROM node:22-alpine
WORKDIR /repo/apps/api
ENV NODE_ENV=production PORT=8000
RUN corepack enable
# Copy the whole installed workspace so drizzle-kit (devDep) is available for db:push at boot.
COPY --from=build /repo /repo
EXPOSE 8000
# Apply the schema (retry until Postgres is reachable so we don't crashloop on a startup race),
# then start. db:push = drizzle-kit push (idempotent).
CMD ["sh", "-c", "until pnpm db:push; do echo 'db not ready - retrying in 5s'; sleep 5; done; node dist/main.js"]
