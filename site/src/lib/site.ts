// The view's SiteData and page-link helpers, shared by every page and component.
// site.json and policy.json are written into the working copy by src/site/build.ts; the shipped
// site/ folder has neither, so it is only ever built through stackledger.
import data from '../data/site.json';
import policyText from '../data/policy.json';

// SiteData of src/site/data.ts; `skills` is there only when the build has a skill set.
// The working copy is built outside this repository, so the shape is not imported from src/: pages
// are checked by the build tests (test/integration/site-skills.test.ts), not by a type check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const site = data as typeof data & { skills?: any };
export const policy: string = policyText;

/** '../' once per folder level of the page, so links work under any path prefix (trailingSlash 'always'). */
export function rootFor(pathname: string): string {
  return '../'.repeat(pathname.split('/').filter(Boolean).length);
}

/** A link from the page at `root` to a site path such as 'software/editor/' ('' is the map). */
export function href(root: string, path: string): string {
  return root + path || './';
}
