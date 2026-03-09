# Development

This guide explains how to set up Thymely locally for development.

## Prerequisites

- **Node.js** 22 or higher
- **Yarn** 4 (Corepack-managed, included with Node.js)
- **PostgreSQL** 15+ (running locally or in Docker)
- **Git**

## Clone and install

```bash
git clone https://github.com/GitCroque/thymely.git
cd thymely
corepack enable
yarn install
```

## Environment setup

Copy the example environment file and fill in your local database credentials:

```bash
cp .env.example .env
```

At minimum, set:

```ini
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/thymely
SECRET=dev-secret-at-least-32-characters-long
DATA_ENCRYPTION_KEY=<openssl rand -hex 32>
```

Run the database migrations:

```bash
cd apps/api
npx prisma migrate deploy
cd ../..
```

## Start the development server

```bash
yarn dev
```

This starts all apps in parallel via [Turborepo](https://turbo.build/):

| App | URL | Description |
| --- | --- | --- |
| `apps/client` | `http://localhost:3000` | Frontend (Next.js) |
| `apps/api` | `http://localhost:5003` | Backend API (Fastify) |
| `apps/landing` | `http://localhost:3001` | Landing page |
| `apps/docs` | `http://localhost:3002` | Documentation (Nextra) |

## Project structure

```
thymely/
  apps/
    api/          Fastify backend + Prisma
    client/       Next.js frontend (pages router)
    landing/      Landing page (Next.js)
    docs/         Documentation (Nextra 4)
  packages/
    config/       Shared ESLint configuration
    tsconfig/     Shared TypeScript configuration
```

## Common commands

| Command | Description |
| --- | --- |
| `yarn dev` | Start all apps in dev mode |
| `yarn build` | Build all apps |
| `yarn lint` | Lint all apps (ESLint 9) |
| `yarn format` | Format code with Prettier |
| `yarn test` | Run unit tests (Vitest, API) |
| `yarn test:e2e` | Run end-to-end tests (Playwright) |

## Type checking

Before committing, verify TypeScript compilation:

```bash
cd apps/api && npx tsc --noEmit
cd apps/client && npx tsc --noEmit
```

## Database

The Prisma schema is at `apps/api/src/prisma/schema.prisma`.

To create a new migration after modifying the schema:

```bash
cd apps/api
npx prisma migrate dev --name <migration-name>
```

To explore the database visually:

```bash
cd apps/api
npx prisma studio
```

## Testing

- **Unit tests** (API): uses [Vitest](https://vitest.dev/). Run with `yarn test`.
- **E2E tests**: uses [Playwright](https://playwright.dev/). Run with `yarn test:e2e`.
