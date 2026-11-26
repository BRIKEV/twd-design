// A syntax error in one of the prototype's scripts stops it before any scenario runs, and the browser only
// says "missing ) after argument list". Fix rounds need to know which script, which line, and what is on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSyntaxErrors } from '../../src/prototype/scenarios.ts';

const page = (scenarios: string) => `<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/npm/vue@3.5.45/dist/vue.global.prod.js"></script>
<style type="text/tailwindcss">@theme { --color-primary: #2563eb; }</style>
</head><body>
<script>
  const state = { ok: true };
</script>
<script id="scenarios">
  function scenarios() {
${scenarios}
  }
</script>
</body></html>`;

test('a prototype whose scripts parse has no syntax errors', () => {
  assert.deepEqual(findSyntaxErrors(page("    describe('Projects', () => {});")), []);
});

test('a syntax error names the script, the line and what is on it', () => {
  const [error] = findSyntaxErrors(page("    describe('Projects', () => {\n      twd.should(await screenDom.findByRole('button', { name: 'Save' }, 'be.visible');\n    });"));
  assert.match(error, /<script id="scenarios">, line 4/);
  assert.match(error, /missing \) after argument list|Unexpected/);
  assert.match(error, /findByRole\('button', \{ name: 'Save' \}, 'be\.visible'\);/, 'the line itself, so the fix round can find it');
});

test('scripts loaded from a URL and non-JavaScript blocks are not checked', () => {
  assert.deepEqual(findSyntaxErrors('<script src="x.js"></script><script type="text/template">{{ not js</script>'), []);
});
