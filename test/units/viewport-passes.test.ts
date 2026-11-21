// twd-js only runs the scenarios that match the window width, so the headless check plans one pass
// per viewport, like twd-cli. Which scenario belongs to which viewport is twd-js's answer; this only
// orders the passes and picks their widths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPasses, type Registry } from '../../src/prototype/scenarios.ts';

const registry = (r: Partial<Registry>): Registry => ({ all: [], names: {}, current: null, named: {}, viewports: {}, ...r });

test('Without viewports, every scenario runs in one pass at the desktop size', () => {
  const plan = planPasses(registry({ all: ['a', 'b'] }), 1280);

  assert.deepEqual(plan, { passes: [{ viewport: null, width: null, ids: ['a', 'b'] }], unmatched: [] });
});

test('A mobile scenario runs in its own pass, at the widest mobile width', () => {
  const plan = planPasses(registry({
    all: ['a', 'menu', 'b'],
    current: ['a', 'b'],
    named: { mobile: ['a', 'menu', 'b'], desktop: ['a', 'b'] },
    viewports: { mobile: { maxWidth: 767 }, desktop: { minWidth: 768 } },
  }), 1280);

  assert.deepEqual(plan.passes, [
    { viewport: null, width: null, ids: ['a', 'b'] },
    { viewport: 'mobile', width: 767, ids: ['menu'] },
  ]);
  assert.deepEqual(plan.unmatched, []);
});

test('A viewport that starts above the desktop size runs at its minimum width', () => {
  const plan = planPasses(registry({
    all: ['a', 'wide'],
    current: ['a'],
    named: { wide: ['a', 'wide'] },
    viewports: { wide: { minWidth: 1600 } },
  }), 1280);

  assert.deepEqual(plan.passes.at(-1), { viewport: 'wide', width: 1600, ids: ['wide'] });
});

test('A scenario tagged with a viewport nobody declared is reported, not silently skipped', () => {
  const plan = planPasses(registry({
    all: ['a', 'typo'],
    current: ['a'],
    named: { mobile: ['a'] },
    viewports: { mobile: { maxWidth: 767 } },
  }), 1280);

  assert.deepEqual(plan.unmatched, ['typo']);
});
