/**
 * ingest.js — Fetch external help pages listed in manifest.yaml and save
 * rendered HTML snapshots to agent/sources/.
 *
 * Usage:
 *   node ingest.js             # fetch all sources in manifest.yaml
 *   node ingest.js --force     # re-fetch even if snapshot already exists
 *
 * Pre-requisite (run once):
 *   npx playwright install chromium
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { chromium } = require('playwright');

const MANIFEST_PATH = path.join(__dirname, 'manifest.yaml');
const SOURCES_DIR   = path.join(__dirname, 'sources');
const FORCE         = process.argv.includes('--force');

async function ingest() {
  const manifest = yaml.load(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const sources  = manifest.sources || [];

  if (!sources.length) {
    console.log('[ingest] No sources defined in manifest.yaml');
    return;
  }

  fs.mkdirSync(SOURCES_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
  });

  let saved = 0, skipped = 0, failed = 0;

  for (const source of sources) {
    const filePath = path.join(SOURCES_DIR, `${source.slug}.html`);

    if (!FORCE && fs.existsSync(filePath)) {
      console.log(`[ingest] Skipping (cached): ${source.slug}`);
      skipped++;
      continue;
    }

    console.log(`[ingest] Fetching: ${source.url}`);
    const page = await context.newPage();
    try {
      await page.goto(source.url, { waitUntil: 'networkidle', timeout: 45000 });

      // Give JS-heavy pages a moment to settle
      await page.waitForTimeout(3000);

      // Inject a <title> the server can use as the article name
      await page.evaluate((name) => {
        const t = document.querySelector('title');
        if (t) t.textContent = name;
        else {
          const newT = document.createElement('title');
          newT.textContent = name;
          document.head.appendChild(newT);
        }
      }, source.name);

      const html = await page.content();
      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`[ingest] Saved: ${source.slug}.html (${Math.round(html.length / 1024)} KB)`);
      saved++;
    } catch (err) {
      console.error(`[ingest] FAILED ${source.slug}: ${err.message}`);
      failed++;
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\n[ingest] Done — saved: ${saved}, skipped: ${skipped}, failed: ${failed}`);
  if (failed) process.exit(1);
}

ingest().catch(err => {
  console.error('[ingest] Fatal:', err.message);
  process.exit(1);
});
