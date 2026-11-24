---
title: Why not v0 or Lovable?
description: TWD Design compared with v0, Lovable and Figma Make. A self-hosted alternative for product teams that can't send their product to a third-party AI builder, and that need an agreement, not an app.
aside: false
---

# Why not v0 or Lovable?

v0, Lovable and Figma Make are great at what they do: one person describes an app and gets something
running, fast. If that is your job, use them.

TWD Design solves a different problem. It is for **product teams in companies with processes**: product,
design and development agreeing on a screen before anyone builds it, on infrastructure the company
controls.

## At a glance

| | v0, Lovable, Figma Make | TWD Design |
|---|---|---|
| **Where it runs** | The vendor's cloud | Your servers, with your own Slack app, GitHub App and model key |
| **What it stores** | Your projects, in the vendor's account | Nothing. The Slack thread is the only history |
| **Which AI** | The one the vendor picked | The one your company already approves |
| **Who it's for** | One person building an app | The product trio: product, design and development, together |
| **Where the work happens** | A separate web app | The Slack thread where the team already talks |
| **What you get** | An app or code to ship | An agreement: a prototype in your design system, acceptance tests that already pass, and a pull request |
| **Design system** | Generic, or a template you pick | Yours, from `design/DESIGN.md` in your repo |
| **Price** | Per seat or per credit | Free and open source (MIT). You pay only for the model |

## Your product never leaves your company's control

Companies with sensitive data or compliance rules often can't paste their product into a third-party AI
builder. TWD Design is built to be easy to approve:

- **Self-hosted.** It runs as one container in your infrastructure. There is no TWD Design server in the
  middle.
- **Stores nothing.** No database, no disk writes. Each turn reads the thread, calls the model, posts the
  result and forgets.
- **Your model, your contract.** You choose the provider and the model: Anthropic, OpenAI, Google,
  Bedrock, Mistral and more. Use the one legal and security already approved, with your company's own
  key.
- **It only writes through pull requests.** A new branch and one commit. Your branch protection and review
  rules still apply.

The full list of what is read, sent and where is in [Security and data](/docs/reference/security).

## The result is an agreement, not an app

AI builders are measured by how fast they get you to something running. Inside a company, speed is rarely
what goes wrong. The handoff is: product describes one thing, design draws another, development builds a
third, and everyone finds out in review.

TWD Design keeps the conversation and the result in one place:

1. Someone describes the screen in a Slack thread.
2. The bot answers with a clickable prototype that looks like your product.
3. The team changes it by replying, until everyone agrees.
4. One click opens a pull request with the prototype, what was agreed and a link back to the
   conversation.

Nobody has to copy a decision from a chat into a ticket, or a design into code, and hope nothing gets
lost.

## The tests exist before the code

Every prototype comes with its acceptance criteria written as [TWD](https://twd.dev) tests. Before a
version reaches the thread, the bot runs them in a headless browser and fixes what fails, so the team
only sees versions where the tests pass.

When developers pick up the pull request, "done" is already defined: build the real screen until the same
tests pass. With v0 or Lovable you get code. With TWD Design you also get the criteria to check that code
against.

## When v0 or Lovable is the better choice

- You are one person, or a very small team, and want a working app today.
- You want a deployed app, not a prototype for your team to agree on.
- Sending your product to a hosted service is not a problem for your company.
- Your team doesn't use Slack. TWD Design works in Slack today, and Microsoft Teams is on the roadmap.

## Try it

TWD Design is open source. Your dev team sets it up in about 15 minutes:
[start with the docs](/docs/).
