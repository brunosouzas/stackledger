## Decision: where the spec lives and what draws it

Chosen: `scripts/how-it-works.json`, drawn by `scripts/site-art.mjs` with the package's `coverTree`, next to `scripts/home-banner.json`. After a design system bump, one command (`node scripts/site-art.mjs`) rewrites all the art the package draws, and the tests say which file is stale. The script checks both specs before it writes the first file.

Rejected: the package's own command (`npx brunosouzas-cover scripts/how-it-works.json --out docs/images/how-it-works.svg`). It needs no code, but a bump would need two commands, and the banner already set the pattern of a spec drawn by `site-art.mjs`.

## Content and layout

The source is the Mermaid block, not the old image. Each node's `<br/>` lines are the box's `text` lines; code (commands, the `catalog/*.yaml` path) is in backticks, which the pieces draw in the monospace stack. The long edge label `npx @brunosouzas/stackledger` is split over two lines. The tab of a `taggedContainer` sits on the left of its top edge, so the arrows that enter the GitHub and Cloudflare containers from above enter right of the tab.

## Test changes

None to existing tests. The new test file is `test/unit/how-it-works.test.ts`.
