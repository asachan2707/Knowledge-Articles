const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT_URL   = process.env.ROOT_URL   || 'https://help.salesforce.com/s/articleView?id=ind.admin_life_sciences.htm&type=5';
const MAX_DEPTH  = parseInt(process.env.MAX_DEPTH  || '3', 10);
const MAX_PAGES  = parseInt(process.env.MAX_PAGES  || '100', 10);
const DELAY_MS   = parseInt(process.env.DELAY_MS   || '1500', 10);
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(__dirname, '../../crawled-output');

const SF_HELP_BASE = 'https://help.salesforce.com';

// ── URL Helpers ───────────────────────────────────────────────────────────────
function isSfHelpArticle(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === 'help.salesforce.com' &&
      (u.pathname.startsWith('/s/articleView') || u.pathname.startsWith('/articleView'))
    );
  } catch (_) {
    return false;
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    const id   = u.searchParams.get('id');
    const type = u.searchParams.get('type');
    u.search = '';
    if (id)   u.searchParams.set('id', id);
    if (type) u.searchParams.set('type', type);
    return u.href;
  } catch (_) {
    return url;
  }
}

function urlToFilename(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('id') || 'index';
    return id.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
  } catch (_) {
    return 'unknown_' + Date.now() + '.json';
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Page Scraper ──────────────────────────────────────────────────────────────
async function scrapePage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for Lightning-rendered content
  await page.waitForSelector(
    'article, .slds-article, .helpArticleContent, [data-aura-class*="article"], h1',
    { timeout: 15000 }
  ).catch(() => console.warn('  [warn] Content selector timed out — capturing partial render'));

  await sleep(1000);

  const data = await page.evaluate(() => {
    const title =
      document.querySelector('h1')?.innerText?.trim() ||
      document.querySelector('title')?.innerText?.trim() ||
      '';

    const breadcrumbs = [
      ...document.querySelectorAll(
        'nav[aria-label*="breadcrumb"] a, .slds-breadcrumb a, ol.breadcrumb a'
      )
    ].map(a => ({ text: a.innerText.trim(), href: a.href }));

    const tocLinks = [
      ...document.querySelectorAll(
        '.toc a, .helpTOC a, aside a[href*="articleView"], nav a[href*="articleView"], .leftNav a'
      )
    ].map(a => ({ text: a.innerText.trim(), href: a.href }));

    const articleEl =
      document.querySelector(
        'article, .slds-article, .helpArticleContent, main, #articleContent'
      ) || document.body;

    const bodyLinks = [...articleEl.querySelectorAll('a[href]')].map(a => ({
      text: a.innerText.trim(),
      href: a.href
    }));

    const relatedLinks = [
      ...document.querySelectorAll(
        '.relatedLinks a, .seeAlso a, [class*="related"] a, [class*="Related"] a'
      )
    ].map(a => ({ text: a.innerText.trim(), href: a.href }));

    const headings = [...articleEl.querySelectorAll('h2, h3')].map(h => ({
      level: h.tagName,
      text: h.innerText.trim()
    }));

    const clone = articleEl.cloneNode(true);
    clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
    const bodyText = clone.innerText.replace(/\s+/g, ' ').trim().slice(0, 8000);

    return { title, breadcrumbs, tocLinks, bodyLinks, relatedLinks, headings, bodyText };
  });

  // Merge and dedup all discovered links
  const seen = new Set();
  data.allLinks = [
    ...data.tocLinks,
    ...data.bodyLinks,
    ...data.relatedLinks
  ].filter(l => {
    if (!l.href || seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });

  return data;
}

// ── Main Crawler ──────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const visited  = new Set();
  const queue    = [{ url: normalizeUrl(ROOT_URL), depth: 0 }];
  const allPages = [];

  console.log(`\nStarting crawl`);
  console.log(`  Root    : ${ROOT_URL}`);
  console.log(`  MaxDepth: ${MAX_DEPTH}`);
  console.log(`  MaxPages: ${MAX_PAGES}`);
  console.log(`  Delay   : ${DELAY_MS}ms`);
  console.log(`  Output  : ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US'
  });

  const page = await context.newPage();

  // Block images/fonts/media — speeds up crawl, no content lost
  await page.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  let crawledCount = 0;

  while (queue.length > 0 && crawledCount < MAX_PAGES) {
    const { url, depth } = queue.shift();
    const normalized = normalizeUrl(url);

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    console.log(`[${crawledCount + 1}/${MAX_PAGES}] depth=${depth} ${normalized}`);

    try {
      const data = await scrapePage(page, normalized);

      const record = {
        url: normalized,
        depth,
        title: data.title,
        headings: data.headings,
        breadcrumbs: data.breadcrumbs,
        tocLinks: data.tocLinks,
        relatedLinks: data.relatedLinks,
        bodyText: data.bodyText,
        crawledAt: new Date().toISOString()
      };

      const filename = urlToFilename(normalized);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        JSON.stringify(record, null, 2)
      );

      console.log(`  saved  : ${filename}  ("${data.title}")`);
      allPages.push({ url: normalized, depth, title: data.title, filename });
      crawledCount++;

      if (depth < MAX_DEPTH) {
        let enqueued = 0;
        for (const link of data.allLinks) {
          let childUrl = link.href;
          if (!childUrl.startsWith('http')) {
            childUrl = SF_HELP_BASE + childUrl;
          }
          const childNorm = normalizeUrl(childUrl);
          if (isSfHelpArticle(childNorm) && !visited.has(childNorm)) {
            queue.push({ url: childNorm, depth: depth + 1 });
            enqueued++;
          }
        }
        if (enqueued > 0) console.log(`  queued : +${enqueued} links (queue size: ${queue.length})`);
      }

    } catch (err) {
      console.error(`  error  : ${err.message}`);
      fs.appendFileSync(
        path.join(OUTPUT_DIR, '_errors.log'),
        `${new Date().toISOString()}\t${normalized}\t${err.message}\n`
      );
    }

    await sleep(DELAY_MS);
  }

  await browser.close();

  // ── Write master index ─────────────────────────────────────────────────────
  const index = {
    rootUrl: ROOT_URL,
    totalCrawled: allPages.length,
    maxDepth: MAX_DEPTH,
    generatedAt: new Date().toISOString(),
    pages: allPages
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_index.json'),
    JSON.stringify(index, null, 2)
  );

  // ── Write markdown report ──────────────────────────────────────────────────
  const reportLines = [
    '# Salesforce Help Crawl Report',
    '',
    `| Key | Value |`,
    `|-----|-------|`,
    `| Root URL | ${ROOT_URL} |`,
    `| Total pages | ${allPages.length} |`,
    `| Max depth | ${MAX_DEPTH} |`,
    `| Generated | ${new Date().toISOString()} |`,
    '',
    '## Pages by Depth',
    ''
  ];

  const byDepth = {};
  for (const p of allPages) {
    (byDepth[p.depth] = byDepth[p.depth] || []).push(p);
  }

  for (const d of Object.keys(byDepth).sort()) {
    reportLines.push(`### Depth ${d}`);
    reportLines.push('');
    for (const p of byDepth[d]) {
      reportLines.push(`- [${p.title || p.url}](${p.url})`);
    }
    reportLines.push('');
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, '_report.md'), reportLines.join('\n'));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Crawl complete: ${allPages.length} pages saved to ${OUTPUT_DIR}/`);
  console.log(`  Index  : ${path.join(OUTPUT_DIR, '_index.json')}`);
  console.log(`  Report : ${path.join(OUTPUT_DIR, '_report.md')}`);
  if (fs.existsSync(path.join(OUTPUT_DIR, '_errors.log'))) {
    console.log(`  Errors : ${path.join(OUTPUT_DIR, '_errors.log')}`);
  }
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
