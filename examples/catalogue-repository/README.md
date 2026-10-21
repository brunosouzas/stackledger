# Catalogue repository template

A starting point for a Git repository that holds your [stackledger](https://github.com/brunosouzas/stackledger) catalogue and publishes its two sites with GitHub Actions to Cloudflare Pages, behind Cloudflare Access.

Copy everything in this folder, including `.github/` and `.gitignore`, to the root of a new **private** repository. Read access to the repository means reading the whole catalogue, costs included.

```
.github/workflows/stackledger.yml   the workflow
catalog/                            the catalogue: every YAML file below it is read
README.md                           this file; replace it with your own
```

The catalogue lives in `catalog/` so that stackledger never reads the workflow's own YAML. `catalog/catalog-info.yaml` holds one fictitious component, so the copy validates and builds as it is; replace it with yours ([catalogue format](https://github.com/brunosouzas/stackledger/blob/main/docs/catalogue-format.md)).

## What the workflow does

| When | `site` job | `deploy` job |
| --- | --- | --- |
| Pull request | scan, validate, build | does not run |
| Push to `main` | scan, validate, build | deploys |
| Every Monday, 06:00 UTC | scan, validate, build | deploys, so renewal windows move without a commit |
| Manual start (Run workflow) | scan, validate, build | deploys only when started on `main` |

The `site` job:

1. scans the repository and its whole history for secrets with [gitleaks](https://github.com/gitleaks/gitleaks), a pinned release checked against its SHA-256; a finding fails the job;
2. runs `stackledger validate catalog`: an error fails the job before the build, a warning does not;
3. builds both sites dated today in UTC, into a folder outside the repository;
4. hands on only `full/`, `staff/`, `_headers` and `robots.txt`, with the build date.

The `deploy` job runs on a fresh runner without a checkout. It installs wrangler with `--ignore-scripts` before any secret is present, then runs it from a folder that holds only the site. Each deployment is labelled with the commit and the build date, for example `stackledger 2026-10-21 <commit>`.

A re-run on the same UTC day deploys the same files.

## Setup

Do these steps in this order, so the sites are never public.

1. **Protect the sites first.** Create the Cloudflare Pages project empty and set up Cloudflare Access for it, as [docs/hosting.md](https://github.com/brunosouzas/stackledger/blob/main/docs/hosting.md) describes: two Access applications, one for `/full/*` and one for the rest, on every address of the project. Do this **before** the first deploy.
2. **API token.** In the Cloudflare dashboard, My Profile → API Tokens → Create Token → Custom token, with the single permission Account → Cloudflare Pages → Edit, for one account only ([Cloudflare docs](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)).
3. **Repository secrets and variable.** In the repository settings, Secrets and variables → Actions:
   - secret `CLOUDFLARE_API_TOKEN`: the token from step 2;
   - secret `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID (on the account's overview page);
   - variable `PAGES_PROJECT`: the name of the Pages project from step 1.

   Only the deploy step reads them. Pull requests never deploy.
4. **Push to `main`.** The first run deploys. Then check the sites as `docs/hosting.md` says: anonymous requests must be sent to the sign-in page, and a staff identity must be refused on `/full/`.

## Versions

The versions are set once, in `env` at the top of the workflow:

| Variable | What |
| --- | --- |
| `STACKLEDGER` | the stackledger release the job runs, with `npx --yes`; the job log names it |
| `WRANGLER` | the wrangler release used to deploy |
| `GITLEAKS_VERSION`, `GITLEAKS_SHA256` | the gitleaks release and the SHA-256 of its `linux_x64` archive, from the release's `checksums.txt` |

Actions are pinned by commit SHA. Change a version in a pull request, so the change is reviewed and its run checks it.

## Rolling back

Cloudflare Pages keeps every deployment. To go back to an earlier one: open the Pages project → Deployments → the previous production deployment (find it by commit and date) → Rollback to this deployment ([Cloudflare docs](https://developers.cloudflare.com/pages/configuration/rollbacks/)).

To fix forward, revert the bad commit on `main`; the push deploys the result. Starting the workflow by hand on an older branch or tag does not deploy: the deploy job runs only for `main`.

## Running the checks locally

With Node.js 22.12 or later:

```sh
npx --yes stackledger@0.1.0 validate catalog
npx --yes stackledger@0.1.0 build catalog --out ../catalogue-site --date "$(date -u +%F)"
```

Build outside the repository, so the build is never committed.
