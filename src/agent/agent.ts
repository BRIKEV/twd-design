import { Agent } from '@mastra/core/agent';
import { config } from '../config.ts';
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

/** Runs one turn: the thread so far + design guide + current prototype in, reply text out. */
export async function runDesignAgent(history: ChatMessage[], state: PrototypeState, ctx: TurnContext) {
  const agent = new Agent({
    id: 'twd-design',
    name: 'TWD Design',
    instructions: loadInstructions(),
    model: config.model.id,
    tools: prototypeTools(state, ctx),
  });

  const messages = [...designMessages(ctx.design), ...prototypeMessages(state), ...history];
  const result = await agent.generate(messages, { maxSteps: 8, providerOptions });
  return { text: result.text, usage: result.usage };
}

function designMessages(design: DesignContext): ChatMessage[] {
  if (!design) return [];
  const content = design.guide
    ? `Design guide for this product, from ${design.repo} (design/DESIGN.md). Follow it: colors, typography, spacing, components and tone.\n\n${design.guide}`
    : `The product repo is ${design.repo}, but it has no design/DESIGN.md. Use the default neutral design and say so in your reply.`;
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
