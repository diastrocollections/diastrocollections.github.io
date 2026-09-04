/*
 * Diastro Gaming Collections — hub page renderer.
 * Fetches data/platforms.json and builds the tile grid + hero stats.
 * To add a new platform later: append one entry to data/platforms.json
 * and it appears here automatically — no HTML/JS changes needed.
 */
(function () {
  var tilesEl = document.getElementById('tiles');
  var heroStatsEl = document.getElementById('heroStats');
  var shelfCountEl = document.getElementById('shelfCount');

  fetch('data/platforms.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      if (tilesEl) {
        tilesEl.innerHTML = '<p style="padding:2rem 0;color:var(--ink-faint);">Could not load the platform list (data/platforms.json). ' +
          'If you’re opening this file directly (file://), the browser blocks the fetch — serve the site with ' +
          '<code>npx serve</code> or GitHub Pages instead.</p>';
      }
      console.error('hub.js: failed to load data/platforms.json', err);
    });

  function render(PLATFORMS) {
    var totalGames = PLATFORMS.reduce(function (sum, p) { return sum + p.games; }, 0);
    var totalChapters = PLATFORMS.reduce(function (sum, p) { return sum + p.chapters; }, 0);
    var earliestStart = Math.min.apply(null, PLATFORMS.map(function (p) { return p.start; }));
    var latestEnd = Math.max.apply(null, PLATFORMS.map(function (p) { return p.end; }));

    var stats = [
      { num: String(PLATFORMS.length), label: "platforms catalogued" },
      { num: String(totalGames), label: "games across the shelf" },
      { num: String(totalChapters), label: "genre chapters" },
      { num: earliestStart + "–" + latestEnd, label: "hardware span" }
    ];

    if (heroStatsEl) {
      stats.forEach(function (s) {
        var el = document.createElement('div');
        el.className = 'stat';
        el.innerHTML = '<span class="num mono">' + s.num + '</span><span class="label">' + s.label + '</span>';
        heroStatsEl.appendChild(el);
      });
    }

    if (shelfCountEl) {
      shelfCountEl.textContent = PLATFORMS.length + ' collections · ' + totalGames + ' games';
    }

    if (tilesEl) {
      PLATFORMS.forEach(function (p, i) {
        var a = document.createElement('a');
        a.className = 'tile';
        a.href = p.url;
        a.style.setProperty('--tile-accent', p.accent);
        a.style.animationDelay = (i * 0.06) + 's';
        a.innerHTML =
          '<div class="tile-spine"></div>' +
          '<div class="tile-body">' +
            '<div class="tile-top">' +
              '<div class="tile-icon">' + p.icon + '</div>' +
              '<div class="tile-years mono">' + p.years + '</div>' +
            '</div>' +
            '<h3>' + p.name + '</h3>' +
            '<p class="tagline">' + p.tagline + '</p>' +
            '<div class="tile-meta">' +
              '<span><strong>' + p.games + '</strong> games</span>' +
              '<span><strong>' + p.chapters + '</strong> chapters</span>' +
              '<span class="tile-region mono">' + p.region + '</span>' +
            '</div>' +
            '<span class="tile-cta">Enter the collection' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
            '</span>' +
          '</div>';
        tilesEl.appendChild(a);
      });
    }
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
