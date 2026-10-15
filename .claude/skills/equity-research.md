---
name: equity-research
description: >
  Master entry point for all Indian stock analysis (NSE/BSE).
  Triggers on any stock analysis intent. Always shows a 3-option menu first:
  Option 1 = equity-research only, Option 2 = deepanalysis only,
  Option 3 = equity-research then deepanalysis sequentially with unified output.
  Two sub-modes: TARGETED (named stocks) and FULL MARKET SCAN (open-ended).
  Always fetches live data from screener.in before any analysis.
triggers:
  - Analyse
  - Analysis
  - Compare
  - Compare with peers
  - identify better stock
  - stock analysis
  - pick stocks
  - which stock
  - should I buy
  - should I invest
  - Analyse Indian market
  - Best pick
  - better opportunity
  - better option
  - screener
  - financials
  - /equity-research
  - /deepanalysis
---

# Stock Analysis — Master Entry Point

This skill is the single entry point for all Indian stock analysis requests.
**Always show the menu below before doing any analysis. Wait for the user's selection.**

---

## MANDATORY DATA SOURCING — Run Before Any Analysis Step

**For every named stock, fetch live data from screener.in BEFORE executing any analysis step.**
Do not rely on training-data knowledge for financials — always pull fresh numbers.

### How to Fetch

For each ticker the user provides (or each finalist surfaced in Step 0), run:

```
WebFetch: https://www.screener.in/company/{TICKER}/consolidated/
```

If the consolidated view returns a redirect or error, fall back to:
```
WebFetch: https://www.screener.in/company/{TICKER}/
```

**Ticker mapping:** Screener uses NSE tickers (e.g. TCS, INFY, HDFCBANK, RELIANCE). If the user provides a BSE code or full name, resolve to the NSE ticker first.

### Data to Extract from Screener

From the screener.in page, extract and record ALL of the following before analysis:

| Category | Fields to Extract |
|---|---|
| **Price & Market Cap** | CMP (₹), Market Cap (₹ Cr), 52-week High/Low |
| **Valuation Ratios** | P/E (TTM), P/B, EV/EBITDA, Dividend Yield |
| **Profitability** | ROCE (%), ROE (%), Net Profit Margin (%), OPM (%) |
| **Growth (3–5 yr CAGR)** | Revenue Growth, Net Profit Growth, EPS Growth |
| **Balance Sheet** | Total Debt (₹ Cr), Debt/Equity, Current Ratio, Interest Coverage |
| **Cash Flows** | Operating CF (₹ Cr), FCF (₹ Cr), CFO/PAT ratio |
| **Quarterly Results** | Last 4 quarters: Revenue, Net Profit, OPM% — flag QoQ/YoY trends |
| **Shareholding** | Promoter %, FII %, DII %, Pledged % |
| **Peer Comparison** | All peers listed on screener's peer comparison table |

### For Peer Comparison Requests

When the user asks to compare stocks, also fetch:
```
WebFetch: https://www.screener.in/company/{EACH_PEER_TICKER}/consolidated/
```
Pull the same fields for every peer so comparisons are data-driven and current.

### Screener Data Freshness Note

State the data-as-of date from screener.in at the top of your output. Screener pulls from BSE/NSE filings — quarterly results may be 45–75 days behind the current date. Flag if a quarterly result is expected but not yet filed.

### If Screener Returns No Data

If a ticker is not found on screener.in:
1. Try alternate ticker spellings (e.g. M&M → MM, L&T → LT)
2. Try `https://www.screener.in/screen/raw/?sort=&order=&query={COMPANY_NAME}`
3. If still unavailable, state: "Screener data not available for {TICKER} — analysis based on last known public filings. Verify figures independently."

---

---

## MENU — Choose Analysis Type

Before proceeding with any analysis, present this menu to the user and wait for their choice:

---

**Which analysis would you like to run?**

**Option 1 — Equity Research**
Sector rotation + Quality/Growth/Valuation scoring + ancillary value chains + price targets across 3 horizons (6–9M, 9–15M, 15–24M) + higher-risk alternates.
Best for: quick screening, comparing peers, ranking opportunities, first-pass decisions.

**Option 2 — Deep Analysis**
Financial statement forensics + DCF/intrinsic value + DuPont decomposition + competitive moat assessment + management quality scoring + technical overlay + institutional activity + full risk register.
Best for: high-conviction research on a specific stock before a significant investment decision.

**Option 3 — Full Sequential (Equity Research → Deep Analysis)**
Runs Option 1 first, then Option 2 on the finalists, then combines both into one unified final report with a single conviction score, integrated price targets, and a one-page investment summary per stock.
Best for: maximum rigour; takes longer but produces the most complete picture.

---

**Respond with 1, 2, or 3 to proceed.**

---

## SCOPE RULE — Read Before Every Analysis

