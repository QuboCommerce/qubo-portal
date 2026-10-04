FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/api/package.json ./packages/api/
COPY packages/db/package.json ./packages/db/
COPY packages/plans/package.json ./packages/plans/
COPY packages/protocol/package.json ./packages/protocol/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @qubo-portal/api...

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/api ./packages/api
COPY packages/db ./packages/db
COPY packages/plans ./packages/plans
COPY packages/protocol ./packages/protocol

EXPOSE 3340
ENV PORT=3340
ENV HOST=0.0.0.0

# Bun runs TypeScript directly; migrations run first so a fresh database is ready.
CMD ["sh", "-c", "bun packages/db/src/migrate.ts && bun packages/api/src/server.ts"]
