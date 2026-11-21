import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser } from 'puppeteer';
import { errorFields, log } from '../log.ts';

// Runs a prototype's TWD scenarios in headless Chrome, the way twd-cli does: Puppeteer only opens
// the page, the scenarios run inside it with TWD's own runner. The page is served from 127.0.0.1
// because the router uses history and hashes, which about:blank doesn't allow.

export type ScenarioFailure = { name: string; error: string };
export type ScenarioReport = { passed: number; failed: ScenarioFailure[]; skipped: number; pageErrors: string[]; ms: number };

/** What checking a prototype answers: a report, or why there is none (no browser, the page broke). */
export type ScenarioCheck = (html: string) => Promise<ScenarioReport | { unavailable: string }>;

let browser: Promise<Browser> | undefined;
// Chrome holds ~150 MB while open. It stays open between versions of a conversation, and closes after
// a few idle minutes so a small instance (512 MB) only pays for it while people are iterating.
const IDLE_MS = 3 * 60_000;
let idleTimer: NodeJS.Timeout | undefined;

async function getBrowser() {
  clearTimeout(idleTimer);
  browser ??= import('puppeteer').then(({ default: puppeteer }) =>
    puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }));
  try {
    return await browser;
  } catch (err) {
    browser = undefined; // try again next time
    throw err;
  }
}

export async function closeBrowser() {
  const b = browser;
  browser = undefined;
  await (await b?.catch(() => undefined))?.close().catch(() => {});
}

function serve(html: string): Promise<Server> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

type Result = { name: string; status: string; error?: string };

// Runs in the page: every scenario TWD registered, with its full "Suite > test" name.
function runAllInPage(): Promise<Result[]> {
  type Handler = { id: string; name: string; parent?: string; type: string };
  const w = window as unknown as { __TWD_STATE__?: { handlers: Map<string, Handler> }; __testRunner: any };
  const handlers = Array.from(w.__TWD_STATE__?.handlers.values() ?? []);
  const byId = new Map(handlers.map((h) => [h.id, h]));
  const fullName = (h: Handler): string => (h.parent && byId.get(h.parent) ? `${fullName(byId.get(h.parent)!)} > ${h.name}` : h.name);
  const ids = handlers.filter((h) => h.type === 'test').map((h) => h.id);
  const results: Result[] = [];
  const runner = new w.__testRunner({
    onStart: (t: any) => { t.status = 'running'; },
    onPass: (t: any) => { t.status = 'done'; results.push({ name: fullName(byId.get(t.id)!), status: 'pass' }); },
    onFail: (t: any, err: Error) => { t.status = 'done'; results.push({ name: fullName(byId.get(t.id)!), status: 'fail', error: err?.message ?? String(err) }); },
    onSkip: (t: any) => { t.status = 'done'; results.push({ name: fullName(byId.get(t.id)!), status: 'skip' }); },
  }, { retryCount: 1 });
  return runner.runByIds(ids).then(() => results);
}

/** Runs every scenario once, at a desktop size. */
export const runScenarios: ScenarioCheck = async (html) => {
  const started = Date.now();
  let b: Browser;
  try {
    b = await getBrowser();
  } catch (err) {
    log.warn('scenario check unavailable: no headless browser', errorFields(err));
    return { unavailable: `no headless browser (${(err as Error).message})` };
  }
  const server = await serve(html);
  const page = await b.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push((err as Error).message));
  try {
    await page.setViewport({ width: 1280, height: 800 });
    // No pause between steps: pace is for people watching.
    await page.evaluateOnNewDocument(() => sessionStorage.setItem('twd-pace', '0'));
    const { port } = server.address() as AddressInfo;
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForSelector('#twd-sidebar-root', { timeout: 15_000 });
    const results: Result[] = await Promise.race([
      page.evaluate(runAllInPage),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('the scenarios took more than 60 s')), 60_000)),
    ]);
    if (!results.length) {
      results.push({ name: 'Scenarios', status: 'fail', error: 'No scenario ran. Keep the initTWD block with 3–5 scenarios.' });
    }
    return {
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').map((r) => ({ name: r.name, error: r.error ?? '' })),
      skipped: results.filter((r) => r.status === 'skip').length,
      pageErrors,
      ms: Date.now() - started,
    };
  } catch (err) {
    // The page never got to run its scenarios: that is a broken prototype, not a missing browser.
    return { passed: 0, failed: [{ name: 'Loading the prototype', error: (err as Error).message }], skipped: 0, pageErrors, ms: Date.now() - started };
  } finally {
    await page.close().catch(() => {});
    server.close();
    idleTimer = setTimeout(() => void closeBrowser(), IDLE_MS);
    idleTimer.unref();
  }
};
