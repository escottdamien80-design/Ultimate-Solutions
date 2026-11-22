// Logo scroll-animation checks. Run with:  node --test tests/scene.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');
const { scrollToProgress, readPieces } = require('./scene-helpers.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/js/logo-scene.js'), 'utf8');

let server, url, browser;
test.before(async () => { ({ server, url } = await start()); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); server.close(); });

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

async function open(opts, extra = {}) {
  const ctx = await browser.newContext({ ...opts, ...extra });
  const page = await ctx.newPage();
  await page.goto(url + '/index.html');
  await page.waitForTimeout(250);
  return { ctx, page };
}
const U_NAMES = ['slate', 'orange', 'bowl', 'sage', 'teal', 'navy'];
const byName = (pieces, n) => pieces.find((p) => p.name === n);
const dist = (p) => Math.hypot(p.tx, p.ty);

// ---------- Markup: the pieces are the real logo shapes ----------
test('the U is split into 6 separate pieces, plus house and two text groups', () => {
  const block = html.match(/<!-- LOGO-SCENE:START[\s\S]*?<!-- LOGO-SCENE:END -->/)[0];
  const svgs = block.match(/<svg class="piece[\s\S]*?<\/svg>/g);
  assert.equal(svgs.length, 9);
  for (const n of U_NAMES) assert.ok(block.includes(`data-name="${n}"`), n);
  for (const n of U_NAMES) {
    const s = svgs.find((x) => x.includes(`data-name="${n}"`));
    assert.equal((s.match(/<path/g) || []).length, 1, `${n} should be one shape`);
  }
  assert.equal(new Set(svgs.map((s) => s.match(/viewBox="([^"]+)"/)[1])).size, 1, 'all pieces share one viewBox so they align');
});

test('pieces use the exact brand colours from the logo', () => {
  const colour = (n) => html.match(new RegExp(`data-name="${n}"[^>]*>\\s*<path fill="(#[0-9a-f]{6})"`))[1];
  assert.equal(colour('slate'), '#738a99');
  assert.equal(colour('orange'), '#f36020');
  assert.equal(colour('navy'), '#254c71');
  assert.equal(colour('sage'), '#b1c193');
  assert.equal(colour('teal'), '#5f7f77');
  assert.equal(colour('bowl'), '#231f20');
});

test('every shape in the scene is a shape from logo-main.svg (and vice versa)', () => {
  const main = fs.readFileSync(path.join(root, 'assets/logo/logo-main.svg'), 'utf8');
  const dsOf = (s) => new Set([...s.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]));
  const scene = dsOf(html.match(/<!-- LOGO-SCENE:START[\s\S]*?<!-- LOGO-SCENE:END -->/)[0]);
  const logo = dsOf(main);
  assert.equal(logo.size, 23);
  assert.deepEqual([...scene].sort(), [...logo].sort());
});

test('generated block is up to date with the build script (re-run produces no change)', () => {
  const { execSync } = require('child_process');
  const before = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  execSync('python3 tools/build_logo_scene.py', { cwd: root });
  const after = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(after, before);
});

// ---------- Scrubbed choreography ----------
test('scene is pinned (sticky) under the header and scrolls for a sensible distance', async () => {
  for (const [opts, label] of [[DESKTOP, 'desktop'], [PHONE, 'phone']]) {
    const { ctx, page } = await open(opts);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('scene-anim')), label);
    const m = await page.evaluate(() => {
      const st = document.querySelector('.logo-stage'), sc = document.querySelector('[data-logo-scene]');
      return { pos: getComputedStyle(st).position, runway: sc.offsetHeight - st.offsetHeight, vh: innerHeight, header: document.querySelector('.site-header').offsetHeight };
    });
    assert.equal(m.pos, 'sticky');
    assert.ok(m.runway >= m.vh * 0.8 && m.runway <= m.vh * 1.3, `${label} runway ${m.runway}px for ${m.vh}px viewport`);
    await scrollToProgress(page, 0.5);
    const top = await page.$eval('.logo-stage', (e) => e.getBoundingClientRect().top);
    const header = await page.$eval('.site-header', (e) => e.getBoundingClientRect().bottom);
    assert.ok(Math.abs(top - header) <= 1.5, `${label}: stage should stay pinned under the header (${top} vs ${header})`);
    await ctx.close();
  }
});