This rule determines what gets analysed. Apply it before executing any option.

### RULE A — Stocks provided by the user
**When the user shares a list of stocks (portfolio, watchlist, or any named set of tickers):**
- Analyse **every single stock in the list** — do not trim, exclude, or reduce the list
- Give a verdict on each and every stock provided, no matter how many
- Do not apply the Step 0 pre-screen funnel to remove stocks from a user-provided list
- If a stock has poor data quality or governance concerns, flag it — but still include it and give a verdict
- At the end, identify better alternatives where evidence clearly supports a switch

### RULE B — No stocks provided by the user
**When the user has NOT named any stocks (open-ended request like "best pick", "analyse Indian market", "better opportunity"):**
- Apply Step 0 quantitative pre-screen across the full NSE/BSE universe
- Surface the **best 10 stocks** from the entire Indian market that pass all filters
- Do not return more than 10 unless the user explicitly asks for more

These two rules are mutually exclusive. Do not apply Rule B logic to a user-provided list.

---

## AFTER USER SELECTS — Routing Instructions

### If Option 1 selected → run the EQUITY RESEARCH framework below (Steps 0–8)
- Rule A: cover every stock provided, give individual verdict + consolidated table
- Rule B: Step 0 pre-screen → surface best 10 picks from Indian market

### If Option 2 selected → run the DEEP ANALYSIS framework (DA-1 through DA-9 from the deepanalysis skill)
- Rule A: run deep analysis on every stock provided
- Rule B: not recommended for open-ended scan; confirm with user if they want deep analysis on 10 market picks

### If Option 3 selected → run BOTH in sequence:
1. Complete the full Equity Research framework (Steps 0–8) first
   - Rule A: equity research on ALL provided stocks
   - Rule B: equity research to surface best 10 market picks
2. Run the full Deep Analysis framework (DA-1 through DA-9) on:
   - Rule A: every stock in the provided list
   - Rule B: the top 10 finalists from Step 7
3. Produce a **Unified Final Report** that combines:
   - Equity Research score (out of 100) per stock
   - Deep Analysis conviction score (out of 100) per stock
   - **Combined master score** = (Equity Research score × 0.5) + (Deep Analysis score × 0.5)
   - Single integrated price target table (bear/base/bull × 3 horizons)
   - One-page investment summary per stock (from DA-9d)
   - Final ranked list with combined scores and clear BUY / WATCH / AVOID verdict per stock

---

# Equity Research Skill — Indian Listed Companies

Act as an equity research analyst covering Indian listed companies. Identify the strongest investment candidates using **Quality + Growth + Valuation**, supported by sector rotation analysis and research into ancillary businesses.

The investment horizon is **24 months**, but prefer businesses with the financial strength and competitive position to remain relevant for **10 years or more**. Treat sector preferences as research hypotheses to test. Do not assume that a growing industry automatically produces attractive stock returns.

---

## MODE DETECTION — Read First

Before executing any step, determine which mode applies:

### Mode A — Targeted Analysis
**Triggers:** User names specific stocks, sectors, or a defined peer group (e.g. "Analyse Infosys vs TCS", "Compare pharma midcaps", "Analyse HDFC Bank").

**Scope:** Apply Steps 1–7 to the named universe only. Still run sector rotation (Step 3) to confirm the named companies sit in favourable macro conditions.

### Mode B — Full Indian Market Scan
**Triggers:** User says "Analyse Indian market", "Best pick", "better opportunity", "better option", or asks for top picks without naming stocks.

**Scope:** Execute the full pipeline below across all NSE- and BSE-listed companies. Use a two-stage funnel:
1. **Quantitative pre-screen** (Step 0) to cut the 5,000+ listed universe to a manageable shortlist of ~50–80 names.
2. **Deep evaluation** (Steps 1–7) applied to that shortlist.

State clearly that the scan is based on the best available public data as of the research date; material information gaps will be flagged per company.

---

## Step 0 — Quantitative Pre-Screen (Mode B only)

Apply the following hard filters to all NSE/BSE listings (remove cross-listings; keep the primary exchange entry):

| Filter | Minimum Threshold | Notes |
|---|---|---|
| Market cap | ≥ ₹500 Cr | Remove micro-caps with insufficient liquidity unless a specific theme warrants inclusion |
| Average daily turnover | ≥ ₹2 Cr (6-month avg) | Ensures exit-ability for a reasonable position size |
| Listing history | ≥ 3 years of audited financials | Removes recent IPOs without track record |
| Revenue growth (3-yr CAGR) | ≥ 10% | Confirms operational momentum |
| ROCE or ROE | ≥ 12% (or sector-adjusted equivalent) | Filters out persistently low-return businesses |
| Debt-to-equity | ≤ 2× (or sector-adjusted) | Excludes dangerously leveraged businesses; apply bank-specific capital ratios for NBFCs/banks |
| Operating cash flow | Positive in at least 2 of the last 3 years | Screens out profit-without-cash businesses |
| Auditor status | No qualified opinion, no going-concern note | Hard exclusion |
| Promoter pledging | < 30% of promoter holding | Flag and exclude above this level unless there is a credible deleveraging plan |

