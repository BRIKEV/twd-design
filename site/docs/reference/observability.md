---
title: Observability
description: TWD Design's health check, JSON logs and the turn metrics you can build from them
---

# Observability

## Health check

`GET /healthz` on `PORT` (default 3000), in both Socket Mode and HTTP mode:

| Response | Meaning |
|---|---|
| `200 {"status":"ok"}` | Running and taking turns. |
| `503 {"status":"shutting_down"}` | Received `SIGTERM`, finishing running turns. |

The Docker image uses it as its `HEALTHCHECK`. Point Kubernetes probes or your platform's health check at it.

## Logs

One JSON object per line. `debug` and `info` go to stdout, `warn` and `error` to stderr. Set the level with
`LOG_LEVEL` (`debug`, `info`, `warn`, `error`).

Every line has `level`, `time` and `msg`. The ones worth knowing:

| `msg` | When | Fields |
|---|---|---|
| `ready` | Started and connected | `bot`, `mode`, `port`, `model`, `github` |
| `config` | A configuration problem at startup (then it exits) | `problem` |
| `turn` | Each bot reply | see below |
| `turn failed` | A turn ended in an error | `thread`, `error`, `stack` |
| `shutting down` | `SIGTERM` received | `signal`, `timeoutMs` |

Lines from the Slack SDK have `"source"` set to its logger name.

### The `turn` line

```json
{
  "level": "info",
  "time": "2026-11-19T21:12:04.211Z",
  "msg": "turn",
  "thread": "C0CK9M965HQ:1795117212.026759",
  "turn": 2,
  "repo": "acme/web",
  "designGuide": 13496,
  "ms": 20431,
  "calls": ["pr:#6"],
  "pr": "https://github.com/acme/web/pull/6",
  "changed": false,
  "bytes": 16947,
  "usage": { "inputTokens": 28817, "outputTokens": 679, "cachedInputTokens": 0 }
}
```

| Field | Meaning |
|---|---|
| `thread` | `channel:thread_ts`, the thread's identity |
| `turn` | Bot reply number in the thread |
| `repo` | Linked repo, if any |
| `designGuide` | Size in bytes of the `DESIGN.md` read, `null` if none |
| `ms` | Time spent by the model, tools included |
| `calls` | Tools used: `write:<bytes>`, `edit:<n>`, `edit:miss(<n>)`, `pr:#<number>`, `pr:error` |
| `pr` | Pull request URL, when one was opened |
| `changed` | Whether a new version of the prototype was posted |
| `bytes` | Size of the current prototype |
| `usage` | Token usage reported by the provider |

From these lines you can chart turns per day, latency, tokens and cost per thread or per repo in any log
tool (Loki, Datadog, CloudWatch, Elasticsearch…). `edit:miss` counts are a good signal of the model
struggling with edits.

## OpenTelemetry

Exporting traces and metrics with OpenTelemetry is planned (the agent framework, Mastra, supports it).
Until then, the `turn` log line carries the same information.
