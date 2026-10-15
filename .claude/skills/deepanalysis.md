---
name: deepanalysis
description: >
  Deep-dive fundamental analysis for Indian listed companies (NSE/BSE).
  Goes beyond the equity-research screening framework into granular financial
  statement forensics, DCF/intrinsic value, management quality scoring,
  competitive moat durability, technical overlay, and institutional activity.
  Always run AFTER equity-research when invoked as Option 3.
  Always fetches live data from screener.in before any analysis module.
triggers:
  - /deepanalysis
  - deep analysis
  - deep dive
  - forensic analysis
  - DCF
  - intrinsic value
  - moat analysis
  - management quality
---

# Deep Analysis Skill — Indian Listed Companies

This skill performs granular, evidence-based deep-dive analysis on a named stock or shortlist.
It is designed to run AFTER the equity-research skill (as Option 3) or standalone (Option 2).
When run standalone, first confirm the stock(s) to analyse before proceeding.

---

## MANDATORY DATA SOURCING — Run Before DA-1

**Before executing any DA module, fetch live financial data from screener.in.**
Never use training-data financials for analysis — pull current numbers first.

### Primary Fetch

```
WebFetch: https://www.screener.in/company/{TICKER}/consolidated/
```

Fallback (standalone / non-consolidated companies):
```
WebFetch: https://www.screener.in/company/{TICKER}/
```

**Ticker mapping:** Screener uses NSE tickers. Resolve BSE codes or full company names to NSE tickers before fetching.

### Data to Extract for Deep Analysis

Screener provides multi-year data — extract ALL of the following:

| Module | Fields Required from Screener |
|---|---|
| **DA-1 Forensics** | 5-year P&L (Revenue, EBITDA, PAT, Other Income, EPS), Balance Sheet (Receivables, Inventory, Intangibles, Debt), Cash Flow (OCF, Capex, FCF) — extract all 5 years |
| **DA-2 DCF** | Revenue (5yr history), EBITDA margin (5yr), Capex (5yr), OCF (5yr), Tax rate, D&A, Working capital changes |
| **DA-3 DuPont** | Net Margin (5yr), Asset Turnover (5yr), Equity Multiplier / Leverage (5yr), ROE (5yr) |
| **DA-4 Moat** | OPM trend vs peers, ROCE vs WACC proxy, Revenue from top customers (if disclosed) |
| **DA-5 Management** | Promoter holding trend (8 quarters), Pledging % trend, EPS growth vs guidance, Dividend/buyback history |
| **DA-6 Technical** | CMP, 52-week High/Low, P/E percentile vs own history (derive from screener charts section) |
| **DA-7 Institutional** | FII % (8 quarters), DII % (8 quarters), Promoter % (8 quarters), Pledged % trend |
| **DA-8 Risk** | Debt/Equity, Interest Coverage, Contingent liabilities (read notes section on screener) |

### Screener Annual Reports & Notes Link

Screener also links to annual reports. If granular footnotes are needed (contingent liabilities, related-party transactions, auditor notes), note:
```
Annual Report links available at: https://www.screener.in/company/{TICKER}/consolidated/#annual-reports
```
Instruct the user to open these if the screener page data is insufficient for DA-1 forensics.

### Screener Data Freshness Note

State the data-as-of date from screener.in at the start of DA-1. Flag if the most recent quarter's results have not yet been filed (typically 45–75 days after quarter end).

### If Screener Returns No Data

1. Try alternate NSE ticker spellings
2. Try standalone URL: `https://www.screener.in/company/{TICKER}/`
3. If still unavailable, state: "Screener data unavailable for {TICKER} — proceeding with last known public data. Verify figures independently before any investment decision."

---

---

## DA-1 — Financial Statement Forensics

Go beyond headline numbers. Interrogate the quality of reported earnings.

### Income Statement Quality
- Revenue recognition policy: is revenue booked on dispatch, delivery, or cash receipt?
- Check for channel stuffing signals: revenue accelerating while receivables growing faster
- Other income as % of PBT — flag if > 15% consistently (hides weak core operations)
- Exceptional items: frequency, nature, and whether they recur under different labels
- Normalise EPS: strip out exceptional gains/losses, deferred tax reversals, one-offs

