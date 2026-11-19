import type { WebClient } from '@slack/web-api';
import { config } from '../config.ts';
import { findRepo } from '../github/files.ts';
import type { ChatMessage, PrototypeState } from '../agent/types.ts';

type SlackFile = { name?: string; filetype?: string; url_private_download?: string };
export type SlackMessage = { user?: string; bot_id?: string; text?: string; ts?: string; files?: SlackFile[] };

/**
 * The Slack thread IS the state, so there is no database:
 * - history: the messages, user and bot, in order
 * - prototype: the last .html the bot attached
 * - repo: the last GitHub link someone pasted
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
  let lastHtml: SlackFile | undefined;
  let botTurns = 0;
  for (const m of messages) {
    if (m.user === botUserId) {
      botTurns++;
      const html = m.files?.find((f) => f.filetype === 'html' || f.name?.endsWith('.html'));
      if (html) lastHtml = html;
      if (m.text) history.push({ role: 'assistant', content: m.text });
    } else if (!m.bot_id) {
      const text = (m.text ?? '').replaceAll(`<@${botUserId}>`, '').trim();
      userTexts.push(text);
      if (text) history.push({ role: 'user', content: text });
    }
  }

  const state: PrototypeState = { filename: lastHtml?.name ?? 'prototype.html', html: null, changed: false, calls: [] };
  if (withHtml && lastHtml?.url_private_download) state.html = await downloadFile(lastHtml.url_private_download);

  return { history, state, botTurns, botInThread: botTurns > 0, repo: findRepo(userTexts) };
}

async function fetchReplies(client: WebClient, channel: string, threadTs: string) {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const res = await client.conversations.replies({ channel, ts: threadTs, cursor, limit: 200 });
    messages.push(...((res.messages ?? []) as SlackMessage[]));
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return messages;
}

async function downloadFile(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${config.slack.botToken}` } });
  return res.ok ? res.text() : null;
}
