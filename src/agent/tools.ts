import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { listRepoFiles, readRepoFile } from '../github/files.ts';
import { openPullRequest } from '../github/pull-request.ts';
import { applyEdits } from '../prototype/edits.ts';
import { lintPlan } from '../prototype/plan-lint.ts';
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

  let rejected = 0;
  // Test first: the model commits to the scenarios (screens, routes, names) before it writes the page.
  // In the evals this ended green 9 of 9 times, against 7 of 9 writing the page first.
  const planScenarios = createTool({
    id: 'plan_scenarios',
    description:
      'Before writing a new version, write its TWD scenarios: the full content of <script id="scenarios">. ' +
      'Then write the page so every query in them matches, and put them in the page verbatim.',
    inputSchema: z.object({
      code: z.string().describe('The whole content of <script id="scenarios">: helpers plus function scenarios() { describe(...) }'),
      contract: z.string().describe(
        'The page contract: every role + name and text the scenarios query, each with the one element that holds it and ' +
        'where (header or #app); the initial data they rely on; one line per action saying what it changes.'),
    }),
    execute: async ({ code, contract }) => {
      // Rules the model skips are checked here, so they cost a step instead of a browser run and a fix round.
      // After two rejections the plan goes through as it is: the browser check still catches what's left.
      const problems = lintPlan(code, contract);
      if (problems.length && rejected < 2) {
        rejected++;
        state.calls.push(`plan:rejected(${problems.length})`);
        return { ok: false, problems, next: 'Fix these and call plan_scenarios again with the whole script and contract.' };
      }
      state.calls.push(`plan:${(code.match(/\bit\(/g) ?? []).length}`);
      state.plan = { code, contract };
      return { ok: true, next: 'Now write the page following the contract: each element as it writes it, the initial data as it lists it, each action as it says. Put the scenarios verbatim in <script id="scenarios">.' };
    },
  });

  const openPr = createTool({
    id: 'open_pull_request',
    description:
      'Save the approved prototype to the linked repo as a pull request: design/prototypes/<slug>/index.html ' +
      'plus intent.md. It only works on the turn started by the Approve and open PR button.',
    inputSchema: z.object({
      slug: z.string().describe('kebab-case feature name, e.g. user-auth-flow'),
      title: z.string().describe('PR title, e.g. "Prototype: user auth flow"'),
      intent: z.string().describe('intent.md in Markdown: problem, screens, agreed scenarios, DEV notes, open questions'),
    }),
    execute: async ({ slug, title, intent }) => {
      if (state.pr) return { ok: true, alreadyOpened: true, ...state.pr };
      // A PR is a decision people make with the button, not something the model infers from a sentence.
      if (!ctx.approved) {
        state.calls.push('pr:not-approved');
        return { ok: false, error: 'Pull requests are opened from the "Approve and open PR" button under the latest version. Tell the user to press it; nothing was opened.' };
      }
      if (!ctx.design?.repo) {
        state.calls.push('pr:no-repo');
        return { ok: false, error: 'No repo linked in this thread. Ask the user to paste the GitHub repo link.' };
      }
      if (!state.html) {
        state.calls.push('pr:no-prototype');
        return { ok: false, error: 'There is no prototype to save yet.' };
      }
      let safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'prototype';
      // The prototype sits next to its issue: design/prototypes/71-my-karma, branch design/71-my-karma.
      if (ctx.issue && !safeSlug.startsWith(`${ctx.issue}-`)) safeSlug = `${ctx.issue}-${safeSlug}`;
      const dir = `design/prototypes/${safeSlug}`;
      const intentMd = `${intent.trim()}\n\n${PORT_NOTE}\n`;
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
          body: `${intentMd}\n${footer}`,
          files: [
            { path: `${dir}/index.html`, content: state.html },
            { path: `${dir}/intent.md`, content: intentMd },
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

  const listFiles = createTool({
    id: 'list_repo_files',
    description:
      'List a folder of the linked product repo (one level). Use it to find the code of an existing screen ' +
      'when the design guide does not say where it is. "" is the repo root.',
    inputSchema: z.object({ path: z.string().describe('Folder path, e.g. "src/pages"') }),
    execute: async ({ path }) => {
      if (!ctx.design?.repo) return noRepo(state, 'list');
      try {
        const entries = await listRepoFiles(ctx.design.repo, path, ctx.design.ref);
        state.calls.push(`list:${path || '/'}`);
        if (!entries) return { ok: false, error: `Folder not found: ${path}` };
        return { ok: true, entries: entries.map((e) => (e.type === 'dir' ? `${e.path}/` : e.path)) };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  });

  const readFile = createTool({
    id: 'read_repo_file',
    description:
      'Read a file of the linked product repo. Before changing a screen that already exists, read its code ' +
      'and the components it uses: the code is how the product really is today.',
    inputSchema: z.object({ path: z.string().describe('File path, e.g. "src/pages/Settings.tsx"') }),
    execute: async ({ path }) => {
      if (!ctx.design?.repo) return noRepo(state, 'read');
      const clean = path.replace(/^\/+/, '');
      if (SECRET.test(clean)) {
        state.calls.push('read:secret');
        return { ok: false, error: `Not readable: ${clean} may hold secrets.` };
      }
      try {
        const content = await readRepoFile(ctx.design.repo, clean, ctx.design.ref);
        state.calls.push(`read:${clean}`);
        if (content == null) return { ok: false, error: `File not found: ${clean}` };
        (state.reads ??= []).push({ path: clean, content: content.slice(0, MAX_READ) });
        if (content.length <= MAX_READ) return { ok: true, content };
        return { ok: true, content: content.slice(0, MAX_READ), truncated: `Only the first ${MAX_READ} of ${content.length} characters.` };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  });

  return {
    write_prototype: writePrototype,
    edit_prototype: editPrototype,
    plan_scenarios: planScenarios,
    open_pull_request: openPr,
    list_repo_files: listFiles,
    read_repo_file: readFile,
  };
}

// Development builds the behavior the criteria describe; the prototype's copy, fake data and markup are
// only there so it can be clicked through. Added by the bot, so it is always there.
const PORT_NOTE = "> Port the behavior these criteria describe, not the prototype's texts, fake data or markup.";

/** Per file read: a big page and its components fit, a lockfile or a bundle doesn't flood the model. */
const MAX_READ = 40_000;
// Env files, keys and certificates stay out of the model (and so out of Slack).
const SECRET = /(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|pfx)|id_(rsa|ed25519).*|\.npmrc|credentials(\.json)?)$/i;

function noRepo(state: PrototypeState, what: string) {
  state.calls.push(`${what}:no-repo`);
  return { ok: false, error: 'No repo linked in this thread, so there is no code to read. Ask for the GitHub repo link.' };
}
