# Releasing stackledger

A version reaches npm when a commit on `main` changes the `version` in `package.json` (the version pull request is merged) and the owner approves the publishing job; the workflow then creates the tag `v<major>.<minor>.<patch>` and the GitHub release. The owner can also push the tag by hand (to retry, or to release a version whose run he rejected). The workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml). This page says how to release, how the very first version is set up, and how to check what was published.

## What the workflow does

The workflow runs on every push to `main` and on every pushed tag `v*`, in three jobs, so the identity that can publish never exists while dependencies install or run their scripts.

0. **`detect`** has only read access. [`scripts/release-detect.mjs`](../scripts/release-detect.mjs) decides whether the push releases anything, and prints one line saying why:
   - a push to `main` releases only when it moves `main` forward (a merge; never a forced push), changes the `version` in `package.json` against the commit before the push, and the tag `v<version>` does not exist yet. A README fix merged later, while the version still waits for approval, releases nothing;
   - a pushed tag always goes on to `check`;
   - anything else stops here, in seconds, and the run is green. An unreadable `package.json` or a Git failure fails the run.
1. **`check`** has only read access to the repository. It runs [`scripts/check-release-tag.mjs`](../scripts/check-release-tag.mjs) first: the tag must be `v` plus the `version` in `package.json`, digits only (no `-beta`), on a commit that is on `origin/main` (from `main`: the pushed commit, and if the tag already exists it must name that commit). Then `npm ci`, the build, the full test suite and `npm audit` (any vulnerability, or an audit that cannot run, stops the release). Then `node scripts/pack-production.mjs "$RUNNER_TEMP/release"` packs a temporary copy of the built package files with a production-only shrinkwrap derived from the repository lock. It does not mutate the repository lock (which retains dev dependencies for `npm ci`); the staged manifest omits dev dependencies and `prepack`, because the build already ran. The CycloneDX SBOM is generated with `npm sbom --package-lock-only --sbom-format cyclonedx` from the manifest and production shrinkwrap extracted from that exact tarball (not from the development checkout). Two clean registry-stand-in installs test that no dev-only or untracked packages ship (npm 10 may classify locked optional WASM packages as extraneous). The exact staged tarball, its integrity and the SBOM go to the next job as an artifact.
2. **`publish`** runs in the GitHub environment `npm`, which waits for the owner's approval. It installs nothing and builds nothing. It checks out the released commit only to run [`scripts/release-publish.sh`](../scripts/release-publish.sh) on the downloaded files. From `main`, the script first reserves the tag: it creates `v<version>` on the released commit through the GitHub API, which either creates it or answers that it exists. The owner may push the same tag by hand meanwhile; an existing tag must name the released commit, or the script stops and nothing is published. Then it asks npm whether the version exists:
   - absent: it publishes the tarball with `npm publish --provenance --access public --ignore-scripts`;
   - present with the same integrity and a provenance attestation: it skips publishing;
   - present with other bytes, or without provenance, or npm cannot answer: it stops with exit 1 and publishes nothing (a tag reserved before stays).

   Then it creates the GitHub release on the tag (`--verify-tag`) with the SBOM attached, or replaces the SBOM of an existing release. A tag created by the workflow does not start the workflow again (GitHub runs no workflow for events of its own token).

If a run fails part way (npm down after the tag was reserved, or the GitHub release after npm), use "Re-run failed jobs": GitHub keeps the successful `detect` and `check` with their outputs and artifact, and the script finds its own tag on the same commit and the same bytes on npm, and only finishes what is missing. Do not use "Re-run all jobs": `detect` then sees the tag and stops. If the failed run can no longer be re-run (its artifact expires after 7 days), delete the tag (`git push origin :refs/tags/v0.2.0`) and push it again: the tag path releases it.

For release candidates, run `node scripts/pack-production.mjs <destination>` after `npm ci`. Plain `npm pack` at the repository root still runs `prepack` and builds `dist/`, but includes the development shrinkwrap and **must not** be published. Only the staging packer supplies the production-only shrinkwrap. The release workflow uploads precisely its output, not a subsequent root pack.

## Releasing a version

