import { createScorer, notScorable } from '@mastra/core/evals';
import type { EvalCase } from './dataset.ts';

// Code scorers: they read the turn's output (calls, usage, ms), no judge model. Each one returns
// notScorable() when it doesn't apply, so it stays out of that scorer's average.

type TurnOutput = {
  changed: boolean;
  calls: string[];
  usage: { inputTokens?: number; outputTokens?: number };
  ms: number;
};
type Run = { output?: TurnOutput; groundTruth?: Pick<EvalCase, 'kind' | 'existing'> };

/** The scenario checks of the turn, in order: "check:3/6" → { passed: 3, total: 6 }. */
export function checksOf(output: TurnOutput) {
  return output.calls
    .filter((c) => c.startsWith('check:'))
    .map((c) => {
      const [passed, total] = c.slice('check:'.length).split('/').map(Number);
      return { passed, total, green: passed === total };
    });
}

const versionChecks = ({ run }: { run: Run }) => {
  if (!run.output) return notScorable('the turn failed');
  const checks = checksOf(run.output);
  return checks.length ? { checks } : notScorable('no new version was checked');
};

export const firstCheckGreen = createScorer({
  id: 'first-check-green',
  description: 'The first scenario check of a new version passes entirely (1) or not (0).',
})
  .preprocess(versionChecks)
  .generateScore(({ results }) => (results.preprocessStepResult.checks[0].green ? 1 : 0));

export const endsGreen = createScorer({
  id: 'ends-green',
  description: 'The version posted to Slack has every scenario passing (1) or not (0).',
})
  .preprocess(versionChecks)
  .generateScore(({ results }) => (results.preprocessStepResult.checks.at(-1)!.green ? 1 : 0));

export const fixRounds = createScorer({
  id: 'fix-rounds',
  description: 'Fix rounds after the first check (0 is best, 2 is the most the bot allows).',
})
  .preprocess(versionChecks)
  .generateScore(({ results }) => results.preprocessStepResult.checks.length - 1);

export const noVersionForQuestion = createScorer({
  id: 'no-version-for-question',
  description: 'A question gets an answer without a new version (1) or a new version anyway (0).',
})
  .preprocess(({ run }: { run: Run }) =>
    run.groundTruth?.kind === 'question' && run.output ? { changed: run.output.changed } : notScorable('not a question'))
  .generateScore(({ results }) => (results.preprocessStepResult.changed ? 0 : 1));

// A prototype invented without reading the screen's code is simpler and passes its checks more easily: it
// would look like a win. When the request changes an existing screen, the code must be read first.
export const readTheCode = createScorer({
  id: 'read-the-code',
  description: 'On a change to an existing screen, the repo code was read before the first version (1) or not (0).',
})
  .preprocess(({ run }: { run: Run }) => {
    if (!run.groundTruth?.existing) return notScorable('not a change to an existing screen');
    if (!run.output) return notScorable('the turn failed');
    const firstWrite = run.output.calls.findIndex((c) => c.startsWith('write:') || c.startsWith('plan:'));
    const before = firstWrite === -1 ? run.output.calls : run.output.calls.slice(0, firstWrite);
    return { read: before.some((c) => c.startsWith('read:')) };
  })
  .generateScore(({ results }) => (results.preprocessStepResult.read ? 1 : 0));

export const seconds = createScorer({
  id: 'seconds',
  description: 'Wall time of the turn, in seconds.',
})
  .preprocess(({ run }: { run: Run }) => (run.output ? { ms: run.output.ms } : notScorable('the turn failed')))
  .generateScore(({ results }) => Math.round(results.preprocessStepResult.ms / 100) / 10);

export const inputKTokens = createScorer({
  id: 'input-ktokens',
  description: 'Input tokens of the turn, in thousands (most of them are usually cached).',
})
  .preprocess(({ run }: { run: Run }) => (run.output ? { tokens: run.output.usage.inputTokens ?? 0 } : notScorable('the turn failed')))
  .generateScore(({ results }) => Math.round(results.preprocessStepResult.tokens / 100) / 10);

export const SCORERS = [firstCheckGreen, endsGreen, fixRounds, readTheCode, noVersionForQuestion, seconds, inputKTokens];
