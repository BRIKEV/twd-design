// Last step of the install: pick the model the bot designs with and paste its key. The key is tried
// with one tiny real request before it is saved, so a bad key shows up here, not in the first thread.

import { describe, test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupModel } from '../../src/setup/model.ts';
import { fakeFetch, json } from '../helpers/fake-fetch.ts';
import { scriptedTerminal } from '../helpers/terminal.ts';

const rejected = () => json({ error: { message: 'Authentication failed' } }, 401);

describe('Setting up the model', () => {
  const tried: string[] = [];
  let thinksFirst = false;
  const net = fakeFetch({
    // Z.ai speaks the OpenAI chat format.
    'POST /api/paas/v4/chat/completions': (req) => {
      tried.push(`zai/${req.body.model}`);
      if (req.headers.get('authorization') !== 'Bearer zai-good') return rejected();
      if (thinksFirst) return {
        id: '1', object: 'chat.completion', created: 0, model: req.body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
      };
      return {
        id: '1', object: 'chat.completion', created: 0, model: req.body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      };
    },
    'POST /v1/messages': (req) => {
      tried.push(`anthropic/${req.body.model}`);
      if (req.headers.get('x-api-key') !== 'sk-ant-good') return rejected();
      return {
        id: 'msg_1', type: 'message', role: 'assistant', model: req.body.model,
        content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn',
        usage: { input_tokens: 3, output_tokens: 1 },
      };
    },
  });
  after(() => net.restore());
  let envFile: string;
  beforeEach(() => {
    envFile = join(mkdtempSync(join(tmpdir(), 'twd-setup-')), '.env');
    writeFileSync(envFile, 'SLACK_BOT_TOKEN=xoxb-good\n');
    tried.length = 0;
    thinksFirst = false;
  });

  test('Marta keeps the recommended model, and her key is tried before it is saved', async () => {
    const term = scriptedTerminal(['', 'zai-good']);
    await setupModel({ ...term, envFile });

    assert.deepEqual(tried, ['zai/glm-5.3-flash'], 'one tiny request with her key');
    assert.match(term.output(), /✔ zai\/glm-5\.3-flash answered/);
    assert.equal(readFileSync(envFile, 'utf8'),
      'SLACK_BOT_TOKEN=xoxb-good\nMODEL=zai/glm-5.3-flash\nZHIPU_API_KEY=zai-good\n');
  });

  test('Her company only approves Anthropic: she picks a Claude model and is asked for that key', async () => {
    const term = scriptedTerminal(['anthropic/claude-sonnet-5-5', 'sk-ant-good']);
    await setupModel({ ...term, envFile });

    assert.match(term.output(), /\? ANTHROPIC_API_KEY/);
    assert.deepEqual(tried, ['anthropic/claude-sonnet-5-5']);
    assert.match(readFileSync(envFile, 'utf8'), /^MODEL=anthropic\/claude-sonnet-5-5\nANTHROPIC_API_KEY=sk-ant-good$/m);
  });

  test('A model that does not exist is explained, with close names, before any key is asked', async () => {
    const term = scriptedTerminal(['glm-5.3-flash', 'acme/designer', 'zai/glm-5.3-flsh', 'zai/glm-5.3-flash', 'zai-good']);
    await setupModel({ ...term, envFile });

    const out = term.output();
    assert.match(out, /provider\/model, e\.g\. zai\/glm-5\.3-flash/);
    assert.match(out, /"acme" is not a provider/);
    assert.match(out, /Z\.AI has no model "glm-5\.3-flsh"\. Close: .*glm-5\.3-flash/);
    assert.deepEqual(tried, ['zai/glm-5.3-flash'], 'nothing was sent for the wrong names');
  });

  test('A rejected key is never saved, and she can paste another one', async () => {
    const term = scriptedTerminal(['', 'zai-typo', 'zai-good']);
    await setupModel({ ...term, envFile });

    assert.match(term.output(), /✖ Z\.AI rejected the key: Authentication failed/);
    const env = readFileSync(envFile, 'utf8');
    assert.ok(!env.includes('zai-typo'));
    assert.match(env, /^ZHIPU_API_KEY=zai-good$/m);
  });

  test('Running it again, she can keep the key she already has, and it is tried too', async () => {
    writeFileSync(envFile, 'MODEL=zai/glm-5.3\nZHIPU_API_KEY=zai-good\n');
    const term = scriptedTerminal(['', '']);
    await setupModel({ ...term, envFile });

    assert.match(term.output(), /\(zai\/glm-5\.3\)/, 'her current model is the default');
    assert.ok(!term.output().includes('zai-good'), 'the key is never printed');
    assert.deepEqual(tried, ['zai/glm-5.3']);
    assert.equal(readFileSync(envFile, 'utf8'), 'MODEL=zai/glm-5.3\nZHIPU_API_KEY=zai-good\n');
  });

  test('A model that spends the tiny request thinking still proves the key works', async () => {
    thinksFirst = true;
    const term = scriptedTerminal(['', 'zai-good']);
    await setupModel({ ...term, envFile });
    assert.match(term.output(), /✔ zai\/glm-5\.3-flash answered/);
    assert.match(readFileSync(envFile, 'utf8'), /^ZHIPU_API_KEY=zai-good$/m);
  });
});
