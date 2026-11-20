import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRepo } from '../../src/github/files.ts';

test('reads the Slack link formats', () => {
  assert.equal(findRepo(['look at <https://github.com/acme/web>']), 'acme/web');
  assert.equal(findRepo(['<https://github.com/acme/web|acme/web> please']), 'acme/web');
  assert.equal(findRepo(['plain https://github.com/acme/web here']), 'acme/web');
});

test('ignores paths, .git, queries and anchors after the repo', () => {
  assert.equal(findRepo(['<https://github.com/acme/web/tree/main/src>']), 'acme/web');
  assert.equal(findRepo(['https://github.com/acme/web.git']), 'acme/web');
  assert.equal(findRepo(['https://github.com/acme/web?tab=readme']), 'acme/web');
  assert.equal(findRepo(['https://github.com/acme/web#readme']), 'acme/web');
});

test('keeps dots, dashes and underscores in names', () => {
  assert.equal(findRepo(['https://github.com/my-org/web_app.v2']), 'my-org/web_app.v2');
});

test('the last link in the thread wins', () => {
  assert.equal(findRepo(['https://github.com/acme/old', 'now <https://github.com/acme/new>']), 'acme/new');
});

test('null when no repo was linked', () => {
  assert.equal(findRepo(['make me a login page', 'https://github.com/acme']), null);
});
