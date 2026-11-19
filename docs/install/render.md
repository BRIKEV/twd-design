---
title: Deploy on Render
description: Deploy TWD Design on Render with the included Blueprint
---

# Deploy on Render

The repo includes a [Render Blueprint](https://render.com/docs/infrastructure-as-code)
([`render.yaml`](https://github.com/BRIKEV/twd-design/blob/main/render.yaml)) that builds the
same Dockerfile used everywhere else.

1. Fork or push the repo to your GitHub account.
2. In Render: **New → Blueprint** → pick the repo.
3. Render reads `render.yaml` and asks for the secret variables: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`,
   your model key, and optionally `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY`.
4. **Apply**. When the deploy is live, the logs show the `ready` line.

Render checks the service on `/healthz` and sends `SIGTERM` on redeploys, so running turns finish before
the old instance stops.

::: warning Don't use the free plan
Render's free web services sleep after 15 minutes without HTTP traffic. In Socket Mode no HTTP traffic
arrives, so the bot would sleep and stop answering. The Blueprint uses the `starter` plan.
:::

## HTTP mode on Render

If you prefer HTTP mode: leave `SLACK_APP_TOKEN` empty, set `SLACK_SIGNING_SECRET`, and use
`https://<your-service>.onrender.com/slack/events` as the Request URL in the Slack app (see
[Socket Mode or HTTP](../setup/slack-app.md#socket-mode-or-http)).
