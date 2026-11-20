# Changelog

All notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- `npm run setup`: creates the Slack app with your name, handle and color from a one-click link, checks the tokens against Slack and writes them to `.env`. One-click default link in the docs.
- `npm run setup` creates the GitHub App from a manifest in the browser (right permissions, no webhook), saves the App ID and private key to `.env`, and checks the App reaches a repo and whether it has a `DESIGN.md`.
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
