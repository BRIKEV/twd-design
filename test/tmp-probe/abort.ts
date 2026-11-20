import { Agent } from '@mastra/core/agent';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
const model = new MastraLanguageModelV2Mock({
  doGenerate: async ({ abortSignal }: any) => {
    console.log('got signal?', !!abortSignal);
    await new Promise((_, rej) => abortSignal?.addEventListener('abort', () => rej(abortSignal.reason ?? new Error('aborted'))));
    return {} as any;
  },
} as any);
const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: model as any });
const ac = new AbortController();
setTimeout(() => ac.abort(new Error('stopped by user')), 100);
try { const r = await agent.generate('hi', { abortSignal: ac.signal }); console.log('returned', r.finishReason, JSON.stringify(r.text), r.error?.message); }
catch (e: any) { console.log('threw', e.name, e.message); }
console.log('aborted?', ac.signal.aborted);
