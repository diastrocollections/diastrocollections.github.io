# Diastro Gaming Collections

**Live site:** https://diastrocollections.github.io

A curated field guide to classic console and handheld games: 1,500 games across 15 platforms, from the NES (1985) to the PSP and DS. Each platform gets 100 games split into 12 genre chapters. Every game is fact-checked for release year, developer and regional availability. Where a European release exists, the European release year comes first.

This repository holds the entire website. This README explains how it is built.

> This is a personal project and isn't open to outside contributions yet. If you spot a mistake in a collection, please use the email link in the footer of any page.

## The approach: a static site that loads its data from JSON

The site is plain HTML, CSS and JavaScript. It has no framework, no build step, no package manager and no server-side code. GitHub Pages serves the files as they are in the repository.

The site keeps content separate from presentation:

- **Content** lives in JSON files in `data/`, one per platform, plus one for the hub and one for the changelog.
- **Presentation** is a small set of shared scripts and stylesheets. They fetch that JSON when the page loads and build the page in the browser.

Because of this split, all 15 collection pages run on one renderer and one layout stylesheet. What makes each platform look different is a single theme file.

## Repository layout

```
index.html                    The hub: a shelf of platform tiles with site-wide totals
<platform>/index.html         One collection page per platform (15 in total)
how-its-made/index.html       How the collections are researched, written and built
version-history/index.html    Release history of the site

data/
  <platform>.json             The chapters and games of one collection
  platforms.json              One entry per platform: feeds the hub tiles and stats
  version-history.json        Changelog entries, newest first

assets/
  collection.js               Shared renderer for every collection page
  hub.js                      Renders the hub from platforms.json
  status.js                   "Hand-written" / "Draft in progress" badge and popover
  nav.js                      Site navigation: top bar, Collections switcher, back to top, previous / next
  version-history.js          Renders the changelog
  how-its-made.js             Shelf progress chart and "On this page" scroll-spy
  css/
    base.css                  Shared layout for all collection pages
    theme-<platform>.css      Per-platform colors, fonts and decorative extras
    hub.css                   Hub layout, also used by the two info pages
    nav.css                   The top bar and Collections switcher, shared by every page
    how-its-made.css          Extras for the "How it's made" page
    status.css                Badge and popover styles
    fonts.css                 @font-face rules for the self-hosted fonts
  fonts/                      Self-hosted .woff2 files (see fonts/MANIFEST.md)
  og/                         Open Graph share images, one per page
  img/                        Logo and author photo

.pages.yml                    Pages CMS schema for the JSON files
```

Platform IDs are used the same way everywhere. For example, `nes` means `nes/index.html`, `data/nes.json` and `assets/css/theme-nes.css`. The 15 IDs are `nes`, `mastersystem`, `gameboy`, `megadrive`, `snes`, `ps1`, `n64`, `gbc`, `ps2`, `gamecube`, `gba`, `psp`, `ds`, `wii` and `xbox`.

## How a collection page works

