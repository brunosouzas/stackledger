/** Text checks of the release and hosting guides (design D1 first version, D4): each step the
 * owner must do by hand is written down. Run npm test.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** The text from the heading `heading` (any level) to the next heading of the same or a higher level. */
function section(text: string, heading: string): string {
  const start = text.search(new RegExp(`^(#+) ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n`, 'm'));
  if (start < 0) return '';
  const level = text.slice(start).indexOf(' ');
  const rest = text.slice(start + level + heading.length + 2);
  const end = rest.search(new RegExp(`^#{1,${level}} `, 'm'));
  return end < 0 ? rest : rest.slice(0, end);
}
const addresses = ['catalogue.example.org', '<project>.pages.dev', '*.<project>.pages.dev'];

test('docs/hosting.md describes the personal mode first, with one application and its anonymous checks', () => {
  const hosting = read('docs/hosting.md');
  const personal = section(hosting, 'Personal mode: one application');
  const corporate = section(hosting, 'Corporate mode: two applications');
  expect(personal).not.toBe('');
  expect(hosting.indexOf('Personal mode: one application')).toBeLessThan(hosting.indexOf('Corporate mode: two applications'));
  const application = section(personal, 'stackledger');
  for (const address of addresses) expect(application).toContain(address);
  const checks = section(personal, 'Check the personal site');
  for (const path of ['/', '/full/', '/full/_astro/']) expect(checks).toContain(`\`${path}\``);
  for (const term of ['302', 'cloudflareaccess.com']) expect(checks).toContain(term);
  // One reader: no staff-only identity to test.
  expect(personal).not.toContain('staff-only');
  expect(corporate).toContain('staff-only');
  expect(hosting).toContain('sites: [full]');
});

test('docs/hosting.md protects every address under both corporate applications and checks every anonymous path', () => {
  const hosting = read('docs/hosting.md');
  const corporate = section(hosting, 'Corporate mode: two applications');
  for (const application of ['stackledger full', 'stackledger staff']) {
    for (const address of addresses) expect(section(corporate, application)).toContain(address);
  }
  const checks = section(corporate, 'Check the corporate sites');
  for (const path of ['/', '/staff/', '/full/', '/full/renewals.ics', '/full/_astro/', '/staff/_astro/']) expect(checks).toContain(`\`${path}\``);
  for (const term of ['302', 'cloudflareaccess.com', 'staff-only']) expect(checks).toContain(term);
  for (const term of ['before', 'oauth2-proxy', '--set-xauthrequest', 'Rollback', '_redirects']) expect(hosting).toContain(term);
});

test('docs/release.md has each first-version bootstrap step', () => {
  const release = read('docs/release.md');
  const steps = [
    // npm account and the one-time token.
    /two-factor authentication/i, /granular access token/i, /read and write/i, /all packages/i, /7 days/i,
    /bypass two-factor authentication/i,
    // The environment, its reviewer and its secret.
    /environment `npm`/, /required reviewer/i, /`NPM_TOKEN`/, /environment secret/i,
    // Who may create release tags.
    /tag ruleset/i, /`v\*`/,
    // The release itself.
    /git tag v0\.1\.0/, /git push origin v0\.1\.0/, /approve/i,
    // After the first version: trusted publishing only.
    /trusted publisher/i, /brunosouzas\/stackledger/, /`release\.yml`/, /disallow tokens/i, /revoke the token/i, /delete the (environment )?secret/i,
    // What a release proves and how to check it.
    /npm audit signatures/, /provenance/i, /SBOM/, /cdx\.json/,
  ];
  expect(steps.filter(step => !step.test(release)).map(String)).toEqual([]);
});
