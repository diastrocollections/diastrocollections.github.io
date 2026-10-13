/*
 * Diastro Gaming Collections — top bar menu (hub, How it's made, Version history).
 *
 * On narrow screens (see the max-width: 640px block in hub.css) the top bar
 * collapses into a "Menu" button that opens #siteNav as a drop-down panel.
 * Escape, a click outside the bar, or tabbing out of it closes the panel.
 */
(function () {
  var btn = document.getElementById('menuToggle');
  var nav = document.getElementById('siteNav');
  if (!btn || !nav) return;
  var bar = btn.closest('.topbar');

  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }

  function setOpen(open) {
    bar.classList.toggle('is-menu-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', function () { setOpen(!isOpen()); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      btn.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (isOpen() && !bar.contains(e.target)) setOpen(false);
  });

  bar.addEventListener('focusout', function (e) {
    if (isOpen() && e.relatedTarget && !bar.contains(e.relatedTarget)) setOpen(false);
  });

  var desktop = window.matchMedia('(min-width: 641px)');
  var onChange = function () { if (desktop.matches) setOpen(false); };
  if (desktop.addEventListener) desktop.addEventListener('change', onChange);
  else desktop.addListener(onChange);
})();
