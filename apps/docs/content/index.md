# Thymely

Thymely is a free, open-source, self-hosted helpdesk and ticket management system built for small businesses and internal teams.

It provides a straightforward way to track support requests, manage client communication, and organize your team's workflow -- without recurring subscription fees or vendor lock-in.

## Key features

- **Ticket management** -- create, assign, track, and close tickets with priorities, labels, and time tracking.
- **Email integration** -- receive tickets via IMAP and send notifications via SMTP.
- **Roles and permissions** -- granular RBAC to control who can do what.
- **Client portal** -- let external users submit and follow their tickets.
- **Webhooks** -- notify external systems (Slack, Discord, custom) on ticket events.
- **16 languages** -- localized interface with community translations.
- **Self-hosted** -- your data stays on your infrastructure. Deploy with Docker in minutes.

## Tech stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| API      | Fastify 5, Prisma 5, PostgreSQL   |
| Frontend | Next.js 16, React 19, TailwindCSS |
| Auth     | JWT, OAuth2, OIDC                 |
| Deploy   | Docker, Docker Compose            |

## Get started

Head to the [Installation](/installation) page to deploy Thymely with Docker Compose.
