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
 * Optional: data-boxart (a bare attribute) wraps the card's number, title and
 * meta around a portrait box-art tile in the card's top-left (the blurb stays
 * full width below). The tile is a styled placeholder; real art is filled in
 * later, per Collection. When a game has both art and an ssGameId, the tile
 * opens the box-art viewer: a modal showing the art larger, with a caption
 * crediting ScreenScraper and linking to the game's entry there.
 *
 * The page itself only needs to provide these elements (ids/classes):
 *   #chapters      - empty container the chapters render into
 *   #chips         - empty container the chapter links render into, inside
 *                    #chaptersPanel, which #chaptersToggle opens and closes;
 *                    #chaptersCurrent shows the chapter you're reading (optional)
 *   #searchInput   - the filter input (optional; filtering is skipped if absent),
 *                    with #filterClear to empty it and #filterStatus, a
 *                    visually hidden live region that announces the result
 *   #resultCount   - small "N of total" label (optional)
 *   #emptyState    - "no results" message element (optional)
 *   #totalCount    - element to fill with the total game count (optional)
 *   .hero .eyebrow - gets the Hand-written / Draft status appended (optional;
 *                    needs assets/status.js loaded first)
 *   #curatorNote   - the curator's note card, wraps #noteBody + #noteToggle
 *                    for the collapsible teaser (optional)
 *   #noteToggle    - button that expands/collapses the curator's note (optional)
 *
 * Data file shape (data/<id>.json) — a plain JSON array of chapters:
 *   [
 *     { "hue": 350, "tag": "Platformer", "title": "...", "blurb": "...",
 *       "games": [
 *         { "title": "...", "year": "...", "developer": "...", "blurb": "...",
 *           "badge": "..." },   // badge is optional: a short label beside the card's No.
 *         ...
 *       ] },
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
  var BOXART = scriptEl.getAttribute('data-boxart') !== null;

  // "../data/nes.json" → "../assets/", the base for game.art paths written by
  // tools/boxart.mjs (e.g. "img/boxart/nes/4023.png").
  var ASSET_BASE = dataSrc ? dataSrc.replace(/data\/[^/]+$/, 'assets/') : '';

  var romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // Strip accents and fold curly quotes to straight ones, so typing "kirby's"
  // or "pokemon" still matches "Kirby’s" and "Pokémon".
  function normalize(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
  }

  // Game titles go into the box-art tile's data-* attributes and aria-label;
  // quotes and angle brackets would break out of the attribute.
  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        '<span class="chapter-num">' + chapterGlyph + '<span class="chapter-num-text">' + romanNumerals[ci] + '</span></span>' +
        '<div class="chapter-head-main">' +
        '<h2 class="chapter-title" tabindex="-1">' + chapter.title + '</h2>' +
        '<span class="chapter-tag">' + chapter.tag + '</span>' +
        '</div>';
      section.appendChild(head);

      var blurb = document.createElement('p');
      blurb.className = 'chapter-blurb';
      blurb.innerHTML = chapter.blurb;
      section.appendChild(blurb);

      var grid = document.createElement('div');
      grid.className = 'grid';

      chapter.games.forEach(function (game) {
        var title = game.title, year = game.year, dev = game.developer, gblurb = game.blurb, badge = game.badge;
        globalIdx++;
        var card = document.createElement('div');
        card.className = 'card';
        var searchStr = (title + ' ' + dev + ' ' + gblurb + ' ' + chapter.title + ' ' + chapter.tag + (badge ? ' ' + badge : '')).toLowerCase();
        card.setAttribute('data-search', searchStr);
        var cardGlyph = '';
        if (GLYPHS && GLYPHS.length) {
          var g = GLYPHS[(globalIdx - 1) % GLYPHS.length];
          cardGlyph = '<span class="card-glyph" style="color:' + g.color + '">' + g.ch + '</span>';
        }
        var idx = '<span class="card-idx">' + cardGlyph + 'No. ' + String(globalIdx).padStart(3, '0') + '</span>';
        // Cards without a badge keep the bare index so no theme's card styling shifts.
        if (badge) idx = '<div class="card-head">' + idx + '<span class="card-badge">' + badge + '</span></div>';
        var head =
          idx +
          '<h3 class="card-title">' + title + '</h3>' +
          '<span class="card-meta">' + year + ' · ' + dev + '</span>';
        if (BOXART) {
          // Box-art cards stack the meta: developer above, release year below.
          // game.art (from tools/boxart.mjs) overlays the placeholder tile; a
          // broken image removes itself so the placeholder shows instead.
          // The blurb sits inside .card-top so the grid can move it around:
          // spanning the full width below on narrow cards, but flowing in the
          // text column beside the art on wide single-column cards.
          var artImg = game.art
            ? '<img class="card-art-img" src="' + ASSET_BASE + game.art + '" alt="" loading="lazy" onerror="this.remove()">'
            : '';
          // With real art and a ScreenScraper id to link to, the tile is a
          // button that opens the box-art viewer. Placeholder tiles stay a
          // plain div, kept out of the tab order, since there is nothing to
          // show. The data-* attributes carry what the viewer needs. Buttons
          // also carry a pixel magnifier that CSS reveals on hover over the
          // darkened art. Editable source: assets/icons/boxart-magnifier-nes.svg
          // (12x12 grid at 4px cells); this inline copy is the same artwork
          // with the empty margin trimmed (10x10 viewBox) and recolored to
          // currentColor, so CSS gives it the chapter colour — keep the two
          // in sync when the source changes.
          var tileInner = artImg + '<span class="card-art-fallback">boxart</span>';
          var zoomSvg = '<svg class="card-art-zoom" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM6 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM7 6h1v1h-1zM6 7h1v1h-1zM8 7h1v1h-1zM7 8h1v1h-1zM9 8h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1z"/></svg>';
          var tile = (artImg && game.ssGameId)
            ? '<button class="card-art card-art-btn" type="button"' +
            ' data-art-src="' + ASSET_BASE + game.art + '"' +
            ' data-art-title="' + escapeAttr(title) + '"' +
            ' data-art-id="' + game.ssGameId + '"' +
            ' aria-label="View the box art of ' + escapeAttr(title) + ' larger">' + tileInner + zoomSvg + '</button>'
            : '<div class="card-art" aria-hidden="true">' + tileInner + '</div>';
          card.innerHTML =
            '<div class="card-top">' +
            tile +
            '<div class="card-top-main">' +
            idx +
            '<h3 class="card-title">' + title + '</h3>' +
            '<div class="card-meta"><span>' + dev + '</span><span>' + year + '</span></div>' +
            '</div>' +
            '<p class="card-blurb">' + gblurb + '</p>' +
            '</div>';
        } else {
          card.innerHTML = head + '<p class="card-blurb">' + gblurb + '</p>';
        }
        grid.appendChild(card);
      });

      section.appendChild(grid);
      chaptersEl.appendChild(section);

      if (chipsEl) {
        var chip = document.createElement('a');
        chip.className = 'chip';
        chip.href = '#ch-' + (ci + 1);
        chip.textContent = romanNumerals[ci] + '. ' + chapter.tag;
        chipsEl.appendChild(chip);
      }
    });

    var totalCountEl = document.getElementById('totalCount');
    if (totalCountEl) totalCountEl.textContent = globalIdx;

    var resultCount = document.getElementById('resultCount');
    if (resultCount) resultCount.textContent = globalIdx + ' games';

    setUpChapters(DATA);
    setUpFilter(globalIdx);
    setUpArtViewer();
  }

  // ---------- Box-art viewer ----------

  // On data-boxart pages, clicking a card's art tile opens the art at its
  // natural size (shrunk to fit the screen) in a native <dialog>. Escape,
  // focus trapping, backdrop and close-on-focus-loss come from the dialog
  // element itself; only the tile buttons, the close button and clicks on
  // the backdrop need wiring here. The caption credits ScreenScraper and
  // links to the game's entry there, so the viewer doubles as attribution.
  function setUpArtViewer() {
    if (!BOXART) return;
    var chaptersEl = document.getElementById('chapters');
    if (!chaptersEl) return;

    var dialog = document.createElement('dialog');
    dialog.className = 'art-dialog';
    dialog.innerHTML =
      '<button class="art-close" type="button" aria-label="Close">' +
      '<svg viewBox="0 0 9 9" aria-hidden="true" focusable="false"><path fill="currentColor" d="M1 1h1v1h-1zM2 1h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1z"/></svg>' +
      '</button>' +
      '<figure class="art-figure">' +
      '<img class="art-img" alt="">' +
      '<figcaption class="art-caption"><span class="art-caption-title"></span> via ' +
      '<a href="https://www.screenscraper.fr/gameinfos.php?gameid=" target="_blank" rel="noopener">ScreenScraper.fr</a>. ' +
      'Box art belongs to its respective owner and is used for identification and commentary only.' +
      '</figcaption>' +
      '</figure>';
    document.body.appendChild(dialog);

    var img = dialog.querySelector('.art-img');
    var titleEl = dialog.querySelector('.art-caption-title');
    var link = dialog.querySelector('.art-caption a');
    var closeBtn = dialog.querySelector('.art-close');

    // One listener for every card, present and future: the buttons carry the
    // source, the game name and the ScreenScraper id in data-* attributes.
    chaptersEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.card-art-btn');
      if (!btn || !btn.querySelector('img')) return; // art failed to load
      var title = btn.getAttribute('data-art-title');
      img.src = btn.getAttribute('data-art-src');
      img.alt = title + ' box art';
      titleEl.textContent = title;
      link.href = 'https://www.screenscraper.fr/gameinfos.php?gameid=' + btn.getAttribute('data-art-id');
      dialog.setAttribute('aria-label', title + ' box art');
      // Frame the viewer in the clicked card's chapter colour, like the card.
      var hue = getComputedStyle(btn.closest('.chapter')).getPropertyValue('--hue');
      if (hue) dialog.style.setProperty('--hue', hue.trim());
      dialog.showModal();
    });

    closeBtn.addEventListener('click', function () { dialog.close(); });
    // Clicks that reach the <dialog> element itself hit the area around the
    // figure, so they count as "outside the box art" and close the viewer.
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  }

  // ---------- Chapters drop-down ----------

  // The "Chapters" button opens a panel with one link per chapter (the themed
  // .chip links), and names the chapter you're currently reading.
  var chaptersBtn = document.getElementById('chaptersToggle');
  var chaptersPanel = document.getElementById('chaptersPanel');
  var chaptersCurrent = document.getElementById('chaptersCurrent');
  var updateCurrentChapter = function () { };

  function setUpChapters(DATA) {
    if (!chaptersBtn || !chaptersPanel) return;
    var container = chaptersBtn.parentNode;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function isOpen() { return chaptersBtn.getAttribute('aria-expanded') === 'true'; }
    function setOpen(open) {
      chaptersBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      chaptersPanel.hidden = !open;
    }
    chaptersBtn.addEventListener('click', function () { setOpen(!isOpen()); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        chaptersBtn.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !container.contains(e.target)) setOpen(false);
    });
    container.addEventListener('focusout', function (e) {
      if (isOpen() && e.relatedTarget && !container.contains(e.relatedTarget)) setOpen(false);
    });

    // Jump to a chapter: close the panel, scroll, and move focus to its title.
    chaptersPanel.addEventListener('click', function (e) {
      var link = e.target.closest('a.chip');
      if (!link) return;
      e.preventDefault();
      var section = document.getElementById(link.getAttribute('href').slice(1));
      if (!section) return;
      setOpen(false);
      if (location.hash !== '#' + section.id) history.pushState(null, '', '#' + section.id);
      section.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      section.querySelector('.chapter-title').focus({ preventScroll: true });
    });

    // Which chapter are we in? The last visible one whose top has passed the
    // bottom of the sticky toolbar.
    var toolbar = document.querySelector('.toolbar');
    var sections = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
    var chips = Array.prototype.slice.call(chaptersPanel.querySelectorAll('.chip'));
    var lastIndex = null;
    updateCurrentChapter = function () {
      var line = (toolbar ? toolbar.getBoundingClientRect().bottom : 0) + 24;
      var current = -1;
      sections.forEach(function (sec, i) {
        if (!sec.classList.contains('hidden') && sec.getBoundingClientRect().top <= line) current = i;
      });
      if (current === lastIndex) return;
      lastIndex = current;
      chips.forEach(function (chip, i) {
        if (i === current) chip.setAttribute('aria-current', 'location');
        else chip.removeAttribute('aria-current');
      });
      if (chaptersCurrent) {
        chaptersCurrent.innerHTML = current === -1 ? '' :
          '<span class="chapters-current-num">' + romanNumerals[current] + '</span>' +
          '<span class="chapters-current-tag">' + DATA[current].tag + '</span>';
      }
    };
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; updateCurrentChapter(); });
    }, { passive: true });
    updateCurrentChapter();

    // A link straight to a chapter (…/nes/#ch-3) can't jump by itself, because
    // the chapters only exist once the JSON has loaded.
    var target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && target.classList.contains('chapter')) target.scrollIntoView({ block: 'start' });
  }

  // ---------- Filter ----------

  function setUpFilter(total) {
    var input = document.getElementById('searchInput');
    if (!input) return;
    var clearBtn = document.getElementById('filterClear');
    var status = document.getElementById('filterStatus');
    var resultCount = document.getElementById('resultCount');
    var emptyState = document.getElementById('emptyState');
    var toolbar = document.querySelector('.toolbar');
    var chips = chaptersPanel ? Array.prototype.slice.call(chaptersPanel.querySelectorAll('.chip')) : [];
    var announceTimer = null;

    function apply() {
      var raw = input.value.trim();
      var q = normalize(raw);
      var visible = 0;
      document.querySelectorAll('.chapter').forEach(function (sec, i) {
        var chapterVisible = 0;
        sec.querySelectorAll('.card').forEach(function (card) {
          var match = normalize(card.getAttribute('data-search')).indexOf(q) !== -1;
          card.classList.toggle('hidden', !match);
          if (match) { chapterVisible++; visible++; }
        });
        sec.classList.toggle('hidden', chapterVisible === 0);
        if (chips[i]) chips[i].hidden = chapterVisible === 0;
      });
      if (resultCount) resultCount.textContent = raw ? visible + ' of ' + total : total + ' games';
      if (emptyState) emptyState.style.display = visible === 0 ? 'block' : 'none';
      if (clearBtn) clearBtn.hidden = !raw;
      if (toolbar) toolbar.classList.toggle('is-filtering', !!raw);
      updateCurrentChapter();

      // Announce the result once typing pauses, not on every keystroke.
      if (status) {
        clearTimeout(announceTimer);
        announceTimer = setTimeout(function () {
          status.textContent = !raw ? 'Showing all ' + total + ' games.' :
            visible === 0 ? 'No games match.' :
              visible + ' of ' + total + ' games match.';
        }, 600);
      }
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        apply();
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        apply();
        input.focus();
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

  // "Hand-written" / "Draft in progress" status in the hero eyebrow, driven by
  // the platform's `handwritten` flag in data/platforms.json (see status.js).
  var eyebrowEl = document.querySelector('.hero .eyebrow');
  if (dataSrc && eyebrowEl && window.DGStatus) {
    var platformId = dataSrc.replace(/^.*\//, '').replace(/\.json$/, '');
    fetch(dataSrc.replace(/[^/]+$/, 'platforms.json'))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (platforms) {
        var platform = platforms.filter(function (p) { return p.id === platformId; })[0];
        if (!platform) return;
        // Gather the eyebrow text into one inline run so the status wraps along
        // with the words instead of becoming its own flex item.
        var run = document.createElement('span');
        Array.prototype.slice.call(eyebrowEl.childNodes).forEach(function (node) {
          if (!(node.classList && node.classList.contains('dot'))) run.appendChild(node);
        });
        run.appendChild(document.createTextNode(' '));
        run.insertAdjacentHTML('beforeend', DGStatus.html(platform.handwritten, {
          variant: 'inline',
          base: dataSrc.replace(/data\/[^/]+$/, '')
        }));
        eyebrowEl.appendChild(run);
      })
      .catch(function (err) { console.error('collection.js: failed to load platform status', err); });
  }

  // "Report a mistake" button in the footer: prefill the subject with the
  // platform's `title` from data/platforms.json, so error reports say which
  // Collection they came from. Without it the link still opens a blank email.
  var mailLinks = document.querySelectorAll('.footer-report a[href^="mailto:"]');
  if (dataSrc && mailLinks.length) {
    var mailPlatformId = dataSrc.replace(/^.*\//, '').replace(/\.json$/, '');
    fetch(dataSrc.replace(/[^/]+$/, 'platforms.json'))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (platforms) {
        var platform = platforms.filter(function (p) { return p.id === mailPlatformId; })[0];
        if (!platform) return;
        var subject = encodeURIComponent('DGC error report \u2013 ' + platform.title);
        Array.prototype.forEach.call(mailLinks, function (a) {
          a.href = 'mailto:diastrogaming@pm.me?subject=' + subject;
        });
      })
      .catch(function (err) { console.error('collection.js: failed to load email subject', err); });
  }


  // Curator's note toggle
  var noteToggle = document.getElementById('noteToggle');
  var noteCard = document.getElementById('curatorNote');
  if (noteToggle && noteCard) {
    var noteLabel = noteToggle.querySelector('.note-toggle-label');
    noteToggle.addEventListener('click', function () {
      var expanded = noteCard.classList.toggle('is-expanded');
      noteToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      if (noteLabel) noteLabel.textContent = expanded ? 'Show less' : 'Read the curator’s note';
    });
  }
})();