test('at the start the U pieces are off-screen or faint, and the words are hidden', async () => {
  const { ctx, page } = await open(DESKTOP);
  const ps = await readPieces(page);
  for (const n of U_NAMES) assert.ok(byName(ps, n).opacity <= 0.3, `${n} opacity ${byName(ps, n).opacity}`);
  assert.equal(byName(ps, 'ultimate').opacity, 0);
  assert.equal(byName(ps, 'solutions').opacity, 0);
  assert.ok(byName(ps, 'house').opacity > 0.1 && byName(ps, 'house').opacity < 0.5, 'house is a faint hint at the start');
  await ctx.close();
});

test('mid-scroll: pieces are in flight from different sides, rotated slightly', async () => {
  const { ctx, page } = await open(DESKTOP);
  await scrollToProgress(page, 0.3);
  const ps = await readPieces(page);
  const moving = U_NAMES.map((n) => byName(ps, n));
  assert.ok(moving.filter((p) => dist(p) > 5).length >= 5, 'most pieces should still be travelling');
  assert.ok(moving.filter((p) => Math.abs(p.rot) > 0.5).length >= 4, 'pieces should be rotated mid-flight');
  for (const p of moving) assert.ok(Math.abs(p.rot) <= 25, `${p.name} rotation ${p.rot} should stay subtle`);
  const signs = new Set(moving.filter((p) => dist(p) > 5).map((p) => `${Math.sign(Math.round(p.tx))},${Math.sign(Math.round(p.ty))}`));
  assert.ok(signs.size >= 3, `pieces should come from different directions, got ${[...signs]}`);
  assert.equal(byName(ps, 'ultimate').opacity, 0, 'words wait until the U has locked in');
  await ctx.close();
});

