import type { WebClient } from '@slack/web-api';
import { onAction, onHomeOpened, onStop, onViewSubmission } from '../../src/slack/actions.ts';
import { onMention, onMessage } from '../../src/slack/events.ts';
import type { SlackMessage } from '../../src/slack/thread.ts';
import type { FakeNet } from './fake-fetch.ts';

export const BOT = 'U_BOT';
const CHANNEL = 'C_DESIGN';

type Block = { type: string; [k: string]: any };
type Message = SlackMessage & { ts: string; thread_ts: string; html?: string; blocks?: Block[] };
type View = { id: string; type: string; callback_id?: string; title?: any; blocks: Block[]; private_metadata?: string; [k: string]: any };

/** Every piece of text in some blocks, flattened: what a person reads. */
function blockText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return '';
  if (Array.isArray(node)) return node.map(blockText).filter(Boolean).join('\n');
  const o = node as Record<string, unknown>;
  const own = typeof o.text === 'string' ? o.text : '';
  const nested = Object.entries(o).filter(([k]) => k !== 'text' || typeof o.text !== 'string').map(([, v]) => blockText(v));
  return [own, ...nested].filter(Boolean).join('\n');
}

/** The buttons in some blocks, wherever they are. */
function buttonsIn(node: unknown): any[] {
  if (node == null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(buttonsIn);
  const o = node as Record<string, any>;
  return [...(o.type === 'button' ? [o] : []), ...Object.values(o).flatMap(buttonsIn)];
}

/**
 * A Slack channel that behaves like the real one for the bot: people post, click buttons, fill in
 * modals, stop the bot and open its Home tab. The bot's replies and uploads land in the same thread,
 * uploaded files can be downloaded, and the thread is read back in pages of 3 (so every story also
 * crosses pagination).
 */
export function slackWorkspace(net: FakeNet) {
  const threads = new Map<string, Message[]>();
  const reactions: string[] = [];
  const statuses: string[] = [];
  const ephemerals: { user: string; text: string }[] = [];
  const homes = new Map<string, View>();
  let modal: View | undefined;
  let views = 0;
  let clock = 1000;
  let agentSessions = true;
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
  const find = (ts: string) => [...threads.values()].flat().find((m) => m.ts === ts);
  const workingStarted = () => { armed = holdNext; holdNext = undefined; };

  const client = {
    conversations: {
      replies: async ({ ts, cursor, include_all_metadata }: { ts: string; cursor?: string; include_all_metadata?: boolean }) => {
        if (armed) { const gate = armed; armed = undefined; await gate; }
        if (failNextRead) { const e = failNextRead; failNextRead = undefined; throw new Error(e); }
        const all = threads.get(ts) ?? [];
        const from = cursor ? Number(cursor) : 0;
        const next = from + 3 < all.length ? String(from + 3) : '';
        // Like Slack: message metadata only comes back when asked for.
        const page = all.slice(from, from + 3).map((m) => (include_all_metadata ? m : { ...m, metadata: undefined }));
        return { messages: page, response_metadata: { next_cursor: next } };
      },
    },
    chat: {
      postMessage: async ({ thread_ts, text, blocks, metadata }: any) => {
        const m = append(thread_ts, { user: BOT, bot_id: 'B_BOT', text, blocks, metadata });
        return { ok: true, ts: m.ts };
      },
      update: async ({ ts, text, blocks }: any) => {
        const m = find(ts);
        if (!m) throw new Error(`message_not_found ${ts}`);
        Object.assign(m, { text, blocks });
        return { ok: true };
      },
      postEphemeral: async ({ user, text }: any) => { ephemerals.push({ user, text }); return { ok: true }; },
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
    agents: {
      sessions: {
        // Slack's own "working… Stop" indicator. The start of a turn: that turn's read of the thread is the one held.
        setStatus: async ({ status }: any) => {
          if (!agentSessions) throw new Error('An API error occurred: feature_disabled');
          statuses.push(status);
          if (status === 'processing') workingStarted();
          return { ok: true };
        },
      },
    },
    reactions: {
      add: async ({ name }: any) => { reactions.push(`+${name}`); workingStarted(); return { ok: true }; },
      remove: async ({ name }: any) => { reactions.push(`-${name}`); return { ok: true }; },
    },
    views: {
      open: async ({ view }: any) => { modal = { ...view, id: `V${++views}` }; return { ok: true, view: modal }; },
      update: async ({ view_id, view }: any) => {
        if (modal?.id !== view_id) throw new Error('not_found');
        modal = { ...view, id: view_id };
        return { ok: true, view: modal };
      },
      publish: async ({ user_id, view }: any) => { homes.set(user_id, { ...view, id: `H${user_id}` }); return { ok: true }; },
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

  /**
   * Someone clicks the button with this label on a message. Fails if the message has no such button.
   * `asSeen` clicks on a copy of the message taken earlier: a screen that hasn't refreshed yet.
   */
  async function click(user: string, message: Message, label: string, { asSeen = false } = {}) {
    const current = asSeen ? message : (find(message.ts) ?? message);
    const button = buttonsIn(current.blocks).find((b) => b.text?.text === label);
    if (!button) throw new Error(`No "${label}" button. Buttons: ${JSON.stringify(buttonsIn(current.blocks).map((b) => b.text?.text))}`);
    const body = {
      user: { id: user },
      trigger_id: `trigger-${clock}`,
      channel: { id: CHANNEL },
      message: { ts: current.ts, thread_ts: current.thread_ts },
      actions: [{ action_id: button.action_id, value: button.value }],
    };
    await onAction({ body, client }, BOT);
  }

  /** The open modal: its options, as people see them. */
  const options = (view: View | undefined = modal) =>
    (view?.blocks ?? []).flatMap((b) => b.element?.options ?? []).map((o: any) => o.value as string);

  /** Someone picks an option in the open modal and submits it. */
  async function submit(user: string, value: string) {
    if (!modal) throw new Error('No modal is open');
    const input = modal.blocks.find((b) => b.type === 'input');
    if (!input) throw new Error(`The modal has nothing to submit: ${blockText(modal.blocks)}`);
    const view = { ...modal, private_metadata: modal.private_metadata ?? '', state: { values: { [input.block_id]: { [input.element.action_id]: { selected_option: { value } } } } } };
    modal = undefined;
    await onViewSubmission({ body: { user: { id: user }, view }, client }, BOT);
  }

  const thread = (root: Message) => threads.get(root.thread_ts) ?? [];
  const botReplies = (root: Message) => thread(root).filter((m) => m.user === BOT);

  return {
    client,
    reactions,
    statuses,
    ephemerals,
    post,
    click,
    submit,
    thread,
    botReplies,
    lastReply: (root: Message) => botReplies(root).at(-1),
    /** The prototype versions the bot attached to the thread, oldest first. */
    versions: (root: Message) => botReplies(root).filter((m) => m.html).map((m) => ({ name: m.files![0].name!, html: m.html! })),
    /** What a message says, its blocks included. */
    textOf: (m: Message | View | undefined) => [m && 'text' in m && typeof m.text === 'string' ? m.text : '', blockText(m?.blocks)].filter(Boolean).join('\n'),
    buttons: (m: Message | View | undefined) => buttonsIn(m?.blocks).map((b) => b.text?.text as string),
    /** The url a link button opens. */
    linkOf: (m: Message | View | undefined, label: string) => buttonsIn(m?.blocks).find((b) => b.text?.text === label)?.url as string | undefined,
    modal: () => modal,
    options,
    home: (user: string) => homes.get(user),
    openHome: (user: string) => onHomeOpened({ event: { user, tab: 'home' }, client }),
    /** Someone clicks Slack's own Stop button while the bot works on this thread. */
    stop: (user: string, root: Message) => onStop({ event: { channel: CHANNEL, thread_ts: root.thread_ts, user } }),
    /** A workspace where agent sessions are not available: the bot falls back to a reaction. */
    withoutAgentSessions: () => { agentSessions = false; },
    /** The next turn stalls (a slow model or Slack) until the returned function is called. */
    holdNextTurn: () => { let release!: () => void; holdNext = new Promise((r) => { release = r; }); return () => release(); },
    failNextRead: (error: string) => { failNextRead = error; },
    mention: (text: string) => `<@${BOT}> ${text}`,
  };
}
