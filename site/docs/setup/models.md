---
title: Choose a model
description: Which LLM provider to use with TWD Design, how to configure it, what a thread costs, and what data is sent
---

# Choose a model

TWD Design works with any model the [Mastra model router](https://mastra.ai/models) supports.
You set two variables: `MODEL` and the provider's API key.

## The quick way

```bash
npm run setup -- model
```

It asks for the model (`zai/glm-5.3-flash` by default), tells you which key variable that provider
uses, tries your key with one tiny request (a few tokens) and saves both to `.env`. A typo in the model
name or a rejected key is explained there, not in your first thread. `npm run setup` runs this step after
the Slack and GitHub ones.

## By hand

```bash
MODEL=anthropic/<model>
ANTHROPIC_API_KEY=sk-ant-...
```

The full list of provider prefixes and key variables is in
[Configuration](../reference/configuration.md#model).

## What to pick

**Start with the provider your company already approves.** On every turn the bot sends the thread's
messages, the current prototype and the repo's `DESIGN.md` to the model. If legal or security has an
approved provider (Anthropic, OpenAI, Azure OpenAI, Bedrock…), use that one and skip the rest of this
section.

What the job needs from a model:

- **Following a long, precise template.** The bot adapts a ~13 KB reference prototype and must keep its
  structure. Mid-size and large models do this well.
- **Writing a lot of HTML fast.** A first version is 3–6k output tokens. Output speed matters more than
  reasoning depth.
- **Reliable tool calls**, to write, edit and save the prototype.

Reasoning ("thinking") modes don't help here: in our measurements they doubled the output tokens and
took a turn from under a minute to several minutes, with no visible improvement. GLM's thinking is off by
default (`THINKING=on` enables it).

## What a thread costs

Measured with `zai/glm-5.3-flash`, thinking off:

| Turn | Typical input | Typical output | Time |
|---|---|---|---|
| First version (`write_prototype`) | 15–24k tokens | 3–6k tokens | 40–70 s |
| Small change (`edit_prototype`) | 25–30k tokens | 0.5–1.5k tokens | 10–25 s |
| Open the pull request | ~29k tokens | ~0.7k tokens | ~20 s |

A typical thread (a first version, two changes and the PR) is about **110k input and 8k output tokens**.
When a version's scenarios fail in the headless check, each fix round adds about one small change
(25–30k input, 0.5–1.5k output).
Input is dominated by the instructions and template (~6k), the design guide (~3–4k) and the current
prototype, which is sent on every turn.

To estimate any model, multiply by its per-token prices:

```
thread cost ≈ 110k × input price per token + 8k × output price per token
```

For example, with Z.ai's list prices at the time of writing (per million tokens, input/output):
`glm-5.3-flash` at $0.15/$0.50 is about **$0.02 per thread**, and `glm-5.3` at $1.40/$4.40 about
**$0.19 per thread**. Check your provider's pricing page for current prices.

::: tip Keep costs predictable
- `MAX_TURNS_PER_THREAD` (default 15) caps how long a thread can go.
- Each turn logs its token usage (`usage` in the `turn` log line), so you can sum real costs per day or per
  channel from your logs.
- Set a spend limit in your provider's console.
:::

## What is sent to the provider

On each turn, and only when someone talks to the bot:

- the thread's messages (text only),
- the current prototype's HTML,
- the linked repo's `design/DESIGN.md`, if there is one,
- the bot's instructions and reference template.

Nothing else from the repo is read or sent. Nothing is stored by the bot. See [Security](../reference/security.md).
