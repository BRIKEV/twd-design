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

- puts your color, radius, shadow and font tokens in the prototype's Tailwind `@theme` (`bg-primary`,
  `rounded-card`…),
- builds screens out of the components you describe, with the states you list,
- names controls and announces messages the way your app does, so its TWD scenarios query what
  development will build,
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
| **Tokens** | Colors with their role (primary, danger, surface, text, muted), fonts, radius, shadows, as CSS custom properties ready for Tailwind's `@theme` (`--color-primary: #2563eb;`). Exact values, whatever your project uses: Tailwind, CSS variables, SCSS or a theme object. |
| **Layout** | Page width, header, navigation, grid, how screens are usually composed. |
| **Components** | Buttons, inputs, cards, tables, modals, toasts… What each looks like and when to use which variant. |
| **States** | Empty, loading, error, success: how your product shows each one. |
| **Accessibility and naming** | How controls get their accessible name (visible text, labels, `aria-label` patterns like "Delete {name}"), the names of the header and navigation links, how messages are announced (`role="status"`, `role="alert"`) and how form errors reach their field. The bot's scenarios query by role and name, like Testing Library: with this they use the names your app uses. Write what the code does today, even if it's inconsistent. |
| **Content** | Vocabulary (what you call things), tone of messages, date and number formats, language. |
| **Screens** | The main existing screens and their routes, so new prototypes fit in. |
| **Where things are** | How the repo is organized: the router, where pages and features live, shared components, tokens, the tests and their mocks or fixtures. The bot follows it to the code of a screen before changing it ([below](#where-things-are)). |
| **Known gaps** | Inconsistencies or missing pieces. The bot avoids copying them, and the prototype can point them out. |
| **Constraints** | Rules for implementable prototypes: "no new colors", "tables always paginate", "use the existing modal". |

You don't need all of it on day one. **Tokens + Components + Content** already change the result a lot.

## Where things are

When a thread asks to change a screen that already exists ("only the notifications section of settings"),
the bot reads that screen's code in the repo first, rebuilds it as it is today and changes only what was
asked. The code is the source of truth; old prototypes only show what was proposed.

To find that code, the bot starts from your router, finds the route, and follows the imports from the page
to the components that render it. Tell it how your repo is organized, not where each screen is: conventions
rarely change, so this section doesn't go stale when screens are added or moved.

```md
## Where things are
- Router: src/router.tsx (each route lazy-loads a page from src/pages/)
- Pages are thin: the UI of each feature lives in src/features/<feature>/ (components/, hooks/)
- Shared components: src/shared/ui/ (Button, Modal, Toggle, DataTable)
- Tokens: src/shared/styles/tokens.css · Tailwind config: tailwind.config.ts
- Copy: src/shared/i18n/en.json
- Tests: src/**/*.test.tsx (Vitest + Testing Library, helpers in test/utils.tsx) · fixtures in test/fixtures/
```

Point it to your tests, whatever kind they are (TWD, unit, end-to-end): they show how the UI is queried and
what realistic data looks like, and the bot reads them when it needs to.

Without it, the bot browses folders from the root to find the router, which works but takes more reads.

The bot only reads; it never changes your code. It doesn't read `.env` files, keys or certificates, and reads
at most 40 KB per file.

## Generate it with your coding agent

The quickest start is to ask the coding agent your team already uses (Claude Code, Cursor, Copilot…) to
write it from the code. Run this prompt in the product repo, then review the result like any pull request:

```text
Create design/DESIGN.md: a design guide that another AI will read to build HTML prototypes (Tailwind and
Vue) that look and behave like this product. It is sent on every request, so keep it to 2–15 KB.

Read the code, not your assumptions: the styles, the Tailwind config or CSS variables, the shared UI
components, the router and the main pages. If there is a CLAUDE.md, AGENTS.md or README, use it.

Sections:
1. Product: one paragraph on what it is, who uses it, the tone.
2. Tokens: colors with their role (primary, danger, surface, text, muted), fonts, radius and shadows as
   CSS custom properties ready for Tailwind 4's @theme, one per line with its role in a comment:
   --color-primary: #2563eb; /* main actions, links */  --radius-card: 14px;  --shadow-card: ...;
   Exact values from the code, whatever it uses (Tailwind, CSS variables, SCSS, a theme object).
   Then the type scale and spacing in one or two lines.
3. Layout: page width, header, navigation, how a screen is usually composed.
4. Components: the shared components (buttons, inputs, cards, tables, modals, toasts), what each looks
   like and when each variant is used.
5. States: how empty, loading, error and success are shown today.
6. Accessibility and naming: how controls get their accessible name (visible text, <label>, aria-label
   patterns for repeated controls such as "Delete {name}"), the exact names of the header and navigation
   links and buttons, how messages are announced (role="status", role="alert", aria-live), how form errors
   reach their field, and the headings and landmarks of a screen. What the code does today, even if it is
   inconsistent; what is missing goes to Known gaps.
7. Content: vocabulary (what things are called in the UI), tone of messages, date and number formats,
   language.
8. Screens: the main screens with their routes, in one line each.
9. Where things are: how the code is organized, not a list per screen: the router file, where pages and
   feature code live and how a page reaches its components, the folder of shared components, the
   tokens or theme file, the tests of any kind (where they live, their helpers) and the mocks or
   fixtures with sample data. Real paths from this repo.
10. Known gaps: inconsistencies or missing pieces you found.
11. Constraints: rules a prototype must follow to be implementable here.

Values, not adjectives. Don't invent anything you didn't see in the code; write "unknown" instead.
```

Commit it at `design/DESIGN.md` on the default branch. Update it when the conventions change (a new router,
a folder restructure), not on every new screen: the bot reads the code, so the guide only has to say where to
start.

## Keep it effective

- **Short beats complete.** It is sent on every turn: aim for 1–4 pages (roughly 2–15 KB). Link out to
  your full design system instead of pasting it.
- **Values, not adjectives.** `--color-primary: #2563eb;` instead of "a vibrant blue".
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