test('pieces start from different edges of the screen', async () => {
  const { ctx, page } = await open(DESKTOP);
  await scrollToProgress(page, 0);
  const ps = await readPieces(page);
  const stage = await page.$eval('.logo-stage', (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const sides = new Set();
  for (const n of U_NAMES) {
    const c = byName(ps, n);
    // piece centre = its layer's un-moved centre + its transform; derive from rect of the piece's own svg
    const cx = c.rect.x + c.rect.w / 2, cy = c.rect.y + c.rect.h / 2;
    if (cx < stage.l) sides.add('left'); else if (cx > stage.r) sides.add('right');
    if (cy < stage.t) sides.add('top'); else if (cy > stage.b) sides.add('bottom');
  }
  // A moved layer's bounding box is the whole logo box shifted, so use the transform sign instead
  const dirs = new Set(U_NAMES.map((n) => `${Math.sign(Math.round(byName(ps, n).tx / 20))},${Math.sign(Math.round(byName(ps, n).ty / 20))}`));
  assert.ok(dirs.size >= 4, `expected several distinct start directions, got ${[...dirs]}`);
  await ctx.close();
});

test('at the end everything is locked in place: no transform, full opacity, words visible', async () => {
  for (const opts of [DESKTOP, PHONE]) {
    const { ctx, page } = await open(opts);
    await scrollToProgress(page, 1);
    for (const p of await readPieces(page)) {
      assert.equal(p.opacity, 1, p.name);
      assert.ok(Math.abs(p.tx) < 0.01 && Math.abs(p.ty) < 0.01 && Math.abs(p.rot) < 0.01, `${p.name} should be exactly in place`);
    }
    await ctx.close();
  }
});

test('the words fade in only AFTER every piece has locked into the U', async () => {
  const { ctx, page } = await open(DESKTOP);
  for (const p of [0.5, 0.6, 0.7]) {
    await scrollToProgress(page, p);
    assert.equal(byName(await readPieces(page), 'ultimate').opacity, 0, `words hidden at ${p}`);
  }
  await scrollToProgress(page, 0.72);
  const ps = await readPieces(page);
  for (const n of U_NAMES) assert.ok(dist(byName(ps, n)) < 0.5, `${n} locked before words appear`);
  await scrollToProgress(page, 0.82);
  const mid = await readPieces(page);
  assert.ok(byName(mid, 'ultimate').opacity > 0.2 && byName(mid, 'ultimate').opacity < 1, 'ULTIMATE is mid-fade');
  assert.ok(byName(mid, 'solutions').opacity < byName(mid, 'ultimate').opacity, 'SOLUTIONS follows ULTIMATE');
  await ctx.close();
});

test('progress is monotonic going down, and scrubbing back up reverses it exactly', async () => {
  const { ctx, page } = await open(DESKTOP);
  const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const down = [];
  for (const p of steps) { await scrollToProgress(page, p, 450); down.push(await readPieces(page)); }
  for (const n of [...U_NAMES, 'ultimate', 'solutions']) {
    for (let i = 1; i < down.length; i++) {
      const a = byName(down[i - 1], n), b = byName(down[i], n);
      assert.ok(b.opacity >= a.opacity - 0.005, `${n} opacity should never drop while scrolling down (${a.opacity} -> ${b.opacity})`);
      if (U_NAMES.includes(n)) assert.ok(dist(b) <= dist(a) + 0.5, `${n} should only move closer to its place`);
    }
  }
  const up = {};
  for (const p of [...steps].reverse()) { await scrollToProgress(page, p, 450); up[p] = await readPieces(page); }
  steps.forEach((p, i) => {
    for (const n of [...U_NAMES, 'ultimate', 'solutions', 'house']) {
      const a = byName(down[i], n), b = byName(up[p], n);
      assert.ok(Math.abs(a.opacity - b.opacity) < 0.01, `${n} opacity differs on the way back at ${p}`);
      assert.ok(Math.abs(a.tx - b.tx) < 1 && Math.abs(a.ty - b.ty) < 1 && Math.abs(a.rot - b.rot) < 0.5, `${n} position differs on the way back at ${p}`);
    }
  });
  await ctx.close();
});

test('the finished animation matches the real logo (logo-main.svg), and the check can detect a misplaced piece', async (t) => {
  const { ctx, page } = await open(DESKTOP);
  // Pin the logo box to whole pixels (size and position) so both renders snap to the same pixel grid.
  await page.addStyleTag({ content: '.logo-stage{background:#fff !important} .logo-box{width:990px !important;height:408px !important;aspect-ratio:auto !important}' });
  await scrollToProgress(page, 1);
  const box = page.locator('.logo-box');
  const bb = await box.boundingBox();
  assert.ok(Number.isInteger(bb.x) && Number.isInteger(bb.y), `box should sit on whole pixels, got ${bb.x},${bb.y}`);
  const ref = await ctx.newPage();
  await ref.setContent(`<body style="margin:0;background:#fff"><img id=i src="${url}/assets/logo/logo-main.svg" style="display:block;width:${bb.width}px;height:${bb.height}px">`);
  await ref.waitForFunction(() => document.getElementById('i').complete && document.getElementById('i').naturalWidth > 0);
  const refShot = (await ref.locator('#i').screenshot()).toString('base64');

  // Share of pixels that differ noticeably. Resolution 1/2 averages away tiny anti-aliasing noise
  // but still catches any real misplacement.
  const compare = async (a) => ref.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(x), load(y)]);
    const w = Math.round(A.width / 2), h = Math.round(A.height / 2);
    const px = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const d1 = px(A), d2 = px(B); let bad = 0;
    for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) > 45 || Math.abs(d1[i + 1] - d2[i + 1]) > 45 || Math.abs(d1[i + 2] - d2[i + 2]) > 45) bad++;
    return bad / (w * h);
  }, [a, refShot]);

  const clean = await compare((await box.screenshot()).toString('base64'));
  assert.ok(clean < 0.003, `${(clean * 100).toFixed(3)}% of areas differ from the real logo`);

  // sensitivity: nudge the orange stem 6px and the same check must notice
  await page.$eval('.piece--orange', (e) => { e.style.transform = 'translate(6px,0)'; });
  const moved = await compare((await box.screenshot()).toString('base64'));
  t.diagnostic(`differing pixels: assembled ${(clean * 100).toFixed(3)}% vs one piece shifted 6px ${(moved * 100).toFixed(3)}%`);
  assert.ok(moved > clean * 3 && moved > 0.0015, `a 6px misplacement should be detected (clean ${clean}, moved ${moved})`);
  await ctx.close();
});

