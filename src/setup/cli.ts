import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { setupGithub } from './github.ts';
import { setupModel } from './model.ts';
import { setupSlack } from './slack.ts';

// npm run setup             → Slack app, GitHub App, model
// npm run setup -- slack    → only the Slack app
// npm run setup -- github   → only the GitHub App
// npm run setup -- model    → only the model and its key
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
  const all = !step;
  let name = 'TWD Design';
  if (all || step === 'slack') ({ name } = await setupSlack({ ...terminal, envFile }));
  if (step === 'github' || (all && !/^n/i.test(await terminal.ask('Set up the GitHub App now? It reads your design guide and opens PRs [Y/n]', 'Y')))) {
    await setupGithub({ ...terminal, envFile, defaultName: name });
  }
  if (all || step === 'model') await setupModel({ ...terminal, envFile });
  console.log(all || step === 'model'
    ? '\n.env is ready. Run it here with npm run dev, on a server with docker compose up -d, or on Render,\nFly.io, Railway or Kubernetes by importing this .env: docs/install/'
    : '\nSaved to .env.');
} finally {
  rl.close();
}
