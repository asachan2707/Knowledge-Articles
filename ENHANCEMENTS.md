# Learning Hub — Enhancement Backlog

Gaps and issues found during the July 2026 project review.
Work these top-to-bottom; each item is self-contained.

---

## 1 · Graph sync — 32 topics missing from `graph.html`

**What:** `index.html` has 151 topic cards; `graph.html`'s `TOPICS` array has only 119 entries.
The 3 most recent additions (order 150–152) are missing, plus ~29 older cards that were added
to the index without a matching graph entry.

**Fix:**
1. Open `graph.html` and find the `var TOPICS = [...]` array (around line 240).
2. For every card in `index.html` that has no matching `{ id: ... }` entry in the graph array,
   add a new entry following the existing pattern:
   ```js
   { id:'paytm-qr',   title:'Paytm QR Code Architecture',              cats:['system-design','architecture','backend'], href:'./topics/paytm-qr-architecture.html' },
   { id:'css-offset', title:'CSS offset-path — Motion Along Any Path',  cats:['frontend','css','quick-read'],            href:'./topics/css-offset-path-motion.html' },
   { id:'sf-mcp-apex',title:'Build Hosted MCP Tools in Apex for Agents',cats:['agents','mcp','backend'],                 href:'./topics/salesforce-hosted-mcp-apex-agents.html' },
   ```
3. Verify the total count matches `index.html` after the addition.

**Acceptance:** `graph.html` stat chip shows the same topic count as the index stats bar.

---

## 2 · Graph `CAT_META` missing categories

**What:** 22 category slugs appear on index cards but have no colour/label entry in `graph.html`'s
`CAT_META` object. Nodes for those topics render in fallback grey (`#94a3b8`) and the category
hub node is never created, so those topics float disconnected.

Missing slugs (from index cards, not yet in `CAT_META`):
`backend`, `frontend`, `css`, `javascript`, `react`, `rag`, `devops`, `engineering`,
`quick-read`, `cloud`, `patterns`, `fundamentals`, `architect`, `certification`,
`course`, `books`, `health`, `html`, `learning`, `portfolio`, `claude`, `quick-reads`

**Fix:** In `graph.html`, extend the `var CAT_META = { ... }` block (around line 403) with
entries for each missing slug. Suggested colours:

| Slug | Label | Color |
|---|---|---|
| `backend` | Backend | `#0f766e` |
| `frontend` | Frontend | `#7c3aed` |
| `css` | CSS | `#1d4ed8` |
| `javascript` | JavaScript | `#b45309` |
| `react` | React | `#0891b2` |
| `rag` | RAG | `#dc2626` |
| `devops` | DevOps | `#475569` |
| `engineering` | Engineering | `#15803d` |
| `quick-read` | Quick Read | `#be185d` |
| `cloud` | Cloud | `#0284c7` |
| `patterns` | Patterns | `#7e22ce` |
| `fundamentals` | Fundamentals | `#92400e` |
| `architect` | Architect | `#b91c1c` |
| `certification` | Certification | `#16a34a` |
| `course` | Course | `#ea580c` |
| `books` | Books | `#4338ca` |
| `health` | Health | `#059669` |
| `html` | HTML | `#d97706` |
| `learning` | Learning | `#6d28d9` |
| `portfolio` | Portfolio | `#475569` |
| `claude` | Claude | `#a21caf` |
| `quick-reads` | Quick Reads | `#be185d` |

**Note:** `quick-reads` and `quick-read` are two slugs for the same concept — normalise all
cards to `quick-read` and drop `quick-reads` from `CAT_META` after fixing the cards.

**Acceptance:** No nodes in the force graph render grey; every category has a hub node.

---

## 3 · Six topic pages missing `read-state.js`

**What:** 6 HTML files under `topics/` don't include `read-state.js`, so those pages never show
the "Mark as read / Mark as unread" button and reads aren't tracked.

**Fix:** Find the 6 files (run `grep -rL "read-state.js" topics/*.html`) and add the script tag
in each `<head>`, immediately after `styles.css` and before `highlight.js`:

```html
<script src="../read-state.js" defer></script>
```

**Acceptance:** Every topic page shows the read-toggle button; `grep -rL "read-state.js" topics/*.html` returns nothing.

---

## 4 · `quick-read` / `quick-reads` slug duplication

**What:** Two variants of the same concept are used as category slugs:
- `quick-read` (used correctly by newer cards, referenced in `CATEGORY_LABELS` in `index.html`)
- `quick-reads` (older typo, appears on some cards)

This means "Quick Read" shows as two separate filter options in the sidebar.

**Fix:**
1. In `index.html`, find all cards using `data-categories="... quick-reads ..."` and replace `quick-reads` with `quick-read`.
2. If `quick-reads` appears in `CATEGORY_LABELS` or `CATEGORY_GROUPS`, remove it.
3. Remove `quick-reads` from `CAT_META` in `graph.html` once cards are normalised.

**Acceptance:** Sidebar shows exactly one "Quick Read" filter; no card uses `quick-reads`.

---

## 5 · Chat widget agent URL is hardcoded to `localhost`

**What:** `chat-widget.js` line 14 defaults `AGENT_URL` to `http://localhost:3030`. If the hub is
ever served from a real host the widget silently fails (CORS + mixed-content errors).

**Fix:** Add a `<meta>` tag convention so the host page can configure the URL without a global
variable. In `chat-widget.js`, extend the URL resolution:

```js
var AGENT_URL = (
  window.AGENT_URL ||
  (document.querySelector('meta[name="agent-url"]') || {}).content ||
  'http://localhost:3030'
).replace(/\/$/, '');
```

Then on any hosted deployment, the page just needs:
```html
<meta name="agent-url" content="https://your-agent-host.example.com">
```

**Acceptance:** Setting `<meta name="agent-url">` overrides `localhost`; no code changes needed at deploy time.

---

## 6 · `graph.html` node count drifts silently from `index.html`

**What:** There is no automated check to keep the two files in sync. Every new topic added to
`index.html` must be manually mirrored in `graph.html`, and the drift currently stands at 32.

**Fix (lightweight):** Add a console warning in `graph.html` that compares `TOPICS.length`
against the stat value scraped from the index at runtime. Since both are on the same origin,
you can fetch `index.html` and count `topic-card` elements, then `console.warn` if the counts
differ. Alternatively, add a note to the `/add-topic` skill checklist requiring a graph entry
for every new card.

**Recommended short-term fix:** Extend the `/add-topic` skill in `.claude/skills/add-topic.md`
to include a step:

> **PHASE 4 — Graph registration**
> After writing the index card, open `graph.html` and append a matching `{ id, title, cats, href }` entry to the `TOPICS` array. The `cats` array must use the same slugs as `data-categories` on the index card.

**Acceptance:** The `/add-topic` skill checklist includes a graph-registration step; future topics are always added to both files.

---

## Priority Order

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Fix 6 pages missing `read-state.js` | Low (add 6 script tags) | High — broken core feature |
| 2 | Normalise `quick-read` / `quick-reads` slug | Low (find-replace) | Medium — duplicate filter |
| 3 | Add missing `CAT_META` entries to graph | Medium | High — grey/disconnected nodes |
| 4 | Sync 32 missing topics into graph | Medium | High — graph is incomplete |
| 5 | Update `/add-topic` skill to require graph entry | Low | High — prevents future drift |
| 6 | Chat widget agent URL via `<meta>` tag | Low | Low (local-only for now) |