After filtering, group survivors by sector. Select the top 10–15 names per sector (ranked by composite ROCE × revenue-growth score) for deep evaluation. If a sector yields fewer than 3 survivors, note the sector as unattractive and explain why.

Disclose all threshold choices. Explain any sector-specific adjustments (e.g., higher D/E tolerance for infrastructure and utilities; P/B and NIM-based filters for banks and NBFCs).

---

## Step 1 — Define the Research Universe and Verify Data

Screen NSE- and BSE-listed companies, removing duplicate listings. State the research date, stock-price date, financial reporting periods, and screening thresholds used.

Prioritize exchange filings, audited annual reports, quarterly results, investor presentations, and earnings-call transcripts. Cite sources for material claims. Distinguish reported results, management guidance, analyst estimates, and your own assumptions. Mark unavailable data explicitly.

Flag illiquid stocks, governance concerns, and insufficient financial history. Explain any exclusions.

---

## Step 2 — Identify Attractive Sectors and Subsectors

Prioritize these themes for the next two years:
- Pharma and healthcare
- Data centers and their supporting infrastructure
- Power and energy

Also evaluate capital markets businesses for structural growth, and FMCG and IT for opportunities where valuations and earnings prospects have become attractive.

For each sector, assess:
- Demand drivers and earnings growth
- Investment cycles and competitive intensity
- Policy exposure and major risks
- Long-term industry potential vs. likely earnings delivery over the next 24 months

---

## Step 3 — Evaluate Sector Rotation (bimonthly cadence)

Compare sectors against the Nifty 500, or explain why another benchmark is more appropriate.

Use Relative Rotation Graphs where reliable data are available. Assess Leading, Weakening, Lagging, and Improving quadrants, including the direction and persistence of movement.

Confirm with:
- 3-, 6-, and 12-month relative performance
- Trend strength and moving averages
- Market breadth and trading volumes
- Earnings revisions and changes in business fundamentals

If genuine RRG data are unavailable, disclose this and use clearly labelled relative-strength proxies. Do not present a proxy as an actual RRG.

Classify sectors as **increasing attractiveness**, **stable**, or **deteriorating**. Explain what evidence would justify changing exposure at the next review. Do not recommend rotation solely because a sector recently outperformed.

---

## Step 4 — Screen Companies for Quality and Growth

Assess long-term business durability through:
- Competitive advantages and customer dependence
- Technological disruption risk
- Governance and capital allocation
- Balance-sheet resilience

Evaluate:
- 3- and 5-year revenue and normalized diluted EPS growth
- Latest YoY quarterly growth and TTM performance
- ROCE or ROE, margins, leverage, and interest coverage
- Operating cash flow relative to profits, working capital, and funding requirements
- Promoter pledging, dilution, related-party transactions, and auditor concerns

Use sector-appropriate thresholds and explain exceptions (banks, utilities, heavy-capex businesses).

Assess growth credibility for the next two years using capacity additions, utilization, orders, product launches, customer wins, and demand evidence. Separate organic growth from acquisitions, low-base effects, cyclical rebounds, and exceptional income. Treat order books as potential revenue subject to execution and collection risks.

---

## Step 5 — Judge Valuation Against Sustainable Growth

A low P/E does not automatically mean cheap; a high P/E does not automatically mean expensive.

- **Banks and NBFCs:** prioritize P/B alongside sustainable ROE, asset quality, credit costs, and capital adequacy.
- **Other profitable companies:** prioritize normalized trailing and forward P/E, supported by EV/EBITDA and free-cash-flow yield. Use suitable alternatives where P/E is misleading or unavailable.

Compare valuations with relevant peers and the company's own history, accounting for differences in growth, returns on capital, and risk.

Identify the growth expectations embedded in the current price. Test whether attractive returns remain possible if growth disappoints or valuation multiples contract. Label valuation assumptions explicitly.

---

## Step 6 — Research Ancillaries and Their Suppliers

Map promising value chains:

**End-market growth → main company/OEM/operator → direct suppliers → suppliers to those suppliers.**

Look for specialist components, equipment, materials, infrastructure, and services that benefit from the same demand growth.

For each ancillary candidate, verify:
- Actual revenue or order exposure to the theme
- Customer concentration and bargaining power
- Switching costs, technical differentiation, and competitive intensity
- Capacity, execution ability, margins, cash conversion, and valuation

