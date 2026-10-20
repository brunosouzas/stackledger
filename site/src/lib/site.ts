// The view's SiteData and page-link helpers, shared by every page and component.
// site.json and policy.json are written into the working copy by src/site/build.ts; the shipped
// site/ folder has neither, so it is only ever built through stackledger.
import data from '../data/site.json';
import policyText from '../data/policy.json';

export const site = data;
export const policy: string = policyText;

/** '../' once per folder level of the page, so links work under any path prefix (trailingSlash 'always'). */
export function rootFor(pathname: string): string {
  return '../'.repeat(pathname.split('/').filter(Boolean).length);
}

/** A link from the page at `root` to a site path such as 'software/editor/' ('' is the map). */
export function href(root: string, path: string): string {
  return root + path || './';
}
