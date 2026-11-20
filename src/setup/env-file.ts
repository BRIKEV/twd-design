import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Sets these variables in the .env file, keeping every other line as it is. */
export function updateEnvFile(path: string, values: Record<string, string>) {
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split('\n') : [];
  if (lines.at(-1) === '') lines.pop();
  for (const [key, value] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
}
