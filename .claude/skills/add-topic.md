---
name: add-topic
description: >
  Run before and after adding any new topic to the Learning Hub.
  Pre-run: audits existing topics for duplicates, gaps, and merge candidates.
  Post-run: assigns order numbers, registers the new card in index.html, and
  validates hub consistency (category chips, stats, keyword coverage).
triggers:
  - before adding a new topic
  - after adding a new topic
  - /add-topic
---

# Add-Topic Skill — Learning Hub

You are the **topic curator** for this Learning Hub. This skill fires **before** and **after** any new topic is
added. Follow every phase in order; do not skip steps.

---

## PHASE 0 — Orientation (always run first)

1. Read `index.html` fully to understand the current card inventory.
2. Read `topics/getting-started.html` to recall the canonical page template.
3. Identify the **next available order number** by counting existing `data-order` attributes (or the total card
   count + 1 if no `data-order` attributes exist yet).
4. List every existing `data-categories` value so you know the live category taxonomy.

---

## PHASE 1 — Pre-Add Audit (run BEFORE writing any new file)

### 1-A  Duplicate / Near-Duplicate Detection

Search `index.html` keywords and titles for the incoming topic's subject.  
**Rule:** if a card already covers ≥ 60 % of the new topic's content, do NOT create a separate file — instead
**merge** the new content into the existing HTML page and update its card in `index.html`.

### 1-B  Merge Candidates

Look for two or more existing cards that share a tight conceptual cluster (e.g., "retry strategies" +
"circuit breaker" + "timeouts" are all fault-tolerance primitives).  
Merge them into a single richer page when:
- combined read time would be ≤ 25 min, AND
- they share ≥ 2 category tags, AND
- reading them separately would leave a reader with an incomplete mental model.

When merging:
- Keep the most specific file name.
- Redirect the old URL by adding a `<meta http-equiv="refresh">` stub file so no links break.
- Update `index.html` to remove the old cards and add/update the merged card.

### 1-C  "Quick-Read" Category Tagging

If the new (or merged) topic page would be **≤ 8 min** and covers a single tight concept, tag it with the
special category `quick-read` in addition to its normal categories.  
Quick-read cards get the badge `<span class="badge quick-read">Quick Read</span>`.

### 1-D  JavaScript Example Requirement

Every concept topic **must** include at least one JavaScript (ES2022+) code example that demonstrates the idea
concretely.  
- Use `async/await`, `Map`, `Set`, `WeakRef`, `structuredClone`, or modern Node.js APIs where they fit.
- Label the code block with a `<span class="code-label">JavaScript Example</span>` element.
- The example must be runnable (no pseudo-code, no `/* ... */` stubs).

---

## PHASE 2 — Content Quality (applies to every new or merged page)

### 2-A  Source Research

Before writing content, fetch at least **2 high-quality sources** on the topic:
- Prefer: MDN, official docs, engineering blogs (Cloudflare, AWS, Stripe, Notion, Linear), Wikipedia, research
  papers, or the existing `topics/` pages for internal cross-links.
- Summarise key insights in your own words; never paste verbatim.

### 2-B  Page Template

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
  <p class="lead">Central insight paragraph.</p>
  <div class="callout"><p><strong>Core idea:</strong> …</p></div>
</section>

<section class="story-card">
  <!-- Real-world scenario anchoring the concept -->
</section>

<!-- Concept breakdown sections (content-card) -->

<!-- JavaScript Example section (content-card) with <pre><code> blocks -->

<!-- Practical checklist section -->

<!-- FAQ section -->

<section class="content-card takeaways">
  <h2>Key Takeaway</h2>
  <p>One paragraph the reader can carry in their head a year later.</p>
