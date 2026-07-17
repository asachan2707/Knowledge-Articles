---
name: dedup-check
description: >
  Run BEFORE adding any new topic. Scores the proposed topic against all 150+
  existing cards for keyword overlap, detects duplicates (≥50% → mandatory merge),
  flags differentiation needs (30-49%), and verifies cluster size before creating
  a new file.
triggers:
  - before adding a new topic
  - /dedup-check
---

# Dedup Check Skill

Run this skill **before** writing any new topic HTML file or inserting a new topic card in `index.html`. It prevents content duplication, enforces merge rules, and ensures the hub stays navigable.

---

## PHASE 0 — Load Inventory

1. **Read `index.html` in full.** Extract into a working mental index:
   - Every `<h3 class="topic-card-title">` → the card's display title
   - Every `<p class="topic-card-summary">` → the card's summary text
   - Every `data-keywords="…"` attribute → the card's keyword list

2. **Read the first 60 lines of any topic HTML file** whose title closely matches the incoming topic's subject (fuzzy match on the title words — if two or more words overlap, read that file too).

---

## PHASE 1 — Title Similarity Scan

Compare the proposed topic title against **every** existing card title using these heuristics:

| Heuristic | Flag |
|---|---|
| Exact word overlap ≥ 3 words (excluding stop words: the, a, an, in, of, for, to, and, or, with, how, why, what, on, at, by, from, is, are, be) | **HIGH** |
| Same technology + same action verb (e.g., both "Build X", "How to do Y", "Understanding Z") | **MEDIUM** |
| Synonym match from the table below | **MEDIUM** |

### Near-synonym table (check all pairs):
- agent / agentic / agent-based / autonomous
- microservice / service-mesh / micro-service
- kubernetes / k8s / k8 / container orchestration
- cache / redis / in-memory store / memcached
- auth / JWT / OAuth / OpenID / SSO / authentication / authorization
- test / testing / TDD / BDD / unit test / integration test
- typescript / TS / typed javascript
- database / DB / datastore / data store / persistence layer
- API / REST / HTTP / endpoint / web service
- event / event-driven / event sourcing / pub-sub / message queue
- ML / machine learning / AI / LLM / large language model / neural network
- react / next.js / nextjs / frontend framework
- serverless / lambda / cloud function / faas
- GraphQL / gql / query language
- docker / container / containerization / OCI image
- CI/CD / pipeline / continuous integration / continuous deployment / github actions

---

## PHASE 2 — Keyword Overlap Scoring

1. Extract the **top 15 most-distinctive keywords** from the proposed topic's description. Exclude generic words (system, design, use, code, data, the, and, etc.).

2. For each existing card's `data-keywords`, count how many of the 15 proposed keywords appear (case-insensitive, partial stem match allowed — e.g., "cach" matches "cache", "caching", "cached").

3. Compute: **overlap % = (matching keywords / 15) × 100**

4. Apply threshold rules:

   | Overlap % | Rule | Action |
   |---|---|---|
   | **≥ 50%** | **MERGE REQUIRED** | Do NOT create a new file. Open the existing topic HTML and add the new content as additional `<section class="content-card">` blocks. Update the existing index card's `<p class="topic-card-summary">` and `data-keywords` to include the new material. Extend the `data-order` read-time estimate in the card footer. Document the merge in `ENHANCEMENTS.md` under a "Merges Performed" section. |
   | **30–49%** | **DIFFERENTIATE** | Create the new file, but add a "Related" callout box (see template below) at the bottom of **both** the new page and the existing page. |
   | **< 30%** | **CLEAR** | Safe to create as a new standalone topic. |

### Related callout template (used for DIFFERENTIATE):
```html
<section class="content-card">
  <h2>Related Topics</h2>
  <ul>
    <li><a href="./RELATED-TOPIC.html">Related Topic Title</a> — one sentence explaining the connection.</li>
  </ul>
</section>
```

---

## PHASE 3 — Cluster Audit

1. Identify the **sub-cluster** the proposed topic belongs to (e.g., "Python", "microservices patterns", "system design case studies", "frontend CSS", "cloud/DevOps").

2. Count how many existing cards are already in that sub-cluster.

3. Apply cluster rules:

   | Cluster size (existing cards) | Rule |
   |---|---|
   | 0–2 | New standalone is fine |
   | 3+ (and no merged/extended card exists yet) | Consider: can this be folded into an existing card? If yes, extend. If the new topic is substantially different in scope, standalone is still acceptable with justification. |
   | 3+ (and a merged "best-of" card already exists for this cluster) | **Extend the existing merged card** rather than adding another standalone. |

---

## PHASE 4 — Decision Output

Before writing any file, output the following structured verdict:

```
## Dedup Check — [Proposed Topic Title]

### Similarity Scores
| Existing Topic | Matching Keywords | Overlap % | Flag |
|---|---|---|---|
| [Title of closest match] | [list] | [N]% | CLEAR / DIFFERENTIATE / MERGE |
| [Next closest] | [list] | [N]% | CLEAR / DIFFERENTIATE / MERGE |
| ... (include all with overlap > 0) | | | |

### Cluster Context
- Category: [category name]
- Existing count in cluster: N
- Cluster action: [new standalone OK / extend existing merged card: filename.html]

### Verdict
- Action: [CREATE NEW | MERGE INTO: filename.html | EXTEND CLUSTER CARD: filename.html]
- Reason: [1–2 sentences explaining the decision]
- If DIFFERENTIATE: add "Related" callout to both [new-page.html] and [existing-page.html]

### Next Step
[Proceed to add-topic Phase 1-C onward / Stop and merge into filename.html / Stop and extend cluster card filename.html]
```

Do not proceed past Phase 4 without outputting this verdict and confirming the action.

---

## PHASE 5 — Post-Add Cross-Link Injection

After any new topic file is **fully written** and the card is registered in `index.html`:

1. Identify the **top 2 most-related existing topic pages** using the overlap scores from Phase 2 (highest overlap % that did not trigger MERGE).

2. For each of those 2 pages:
   a. Read the file.
   b. Check whether a `<section class="content-card">` containing an `<a href="./NEW-TOPIC.html">` link already exists. If it does, skip (never duplicate a link).
   c. If no such link exists, inject the following block **immediately before the `</main>` closing tag**:

```html
      <section class="content-card">
        <h2>Related Reading</h2>
        <ul>
          <li><a href="./NEW-TOPIC.html">New Topic Title</a> — [one sentence on how it connects].</li>
        </ul>
      </section>
```

3. Only inject if the section does not already exist. Never duplicate a link already present in the file.

---

## Quick Reference — When to Invoke

| Situation | Action |
|---|---|
| User asks to add a new topic (any method) | Run dedup-check FIRST, before any file write |
| User invokes `/add-topic` | dedup-check runs automatically as a pre-step |
| User invokes `/dedup-check [topic name]` | Run this skill directly |
| After a merge or extension | Still run Phase 5 to inject cross-links |
