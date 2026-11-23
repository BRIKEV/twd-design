import { gh, repoToken } from './client.ts';

/** File contents as text, or null if it doesn't exist. */
export async function readRepoFile(repo: string, path: string): Promise<string | null> {
  const res = await gh(`/repos/${repo}/contents/${path}`, await repoToken(repo), {
    headers: { Accept: 'application/vnd.github.raw+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed for ${repo}/${path}: ${res.status}`);
  return res.text();
}

// Slack sends links as <https://github.com/o/r|label> or <https://github.com/o/r>.
const REPO_LINK = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[/|>#?\s]|$)/gi;

/** The last GitHub repo linked in the given texts, as "owner/repo". */
export function findRepo(texts: string[]): string | null {
  let found: string | null = null;
  for (const text of texts) {
    for (const m of text.matchAll(REPO_LINK)) found = `${m[1]}/${m[2]}`;
  }
  return found;
}

const ISSUE_LINK = /github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/gi;
// "#71" on its own, not inside a Slack channel link (<#C0123|name>).
const ISSUE_REF = /(?:^|[\s(\[])#(\d{1,7})\b/g;

/** The last issue of the linked repo the texts point to: an issue link, or a bare "#71". */
export function findIssue(texts: string[], repo: string | null): number | null {
  if (!repo) return null;
  let found: number | null = null;
  for (const text of texts) {
    const hits: { at: number; n: number }[] = [];
    for (const m of text.matchAll(ISSUE_LINK)) {
      if (`${m[1]}/${m[2]}`.toLowerCase() === repo.toLowerCase()) hits.push({ at: m.index!, n: Number(m[3]) });
    }
    for (const m of text.matchAll(ISSUE_REF)) hits.push({ at: m.index!, n: Number(m[1]) });
    const last = hits.sort((a, b) => a.at - b.at).at(-1);
    if (last) found = last.n;
  }
  return found;
}

export type RepoEntry = { path: string; type: 'file' | 'dir' };

/** The entries of a folder (one level), or null if it doesn't exist. A file path gives null too. */
export async function listRepoFiles(repo: string, path: string): Promise<RepoEntry[] | null> {
  const res = await gh(`/repos/${repo}/contents/${path.replace(/^\/+|\/+$/g, '')}`, await repoToken(repo));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub list failed for ${repo}/${path}: ${res.status}`);
  const body = (await res.json()) as { path: string; type: string }[] | object;
  if (!Array.isArray(body)) return null;
  return body.map((e) => ({ path: e.path, type: e.type === 'dir' ? 'dir' : 'file' }));
}
