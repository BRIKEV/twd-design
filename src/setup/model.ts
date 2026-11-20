import { existsSync, readFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { noopLogger } from '@mastra/core/logger';
import { PROVIDER_KEYS } from '../config.ts';
import { updateEnvFile } from './env-file.ts';
import { askValid, type Terminal } from './slack.ts';

// Setup step 3: the model the bot designs with, and its API key, tried with one tiny request.

const RECOMMENDED = 'zai/glm-5.3-flash';
type Provider = { name: string; models: string[]; apiKeyEnvVar: string | string[] };
const providers = PROVIDER_REGISTRY as unknown as Record<string, Provider>;

function readEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter((m) => m != null).map((m) => [m[1], m[2]]));
}

const commonPrefix = (a: string, b: string) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };

function modelProblem(id: string): string | null {
  const slash = id.indexOf('/');
  if (slash < 1) return `Use provider/model, e.g. ${RECOMMENDED} or anthropic/claude-sonnet-5-5.`;
  const [provider, model] = [id.slice(0, slash), id.slice(slash + 1)];
  const p = providers[provider];
  if (!p) return `"${provider}" is not a provider. Some that are: zai, anthropic, openai, google, deepseek, openrouter.`;
  if (p.models.includes(model)) return null;
  const close = [...p.models].sort((a, b) => commonPrefix(b, model) - commonPrefix(a, model)).slice(0, 5);
  return `${p.name} has no model "${model}". Close: ${close.join(', ')}.`;
}

const keyVarOf = (provider: string) => {
  const v = PROVIDER_KEYS[provider] ?? providers[provider].apiKeyEnvVar;
  return Array.isArray(v) ? v[0] : v;
};

/** One tiny request with this key. Returns why it failed, or null. */
async function tryKey(id: string, apiKey: string): Promise<string | null> {
  const agent = new Agent({
    id: 'setup-check', name: 'setup-check', instructions: 'Reply with OK.',
    model: { id: id as `${string}/${string}`, apiKey },
  });
  agent.__setLogger(noopLogger);
  try {
    await agent.generate('Reply with OK.', { modelSettings: { maxOutputTokens: 5, maxRetries: 0 } });
    return null;
  } catch (err) {
    const e = err as { statusCode?: number; data?: { error?: { message?: string } }; message?: string };
    // The provider answered, so the key works. Reasoning models can spend 5 tokens thinking, and Mastra
    // then complains there is no text: that is not a key problem.
    if (e.statusCode == null && /maximum output length|no text/i.test(e.message ?? '')) return null;
    const why = e.data?.error?.message || e.message || 'no details';
    const provider = providers[id.split('/')[0]].name;
    return e.statusCode === 401 || e.statusCode === 403
      ? `${provider} rejected the key: ${why}`
      : `${id} did not answer: ${why}${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}`;
  }
}

export async function setupModel({ ask, say, envFile }: Terminal & { envFile: string }) {
  const t = { ask, say };
  const current = readEnv(envFile);
  say(`\nModel (what the bot designs with). Which one fits your company: docs/setup/models.md\n`);

  const id = await askValid(t, 'Model, as provider/model', current.MODEL ?? RECOMMENDED, modelProblem);
  const keyVar = keyVarOf(id.slice(0, id.indexOf('/')));
  const existing = current[keyVar];

  let key = '';
  await askValid(t, existing ? `${keyVar} (Enter keeps the current one)` : keyVar, undefined, async (v) => {
    key = v || existing || '';
    if (!key) return 'Paste the API key from your provider\'s console.';
    return tryKey(id, key);
  });

  updateEnvFile(envFile, { MODEL: id, [keyVar]: key });
  say(`✔ ${id} answered. Saved MODEL and ${keyVar} to .env.`);
}