All collection pages share the same HTML skeleton. The only parts that differ from one page to the next are the text (hero, curator's note, footer), the meta tags, the theme stylesheet and one attribute on the script tag:

```html
<link rel="stylesheet" href="../assets/css/base.css">
<link rel="stylesheet" href="../assets/css/theme-nes.css">
...
<link rel="stylesheet" href="../assets/css/nav.css">
...
<script src="../assets/nav.js"></script>
<script src="../assets/status.js"></script>
<script src="../assets/collection.js" data-src="../data/nes.json"></script>
```

`collection.js` reads its own `data-src` attribute, fetches that file and renders:

- the chapters and their game cards, numbered No. 001 to No. 100 across the whole page;
- the "Chapters" drop-down in the toolbar, which lists every chapter and shows which one you're reading;
- the filter over title, developer and genre, which ignores accents so that "pokemon" also finds "Pokémon", and announces the number of matches to screen readers;
- the collapsible curator's note;
- the platform's writing status in the hero, which it looks up in `platforms.json`.

The renderer only needs a handful of element IDs on the page, such as `#chapters`, `#chips` and `#searchInput`, and every one except `#chapters` is optional. Platform-specific touches are opt-in through attributes. For example, the PlayStation page passes `data-glyphs` so the renderer cycles the △ ○ ✕ □ button symbols through its cards.

### The data format

Each `data/<platform>.json` file is an array of chapters:

```json
[
  {
    "hue": 71,
    "tag": "Puzzle",
    "title": "Falling-Block & Puzzle",
    "blurb": "Chapter introduction.",
    "games": [
      { "title": "Tetris", "year": "1989", "developer": "Nintendo R&D1", "blurb": "About the game." }
    ]
  }
]
```

`hue` (0–360) is fed into a CSS custom property, so each chapter gets its own accent color within the platform's palette.

## Styling and theming

The CSS is built in layers:

1. **`base.css`** holds the complete layout of a collection page: hero, curator's note, sticky toolbar, card grid and footer. It uses no fixed colors or fonts. Everything comes from CSS custom properties.
2. **`theme-<platform>.css`** loads after it and sets those properties (`--bg`, `--surface`, `--ink`, `--accent`, `--hue`, `--font-display` and so on). It then adds that console's decorative extras, such as the NES page's pixel-art hills and brick pattern or the PS1 page's button glyphs.

Each theme defines its palette three times: once for light mode, once inside `@media (prefers-color-scheme: dark)` to follow the system setting, and once under `:root[data-theme="dark"]` for the manual toggle. Switching themes cross-fades colors instead of snapping.

The hub, "How it's made" and version history pages share `hub.css`, which has its own tile-based layout.

## Navigation

Every page has the same top bar: the shelf, a "Collections" switcher, the two info pages, YouTube, the theme toggle and a back-to-top arrow that appears once you scroll past the hero. Its styles live in `nav.css` (loaded last, so it looks the same everywhere while taking its colors from the page's theme) and its behaviour in `nav.js`. At 760px and narrower the bar folds into a Menu button, and the back-to-top arrow is hidden, since phones scroll to the top by tapping the status bar.

Every page also ends with the same site footer (styled in `nav.css` too): the name and social links, three short promises that link to the details on the "How it's made" page (how AI is used, no ads or tracking, contact), and the copyright line. On collection pages it follows the Collection's own notes, sources and "Report a mistake" button.

`nav.js` builds the Collections switcher and the "previous / next on the shelf" links at the bottom of each collection page from `platforms.json`, so a new platform appears there automatically. On collection pages it also replaces the footer's general AI line with that Collection's own writing status, such as "AI-assisted draft, 5% rewritten by hand". The HTML of the top bar and the footer is repeated in every page, so a change to either means updating all 18 `index.html` files.

## Fonts

The themes use 29 typefaces, and all of them are self-hosted in `assets/fonts/` instead of loaded from Google Fonts, so visitors' IP addresses are never sent to a third party. Only the Latin and Latin Extended subsets are included, and only the weights and styles the site actually uses. `assets/fonts/MANIFEST.md` documents where each file came from.

## Hub, status and version history

- **`platforms.json`** stores each platform's metadata: name, years, accent color, region, tagline, game and chapter counts, and writing status. `hub.js` builds the tiles from it and calculates the site-wide totals (games, chapters and the hardware timeline). Adding an entry adds a tile without any code changes.
- **Writing status:** every collection starts from an AI-assisted draft and is rewritten by hand. The `handwritten` and `progress` fields drive the "Hand-written" / "Draft in progress" badges (`status.js`, which uses the Popover API so the popover isn't clipped by the tiles). The same fields drive the shelf progress chart on the "How it's made" page.
- **`version-history.json`** is rendered by `version-history.js` as a timeline of releases. Each release is tagged major, minor or patch, and its notes are a list of `sections`: each one an optional `heading` (rendered as an `<h3>`, for short labels like "Content updates"), an optional paragraph (`text`, for sentences) and optional `bullets`, which can have `sub` bullets. Inline HTML works everywhere, and `` `backticks` `` show as inline code.

## Content management

The JSON files are edited through [Pages CMS](https://pagescms.org), which commits straight to this repository. `.pages.yml` describes the chapter and game fields once and reuses them for all 15 platform files. Because every page reads its data at runtime, a content change goes live as soon as GitHub Pages redeploys. No HTML or JavaScript needs to be touched.

## Privacy and third parties

- **Analytics:** [GoatCounter](https://www.goatcounter.com) counts page views anonymously. There are no cookies and no personal tracking.
- **Fonts:** self-hosted (see above).
- **Browser storage:** none. The dark-mode choice is not saved between visits.
- There are no ads, accounts or other external scripts.

## Running it locally

Pages load their data with `fetch()`, which browsers block for files opened directly from disk (`file://`). Serve the folder with any static server instead:

```sh
python3 -m http.server
# then open http://localhost:8000
```

## How it's made, and AI

Much of the technical side (the HTML, CSS and JavaScript in this repository) is built with [Claude Code](https://claude.com/claude-code), under my direction and with my review and testing. Version 1.0 of the collections also used research and draft texts created with Claude. From then on, every collection is being rewritten, expanded and edited by hand, and the status badges show how far each one has got. The [How it's made](https://diastrocollections.github.io/how-its-made/) page covers the process in full.

## License and trademarks

© 2026 Jesper Bekkering / Diastro Gaming. Platform names, game titles and other trademarks belong to their respective owners and are used only for identification and commentary.
