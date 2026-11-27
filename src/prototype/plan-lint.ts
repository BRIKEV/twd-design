import { Script } from 'node:vm';

// Checks a planned <script id="scenarios"> before the page is written. The skill states these rules, but a
// fast model skips some of them, and each one skipped cost a browser run and a fix round. Here a plan that
// breaks one is sent back with the line and how to fix it, and the model fixes it in the same turn.

const QUOTED = String.raw`(?<q>['"\`])((?:\\.|(?!\k<q>).)*)\k<q>`;
// findByRole('link', { name: 'Wishlist' }) — any variant: find/get/query, All or not.
const ROLE = new RegExp(String.raw`\b(?:find|get|query)(?:All)?ByRole\(\s*['"]([\w-]+)['"]\s*,\s*\{[^}]*?\bname:\s*${QUOTED}`, 'g');
const TEXT = new RegExp(String.raw`\b(?:find|get|query)(?:All)?By(?:Text|LabelText)\(\s*${QUOTED}`, 'g');

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

/** What a planned scenarios script breaks, one problem per line, each saying how to fix it. Empty: fine. */
export function lintPlan(code: string): string[] {
  try {
    new Script(code, { filename: 'scenarios' });
  } catch (err) {
    if (err instanceof SyntaxError) {
      const line = Number(err.stack?.match(/^scenarios:(\d+)/)?.[1]);
      return [`line ${line || '?'}: syntax error, ${err.message}: ${code.split('\n')[line - 1]?.trim() ?? ''}. ` +
        'Inside twd.waitFor(() => ...) nothing is awaited: query with getBy*.'];
    }
  }

  const problems: string[] = [];
  for (const m of code.matchAll(ROLE)) {
    const [, role, , name] = m;
    if (name.includes('${')) continue;
    const line = lineOf(code, m.index);
    if (/\s\d+$|\(\d+\)|^\d+\s/.test(name)) {
      problems.push(`line ${line}: ${role} "${name}" has a count in its name. Query the fixed name ` +
        `("${name.replace(/\s*\(?\d+\)?\s*/g, ' ').trim()}") and put the count in an aria-hidden badge; check the count as ` +
        'its own text only if it is what the feature is about.');
    }
  }
  for (const m of code.matchAll(TEXT)) {
    const [, , text] = m;
    if (text.includes('${')) continue;
    const line = lineOf(code, m.index);
    // "2 items · Total €14.50" is several pieces the page tends to render in separate elements. Two sentences
    // in one <p> ("Nothing to do. Suspicious.") pass, so they are not flagged.
    if (/[·|•]/.test(text)) {
      problems.push(`line ${line}: "${text}" joins several texts into one. A query matches ONE element's whole text: ` +
        'query the one part the scenario is about (the total, the count, the heading), or a role.');
    }
  }
  return problems;
}
