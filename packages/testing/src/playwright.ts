import type { Browser, BrowserContext, Page } from '@playwright/test';
import { writeCapture } from './node.js';
/** Every actor gets independent storage. Service workers blocked so HTTP routing is observable. */
export async function actor(browser: Browser, options: { name: string; viewport: { width: number; height: number }; origins: string[]; allowRequest?: (url: URL) => boolean; clock?: number; seed?: number }): Promise<{ context: BrowserContext; page: Page; assertNetwork: () => void; close: () => Promise<void> }> {
  const origins = new Set(options.origins.map(origin => new URL(origin).origin));
  const violations: string[] = [];
  const context = await browser.newContext({ viewport: options.viewport, serviceWorkers: 'block' });
  try {
    await context.route('**/*', route => {
      const origin = new URL(route.request().url()).origin;
      if (origins.has(origin) && (!options.allowRequest || options.allowRequest(new URL(route.request().url())))) return route.continue();
      violations.push(origin);
      return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      if (origins.has(url.origin) && (!options.allowRequest || options.allowRequest(url))) { socket.connectToServer(); return; }
      violations.push(url.origin);
      socket.close();
    });
    if (options.seed !== undefined) {
      if (!Number.isInteger(options.seed)) throw new Error('integer seed required');
      await context.addInitScript(seed => {
        let state = seed >>> 0;
        Math.random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
      }, options.seed);
    }
    const page = await context.newPage();
    if (options.clock !== undefined) {
      if (!Number.isFinite(options.clock)) throw new Error('finite clock required');
      await page.clock.setFixedTime(options.clock);
    }
    return { context, page, assertNetwork: () => { if (violations.length) throw new Error(`Unexpected network origins: ${violations.join(', ')}`); }, close: () => context.close() };
  } catch (error) { await context.close(); throw error; }
}
/** Caller must first assert app-specific semantics/readiness. Screenshot disables finite animations. */
export async function capture(page: Page, directory: string, index: number, actorName: string) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('fixed viewport required');
  const bytes = await page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false });
  return writeCapture(directory, index, actorName, viewport, bytes);
}
