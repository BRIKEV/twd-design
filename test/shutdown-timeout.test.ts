import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drainTurns, handleTurn } from '../src/slack/turn.ts';
import { BOT, fakeSlack } from './helpers/fake-slack.ts';

test('the drain gives up at the timeout and reports how many turns are still running', async () => {
  const stuck = fakeSlack([[]], { replies: () => new Promise<void>(() => {}) });
  void handleTurn({ client: stuck.client, botUserId: BOT, channel: 'C1', threadTs: '1.0', messageTs: '1.1' });
  const started = Date.now();
  assert.equal(await drainTurns(300), 1);
  assert.ok(Date.now() - started < 1_000);
});
