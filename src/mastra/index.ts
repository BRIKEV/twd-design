import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { designTurn } from './workflows/design-turn.ts';

// Studio starts from its own folder (src/mastra/public), so look for the project root.
function projectRoot(dir = process.cwd()): string {
  if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'src/agent'))) return dir;
  const up = dirname(dir);
  return up === dir ? process.cwd() : projectRoot(up);
}
const evalsDir = join(projectRoot(), 'evals');
mkdirSync(evalsDir, { recursive: true });

// What Mastra Studio (npm run studio) shows. The Slack bot doesn't use this file.
// Runs, traces and scores are kept in evals/mastra.db (git-ignored), only on this machine.
export const mastra = new Mastra({
  workflows: { designTurn },
  storage: new LibSQLStore({ id: 'evals', url: `file:${join(evalsDir, 'mastra.db')}` }),
  // Traces in Studio: every model call and tool call of a run, with its input, output and tokens.
  // Secrets in spans (tokens, keys) are redacted by default.
  observability: new Observability({
    configs: { default: { serviceName: 'twd-design', exporters: [new MastraStorageExporter()] } },
  }),
});
