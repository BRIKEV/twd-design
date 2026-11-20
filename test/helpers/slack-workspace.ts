import type { WebClient } from '@slack/web-api';
import { onMention, onMessage } from '../../src/slack/events.ts';
import type { SlackMessage } from '../../src/slack/thread.ts';
import type { FakeNet } from './fake-fetch.ts';

export const BOT = 'U_BOT';
const CHANNEL = 'C_DESIGN';

type Message = SlackMessage & { ts: string; thread_ts: string; html?: string };

/**
 * A Slack channel that behaves like the real one for the bot: people post, the bot's replies and
 * uploads land in the same thread, uploaded files can be downloaded, and the thread is read back
 * in pages of 3 (so every story also crosses pagination).
 */
export function slackWorkspace(net: FakeNet) {
  const threads = new Map<string, Message[]>();
  const reactions: string[] = [];
  let clock = 1000;
  let holdNext: Promise<void> | undefined; // armed by holdNextTurn()
  let armed: Promise<void> | undefined; // taken by the next thread read inside a turn
  let failNextRead: string | undefined;

  const append = (threadTs: string, m: Omit<Message, 'ts' | 'thread_ts'>) => {
    const ts = `${clock++}.000`;
    const msg: Message = { ...m, ts, thread_ts: threadTs || ts };
    const key = threadTs || ts;
    threads.set(key, [...(threads.get(key) ?? []), msg]);
    return msg;
  };

  const client = {
    conversations: {
      replies: async ({ ts, cursor }: { ts: string; cursor?: string }) => {
        if (armed) { const gate = armed; armed = undefined; await gate; }
        if (failNextRead) { const e = failNextRead; failNextRead = undefined; throw new Error(e); }
        const all = threads.get(ts) ?? [];
        const from = cursor ? Number(cursor) : 0;
        const next = from + 3 < all.length ? String(from + 3) : '';
        return { messages: all.slice(from, from + 3), response_metadata: { next_cursor: next } };
      },
    },
    chat: {
      postMessage: async ({ thread_ts, text }: any) => { append(thread_ts, { user: BOT, bot_id: 'B_BOT', text }); return { ok: true }; },
      getPermalink: async ({ message_ts }: any) => ({ permalink: `https://acme.slack.com/archives/${CHANNEL}/p${message_ts.replace('.', '')}` }),
    },
    files: {
      uploadV2: async ({ thread_ts, filename, content, initial_comment }: any) => {
        const url = `https://files.slack.test/${clock}/${filename}`;
        net.routes[`GET ${url}`] = () => new Response(content);
        append(thread_ts, { user: BOT, bot_id: 'B_BOT', text: initial_comment, html: content, files: [{ name: filename, filetype: 'html', url_private_download: url }] });
        return { ok: true };
      },
    },
    reactions: {
      // The hourglass marks the start of a turn: that turn's read of the thread is the one held.
      add: async ({ name }: any) => { reactions.push(`+${name}`); armed = holdNext; holdNext = undefined; return { ok: true }; },
      remove: async ({ name }: any) => { reactions.push(`-${name}`); return { ok: true }; },
    },
  } as unknown as WebClient;

  /** Someone posts. Slack delivers it to the bot as app_mention (if it mentions the bot) and as a message. */
  async function post(user: string, text: string, { thread, retry = 0, subtype, botId }: { thread?: Message; retry?: number; subtype?: string; botId?: string } = {}) {
    const msg = append(thread?.thread_ts ?? '', { user, text, bot_id: botId });
    const context = { retryNum: retry || undefined };
    const event = { ...msg, channel: CHANNEL, thread_ts: thread ? msg.thread_ts : undefined, subtype };
    if (text.includes(`<@${BOT}>`)) await onMention({ event, client, context }, BOT);
    await onMessage({ message: event, client, context }, BOT);
    return msg;
  }

  const thread = (root: Message) => threads.get(root.thread_ts) ?? [];
  const botReplies = (root: Message) => thread(root).filter((m) => m.user === BOT);

  return {
    client,
    reactions,
    post,
    thread,
    botReplies,
    lastReply: (root: Message) => botReplies(root).at(-1),
    /** The prototype versions the bot attached to the thread, oldest first. */
    versions: (root: Message) => botReplies(root).filter((m) => m.html).map((m) => ({ name: m.files![0].name!, html: m.html! })),
    /** The next turn stalls (a slow model or Slack) until the returned function is called. */
    holdNextTurn: () => { let release!: () => void; holdNext = new Promise((r) => { release = r; }); return () => release(); },
    failNextRead: (error: string) => { failNextRead = error; },
    mention: (text: string) => `<@${BOT}> ${text}`,
  };
}
