// Its own file: draining is one-way for the process, and node --test runs each file in its own process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainTurns, handleTurn, isAccepting } from '../src/slack/turn.ts';
import { BOT, fakeSlack } from './helpers/fake-slack.ts';

test('SIGTERM drain: waits for the running turn, then refuses new ones', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const full = Array.from({ length: 15 }, () => ({ user: BOT, text: 'v' }));
  const running = handleTurn({ client: fakeSlack([full], { replies: () => gate }).client, botUserId: BOT, channel: 'C1', threadTs: '1.0', messageTs: '1.1' });

  const drained = drainTurns(5_000);
  assert.equal(isAccepting(), false);
  setTimeout(release, 100);
  assert.equal(await drained, 0, 'no turn left running');
  await running;

  const late = fakeSlack([full]);
  await handleTurn({ client: late.client, botUserId: BOT, channel: 'C1', threadTs: '2.0', messageTs: '2.1' });
  assert.deepEqual(late.texts(), ['Restarting right now, ask again in a minute.']);
});
