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

Describe the screen in your own words, and paste the link to your repo (`https://github.com/acme/web`) so it
uses that repo's [design guide](./design-md.md). If there is an issue for it, paste its link too.

If the first request of a thread has no repo, the bot asks which one it is for before designing anything,
with two buttons: **Pick repo** (the repos the GitHub App is installed on, and which ones have a design
guide) and **Design without a repo** (a neutral look; you can still pick a repo before approving). It asks
once per thread, and answering with a repo link in words works too.

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

To change anything, mention the bot in the thread: "@twd-design and on mobile?", "@twd-design remove the
banner". It only answers when mentioned, so the team (and other bots, like an issue tracker) can talk in the
same thread without starting a turn. When it answers, it reads the whole thread, the replies that didn't
mention it included, and the message that started the thread even if another app posted it.

Only the latest version has buttons. When a new one arrives, the previous one shows "Replaced by vN".

## Approve

Approving opens a pull request with `design/prototypes/<feature>/index.html` and an `intent.md`
(problem, screens, agreed scenarios, notes for developers), linking back to the thread. If no repo is
linked yet, the bot asks where the PR should go.

When the thread is about an issue of the linked repo (an issue link, or `#71` in the message that started the
thread), the folder and the branch start with its number: `design/prototypes/71-my-karma/`, branch
`design/71-my-karma`, and the intent links the issue.

Only the button opens a pull request. Asking in words ("ship it", "open the PR") gets a reminder to press
it, so a sentence the bot misreads can never create a PR.

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
