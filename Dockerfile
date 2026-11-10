# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/game/package.json apps/game/
COPY apps/admin/package.json apps/admin/
RUN npm ci --no-audit --no-fund
COPY . .
# commit Git untuk halaman Versi & changelog (dikirim install.sh/update.sh)
ARG GIT_SHA=
ENV GIT_SHA=$GIT_SHA
RUN npm run build

# --- runtime ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/game/package.json apps/game/
COPY apps/admin/package.json apps/admin/
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/game/dist apps/game/dist
COPY --from=build /app/apps/admin/dist apps/admin/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "apps/server/dist/index.js"]
