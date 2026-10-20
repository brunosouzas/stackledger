# The catalogue site

`stackledger build` turns a catalogue folder into two static websites: `full/` for the people allowed to see costs and contracts (owners and finance), and `staff/` for everyone else. Each is a complete site built only from its view ([ADR 7](adr/0007-two-views-built-as-separate-sites.md)), meant to be served behind an identity-aware proxy ([ADR 6](adr/0006-authentication-at-an-identity-aware-proxy.md)).

## Build

From this checkout, with Node.js 22.12 or later:

```sh
npm ci
npm run build
node dist/cli.js build examples/northwind --out ./public --date 2027-06-01
```

`stackledger build <folder> --out <dir> [--date YYYY-MM-DD]` writes `<dir>/full/`, `<dir>/staff/`, `<dir>/_headers`, `<dir>/robots.txt` and the marker `<dir>/.stackledger-build`. `--date` sets the map date of the `full` site (renewals within 30 days are ringed); the default is the machine's local date. The `staff` site never depends on the date.

| Exit | When |
| --- | --- |
| 0 | Both sites are published. A catalogue with errors still builds from what the views serve. |
| 1 | An internal failure. Nothing published changed: the previous build, if any, is still there byte for byte. |
| 2 | A usage or folder problem: `--help` aside, a missing folder or `--out`, an unknown option, an impossible date, more than one folder, a catalogue folder that is missing, not a folder or unreadable, or an `--out` that is a file. Nothing is created or changed. |

The output folder is refused (exit 2) when, after resolving symbolic links, it is the catalogue folder, inside it, contains it, or is a non-empty folder without the marker of an earlier build. The marker counts only as a regular file (not a link or a folder) holding exactly the text stackledger writes. The folder is also refused when `full`, `staff`, `_headers`, `robots.txt` or the marker is a symbolic link: the build never renames or removes through a link. A missing output folder is created. Building again into the same folder replaces the previous build completely.

stderr holds the report, in this order: the catalogue's error and warning counts with a hint to run `stackledger validate` (only when there is at least one), the map's suggested positions, unrouted hops and unused layout as [`stackledger map`](map.md) writes them for the `full` view, one line per site with its folder and page count, and a reminder that both folders must be served behind an identity-aware proxy.

**What it writes.** Only inside `--out`. Astro runs from a copy of the site project in a staging folder `--out/.stackledger-tmp-*`, with every cache there too; nothing is written to the catalogue, the installed package, the system temporary folder or your home folder, and there are no network calls and no telemetry. You can check it with the Node.js permission model (Node 22.13 or later):

```sh
node --permission --allow-fs-read=/path/to/catalogue --allow-fs-read=/path/to/stackledger \
  --allow-fs-read=/path/to/out --allow-fs-write=/path/to/out \
  --allow-addons --allow-child-process --allow-worker \
  /path/to/stackledger/dist/cli.js build /path/to/catalogue --out /path/to/out
```

Create `/path/to/out` first and give real paths (without symbolic links): the build reads back what it writes in the staging folder, and the permission model checks paths as written.

**Atomic replace.** Both sites are fully built in the staging folder before anything published changes. Then each entry (`staff`, `full`, `_headers`, `robots.txt`, `.stackledger-build`) is swapped by renames; the rename of the marker is the commit point. A failure before it undoes every rename, so the previous build stays as it was. A failure to remove the staging folder after it is only a warning; the next build removes stale staging folders first.

**Deterministic.** The same catalogue, `--date` and stackledger version produce byte-identical files, whatever the order of files and documents in the catalogue folder.

## Pages

Each site has the same pages, filled from its own view.

