import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleTurn } from '../src/slack/turn.ts';
import { fakeFetch, json } from './helpers/fake-fetch.ts';
import { BOT, fakeSlack } from './helpers/fake-slack.ts';

// These cover what happens around the model. Every case here returns before calling it, and the
// fake fetch makes sure nothing reaches a real API if one ever doesn't.
let net = fakeFetch({});
afterEach(() => { net.restore(); net = fakeFetch({}); });

const turn = (client: any, threadTs = '1.0') => handleTurn({ client, botUserId: BOT, channel: 'C1', threadTs, messageTs: '2.0' });
const reactions = (posted: { method: string }[]) => posted.filter((p) => p.method.startsWith('reactions')).map((p) => p.method);

test('stops at the turn limit and says how to continue', async () => {
  const bot = Array.from({ length: 15 }, () => ({ user: BOT, text: 'v' }));
  const slack = fakeSlack([[{ user: 'U1', text: 'hi' }, ...bot]]);
  await turn(slack.client);
  assert.deepEqual(slack.texts(), ['This thread hit the 15-turn limit. Start a new thread to keep going.']);
  assert.deepEqual(reactions(slack.posted), ['reactions.add', 'reactions.remove']);
});

test('App not installed on the linked repo: replies with the install link', async () => {
  net.restore();
  net = fakeFetch({
    'GET /repos/acme/private/installation': () => json({}, 404),
    'GET /app': () => ({ slug: 'acme-design' }),
  });
  const slack = fakeSlack([[{ user: 'U1', text: `<@${BOT}> login for <https://github.com/acme/private>` }]]);
  await turn(slack.client);
  assert.deepEqual(slack.texts(), [
    "I can't read *acme/private*: the GitHub App isn't installed there. <https://github.com/apps/acme-design/installations/new|Install it on that repo> and ask again.",
  ]);
});

test('one turn per thread at a time; other threads are not blocked', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const full = Array.from({ length: 15 }, () => ({ user: BOT, text: 'v' }));
  const slow = fakeSlack([full], { replies: () => gate });
  const first = turn(slow.client, '7.0');

  const sameThread = fakeSlack([full]);
  await turn(sameThread.client, '7.0');
  assert.deepEqual(sameThread.texts(), ['Still working on the previous version, give me a moment.']);

  const otherThread = fakeSlack([full]);
  await turn(otherThread.client, '8.0');
  assert.match(otherThread.texts()[0], /turn limit/);

  release();
  await first;
  // Once done, the thread is free again.
  const later = fakeSlack([full]);
  await turn(later.client, '7.0');
  assert.match(later.texts()[0], /turn limit/);
});

test('an error is reported in the thread and the hourglass is always removed', async () => {
  const slack = fakeSlack([], { replies: async () => { throw new Error('channel_not_found'); } });
  await turn(slack.client);
  assert.deepEqual(slack.texts(), ['Something failed: channel_not_found']);
  assert.deepEqual(reactions(slack.posted), ['reactions.add', 'reactions.remove']);
});
