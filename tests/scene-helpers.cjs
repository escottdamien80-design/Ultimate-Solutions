// Shared helpers for the logo-scene tests and screenshots.

// Scroll so the animation is at progress p (0..1), then wait for the light smoothing to settle.
async function scrollToProgress(page, p, settleMs = 700) {
  await page.evaluate((p) => {
    const scene = document.querySelector('[data-logo-scene]');
    const stage = scene.querySelector('.logo-stage');
    const stageTop = parseFloat(getComputedStyle(stage).top) || 0;
    const docTop = scene.getBoundingClientRect().top + window.scrollY;
    const runway = scene.offsetHeight - stage.offsetHeight;
    window.scrollTo(0, docTop - stageTop + p * runway);
  }, p);
  await page.waitForTimeout(settleMs);
}

// matrix(...) / none -> { tx, ty, rot, scale }
function parseTransform(t) {
  if (!t || t === 'none') return { tx: 0, ty: 0, rot: 0, scale: 1 };
  const m = t.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
  return { tx: m[4], ty: m[5], rot: Math.atan2(m[1], m[0]) * 180 / Math.PI, scale: Math.hypot(m[0], m[1]) };
}

// Read every piece's current transform + opacity.
async function readPieces(page) {
  const raw = await page.$$eval('[data-piece]', (els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { name: el.getAttribute('data-name') || el.getAttribute('data-piece'), kind: el.getAttribute('data-piece'),
      transform: cs.transform, opacity: parseFloat(cs.opacity), rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
  }));
  return raw.map((p) => ({ ...p, ...parseTransform(p.transform) }));
}

module.exports = { scrollToProgress, parseTransform, readPieces };
