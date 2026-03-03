FROM node:lts AS builder

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

# Install dependencies with lockfile
# --mode=skip-build prevents Yarn from running postinstall/build scripts
# (prisma generate needs the schema which isn't copied yet)
RUN yarn install --mode=skip-build

# Copy source code
COPY apps/api ./apps/api
COPY apps/client ./apps/client
COPY ecosystem.config.js ./

# Build API: generate Prisma client then compile TypeScript
RUN cd apps/api && npx prisma generate && npx tsc

# Build client
RUN cd apps/client && npx next build

FROM node:lts AS runner

WORKDIR /app

COPY --from=builder /app/apps/api/ ./apps/api/
COPY --from=builder /app/apps/client/.next/standalone ./apps/client
COPY --from=builder /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder /app/apps/client/public ./apps/client/public
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js

EXPOSE 3000 5003

RUN npm install -g pm2
RUN addgroup --system app && adduser --system --ingroup app app
RUN chown -R app:app /app

USER app

CMD ["pm2-runtime", "ecosystem.config.js"]
