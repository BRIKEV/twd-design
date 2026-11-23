---
title: Your design guide (DESIGN.md)
description: How to write the design/DESIGN.md that makes TWD Design draw with your product's look, components and vocabulary
---

# Your design guide

`design/DESIGN.md` is how TWD Design learns what your product looks like. When a thread links your
repo, the bot reads this file on every turn and builds prototypes with your colors, type, components and
words. Without it, prototypes use a neutral look.

It is also useful on its own: a short, written description of your UI that new people, designers and
other tools can read.

## Where it goes

```
your-repo/
  design/
    DESIGN.md
```

On the default branch, exactly at `design/DESIGN.md`. Commit it like any other file.

## What the bot does with it

The whole file goes to the model as the product's design guide, next to a reference prototype built with
**Tailwind**. The model then:

- turns your color, radius, shadow and font tokens into Tailwind theme tokens (`bg-primary`,
  `rounded-card`…),
- builds screens out of the components you describe, with the states you list,
- writes copy with your product's vocabulary and tone,
- respects the constraints you write down (what exists, what doesn't, what to avoid).

So write it for a reader that is smart but has never seen your product: concrete values, short rules,
examples. If your app uses Tailwind, say so and use its class names: the prototype's markup will then be
close to portable as is.

## Recommended structure

Start from the template in [`examples/DESIGN.md`](https://github.com/BRIKEV/twd-design/blob/main/examples/DESIGN.md). It has these sections:

| Section | What to put in it |
|---|---|
| **Product** | One paragraph: what the product is, who uses it, the tone (serious, friendly, dense, airy). |
| **Tokens** | Colors with their role (primary, danger, surface, text, muted), typography scale, spacing, radius, shadows. Hex values, plus the Tailwind name if you use Tailwind. |
| **Layout** | Page width, header, navigation, grid, how screens are usually composed. |
| **Components** | Buttons, inputs, cards, tables, modals, toasts… What each looks like and when to use which variant. |
| **States** | Empty, loading, error, success: how your product shows each one. |
| **Content** | Vocabulary (what you call things), tone of messages, date and number formats, language. |
| **Screens** | The main existing screens and their routes, so new prototypes fit in. |
| **Where things are** | For each screen, the file that renders it, plus the shared components and the tokens file. The bot reads that code before changing an existing screen ([below](#where-things-are)). |
| **Known gaps** | Inconsistencies or missing pieces. The bot avoids copying them, and the prototype can point them out. |
| **Constraints** | Rules for implementable prototypes: "no new colors", "tables always paginate", "use the existing modal". |

You don't need all of it on day one. **Tokens + Components + Content** already change the result a lot.

## Where things are

When a thread asks to change a screen that already exists ("only the notifications section of settings"),
the bot reads that screen's code in the repo first, rebuilds it as it is today and changes only what was
asked. The code is the source of truth; old prototypes only show what was proposed.

It can find the code on its own by browsing folders, but a short map makes it faster and much more
reliable, especially in big repos:

```md
## Where things are
- /settings → src/pages/settings/SettingsPage.tsx (sections in src/pages/settings/sections/)
- /projects → src/pages/projects/ProjectsList.tsx
- Shared components: src/components/ui/ (Button, Modal, Toggle, DataTable)
- Tokens: src/styles/tokens.css · Tailwind config: tailwind.config.ts
```

The bot only reads; it never changes your code. It doesn't read `.env` files, keys or certificates, and reads
at most 40 KB per file.

## Generate it with your coding agent

The quickest start is to ask the coding agent your team already uses (Claude Code, Cursor, Copilot…) to
write it from the code. Run this prompt in the product repo, then review the result like any pull request:

```text
Create design/DESIGN.md: a design guide that another AI will read to build HTML prototypes (Tailwind and
Alpine.js) that look and behave like this product. It is sent on every request, so keep it to 2–15 KB.

Read the code, not your assumptions: the styles, the Tailwind config or CSS variables, the shared UI
components, the router and the main pages. If there is a CLAUDE.md, AGENTS.md or README, use it.

Sections:
1. Product: one paragraph on what it is, who uses it, the tone.
2. Tokens: colors with their role (primary, danger, surface, text, muted), type scale, spacing, radius,
   shadows. Exact values from the code, plus the Tailwind class if the project uses Tailwind.
3. Layout: page width, header, navigation, how a screen is usually composed.
4. Components: the shared components (buttons, inputs, cards, tables, modals, toasts), what each looks
   like and when each variant is used.
5. States: how empty, loading, error and success are shown today.
6. Content: vocabulary (what things are called in the UI), tone of messages, date and number formats,
   language.
7. Screens: the main screens with their routes.
8. Where things are: for each screen, the file that renders it; the folder of shared components; the
   tokens or theme file. Real paths from this repo.
9. Known gaps: inconsistencies or missing pieces you found.
10. Constraints: rules a prototype must follow to be implementable here.

Values, not adjectives. Don't invent anything you didn't see in the code; write "unknown" instead.
```

Commit it at `design/DESIGN.md` on the default branch. Keep the map up to date when screens move: a stale
path only costs the bot a few extra reads, but a correct one makes it start from the right file.

## Keep it effective

- **Short beats complete.** It is sent on every turn: aim for 1–4 pages (roughly 2–15 KB). Link out to
  your full design system instead of pasting it.
- **Values, not adjectives.** `primary: #2563eb (blue-600)` instead of "a vibrant blue".
- **Name the roles.** "Danger buttons only for destructive actions, always with a confirmation dialog" is
  more useful than listing every button.
- **Write down the gaps.** "We have no empty states yet" lets the bot propose one and flag it for you.
- **Review it like code.** Changes go through a pull request; the next prototype uses the new version.

::: tip Don't have one yet?
Start with the template, fill in the tokens from your CSS or `tailwind.config`, list your five most used
components, and iterate: ask the bot for a screen you know well and adjust the guide where the result is off.
:::

## How to check it works

Open a thread with the repo link:

```
@twd-design with https://github.com/acme/web, how would the settings screen look?
```

The prototype should use your colors and components. If the bot says it used a neutral design, it couldn't
find the file: check the path and that the GitHub App is installed on the repo
([Troubleshooting](../reference/troubleshooting.md#it-ignores-my-design)).
