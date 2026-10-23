## Decision

Skip folders whose name starts with `.`, not a `.stackledgerignore` for catalogues. The skills walk already skips hidden folders (`skill-source`), so both readers follow one rule. Hidden folders hold tool configuration (`.github`, `.vscode`), never catalogue data, and an ignore file would be a second feature to learn for a case one rule covers. No new code paths: one condition in the existing walk of `src/source.ts`.
