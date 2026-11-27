# Ultimate Solutions website

One-page website for **Ultimate Solutions**, bathroom, wet room and kitchen fitters covering Cheshire and surrounding areas.
Plain HTML, CSS and JavaScript. No frameworks, no build step, no external requests.

> **Status: private preview.** The site is set to `noindex`, so search engines are asked to ignore it until you say it's ready (see [Going live](#going-live)).

## What's in the folder

```
index.html              the whole page (edit text here)
assets/css/styles.css   all the styling; colours are at the top
assets/js/main.js       mobile menu + quote form checks
assets/logo/            logos (SVG + PNG), see "Logos" below
assets/icons/           favicon + phone/home-screen icons
brand/source/           the original logo files you supplied
tests/                  automated checks + screenshot script
tools/                  scripts that rebuild the logo files
.nojekyll               tells GitHub Pages to publish the files as they are
```

## Turn on GitHub Pages (step by step)

You only need to do this once. You need to be signed in to GitHub as the owner of this repo.

1. Go to **https://github.com/escottdamien80-design/Ultimate-Solutions** in your browser.
2. Click the **Settings** tab (the one with the cog icon, along the top of the repo, right of "Insights").
   - Can't see it? You're not signed in as the owner, or you're on a phone, where the tab can be hidden under a "…" menu.
3. In the left-hand menu, scroll to **Code and automation** and click **Pages**.
4. Under **Build and deployment**, find **Source** and make sure it says **Deploy from a branch**.
5. Under **Branch**, open the first dropdown and choose the branch that holds the website:
   - **Right now** the site is on the branch **`claude/nifty-keller-9vyx17`** (nothing has been merged into `main` yet), so pick that one to preview it.
   - **Later**, once the work has been merged into `main`, come back here and switch the branch to **`main`**.
6. Leave the second dropdown on **`/ (root)`**, then click **Save**.
7. Wait about 1 to 2 minutes. Refresh the Pages settings page. A box appears at the top saying **"Your site is live at …"**.
   Your address will be: **https://escottdamien80-design.github.io/Ultimate-Solutions/**
8. Click **Visit site** to check it. If you see a 404, wait another minute and refresh, because the first publish can take a little while.
   You can watch progress under the **Actions** tab: a job called *"pages build and deployment"* shows a green tick when finished.

Good to know:
- Every time you save a change to the branch you chose, the live site updates by itself within a minute or two.
- If the Pages page asks you to upgrade, the repo is **private**. GitHub's free plan only publishes Pages from **public** repos. Either make the repo public (Settings → General → scroll to the bottom → Change visibility) or upgrade your plan.
- "noindex" keeps the site out of Google, but the web address is **not secret or password protected**. Anyone with the link can open it.
- Later you can add your own domain (e.g. `ultimatesolutions.co.uk`) in the same Pages screen under **Custom domain**.

## Things to fill in

| What | Where | Notes |
|---|---|---|
| **Real email address** | `index.html`, search for `PLACEHOLDER@example.com` (2 places, each has the `mailto:` link and the text) | Also remove the dashed outline: delete `class="placeholder-email"` |
| **Quote form service** | `index.html`, the `<form id="quote-form" action="…">` | See below |
| **Job photos** | `index.html`, the Gallery section | See below |
| **Town list** | `index.html`, the "Areas covered" section | I picked common Cheshire towns. Remove any you don't want to cover, add any that are missing. |
| **How it works / Why choose us wording** | `index.html` | Draft copy based on what you told me. Check it describes how David really works. |
| **Reviews** | `index.html`, big commented-out block above the Gallery | Instructions are inside the comment |

I've deliberately **not** claimed anything I couldn't verify (years of experience, insurance, guarantees, accreditations such as Gas Safe/NICEIC, "free quotes", prices). If any of those are true, they're strong trust signals worth adding.

## Connecting the quote form

GitHub Pages can only host static files, so it can't receive form submissions by itself. You need a free/cheap form service that emails you each enquiry (for example **Formspree**, **Web3Forms** or **Basin**).

1. Sign up with one and create a form. It gives you an **endpoint URL**.
2. In `index.html`, replace `https://form-endpoint-not-set.invalid/` in the form's `action="…"` with that URL.
3. Send yourself a test enquiry, including a photo.

