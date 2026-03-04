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
COPY apps/docs/package.json ./apps/docs/
COPY apps/landing/package.json ./apps/landing/
COPY packages/config/package.json ./packages/config/
COPY packages/tsconfig/package.json ./packages/tsconfig/

# Install dependencies with lockfile (skip postinstall scripts)
RUN yarn install --mode=skip-build

# Copy source code
COPY apps/api ./apps/api
COPY apps/client ./apps/client
COPY ecosystem.config.js ./

# Run postinstall scripts now that source is available (prisma generate, re2 build, etc.)
RUN yarn install && cd apps/api && npx prisma generate && npx tsc

# Build client
RUN cd apps/client && npx next build

FROM node:22-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl libstdc++6 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/apps/client/.next/standalone/apps/client ./apps/client
COPY --from=builder /app/apps/client/.next/standalone/node_modules ./apps/client/node_modules
COPY --from=builder /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder /app/apps/client/public ./apps/client/public
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

EXPOSE 3000 5003

RUN npm install -g pm2
RUN addgroup --system app && adduser --system --home /home/app --ingroup app app
RUN chown -R app:app /app /home/app

USER app

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:5003/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["pm2-runtime", "ecosystem.config.js"]
