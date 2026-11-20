// The bot lives in busy channels: it must answer when it's asked, once, and stay out of everything else.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

describe('When the bot answers, and when it stays quiet', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const model = scriptedModel();

  test('A conversation the bot was never part of is left alone', async () => {
    const chat = await slack.post('U_ANA', 'should we redo the login?');
    await slack.post('U_BRUNO', 'yes, the copy is confusing', { thread: chat });

    assert.equal(model.calls(), 0);
    assert.equal(slack.botReplies(chat).length, 0);
  });

  test('Mentioned in an existing conversation, it joins and answers once', async () => {
    const chat = await slack.post('U_ANA', 'the settings page is a mess');
    model.willDo(decide.reply('Tell me what has to fit in it.'));

    await slack.post('U_BRUNO', slack.mention('can you help us here?'), { thread: chat });

    assert.equal(model.calls(), 1, 'one answer, although Slack delivers the mention twice (mention + message)');
    assert.equal(slack.botReplies(chat).length, 1);
  });

  test('Once in a thread, it follows the conversation without being mentioned again', async () => {
    model.willDo(decide.reply('What should the empty state say?'));
    const chat = await slack.post('U_ANA', slack.mention('an empty state for projects'));
    model.willDo(decide.reply('Got it.'));

    await slack.post('U_ANA', 'something friendly, with a button to create one', { thread: chat });

    assert.equal(slack.botReplies(chat).length, 2);
  });

  test('Edited messages, other bots and Slack retries never start a turn', async () => {
    model.willDo(decide.reply('Sure.'));
    const chat = await slack.post('U_ANA', slack.mention('a pricing page'));
    const before = model.calls();

    await slack.post('U_ANA', 'a pricing page with three plans', { thread: chat, subtype: 'message_changed' });
    await slack.post('U_GITHUB', 'New commit on main', { thread: chat, botId: 'B_GITHUB' });
    await slack.post('U_ANA', slack.mention('a pricing page'), { retry: 1 });

    assert.equal(model.calls(), before);
    assert.equal(slack.botReplies(chat).length, 1);
  });

  test('Notifications from other bots in the thread are not taken as requests', async () => {
    model.willDo(decide.reply('Sure.'));
    const chat = await slack.post('U_ANA', slack.mention('an onboarding checklist'));
    await slack.post('U_GITHUB', 'Deploy failed on staging', { thread: chat, botId: 'B_GITHUB' });
    model.willDo(decide.reply('Three steps then.'));

    await slack.post('U_ANA', 'three steps max', { thread: chat });

    assert.ok(model.lastSaw().includes('three steps max'));
    assert.ok(!model.lastSaw().includes('Deploy failed'), 'the GitHub notification never reached the model');
  });
});
