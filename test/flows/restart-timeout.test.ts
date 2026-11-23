import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { drainTurns } from '../../src/slack/turn.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { scriptedModel } from '../helpers/scripted-model.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

describe('A deploy while a turn is stuck', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  githubRepo(net, 'acme/web'); // linked in the request: no question about the repo first
  scriptedModel();

  test('The restart does not wait forever: it gives up at the timeout and reports the stuck turn', async () => {
    slack.holdNextTurn(); // never released
    void slack.post('U_ANA', slack.mention('a report page for <https://github.com/acme/web>'));
    const started = Date.now();
    assert.equal(await drainTurns(300), 1);
    assert.ok(Date.now() - started < 1_000);
  });
});