| Page | Path | Shows |
| --- | --- | --- |
| Map | `/` | The metro map in the page's theme, with zoom in, zoom out, reset and drag to pan; a zone filter; the lines as buttons under the map (choose one to dim the others, choose it again to restore); the map symbols. Each station opens its item page by click, or by focus and Enter. |
| Software | `/software/` | Every component and licence in one table: name, kind, type, lifecycle or status, owner and zone, sorted by reference. Search (any shown cell, ignoring case) and filters work on the table itself. |
| Component | `/software/<name>/` | Title, name, description, type, lifecycle, owner, zone and tags; its licences with the licence fields of the view; the journeys that stop at it; a neighbourhood diagram (what it depends on, what depends on it) with the same items as text links; the impact of removing it; references that match nothing. |
| Licence | `/licences/<name>/` | Title, name, owner and the licence fields of the view; the components that use it; the impact of removing it. |
| Journeys | `/journeys/` | Every drawn line in line order, with badge, title and number of stops. |
| Journey | `/journeys/<name>/` | A strip diagram of the line's stops in order, with the badges of other lines at interchanges, and the same stops and lines as text links. |

`<name>` is the item's `metadata.name` in lower case. The diagrams are SVG drawn by stackledger itself, in the map's style. Owners show by name when the catalogue has a `Group` or `User` document for them (its `metadata.title`, else `spec.profile.displayName`, else its name); otherwise the reference, such as `group:northwind`, is shown.

Without JavaScript every page still works as a document: the whole map, both legends and the full, unfiltered table are shown; only zoom, filters and search need the page scripts.

### Look and settings

The look follows brunosouzas.com (based on the Astroplate theme, MIT), with the Heebo and Signika fonts shipped in the package. A theme switch in the header follows the system's light or dark setting until the reader chooses, then remembers the choice in the browser for every page of that site. `spec.site` in the `Settings` document sets the site title and up to four light-theme colours; see [the catalogue format](catalogue-format.md#settings-and-views).

**Known limitation:** a remembered theme is applied by a script file after the page starts to load (the policy forbids inline scripts), so a page can show the system theme for a moment before switching.

## Security

- One fixed Content Security Policy on every page, in a `meta` element and in `_headers`: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` (plus `frame-ancestors 'none'` in `_headers`). Pages have no inline script or style, no `style` attribute and no event-handler attribute.
- Every URL is relative and stays inside its site, so the same files work under any path prefix. No font, script or image comes from another site; there are no analytics.
- `noindex, nofollow` on every page, `X-Robots-Tag` in `_headers`, and a `robots.txt` that disallows everything, at the root of the output and in each site.
- The `staff` site is built first, from the staff view only: no file of it contains a hidden field's value.
- Catalogue text is escaped everywhere; titles such as `<img onerror=…>` show as text.

## Publishing the output

The output folder holds more than the two sites while a build runs: the build prepares everything in a staging folder `.stackledger-tmp-*` inside it, and that staging folder holds `full` view files outside the protected `/full/` path.

- Never serve the output folder while a build runs, and never serve the output folder itself.
- Publish only these four entries of the output folder: `full/`, `staff/`, `_headers` and `robots.txt`, and only after the command exits with code 0. For example, copy them into a clean folder and deploy that, or let a CI job build into a fresh folder and upload only those entries.

### One host, two audiences

Serve both sites from one host, with a stricter rule on `/full/`:

| Path | Who | Site |
| --- | --- | --- |
| `/full/*` | Owners and finance | the `full` view: costs, renewals, payers, seats, password-manager references, notes |
| `/staff/*` (and the rest of the host) | Everyone in the company | the `staff` view |

Without the proxy, anyone with the address can read the catalogue. The host has no page at `/`: point people to `/staff/`, or add a redirect at the host.

**Trailing slash.** Every page is a folder with an `index.html`, and its links are relative, so a page must be served at its address with a trailing slash. The host must redirect a folder address without it (`/staff/software/slack`) to the address with it (`/staff/software/slack/`), and serve `index.html` for a folder. Cloudflare Pages, Netlify and most static hosts do both by default; for nginx, `try_files $uri $uri/ =404;` does.

**Cloudflare Pages and Access.** Deploy a folder holding only the four entries (for example `npx wrangler pages deploy ./publish`); Pages reads `_headers` at its root. In Cloudflare Zero Trust, add two self-hosted Access applications on the Pages domain: one for the path `full/*` with a policy for owners and finance, and one for the whole domain with a policy for staff. Access applies the more specific path, so `/full/` needs the stricter policy. Protect the `*.pages.dev` preview addresses too. Step-by-step recipes come with the `catalogue-git-source` change ([roadmap](roadmap.md)).
