FROM node:22-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/marketing/package.json ./apps/marketing/
COPY packages/plans/package.json ./packages/plans/
COPY packages/protocol/package.json ./packages/protocol/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @qubo-portal/marketing...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/marketing/node_modules ./apps/marketing/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# Public URLs are read at request time, not inlined; only NEXT_PUBLIC_* build args would be.
RUN pnpm --filter @qubo-portal/marketing build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/marketing/.next/standalone ./
COPY --from=builder /app/apps/marketing/.next/static ./apps/marketing/.next/static
COPY --from=builder /app/apps/marketing/public ./apps/marketing/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/marketing/server.js"]
