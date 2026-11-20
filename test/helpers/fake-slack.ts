import type { WebClient } from '@slack/web-api';
import type { SlackMessage } from '../../src/slack/thread.ts';

export const BOT = 'UBOT';

/** A WebClient stand-in: serves the thread in pages and records what the bot posts. */
export function fakeSlack(pages: SlackMessage[][], opts: { replies?: () => Promise<void> } = {}) {
  const posted: { method: string; args: any }[] = [];
  const record = (method: string) => async (args: any) => { posted.push({ method, args }); return { ok: true }; };
  const client = {
    conversations: {
      replies: async ({ cursor }: { cursor?: string }) => {
        await opts.replies?.();
        const i = cursor ? Number(cursor) : 0;
        return { messages: pages[i], response_metadata: { next_cursor: i + 1 < pages.length ? String(i + 1) : '' } };
      },
    },
    chat: {
      postMessage: record('chat.postMessage'),
      getPermalink: async () => ({ permalink: 'https://slack.test/archives/C1/p1' }),
    },
    reactions: { add: record('reactions.add'), remove: record('reactions.remove') },
    files: { uploadV2: record('files.uploadV2') },
  };
  return {
    client: client as unknown as WebClient,
    posted,
    texts: () => posted.filter((p) => p.method === 'chat.postMessage').map((p) => p.args.text as string),
  };
}
