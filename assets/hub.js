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
      // For screen readers the ruler is a named group of links, one per platform;
      // the line, ticks and year labels are drawing only.
      rulerEl.setAttribute('role', 'group');
      rulerEl.setAttribute('aria-label', 'Platform timeline, ' + earliestStart + ' to ' + latestEnd);

      var line = document.createElement('div');
      line.className = 'er-line';
      line.setAttribute('aria-hidden', 'true');
      rulerEl.appendChild(line);

      var tickStart = Math.ceil(earliestStart / 5) * 5;
      for (var y = tickStart; y <= latestEnd; y += 5) {
        var pct = ((y - earliestStart) / span) * 100;
        var tick = document.createElement('i');
        tick.className = 'er-tick';
        tick.setAttribute('aria-hidden', 'true');
        tick.style.left = pct + '%';
        rulerEl.appendChild(tick);
        var label = document.createElement('span');
        label.className = 'er-tick-label mono';
        label.setAttribute('aria-hidden', 'true');
        label.style.left = pct + '%';
        label.textContent = y;
        rulerEl.appendChild(label);
      }

      var rulerW = rulerEl.clientWidth || 1080;

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
          dotShift[p.id] = ((gi - (group.length - 1) / 2) * 18).toFixed(1);
        });
      });

      PLATFORMS.forEach(function (p, i) {
        var pct = ((p.start - earliestStart) / span) * 100;
        var m = document.createElement('a');
        m.className = 'er-marker';
        m.href = p.url;
        m.style.left = pct + '%';
        m.style.setProperty('--c', p.accent);
        m.style.animationDelay = (i * 0.04) + 's';
        m.title = p.name + ' · ' + p.years;
        m.setAttribute('aria-label', p.name + ', ' + p.years);
        m.innerHTML =
          '<span class="er-label mono" aria-hidden="true">' + p.name + '</span>' +
          '<span class="er-dot" style="--dot-shift:' + (dotShift[p.id] || 0) + 'px"></span>';
        rulerEl.appendChild(m);
      });
    }

    if (tilesEl) {
      PLATFORMS.forEach(function (p, i) {
        // An icon is either an SVG file (the controller illustrations) or an emoji
        // placeholder until that Collection's illustration is ready.
        var isSvg = /\.svg$/.test(p.icon);
        var a = document.createElement('div');
        a.className = 'tile';
        a.style.setProperty('--tile-accent', p.accent);
        a.style.animationDelay = (i * 0.06) + 's';
        a.innerHTML =
          '<a class="tile-link" href="' + p.url + '" aria-label="Enter the ' + p.name + ' collection"></a>' +
          '<div class="tile-spine"></div>' +
          '<div class="tile-body">' +
            '<span class="tile-watermark' + (isSvg ? ' tile-watermark--svg' : '') + '" aria-hidden="true">' + (isSvg ? '' : p.icon) + '</span>' +
            '<div class="tile-kicker mono"><span>' + String(i + 1).padStart(2, '0') + '</span><span>' + p.manufacturer + '</span><span>' + p.years + '</span></div>' +
            '<div class="tile-top">' +
              '<h3>' + p.name + '</h3>' +
            '</div>' +
            '<p class="tagline">' + p.tagline + '</p>' +
            '<div class="tile-meta">' +
              '<span><strong>' + p.games + '</strong> games</span>' +
              '<span><strong>' + p.chapters + '</strong> chapters</span>' +
              '<span class="tile-region mono">' + p.region + '</span>' +
            '</div>' +
            '<div class="tile-foot">' +
              // Hidden from screen readers: the tile's link already says "Enter the … collection".
              '<span class="tile-cta" aria-hidden="true">Enter the collection' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
              '</span>' +
              DGStatus.html(p.handwritten, { variant: 'pill' }) +
            '</div>' +
          '</div>';
        tilesEl.appendChild(a);
        // Inlined rather than an <img> so the drawing can take the tile's accent colour.
        if (isSvg) loadSvg(p.icon, a.querySelector('.tile-watermark'));
      });
    }
  }

  function loadSvg(src, el) {
    fetch(src)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (svg) { el.innerHTML = svg; })
      .catch(function (err) { console.error('hub.js: failed to load ' + src, err); });
  }

})();
