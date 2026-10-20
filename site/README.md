# stackledger site

The Astro project `stackledger build` uses to make the `full` and `staff` sites. It is shipped in the
npm package and never built in place: the build copies it into a staging folder inside `--out`, writes
`src/data/site.json` (the view's SiteData, from `src/site/data.ts`), `src/data/policy.json`,
`src/styles/override.css`, `src/fonts/` and `.astro/settings.json`, and runs Astro there (see `src/site/build.ts`).

Two details keep the build inside `--out` under the Node.js permission model: `"workspaces": []` in
`package.json` makes Vite stop its search for a workspace root at the working copy instead of reading
every parent folder, and `.astro/settings.json` answers Astro's preferences so it does not read the
user's home folder.

Rules for the files here (site-security spec): no inline `<script>` or `<style>`, no `style` or
event-handler attributes, no `is:inline` or `define:vars`, page links through `href()` in
`src/lib/site.ts`, catalogue text only through `{...}` (escaped by Astro), and `set:html` only for
SVG drawn by stackledger's renderers.

The look follows brunosouzas.com, which is based on the Astroplate theme (MIT, see `LICENSE-astroplate`).
