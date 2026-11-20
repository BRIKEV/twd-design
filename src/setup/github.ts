import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { appJwt, gh, installationToken } from '../github/client.ts';
import { findRepo } from '../github/files.ts';
import { updateEnvFile } from './env-file.ts';
import type { Terminal } from './slack.ts';

// Setup step 2: the team's GitHub App, through GitHub's manifest flow. A local page posts the
// manifest to GitHub; after "Create GitHub App", GitHub redirects back here with a one-time code
// that we exchange for the App ID and private key. Nothing to copy, nothing leaves this machine.

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

type CreatedApp = { id: number; slug: string; pem: string; html_url: string };

/** Serves the page that sends the manifest to GitHub, and waits for GitHub to come back. */
async function createAppInBrowser(t: Terminal, owner: string, name: string): Promise<CreatedApp> {
  const state = randomBytes(16).toString('hex');
  let done!: (app: CreatedApp) => void;
  let fail!: (err: Error) => void;
  const created = new Promise<CreatedApp>((resolve, reject) => { done = resolve; fail = reject; });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const page = (status: number, body: string) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:2rem">${body}</body>`);
    };
    if (url.pathname === '/') {
      const manifest = {
        name,
        description: 'Turns requests in Slack into clickable prototypes with acceptance tests, and opens them as pull requests.',
        url: 'https://twd.dev',
        hook_attributes: { url: 'https://twd.dev', active: false },
        redirect_url: `http://${req.headers.host}/callback`,
        public: false,
        default_permissions: { contents: 'write', pull_requests: 'write', metadata: 'read' },
        default_events: [],
      };
      const target = owner ? `https://github.com/organizations/${owner}/settings/apps/new` : 'https://github.com/settings/apps/new';
      return page(200, `<p>Sending you to GitHub to create <b>${escapeAttr(name)}</b>…</p>
<form id="f" method="post" action="${target}?state=${state}">
  <input type="hidden" name="manifest" value="${escapeAttr(JSON.stringify(manifest))}">
  <button>Continue to GitHub</button>
</form><script>document.getElementById('f').submit()</script>`);
    }
    if (url.pathname === '/callback') {
      if (url.searchParams.get('state') !== state) return page(400, 'This link did not come from this setup. Start again from the terminal.');
      try {
        const res = await fetch(`https://api.github.com/app-manifests/${url.searchParams.get('code')}/conversions`, {
          method: 'POST',
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub did not return the App: ${res.status} ${await res.text()}`);
        const app = (await res.json()) as CreatedApp;
        page(200, `<p>✔ <b>${escapeAttr(name)}</b> is created. You can close this tab and go back to the terminal.</p>`);
        done(app);
      } catch (err) {
        page(500, escapeAttr((err as Error).message));
        fail(err as Error);
      }
      return;
    }
    page(404, 'Not found');
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  t.say(`
1. Open http://127.0.0.1:${port} in your browser. It takes you to GitHub with everything filled in.
2. Click Create GitHub App (change the name there if GitHub says it is taken).
`);
  try {
    return await created;
  } finally {
    server.close();
  }
}

/** Confirms the App can reach the repo, and whether the repo has a design guide. */
async function checkRepo(t: Terminal, app: CreatedApp, repo: string) {
  const jwt = appJwt(String(app.id), app.pem);
  let access = await installationToken(repo, jwt);
  while (!access) {
    t.say(`  ✖ The App is not installed on ${repo} yet. Install it there: ${app.html_url}/installations/new`);
    await t.ask('Press Enter when it is installed');
    access = await installationToken(repo, jwt);
  }
  const guide = await gh(`/repos/${repo}/contents/design/DESIGN.md`, access.token);
  t.say(guide.ok
    ? `✔ ${repo}: the App can read it, and it has a design/DESIGN.md. Prototypes will follow it.`
    : `✔ ${repo}: the App can read it, but there is no design/DESIGN.md yet. Prototypes will use a neutral look.\n` +
      '  How to write one: https://github.com/BRIKEV/twd-design/blob/main/docs/guides/design-md.md');
}

export async function setupGithub({ ask, say, envFile, defaultName }: Terminal & { envFile: string; defaultName: string }) {
  const t = { ask, say };
  say('\nGitHub App (reads your design guide and opens pull requests)\n');

  const owner = (await ask('GitHub organization that owns your repos (empty for your personal account)')).trim();
  const name = (await ask('App name, unique on GitHub', defaultName)).trim() || defaultName;

  const app = await createAppInBrowser(t, owner, name);
  // One line with literal \n: safe in .env, docker --env-file and compose. The bot restores the breaks.
  updateEnvFile(envFile, { GITHUB_APP_ID: String(app.id), GITHUB_PRIVATE_KEY: app.pem.trim().replace(/\n/g, '\\n') });
  say(`✔ Created ${app.html_url}. Saved GITHUB_APP_ID and GITHUB_PRIVATE_KEY to ${envFile}.`);
  say(`\n3. Install it on the repos the bot may read and open pull requests in:\n   ${app.html_url}/installations/new\n`);

  const answer = (await ask('A repo to check, e.g. https://github.com/acme/web (empty to skip)')).trim();
  const repo = findRepo([answer]) ?? (/^[\w.-]+\/[\w.-]+$/.test(answer) ? answer : null);
  if (repo) await checkRepo(t, app, repo);
}
