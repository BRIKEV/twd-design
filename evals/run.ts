// npm run evals -- --label vue-screens [--repeat 3] [--cases coupon,question]
//
// Runs every case of the dataset through one bot turn (the design-turn workflow) with the real model, the
// real GitHub reads at the pinned commit and the real scenario check, and scores each run. It calls a paid
// model: it is not part of npm test or CI. The model and switches come from the environment (MODEL,
// SCREENS_STEP...), so pass the env file: node --env-file=.env evals/run.ts.

import { execSync } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runEvals } from '@mastra/core/evals';
import { config } from '../src/config.ts';
import { closeBrowser } from '../src/prototype/scenarios.ts';
import { mastra } from '../src/mastra/index.ts';
import { CASES, REPO } from './dataset.ts';
import { checksOf, SCORERS } from './scorers.ts';

const { values } = parseArgs({
  options: {
    label: { type: 'string', default: 'run' },
    repeat: { type: 'string', default: '1' },
    cases: { type: 'string' },
  },
});
const repeat = Number(values.repeat);
const picked = values.cases ? CASES.filter((c) => values.cases!.split(',').includes(c.id)) : CASES;
const data = picked.flatMap((c) =>
  Array.from({ length: repeat }, () => ({
    input: { request: c.request, history: [], ...REPO, approved: false },
    groundTruth: { id: c.id, kind: c.kind },
  })));

const dir = join(import.meta.dirname, 'reports');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = join(dir, `${stamp}-${values.label}.jsonl`);

const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: import.meta.dirname }).toString().trim();
const variant = { label: values.label, branch, model: config.model.id, SCREENS_STEP: process.env.SCREENS_STEP ?? 'on', scenarioCheck: config.scenarioCheck };
console.log(`${data.length} runs · ${JSON.stringify(variant)}\n→ ${file}\n`);

type Row = { id: string; calls: string[]; scores: Record<string, number | null>; error?: string };
const rows: Row[] = [];
let n = 0;

const result = await runEvals({
  target: mastra.getWorkflow('designTurn'),
  data,
  scorers: SCORERS,
  concurrency: 1,
  onItemComplete: ({ item, targetResult, scorerResults }) => {
    n++;
    // runEvals hands over its own wrapper: the workflow's result is in scoringData.output.
    const output = (targetResult as unknown as { scoringData?: { output?: any } }).scoringData?.output;
    const scores = Object.fromEntries(Object.entries(scorerResults as Record<string, { score?: number }>)
      .map(([id, r]) => [id, typeof r?.score === 'number' ? r.score : null]));
    const row: Row = {
      id: item.groundTruth.id,
      calls: output?.calls ?? [],
      scores,
      ...(output ? {} : { error: 'the turn failed (see the trace in Studio)' }),
    };
    rows.push(row);
    appendFileSync(file, `${JSON.stringify({ ...variant, ...row, html: output?.html ?? null, reply: output?.reply ?? null })}\n`);
    const checks = output ? checksOf(output).map((c) => `${c.passed}/${c.total}`).join(' → ') : row.error;
    console.log(`[${n}/${data.length}] ${row.id.padEnd(12)} ${checks || 'no version'} · ${scores.seconds ?? '-'} s · ${scores['input-ktokens'] ?? '-'}k in`);
  },
});
await closeBrowser();

// Per case and overall: the average of each scorer over the runs where it applied.
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
};
const ids = SCORERS.map((s) => s.id);
const table = [...picked.map((c) => c.id), 'ALL'].map((id) => {
  const mine = id === 'ALL' ? rows : rows.filter((r) => r.id === id);
  return { case: id, runs: mine.length, ...Object.fromEntries(ids.map((s) => [s, avg(mine.map((r) => r.scores[s] ?? null))])) };
});
console.log('');
console.table(table);
writeFileSync(file.replace(/\.jsonl$/, '.summary.json'), JSON.stringify({ ...variant, table, runEvals: result }, null, 2));
process.exit(0);
