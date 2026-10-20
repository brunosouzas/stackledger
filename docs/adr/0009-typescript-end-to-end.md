# 9. TypeScript end to end

- Status: Accepted
- Date: 2026-10-20

## Context

stackledger has a command-line tool, a map engine that must also run in the browser, a static site, an MCP server and, later, a Backstage plugin.

## Options considered

1. Go for the CLI and TypeScript for the site.
2. Python for the CLI and TypeScript for the site.
3. TypeScript for everything, on Node.js.

## Decision

Option 3: TypeScript on Node.js 22 or later, published to npm. Astro for the site, zod for the schemas, vitest and Playwright for tests.

## Consequences

- One language, one package manager and one set of types from the catalogue schema to the browser.
- The map engine runs both at build time and in the browser without a second implementation.
- The official MCP SDK and Backstage plugins are TypeScript.
- A single binary download, as Go would give, is not available; users install with npm.
