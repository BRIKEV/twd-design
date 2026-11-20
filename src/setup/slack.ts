import { readFileSync } from 'node:fs';
import { updateEnvFile } from './env-file.ts';

// Setup step 1: the team's Slack app, with their name and color, from the repo's manifest.

export type Terminal = {
  ask: (question: string, fallback?: string) => Promise<string>;
  say: (text: string) => void;
};

const MANIFEST = new URL('../../slack-manifest.yaml', import.meta.url);

/** Asks until `check` accepts the answer (it returns an error message otherwise). */
async function askValid(t: Terminal, question: string, fallback: string | undefined, check: (v: string) => string | null | Promise<string | null>) {
  for (;;) {
    const value = (await t.ask(question, fallback)).trim();
    const problem = await check(value);
    if (!problem) return value;
    t.say(`  ✖ ${problem}`);
  }
}

const toHandle = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** The repo's manifest with the team's branding, without the editing notes. */
export function brandedManifest({ name, handle, color }: { name: string; handle: string; color: string }) {
  return readFileSync(MANIFEST, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .map((line) => line.replace(/\s+# .*$/, ''))
    .join('\n')
    .replace(/^  name: .*$/m, `  name: ${JSON.stringify(name)}`)
    .replace(/^    display_name: .*$/m, `    display_name: ${JSON.stringify(handle)}`)
    .replace(/^  background_color: .*$/m, `  background_color: "${color}"`)
    .replace('TWD Design answers', `${name} answers`)
    .trim();
}

async function slackApi(method: string, token: string) {
  const res = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  return (await res.json()) as { ok: boolean; error?: string; user?: string; team?: string };
}

export async function setupSlack({ ask, say, envFile }: Terminal & { envFile: string }) {
  const t = { ask, say };
  say('\nSlack app\n');

  const name = await askValid(t, 'App name, as people will see it in Slack', 'TWD Design', (v) =>
    !v ? 'The name cannot be empty.' : v.length > 35 ? 'Slack allows up to 35 characters.' : null);
  const handle = await askValid(t, 'Handle people will @mention', toHandle(name), (v) =>
    /^[a-z0-9._-]{1,80}$/.test(v) ? null : 'Use lowercase letters, numbers, dots, dashes or underscores, no spaces.');
  const color = await askValid(t, 'Brand color for the app card', '#123956', (v) =>
    /^#?[0-9a-f]{6}$/i.test(v) ? null : 'Use a hex color, like #123956.');

  const manifest = brandedManifest({ name, handle, color: color.startsWith('#') ? color : `#${color}` });
  say(`
1. Open this link, pick your workspace and click Create:

   https://api.slack.com/apps?new_app=1&manifest_yaml=${encodeURIComponent(manifest)}

2. Install App → Install to Workspace (or Request to Install, if an admin approves apps).
3. Basic Information → App-Level Tokens → Generate Token and Scopes, with the scope connections:write.
4. Basic Information → Display Information: upload your icon (or brand/slack-icon.png from this repo).
`);

  let identity = '';
  const botToken = await askValid(t, 'Bot User OAuth Token (xoxb-…), from Install App', undefined, async (v) => {
    if (!v.startsWith('xoxb-')) return 'That is not a bot token: copy the Bot User OAuth Token (it starts with xoxb-).';
    const r = await slackApi('auth.test', v);
    if (!r.ok) return `Slack rejected the token: ${r.error}.`;
    identity = `@${r.user} in ${r.team}`;
    return null;
  });
  const appToken = await askValid(t, 'App-Level Token (xapp-…), from Basic Information', undefined, async (v) => {
    if (!v.startsWith('xapp-')) return 'That is not an app-level token: it starts with xapp- and needs the connections:write scope.';
    const r = await slackApi('apps.connections.open', v);
    return r.ok ? null : `Slack rejected the token: ${r.error}. Check it has the connections:write scope.`;
  });

  updateEnvFile(envFile, { SLACK_BOT_TOKEN: botToken, SLACK_APP_TOKEN: appToken });
  say(`\n✔ Connected as ${identity}. Saved SLACK_BOT_TOKEN and SLACK_APP_TOKEN to ${envFile}.`);
  say(`  Invite the bot to a channel with /invite @${handle}`);
}
