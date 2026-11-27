// Site checks. Run with:  node --test tests/
// Needs Playwright (npm i -D playwright && npx playwright install chromium).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/styles.css'), 'utf8');

let server, url, browser;
test.before(async () => { ({ server, url } = await start()); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); server.close(); });

async function open(width = 390, height = 844, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const requests = [];
  // lazy-loaded gallery photos are local images, not data being sent anywhere
  page.on('request', (r) => { if (r.resourceType() !== 'image') requests.push(r.url()); });
  await page.goto(url + '/index.html');
  return { ctx, page, errors, requests };
}

// ---------- Static HTML checks ----------
test('site is set to noindex', () => {
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});

test('no robots.txt blocking (it would stop crawlers seeing the noindex tag)', () => {
  assert.equal(fs.existsSync(path.join(root, 'robots.txt')), false);
});

test('every phone link is the correct click-to-call number', () => {
  const tels = [...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(tels.length >= 6, `expected click-to-call in many places, found ${tels.length}`);
  for (const t of tels) assert.equal(t, '+447702782875');
});

test('every visible phone number is written 07702 782875', () => {
  const numbers = html.match(/07\d{3}\s?\d{6}/g) || [];
  assert.ok(numbers.length > 0);
  for (const n of numbers) assert.equal(n, '07702 782875');
});

test('email is an obvious placeholder', () => {
  assert.match(html, /PLACEHOLDER@example\.com/);
  assert.doesNotMatch(html, /@(gmail|hotmail|outlook|yahoo)\./i);
});

test('reviews section is commented out, not rendered', async () => {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(stripped, /id="reviews"/);
  assert.match(html, /<!--[\s\S]*id="reviews"[\s\S]*-->/);
});

test('required sections exist, in a sensible order', () => {
  const ids = ['top', 'services', 'included', 'how-it-works', 'why-us', 'gallery', 'area', 'quote'];
  let last = -1;
  for (const id of ids) {
    const i = html.indexOf(`id="${id}"`);
    assert.ok(i > -1, `missing #${id}`);
    assert.ok(i > last, `#${id} is out of order`);
    last = i;
  }
});

test('no external requests in the HTML (fast, private, works offline)', () => {
  const external = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0])
    .filter((x) => !/form-endpoint-not-set\.invalid/.test(x))
    // social profile links are plain outbound links, not resources the page loads
    .filter((x) => !/^href="https:\/\/www\.(instagram|facebook)\.com\//.test(x));
  assert.deepEqual(external, []);
});

