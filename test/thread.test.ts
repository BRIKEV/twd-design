import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadThread } from '../src/slack/thread.ts';
import { fakeFetch } from './helpers/fake-fetch.ts';
import { BOT, fakeSlack } from './helpers/fake-slack.ts';

const html = (name: string, url: string) => ({ name, filetype: 'html', url_private_download: url });

let net: ReturnType<typeof fakeFetch>;
afterEach(() => net?.restore());

test('rebuilds the conversation from the thread, across pages', async () => {
  const { client } = fakeSlack([
    [
      { user: 'U1', text: `<@${BOT}> a login page for <https://github.com/acme/web>` },
      { user: BOT, text: 'Here is v1', files: [html('login.html', 'https://files.slack.test/v1')] },
      { bot_id: 'B_OTHER', text: 'some other bot' },
    ],
    [
      { user: 'U2', text: 'make the button blue' },
      { user: BOT, text: 'Here is v2', files: [html('login.html', 'https://files.slack.test/v2')] },
      { user: 'U1', text: `<@${BOT}>` },
    ],
  ]);
  net = fakeFetch({ 'GET https://files.slack.test/v2': () => new Response('<html>v2</html>') });

  const t = await loadThread(client, BOT, 'C1', '1.0');

  assert.deepEqual(t.history, [
    { role: 'user', content: 'a login page for <https://github.com/acme/web>' },
    { role: 'assistant', content: 'Here is v1' },
    { role: 'user', content: 'make the button blue' },
    { role: 'assistant', content: 'Here is v2' },
  ]);
  assert.equal(t.botTurns, 2);
  assert.equal(t.botInThread, true);
  assert.equal(t.repo, 'acme/web');
  assert.deepEqual(t.state, { filename: 'login.html', html: '<html>v2</html>', changed: false, calls: [] });
  assert.equal(net.requests[0].headers.get('authorization'), 'Bearer xoxb-test');
});

test('withHtml: false reads the thread without downloading the prototype', async () => {
  const { client } = fakeSlack([[{ user: BOT, text: 'v1', files: [html('a.html', 'https://files.slack.test/a')] }]]);
  net = fakeFetch({});
  const t = await loadThread(client, BOT, 'C1', '1.0', { withHtml: false });
  assert.equal(t.state.html, null);
  assert.equal(net.requests.length, 0);
});

test('a thread the bot never answered', async () => {
  const { client } = fakeSlack([[{ user: 'U1', text: 'hello team' }]]);
  const t = await loadThread(client, BOT, 'C1', '1.0');
  assert.equal(t.botInThread, false);
  assert.equal(t.repo, null);
  assert.equal(t.state.html, null);
  assert.equal(t.state.filename, 'prototype.html');
});

test('a failed download starts without a prototype instead of crashing', async () => {
  const { client } = fakeSlack([[{ user: BOT, text: 'v1', files: [html('a.html', 'https://files.slack.test/a')] }]]);
  net = fakeFetch({ 'GET https://files.slack.test/a': () => new Response('nope', { status: 403 }) });
  const t = await loadThread(client, BOT, 'C1', '1.0');
  assert.equal(t.state.html, null);
});
