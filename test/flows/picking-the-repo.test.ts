// A PM rarely knows the repo URL. The bot lists the repos where the GitHub App is installed, says
// which ones have a design guide, and the choice is posted in the thread (still no database).

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { DESIGN_MD, INTENT, LOGIN_V1 } from './fixtures.ts';

describe('Picking the repo from a list', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const web = githubRepo(net, 'acme/web', { files: { 'design/DESIGN.md': DESIGN_MD }, description: 'Customer web app' });
  githubRepo(net, 'acme/landing', { description: 'Marketing site' });
  githubRepo(net, 'acme/legacy', { installed: false });
  const model = scriptedModel();
  let root: Awaited<ReturnType<typeof slack.post>>;
  let next: ReturnType<typeof slack.lastReply>;

  test('Without a repo, the version offers to pick one', async () => {
    model.willDo(decide.write('orders.html', LOGIN_V1), decide.reply('Here is a first version.'));

    root = await slack.ask('U_BRUNO', 'an order history page with filters by date and status');

    next = slack.lastReply(root);
    assert.deepEqual(slack.buttons(next), ['Approve and open PR', 'Pick repo']);
    assert.match(slack.textOf(next), /No repo linked/);
  });

  test('"Pick repo" lists the repos the App is installed on, and which ones have a design guide', async () => {
    await slack.click('U_BRUNO', next!, 'Pick repo');

    assert.deepEqual(slack.options(), ['acme/web', 'acme/landing'], 'only where the App is installed');
    const modal = slack.textOf(slack.modal());
    assert.match(modal, /acme\/web\*?\n.*has a design guide.*Customer web app/);
    assert.match(modal, /acme\/landing\*?\n.*no design guide yet.*Marketing site/);
  });

  test('Bruno picks acme/web: the link goes in the thread in his name, and the next version follows its guide', async () => {
    await slack.submit('U_BRUNO', 'acme/web');

    assert.ok(slack.thread(root).some((m) => m.text?.startsWith('<@U_BRUNO>: Linked https://github.com/acme/web')));
    assert.deepEqual(slack.buttons(next), ['Approve and open PR'], 'no need to pick it again');

    model.willDo(decide.edit({ old: '>Log in<', new: '>Sign in<' }), decide.reply('v2 with your design guide.'));
    const turnStart = model.calls();
    await slack.post('U_BRUNO', slack.mention('redo it with our guide'), { thread: root });
    assert.ok(model.saw(turnStart).includes('#e4572e'), 'designed with the DESIGN.md of acme/web');
  });

  test('Approving without a repo asks where to open the PR, then opens it there', async () => {
    model.willDo(decide.write('settings.html', LOGIN_V1), decide.reply('First version.'));
    const other = await slack.ask('U_ANA', 'notification settings');

    await slack.click('U_ANA', slack.lastReply(other)!, 'Approve and open PR');
    assert.match(slack.textOf(slack.modal()), /Where should the PR go/);

    model.willDo(decide.openPr('notification-settings', 'Prototype: notification settings', INTENT), decide.reply('Done: https://github.com/acme/web/pull/1'));
    await slack.submit('U_ANA', 'acme/web');

    assert.equal(web.pulls.length, 1);
    assert.equal(web.pulls[0].head, 'design/notification-settings');
    assert.ok(slack.botReplies(other).some((m) => /Approved by <@U_ANA>/.test(slack.textOf(m))));
  });
});