// ---------- Reduced motion ----------
test('prefers-reduced-motion: finished logo shown, no pinning, no animation', async () => {
  for (const opts of [DESKTOP, PHONE]) {
    const { ctx, page } = await open(opts, { reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('scene-anim')), false);
    const m = await page.evaluate(() => ({
      pos: getComputedStyle(document.querySelector('.logo-stage')).position,
      h: document.querySelector('[data-logo-scene]').offsetHeight, vh: innerHeight,
      cue: getComputedStyle(document.querySelector('.scene-cue')).display }));
    assert.notEqual(m.pos, 'sticky');
    assert.ok(m.h < m.vh * 0.75, `banner should be compact, got ${m.h}px in a ${m.vh}px window`);
    assert.equal(m.cue, 'none');
    const check = async () => { for (const p of await readPieces(page)) { assert.equal(p.opacity, 1, p.name); assert.equal(p.transform, 'none', p.name); } };
    await check();
    await page.mouse.wheel(0, 250); await page.waitForTimeout(400);
    await check();                                    // scrolling changes nothing
    await ctx.close();
  }
});

test('switching reduced-motion on and off while the page is open works', async () => {
  const { ctx, page } = await open(DESKTOP);
  await scrollToProgress(page, 0.3);
  assert.ok((await readPieces(page)).some((p) => p.opacity < 1));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('scene-anim')), false);
  for (const p of await readPieces(page)) assert.equal(p.opacity, 1, p.name + ' should show finished logo');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('scene-anim')));
  await scrollToProgress(page, 0);
  assert.ok(byName(await readPieces(page), 'orange').opacity < 0.3, 'animation is live again');
  await ctx.close();
});

test('without JavaScript the finished logo is shown', async () => {
  const ctx = await browser.newContext({ ...DESKTOP, javaScriptEnabled: false });
  const page = await ctx.newPage(); await page.goto(url + '/index.html');
  for (const p of await readPieces(page)) { assert.equal(p.opacity, 1, p.name); assert.equal(p.transform, 'none'); }
  assert.ok(await page.$eval('[data-logo-scene]', (e) => e.offsetHeight) < 700);
  await ctx.close();
});

// ---------- Smooth, cheap, no layout shift ----------
test('only transform and opacity are animated (GPU-friendly), and layers are promoted', async () => {
  const { ctx, page } = await open(DESKTOP);
  await scrollToProgress(page, 0.4);
  const styles = await page.$$eval('[data-piece]', (els) => els.map((e) => [...e.style].sort().join()));
  for (const s of styles) assert.match(s, /^(opacity,transform(,transform-origin)?|opacity,transform-origin,transform|opacity,transform,transform-origin|transform-origin,opacity,transform|opacity,transform-origin|opacity,transform)$/);
  for (const s of styles) assert.doesNotMatch(s, /left|top|width|height|margin|filter|blur/);
  assert.match(await page.$eval('.piece--orange', (e) => getComputedStyle(e).willChange), /transform/);
  await ctx.close();
});

