---
title: Install with Docker Compose
description: Run TWD Design with Docker Compose on your own server
---

# Install with Docker Compose

The repo ships a [`docker-compose.yml`](https://github.com/BRIKEV/twd-design/blob/main/docker-compose.yml)
that reads a `.env` file next to it.

```bash
git clone https://github.com/BRIKEV/twd-design.git twd-design
cd twd-design
cp .env.example .env     # fill it in, see the configuration reference
docker compose up -d
docker compose logs -f   # wait for {"msg":"ready",...}
```

Prefer not to clone? Copy just these two files to a folder on your server:

```yaml
# docker-compose.yml
services:
  twd-design:
    image: ghcr.io/brikev/twd-design:0.3.0
    env_file: .env
    restart: unless-stopped
    ports:
      - "3000:3000"          # only for /healthz from outside, or HTTP mode
    stop_grace_period: 70s   # longer than SHUTDOWN_TIMEOUT_MS so running turns can finish
```

and your `.env` (see [Configuration](../reference/configuration.md)).

::: tip
Put `GITHUB_PRIVATE_KEY` on one line, the `.pem` contents with the line breaks removed. The bot restores
them, and it avoids differences in how tools parse multi-line values in env files.
:::

## Day to day

```bash
docker compose ps                      # status and health
docker compose logs -f                 # JSON logs
docker compose pull && docker compose up -d   # upgrade (after changing the tag)
docker compose down                    # stop; running turns finish first
```

Everything else (health check, shutdown, resources) is the same as with [Docker](./docker.md#operating-it).
