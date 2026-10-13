# Self-hosted fonts

Every font used across the site lives here instead of being fetched from Google Fonts,
so visitors' IPs are never sent to Google. `assets/css/fonts.css` declares one
`@font-face` per file and is linked from every page in place of the old
`fonts.googleapis.com` `<link>` tags.

## What's here

29 font families, `latin` + `latin-ext` subsets only (this site's content is
English/European — the `latin-ext` subset covers accented characters like the é in
"Pokémon" or German umlauts; subsets for Greek, Cyrillic, Vietnamese, Arabic, Hebrew,
Thai and Devanagari were dropped since nothing on the site needs them).

Each family's folder (`assets/fonts/<slug>/`) holds one `.woff2` file per
weight/style/subset combination actually used somewhere on the site — no unused
weights were bulk-downloaded.

## How this was generated

The files and `assets/css/fonts.css` were produced by querying Google Fonts' own
`css2` API with the exact family/weight/style list every page used to request
individually, filtering the response down to the `latin`/`latin-ext` `@font-face`
blocks, downloading each referenced `.woff2` from `fonts.gstatic.com`, and rewriting
each block's `src: url(...)` to point at the local file. Nothing here is hand-authored
CSS — it's Google's own generated font-face rules with the URLs swapped, which is why
`unicode-range` and `font-stretch` are preserved as-is.

## Adding or changing a font

1. Add the family (with its weights, e.g. `Some+Font:wght@400;700`) to a Google Fonts
   `css2` query URL.
2. Fetch it with a real browser user-agent so Google serves `.woff2`:
   `curl -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=...&display=swap"`
3. Keep only the `/* latin */` and `/* latin-ext */` blocks, download each block's
   `url(...)`, save it under `assets/fonts/<slug>/`, and append the block to
   `fonts.css` with its `src` rewritten to the local path — following the naming
   pattern `<slug>-<weight>-<style>-<subset>.woff2`.
4. Point the relevant theme's `--font-body` / `--font-display` / `--font-mono`
   variable (or hub.css's hardcoded font-family, for the hub/version-history pages) at
   the new family name.

No page needs its own font `<link>` — `fonts.css` carries every family used anywhere
on the site, and browsers only ever fetch the specific files a page's rendered text
actually needs, regardless of how many `@font-face` rules are declared.
