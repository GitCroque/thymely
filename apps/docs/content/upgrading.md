# Upgrading

Thymely uses Docker for deployment. Upgrading is straightforward — pull the new image and restart.

## Standard Upgrade (Docker Compose)

```bash
# Pull the latest image
docker compose pull

# Restart with the new image
docker compose up -d
```

Database migrations run automatically on startup. No manual migration steps needed.

## Portainer

1. Navigate to your Thymely stack
2. Click **Pull and Redeploy**
3. Enable **Re-pull image**
4. Click **Update**

## Version Tags

| Tag | Description |
| --- | --- |
| `latest` | Latest stable release (recommended for production) |
| `nightly` | Built from `main` branch on every push |
| `sha-xxxxxx` | Specific commit build |
| `x.y.z` | Specific version (e.g., `0.8.4`) |

For production, use `latest` or pin a specific version like `0.8.4`.

## Breaking Changes

### v0.8.x

- **SMTP configuration**: If you used `fastify-multer` for file uploads in a custom setup, it has been replaced by `@fastify/multipart`. No action needed if using the official Docker image.
- **CORS**: `CORS_ORIGIN` environment variable is now available. Set it to your domain for stricter security (optional).
- **ESLint**: If contributing, the project now uses ESLint 9 flat config.

### v0.7.x

- **SAML authentication** has been removed. Use OIDC or OAuth instead.
- **SECRET** environment variable is now required in production (minimum 32 characters).

## Backup Before Upgrading

Always back up your database before major upgrades:

```bash
docker compose exec db pg_dump -U thymely thymely > backup-$(date +%F).sql
```

## Rollback

If something goes wrong, you can roll back to a specific version:

```yaml
# docker-compose.yml
services:
  thymely:
    image: ghcr.io/gitcroque/thymely:0.8.3  # Pin to previous version
```

Then restart:

```bash
docker compose up -d
```
