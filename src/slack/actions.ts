import type { WebClient } from '@slack/web-api';
import { config } from '../config.ts';
import { installedRepos, pendingPrototypes } from '../github/repos.ts';
import { errorFields, log } from '../log.ts';
import { approvedBlocks, homeView, nextStepsBlocks, pendingBlocks, pickRepoLoading, pickRepoModal, type PickRepoMeta } from './blocks.ts';
import { downloadFile, loadThread, SAID } from './thread.ts';
import { handleTurn, isBusy, postVersion, stopTurn } from './turn.ts';

// What happens when someone clicks a button, submits the repo modal, presses Stop or opens the
// app's Home. Everything here is deterministic: the model only runs through handleTurn.

export type ActionBody = {
  user: { id: string };
  trigger_id: string;
  channel?: { id: string };
  message?: { ts: string; thread_ts?: string };
  actions: { action_id: string; value?: string }[];
};
export type ViewBody = {
  user: { id: string };
  view: { private_metadata: string; state: { values: Record<string, Record<string, { selected_option?: { value: string } | null }>> } };
};

/** Posts something a person did with a button, in their name, so the team sees it and it counts as theirs. */
async function sayFor(client: WebClient, user: string, channel: string, threadTs: string, text: string) {
  const res = await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: `<@${user}>: ${text}`,
    metadata: { event_type: SAID, event_payload: { user } },
  });
  return res.ts as string;
}

export async function onAction({ body, client }: { body: ActionBody; client: WebClient }, botUserId: string) {
  const action = body.actions[0];
  const channel = body.channel?.id;
  const message = body.message;
  if (!action || !channel || !message || action.action_id.startsWith('twd_link_')) return; // link buttons just open a URL
  const user = body.user.id;
  const threadTs = message.thread_ts ?? message.ts;
  const tell = (text: string) => client.chat.postEphemeral({ channel, user, thread_ts: threadTs, text });

  try {
    if (action.action_id.startsWith('twd_example_')) {
      const ts = await sayFor(client, user, channel, threadTs, action.value ?? '');
      await handleTurn({ client, botUserId, channel, threadTs, messageTs: ts });
      return;
    }

    const thread = await loadThread(client, botUserId, channel, threadTs, { withHtml: false });
    const latest = thread.versions.length;
    const version = Number(action.value);

    if (action.action_id === 'twd_approve') {
      if (version !== latest) return void (await tell(`v${version} is not the latest version (v${latest}). Approve the latest one, or go back to v${version} first.`));
      if (!thread.repo) {
        return void (await openRepoPicker(client, body.trigger_id, {
          channel, threadTs, nextTs: message.ts, version, turn: thread.nextSteps?.turn ?? thread.botTurns, then: 'approve',
        }));
      }
      await approve(client, botUserId, { channel, threadTs, nextTs: message.ts, version, user });
      return;
    }

    if (action.action_id === 'twd_pick_repo') {
      await openRepoPicker(client, body.trigger_id, {
        channel, threadTs, nextTs: message.ts, version: latest, turn: thread.nextSteps?.turn ?? thread.botTurns, then: 'link',
      });
      return;
    }

    if (action.action_id === 'twd_back') {
      if (isBusy(channel, threadTs)) return void (await tell('Still working on a version, try again when it is posted.'));
      const file = thread.versions[version - 1];
      const html = file?.url_private_download ? await downloadFile(file.url_private_download) : null;
      if (!html) return void (await tell(`I couldn't read v${version} from the thread.`));
      await postVersion(client, {
        channel,
        threadTs,
        filename: file.name ?? 'prototype.html',
        html,
        comment: `Back to v${version}, posted as v${latest + 1}.`,
        version: latest + 1,
        turn: thread.botTurns + 1,
        repo: thread.repo,
        previous: thread.nextSteps,
      });
    }
  } catch (err) {
    log.error('button failed', { action: action.action_id, ...errorFields(err) });
    await tell(`Something failed: ${(err as Error).message}`).catch(() => {});
  }
}

type Approval = { channel: string; threadTs: string; nextTs: string; version: number; user: string };

/** The approval goes in the thread in the person's name, and the model opens the PR with its intent. */
async function approve(client: WebClient, botUserId: string, a: Approval) {
  await client.chat.update({ channel: a.channel, ts: a.nextTs, text: `v${a.version}: approved`, blocks: approvedBlocks(a.version, a.user) });
  const ts = await sayFor(client, a.user, a.channel, a.threadTs, `Approved v${a.version}. Open the pull request.`);
  await handleTurn({ client, botUserId, channel: a.channel, threadTs: a.threadTs, messageTs: ts, approved: true });
}

/** Slack wants the modal open within 3 seconds of the click: open it loading, then list the repos. */
async function openRepoPicker(client: WebClient, triggerId: string, meta: PickRepoMeta) {
  const opened = await client.views.open({ trigger_id: triggerId, view: pickRepoLoading(meta) });
  const viewId = opened.view?.id;
  if (!viewId) return;
  try {
    await client.views.update({ view_id: viewId, view: pickRepoModal(meta, await installedRepos()) });
  } catch (err) {
    log.error('repo list failed', errorFields(err));
    const failed = pickRepoLoading(meta);
    failed.blocks = [{ type: 'section', text: { type: 'mrkdwn', text: `I couldn't list the repos: ${(err as Error).message}` } }];
    await client.views.update({ view_id: viewId, view: failed });
  }
}

export async function onViewSubmission({ body, client }: { body: ViewBody; client: WebClient }, botUserId: string) {
  const meta = JSON.parse(body.view.private_metadata) as PickRepoMeta;
  const repo = body.view.state.values.repo?.pick?.selected_option?.value;
  if (!repo) return;
  const user = body.user.id;
  await sayFor(client, user, meta.channel, meta.threadTs, `Linked https://github.com/${repo}`);
  if (meta.then === 'approve') {
    await approve(client, botUserId, { channel: meta.channel, threadTs: meta.threadTs, nextTs: meta.nextTs, version: meta.version, user });
    return;
  }
  // The buttons no longer offer to pick a repo.
  await client.chat.update({
    channel: meta.channel,
    ts: meta.nextTs,
    text: `v${meta.version}: approve it, or mention me in the thread to change it`,
    blocks: nextStepsBlocks({ version: meta.version, turn: meta.turn, maxTurns: config.maxTurnsPerThread, repo, github: true }),
  });
}

/** Slack's Stop button, shown while the bot works on a thread. */
export async function onStop({ event }: { event: { channel: string; thread_ts: string; user: string } }) {
  stopTurn(event.channel, event.thread_ts, event.user);
}

/** The prototypes waiting to be built, or null when GitHub isn't set up. */
async function pending() {
  return config.github.enabled ? pendingPrototypes() : null;
}

export async function onHomeOpened({ event, client }: { event: { user: string; tab?: string }; client: WebClient }) {
  if (event.tab && event.tab !== 'home') return;
  try {
    await client.views.publish({ user_id: event.user, view: homeView(await pending()) });
  } catch (err) {
    log.error('home failed', errorFields(err));
  }
}

/** "@bot pending" in a channel: the same list as the Home. */
export async function postPending(client: WebClient, channel: string, threadTs: string) {
  const list = await pending();
  await client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: 'Waiting to be built',
    blocks: list ? pendingBlocks(list) : [{ type: 'section', text: { type: 'mrkdwn', text: 'GitHub is not set up for this bot yet (docs/setup/github-app.md).' } }],
  });
}
