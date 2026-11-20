import type { KnownBlock } from '@slack/web-api';
import type { InstalledRepo, PendingPrototype } from '../github/repos.ts';

// Every message and view the bot builds without the model: fixed words, the same every time.

const plain = (text: string) => ({ type: 'plain_text' as const, text, emoji: true });
const md = (text: string) => ({ type: 'mrkdwn' as const, text });
const context = (text: string): KnownBlock => ({ type: 'context', elements: [md(text)] });

const HOW_IT_WORKS =
  '1. *Ask for a screen* here. Paste the repo link, or pick it later, to use its design guide.\n' +
  '2. *To change it, reply in the thread*: "and on mobile?", "remove the banner"…\n' +
  '3. *Approve* it and I open a pull request for developers.';

export const EXAMPLES = [
  { label: 'A login screen', request: 'A login screen with email and password, and a "forgot password" link' },
  { label: 'A list with filters', request: 'A list of orders with filters by date and status, and a search box' },
  { label: 'A 3-step sign-up', request: 'A sign-up form in 3 steps: account, profile, confirmation' },
  { label: 'Notification settings', request: 'A notification settings page with email and push toggles for each event' },
];

export function welcomeBlocks(): KnownBlock[] {
  return [
    { type: 'section', text: md('I turn a request into a *clickable HTML prototype* that follows your design guide, with its acceptance criteria as TWD tests that already pass.') },
    { type: 'section', text: md(HOW_IT_WORKS) },
    context('Try an example:'),
    {
      type: 'actions',
      elements: EXAMPLES.map((e, i) => ({ type: 'button', action_id: `twd_example_${i}`, text: plain(e.label), value: e.request })),
    },
  ];
}

type NextStepsInput = { version: number; turn: number; maxTurns: number; repo: string | null; github: boolean };

/** The buttons under the latest version. */
export function nextStepsBlocks({ version, turn, maxTurns, repo, github }: NextStepsInput): KnownBlock[] {
  const buttons = [
    ...(github ? [{ type: 'button' as const, style: 'primary' as const, action_id: 'twd_approve', text: plain('Approve and open PR'), value: String(version) }] : []),
    ...(version > 1 ? [{ type: 'button' as const, action_id: 'twd_back', text: plain(`Back to v${version - 1}`), value: String(version - 1) }] : []),
    ...(github && !repo ? [{ type: 'button' as const, action_id: 'twd_pick_repo', text: plain('Pick repo'), value: 'link' }] : []),
  ];
  const lines = [`*v${version}* · To change something, reply in the thread · turn ${turn} of ${maxTurns}`];
  if (github && !repo) lines.push('No repo linked: generic styles. Pick the repo to use its design guide.');
  return [...(buttons.length ? [{ type: 'actions' as const, elements: buttons }] : []), context(lines.join('\n'))];
}

export const replacedBlocks = (version: number, by: number) => [context(`v${version} · Replaced by v${by}`)];
export const approvedBlocks = (version: number, user: string) => [context(`v${version} · Approved by <@${user}>`)];

/** What the modal remembers between the click and the submit. */
export type PickRepoMeta = { channel: string; threadTs: string; nextTs: string; version: number; turn: number; then: 'link' | 'approve' };

const pickTitle = (then: PickRepoMeta['then']) => (then === 'approve' ? 'Open the PR' : 'Pick repo');

export function pickRepoLoading(meta: PickRepoMeta) {
  return {
    type: 'modal' as const,
    callback_id: 'twd_pick_repo',
    title: plain(pickTitle(meta.then)),
    close: plain('Cancel'),
    private_metadata: JSON.stringify(meta),
    blocks: [{ type: 'section', text: md('Loading the repos the GitHub App is installed on…') }] as KnownBlock[],
  };
}

export function pickRepoModal(meta: PickRepoMeta, repos: InstalledRepo[]) {
  const base = pickRepoLoading(meta);
  if (!repos.length) {
    return { ...base, blocks: [{ type: 'section', text: md('The GitHub App is not installed on any repo yet. Install it on your repos and try again.') }] as KnownBlock[] };
  }
  const guide = (r: InstalledRepo) =>
    r.hasDesignGuide == null ? '' : r.hasDesignGuide ? ':white_check_mark: has a design guide' : ':warning: no design guide yet';
  const describe = (r: InstalledRepo) => [guide(r), r.description].filter(Boolean).join(' · ') || ' ';
  // Radio buttons show a description per repo, up to 10. Beyond that, a searchable menu.
  const element = repos.length <= 10
    ? {
      type: 'radio_buttons' as const,
      action_id: 'pick',
      options: repos.map((r) => ({ text: md(`*${r.fullName}*`), description: md(describe(r)), value: r.fullName })),
    }
    : {
      type: 'static_select' as const,
      action_id: 'pick',
      placeholder: plain('Search a repo'),
      options: repos.slice(0, 100).map((r) => ({ text: plain(r.fullName.slice(0, 75)), value: r.fullName })),
    };
  const intro = meta.then === 'approve' ? 'Where should the PR go? Repos the GitHub App is installed on.' : 'Repos the GitHub App is installed on.';
  return {
    ...base,
    submit: plain(meta.then === 'approve' ? 'Open PR' : 'Link'),
    blocks: [context(intro), { type: 'input', block_id: 'repo', label: plain('Repo'), element }] as KnownBlock[],
  };
}

const age = (createdAt: string) => {
  const days = Math.floor((Date.now() - Date.parse(createdAt)) / 86_400_000);
  return days <= 0 ? 'opened today' : `opened ${days} day${days === 1 ? '' : 's'} ago`;
};

/** The open prototype PRs, by repo, oldest first. */
export function pendingBlocks(pending: PendingPrototype[]): KnownBlock[] {
  const blocks: KnownBlock[] = [
    { type: 'header', text: plain('Waiting to be built') },
    context('Approved prototypes with an open pull request. Once it is merged, it is built.'),
  ];
  if (!pending.length) return [...blocks, { type: 'section', text: md('Nothing waiting: every approved prototype has been built.') }];
  const byRepo = Map.groupBy(pending, (p) => p.repo);
  for (const [repo, prs] of byRepo) {
    blocks.push({ type: 'section', text: md(`*${repo}* · ${prs.length} waiting`) });
    for (const pr of prs.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 15)) {
      blocks.push({ type: 'section', text: md(`*${pr.title}*\n#${pr.number} · ${age(pr.createdAt)}`) });
      blocks.push({
        type: 'actions',
        elements: [
          { type: 'button', action_id: `twd_link_pr_${repo}_${pr.number}`, text: plain('View PR'), url: pr.url },
          ...(pr.threadUrl ? [{ type: 'button' as const, action_id: `twd_link_thread_${repo}_${pr.number}`, text: plain('Open thread'), url: pr.threadUrl }] : []),
        ],
      });
    }
  }
  return blocks;
}

export function homeView(pending: PendingPrototype[] | null) {
  return {
    type: 'home' as const,
    blocks: [
      { type: 'section', text: md('I turn a request into a *clickable HTML prototype* that follows your design guide. Mention me in any channel:') },
      { type: 'section', text: md(HOW_IT_WORKS) },
      { type: 'divider' },
      ...(pending ? pendingBlocks(pending) : [context('Connect the GitHub App to see the prototypes waiting to be built (docs/setup/github-app.md).')]),
    ] as KnownBlock[],
  };
}
