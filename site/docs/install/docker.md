---
title: Install with Docker
description: Run TWD Design with docker run on any server, with health checks, logs and upgrades
---

# Install with Docker

TWD Design is one container: no database, no volumes, no inbound traffic in Socket Mode.

## Before you start

- A [Slack app](../setup/slack-app.md) and its tokens.
- An API key for your [model provider](../setup/models.md).
- Optional: a [GitHub App](../setup/github-app.md) for your design guide and pull requests.

## 1. Configure

Create an env file with your values. [`.env.example`](https://github.com/BRIKEV/twd-design/blob/main/.env.example)
lists every variable; the minimum for Socket Mode is:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
MODEL=zai/glm-5.3-flash
ZHIPU_API_KEY=...
# Optional
GITHUB_APP_ID=...
GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...-----END RSA PRIVATE KEY-----
```

::: tip
`docker run --env-file` reads each line literally, without quotes or multi-line values. Put
`GITHUB_PRIVATE_KEY` on one line; the bot restores the line breaks.
:::

## 2. Run

```bash
docker run -d \
  --name twd-design \
  --env-file .env \
  --restart unless-stopped \
  -p 3000:3000 \
  ghcr.io/brikev/twd-design:latest
```

The image is multi-arch (`linux/amd64`, `linux/arm64`). Pin a version (`:0.3.0`) in production instead
of `latest`.

::: tip Until the first release
The image is published to GHCR from tagged releases. Before the first one, build it from the repo:
`docker build -t twd-design .` and use `twd-design` as the image name.
:::

`-p 3000:3000` is only needed to reach `/healthz` from outside the container, or for HTTP mode. In Socket
Mode the bot needs no inbound traffic at all.

## 3. Check it

```bash
docker logs twd-design
```

Look for the `ready` line:

```json
{"level":"info","msg":"ready","bot":"U0123ABCD","mode":"socket","port":3000,"model":"zai/glm-5.3-flash","github":true}
```

If the configuration is wrong, the container exits right away and the logs say what to fix, one
`config` line per problem. Then mention the bot in a channel it was invited to.

```bash
curl -s localhost:3000/healthz     # {"status":"ok"}
docker inspect --format '{{.State.Health.Status}}' twd-design   # healthy
```

## Operating it

| | |
|---|---|
| **Health** | The image has a `HEALTHCHECK` on `GET /healthz`. It returns `503` while shutting down. |
| **Logs** | JSON, one object per line, on stdout/stderr. Each turn logs duration, tools and token usage. See [Observability](../reference/observability.md). |
| **Stop** | `docker stop` sends `SIGTERM`: the bot stops taking turns and lets running ones finish (up to `SHUTDOWN_TIMEOUT_MS`, 60 s). Use `docker stop -t 70` so Docker waits long enough. |
| **Upgrade** | Pull the new tag and recreate the container. There is no state to migrate. Read the [changelog](https://github.com/BRIKEV/twd-design/blob/main/CHANGELOG.md) first. |
| **Scale** | Run **one** instance per Slack app. In Socket Mode, several instances split the events between them, which works but doesn't make a single turn faster. |
| **Resources** | Mostly idle, waiting for the model: about 50 MB of RAM at rest. Give it 256 MB and a fraction of a CPU. |

## Next

- [Docker Compose](./docker-compose.md)
- [Troubleshooting](../reference/troubleshooting.md)
