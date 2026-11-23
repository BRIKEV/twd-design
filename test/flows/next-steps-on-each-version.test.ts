// Every version says what can happen next, so a PM never wonders how to approve or undo. Only the
// latest version has buttons: an old one can't be approved by mistake.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { DESIGN_MD, INTENT, LOGIN_V1 } from './fixtures.ts';

describe('Each version comes with what you can do next', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const repo = githubRepo(net, 'acme/web', { files: { 'design/DESIGN.md': DESIGN_MD } });
  const model = scriptedModel();
  let root: Awaited<ReturnType<typeof slack.post>>;

  test('v1 arrives with Approve, and how to ask for changes', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1), decide.reply('Here is a first version of the login.'));

    root = await slack.post('U_ANA', slack.mention('a login screen for <https://github.com/acme/web>'));

    const next = slack.lastReply(root);
    assert.deepEqual(slack.buttons(next), ['Approve and open PR']);
    assert.match(slack.textOf(next), /v1/);
    assert.match(slack.textOf(next), /mention me in the thread/i);
    assert.match(slack.textOf(next), /turn 1 of 15/);
  });

  let v1AsBrunoSawIt: NonNullable<ReturnType<typeof slack.lastReply>>;

  test('v2 replaces v1: the old buttons go away and "Back to v1" appears', async () => {
    model.willDo(decide.edit({ old: '>Log in<', new: '>Sign in<' }), decide.reply('The button now says Sign in.'));
    const v1Next = slack.lastReply(root)!;
    v1AsBrunoSawIt = structuredClone(v1Next);

    await slack.post('U_BRUNO', slack.mention('the button should say Sign in'), { thread: root });

    assert.deepEqual(slack.buttons(v1Next), []);
    assert.match(slack.textOf(v1Next), /Replaced by v2/);
    const v2Next = slack.lastReply(root);
    assert.deepEqual(slack.buttons(v2Next), ['Approve and open PR', 'Back to v1']);
    assert.match(slack.textOf(v2Next), /turn 2 of 15/, 'the buttons are not counted as turns');
  });

  test('Bruno clicks Approve on v1 from a screen that has not refreshed: he is told v2 is the latest, nothing is opened', async () => {
    const calls = model.calls();

    await slack.click('U_BRUNO', v1AsBrunoSawIt, 'Approve and open PR', { asSeen: true });

    assert.deepEqual(slack.ephemerals.at(-1), { user: 'U_BRUNO', text: 'v1 is not the latest version (v2). Approve the latest one, or go back to v1 first.' });
    assert.equal(model.calls(), calls);
    assert.equal(repo.pulls.length, 0);
  });

  test('"Back to v1" posts v1 again as v3, without asking the model', async () => {
    const calls = model.calls();

    await slack.click('U_ANA', slack.lastReply(root)!, 'Back to v1');

    const versions = slack.versions(root);
    assert.equal(versions.length, 3);
    assert.equal(versions[2].html, versions[0].html);
    assert.equal(model.calls(), calls, 'no model call, no cost');
    assert.match(slack.textOf(slack.botReplies(root).at(-2)), /Back to v1/);
    assert.deepEqual(slack.buttons(slack.lastReply(root)), ['Approve and open PR', 'Back to v2']);
  });

  test('Ana approves: the PR has the version she approved, and the buttons show who approved it', async () => {
    model.willDo(decide.openPr('login', 'Prototype: login', INTENT), decide.reply('Done: https://github.com/acme/web/pull/1'));
    const v3Next = slack.lastReply(root)!;
    const turnStart = model.calls();

    await slack.click('U_ANA', v3Next, 'Approve and open PR');

    assert.ok(slack.thread(root).some((m) => m.text?.startsWith('<@U_ANA>: Approved v3. Open the pull request.')));
    assert.ok(model.saw(turnStart).includes('Approved v3. Open the pull request.'), 'the model got an explicit approval');
    assert.equal(repo.pulls[0].files['design/prototypes/login/index.html'], slack.versions(root)[2].html);
    assert.deepEqual(slack.buttons(v3Next), []);
    assert.match(slack.textOf(v3Next), /Approved by <@U_ANA>/);
    assert.equal(slack.lastReply(root)!.text, 'Done: https://github.com/acme/web/pull/1');
  });
});
