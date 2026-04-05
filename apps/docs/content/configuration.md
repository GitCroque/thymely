# Configuration

Thymely is configured through environment variables defined in your `.env` file. The full reference is available in [`.env.example`](https://github.com/GitCroque/thymely/blob/main/.env.example).

## Required variables

| Variable | Description |
| --- | --- |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name (default: `thymely`) |
| `DATABASE_URL` | Full PostgreSQL connection string for Prisma. Format: `postgresql://<user>:<password>@<host>:5432/<db>` |
| `SECRET` | JWT signing key. Must be at least 32 characters, base64-encoded. Generate with `openssl rand -base64 48`. |
| `DATA_ENCRYPTION_KEY` | AES key for encrypting sensitive data at rest (e.g. IMAP credentials). Generate with `openssl rand -hex 32`. |

## Optional variables

### Security and bootstrap

| Variable | Default | Description |
| --- | --- | --- |
| `THYMELY_BOOTSTRAP_PASSWORD` | *(random)* | Initial admin account password. If not set, a random password is printed to stdout on first run. |
| `AUTH_CONFIG_CACHE_TTL_MS` | `60000` | Cache TTL for auth/RBAC config lookups (milliseconds). |

### Network and proxy

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Runtime environment. |
| `PUBLIC_APP_URL` | *(auto-detected)* | Public URL of your instance (e.g. `https://help.example.com`). Used for OAuth/OIDC callback URLs. |
| `CORS_ORIGIN` | *(same-origin)* | Comma-separated list of allowed CORS origins. |
| `TRUST_PROXY` | `false` | Set to `true` if Thymely runs behind a reverse proxy. |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS. |

### Public access

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOW_EXTERNAL_REGISTRATION` | `true` | Allow unauthenticated users to create accounts via the client portal. Set to `false` to restrict signups. |
| `ALLOW_PUBLIC_TICKETS` | `false` | Allow unauthenticated users to submit tickets via the public form. |
| `SESSION_BIND_IP` | `false` | Bind sessions to the client IP address. Prevents session reuse from a different network, but may disconnect mobile users. |

### Email

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOW_INSECURE_IMAP_TLS` | `false` | Allow IMAP connections with self-signed certificates. |
| `ALLOW_INSECURE_WEBHOOK_URLS` | `false` | Allow webhook URLs using `http://` instead of `https://`. |

SMTP and IMAP settings are configured through the admin panel, not environment variables. See [Email Integration](/email).

### Logging

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |

### Analytics

| Variable | Default | Description |
| --- | --- | --- |
| `POSTHOG_API_KEY` | *(empty)* | PostHog API key for anonymous usage analytics. Leave empty to disable entirely. |
