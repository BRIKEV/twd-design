import type { FakeNet } from './fake-fetch.ts';
import { json } from './fake-fetch.ts';

type Pull = { number: number; title: string; head: string; base: string; body: string; files: Record<string, string>; basedOn: string[]; createdAt: string };
type Seed = { title: string; head: string; body?: string; daysAgo: number };
const DAY = 86_400_000;

/**
 * A GitHub repo with the TWD Design App installed (or not). Serves files, and keeps the branches
 * and pull requests the bot creates so a story can check what the team would see.
 */
export function githubRepo(
  net: FakeNet,
  fullName: string,
  opts: { files?: Record<string, string>; installed?: boolean; description?: string; openPulls?: Seed[] } = {},
) {
  const files = opts.files ?? {};
  const branches = new Set(['main']);
  const pulls: Pull[] = (opts.openPulls ?? []).map((p, i) => ({
    number: 100 + i, title: p.title, head: p.head, base: 'main', body: p.body ?? '', files: {}, basedOn: [],
    createdAt: new Date(Date.now() - p.daysAgo * DAY).toISOString(),
  }));
  const trees = new Map<string, Record<string, string>>();
  const commits = new Map<string, { tree: string; parents: string[] }>();
  const refs = new Map<string, string>();
  const r = (path: string) => `/repos/${fullName}${path}`;

  // Every repo the App is installed on, across the fake repos of this test (one installation).
  const installed: { full_name: string; description: string | null }[] = ((net as any).installedRepos ??= []);
  if (opts.installed !== false) installed.push({ full_name: fullName, description: opts.description ?? null });

  Object.assign(net.routes, {
    'GET /app': () => ({ slug: 'twd-design' }),
    'GET /app/installations': () => [{ id: 7, account: { login: fullName.split('/')[0] } }],
    'GET /installation/repositories': () => ({ total_count: installed.length, repositories: installed }),
    [`GET ${r('/pulls')}`]: () => pulls.map((p) => ({
      number: p.number, title: p.title, body: p.body, state: 'open', created_at: p.createdAt,
      html_url: `https://github.com/${fullName}/pull/${p.number}`, head: { ref: p.head },
    })),
    [`GET ${r('/installation')}`]: () => (opts.installed === false ? json({ message: 'Not Found' }, 404) : { id: 7 }),
    'POST /app/installations/7/access_tokens': () => ({ token: 'ghs_test', expires_at: new Date(Date.now() + 3600_000).toISOString() }),
    [`GET ${r('')}`]: () => ({ default_branch: 'main' }),
    [`GET ${r('/git/ref/heads/main')}`]: () => ({ object: { sha: 'main-sha' } }),
    [`GET ${r('/git/commits/main-sha')}`]: () => ({ tree: { sha: 'main-tree' } }),
    [`POST ${r('/git/trees')}`]: ({ body }: any) => {
      const sha = `tree-${trees.size + 1}`;
      trees.set(sha, Object.fromEntries(body.tree.map((f: any) => [f.path, f.content])));
      return { sha };
    },
    [`POST ${r('/git/commits')}`]: ({ body }: any) => { const sha = `commit-${commits.size + 1}`; commits.set(sha, { tree: body.tree, parents: body.parents }); return { sha }; },
    [`POST ${r('/git/refs')}`]: ({ body }: any) => {
      const name = body.ref.replace('refs/heads/', '');
      if (branches.has(name)) return json({ message: 'Reference already exists' }, 422);
      branches.add(name);
      refs.set(name, body.sha);
      return {};
    },
    [`POST ${r('/pulls')}`]: ({ body }: any) => {
      const commit = commits.get(refs.get(body.head)!)!;
      const pull = { number: pulls.length + 1, ...body, files: trees.get(commit.tree)!, basedOn: commit.parents, createdAt: new Date().toISOString() };
      pulls.push(pull);
      return { number: pull.number, html_url: `https://github.com/${fullName}/pull/${pull.number}` };
    },
  });
  // Any file in the repo, raw.
  net.fallbacks.push((req) => {
    const prefix = `/repos/${fullName}/contents/`;
    if (req.method !== 'GET' || !req.path.startsWith(prefix)) return undefined;
    const path = decodeURIComponent(req.path.slice(prefix.length)).replace(/\/$/, '');
    const content = files[path];
    if (content != null) return new Response(content);
    // A folder: its entries, one level, like GitHub.
    const inside = Object.keys(files).filter((f) => path === '' || f.startsWith(`${path}/`));
    if (!inside.length) return json({ message: 'Not Found' }, 404);
    const entries = new Map<string, string>();
    for (const f of inside) {
      const rest = path ? f.slice(path.length + 1) : f;
      const [name, ...deeper] = rest.split('/');
      entries.set(name, deeper.length ? 'dir' : 'file');
    }
    return json([...entries].map(([name, type]) => ({ name, path: path ? `${path}/${name}` : name, type })));
  });

  return { pulls, branches };
}
