// An approved prototype is an open PR until developers build it. The open design PRs are the list
// of what is waiting to be built: read from GitHub when asked, nothing stored.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

const thread = 'https://acme.slack.com/archives/C_DESIGN/p1700000000000100';

describe('What is waiting to be built', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  githubRepo(net, 'acme/web', {
    openPulls: [
      { title: 'Prototype: one-step checkout', head: 'design/one-step-checkout', daysAgo: 2 },
      { title: 'Fix typo in footer', head: 'fix/footer-typo', daysAgo: 1 },
      { title: 'Prototype: magic link login', head: 'design/magic-link-login', daysAgo: 9, body: `Intent\n\nDiscussion: [Slack thread](${thread})` },
    ],
  });
  githubRepo(net, 'acme/backoffice', { openPulls: [{ title: 'Prototype: order history', head: 'design/order-history', daysAgo: 0 }] });
  githubRepo(net, 'acme/landing');
  const model = scriptedModel();

  test('Ana opens the app: the approved prototypes not built yet, by repo, the oldest first', async () => {
    await slack.openHome('U_ANA');

    const home = slack.textOf(slack.home('U_ANA'));
    assert.match(home, /Waiting to be built/);
    assert.match(home, /acme\/web[\s\S]*magic link login[\s\S]*9 days[\s\S]*one-step checkout[\s\S]*2 days[\s\S]*acme\/backoffice[\s\S]*order history[\s\S]*today/);
    assert.doesNotMatch(home, /Fix typo/, 'only prototypes');
    assert.doesNotMatch(home, /acme\/landing/, 'repos with nothing pending are left out');
  });

  test('Each one links to its PR and to the thread where it was agreed', async () => {
    const home = slack.home('U_ANA');
    assert.equal(slack.linkOf(home, 'Open thread'), thread);
    assert.equal(slack.linkOf(home, 'View PR'), 'https://github.com/acme/web/pull/102');
  });

  test('The Home also says how to use the bot', async () => {
    assert.match(slack.textOf(slack.home('U_ANA')), /Ask for a screen/);
  });

  test('"@bot pending" in a channel answers with the same list', async () => {
    const root = await slack.ask('U_BRUNO', 'pending');

    assert.match(slack.textOf(slack.lastReply(root)), /magic link login[\s\S]*order history/);
    assert.equal(model.calls(), 0);
  });
});
