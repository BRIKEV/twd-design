---
title: Working in Slack
description: What your team sees when they work with TWD Design in a Slack thread, from the first mention to the pull request
---

# Working in Slack

Everything happens in a Slack thread, and the thread is all the bot remembers. This page is what you
can share with PMs, designers and developers before they start.

## Say hi

Mention the bot with nothing else, or with "help", and it answers with what it does, how to work with it,
and four examples. Click one and it is posted in the thread as your request, and the bot designs it.

That answer is fixed text: it costs nothing and never changes.

::: tip A bare mention in a discussion
If the team already discussed a feature in a thread, mention the bot there with nothing else. It reads
the discussion and designs from it.
:::

## Ask for a screen

Describe the screen in your own words. Paste the link to your repo (`https://github.com/acme/web`) if you
want it to use that repo's [design guide](./design-md.md), or pick the repo later from a button.

While it works, Slack shows that the bot is working with a **Stop** button. Stopping throws away the
version in progress: the last one posted is still the current one.

## Iterate

Each version is an `.html` file in the thread. Open it to click through the screens and run its TWD
scenarios. Before posting it, the bot runs those scenarios in a headless browser and fixes any that fail,
so the version says "✅ 4 TWD scenarios pass". If one still fails after two fixes, the version says which
one, and you can ask the bot to fix it.

Under the latest version:

| Button | What it does |
|---|---|
| **Approve and open PR** | Posts your approval in the thread and opens the pull request with this version. |
| **Back to vN** | Posts the previous version again as a new one. No model call. |
| **Pick repo** | Lists the repos where the GitHub App is installed, and which ones have a design guide. Shown until a repo is linked. |

To change anything, reply in the thread: "and on mobile?", "remove the banner", "the button should say
Sign in". There is no need to mention the bot again in a thread it is already in.

Only the latest version has buttons. When a new one arrives, the previous one shows "Replaced by vN".

## Approve

Approving opens a pull request with `design/prototypes/<feature>/index.html` and an `intent.md`
(problem, screens, agreed scenarios, notes for developers), linking back to the thread. If no repo is
linked yet, the bot asks where the PR should go.

## Waiting to be built

An approved prototype is an open pull request until developers build it and merge it. Open the bot's app
in Slack (its **Home** tab) to see, by repo, the prototypes waiting to be built, how long each has been
waiting, and links to the PR and to the thread where it was agreed.

Mentioning the bot with "pending" in any channel shows the same list.

Both read the open pull requests from GitHub when asked: nothing is stored.

## Limits

- A thread has up to `MAX_TURNS_PER_THREAD` turns (15 by default). The welcome, the buttons themselves
  and picking a repo don't count. Start a new thread to keep going.
- One turn at a time per thread: a message sent while the bot works gets a "one moment".
