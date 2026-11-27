# Box art
This document is written by Mistral Large 4.

The collection pages show each game's box art in a portrait tile on its card. This document explains the whole system: the data properties in `data/<platform>.json`, the fetch tool, and the card layout with its tuning knobs. It exists so future adjustments — and especially future Collections whose boxes have different proportions — don't have to be reverse-engineered from the code.

The guiding rule: **the pages never talk to ScreenScraper.** A local build tool downloads the art once, the images are committed to the repository, and the pages load plain local files. Visitor traffic never touches the API, the site stays fast and static, and a ScreenScraper outage cannot break a published page.

## The data properties

Each game in `data/<platform>.json` can carry three box-art properties:

| Property | Written by | Meaning |
|---|---|---|
| `ssGameId` | me (directly or via `ids`) | The ScreenScraper database id of the exact game. The source of truth: fetches always pull by this id, never by searching. |
| `ssRegion` | me, by hand | Optional. Pins a preferred region's scan (e.g. `"de"` for the German DuckTales 2 box) ahead of the usual `eu > uk > wor > us` fallback. |
| `art` | `fetch` | The local image path relative to `assets/`, e.g. `"img/boxart/nes/1245.png"`. Hand-edit only to delete it, which makes the card fall back to its gray placeholder tile. |

Games without an `ssGameId` are skipped by every step, and their cards keep the placeholder tile.

## The tool: tools/boxart.mjs

A zero-dependency Node script (Node 18+ for built-in `fetch`). Credentials come from shell environment variables and are never stored on disk or committed:

```
SS_DEVID         developer id (required)
SS_DEVPASSWORD   developer password (required)
SS_SOFTNAME      app name for ScreenScraper (default: "diastrocollections")
SS_SSID          optional: a regular ScreenScraper member login (better quota)
SS_SSPASSWORD    optional: password for that account
SS_SYSTEMID      optional: override the systemeid lookup (probe prints it)
```

### Commands

```
node tools/boxart.mjs probe <platform>    verify credentials and API response shapes
node tools/boxart.mjs ids <platform>     suggest ssGameId values for every game
node tools/boxart.mjs fetch <platform>   download art for games with an ssGameId
node tools/boxart.mjs search <platform> <terms...>   one-off candidate search
node tools/boxart.mjs info <platform> <ids...>        verify ids: names + art regions
```

Progress prints to stderr while a run is in flight; the review table prints to stdout at the end, so the report can be redirected cleanly.

### The workflow for a new Collection

1. **`probe`** — confirms credentials, prints the platform's `systemeid` and the API's response shapes. Run it first when adding a platform: if ScreenScraper's beta API has drifted, this is where it shows.
2. **`ids`** — searches each game by title and writes its best candidate's `ssGameId` into the data file, saving progress every 10 games (a quota cut-off mid-run loses nothing; re-running resumes). Because ScreenScraper's search cannot see colons, curly quotes and some "!" titles, each search retries with progressively simpler variants and finally falls back to `jeuInfos`' rom-name auto-match. Every match is scored against the full card title; auto-matches at 0.90+ are reported as `ok`, 0.75–0.90 as `REVIEW`, and rom-name matches are always `REVIEW`.
3. **Review** — read the printed table and the `git diff` of the data file. Check every `REVIEW` and `NO MATCH` line. For stubborn games, hunt the id with `search` (trying the title as ScreenScraper may file it — see the quirks list below) and verify with `info`, then type the `ssGameId` in by hand.
4. **`fetch`** — pulls each confirmed id's `box-2D` art, preferring regions in the order `eu > uk > wor > us` (or the game's `ssRegion` first, if set), downloads at 400px wide into `assets/img/boxart/<platform>/` and writes the `art` path into the data file. It is idempotent: art already on disk is skipped, so re-runs after a quota stop resume where they left off.
5. **Review again** — the `fetch` report lists the region used for every file. Check any line that did not come back `eu`; that is where a US or world scan stood in for a missing EU one. To swap a game's art, set its `ssRegion` (or fix its `ssGameId`), delete its image and its `art` line, and re-run `fetch`.

### ScreenScraper quirks we have met

- The search returns a single empty candidate when it finds nothing; the tool treats that as "no result".
- jeuRecherche's `systemeid` filter **leaks across related systems** when the query has no exact match on the requested one: a Game Boy search for "Super Mario Bros." returns Game Boy Color's *Deluxe*, and a "Tetris" search could offer *Tetris DX*. The `ids` command therefore checks each candidate's own `systeme.id` and skips other systems' entries (`onSystem` in the tool); `search` and `info` print the candidate's system in brackets so hand-found ids get the same check.
- Name matching can pick the wrong *game* when an entry carries another's name as an alias: **Super Mario Bros. 2 on ScreenScraper (id 1270) is The Lost Levels**, the Japanese sequel. The western Doki Doki Panic-based game is id 1248. Always sanity-check the odd ones with `info`.
- Titles are not always filed the way the box says: `Ufouria: The Saga` is "U-four-ia - The Saga" (1600), `Asterix` is "Astérix" (1331), `Sid Meier's Pirates!` is "Pirates!" (1552), `Gargoyle's Quest II: The Demon Darkness` is "Gargoyle's Quest 2" (71396), DuckTales games are "Disney's DuckTales" (1263/71346/71344), SMB3 is 1246, Bad Dudes' rom name is "DragonNinja" as one word.
- The API is rate-limited (HTTP 429) and quota-limited per day (430/431), and closes to low-tier users when its servers saturate (401). The tool backs off, resumes across days, and says so on stderr.

