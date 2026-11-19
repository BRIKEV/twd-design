import bolt from '@slack/bolt';
import { config, socketMode } from '../config.ts';
import { boltLogger } from '../log.ts';
import { loadThread, type SlackMessage } from './thread.ts';
import { handleTurn, isAccepting } from './turn.ts';

const { App } = bolt;

/** The Bolt app with its two entry points: mentions, and replies in threads the bot is already in. */
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

  // Mentions start a thread or continue one.
  app.event('app_mention', async ({ event, client, context }) => {
    // Slack retries when we're slow to ack (e.g. a cold start): the first delivery is already running.
    if (context.retryNum) return;
    const threadTs = event.thread_ts ?? event.ts;
    await handleTurn({ client, botUserId: getBotUserId(), channel: event.channel, threadTs, messageTs: event.ts });
  });

  // Replies in a thread the bot is already in don't need a mention: that's the ping-pong.
  app.message(async ({ message, client, context }) => {
    if (context.retryNum) return;
    const m = message as SlackMessage & { channel: string; thread_ts?: string; subtype?: string };
    if (m.subtype || m.bot_id || !m.thread_ts || !m.ts) return;
    const botUserId = getBotUserId();
    if (m.text?.includes(`<@${botUserId}>`)) return; // app_mention handles it
    const { botInThread } = await loadThread(client, botUserId, m.channel, m.thread_ts, { withHtml: false });
    if (botInThread) await handleTurn({ client, botUserId, channel: m.channel, threadTs: m.thread_ts, messageTs: m.ts });
  });

  return app;
}
