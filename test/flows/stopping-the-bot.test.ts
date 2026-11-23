// While the bot works, Slack shows its own indicator with a Stop button. Stopping throws away the
// version in progress: the last posted one is still the current one.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { LOGIN_V1 } from './fixtures.ts';

describe('Stopping the bot', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const model = scriptedModel();
  let root: Awaited<ReturnType<typeof slack.post>>;

  test('Slack shows that the bot is working, with its Stop button, until the version is posted', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1), decide.reply('Here is a first version.'));

    root = await slack.post('U_ANA', slack.mention('a login screen'));

    assert.deepEqual(slack.statuses, ['processing', 'active']);
    assert.deepEqual(slack.reactions, [], 'no hourglass: Slack has its own indicator');
  });

  test('Bruno stops a change he regrets: nothing is posted, and v1 is still the current version', async () => {
    model.willHang();
    const calls = model.calls();

    const turn = slack.post('U_BRUNO', slack.mention('make everything purple'), { thread: root });
    await model.waitForCalls(calls + 1);
    await slack.stop('U_BRUNO', root);
    await turn;

    assert.equal(slack.versions(root).length, 1);
    assert.equal(slack.lastReply(root)!.text, 'Stopped by <@U_BRUNO>. v1 is still the current version.');
    assert.equal(slack.statuses.at(-1), 'active');
  });

  test('The thread is free right away: the next request works', async () => {
    model.willDo(decide.edit({ old: '>Log in<', new: '>Sign in<' }), decide.reply('The button now says Sign in.'));

    await slack.post('U_BRUNO', slack.mention('just change the button to Sign in'), { thread: root });

    assert.equal(slack.versions(root).length, 2);
  });

  test('For an app not declared as an agent, Slack shows the older "is working…" status instead', async () => {
    slack.withoutAgentSessions();
    model.willDo(decide.reply('Errors show under the form.'));
    const before = slack.statuses.length;

    await slack.post('U_ANA', slack.mention('where do errors show?'), { thread: root });

    assert.deepEqual(slack.statuses.slice(before), ['working…', 'cleared']);
    assert.deepEqual(slack.reactions, []);
  });

  test('Where Slack offers neither, an hourglass on the message shows the bot is working', async () => {
    slack.withoutAnyStatus();
    model.willDo(decide.reply('Errors show under the form.'));

    await slack.post('U_ANA', slack.mention('and the success message?'), { thread: root });

    assert.deepEqual(slack.reactions, ['+hourglass_flowing_sand', '-hourglass_flowing_sand']);
  });
});
