// The skill's scenario rules, checked on the plan before the page is written. In the evals a fast model
// skipped some of them, and each one skipped cost a browser run and a fix round.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintPlan } from '../../src/prototype/plan-lint.ts';

const it = (body: string) => `function scenarios() {\n  describe('Shop', () => {\n    it('works', async () => {\n${body}\n    });\n  });\n}`;

test("the template's scenarios pass", () => {
  const template = readFileSync(new URL('../../src/agent/template.html', import.meta.url), 'utf8');
  const scenarios = template.match(/<script id="scenarios">([\s\S]*?)<\/script>/)![1];
  assert.deepEqual(lintPlan(scenarios), []);
});

test('a count in a name is sent back with the fixed name to query', () => {
  const [problem] = lintPlan(it(`await screenDomGlobal.findByRole('link', { name: 'Wishlist 1' });`));
  assert.match(problem, /^line 4: link "Wishlist 1" has a count in its name/);
  assert.match(problem, /\("Wishlist"\)/);
});

test('a text made of several pieces is sent back; two sentences in one paragraph are fine', () => {
  const [problem] = lintPlan(it(`await screenDom.findByText('2 items · Total €8.10');`));
  assert.match(problem, /"2 items · Total €8\.10" joins several texts into one/);
  assert.deepEqual(lintPlan(it(`await screenDom.findByText('Nothing to do. Suspicious.');`)), []);
});

test('an await inside twd.waitFor is a syntax error, with the line', () => {
  const [problem] = lintPlan(it(`await twd.waitFor(() => twd.should(await screenDom.findByRole('button', { name: 'Save' }), 'be.visible'));`));
  assert.match(problem, /^line 4: syntax error/);
  assert.match(problem, /query with getBy\*/);
});

test('every fixed name and text queried must be in the page contract', () => {
  const code = it(`await screenDom.findByRole('button', { name: 'Apply coupon' });\nawait screenDom.findByText('Coupon applied');\nawait screenDom.findByText('Total €22.50');`);
  const [problem] = lintPlan(code, 'button "Apply coupon" → #app: <button>Apply coupon</button>');
  assert.match(problem, /doesn't say which element holds: "Coupon applied"/);
  assert.doesNotMatch(problem, /Total/, 'a text with a value is written in the contract as its template');
  assert.deepEqual(lintPlan(code, 'button "Apply coupon" → #app · "Coupon applied" → #app: <p role="status">Coupon applied</p>'), []);
});
