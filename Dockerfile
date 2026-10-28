# syntax=docker/dockerfile:1.7
#
# Consensia — production image.
#   docker compose up -d --build      (see docker-compose.yml and README → Wdrożenie)
#
# Targets:
#   runner  (default) — the Next.js server, standalone output, non-root
#   migrate           — full toolchain for `prisma migrate deploy` / `npm run db:seed`

ARG NODE_VERSION=22-bookworm-slim

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Build-time placeholder: `prisma generate` (postinstall) only needs a syntactically valid URL.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# Placeholders so env validation passes while Next.js collects page data. None of these
# end up in the runtime image; the real values come from the environment at start-up.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone \
    AUTH_SECRET=build-time-placeholder-not-used-at-runtime-000000 \
    APP_URL=http://localhost:3000 \
    EMAIL_FROM=build@localhost \
    EMAIL_TRANSPORT=console
RUN npm run build

# ── Migrations / seed (one-shot container) ───────────────────────────────────
FROM deps AS migrate
COPY . .
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data/uploads

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /data/uploads && chown -R nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

USER nextjs
EXPOSE 3000
VOLUME ["/data/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
