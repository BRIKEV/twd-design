import bolt from '@slack/bolt';
import { config, socketMode } from '../config.ts';
import { boltLogger } from '../log.ts';
import { onAction, onHomeOpened, onStop, onViewSubmission, type ActionBody, type ViewBody } from './actions.ts';
import { onMention } from './events.ts';
import { isAccepting } from './turn.ts';

const { App } = bolt;

/**
 * The Bolt app. Conversation (events.ts): mentions only.
 * Buttons, the repo modal, Slack's Stop button and the Home tab (actions.ts).
 */
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

  // Slack wants every click and submit acknowledged within 3 seconds; the work happens after.
  app.action(/^twd_/, async ({ ack, body, client }) => {
    await ack();
    await onAction({ body: body as unknown as ActionBody, client }, getBotUserId());
  });
  app.view('twd_pick_repo', async ({ ack, body, client }) => {
    await ack();
    await onViewSubmission({ body: body as unknown as ViewBody, client }, getBotUserId());
  });
  app.event('app_home_opened', ({ event, client }) => onHomeOpened({ event, client }));
  // Not in Bolt's event types yet.
  app.event('agent_session_stopped' as 'app_home_opened', ({ event }) =>
    onStop({ event: event as unknown as { channel: string; thread_ts: string; user: string } }));

  return app;
}
