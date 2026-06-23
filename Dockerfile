# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Node 22+ is required at build & runtime: @mikro-orm/core v7 uses fs.globSync
# (Node >= 22.17) and modern pnpm relies on node:sqlite (Node 22+).
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN addgroup -S chapar && adduser -S chapar -G chapar

WORKDIR /app

# Copy only what the app needs at runtime
COPY --from=builder --chown=chapar:chapar /app/node_modules ./node_modules
COPY --from=builder --chown=chapar:chapar /app/dist ./dist
COPY --from=builder --chown=chapar:chapar /app/src/templates/hbs ./dist/templates/hbs

USER chapar

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
