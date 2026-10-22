/** Browser test of the built sites (catalogue-site task 5.1) and of the skills map's Mermaid diagrams
 * (skills-mermaid task 2.2, test/browser/skills-map.spec.ts, which renders offline and does not use the
 * server). Run npm run test:browser; it builds the CLI, then test/browser/serve.mjs builds
 * examples/northwind and serves both sites on one origin.
 * Chromium only: npx playwright install chromium once. Kept apart from npm test (vitest).
 */
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.STACKLEDGER_BROWSER_PORT ?? 4410);

export default defineConfig({
  testDir: 'test/browser',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'list' : 'line',
  use: { baseURL: `http://127.0.0.1:${port}/`, colorScheme: 'light' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } }],
  webServer: {
    command: 'node test/browser/serve.mjs',
    url: `http://127.0.0.1:${port}/full/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