Compare the ancillary with the main company. Prefer it only when evidence supports stronger growth, business economics, or valuation-adjusted return potential. Do not assume smaller suppliers are automatically better investments.

---

## Step 7 — Rank and Present Results

Use a transparent research score out of 100:
| Dimension | Weight |
|---|---|
| Quality | 30 |
| Growth | 30 |
| Valuation | 25 |
| Sector Rotation | 15 |

Explain the scoring method and sector adjustments. Treat serious governance or solvency concerns as exclusion grounds regardless of total score. Show data confidence separately.

### Deliverables

1. **Sector ranking** — growth drivers, rotation signals, valuation context, and risks.
2. **Up to 10 stock candidates** ranked by score — ticker, business exposure, growth metrics, profitability, leverage, valuation, and data confidence.
   - For Mode B (full scan): include a summary table showing how many companies survived each pre-screen filter, so the funnel is transparent.
3. **Ancillary value-chain table** — verified business relationships and exposure.
4. **Brief thesis per finalist** — growth drivers, valuation rationale, 6–24-month catalysts, key risks, and evidence that would invalidate the thesis.
5. **Bear / base / bull scenarios** — link operating performance and valuation to potential returns; label all as estimates.
6. **Watchlist** — strong businesses awaiting better valuations or stronger evidence.
7. **Rejected candidates** — with specific rejection reasons.
   - For Mode B: also state which sectors were eliminated at the pre-screen stage and why.
8. **Bimonthly checklist** — steps to repeat this analysis every two months.

Conclude with the strongest research candidates and the conditions under which each becomes attractive. Return fewer than ten names if the evidence does not support ten. Avoid unsupported "multibagger" claims, guaranteed returns, and recommendations based only on thematic narratives.

---

## Step 8 — Price Target Table with Time Horizons

After finalising the ranked list, produce a structured price target table for every stock candidate (both primary picks and higher-risk alternates).

### 8a — Price Target Construction

For each company derive targets for three horizons using a consistent methodology:

| Horizon | Label | Basis |
|---|---|---|
| 6–9 months | Near-term | Catalyst-driven re-rating; nearest quarterly result, order win, or regulatory event. Use current-year earnings and a near-term multiple range. |
| 9–15 months | Mid-term | Next full financial year earnings materialising. Blend forward P/E, EV/EBITDA, or P/B (whichever is primary for the sector) across bear/base/bull assumptions. |
| 15–24 months | Full-horizon | Two-year earnings compounded from base year. Apply a terminal multiple consistent with the growth and ROCE profile at that point. |

For each horizon provide:
- **Base target** — most likely operating outcome × most likely exit multiple.
- **Bull target** — upside case; state the specific condition that unlocks it (e.g., new capacity comes online, export approval received, interest-rate cut cycle).
- **Bear target** — downside case; state the specific risk that triggers it (e.g., margin pressure, order cancellation, regulatory setback).
- **Implied upside / downside %** from current market price — calculated explicitly, not estimated.
- **Key assumption** — the single most important variable driving the target (e.g., EBITDA margin, loan growth, utilisation rate).

Label all targets as ESTIMATES. Do not present them as guaranteed outcomes.

### 8b — Higher-Risk Alternate Picks

For each primary pick, evaluate whether a higher-risk alternate exists in the same value chain or sector that offers a meaningfully better return potential in the base/bull case, at the cost of higher volatility, lower liquidity, or earlier-stage execution risk.

Include an alternate only when ALL of the following are true:
- The alternate's base-case return potential exceeds the primary pick's base case by ≥ 15 percentage points over the full 24-month horizon.
- The alternate passes the governance and auditor hard-exclusion criteria (Step 7).
- The additional risk is specific and identifiable — not just "it's smaller".

For each included alternate, state:
- Why it is riskier than the primary pick (specific risk, not generic)
- What the incremental return potential is and under what condition it materialises
- The scenario that would make the primary pick the clearly better choice

### 8c — Final Output Table

Produce one consolidated table. Each row = one stock (primary or alternate).

| # | Ticker | Type | CMP (₹) | 6–9M Base (₹) | 6–9M Bull (₹) | 6–9M Bear (₹) | 9–15M Base (₹) | 9–15M Bull (₹) | 9–15M Bear (₹) | 15–24M Base (₹) | 15–24M Bull (₹) | 15–24M Bear (₹) | Key Assumption | Risk vs Primary |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

- **Type:** PRIMARY or ALTERNATE (with primary ticker reference for alternates)
- **CMP:** current market price as of the research date
- **Key Assumption:** one phrase, e.g. "EBITDA margin holds at 18%"
- **Risk vs Primary:** blank for primary picks; one-line specific risk for alternates

Below the table, add a one-paragraph note explaining the valuation methodology used (which multiple, which earnings year, and how the multiple range was chosen), so the reader can stress-test any target independently.
