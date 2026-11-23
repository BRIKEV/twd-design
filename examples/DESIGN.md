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

### Color

| Role | Value | Tailwind | Use |
|---|---|---|---|
| primary | `#2563eb` | `blue-600` | Main actions, links, focus ring |
| primary-hover | `#1d4ed8` | `blue-700` | Hover on primary |
| danger | `#dc2626` | `red-600` | Destructive actions, errors |
| success | `#15803d` | `green-700` | Confirmations |
| surface | `#ffffff` | `white` | Cards, modals |
| background | `#f9fafb` | `gray-50` | Page background |
| text | `#111827` | `gray-900` | Body text |
| muted | `#6b7280` | `gray-500` | Secondary text, metadata |
| border | `#e5e7eb` | `gray-200` | Dividers, input borders |

### Typography

- Font: <e.g. Inter, from Google Fonts; fallback system-ui>.
- Scale: page title <text-3xl bold>, section title <text-xl semibold>, body <text-base>, small <text-sm>.

### Spacing, radius, shadows

- Spacing: <4px base; cards p-6, page px-4 py-10, gaps 4/8/16/24>.
- Radius: <rounded-lg (8px) for cards, inputs and buttons; rounded-full for avatars>.
- Shadows: <shadow-md for cards, shadow-lg for modals>.

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

## Known gaps

- <e.g. no empty states yet; the nav has no active state; two different button styles in Billing.>

## Constraints for prototypes

- <Use only the tokens above; no new colors.>
- <Reuse existing components before inventing new ones.>
- <Every destructive action needs a confirmation dialog.>
