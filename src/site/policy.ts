/** Fixed files and policy of every built site: the Content Security Policy, `_headers`, `robots.txt`
 * and the output-folder marker (site-security, build-command specs).
 *
 * Why one module: the layout's CSP meta (written into each working copy as src/data/policy.json),
 * the `_headers` file and the output scan all read POLICY from here, so they cannot drift apart.
 * Nothing here depends on the catalogue, the date or the version.
 */
export const POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Cloudflare Pages / Netlify style headers for every path; `frame-ancestors` only works as a header. */
export const HEADERS = [
  '/*',
  `  Content-Security-Policy: ${POLICY}; frame-ancestors 'none'`,
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: no-referrer',
  '  X-Robots-Tag: noindex, nofollow',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
  '',
].join('\n');

export const ROBOTS = 'User-agent: *\nDisallow: /\n';

/** Written at the root of the output folder; its presence lets a later build replace the folder. */
export const MARKER_NAME = '.stackledger-build';
export const MARKER = 'This folder is written by stackledger build. The next build replaces it.\n';
