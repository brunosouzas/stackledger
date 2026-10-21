# Releasing stackledger

A version reaches npm only one way: the owner pushes a tag `v<major>.<minor>.<patch>` on a commit already on `main`, and approves the publishing job. The workflow is [`.github/workflows/release.yml`](../.github/workflows/release.yml). This page says how to release, how the very first version is set up, and how to check what was published.

## What the workflow does

Two jobs, so the identity that can publish never exists while dependencies install or run their scripts.

1. **`check`** has only read access to the repository. It runs [`scripts/check-release-tag.mjs`](../scripts/check-release-tag.mjs) first: the tag must be `v` plus the `version` in `package.json`, digits only (no `-beta`), on a commit that is on `origin/main`. Then `npm ci`, the build, the full test suite and `npm audit` (any vulnerability, or an audit that cannot run, stops the release). Then `node scripts/pack-production.mjs "$RUNNER_TEMP/release"` packs a temporary copy of the built package files with a production-only shrinkwrap derived from the repository lock. It does not mutate the repository lock (which retains dev dependencies for `npm ci`); the staged manifest omits dev dependencies and `prepack`, because the build already ran. The CycloneDX SBOM is generated with `npm sbom --package-lock-only --sbom-format cyclonedx` from the manifest and production shrinkwrap extracted from that exact tarball (not from the development checkout). Two clean registry-stand-in installs test that no dev-only or untracked packages ship (npm 10 may classify locked optional WASM packages as extraneous). The exact staged tarball, its integrity and the SBOM go to the next job as an artifact.
2. **`publish`** runs in the GitHub environment `npm`, which waits for the owner's approval. It installs nothing and builds nothing. It checks out the tagged commit only to run [`scripts/release-publish.sh`](../scripts/release-publish.sh) on the downloaded files. The script asks npm whether the version exists:
   - absent: it publishes the tarball with `npm publish --provenance --access public --ignore-scripts`;
   - present with the same integrity and a provenance attestation: it skips publishing;
   - present with other bytes, or without provenance, or npm cannot answer: it stops with exit 1 and changes nothing.

   Then it creates the GitHub release for the tag with the SBOM attached, or replaces the SBOM of an existing release.

If a run fails after npm publishing (for example while creating the GitHub release), use "Re-run failed jobs". The script sees the same bytes on npm and only finishes the release.

For release candidates, run `node scripts/pack-production.mjs <destination>` after `npm ci`. Plain `npm pack` at the repository root still runs `prepack` and builds `dist/`, but includes the development shrinkwrap and **must not** be published. Only the staging packer supplies the production-only shrinkwrap. The release workflow uploads precisely its output, not a subsequent root pack.

## Releasing a version