## The card layout

Enabled per platform with the `data-boxart` attribute on the `collection.js` script tag (the NES page first, the Game Boy page second). The renderer then builds each card as:

```
.card
└─ .card-top (grid: 3fr 7fr, 14px gap, container-type: inline-size)
   ├─ .card-art          the tile: art <img> over the gray "boxart" placeholder
   ├─ .card-top-main      No. + badge, title, developer, year
   └─ .card-blurb         the game's blurb, placed by the grid (see below)
```

The shared styles cover both pages; each theme tunes them for its console's box shape. The Game Boy theme's three deviations from the NES defaults, all in `theme-gameboy.css`:

- **Square tiles**: `--card-art-ratio: 1 / 1` — Game Boy boxes are near-square (measured mean w/h 1.002 over 100 scans), not the NES's 5:7 portrait.
- **One-line meta**: `.card-top-main .card-meta { display: block }` with a mid-dot `::before` — square tiles are short, so the default stacked developer-over-year made the text head taller than the art. Inline flow (not a flex row: a long developer string in a flex row is squeezed to fill the line and shoves the year to the row's right edge) lets the pair wrap like a sentence. The NES keeps the stacked meta; its boxes are tall enough that the head never outgrows them.
- **No hover lift**: cards are informational now; only the art tile reacts to hover.

One deviation lives in `base.css` instead, scoped to box-art cards of every theme: the head's title wraps greedily (`text-wrap: wrap` / `pretty`) instead of the site-wide `balance`, which split long titles into short even lines and pushed words that would fit onto the next line anyway.

The blurb is a grid child of `.card-top` so the same markup supports two placements:

- **Default:** it spans both columns below the art and the text head.
- **Wide-card mode** (container query, `.card-top` at least 440px wide): the art spans both grid rows and the blurb flows into the text column beside it. This fills the card in single-column view (roughly 554–779px viewport), where a full-width card would otherwise waste its right half. It never engages for 2- or 3-column cards, and phones stay in the default layout because their text column is too narrow for comfortable reading.

### The box-art viewer

Clicking (or tapping, or Enter-ing) an art tile with real art opens a modal built on the native `<dialog>` element: the art at its natural size, shrunk to fit the viewport — never wider or taller than the screen, so nothing scrolls. Escape, the Close button (top right), and a click on the backdrop all close it. Under the image, a caption names the game and links to its ScreenScraper entry (`https://www.screenscraper.fr/gameinfos.php?gameid=<ssGameId>`, new tab), so the viewer doubles as the attribution line.

Tiles without real art (placeholder, or a failed image load) are plain divs, out of the tab order. The tile button carries `data-art-src`, `data-art-title` and `data-art-id`; one delegated click listener on `#chapters` opens the dialog for any card, and the frame is tinted with the clicked card's chapter colour.

The image shown is the file on disk, so the modal's fidelity is capped by the `maxwidth` the fetcher downloads at (400px today). Box fronts upscale acceptably, but if the viewer should show crisper art on big screens, raise `MAXWIDTH` in `tools/boxart.mjs`, delete the art and re-run `fetch` — at a cost in repository size.

### The knobs

| Knob | Where | Current | Effect |
|---|---|---|---|
| Column breakpoints | `theme-<platform>.css` | NES and Game Boy: 1 col / 2 cols ≥ 780px / 3 cols ≥ 940px | Where the page switches column counts. Do the chip arithmetic below before changing them. |
| Tile proportions | `base.css` | `--card-art-ratio`, default `5 / 7` | Set per theme in `theme-<platform>.css` to match the console's box shape. |
| Art column share | `base.css` `.card-top` | `3fr 7fr` (~30%) | How much of the card the art takes. Landscape boxes may want a larger share. |
| Wide-card threshold | `base.css` `@container` | 440px | How wide a card must be before the blurb moves beside the art. |
| `maxwidth` | `tools/boxart.mjs` | 400px | Download resolution. Generous for today's tile size; future-proof for larger designs. |

### The one piece of arithmetic to remember

The "No. ###" chip and the longest badge ("PAL-optimised", in Press Start 2P at 0.5rem) need about **195px of text column** to share a line. The text column is ~70% of the card, so the chips stay side by side from cards of ~334px up — on the NES grid, from roughly a 1130px viewport. Below that, inside the widened 3-column band, the badge wraps under the number (the original spec's fallback). If that band ever bothers the eye, raise the 940px breakpoint toward 1120 and the wrap disappears. New platforms should do this arithmetic once before choosing their column breakpoints: measure the widest chip pair at the theme's display font, divide by the text column's share. The Game Boy did: "No. 100" in Silkscreen plus "Super Game Boy" in DotGothic16 is ~178px, worked through the same way in the grid comment in `theme-gameboy.css`.

## Gotchas learned the hard way

- `art` paths are relative to `assets/` (`"img/boxart/..."`), not to the repository root. Both a missing `img/` segment and a doubled `img/boxart/<platform>/` prefix have happened; `fetch`'s already-on-disk branch must keep normalising to a bare filename before re-attaching the prefix.
- Box-art pages are the only ones whose cards put the blurb inside `.card-top`. Every other platform's markup is untouched, and the shared styles are scoped so they stay that way.
