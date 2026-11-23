import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import { config } from '../config.ts';
import { runScenarios, type ScenarioCheck, type ScenarioReport } from '../prototype/scenarios.ts';
import { loadInstructions } from './instructions.ts';
import { prototypeTools } from './tools.ts';
import type { ChatMessage, DesignContext, PrototypeState, TurnContext } from './types.ts';

// GLM takes `thinking` in the request body; Mastra passes it through from providerOptions keyed by
// the provider id (zai or zai-coding-plan). Other providers ignore it.
const provider = config.model.id.split('/')[0];
const providerOptions =
  provider.startsWith('zai') && !config.model.thinking
    ? { [provider]: { thinking: { type: 'disabled' } } }
    : undefined;

// Always MODEL in production. Tests swap in a scripted model to replay whole conversations.
let model: MastraModelConfig = config.model.id;
export const setModel = (m: MastraModelConfig) => { model = m; };

// Headless Chrome in production. Tests plug in a fake, or null to skip it.
let checkScenarios: ScenarioCheck | null = config.scenarioCheck ? runScenarios : null;
export const setScenarioCheck = (c: ScenarioCheck | null) => { checkScenarios = c; };

/** Fix rounds after the first run, before the version is posted as it is. */
const FIX_ROUNDS = 2;

function fixRequest(html: string, report: ScenarioReport) {
  const failures = report.failed.map((f) => `- ${f.name}: ${f.error}`).join('\n');
  const errors = report.pageErrors.length ? `\n\nErrors in the page:\n${report.pageErrors.map((e) => `- ${e}`).join('\n')}` : '';
  return `The TWD scenarios of this version ran in headless Chrome. ${report.failed.length} of ${report.passed + report.failed.length} failed:\n${failures}${errors}

Fix them with edit_prototype before anyone sees this version. If the scenario asserts the wrong thing (see the TWD rules), fix the scenario; if the page doesn't do what was agreed, fix the page. Don't drop a scenario to make it pass. Reply with one short line.

The prototype as it ran:

${html}`;
}

/** Runs one turn: the thread so far + design guide + current prototype in, reply text out. */
export async function runDesignAgent(history: ChatMessage[], state: PrototypeState, ctx: TurnContext, abortSignal?: AbortSignal) {
  const agent = new Agent({
    id: 'twd-design',
    name: 'TWD Design',
    instructions: loadInstructions(),
    model,
    tools: prototypeTools(state, ctx),
  });

  const messages = [...designMessages(ctx.design, ctx.issue), ...prototypeMessages(state), ...history];
  const options = { maxSteps: 16, providerOptions, abortSignal };
  const first = await agent.generate(messages, options);
  const usage = [first.usage];

  // A new version runs its scenarios; failures go back to the model, up to FIX_ROUNDS times.
  let scenarios: ScenarioReport | undefined;
  if (state.changed && state.html && checkScenarios) {
    let conversation = [...messages, { role: 'assistant' as const, content: first.text || 'Done.' }];
    for (let round = 0; !abortSignal?.aborted; round++) {
      const report = await checkScenarios(state.html);
      if ('unavailable' in report) break;
      scenarios = report;
      state.calls.push(`check:${report.passed}/${report.passed + report.failed.length}`);
      if (!report.failed.length || round === FIX_ROUNDS) break;
      conversation = [...conversation, { role: 'user', content: fixRequest(state.html, report) }];
      const fix = await agent.generate(conversation, options);
      usage.push(fix.usage);
      conversation = [...conversation, { role: 'assistant', content: fix.text || 'Done.' }];
    }
  }
  return { text: first.text, usage: sumUsage(usage), scenarios };
}

type Usage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
function sumUsage(all: Usage[]): Usage {
  if (all.length === 1) return all[0];
  const add = (k: keyof Usage) => all.reduce((n, u) => n + (u?.[k] ?? 0), 0);
  return { inputTokens: add('inputTokens'), outputTokens: add('outputTokens'), totalTokens: add('totalTokens') };
}

function designMessages(design: DesignContext, issue?: number | null): ChatMessage[] {
  if (!design) return [];
  const about = issue ? `\n\nThis thread is about issue #${issue} (https://github.com/${design.repo}/issues/${issue}): link it at the top of intent.md.` : '';
  const content = (design.guide
    ? `Design guide for this product, from ${design.repo} (design/DESIGN.md). Follow it: colors, typography, spacing, components and tone.\n\n${design.guide}`
    : `The product repo is ${design.repo}, but it has no design/DESIGN.md. Use the default neutral design and say so in your reply.`) + about;
  return [
    { role: 'user', content },
    { role: 'assistant', content: 'Understood, I will design with that.' },
  ];
}

function prototypeMessages(state: PrototypeState): ChatMessage[] {
  if (!state.html) return [];
  return [
    { role: 'user', content: `Current prototype (${state.filename}):\n\n${state.html}` },
    { role: 'assistant', content: 'Got it, I have the current prototype.' },
  ];
}
