// Page first, then scenarios. A model that writes a page and its scenarios in one go guesses the texts
// twice and gets them out of step. So every new version is rendered first, and the model writes the
// scenarios against what each screen really shows, the way you write a test for a page that exists.

import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { setScenarioCheck, setScreensSnapshot } from '../../src/agent/agent.ts';
import { fakeFetch } from '../helpers/fake-fetch.ts';
import { decide, scriptedModel } from '../helpers/scripted-model.ts';
import { slackWorkspace } from '../helpers/slack-workspace.ts';

const PAGE = `<main id="app"><h1>Cart</h1><p>2 items · <strong>€25.00</strong></p><button>Checkout</button></main>
<script id="scenarios">
function scenarios() {}
</script>`;
const SCREENS = `Screen #/cart
  heading 1 "Cart"
  text "2 items · "
  text "€25.00"
  button "Checkout"`;
const SCENARIOS = `function scenarios() {
  describe('Cart', () => {
    it('goes to checkout', async () => {
      twd.should(await screenDom.findByText('2 items ·'), 'be.visible');
    });
  });
}`;

describe('Scenarios are written against the rendered page', () => {
  const net = fakeFetch();
  const slack = slackWorkspace(net);
  const model = scriptedModel();
  const rendered: string[] = [];
  setScreensSnapshot(async (html) => { rendered.push(html); return SCREENS; });
  setScenarioCheck(async () => ({ passed: 1, failed: [], skipped: 0, pageErrors: [], ms: 900 }));
  after(() => { net.restore(); setScreensSnapshot(null); setScenarioCheck(null); });

  test('A new version: the page is written, rendered, and then its scenarios are written from the screens', async () => {
    model.willDo(
      decide.write('cart.html', PAGE), decide.reply('The page is ready.'),
      decide.scenarios(SCENARIOS), decide.reply('*Cart* — your cart with a checkout button.'),
    );

    const root = await slack.ask('U_ANA', 'a cart page');

    assert.equal(rendered.length, 1, 'the page was rendered once, before the scenarios');
    assert.ok(rendered[0].includes('function scenarios() {}'), 'it was rendered as the model wrote it, without scenarios');
    const firstCall = model.saw(0);
    assert.ok(firstCall.includes('Scenarios come second'), 'the model was told to write only the page first');
    const scenariosCall = model.saw(2);
    assert.ok(scenariosCall.includes('text \\"2 items · \\"'), 'the model saw each screen, with the sentence as the browser splits it');
    const html = slack.versions(root)[0].html;
    assert.ok(html.includes("findByText('2 items ·')"), 'the posted version carries the scenarios written from the screens');
    assert.ok(html.includes('<p>2 items · <strong>€25.00</strong></p>'), 'and the page as written');
    const reply = slack.botReplies(root).filter((m) => m.html).at(-1)!.text!;
    assert.match(reply, /^\*Cart\* — your cart with a checkout button\./, 'the reply comes from the step that knows the scenarios');
    assert.equal(model.pending(), 0);
  });

  test('A prototype from before scenarios had their own block is told to use edit_prototype', async () => {
    model.willDo(
      decide.write('old.html', '<main id="app"><button>Save</button></main>'), decide.reply('The page is ready.'),
      decide.scenarios(SCENARIOS), decide.reply('*Old* — saved.'),
    );

    await slack.ask('U_ANA', 'an old style page');

    assert.ok(model.lastSaw().includes('Change its scenarios with edit_prototype'), 'the model learns why write_scenarios did nothing');
  });
});
