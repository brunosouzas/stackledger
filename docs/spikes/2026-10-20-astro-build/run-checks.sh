#!/bin/sh
# Spike checks for task 0.1 of the catalogue-site change. Throwaway code.
#
# What: packs stackledger with `npm pack`, installs the tarball into a scratch
# folder, makes that folder read-only and runs the spike build from it:
#   A  with an empty fake HOME and TMPDIR, cwd inside the read-only install;
#   B  with the real HOME and TMPDIR (byte comparison with A);
#   C  under the Node.js permission model, write access only to its --out;
#   C2 the same with SPIKE_LINK=1, expected to fail (fs.symlink is refused);
#   D  with Node 22.12.0, if NODE22 points to that binary.
# Then it checks that the package, HOME and TMPDIR are unchanged, scans the
# output, compares builds byte for byte and runs the Playwright browser check.
# Why: proves design D2/D3/D4 and the version choice before pages are built.
# Run:  sh run-checks.sh <empty scratch folder> [path to node 22.12.0 binary]
#       SPIKE_LINK=1 sh run-checks.sh ...  runs A, B, C and D with the link.
#       Needs network for `npm install` and `npx playwright install chromium`
#       done once beforehand. Output: a log per step in the scratch folder.
# What can go wrong: the install folder is left read-only on failure; the last
# line prints the chmod that makes it removable.
set -eu

S_ARG=${1:?usage: sh run-checks.sh <scratch folder> [node22 binary]}
NODE22=${2:-}
SPIKE_DIR=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$SPIKE_DIR/../../.." && pwd)
SPIKE_REL=docs/spikes/2026-10-20-astro-build
mkdir -p "$S_ARG"
S=$(cd "$S_ARG" && pwd)
step() { printf '\n=== %s\n' "$1"; }

step "npm pack"
TARBALL=$(cd "$REPO" && npm pack --pack-destination "$S" --silent)
echo "$TARBALL ($(du -h "$S/$TARBALL" | cut -f1))"
tar tzf "$S/$TARBALL" | grep -c "$SPIKE_REL" | sed 's/^/spike files in tarball: /'

step "install tarball into $S/install"
mkdir "$S/install"
# Without its own package.json, npm walks up and installs into an ancestor project.
printf '{ "private": true }\n' > "$S/install/package.json"
(cd "$S/install" && npm install --no-fund --no-audit "$S/$TARBALL" 2>&1 | tail -2)
(cd "$S/install" && npm ls astro vite 2>&1 | tail -6)
PKG="$S/install/node_modules/stackledger"
BUILD="$PKG/$SPIKE_REL/build.mjs"

manifest() {
  (cd "$S/install" && find . -print | LC_ALL=C sort && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256)
}
chmod -R a-w "$S/install"
manifest > "$S/install-before.txt"
mkdir "$S/home" "$S/tmp"
REAL_PREFS="$HOME/Library/Preferences/astro/config.json"
PREFS_BEFORE=$(shasum "$REAL_PREFS" 2>/dev/null || echo none)
touch "$S/marker"
sleep 1

step "A: build from read-only install, fake HOME and TMPDIR, cwd read-only"
(cd "$S/install" && HOME="$S/home" TMPDIR="$S/tmp" /usr/bin/time -p node "$BUILD" --out "$S/out-a" --list-writes > "$S/build-a.log" 2>&1) || { cat "$S/build-a.log"; exit 1; }
grep -E '^(built|real|user|sys)' "$S/build-a.log"

step "B: same, real HOME and TMPDIR"
(cd "$S/install" && /usr/bin/time -p node "$BUILD" --out "$S/out-b" > "$S/build-b.log" 2>&1) || { cat "$S/build-b.log"; exit 1; }
grep -E '^(built|real)' "$S/build-b.log"

step "C: Node permission model, write only to out-c"
mkdir "$S/out-c"
(cd "$S/install" && node --permission --allow-fs-read='*' --allow-fs-write="$S/out-c" --allow-addons --allow-child-process --allow-worker "$BUILD" --out "$S/out-c" > "$S/build-c.log" 2>&1) && grep -E '^built' "$S/build-c.log" || { echo "C FAILED:"; tail -15 "$S/build-c.log"; }

if [ -n "$NODE22" ]; then
  step "D: $("$NODE22" --version)"
  (cd "$S/install" && /usr/bin/time -p "$NODE22" "$BUILD" --out "$S/out-d" > "$S/build-d.log" 2>&1) && grep -E '^(built|real)' "$S/build-d.log" || { echo "D FAILED:"; tail -15 "$S/build-d.log"; }
