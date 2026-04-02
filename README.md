<h1 align="center">Thymely</h1>

<p align="center">
  Free, open-source, self-hosted helpdesk for small businesses and internal teams.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.8.2-blue.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-green.svg" />
  <a href="https://ghcr.io/gitcroque/thymely">
    <img alt="Docker" src="https://img.shields.io/badge/docker-ghcr.io%2Fgitcroque%2Fthymely-blue?logo=docker" />
  </a>
</p>

<p align="center">
  <img src="apps/landing/public/screenshots/dashboard.png" alt="Thymely Dashboard" width="800" />
</p>

## Features

- **Ticket management** -- create, assign, track, and close tickets with a rich text editor
- **Role-based access control (RBAC)** -- granular permissions per role
- **Email integration** -- inbound (IMAP) and outbound (SMTP) email-to-ticket
- **Client portal** -- external clients can submit and follow their tickets
- **Time tracking** -- log time spent on tickets
- **File attachments** -- upload files to tickets (10 MB limit, MIME whitelist)
- **Webhooks and notifications** -- Discord, Slack, and custom webhooks
- **Audit logging** -- structured logs for security and compliance
- **Multi-language** -- 16 languages supported
- **Authentication** -- local (email/password), OAuth2, OIDC
- **Self-hosted** -- your data stays on your infrastructure
- **Multi-arch Docker image** -- linux/amd64 and linux/arm64

## Quick Start

### 1. Create a `.env` file

Copy `.env.example` and fill in the required values:

```bash
cp .env.example .env
```

At minimum, set these:

```env
POSTGRES_USER=thymely
POSTGRES_PASSWORD=<strong-db-password>
POSTGRES_DB=thymely
DATABASE_URL=postgresql://thymely:<strong-db-password>@thymely_postgres:5432/thymely

SECRET=<base64-encoded-string-min-32-chars>
THYMELY_BOOTSTRAP_PASSWORD=<strong-admin-password>
DATA_ENCRYPTION_KEY=<openssl rand -hex 32>
```

### 2. Start with Docker Compose

Use the bundled [`docker-compose.yml`](docker-compose.yml). It starts PostgreSQL, runs a one-shot initialization container (`thymely_init`) for migrations, seed, and secret backfill, then starts the app services.

```bash
docker compose up -d
```

Thymely no longer mutates the database at API boot. Schema/data initialization happens explicitly through the init container or through `cd apps/api && yarn bootstrap:init`.

### 3. Log in

Open `http://localhost:3000` and log in with:

- **Email:** `admin@admin.com`
- **Password:** the value you set in `THYMELY_BOOTSTRAP_PASSWORD`

## Configuration

All configuration is done through environment variables. See [`.env.example`](.env.example) for the full list.

| Variable | Required | Description |
| --- | --- | --- |
| `SECRET` | Yes | JWT signing key (base64, min 32 characters) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `THYMELY_BOOTSTRAP_PASSWORD` | Yes | Initial admin account password used by the install/bootstrap step |
| `DATA_ENCRYPTION_KEY` | Recommended | Encryption key for stored secrets (hex or base64, 32+ bytes) |
| `POSTGRES_USER` | Yes | PostgreSQL user |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name (default: `thymely`) |
| `CORS_ORIGIN` | No | Allowed origins, comma-separated |
| `TRUST_PROXY` | No | Set to `true` behind a reverse proxy |
| `COOKIE_SECURE` | No | Set to `true` when using HTTPS |
| `LOG_LEVEL` | No | Pino log level; logs are written to stdout/stderr |

## Development

**Requirements:** Node.js 22+, Yarn 4, PostgreSQL 17

```bash
# Install dependencies
yarn install

# Start all apps in dev mode
yarn dev

# Build
yarn build

# Lint
yarn lint

# Run unit tests (API)
yarn test

# Run E2E tests (Playwright)
yarn test:e2e

# Run the release smoke suite only
yarn test:e2e:smoke
```

### Project structure

```
apps/
  api/        Fastify 5 + Prisma 5 backend (port 5003)
  client/     Next.js 16 frontend (port 3000)
  knowledge-base/ Public KB app (Next.js, port 3002)
  landing/    Landing page (Next.js)
  docs/       Documentation (Nextra 4)
packages/
  config/     Shared ESLint config
  tsconfig/   Shared TypeScript config
```

## Documentation

Documentation is available in `apps/docs/`. A hosted version is planned.

## Contributing

Contributions are welcome. Open an issue to discuss larger changes before submitting a pull request.

## License

[AGPL-3.0](LICENSE)

## Links

- **GitHub:** [github.com/GitCroque/thymely](https://github.com/GitCroque/thymely)
- **Mastodon:** [@jugue@mastodon.social](https://mastodon.social/@jugue)
