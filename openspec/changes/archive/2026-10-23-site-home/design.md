## Context

The site is an Astro project shipped in the package. Pages read one data object built by `src/site/data.ts`. The header, sub-navigation and footer are shared components, and `Settings` is validated by zod in `src/schema.ts`.

## Decisions

- **Links are data, not a feed.** The owner chose configured links over reading articles at build time. The build stays offline and deterministic, and the tool is not tied to one blog.
- **Only `http(s)` URLs.** A link is the only place where `Settings` text becomes an `href`. Allowing other schemes (`javascript:`, `data:`) would let a catalogue file run code on the site. Relative links are not needed, because the home already links every page.
- **No redirect from `/` to `/map/`.** `/` is the home now, and the home links the map in its Software card.
- **Counts come from the same data the pages use**, per view, so the `staff` home never counts what the `staff` site does not show, and links Reports only in `full`.
