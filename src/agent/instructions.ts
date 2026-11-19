import { readFileSync } from 'node:fs';

// skill.md: how the bot works and the rules for prototypes, scenarios and PRs.
// template.html: a working prototype (its scenarios pass in Slack's preview) the model adapts.
// Both are read on every turn, so editing them applies without restarting the bot.
const SKILL = new URL('./skill.md', import.meta.url);
const TEMPLATE = new URL('./template.html', import.meta.url);

export function loadInstructions() {
  const skill = readFileSync(SKILL, 'utf8');
  const template = readFileSync(TEMPLATE, 'utf8');
  return `${skill}\n\n## Reference template\n\n\`\`\`html\n${template}\n\`\`\`\n`;
}
