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
# Environment: RELEASE_TAG (the tag, v<version>; GITHUB_REF_NAME when unset), GH_TOKEN and GH_REPO for
# gh, NODE_AUTH_TOKEN only for the very first version (docs/release.md). RELEASE_COMMIT, when set (a
# release from a push to main), is the commit the tag is reserved on before npm (package-release spec,
# Tag reserved before publishing); when unset (a pushed tag), the tag already exists.
# npm, gh and node must be on PATH. Runs under bash 3.2 too (macOS, the tests).
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
tag=${RELEASE_TAG:-${GITHUB_REF_NAME:?RELEASE_TAG or GITHUB_REF_NAME must hold the release tag}}
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

# Sets found_commit to the commit the tag names on GitHub, or nothing when it does not exist. An
# annotated tag is followed to its commit. It sets a variable rather than printing, so fail stops the
# script (an exit inside $(...) would only leave the subshell).
found_commit=
read_tag_commit() {
  local answer status=0
  found_commit=
  answer=$(gh api "repos/$GH_REPO/git/ref/tags/$tag" --jq '.object.type + " " + .object.sha' 2>&1) || status=$?
  if [ "$status" -ne 0 ]; then
    printf '%s' "$answer" | grep -q 'HTTP 404' && return 0
    fail "cannot read tag $tag on GitHub: $answer"
  fi
  if [ "${answer% *}" = tag ]; then
    status=0
    answer=$(gh api "repos/$GH_REPO/git/tags/${answer#* }" --jq '.object.sha' 2>&1) || status=$?
    [ "$status" -eq 0 ] || fail "cannot read annotated tag $tag on GitHub: $answer"
  else
    answer=${answer#* }
  fi
  found_commit=$answer
}

# 0. From main, reserve the tag on the released commit before npm, atomically: GitHub creates the ref
# or answers 422 (it exists). An existing tag must name the released commit (a re-run of the failed
# publishing job), or nothing is published: the owner may have pushed it by hand meanwhile.
if [ -n "${RELEASE_COMMIT:-}" ]; then
  : "${GH_REPO:?GH_REPO must name the repository}"
  reserve_status=0
  reserve_answer=$(gh api -X POST "repos/$GH_REPO/git/refs" -f "ref=refs/tags/$tag" -f "sha=$RELEASE_COMMIT" 2>&1) || reserve_status=$?
  if [ "$reserve_status" -eq 0 ]; then
    echo "tag $tag created on $RELEASE_COMMIT"
  else
    printf '%s' "$reserve_answer" | grep -q 'HTTP 422' || fail "cannot create tag $tag on GitHub: $reserve_answer; nothing was published"
    read_tag_commit
    [ "$found_commit" = "$RELEASE_COMMIT" ] || fail "tag $tag names ${found_commit:-nothing}, not the released commit $RELEASE_COMMIT; nothing was published"
    echo "tag $tag already names $RELEASE_COMMIT"
  fi
fi

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
