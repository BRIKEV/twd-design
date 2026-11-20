import type { WebClient } from '@slack/web-api';
import { config } from '../config.ts';
import { findRepo } from '../github/files.ts';
import type { ChatMessage, PrototypeState } from '../agent/types.ts';

type SlackFile = { name?: string; filetype?: string; url_private_download?: string };
type Metadata = { event_type?: string; event_payload?: Record<string, unknown> };
export type SlackMessage = { user?: string; bot_id?: string; text?: string; ts?: string; files?: SlackFile[]; metadata?: Metadata };

/**
 * Messages the bot posts that are not its turns, told apart by Slack message metadata:
 * - SAID: something a person did with a button (an example, an approval, a repo pick), posted in
 *   their name so the team sees it. It counts as that person's message.
 * - UI: the welcome and the next-steps buttons under each version. Not part of the conversation.
 */
export const SAID = 'twd_said';
export const UI = 'twd_ui';
export type NextSteps = { ts: string; version: number; turn: number };

/**
 * The Slack thread IS the state, so there is no database:
 * - history: the messages, user and bot, in order
 * - prototype: the last .html the bot attached
 * - repo: the last GitHub link someone pasted (or picked)
 * - versions: every .html the bot attached, and the buttons under the latest one
 */
export async function loadThread(
  client: WebClient,
  botUserId: string,
  channel: string,
  threadTs: string,
  { withHtml = true } = {},
) {
  const messages = await fetchReplies(client, channel, threadTs);

  const history: ChatMessage[] = [];
  const userTexts: string[] = [];
  const versions: SlackFile[] = [];
  let nextSteps: NextSteps | undefined;
  let botTurns = 0;
  let botInThread = false;
  for (const m of messages) {
    const meta = m.metadata?.event_type;
    if (m.user === botUserId && meta === SAID) {
      const text = (m.text ?? '').replace(/^<@\w+>:\s*/, '');
      userTexts.push(text);
      history.push({ role: 'user', content: text });
    } else if (m.user === botUserId && meta === UI) {
      botInThread = true;
      const p = m.metadata!.event_payload ?? {};
      if (p.kind === 'next_steps' && m.ts) nextSteps = { ts: m.ts, version: Number(p.version), turn: Number(p.turn) };
    } else if (m.user === botUserId) {
      botTurns++;
      botInThread = true;
      const html = m.files?.find((f) => f.filetype === 'html' || f.name?.endsWith('.html'));
      if (html) versions.push(html);
      if (m.text) history.push({ role: 'assistant', content: m.text });
    } else if (!m.bot_id) {
      const text = (m.text ?? '').replaceAll(`<@${botUserId}>`, '').trim();
      userTexts.push(text);
      if (text) history.push({ role: 'user', content: text });
    }
  }

  const lastHtml = versions.at(-1);
  const state: PrototypeState = { filename: lastHtml?.name ?? 'prototype.html', html: null, changed: false, calls: [] };
  if (withHtml && lastHtml?.url_private_download) state.html = await downloadFile(lastHtml.url_private_download);

  return { history, state, botTurns, botInThread, repo: findRepo(userTexts), versions, nextSteps };
}

async function fetchReplies(client: WebClient, channel: string, threadTs: string) {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.conversations.replies({ channel, ts: threadTs, cursor, limit: 200, include_all_metadata: true });
    messages.push(...((res.messages ?? []) as SlackMessage[]));
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return messages;
}

export async function downloadFile(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.slack.botToken}` } });
  return res.ok ? res.text() : null;
}
