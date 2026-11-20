import bolt from '@slack/bolt';
import { config, socketMode } from '../config.ts';
import { boltLogger } from '../log.ts';
import { onMention, onMessage, type MessageEvent } from './events.ts';
import { isAccepting } from './turn.ts';

const { App } = bolt;

/** The Bolt app with its two entry points (events.ts): mentions, and replies in threads the bot is already in. */
export function createSlackApp(getBotUserId: () => string) {
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    appToken: config.slack.appToken,
    socketMode,
    logger: boltLogger(),
    // /healthz for Docker/Kubernetes/Render health checks. In Socket Mode Bolt starts a small HTTP
    // server on this port just for custom routes; in HTTP mode it shares the events server.
    port: config.port,
    installerOptions: { port: config.port },
    customRoutes: [{
      path: '/healthz',
      method: ['GET'],
      handler: (_req, res) => {
        const ok = isAccepting();
        res.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: ok ? 'ok' : 'shutting_down' }));
      },
    }],
  });

  app.event('app_mention', ({ event, client, context }) => onMention({ event, client, context }, getBotUserId()));
  app.message(({ message, client, context }) =>
    onMessage({ message: message as MessageEvent, client, context }, getBotUserId()));

  return app;
}
