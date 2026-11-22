// Renders the logo SVGs to PNG using Playwright's Chromium.
//   node tools/render_pngs.cjs
// Needs: npm i -D playwright && npx playwright install chromium
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jobs = [
  // [svg, png, width (px), background]
  ['assets/logo/logo-stacked.svg', 'assets/logo/logo-stacked.png', 1200, '#ffffff'],            // invoices
  ['assets/logo/logo-stacked.svg', 'assets/logo/logo-stacked-transparent.png', 1200, null],
  ['assets/logo/logo-main.svg', 'assets/logo/logo-main.png', 1600, '#ffffff'],
  ['assets/icons/favicon.svg', 'assets/icons/favicon-32.png', 32, null],
  ['assets/icons/favicon.svg', 'assets/icons/favicon-192.png', 192, null],
  ['assets/icons/favicon.svg', 'assets/icons/apple-touch-icon.png', 180, '#ffffff'],
  ['assets/icons/favicon.svg', 'assets/icons/favicon-512.png', 512, null],
];

(async () => {
  const browser = await chromium.launch();
  for (const [svgPath, pngPath, width, bg] of jobs) {
    const svg = fs.readFileSync(path.join(root, svgPath), 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const height = Math.round((width * vb[3]) / vb[2]);
    const page = await browser.newPage({ viewport: { width, height } });
    const pad = bg && pngPath.includes('apple') ? Math.round(width * 0.1) : 0;
    await page.setContent(
      `<body style="margin:0;background:${bg || 'transparent'};display:grid;place-items:center;width:${width}px;height:${height}px">` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" ` +
        `style="width:${width - pad * 2}px;height:${height - pad * 2}px;display:block"></body>`
    );
    await page.screenshot({ path: path.join(root, pngPath), omitBackground: !bg });
    await page.close();
  }
  await browser.close();
  console.log('PNGs written');
})();
