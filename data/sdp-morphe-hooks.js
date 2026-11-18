/* Smart Dictation Player — v0.0.5.b Morphe transition hooks (strict ES5).
 * Loaded with defer AFTER the app modules so it decorates the finished DOM.
 * Zero new CSS is injected at runtime (W3/G1: no insertRule, no
 * adoptedStyleSheets) — every effect below only toggles classes and sets
 * custom properties that the v0.0.5.b section of sdp-ui.css consumes.
 *
 * Source techniques (verbatim behaviour, retargeted to SDP's DOM):
 *   kit.js setupLit()        — pointer-tracked lit card border glow
 *   kit.js applyTheme()      — smooth dark<->light switch without a flash
 *   faq.js measureAnswer()   — measured max-height accordion animation
 *   main.js IntersectionObserver — staggered scroll reveals (80ms)
 */
(function () {
  'use strict';
  if (window.__SDP_MORPHE_HOOKS__) return;
  window.__SDP_MORPHE_HOOKS__ = true;

  var doc = document;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var REDUCED = reduce ? reduce.matches : false;

  /* ── 1. Lit cards: the glow follows the pointer (kit.js setupLit) ─────── */
  function setupLit() {
    if (REDUCED) return;
    var handler = function (ev) {
      var card = ev.target && ev.target.closest ? ev.target.closest('.lit') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    };
    doc.addEventListener('pointermove', handler, { passive: true });
  }

  /* ── 2. Theme switch cross-fade (no flash, Morphe body transition) ──────
     applyTheme() in sdp-ui-views.js writes data-theme on <html>/<body>; we
     listen for the attribute change, flash the .sd-theme-anim class that the
     CSS layer uses to colour-transition every surface, then drop it. */
  function setupThemeFade() {
    var root = doc.documentElement;
    var timer = null;
    var animate = function () {
      if (REDUCED) return;
      root.classList.add('sd-theme-anim');
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { root.classList.remove('sd-theme-anim'); }, 450);
    };
    var obs = null;
    if (window.MutationObserver) {
      obs = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          if (records[i].attributeName === 'data-theme') { animate(); return; }
        }
      });
      obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    /* btnTheme also drives applyTheme; the observer covers settings select. */
  }

  /* ── 3. Accordion: measured max-height (faq.js measureAnswer) ───────────
     .studio-card uses <details>; we measure the body once it opens so the
     CSS max-height transition runs over the real content height. */
  function measureStudioBody(details) {
    var body = details.querySelector('.studio-body');
    if (!body) return;
    var open = details.hasAttribute('open');
    if (open) {
      var prev = body.style.maxHeight;
      body.style.maxHeight = 'none';
      var h = body.scrollHeight;
      body.style.maxHeight = prev || '';
      details.style.setProperty('--studio-body-h', Math.max(h, 40) + 'px');
    }
  }
  function setupAccordions() {
    var cards = doc.querySelectorAll('details.studio-card, details.studio-setup');
    for (var i = 0; i < cards.length; i++) {
      (function (node) {
        node.addEventListener('toggle', function () { measureStudioBody(node); });
      })(cards[i]);
    }
    /* remeasure on resize so long content never clips (faq.js pattern) */
    var frame = null;
    window.addEventListener('resize', function () {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var openCards = doc.querySelectorAll('details.studio-card[open], details.studio-setup[open]');
        for (var k = 0; k < openCards.length; k++) measureStudioBody(openCards[k]);
      });
    });
  }

  /* ── 4. Scroll reveals: IntersectionObserver stagger (main.js) ──────────
     Cards rise 20px and fade in as they enter the viewport, 80ms apart. */
  function setupReveals() {
    if (REDUCED) return;
    if (!window.IntersectionObserver) return;
    var targets = doc.querySelectorAll('#screen-home .card, #screen-settings .set-card');
    for (var i = 0; i < targets.length; i++) {
      targets[i].classList.add('sd-reveal');
      targets[i].style.setProperty('--reveal-delay', (i % 6) * 80 + 'ms');
    }
    var obs = new IntersectionObserver(function (entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add('sd-reveal-in');
          obs.unobserve(entries[j].target);
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });
    for (var k = 0; k < targets.length; k++) obs.observe(targets[k]);
  }

  /* ── 5. Header scrolled state (kit.js setupScroll) ────────────────────── */
  function setupHeaderScroll() {
    var header = doc.getElementById('appHeader');
    if (!header) return;
    var ticking = false;
    var update = function () {
      ticking = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (y > 24) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ── 6. Lit cards attach: home + settings cards get the pointer glow ──── */
  function markLit() {
    var cards = doc.querySelectorAll('#screen-home .card, .set-card');
    for (var i = 0; i < cards.length; i++) {
      if (!cards[i].classList.contains('lit')) cards[i].classList.add('lit');
    }
  }

  function init() {
    setupLit();
    setupThemeFade();
    setupAccordions();
    setupReveals();
    setupHeaderScroll();
    markLit();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
  /* v0.0.6.i: the v0.0.5.b document-level click relay that re-synthesised
     a #btnPlayPause click for every .ring-wrap tap is REMOVED. The engine
     already binds its own click + keydown handlers on #ringWrap
     (sdp-dictation-engine.js bind()), so the relay made one physical tap fire
     togglePlayPause() twice — the clock started and instantly paused, and a
     paused session resumed-then-paused again in the same tick. One tap, one
     toggle; the ring and the transport button stay perfectly in sync. */
})();
