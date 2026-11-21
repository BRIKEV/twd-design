# Changelog

All notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

### Changed
- Existing Slack apps need the new manifest (interactivity, Home tab, `app_home_opened` and `agent_session_stopped` events). See "Updating an app you created before" in `docs/setup/slack-app.md`.

### Added
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