</section>
```

### 2-C  Read-Time Estimate

Count words (rough: 200 words ≈ 1 min read). Set the read time in:
- The hero kicker: `Category · Concept N · X min`
- The `index.html` card footer: `<span class="topic-card-meta">X min</span>`
- The card's `data-duration` attribute (if the hub uses one).

---

## PHASE 3 — index.html Card Registration (run AFTER the HTML file is written)

Add or update the topic card block in `index.html` using this exact shape:

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
- `data-order` = sequential integer, gap-free, assigned by total existing count + 1 per new card.
- `data-relevance` = 5 for flagship/comprehensive topics, 4 for solid standalone, 3 for quick-reads.
- `data-keywords` must include: topic name, all major sub-concepts, tools mentioned, and at least 3 synonyms a
  reader might search for.
- Insert the new card at the **top** of the grid (newest first) unless the topic is part of a series, in which
  case insert it adjacent to its siblings.

---

## PHASE 4 — Post-Add Validation

After writing the file and updating `index.html`, verify:

1. **Category chip parity** — every `data-categories` value used by any card must have a matching chip in the
   `#category-chips` container. If a new category was introduced, add the chip HTML.

2. **Stat accuracy** — the `#stat-topics`, `#stat-categories` counters in `index.html` are computed dynamically
   by the JS at the bottom; confirm the JS reads from the live DOM (no hardcoded values to update manually).

3. **Back-link correctness** — the `<a class="back-link">` in the new HTML file points to the right parent
   (`../index.html` for top-level topics, `../system-design-concepts.html` for system-design sub-topics, etc.).

4. **No orphan pages** — every `.html` file in `topics/` must have a corresponding card in `index.html`. Run:
   ```bash
   # check for unlinked topic files
   find topics -name "*.html" | while read f; do
     rel="${f#topics/}";
     grep -q "$rel" index.html || echo "ORPHAN: $f";
   done
   ```

5. **Keyword completeness** — search the new card's `data-keywords` for the topic name itself, at least one
   tool name, and at least one "what problem does this solve" phrase.

---

## PHASE 5 — Summary Report

After completing all phases, output a structured report:

```
## Add-Topic Run Report

### Pre-Add Audit
- Duplicates found: [none | list]
- Merge performed: [none | old-file → new-file]
- Quick-read flag applied: [yes/no]

### New Topic
- File: topics/FILENAME.html
- Title: …
- Categories: …
- Order #: NNN
- Read time: X min
- JS example: ✓

### index.html Changes
- Cards added: N
- Cards removed (merged): N
- New categories introduced: [list or none]

### Validation
- Category chips: ✓ / ✗ (details)
- Orphan check: ✓ / ✗ (details)
- Keyword completeness: ✓ / ✗ (details)
```

---

## Quick Reference — Category Taxonomy

Use only these category slugs (add new ones sparingly and document them here):

| Slug | Badge label | Colour class |
|---|---|---|
| `ai` | AI | `ai` |
| `claude-code` | Claude Code | `claude-code` |
| `agents` | Agents | `agents` |
| `python` | Python | `python` |
| `javascript` | JavaScript | `javascript` |
| `react` | React | `react` |
| `system-design` | System Design | `system-design` |
| `engineering` | Engineering | `engineering` |
| `architecture` | Architecture | `architecture` |
| `backend` | Backend | `backend` |
| `frontend` | Frontend | `frontend` |
| `devops` | DevOps | `devops` |
| `cloud` | Cloud | `cloud` |
| `data-engineering` | Data | `python` |
| `mcp` | MCP | `mcp` |
| `rag` | RAG | `ai` |
| `local-llm` | Local LLM | `ai` |
| `career` | Career | `career` |
| `productivity` | Productivity | `productivity` |
| `tools` | Tools | `tools` |
| `finance` | Finance | `finance` |
| `interview` | Interview | `interview` |
| `certification` | Certification | `interview` |
| `security` | Security | `tools` |
| `fundamentals` | Fundamentals | `fundamentals` |
| `patterns` | Patterns | `tools` |
| `web` | Web | `web` |
| `html` | HTML | `web` |
| `learning` | Learning | `meta` |
| `books` | Books | `meta` |
| `health` | Health | `meta` |
| `meta` | Meta | `meta` |
| `project` | Project | `project` |
| `slack` | Slack | `tools` |
| `quick-read` | Quick Read | `productivity` |
