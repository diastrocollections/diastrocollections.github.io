/*
 * Diastro Gaming Collections — "How it's made" page behaviour.
 * This code is 100% generated with Claude Code.
 * 
 * The page copy is plain HTML in how-its-made/index.html. This script only
 * draws the shelf progress chart from data/platforms.json (each platform's
 * "handwritten" field and "accent" color), plus the theme toggle and the
 * "On this page" scroll-spy.
 */

(function () {
  var root = document.documentElement;

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function renderShelf(platforms) {
    var spinesEl = document.getElementById('aimSpines');
    var countEl = document.getElementById('aimShelfCount');
    if (!spinesEl || !platforms) return;

    var writtenCount = platforms.filter(function (p) { return p.handwritten; }).length;
    if (countEl) countEl.textContent = writtenCount + ' of ' + platforms.length + ' hand-written';

    // A draft spine fills up to its "progress" percentage; a hand-written one is full.
    function progressOf(p) {
      return p.handwritten ? 100 : Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
    }

    var underway = platforms.filter(function (p) { return !p.handwritten && progressOf(p) > 0; });
    spinesEl.setAttribute('aria-label', 'Progress: ' + writtenCount + ' of ' + platforms.length + ' collections hand-written' +
      (underway.length ? '. Underway: ' + underway.map(function (p) { return p.name + ' ' + progressOf(p) + '%'; }).join(', ') : '') + '.');
    spinesEl.style.setProperty('--spines', platforms.length);
    spinesEl.innerHTML = platforms.map(function (p, i) {
      var height = 150 + ((i * 37) % 45);
      var draft = !p.handwritten;
      var pct = progressOf(p);
      return '<div class="aim-spine' + (draft ? ' is-draft' : '') + '" style="--spine-h:' + height + 'px;--spine-c:' + p.accent + ';--fill:' + pct + '%" ' +
        'title="' + esc(p.name) + ': ' + pct + '% hand-written">' + esc(p.name) + '</div>';
    }).join('');
  }

  fetch('../data/platforms.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(renderShelf)
    .catch(function (err) {
      var countEl = document.getElementById('aimShelfCount');
      if (countEl) countEl.textContent = 'Progress unavailable';
      console.error('how-its-made.js: failed to load data/platforms.json', err);
    });

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
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

  // Scroll-spy: highlight the "On this page" link for whichever section
  // currently sits in the upper part of the viewport.
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.aim-toc a'));
  var tocSections = tocLinks.map(function (a) {
    return document.getElementById(a.getAttribute('href').slice(1));
  }).filter(Boolean);

  function setActiveTocLink(id) {
    tocLinks.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window && tocSections.length) {
    // The last section can never cross the detection band below if the page
    // can't scroll any further past it, so this always gets the final say —
    // called both as its own scroll listener and at the end of every
    // IntersectionObserver callback, since those two can otherwise race.
    function activateLastIfAtBottom() {
      var atBottom = window.innerHeight + Math.ceil(window.scrollY) >= document.documentElement.scrollHeight - 4;
      if (atBottom) setActiveTocLink(tocSections[tocSections.length - 1].id);
      return atBottom;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActiveTocLink(entry.target.id);
      });
      activateLastIfAtBottom();
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });
    tocSections.forEach(function (s) { observer.observe(s); });

    window.addEventListener('scroll', activateLastIfAtBottom, { passive: true });
  }
})();
