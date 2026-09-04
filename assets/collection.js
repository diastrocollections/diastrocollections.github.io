/*
 * Diastro Gaming Collections — shared collection-page renderer.
 *
 * Every platform page (nes/index.html, snes/index.html, ...) includes this
 * script with two attributes on the <script> tag itself:
 *
 *   <script src="../assets/collection.js" data-src="../data/nes.json"></script>
 *
 * Optional: data-glyphs='[{"ch":"△","color":"#2FA84F"}, ...]' cycles a small
 * colored glyph badge through chapters/cards in that order (used by PS1).
 *
 * The page itself only needs to provide these elements (ids/classes):
 *   #chapters      - empty container the chapters render into
 *   #chips         - empty container the chapter-jump chips render into
 *   #searchInput   - text input (optional; search is skipped if absent)
 *   #resultCount   - small "N / total" label (optional)
 *   #emptyState    - "no results" message element (optional)
 *   #totalCount    - element to fill with the total game count (optional)
 *   #themeToggle   - button that cycles light/dark/system (optional)
 *
 * Data file shape (data/<id>.json) — a plain JSON array of chapters:
 *   [
 *     { "hue": 350, "tag": "Platformer", "title": "...", "blurb": "...",
 *       "games": [ ["Title", "Year", "Developer", "One-line blurb"], ... ] },
 *     ...
 *   ]
 */
(function () {
  var scriptEl = document.currentScript;
  var dataSrc = scriptEl.getAttribute('data-src');
  var glyphsAttr = scriptEl.getAttribute('data-glyphs');
  var GLYPHS = null;
  if (glyphsAttr) {
    try { GLYPHS = JSON.parse(glyphsAttr); } catch (e) { GLYPHS = null; }
  }

  var romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  function normalize(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function render(DATA) {
    var chaptersEl = document.getElementById('chapters');
    var chipsEl = document.getElementById('chips');
    if (!chaptersEl) return;

    var globalIdx = 0;

    DATA.forEach(function (chapter, ci) {
      var section = document.createElement('section');
      section.className = 'chapter';
      section.id = 'ch-' + (ci + 1);
      section.style.setProperty('--hue', chapter.hue);

      var head = document.createElement('div');
      head.className = 'chapter-head';
      var chapterGlyph = '';
      if (GLYPHS && GLYPHS.length) {
        var cg = GLYPHS[ci % GLYPHS.length];
        chapterGlyph = '<span class="chapter-glyph" style="color:' + cg.color + '">' + cg.ch + '</span>';
      }
      head.innerHTML =
        '<span class="chapter-num">' + chapterGlyph + romanNumerals[ci] + '</span>' +
        '<h2 class="chapter-title">' + chapter.title + '</h2>' +
        '<span class="chapter-tag">' + chapter.tag + '</span>';
      section.appendChild(head);

      var blurb = document.createElement('p');
      blurb.className = 'chapter-blurb';
      blurb.textContent = chapter.blurb;
      section.appendChild(blurb);

      var grid = document.createElement('div');
      grid.className = 'grid';

      chapter.games.forEach(function (game) {
        var title = game[0], year = game[1], dev = game[2], gblurb = game[3];
        globalIdx++;
        var card = document.createElement('div');
        card.className = 'card';
        var searchStr = (title + ' ' + dev + ' ' + gblurb + ' ' + chapter.title + ' ' + chapter.tag).toLowerCase();
        card.setAttribute('data-search', searchStr);
        var cardGlyph = '';
        if (GLYPHS && GLYPHS.length) {
          var g = GLYPHS[(globalIdx - 1) % GLYPHS.length];
          cardGlyph = '<span class="card-glyph" style="color:' + g.color + '">' + g.ch + '</span>';
        }
        card.innerHTML =
          '<span class="card-idx">' + cardGlyph + 'No. ' + String(globalIdx).padStart(3, '0') + '</span>' +
          '<h3 class="card-title">' + title + '</h3>' +
          '<span class="card-meta">' + year + ' · ' + dev + '</span>' +
          '<p class="card-blurb">' + gblurb + '</p>';
        grid.appendChild(card);
      });

      section.appendChild(grid);
      chaptersEl.appendChild(section);

      if (chipsEl) {
        var chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = romanNumerals[ci] + '. ' + chapter.tag;
        chip.addEventListener('click', function () {
          document.getElementById('ch-' + (ci + 1)).scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        chipsEl.appendChild(chip);
      }
    });

    var totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) totalCountEl.textContent = globalIdx;

    var resultCount = document.getElementById('resultCount');
    if (resultCount) resultCount.textContent = globalIdx + ' / ' + globalIdx;

    var searchInput = document.getElementById('searchInput');
    var emptyState = document.getElementById('emptyState');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = normalize(searchInput.value.trim());
        var visible = 0;
        document.querySelectorAll('.chapter').forEach(function (sec) {
          var chapterVisible = 0;
          sec.querySelectorAll('.card').forEach(function (card) {
            var match = normalize(card.getAttribute('data-search')).indexOf(q) !== -1;
            card.classList.toggle('hidden', !match);
            if (match) { chapterVisible++; visible++; }
          });
          sec.classList.toggle('hidden', chapterVisible === 0);
        });
        if (resultCount) resultCount.textContent = visible + ' / ' + globalIdx;
        if (emptyState) emptyState.style.display = visible === 0 ? 'block' : 'none';
      });
    }
  }

  function showError(err) {
    var chaptersEl = document.getElementById('chapters');
    if (chaptersEl) {
      chaptersEl.innerHTML =
        '<p style="padding:2rem 0;color:var(--text-faint,var(--ink-faint,#888));">' +
        'Could not load this collection’s data (' + dataSrc + '). ' +
        'If you’re opening this file directly (file://) instead of through a local server, ' +
        'the browser blocks the fetch — serve the site with something like <code>npx serve</code> ' +
        'or GitHub Pages instead.</p>';
    }
    console.error('collection.js: failed to load ' + dataSrc, err);
  }

  if (dataSrc) {
    fetch(dataSrc)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(render)
      .catch(showError);
  }

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    var root = document.documentElement;
    themeToggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next;
      if (!current) next = prefersDark ? 'light' : 'dark';
      else if (current === 'dark') next = 'light';
      else next = 'dark';
      root.setAttribute('data-theme', next);
    });
  }
})();
