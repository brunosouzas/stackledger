/** Browser checks of the built Northwind sites (catalogue-site task 5.1), served under /full/ and
 * /staff/ of one origin by test/browser/serve.mjs. Run npm run test:browser (Chromium).
 *
 * Every page of both sites is opened under the fixed CSP: no policy violation (DOM event and console),
 * no failed request, no request outside the page's site prefix and none to another origin. Then the
 * interactions of the catalogue-site spec: zoom, reset, pan, zone filter, line highlight, station
 * links (click and Enter), diagram links, search, nothing matches, the remembered theme, and the
 * map and table without JavaScript, and the full site's Reports page and calendar file (licence-reports).
 * Data is the fictitious example in examples/northwind.
 */
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { cspViolations: string[] }
}

interface Watch { problems: string[] }

/** Record CSP violations, failed or off-prefix requests, HTTP errors and console errors of a page. */
async function watch(page: Page, prefix: string): Promise<Watch> {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const result: Watch = { problems: [] };
  // Init scripts run through the DevTools protocol, so the page's own CSP does not block them.
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol === 'data:') return;
    if (url.origin !== origin) result.problems.push(`external request ${request.url()}`);
    else if (!url.pathname.startsWith(prefix)) result.problems.push(`request outside ${prefix}: ${url.pathname}`);
  });
  page.on('requestfailed', request => result.problems.push(`failed request ${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.status() >= 400) result.problems.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' || /Content Security Policy/i.test(message.text())) result.problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => result.problems.push(`page error: ${error.message}`));
  return result;
}

const violations = (page: Page) => page.evaluate(() => window.cspViolations);

/** Every page of one site, found by following its own links from the map page. */
async function crawl(page: Page, prefix: string): Promise<string[]> {
  const seen = new Set<string>([prefix]);
  const queue = [prefix];
  while (queue.length) {
    const path = queue.shift()!;
    await page.goto(path);
    const links = await page.locator('a[href]').evaluateAll(anchors => anchors.map(anchor => (anchor as HTMLAnchorElement).href));
    for (const link of links) {
      const url = new URL(link);
      if (url.pathname.startsWith(prefix) && url.pathname.endsWith('/') && !seen.has(url.pathname)) {
        seen.add(url.pathname);
        queue.push(url.pathname);
      }
    }
  }
  return [...seen].sort();
}

for (const site of ['full', 'staff']) {
  test(`Pages work under the policy and stay in /${site}/ (Two sites on one host)`, async ({ page }) => {
    test.setTimeout(120_000);
    const prefix = `/${site}/`;
    const watched = await watch(page, prefix);
    const paths = await crawl(page, prefix);
    // Map, list, journeys list, reports, 17 components, 14 licences and 7 journeys.
    expect(paths.length).toBeGreaterThanOrEqual(40);
    for (const kind of ['software/', 'licences/', 'journeys/']) expect(paths.some(path => path.startsWith(prefix + kind) && path !== prefix + kind)).toBe(true);
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await violations(page), path).toEqual([]);
      // The page script ran (the theme switch is shown by it).
      await expect(page.locator('[data-theme-switch]'), path).toBeVisible();
    }
    expect(watched.problems).toEqual([]);
  });
}

test('The violation detector works (positive control)', async ({ page }) => {
  await watch(page, '/full/');
  await page.goto('/full/');
  await page.evaluate(() => document.body.setAttribute('style', 'color: red'));
  await expect.poll(() => violations(page)).toContainEqual(expect.stringMatching(/^style-src/));
});

/** viewBox of the light map as numbers. */
async function viewBox(page: Page): Promise<number[]> {
  const value = await page.locator('.map-canvas.themed-light svg').getAttribute('viewBox');
  return (value ?? '').split(' ').map(Number);
}

test.describe('Map page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/full/map/');
  });

  test('Zoom', async ({ page }) => {
    const initial = await viewBox(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const zoomed = await viewBox(page);
    expect(zoomed[2]).toBeCloseTo(initial[2]! / 1.25 / 1.25, 1);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    expect((await viewBox(page))[2]).toBeCloseTo(initial[2]! / 1.25, 1);
    await page.getByRole('button', { name: 'Reset' }).click();
    expect(await viewBox(page)).toEqual(initial);
  });

  test('Pan', async ({ page }) => {
    const initial = await viewBox(page);
    const frame = await page.locator('[data-map]').boundingBox();
    // Near the top-left corner of the frame, which is inside the viewport.
    const start = { x: frame!.x + 40, y: frame!.y + 60 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 120, start.y - 60, { steps: 6 });
    await page.mouse.up();
    const moved = await viewBox(page);
    expect(moved[0]).toBeLessThan(initial[0]!);
    expect(moved[1]).toBeGreaterThan(initial[1]!);
    expect(page.url()).toMatch(/\/full\/map\/$/);
  });

  test('Highlight a line', async ({ page }) => {
    const dimmed = page.locator('.map-canvas.themed-light svg .is-dimmed');
    const chip = page.locator('[data-map-lines] button[data-line="line:ship"]');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(await dimmed.count()).toBeGreaterThan(0);
    // Nothing on the ship line is dimmed; every other line's stroke is.
    expect(await page.locator('.map-canvas.themed-light svg .is-dimmed[data-line~="line:ship"]').count()).toBe(0);
    await expect(page.locator('.map-canvas.themed-light svg g[data-ref="line:design"]')).toHaveClass(/is-dimmed/);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(dimmed).toHaveCount(0);
  });

  test('Zone filter', async ({ page }) => {
    const svg = page.locator('.map-canvas.themed-light svg');
    await page.locator('[data-zone-filter]').selectOption('finance');
    const inZone = svg.locator('g[data-ref^="component:"][data-zone="finance"]');
    expect(await inZone.count()).toBeGreaterThan(0);
    expect(await svg.locator('g[data-ref^="component:"][data-zone="finance"].is-dimmed').count()).toBe(0);
    await expect(svg.locator('g[data-ref="component:github"]')).toHaveClass(/is-dimmed/);
    // A line with no stop in the zone is dimmed; one with a stop there is not.
    await expect(svg.locator('g[data-ref="line:ship"]')).toHaveClass(/is-dimmed/);
    await expect(svg.locator('g[data-ref="line:invoice"]')).not.toHaveClass(/is-dimmed/);
    await page.locator('[data-zone-filter]').selectOption('');
    await expect(svg.locator('.is-dimmed')).toHaveCount(0);
  });

  test('Station link (click)', async ({ page }) => {
    await page.locator('.map-canvas.themed-light svg g[data-ref="component:slack"]').click();
    await expect(page).toHaveURL(/\/full\/software\/slack\/$/);
    await expect(page.locator('h1')).toHaveText('Slack');
  });

  test('Station link (Enter)', async ({ page }) => {
    const station = page.locator('.map-canvas.themed-light svg g[data-ref="component:slack"]');
    await expect(station).toHaveAttribute('role', 'link');
    await station.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/full\/software\/slack\/$/);
  });
});

test.describe('Diagram links', () => {
  test('Neighbourhood box (click and Enter)', async ({ page }) => {
    await page.goto('/full/software/slack/');
    const box = page.locator('.diagram.themed-light svg g[data-ref="resource:licence-slack"]');
    await box.click();
    await expect(page).toHaveURL(/\/full\/licences\/licence-slack\/$/);
    await page.goBack();
    await page.locator('.diagram.themed-light svg g[data-ref="resource:licence-slack"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/full\/licences\/licence-slack\/$/);
  });

  test('Journey strip stop and interchange badge', async ({ page }) => {
    await page.goto('/staff/journeys/ship/');
    await page.locator('.diagram.themed-light svg g[data-ref="component:linear"]').click();
    await expect(page).toHaveURL(/\/staff\/software\/linear\/$/);
    await page.goBack();
    const badge = page.locator('.diagram.themed-light svg g[data-ref^="line:"]:not([data-ref="line:ship"])').first();
    const ref = await badge.getAttribute('data-ref');
    await badge.click();
    await expect(page).toHaveURL(new RegExp(`/staff/journeys/${ref!.slice('line:'.length)}/$`));
  });
});

test.describe('Software list', () => {
  const visibleRows = (page: Page) => page.locator('[data-software] tbody tr:visible');

  test('Search', async ({ page }) => {
    await page.goto('/full/software/');
    const total = await visibleRows(page).count();
    await page.locator('[data-search]').fill('north');
    for (const text of await visibleRows(page).allTextContents()) expect(text.toLowerCase()).toContain('north');
    for (const text of await page.locator('[data-software] tbody tr:not(:visible)').allTextContents()) expect(text.toLowerCase()).not.toContain('north');
    // Case is ignored, and a narrower term hides rows.
    await page.locator('[data-search]').fill('GIT');
    const git = await visibleRows(page).allTextContents();
    expect(git.length).toBeGreaterThan(0);
    expect(git.length).toBeLessThan(total);
    for (const text of git) expect(text.toLowerCase()).toContain('git');
    await expect(page.locator('[data-count]')).toHaveText(`${git.length} of ${total} items shown.`);
  });

  test('Filters', async ({ page }) => {
    await page.goto('/full/software/');
    await page.locator('select[data-filter="kind"]').selectOption('licence');
    const kinds = await page.locator('[data-software] tbody tr:visible td[data-column="kind"]').allTextContents();
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['licence']));
  });

  test('Nothing matches', async ({ page }) => {
    await page.goto('/full/software/');
    await page.locator('[data-search]').fill('zzz-no-such-item');
    await expect(visibleRows(page)).toHaveCount(0);
    await expect(page.locator('[data-no-match]')).toBeVisible();
    await expect(page.locator('[data-no-match]')).toHaveText('No item matches.');
  });
});

test('Theme remembered', async ({ page }) => {
  await page.goto('/full/map/');
  await expect(page.locator('.map-canvas.themed-light')).toBeVisible();
  await page.locator('[data-theme-switch]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/full/software/slack/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-theme-switch]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.diagram.themed-dark')).toBeVisible();
  await expect(page.locator('.diagram.themed-light')).toBeHidden();
});

// catalogue-site "Ink frame" and "Site tokens from the design system".
const frameOf = (page: Page, selector: string) => page.locator(selector).first().evaluate(element => {
  const style = getComputedStyle(element);
  return { width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor, shadow: style.boxShadow };
});

// catalogue-site "Home banner art", "Home links" and "Brand mark": images that follow the width and the theme.
test('Banner keeps its ratio', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/full/');
    const sizes = await page.locator('.home-banner-art').evaluate(image => {
      const box = image.getBoundingClientRect(), container = image.parentElement!;
      const style = getComputedStyle(container);
      return { width: box.width, height: box.height, content: container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    expect(sizes.width, `${width}`).toBeCloseTo(sizes.content, 0);
    expect(sizes.height / sizes.width, `${width}`).toBeCloseTo(420 / 1200, 2);
  }
});

/** Which of the light and dark images of `selector` are shown, and whether each shown one is inline. */
const shownImages = (page: Page, selector: string) => page.locator(selector).evaluateAll(images => images
  .filter(image => getComputedStyle(image).display !== 'none')
  .map(image => [image.getAttribute('src')!.split('/').pop(), getComputedStyle(image).display]));

for (const [how, set] of [
  ['system preference', async (page: Page, scheme: 'light' | 'dark') => { await page.emulateMedia({ colorScheme: scheme }); }],
  ['theme switch', async (page: Page, scheme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: scheme === 'light' ? 'dark' : 'light' });
    const toggle = page.locator('[data-theme-switch]');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
  }],
] as const) {
  test(`Mark follows the theme (${how})`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.goto('/full/map/');
      await set(page, scheme);
      // The brand link is a flex box, so its shown mark is a flex item (computed display block).
      expect((await shownImages(page, '.navbar-brand img')).map(([src]) => src), scheme).toEqual([scheme === 'light' ? 'favicon.svg' : 'brand-mark-dark.svg']);
      // The map canvas and a legend symbol are still blocks after display: revert.
      expect(await page.locator(`.map-canvas.themed-${scheme}`).evaluate(element => getComputedStyle(element).display), scheme).toBe('block');
      expect(await page.locator(`.symbol.themed-${scheme}`).first().evaluate(element => getComputedStyle(element).display), scheme).toBe('block');
    }
  });

  test(`Link icon follows the theme (${how})`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.goto('/extra/');
      await set(page, scheme);
      expect(await shownImages(page, '.home-external img'), scheme).toEqual([[`github-${scheme}.svg`, 'inline']]);
    }
  });
}

test('Card frame in light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/full/');
  expect(await frameOf(page, '.card')).toEqual({ width: '3px', style: 'solid', color: 'rgb(10, 16, 51)', shadow: 'rgb(10, 16, 51) 4px 4px 0px 0px' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
});

test('Card frame in dark', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/full/');
  expect(await frameOf(page, '.card')).toEqual({ width: '3px', style: 'solid', color: 'rgb(10, 16, 51)', shadow: 'rgb(238, 242, 255) 0px 0px 0px 1px, rgb(76, 92, 184) 4px 4px 0px 0px' });
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(28, 28, 28)');
});

test('Pressed chip keeps the dark rim', async ({ page }) => {
  for (const [scheme, shadow] of [['light', 'none'], ['dark', 'rgb(238, 242, 255) 0px 0px 0px 1px']] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/full/map/');
    const chip = page.locator('.line-chips .btn').first();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect((await frameOf(page, '.line-chips .btn[aria-pressed="true"]')).shadow, scheme).toBe(shadow);
  }
});

test('Focus still visible', async ({ page }) => {
  for (const [scheme, accent] of [['light', 'rgb(0, 15, 159)'], ['dark', 'rgb(157, 168, 255)']] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/full/map/');
    const chips = page.locator('.line-chips .btn');
    // Reach the second chip with the keyboard, so the browser treats the focus as keyboard focus.
    await chips.first().focus();
    await page.keyboard.press('Tab');
    const outline = await chips.nth(1).evaluate(element => {
      const style = getComputedStyle(element);
      return { focused: element.matches(':focus-visible'), style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(outline, scheme).toEqual({ focused: true, style: 'solid', width: '3px', color: accent });
    expect((await frameOf(page, '.line-chips .btn')).width, scheme).toBe('3px');
  }
});

test('The Reports page under the CSP', async ({ page }) => {
  const watched = await watch(page, '/full/');
  await page.goto('/full/');
  await page.getByRole('link', { name: 'Reports', exact: true }).first().click();
  await expect(page).toHaveURL(/\/full\/reports\/$/);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
  await expect(page.locator('table[data-report="recurring"] tbody tr').first()).toContainText('GBP');
  await expect(page.locator('[data-theme-switch]')).toBeVisible();
  // The calendar link points at a file of this site, served as a calendar.
  const calendar = await page.request.get(await page.locator('a[href$="renewals.ics"]').evaluate(anchor => (anchor as HTMLAnchorElement).href));
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()['content-type']).toContain('text/calendar');
  expect(await calendar.text()).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(await violations(page)).toEqual([]);
  expect(watched.problems).toEqual([]);
  // The staff site has neither the page nor a link to it.
  await page.goto('/staff/');
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
  expect((await page.request.get('/staff/reports/')).status()).toBe(404);
});

test.describe('Without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('The map and the full table are shown', async ({ page }) => {
    await page.goto('/staff/map/');
    await expect(page.locator('.map-canvas.themed-light svg')).toBeVisible();
    await expect(page.locator('[data-map-tools]')).toBeHidden();
    await expect(page.locator('[data-map-lines]')).toBeVisible();
    await page.goto('/staff/software/');
    const rows = page.locator('[data-software] tbody tr');
    expect(await rows.count()).toBeGreaterThan(20);
    await expect(page.locator('[data-software] tbody tr:visible')).toHaveCount(await rows.count());
    await expect(page.locator('[data-list-tools]')).toBeHidden();
  });
});

// catalogue-site "Interface icons": the zoom icon follows its button's text colour, at rest and on hover.
test('Icon follows the button colour', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/full/map/');
    const button = page.getByRole('button', { name: 'Zoom in' });
    const paint = () => button.evaluate(element => {
      const path = element.querySelector('svg path')!;
      return { text: getComputedStyle(element).color, stroke: getComputedStyle(path).stroke, fill: getComputedStyle(path).fill };
    });
    const rest = await paint();
    expect(rest.stroke, scheme).toBe(rest.text);expect(rest.fill, scheme).toBe('none');
    await button.hover();
    // The button's colour transition is 0.2s; wait until the text colour has settled.
    await expect.poll(async () => (await paint()).text).not.toBe(rest.text);
    await page.waitForTimeout(300);
    const hover = await paint();
    expect(hover.stroke, scheme).toBe(hover.text);expect(hover.fill, scheme).toBe('none');
  }
});

// catalogue-site "Interface icons": the theme switch shows the sun in light and the moon in dark.
test('Theme switch icons', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/full/');
    const shown = await page.locator('[data-theme-switch] svg').evaluateAll(icons => icons
      .filter(icon => icon.getBoundingClientRect().width > 0)
      .map(icon => icon.parentElement!.className));
    expect(shown, scheme).toEqual([scheme === 'light' ? 'icon-sun' : 'icon-moon']);
  }
});
