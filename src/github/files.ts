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
