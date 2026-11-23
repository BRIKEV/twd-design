// A prototype is only as good as what the bot knows. Before the first version of a thread, if no repo
// is linked, it asks which one it is for (its design guide and, later, the PR) instead of guessing.
// One question, once per thread: whoever doesn't know can go ahead without a repo.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { DESIGN_MD, LOGIN_V1 } from './fixtures.ts';

describe('Asking where the prototype goes before designing it', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  githubRepo(net, 'acme/web', { files: { 'design/DESIGN.md': DESIGN_MD } });
  const model = scriptedModel();

  test('The first request without a repo asks which repo it is for, and mentions the issue, before any model call', async () => {
    const calls = model.calls();

    const root = await slack.post('U_KEVIN', slack.mention('a My karma page with my total and who gave me points'));

    assert.equal(model.calls(), calls, 'nothing designed yet');
    const ask = slack.lastReply(root)!;
    assert.match(slack.textOf(ask), /Which repo is this for\?/);
    assert.match(slack.textOf(ask), /issue/i);
    assert.deepEqual(slack.buttons(ask), ['Pick repo', 'Design without a repo']);
  });

  test('Picking the repo designs straight away, with its design guide', async () => {
    const root = await slack.post('U_KEVIN', slack.mention('a My karma page'));
    model.willDo(decide.write('karma.html', LOGIN_V1), decide.reply('First version, with your guide.'));

    await slack.click('U_KEVIN', slack.lastReply(root)!, 'Pick repo');
    await slack.submit('U_KEVIN', 'acme/web');

    assert.ok(model.lastSaw().includes('#e4572e'), 'designed with the DESIGN.md of acme/web');
    assert.equal(slack.versions(root).length, 1);
    assert.ok(slack.thread(root).some((m) => m.text?.startsWith('<@U_KEVIN>: Linked https://github.com/acme/web')));
    assert.equal(slack.buttons(slack.thread(root).find((m) => /Which repo/.test(slack.textOf(m)))).length, 0, 'the question is answered');
  });

  test('"Design without a repo" goes ahead with a neutral look, and the thread is not asked again', async () => {
    const root = await slack.post('U_ANA', slack.mention('a pricing page'));
    model.willDo(decide.write('pricing.html', LOGIN_V1), decide.reply('Neutral first version.'));

    await slack.click('U_ANA', slack.lastReply(root)!, 'Design without a repo');

    assert.equal(slack.versions(root).length, 1);
    assert.ok(!model.lastSaw().includes('Design guide for this product'));
    assert.match(slack.textOf(slack.thread(root).find((m) => /Which repo/.test(slack.textOf(m)))), /without a repo.*<@U_ANA>/i);
  });

  test('Answering in words instead of with the buttons also works: a repo link designs with it', async () => {
    const root = await slack.post('U_ANA', slack.mention('an invoices list'));
    model.willDo(decide.write('invoices.html', LOGIN_V1), decide.reply('First version.'));

    await slack.post('U_ANA', slack.mention('it is <https://github.com/acme/web>'), { thread: root });

    assert.ok(model.lastSaw().includes('#e4572e'));
    assert.equal(slack.versions(root).length, 1);
  });

  test('A request that already names the repo goes straight to designing', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1), decide.reply('First version.'));

    const root = await slack.post('U_ANA', slack.mention('a login for <https://github.com/acme/web>'));

    assert.equal(slack.versions(root).length, 1);
    assert.ok(!slack.thread(root).some((m) => /Which repo/.test(slack.textOf(m))));
  });
});
