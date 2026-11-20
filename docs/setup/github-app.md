---
title: Create the GitHub App
description: Create the GitHub App that lets TWD Design read your design guide and open pull requests, with minimal permissions
---

# Create the GitHub App

The GitHub App is **optional**. Without it the bot designs with a neutral look and can't save prototypes.
With it, the bot:

- reads `design/DESIGN.md` from the repo linked in the thread, so prototypes use your design;
- opens a pull request with the approved prototype and its `intent.md`.

Like the Slack app, it is **your own App**: its private key stays in your infrastructure, and you choose
exactly which repos it can touch. About 5 minutes.

## The quick way

From a clone of the repo:

```bash
npm run setup -- github
```

It asks for the organization and the App name, then opens a page that takes you to GitHub with the
manifest filled in: the right permissions, no webhook. Click **Create GitHub App** and GitHub hands
the App ID and private key back to the setup, which writes them to `.env`. You never copy a key. Then it
gives you the install link and checks that the App reaches a repo of your choice and whether it has a
`DESIGN.md`.

The rest of this page is the same, by hand, and explains every choice.

## 1. Create the App where your repos live

Create it **in the organization that owns the repos**, not in your personal account: an App created in a
personal account with "Only on this account" can't be installed on an organization's repos.

- Organization: **Your org → Settings → Developer settings → GitHub Apps → New GitHub App**
- Personal repos: **Your profile → Settings → Developer settings → GitHub Apps → New GitHub App**

Fill in:

| Field | Value |
|---|---|
| GitHub App name | Anything unique on GitHub, e.g. `acme-twd-design`. Pull requests are opened as `<name>[bot]`. |
| Homepage URL | Any URL, e.g. your internal docs or this repo. |
| Webhook → Active | **Uncheck it.** The bot never receives GitHub events. |
| Where can this GitHub App be installed? | **Only on this account.** |

## 2. Permissions

Under **Repository permissions**, set exactly these and leave everything else as *No access*:

| Permission | Access | Why |
|---|---|---|
| Contents | Read and write | Read `design/DESIGN.md`. Create the `design/<feature>` branch and its commit. |
| Pull requests | Read and write | Open the pull request. |
| Metadata | Read-only | Mandatory for every App. |

The bot **never writes to the default branch**: it always creates a new branch and opens a pull request,
which your usual review and branch protection rules apply to.

Click **Create GitHub App**.

## 3. Get the credentials

| Value | Where | Variable |
|---|---|---|
| App ID | The App's settings page, **About** | `GITHUB_APP_ID` |
| Private key | Same page, **Private keys → Generate a private key**. A `.pem` file downloads. | `GITHUB_PRIVATE_KEY` |

Put the whole `.pem` contents in `GITHUB_PRIVATE_KEY`. It can be on one line: the bot restores the line
breaks. GitHub won't show the key again, so keep it in your secret manager.

## 4. Install it on your repos

1. On the App's page: **Install App** → your organization → **Only select repositories**.
2. Pick the repos the bot may read and open pull requests in.

That's it: there is no installation ID to configure. When someone pastes a repo link in a thread, the bot
finds the installation for that repo. If the App isn't installed there, the bot replies with the link to
install it.

::: warning Who can use these repos
Anyone who can talk to the bot in Slack can point it at any repo the App is installed on. Install it only
on repos your Slack workspace may see the design guide of and propose pull requests to.
:::

## Give it a design guide

The bot reads `design/DESIGN.md` from the linked repo. If there is none, it says so and uses a neutral
design. See [Your design guide](../guides/design-md.md) for how to write one.

## Next

- [Choose a model](./models.md)
- [Install with Docker](../install/docker.md)
