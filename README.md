# Diastro Gaming Collections

A twelve-platform field guide to classic console and handheld games — NES, Game Boy, Mega Drive, SNES, PlayStation, Nintendo 64, Game Boy Color, PlayStation 2, GameCube, Game Boy Advance, PSP, and Wii. 1,200 games across 144 genre chapters.

This is a static site: no build step, no server-side code. Every page fetches its game data from a JSON file at runtime, so you can edit the JSON in any text editor (VS Code works great) without touching HTML or JavaScript.

## Site structure

```
site/
├── index.html                    the hub page (the tile grid linking to all 12 collections)
├── assets/
│   ├── hub.js                    renders the hub's tiles + stats from data/platforms.json
│   ├── collection.js             shared renderer used by all 12 collection pages
│   └── css/
│       ├── base.css              shared layout for all 12 collection pages (hero,
│       │                         curator note, toolbar/search, card grid, footer)
│       ├── hub.css               the hub page's own styles
│       ├── theme-nes.css         one small file per platform: just its colors,
│       ├── theme-gameboy.css     fonts, and visual flourishes (loaded after
│       ├── theme-megadrive.css   base.css, so it only needs to override what
│       ├── theme-snes.css        makes that platform look different)
│       ├── theme-ps1.css
│       ├── theme-n64.css
│       ├── theme-gbc.css
│       ├── theme-ps2.css
│       ├── theme-gamecube.css
│       ├── theme-gba.css
│       ├── theme-psp.css
│       └── theme-wii.css
├── data/
│   ├── platforms.json            one entry per platform, feeds the hub page
│   ├── nes.json
│   ├── gameboy.json
│   ├── megadrive.json
│   ├── snes.json
│   ├── ps1.json
│   ├── n64.json
│   ├── gbc.json
│   ├── ps2.json
│   ├── gamecube.json
│   ├── gba.json
│   ├── psp.json
│   └── wii.json
├── nes/index.html                each of these is a collection page. They all share
├── gameboy/index.html            the same HTML skeleton and assets/css/base.css,
├── megadrive/index.html          link their own assets/css/theme-<platform>.css for
├── snes/index.html               look and feel, and render their games through the
├── ps1/index.html                shared assets/collection.js script, reading their
├── n64/index.html                own data/<platform>.json file.
├── gbc/index.html
├── ps2/index.html
├── gamecube/index.html
├── gba/index.html
├── psp/index.html
└── wii/index.html
```

## Editing a collection's games

Open `data/<platform>.json` (e.g. `data/nes.json`) in VS Code. It's a JSON array of chapters, each with four games-per-entry:

```json
[
  {
    "hue": 350,
    "tag": "Platformer",
    "title": "Foundational Platforming",
    "blurb": "One or two sentences introducing this chapter's theme.",
    "games": [
      ["Super Mario Bros.", "1985", "Nintendo", "One-line description of the game."],
      ["Mega Man 2", "1988", "Capcom", "One-line description of the game."]
    ]
  }
]
```

Notes on the fields:

- **`hue`** — a number 0–360 that sets the chapter's accent color (used in `hsl(var(--hue) ...)` throughout that page's CSS). Pick a hue that doesn't collide with a neighboring chapter if you want them visually distinct.
- **`tag`** — the short genre/category label shown next to the chapter title (e.g. "RPG", "Platformer", "Racing").
- **`title`** / **`blurb`** — the chapter's heading and one-paragraph intro.
- **`games`** — an array of `[Title, Year, Developer, Blurb]` tuples. Order within a chapter is the order they'll display in the grid.

To add a game, add another `[Title, Year, Developer, Blurb]` entry to a chapter's `games` array. To add a whole new chapter, add another object to the top-level array with the same four keys. There's no hard limit on chapter or game count — the page numbers cards automatically (No. 001, No. 002, …) and the hub's totals won't update on their own (see below).

**Keep the JSON valid**: every string in double quotes, commas between entries but not after the last one, and escape any literal `"` inside a blurb as `\"`. If a page shows a small "could not load this collection's data" message instead of your games, the most common cause is a JSON syntax error — paste the file into [jsonlint.com](https://jsonlint.com) or run `python3 -m json.tool data/nes.json` to find it.

## Editing the hub page

`data/platforms.json` is what feeds the tile grid on the home page. Each platform's entry there is independent of its own `data/<platform>.json` — so if you add or remove games from a collection, update that platform's `games` count in `platforms.json` too (and `chapters` if you added/removed a chapter), or the hub's stats and tile numbers will drift out of sync with the actual page.

## Adding a 13th platform

1. Create a new folder, e.g. `site/genesis-cd/`.
2. Copy an existing collection page's `index.html` (any of the 12) to `site/genesis-cd/index.html` as a starting point — the HTML skeleton is identical across all of them, so it doesn't matter which one you pick. Update its `<title>`, the Google Fonts `<link>` if you want different fonts, the `href` on its `theme-<platform>.css` link (point it at a new `../assets/css/theme-genesis-cd.css`), the hero copy (eyebrow, `<h1>`, lede, stats), the curator note, the footer, and the `data-src` attribute on its closing `<script>` tag (`../data/genesis-cd.json`).
3. Create `assets/css/theme-genesis-cd.css` for the new platform's look. Easiest path: copy the theme file closest to the vibe you want (e.g. `theme-nes.css` for something blocky/retro, `theme-wii.css` for something soft and rounded) and change its colors, fonts, and the small set of decorative overrides at the bottom (hero background, card shape). See "What's shared vs. per-page" below for what a theme file needs to define.
4. Create `data/genesis-cd.json` with your chapters and games, following the schema above.
5. Add one new entry to `data/platforms.json` with that platform's `id`, `icon` (an emoji), `name`, `title`, `years`, `start`/`end` (for the hub's hardware-span stat), `games`, `chapters`, `accent` (a hex color for the tile), `region`, `tagline`, and `url` (`"genesis-cd/"`).

The hub page needs no code changes — it renders however many entries are in `platforms.json`.

## What's shared vs. per-page

- **`assets/css/base.css`** is the layout every collection page shares: the hero, curator note, sticky search toolbar, chapter/card grid, and footer. Edit this file and the change applies to all 12 pages at once — this is the one place to make a site-wide layout change (spacing, grid breakpoints, adding a new section, etc.).
- **`assets/css/theme-<platform>.css`** is what makes each platform look different. It's loaded after `base.css`, so it only needs to set what's distinct for that page:
  - Color variables (`--bg`, `--surface`, `--ink`, `--accent`, etc.) for light mode, plus the two dark-mode blocks (`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`, which need the same values — the first handles system dark mode, the second handles the manual toggle).
  - Font variables (`--font-body`, `--font-display`, `--font-mono`).
  - A handful of decorative overrides at the bottom of the file — things like the hero's background pattern, card shape (`--card-radius`, a `::before`/`::after` accent bar), or one-off flourishes like PS1's scattered button glyphs or GBC's gradient bubbles. These are optional; a bare-minimum theme file with just colors and fonts still renders correctly using base.css's defaults.
- **`assets/collection.js`** is the one script every collection page uses. It reads the game data, builds the chapter/card HTML, wires up search and the theme toggle, and is the same file for all 12 pages — editing it changes behavior everywhere at once.
- **`assets/hub.js`** and **`assets/css/hub.css`** do the same job for the home page only — the hub has its own layout (tile grid instead of chapters), so it isn't built on `base.css`.
