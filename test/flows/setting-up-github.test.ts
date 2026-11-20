// Installing TWD Design, step 2: the team's GitHub App, created from a manifest in the browser.
// Nobody copies an App ID or a private key: GitHub hands them back to the setup, which saves them.

import { describe, test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createSign } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { setupGithub } from '../../src/setup/github.ts';
import { fakeFetch, json } from '../helpers/fake-fetch.ts';
import { scriptedTerminal } from '../helpers/terminal.ts';

const NEW_APP_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

/** Plays the person's browser: opens the setup page, reads the form GitHub would receive, clicks Create. */
async function createAppInBrowser(term: ReturnType<typeof scriptedTerminal>, { state }: { state?: string } = {}) {
  const [local] = await term.waitFor(/http:\/\/127\.0\.0\.1:\d+\/?/);
  const page = await (await fetch(local)).text();
  const action = page.match(/<form[^>]+action="([^"]+)"/)![1].replace(/&amp;/g, '&');
  const manifest = JSON.parse(page.match(/name="manifest" value="([^"]+)"/)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  const sentState = state ?? new URL(action).searchParams.get('state');
  // GitHub creates the App and sends the browser back with a one-time code.
  const back = await fetch(`${manifest.redirect_url}?code=one-time-code&state=${sentState}`);
  return { action, manifest, back: { status: back.status, text: await back.text() } };
}

describe('Setting up the GitHub App', () => {
  let installed = new Set<string>();
  let lookups = 0;
  const net = fakeFetch({
    'POST /app-manifests/one-time-code/conversions': () => ({ id: 424242, slug: 'acme-design', pem: NEW_APP_KEY, html_url: 'https://github.com/apps/acme-design' }),
    'POST /app/installations/9/access_tokens': () => ({ token: 'ghs_new', expires_at: new Date(Date.now() + 3600_000).toISOString() }),
    'GET /repos/acme/web/contents/design/DESIGN.md': () => new Response('# Design'),
    'GET /repos/acme/api/contents/design/DESIGN.md': () => json({ message: 'Not Found' }, 404),
  });
  net.fallbacks.push((req) => {
    const m = req.path.match(/^\/repos\/([^/]+\/[^/]+)\/installation$/);
    if (!m) return undefined;
    lookups++;
    return installed.has(m[1]) ? json({ id: 9 }) : json({ message: 'Not Found' }, 404);
  });
  after(() => net.restore());
  let envFile: string;
  beforeEach(() => {
    envFile = join(mkdtempSync(join(tmpdir(), 'twd-setup-')), '.env');
    installed = new Set(['acme/web', 'acme/api']);
    lookups = 0;
  });

  test('Sabrina creates Acme\'s App in the acme org, checks it reaches acme/web, and never copies a key', async () => {
    writeFileSync(envFile, 'SLACK_BOT_TOKEN=xoxb-good\n');
    const term = scriptedTerminal(['acme', '', 'https://github.com/acme/web']);
    const setup = setupGithub({ ...term, envFile, defaultName: 'Acme Design' });

    const { action, manifest, back } = await createAppInBrowser(term);
    await setup;

    assert.match(action, /^https:\/\/github\.com\/organizations\/acme\/settings\/apps\/new\?state=/, 'created where the repos live');
    assert.equal(manifest.name, 'Acme Design');
    assert.deepEqual(manifest.default_permissions, { contents: 'write', pull_requests: 'write', metadata: 'read' }, 'only what the bot needs');
    assert.equal(manifest.hook_attributes.active, false, 'no webhooks: the bot never receives GitHub events');
    assert.equal(manifest.public, false);
    assert.match(back.text, /back to the terminal/i);

    const env = readFileSync(envFile, 'utf8');
    assert.match(env, /^SLACK_BOT_TOKEN=xoxb-good$/m, 'existing settings are kept');
    assert.match(env, /^GITHUB_APP_ID=424242$/m);
    const key = env.match(/^GITHUB_PRIVATE_KEY=(.+)$/m)![1];
    assert.ok(!key.includes('"'), 'one unquoted line, safe for docker --env-file and compose');
    const pem = key.replace(/\\n/g, '\n');
    assert.ok(createSign('RSA-SHA256').update('x').sign(pem), 'the saved key is the App key, usable as is');

    const out = term.output();
    assert.match(out, /https:\/\/github\.com\/apps\/acme-design\/installations\/new/, 'she is told where to install it');
    assert.match(out, /acme\/web: the App can read it, and it has a design\/DESIGN\.md/);
  });

  test('In a personal account, the App is created there', async () => {
    const term = scriptedTerminal(['', 'My Design Bot', '']);
    const setup = setupGithub({ ...term, envFile, defaultName: 'TWD Design' });
    const { action, manifest } = await createAppInBrowser(term);
    await setup;
    assert.match(action, /^https:\/\/github\.com\/settings\/apps\/new\?state=/);
    assert.equal(manifest.name, 'My Design Bot');
    assert.equal(lookups, 0, 'no repo to check was given');
  });

  test('Not installed on the repo yet: she is told how, and it checks again when she is done', async () => {
    installed = new Set();
    const installsThenPressesEnter = () => { installed.add('acme/api'); return ''; };
    const term = scriptedTerminal(['acme', '', 'acme/api', installsThenPressesEnter]);
    const setup = setupGithub({ ...term, envFile, defaultName: 'Acme Design' });
    await createAppInBrowser(term);
    await setup;

    const out = term.output();
    assert.match(out, /not installed on acme\/api yet\. Install it there: https:\/\/github\.com\/apps\/acme-design\/installations\/new/);
    assert.match(out, /acme\/api: the App can read it, but there is no design\/DESIGN\.md yet/);
    assert.match(out, /docs\/guides\/design-md\.md/, 'and where to learn to write one');
    assert.equal(lookups, 2);
  });

  test('A redirect that did not come from this setup is refused', async () => {
    const term = scriptedTerminal(['acme', '', '']);
    const setup = setupGithub({ ...term, envFile, defaultName: 'Acme Design' });
    const forged = await createAppInBrowser(term, { state: 'forged' });
    assert.equal(forged.back.status, 400);
    const real = await createAppInBrowser(term);
    await setup;
    assert.equal(real.back.status, 200);
    assert.match(readFileSync(envFile, 'utf8'), /GITHUB_APP_ID=424242/);
  });
});
