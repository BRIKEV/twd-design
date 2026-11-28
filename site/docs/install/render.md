---
title: Deploy on Render
description: Deploy TWD Design on Render with one click, using the published image and the .env from npm run setup
---

# Deploy on Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BRIKEV/twd-design)

The button reads the repo's [Blueprint](https://github.com/BRIKEV/twd-design/blob/main/render.yaml), which
runs the published image `ghcr.io/brikev/twd-design:0.4`: nothing to fork, nothing to build.

## Before you start

Run `npm run setup` on your machine (see [Install](../index.md#install-about-15-minutes)). It creates the
Slack app and the GitHub App, checks your model key, and leaves everything in a `.env` file. Keep it open:
Render asks for those values.

## Deploy

1. Click **Deploy to Render** and sign in.
2. Render asks for the secret variables. Copy each one from your `.env`:
   - `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`;
   - `ZHIPU_API_KEY` if you use GLM (the default `MODEL`);
   - `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY`, if you created the GitHub App. The key is the long single
     line that starts with `-----BEGIN`: paste it as it is.
3. **Apply**. When the deploy is live, the logs show the `ready` line. Mention the bot in Slack.

**Another model provider?** Set `MODEL` and leave `ZHIPU_API_KEY` empty, then add your provider's key
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`…) as described below.

## Changing variables later

**Environment → Add from .env** takes a whole `.env` pasted in one go: the quickest way to add another key
or copy over a new `.env` after running `npm run setup` again. Saving redeploys the service.

## Plan and upgrades

Use the **starter** plan (512 MB), or a 1 GB plan if several threads iterate at the same time. Render's free
web services sleep after 15 minutes without HTTP traffic, and in Socket Mode no HTTP traffic arrives, so the
bot would stop answering.

Each redeploy pulls the latest `0.1.x` image. To move to a new minor version, change the tag in the
service's **Settings → Image**.

Render checks the service on `/healthz` and sends `SIGTERM` on redeploys, so running turns finish before
the old instance stops.

## HTTP mode on Render

If you prefer HTTP mode: leave `SLACK_APP_TOKEN` empty, set `SLACK_SIGNING_SECRET`, and use
`https://<your-service>.onrender.com/slack/events` as the Request URL in the Slack app (see
[Socket Mode or HTTP](../setup/slack-app.md#socket-mode-or-http)).
