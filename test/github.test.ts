import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify } from 'node:crypto';
import { AppNotInstalledError } from '../src/github/client.ts';
import { readRepoFile } from '../src/github/files.ts';
import { openPullRequest } from '../src/github/pull-request.ts';
import { fakeFetch, githubAuth, json } from './helpers/fake-fetch.ts';

let net: ReturnType<typeof fakeFetch>;
afterEach(() => net?.restore());

const repoRoutes = (repo: string) => ({
  ...githubAuth(repo),
  [`GET /repos/${repo}`]: () => ({ default_branch: 'main' }),
  [`GET /repos/${repo}/git/ref/heads/main`]: () => ({ object: { sha: 'head1' } }),
  [`GET /repos/${repo}/git/commits/head1`]: () => ({ tree: { sha: 'tree0' } }),
  [`POST /repos/${repo}/git/trees`]: () => ({ sha: 'tree1' }),
  [`POST /repos/${repo}/git/commits`]: () => ({ sha: 'commit1' }),
  [`POST /repos/${repo}/git/refs`]: () => ({}),
  [`POST /repos/${repo}/pulls`]: () => ({ html_url: `https://github.com/${repo}/pull/7`, number: 7 }),
});

const pr = {
  slug: 'login',
  title: 'Prototype: login',
  body: 'intent',
  files: [
    { path: 'design/prototypes/login/index.html', content: '<html></html>' },
    { path: 'design/prototypes/login/intent.md', content: '# Login' },
  ],
};

test('signs a valid App JWT, even from a PEM pasted on one line', async () => {
  net = fakeFetch({ ...githubAuth('acme/jwt'), 'GET /repos/acme/jwt/contents/design/DESIGN.md': () => new Response('# Design') });
  await readRepoFile('acme/jwt', 'design/DESIGN.md');

  const jwt = net.requests[0].headers.get('authorization')!.replace('Bearer ', '');
  const [header, payload, sig] = jwt.split('.');
  const ok = createVerify('RSA-SHA256').update(`${header}.${payload}`).verify(process.env.TEST_GITHUB_PUBLIC_KEY!, sig, 'base64url');
  assert.ok(ok, 'signature verifies with the public key');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.iss, '12345');
  assert.ok(claims.exp - claims.iat <= 600, 'GitHub rejects JWTs longer than 10 minutes');
  // The installation token is scoped to the one repo.
  assert.deepEqual(net.requests[1].body, { repositories: ['jwt'] });
});

test('readRepoFile: the text, null on 404, an error otherwise', async () => {
  net = fakeFetch({
    ...githubAuth('acme/read'),
    'GET /repos/acme/read/contents/design/DESIGN.md': () => new Response('# Design'),
    'GET /repos/acme/read/contents/missing.md': () => new Response('', { status: 404 }),
    'GET /repos/acme/read/contents/broken.md': () => new Response('', { status: 500 }),
  });
  assert.equal(await readRepoFile('acme/read', 'design/DESIGN.md'), '# Design');
  assert.equal(await readRepoFile('acme/read', 'missing.md'), null);
  await assert.rejects(readRepoFile('acme/read', 'broken.md'), /500/);
  assert.equal(net.requests.filter((r) => r.path.endsWith('/access_tokens')).length, 1, 'token is cached');
  assert.equal(net.requests.at(-1)!.headers.get('authorization'), 'Bearer ghs_acme/read');
});

test('App not installed: a typed error carrying the install link', async () => {
  net = fakeFetch({
    'GET /repos/acme/nope/installation': () => json({}, 404),
    'GET /app': () => ({ slug: 'acme-design' }),
  });
  const err = await readRepoFile('acme/nope', 'design/DESIGN.md').catch((e) => e);
  assert.ok(err instanceof AppNotInstalledError);
  assert.equal(err.installUrl, 'https://github.com/apps/acme-design/installations/new');
});

test('opens a PR: one tree, one commit, a design/ branch, never the default branch', async () => {
  net = fakeFetch(repoRoutes('acme/pr'));
  const out = await openPullRequest('acme/pr', pr);

  assert.deepEqual(out, { url: 'https://github.com/acme/pr/pull/7', number: 7, branch: 'design/login' });
  const body = (call: string) => net.requests.find((r) => `${r.method} ${r.path}` === call)!.body;
  assert.deepEqual(body('POST /repos/acme/pr/git/trees'), {
    base_tree: 'tree0',
    tree: pr.files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
  });
  assert.deepEqual(body('POST /repos/acme/pr/git/commits'), { message: 'Prototype: login', tree: 'tree1', parents: ['head1'] });
  assert.deepEqual(body('POST /repos/acme/pr/git/refs'), { ref: 'refs/heads/design/login', sha: 'commit1' });
  assert.deepEqual(body('POST /repos/acme/pr/pulls'), { title: 'Prototype: login', head: 'design/login', base: 'main', body: 'intent' });
  assert.ok(!net.requests.some((r) => r.method !== 'GET' && r.path.includes('heads/main')), 'never writes main');
});

test('an existing branch gets a suffixed one instead of failing', async () => {
  let refs = 0;
  net = fakeFetch({
    ...repoRoutes('acme/again'),
    'POST /repos/acme/again/git/refs': () => (refs++ === 0 ? json({ message: 'Reference already exists' }, 422) : {}),
  });
  const out = await openPullRequest('acme/again', pr);
  assert.match(out.branch, /^design\/login-[a-z0-9]+$/);
  assert.equal(net.requests.find((r) => r.path.endsWith('/pulls'))!.body.head, out.branch);
});

test('a GitHub failure surfaces with its status and message', async () => {
  net = fakeFetch({ ...repoRoutes('acme/fail'), 'POST /repos/acme/fail/pulls': () => json({ message: 'Validation Failed' }, 422) });
  await assert.rejects(openPullRequest('acme/fail', pr), /POST \/pulls failed: 422 .*Validation Failed/);
});
