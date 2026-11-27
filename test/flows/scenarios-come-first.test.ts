// Test first. A model that writes a page and then its scenarios guesses the same names and texts twice. In
// the evals, planning the scenarios first and then writing the page to match them ended green 9 of 9 times
// (7 of 9 the other way): the scenarios fix the screens, routes and names the page has to provide.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

const SCENARIOS = `function scenarios() {
  describe('Cart', () => {
    it('goes to checkout', async () => {
      const user = userEvent.setup();
      await user.click(await screenDom.findByRole('button', { name: 'Checkout' }));
      twd.should(await screenDom.findByRole('heading', { name: 'Checkout' }), 'be.visible');
    });
  });
}`;
const PAGE = `<main id="app"><button>Checkout</button></main>\n<script id="scenarios">\n${SCENARIOS}\n</script>`;

describe('Scenarios come first', () => {
  const net = fakeFetch();
  after(() => net.restore());
  const slack = slackWorkspace(net);
  const model = scriptedModel();

  test('The model is told to plan the scenarios before writing the page', async () => {
    model.willDo(decide.reply('What should the cart do?'));

    await slack.ask('U_ANA', 'a cart page');

    const instructions = model.saw(0);
    assert.ok(instructions.includes('Scenarios first'), 'the instructions ask for test first');
    assert.ok(instructions.includes('plan_scenarios'), 'with the tool to plan them');
  });

  test('Planned scenarios come back as the brief for the page, which carries them', async () => {
    const calls = model.calls();
    model.willDo(decide.plan(SCENARIOS), decide.write('cart.html', PAGE), decide.reply('*Cart* — with a checkout button.'));

    const root = await slack.ask('U_ANA', 'a cart page');

    assert.match(model.saw(calls + 1), /Now write the page following the contract/,
      'after planning, the model is told to write the page to match them');
    assert.ok(slack.versions(root)[0].html.includes("findByRole('button', { name: 'Checkout' })"), 'the posted version carries the planned scenarios');
    assert.equal(model.pending(), 0);
  });

  test('A plan that breaks a scenario rule is sent back, and fixed before the page is written', async () => {
    const calls = model.calls();
    const badPlan = SCENARIOS.replace("name: 'Checkout' })", "name: 'Checkout 1' })");
    model.willDo(decide.plan(badPlan), decide.plan(SCENARIOS), decide.write('cart.html', PAGE), decide.reply('*Cart* — with a checkout button.'));

    const root = await slack.ask('U_ANA', 'a cart page');

    assert.match(model.saw(calls + 1), /button \\?"Checkout 1\\?" has a count in its name/, 'the model is told what to fix');
    assert.match(model.saw(calls + 2), /Now write the page following the contract/, 'the fixed plan goes through');
    assert.equal(slack.versions(root).length, 1);
    assert.equal(model.pending(), 0);
  });

});
