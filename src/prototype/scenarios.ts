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
type Viewport = { minWidth?: number; maxWidth?: number };

/** What the page registered: every scenario, and which viewport takes which (twd-js's own answer). */
export type Registry = {
  all: string[];
  names: Record<string, string>;
  /** Ids twd-js runs at the current width; null when the prototype declares no viewports. */
  current: string[] | null;
  named: Record<string, string[]>;
  viewports: Record<string, Viewport>;
};
export type Pass = { viewport: string | null; width: number | null; ids: string[] };

const inRange = ({ minWidth, maxWidth }: Viewport, width: number) =>
  (minWidth === undefined || width >= minWidth) && (maxWidth === undefined || width <= maxWidth);

/**
 * twd-js runs only the scenarios that match the window width, so a prototype with a mobile scenario
 * needs one pass per viewport, each scenario once, the way twd-cli does it: what is in scope at the
 * base width first, then each remaining viewport at a width inside its range. `unmatched` are
 * scenarios tagged with a viewport nobody declared: they would never run.
 */
export function planPasses(r: Registry, baseWidth: number): { passes: Pass[]; unmatched: string[] } {
  if (!r.current) return { passes: [{ viewport: null, width: null, ids: r.all }], unmatched: [] };
  const assigned = new Set<string>();
  const take = (scope: string[]) => {
    const ids = r.all.filter((id) => scope.includes(id) && !assigned.has(id));
    ids.forEach((id) => assigned.add(id));
    return ids;
  };
  const passes: Pass[] = [];
  const base = take(r.current);
  if (base.length) passes.push({ viewport: null, width: null, ids: base });
  for (const [name, vp] of Object.entries(r.viewports)) {
    const ids = take(r.named[name] ?? []);
    if (!ids.length) continue;
    passes.push({ viewport: name, width: inRange(vp, baseWidth) ? baseWidth : (vp.maxWidth ?? vp.minWidth ?? baseWidth), ids });
  }
  return { passes, unmatched: r.all.filter((id) => !assigned.has(id)) };
}

// Runs in the page: the scenarios TWD registered, their full "Suite > test" names, and the viewports.
function readRegistry(): Registry {
  type Handler = { id: string; name: string; parent?: string; type: string };
  const w = window as unknown as {
    __TWD_STATE__?: { handlers: Map<string, Handler> };
    __TWD_VIEWPORTS__?: { viewports?: Record<string, { minWidth?: number; maxWidth?: number }> };
    __testRunner: any;
  };
  const handlers = Array.from(w.__TWD_STATE__?.handlers.values() ?? []);
  const byId = new Map(handlers.map((h) => [h.id, h]));
  const fullName = (h: Handler): string => (h.parent && byId.get(h.parent) ? `${fullName(byId.get(h.parent)!)} > ${h.name}` : h.name);
  const tests = handlers.filter((h) => h.type === 'test');
  const viewports = w.__TWD_VIEWPORTS__?.viewports ?? {};
  const runner = new w.__testRunner({});
  const scoped = Object.keys(viewports).length > 0 && typeof runner.viewportScope === 'function';
  const current: Set<string> | null = scoped ? runner.viewportScope() : null;
  const named: Record<string, string[]> = {};
  if (scoped) for (const name of Object.keys(viewports)) named[name] = Array.from(runner.viewportScope({ viewport: name }) ?? []);
  return {
    all: tests.map((h) => h.id),
    names: Object.fromEntries(tests.map((h) => [h.id, fullName(h)])),
    current: current ? Array.from(current) : null,
    named,
    viewports,
  };
}

// Runs in the page: the given scenarios, with TWD's own runner. A failure carries what the screen showed
// at that moment, so the fix round sees why ("Loading…", an empty list) instead of fixing blind.
function runInPage(ids: string[], names: Record<string, string>): Promise<Result[]> {
  const results: Result[] = [];
  const screen = () => {
    const text = ((document.querySelector('#app') ?? document.body) as HTMLElement).innerText.replace(/\n\s*\n+/g, '\n').trim();
    const shown = text.length > 600 ? `${text.slice(0, 600)}…` : text;
    return `\nThe screen (#app) showed:\n${shown || '(nothing)'}`;
  };
  const runner = new (window as any).__testRunner({
    onStart: (t: any) => { t.status = 'running'; },
    onPass: (t: any) => { t.status = 'done'; results.push({ name: names[t.id], status: 'pass' }); },
    onFail: (t: any, err: Error) => { t.status = 'done'; results.push({ name: names[t.id], status: 'fail', error: (err?.message ?? String(err)) + screen() }); },
    onSkip: (t: any) => { t.status = 'done'; results.push({ name: names[t.id], status: 'skip' }); },
  }, { retryCount: 1 });
  return runner.runByIds(ids).then(() => results);
}

const BASE = { width: 1280, height: 800 };

/** Runs every scenario once: at a desktop size, plus one pass per other viewport the prototype declares. */
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
    await page.setViewport(BASE);
    // No pause between steps: pace is for people watching.
    await page.evaluateOnNewDocument(() => sessionStorage.setItem('twd-pace', '0'));
    const { port } = server.address() as AddressInfo;
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20_000 });
    await page.waitForSelector('#twd-sidebar-root', { timeout: 15_000 });
    const results: Result[] = await Promise.race([
      (async () => {
        const registry = await page.evaluate(readRegistry);
        const { passes, unmatched } = planPasses(registry, BASE.width);
        const out: Result[] = unmatched.map((id) => ({
          name: registry.names[id],
          status: 'fail',
          error: 'Tagged with a viewport that initTWD does not declare, so it never runs. Declare it in viewports or remove the tag.',
        }));
        for (const pass of passes) {
          if (pass.width && pass.width !== BASE.width) await page.setViewport({ ...BASE, width: pass.width });
          const run = await page.evaluate(runInPage, pass.ids, registry.names);
          out.push(...run.map((r) => (pass.viewport ? { ...r, name: `${r.name} (${pass.viewport})` } : r)));
        }
        return out;
      })(),
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

