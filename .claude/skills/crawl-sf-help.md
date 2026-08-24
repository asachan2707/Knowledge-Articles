---
name: crawl-sf-help
description: Manually trigger the Salesforce Help crawler. Crawls the target site using Playwright, saves JSON artifacts to crawled-output/, then commits and pushes to main.
---

# /crawl-sf-help

Trigger a manual crawl of Salesforce Help documentation and push the results to the repo.

## Invocation syntax

```
/crawl-sf-help [url=<SF Help URL>] [depth=<1-5>] [pages=<number>] [delay=<ms>]
```

All parameters are optional. Defaults:
- `url`   → `https://help.salesforce.com/s/articleView?id=ind.admin_life_sciences.htm&type=5`
- `depth` → `3`
- `pages` → `100`
- `delay` → `1500`

## Steps to follow

### 1. Parse arguments

Read the user's invocation line. Extract any of the four named parameters if provided.
If a parameter is missing, use its default value listed above.
Confirm the resolved values back to the user before proceeding.

### 2. Check prerequisites

Run:
```bash
ls /Users/asachan/Documents/ABhinav/Knowledge-Articles/.github/scripts/node_modules 2>/dev/null && echo "deps_ok" || echo "deps_missing"
```

If `deps_missing`, run:
```bash
cd /Users/asachan/Documents/ABhinav/Knowledge-Articles/.github/scripts && /opt/homebrew/bin/npm install
```

Then check for Playwright Chromium:
```bash
ls "$HOME/.cache/ms-playwright" 2>/dev/null || ls /Users/asachan/Documents/ABhinav/Knowledge-Articles/.github/scripts/node_modules/playwright-core/.local-chromium 2>/dev/null && echo "chromium_ok" || echo "chromium_missing"
```

If `chromium_missing`, run:
```bash
cd /Users/asachan/Documents/ABhinav/Knowledge-Articles/.github/scripts && /opt/homebrew/bin/npx playwright install chromium
```

### 3. Run the crawler

```bash
cd /Users/asachan/Documents/ABhinav/Knowledge-Articles/.github/scripts && \
ROOT_URL="<resolved url>" \
MAX_DEPTH="<resolved depth>" \
MAX_PAGES="<resolved pages>" \
DELAY_MS="<resolved delay>" \
OUTPUT_DIR="../../crawled-output" \
/opt/homebrew/bin/node crawl-sf-help.js
```

Substitute the resolved parameter values from Step 1.
Stream output to the user as it runs.

### 4. Summarise results

After the crawler finishes, read the index file:
```bash
cat /Users/asachan/Documents/ABhinav/Knowledge-Articles/crawled-output/_index.json
```

Report to the user:
- Total pages crawled
- Pages per depth level
- Any errors encountered
- Output directory location

### 5. Commit and push to main

```bash
cd /Users/asachan/Documents/ABhinav/Knowledge-Articles
git add crawled-output/
git diff --staged --quiet && echo "no_changes" || (
  git commit -m "chore: manual crawl update ($(date '+%Y-%m-%d'))" &&
  git push origin main &&
  echo "pushed_ok"
)
```

If `no_changes` → tell the user no new content was found since the last crawl.
If `pushed_ok` → confirm the commit message and that it was pushed to main.
If git or push fails → show the error and stop; do not retry silently.

### 6. Final report

Give the user a one-paragraph summary:
- How many pages were crawled
- Whether changes were committed and pushed (or if there were no new changes)
- Where to find the artifacts locally (`crawled-output/`) and in the repo
