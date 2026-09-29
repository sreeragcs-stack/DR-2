# Production image for the web SPA. Built by docker-build-service from the repo root
# (context_path "."), so the whole pnpm workspace + lockfile are present.
# The k8s ingress (Traefik) routes /api -> backend and / -> here, so nginx only serves
# the static SPA — no /api proxy needed.
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
RUN pnpm --filter @app/web build      # vite build -> apps/web/dist

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
