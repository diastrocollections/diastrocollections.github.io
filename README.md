# Diastro Gaming — Explorer's Collections

A twelve-platform field guide to classic console and handheld games — NES, Game Boy, Mega Drive, SNES, PlayStation, Nintendo 64, Game Boy Color, PlayStation 2, GameCube, Game Boy Advance, PSP, and Wii. 1,200 games across 144 genre chapters.

This is a static site: no build step, no server-side code. Every page fetches its game data from a JSON file at runtime, so you can edit the JSON in any text editor (VS Code works great) without touching HTML or JavaScript.

## Site structure

```
site/
├── index.html              the hub page (the tile grid linking to all 12 collections)
├── assets/
│   ├── hub.js               renders the hub's tiles + stats from data/platforms.json
│   └── collection.js        shared renderer used by all 12 collection pages
├── data/
│   ├── platforms.json        one entry per platform, feeds the hub page
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
├── nes/index.html            each of these is a collection page — its own
├── gameboy/index.html        look and feel (fonts, colors, hero copy), but all
├── megadrive/index.html      of them render their games through the shared
├── snes/index.html           assets/collection.js script, reading their own
├── ps1/index.html             data/<platform>.json file.
├── n64/index.html
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
2. Copy an existing collection page (pick one with a similar visual style you like) to `site/genesis-cd/index.html`, and change its `<title>`, hero copy, `<style>` colors/fonts as you like, and the `data-src` attribute on its closing `<script>` tag to point at `../data/genesis-cd.json`.
3. Create `data/genesis-cd.json` with your chapters and games, following the schema above.
4. Add one new entry to `data/platforms.json` with that platform's `id`, `icon` (an emoji), `name`, `title`, `years`, `start`/`end` (for the hub's hardware-span stat), `games`, `chapters`, `accent` (a hex color for the tile), `region`, `tagline`, and `url` (`"genesis-cd/"`).

The hub page needs no code changes — it renders however many entries are in `platforms.json`.

## Running it locally

Because the pages fetch JSON with `fetch()`, opening `index.html` directly from disk (a `file://` URL) won't work — browsers block that fetch for local files. Serve the folder instead:

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Or, if you have Node installed:

```bash
npx serve site
```

## Deploying to GitHub Pages

1. Create a new GitHub repository and push the contents of this `site/` folder to it (the repo root should be `index.html`, `assets/`, `data/`, and the 12 platform folders — not a `site/` subfolder, unless you configure Pages to serve from `/site`).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch," pick your default branch (usually `main`) and the `/ (root)` folder.
4. Save. GitHub will build and publish the site at `https://<your-username>.github.io/<repo-name>/` within a minute or two.
5. Any time you push a change to the JSON or HTML files, GitHub Pages rebuilds automatically — no build step needed on your end.

## What's shared vs. per-page

- **`assets/collection.js`** is the one script every collection page uses. It reads the game data, builds the chapter/card HTML, wires up search and the theme toggle, and is the same file for all 12 pages — editing it changes behavior everywhere at once.
- **`assets/hub.js`** does the same job for the home page only.
- Each collection page's own `<style>` block controls that platform's fonts, colors, and layout flourishes — those are intentionally different per platform and won't be touched by editing `collection.js`.
- A few pages (PlayStation 2, GameCube, Wii) don't have a dark/light theme toggle button, matching how they originally shipped; the rest do. This is cosmetic only and doesn't affect the data-editing workflow above.
