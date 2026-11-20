export type Edit = { old: string; new: string };

export type EditResult = { ok: true; html: string } | { ok: false; index: number; count: number };

/**
 * Applies exact text replacements, all or nothing: every `old` must appear exactly once in the
 * document as it stands when that edit runs. A miss changes nothing, so the model can retry with a
 * better anchor.
 */
export function applyEdits(html: string, edits: Edit[]): EditResult {
  let out = html;
  for (const [index, e] of edits.entries()) {
    const count = out.split(e.old).length - 1;
    if (count !== 1) return { ok: false, index, count };
    // A function replacement, so `$&`, `$1`… in the new text stay literal.
    out = out.replace(e.old, () => e.new);
  }
  return { ok: true, html: out };
}
