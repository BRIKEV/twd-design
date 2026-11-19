---
title: Troubleshooting
description: Fixes for the common problems when installing and using TWD Design
---

# Troubleshooting

Start with the logs: the bot writes one JSON line per event, and every problem below shows up there.

## The container exits right after starting

The configuration is incomplete. The logs list each problem and what to do:

```json
{"level":"error","msg":"config","problem":"SLACK_APP_TOKEN should start with xapp- (an App-Level Token with connections:write)."}
```

Fix the variables and start it again. Reference: [Configuration](./configuration.md).

If it says **"Slack rejected SLACK_BOT_TOKEN"**, the token is wrong or the app was uninstalled: copy the
**Bot User OAuth Token** again from **OAuth & Permissions**.

## The bot doesn't answer a mention

1. **Is it running?** The logs show `{"msg":"ready",...}` and `/healthz` returns `ok`.
2. **Is it in the channel?** Run `/invite @twd-design` in the channel.
3. **Did you change scopes or events?** Reinstall the app: **Install App → Reinstall to Workspace**.
4. **Is it a DM?** The bot works in channels only.
5. **HTTP mode:** is the Request URL reachable from the internet, and is `SLACK_SIGNING_SECRET` right?

If the logs show nothing at all when you mention it, Slack isn't delivering the event: it's one of 2, 3 or 5.

## It answers mentions but not replies in the thread

Replies without a mention arrive through the `message.channels` (public) and `message.groups` (private)
events. Check they are in the app's **Event Subscriptions**, then reinstall. The bot only answers replies
in threads where it has already posted.

## "I can't read owner/repo: the GitHub App isn't installed there"

The App isn't installed on that repo. Follow the link in the message, or on the App's page: **Install App →
your org → Configure → add the repo**. If your org doesn't appear, the App was created in a personal
account with "Only on this account": create it in the organization instead. See
[Create the GitHub App](../setup/github-app.md).

## It ignores my design

The bot reads `design/DESIGN.md` from the **last GitHub link pasted in the thread**. Check that:

- the thread contains the repo link (any link to the repo works, e.g. `https://github.com/acme/web`),
- the file is exactly at `design/DESIGN.md` on the default branch,
- `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` are set (the `ready` log line shows `"github":true`).

When the repo has no `DESIGN.md`, the bot says it used a neutral design.

## Something doesn't respond in Slack's preview

Slack shows the `.html` in a sandboxed preview that blocks a few browser features (popups, `alert()`,
network requests, external images). Prototypes are built to work there, forms included. If something still
doesn't respond, **download the file and open it in your browser**: it works the same and has no limits.

## "Something failed: …" in the thread

The turn failed, usually at the model provider. The message and the `turn failed` log line say why. The
usual causes:

- a wrong `MODEL` id or a model your key can't use,
- an invalid or out-of-credit API key,
- the provider's rate limits.

## A turn takes minutes

- Check `THINKING` is not `on`.
- First versions take 40–70 s with a fast model; changes 10–25 s. Much slower usually means a slow model
  or provider. Compare with the `ms` field in the `turn` log lines, and see [Choose a model](../setup/models.md).

## "This thread hit the 15-turn limit"

Start a new thread. You can raise the limit with `MAX_TURNS_PER_THREAD`.

## `WebSocket error` lines in the logs

In Socket Mode, Slack closes and reopens connections from time to time. The client reconnects by itself.
It is only a problem if the bot stops answering, in which case restart it and check outbound access to
`wss://*.slack.com`.
