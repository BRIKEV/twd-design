import { Agent } from '@mastra/core/agent';
import type { MastraModelConfig } from '@mastra/core/llm';
import type { TracingContext } from '@mastra/core/observability';
import { config } from '../config.ts';
import { runScenarios, snapshotScreens, type ScenarioCheck, type ScenarioReport, type ScreensSnapshot } from '../prototype/scenarios.ts';
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

// Renders each screen of a new version so the scenarios are written against the real page. Headless
// Chrome in production; tests plug in a fake, or null to write page and scenarios in one step.
let snapshot: ScreensSnapshot | null = config.scenarioCheck && config.screensStep ? snapshotScreens : null;
export const setScreensSnapshot = (s: ScreensSnapshot | null) => { snapshot = s; };

// Added to the instructions when the screens step runs: the first call writes only the page.
const SCENARIOS_LATER = `

## Scenarios come second

Every new version is rendered in Chrome after you write it, and you get what each screen shows, to write
the scenarios against it. So with write_prototype and edit_prototype work only on the page: in a first
version leave \`<script id="scenarios">\` with an empty \`function scenarios() {}\`; in later versions don't
touch it. Don't write the Slack reply yet: one line saying the page is ready is enough.`;

function scenariosRequest(screens: string) {
  return `The page of this version is written. This is what each screen shows once rendered in Chrome, as Testing Library sees it: role "name" (states), and texts exactly as the browser splits them.

${screens}

Now write this version's TWD scenarios with write_scenarios, following the TWD rules. Query only roles, names and texts listed here, exactly as written. A sentence that shows up as two text lines can't be found as one: query the piece you need, or fix the page with edit_prototype first. A text that comes from state (a name typed in a form, a total after adding items) changes after the action that sets it: follow the code you wrote.

Then write your reply for Slack, in the format of your instructions: it is the reply people see.`;
}

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

/**
 * Runs one turn: the thread so far + design guide + current prototype in, reply text out.
 * tracingContext: only from Mastra Studio and the evals, so the model and tool calls show up in its traces.
 */
export async function runDesignAgent(history: ChatMessage[], state: PrototypeState, ctx: TurnContext, abortSignal?: AbortSignal, tracingContext?: TracingContext) {
  const tools = prototypeTools(state, ctx);
  const instructions = loadInstructions() + (snapshot ? SCENARIOS_LATER : '');
  const agent = new Agent({ id: 'twd-design', name: 'TWD Design', instructions, model, tools });

  const messages = [...designMessages(ctx.design, ctx.issue), ...prototypeMessages(state), ...history];
  const options = { maxSteps: 16, providerOptions, abortSignal, tracingContext };
  const first = await agent.generate(messages, options);
  const usage = [first.usage];
  let reply = first.text;
  let conversation: ChatMessage[] = [...messages, { role: 'assistant', content: first.text || 'Done.' }];

  // Page first, then scenarios: the new version is rendered and the model writes the scenarios against
  // what each screen really shows, the way you write a test for a page that already exists.
  if (state.changed && state.html && snapshot && !abortSignal?.aborted) {
    const screens = await snapshot(state.html);
    if (typeof screens === 'string') {
      state.calls.push('screens');
      conversation = [...conversation, { role: 'user', content: scenariosRequest(screens) }];
      // Only the scenarios and small page fixes here: rewriting the page would make the screens stale.
      const scenarioWriter = new Agent({
        id: 'twd-design-scenarios', name: 'TWD Design', instructions, model,
        tools: { write_scenarios: tools.write_scenarios, edit_prototype: tools.edit_prototype },
      });
      const written = await scenarioWriter.generate(conversation, options);
      usage.push(written.usage);
      reply = written.text || reply;
      conversation = [...conversation, { role: 'assistant', content: written.text || 'Done.' }];
    }
  }

  // A new version runs its scenarios; failures go back to the model, up to FIX_ROUNDS times.
  let scenarios: ScenarioReport | undefined;
  if (state.changed && state.html && checkScenarios) {
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
  return { text: reply, usage: sumUsage(usage), scenarios };
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
