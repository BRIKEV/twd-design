---
title: Create the Slack app
description: Create TWD Design's Slack app from the manifest, what to change, what each scope is for, and Socket Mode vs HTTP
---

# Create the Slack app

Each team runs TWD Design with **its own Slack app**: the tokens never leave your infrastructure.
The repo ships a manifest, so creating the app is a paste and a few clicks. About 5 minutes.

## 1. Create it from the manifest

**The quickest way** is the setup command, from a clone of the repo. It asks for your app's name, handle and
color, gives you a link that creates the app with them, then checks the tokens against Slack and
writes them to `.env`:

```bash
npm install
npm run setup
```

**Or create it with the TWD Design defaults** in one click, and rename it later in the app settings:
[Create the Slack app](https://api.slack.com/apps?new_app=1&manifest_yaml=display_information%3A%0A%20%20name%3A%20%22TWD%20Design%22%0A%20%20description%3A%20%22Test%20While%20Designing%3A%20clickable%20prototypes%20with%20acceptance%20tests%2C%20right%20in%20the%20thread%22%0A%20%20long_description%3A%20%22Ask%20in%20a%20thread%20how%20a%20screen%20would%20look.%20TWD%20Design%20answers%20with%20a%20clickable%20HTML%20prototype%20that%20uses%20your%20design%20guide%2C%20carries%20its%20acceptance%20criteria%20as%20TWD%20scenarios%20you%20can%20run%20in%20the%20page%2C%20and%20notes%20for%20whoever%20implements%20it.%20Iterate%20in%20the%20thread%20until%20the%20team%20agrees%2C%20then%20it%20opens%20a%20pull%20request%20in%20your%20repo.%20Self-hosted%3A%20your%20Slack%20app%2C%20your%20GitHub%20App%2C%20your%20model%20key.%20https%3A%2F%2Ftwd.dev%22%0A%20%20background_color%3A%20%22%23123956%22%0A%0Afeatures%3A%0A%20%20bot_user%3A%0A%20%20%20%20display_name%3A%20%22twd-design%22%0A%20%20%20%20always_online%3A%20true%0A%20%20app_home%3A%0A%20%20%20%20home_tab_enabled%3A%20true%0A%20%20%20%20messages_tab_enabled%3A%20false%0A%20%20%20%20messages_tab_read_only_enabled%3A%20false%0A%0Aoauth_config%3A%0A%20%20scopes%3A%0A%20%20%20%20bot%3A%0A%20%20%20%20%20%20-%20app_mentions%3Aread%0A%20%20%20%20%20%20-%20chat%3Awrite%0A%20%20%20%20%20%20-%20files%3Awrite%0A%20%20%20%20%20%20-%20files%3Aread%0A%20%20%20%20%20%20-%20channels%3Ahistory%0A%20%20%20%20%20%20-%20groups%3Ahistory%0A%20%20%20%20%20%20-%20reactions%3Awrite%0A%0Asettings%3A%0A%20%20event_subscriptions%3A%0A%20%20%20%20bot_events%3A%0A%20%20%20%20%20%20-%20app_mention%0A%20%20%20%20%20%20-%20message.channels%0A%20%20%20%20%20%20-%20message.groups%0A%20%20%20%20%20%20-%20app_home_opened%0A%20%20%20%20%20%20-%20agent_session_stopped%0A%20%20interactivity%3A%0A%20%20%20%20is_enabled%3A%20true%0A%20%20socket_mode_enabled%3A%20true%0A%20%20org_deploy_enabled%3A%20false%0A%20%20token_rotation_enabled%3A%20false).

**Or by hand:**

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

`npm run setup` asks for these and checks them; this is where each one lives.

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
| `reactions:write` | Add ⏳ to your message while it works, in workspaces where Slack's own "working… Stop" indicator isn't available. |

The bot doesn't read channels it isn't in, doesn't work in DMs, and never stores messages: it reads the
thread when someone talks to it and forgets it after replying.

The manifest also turns on, with no extra scopes:

| Setting | What for |
|---|---|
| Interactivity | The buttons under each version (approve, go back, pick the repo), the examples in the welcome, and the repo picker. |
| Home tab (`app_home_opened`) | How to use the bot, and the prototypes waiting to be built. |
| `agent_session_stopped` | Slack's own Stop button while the bot works. |

::: tip Updating an app you created before
Copy the current `slack-manifest.yaml`, paste it in your app under **App Manifest** (keep your name, handle
and color), save, and reinstall when Slack asks. Without it the bot still answers, but buttons do nothing
and there is no Home tab or Stop button.
:::

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

1. In the manifest, set `socket_mode_enabled: false` and uncomment both `request_url` lines (events and
   interactivity) with your URL (`https://<your-host>/slack/events`).
2. Leave `SLACK_APP_TOKEN` empty and set `SLACK_SIGNING_SECRET`.
3. Expose `PORT` (3000) through your ingress. Slack verifies the URL when you save the manifest, so the
   bot must be running.

## Next

- [Working in Slack](../guides/working-in-slack.md): what your team will see
- [Create the GitHub App](./github-app.md) (optional: your design guide and pull requests)
- [Choose a model](./models.md)