### Balance Sheet Forensics
- **Accruals ratio** = (Net Income − Operating Cash Flow) ÷ Average Total Assets
  - > 5% consistently = earnings quality concern; investigate
- Receivables days trend (DSO): rising DSO in a growing company signals collection risk
- Inventory days: rising with flat/falling margins signals demand weakness or value erosion
- Intangible assets and goodwill: any large increases? Were they acquired or internally generated?
- Contingent liabilities: read the notes — off-balance-sheet risks, guarantees, litigation
- Related-party receivables or loans: flag and quantify

### Cash Flow Quality
- Operating Cash Flow / PAT ratio (OCF conversion): target > 0.8× consistently
- Capex pattern: maintenance vs growth capex distinction (check against depreciation)
- Free Cash Flow (FCF) = OCF − Capex: is the company FCF positive after growth spend?
- Working capital cycle: trend in cash conversion cycle over 5 years
- Dividend and buyback track record vs FCF: is payout funded by operations or debt?

---

## DA-2 — Intrinsic Value Estimation (DCF)

Build a two-stage DCF. Label every assumption explicitly — this is an estimate, not a fact.

### Stage 1 — Explicit Forecast (Years 1–5)
Inputs to justify from evidence (capacity, orders, market share, pricing):
- Revenue growth rate per year
- EBITDA margin trajectory
- D&A as % of revenue
- Capex as % of revenue (maintenance + growth)
- Working capital changes
- Tax rate (effective, not statutory)
- Derive Free Cash Flow to Firm (FCFF) for each year

### Stage 2 — Terminal Value
- Terminal growth rate: cap at India's nominal GDP growth (8–9%) or lower for mature businesses
- Terminal WACC: use sector-appropriate cost of equity (CAPM) + after-tax cost of debt
- Sensitivity table: vary terminal growth ±1% and WACC ±1% — show the full matrix

### Output
- Intrinsic value per share (base case)
- Margin of safety = (Intrinsic Value − CMP) ÷ Intrinsic Value
- Bull / bear intrinsic value using optimistic and pessimistic input sets
- State clearly: DCF is sensitive to terminal assumptions; treat as a range, not a precise number

For banks and NBFCs: replace DCF with **Dividend Discount Model (DDM)** or **Residual Income Model** using sustainable ROE, cost of equity, and long-run growth. Do not use FCFF for banks.

---

## DA-3 — DuPont Decomposition of ROE

Decompose ROE = Net Margin × Asset Turnover × Financial Leverage
Track each component over 5 years.

Identify what is actually driving ROE:
- Improving margins (pricing power, cost control) — sustainable
- Improving asset turnover (better capital efficiency) — sustainable
- Rising leverage (borrowing more) — may be unsustainable; flag if D/E > 2×

Compare decomposition with closest 2–3 peers.
State whether current ROE is likely to sustain, improve, or revert to mean.

---

## DA-4 — Competitive Moat Assessment (Porter + Moat Framework)

### Porter's Five Forces
Rate each force as HIGH / MEDIUM / LOW threat, with one-line evidence:
1. Threat of new entrants
2. Bargaining power of suppliers
3. Bargaining power of buyers
4. Threat of substitutes
5. Rivalry among existing competitors

### Moat Type and Durability
Identify which moat type(s) apply and test their durability:

| Moat Type | Evidence Required | Durability Signal |
|---|---|---|
| Cost advantage | Lowest cost producer data; scale economics | Margin premium over peers sustained 5yr+ |
| Switching costs | Customer retention rates; contract length | Revenue from existing customers vs new |
| Network effects | User/node growth accelerating value | Retention improving as network grows |
| Intangible assets | Brand, patents, regulatory licences | Pricing premium sustained over generics |
| Efficient scale | Niche market; limited room for second player | ROCE > WACC with no new entrants |

Rate overall moat: WIDE / NARROW / NONE — with specific evidence for each claim.

---

## DA-5 — Management Quality Scoring

Score management out of 30 across six dimensions (5 points each):

