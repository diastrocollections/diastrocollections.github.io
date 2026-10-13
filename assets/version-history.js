/*
 * Diastro Gaming Collections — version history page renderer.
 * Fetches data/version-history.json and builds the release timeline,
 * hero stats, and commit-line decoration.
 * To add a new release later: prepend one entry to data/version-history.json
 * and it appears here automatically — no HTML/JS changes needed.
 */
(function () {
  var listEl = document.getElementById('vhList');
  var statsEl = document.getElementById('vhStats');
  var commitLineEl = document.getElementById('commitLine');

  fetch('../data/version-history.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(render)
    .catch(function (err) {
      if (listEl) {
        listEl.innerHTML = '<p style="padding:2rem 0;color:var(--ink-faint);">Could not load the version history (data/version-history.json). ' +
          'If you’re opening this file directly (file://), the browser blocks the fetch — serve the site with ' +
          '<code>npx serve</code> or GitHub Pages instead.</p>';
      }
      console.error('version-history.js: failed to load data/version-history.json', err);
    });

  // UK date formatting 
  function formatDate(iso) {
    var d = new Date(iso.indexOf('T') === -1 ? iso + 'T00:00:00Z' : iso);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  function renderBullets(bullets) {
    return bullets.map(function (b) {
      var sub = (b.sub && b.sub.length)
        ? '<ul>' + b.sub.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>'
        : '';
      return '<li>' + b.text + sub + '</li>';
    }).join('');
  }

  function render(releases) {
    if (listEl) {
      releases.forEach(function (r) {
        var entry = document.createElement('div');
        entry.className = 'vh-entry' + (r.type === 'major' ? ' major' : r.type === 'patch' ? ' patch' : '');
        entry.innerHTML =
          '<div class="vh-meta">' +
            '<span class="vh-version">v' + r.version + '</span>' +
            (r.current ? '<span class="vh-badge">Current</span>' : '') +
            '<span class="vh-date">' + formatDate(r.date) + '</span>' +
          '</div>' +
          '<ul>' + renderBullets(r.bullets) + '</ul>';
        listEl.appendChild(entry);
      });
    }

    if (statsEl && releases.length) {
      var majors = releases.filter(function (r) { return r.type === 'major'; }).length;
      var latest = 'v' + releases[0].version;
      var first = formatDate(releases[releases.length - 1].date);
      [[String(releases.length), 'releases'], [latest, 'latest version'], [String(majors), 'major updates'], [first, 'first release']].forEach(function (s) {
        var d = document.createElement('div');
        d.className = 'stat';
        d.innerHTML = '<span class="num mono">' + s[0] + '</span><span class="label">' + s[1] + '</span>';
        statsEl.appendChild(d);
      });
    }

    if (commitLineEl && releases.length) {
      var track = document.createElement('div');
      track.className = 'commit-track';
      commitLineEl.appendChild(track);

      var chrono = releases.slice().reverse(); // oldest first, left to right
      var sizes = { patch: 8, minor: 12, major: 16 };
      chrono.forEach(function (r, i) {
        var dot = document.createElement('i');
        dot.className = 'commit-dot' + (r.current ? ' current' : '');
        var size = sizes[r.type] || sizes.minor;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = (chrono.length === 1 ? 0 : (i / (chrono.length - 1)) * 100) + '%';
        track.appendChild(dot);
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
