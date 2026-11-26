// The core story: a request in Slack becomes a clickable prototype, the team iterates on it in the
// thread, and the approved version reaches development as a pull request.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { githubRepo } from '../helpers/github-repo.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';
import { DESIGN_MD, INTENT, LOGIN_V1 } from './fixtures.ts';

describe('A designer and a PM shape a login screen with the bot and hand it to development', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const repo = githubRepo(net, 'acme/web', { files: { 'design/DESIGN.md': DESIGN_MD } });
  const model = scriptedModel();
  let thread: Awaited<ReturnType<typeof slack.post>>;

  test('Ana asks for a login screen for acme/web and gets a first version, designed with the team guide', async () => {
    model.willDo(
      decide.write('login.html', LOGIN_V1),
      decide.reply('Here is a first version of the login.\n\nDownload the file to see it at full size.'),
    );

    thread = await slack.post('U_ANA', slack.mention('a login screen for <https://github.com/acme/web>'));

    assert.ok(model.lastSaw().includes('#e4572e'), 'the bot designed with the DESIGN.md of acme/web');
    const [v1] = slack.versions(thread);
    assert.equal(v1.name, 'login.html');
    assert.match(v1.html, /twd-design:form-shim/, 'the form works in the Slack preview');
    assert.match(slack.botReplies(thread).find((m) => m.html)!.text!, /first version/);
    assert.deepEqual(slack.statuses, ['processing', 'active'], 'Ana saw the bot working');
  });

  test('Bruno mentions the bot in the thread with a change and gets v2', async () => {
    model.willDo(decide.edit({ old: '>Log in<', new: '>Sign in<' }), decide.reply('The button now says Sign in.'));
    const turnStart = model.calls();

    await slack.post('U_BRUNO', slack.mention('the button should say Sign in, like the rest of the app'), { thread });

    const seen = model.saw(turnStart);
    assert.ok(seen.includes('Current prototype (login.html)') && seen.includes('>Log in<'), 'the bot started from v1, read back from the thread');
    assert.ok(seen.includes('a login screen for') && seen.includes('first version'), 'and with the whole conversation');
    const versions = slack.versions(thread);
    assert.equal(versions.length, 2);
    assert.match(versions[1].html, />Sign in</);
    assert.doesNotMatch(versions[1].html, />Log in</);
    assert.equal(versions[1].html.split('twd-design:form-shim').length - 1, 1, 'the shim is not duplicated');
  });

  test('Bruno asks a question and gets an answer, without a new version', async () => {
    model.willDo(decide.reply('Errors show under the form, in red.'));

    await slack.post('U_BRUNO', slack.mention('where do the errors show?'), { thread });

    assert.equal(slack.lastReply(thread)!.text, 'Errors show under the form, in red.');
    assert.equal(slack.versions(thread).length, 2);
  });

  test('Asking in words for the PR opens nothing: the bot points to the Approve button', async () => {
    model.willDo(
      decide.openPr('login-screen', 'Prototype: login', INTENT),
      decide.reply('Press Approve and open PR under v2 and I will open it.'),
    );

    await slack.post('U_ANA', slack.mention('looks good, open the PR'), { thread });

    assert.equal(repo.pulls.length, 0);
    assert.match(model.lastToolResult().error, /Approve and open PR/);
  });

  test('Ana clicks Approve: a PR with the latest version and its intent, linking back to the thread', async () => {
    model.willDo(
      decide.openPr('Login Screen', 'Prototype: login', INTENT),
      decide.reply('Done: https://github.com/acme/web/pull/1'),
    );

    await slack.click('U_ANA', slack.controls(thread)!, 'Approve and open PR');

    const [pr] = repo.pulls;
    assert.equal(pr.title, 'Prototype: login');
    assert.equal(pr.head, 'design/login-screen');
    assert.equal(pr.base, 'main');
    assert.deepEqual(pr.basedOn, ['main-sha'], 'branched from the latest main');
    assert.deepEqual(Object.keys(pr.files), ['design/prototypes/login-screen/index.html', 'design/prototypes/login-screen/intent.md']);
    assert.equal(pr.files['design/prototypes/login-screen/index.html'], slack.versions(thread)[1].html, 'the PR has v2, the approved one');
    const intent = pr.files['design/prototypes/login-screen/intent.md'];
    assert.ok(intent.startsWith(INTENT), 'intent.md is what the model wrote');
    assert.match(intent, /Port the behavior these criteria describe, not the prototype's texts, fake data or markup\./,
      'and tells development to port the behavior, not the prototype');
    assert.ok(pr.body.startsWith(intent));
    assert.ok(pr.body.includes(`https://acme.slack.com/archives/C_DESIGN/p${thread.ts.replace('.', '')}`), 'the PR links to the discussion');
    assert.equal(model.lastToolResult().url, 'https://github.com/acme/web/pull/1', 'the bot knew the PR link to share it');
    assert.equal(slack.lastReply(thread)!.text, 'Done: https://github.com/acme/web/pull/1');
    assert.equal(slack.versions(thread).length, 2, 'approving does not post another version');
  });

  test('A later iteration of the same feature gets its own branch, and one PR even if the model asks twice', async () => {
    model.willDo(decide.write('login.html', LOGIN_V1.replace('Log in', 'Continue')), decide.reply('One-step login.'));
    const again = await slack.post('U_ANA', slack.mention('new login, one-step <https://github.com/acme/web>'));
    model.willDo(
      decide.openPr('login-screen', 'Prototype: login v2', INTENT),
      decide.openPr('login-screen', 'Prototype: login v2', INTENT),
      decide.reply('New PR opened.'),
    );

    await slack.click('U_ANA', slack.controls(again)!, 'Approve and open PR');

    assert.equal(repo.pulls.length, 2, 'one new PR for this approval, not two');
    assert.equal(model.lastToolResult().alreadyOpened, true);

    const latest = repo.pulls.at(-1)!;
    assert.match(latest.head, /^design\/login-screen-[a-z0-9]+$/);
    assert.match(latest.files['design/prototypes/login-screen/index.html'], />Continue</);
    assert.equal(model.pending(), 0);
  });

  test('A thread about an issue: the PR folder and branch start with its number, and the intent can link it', async () => {
    const idea = await slack.post('U_NEPTUNO', 'Thanks for your idea: a My karma page (#71). Is that right?', { botId: 'B_NEPTUNO' });
    model.willDo(decide.write('karma.html', LOGIN_V1), decide.reply('First version.'));
    await slack.post('U_KEVIN', slack.mention('prototype it for <https://github.com/acme/web>'), { thread: idea });
    assert.match(model.lastSaw(), /issue #71/, 'the model knows which issue to link in intent.md');
    model.willDo(decide.openPr('my-karma', 'Prototype: my karma', INTENT), decide.reply('Done.'));

    await slack.click('U_KEVIN', slack.controls(idea)!, 'Approve and open PR');

    const pr = repo.pulls.at(-1)!;
    assert.equal(pr.head, 'design/71-my-karma');
    assert.deepEqual(Object.keys(pr.files), ['design/prototypes/71-my-karma/index.html', 'design/prototypes/71-my-karma/intent.md']);
  });
});
