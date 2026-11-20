import type { FakeNet } from './fake-fetch.ts';
import { json } from './fake-fetch.ts';

type Pull = { number: number; title: string; head: string; base: string; body: string; files: Record<string, string>; basedOn: string[] };

/**
 * A GitHub repo with the TWD Design App installed (or not). Serves files, and keeps the branches
 * and pull requests the bot creates so a story can check what the team would see.
 */
export function githubRepo(net: FakeNet, fullName: string, opts: { files?: Record<string, string>; installed?: boolean } = {}) {
  const files = opts.files ?? {};
  const branches = new Set(['main']);
  const pulls: Pull[] = [];
  const trees = new Map<string, Record<string, string>>();
  const commits = new Map<string, { tree: string; parents: string[] }>();
  const refs = new Map<string, string>();
  const r = (path: string) => `/repos/${fullName}${path}`;

  Object.assign(net.routes, {
    'GET /app': () => ({ slug: 'twd-design' }),
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
      const pull = { number: pulls.length + 1, ...body, files: trees.get(commit.tree)!, basedOn: commit.parents };
      pulls.push(pull);
      return { number: pull.number, html_url: `https://github.com/${fullName}/pull/${pull.number}` };
    },
  });
  // Any file in the repo, raw.
  net.fallbacks.push((req) => {
    const prefix = `/repos/${fullName}/contents/`;
    if (req.method !== 'GET' || !req.path.startsWith(prefix)) return undefined;
    const content = files[decodeURIComponent(req.path.slice(prefix.length))];
    return content == null ? json({ message: 'Not Found' }, 404) : new Response(content);
  });

  return { pulls, branches };
}
