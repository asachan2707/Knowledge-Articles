---
name: add-topic
description: >
  Run before and after adding any new topic to the Learning Hub.
  Pre-run: audits existing topics for duplicates, gaps, and merge candidates.
  Post-run: assigns order numbers, registers the new card in index.html, and
  validates hub consistency (category chips, stats, keyword coverage, graph sync).
triggers:
  - before adding a new topic
  - after adding a new topic
  - /add-topic
---

# Add-Topic Skill — Learning Hub

You are the **topic curator** for this Learning Hub. This skill fires **before** and **after** any new topic is added. Follow every phase in order; do not skip steps.

> **PREREQUISITE:** Run `/dedup-check` before Phase 1. If the verdict is MERGE or EXTEND, follow those instructions and stop — **unless the user has explicitly stated that this topic should NOT be merged** (e.g. "don't merge this", "keep this separate"), in which case proceed to create a new standalone page regardless of overlap score.

---

## GLOBAL RULES (apply to every phase)

1. **No permission prompts needed** — all local file edits and all external web fetches are pre-approved for this session.
2. **Category-first batching** — when multiple topics are requested, group them by category first and build all topics in the same category together before moving to the next category. This keeps related content consistent and cross-linked.
3. **Voice & depth** — write every topic page as a **senior architect** would explain it: opinionated, precise, grounded in real production constraints, including low-level design facts (data structures, time/space complexity, wire formats, failure modes, scaling knees). Avoid surface-level summaries.
4. **Code examples:**
   - Preferred language: **JavaScript (ES2022+)** — use `async/await`, `Map`, `Set`, `structuredClone`, `WeakRef`, `Proxy`, modern Node.js APIs.
   - If the topic is inherently Python-centric (ML, data science, scripting): use **Python 3.11+**.
   - For other tech stacks (Go, Rust, SQL, Java, Bash): use the canonical idiomatic style for that stack.
   - Every code block must be **runnable** (no pseudo-code, no `/* ... */` stubs). Label each with `<span class="code-label">JavaScript Example</span>` (or the appropriate language).
5. **No-merge override** — if the user explicitly states a topic should NOT be merged with an existing one, honour that instruction for those specific topics even if keyword overlap ≥ 50 %.

---

## PHASE 0 — Orientation (always run first)

1. Read `index.html` fully to understand the current card inventory.
2. Read `topics/getting-started.html` to recall the canonical page template.
3. Identify the **next available order number** (highest existing `data-order` value + 1).
4. List every active `data-categories` value so you know the live category taxonomy.
5. **Category batching plan** — if building multiple topics, list them grouped by category and confirm the build order before writing any files.

---

## PHASE 1 — Pre-Add Audit (run BEFORE writing any new file)

### 1-A  Duplicate / Near-Duplicate Detection

Search `index.html` keywords and titles for the incoming topic's subject.
**Rule:** if a card already covers ≥ 60 % of the new topic's content, do NOT create a separate file — **merge** the new content into the existing HTML page and update its card, **unless the user has explicitly opted out of merging for this specific topic**.

### 1-B  Merge Candidates

Look for two or more existing cards that share a tight conceptual cluster (e.g., "retry strategies" + "circuit breaker" + "timeouts").
Merge them when:
- combined read time would be ≤ 25 min, AND
- they share ≥ 2 category tags, AND
- reading them separately would leave a reader with an incomplete mental model.

When merging:
- Keep the most specific file name.
- Redirect the old URL with a `<meta http-equiv="refresh">` stub so no links break.
- Update `index.html` to remove old cards and add/update the merged card.

### 1-C  "Quick-Read" Category Tagging

If the new (or merged) topic page would be **≤ 8 min** and covers a single tight concept, tag it `quick-read` in addition to its normal categories. Quick-read cards get `<span class="badge quick-read">Quick Read</span>`.

### 1-D  Code Example Requirement

Every concept topic **must** include at least one code example (see Global Rules §4 for language choice). The example must be runnable — no placeholders.

---

## PHASE 2 — Content Quality

### 2-A  Source Research

Before writing, fetch at least **2 high-quality sources**:
- Prefer: official docs, MDN, engineering blogs (Cloudflare, AWS, Stripe, Netflix, Uber, Linear, Notion), Wikipedia, research papers, or existing `topics/` pages for cross-links.
- Summarise insights in your own words; never paste verbatim.
- For every important claim, include the real-world production context (e.g. "Netflix uses this pattern to survive regional failures").

