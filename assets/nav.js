/*
 * Diastro Gaming Collections — site navigation, shared by every page.
 *
 * - Menu: at 760px and narrower (see nav.css) the top bar collapses into a
 *   "Menu" button that opens #siteNav as a drop-down panel.
 * - Collections switcher: the "Collections" button opens a panel listing every
 *   Collection, built from data/platforms.json, so a new platform shows up
 *   here without touching any page.
 * - Back to top: the arrow at the right end of the bar appears once the hero
 *   has scrolled out of view (hidden on phones by CSS).
 * - Theme toggle: dark / light.
 * - Collection pages only: the "previous / next on the shelf" links in
 *   #collectionPager, in the same order as the shelf, and the footer's AI
 *   line (#footerAiLine), which states this Collection's writing status.
 *
 * Both panels follow the disclosure pattern: Escape, a click outside, or
 * tabbing out of them closes them.
 */
(function () {
  var root = document.documentElement;
  var bar = document.querySelector('.topbar');
  var menuBtn = document.getElementById('menuToggle');
  var siteNav = document.getElementById('siteNav');
  var collectionsBtn = document.getElementById('collectionsToggle');
  var collectionsPanel = document.getElementById('collectionsPanel');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 760px)');

  // Paths are resolved against this script (assets/nav.js), so the same code
  // works on the hub and on pages one folder down.
  var scriptUrl = document.currentScript && document.currentScript.src;
  function siteUrl(path) { return new URL('../' + path, scriptUrl || location.href).href; }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }

  function onMediaChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else mq.addListener(fn);
  }

  // ---------- Disclosure helper (Menu and Collections) ----------

  function disclosure(btn, panel, container, onToggle) {
    function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
    function setOpen(open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (panel) panel.hidden = !open;
      if (onToggle) onToggle(open);
    }
    btn.addEventListener('click', function () { setOpen(!isOpen()); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        btn.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !container.contains(e.target)) setOpen(false);
    });
    container.addEventListener('focusout', function (e) {
      if (isOpen() && e.relatedTarget && !container.contains(e.relatedTarget)) setOpen(false);
    });
    return { setOpen: setOpen, isOpen: isOpen };
  }

  // ---------- Menu (narrow screens) ----------

  if (menuBtn && siteNav && bar) {
    var menu = disclosure(menuBtn, null, bar, function (open) {
      bar.classList.toggle('is-menu-open', open);
    });
    onMediaChange(narrow, function () { if (!narrow.matches) menu.setOpen(false); });
  }

  // ---------- Collections switcher ----------

  var collections = null;
  if (collectionsBtn && collectionsPanel) {
    collections = disclosure(collectionsBtn, collectionsPanel, collectionsBtn.parentNode);
    // The Escape handler of the menu also runs; on narrow screens that closes
    // both, which is what you'd expect from one menu.
  }

  // ---------- Theme toggle ----------

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

  // ---------- Back to top ----------

  var topBtn = document.getElementById('topbarTopBtn');
  var hero = document.querySelector('.hero');
  if (topBtn) {
    var setTopVisible = function (visible) {
      topBtn.classList.toggle('is-visible', visible);
      if (bar) {
        bar.classList.toggle('has-top', visible);
        // Animate only changes after the first state is in place (see nav.css).
        if (!bar.classList.contains('is-ready')) {
          requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.add('is-ready'); }); });
        }
      }
    };
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        setTopVisible(!entries[0].isIntersecting);
      }, { rootMargin: '-60px 0px 0px 0px' }).observe(hero);
    } else {
      var onScroll = function () { setTopVisible(window.scrollY > window.innerHeight * 0.75); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      // Move keyboard / screen reader focus back to the start of the page too.
      var h1 = document.querySelector('h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    });
  }

  // ---------- Collections list + previous / next ----------

  var pager = document.getElementById('collectionPager');
  if (!collectionsPanel && !pager) return;

  fetch(siteUrl('data/platforms.json'))
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (platforms) {
      var path = location.pathname.replace(/index\.html$/, '');
      var currentIndex = -1;
      platforms.forEach(function (p, i) {
        if (path.slice(-('/' + p.url).length) === '/' + p.url) currentIndex = i;
      });
      if (currentIndex !== -1 && collectionsBtn) collectionsBtn.classList.add('is-current');
      if (collectionsPanel) renderCollections(platforms, currentIndex);
      if (pager && currentIndex !== -1) renderPager(platforms, currentIndex);
      if (currentIndex !== -1) renderAiLine(platforms[currentIndex]);
    })
    .catch(function (err) { console.error('nav.js: failed to load data/platforms.json', err); });

  function renderCollections(platforms, currentIndex) {
    // Group by manufacturer, in the order they first appear on the shelf.
    var groups = [];
    var byMaker = {};
    platforms.forEach(function (p, i) {
      if (!byMaker[p.manufacturer]) {
        byMaker[p.manufacturer] = [];
        groups.push(p.manufacturer);
      }
      byMaker[p.manufacturer].push({ p: p, i: i });
    });
    // The largest group gets two columns on wide screens.
    var largest = groups.reduce(function (a, b) { return byMaker[b].length > byMaker[a].length ? b : a; }, groups[0]);

    var html = groups.map(function (maker) {
      return '<div class="collections-group' + (maker === largest && byMaker[maker].length > 4 ? ' is-wide' : '') + '">' +
        '<h3 class="collections-group-title">' + esc(maker) + '</h3>' +
        '<ul class="collections-list">' +
        byMaker[maker].map(function (item) {
          var p = item.p;
          var here = item.i === currentIndex;
          return '<li><a class="collection-link" href="' + siteUrl(p.url) + '" style="--c:' + esc(p.accent) + '"' +
            (here ? ' aria-current="page"' : '') + '>' +
            '<span class="collection-name">' + esc(p.name) +
            (here ? '<span class="collection-here">You are here</span>' : '') + '</span>' +
            '<span class="collection-years">' + esc(p.years) + '</span></a></li>';
        }).join('') +
        '</ul></div>';
    }).join('');

    collectionsPanel.innerHTML = '<div class="wrap collections-inner">' + html +
      '<a class="collections-all" href="' + siteUrl('') + '">See all Collections on the shelf</a></div>';
  }

  // The footer's general line ("AI-assisted drafts, rewritten by hand") becomes
  // specific on a Collection page, from the same fields as the status badge.
  function renderAiLine(p) {
    var el = document.getElementById('footerAiLine');
    if (!el) return;
    var progress = Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
    el.textContent = p.handwritten ? 'Every word on this page is hand-written' :
      progress > 0 ? 'AI-assisted draft, ' + progress + '% rewritten by hand' :
      'AI-assisted draft, to be rewritten by hand';
  }

  function renderPager(platforms, i) {
    var prev = platforms[i - 1];
    var next = platforms[i + 1];
    function link(p, dir) {
      return '<a class="pager-link pager-' + dir + '" href="' + siteUrl(p.url) + '" style="--c:' + esc(p.accent) + '">' +
        '<span class="pager-dir">' + (dir === 'prev' ? '&larr; Previous' : 'Next') +
        '<span class="pager-dir-long"> on the shelf</span>' + (dir === 'next' ? ' &rarr;' : '') + '</span>' +
        '<span class="pager-title"><span class="pager-name">' + esc(p.name) + '</span>' +
        '<span class="pager-years">' + esc(p.years) + '</span></span></a>';
    }
    pager.innerHTML = (prev ? link(prev, 'prev') : '<span></span>') + (next ? link(next, 'next') : '<span></span>');
  }
})();
