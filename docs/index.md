---
title: TWD Design
description: From a Slack thread to a clickable prototype with acceptance criteria, and a pull request in your repo. Self-hosted.
---

# TWD Design

**Test While Designing.** The tests exist before the code.

Ask in a Slack thread how a screen would look. TWD Design answers with a clickable HTML prototype
that uses your design guide, carries its acceptance criteria as [TWD](https://twd.dev) scenarios you can
run in the page, and notes for whoever implements it. Iterate in the thread until the team agrees, then
it opens a pull request in your repo.

It runs in your infrastructure, with your own Slack app, GitHub App and model key, and stores nothing.

## Where it fits in TWD

TWD runs tests while you develop. TWD Design moves them one step earlier: the acceptance criteria are
agreed in the thread and live in the prototype as TWD scenarios that already pass. Whoever implements the
feature starts from those scenarios and builds until they pass in the real app.

| Stage | Tool |
|---|---|
| Design | **TWD Design** |
| Build | [twd-js](https://twd.dev/getting-started) and the [TWD agent](https://twd.dev/agents) |
| CI | [twd-cli](https://twd.dev/ci-execution) |
| Review | [twd-relay](https://twd.dev/twd-relay) and [recordings](https://twd.dev/recording) |

## Install (about 15 minutes)

1. [Create the Slack app](./setup/slack-app.md) from the manifest. *5 min*
2. [Create the GitHub App](./setup/github-app.md) (optional: design guide and pull requests). *5 min*
3. [Choose a model](./setup/models.md) and get its API key.
4. Run it: [Docker](./install/docker.md), [Docker Compose](./install/docker-compose.md) or [Render](./install/render.md). *5 min*
5. Invite the bot to a channel and mention it.

## Reference

- [Configuration](./reference/configuration.md): every environment variable
- [Security and data](./reference/security.md): what is read, sent and (not) stored
- [Observability](./reference/observability.md): health check and logs
- [Troubleshooting](./reference/troubleshooting.md)