fi

step "C2: Node permission model with the node_modules link (expected to fail)"
mkdir "$S/out-c2"
(cd "$S/install" && SPIKE_LINK=1 node --permission --allow-fs-read='*' --allow-fs-write="$S/out-c2" --allow-addons --allow-child-process --allow-worker "$BUILD" --out "$S/out-c2" > "$S/build-c2.log" 2>&1) && echo "C2 unexpectedly passed" || grep -m1 ERR_ACCESS_DENIED "$S/build-c2.log"

step "check 1: nothing changed in the package, HOME, TMPDIR"
manifest > "$S/install-after.txt"
if cmp -s "$S/install-before.txt" "$S/install-after.txt"; then echo "install tree: identical ($(wc -l < "$S/install-after.txt" | tr -d ' ') manifest lines)"; else echo "install tree: CHANGED"; diff "$S/install-before.txt" "$S/install-after.txt" | head; fi
echo "files newer than marker in install: $(find "$S/install" -newer "$S/marker" | wc -l | tr -d ' ')"
echo "entries in fake HOME: $(find "$S/home" -mindepth 1 | wc -l | tr -d ' '); in fake TMPDIR: $(find "$S/tmp" -mindepth 1 | wc -l | tr -d ' ')"
echo "real astro preference dirs newer than marker: $(find "$HOME/.astro" "$HOME/.config/astro" "$HOME/Library/Preferences/astro" -newer "$S/marker" 2>/dev/null | wc -l | tr -d ' ')"
[ "$PREFS_BEFORE" = "$(shasum "$REAL_PREFS" 2>/dev/null || echo none)" ] && echo "real ~/Library/Preferences/astro/config.json: unchanged" || echo "real astro config: CHANGED"
SYS_TMP=$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null || echo /tmp)
echo "astro/vite/stackledger entries newer than marker in $SYS_TMP and \$TMPDIR: $(find "$SYS_TMP" "${TMPDIR:-/tmp}" -maxdepth 2 -newer "$S/marker" \( -iname '*astro*' -o -iname '*vite*' -o -iname '*stackledger*' -o -iname '*rolldown*' \) -not -path "$S*" 2>/dev/null | wc -l | tr -d ' ')"
echo "out-a top level: $(ls -A "$S/out-a" | tr '\n' ' ')"

step "check 2: output scan"
echo "root-absolute /_astro/ references: $(grep -rlE '(href|src)="/_astro/|url\(/_astro/' "$S/out-a" | wc -l | tr -d ' ')"
echo "inline <script> without src: $(grep -rhoE '<script[^>]*>' --include=*.html "$S/out-a" | grep -vc 'src=' || true)"
echo "<style> or style= in HTML: $(grep -rlE '<style|style=' --include=*.html "$S/out-a" | wc -l | tr -d ' ')"
echo "distinct CSP metas over $(find "$S/out-a" -name '*.html' | wc -l | tr -d ' ') pages:"
grep -rhoE 'http-equiv="Content-Security-Policy" content="[^"]*"' --include=*.html "$S/out-a" | sort | uniq -c

step "check 4: byte-identical builds"
for other in out-b out-c out-d; do
  [ -d "$S/$other/full" ] || continue
  if diff -r "$S/out-a" "$S/$other" > /dev/null; then echo "out-a vs $other: identical"; else echo "out-a vs $other: DIFFERENT"; diff -rq "$S/out-a" "$S/$other" | head; fi
done
(cd "$S/out-a" && find . -type f | LC_ALL=C sort | xargs shasum -a 256) > "$S/out-a.sha256"
echo "files per build: $(wc -l < "$S/out-a.sha256" | tr -d ' ')"

step "check 3: browser (Playwright, chromium)"
node "$REPO/$SPIKE_REL/browser-check.mjs" "$S/out-a" > "$S/browser-a.json" && echo "browser check: ok" || echo "browser check: FAILED (see $S/browser-a.json)"
node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const p of r) {
  if (p.url) console.log(`${p.url.replace(/^http:\/\/[^/]+/, "")} ok=${p.ok} requests=${p.requests.length} failed=${p.failedRequests.length} outside=${p.outsidePrefix.length} cspViolations=${p.violations.length + p.cspConsole.length} errors=${p.errors.length} fonts=[${p.fonts.join(", ")}] script=${p.scriptRan} toggle=${p.toggleWorks}`);
  else console.log(`positive control: ${JSON.stringify(p.violations)} ok=${p.ok}`);
}' "$S/browser-a.json"

chmod -R u+w "$S/install"
echo
echo "done; logs in $S"