test('all local files referenced by the page exist', () => {
  const live = html.replace(/<!--[\s\S]*?-->/g, '');   // ignore examples inside comments
  const refs = [...live.matchAll(/(?:src|href)="(assets\/[^"#?]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 6);
  for (const r of refs) assert.ok(fs.existsSync(path.join(root, r)), `missing file ${r}`);
});

test('every in-page link points at an element that exists', () => {
  const ids = new Set([...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const links = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  for (const l of links) assert.ok(ids.has(l), `broken anchor #${l}`);
});

test('every <img> has alt text and dimensions; no duplicate ids', () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  for (const i of imgs) { assert.match(i, /\salt="[^"]+"/); assert.match(i, /\swidth="\d+"/); assert.match(i, /\sheight="\d+"/); }
  const ids = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id found');
});

test('logo files exist and use the brand colours', () => {
  for (const f of ['logo-main.svg', 'logo-main-reversed.svg', 'logo-stacked.svg', 'logo-stacked.png']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/logo', f)), f);
  }
  const svg = fs.readFileSync(path.join(root, 'assets/logo/logo-main.svg'), 'utf8');
  for (const c of ['#231f20', '#f36020', '#738a99', '#254c71']) assert.ok(svg.includes(c), `logo missing ${c}`);
});

// ---------- Colour contrast (WCAG AA) ----------
function lum(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  const c = h.match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{3,6})\\b`))[1];

test('text colours meet WCAG AA contrast (4.5:1)', () => {
  const pairs = [
    ['ink', 'white'], ['ink', 'paper'], ['slate-deep', 'white'], ['slate-deep', 'paper'], ['slate-deep', 'slate-tint'],
    ['orange-deep', 'white'], ['orange-deep', 'paper'], ['orange-deep', 'slate-tint'],
    ['ink', 'orange'], ['ink', 'orange-pressed'], ['ink', 'orange-hover'],   // button text: rest / pressed / hover
    ['orange', 'ink'],            // orange on the dark hero
    ['white', 'slate-band'], ['on-dark-muted', 'slate-band'], ['on-dark-muted', 'ink'], ['orange-on-slate', 'slate-band'],
  ];
  for (const [fg, bg] of pairs) {
    const r = ratio(token(fg), token(bg));
    assert.ok(r >= 4.5, `${fg} on ${bg} is only ${r.toFixed(2)}:1`);
  }
});

// ---------- Browser checks ----------
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`no horizontal scrolling at ${width}px wide`, async () => {
    const { ctx, page } = await open(width, 900);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.equal(sw, cw, `page is ${sw}px wide in a ${cw}px window`);
    await ctx.close();
  });
}

test('page loads with no console errors and only local requests', async () => {
  const { ctx, page, errors, requests } = await open(390);
  assert.deepEqual(errors, []);
  assert.ok(requests.every((r) => r.startsWith(url)), 'found a non-local request: ' + requests.find((r) => !r.startsWith(url)));
  await ctx.close();
});

test('page stays light: total transferred under 250 KB', async () => {
  const { ctx, page } = await open(390);
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, r) => s + (r.encodedBodySize || 0), 0));
  const htmlBytes = Buffer.byteLength(html);
  assert.ok(bytes + htmlBytes < 250 * 1024, `${Math.round((bytes + htmlBytes) / 1024)} KB`);
  await ctx.close();
});

test('header has a visible click-to-call button at phone and desktop widths', async () => {
  for (const w of [320, 390, 1440]) {
    const { ctx, page } = await open(w);
    const btn = page.locator('.header-call');
    assert.ok(await btn.isVisible(), `not visible at ${w}`);
    assert.equal(await btn.getAttribute('href'), 'tel:+447702782875');
    const box = await btn.boundingBox();
    assert.ok(box.height >= 44, `touch target too small at ${w}: ${box.height}`);
    await ctx.close();
  }
});

test('mobile menu opens, closes with Escape, and links work', async () => {
  const { ctx, page } = await open(390);
  const toggle = page.locator('.nav-toggle');
  assert.equal(await page.locator('#site-nav').isVisible(), false);
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator('#site-nav').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.click();
  await page.click('#site-nav a[href="#gallery"]');
  assert.equal(await page.locator('#site-nav').isVisible(), false);
  await ctx.close();
});

test('desktop shows the full nav and hides the menu button', async () => {
  const { ctx, page } = await open(1440);
  assert.ok(await page.locator('#site-nav').isVisible());
  assert.equal(await page.locator('.nav-toggle').isVisible(), false);
  await ctx.close();
});

test('gallery: every tile is a real photo or clearly marked as a placeholder', async () => {
  const { ctx, page } = await open(390);
  const tiles = await page.locator('.gallery figure').count();
  const photos = await page.locator('.gallery figure img').count();
  assert.equal(tiles, 6);
  assert.equal(await page.locator('.gallery .ph-tag').count(), tiles - photos);
  await ctx.close();
});

// ---------- Quote form ----------
async function fill(page, over = {}) {
  const d = { name: 'Test Customer', phone: '07700 900123', email: 'test@example.com', postcode: 'CW1 2AB', ...over };
  await page.fill('#q-name', d.name); await page.fill('#q-phone', d.phone);
  await page.fill('#q-email', d.email); await page.fill('#q-postcode', d.postcode);
  if (over.project !== null) await page.check('input[name=project][value=Kitchen]', { force: true });
}

test('form has every requested field', async () => {
  const { ctx, page } = await open(390);
  for (const sel of ['[name=name]', '[name=phone][type=tel]', '[name=email][type=email]', '[name=postcode]',
    '[name=project][value=Kitchen]', '[name=project][value=Bathroom]', '[name=message]', '[name=photos][type=file]']) {
    assert.equal(await page.locator('#quote-form ' + sel).count(), 1, sel);
  }
  assert.equal(await page.getAttribute('#q-photos', 'multiple'), '');
  assert.equal(await page.locator('#q-photos[required]').count(), 0, 'photo upload must be optional');
  await ctx.close();
});

test('empty form shows errors and sends nothing', async () => {
  const { ctx, page, requests } = await open(390);
  const before = requests.length;
  await page.click('#quote-form button[type=submit]');
  for (const id of ['q-name', 'q-phone', 'q-postcode', 'q-type']) assert.ok(await page.locator(`#${id}-err`).isVisible(), id);
  assert.equal(await page.locator('#q-email-err').isVisible(), false, 'email is optional');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'q-name', 'focus should move to first error');
  const border = await page.$eval('#q-phone', (el) => getComputedStyle(el).borderTopColor);
  assert.equal(border, 'rgb(180, 35, 24)', 'invalid fields should turn red');
  assert.equal(requests.length, before);
  await ctx.close();
});

test('bad phone, email and postcode are rejected', async () => {
  const { ctx, page } = await open(390);
  await fill(page, { phone: '123', email: 'nope', postcode: '12345' });
  await page.click('#quote-form button[type=submit]');
  for (const id of ['q-phone', 'q-email', 'q-postcode']) assert.ok(await page.locator(`#${id}-err`).isVisible(), id);
  await ctx.close();
});

test('accepts normal UK postcodes in different formats', async () => {
  const { ctx, page } = await open(390);
  for (const pc of ['CW1 2AB', 'cw12ab', 'CH1 1AA', 'M1 1AE', 'SK10 4AA', 'WA16 0AB']) {
    await fill(page, { postcode: pc });
    await page.click('#quote-form button[type=submit]');
    assert.equal(await page.locator('#q-postcode-err').isVisible(), false, pc);
  }
  await ctx.close();
});

test('while the form is unconnected it says NOT sent (never fakes success)', async () => {
  const { ctx, page, requests } = await open(390);
  const before = requests.length;
  await fill(page);
  await page.click('#quote-form button[type=submit]');
  const msg = await page.locator('#form-status').innerText();
  assert.match(msg, /NOT been sent/);
  assert.match(msg, /07702\s782875/);
  assert.equal(await page.locator('#form-status.is-ok').count(), 0);
  assert.equal(requests.length, before, 'must not send anything to the placeholder endpoint');
  await ctx.close();
});

test('oversized and non-image uploads are rejected', async () => {
  const { ctx, page } = await open(390);
  await fill(page);
  await page.setInputFiles('#q-photos', { name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await page.click('#quote-form button[type=submit]');
  assert.match(await page.locator('#q-photos-err').innerText(), /5/);
  await page.setInputFiles('#q-photos', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await page.click('#quote-form button[type=submit]');
  assert.match(await page.locator('#q-photos-err').innerText(), /image/);
  await ctx.close();
});

test('once connected, form posts the data (including a photo) and shows success', async () => {
  const { ctx, page } = await open(390);
  await page.evaluate(() => document.getElementById('quote-form').setAttribute('action', 'http://127.0.0.1/__form'));
  let posted = null;
  await page.route('http://127.0.0.1/__form', async (route) => {
    posted = { method: route.request().method(), ct: route.request().headers()['content-type'], body: route.request().postDataBuffer().toString('latin1') };
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await fill(page);
  await page.setInputFiles('#q-photos', { name: 'kitchen.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('JPEGDATA') });
  await page.click('#quote-form button[type=submit]');
  await page.waitForSelector('#form-status.is-ok');
  assert.equal(posted.method, 'POST');
  assert.match(posted.ct, /multipart\/form-data/);
  for (const s of ['Test Customer', '07700 900123', 'CW1 2AB', 'Kitchen', 'kitchen.jpg', 'JPEGDATA']) assert.ok(posted.body.includes(s), s);
  assert.equal(await page.inputValue('#q-name'), '', 'form should reset after success');
  await ctx.close();
});

test('server failure shows an error, not success', async () => {
  const { ctx, page } = await open(390);
  await page.evaluate(() => document.getElementById('quote-form').setAttribute('action', 'http://127.0.0.1/__form'));
  await page.route('http://127.0.0.1/__form', (route) => route.fulfill({ status: 500, body: 'no' }));
  await fill(page);
  await page.click('#quote-form button[type=submit]');
  await page.waitForSelector('#form-status.is-error');
  assert.equal(await page.inputValue('#q-name'), 'Test Customer', 'keep what the visitor typed');
  await ctx.close();
});

test('spam trap field is hidden from people', async () => {
  const { ctx, page } = await open(390);
  const box = await page.locator('.hp input').boundingBox();
  assert.ok(box.x < 0 || box.width <= 1, 'honeypot should be off-screen');
  await ctx.close();
});
