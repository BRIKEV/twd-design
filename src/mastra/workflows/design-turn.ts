import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { runDesignAgent } from '../../agent/agent.ts';
import type { PrototypeState } from '../../agent/types.ts';
import { readRepoFile } from '../../github/files.ts';

// One bot turn, outside Slack: what the thread would send in, what the bot would post back.
// Studio runs it by hand, and the evals run it once per dataset case.

const message = z.object({ role: z.enum(['user', 'assistant']), content: z.string() });

export const turnInput = z.object({
  request: z.string().describe('What someone writes to the bot in the thread'),
  history: z.array(message).default([]).describe('Earlier messages in the thread, oldest first'),
  repo: z.string().optional().describe('owner/name of the linked repo; its design/DESIGN.md is loaded'),
  ref: z.string().optional().describe('Commit sha to read the repo at. Empty: the default branch, like the bot'),
  current: z.object({ filename: z.string(), html: z.string() }).optional().describe('The current version, if any'),
  approved: z.boolean().default(false).describe('True only on the turn started by the Approve button'),
});

export const turnOutput = z.object({
  reply: z.string(),
  filename: z.string(),
  html: z.string().nullable(),
  changed: z.boolean(),
  calls: z.array(z.string()).describe('Tool calls in order, e.g. read:src/router.tsx, write:16339, check:4/4'),
  scenarios: z.object({ passed: z.number(), failed: z.number() }).nullable(),
  usage: z.object({ inputTokens: z.number().optional(), outputTokens: z.number().optional(), totalTokens: z.number().optional() }),
  ms: z.number(),
});

const turn = createStep({
  id: 'turn',
  inputSchema: turnInput,
  outputSchema: turnOutput,
  execute: async ({ inputData, tracingContext }) => {
    const { request, history, repo, ref, current, approved } = inputData;
    const design = repo ? { repo, ref, guide: await readRepoFile(repo, 'design/DESIGN.md', ref) } : null;
    const state: PrototypeState = {
      filename: current?.filename ?? 'prototype.html',
      html: current?.html ?? null,
      changed: false,
      calls: [],
    };
    const started = Date.now();
    const { text, usage, scenarios } = await runDesignAgent(
      [...history, { role: 'user', content: request }],
      state,
      { design, approved },
      undefined,
      tracingContext,
    );
    return {
      reply: text,
      filename: state.filename,
      html: state.html,
      changed: state.changed,
      calls: state.calls,
      scenarios: scenarios ? { passed: scenarios.passed, failed: scenarios.failed.length } : null,
      usage: usage ?? {},
      ms: Date.now() - started,
    };
  },
});

export const designTurn = createWorkflow({
  id: 'design-turn',
  description: 'One TWD Design turn: a request in, the reply, the prototype and the tool calls out.',
  inputSchema: turnInput,
  outputSchema: turnOutput,
})
  .then(turn)
  .commit();
