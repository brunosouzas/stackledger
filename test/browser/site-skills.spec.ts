/** Browser checks of the Skills section (skills-site spec) and of the zone filter with a multi-word
 * software zone (catalogue-site, Map interaction). Sites are built by test/browser/serve.mjs: the
 * example with examples/northwind-skills under /full/ and /staff/, and a small catalogue under /extra/
 * (a zone named `Team tools`, one skill line, no playbook zones, no rules). Run npm run test:browser.
 */
import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { cspViolations: string[] }
}

const visibleRows = (page: Page, table = '[data-software]') => page.locator(`${table} tbody tr:visible`);

test('Pages work under the policy', async ({ page }) => {
  test.setTimeout(120_000);
  const problems: string[] = [];
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('pageerror', error => problems.push(error.message));
  page.on('response', response => { if (response.status() >= 400) problems.push(`HTTP ${response.status()} ${response.url()}`); });
  for (const site of ['full', 'staff']) {
    for (const path of ['skills/', 'skill-map/', 'rules/', 'skills/writer/', 'playbooks/publishing/', 'agents/reviewer/']) {
      await page.goto(`/${site}/${path}`);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => window.cspViolations), path).toEqual([]);
    }
  }
  expect(problems).toEqual([]);
});

test.describe('Skills list', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/full/skills/'); });
  test('Search', async ({ page }) => {
    await page.locator('[data-search]').fill('REVIEW');
    const rows = visibleRows(page);
    expect(await rows.count()).toBeGreaterThan(0);
    for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain('review');
  });
  test('Kind filter', async ({ page }) => {
    await page.locator('[data-filter="kind"]').selectOption('playbook');
    await expect(visibleRows(page)).toHaveCount(2);
    for (const kind of await page.locator('[data-software] tbody tr:visible [data-column="kind"]').allInnerTexts()) expect(kind).toBe('playbook');
  });
  test('Nothing matches', async ({ page }) => {
    await page.locator('[data-search]').fill('no-such-skill-anywhere');
    await expect(page.locator('[data-no-match]')).toBeVisible();
  });
});

test.describe('Skills map page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/full/skill-map/'); });
  const svg = (page: Page) => page.locator('.map-canvas.themed-light svg');
  test('Station link', async ({ page }) => {
    await svg(page).locator('g[data-ref="skill:writer"]').click();
    await expect(page).toHaveURL(/\/full\/skills\/writer\/$/);
    await page.goBack();
    await svg(page).locator('g[data-ref="skill:writer"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/full\/skills\/writer\/$/);
  });
  test('Highlight a skill line', async ({ page }) => {
    const chip = page.locator('[data-map-lines] button[data-line="line:publish"]');
    await chip.click();
    await expect(svg(page).locator('g[data-ref="line:change"]')).toHaveClass(/is-dimmed/);
    expect(await svg(page).locator('.is-dimmed[data-line~="line:publish"]').count()).toBe(0);
    await chip.click();
    await expect(svg(page).locator('.is-dimmed')).toHaveCount(0);
  });
  test('Filter by a playbook zone', async ({ page }) => {
    // editor is in both zones, writer only in publishing.
    await page.locator('[data-zone-filter]').selectOption('engineering');
    await expect(svg(page).locator('g[data-ref="skill:writer"]')).toHaveClass(/is-dimmed/);
    await expect(svg(page).locator('g[data-ref="skill:editor"]')).not.toHaveClass(/is-dimmed/);
    await page.locator('[data-zone-filter]').selectOption('publishing');
    await expect(svg(page).locator('g[data-ref="skill:writer"]')).not.toHaveClass(/is-dimmed/);
    await expect(svg(page).locator('g[data-ref="skill:editor"]')).not.toHaveClass(/is-dimmed/);
  });
  test('No zone filter without zones', async ({ page }) => {
    await page.goto('/extra/skill-map/');
    await expect(page.locator('[data-map-tools]')).toBeVisible();
    await expect(page.locator('[data-zone-filter]')).toHaveCount(0);
  });
});

test('Box link', async ({ page }) => {
  await page.goto('/full/skills/writer/');
  const box = page.locator('[data-diagram] .themed-light svg g[data-ref="playbook:publishing"]');
  await box.click();
  await expect(page).toHaveURL(/\/full\/playbooks\/publishing\/$/);
  await page.goBack();
  await box.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/full\/playbooks\/publishing\/$/);
});

test.describe('Rules index', () => {
  test('Search rules', async ({ page }) => {
    await page.goto('/full/rules/');
    await page.locator('[data-search]').fill('voi-01');
    await expect(visibleRows(page)).toHaveCount(1);
    expect((await visibleRows(page).innerText()).toLowerCase()).toContain('voi-01');
  });
  test('No rules', async ({ page }) => {
    await page.goto('/extra/rules/');
    await expect(page.locator('main')).toContainText('No rules');
  });
});

test('Zone with a space in its name', async ({ page }) => {
  await page.goto('/extra/map/');
  const svg = page.locator('.map-canvas.themed-light svg');
  await page.locator('[data-zone-filter]').selectOption('team tools');
  await expect(svg.locator('g[data-ref="component:wiki"]')).not.toHaveClass(/is-dimmed/);
  await expect(svg.locator('g[data-ref="component:ledger"]')).toHaveClass(/is-dimmed/);
});

test.describe('Without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Without JavaScript', async ({ page }) => {
    await page.goto('/staff/skills/');
    const rows = page.locator('[data-software] tbody tr');
    await expect(visibleRows(page)).toHaveCount(await rows.count());
    await expect(page.locator('[data-list-tools]')).toBeHidden();
  });
  test('Map without JavaScript', async ({ page }) => {
    await page.goto('/staff/skill-map/');
    await expect(page.locator('.map-canvas.themed-light svg')).toBeVisible();
    await expect(page.locator('[data-map-tools]')).toBeHidden();
  });
});
