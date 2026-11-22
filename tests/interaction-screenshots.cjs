// Before/after pictures of the hover and pressed states.
//   node tests/interaction-screenshots.cjs [outputDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { start } = require('./server.cjs');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'screenshots'));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, url } = await start();
  const browser = await chromium.launch();
  const shot = async (page, sel, name, pad = 24) => {
    const b = await page.locator(sel).first().boundingBox();
    await page.screenshot({ path: path.join(out, name + '.png'),
      clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } });
  };
  const wait = (p, ms = 1100) => p.waitForTimeout(ms);

  // ----- desktop (mouse) -----
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  let page = await ctx.newPage(); await page.goto(url + '/index.html');

  // pulse ring caught mid-animation (starts after 1.5s, peaks early in the cycle)
  await page.waitForTimeout(1750);
  await shot(page, '.hero-cta .btn--primary', 'd-call-pulse', 30);
  await page.waitForTimeout(3600);
  await shot(page, '.hero-cta .btn--primary', 'd-call-rest', 30);

  await shot(page, '.hero-cta', 'd-btn-rest');
  await page.hover('.hero-cta .btn--primary'); await wait(page); await shot(page, '.hero-cta', 'd-btn-hover-primary');
  await page.hover('.hero-cta .btn--ghost'); await wait(page); await shot(page, '.hero-cta', 'd-btn-hover-ghost');

  await page.mouse.move(700, 5); await wait(page);
  await shot(page, '.site-header .header-inner', 'd-nav-rest', 4);
  await page.hover('.nav a[href="#why-us"]'); await wait(page, 600); await shot(page, '.site-header .header-inner', 'd-nav-hover', 4);

  await page.locator('#services .service-grid').scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await wait(page, 600);
  await shot(page, '.service-grid', 'd-card-rest', 30);
  await page.hover('.service-card'); await wait(page); await shot(page, '.service-grid', 'd-card-hover', 30);

  await page.locator('.why-grid').scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await wait(page, 600);
  await shot(page, '.why-grid', 'd-why-rest', 30);
  await page.hover('.why-card:nth-child(2)'); await wait(page); await shot(page, '.why-grid', 'd-why-hover', 30);

  // gallery: show with a real-looking photo in the first tile so the zoom is visible
  await page.evaluate(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe5e9"/><stop offset="1" stop-color="#9aa9b4"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><rect x="80" y="120" width="420" height="660" fill="#231f20"/><rect x="540" y="120" width="580" height="260" fill="#738a99"/><rect x="540" y="420" width="580" height="360" fill="#f36020" opacity=".85"/><circle cx="300" cy="300" r="70" fill="#f6f5f3"/></svg>`;
    for (const fig of document.querySelectorAll('.gallery figure')) {
      const ph = fig.querySelector('.ph'); if (!ph) continue;
      const img = document.createElement('img'); img.alt = 'sample'; img.width = 1200; img.height = 900;
      img.src = 'data:image/svg+xml,' + encodeURIComponent(svg); ph.replaceWith(img); fig.querySelector('.ph-tag')?.remove();
    }
  });
  await page.locator('.gallery').scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await wait(page, 600);
  await shot(page, '.gallery', 'd-gallery-rest', 20);
  await page.hover('.gallery figure:nth-child(2)'); await wait(page, 1300); await shot(page, '.gallery', 'd-gallery-hover', 20);
  await ctx.close();

  // ----- phone (touch): pressed states -----
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page = await ctx.newPage(); await page.goto(url + '/index.html');
  const press = async (sel, name, area, offset = [20, 20]) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const b = await page.locator(sel).first().boundingBox();
    await shot(page, area || sel, name + '-rest');
    await page.mouse.move(b.x + offset[0], b.y + offset[1]); await page.mouse.down(); await page.waitForTimeout(600);
    await shot(page, area || sel, name + '-pressed'); await page.mouse.up(); await page.waitForTimeout(300);
  };
  await press('.hero-cta .btn--primary', 'p-btn', '.hero-cta');
  await press('.service-card', 'p-card');
  await press('.gallery figure:first-child', 'p-gallery');
  await page.locator('.hero-cta .btn--primary').scrollIntoViewIfNeeded();
  await ctx.close(); await browser.close(); server.close();
  console.log('saved to', out);
})();