1. In a pull request, set the new version: `npm version 0.2.0 --no-git-tag-version` (it updates `package.json` and `npm-shrinkwrap.json`). The diff shows the line `"version": "0.2.0"`, and that line is what releases. Before the merge, check the trusted publisher (below).
2. Merge it. The run of that merge in the Actions tab goes through `detect` and `check`, then the `publish` job waits for you: review it and approve. To not release it, reject the run; nothing is published and no tag is created.

   Before the first release after the trusted publisher was set up, check its status on npmjs.com (package → Settings → Trusted Publisher). npm marks a new configuration "Pending validation" until a publish uses it, and expires it 48 hours after creation ([GitHub changelog](https://github.blog/changelog/2026-10-02-unvalidated-npm-trusted-publishing-configurations-now-expire/)). An expired configuration no longer authorises publishing, and with no token left the job fails. If it is pending or expired, delete it and add it again with the same values (step 5.1 below) just before merging the version (or pushing the tag): the release then validates it.
3. Check the result (see [Checking a release](#checking-a-release)).

**By hand, or to retry.** Tag the commit on `main` and push the tag:

```sh
git switch main && git pull --ff-only
git tag v0.2.0
git push origin v0.2.0
```

A tag that does not match the version, or a tag on a commit that is not on `main`, fails in the first step of `check`. Delete the tag (`git push origin :refs/tags/v0.2.0`), fix, and tag again.

## Who can release

Three controls, so neither a merge nor a pushed tag alone publishes:

- **The tag check.** Only a commit on `main`, so only merged and reviewed code, is released, and only when its version is the tag's.
- **The environment `npm`.** Its required reviewer is the owner, so every publishing run waits for his approval.
- **The trusted publisher on npm** (after the first version). npm accepts a publication only from the workflow `release.yml` of `brunosouzas/stackledger`, running in the environment `npm`.

The owner also adds a tag ruleset, so a `v*` tag cannot be moved or deleted except by him.

## Setting up the first version

npm lets a package trust a GitHub workflow only once the package exists. So the first version of a package is published with a short-lived token, and the token is removed right after. The owner does every step below; the agent does none of them.

The package is `@brunosouzas/stackledger`, in the npm organisation `brunosouzas`; its first version is 0.4.1. Versions 0.1.0 to 0.4.0 were published by the same workflow under the unscoped name `stackledger` (npm user `bruno_souza`), which is deprecated and points to the scoped name. The command is `stackledger` in both.

### 1. The npm token

1. Sign in to [npmjs.com](https://www.npmjs.com/) with two-factor authentication on ([npm docs](https://docs.npmjs.com/configuring-two-factor-authentication)). The organisation `brunosouzas` must exist, with the owner in it.
2. Create a granular access token ([npm docs](https://docs.npmjs.com/creating-and-viewing-access-tokens)): Access Tokens → Generate New Token → Granular Access Token.
   - Name: `stackledger first release`.
   - Expiration: 7 days.
   - Packages and scopes: permission **Read and write**, not "Read and write (stage only)": a stage-only token cannot run `npm publish`. Select **Only select packages and scopes**, with the scope `@brunosouzas` and no package (the package does not exist yet, and the token needs nothing else).
   - Tick **Bypass two-factor authentication**: the job cannot answer a two-factor prompt. npm is phasing such tokens out for direct publishing; this one lives for one release.
   - Organizations: no access.

   Copy the token once; it is shown only once. Never paste it anywhere but the secret below.

If the publishing job later fails with 403, or with `E404 Not Found - PUT`, the token lacks a permission (npm often reports a missing scope permission as 404): make a new token with Organizations set to read only, replace the secret, and re-run the job.

### 2. The GitHub environment `npm`

For 0.4.1 the environment and the tag ruleset (step 3) already exist from 0.1.0: only the `NPM_TOKEN` environment secret is added again. For a new repository: Settings → Environments → New environment, named `npm` ([GitHub docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)).

- **Required reviewers:** the owner. Leave "Prevent self-review" off: the owner pushes the tag and approves his own run.
- **Deployment branches and tags:** "Selected branches and tags", with the branch rule `main` and the tag rule `v*`.
- **Environment secrets:** add `NPM_TOKEN` with the token from step 1. It is an environment secret, not a repository secret, so only the approved `publish` job can read it.

### 3. The tag ruleset

Settings → Rules → Rulesets → New ruleset → New tag ruleset ([GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)):

- Name: `release tags`; enforcement: Active.
- Target tags: include by pattern `v*`.
- Rules: restrict updates, restrict deletions. Not "restrict creations": the `publish` job creates the tag with the workflow's own token, which the bypass list cannot name (it lists only installed apps).
- Bypass list: Repository admin (the owner), always allowed.

### 4. Release the first version

Follow [Releasing a version](#releasing-a-version) from step 2 (`package.json` already says `0.4.1`):

```sh
git switch main && git pull --ff-only
git tag v0.4.1
git push origin v0.4.1
```

Approve the `publish` job when it waits. npm publishes with the token and with provenance.

### 5. Trusted publishing only

Right after the version is on npm:

1. On npmjs.com, open the package `@brunosouzas/stackledger` → Settings → Trusted Publisher → GitHub Actions ([npm docs](https://docs.npmjs.com/trusted-publishers)): user `brunosouzas`, repository `stackledger`, workflow filename `release.yml`, environment `npm`. Save. The configuration stays "Pending validation" until a release publishes through it, and expires after 48 hours without one; the next release re-creates it if needed (see step 3 of [Releasing a version](#releasing-a-version)).
2. In the same settings, Publishing access: choose "Require two-factor authentication and disallow tokens". From now on only the trusted workflow can publish.
3. Revoke the token: Access Tokens → the `stackledger first release` token → Delete.
4. Delete the environment secret `NPM_TOKEN` in Settings → Environments → `npm`.

The workflow still passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. With the secret gone it is empty, and npm publishes through OpenID Connect: the job proves who it is with a short-lived token from GitHub, and no long-lived npm token exists anywhere.

### 6. Deprecate the unscoped package

Signed in to npm as `bruno_souza`, the owner of the unscoped package, with two-factor authentication. The account `brunosouzas` became the organisation and does not own the unscoped package, so `npm whoami` must print `bruno_souza` first; otherwise npm answers 404. Type the command rather than paste it, so no stray backtick reaches the shell:

```sh
npm whoami
npm deprecate stackledger "Moved to @brunosouzas/stackledger"
```

Without a version range the message applies to every version. They stay installable; `npm install stackledger` and `npx stackledger` show the message.

## Moving to release on merge

Done once, before the first version that should release on merge (AB#172):

1. Settings → Environments → `npm` → Deployment branches and tags: add the branch rule `main` (keep `v*`). Without it the `publish` job of a push to `main` cannot enter the environment.
2. Settings → Rules → Rulesets → `release tags`: untick "Restrict creations" (keep updates and deletions restricted). Without it the reservation fails and nothing is published; after the fix, "Re-run failed jobs".

The trusted publisher on npm does not change: it names the workflow file `release.yml` and the environment `npm`, not the trigger. A GitHub App in the bypass list could keep "Restrict creations", but it adds a long-lived private key to the environment (the release holds no secret today) and its tag push starts the workflow again; revisit it when the repository has other writers.

## Checking a release

**On npm.** The package page on npmjs.com shows a provenance badge naming the repository, the workflow and the commit. From the command line:

```sh
npm view @brunosouzas/stackledger@0.7.0 dist --json   # integrity and attestations.provenance
```

**Signatures and provenance of an install.** In a scratch folder, not in a project:

```sh
mkdir stackledger-check && cd stackledger-check
npm init -y
npm install @brunosouzas/stackledger@0.7.0
npm audit signatures
```

`npm audit signatures` checks the registry signature of every installed package and the provenance attestation of those that have one; stackledger must be counted under "verified attestation". Then delete the folder.

**The SBOM.** The GitHub release of the tag has `stackledger-<version>.cdx.json` attached: a CycloneDX list of the production dependencies with their versions and integrity hashes, the same versions `npm-shrinkwrap.json` locks. To read it:

```sh
gh release download v0.7.0 -R brunosouzas/stackledger -p 'stackledger-*.cdx.json'
```

**What this proves.** Provenance says the tarball on npm was built by `release.yml` in `brunosouzas/stackledger` from the tagged commit; it does not say the code is safe. The SBOM says which dependency versions the package installs, so you can check them against advisories later. The tarball on npm is the one the `check` job tested and audited: `publish` uploads those bytes and builds nothing.
