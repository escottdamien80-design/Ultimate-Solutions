// Hover / pressed / reduced-motion checks. Run with:  node --test tests/interactions.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');

let server, url, browser;
test.before(async () => { ({ server, url } = await start()); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); server.close(); });

const DESKTOP = { viewport: { width: 1440, height: 900 } };
const TOUCH = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

async function open(opts, media) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (media) await page.emulateMedia(media);
  await page.goto(url + '/index.html');
  return { ctx, page };
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);       // let transitions finish

// matrix(a,b,c,d,tx,ty) -> { sx, sy, ty }
const parse = (t) => {
  if (!t || t === 'none') return { sx: 1, sy: 1, tx: 0, ty: 0, rot: 0 };
  const m = t.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
  return { sx: Math.hypot(m[0], m[1]), sy: Math.hypot(m[2], m[3]), tx: m[4], ty: m[5], rot: Math.atan2(m[1], m[0]) * 180 / Math.PI };
};
const style = (page, sel, prop, pseudo = null) =>
  page.$eval(sel, (el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
const tf = async (page, sel, pseudo) => parse(await style(page, sel, 'transform', pseudo));

// ---------- Mouse hover ----------
test('primary button lifts, glows orange and nudges its icon on hover', async () => {
  const { ctx, page } = await open(DESKTOP);
  const sel = '.hero-cta .btn--primary';
  const before = { t: await tf(page, sel), s: await style(page, sel, 'boxShadow'), i: await tf(page, sel + ' svg') };
  await page.hover(sel); await settle(page);
  const after = { t: await tf(page, sel), s: await style(page, sel, 'boxShadow'), i: await tf(page, sel + ' svg') };
  assert.ok(after.t.ty <= -1.5, `should lift, got ty=${after.t.ty}`);
  assert.equal(before.t.ty, 0);
  assert.notEqual(after.s, before.s);
  assert.match(after.s, /rgba\(243, 96, 32/, 'glow should be brand orange');
  assert.equal(before.i.tx, 0);
  assert.ok(after.i.tx > 0, `icon should nudge right, got tx=${after.i.tx}`);
  assert.ok(after.i.rot < 0, `icon should tilt slightly, got ${after.i.rot}deg`);
  await ctx.close();
});

test('ghost and dark buttons also respond to hover', async () => {
  const { ctx, page } = await open(DESKTOP);
  await page.hover('.hero-cta .btn--ghost'); await settle(page);
  assert.ok((await tf(page, '.hero-cta .btn--ghost')).ty <= -1.5);
  await ctx.close();
});

test('service cards rise with shadow and an orange border highlight', async () => {
  const { ctx, page } = await open(DESKTOP);
  const sel = '.service-card';
  const b = { s: await style(page, sel, 'boxShadow'), c: await style(page, sel, 'borderTopColor') };
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.hover(sel); await settle(page);
  const t = await tf(page, sel);
  assert.ok(t.ty <= -3 && t.ty >= -6, `rise should be a few px, got ${t.ty}`);
  assert.notEqual(await style(page, sel, 'boxShadow'), b.s);
  const c = await style(page, sel, 'borderTopColor');
  assert.notEqual(c, b.c); assert.match(c, /rgba?\(243, 96, 32/);
  await ctx.close();
});

test('"why choose us" cards rise with a border highlight', async () => {
  const { ctx, page } = await open(DESKTOP);
  const sel = '.why-card';
  const bc = await style(page, sel, 'borderTopColor');
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.hover(sel); await settle(page);
  assert.ok((await tf(page, sel)).ty <= -3);
  assert.notEqual(await style(page, sel, 'borderTopColor'), bc);
  await ctx.close();
});

test('gallery project: photo zooms gently inside its frame on hover', async () => {
  const { ctx, page } = await open(DESKTOP);
  const fig = '.gallery figure:first-child';
  await page.locator(fig).scrollIntoViewIfNeeded();
  assert.equal((await tf(page, fig + ' img')).sx, 1);
  await page.hover(fig); await settle(page, 2000);
  const z = await tf(page, fig + ' img');
  assert.ok(z.sx > 1.01 && z.sx < 1.06, `zoom should be slight, got ${z.sx}`);
  assert.equal(await style(page, fig, 'overflow'), 'hidden', 'zoom must stay inside the frame');
  await ctx.close();
});

test('nav links get an animated underline on hover (desktop)', async () => {
  const { ctx, page } = await open(DESKTOP);
  const sel = '.nav a[href="#services"]';
  assert.equal((await tf(page, sel, '::after')).sx, 0, 'hidden until hover');
  await page.hover(sel); await settle(page, 600);
  assert.equal((await tf(page, sel, '::after')).sx, 1);
  assert.equal(await style(page, sel, 'transitionProperty', '::after'), 'transform');
  assert.equal(await style(page, sel, 'height', '::after'), '2px');
  await page.mouse.move(5, 500); await settle(page, 600);
  assert.equal((await tf(page, sel, '::after')).sx, 0, 'underline retracts');
  await ctx.close();
});

test('nav underline also shows for keyboard focus', async () => {
  const { ctx, page } = await open(DESKTOP);
  await page.focus('.nav a[href="#gallery"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  await settle(page, 600);
  assert.equal((await tf(page, '.nav a[href="#gallery"]', '::after')).sx, 1);
  await ctx.close();
});

test('click-to-call buttons have a standing glow and a pulse ring', async () => {
  const { ctx, page } = await open(DESKTOP);
  for (const sel of ['.header-call', '.hero-cta .btn--primary']) {
    assert.equal(await style(page, sel, 'animationName', '::after'), 'callPulse', sel);
    assert.equal(await style(page, sel, 'animationIterationCount', '::after'), 'infinite');
    assert.match(await style(page, sel, 'boxShadow'), /rgba\(243, 96, 32/, sel + ' should glow at rest');
  }
  // understated: the ring is faint and the cycle is slow (>= 4s)
  assert.ok(parseFloat(await style(page, '.header-call', 'animationDuration', '::after')) >= 4);
  // hover hands over to the stronger glow and stops the pulse
  await page.hover('.header-call'); await settle(page, 500);
  assert.equal(await style(page, '.header-call', 'animationName', '::after'), 'none');
  await ctx.close();
});

// ---------- Touch: no sticky hover, clean pressed state ----------
test('touch device matches (hover: none) so hover styles are off', async () => {
  const { ctx, page } = await open(TOUCH);
  assert.equal(await page.evaluate(() => matchMedia('(hover: hover)').matches), false);
  await ctx.close();
});

test('tapping a button on touch leaves NO sticky hover lift or glow', async () => {
  const { ctx, page } = await open(TOUCH);
  const sel = '.hero-cta .btn--ghost';                   // # anchor link, safe to tap
  await page.tap(sel); await settle(page);
  assert.equal((await tf(page, sel)).ty, 0, 'no lift after tap');
  assert.equal(await style(page, sel, 'boxShadow'), 'none');
  await page.hover('.service-card'); await settle(page);
  assert.equal((await tf(page, '.service-card')).ty, 0, 'cards do not rise on touch');
  await ctx.close();
});

test('pressing shows a clean pressed state on touch (button, card, nav)', async () => {
  const { ctx, page } = await open(TOUCH);
  // button: scales down + darker orange
  const b = '.hero-cta .btn--primary';
  const rest = await style(page, b, 'backgroundColor');
  const box = await page.locator(b).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10); await page.mouse.down(); await page.waitForTimeout(300);
  const t = await tf(page, b);
  assert.ok(t.sx < 1 && t.sx > 0.9, `pressed scale ${t.sx}`);
  assert.notEqual(await style(page, b, 'backgroundColor'), rest);
  await page.mouse.up();
  // card: border highlight, no movement (so scrolling never feels janky)
  const c = '.service-card'; await page.locator(c).first().scrollIntoViewIfNeeded();
  const cb = await page.locator(c).first().boundingBox(); const bc = await style(page, c, 'borderTopColor');
  await page.mouse.move(cb.x + 20, cb.y + 20); await page.mouse.down(); await page.waitForTimeout(500);
  assert.notEqual(await style(page, c, 'borderTopColor'), bc);
  assert.equal((await tf(page, c)).ty, 0);
  await page.mouse.up();
  await ctx.close();
});

test('pressed state also works with a mouse (button click-down)', async () => {
  const { ctx, page } = await open(DESKTOP);
  const sel = '.hero-cta .btn--primary'; const box = await page.locator(sel).boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10); await page.mouse.down(); await page.waitForTimeout(300);
  assert.ok((await tf(page, sel)).sx < 1);
  await page.mouse.up(); await ctx.close();
});

// ---------- Reduced motion ----------
test('prefers-reduced-motion: no pulse, lift, zoom or nudge (colour/shadow feedback kept)', async () => {
  const { ctx, page } = await open(DESKTOP, { reducedMotion: 'reduce' });
  assert.equal(await style(page, '.header-call', 'animationName', '::after'), 'none');
  const sel = '.hero-cta .btn--primary';
  const shadow = await style(page, sel, 'boxShadow');
  await page.hover(sel); await settle(page, 400);
  assert.equal((await tf(page, sel)).ty, 0, 'no lift');
  assert.equal((await tf(page, sel + ' svg')).tx, 0, 'no icon nudge');
  assert.notEqual(await style(page, sel, 'boxShadow'), shadow, 'still gets a glow');
  await page.locator('.service-card').first().scrollIntoViewIfNeeded();
  await page.hover('.service-card'); await settle(page, 400);
  assert.equal((await tf(page, '.service-card')).ty, 0);
  assert.notEqual(await style(page, '.service-card', 'borderTopColor'), 'rgb(225, 223, 218)', 'border highlight kept');
  await page.locator('.gallery figure').first().scrollIntoViewIfNeeded();
  await page.hover('.gallery figure:first-child'); await settle(page, 400);
  assert.equal((await tf(page, '.gallery figure:first-child :is(img, .ph)')).sx, 1, 'no zoom');
  await ctx.close();
});

// ---------- Nothing else changes ----------
test('hovering and pressing never changes layout or causes scrolling sideways', async () => {
  for (const [opts, label] of [[DESKTOP, 'desktop'], [TOUCH, 'phone']]) {
    const { ctx, page } = await open(opts);
    const measure = () => page.evaluate(() => ({
      h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      boxes: [...document.querySelectorAll('section, .card, .why-card, .trade-tile, .gallery figure, .btn, .nav a')]
        .map((e) => [e.offsetTop, e.offsetLeft, e.offsetWidth, e.offsetHeight].join()).join('|'),
    }));
    const before = await measure();
    for (const sel of ['.btn--primary', '.service-card', '.why-card', '.gallery figure', '.trade-tile']) {
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      const b = await page.locator(sel).first().boundingBox();
      await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.waitForTimeout(150);
      await page.mouse.up(); await page.waitForTimeout(250);
    }
    const after = await measure();
    assert.deepEqual(after, before, label);
    assert.equal(after.w, after.cw, label + ' horizontal overflow');
    await ctx.close();
  }
});

test('disabled submit button (while sending) does not lift or glow', async () => {
  const { ctx, page } = await open(DESKTOP);
  await page.evaluate(() => { document.querySelector('#quote-form button[type=submit]').disabled = true; });
  await page.locator('#quote-form').scrollIntoViewIfNeeded();
  await page.hover('#quote-form button[type=submit]', { force: true }); await settle(page, 400);
  assert.equal((await tf(page, '#quote-form button[type=submit]')).ty, 0);
  await ctx.close();
});
