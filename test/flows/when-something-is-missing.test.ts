// Things go wrong in real teams: no repo, no guide, the App not installed, a slow or failing model.
// Each time, the thread itself tells people what is happening and what to do.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch, json } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { INTENT, LOGIN_V1 } from './fixtures.ts';

describe('When something is missing or fails, the thread says what to do', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const model = scriptedModel();
  githubRepo(net, 'acme/no-guide');
  githubRepo(net, 'acme/private', { installed: false });
  githubRepo(net, 'acme/locked', { files: { 'design/DESIGN.md': '# Design' } });
  net.routes['POST /repos/acme/locked/pulls'] = () => json({ message: 'Resource not accessible by integration' }, 403);

  test('Without a linked repo, it designs with neutral defaults', async () => {
    model.willDo(decide.write('signup.html', LOGIN_V1), decide.reply('Here is a signup with neutral styles.'));
    await slack.ask('U_ANA', 'a signup page');
    assert.ok(!model.lastSaw().includes('Design guide for this product'));
  });

  test('A repo without DESIGN.md: the bot is told so, to design neutral and say it', async () => {
    model.willDo(decide.reply('acme/no-guide has no design guide yet, so I used neutral styles.'));
    await slack.post('U_ANA', slack.mention('a dashboard for <https://github.com/acme/no-guide>'));
    assert.match(model.lastSaw(), /no design\/DESIGN\.md/);
  });

  test('The GitHub App is not installed on the repo: a link to install it, and no wasted model call', async () => {
    const calls = model.calls();
    const chat = await slack.post('U_ANA', slack.mention('a dashboard for <https://github.com/acme/private>'));

    assert.equal(model.calls(), calls);
    assert.equal(slack.lastReply(chat)!.text,
      "I can't read *acme/private*: the GitHub App isn't installed there. <https://github.com/apps/twd-design/installations/new|Install it on that repo> and ask again.");
  });

  test('GitHub refuses the PR: the bot gets the reason and can explain it', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1), decide.reply('First version.'));
    const chat = await slack.post('U_ANA', slack.mention('a login for <https://github.com/acme/locked>'));
    model.willDo(
      decide.openPr('login', 'Prototype: login', INTENT),
      decide.reply('GitHub refused the PR: the App lacks write access to acme/locked.'),
    );
    await slack.click('U_ANA', slack.controls(chat)!, 'Approve and open PR');
    assert.match(model.lastToolResult().error, /403 .*Resource not accessible/);
  });

  test('The model provider fails: the error is posted, and the thread keeps working afterwards', async () => {
    model.willDo(decide.reply('What should it show?'));
    const chat = await slack.ask('U_ANA', 'a billing page');

    model.willFail('Rate limit exceeded');
    await slack.post('U_ANA', slack.mention('monthly invoices, with download'), { thread: chat });
    assert.match(slack.lastReply(chat)!.text!, /^Something failed: .*Rate limit exceeded/);
    assert.equal(slack.statuses.at(-1), 'active', 'the working indicator never stays on');

    model.willDo(decide.reply('Here it is.'));
    await slack.post('U_ANA', slack.mention('try again'), { thread: chat });
    assert.equal(slack.lastReply(chat)!.text, 'Here it is.');
  });

  test('A message while the bot is still working gets a "one moment", not a second run', async () => {
    model.willDo(decide.reply('Working on it.'));
    const chat = await slack.ask('U_ANA', 'a team page');

    const release = slack.holdNextTurn();
    model.willDo(decide.reply('Added avatars.'));
    const slowTurn = slack.post('U_ANA', slack.mention('add avatars'), { thread: chat });
    await slack.post('U_BRUNO', slack.mention('and roles too'), { thread: chat });
    release();
    await slowTurn;

    const replies = slack.botReplies(chat).map((m) => m.text);
    assert.ok(replies.includes('Still working on the previous version, give me a moment.'));
    assert.equal(replies.at(-1), 'Added avatars.');
  });

  test('A thread that reaches the turn limit asks to start a new one', async () => {
    model.willDo(decide.reply('ok'));
    const chat = await slack.ask('U_ANA', 'a never-ending settings page');
    for (let i = 1; i < 15; i++) {
      model.willDo(decide.reply('ok'));
      await slack.post('U_ANA', slack.mention(`change ${i}`), { thread: chat });
    }
    const calls = model.calls();

    await slack.post('U_ANA', slack.mention('one more change'), { thread: chat });

    assert.equal(model.calls(), calls);
    assert.equal(slack.lastReply(chat)!.text, 'This thread hit the 15-turn limit. Start a new thread to keep going.');
  });

  test('Slack fails while reading the thread: the error is posted in the thread', async () => {
    model.willDo(decide.reply('Sure.'));
    const chat = await slack.ask('U_ANA', 'a profile page');
    slack.failNextRead('ratelimited');
    await slack.post('U_ANA', slack.mention('with a photo'), { thread: chat });
    assert.equal(slack.lastReply(chat)!.text, 'Something failed: ratelimited');
  });
});
