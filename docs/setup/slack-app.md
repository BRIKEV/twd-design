---
title: Create the Slack app
description: Create TWD Design's Slack app from the manifest, what to change, what each scope is for, and Socket Mode vs HTTP
---

# Create the Slack app

Each team runs TWD Design with **its own Slack app**: the tokens never leave your infrastructure.
The repo ships a manifest, so creating the app is a paste and a few clicks. About 5 minutes.

## 1. Create it from the manifest

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest**.
2. Pick the workspace.
3. Paste the contents of [`slack-manifest.yaml`](https://github.com/BRIKEV/twd-design/blob/main/slack-manifest.yaml) (YAML tab) → **Next** → **Create**.

Before you paste it, make it yours. The manifest marks every line as `CHANGE` or `KEEP`:

| Field | Change it? | What it is |
|---|---|---|
| `display_information.name` | Yes | The app name people see in Slack. |
| `display_information.description` | Yes | Short description on the app card. |
| `display_information.background_color` | Yes | App card color. |
| `features.bot_user.display_name` | Yes | The handle people mention, e.g. `@design-bot`. |
| `oauth_config.scopes` | **No** | What the bot can do. See [Scopes](#scopes). |
| `settings.event_subscriptions.bot_events` | **No** | What the bot listens to. |
| `settings.socket_mode_enabled` | Only for HTTP mode | See [Socket Mode or HTTP](#socket-mode-or-http). |

::: tip Your brand on the bot
The **icon** isn't in the manifest: upload it in **Basic Information → Display Information** after
creating the app. Use [`brand/slack-icon.png`](https://github.com/BRIKEV/twd-design/blob/main/brand/slack-icon.png)
(TWD's icon, 512×512) or your own. Name, handle, color and icon are all the branding the bot itself has. The prototypes'
look comes from your repo's `DESIGN.md`, see [Your design guide](../guides/design-md.md).
:::

## 2. Get the tokens

| Token | Where | Variable |
|---|---|---|
| App-Level Token | **Basic Information → App-Level Tokens → Generate Token and Scopes**, scope `connections:write` | `SLACK_APP_TOKEN` (`xapp-…`) |
| Bot token | **Install App → Install to Workspace**, then copy the **Bot User OAuth Token** | `SLACK_BOT_TOKEN` (`xoxb-…`) |
| Signing secret | **Basic Information → App Credentials** | `SLACK_SIGNING_SECRET` (HTTP mode only) |

If your workspace requires admin approval, **Install to Workspace** becomes **Request to Install**:
the bot token appears once an admin approves it.

## 3. Invite the bot

The bot only sees channels it is a member of. In each channel where you want to use it:

```
/invite @twd-design
```

## Scopes

Every scope the manifest asks for, and why. Hand this table to whoever approves Slack apps in your company.

| Scope | Why the bot needs it |
|---|---|
| `app_mentions:read` | Receive `@twd-design` mentions, which start or continue a thread. |
| `chat:write` | Reply in the thread. |
| `files:write` | Attach the prototype `.html` to the thread. |
| `files:read` | Download the latest prototype from the thread to iterate on it. The thread is the bot's only storage. |
| `channels:history` | Read the thread's messages in public channels: the conversation is the context for each new version. Also delivers replies in a thread the bot is in, so people don't have to mention it every time. |
| `groups:history` | The same, in private channels the bot was invited to. |
| `reactions:write` | Add ⏳ to your message while it works. |

The bot doesn't read channels it isn't in, doesn't work in DMs, and never stores messages: it reads the
thread when someone talks to it and forgets it after replying.

::: warning Changed the scopes?
After any change to scopes or events, Slack asks you to **reinstall** the app (**Install App →
Reinstall to Workspace**). Until then the old permissions apply.
:::

## Socket Mode or HTTP

| | Socket Mode (default) | HTTP |
|---|---|---|
| How events arrive | The bot opens an outbound WebSocket to Slack | Slack sends `POST` requests to your URL |
| Public URL | Not needed | Required (HTTPS) |
| Behind a firewall | Works as is | Needs an ingress |
| Variables | `SLACK_APP_TOKEN` | `SLACK_SIGNING_SECRET`, `PORT` |
| Slack Marketplace | Not allowed | Allowed (irrelevant when self-hosting) |

**Use Socket Mode** unless your company forbids outbound WebSockets. To switch to HTTP:

1. In the manifest, set `socket_mode_enabled: false` and uncomment `request_url` with your URL
   (`https://<your-host>/slack/events`).
2. Leave `SLACK_APP_TOKEN` empty and set `SLACK_SIGNING_SECRET`.
3. Expose `PORT` (3000) through your ingress. Slack verifies the URL when you save the manifest, so the
   bot must be running.

## Next

- [Create the GitHub App](./github-app.md) (optional: your design guide and pull requests)
- [Choose a model](./models.md)
