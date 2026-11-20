import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { prototypeTools } from '../src/agent/tools.ts';
import type { PrototypeState, TurnContext } from '../src/agent/types.ts';
import { fakeFetch, githubAuth } from './helpers/fake-fetch.ts';

let net: ReturnType<typeof fakeFetch>;
afterEach(() => net?.restore());

const newState = (html: string | null = null): PrototypeState => ({ filename: 'prototype.html', html, changed: false, calls: [] });
const run = (tool: any, input: unknown) => tool.execute(input, {});
const form = '<html><body><form><button>Save</button></form></body></html>';

test('write_prototype: stores the page, names it .html and adds the form shim', async () => {
  const state = newState();
  const tools = prototypeTools(state, { design: null });
  assert.deepEqual(await run(tools.write_prototype, { filename: 'login', html: form }), { ok: true, bytes: form.length });
  assert.equal(state.filename, 'login.html');
  assert.equal(state.changed, true);
  assert.match(state.html!, /twd-design:form-shim/);
  assert.deepEqual(state.calls, [`write:${form.length}`]);
});

test('edit_prototype: applies, then keeps the shim', async () => {
  const state = newState('<html><body><p>Hi</p></body></html>');
  const tools = prototypeTools(state, { design: null });
  assert.deepEqual(await run(tools.edit_prototype, { edits: [{ old: '<p>Hi</p>', new: '<form><button>Go</button></form>' }] }), { ok: true, applied: 1 });
  assert.match(state.html!, /twd-design:form-shim/);
  assert.deepEqual(state.calls, ['edit:1']);
});

test('edit_prototype: a miss leaves the prototype untouched and tells the model why', async () => {
  const state = newState('<p>a</p><p>a</p>');
  const tools = prototypeTools(state, { design: null });
  const r = await run(tools.edit_prototype, { edits: [{ old: '<p>a</p>', new: 'x' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /found 2 times/);
  assert.equal(state.html, '<p>a</p><p>a</p>');
  assert.equal(state.changed, false);
  assert.deepEqual(state.calls, ['edit:miss(2)']);
});

test('edit_prototype: no prototype yet', async () => {
  const state = newState();
  const r = await run(prototypeTools(state, { design: null }).edit_prototype, { edits: [{ old: 'a', new: 'b' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /write_prototype/);
});

const prInput = { slug: 'User Auth Flow!', title: 'Prototype: auth', intent: '# Auth\n\nScenarios…' };

test('open_pull_request: refuses without a linked repo or a prototype', async () => {
  const noRepo = newState('<p>x</p>');
  assert.match((await run(prototypeTools(noRepo, { design: null }).open_pull_request, prInput)).error, /No repo linked/);
  const noHtml = newState();
  assert.match((await run(prototypeTools(noHtml, { design: { repo: 'acme/x', guide: null } }).open_pull_request, prInput)).error, /no prototype/);
  assert.deepEqual([...noRepo.calls, ...noHtml.calls], ['pr:no-repo', 'pr:no-prototype']);
});

test('open_pull_request: files, slug and footer, and only once per turn', async () => {
  const repo = 'acme/tools';
  let pulls = 0;
  net = fakeFetch({
    ...githubAuth(repo),
    [`GET /repos/${repo}`]: () => ({ default_branch: 'main' }),
    [`GET /repos/${repo}/git/ref/heads/main`]: () => ({ object: { sha: 'h' } }),
    [`GET /repos/${repo}/git/commits/h`]: () => ({ tree: { sha: 't0' } }),
    [`POST /repos/${repo}/git/trees`]: () => ({ sha: 't1' }),
    [`POST /repos/${repo}/git/commits`]: () => ({ sha: 'c1' }),
    [`POST /repos/${repo}/git/refs`]: () => ({}),
    [`POST /repos/${repo}/pulls`]: () => ({ html_url: `https://github.com/${repo}/pull/${++pulls}`, number: pulls }),
  });
  const state = newState('<p>proto</p>');
  const ctx: TurnContext = { design: { repo, guide: null }, threadUrl: 'https://slack.test/p1' };
  const tools = prototypeTools(state, ctx);

  const r = await run(tools.open_pull_request, prInput);
  assert.deepEqual(r, { ok: true, url: `https://github.com/${repo}/pull/1`, number: 1, branch: 'design/user-auth-flow' });

  const tree = net.requests.find((x) => x.path.endsWith('/git/trees'))!.body.tree;
  assert.deepEqual(tree.map((f: any) => [f.path, f.content]), [
    ['design/prototypes/user-auth-flow/index.html', '<p>proto</p>'],
    ['design/prototypes/user-auth-flow/intent.md', prInput.intent],
  ]);
  const body = net.requests.find((x) => x.path.endsWith('/pulls'))!.body.body;
  assert.ok(body.startsWith(prInput.intent));
  assert.match(body, /\[Slack thread\]\(https:\/\/slack\.test\/p1\)/);
  assert.match(body, /Opened by \[TWD Design\]/);

  // The model sometimes calls it twice in one turn: the second call must not open another PR.
  const again = await run(tools.open_pull_request, prInput);
  assert.equal(again.alreadyOpened, true);
  assert.equal(pulls, 1);
  assert.deepEqual(state.calls, ['pr:#1']);
});
