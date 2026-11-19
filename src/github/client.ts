import { createSign } from 'node:crypto';
import { config } from '../config.ts';

// GitHub App auth with plain fetch: sign a short-lived JWT as the App, then exchange it for an
// installation token scoped to the repo. The installation is looked up from the repo, so no
// installation id is configured.

const API = 'https://api.github.com';

export class AppNotInstalledError extends Error {
  repo: string;
  installUrl: string;
  constructor(repo: string, installUrl: string) {
    super(`The GitHub App is not installed on ${repo}`);
    this.repo = repo;
    this.installUrl = installUrl;
  }
}

export async function gh(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...init.headers },
  });
}

// .env files often end up with the PEM on one line or with literal \n.
function normalizePem(raw: string) {
  const s = raw.replace(/\\n/g, '\n').trim();
  const m = s.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return s;
  const body = m[2].replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN ${m[1]}-----\n${body}\n-----END ${m[1]}-----\n`;
}

function appJwt() {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iat: now - 60, exp: now + 540, iss: config.github.appId })}`;
  const key = normalizePem(config.github.privateKey ?? '');
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url')}`;
}

let appSlug: string | undefined;
async function installUrl() {
  if (!appSlug) {
    const res = await gh('/app', appJwt());
    appSlug = res.ok ? ((await res.json()) as { slug: string }).slug : 'twd-design';
  }
  return `https://github.com/apps/${appSlug}/installations/new`;
}

// In-memory only: tokens last 1h, refreshed 5 minutes before they expire.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function repoToken(repo: string) {
  const cached = tokenCache.get(repo);
  if (cached && cached.expiresAt > Date.now() + 5 * 60_000) return cached.token;

  const jwt = appJwt();
  const inst = await gh(`/repos/${repo}/installation`, jwt);
  if (inst.status === 404) throw new AppNotInstalledError(repo, await installUrl());
  if (!inst.ok) throw new Error(`GitHub installation lookup failed for ${repo}: ${inst.status}`);
  const { id } = (await inst.json()) as { id: number };

  const res = await gh(`/app/installations/${id}/access_tokens`, jwt, {
    method: 'POST',
    body: JSON.stringify({ repositories: [repo.split('/')[1]] }),
  });
  if (!res.ok) throw new Error(`GitHub token request failed for ${repo}: ${res.status}`);
  const { token, expires_at } = (await res.json()) as { token: string; expires_at: string };
  tokenCache.set(repo, { token, expiresAt: Date.parse(expires_at) });
  return token;
}
