## Context

The walk of `skills-source` lists each given folder depth first and skips hidden entries and `node_modules` before any other check. The ignore file adds one more skip, right after that one.

## Decisions

### 1. One file per given folder, matched against paths relative to it

`.stackledgerignore` is read only from the top of each given folder that is not itself a skill folder, never from a parent or a sub-folder. So running at the repository root and running on `skills/` can give different sets; the docs say to put the file where the pipeline points the command.

The walk tests folders, links, each skill folder's `SKILL.md` and the `.md` files directly in the top-level `agents/` folder: the entries that can add something to the set. Other files are not tested, so `*.md` written to hide a README does not inflate the count. The path is relative to the given folder, with `/`, and ends in `/` for a folder or a link whose target is a folder. A link is tested by its own path, the name the person sees, so the walk resolves the target first to know whether the `/` belongs; a matched link gets no link warning. Testing `<skill>/SKILL.md` as well as `<skill>/` keeps the `.gitignore` promise: `fixtures/*/SKILL.md` hides those skills, as it would hide the files from Git.

Patterns of one given folder never apply to another given folder, even when the folders overlap: an entry skipped through `repo` can still be read through `repo/skills`. Each walk uses only its own file.

The `ignore` package throws on paths starting with `./` or `../` and on an empty path. Tested paths are always relative to the given folder and never empty, and hidden entries (which include `.` and `..`) are skipped before the test.

### 2. The `ignore` package

`ignore@7.0.13` (MIT, no dependencies, about 130 kB unpacked) implements the `.gitignore` rules: blank lines and `#` comments, `\#` and `\!` escapes, trailing spaces, `!` negation with the last match winning, anchoring, a trailing `/` for folders only, `*`, `?`, `[...]` and `**`, CRLF and a byte-order mark. Each line means what it means to `ignore@7.0.13`, which matches `git check-ignore` on the cases checked (`[z-a]` matches `z`, as in Git; `a[` and a lone `\` match nothing). Matching is case-sensitive (`ignorecase: false`), so the same names give the same result on macOS and Linux. Names are compared as stored: a name in decomposed Unicode does not match a pattern written composed. Writing our own matcher was rejected: the edge cases are many, and getting one wrong hides a skill silently.

A folder that matches is not entered, so nothing below it can be re-included, which is also Git's rule.

### 3. Failure is visible and never hides anything

An ignore file that is too large, unreadable, secret-bearing or not a regular file is an error, and the folder is then walked with no patterns. Hiding more than intended would be silent; reading too much is loud (the run shows the template's warnings) and the error says why. The error is reported once per run, at the first path in walk order, like the other problems of an item reached twice.

The limit is 64 KiB, not the 1 MiB of other files. The cost of matching is entries times lines: a 1 MiB file holds about 96,000 patterns, and 1,000 tests against it took 79 s in the review. A pull request from a fork must not be able to stall a CI run, and no real ignore file comes near 64 KiB.

No line gives a problem: the `ignore` package does not report lines it cannot use, so a warning would mean parsing the patterns ourselves.

### 4. The `ignored` count and list

Each entry skipped by a pattern counts once per run, identified by device and inode, so a folder given twice counts its skipped entries once. A skipped folder counts as one, whatever it holds, so `fixtures/` counts one and `fixtures/*` counts each entry. Hidden entries and `node_modules` do not count: they are a fixed rule, not a choice in the file. The JSON output also lists the skipped paths, so a team can see what a pattern hid, and a pipeline can refuse unexpected ignores (`jq -e '.summary.ignored == 2'`).

### 5. Release

The `skills` command has not been released (npm `stackledger@0.1.0` has no `dist/skills/`), so adding `ignored` to the counts line and the JSON is not a breaking change only if this change ships in the same release as `skills-source`.

## Risks

- The ignore file is hidden (its name starts with `.`), so a person may forget it exists; the `ignored` count, the JSON list and the docs make it visible.
- `.gitignore` is not read: a local build copy that Git ignores (for example a `dist/` holding copied skills) gives duplicate-name errors on a laptop and not in CI. The docs say so and suggest adding such folders to `.stackledgerignore`.
