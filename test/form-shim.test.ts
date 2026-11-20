import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ensureFormShim } from '../src/prototype/form-shim.ts';

const count = (s: string, sub: string) => s.split(sub).length - 1;

test('injects the shim right after <body> when there is a form', () => {
  const html = '<html><body class="x">\n<form><button>Go</button></form></body></html>';
  const out = ensureFormShim(html);
  assert.match(out, /<body class="x">\n<script>[\s\S]*twd-design:form-shim[\s\S]*<\/script>\n\n<form>/);
});

test('is idempotent: a second pass changes nothing', () => {
  const once = ensureFormShim('<body><form></form></body>');
  assert.equal(ensureFormShim(once), once);
  assert.equal(count(once, 'twd-design:form-shim'), 1);
});

test('leaves pages without a form untouched', () => {
  const html = '<body><p>No forms, but the word format and <formula> do not count</p></body>';
  assert.equal(ensureFormShim(html), html);
});

test('respects a shim the model already wrote', () => {
  const html = '<body><script>form.dispatchEvent(new SubmitEvent("submit"))</script><form></form></body>';
  assert.equal(ensureFormShim(html), html);
});

test('prepends the shim when there is no <body> tag', () => {
  const out = ensureFormShim('<form></form>');
  assert.ok(out.startsWith('<script>'));
  assert.ok(out.endsWith('<form></form>'));
});

test('the reference template already carries the shim', () => {
  const template = readFileSync(new URL('../src/agent/template.html', import.meta.url), 'utf8');
  assert.equal(ensureFormShim(template), template);
});
