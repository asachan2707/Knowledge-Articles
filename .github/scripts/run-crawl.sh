#!/bin/bash
# Wrapper: installs deps if missing, runs the crawler, commits + pushes output to main.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$SCRIPT_DIR/crawl.log"
NODE="/opt/homebrew/bin/node"
NPM="/opt/homebrew/bin/npm"
NPX="/opt/homebrew/bin/npx"
GIT="/usr/bin/git"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "===== Crawl run started ====="

# ── 1. Install Node dependencies if missing ───────────────────────────────────
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  log "node_modules not found — running npm install"
  cd "$SCRIPT_DIR"
  "$NPM" install >> "$LOG_FILE" 2>&1
  log "npm install done"
fi

# ── 2. Install Playwright Chromium if missing ─────────────────────────────────
CHROMIUM_MARKER="$SCRIPT_DIR/node_modules/playwright-core/.local-chromium"
if [ ! -d "$CHROMIUM_MARKER" ] && [ ! -d "$HOME/.cache/ms-playwright/chromium"* ] 2>/dev/null; then
  log "Playwright Chromium not found — installing"
  cd "$SCRIPT_DIR"
  "$NPX" playwright install chromium >> "$LOG_FILE" 2>&1
  log "Playwright install done"
fi

# ── 3. Run the crawler ────────────────────────────────────────────────────────
log "Starting crawler (ROOT_URL=${ROOT_URL:-default}, MAX_DEPTH=${MAX_DEPTH:-3}, MAX_PAGES=${MAX_PAGES:-100})"
cd "$SCRIPT_DIR"

if "$NODE" crawl-sf-help.js >> "$LOG_FILE" 2>&1; then
  log "Crawler finished successfully"
else
  log "ERROR: Crawler exited with code $?"
  exit 1
fi

# ── 4. Commit and push to main ────────────────────────────────────────────────
cd "$REPO_ROOT"

"$GIT" add crawled-output/

if "$GIT" diff --staged --quiet; then
  log "No changes detected — nothing to commit"
else
  COMMIT_MSG="chore: update crawled SF Help content ($(date '+%Y-%m-%d'))"
  "$GIT" commit -m "$COMMIT_MSG"
  "$GIT" push origin main
  log "Committed and pushed to main: $COMMIT_MSG"
fi

log "===== Crawl run completed ====="
