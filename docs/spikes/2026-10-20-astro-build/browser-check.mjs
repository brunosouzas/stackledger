/**
 * Browser check for the spike (task 0.1). Throwaway code.
 *
 * What: serves <out> with serve.mjs, opens every page of /full/ and /staff/ in
 * headless Chromium (Playwright) and records failed requests, requests outside
 * the site's prefix, CSP violations (securitypolicyviolation events and console
 * messages), whether the fonts loaded and whether the page script ran.
 * Then a positive control sets a style attribute from script, which the CSP
 * must block, to prove the violation listener works.
 * Why: design D3/D4 must hold in a real browser, not only in a file scan.
 * Run: node browser-check.mjs <out>   (needs `npx playwright install chromium`)
 *      Prints a JSON report; exit 1 if any check fails.
 */
import { chromium } from '@playwright/test';
import { startServer } from './serve.mjs';

const out = process.argv[2];
if (!out) {
  console.error('usage: node browser-check.mjs <out>');
  process.exit(2);
}
const PAGES = ['', 'software/editor/'];
const VIEWS = ['full', 'staff'];

const server = await startServer(out);
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const report = [];
let failed = false;

try {
  for (const view of VIEWS) {
    const prefix = `${origin}/${view}/`;
    for (const path of PAGES) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const record = { url: prefix + path, requests: [], failedRequests: [], outsidePrefix: [], violations: [], cspConsole: [], errors: [] };
      // Runs via CDP before page scripts; it is not subject to the page's CSP.
      await page.addInitScript(() => {
        window.__violations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.__violations.push({ directive: event.violatedDirective, blocked: event.blockedURI, sample: event.sample });
        });
      });
      page.on('request', (request) => {
        record.requests.push(request.url().slice(origin.length));
        if (!request.url().startsWith(prefix)) record.outsidePrefix.push(request.url());
      });
      page.on('requestfailed', (request) => record.failedRequests.push(`${request.url()} ${request.failure()?.errorText}`));
      page.on('response', (response) => { if (response.status() >= 400) record.failedRequests.push(`${response.url()} HTTP ${response.status()}`); });
      page.on('console', (message) => { if (/Content.Security.Policy/i.test(message.text())) record.cspConsole.push(message.text()); });
      page.on('pageerror', (error) => record.errors.push(String(error)));

      await page.goto(prefix + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      record.fonts = await page.evaluate(() => [...document.fonts].map((font) => `${font.family} ${font.status}`));
      record.heeboAvailable = await page.evaluate(() => document.fonts.check('16px Heebo'));
      record.scriptRan = await page.evaluate(() => document.documentElement.classList.contains('js-ran') && document.documentElement.dataset.page);
      await page.click('#toggle');
      record.toggleWorks = await page.evaluate(() => document.body.classList.contains('is-on'));
      record.violations = await page.evaluate(() => window.__violations);

      // Follow the nav link to the other page: it must stay under the prefix.
      const target = path === '' ? 'Editor' : 'Map';
      await Promise.all([page.waitForLoadState('networkidle'), page.click(`nav >> text=${target}`)]);
      record.afterNavigation = page.url();
      if (!page.url().startsWith(prefix)) record.outsidePrefix.push(page.url());

      // Browsers load a font only when text uses it: Heebo (body) must be loaded;
      // Signika is used only on the home page, so elsewhere it stays 'unloaded'.
      // No font may end in 'error'.
      const fontsLoaded = record.fonts.includes('Heebo loaded') && !record.fonts.some((entry) => entry.endsWith(' error'));
      const ok = record.failedRequests.length === 0 && record.outsidePrefix.length === 0 && record.violations.length === 0
        && record.cspConsole.length === 0 && record.errors.length === 0 && fontsLoaded && record.heeboAvailable
        && Boolean(record.scriptRan) && record.toggleWorks;
      record.ok = ok;
      if (!ok) failed = true;
      report.push(record);
      await context.close();
    }
  }

  // Positive control: the listener must see a violation when one happens.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener('securitypolicyviolation', (event) => window.__violations.push(event.violatedDirective));
  });
  await page.goto(`${origin}/full/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.body.setAttribute('style', 'color: red'));
  await page.waitForTimeout(200);
  const control = await page.evaluate(() => window.__violations);
  report.push({ positiveControl: 'style attribute set from script', violations: control, ok: control.length > 0 });
  if (control.length === 0) failed = true;
  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