test('script uses passive scroll listeners and batches work in requestAnimationFrame', async () => {
  assert.match(js, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  assert.match(js, /requestAnimationFrame/);
  assert.doesNotMatch(js, /\.(left|top|width|height)\s*=/, 'must not animate layout properties');
  const ctx = await browser.newContext(DESKTOP); const page = await ctx.newPage();
  await page.addInitScript(() => { window.__raf = 0; const o = window.requestAnimationFrame; window.requestAnimationFrame = (f) => { window.__raf++; return o(f); }; });
  await page.goto(url + '/index.html'); await page.waitForTimeout(500);
  const used = await page.evaluate(() => { const b = window.__raf; for (let i = 0; i < 200; i++) window.dispatchEvent(new Event('scroll')); return window.__raf - b; });
  assert.ok(used <= 1, `200 scroll events should schedule at most 1 frame of work, got ${used}`);
  await ctx.close();
});

test('no layout shift while loading or scrolling, and no sideways scrolling at any size', async () => {
  for (const w of [320, 390, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage();
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(url + '/index.html'); await page.waitForTimeout(400);
    const heights = [];
    for (const p of [0, 0.3, 0.6, 1]) {
      await scrollToProgress(page, p, 350);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }));
      assert.equal(m.sw, m.cw, `${w}px wide at progress ${p}`);
      heights.push(m.h);
    }
    assert.equal(new Set(heights).size, 1, `page height changed while animating at ${w}px: ${heights}`);
    assert.ok((await page.evaluate(() => window.__cls)) < 0.02, `layout shift at ${w}px`);
    await ctx.close();
  }
});

test('logo stays inside the screen when assembled, on small and large screens', async () => {
  for (const w of [320, 390, 768, 1440]) {
    const { ctx, page } = await open({ viewport: { width: w, height: 800 } });
    await scrollToProgress(page, 1);
    const r = await page.$eval('.logo-box', (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, w: innerWidth }; });
    assert.ok(r.l >= 0 && r.r <= r.w, `${w}px: logo box ${r.l}..${r.r}`);
    await ctx.close();
  }
});

// ---------- The rest of the page is untouched and stays usable ----------
test('page stays readable and usable: header stays clickable, hero text is reachable and uncovered', async () => {
  for (const opts of [DESKTOP, PHONE]) {
    const { ctx, page } = await open(opts);
    await scrollToProgress(page, 0.5);
    const hit = await page.evaluate(() => { const b = document.querySelector('.header-call').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e && !!e.closest('.header-call'); });
    assert.ok(hit, 'call button must stay clickable during the animation');
    await page.evaluate(() => document.querySelector('#hero').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(500);
    const h1 = await page.evaluate(() => { const b = document.querySelector('#hero-title').getBoundingClientRect(); const e = document.elementFromPoint(b.x + 20, b.y + b.height / 2); return { top: b.top, bottom: b.bottom, vh: innerHeight, ok: !!e && !!e.closest('#hero-title') }; });
    assert.ok(h1.ok, 'headline should not be covered');
    assert.ok(h1.top >= 0 && h1.bottom <= h1.vh, 'headline should be on screen when the hero is reached');
    for (const p of await readPieces(page)) assert.equal(p.opacity, 1);
    await ctx.close();
  }
});

test('logo in the header still takes you to the very top (the animation start)', async () => {
  const { ctx, page } = await open(DESKTOP);
  await page.evaluate(() => document.querySelector('#hero').scrollIntoView({ behavior: 'instant' }));
  await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => scrollY) > 300);
  await page.click('.brand'); await page.waitForTimeout(1200);
  assert.ok(await page.evaluate(() => scrollY) < 5);
  assert.equal(await page.$eval('#top', (e) => e.getAttribute('data-logo-scene') !== null), true);
  await ctx.close();
});

test('scene styles never touch buttons, cards, gallery or the form (hover effects and form untouched)', () => {
  const scene = css.slice(css.indexOf('Logo scene (scroll-driven'));
  for (const sel of ['.btn', '.card', '.why-card', '.trade-tile', '.gallery', '.form', '.field', '.nav']) {
    assert.ok(!scene.includes(sel), `scene CSS should not mention ${sel}`);
  }
  assert.ok(css.includes('Interaction polish'), 'hover block still there');
  assert.match(html, /<form class="form" id="quote-form"/);
});
