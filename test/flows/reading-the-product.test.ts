// Prototypes are about a real product: to change one section of an existing page, the bot reads that
// page's code in the linked repo first. The code is the truth; old prototypes only show what was proposed.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { DESIGN_MD, LOGIN_V1 } from './fixtures.ts';

const SETTINGS_PAGE = `export function Settings() {
  return (<>
    <h1>Settings</h1>
    <section><h2>Profile</h2><ProfileForm /></section>
    <section><h2>Notifications</h2><NotificationToggles /></section>
  </>);
}`;

describe('Changing one section of a page that already exists in the product', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  githubRepo(net, 'acme/web', {
    files: {
      'design/DESIGN.md': `${DESIGN_MD}\n\n## Where things are\n- /settings → src/pages/Settings.tsx`,
      'src/pages/Settings.tsx': SETTINGS_PAGE,
      'src/pages/Login.tsx': 'export function Login() {}',
      '.env': 'STRIPE_KEY=sk_live_123',
      'big.json': 'x'.repeat(200_000),
    },
  });
  const model = scriptedModel();

  test('The bot finds the page in the repo and starts from its real code', async () => {
    model.willDo(
      decide.list('src/pages'),
      decide.read('src/pages/Settings.tsx'),
      decide.write('settings.html', LOGIN_V1),
      decide.reply('Settings, with the notifications section reworked.'),
    );

    const chat = await slack.post('U_ANA', slack.mention('in <https://github.com/acme/web> change only the notifications section of settings'));

    const seen = model.lastSaw();
    assert.ok(seen.includes('src/pages/Settings.tsx') && seen.includes('src/pages/Login.tsx'), 'it listed the pages folder');
    assert.ok(seen.includes('<h2>Notifications</h2><NotificationToggles />'), 'it read the page as it is today');
    assert.equal(slack.versions(chat).length, 1);
  });

  test('Secrets in the repo are never read, and huge files are cut', async () => {
    model.willDo(decide.read('.env'), decide.read('big.json'), decide.read('src/nope.tsx'), decide.reply('Ok.'));

    await slack.post('U_ANA', slack.mention('look around <https://github.com/acme/web>'));

    const seen = model.lastSaw();
    assert.ok(!seen.includes('sk_live_123'), 'the .env never reached the model');
    assert.ok(seen.length < 120_000, 'the big file was cut');
    assert.match(seen, /not found/i);
  });

  test('Without a linked repo there is no code to read, and the bot is told so', async () => {
    model.willDo(decide.read('src/pages/Settings.tsx'), decide.reply('Paste the repo link and I will look.'));

    await slack.ask('U_ANA', 'change the settings page');

    assert.match(model.lastToolResult().error, /No repo linked/);
  });
});