| Dimension | What to assess |
|---|---|
| Capital allocation | ROCE trend; M&A track record; buybacks vs dilution; dividend policy |
| Guidance credibility | Compare last 3 years of guidance to actual delivery; flag consistent misses |
| Compensation | MD/CEO pay vs PAT growth and peers; ESOPs — dilutive or aligned? |
| Communication | Transparency in earnings calls; honest about risks; no selective disclosure |
| Promoter behaviour | Net buying or selling on exchange; pledging trend; skin in the game |
| Governance structure | Board independence; audit committee quality; related-party discipline |

State the management score with evidence for each dimension. A score < 18/30 is a flag; < 12/30 is near-exclusion unless the business quality is exceptional.

---

## DA-6 — Technical Analysis Overlay

Use as a timing and confirmation tool — not as the primary investment thesis.

Assess:
- **Trend:** Price vs 50DMA and 200DMA. Is the stock in a confirmed uptrend?
- **Relative strength:** Stock vs Nifty 500 and vs sector index — 3/6/12 month
- **Support and resistance levels:** Key price zones to monitor for entry/exit
- **Volume:** Accumulation or distribution pattern on weekly chart
- **Momentum indicators:** RSI (overbought/oversold), MACD crossover direction
- **52-week range position:** Where is CMP relative to 52-week high/low?

State whether the technical picture **confirms, is neutral to, or contradicts** the fundamental thesis.
A poor technical setup does not override a strong fundamental case — but it informs timing.

---

## DA-7 — Institutional and Smart Money Activity

Review latest available shareholding data (check BSE/NSE quarterly filings):
- FII holding trend: increasing, stable, or decreasing over last 4 quarters
- DII (MF + Insurance) holding trend
- Total institutional ownership %
- Any new large institutional entry or exit in the last 2 quarters
- Promoter holding trend: any creeping acquisition or secondary market buying

Flag: if both FII and DII are consistently reducing, investigate why before investing.
Confirm: smart money alignment is a supporting signal, not a primary reason to invest.

---

## DA-8 — Risk Register

Build an explicit, ranked risk register for the stock:

| Rank | Risk | Probability | Impact | Mitigant |
|---|---|---|---|---|
| 1 | [Specific risk] | H/M/L | H/M/L | [What reduces it] |
| 2 | … | | | |

Categories to cover:
- Business risk (competition, disruption, demand)
- Financial risk (leverage, refinancing, interest rate sensitivity)
- Governance risk (promoter behaviour, related parties)
- Regulatory/policy risk (sector-specific)
- Macro risk (INR, commodity input costs, global slowdown)
- Execution risk (capex delays, new business ramp-up)

State the **single biggest risk** that would make you exit the position immediately.

---

## DA-9 — Final Deep Analysis Output

Produce all of the following:

### 9a — Conviction Score (out of 100)

| Dimension | Weight | Score |
|---|---|---|
| Financial statement quality | 20 | /20 |
| Intrinsic value vs CMP | 20 | /20 |
| Competitive moat | 20 | /20 |
| Management quality | 15 | /15 |
| Growth credibility | 15 | /15 |
| Technical + institutional alignment | 10 | /10 |

**Total: /100** — Conviction level: HIGH (≥75) / MEDIUM (55–74) / LOW (<55)

### 9b — Intrinsic Value Summary Table

| Scenario | Key Inputs | Intrinsic Value (₹) | Margin of Safety vs CMP |
|---|---|---|---|
| Bear | [inputs] | ₹X | X% |
| Base | [inputs] | ₹X | X% |
| Bull | [inputs] | ₹X | X% |

### 9c — Price Target Table (three horizons)

| Horizon | Bear (₹) | Base (₹) | Bull (₹) | Trigger |
|---|---|---|---|---|
| 6–9 months | | | | |
| 9–15 months | | | | |
| 15–24 months | | | | |

### 9d — One-Page Investment Summary

- **Business in one line**
- **Moat:** Wide / Narrow / None — evidence
- **Management:** score/30 — one-line verdict
- **Valuation:** CMP vs intrinsic value range
- **Entry price:** at what price does margin of safety become compelling?
- **Exit trigger:** what specific event or price makes you sell?
- **Position sizing suggestion:** High conviction (full position) / Medium (half) / Low (watch only)

All outputs are ESTIMATES based on available data. Verify figures against current filings before acting.
