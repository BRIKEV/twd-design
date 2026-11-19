import { config, configErrors, socketMode } from './config.ts';
import { errorFields, log } from './log.ts';
import { createSlackApp } from './slack/app.ts';
import { drainTurns } from './slack/turn.ts';

const errors = configErrors();
if (errors.length) {
  for (const e of errors) log.error('config', { problem: e });
  log.error('Not starting: fix the configuration above. See docs/reference/configuration.md');
  process.exit(1);
}

let botUserId = '';
const app = createSlackApp(() => botUserId);

try {
  const auth = await app.client.auth.test();
  botUserId = auth.user_id as string;
} catch (err) {
  log.error('Slack rejected SLACK_BOT_TOKEN (auth.test failed). Check the token and that the app is installed.', errorFields(err));
  process.exit(1);
}

await app.start(config.port);
log.info('ready', {
  bot: botUserId,
  mode: socketMode ? 'socket' : 'http',
  port: config.port,
  model: config.model.id,
  github: config.github.enabled,
});

// Graceful shutdown: stop taking turns, let running ones finish, then exit.
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    log.info('shutting down', { signal, timeoutMs: config.shutdownTimeoutMs });
    const unfinished = await drainTurns(config.shutdownTimeoutMs);
    if (unfinished) log.warn('exiting with turns still running', { unfinished });
    await app.stop().catch(() => {});
    process.exit(0);
  });
}
