import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { setupGithub } from './github.ts';
import { setupSlack } from './slack.ts';

// npm run setup             → Slack app, then GitHub App
// npm run setup -- slack    → only the Slack app
// npm run setup -- github   → only the GitHub App
// Writes .env in this folder. Secrets stay on this machine.

const step = argv[2];
const rl = createInterface({ input: stdin, output: stdout });
const terminal = {
  ask: async (question: string, fallback?: string) =>
    (await rl.question(`? ${question}${fallback ? ` (${fallback})` : ''}: `)) || (fallback ?? ''),
  say: (text: string) => console.log(text),
};
const envFile = '.env';

try {
  let name = 'TWD Design';
  if (step !== 'github') ({ name } = await setupSlack({ ...terminal, envFile }));
  if (step !== 'slack') {
    const go = step === 'github' || !/^n/i.test(await terminal.ask('Set up the GitHub App now? It reads your design guide and opens PRs [Y/n]', 'Y'));
    if (go) await setupGithub({ ...terminal, envFile, defaultName: name });
  }
  console.log('\nNext: choose a model and add its API key to .env (docs/setup/models.md), then docker compose up -d.');
} finally {
  rl.close();
}