### 2-B  Senior Architect Depth Requirements

Every topic page must include:
- **Why this exists** — the production problem it solves, not just what it is.
- **Low-level design facts** — internal data structures, wire formats, time/space complexity, memory layout, or protocol details relevant to the concept.
- **Failure modes** — what breaks, under what conditions, and why.
- **Scaling constraints** — where the design starts to hurt and what the typical mitigation is.
- **Production gotchas** — counterintuitive behaviour a senior engineer would know but a junior would not.
- **At least one runnable code example** (see Global Rules §4).
- **Real-world examples** — name the actual companies or systems that use this.

### 2-C  Page Template

Every topic HTML file must follow this structure (mirror `topics/getting-started.html`):

```
<header class="page-header">
  <a class="back-link" …>← Back to …</a>
  <figure class="article-hero"> … </figure>
  <h1>Title</h1>
  <p class="summary">2–3 sentence summary.</p>
  <div class="article-meta"> … </div>
</header>

<section class="content-card">
  <p class="lead">Central insight paragraph — written as a senior architect would frame it.</p>
  <div class="callout"><p><strong>Core idea:</strong> …</p></div>
</section>

<section class="story-card">
  <!-- Real production scenario anchoring the concept — name a real company/system -->
</section>

<!-- Concept breakdown sections (content-card) — include low-level design facts -->

<!-- Code example section (content-card) with <pre><code> blocks, labelled -->

<!-- Failure modes section -->

<!-- Scaling & production gotchas section -->

<!-- Practical checklist section -->

<!-- FAQ section -->

<section class="content-card takeaways">
  <h2>Key Takeaway</h2>
  <p>One paragraph a senior engineer can carry in their head a year later.</p>
</section>
```

### 2-D  Read-Time Estimate

Count words (200 words ≈ 1 min). Set read time in:
- The hero kicker
- The `index.html` card footer: `<span class="topic-card-meta">X min</span>`
- The card's `data-duration` attribute

---

## PHASE 3 — index.html Card Registration (run AFTER the HTML file is written)

Add or update the topic card in `index.html` using this exact shape:

```html
<a class="topic-card" href="./topics/FILENAME.html"
   data-categories="CAT1 CAT2"
   data-keywords="keyword1 keyword2 …"
   data-added="YYYY-MM-DD"
   data-order="NNN"
   data-relevance="4">
  <div class="topic-card-badges">
    <span class="badge CAT1">CAT1 Label</span>
    <!-- add quick-read badge if ≤ 8 min -->
  </div>
  <h3 class="topic-card-title">Full Title</h3>
  <p class="topic-card-summary">2–3 sentence summary matching the page summary.</p>
  <div class="topic-card-footer">
    <span class="topic-card-source">Source · Domain</span>
    <span class="topic-card-meta">X min</span>
  </div>
</a>
```

Rules:
- `data-order` = highest existing + 1, gap-free.
- `data-relevance` = 5 for flagship/comprehensive, 4 for solid standalone, 3 for quick-reads.
- `data-keywords` must include: topic name, all major sub-concepts, tools mentioned, and ≥ 3 synonyms.
- Insert at the **top** of the grid (newest first) unless part of a series → insert adjacent to siblings.

---

## PHASE 4 — Graph Registration (run AFTER index.html is updated)

Open `graph.html` and append a matching entry to the `var TOPICS = [...]` array (around line 268):

```js
{ id:'SLUG', title:'Full Title', cats:['cat1','cat2'], href:'./topics/FILENAME.html' },
```

Rules:
- `id` = kebab-case slug, unique, derived from the filename.
- `cats` must use the **same slugs** as `data-categories` on the index card.
- If a `cats` entry is not yet in `CAT_META` (around line 403), add it:
  ```js
  'slug': { label: 'Label', color: '#hexcode' },
  ```
  Use a colour from the palette table in the Quick Reference section below.

**Acceptance:** `graph.html` stat chip shows the same topic count as the index stats bar after your addition.

---

## PHASE 5 — Post-Add Validation

After writing the file and updating `index.html` and `graph.html`, verify:

1. **Category chip parity** — every `data-categories` value used by any card must have a matching chip in the `#category-chips` container in `index.html`. If a new category was introduced, add the chip HTML.

2. **Stat accuracy** — `#stat-topics`, `#stat-categories` in `index.html` are computed dynamically by JS — no manual update needed, but confirm the JS reads from the live DOM.

