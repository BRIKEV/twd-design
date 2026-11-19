import { gh, repoToken } from './client.ts';

type PullRequestInput = {
  slug: string;
  title: string;
  body: string;
  files: { path: string; content: string }[];
};

/**
 * Branch from the default branch, ONE commit with all files (git data API, so no commit per file),
 * and a pull request. Never pushes to the default branch.
 */
export async function openPullRequest(repo: string, pr: PullRequestInput) {
  const token = await repoToken(repo);
  const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await gh(`/repos/${repo}${path}`, token, init);
    if (!res.ok) throw new Error(`GitHub ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });

  const { default_branch: base } = await api<{ default_branch: string }>('');
  const { object: head } = await api<{ object: { sha: string } }>(`/git/ref/heads/${base}`);
  const { tree: baseTree } = await api<{ tree: { sha: string } }>(`/git/commits/${head.sha}`);

  const tree = await post<{ sha: string }>('/git/trees', {
    base_tree: baseTree.sha,
    tree: pr.files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
  });
  const commit = await post<{ sha: string }>('/git/commits', {
    message: pr.title,
    tree: tree.sha,
    parents: [head.sha],
  });

  // If design/<slug> already exists (an earlier PR), use a suffixed branch.
  let branch = `design/${pr.slug}`;
  try {
    await post('/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
  } catch {
    branch = `design/${pr.slug}-${Date.now().toString(36)}`;
    await post('/git/refs', { ref: `refs/heads/${branch}`, sha: commit.sha });
  }

  const pull = await post<{ html_url: string; number: number }>('/pulls', {
    title: pr.title,
    head: branch,
    base,
    body: pr.body,
  });
  return { url: pull.html_url, number: pull.number, branch };
}
