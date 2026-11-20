// Installing TWD Design: someone from infra creates the team's Slack app with the company's own
// name and color, pastes two tokens, and ends with a working .env. No manifest editing by hand.

import { describe, test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brandedManifest, setupSlack } from '../../src/setup/slack.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { scriptedTerminal } from '../helpers/terminal.ts';

const manifestIn = (output: string) => {
  const link = output.match(/https:\/\/api\.slack\.com\/apps\?new_app=1&manifest_yaml=([^\s)]+)/);
  assert.ok(link, 'a link that creates the app');
  return decodeURIComponent(link[1]);
};

describe('Setting up the Slack app', () => {
  const net = fakeFetch({
    'POST /api/auth.test': (req) => req.headers.get('authorization') === 'Bearer xoxb-good'
      ? { ok: true, user: 'acme-design', team: 'Acme Corp' }
      : { ok: false, error: 'invalid_auth' },
    'POST /api/apps.connections.open': (req) => req.headers.get('authorization') === 'Bearer xapp-good'
      ? { ok: true, url: 'wss://wss.slack.test/link' }
      : { ok: false, error: 'invalid_auth' },
  });
  after(() => net.restore());
  let envFile: string;
  beforeEach(() => { envFile = join(mkdtempSync(join(tmpdir(), 'twd-setup-')), '.env'); });

  test('Sabrina creates the app with Acme\'s name, handle and color, and gets a working .env', async () => {
    writeFileSync(envFile, 'MODEL=zai/glm-5.3-flash\nSLACK_BOT_TOKEN=xoxb-old\n');
    const term = scriptedTerminal(['Acme Design', 'acme-design', '#e4572e', 'xoxb-good', 'xapp-good']);

    await setupSlack({ ...term, envFile });

    const manifest = manifestIn(term.output());
    assert.match(manifest, /^  name: "Acme Design"$/m);
    assert.match(manifest, /^    display_name: "acme-design"$/m);
    assert.match(manifest, /^  background_color: "#e4572e"$/m);
    assert.match(manifest, /Acme Design answers with a clickable HTML prototype/);
    for (const kept of ['app_mentions:read', 'files:read', 'reactions:write', 'message.channels', 'socket_mode_enabled: true']) {
      assert.ok(manifest.includes(kept), `keeps ${kept}`);
    }
    assert.ok(!manifest.includes('# CHANGE'), 'the editing notes stay in the repo file, not in her app');

    assert.match(term.output(), /brand\/slack-icon\.png/, 'she is told where the icon goes');
    assert.match(term.output(), /connections:write/, 'and how to create the app-level token');
    assert.match(term.output(), /@acme-design in Acme Corp/, 'the tokens were checked against Slack');
    assert.equal(readFileSync(envFile, 'utf8'),
      'MODEL=zai/glm-5.3-flash\nSLACK_BOT_TOKEN=xoxb-good\nSLACK_APP_TOKEN=xapp-good\n', 'existing settings are kept');
    assert.equal(term.unanswered(), 0);
  });

  test('Pressing enter everywhere gives the TWD Design defaults', async () => {
    const term = scriptedTerminal(['', '', '', 'xoxb-good', 'xapp-good']);
    await setupSlack({ ...term, envFile });
    const manifest = manifestIn(term.output());
    assert.match(manifest, /^  name: "TWD Design"$/m);
    assert.match(manifest, /^    display_name: "twd-design"$/m);
    assert.match(manifest, /^  background_color: "#123956"$/m);
  });

  test('The handle is suggested from the name', async () => {
    const term = scriptedTerminal(['Design Bot de Pagos', '', '', 'xoxb-good', 'xapp-good']);
    await setupSlack({ ...term, envFile });
    assert.match(manifestIn(term.output()), /^    display_name: "design-bot-de-pagos"$/m);
  });

  test('Values Slack would reject are explained and asked again, before creating anything', async () => {
    const term = scriptedTerminal([
      'Acme Product Design Prototyping Assistant', 'Acme Design',
      'Acme Design', 'acme-design',
      'orange', 'e4572e',
      'xoxb-good', 'xapp-good',
    ]);
    await setupSlack({ ...term, envFile });
    const out = term.output();
    assert.match(out, /35 characters/);
    assert.match(out, /lowercase/);
    assert.match(out, /hex color/);
    assert.match(manifestIn(out), /^  background_color: "#e4572e"$/m, 'a color without # is fine');
  });

  test('A wrong token says what is wrong and asks again', async () => {
    const term = scriptedTerminal(['', '', '', 'xoxp-user-token', 'xoxb-revoked', 'xoxb-good', 'xapp-revoked', 'xapp-good']);
    await setupSlack({ ...term, envFile });
    const out = term.output();
    assert.match(out, /Bot User OAuth Token/, 'a user token is told apart from the bot token');
    assert.match(out, /Slack rejected .*invalid_auth/);
    assert.match(readFileSync(envFile, 'utf8'), /SLACK_BOT_TOKEN=xoxb-good\nSLACK_APP_TOKEN=xapp-good/);
  });

  test('The one-click link in the docs creates the same app as the manifest', () => {
    const docs = readFileSync(new URL('../../docs/setup/slack-app.md', import.meta.url), 'utf8');
    const defaults = brandedManifest({ name: 'TWD Design', handle: 'twd-design', color: '#123956' });
    assert.equal(manifestIn(docs), defaults, 'regenerate the link in docs/setup/slack-app.md after changing slack-manifest.yaml');
  });
});