3. **Back-link correctness** — `<a class="back-link">` points to `../index.html` for top-level topics; `../system-design-concepts.html` for system-design sub-topics.

4. **No orphan pages** — every `.html` file in `topics/` must have a card in `index.html`. Run:
   ```bash
   find topics -name "*.html" | while read f; do
     rel="${f#topics/}";
     grep -q "$rel" index.html || echo "ORPHAN: $f";
   done
   ```

5. **Graph sync** — confirm the new entry was added to `graph.html` TOPICS array and that its `cats` slugs are all present in `CAT_META`.

6. **Keyword completeness** — `data-keywords` contains the topic name, ≥ 1 tool name, and ≥ 1 "what problem does this solve" phrase.

7. **read-state.js present** — every new topic HTML must include:
   ```html
   <script src="../read-state.js" defer></script>
   ```
   in `<head>`, immediately after `styles.css` and before `highlight.js`.

---

## PHASE 6 — Category-Batch Cross-Linking

When building multiple topics in the same category in one run:
1. After all files in a batch are written, inject "Related Topics" callout sections between them.
2. Each page in the batch should link to the other pages in the same batch (if they cover related sub-concepts).
3. Use the template:
   ```html
   <section class="content-card">
     <h2>Related Topics</h2>
     <ul>
       <li><a href="./RELATED.html">Related Title</a> — one sentence on the connection.</li>
     </ul>
   </section>
   ```

---

## PHASE 7 — Summary Report

```
## Add-Topic Run Report

### Pre-Add Audit
- Duplicates found: [none | list]
- Merge performed: [none | old-file → new-file]
- No-merge override applied: [yes/no — topic name]
- Quick-read flag applied: [yes/no]
- Category batch order: [list]

### New Topics (per category group)
#### [Category Name]
- File: topics/FILENAME.html
- Title: …
- Categories: …
- Order #: NNN
- Read time: X min
- Code example language: JS / Python / other
- Architect depth: ✓ (LLD facts, failure modes, scaling constraints included)

### index.html Changes
- Cards added: N
- Cards removed (merged): N
- New categories introduced: [list or none]

### Graph Changes
- Entries added to graph.html TOPICS: N
- New CAT_META entries: [list or none]
- graph.html topic count now: NNN (should match index count)

### Validation
- Category chips: ✓ / ✗ (details)
- Orphan check: ✓ / ✗ (details)
- Graph sync: ✓ / ✗ (details)
- read-state.js present: ✓ / ✗ (details)
- Keyword completeness: ✓ / ✗ (details)
```

---

## Quick Reference — Category Taxonomy & Graph Colours

Use only these category slugs (add new ones sparingly and document them here):

| Slug | Badge label | Graph colour |
|---|---|---|
| `ai` | AI | `#7c3aed` |
| `claude-code` | Claude Code | `#a21caf` |
| `agents` | Agents | `#ea580c` |
| `mcp` | MCP | `#0891b2` |
| `python` | Python | `#0369a1` |
| `javascript` | JavaScript | `#b45309` |
| `react` | React | `#0891b2` |
| `system-design` | System Design | `#c2410c` |
| `engineering` | Engineering | `#15803d` |
| `architecture` | Architecture | `#b91c1c` |
| `backend` | Backend | `#0f766e` |
| `frontend` | Frontend | `#7c3aed` |
| `devops` | DevOps | `#475569` |
| `cloud` | Cloud | `#0284c7` |
| `data-engineering` | Data | `#0d9488` |
| `rag` | RAG | `#dc2626` |
| `local-llm` | Local LLM | `#0284c7` |
| `patterns` | Patterns | `#7e22ce` |
| `fundamentals` | Fundamentals | `#92400e` |
| `career` | Career | `#16a34a` |
| `productivity` | Productivity | `#be185d` |
| `tools` | Tools | `#4338ca` |
| `finance` | Finance | `#b45309` |
| `interview` | Interview | `#7e22ce` |
| `certification` | Certification | `#16a34a` |
| `security` | Security | `#dc2626` |
| `web` | Web | `#1d4ed8` |
| `html` | HTML | `#d97706` |
| `learning` | Learning | `#6d28d9` |
| `books` | Books | `#4338ca` |
| `health` | Health | `#059669` |
| `meta` | Meta | `#059669` |
| `project` | Project | `#475569` |
| `slack` | Slack | `#5b21b6` |
| `quick-read` | Quick Read | `#be185d` |
| `portfolio` | Portfolio | `#475569` |
| `architect` | Architect | `#b91c1c` |
