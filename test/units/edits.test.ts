import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits } from '../../src/prototype/edits.ts';

const html = '<h1>Projects</h1><button>Add</button><button>Delete</button>';

test('applies several edits in order', () => {
  const r = applyEdits(html, [
    { old: '<h1>Projects</h1>', new: '<h1>Workspaces</h1>' },
    { old: '>Add<', new: '>New workspace<' },
  ]);
  assert.deepEqual(r, { ok: true, html: '<h1>Workspaces</h1><button>New workspace</button><button>Delete</button>' });
});

test('a later edit sees the result of the earlier ones', () => {
  const r = applyEdits(html, [
    { old: 'Projects', new: 'Teams' },
    { old: '<h1>Teams</h1>', new: '<h2>Teams</h2>' },
  ]);
  assert.ok(r.ok && r.html.startsWith('<h2>Teams</h2>'));
});

test('an ambiguous anchor fails with its count', () => {
  assert.deepEqual(applyEdits(html, [{ old: '<button>', new: '<button class="b">' }]), { ok: false, index: 0, count: 2 });
});

test('a missing anchor fails with count 0', () => {
  assert.deepEqual(applyEdits(html, [{ old: 'Settings', new: 'x' }]), { ok: false, index: 0, count: 0 });
});

test('all or nothing: one miss discards the edits before it', () => {
  const r = applyEdits(html, [
    { old: 'Projects', new: 'Teams' },
    { old: 'Nope', new: 'x' },
  ]);
  assert.deepEqual(r, { ok: false, index: 1, count: 0 });
});

test('replacement text is literal, even with $ patterns', () => {
  const r = applyEdits('<p>price</p>', [{ old: 'price', new: '$& costs $1 or $$5' }]);
  assert.deepEqual(r, { ok: true, html: '<p>$& costs $1 or $$5</p>' });
});
