// Takes full-page screenshots at phone and desktop widths.
//   node tests/screenshots.cjs [outputDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { start } = require('./server.cjs');

const out = path.resolve(process.argv[2] || path.join(__dirname, 'screenshots'));
const sizes = [
  { name: 'phone-390', width: 390, height: 844, scale: 2 },
  { name: 'tablet-820', width: 820, height: 1180, scale: 1 },
  { name: 'desktop-1440', width: 1440, height: 900, scale: 1 },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { server, url } = await start();
  const browser = await chromium.launch();
  for (const s of sizes) {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.scale });
    const page = await ctx.newPage();
    await page.goto(url + '/index.html');
    await page.screenshot({ path: path.join(out, `${s.name}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(out, `${s.name}-top.png`) });
    await ctx.close();
  }
  // Phone: menu open, and form with validation errors
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url + '/index.html');
  await page.click('.nav-toggle');
  await page.screenshot({ path: path.join(out, 'phone-390-menu-open.png') });
  await page.click('.nav-toggle');
  await page.click('#quote-form button[type=submit]');
  await page.locator('#quote-form').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'phone-390-form-errors.png') });
  await ctx.close();
  await browser.close();
  server.close();
  console.log('Screenshots in', out);
})();
