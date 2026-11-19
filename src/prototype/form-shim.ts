// Slack previews the .html in a sandboxed iframe without `allow-forms`, which
// blocks every form submission: the `submit` event never fires. The skill asks
// the model to include this shim, but a forgotten shim fails silently, so the
// bot also injects it whenever the prototype has a <form> and lacks one.

const MARKER = 'twd-design:form-shim';

const SHIM = `<script>
  // PROTOTYPE ONLY (${MARKER}): Slack's preview sandbox blocks form submission. This re-dispatches it
  // as a plain \`submit\` event (after native validation) so the forms work there too. Do not port.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[type=submit], button:not([type]), input[type=submit]');
    const form = btn && btn.form;
    if (!form) return;
    e.preventDefault();
    if (!form.noValidate && !form.reportValidity()) return;
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: btn }));
  }, true);
</script>`;

export function ensureFormShim(html: string): string {
  if (!/<form[\s>]/i.test(html)) return html;
  // Already there: the model copied the skill's shim or an earlier turn injected it.
  if (html.includes(MARKER) || html.includes('new SubmitEvent(')) return html;
  const body = html.match(/<body[^>]*>/i);
  if (body?.index !== undefined) {
    const at = body.index + body[0].length;
    return `${html.slice(0, at)}\n${SHIM}\n${html.slice(at)}`;
  }
  return `${SHIM}\n${html}`;
}
