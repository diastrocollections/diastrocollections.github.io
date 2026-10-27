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

  var romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // Strip accents and fold curly quotes to straight ones, so typing "kirby's"
  // or "pokemon" still matches "Kirby’s" and "Pokémon".
  function normalize(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
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
        card.innerHTML =
          idx +
          '<h3 class="card-title">' + title + '</h3>' +
          '<span class="card-meta">' + year + ' · ' + dev + '</span>' +
          '<p class="card-blurb">' + gblurb + '</p>';
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
  }

  // ---------- Chapters drop-down ----------

  // The "Chapters" button opens a panel with one link per chapter (the themed
  // .chip links), and names the chapter you're currently reading.
  var chaptersBtn = document.getElementById('chaptersToggle');
  var chaptersPanel = document.getElementById('chaptersPanel');
  var chaptersCurrent = document.getElementById('chaptersCurrent');
  var updateCurrentChapter = function () {};

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
