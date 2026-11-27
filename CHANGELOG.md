# Changelog

All notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

### Changed
- Prototypes are built with Vue 3 (global build from jsDelivr) instead of Alpine.js. Text is interpolated
  with `{{ }}` inside one element and everything conditional uses `v-if`, so TWD scenarios query the page
  the way Testing Library queries a real app: no sentences split into `<span>`s, no hidden elements found.
  Prototypes made before keep working; new versions of them are edited as they are.
- The reference template shows the patterns that failed most: a route per screen and per step of a flow,
  a route with a parameter, a form that enables its button as you type, length checks with a message.
- A failing scenario tells the model what the screen showed at that moment, and the scenario check passes on
  Vue's render errors (reported with console.error, they unmount the app), so fix rounds aren't blind.
- A syntax error in one of the prototype's scripts is reported with the script, the line and its code,
  before opening the browser: the browser alone says "missing ) after argument list" and runs nothing.
- The skill spells out that the `twd.waitFor` callback isn't async: `getBy*` inside it, never `await`.
- Test first: before writing a new version the model plans its scenarios with `plan_scenarios`, then writes
  the page so every role, name and text they query exists. In the evals it ended green 9 of 9 times (7 of 9
  writing the page first), with fewer fix rounds.
- A control that shows a count keeps a fixed name (the count goes in an `aria-hidden` badge), and scenarios
  check that a message shows up rather than its wording.
- The skill and the template show that the header is outside `#app`: scenarios reach its links and buttons
  with `screenDomGlobal`.
- Scenarios check behavior, not copy: where a flow lands, the messages that show up and the state of
  controls, with at most one exact value when it is what the feature is about. Fake prices, names and long
  sentences stay out of them, so they don't fail on arithmetic and port cleanly to the real app.
- `intent.md` ends with a note for development: port the behavior the criteria describe, not the
  prototype's texts, fake data or markup.
