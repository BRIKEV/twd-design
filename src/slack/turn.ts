import type { WebClient } from '@slack/web-api';
import { config } from '../config.ts';
import { runDesignAgent } from '../agent/agent.ts';
import type { DesignContext } from '../agent/types.ts';
import { AppNotInstalledError } from '../github/client.ts';
import { readRepoFile } from '../github/files.ts';
import { errorFields, log } from '../log.ts';
import { nextStepsBlocks, replacedBlocks } from './blocks.ts';
import { loadThread, UI, type NextSteps } from './thread.ts';

// In-memory only: avoids two runs on the same thread at once, lets someone stop a running turn,
// and lets shutdown wait for running turns.
const running = new Map<string, AbortController>();
let accepting = true;

/** Stop starting new turns and resolve when the running ones finish (or the timeout passes). */
export async function drainTurns(timeoutMs: number) {
  accepting = false;
  const deadline = Date.now() + timeoutMs;
  while (running.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  return running.size;
}

export const isAccepting = () => accepting;
export const isBusy = (channel: string, threadTs: string) => running.has(`${channel}:${threadTs}`);

/** Someone pressed Stop: the running turn on that thread ends without posting its version. */
export function stopTurn(channel: string, threadTs: string, user: string) {
  running.get(`${channel}:${threadTs}`)?.abort({ user });
}

type Turn = { client: WebClient; botUserId: string; channel: string; threadTs: string; messageTs: string; approved?: boolean };

/**
 * Shows that the bot is working, with the best Slack offers:
 * 1. agent sessions: Slack's indicator with its Stop button (apps declared as agents);
 * 2. the older assistant status, "is working…" under the thread;
 * 3. an hourglass reaction on the message.
 */
async function showWorking(client: WebClient, channel: string, threadTs: string, messageTs: string) {
  const session = (s: 'processing' | 'active') => client.agents.sessions.setStatus({ channel_id: channel, thread_ts: threadTs, status: s });
  try {
    await session('processing');
    return () => session('active').catch(() => {});
  } catch { /* not an agent: try the next one */ }

  const status = (s: string) => client.assistant.threads.setStatus({ channel_id: channel, thread_ts: threadTs, status: s });
  try {
    await status('is working on it…');
    return () => status('').catch(() => {});
  } catch {
    const reaction = { channel, timestamp: messageTs, name: 'hourglass_flowing_sand' };
    await client.reactions.add(reaction).catch(() => {});
    return () => client.reactions.remove(reaction).catch(() => {});
  }
}

type NewVersion = {
  channel: string;
  threadTs: string;
  filename: string;
  html: string;
  comment: string;
  version: number;
  turn: number;
  repo: string | null;
  previous?: NextSteps;
};

/** Posts a version with the buttons under it, and takes the buttons off the one it replaces. */
export async function postVersion(client: WebClient, v: NewVersion) {
  await client.files.uploadV2({
    channel_id: v.channel,
    thread_ts: v.threadTs,
    filename: v.filename,
    title: v.filename,
    content: v.html,
    initial_comment: v.comment,
  });
  if (v.previous) {
    await client.chat
      .update({ channel: v.channel, ts: v.previous.ts, text: `v${v.previous.version}: replaced by v${v.version}`, blocks: replacedBlocks(v.previous.version, v.version) })
      .catch((err) => log.warn('could not update the previous buttons', errorFields(err)));
  }
  await client.chat.postMessage({
    channel: v.channel,
    thread_ts: v.threadTs,
    text: `v${v.version}: approve it, or mention me in the thread to change it`,
    blocks: nextStepsBlocks({ version: v.version, turn: v.turn, maxTurns: config.maxTurnsPerThread, repo: v.repo, github: config.github.enabled }),
    metadata: { event_type: UI, event_payload: { kind: 'next_steps', version: v.version, turn: v.turn } },
  });
}

/** One bot turn: read the thread, run the agent, post the new version (or the answer) in the thread. */
export async function handleTurn({ client, botUserId, channel, threadTs, messageTs, approved }: Turn) {
  const say = (text: string) => client.chat.postMessage({ channel, thread_ts: threadTs, text });
  const key = `${channel}:${threadTs}`;
  if (!accepting) {
    await say('Restarting right now, ask again in a minute.');
    return;
  }
  if (running.has(key)) {
    await say('Still working on the previous version, give me a moment.');
    return;
  }
  const stop = new AbortController();
  running.set(key, stop);
  const doneWorking = await showWorking(client, channel, threadTs, messageTs);

  try {
    const { history, state, botTurns, repo, versions, nextSteps } = await loadThread(client, botUserId, channel, threadTs);
    if (botTurns >= config.maxTurnsPerThread) {
      await say(`This thread hit the ${config.maxTurnsPerThread}-turn limit. Start a new thread to keep going.`);
      return;
    }

    let design: DesignContext = null;
    if (repo && config.github.enabled) {
      try {
        design = { repo, guide: await readRepoFile(repo, 'design/DESIGN.md') };
      } catch (err) {
        if (!(err instanceof AppNotInstalledError)) throw err;
        await say(`I can't read *${repo}*: the GitHub App isn't installed there. <${err.installUrl}|Install it on that repo> and ask again.`);
        return;
      }
    }

    const threadUrl = await client.chat
      .getPermalink({ channel, message_ts: threadTs })
      .then((r) => r.permalink)
      .catch(() => undefined);

    const started = Date.now();
    const { text, usage, scenarios } = await runDesignAgent(history, state, { design, threadUrl, approved }, stop.signal);
    log.info('turn', {
      thread: key,
      turn: botTurns + 1,
      repo,
      designGuide: design?.guide?.length ?? null,
      ms: Date.now() - started,
      calls: state.calls,
      pr: state.pr?.url,
      changed: state.changed,
      bytes: state.html?.length,
      stopped: stop.signal.aborted || undefined,
      usage,
    });

    if (stop.signal.aborted) {
      const { user } = stop.signal.reason as { user: string };
      await say(`Stopped by <@${user}>. ${versions.length ? `v${versions.length} is still the current version.` : 'Nothing was posted.'}`);
      return;
    }

    const reply = text?.trim() || 'Done.';
    if (state.changed && state.html) {
      const total = scenarios ? scenarios.passed + scenarios.failed.length : 0;
      const checked = !scenarios ? ''
        : scenarios.failed.length
          ? `\n\n_:warning: ${scenarios.failed.length} of ${total} TWD scenarios ${scenarios.failed.length === 1 ? 'fails' : 'fail'}: ${scenarios.failed.map((f) => `"${f.name}"`).join(', ')}. Ask me to fix it._`
          : `\n\n_:white_check_mark: ${total} TWD scenarios pass in headless Chrome._`;
      await postVersion(client, {
        channel,
        threadTs,
        filename: state.filename,
        html: state.html,
        comment: reply + checked,
        version: versions.length + 1,
        turn: botTurns + 1,
        repo,
        previous: nextSteps,
      });
    } else {
      await say(reply);
    }
  } catch (err) {
    log.error('turn failed', { thread: key, ...errorFields(err) });
    await say(`Something failed: ${(err as Error).message}`);
  } finally {
    running.delete(key);
    await doneWorking();
  }
}
