# The catalogue site

`stackledger build` turns a catalogue folder into two static websites: `full/` for the people allowed to see costs and contracts (owners and finance), and `staff/` for everyone else. In the personal mode (`spec.sites: [full]` in the [Settings document](catalogue-format.md#settings-and-views)), when you are the only reader, it builds only `full/`. Each is a complete site built only from its view ([ADR 7](adr/0007-two-views-built-as-separate-sites.md)), meant to be served behind an identity-aware proxy ([ADR 6](adr/0006-authentication-at-an-identity-aware-proxy.md)).

## Build

From this checkout, with Node.js 22.12 or later:

```sh
npm ci
npm run build
node dist/cli.js build examples/northwind --out ./public --date 2027-06-01
```

`stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` writes `<dir>/full/`, `<dir>/staff/`, `<dir>/_headers`, `<dir>/robots.txt`, `<dir>/_redirects` and the marker `<dir>/.stackledger-build`. In the personal mode there is no `staff/`, and one left by an earlier build is removed with the rest of that build. `_redirects` sends `/` to `/staff/`, or to `/full/` in the personal mode, as `/ /staff/ 302` (the Cloudflare Pages and Netlify format). `--date` sets the map date and the report date of the `full` site (renewals within 30 days are ringed on the map; the Reports page and `renewals.ics` cover the 90 days from it); the default is the machine's local date. The `staff` site never depends on the date.

| Exit | When |
| --- | --- |
| 0 | The sites are published. A catalogue with errors still builds from what the views serve. |
| 1 | An internal failure. Nothing published changed: the previous build, if any, is still there byte for byte. The exceptions are a failed undo and a staging folder an earlier failed undo left behind: stderr names the staging folder, and [Restoring after a failed publication](#restoring-after-a-failed-publication) says what to do. |
| 2 | A usage or folder problem: `--help` aside, a missing folder or `--out`, an unknown option, an impossible date, more than one folder, a catalogue folder that is missing, not a folder or unreadable, an `--out` that is a file, or a `.stackledger-tmp-*` entry in it that is a symbolic link or a file. Nothing is created or changed. |

The output folder is refused (exit 2) when, after resolving symbolic links, it is the catalogue folder, inside it, contains it, or is a non-empty folder without the marker of an earlier build. The marker counts only as a regular file (not a link or a folder) holding exactly the text stackledger writes. The folder is also refused when `full`, `staff`, `_headers`, `robots.txt`, `_redirects` or the marker is a symbolic link: the build never renames or removes through a link. A missing output folder is created. Building again into the same folder replaces the previous build completely.

stderr holds the report, in this order: the catalogue's error and warning counts with a hint to run `stackledger validate` (only when there is at least one), the map's suggested positions, unrouted hops and unused layout as [`stackledger map`](map.md) writes them for the `full` view, one line per site built with its folder and page count, and a reminder that the folders must be served behind an identity-aware proxy.

**What it writes.** Only inside `--out`. Astro runs from a copy of the site project in a staging folder `--out/.stackledger-tmp-*`, with every cache there too; nothing is written to the catalogue, the installed package, the system temporary folder or your home folder, and there are no network calls and no telemetry. You can check it with the Node.js permission model (Node 22.13 or later):

```sh
node --permission --allow-fs-read=/path/to/catalogue --allow-fs-read=/path/to/stackledger \
  --allow-fs-read=/path/to/out --allow-fs-write=/path/to/out \
  --allow-addons --allow-child-process --allow-worker \
  /path/to/stackledger/dist/cli.js build /path/to/catalogue --out /path/to/out
```

Create `/path/to/out` first and give real paths (without symbolic links): the build reads back what it writes in the staging folder, and the permission model checks paths as written.

**Atomic replace.** Both sites are fully built in the staging folder before anything published changes. Then each entry (`staff`, `full`, `_headers`, `robots.txt`, `_redirects`, `.stackledger-build`) is swapped by renames: the previous entry moves into the staging folder's `old/`, created just before the first rename, and the new one moves into place. A personal build has no new `staff`: it writes an empty `full-only` file in the staging folder, and an earlier `staff` only moves into `old/`. The rename of the marker is the commit point. A failure before it undoes every rename, so the previous build stays as it was. After the commit the replaced entries and the staging folder are removed; a failure there is only a warning.

**Interrupted publication.** A staging folder without `old/` never touched a published entry (a build that crashed or failed before publishing): the next build removes it. A staging folder with `old/` may hold the only copy of the previous build, after a failed undo (for example a folder made read-only during the build) or a process killed during publication. stackledger never moves those entries back by itself: while such a folder exists, every build exits 1, names it and changes nothing, until you restore by hand as described below. Automatic recovery was tried and dropped, because trusting what a staging folder says about itself could move or delete the published site.

**Deterministic.** The same catalogue, `--date` and stackledger version produce byte-identical files, whatever the order of files and documents in the catalogue folder.

### Restoring after a failed publication

When a build says a staging folder `<out>/.stackledger-tmp-…` was kept, or refuses an output folder because of one, put the output folder back by hand. Nothing else runs meanwhile: each build refuses that output folder and changes nothing. Below, `<out>` is the output folder and `<staging>` the staging folder the message names.

1. Look for `<staging>/root/.stackledger-build`. If it is **not** there, the publication had reached its commit point: `<out>` already holds the new build, and `<staging>/old/` only the build it replaced. Go to step 4.
2. Otherwise the publication stopped before its commit point. For each entry below whose new version is **no longer** in the staging folder, the entry of that name in `<out>` belongs to the failed build: delete it.

   | Entry in `<out>` | Its new version in the staging folder |
   | --- | --- |
   | `staff` | `<staging>/site-staff` |
   | `full` | `<staging>/site-full` |
   | `_headers` | `<staging>/root/_headers` |
   | `robots.txt` | `<staging>/root/robots.txt` |
   | `_redirects` | `<staging>/root/_redirects` |

   When `<staging>/full-only` exists, the failed build was a personal one and never had a staff site: skip the `staff` row, and keep any `staff` in `<out>`.

3. Move every entry of `<staging>/old/` (`ls -A` shows `.stackledger-build` too) back into `<out>`, keeping its name, for example `mv "<staging>/old/full" "<out>/full"`.
4. Delete the staging folder: `rm -rf "<staging>"` (it removes symbolic links inside without following them).
5. Run the build again.

After step 3, `<out>` holds the previous build byte for byte; the build tests follow these steps to prove it (`test/manual-restore.ts`).

## Pages

Each site has the same pages, filled from its own view; the `full` site also has the Reports page and the calendar file.

| Page | Path | Shows |
| --- | --- | --- |
| Map | `/` | The metro map in the page's theme, with zoom in, zoom out, reset and drag to pan; a zone filter; the lines as buttons under the map (choose one to dim the others, choose it again to restore); the map symbols. Each station opens its item page by click, or by focus and Enter. |
| Software | `/software/` | Every component and licence in one table: name, kind, type, lifecycle or status, owner and zone, sorted by reference. Search (any shown cell, ignoring case) and filters work on the table itself. |
| Component | `/software/<name>/` | Title, name, description, type, lifecycle, owner, zone and tags; its licences with the licence fields of the view; the journeys that stop at it; a neighbourhood diagram (what it depends on, what depends on it) with the same items as text links; the impact of removing it; references that match nothing. |
| Licence | `/licences/<name>/` | Title, name, owner and the licence fields of the view; the components that use it; the impact of removing it. |
| Journeys | `/journeys/` | Every drawn line in line order, with badge, title and number of stops. |
| Journey | `/journeys/<name>/` | A strip diagram of the line's stops in order, with the badges of other lines at interchanges, and the same stops and lines as text links. |
| Reports (`full` only) | `/reports/` | Renewals in the next 90 days, overdue renewals and unknown dates; recurring cost per month and per year for each currency, with the number of incomplete licences; the same totals by owner, by payer and by zone; one-off costs, planned purchases and incomplete licences; a link to `renewals.ics`. Each licence links to its page. The rules are in [docs/reports.md](reports.md). |
| Calendar (`full` only) | `/renewals.ics` | The renewals of the Reports page as an iCalendar file to download and import ([docs/reports.md](reports.md#the-calendar-file)). |

`<name>` is the item's `metadata.name` in lower case. The diagrams are SVG drawn by stackledger itself, in the map's style. Owners show by name when the catalogue has a `Group` or `User` document for them (its `metadata.title`, else `spec.profile.displayName`, else its name); otherwise the reference, such as `group:northwind`, is shown.

Without JavaScript every page still works as a document: the whole map, both legends and the full, unfiltered table are shown; only zoom, filters and search need the page scripts.

### Look and settings

The look follows brunosouzas.com (based on the Astroplate theme, MIT), with the Heebo and Signika fonts shipped in the package. The map and the diagrams use the style of the site's illustrations (ink outlines, hard offset shadows, see [the map](map.md#routes-and-themes)) and the Lato font, also shipped in the package (`@fontsource/lato`, SIL Open Font License 1.1). A theme switch in the header follows the system's light or dark setting until the reader chooses, then remembers the choice in the browser for every page of that site. `spec.site` in the `Settings` document sets the site title and up to four light-theme colours; see [the catalogue format](catalogue-format.md#settings-and-views).

**Known limitation:** a remembered theme is applied by a script file after the page starts to load (the policy forbids inline scripts), so a page can show the system theme for a moment before switching.

## Security

- One fixed Content Security Policy on every page, in a `meta` element and in `_headers`: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` (plus `frame-ancestors 'none'` in `_headers`). Pages have no inline script or style, no `style` attribute and no event-handler attribute.
- Every URL is relative and stays inside its site, so the same files work under any path prefix. No font, script or image comes from another site; there are no analytics.
- `noindex, nofollow` on every page, `X-Robots-Tag` in `_headers`, and a `robots.txt` that disallows everything, at the root of the output and in each site.
- The `staff` site is built first, from the staff view only: no file of it contains a hidden field's value. It has no Reports page, no calendar file and no link to either.
- Catalogue text is escaped everywhere; titles such as `<img onerror=…>` show as text.
- The build writes only inside the output folder and never renames or removes through a symbolic link: entries are looked at with `lstat`, and a staging folder is removed only when it is a real folder. Node.js cannot hold a folder open, so the build works with paths: it records the output folder's real path and identity (device and inode) once the folder is checked, compares them again immediately before it creates the staging folder, before each rename (an undo's included) and before each removal, and stops with exit 1, changing nothing more, when they differ. **Trust assumption:** no other process renames or replaces the output folder or its parents during a build. A swap between a check and the change right after it, or while the sites are being prepared in the staging folder, is outside what the build can detect; this is the same trust you give any program you run as yourself.

## Publishing the output

The output folder holds more than the two sites while a build runs: the build prepares everything in a staging folder `.stackledger-tmp-*` inside it, and that staging folder holds `full` view files outside the protected `/full/` path.

- Never serve the output folder while a build runs, and never serve the output folder itself.
- Publish only these entries of the output folder: `full/`, `staff/` (not in the personal mode), `_headers`, `robots.txt` and `_redirects`, and only after the command exits with code 0. For example, copy them into a clean folder and deploy that, or let a CI job build into a fresh folder and upload only those entries.

### One host, two audiences

In the corporate mode, serve both sites from one host, with a stricter rule on `/full/`:

| Path | Who | Site |
| --- | --- | --- |
| `/full/*` | Owners and finance | the `full` view: costs, renewals, payers, seats, password-manager references, notes |
| `/staff/*` (and the rest of the host) | Everyone in the company | the `staff` view |

In the personal mode there is only `/full/*`, for you. Without the proxy, anyone with the address can read the catalogue. The host has no page at `/`: Cloudflare Pages and Netlify follow `_redirects` to `/staff/` (or `/full/`); on another host, add the same redirect there.

**Trailing slash.** Every page is a folder with an `index.html`, and its links are relative, so a page must be served at its address with a trailing slash. The host must redirect a folder address without it (`/staff/software/slack`) to the address with it (`/staff/software/slack/`), and serve `index.html` for a folder. Cloudflare Pages, Netlify and most static hosts do both by default; for nginx, `try_files $uri $uri/ =404;` does.

**Calendar file.** Serve `renewals.ics` with the type `text/calendar` (check how your host types `.ics` files). It is for download and import only: calendar services fetch a subscribed feed from their own servers, without the reader's sign-in, so the proxy in front of `/full/` refuses them and a subscription to it cannot work. Do not publish the file outside the proxy to make it subscribable; it holds costs.

**Hosting recipes.** [docs/hosting.md](hosting.md) covers Cloudflare Pages with Access on every project address, and a generic Caddy proxy in front of oauth2-proxy. Set up access control before the first deployment. The [catalogue repository template](../examples/catalogue-repository/) builds and deploys only the publishable entries.
