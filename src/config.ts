// Every environment variable the bot reads, in one place.
// Reference: https://design.twd.dev/docs/reference/configuration · Example: .env.example

const env = process.env;

export const config = {
  slack: {
    botToken: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    // Set → Socket Mode (outbound connection, no public URL). Empty → HTTP events on PORT.
    appToken: env.SLACK_APP_TOKEN,
  },
  // Serves /healthz in both modes, and Slack events in HTTP mode.
  port: Number(env.PORT ?? 3000),
  model: {
    // Any Mastra model router id: zai/glm-5.3-flash, deepseek/deepseek-v4-flash, anthropic/..., openai/...
    id: (env.MODEL ?? 'zai/glm-5.3') as `${string}/${string}`,
    // GLM thinking roughly doubles output tokens and adds minutes per turn. Off unless THINKING=on.
    thinking: env.THINKING === 'on',
    // Thinking only while reading and planning (plan_scenarios); the page is then written without it.
    planThinking: env.PLAN_THINKING === 'on',
  },
  github: {
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_PRIVATE_KEY,
    enabled: Boolean(env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY),
  },
  maxTurnsPerThread: Number(env.MAX_TURNS_PER_THREAD ?? 15),
  // Run each new version's TWD scenarios in headless Chrome and let the model fix failures before
  // posting. On unless SCENARIO_CHECK=off.
  scenarioCheck: env.SCENARIO_CHECK !== 'off',
  // On SIGTERM, how long to wait for running turns before exiting.
  shutdownTimeoutMs: Number(env.SHUTDOWN_TIMEOUT_MS ?? 60_000),
};

export const socketMode = Boolean(config.slack.appToken);

// The API key variable each model provider reads (Mastra model router).
export const PROVIDER_KEYS: Record<string, string> = {
  zai: 'ZHIPU_API_KEY',
  'zai-coding-plan': 'ZHIPU_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Problems that stop the bot from starting, each with what to do about it. */
export function configErrors(): string[] {
  const errors: string[] = [];
  const need = (name: string, why: string) => { if (!env[name]) errors.push(`${name} is missing: ${why}`); };

  need('SLACK_BOT_TOKEN', 'the bot token (xoxb-...) from your Slack app, under OAuth & Permissions.');
  if (!socketMode) {
    need('SLACK_SIGNING_SECRET', 'required in HTTP mode, from your Slack app, under Basic Information. ' +
      'Or set SLACK_APP_TOKEN to use Socket Mode instead.');
  }
  if (env.SLACK_BOT_TOKEN && !env.SLACK_BOT_TOKEN.startsWith('xoxb-')) {
    errors.push('SLACK_BOT_TOKEN should start with xoxb- (use the Bot User OAuth Token, not the user token).');
  }
  if (env.SLACK_APP_TOKEN && !env.SLACK_APP_TOKEN.startsWith('xapp-')) {
    errors.push('SLACK_APP_TOKEN should start with xapp- (an App-Level Token with connections:write).');
  }

  if (!config.model.id.includes('/')) {
    errors.push(`MODEL "${config.model.id}" must be provider/model, e.g. zai/glm-5.3-flash or anthropic/<model>.`);
  } else {
    const keyVar = PROVIDER_KEYS[config.model.id.split('/')[0]];
    if (keyVar) need(keyVar, `the API key for MODEL=${config.model.id}.`);
  }

  if (Boolean(env.GITHUB_APP_ID) !== Boolean(env.GITHUB_PRIVATE_KEY)) {
    errors.push('Set both GITHUB_APP_ID and GITHUB_PRIVATE_KEY to enable GitHub, or neither to run without it.');
  }
  for (const [name, value] of [['PORT', config.port], ['MAX_TURNS_PER_THREAD', config.maxTurnsPerThread], ['SHUTDOWN_TIMEOUT_MS', config.shutdownTimeoutMs]] as const) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`${name} must be a positive number.`);
  }
  return errors;
}
