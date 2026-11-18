/*
 * Diastro Gaming Collections — hub page renderer.
 * Fetches data/platforms.json and builds the tile grid + the hero's line of totals,
 * plus the shelf's "Arrange" control (timeline, or grouped by maker/type/status).
 * To add a new platform later: append one entry to data/platforms.json
 * and it appears here automatically — no HTML/JS changes needed.
 */
(function () {
  var shelfEl = document.getElementById('shelfBody');
  var arrangeEl = document.getElementById('arrange');
  var arrangeStatusEl = document.getElementById('arrangeStatus');
  var heroStatsEl = document.getElementById('heroStats');

  // Ways to arrange the shelf. Each tile list is always in launch order; a mode
  // with a `group` function splits it into headed groups, ordered by `order`
  // (or by the first group to appear on the timeline when there is none).
  var ARRANGE = {
    timeline: { label: 'Shelf in launch order' },
    maker: { label: 'Shelf grouped by maker', group: function (p) { return p.manufacturer; } },
    type: {
      label: 'Shelf grouped by type',
      group: function (p) { return p.type === 'handheld' ? 'Handhelds' : 'Home consoles'; },
      order: ['Home consoles', 'Handhelds']
    },
    status: {
      label: 'Shelf grouped by status',
      group: function (p) { return p.handwritten ? 'Hand-written' : 'In progress'; },
      order: ['Hand-written', 'In progress']
    }
  };

  fetch('data/platforms.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      if (shelfEl) {
        shelfEl.innerHTML = '<p style="padding:2rem 0;color:var(--ink-faint);">Could not load the platform list (data/platforms.json). ' +
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

    // The totals, under the tagline like the edition line on a title page.
    // Only numbers go into the markup, so innerHTML is safe here.
    if (heroStatsEl) {
      // Each total is one span, so a narrow screen breaks the line between totals.
      heroStatsEl.innerHTML = [
        '<b>' + PLATFORMS.length + '</b> platforms',
        '<b>' + totalGames.toLocaleString('en-GB') + '</b> games',
        '<b>' + totalChapters + '</b> chapters',
        '<b>' + earliestStart + '–' + latestEnd + '</b>'
      ].map(function (item) { return '<span>' + item + '</span>'; }).join(' · ');
    }

    if (shelfEl) {
      // Launch order; platforms from the same year keep their order in platforms.json.
      var tiles = PLATFORMS.slice()
        .sort(function (a, b) { return a.start - b.start; })
        .map(function (p) { return { p: p, el: buildTile(p) }; });

      var mode = readMode();
      arrange(tiles, mode);
      if (arrangeEl) {
        arrangeEl.querySelector('input[value="' + mode + '"]').checked = true;
        arrangeEl.addEventListener('change', function (e) {
          var groups = arrange(tiles, e.target.value);
          writeMode(e.target.value);
          // Focus stays on the option, so tell screen readers what changed below it.
          if (arrangeStatusEl) {
            arrangeStatusEl.textContent = ARRANGE[e.target.value].label +
              (groups > 1 ? ', ' + groups + ' groups' : '') + '.';
          }
        });
      }
    }
  }

  function buildTile(p) {
    // An icon is either an SVG file (the controller illustrations) or an emoji
    // placeholder until that Collection's illustration is ready.
    var isSvg = /\.svg$/.test(p.icon);
    var a = document.createElement('div');
    a.className = 'tile';
    a.style.setProperty('--tile-accent', p.accent);
    a.innerHTML =
      '<a class="tile-link" href="' + p.url + '" aria-label="Enter the ' + p.name + ' collection"></a>' +
      '<div class="tile-spine"></div>' +
      '<div class="tile-body">' +
        // The card's head is centred: emblem, title, then maker and years.
        '<div class="tile-head">' +
          '<span class="tile-emblem' + (isSvg ? ' tile-emblem--svg' : '') + '" aria-hidden="true">' + (isSvg ? '' : p.icon) + '</span>' +
          '<div class="tile-top">' +
            '<h3 class="tile-title">' + p.name + '</h3>' +
          '</div>' +
          '<div class="tile-kicker mono"><span>' + p.manufacturer + '</span><span>' + p.years + '</span>' +
            // EU-first is the shelf's default, so only the exceptions still get a label.
            (p.region === 'EU-first' ? '' : '<span class="tile-region">' + p.region + '</span>') +
          '</div>' +
        '</div>' +
        // No games/chapters count: every Collection has 100 games in 12 chapters,
        // and the hero already says so.
        '<p class="tagline">' + p.tagline + '</p>' +
        '<div class="tile-foot">' +
          DGStatus.html(p.handwritten, { variant: 'pill' }) +
          // Hidden from screen readers: the tile's link already says "Enter the … collection".
          '<span class="tile-enter mono" aria-hidden="true"><span class="tile-enter-label">Enter</span><span class="tile-cursor"></span></span>' +
        '</div>' +
      '</div>';
    // Inlined rather than an <img> so the drawing can take the tile's accent colour.
    if (isSvg) loadSvg(p.icon, a.querySelector('.tile-emblem'));
    return a;
  }

  // Moves the already-built tiles into one grid (timeline) or one headed grid per
  // group, so switching never re-fetches the illustrations.
  function arrange(tiles, mode) {
    var groupOf = ARRANGE[mode].group;
    var names = [];
    var byName = {};
    tiles.forEach(function (t) {
      var name = groupOf ? groupOf(t.p) : '';
      if (!byName[name]) {
        byName[name] = [];
        names.push(name);
      }
      byName[name].push(t);
    });
    var order = ARRANGE[mode].order;
    if (order) names.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });

    shelfEl.innerHTML = '';
    var i = 0;
    names.forEach(function (name) {
      var group = document.createElement('section');
      group.className = 'shelf-group';
      if (groupOf) {
        group.innerHTML = '<h3 class="shelf-group-head">' + name +
          ' <span class="shelf-group-count mono">' + byName[name].length + '</span></h3>';
      }
      var grid = document.createElement('div');
      grid.className = 'tiles';
      byName[name].forEach(function (t) {
        // Under a group heading (h3) the tile titles step down to h4.
        setTitleLevel(t.el, groupOf ? 'H4' : 'H3');
        // Re-inserting a tile restarts its rise animation, so stagger by new position.
        t.el.style.animationDelay = (i++ * 0.04) + 's';
        grid.appendChild(t.el);
      });
      group.appendChild(grid);
      shelfEl.appendChild(group);
    });
    return names.length;
  }

  function setTitleLevel(tile, tag) {
    var title = tile.querySelector('.tile-title');
    if (title.tagName === tag) return;
    var next = document.createElement(tag);
    next.className = title.className;
    next.innerHTML = title.innerHTML;
    title.replaceWith(next);
  }

  // The chosen arrangement lives in the URL (?arrange=maker), so it can be shared
  // and survives the back button. Timeline is the default and keeps the URL clean.
  function readMode() {
    var m = new URLSearchParams(location.search).get('arrange');
    return ARRANGE.hasOwnProperty(m) ? m : 'timeline';
  }

  function writeMode(mode) {
    var url = new URL(location.href);
    if (mode === 'timeline') url.searchParams.delete('arrange');
    else url.searchParams.set('arrange', mode);
    history.replaceState(null, '', url);
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
