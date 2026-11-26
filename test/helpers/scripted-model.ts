import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { setModel } from '../../src/agent/agent.ts';

// Stands in for the LLM so a whole conversation can be replayed deterministically. The test
// scripts what the model decides at each step (which tool to call, what to say); everything
// around it is the real code: the agent loop, the tools, the thread, GitHub.

type Part = { type: 'text'; text: string } | { type: 'tool-call'; toolCallId: string; toolName: string; input: string };
type Step = Part[];

let next = 0;
const call = (toolName: string, input: unknown): Part => ({ type: 'tool-call', toolCallId: `call-${++next}`, toolName, input: JSON.stringify(input) });

/** What the model can decide in one step. */
export const decide = {
  write: (filename: string, html: string): Step => [call('write_prototype', { filename, html })],
  edit: (...edits: { old: string; new: string }[]): Step => [call('edit_prototype', { edits })],
  openPr: (slug: string, title: string, intent: string): Step => [call('open_pull_request', { slug, title, intent })],
  list: (path: string): Step => [call('list_repo_files', { path })],
  read: (path: string): Step => [call('read_repo_file', { path })],
  scenarios: (code: string): Step => [call('write_scenarios', { code })],
  reply: (text: string): Step => [{ type: 'text', text }],
};

type Prompt = { role: string; content: unknown }[];

export function scriptedModel() {
  const queue: Step[] = [];
  const prompts: Prompt[] = [];
  let fail: string | undefined;
  let hang = false;

  setModel(new MastraLanguageModelV2Mock({
    doGenerate: async ({ prompt, abortSignal }: { prompt: Prompt; abortSignal?: AbortSignal }) => {
      prompts.push(prompt);
      if (fail) { const e = fail; fail = undefined; throw new Error(e); }
      if (hang) {
        hang = false;
        // A slow model: it only ends when the turn is stopped.
        await new Promise((_, reject) => abortSignal?.addEventListener('abort', () => reject(new Error('aborted'))));
      }
      const content = queue.shift();
      if (!content) throw new Error('The scripted model has no step left: the bot called the model more often than the story expects.');
      return {
        content,
        finishReason: content.some((p) => p.type === 'tool-call') ? 'tool-calls' : 'stop',
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
        warnings: [],
      } as any;
    },
  }) as any);

  const text = (p: Prompt) => JSON.stringify(p);
  return {
    /** The steps the model takes in the next turn, in order. */
    willDo: (...steps: Step[]) => { queue.push(...steps); },
    willFail: (message: string) => { fail = message; },
    /** The next call takes forever, until someone stops the turn. */
    willHang: () => { hang = true; },
    /** Resolves once the model has been called n times in total. */
    waitForCalls: async (n: number) => {
      for (let i = 0; i < 200 && prompts.length < n; i++) await new Promise((r) => setTimeout(r, 5));
      if (prompts.length < n) throw new Error(`The model was called ${prompts.length} times, expected ${n}`);
    },
    calls: () => prompts.length,
    /** What the model received on call number n (0-based): pass calls() taken before a turn to see how that turn started. */
    saw: (n: number) => text(prompts[n] ?? []),
    /** Everything the model received on its latest call (system prompt, thread, tool results), as text. */
    lastSaw: () => text(prompts.at(-1) ?? []),
    /** What a tool answered the model on its latest call. */
    lastToolResult: () => {
      const tool = [...(prompts.at(-1) ?? [])].reverse().find((m) => m.role === 'tool') as any;
      return tool?.content[0]?.output?.value;
    },
    pending: () => queue.length,
  };
}