1. In a pull request, set the new version: `npm version 0.2.0 --no-git-tag-version` (it updates `package.json` and `npm-shrinkwrap.json`). Merge it.
2. Tag the merge commit on `main` and push the tag:

   ```sh
   git switch main && git pull --ff-only
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. Open the run in the Actions tab. When `check` has passed, the `publish` job waits for you: review it and approve.
4. Check the result (see [Checking a release](#checking-a-release)).

A tag that does not match the version, or a tag on a commit that is not on `main`, fails in the first step of `check`. Delete the tag (`git push origin :refs/tags/v0.2.0`), fix, and tag again.

## Who can release

Three controls, so a pushed tag alone never publishes:

- **The tag check.** Only a commit on `main`, so only merged and reviewed code, is released.
- **The environment `npm`.** Its required reviewer is the owner, so every publishing run waits for his approval.
- **The trusted publisher on npm** (after the first version). npm accepts a publication only from the workflow `release.yml` of `brunosouzas/stackledger`, running in the environment `npm`.

The owner also adds a tag ruleset, so only he can create `v*` tags.

## Setting up the first version

npm lets a package trust a GitHub workflow only once the package exists. So version 0.1.0 is published with a short-lived token, and the token is removed right after. The owner does every step below; the agent does none of them.

### 1. The npm account

1. Sign in to [npmjs.com](https://www.npmjs.com/) and turn on two-factor authentication for the account ([npm docs](https://docs.npmjs.com/configuring-two-factor-authentication)), if it is not on yet.
2. Create a granular access token ([npm docs](https://docs.npmjs.com/creating-and-viewing-access-tokens)): Access Tokens → Generate New Token → Granular Access Token.
   - Name: `stackledger first release`.
   - Expiration: 7 days.
   - Packages and scopes: permission **Read and write**, for **All packages** (the package does not exist yet, so it cannot be selected).
   - Tick **Bypass two-factor authentication**: the job cannot answer a two-factor prompt.
   - Organisations: no access.

   Copy the token once; it is shown only once. Never paste it anywhere but the secret below.

### 2. The GitHub environment `npm`

In the repository: Settings → Environments → New environment, named `npm` ([GitHub docs](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)).

- **Required reviewers:** the owner. Leave "Prevent self-review" off: the owner pushes the tag and approves his own run.
- **Deployment branches and tags:** "Selected branches and tags", with the tag rule `v*`.
- **Environment secrets:** add `NPM_TOKEN` with the token from step 1. It is an environment secret, not a repository secret, so only the approved `publish` job can read it.

### 3. The tag ruleset

Settings → Rules → Rulesets → New ruleset → New tag ruleset ([GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)):

- Name: `release tags`; enforcement: Active.
- Target tags: include by pattern `v*`.
- Rules: restrict creations, restrict updates, restrict deletions.
- Bypass list: Repository admin (the owner), always allowed.

### 4. Release 0.1.0

Follow [Releasing a version](#releasing-a-version) from step 2 (`package.json` already says `0.1.0`):

```sh
git switch main && git pull --ff-only
git tag v0.1.0
git push origin v0.1.0
```

Approve the `publish` job when it waits. npm publishes with the token and with provenance.

### 5. Trusted publishing only

Right after 0.1.0 is on npm:

1. On npmjs.com, open the package `stackledger` → Settings → Trusted Publisher → GitHub Actions ([npm docs](https://docs.npmjs.com/trusted-publishers)): user `brunosouzas`, repository `stackledger`, workflow filename `release.yml`, environment `npm`. Save.
2. In the same settings, Publishing access: choose "Require two-factor authentication and disallow tokens". From now on only the trusted workflow can publish.
3. Revoke the token: Access Tokens → the `stackledger first release` token → Delete.
4. Delete the environment secret `NPM_TOKEN` in Settings → Environments → `npm`.

The workflow still passes `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. With the secret gone it is empty, and npm publishes through OpenID Connect: the job proves who it is with a short-lived token from GitHub, and no long-lived npm token exists anywhere.

## Checking a release

**On npm.** The package page on npmjs.com shows a provenance badge naming the repository, the workflow and the commit. From the command line:

```sh
npm view stackledger@0.1.0 dist --json   # integrity and attestations.provenance
```

**Signatures and provenance of an install.** In a scratch folder, not in a project:

```sh
mkdir stackledger-check && cd stackledger-check
npm init -y
npm install stackledger@0.1.0
npm audit signatures
```

`npm audit signatures` checks the registry signature of every installed package and the provenance attestation of those that have one; stackledger must be counted under "verified attestation". Then delete the folder.

**The SBOM.** The GitHub release of the tag has `stackledger-<version>.cdx.json` attached: a CycloneDX list of the production dependencies with their versions and integrity hashes, the same versions `npm-shrinkwrap.json` locks. To read it:

```sh
gh release download v0.1.0 -R brunosouzas/stackledger -p 'stackledger-*.cdx.json'
```

**What this proves.** Provenance says the tarball on npm was built by `release.yml` in `brunosouzas/stackledger` from the tagged commit; it does not say the code is safe. The SBOM says which dependency versions the package installs, so you can check them against advisories later. The tarball on npm is the one the `check` job tested and audited: `publish` uploads those bytes and builds nothing.
