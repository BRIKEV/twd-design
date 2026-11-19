---
title: Security and data
description: What data TWD Design reads, sends and stores, which permissions it needs, and how to run it safely
---

# Security and data

TWD Design is designed to be easy to approve: it runs in your infrastructure, with your own Slack
app, GitHub App and model key, and it stores nothing.

## What it stores

**Nothing.** There is no database and no disk writes. Each turn:

1. reads the Slack thread (messages and the latest prototype file),
2. reads `design/DESIGN.md` from the linked repo, if any,
3. calls the model,
4. posts the result in the thread,

and then forgets everything. The only things kept in memory between turns are short-lived GitHub
installation tokens (they expire after an hour) and which threads are busy right now.

## Where data goes

| Data | Read from | Sent to |
|---|---|---|
| Thread messages (text) | Slack | Your model provider |
| Current prototype (HTML) | Slack (file in the thread) | Your model provider |
| `design/DESIGN.md` | GitHub (linked repo) | Your model provider |
| New prototype | Model provider | Slack (file in the thread); GitHub (pull request, only when approved) |
| `intent.md` | Model provider | GitHub (pull request, only when approved) |

Nothing else from your repos is read. Prototypes contain only inline fake data: they make no network
requests when opened.

## Logs

Logs contain operational data only: thread IDs, repo names, durations, tool names, prototype sizes and
token counts. They don't contain message text, prototype HTML, design guides or secrets.

## Permissions

**Slack**: seven bot scopes, each explained in [Create the Slack app](../setup/slack-app.md#scopes). The bot
only sees channels it was invited to and doesn't work in DMs.

**GitHub**: `contents: write`, `pull_requests: write`, `metadata: read`, only on the repos you select when
installing the App. See [Create the GitHub App](../setup/github-app.md#_2-permissions).

- It reads one file: `design/DESIGN.md`.
- It writes only through pull requests: a new `design/<feature>` branch with one commit. It never pushes
  to the default branch, so your branch protection and review rules apply.

## Who can do what

Anyone in your Slack workspace who can talk to the bot can:

- ask it for prototypes in channels it was invited to,
- point it at any repo the GitHub App is installed on, which makes it read that repo's `DESIGN.md`,
- ask it to open a pull request in that repo.

So: **install the GitHub App only on repos your whole workspace may propose changes to**, and invite the
bot only to the channels where you want it used.

## Secrets

| Secret | Variable |
|---|---|
| Slack bot token | `SLACK_BOT_TOKEN` |
| Slack app-level token | `SLACK_APP_TOKEN` |
| Slack signing secret (HTTP mode) | `SLACK_SIGNING_SECRET` |
| Model provider key | e.g. `ANTHROPIC_API_KEY` |
| GitHub App private key | `GITHUB_PRIVATE_KEY` |

They are read from the environment only. Inject them from your secret manager (Kubernetes secrets,
Docker secrets, your platform's environment settings) rather than committing an `.env` file. Rotating any
of them is a restart with the new value.

## Network

| Direction | Destination | Why |
|---|---|---|
| Outbound | `slack.com`, `wss://*.slack.com` | Slack API and Socket Mode |
| Outbound | `api.github.com` | Design guide and pull requests (optional) |
| Outbound | Your model provider's API | The model |
| Inbound | None in Socket Mode | HTTP mode: Slack → `POST /slack/events` |

People who open a prototype load Alpine.js, Tailwind and TWD from `cdn.jsdelivr.net` in their browser.
