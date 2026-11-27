import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { TracingContext } from '@mastra/core/observability';
import { config } from '../config.ts';
import { runScenarios, type ScenarioCheck, type ScenarioReport } from '../prototype/scenarios.ts';
import { loadInstructions } from './instructions.ts';
import { prototypeTools } from './tools.ts';
import type { ChatMessage, DesignContext, PrototypeState, TurnContext } from './types.ts';

// GLM takes `thinking` in the request body; Mastra passes it through from providerOptions keyed by
// the provider id (zai or zai-coding-plan). Other providers ignore it.
const provider = config.model.id.split('/')[0];
const thinking = (on: boolean) =>
  provider.startsWith('zai') ? { [provider]: { thinking: { type: on ? 'enabled' : 'disabled' } } } : undefined;
const providerOptions = thinking(config.model.thinking);

// Always MODEL in production. Tests swap in a scripted model to replay whole conversations.
let model: MastraModelConfig = config.model.id;
export const setModel = (m: MastraModelConfig) => { model = m; };

// Headless Chrome in production. Tests plug in a fake, or null to skip it.
let checkScenarios: ScenarioCheck | null = config.scenarioCheck ? runScenarios : null;
export const setScenarioCheck = (c: ScenarioCheck | null) => { checkScenarios = c; };

/** Fix rounds after the first run, before the version is posted as it is. */
const FIX_ROUNDS = 3;

function fixRequest(html: string, report: ScenarioReport) {
  const failures = report.failed.map((f) => `- ${f.name}: ${f.error}`).join('\n');
  const errors = report.pageErrors.length ? `\n\nErrors in the page:\n${report.pageErrors.map((e) => `- ${e}`).join('\n')}` : '';
  return `The TWD scenarios of this version ran in headless Chrome. ${report.failed.length} of ${report.passed + report.failed.length} failed:\n${failures}${errors}

Fix them with edit_prototype before anyone sees this version. If the scenario asserts the wrong thing (see the TWD rules), fix the scenario; if the page doesn't do what was agreed, fix the page. Don't drop a scenario to make it pass. Reply with one short line.

The prototype as it ran:

${html}`;
}

/**
 * Runs one turn: the thread so far + design guide + current prototype in, reply text out.
 * tracingContext: only from Mastra Studio and the evals, so the model and tool calls show up in its traces.
 */
export async function runDesignAgent(history: ChatMessage[], state: PrototypeState, ctx: TurnContext, abortSignal?: AbortSignal, tracingContext?: TracingContext) {
  const tools = prototypeTools(state, ctx);
  const agent = new Agent({ id: 'twd-design', name: 'TWD Design', instructions: loadInstructions(), model, tools });

  const messages = [...designMessages(ctx.design, ctx.issue), ...prototypeMessages(state), ...history];
  const options = { maxSteps: 16, providerOptions, abortSignal, tracingContext };
  const { first, usage } = config.model.planThinking && !config.model.thinking
    ? await planThenWrite(agent, tools, messages, state, options)
    : await agent.generate(messages, options).then((r) => ({ first: r, usage: [r.usage] }));

  // A new version runs its scenarios; failures go back to the model, up to FIX_ROUNDS times.
  let scenarios: ScenarioReport | undefined;
  const checks: ScenarioReport[] = [];
  if (state.changed && state.html && checkScenarios) {
    let conversation = [...messages, { role: 'assistant' as const, content: first.text || 'Done.' }];
    for (let round = 0; !abortSignal?.aborted; round++) {
      const report = await checkScenarios(state.html);
      if ('unavailable' in report) break;
      scenarios = report;
      checks.push(report);
      state.calls.push(`check:${report.passed}/${report.passed + report.failed.length}`);
      if (!report.failed.length || round === FIX_ROUNDS) break;
      conversation = [...conversation, { role: 'user', content: fixRequest(state.html, report) }];
      const fix = await agent.generate(conversation, options);
      usage.push(fix.usage);
      conversation = [...conversation, { role: 'assistant', content: fix.text || 'Done.' }];
    }
  }
  return { text: first.text, usage: sumUsage(usage), scenarios, checks };
}

// PLAN_THINKING=on: the model reads and plans with thinking on, without the tools that write the page, then
// writes the page without thinking, following the plan. Thinking pays for a short plan, not for the page.
// A turn that plans nothing (a question, an approval) ends after the first call.
async function planThenWrite(
  agent: Agent, tools: ReturnType<typeof prototypeTools>, messages: ChatMessage[], state: PrototypeState,
  options: { maxSteps: number; providerOptions: unknown; abortSignal?: AbortSignal; tracingContext?: TracingContext },
) {
  const { write_prototype, edit_prototype, ...planTools } = tools;
  const planner = new Agent({
    id: 'twd-design-plan', name: 'TWD Design (plan)', model, tools: planTools,
    instructions: `${loadInstructions()}\n\n## This step\n\nYou can read and plan, not write the page: a change needs ` +
      '`plan_scenarios` (scenarios + page contract); the page is written right after, from your plan. A question or ' +
      'an approval needs no plan: answer it.',
  });
  const plan = await planner.generate(messages, { ...options, providerOptions: thinking(true) } as never);
  if (!state.plan) return { first: plan, usage: [plan.usage] };
  const code = (state.reads ?? []).map((r) => `### ${r.path}\n\n\`\`\`\n${r.content}\n\`\`\``).join('\n\n');
  const write = await agent.generate([
    ...messages,
    { role: 'user', content: `Plan for this version. Write the page now, following it.\n\nScenarios:\n${state.plan.code}\n\n` +
      `Page contract:\n${state.plan.contract}${code ? `\n\nThe product code read for it:\n\n${code}` : ''}` },
  ], options as never);
  return { first: write, usage: [plan.usage, write.usage] };
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