- The plan comes with a page contract: the one element that holds each name and text the scenarios query
  (and whether it's in the header or `#app`), the initial data they rely on, and what each action changes.
  Scenarios prefer roles over text and never query a composed string like `'1 item · Total €14.50'`: in the
  evals, 17 of 18 first-check failures were the page not showing exactly what the scenarios queried.
- Up to 3 fix rounds when a version's scenarios fail (was 2): a version takes longer rather than being
  posted with failing scenarios.

### Added
- Mastra Studio (`npm run studio`) runs one bot turn outside Slack, with traces of every model and tool call,
  as the base for the evals (#1). Code reads can be pinned to a commit (`ref`), so eval results stay comparable.

## [0.3.0] - 2026-11-24

Image: `ghcr.io/brikev/twd-design:0.3.0`. Render services built from the Blueprint move to `:0.3` on their next sync.

### Added
- The bot reads the linked repo's code (`list_repo_files`, `read_repo_file`, read only) before changing a
  screen that already exists, rebuilds it as it is and changes only what was asked. It skips `.env` files,
  keys and certificates and reads at most 40 KB per file. It finds a screen from the router, following the
  imports; a "Where things are" section in `DESIGN.md` says how the repo is organized; the DESIGN.md guide has a prompt to generate the file with your coding agent.
- The docs are part of the site: design.twd.dev/docs, with search, sidebar and dark mode. They moved from
  `docs/` to `site/docs/`; the landing, the bot and the setup link to the site.
- The site explains who it is for: agreeing on a screen before anyone builds it. New pages
  [/why-not-v0-or-lovable](https://design.twd.dev/why-not-v0-or-lovable) and
  [/companies](https://design.twd.dev/companies) (pilots, rollout, training).

## [0.2.0] - 2026-11-23

Image: `ghcr.io/brikev/twd-design:0.2.0`. Existing Render services built from the Blueprint move to `:0.2` on their next sync.

### Changed
- The bot only answers when mentioned, also in threads it is already in. Threads with other bots (an issue
  tracker, CI) or replies between people no longer start a turn. Existing Slack apps can drop the
  `message.channels` and `message.groups` events.
- Pull requests are opened only from the **Approve and open PR** button. Asking in words gets a reminder to
  press it, so a misread sentence can't open a PR.

### Added
- Before the first version of a thread with no repo, the bot asks which repo it is for (**Pick repo** or
  **Design without a repo**), and mentions pasting the issue link. Once per thread.
- The message that started a thread is context even when another app posted it (an issue tracker's
  summary, for example). Other apps' replies inside the thread are still left out.
- A thread about an issue of the linked repo names the PR folder and branch after it
  (`design/prototypes/71-my-karma`, `design/71-my-karma`), and the intent links the issue.

## [0.1.0] - 2026-11-23

First release. Image: `ghcr.io/brikev/twd-design:0.1.0` (linux/amd64, linux/arm64).

### Added
- Deploy to Render button: the Blueprint runs the published image, nothing to fork or build. Guides for Fly.io, Railway and Kubernetes, each importing the `.env` from `npm run setup` in one go.
- Landing page for design.twd.dev in `site/` (VitePress, prerendered): `npm run site:dev`, `npm run site:build`.
- Prototypes load twd-js 1.14.0. The headless check runs a prototype's scenarios once per viewport it declares, like twd-cli: a `{ viewport: 'mobile' }` scenario runs at a mobile width instead of being skipped at the desktop size, and a scenario tagged with an undeclared viewport is reported as failing.
- Every new version's TWD scenarios run in headless Chrome before it is posted (pace 0, about 1–3 s). Failures go back to the model to fix, up to two rounds; the version then says how many scenarios pass, or which one still fails. `SCENARIO_CHECK=off` skips it. The Docker image includes Chromium.
- The model's TWD rules now spell out what each assertion checks, and the Alpine traps behind failing scenarios (`x-show` vs `x-if`, ARIA switches, asserting right after a click).
- Slack's working indicator falls back to the older assistant status ("is working on it…") for apps not declared as agents, then to the hourglass.
- Guided Slack experience. A welcome with examples when the bot is greeted or mentioned on its own. Buttons under the latest version to approve it (opens the PR), go back to the previous version, and pick the repo from the ones the GitHub App is installed on. Slack's own working indicator with a Stop button. A Home tab, and "@bot pending", with the prototypes waiting to be built (open design PRs). Guide: `docs/guides/working-in-slack.md`.
- `npm run setup`: creates the Slack app with your name, handle and color from a one-click link, checks the tokens against Slack and writes them to `.env`. One-click default link in the docs.
- `npm run setup` creates the GitHub App from a manifest in the browser (right permissions, no webhook), saves the App ID and private key to `.env`, and checks the App reaches a repo and whether it has a `DESIGN.md`.
- `npm run setup` asks for the model and its API key, explains typos in the model name with close matches, tries the key with one tiny request, and saves both to `.env`.
- TWD Design branding: name, *Test While Designing* tagline, TWD colors and icon (`brand/`), MIT license.
- Slack bot that turns requests into single-file HTML prototypes and iterates on them in the thread.
- Stateless design: the thread is the history, the last attached `.html` is the current version.
- Design guide from the linked repo (`design/DESIGN.md`) through a GitHub App.
- Pull request with the approved prototype and an `intent.md`.
- Alpine.js + Tailwind reference template with TWD scenarios that pass in Slack's preview.
- Form shim injected automatically for Slack's sandboxed preview.
- Docker image, `docker-compose.yml`, Render blueprint.
- `/healthz`, configuration validation at startup, JSON logs, graceful shutdown on `SIGTERM`.
- Deterministic test suite (`npm test`, `node:test`, no network): business stories end to end with a fake Slack channel, a fake GitHub repo and a scripted model, plus unit tests for edits, repo links, the form shim and GitHub App auth. Runs in CI.

[Unreleased]: https://github.com/BRIKEV/twd-design/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BRIKEV/twd-design/releases/tag/v0.1.0
