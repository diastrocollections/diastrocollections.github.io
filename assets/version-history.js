/*
 * Diastro Gaming Collections — version history page renderer.
 * Fetches data/version-history.json and builds the release list, the hero
 * stats, and the horizontal release timeline (dots placed by release date,
 * each one a link that scrolls to its release).
 * To add a new release later: prepend one entry to data/version-history.json
 * and it appears here automatically — no HTML/JS changes needed.
 */
(function () {
  var listEl = document.getElementById('vhList');
  var statsEl = document.getElementById('vhStats');
  var timelineEl = document.getElementById('vhTimeline');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  // "2.1.0" -> "v2-1-0": the id of a release's entry, and the timeline's link target.
  function releaseId(version) {
    return 'v' + String(version).replace(/[^0-9A-Za-z]+/g, '-');
  }

  function toTime(iso) {
    return Date.parse(iso.indexOf('T') === -1 ? iso + 'T00:00:00Z' : iso);
  }

  // Scroll to a release and move keyboard/screen reader focus to its heading.
  function goToRelease(id, smooth) {
    var entry = document.getElementById(id);
    if (!entry) return;
    entry.scrollIntoView({ behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto', block: 'start' });
    var heading = entry.querySelector('.vh-version');
    if (heading) heading.focus({ preventScroll: true });
  }

  // UK date formatting 
  function formatDate(iso) {
    var d = new Date(iso.indexOf('T') === -1 ? iso + 'T00:00:00Z' : iso);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  // Release notes are inline HTML, plus `backticks` for inline code. What's
  // between the backticks is shown as typed, so `<em>` appears literally.
  function inline(str) {
    return String(str == null ? '' : str).replace(/`([^`]+)`/g, function (m, code) {
      return '<code>' + code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>';
    });
  }

  function renderBullets(bullets) {
    return '<ul>' + bullets.map(function (b) {
      var sub = (b.sub && b.sub.length)
        ? '<ul>' + b.sub.map(function (s) { return '<li>' + inline(s) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<li>' + inline(b.text) + sub + '</li>';
    }).join('') + '</ul>';
  }

  // Each section is an optional heading (a real <h3>, under the release's
  // level-2 version heading), an optional paragraph, then optional bullets.
  // Entries written before sections existed have only "bullets".
  function renderSections(r) {
    var sections = r.sections || (r.bullets ? [{ bullets: r.bullets }] : []);
    return sections.map(function (s) {
      return '<div class="vh-section">' +
        (s.heading ? '<h3 class="vh-heading">' + inline(s.heading) + '</h3>' : '') +
        (s.text ? '<p class="vh-text">' + inline(s.text) + '</p>' : '') +
        (s.bullets && s.bullets.length ? renderBullets(s.bullets) : '') +
        '</div>';
    }).join('');
  }

  function render(releases) {
    if (listEl) {
      releases.forEach(function (r) {
        var entry = document.createElement('div');
        entry.className = 'vh-entry' + (r.type === 'major' ? ' major' : r.type === 'patch' ? ' patch' : '');
        entry.id = releaseId(r.version);
        entry.innerHTML =
          '<div class="vh-meta">' +
            '<span class="vh-version" role="heading" aria-level="2" tabindex="-1">v' + r.version + '</span>' +
            (r.current ? '<span class="vh-badge">Current</span>' : '') +
            '<span class="vh-date">' + formatDate(r.date) + '</span>' +
          '</div>' +
          '<div class="vh-body">' + renderSections(r) + '</div>';
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

    if (timelineEl && releases.length) renderTimeline(releases);

    // A link straight to a release (e.g. .../version-history/#v2-1-0) can't jump
    // on its own, because the entries only exist once the JSON has loaded.
    if (location.hash) goToRelease(decodeURIComponent(location.hash.slice(1)), false);
  }

  // The release timeline, laid out like the era ruler on the hub: a dotted line
  // inside the page's content width, a few month ticks below it, and one dot per
  // release placed by its date. Dot size follows the release type.
  function renderTimeline(releases) {
    var chrono = releases.slice().reverse(); // oldest first, left to right
    var times = chrono.map(function (r) { return toTime(r.date); });
    var firstDay = new Date(times[0]);
    // Start at the 1st of the first release's month, so that month gets a tick.
    var domainStart = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), 1);
    var domainEnd = Math.max(times[times.length - 1], domainStart + 864e5);

    // Month ticks: at most 4 labels, however long the history gets.
    var months = [];
    for (var m = new Date(domainStart); m.getTime() <= domainEnd; m.setUTCMonth(m.getUTCMonth() + 1)) {
      months.push(new Date(m.getTime()));
    }
    var step = Math.ceil(months.length / 4);
    months = months.filter(function (d, i) { return i % step === 0; });

    var sizes = { patch: 8, minor: 12, major: 16 };
    var typeNames = { patch: 'patch release', minor: 'minor release', major: 'major release' };

    var line = document.createElement('div');
    line.className = 'vh-tl-line';
    line.setAttribute('aria-hidden', 'true');
    timelineEl.appendChild(line);

    var ticks = months.map(function (d, i) {
      var showYear = i === 0 || d.getUTCMonth() === 0 || d.getUTCFullYear() !== months[i - 1].getUTCFullYear();
      var tick = document.createElement('span');
      tick.className = 'vh-tl-tick';
      tick.setAttribute('aria-hidden', 'true');
      tick.innerHTML = '<span class="vh-tl-month mono">' + MONTHS[d.getUTCMonth()] + (showYear ? ' ' + d.getUTCFullYear() : '') + '</span>';
      timelineEl.appendChild(tick);
      return { el: tick, time: d.getTime() };
    });

    var list = document.createElement('ol');
    list.className = 'vh-tl-list';
    var markers = chrono.map(function (r, i) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      var id = releaseId(r.version);
      var size = sizes[r.type] || sizes.minor;
      a.className = 'vh-tl-marker' + (r.current ? ' current' : '');
      a.href = '#' + id;
      a.setAttribute('aria-label', 'v' + r.version + ', ' + formatDate(r.date) + ', ' +
        (typeNames[r.type] || typeNames.minor) + (r.current ? ', current version' : ''));
      a.style.animationDelay = (i * 0.04) + 's';
      a.innerHTML =
        '<span class="vh-tl-label mono" aria-hidden="true">v' + r.version + '</span>' +
        '<span class="vh-tl-dot" style="width:' + size + 'px;height:' + size + 'px"></span>';
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
        goToRelease(id, true);
      });
      li.appendChild(a);
      list.appendChild(li);
      return { el: a, time: times[i] };
    });
    timelineEl.appendChild(list);

    // Positions are worked out in pixels, because releases on the same day (or a
    // few days apart) would otherwise sit on top of each other. Those get pushed
    // apart, in order, just far enough for each dot to stay its own tap target.
    function layout() {
      var width = timelineEl.clientWidth;
      if (!width) return;
      var pad = 10;
      var usable = Math.max(width - pad * 2, 1);
      var x = function (t) { return pad + ((t - domainStart) / (domainEnd - domainStart)) * usable; };
      var gap = Math.min(window.matchMedia('(max-width: 640px)').matches ? 24 : 20, usable / Math.max(markers.length - 1, 1));

      var xs = markers.map(function (mk) { return x(mk.time); });
      for (var i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + gap);
      xs[xs.length - 1] = Math.min(xs[xs.length - 1], width - pad);
      for (var j = xs.length - 2; j >= 0; j--) xs[j] = Math.min(xs[j], xs[j + 1] - gap);

      markers.forEach(function (mk, k) { mk.el.style.left = xs[k] + 'px'; });
      ticks.forEach(function (tk) { tk.el.style.left = x(tk.time) + 'px'; });
    }

    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(timelineEl);
    else window.addEventListener('resize', layout);
  }

})();
