import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { openPullRequest } from '../github/pull-request.ts';
import { applyEdits } from '../prototype/edits.ts';
import { ensureFormShim } from '../prototype/form-shim.ts';
import type { PrototypeState, TurnContext } from './types.ts';

// The tools close over this turn's state: nothing is shared between threads or stored.
export function prototypeTools(state: PrototypeState, ctx: TurnContext) {
  const writePrototype = createTool({
    id: 'write_prototype',
    description: 'Create or fully replace the prototype HTML. Use for the first version or a full redesign.',
    inputSchema: z.object({
      filename: z.string().describe('kebab-case file name ending in .html, e.g. karma-history.html'),
      html: z.string().describe('The complete self-contained HTML document'),
    }),
    execute: async ({ filename, html }) => {
      state.calls.push(`write:${html.length}`);
      state.filename = filename.endsWith('.html') ? filename : `${filename}.html`;
      state.html = ensureFormShim(html);
      state.changed = true;
      return { ok: true, bytes: html.length };
    },
  });

  const editPrototype = createTool({
    id: 'edit_prototype',
    description:
      'Apply exact text replacements to the current prototype. Each old string must appear exactly once. ' +
      'Prefer this over write_prototype for any change to an existing prototype.',
    inputSchema: z.object({
      edits: z.array(z.object({ old: z.string(), new: z.string() })).min(1),
    }),
    execute: async ({ edits }) => {
      if (state.html == null) {
        state.calls.push('edit:no-prototype');
        return { ok: false, error: 'No prototype yet. Use write_prototype.' };
      }
      const result = applyEdits(state.html, edits);
      if (!result.ok) {
        state.calls.push(`edit:miss(${result.count})`);
        return {
          ok: false,
          error: `Edit ${result.index}: old string found ${result.count} times (must be exactly 1). Nothing applied.`,
        };
      }
      state.calls.push(`edit:${edits.length}`);
      state.html = ensureFormShim(result.html);
      state.changed = true;
      return { ok: true, applied: edits.length };
    },
  });

  const openPr = createTool({
    id: 'open_pull_request',
    description:
      'Save the approved prototype to the linked repo as a pull request: design/prototypes/<slug>/index.html ' +
      'plus intent.md. ONLY call this when the user explicitly approves or asks to save / open a PR.',
    inputSchema: z.object({
      slug: z.string().describe('kebab-case feature name, e.g. user-auth-flow'),
      title: z.string().describe('PR title, e.g. "Prototype: user auth flow"'),
      intent: z.string().describe('intent.md in Markdown: problem, screens, agreed scenarios, DEV notes, open questions'),
    }),
    execute: async ({ slug, title, intent }) => {
      if (state.pr) return { ok: true, alreadyOpened: true, ...state.pr };
      if (!ctx.design?.repo) {
        state.calls.push('pr:no-repo');
        return { ok: false, error: 'No repo linked in this thread. Ask the user to paste the GitHub repo link.' };
      }
      if (!state.html) {
        state.calls.push('pr:no-prototype');
        return { ok: false, error: 'There is no prototype to save yet.' };
      }
      const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'prototype';
      const dir = `design/prototypes/${safeSlug}`;
      const footer = [
        '---',
        `Prototype: \`${dir}/index.html\` (open it in a browser and run the scenarios from the TWD sidebar).`,
        ctx.threadUrl ? `Discussion: [Slack thread](${ctx.threadUrl})` : '',
        'Opened by [TWD Design](https://twd.dev) · Test While Designing.',
      ].filter(Boolean).join('\n\n');
      try {
        state.pr = await openPullRequest(ctx.design.repo, {
          slug: safeSlug,
          title,
          body: `${intent}\n\n${footer}`,
          files: [
            { path: `${dir}/index.html`, content: state.html },
            { path: `${dir}/intent.md`, content: intent },
          ],
        });
        state.calls.push(`pr:#${state.pr.number}`);
        return { ok: true, ...state.pr };
      } catch (err) {
        state.calls.push('pr:error');
        return { ok: false, error: (err as Error).message };
      }
    },
  });

  return { write_prototype: writePrototype, edit_prototype: editPrototype, open_pull_request: openPr };
}
