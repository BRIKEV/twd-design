import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findIssue, findRepo } from '../../src/github/files.ts';

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

// The issue a thread is about names the PR's folder and branch, so the prototype sits next to its issue.

test('an issue link of the linked repo, or a bare #number, is the thread\'s issue', () => {
  assert.equal(findIssue(['see <https://github.com/acme/web/issues/71>'], 'acme/web'), 71);
  assert.equal(findIssue(['Thanks for your idea: a My karma page (#71).'], 'acme/web'), 71);
  assert.equal(findIssue(['for #12', 'actually #34'], 'acme/web'), 34, 'the last one wins');
});

test('no issue from another repo, a Slack channel or without a linked repo', () => {
  assert.equal(findIssue(['<https://github.com/acme/other/issues/9>'], 'acme/web'), null);
  assert.equal(findIssue(['posted in <#C0123|design>'], 'acme/web'), null);
  assert.equal(findIssue(['for #12'], null), null);
  assert.equal(findIssue(['make it #1 priority'], 'acme/web'), 1, 'a bare #number is taken at its word');
});
