import { existsSync, readFileSync } from 'node:fs';

// skill.md: how the bot works and the rules for prototypes, scenarios and PRs.
// template.html: a working prototype (its scenarios pass in Slack's preview) the model adapts.
// Both are read on every turn, so editing them applies without restarting the bot.
// Next to this file when run with node; Mastra Studio runs a bundle in .mastra/output, so from there
// they are read from src/agent.
const agentFile = (name: string) => {
  const here = new URL(`./${name}`, import.meta.url);
  return existsSync(here) ? here : new URL(`../../src/agent/${name}`, import.meta.url);
};
const SKILL = agentFile('skill.md');
const TEMPLATE = agentFile('template.html');

export function loadInstructions() {
  const skill = readFileSync(SKILL, 'utf8');
  const template = readFileSync(TEMPLATE, 'utf8');
  return `${skill}\n\n## Reference template\n\n\`\`\`html\n${template}\n\`\`\`\n`;
}
