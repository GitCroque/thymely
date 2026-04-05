# Backup & Restore

Regular backups are essential for any production deployment. Thymely stores all data in PostgreSQL and configuration in `.env`.

## What to back up

| Item | Location | Method |
| --- | --- | --- |
| Database | PostgreSQL container | `pg_dump` |
| Environment config | `.env` file | File copy |
| Docker volumes | `pgdata` volume | Volume backup or `pg_dump` |
| Uploaded files | Stored in database (binary) | Included in `pg_dump` |

## Database backup

### Manual backup

```bash
docker exec thymely_postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --compress=9 \
  > "thymely-backup-$(date +%Y%m%d-%H%M%S).dump"
```

The `--format=custom` flag produces a compressed binary dump that supports selective restore. For a plain SQL dump instead:

```bash
docker exec thymely_postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  > "thymely-backup-$(date +%Y%m%d-%H%M%S).sql"
```

### Automated backups (cron)

Create a script at `/opt/thymely/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/thymely/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

docker exec thymely_postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --compress=9 \
  > "$BACKUP_DIR/thymely-$TIMESTAMP.dump"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "thymely-*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: thymely-$TIMESTAMP.dump"
```

Add to crontab (`crontab -e`):

```cron
# Daily backup at 2:00 AM
0 2 * * * /opt/thymely/backup.sh >> /var/log/thymely-backup.log 2>&1
```

## Restore

### From a custom dump

```bash
# Stop the application (keep database running)
docker compose stop thymely

# Drop and recreate the database
docker exec thymely_postgres dropdb -U "$POSTGRES_USER" "$POSTGRES_DB"
docker exec thymely_postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

# Restore the dump
docker exec -i thymely_postgres pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-privileges \
  < thymely-backup-20260405-020000.dump

# Restart
docker compose start thymely
```

### From a plain SQL dump

```bash
docker compose stop thymely
docker exec thymely_postgres dropdb -U "$POSTGRES_USER" "$POSTGRES_DB"
docker exec thymely_postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

cat thymely-backup-20260405-020000.sql | \
  docker exec -i thymely_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

docker compose start thymely
```

## Before upgrading

Always back up before pulling a new version:

```bash
# 1. Backup
docker exec thymely_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --format=custom --compress=9 > pre-upgrade-backup.dump

# 2. Upgrade
docker compose pull
docker compose up -d

# 3. Verify
docker compose logs thymely_init --tail 20
curl http://localhost:5003/
```

If the upgrade fails, restore from the backup and pin the previous image version in `docker-compose.yml`.

## Migrating to a new server

1. Back up the database on the old server.
2. Copy the `.env` file and backup dump to the new server.
3. Start only PostgreSQL: `docker compose up -d thymely_postgres`
4. Wait for it to be healthy: `docker compose ps`
5. Restore the dump (see above).
6. Start the full stack: `docker compose up -d`

The `DATA_ENCRYPTION_KEY` in `.env` must match the one used when IMAP/webhook credentials were saved. If you lose this key, those credentials must be re-entered.
