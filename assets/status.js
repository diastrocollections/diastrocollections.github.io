/*
 * Diastro Gaming Collections — "Hand-written" / "Draft in progress" status.
 *
 * Shared by the hub (tile pills) and every collection page (eyebrow).
 * Load before hub.js / collection.js, together with assets/css/status.css.
 *
 *   DGStatus.html(handwritten, { variant: 'pill' | 'inline', base: '../' })
 *
 * returns the markup for a status button plus its explainer popover. The
 * popover opens on mouse hover, and toggles on click/tap or Enter/Space, so it
 * works on touch screens and from the keyboard. It uses the Popover API (top
 * layer) so it isn't clipped by the hub tiles' overflow: hidden.
 */
(function () {
  var uid = 0;
  var open = null;       // { wrap, btn, pop, pinned }
  var closeTimer = null;
  var supportsPopover = typeof HTMLElement !== 'undefined' &&
    HTMLElement.prototype.hasOwnProperty('popover');

  var ICONS = {
    handwritten: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    draft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>'
  };

  function html(handwritten, opts) {
    opts = opts || {};
    var variant = opts.variant || 'pill';
    var base = opts.base || '';
    var key = handwritten ? 'handwritten' : 'draft';
    var label = handwritten ? 'Hand-written' : 'Draft in progress';
    var id = 'status-pop-' + (++uid);

    return '<div class="status status--' + variant + '">' +
      '<button type="button" class="status-btn is-' + key + '" aria-expanded="false" aria-controls="' + id + '">' +
        ICONS[key] + label +
      '</button>' +
      '<div class="status-pop" id="' + id + '" popover="manual">' +
        '<p class="status-def' + (handwritten ? '' : ' is-current') + '">' +
          '<strong>Draft in progress:</strong> This Collection is written completely by Claude and the ' +
          'hand-written revision is currently in progress.</p>' +
        '<p class="status-def' + (handwritten ? ' is-current' : '') + '">' +
          '<strong>Hand-written:</strong> This Collection is hand-written by Jesper and does not contain any ' +
          'AI-generated text.</p>' +
        '<p class="status-more">You can learn more about the use of AI in this project on the ' +
          '<a href="' + base + 'how-its-made/#ai">How it\'s made</a> page.</p>' +
      '</div>' +
    '</div>';
  }

  function position() {
    if (!open) return;
    var gap = 8, margin = 12;
    var r = open.btn.getBoundingClientRect();
    var pop = open.pop;
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(margin, r.left), vw - w - margin);
    var top = r.bottom + gap;
    if (top + h > vh - margin && r.top - gap - h > margin) top = r.top - gap - h;
    pop.style.left = Math.max(margin, left) + 'px';
    pop.style.top = top + 'px';
  }

  function show(wrap, pinned) {
    clearTimeout(closeTimer);
    if (open && open.wrap === wrap) {
      if (pinned) open.pinned = true;
      return;
    }
    hide();
    var btn = wrap.querySelector('.status-btn');
    var pop = wrap.querySelector('.status-pop');
    if (supportsPopover) pop.showPopover();
    pop.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    open = { wrap: wrap, btn: btn, pop: pop, pinned: !!pinned };
    position();
  }

  function hide() {
    clearTimeout(closeTimer);
    if (!open) return;
    if (supportsPopover && open.pop.matches(':popover-open')) open.pop.hidePopover();
    open.pop.classList.remove('is-open');
    open.btn.setAttribute('aria-expanded', 'false');
    open = null;
  }

  function isMouse(e) { return e.pointerType === 'mouse'; }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.status-btn');
    if (btn) {
      var wrap = btn.closest('.status');
      if (open && open.wrap === wrap && open.pinned) hide();
      else show(wrap, true);
      return;
    }
    if (open && !open.wrap.contains(e.target)) hide();
  });

  document.addEventListener('pointerover', function (e) {
    if (!isMouse(e)) return;
    var wrap = e.target.closest('.status');
    if (wrap) show(wrap, false);
  });

  document.addEventListener('pointerout', function (e) {
    if (!isMouse(e) || !open || open.pinned) return;
    var wrap = e.target.closest('.status');
    if (wrap !== open.wrap || wrap.contains(e.relatedTarget)) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, 180);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) {
      var btn = open.btn;
      hide();
      btn.focus();
    }
  });

  document.addEventListener('focusout', function (e) {
    if (open && e.relatedTarget && !open.wrap.contains(e.relatedTarget)) hide();
  });

  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });

  window.DGStatus = { html: html };
})();
