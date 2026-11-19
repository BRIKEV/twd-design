import type { WebClient } from '@slack/web-api';
import { config } from '../config.ts';
import { runDesignAgent } from '../agent/agent.ts';
import type { DesignContext } from '../agent/types.ts';
import { AppNotInstalledError } from '../github/client.ts';
import { readRepoFile } from '../github/files.ts';
import { errorFields, log } from '../log.ts';
import { loadThread } from './thread.ts';

// In-memory only: avoids two runs on the same thread at once, and lets shutdown wait for running turns.
const busyThreads = new Set<string>();
let accepting = true;

/** Stop starting new turns and resolve when the running ones finish (or the timeout passes). */
export async function drainTurns(timeoutMs: number) {
  accepting = false;
  const deadline = Date.now() + timeoutMs;
  while (busyThreads.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  return busyThreads.size;
}

export const isAccepting = () => accepting;

type Turn = { client: WebClient; botUserId: string; channel: string; threadTs: string; messageTs: string };

/** One bot turn: read the thread, run the agent, post the new version (or the answer) in the thread. */
export async function handleTurn({ client, botUserId, channel, threadTs, messageTs }: Turn) {
  const say = (text: string) => client.chat.postMessage({ channel, thread_ts: threadTs, text });
  const key = `${channel}:${threadTs}`;
  if (!accepting) {
    await say('Restarting right now, ask again in a minute.');
    return;
  }
  if (busyThreads.has(key)) {
    await say('Still working on the previous version, give me a moment.');
    return;
  }
  busyThreads.add(key);
  await client.reactions.add({ channel, timestamp: messageTs, name: 'hourglass_flowing_sand' }).catch(() => {});

  try {
    const { history, state, botTurns, repo } = await loadThread(client, botUserId, channel, threadTs);
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
    const { text, usage } = await runDesignAgent(history, state, { design, threadUrl });
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
      usage,
    });

    const reply = text?.trim() || 'Done.';
    if (state.changed && state.html) {
      await client.files.uploadV2({
        channel_id: channel,
        thread_ts: threadTs,
        filename: state.filename,
        title: state.filename,
        content: state.html,
        initial_comment: reply,
      });
    } else {
      await say(reply);
    }
  } catch (err) {
    log.error('turn failed', { thread: key, ...errorFields(err) });
    await say(`Something failed: ${(err as Error).message}`);
  } finally {
    busyThreads.delete(key);
    await client.reactions.remove({ channel, timestamp: messageTs, name: 'hourglass_flowing_sand' }).catch(() => {});
  }
}
