// Deploys happen during the day. A restart must not lose the turn someone is waiting for.
// Own file: shutting down is one-way for the process (node --test runs each file in its own process).

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { drainTurns, isAccepting } from '../../src/slack/turn.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

describe('A deploy while someone is waiting for the bot', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  githubRepo(net, 'acme/web'); // linked in the request: no question about the repo first
  const model = scriptedModel();

  test('The running turn finishes and is posted; new requests are asked to wait a minute', async () => {
    const release = slack.holdNextTurn();
    model.willDo(decide.reply('Here is your checkout page.'));
    const waiting = slack.post('U_ANA', slack.mention('a checkout page for <https://github.com/acme/web>'));

    const drained = drainTurns(5_000); // SIGTERM
    assert.equal(isAccepting(), false, '/healthz now answers 503');
    const late = await slack.post('U_BRUNO', slack.mention('a cart page for <https://github.com/acme/web>'));
    setTimeout(release, 50);

    assert.equal(await drained, 0, 'nothing was cut off');
    const chat = await waiting;
    assert.equal(slack.lastReply(chat)!.text, 'Here is your checkout page.');
    assert.equal(slack.lastReply(late)!.text, 'Restarting right now, ask again in a minute.');
  });
});
