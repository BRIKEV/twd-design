// Loaded before every test file (--import): config.ts reads the environment when it is first
// imported, so the test environment has to exist before that.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

Object.assign(process.env, {
  SLACK_BOT_TOKEN: 'xoxb-test',
  SLACK_APP_TOKEN: 'xapp-test',
  MODEL: 'zai/glm-5.3-flash',
  ZHIPU_API_KEY: 'test-key',
  GITHUB_APP_ID: '12345',
  // On one line, the way it often ends up pasted in a .env: the client must normalize it.
  GITHUB_PRIVATE_KEY: pem.replace(/\n/g, ' '),
  TEST_GITHUB_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  LOG_LEVEL: 'error',
  // Stories that need it plug in a fake: npm test never starts a browser.
  SCENARIO_CHECK: 'off',
});
