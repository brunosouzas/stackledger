## Context

The walk of `skills-source` lists each given folder depth first and skips hidden entries and `node_modules` before any other check. The ignore file adds one more skip, right after that one.

## Decisions

### 1. One file per given folder, matched against paths relative to it

`.stackledgerignore` is read only from the top of each given folder that is not itself a skill folder. Every entry the walk meets below that folder is tested with its path relative to the folder, using `/`, with a trailing `/` for folders and folder links, as `.gitignore` expects. A folder link is tested by its own path, not its target's, because that is the name the person sees. Patterns of one given folder never apply to another given folder, even when the folders overlap: each walk uses only its own file.

### 2. The `ignore` package

`ignore@7.0.13` (MIT, no dependencies, about 130 kB unpacked) implements the `.gitignore` rules: blank lines and `#` comments, `\#` and `\!` escapes, trailing spaces, `!` negation with the last match winning, a leading `/` to anchor, a trailing `/` for folders only, `*`, `?`, `[...]` and `**`. Matching is case-sensitive (`ignorecase: false`), so the same file gives the same result on macOS and Linux. Writing our own matcher was rejected: the edge cases are many and well known, and getting one wrong hides a skill silently.

A folder that matches is not entered, so nothing below it can be re-included, which is also Git's rule.

### 3. Failure is visible and never hides anything

A too-large, unreadable or secret-bearing ignore file is an error, and the folder is then walked with no patterns. Hiding more than intended would be silent; reading too much is loud (the run shows the template's warnings) and the error says why. A line that is not a valid pattern matches nothing and gives no problem: Git does the same, and `ignore@7.0.13` drops such lines without telling (checked: `[z-a]`, `a[`, a lone `\\`), so a warning would mean parsing the patterns ourselves.

### 4. The `ignored` count

Each entry skipped by a pattern counts once (a skipped folder counts as one, whatever it holds). Hidden entries and `node_modules` do not count: they are a fixed rule, not a choice in the file.

## Risks

- The ignore file is hidden (its name starts with `.`), so a person may forget it exists; the `ignored` count and the docs make it visible.
