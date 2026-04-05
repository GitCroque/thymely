# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-05

### Added

- **Pre-deployment validation** — `preflight.sh` script checks `.env` completeness, key formats, and Docker availability before `docker compose up`.
- **Graceful shutdown** — SIGTERM/SIGINT handlers close Fastify and Prisma connections cleanly. No more interrupted requests on restart.
- **Access logs** — Minimal structured request logging in production (method, URL, status, duration).
- **Session cleanup** — Automatic hourly purge of expired sessions from the database.
- **Public access toggles** — `ALLOW_EXTERNAL_REGISTRATION` (default: true) and `ALLOW_PUBLIC_TICKETS` (default: false) environment variables to control public-facing endpoints.
- **Session IP binding** — Optional `SESSION_BIND_IP=true` to tie sessions to client IP (off by default to avoid mobile disconnects).
- **Documentation: Security Checklist** — Production hardening guide: secrets, HTTPS, CORS, rotation procedures.
- **Documentation: Backup & Restore** — PostgreSQL backup/restore guide with automated cron examples and server migration procedure.
- **Documentation: Monitoring** — Health endpoint, Pino logs, Sentry/PostHog setup, alerting recommendations.
- **New tests** — 63 new unit tests: encryption/decryption (secrets.ts), session management (JWT expiry, IP/UA binding, caching), request token extraction, knowledge base CRUD, time tracking. Coverage: 259 → 322 tests, 15/15 controllers tested.

### Changed

- **Migrations squashed** — 64 incremental migrations consolidated into a single `0_baseline` migration (605 lines). Faster first-run setup, smaller attack surface.
- **Health endpoint** — Now checks PostgreSQL connectivity (`SELECT 1`). Returns HTTP 503 with `{"healthy": false}` when database is unreachable.
- **Docker healthcheck** — Verifies all three services (API:5003, client:3000, knowledge-base:3002), not just the API.
- **Error handler** — 4xx responses no longer expose internal error messages. Validation errors (JSON schema) are still returned; all others use generic messages.
- **Bootstrap password** — No longer printed to stdout. Sent to stderr only to reduce exposure in log aggregators.
- **CORS warning** — Log message corrected: empty `CORS_ORIGIN` blocks cross-origin requests (not "permissive mode").
- **Swagger metadata** — License corrected from MIT to AGPL-3.0. Version fallback updated to 1.0.0.
- **Session binding** — IP check is now opt-in (`SESSION_BIND_IP`). User-agent check remains always active.

### Fixed

- **DATA_ENCRYPTION_KEY ignored by seed** — `seed.js` now uses the `DATA_ENCRYPTION_KEY` environment variable when provided, with hex format validation. Previously generated a random key and ignored the env var.
- **DATABASE_URL silent failure** — `docker-compose.yml` init container now validates `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `SECRET` before running bootstrap.
- **start.sh error masking** — Seed and backfill errors are no longer silently swallowed. Pre-flight checks validate `DATABASE_URL` and `SECRET` before starting.

## [0.9.0] - 2026-04-03

### Added

- **API Documentation (OpenAPI/Swagger)** — Interactive API docs available at `/documentation`. All ~55 routes are auto-tagged by domain (auth, tickets, users, config, etc.). Existing JSON schemas are exposed automatically. Uses `@fastify/swagger` + `@fastify/swagger-ui`.
- **Front-end test infrastructure** — Vitest + jsdom + @testing-library/react configured for the client app. Setup file with mocks for next/router, toast, cookies. Test helpers for rendering with SessionProvider.
- **Front-end unit tests (19 new)** — Coverage for Login page (8 tests: credentials, redirections, OIDC, error handling), ResetPassword component (6 tests: modal lifecycle, password validation, API calls), SessionProvider/useUser/useAuthedUser (5 tests: profile fetch, auth redirects, error boundaries).
- **SMTP connection test endpoint** — `POST /api/v1/config/email/test` validates SMTP credentials without saving (10s timeout, detailed error feedback).
- **Enhanced onboarding wizard** — "Test connection" button on the email step with live success/error feedback. Enriched final step with recommended next actions (create users, configure email, customize settings, read docs).
- **E2E tests: onboarding flow** (2 tests) — Full onboarding completion and re-login verification.
- **E2E tests: session lifecycle** (2 tests) — Session invalidation after password reset, re-login after reset.
- **CI: full E2E suite** — CI workflows now run all E2E tests (not just smoke).

## [0.8.2] - 2026-03-20

### Fixed

- Re-login after password change in onboarding flow
- Onboarding loop — use credentials instead of httpOnly cookie read
- PM2 environment variables (HOSTNAME per-process, PORT=3000 for Railway)
- Remove custom healthcheck, let Railway use default TCP check
- Dockerfile casing standardization
