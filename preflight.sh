#!/bin/sh
# =============================================================================
# Thymely — Pre-deployment validation
# Run this BEFORE `docker compose up` to catch configuration errors early.
# Usage: sh preflight.sh [path/to/.env]
# =============================================================================

set -e

ENV_FILE="${1:-.env}"
errors=0
warnings=0

echo ""
echo "======================================"
echo "  Thymely pre-deployment check"
echo "======================================"
echo ""

# ── Load .env file ───────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "[FATAL] .env file not found at: $ENV_FILE"
  echo "        Copy .env.example to .env and fill in the values."
  exit 1
fi

# Source the .env file (handle lines with export prefix)
set -a
. "$ENV_FILE"
set +a

echo "Using: $ENV_FILE"
echo ""

# ── Helper ───────────────────────────────────────────────────────────
check_required() {
  var_name="$1"
  description="$2"
  eval val="\$$var_name"
  if [ -z "$val" ]; then
    echo "  [ERROR] $var_name is not set — $description"
    errors=$((errors + 1))
  else
    echo "  [OK]    $var_name"
  fi
}

check_warn() {
  var_name="$1"
  description="$2"
  eval val="\$$var_name"
  if [ -z "$val" ]; then
    echo "  [WARN]  $var_name is not set — $description"
    warnings=$((warnings + 1))
  else
    echo "  [OK]    $var_name"
  fi
}

# ── Required variables ───────────────────────────────────────────────
echo "--- Required variables ---"
check_required "POSTGRES_USER" "PostgreSQL username"
check_required "POSTGRES_PASSWORD" "PostgreSQL password"
check_required "SECRET" "JWT signing key"

# Validate SECRET length
if [ -n "$SECRET" ] && [ "$(printf '%s' "$SECRET" | wc -c | tr -d ' ')" -lt 32 ]; then
  echo "  [ERROR] SECRET is too short (min 32 chars). Generate with: openssl rand -base64 48"
  errors=$((errors + 1))
fi

# Validate DATABASE_URL can be constructed
if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ]; then
  echo "  [ERROR] DATABASE_URL will fail — POSTGRES_USER and POSTGRES_PASSWORD are required"
  errors=$((errors + 1))
else
  echo "  [OK]    DATABASE_URL (interpolation valid)"
fi

echo ""

# ── Recommended variables ────────────────────────────────────────────
echo "--- Recommended variables ---"
check_warn "DATA_ENCRYPTION_KEY" "AES key for IMAP/webhook encryption. Generate: openssl rand -hex 32"
check_warn "THYMELY_BOOTSTRAP_PASSWORD" "Initial admin password. If unset, a random one is generated (check init logs)"

# Validate DATA_ENCRYPTION_KEY format if set
if [ -n "$DATA_ENCRYPTION_KEY" ]; then
  key_len=$(printf '%s' "$DATA_ENCRYPTION_KEY" | wc -c | tr -d ' ')
  if [ "$key_len" -ne 64 ]; then
    echo "  [ERROR] DATA_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Got $key_len chars."
    errors=$((errors + 1))
  fi
fi

echo ""

# ── Production hardening ─────────────────────────────────────────────
echo "--- Production hardening ---"

if [ "$TRUST_PROXY" = "true" ]; then
  echo "  [OK]    TRUST_PROXY=true (behind reverse proxy)"
else
  echo "  [INFO]  TRUST_PROXY=false — set to true if behind nginx/Caddy/Traefik"
fi

if [ "$COOKIE_SECURE" = "true" ]; then
  echo "  [OK]    COOKIE_SECURE=true (HTTPS cookies)"
else
  echo "  [WARN]  COOKIE_SECURE=false — set to true when serving over HTTPS"
  warnings=$((warnings + 1))
fi

if [ -n "$CORS_ORIGIN" ]; then
  echo "  [OK]    CORS_ORIGIN=$CORS_ORIGIN"
else
  echo "  [WARN]  CORS_ORIGIN not set — CORS will be permissive in production"
  warnings=$((warnings + 1))
fi

echo ""

# ── Docker check ─────────────────────────────────────────────────────
echo "--- Docker ---"
if command -v docker >/dev/null 2>&1; then
  echo "  [OK]    docker found: $(docker --version | head -1)"
else
  echo "  [ERROR] docker not found"
  errors=$((errors + 1))
fi

if docker compose version >/dev/null 2>&1; then
  echo "  [OK]    docker compose found: $(docker compose version --short)"
else
  echo "  [ERROR] docker compose not found"
  errors=$((errors + 1))
fi

echo ""

# ── Summary ──────────────────────────────────────────────────────────
echo "======================================"
if [ "$errors" -gt 0 ]; then
  echo "  FAILED: $errors error(s), $warnings warning(s)"
  echo "  Fix errors above before running docker compose up."
  echo "======================================"
  exit 1
else
  echo "  PASSED: 0 errors, $warnings warning(s)"
  echo "  Ready to deploy: docker compose up -d"
  echo "======================================"
  exit 0
fi
