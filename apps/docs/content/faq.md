# FAQ

## I forgot the admin password

If you set `THYMELY_BOOTSTRAP_PASSWORD` in your `.env`, the admin password is reset to that value on every startup. Restart the container:

```bash
docker compose restart thymely
```

If you did not set `THYMELY_BOOTSTRAP_PASSWORD`, you can add it now to your `.env` and restart. Alternatively, connect to the database and reset the password manually (the password must be a bcrypt hash with cost 12).

## Emails are not being sent

1. Check your SMTP configuration in **Admin > SMTP Email**.
2. Verify the credentials are correct by clicking **Send Test Email**.
3. Check the API logs for error details: `docker compose logs thymely | grep -i smtp`.
4. Make sure your email provider allows SMTP access (some providers like Gmail require an app password).

## How do I update Thymely?

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on startup. No manual steps are required.

It is a good practice to back up your database before updating:

```bash
docker exec thymely_postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql
```

## Can I run Thymely without Docker?

Yes, but Docker is the recommended and supported method. To run without Docker:

1. Install Node.js 22+, Yarn 4, and PostgreSQL.
2. Clone the repository and run `yarn install`.
3. Set up your `.env` with a `DATABASE_URL` pointing to your PostgreSQL instance.
4. Run `cd apps/api && npx prisma migrate deploy` to initialize the database.
5. Run `yarn build` to build all apps.
6. Use [PM2](https://pm2.keymetrics.io/) or a similar process manager to run the API and client.

See the [Development](/development) guide for more details on local setup.

## The client portal is not accessible

Make sure port 3000 is exposed and reachable. If you use a reverse proxy, verify the Nginx/Traefik configuration proxies to the correct port. See [Reverse Proxy](/proxy).

## I see "Internal Server Error" with no details

Check the API logs for the full error:

```bash
docker compose logs thymely --tail 100
```

Thymely intentionally hides internal error details from end users for security. The logs contain the complete error information.

## How do I back up my data?

Back up the PostgreSQL database:

```bash
docker exec thymely_postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> > backup.sql
```

To restore:

```bash
cat backup.sql | docker exec -i thymely_postgres psql -U <POSTGRES_USER> <POSTGRES_DB>
```

Also back up your `.env` file and any uploaded files stored in the Docker volumes.
