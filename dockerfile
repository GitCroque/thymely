FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y build-essential python3

# Enable Corepack to use Yarn 4 (specified in package.json packageManager)
RUN corepack enable

# Copy monorepo root config and lockfile
COPY package.json yarn.lock .yarnrc.yml ./

# Copy all workspace package.json files (required by yarn workspaces)
COPY apps/api/package.json ./apps/api/
COPY apps/client/package.json ./apps/client/
COPY apps/knowledge-base/package.json ./apps/knowledge-base/
COPY apps/docs/package.json ./apps/docs/
COPY apps/landing/package.json ./apps/landing/
COPY packages/config/package.json ./packages/config/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# Install dependencies with lockfile (skip postinstall scripts)
# This layer is cached as long as package.json/yarn.lock don't change
RUN yarn install --mode=skip-build

# Copy source code
COPY apps/api ./apps/api
COPY apps/client ./apps/client
COPY apps/knowledge-base ./apps/knowledge-base
COPY ecosystem.config.js ./

# Rebuild native modules + generate Prisma client + compile API
RUN yarn rebuild && cd apps/api && npx prisma generate && npx tsc

# Build client — version is inlined by Next.js at build time
ARG APP_VERSION=dev
RUN cd apps/client && NEXT_PUBLIC_CLIENT_VERSION=${APP_VERSION} npx next build --webpack
RUN cd apps/knowledge-base && npx next build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV PATH="/app/node_modules/.bin:/app/apps/api/node_modules/.bin:${PATH}"

# Install runtime deps + pm2 + create app user in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends openssl libstdc++6 && rm -rf /var/lib/apt/lists/* && \
    npm install -g pm2 && \
    addgroup --system app && adduser --system --home /home/app --ingroup app app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=app:app /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=app:app /app/apps/api/src/prisma ./apps/api/src/prisma
COPY --from=builder --chown=app:app /app/apps/client/.next/standalone/apps/client ./apps/client
COPY --from=builder --chown=app:app /app/apps/client/.next/standalone/node_modules ./apps/client/node_modules
COPY --from=builder --chown=app:app /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder --chown=app:app /app/apps/client/public ./apps/client/public
COPY --from=builder --chown=app:app /app/apps/knowledge-base/.next/standalone/apps/knowledge-base ./apps/knowledge-base
COPY --from=builder --chown=app:app /app/apps/knowledge-base/.next/standalone/node_modules ./apps/knowledge-base/node_modules
COPY --from=builder --chown=app:app /app/apps/knowledge-base/.next/static ./apps/knowledge-base/.next/static
COPY --from=builder --chown=app:app /app/apps/knowledge-base/public ./apps/knowledge-base/public
COPY --from=builder --chown=app:app /app/ecosystem.config.js ./ecosystem.config.js

EXPOSE 3000 3002 5003

USER app

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:5003/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["pm2-runtime", "ecosystem.config.js"]
