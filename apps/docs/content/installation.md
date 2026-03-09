# Installation

Thymely runs as a Docker container alongside a PostgreSQL database. This is the recommended way to deploy it.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) (20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

## Step 1: Create a project directory

```bash
mkdir thymely && cd thymely
```

## Step 2: Create the environment file

Download or create a `.env` file based on the example:

```bash
curl -O https://raw.githubusercontent.com/GitCroque/thymely/main/.env.example
cp .env.example .env
```

Edit `.env` and fill in the required values:

```ini
# Database credentials
POSTGRES_USER=thymely
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=thymely

# Connection string (must match the credentials above)
DATABASE_URL=postgresql://thymely:<strong-random-password>@thymely_postgres:5432/thymely

# JWT signing key -- generate with: openssl rand -base64 48
SECRET=<your-base64-secret>

# AES encryption key for sensitive data -- generate with: openssl rand -hex 32
DATA_ENCRYPTION_KEY=<your-hex-key>

# Optional: set the initial admin password. If omitted, a random one is printed on first start.
THYMELY_BOOTSTRAP_PASSWORD=<your-admin-password>
```

See the [Configuration](/configuration) page for all available variables.

## Step 3: Create the Docker Compose file

Create a `docker-compose.yml`:

```yaml
services:
  thymely_postgres:
    container_name: thymely_postgres
    image: postgres:17
    restart: always
    volumes:
      - pgdata:/var/lib/postgresql/data
    env_file: .env
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  thymely:
    container_name: thymely
    image: ghcr.io/gitcroque/thymely:latest
    ports:
      - "3000:3000"
      - "5003:5003"
    restart: always
    depends_on:
      thymely_postgres:
        condition: service_healthy
    env_file: .env
    networks:
      - frontend
      - backend

networks:
  frontend:
  backend:
    internal: true

volumes:
  pgdata:
```

Port `3000` serves the web interface. Port `5003` serves the API.

## Step 4: Start Thymely

```bash
docker compose up -d
```

Wait for the containers to start (about 30 seconds for the first run, as the database is initialized).

## Step 5: Log in

Open `http://<your-server-ip>:3000` in your browser.

- **Email**: `admin@admin.com`
- **Password**: the value of `THYMELY_BOOTSTRAP_PASSWORD` from your `.env`, or check the container logs if you did not set one:

```bash
docker compose logs thymely | grep -i password
```

See [First Launch](/first-launch) for what to do next.

## Updating Thymely

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on startup.
