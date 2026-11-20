import { appJwt, gh } from './client.ts';

// Across every repo the App is installed on: to pick a repo in Slack, and to list what is waiting
// to be built. Read from GitHub each time; nothing is stored.

export type InstalledRepo = { fullName: string; description: string | null; hasDesignGuide?: boolean };
export type PendingPrototype = { repo: string; title: string; number: number; url: string; createdAt: string; threadUrl: string | null };

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`GitHub ${what} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Each installed repo with an installation token that can read it. */
async function reposWithTokens() {
  const jwt = appJwt();
  const installations = await json<{ id: number }[]>(await gh('/app/installations', jwt), 'installations list');
  const all: (InstalledRepo & { token: string })[] = [];
  for (const inst of installations) {
    const { token } = await json<{ token: string }>(
      await gh(`/app/installations/${inst.id}/access_tokens`, jwt, { method: 'POST' }),
      'token request',
    );
    const { repositories } = await json<{ repositories: { full_name: string; description: string | null }[] }>(
      await gh('/installation/repositories?per_page=100', token),
      'repositories list',
    );
    all.push(...repositories.map((r) => ({ fullName: r.full_name, description: r.description, token })));
  }
  return all;
}

/** The repos the App is installed on. Up to 10, it also says which ones have design/DESIGN.md. */
export async function installedRepos(): Promise<InstalledRepo[]> {
  const repos = await reposWithTokens();
  const check = repos.length <= 10;
  return Promise.all(repos.map(async ({ token, ...r }) => {
    if (!check) return r;
    const res = await gh(`/repos/${r.fullName}/contents/design/DESIGN.md`, token);
    return { ...r, hasDesignGuide: res.ok };
  }));
}

// The PR body the bot writes ends with "Discussion: [Slack thread](<url>)".
const THREAD_LINK = /\[Slack thread\]\((https:\/\/[^)\s]+)\)/;

/** Open PRs from design/ branches: approved prototypes not built yet. */
export async function pendingPrototypes(): Promise<PendingPrototype[]> {
  const repos = await reposWithTokens();
  const lists = await Promise.all(repos.map(async ({ fullName, token }) => {
    const pulls = await json<{ number: number; title: string; html_url: string; created_at: string; body: string | null; head: { ref: string } }[]>(
      await gh(`/repos/${fullName}/pulls?state=open&per_page=100`, token),
      `pull requests of ${fullName}`,
    );
    return pulls
      .filter((p) => p.head.ref.startsWith('design/'))
      .map((p) => ({
        repo: fullName,
        title: p.title,
        number: p.number,
        url: p.html_url,
        createdAt: p.created_at,
        threadUrl: p.body?.match(THREAD_LINK)?.[1] ?? null,
      }));
  }));
  return lists.flat();
}
