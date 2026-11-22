/* Ultimate Solutions - scroll-driven logo assembly.

   As the visitor scrolls through the tall "logo scene", the pieces of the striped U
   fly in from different sides, rotate slightly and lock into the house outline; then
   the words fade in. Progress is tied to scroll position, so scrolling back up plays
   it in reverse.

   - Only `transform` and `opacity` are written, so it stays on the GPU compositor.
   - Scroll events are passive and batched into one requestAnimationFrame per frame.
   - The choreography numbers live in index.html (data-* attributes) and are generated
     by tools/build_logo_scene.py.
   - With prefers-reduced-motion (or no JS) nothing here runs: the finished logo shows. */
(function () {
  'use strict';

  var root = document.documentElement;
  var scene = document.querySelector('[data-logo-scene]');
  if (!scene) return;

  var stage = scene.querySelector('.logo-stage');
  var box = scene.querySelector('.logo-box');
  var cue = scene.querySelector('.scene-cue');
  var items = Array.prototype.map.call(scene.querySelectorAll('[data-piece]'), function (el) {
    var from = (el.getAttribute('data-from') || '0,0').split(',');
    return {
      el: el,
      kind: el.getAttribute('data-piece'),                 // house | u | text
      fx: parseFloat(from[0]), fy: parseFloat(from[1]),
      rot: parseFloat(el.getAttribute('data-rot')) || 0,
      start: parseFloat(el.getAttribute('data-start')) || 0,
      dur: parseFloat(el.getAttribute('data-dur')) || 0.5,
      cx: parseFloat(el.getAttribute('data-cx')) / 100,    // piece centre, as a fraction of the logo box
      cy: parseFloat(el.getAttribute('data-cy')) / 100,
      w: parseFloat(el.getAttribute('data-w')) / 100,
      h: parseFloat(el.getAttribute('data-h')) / 100,
      dx: 0, dy: 0                                         // start offsets in px (set in measure)
    };
  });

  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var active = false, raf = 0, current = 0, target = 0, runway = 1, stageTop = 0;
  var LEAD = 0.04;       // pieces are already a touch in motion at scroll position 0
  var DAMP = 0.3;        // light smoothing so mouse-wheel steps don't look steppy

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { var u = 1 - t; return 1 - u * u * u; }
  function num(v) { return (Math.round(v * 100) / 100).toString(); }

  /* Work out, in px, where each piece starts so it begins just beyond the screen edge. */
  function measure() {
    var sr = stage.getBoundingClientRect();
    var br = box.getBoundingClientRect();
    var W = sr.width, H = sr.height;
    var offX = (br.left + br.width / 2) - (sr.left + W / 2);
    var offY = (br.top + br.height / 2) - (sr.top + H / 2);
    items.forEach(function (it) {
      if (it.kind !== 'u') return;
      var finalX = offX + (it.cx - 0.5) * br.width;
      var finalY = offY + (it.cy - 0.5) * br.height;
      var half = Math.max(it.w * br.width, it.h * br.height) / 2 + 24;
      it.dx = it.fx * (W / 2 + half) - finalX;
      it.dy = it.fy * (H / 2 + half) - finalY;
    });
    var cs = getComputedStyle(stage);
    stageTop = parseFloat(cs.top) || 0;
    runway = Math.max(1, scene.offsetHeight - stage.offsetHeight);
  }

  /* 0 when the stage pins under the header, 1 when the runway has been scrolled. */
  function progress() {
    return clamp((stageTop - scene.getBoundingClientRect().top) / runway);
  }

  function render(p) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i], el = it.el, t, e;
      if (it.kind === 'house') {
        t = easeOut(clamp(p / 0.25));
        el.style.opacity = num(0.25 + 0.75 * t);
        el.style.transform = t >= 1 ? 'none' : 'translate3d(0,' + num((1 - t) * 10) + 'px,0)';
      } else if (it.kind === 'u') {
        t = clamp((p + LEAD - it.start) / it.dur);
        e = easeOut(t);
        el.style.opacity = num(easeOut(clamp(t / 0.5)));
        el.style.transform = t >= 1 ? 'none' :
          'translate3d(' + num(it.dx * (1 - e)) + 'px,' + num(it.dy * (1 - e)) + 'px,0) rotate(' + num(it.rot * (1 - e)) + 'deg)';
      } else {
        t = clamp((p - it.start) / it.dur);
        e = easeOut(t);
        el.style.opacity = num(e);
        el.style.transform = t >= 1 ? 'none' : 'translate3d(0,' + num((1 - e) * 10) + 'px,0)';
      }
    }
    if (cue) cue.style.opacity = num(1 - clamp(p / 0.08));
  }

  function tick() {
    raf = 0;
    current += (target - current) * DAMP;
    if (Math.abs(target - current) < 0.0008) current = target;
    render(current);
    if (current !== target) raf = requestAnimationFrame(tick);
  }

  function onScroll() {
    target = progress();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  var resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      measure();
      current = target = progress();
      render(current);
    });
  }

  function enable() {
    if (active) return;
    active = true;
    root.classList.add('scene-anim');
    measure();
    current = target = progress();      // reloading mid-page: start from where we are
    render(current);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('load', onResize);
  }

  function disable() {
    if (!active && !root.classList.contains('scene-anim')) return;
    active = false;
    root.classList.remove('scene-anim');
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('load', onResize);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    items.forEach(function (it) { it.el.style.opacity = ''; it.el.style.transform = ''; });
    if (cue) cue.style.opacity = '';
  }

  function sync() { if (motion.matches) disable(); else enable(); }

  sync();
  if (motion.addEventListener) motion.addEventListener('change', sync);
  else if (motion.addListener) motion.addListener(sync);
})();
