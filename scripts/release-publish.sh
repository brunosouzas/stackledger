#!/usr/bin/env bash
# Publish one checked stackledger tarball to npm and attach its SBOM to the GitHub release.
#
# Why: the publish job of .github/workflows/release.yml must publish exactly the bytes the check job
# tested, and a re-run after a failure must finish the release without publishing twice. So it asks
# npm first:
#   - the version is absent (npm answers E404): publish with provenance;
#   - the same integrity with a provenance attestation is there: skip publishing;
#   - the same integrity without provenance, another integrity, or any other npm answer: exit 1,
#     before anything changes. Then the GitHub release: create it with the SBOM when it is not found,
#     replace its SBOM when it exists, exit 1 on any other error.
#
# Run (in the publish job, from the checkout of the tagged commit):
#   scripts/release-publish.sh <tarball> <integrity-file> <sbom>
# Environment: GITHUB_REF_NAME (the tag, v<version>), GH_TOKEN and GH_REPO for gh, NODE_AUTH_TOKEN
# only for the very first version (docs/release.md). npm, gh and node must be on PATH.
# Exit 0: published or already published, and the release has the SBOM. 1: stopped, reason on stderr.
# 2: usage. The tarball is data only: npm publishes it with --ignore-scripts and nothing in it runs.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: scripts/release-publish.sh <tarball> <integrity-file> <sbom>" >&2
  exit 2
fi
tarball=$1
integrity_file=$2
sbom=$3
tag=${GITHUB_REF_NAME:?GITHUB_REF_NAME must hold the release tag}
version=${tag#v}
expected=$(tr -d '[:space:]' < "$integrity_file")
if [ -z "$expected" ]; then
  echo "release: $integrity_file holds no integrity" >&2
  exit 1
fi

fail() {
  echo "release: $*" >&2
  exit 1
}

package='@brunosouzas/stackledger'

# 1. npm. stdout holds JSON both on success and on error (npm --json); stderr only the log.
lookup_status=0
lookup=$(npm view "$package@$version" dist --json 2>/dev/null) || lookup_status=$?

if [ "$lookup_status" -ne 0 ]; then
  # Absent only when npm says E404; a network or authentication error must not look like "absent".
  code=$(printf '%s' "$lookup" | node -e '
    let text = ""; process.stdin.on("data", c => text += c).on("end", () => {
      try { process.stdout.write(String(JSON.parse(text).error.code)); } catch { process.stdout.write("unknown"); }
    });')
  [ "$code" = "E404" ] || fail "npm view $package@$version failed ($code); nothing was published"
  echo "$package@$version is not on npm: publishing $tarball"
  npm publish "$tarball" --provenance --access public --ignore-scripts
else
  # Prints "<integrity> <yes|no>", or exits 1 when the answer has no integrity.
  # shellcheck disable=SC2016 # ${...} below is a JavaScript template literal, not shell.
  answer=$(printf '%s' "$lookup" | node -e '
    let text = ""; process.stdin.on("data", c => text += c).on("end", () => {
      let dist; try { dist = JSON.parse(text); } catch { process.exit(1); }
      if (!dist || typeof dist.integrity !== "string" || dist.integrity === "") process.exit(1);
      process.stdout.write(`${dist.integrity} ${dist.attestations?.provenance ? "yes" : "no"}`);
    });') || fail "npm view $package@$version gave no integrity; nothing was published"
  published=${answer% *}
  provenance=${answer##* }
  [ "$published" = "$expected" ] || fail "$package@$version is on npm with integrity $published, not the checked $expected"
  [ "$provenance" = "yes" ] || fail "$package@$version is on npm without provenance; deprecate it and release a new version"
  echo "$package@$version is already on npm with these bytes and provenance: not publishing again"
fi

# 2. The GitHub release.
view_status=0
view_error=$(gh release view "$tag" 2>&1 >/dev/null) || view_status=$?
if [ "$view_status" -eq 0 ]; then
  gh release upload "$tag" "$sbom" --clobber
elif printf '%s' "$view_error" | grep -q 'release not found'; then
  gh release create "$tag" "$sbom" --verify-tag --generate-notes
else
  fail "gh release view $tag failed: $view_error"
fi
echo "release $tag is complete"
