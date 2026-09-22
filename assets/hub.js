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
  var rulerEl = document.getElementById('eraRuler');

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
    var span = (latestEnd - earliestStart) || 1;

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

    if (rulerEl) {
      var line = document.createElement('div');
      line.className = 'er-line';
      rulerEl.appendChild(line);

      var tickStart = Math.ceil(earliestStart / 5) * 5;
      for (var y = tickStart; y <= latestEnd; y += 5) {
        var pct = ((y - earliestStart) / span) * 100;
        var tick = document.createElement('i');
        tick.className = 'er-tick';
        tick.style.left = pct + '%';
        rulerEl.appendChild(tick);
        var label = document.createElement('span');
        label.className = 'er-tick-label mono';
        label.style.left = pct + '%';
        label.textContent = y;
        rulerEl.appendChild(label);
      }

      var rulerW = rulerEl.clientWidth || 1080;
      var laneRight = [-9999, -9999, -9999, -9999];
      var laneOffset = [-13, 13, -48, 48]; // the far lanes (index 2/3) must clear .er-tick-label at +30px

      // Platforms that launched the same year land on the exact same x position; without
      // this, only the last dot in the list would be visible, hiding the others underneath it.
      var dotGroups = {};
      PLATFORMS.forEach(function (p) {
        var xpx = (((p.start - earliestStart) / span) * 100 / 100) * rulerW;
        var key = Math.round(xpx / 4);
        (dotGroups[key] = dotGroups[key] || []).push(p);
      });
      var dotShift = {};
      Object.keys(dotGroups).forEach(function (key) {
        var group = dotGroups[key];
        if (group.length < 2) return;
        group.forEach(function (p, gi) {
          dotShift[p.id] = ((gi - (group.length - 1) / 2) * 8).toFixed(1);
        });
      });

      PLATFORMS.forEach(function (p, i) {
        var pct = ((p.start - earliestStart) / span) * 100;
        var xpx = (pct / 100) * rulerW;
        var halfW = (p.name.length * 6.3) / 2 + 4;
        var lane = laneRight.length - 1;
        for (var L = 0; L < laneRight.length; L++) {
          if (xpx - halfW > laneRight[L] + 10) { lane = L; break; }
        }
        laneRight[lane] = xpx + halfW;
        var dy = laneOffset[lane];
        var m = document.createElement('a');
        m.className = 'er-marker';
        m.href = p.url;
        m.style.left = pct + '%';
        m.style.setProperty('--c', p.accent);
        m.style.animationDelay = (i * 0.04) + 's';
        m.title = p.name + ' · ' + p.years;
        m.innerHTML =
          '<span class="er-label mono" style="top:' + dy + 'px;transform:translate(-50%,' + (dy < 0 ? '-100%' : '0') + ')">' + p.name + '</span>' +
          '<span class="er-dot" style="--dot-shift:' + (dotShift[p.id] || 0) + 'px"></span>';
        rulerEl.appendChild(m);
      });
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
            '<span class="tile-watermark" aria-hidden="true">' + p.icon + '</span>' +
            '<div class="tile-kicker mono"><span>' + String(i + 1).padStart(2, '0') + '</span><span>' + p.manufacturer + '</span></div>' +
            '<div class="tile-top">' +
              '<div class="tile-icon">' + p.icon + '</div>' +
              '<div class="tile-years mono">' + p.years + '</div>' +
            '</div>' +
            '<h3>' + p.name + '</h3>' +
            '<p class="tagline">' + p.tagline + '</p>' +
            '<div class="tile-span" aria-hidden="true"><i style="left:' + (((p.start - earliestStart) / span) * 100).toFixed(1) + '%;width:' + Math.max(((p.end - p.start) / span) * 100, 5).toFixed(1) + '%"></i></div>' +
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
