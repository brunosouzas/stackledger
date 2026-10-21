/** Text checks of the release and hosting guides (design D1 first version, D4): each step the
 * owner must do by hand is written down. Run npm test.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('docs/hosting.md protects every address under both applications and checks every anonymous path', () => {
  const hosting = read('docs/hosting.md');
  for (const application of ['stackledger full', 'stackledger staff']) {
    const section = hosting.split(`### ${application}\n`)[1]?.split(/^###? /m)[0] ?? '';
    for (const address of ['catalogue.example.org', '<project>.pages.dev', '*.<project>.pages.dev']) expect(section).toContain(address);
  }
  for (const path of ['/', '/staff/', '/full/', '/full/renewals.ics', '/full/_astro/', '/staff/_astro/']) expect(hosting).toContain(`\`${path}\``);
  for (const term of ['302', 'cloudflareaccess.com', 'staff-only', 'before', 'oauth2-proxy', '--set-xauthrequest', 'Rollback']) expect(hosting).toContain(term);
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
