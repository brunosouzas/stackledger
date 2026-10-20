# softwaremetro: project context

Open-source tool that reads a software and licence catalogue (Backstage `catalog-info.yaml` format, kept in a separate Git repository or a local folder) and builds a static website with a metro-map view, a software list and licence reports. Owner: Bruno Souza. Human documentation lives in the brain vault under `10-personal/projects/softwaremetro/`.

## Technology

Stack: TypeScript, Node.js, Astro, zod, vitest, Playwright, GitHub Actions, OpenSpec

Nothing is implemented yet. Until a change delivers code, say "not implemented" instead of describing files that do not exist.

- Build: not applicable yet
- Test: not applicable yet
- Run locally: not applicable yet

## Rules for this repository

- Integration branch: `main`.
- Board area: `setup` (Azure Boards, project `brunosouzas`).
- OpenSpec: yes, see `openspec/`. The order of the planned changes is in `docs/roadmap.md`.
- No real catalogue data in this repository, ever: examples, fixtures, tests and the demo use fictitious companies and people. Bruno's own catalogue lives in a private repository. Reason: a catalogue maps its owner's attack surface (versions, VPN, secret stores).
- The tool only reads the machine it inspects: no `sudo`, no writes outside its output folder, no network calls during discovery, no telemetry.
- A secret value never appears in the catalogue schema. A catalogue entry may name a password-manager item, never hold a credential.
- Public text (README, docs, specs, commit messages) is in English.
