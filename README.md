<h1 align="center">Welcome to Thymely Ticket Management</h1>
<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.2-blue.svg?cacheSeconds=2592000" />
  <a target="_blank">
    <img alt="Github Stars: " src="https://img.shields.io/github/stars/GitCroque/thymely?style=social" />
  </a>
  <img src="https://img.shields.io/docker/pulls/gitcroque/thymely" />
</p>
<p align="center">
    <img src="./static/logo.svg" alt="Logo" height="80px" >
</p>

> Ticket Management System in order to help helpdesks & service desks manage internal staff & customer requests

## Features

- **Ticket Creation**: Bog standard ticket creation with a markdown editor and file uploads
- **A log of client history**
- **Markdown based Notebook with todo lists**
- **Responsive**: Designed for variable screen sizes from mobile up to 4k
- **Multi-deployment**: Quickly deploy using docker & pm2
- **Simple to Use**: Designed to be easy to use with a simple logical workflow

## Installation with Docker

```
version: "3.1"

services:
  thymely_postgres:
    container_name: thymely_postgres
    image: postgres:latest
    restart: always
    ports:
      - 5432:5432
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: thymely
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: thymely

  thymely:
    container_name: thymely
    image: gitcroque/thymely:latest
    ports:
      - 3000:3000
      - 5003:5003
    restart: always
    depends_on:
      - thymely_postgres
    environment:
      DB_USERNAME: "thymely"
      DB_PASSWORD: "1234"
      DB_HOST: "thymely_postgres"
      SECRET: 'thymely4life'

volumes:
 pgdata:

```

Once this is completed then you can go to your server-ip:3000 which was added to the compose file and login.

The default login credentials are

```
admin@admin.com
1234
```

## Documentation

Check out the documentation for Thymely which covers development to general usage on [GitHub](https://github.com/GitCroque/thymely).

## Motivation

- Build a fully fledged helpdesk product which offers what the big players offer, but at a much better ROI than signing up for Zendesk etc.
- Designed to be easy to use with a simple logical workflow
- Self-hosted and open source

Give a star if this project helped you!

## Activity
![Alt](https://repobeats.axiom.co/api/embed/9b568eb9e41b60f60fe155836b1ef0fb2a7b93b9.svg "Repobeats analytics image")

- Github: [@GitCroque](https://github.com/GitCroque)
