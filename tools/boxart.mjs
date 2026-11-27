#!/usr/bin/env node
/*
 * Diastro Gaming Collections — box-art build tool.
 *
 * Fetches box art from the ScreenScraper API (api.screenscraper.fr) at build
 * time and saves it into assets/img/boxart/<platform>/, so the pages never
 * talk to ScreenScraper from the visitor's browser. Run this locally, then
 * commit the images it writes.
 *
 * Credentials come from shell environment variables and are never stored on
 * disk or committed to the repo:
 *   SS_DEVID        developer id (required)
 *   SS_DEVPASSWORD  developer password (required)
 *   SS_SOFTNAME     name of this app as registered with ScreenScraper
 *                   (default: "diastrocollections")
 *   SS_SSID         optional: a regular ScreenScraper account (better quota)
 *   SS_SSPASSWORD   optional: password for that account
 *   SS_SYSTEMID     optional: override the systemeid lookup (probe shows it)
 *
 * Commands (platform is a data/<platform>.json id, e.g. "nes"):
 *   probe <platform>   verify credentials and the API's response shapes; run
 *                      this first — it prints everything needed to adapt the
 *                      parsing below if ScreenScraper's beta API drifts.
 *   ids <platform>     search each game by title and write a suggested
 *                      "ssGameId" into data/<platform>.json. Always review
 *                      the printed report (and the git diff) before keeping
 *                      the suggestions; flagged matches need a manual check.
 *   fetch <platform>   for every game with an ssGameId, download its box art
 *                      (region fallback: eu, uk, wor, us), save it to
 *                      assets/img/boxart/<platform>/ and record the local
 *                      path in the game's "art" property. Skips art that is
 *                      already on disk, so it is safe to re-run. A game may
 *                      set "ssRegion": "de" (or any ScreenScraper region) to
 *                      prefer that region's scan over the fallback order.
 *   search <platform> <terms...>
 *                      one-off candidate search: prints the id and regional
 *                      names of the top 10 matches, to fill in ssGameId
 *                      values the ids command could not match.
 *
 * Example:
 *   SS_DEVID=xxx SS_DEVPASSWORD=yyy node tools/boxart.mjs probe nes
 *
 * The full workflow, the data properties, the card layout and its tuning
 * knobs are documented in tools/README.md.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.screenscraper.fr/api2/';
const REGION_FALLBACK = ['eu', 'uk', 'wor', 'us'];
const MEDIA_TYPE = 'box-2D';
const MAXWIDTH = 400;
const THROTTLE_MS = 800;
const MATCH_AUTO = 0.9;
const MATCH_REVIEW = 0.75;

// Names to recognise the platform in systemesListe.php, per data/<id>.json.
const SYSTEM_NAMES = {
  nes: ['nintendo entertainment system', 'nes'],
  gameboy: ['game boy', 'nintendo game boy'],
};

const creds = {
  devid: process.env.SS_DEVID,
  devpassword: process.env.SS_DEVPASSWORD,
  softname: process.env.SS_SOFTNAME || 'diastrocollections',
  ssid: process.env.SS_SSID || '',
  sspassword: process.env.SS_SSPASSWORD || '',
};

function requireCreds() {
  if (!creds.devid || !creds.devpassword) {
    console.error('Missing SS_DEVID / SS_DEVPASSWORD. For example:\n' +
      '  SS_DEVID=xxx SS_DEVPASSWORD=yyy node tools/boxart.mjs probe nes');
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ScreenScraper's error bodies say more than the status code; surface them.
async function bodyHint(res) {
  try {
    const text = (await res.text()).trim();
    return text ? 'API says: "' + text.slice(0, 200) + '" ' : '';
  } catch (err) {
    return '';
  }
}

// Live progress during long runs, on stderr so stdout's final report can be
// redirected cleanly; both show interleaved in a terminal.
function progress(text) {
  process.stderr.write(text + '\n');
}

let lastCall = 0;

// One API call, throttled, with the retry/abort policy ScreenScraper asks for:
// back off on 429 (too fast) and server errors, stop the run on quota (430/431)
// and on closed-API/credential errors (401/403/423), return null on 404.
async function api(endpoint, params) {
  const url = new URL(API + endpoint);
  const all = {
    devid: creds.devid,
    devpassword: creds.devpassword,
    softname: creds.softname,
    ssid: creds.ssid,
    sspassword: creds.sspassword,
    output: 'json',
    ...params,
  };
  for (const [key, value] of Object.entries(all)) {
    if (value !== '' && value !== null && value !== undefined) url.searchParams.set(key, value);
  }

  for (let attempt = 1; ; attempt++) {
    const wait = THROTTLE_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= 3) throw new Error(endpoint + ': network error — ' + err.message);
      progress('    … network error, retrying (' + attempt + ')');
      await sleep(1000 * attempt);
      continue;
    }
    if (res.status === 429 && attempt < 3) {
      progress('    … rate-limited, waiting ' + ((15000 * attempt) / 1000) + 's');
      await sleep(15000 * attempt);
      continue;
    }
    if (res.status === 430 || res.status === 431) {
      console.error(endpoint + ': daily quota reached (' + res.status + '). ' + await bodyHint(res) +
        'Re-run tomorrow; already-downloaded art is skipped, so the run resumes where it stopped.');
      process.exit(2);
    }
    if (res.status === 401 || res.status === 423) {
      console.error(endpoint + ': API closed to your user level right now (' + res.status + '). ' + await bodyHint(res) +
        'ScreenScraper saturates at busy times; try again later or attach SS_SSID credentials.');
      process.exit(2);
    }
    if (res.status === 403) {
      console.error(endpoint + ': developer credentials rejected (403). ' + await bodyHint(res) +
        'Check SS_DEVID / SS_DEVPASSWORD / SS_SOFTNAME.');
      process.exit(2);
    }
    if (res.status === 404) return null;
    if (res.ok) return await res.json();
    if (attempt >= 3) throw new Error(endpoint + ': HTTP ' + res.status);
    await sleep(1000 * attempt);
  }
}

// ---------- Response-shape helpers (validated by the probe command) ----------
// ScreenScraper's API v2 is a beta; these helpers find the payload no matter
// whether it sits at the top level or under "response".

function gameList(payload) {
  if (Array.isArray(payload?.jeux)) return payload.jeux;
  if (Array.isArray(payload?.response?.jeux)) return payload.response.jeux;
  return [];
}

function gameNames(game) {
  const names = [];
  const push = (v) => {
    if (typeof v === 'string' && v && !names.includes(v)) names.push(v);
  };
  const walk = (nom) => {
    if (!nom) return;
    if (typeof nom === 'string') push(nom);
    else if (Array.isArray(nom)) nom.forEach((n) => walk(n));
    else if (typeof nom === 'object') {
      if (typeof nom.text === 'string') push(nom.text);
      else if (typeof nom.nom === 'string') push(nom.nom);
      // e.g. systemesListe's noms: { nom_eu: "NES", noms_commun: "NES,Famicom" }
      else for (const value of Object.values(nom)) if (typeof value === 'string') push(value);
    }
  };
  walk(game?.nom);
  walk(game?.noms);
  return names;
}

function gameId(game) {
  return String(game?.id ?? game?.gameid ?? game?.jeuid ?? '');
}

function normalizedTitle(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  const na = normalizedTitle(a);
  const nb = normalizedTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

// ---------- Platform helpers ----------

function readData(platform) {
  const file = join(ROOT, 'data', platform + '.json');
  return { file, data: JSON.parse(readFileSync(file, 'utf8')) };
}

// data/<platform>.json is hand-formatted (2-space indent, no trailing
// newline); stringify with the same settings so a re-write only shows the
// lines that actually changed.
function writeData(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2));
}

function eachGame(data) {
  const games = [];
  for (const chapter of data) {
    for (const game of chapter.games || []) games.push(game);
  }
  return games;
}

async function findSystemId(platform) {
  if (process.env.SS_SYSTEMID) return process.env.SS_SYSTEMID;
  const payload = await api('systemesListe.php', {});
  const systems = payload?.systemes || payload?.response?.systemes || [];
  const wanted = SYSTEM_NAMES[platform] || [platform];
  const flat = [];
  const collect = (entry) => {
    if (Array.isArray(entry)) { entry.forEach(collect); return; }
    if (entry && typeof entry === 'object' && entry.id != null) flat.push(entry);
  };
  collect(systems);
  for (const system of flat) {
    // Exact token match against every name, including the comma-separated
    // noms_commun list: substring matching would hit "geNESis" for "nes".
    const tokens = gameNames(system)
      .flatMap((n) => n.toLowerCase().split(','))
      .map((t) => t.trim());
    if (wanted.some((w) => tokens.includes(w))) return String(system.id);
  }
  console.error('Could not find the system id for "' + platform + '". Run the probe command, ' +
    'then pass the id with SS_SYSTEMID until it is added to SYSTEM_NAMES.');
  process.exit(2);
}

// Media URLs come straight from jeuInfos and are plain image files; they are
// fetched with the same throttle and retry policy as the API endpoints.
async function downloadMedia(url) {
  const target = new URL(url);
  target.searchParams.set('maxwidth', String(MAXWIDTH));
  for (let attempt = 1; ; attempt++) {
    const wait = THROTTLE_MS - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    let res;
    try {
      res = await fetch(target);
    } catch (err) {
      if (attempt >= 3) throw new Error('media download failed — ' + err.message);
      progress('    … network error, retrying (' + attempt + ')');
      await sleep(1000 * attempt);
      continue;
    }
    if (res.ok) return res;
    if (attempt >= 3) throw new Error('media download HTTP ' + res.status + ' — ' + target.href);
    progress('    … media download HTTP ' + res.status + ', retrying (' + attempt + ')');
    await sleep(1000 * attempt);
  }
}

// ---------- Commands ----------

async function probe(platform) {
  requireCreds();
  readData(platform); // fail fast if the platform id is wrong

  // systemesListe.php needs the dev credentials only, so it doubles as the
  // credential check. ssuserInfos.php additionally wants a member login
  // (ssid/sspassword), so it runs last and is skipped without one.
  console.log('== systemesListe.php — dev credentials + the id for ' + platform + ' ==');
  const systemId = await findSystemId(platform);
  console.log('systemeid: ' + systemId + ' (dev credentials accepted)');

  console.log('\n== jeuRecherche.php — search "Super Mario Bros." ==');
  const search = await api('jeuRecherche.php', { recherche: 'Super Mario Bros.', systemeid: systemId });
  const candidates = gameList(search);
  console.log('candidates: ' + candidates.length);
  if (candidates.length) {
    console.log('first candidate: ' + JSON.stringify(candidates[0], null, 2).slice(0, 1500));
  }

  console.log('\n== jeuInfos.php — direct lookup by gameid ==');
  const first = candidates[0];
  const gameIdToTry = gameId(first) || '3';
  const info = await api('jeuInfos.php', { gameid: gameIdToTry, systemeid: systemId });
  const game = info?.jeu || info?.response?.jeu || info?.game || {};
  const medias = game?.medias || [];
  console.log('game id: ' + gameId(game) + ', medias: ' + medias.length);
  console.log(medias.filter((m) => m.type === MEDIA_TYPE)
    .map((m) => m.type + ' [' + m.region + '] ' + m.url)
    .join('\n') || 'no ' + MEDIA_TYPE + ' medias found');

  console.log('\n== ssuserInfos.php — level and quota ==');
  if (!creds.ssid) {
    console.log('skipped: needs a member login. Set SS_SSID / SS_SSPASSWORD to raise the quota ' +
      'above the dev-only level (everything above works without it).');
  } else {
    const user = await api('ssuserInfos.php', {});
    const u = user?.ssuser || user?.response?.ssuser || {};
    console.log(JSON.stringify({
      id: u.id, niveau: u.niveau, contribution: u.contribution,
      maxthreads: u.maxthreads, requeststoday: u.requeststoday,
      maxrequestspermin: u.maxrequestspermin, maxrequestsperday: u.maxrequestsperday,
    }, null, 2));
  }

  console.log('\nIf any of the above looks different from what the parsing expects, ' +
    'the shapes have drifted; adjust gameList()/gameNames()/gameId() accordingly.');
}

// jeuRecherche chokes on colons, curly quotes and "!" (it answers with a
// single empty candidate), so a search tries progressively simpler queries:
// the full title, then a cleaned one, then the title without its subtitle.
// Candidates are always scored against the full original title.
function searchQueries(title) {
  const variants = [title];
  const cleaned = title.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[!?]+/g, '').trim();
  if (cleaned && !variants.includes(cleaned)) variants.push(cleaned);
  const main = cleaned.split(':')[0].trim();
  if (main && !variants.includes(main)) variants.push(main);
  return variants;
}

// A candidate list that is one empty object means "no result" (see above).
function usableCandidates(payload) {
  const candidates = gameList(payload);
  if (!candidates.length) return [];
  if (candidates.length === 1 && !gameId(candidates[0])) return [];
  return candidates;
}

// jeuRecherche's systemeid filter leaks across related systems when the
// query has no exact match on the requested one: the probe's "Super Mario
// Bros." search on Game Boy returns Game Boy Color's Deluxe, and a "Tetris"
// search could offer Tetris DX. Candidates carrying another system's id are
// skipped; candidates without systeme info are kept (their id is all we
// have, and the report still shows what matched).
function onSystem(candidate, systemId) {
  const sid = candidate?.systeme?.id;
  return sid == null || String(sid) === String(systemId);
}

async function ids(platform) {
  requireCreds();
  const { file, data } = readData(platform);
  const systemId = await findSystemId(platform);
  const games = eachGame(data);
  const report = [];
  let searched = 0;
  let seen = 0;

  for (const game of games) {
    seen++;
    if (game.ssGameId) { report.push([game.title, '', game.ssGameId, 1, 'already set']); continue; }
    let best = null;
    let bestScore = 0;
    let bestName = '';
    let queriesTried = 0;
    const variants = searchQueries(game.title);
    for (const query of variants) {
      const payload = await api('jeuRecherche.php', { recherche: query, systemeid: systemId });
      searched++;
      queriesTried++;
      for (const candidate of usableCandidates(payload)) {
        if (!onSystem(candidate, systemId)) continue;
        for (const name of gameNames(candidate)) {
          const score = similarity(game.title, name);
          if (score > bestScore) { best = candidate; bestScore = score; bestName = name; }
        }
      }
      if (bestScore >= MATCH_REVIEW) break;
    }
    let romMatched = false;
    if (!best || bestScore < MATCH_REVIEW) {
      // jeuRecherche cannot see every title (e.g. ones containing "!"), so give
      // jeuInfos' rom-name auto-match a last shot with the simplest variant.
      // Accepted on the same thresholds, comparing both the full title and its
      // main part (ScreenScraper often files games without their subtitle),
      // and always flagged REVIEW because it is a single unranked result.
      const matched = await api('jeuInfos.php', {
        romnom: variants[variants.length - 1] + '.zip', romtype: 'rom', systemeid: systemId,
      });
      searched++;
      const game2 = matched?.jeu || matched?.response?.jeu || null;
      if (game2 && gameId(game2) && onSystem(game2, systemId)) {
        for (const name of gameNames(game2)) {
          const full = similarity(game.title, name);
          const main = variants.length > 1
            ? similarity(variants[variants.length - 1], name) : 0;
          const score = Math.max(full, main >= MATCH_AUTO ? main : 0);
          if (score > bestScore) { best = game2; bestScore = score; bestName = name; romMatched = true; }
        }
      }
    }
    const tag = '[' + String(seen).padStart(3) + '/' + games.length + '] ';
    if (!best || bestScore < MATCH_REVIEW) {
      progress(tag + game.title + ' — no match' + (queriesTried > 1 ? ' (' + queriesTried + ' variants tried)' : ''));
      report.push([game.title, bestName || '(no candidate)', gameId(best) || '—', bestScore,
        'NO MATCH — find by hand' + (queriesTried > 1 ? ' (' + queriesTried + ' variants tried)' : '')]);
      continue;
    }
    game.ssGameId = Number(gameId(best));
    progress(tag + game.title + ' → ' + game.ssGameId + ' (' + bestScore.toFixed(2) + (bestScore < MATCH_AUTO ? ', REVIEW' : '') + ')');
    report.push([game.title, bestName, game.ssGameId, bestScore,
      romMatched ? 'REVIEW — rom-name auto-match, check it'
        : bestScore >= MATCH_AUTO ? 'ok' : 'REVIEW — plausible but check it']);
    // Save as we go, so a quota cut-off mid-run keeps the matches so far.
    if (searched % 10 === 0) writeData(file, data);
  }

  writeData(file, data);
  const width = 38;
  console.log('\n' + platform + ': searched ' + searched + ' of ' + games.length + ' games, ssGameId written to ' + file);
  for (const [title, matched, id, score, status] of report) {
    console.log(
      (title.length > width ? title.slice(0, width - 1) + '…' : title).padEnd(width + 2) +
      (matched.length > width ? matched.slice(0, width - 1) + '…' : matched).padEnd(width + 2) +
      String(id).padStart(6) + '  ' + score.toFixed(2) + '  ' + status
    );
  }
  console.log('\nReview the REVIEW and NO MATCH lines (and the git diff) before committing.');
}

async function fetchArt(platform) {
  requireCreds();
  const { file, data } = readData(platform);
  const systemId = await findSystemId(platform);
  const dir = join(ROOT, 'assets', 'img', 'boxart', platform);
  mkdirSync(dir, { recursive: true });
  const existing = new Set(readdirSync(dir));
  const games = eachGame(data);
  const rows = [];
  let missingId = 0;
  let seen = 0;

  for (const game of games) {
    seen++;
    const tag = '[' + String(seen).padStart(3) + '/' + games.length + '] ';
    if (!game.ssGameId) {
      missingId++;
      progress(tag + game.title + ' — no ssGameId yet');
      rows.push([game.title, '—', 'no ssGameId']);
      continue;
    }
    const id = String(game.ssGameId);
    // Normalise to a bare filename: game.art is already a full path, and the
    // on-disk lookup is by filename, so mixing the two forms would double the
    // "img/boxart/<platform>/" prefix when it gets re-attached below.
    const artName = game.art ? game.art.split('/').pop() : null;
    const already = artName && existing.has(artName)
      ? artName
      : [...existing].find((f) => f.startsWith(id + '.'));
    if (already) {
      game.art = 'img/boxart/' + platform + '/' + already;
      progress(tag + game.title + ' — already on disk (' + already + ')');
      rows.push([game.title, already, 'already on disk']);
      continue;
    }

    const info = await api('jeuInfos.php', { gameid: id, systemeid: systemId });
    const gameInfo = info?.jeu || info?.response?.jeu || info?.game || null;
    const medias = (gameInfo?.medias || []).filter((m) => m.type === MEDIA_TYPE);
    if (!medias.length) {
      progress(tag + game.title + ' — no ' + MEDIA_TYPE + ' media on ScreenScraper');
      rows.push([game.title, '—', 'no ' + MEDIA_TYPE + ' media']);
      continue;
    }

    // A game's optional "ssRegion" (e.g. "de") pins its preferred scan before
    // the usual eu > uk > wor > us fallback — for when a specific country's
    // box is the right one for a Europe-first collection.
    const chain = game.ssRegion
      ? [game.ssRegion, ...REGION_FALLBACK.filter((r) => r !== game.ssRegion)]
      : REGION_FALLBACK;
    let chosen = null;
    for (const region of chain) {
      chosen = medias.find((m) => m.region === region);
      if (chosen) break;
    }
    if (!chosen) chosen = medias[0]; // any region beats no art; the report shows it
    const res = await downloadMedia(chosen.url);
    const type = res.headers.get('content-type') || '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = id + '.' + ext;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(dir, name), buffer);
    game.art = 'img/boxart/' + platform + '/' + name;
    existing.add(name);
    progress(tag + game.title + ' → ' + name + ' (' + (chosen.region || '?') + ', ' + ((buffer.length / 1024) | 0) + ' KB)');
    rows.push([game.title, name, (chosen.region || '?') + ' ' + ((buffer.length / 1024) | 0) + ' KB']);
  }

  writeData(file, data);
  const width = 38;
  console.log('\n' + platform + ': ' + games.length + ' games, ' + missingId + ' without ssGameId');
  for (const [title, file2, status] of rows) {
    console.log(
      (title.length > width ? title.slice(0, width - 1) + '…' : title).padEnd(width + 2) +
      String(file2).padEnd(30) + status
    );
  }
  console.log('\nRegion fallback order: ' + REGION_FALLBACK.join(' > ') +
    '. Files without a listed region fell outside it; check those.');
}

async function search(platform, queries) {
  requireCreds();
  const systemId = await findSystemId(platform);
  for (const query of queries) {
    const payload = await api('jeuRecherche.php', { recherche: query, systemeid: systemId });
    const candidates = usableCandidates(payload);
    if (candidates.length) {
      console.log('\n"' + query + '": ' + candidates.length + ' candidates');
      for (const candidate of candidates.slice(0, 10)) {
        if (!gameId(candidate)) {
          console.log('  (unparsed candidate, raw:) ' + JSON.stringify(candidate).slice(0, 400));
          continue;
        }
        console.log('  ' + String(gameId(candidate)).padStart(8) + '  ' + gameNames(candidate).slice(0, 4).join(' / ') +
          (candidate?.systeme?.text ? '  [' + candidate.systeme.text + ']' : ''));
      }
      continue;
    }
    // No candidates: jeuRecherche cannot see titles containing "!" (e.g.
    // "Pirates!"), so fall back to the rom-name auto-match on jeuInfos.
    const matched = await api('jeuInfos.php', { romnom: query + '.zip', romtype: 'rom', systemeid: systemId });
    const game = matched?.jeu || matched?.response?.jeu || null;
    if (game && gameId(game)) {
      console.log('\n"' + query + '": no search candidates; rom-name auto-match:');
      console.log('  ' + String(gameId(game)).padStart(8) + '  ' + gameNames(game).slice(0, 4).join(' / '));
    } else {
      console.log('\n"' + query + '": no candidates');
    }
  }
}

// Verify a manually chosen ssGameId before committing it: shows the game's
// names and which regions have box-2D art.
async function info(platform, ids) {
  requireCreds();
  const systemId = await findSystemId(platform);
  for (const id of ids) {
    const payload = await api('jeuInfos.php', { gameid: id, systemeid: systemId });
    const game = payload?.jeu || payload?.response?.jeu || payload?.game || null;
    if (!game) { console.log('\n' + id + ': not found'); continue; }
    const boxes = (game.medias || []).filter((m) => m.type === MEDIA_TYPE);
    const regions = [...new Set(boxes.map((m) => m.region))];
    console.log('\n' + id + ': ' + gameNames(game).slice(0, 6).join(' / ') +
      (game?.systeme?.text ? '  [' + game.systeme.text + ']' : ''));
    console.log('  box-2D regions: ' + (regions.join(', ') || 'none'));
  }
}

const [command, platform = 'nes', ...rest] = process.argv.slice(2);
if (command === 'probe') await probe(platform);
else if (command === 'ids') await ids(platform);
else if (command === 'fetch') await fetchArt(platform);
else if (command === 'search') await search(platform, rest);
else if (command === 'info') await info(platform, rest);
else {
  console.error('Usage: node tools/boxart.mjs <probe|ids|fetch|search|info> <platform> [search terms...]');
  process.exit(1);
}
