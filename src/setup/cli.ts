import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { setupSlack } from './slack.ts';

// npm run setup: walks through the setup and writes .env. Secrets stay on this machine.

const rl = createInterface({ input: stdin, output: stdout });
const terminal = {
  ask: async (question: string, fallback?: string) =>
    (await rl.question(`? ${question}${fallback ? ` (${fallback})` : ''}: `)) || (fallback ?? ''),
  say: (text: string) => console.log(text),
};

try {
  await setupSlack({ ...terminal, envFile: '.env' });
} finally {
  rl.close();
}
