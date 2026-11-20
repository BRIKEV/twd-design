// Replaces global fetch with a router, so no test ever reaches GitHub or Slack.

export type FakeRequest = { method: string; url: string; path: string; headers: Headers; body: any };
type Handler = (req: FakeRequest) => unknown | Response | Promise<unknown | Response>;

export function fakeFetch(routes: Record<string, Handler>) {
  const requests: FakeRequest[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const req = { method, url: url.href, path: url.pathname, headers: new Headers(init.headers), body };
    requests.push(req);
    const handler = routes[`${method} ${url.pathname}`] ?? routes[`${method} ${url.href}`];
    if (!handler) return json({ message: `no fake for ${method} ${url.pathname}` }, 500);
    const out = await handler(req);
    return out instanceof Response ? out : json(out);
  }) as typeof fetch;

  return {
    requests,
    calls: () => requests.map((r) => `${r.method} ${r.path}`),
    restore: () => { globalThis.fetch = original; },
  };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** Routes for the App auth handshake on a repo where the App is installed. */
export const githubAuth = (repo: string) => ({
  [`GET /repos/${repo}/installation`]: () => ({ id: 99 }),
  'POST /app/installations/99/access_tokens': () => ({
    token: `ghs_${repo}`,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
  }),
});
