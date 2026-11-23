// Nobody reads docs before trying a bot. Mentioning it is enough to learn what it does, and an
// example is one click away.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { LOGIN_V1 } from './fixtures.ts';

describe('Meeting the bot: anyone can tell what it does and try it', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const model = scriptedModel();
  let root: Awaited<ReturnType<typeof slack.post>>;

  test('Ana says hi and learns what the bot does, how to work with it, and what to try', async () => {
    root = await slack.post('U_ANA', slack.mention('hi!'));

    const welcome = slack.textOf(slack.lastReply(root));
    assert.match(welcome, /clickable HTML prototype/);
    assert.match(welcome, /Ask for a screen/);
    assert.match(welcome, /mention me in the thread/i);
    assert.match(welcome, /Approve/);
    assert.deepEqual(slack.buttons(slack.lastReply(root)), ['A login screen', 'A list with filters', 'A 3-step sign-up', 'Notification settings']);
    assert.equal(model.calls(), 0, 'a fixed answer: no model call, no cost');
  });

  test('A bare mention, or "help" in a thread, gets the same answer', async () => {
    const bare = await slack.post('U_BRUNO', slack.mention(''));
    assert.match(slack.textOf(slack.lastReply(bare)), /Ask for a screen/);

    await slack.post('U_BRUNO', slack.mention('help'), { thread: bare });
    assert.equal(slack.botReplies(bare).length, 2);
    assert.match(slack.textOf(slack.lastReply(bare)), /Ask for a screen/);
    assert.equal(model.calls(), 0);
  });

  test('Ana picks an example: it is posted as her request, and the bot designs it', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1), decide.reply('Here is a first version of the login.'));

    await slack.click('U_ANA', slack.botReplies(root)[0], 'A login screen');

    assert.ok(slack.thread(root).some((m) => m.text?.startsWith('<@U_ANA>: A login screen with email and password')), 'the team sees who asked for what');
    assert.ok(model.lastSaw().includes('A login screen with email and password'), 'the model got it as her request');
    assert.equal(slack.versions(root).length, 1);
  });

  test('Then she keeps going in the thread, mentioning the bot', async () => {
    model.willDo(decide.edit({ old: '>Log in<', new: '>Sign in<' }), decide.reply('The button now says Sign in.'));

    await slack.post('U_ANA', slack.mention('the button should say Sign in'), { thread: root });

    assert.equal(slack.versions(root).length, 2);
  });

  test('Mentioned in a thread where the team already discussed a feature, it designs it: no welcome', async () => {
    const discussion = await slack.post('U_BRUNO', 'we need a page to export invoices as CSV, with a date range');
    model.willDo(decide.write('export.html', LOGIN_V1), decide.reply('First version of the export page.'));

    await slack.post('U_ANA', slack.mention(''), { thread: discussion });

    assert.ok(model.lastSaw().includes('export invoices as CSV'));
    assert.equal(slack.versions(discussion).length, 1);
  });
});
