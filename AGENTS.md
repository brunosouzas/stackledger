# stackledger: project context

Open-source software governance tool. It reads a software and licence catalogue (Backstage `catalog-info.yaml` format, kept in a separate Git repository or a local folder) and builds a static website with a metro-map view, a software list and licence reports. Owner: Bruno Souza. Human documentation lives in the brain vault under `10-personal/projects/stackledger/`.

## Technology

Stack: TypeScript, Node.js, Astro, zod, vitest, Playwright, GitHub Actions, OpenSpec

Implemented: the catalogue format and `stackledger validate` (`catalogue-model`), the SVG map engine and `stackledger map` (`metro-map-engine`), the read-only MCP server with the `full` and `staff` views (`mcp-server`), `stackledger build` with the static `full` and `staff` sites (`catalogue-site`), the licence report: `stackledger report`, the Reports page and `renewals.ics` of the `full` site (`licence-reports`), and Mac discovery: `stackledger discover`, `stackledger drift` with `--scaffold` and the `stackledger/<source>` annotations (`mac-discovery`). The publishable npm package, owner-approved release workflow, catalogue repository pipeline template and protected hosting recipes (`catalogue-deployment`) are implemented; 0.1.0 is not yet released. The rest of the roadmap is not implemented: say so instead of describing files that do not exist.

Layout: `src/` the CLI and its modules (`src/map/` map engine and diagrams, `src/site/` site data, build, publication, `src/discovery/` the Mac sources, sandboxed runner and snapshot); `site/` the Astro project shipped in the package and copied into the build's staging folder; `test/unit`, `test/integration` (vitest) and `test/browser` (Playwright); `examples/northwind/` the fictitious example catalogue and `examples/northwind-machine/` its fictitious Mac snapshot.

- Build: `npm run build`
- Test: `npm test` (vitest; build first for CLI integration tests)
- Timing test: `npm run test:perf` (alone, after the build)
- Browser test: `npm run test:browser` (Playwright with Chromium; `npx playwright install chromium` once)
- Run locally: `node dist/cli.js --help`

## Rules for this repository

- Integration branch: `main`.
- Releases only via a version tag and an owner-approved environment (`npm`); see `docs/release.md`. Never publish from a local agent session.
- Board area: `setup` (Azure Boards, project `brunosouzas`).
- OpenSpec: yes, see `openspec/`. The order of the planned changes is in `docs/roadmap.md`.
- Project-wide decisions are ADRs in `docs/adr/` (index in `docs/adr/README.md`). Read them before a design; a change that contradicts one needs a new ADR that supersedes it, and the README's short explanation of that decision is updated in the same pull request.
- No real catalogue data in this repository, ever: examples, fixtures, tests and the demo use fictitious companies and people. Bruno's own catalogue lives in a private repository. Reason: a catalogue maps its owner's attack surface (versions, VPN, secret stores).
- The tool only reads the machine it inspects: no `sudo`, no writes outside its output folder, no network calls during discovery, no telemetry.
- Discovery tests never use real machine data: fake hosts, fake programs and temporary folders only (`test/virtual-host.ts`, `test/integration/discover-helpers.ts`). Never run `brew`, `npm`, `pipx` or `mas` plainly to look at something, never read or write the real `~/.stackledger`, and use `username` in every `/Users/` path (a docs test checks it). Tests that need the real sandbox or `plutil` run only on macOS (`describe.runIf(onMac)` from `test/discovery-helpers.ts`, that is `process.platform === 'darwin'`).
- A secret value never appears in the catalogue schema. A catalogue entry may name a password-manager item, never hold a credential.
- Public text (README, docs, specs, commit messages) is in English.
