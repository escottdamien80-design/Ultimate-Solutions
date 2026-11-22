// Pictures of the logo animation at several scroll positions, on phone and desktop.
//   node tests/scene-screenshots.cjs [outputDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { start } = require('./server.cjs');
const { scrollToProgress } = require('./scene-helpers.cjs');

const out = path.resolve(process.argv[2] || path.join(__dirname, 'screenshots'));
const stops = [0, 0.2, 0.4, 0.6, 0.8, 1];
const devices = [
  { name: 'desktop', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'phone', opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, url } = await start();
  const browser = await chromium.launch();
  for (const d of devices) {
    const ctx = await browser.newContext(d.opts);
    const page = await ctx.newPage();
    await page.goto(url + '/index.html');
    await page.waitForTimeout(300);
    for (const p of stops) {
      await scrollToProgress(page, p);
      await page.screenshot({ path: path.join(out, `scene-${d.name}-${String(Math.round(p * 100)).padStart(3, '0')}.png`) });
    }
    // and a moment after the animation, as the hero scrolls into view
    await page.evaluate(() => document.querySelector('#hero').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, `scene-${d.name}-hero.png`) });
    await ctx.close();
  }
  // Reduced motion: the finished logo, no animation
  for (const d of devices) {
    const ctx = await browser.newContext({ ...d.opts, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url + '/index.html');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `scene-${d.name}-reduced-motion.png`) });
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log('saved to', out);
})();
