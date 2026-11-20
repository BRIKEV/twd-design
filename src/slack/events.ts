import type { WebClient } from '@slack/web-api';
import { postPending } from './actions.ts';
import { welcomeBlocks } from './blocks.ts';
import { loadThread, UI, type SlackMessage } from './thread.ts';
import { handleTurn } from './turn.ts';

// When the bot answers. Kept apart from the Bolt wiring so the rules can be read (and tested) on their own.

type Ctx = { client: WebClient; context: { retryNum?: number } };
export type MentionEvent = { channel: string; ts: string; thread_ts?: string; text?: string };

const GREETING = /^(help|ayuda|hi|hello|hey|hola)?[\s!.?¡¿]*$/i;
const PENDING = /^(pending|pendientes)[\s!.?]*$/i;
export type MessageEvent = SlackMessage & { channel: string; thread_ts?: string; subtype?: string };

/** A mention starts a thread or continues one. */
export async function onMention({ event, client, context }: Ctx & { event: MentionEvent }, botUserId: string) {
  // Slack retries when we're slow to ack (e.g. a cold start): the first delivery is already running.
  if (context.retryNum) return;
  const threadTs = event.thread_ts ?? event.ts;
  const text = (event.text ?? '').replaceAll(`<@${botUserId}>`, '').trim();
  // "hi", "help", or a bare mention that starts a thread: what the bot does, with examples. A bare
  // mention inside a thread means "read this discussion and design it", so that one is a turn.
  if (GREETING.test(text) && (text || !event.thread_ts)) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: 'I turn a request into a clickable HTML prototype. Ask for a screen, reply in the thread to change it, approve it to open a PR.',
      blocks: welcomeBlocks(),
      metadata: { event_type: UI, event_payload: { kind: 'welcome' } },
    });
    return;
  }
  if (PENDING.test(text)) {
    await postPending(client, event.channel, threadTs);
    return;
  }
  await handleTurn({ client, botUserId, channel: event.channel, threadTs, messageTs: event.ts });
}

/** A reply in a thread the bot is already in needs no mention: that's the ping-pong. */
export async function onMessage({ message: m, client, context }: Ctx & { message: MessageEvent }, botUserId: string) {
  if (context.retryNum) return;
  // Edits, deletions, joins… and other bots (including this one) are not requests.
  if (m.subtype || m.bot_id || m.user === botUserId || !m.thread_ts || !m.ts) return;
  if (m.text?.includes(`<@${botUserId}>`)) return; // onMention handles it
  const { botInThread } = await loadThread(client, botUserId, m.channel, m.thread_ts, { withHtml: false });
  if (botInThread) await handleTurn({ client, botUserId, channel: m.channel, threadTs: m.thread_ts, messageTs: m.ts });
}
