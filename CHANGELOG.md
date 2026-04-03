# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
