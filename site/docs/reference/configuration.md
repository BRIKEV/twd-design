---
title: Configuration
description: Every environment variable TWD Design reads, what it does, and where to get it
---

# Configuration

TWD Design is configured only with environment variables. There is no config file for the
service and no database. Copy `.env.example` to `.env` to start.

The bot checks its configuration when it starts. If something is missing or malformed it logs one
`config` line per problem, says what to do about it, and exits with code `1`:

```json
{"level":"error","msg":"config","problem":"SLACK_BOT_TOKEN is missing: the bot token (xoxb-...) from your Slack app, under OAuth & Permissions."}
```

## Slack

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token (`xoxb-…`). Slack app → **OAuth & Permissions**. Available after installing the app to your workspace. |
| `SLACK_APP_TOKEN` | For Socket Mode | App-Level Token (`xapp-…`) with the `connections:write` scope. Slack app → **Basic Information → App-Level Tokens**. |
| `SLACK_SIGNING_SECRET` | In HTTP mode | Slack app → **Basic Information → App Credentials**. |

::: tip Socket Mode or HTTP?
With `SLACK_APP_TOKEN` set, the bot opens an outbound WebSocket to Slack. It needs **no public URL and no
inbound traffic**, so it runs behind a corporate firewall as is. This is the recommended mode.

Leave `SLACK_APP_TOKEN` empty to receive events over HTTP at `POST /slack/events` on `PORT`. You then need
a public HTTPS URL configured as the Request URL in your Slack app.
:::

## Model

| Variable | Required | Description |
|---|---|---|
| `MODEL` | No | The model, as a [Mastra model router](https://mastra.ai/models) id: `provider/model`. Default `zai/glm-5.3`. |
| *Provider API key* | Yes | The key variable of the provider in `MODEL`, see below. |
| `THINKING` | No | `on` enables GLM's thinking mode. Off by default: it roughly doubles output tokens and adds minutes per turn without improving prototypes noticeably. |

| Provider prefix | API key variable |
|---|---|
| `zai`, `zai-coding-plan` | `ZHIPU_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `mistral` | `MISTRAL_API_KEY` |
| `xai` | `XAI_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |

Use the provider your company already approves: the prototype, the thread and the design guide are sent
to it on every turn.

## GitHub (optional)

Without these, the bot works with a neutral design and can't open pull requests.

| Variable | Required | Description |
|---|---|---|
| `GITHUB_APP_ID` | With GitHub | Your GitHub App's **App ID**, on its settings page. |
| `GITHUB_PRIVATE_KEY` | With GitHub | The contents of the `.pem` private key generated for the App. It can be on one line: the bot restores the line breaks. |

Set both or neither. The repo is not configured: the bot uses the last GitHub link pasted in the thread,
and finds the installation for that repo by itself.

## Runtime

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port. Serves `GET /healthz` in both modes, and Slack events in HTTP mode. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. |
| `MAX_TURNS_PER_THREAD` | `15` | After this many bot replies, the thread asks you to start a new one. Caps cost per thread. |
| `SHUTDOWN_TIMEOUT_MS` | `60000` | On `SIGTERM`, how long to wait for running turns before exiting. |
| `SCENARIO_CHECK` | on | Each new version's TWD scenarios run in headless Chrome before it is posted; failures go back to the model to fix (up to 3 rounds). `off` skips it, for example where no browser can run. The Docker image includes Chromium; outside Docker, Puppeteer's own Chrome is used. |

## Health and logs

- `GET /healthz` returns `200 {"status":"ok"}`, or `503 {"status":"shutting_down"}` while the bot drains
  after `SIGTERM`.
- Logs are one JSON object per line on stdout (`info`, `debug`) and stderr (`warn`, `error`). Each bot turn
  logs a `turn` line with the duration, the tools used, the prototype size and the token usage:

```json
{"level":"info","msg":"turn","thread":"C0123:1795.1","turn":2,"repo":"acme/web","ms":20431,"calls":["edit:2"],"bytes":16947,"usage":{"inputTokens":22930,"outputTokens":679}}
```
