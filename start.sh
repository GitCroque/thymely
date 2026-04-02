#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

echo "==> Running database seed..."
npx prisma db seed || echo "Seed already applied or skipped"

echo "==> Running secrets backfill..."
node dist/scripts/backfill-secrets.js || echo "Backfill skipped"

echo "==> Starting services with PM2..."
cd /app
exec pm2-runtime ecosystem.config.js