**Check the plan limits before you commit.** Many services restrict or charge for **file uploads**. The form allows up to 5 photos at 5 MB each; if your service allows less, change `MAX_FILES` / `MAX_BYTES` at the top of the form section in `assets/js/main.js` and the hint text in `index.html`.

Until an endpoint is set, the form still checks what people type, but it tells them clearly **"your enquiry has NOT been sent, please call 07702 782875"** rather than pretending it worked.

## Adding real gallery photos

1. Put photos in `assets/img/gallery/` (create the folder). JPG or WebP, about 1200px wide, ideally under 300 KB each.
2. In `index.html`, in the Gallery section, replace each grey `<div class="ph">…</div>` (and its `PLACEHOLDER` tag) with:
   ```html
   <img src="assets/img/gallery/kitchen-1.jpg" width="1200" height="900" loading="lazy"
        alt="Fitted kitchen with grey units in Nantwich">
   ```
   Describe each photo in the `alt` text. It helps accessibility and search.
3. Update the caption under it, and delete the "Real photos … are on their way" line.

## Logos

| File | Use |
|---|---|
| `assets/logo/logo-main.svg` / `.png` | The main logo, **identical artwork to your PDF** |
| `assets/logo/logo-main-reversed.svg` | Same, with the black turned white, for dark backgrounds |
| `assets/logo/logo-stacked.svg` / `.png` | The smaller stacked logo for **invoices** (PNG has a white background; `-transparent.png` has none) |
| `assets/icons/favicon.svg`, `favicon-*.png`, `apple-touch-icon.png` | Browser tab / phone home-screen icons (the house + U mark) |

The PDF's text was already converted to outlines, so the lettering is the **real letter shapes**, not a look-alike font. The stacked logo reuses those exact shapes. One note: the PDF has no standalone black "U" (its U is the striped graphic in the house), so the stacked logo's "U" is drawn to match the PDF's cap height and stroke weight. Also, the old small logo wrote "Solutions" in mixed case; the PDF only has spaced capitals, so the new one uses **S O L U T I O N S**.

To regenerate after any change: `npm run logos` (needs `pdftocairo` from poppler, Python 3, and Playwright).

## Colours

| Name | Hex | Where from |
|---|---|---|
| Ink (black) | `#231f20` | logo |
| Orange | `#f36020` | logo |
| Slate blue/grey | `#738a99` | logo |
| Deep blue | `#254c71` | logo |

Darker/lighter shades are defined in `assets/css/styles.css` and tuned so all text meets WCAG AA contrast (the tests check this).

## Tests and screenshots

```bash
npm install                      # once; installs Playwright (tests only, not part of the site)
npx playwright install chromium  # once; downloads the test browser
npm test                         # 48 checks (site + hover/press/reduced-motion)
npm run screenshots              # phone/tablet/desktop pictures into tests/screenshots/
node tests/interaction-screenshots.cjs   # rest vs hover vs pressed pictures
```

The tests cover: noindex, click-to-call links, no horizontal scrolling from 320px to 1440px, no external requests, page weight, broken links, image alt text, colour contrast, the mobile menu, and the quote form (validation, UK postcodes, photo limits, honest "not connected" message, successful send, server errors).

## Going live

When you're happy with the site:

1. **Delete the `noindex` line** in `index.html` (the `<meta name="robots" …>` tag in the `<head>`, with the big comment above it).
2. Replace all placeholders (email, photos, form endpoint).
3. Add a short **privacy notice** page or section. The quote form collects personal details, so UK GDPR expects one. Also check whether you want your business name/address or company number in the footer.
4. Add a **canonical URL**, social share tags and `LocalBusiness` structured data once the final address is known.
5. Add the site to **Google Business Profile** and Google Search Console, and submit a sitemap.
6. Don't add a `robots.txt` that blocks everything while you're still on `noindex`; it can stop search engines from ever seeing the noindex tag.

## Hover and press effects

All in the "Interaction polish" block at the end of `assets/css/styles.css`.

- Hover effects only run on devices with a real mouse or trackpad, so phones never get a "stuck" hover after a tap. Touch gets a clean pressed (`:active`) state instead.
- With "reduce motion" switched on in the visitor's device settings, the pulse, lifting, zooming and icon nudge are all turned off. Colour and shadow feedback stays.
- The call-button pulse is one ring every 5 seconds. To remove it, delete the `callPulse` animation line.
