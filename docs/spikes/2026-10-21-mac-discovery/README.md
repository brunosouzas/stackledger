# Spike: reading a Mac without changing it (2026-10-21)

Question: for each discovery source of the `mac-discovery` change, what does the output look like, what does reading it cost, and can it be read without writing anything or using the network?

Method: one Apple silicon Mac on macOS 27, Homebrew 7, npm 11, pipx 1.18. Each command ran once plainly and once inside `sandbox-exec` with this profile:

```
(version 1)
(allow default)
(deny network*)
(deny file-write* (require-not (literal "/dev/null")))
```

Raw output stayed in a scratch folder outside the repository and was deleted. Nothing below names a real item.

## Results

| Source | Command or files | Time | In the sandbox | Notes |
| --- | --- | --- | --- | --- |
| Homebrew formulae and casks | `brew info --json=v2 --installed` (`HOMEBREW_NO_AUTO_UPDATE=1`) | ~1.5 s | Same bytes as outside | Full name, installed versions, `installed_on_request`, `runtime_dependencies` with `declared_directly`; casks have `full_token` and `.app` artifacts. Most installed formulae were dependencies, not requested |
| Homebrew lists | `brew list --formula --versions`, `brew list --cask --versions`, `brew leaves` | ~1–4 s | Not needed | Less data than `brew info` |
| npm globals | `npm ls --global --depth=0 --json` | ~0.8 s | Same bytes | Outside the sandbox every npm run writes a debug log; `--logs-max=0` deletes old logs. The sandbox blocks both, and npm still succeeds |
| pipx | `pipx list --json` | – | Crashes (cannot write its log) | `venvs/<name>/pipx_metadata.json` holds the package and version: read the files instead |
| launchd | `launchctl list` | – | Exits 1 | The plist files in `~/Library/LaunchAgents`, `/Library/LaunchAgents` and `/Library/LaunchDaemons` are readable, except root-only daemons |
| Applications | `plutil -convert json -o - <app>/Contents/Info.plist` | ~1 s for 60 apps | Works | Every bundle converted. Apple apps such as Safari are symbolic links into the system cryptex. App Store apps have `Contents/_MASReceipt` |
| Machine name | `scutil --get ComputerName`, `--get LocalHostName` | ~20 ms | Works | `username - MacBook Air` and `username---MacBook-Air` |
| App Store | `mas list` | – | Not tested | `mas` was not installed |
| mise | `installs/` in the mise data folder | – | Not tested | mise was not installed |

The sandbox also stopped `curl` from connecting and `touch` from creating a file.

## Conclusions

1. Run every program inside the sandbox: it is the only thing that kept npm from writing, and it costs nothing measurable.
2. Use `brew info --json=v2 --installed`: one run gives formulae, casks, the "installed on request" flag and dependencies, and it works offline.
3. Read pipx, mise and launchd from their files; run `plutil` (sandboxed) only to read plists.
4. Check `mas` and mise on a Mac that has them before relying on their fixtures.
