#!/bin/sh
set -e

# ── Pre-flight checks ────────────────────────────────────────────────
echo "==> Pre-flight checks..."

missing=""
[ -z "$DATABASE_URL" ] && missing="$missing DATABASE_URL"
[ -z "$SECRET" ] && missing="$missing SECRET"

if [ -n "$missing" ]; then
  echo "[FATAL] Missing required environment variables:$missing"
  echo "        Set them in .env or your deployment platform."
  exit 1
fi

if [ "$(printf '%s' "$SECRET" | wc -c)" -lt 32 ]; then
  echo "[FATAL] SECRET must be at least 32 characters."
  exit 1
fi

echo "    Pre-flight checks passed."

# ── Database migrations ──────────────────────────────────────────────
echo "==> Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy

# ── Database seed ────────────────────────────────────────────────────
echo "==> Running database seed..."
if npx prisma db seed 2>&1; then
  echo "    Seed completed."
else
  exit_code=$?
  echo "[ERROR] Seed failed with exit code $exit_code"
  exit $exit_code
fi

# ── Secrets backfill ─────────────────────────────────────────────────
echo "==> Running secrets backfill..."
if node dist/scripts/backfill-secrets.js 2>&1; then
  echo "    Backfill completed."
else
  exit_code=$?
  echo "[ERROR] Backfill failed with exit code $exit_code"
  exit $exit_code
fi

# ── Start services ───────────────────────────────────────────────────
echo "==> Starting services with PM2..."
cd /app
exec pm2-runtime ecosystem.config.js
