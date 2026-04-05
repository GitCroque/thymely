# Monitoring

Thymely provides several hooks for monitoring your deployment.

## Health endpoint

The API exposes a health check at `GET /` (port 5003):

```json
{ "healthy": true, "version": "1.0.0", "uptime": 3600 }
```

If PostgreSQL is unreachable, it returns HTTP 503:

```json
{ "healthy": false, "version": "1.0.0", "error": "database unreachable" }
```

Use this endpoint for uptime monitoring (UptimeRobot, Uptime Kuma, Healthchecks.io, etc.).

The Docker container checks all three services (API on 5003, client on 3000, knowledge base on 3002) via the built-in `HEALTHCHECK`.

## Logs

Thymely uses [Pino](https://getpino.io/) for structured JSON logging on stdout/stderr.

### Viewing logs

```bash
# All services
docker compose logs thymely --tail 100 -f

# Init container (first-run bootstrap)
docker compose logs thymely_init

# PostgreSQL
docker compose logs thymely_postgres
```

### Log levels

Set `LOG_LEVEL` in `.env`. Available levels (from most to least verbose): `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Default: `info`.

### Security events

Security-sensitive events are tagged with `{ "security": true }` in the logs:

- `rate_limit_hit` -- IP exceeded rate limit (HTTP 429)
- `forbidden` -- access denied (HTTP 403)
- `login_failed` -- invalid credentials
- Audit log entries (login, CRUD, password reset, role changes)

Filter security events:

```bash
docker compose logs thymely | grep '"security":true'
```

### Forwarding logs

Pino outputs JSON to stdout, which works with any log aggregator:

- **Docker logging driver**: configure `json-file`, `syslog`, or `fluentd` in your Docker daemon
- **Loki + Grafana**: use the Docker Loki plugin or Promtail
- **Datadog**: use the Datadog Docker agent
- **ELK stack**: use Filebeat with Docker input

## Error tracking with Sentry

Thymely has built-in Sentry support for both the API and the frontend.

### Setup

Set these in `.env`:

```env
# Backend (Fastify)
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# Frontend (Next.js)
NEXT_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

Leave empty to disable Sentry entirely. The application functions normally without it.

### What is captured

- All HTTP 500 errors (server-side exceptions)
- Unhandled promise rejections
- Frontend JavaScript errors (when `NEXT_PUBLIC_SENTRY_DSN` is set)

### Traces

`SENTRY_TRACES_SAMPLE_RATE` controls the percentage of requests traced for performance monitoring. Default: `0.1` (10%). Set to `0` to disable tracing, `1.0` for full tracing (high volume).

## Analytics with PostHog

Optional anonymous usage analytics. Set `POSTHOG_API_KEY` in `.env` to enable. Leave empty to disable completely -- no data is sent.

## What to monitor

| Metric | How | Alert threshold |
| --- | --- | --- |
| API availability | `GET /` health endpoint | 503 or timeout > 10s |
| Container health | `docker inspect --format='{{.State.Health.Status}}'` | unhealthy |
| Database connections | PostgreSQL `pg_stat_activity` | > 80% of `max_connections` |
| Disk usage | Host filesystem monitoring | > 80% on `pgdata` volume |
| Error rate | Sentry dashboard or log grep | > 5 errors/minute |
| Rate limit hits | Log grep for `rate_limit_hit` | Sustained > 50/minute |
| Email sync | API logs for `IMAP sync failed` | Consecutive failures > 3 |
| Memory usage | `docker stats` or cAdvisor | > 512MB sustained |
