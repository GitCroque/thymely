# Production Security Checklist

Before exposing your Thymely instance to the internet, verify the following.

## Required

### JWT secret

`SECRET` must be at least 32 characters, random and unique per deployment.

```bash
# Generate a strong secret
openssl rand -base64 48
```

Never reuse a secret across environments. If compromised, rotate it immediately -- all active sessions will be invalidated.

### Encryption key

`DATA_ENCRYPTION_KEY` encrypts IMAP credentials and webhook URLs at rest. It must be a 64-character hex string (32 bytes).

```bash
openssl rand -hex 32
```

Store it securely. If you lose this key, encrypted data in the database becomes unrecoverable.

### HTTPS

Thymely should always run behind HTTPS in production. Configure your reverse proxy (see [Reverse Proxy](/proxy)) and set:

```env
COOKIE_SECURE=true
TRUST_PROXY=true
```

`COOKIE_SECURE=true` marks session cookies as `Secure`, preventing transmission over plain HTTP. `TRUST_PROXY=true` tells Fastify to trust `X-Forwarded-*` headers from your reverse proxy -- required for correct IP detection and rate limiting.

### CORS

Set `CORS_ORIGIN` to your domain(s):

```env
CORS_ORIGIN=https://help.example.com
```

Multiple origins are comma-separated. If left empty, CORS is permissive (any origin accepted) -- the API logs a warning on startup.

### Public access

External registration is **enabled by default** (helpdesk clients need to sign up). Public ticket creation is **disabled by default**.

```env
# Disable external signups (internal-only helpdesk)
ALLOW_EXTERNAL_REGISTRATION=false

# Enable anonymous ticket submission (public form)
ALLOW_PUBLIC_TICKETS=true
```

If you enable public tickets, consider adding a reverse proxy rule with rate limiting or a CAPTCHA (e.g. Cloudflare Turnstile) to prevent spam.

## Recommended

### Pre-deployment validation

Run the preflight script before starting Docker:

```bash
sh preflight.sh
```

It checks for missing variables, validates key formats, and flags insecure defaults.

### Bootstrap password

Set `THYMELY_BOOTSTRAP_PASSWORD` in `.env` to control the initial admin password. If unset, a random password is generated and printed to stderr during first startup -- check the init container logs:

```bash
docker compose logs thymely_init 2>&1 | grep BOOTSTRAP
```

Change the admin password immediately after first login.

### Database credentials

Use strong, unique passwords for `POSTGRES_USER` / `POSTGRES_PASSWORD`. These are also interpolated into `DATABASE_URL`.

```bash
# Generate a database password
openssl rand -base64 24
```

### Insecure flags

These flags are `false` by default. Only enable them in trusted environments:

| Flag | What it does |
| --- | --- |
| `ALLOW_INSECURE_IMAP_TLS` | Accepts self-signed IMAP certificates |
| `ALLOW_INSECURE_WEBHOOK_URLS` | Allows `http://` webhook URLs |

## Security features

Thymely includes several built-in security mechanisms:

- **Rate limiting**: 100 requests/minute globally, stricter on auth endpoints (login: 10/15min, password reset: 5/15min)
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (production only)
- **Content Security Policy**: configured in the Next.js client to prevent XSS
- **HTML sanitization**: inbound IMAP emails and comments are sanitized with `sanitize-html`
- **SMTP injection prevention**: outbound email headers are validated
- **Session cookies**: `httpOnly`, `SameSite`, `Secure` (when `COOKIE_SECURE=true`)
- **Soft delete**: users, clients, tickets, and comments are soft-deleted (recoverable)
- **Audit logging**: login, CRUD operations, password resets, role changes, and GDPR actions are logged
- **GDPR erasure**: `POST /api/v1/data/gdpr-erase/:userId` for right-to-erasure compliance

## Secret rotation

### Rotating SECRET (JWT key)

1. Set the new `SECRET` in `.env`.
2. Restart Thymely: `docker compose restart thymely`.
3. All active sessions are invalidated -- users must log in again.

### Rotating DATA_ENCRYPTION_KEY

There is currently no automated re-encryption migration. To rotate:

1. Note your current key.
2. Back up the database (see [Backup & Restore](/backup)).
3. Update the key in `.env`.
4. Encrypted fields (IMAP passwords, webhook URLs) must be re-entered through the admin panel.

### Rotating database password

1. Update `POSTGRES_PASSWORD` in `.env`.
2. Change the password in PostgreSQL: `ALTER USER <user> WITH PASSWORD '<new>';`
3. Restart all containers: `docker compose restart`.
