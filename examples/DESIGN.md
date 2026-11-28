# Design — <Product name>

<!--
Template for design/DESIGN.md. Replace everything in <angle brackets>, delete what doesn't apply.
Aim for 1–4 pages: concrete values and short rules beat long prose.
Guide: https://design.twd.dev/docs/guides/design-md
-->

## Product

<One paragraph: what the product is, who uses it and for what, and the tone of the UI
(e.g. "a B2B dashboard for finance teams: dense, calm, no decoration").>

Stack: <e.g. Vue 3 + Tailwind 4>. <If you use Tailwind, say so: prototypes will use the same classes.>

## Tokens

CSS custom properties ready for the prototype's Tailwind `@theme`, with the exact values from the code
(whatever your project uses: Tailwind, CSS variables, SCSS, a theme object):

```css
--color-primary: #2563eb;       /* main actions, links, focus ring */
--color-primary-hover: #1d4ed8; /* hover on primary */
--color-danger: #dc2626;        /* destructive actions, errors */
--color-success: #15803d;       /* confirmations */
--color-surface: #ffffff;       /* cards, modals */
--color-background: #f9fafb;    /* page background */
--color-text: #111827;          /* body text */
--color-muted: #6b7280;         /* secondary text, metadata */
--color-border: #e5e7eb;        /* dividers, input borders */
--font-sans: Inter, system-ui, sans-serif;
--radius-card: 8px;             /* cards, inputs, buttons */
--shadow-card: 0 4px 6px -1px rgb(0 0 0 / 0.1);
```

- Type scale: page title <30px bold>, section title <20px semibold>, body <16px>, small <14px>.
- Spacing: <4px base; cards 24px padding, page 16px × 40px, gaps 4/8/16/24>.

## Layout

- Max width: <max-w-5xl centered>.
- Header: <sticky, white with blur, app name left, navigation right>.
- Navigation: <top links; active link in primary>.
- <Typical screen: page title, primary action top right, content in cards.>

## Components

- **Buttons**: <primary = solid primary, white text; secondary = white with border; danger = solid danger,
  only for destructive actions and always behind a confirmation dialog>.
- **Inputs**: <label above, full width, border-gray-300, focus ring primary; errors in red below the field>.
- **Cards**: <white, rounded-lg, shadow-md, p-6>.
- **Tables**: <for lists over 10 items; header gray-50; actions in the last column>.
- **Modals**: <centered dialog, title + text + actions right aligned, Cancel always present>.
- **Toasts / messages**: <inline under the form for errors, green text for success>.

## States

- **Empty**: <icon + one sentence + primary action>.
- **Loading**: <skeletons for lists, spinner inside buttons>.
- **Error**: <inline message with a retry action>.

## Accessibility and naming

- Controls: <named by their visible text; icon buttons and repeated controls by aria-label: "Delete {name}",
  "Edit {name}">.
- Header and navigation: <links "Dashboard", "Projects", "Settings"; account menu button "Account">.
- Messages: <success in role="status", errors in role="alert">. Form errors: <under the field, linked with
  aria-describedby>.
- Each screen: <one h1 with the screen name; main content in <main>>.

## Content

- Language: <English>. Tone: <direct and friendly, no exclamation marks>.
- Vocabulary: <we say "workspace", never "project"; "member", never "user">.
- Formats: <dates "19 Nov 2026", currency "€1,200.00">.

## Screens

| Screen | Route | What it does |
|---|---|---|
| <Dashboard> | `</>` | <Summary of ...> |
| <Settings> | `</settings>` | <Profile and preferences> |

## Where things are

How the code is organized, so the bot can go from a route to the code of its screen. Conventions, not a
list per screen: it stays true when screens are added.

- Router: `<src/router.tsx>`
- Pages and features: `<pages in src/pages/ are thin; each feature's UI lives in src/features/<feature>/>`
- Shared components: `<src/shared/ui/>`
- Tokens: `<src/shared/styles/tokens.css>`
- Tests: `<src/**/*.test.tsx, Vitest + Testing Library; helpers in test/utils.tsx>` · mocks/fixtures: `<test/fixtures/>`

## Known gaps

- <e.g. no empty states yet; the nav has no active state; two different button styles in Billing.>

## Constraints for prototypes

- <Use only the tokens above; no new colors.>
- <Reuse existing components before inventing new ones.>
- <Every destructive action needs a confirmation dialog.>
