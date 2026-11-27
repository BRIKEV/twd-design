// The promise is "TWD scenarios that already pass". Every new version runs its scenarios in headless
// Chrome before anyone sees it; if some fail, the model gets the failures and fixes them first.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setScenarioCheck } from '../../src/agent/agent.ts';
import type { ScenarioReport } from '../../src/prototype/scenarios.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

const BROKEN = `<main id="app"><button role="switch" aria-checked="true">Email</button></main>
<script>it('email is on', async () => { twd.should(await screenDom.findByRole('switch'), 'be.checked'); });</script>`;
const FIXED_ASSERT = `'have.attr', 'aria-checked', 'true'`;

const pass = (passed: number): ScenarioReport => ({ passed, failed: [], skipped: 0, pageErrors: [], ms: 900 });
const fail = (passed: number, name: string, error: string): ScenarioReport =>
  ({ passed, failed: [{ name, error }], skipped: 0, pageErrors: [], ms: 900 });

describe('Scenarios pass before a version is posted', () => {
  const net = fakeFetch();
  after(() => { net.restore(); setScenarioCheck(null); });
  const slack = slackWorkspace(net);
  const model = scriptedModel();
  const checked: string[] = [];
  const reports: (ScenarioReport | { unavailable: string })[] = [];
  setScenarioCheck(async (html) => {
    checked.push(html);
    const next = reports.shift();
    if (!next) throw new Error('The story did not expect another scenario run');
    return next;
  });
  const comment = (root: Awaited<ReturnType<typeof slack.post>>) => slack.botReplies(root).filter((m) => m.html).at(-1)!.text!;

  test('Scenarios that pass: the version is posted, saying how many pass', async () => {
    model.willDo(decide.write('settings.html', BROKEN.replace(`'be.checked'`, FIXED_ASSERT)), decide.reply('Here is a first version.'));
    reports.push(pass(4));

    const root = await slack.ask('U_ANA', 'notification settings');

    assert.equal(checked.at(-1), slack.versions(root)[0].html, 'what was checked is what was posted');
    assert.match(comment(root), /^Here is a first version\.\n\n.*4 TWD scenarios pass/);
    assert.equal(model.calls(), 2, 'no extra model call');
  });

  test('A failing scenario is fixed before anyone sees it', async () => {
    const calls = model.calls();
    model.willDo(
      decide.write('settings.html', BROKEN), decide.reply('Here is a first version.'),
      decide.edit({ old: `'be.checked'`, new: FIXED_ASSERT }), decide.reply('Fixed the assertion.'),
    );
    reports.push(fail(3, 'Settings > email is on', 'Assertion failed: Expected element to be checked'), pass(4));

    const root = await slack.ask('U_ANA', 'notification settings');

    const fixPrompt = model.saw(calls + 2);
    assert.ok(fixPrompt.includes('Settings > email is on') && fixPrompt.includes('Expected element to be checked'), 'the model got the failure');
    assert.ok(fixPrompt.includes(`'be.checked'`), 'and the prototype as it was checked');
    const versions = slack.versions(root);
    assert.equal(versions.length, 1, 'only the fixed version is posted');
    assert.ok(versions[0].html.includes(FIXED_ASSERT));
    assert.match(comment(root), /^Here is a first version\.\n\n.*4 TWD scenarios pass/, 'the team reads about the version, not the fix');
  });

  test('Still failing after three fixes: it is posted, and the team is told which scenario fails', async () => {
    model.willDo(
      decide.write('settings.html', BROKEN), decide.reply('Here is a first version.'),
      decide.edit({ old: 'Email', new: 'Email alerts' }), decide.reply('Tried a fix.'),
      decide.edit({ old: 'Email alerts', new: 'Email' }), decide.reply('Tried another fix.'),
      decide.edit({ old: 'Email', new: 'Email alerts' }), decide.reply('One last try.'),
    );
    const failing = fail(3, 'Settings > email is on', 'Assertion failed: Expected element to be checked');
    reports.push(failing, failing, failing, failing);

    const root = await slack.ask('U_ANA', 'notification settings');

    assert.equal(slack.versions(root).length, 1);
    assert.match(comment(root), /1 of 4 TWD scenarios fails: "Settings > email is on"/);
    assert.equal(model.pending(), 0);
  });

  test('Without a headless browser, versions are posted as before', async () => {
    model.willDo(decide.write('settings.html', BROKEN), decide.reply('Here is a first version.'));
    reports.push({ unavailable: 'no headless browser' });

    const root = await slack.ask('U_ANA', 'notification settings');

    assert.equal(comment(root), 'Here is a first version.');
  });

  test('A version that is only an answer runs nothing', async () => {
    model.willDo(decide.reply('Errors show under the form.'));

    await slack.ask('U_ANA', 'where do errors show?');

    assert.equal(reports.length, 0);
  });
});
