# RxNPV Field Reference

## Purpose

This is a companion reference, attached alongside `BiotechAgent.md` whenever a research task's output is meant to be typed directly into RxNPV. It does not replace or loosen any requirement in `BiotechAgent.md` — every rule there (citation, Fact/Inference/Speculation, source hierarchy, red-team review) still applies in full. This file exists only to describe RxNPV's data model precisely enough that research output arrives in a form that is immediately usable, not generically correct.

This file is stable and does not change per assignment. It should never require editing for a specific ticker, asset, or research task — case-specific instructions belong in the request template, not here.

## How RxNPV Is Structured

A **Case** is one company. A Case contains one or more **Programs**, where a Program is one drug/indication pair. Some fields belong to the Program (asset-specific: this drug, this indication, this trial); others belong to the Case (company-wide: cash, share count, discount rate). A multi-asset company has one Case with several Programs inside it.

RxNPV computes a bottoms-up, PoS-weighted rNPV (the same formula and double-counting discipline `BiotechAgent.md` Section 9 specifies), producing Bear/Base/Bull fair values per share.

## Critical: Read the Unit Convention Before Reporting Any Number

RxNPV's input boxes do not all use the same unit convention, and this is the single most likely place a correct research finding turns into a wrong number in the model. For every numeric field below, this document states exactly what to type into that specific box. Report findings in that convention, explicitly, every time — e.g., "Peak US revenue estimate: **$850M**" rather than a bare "850" or "$850,000,000," so there is no ambiguity when it's transcribed.

The three conventions in use:

- **Millions-denominated** — type the number of millions (e.g., type `500` for $500M). Used for: peak revenue, cash, debt, PRV value.
- **Raw whole number** — type the actual count (e.g., type `100000000` for 100 million shares). Used for: diluted shares outstanding.
- **Raw dollars per share** — type the actual price (e.g., type `12.50`). Used for: current price.

Percentages are always typed as whole numbers 0–100 (e.g., `65` for 65%), not decimals.

## Section 1 — Program-Level Fields (one entry per asset)

### 1.1 Identity and Classification
- **Drug name, indication, therapeutic area** — plain text, as commonly referred to.
- **Modality** — `smallMolecule` or `biologic`. This drives which COGS/exclusivity benchmarks apply internally; when uncertain, describe the modality specifically (ADC, cell therapy, gene therapy, RNA, peptide) rather than guessing which of the two bins it falls into — that classification call belongs to whoever enters it.
- **Current phase** — one of: discovery/preclinical, phase1, phase2, phase3, filed, approved. Use the trial's actual current stage per its registry record, not the sponsor's forward-looking guidance about where it will be.

### 1.2 Probability of Success Override
- **Field:** PoS override, typed as a whole-number percentage 0–100, or left blank to use RxNPV's own phase/area benchmark.
- **What justifies a value here:** This is the field most directly answered by `BiotechAgent.md` Section 5 (clinical design, data, and statistics) and Section 6 (operations, safety, endpoints). A justified override needs a specific reason the asset's odds differ from its area's typical benchmark — e.g., a validated predictive biomarker, an unusually strong or weak interim readout, a trial design/operational red flag, a modality with a track record atypical for its class. State the number as a range with reasoning, not a bare point estimate, and flag it clearly as Inference (per `BiotechAgent.md`'s labeling requirement) since it is your judgment applied to RxNPV's benchmark, not a directly sourced fact.
- Do not report this as a percentage of something else (response rate, hazard ratio) — it must be your own considered probability of ultimate approval/launch.

### 1.3 Priority Review Voucher (PRV)
- **Enabled:** yes/no — is this program plausibly eligible for a Rare Pediatric Disease or Tropical Disease PRV.
- **PRV value:** millions-denominated (e.g., `150` for $150M). Report the current realistic secondary-market trading range if known, rather than a historical high; PRV values have moved substantially over time.
- This maps to `BiotechAgent.md` Section 7 (regulatory designations) — note explicitly that a designation is not a guarantee of eventual approval or voucher award.

### 1.4 Launch Timing
- **Field:** years from today until launch, as a whole number, or left blank to use RxNPV's own phase-duration benchmark.
- Only override this with a specific reason (a disclosed company timeline, a known regulatory filing date, an unusual trial completion date) — cite the source of the date directly.

### 1.5 Revenue — Quick Mode
Used when a single peak revenue estimate is enough (fast, less granular).
- **Peak revenue:** millions-denominated (e.g., `2000` for $2B peak).
- **Years to peak:** whole number of years from launch to peak sales.
- What justifies a number here draws on `BiotechAgent.md` Section 2 (population funnel: prevalence → diagnosed → treated → reachable → payer-approved) crossed with pricing precedent from comparable approved drugs in the same or an adjacent indication. State the buildup even in Quick mode — "$X patients × $Y annual price × Z% peak share" — so whoever enters it can sanity-check the arithmetic, even though only the final number gets typed in.

### 1.6 Revenue — Detailed/Full Mode
Used for a genuine bottoms-up build. Report each of these separately if researching this mode specifically:
- **Population:** prevalence or incidence (raw patient count, not a rate), disease duration in years if incidence-based, diagnosis rate %, treatment rate %, eligible % (share of treated patients who fit the drug's actual label/eligibility criteria).
- **Adherence %** — whole-number percentage.
- **Market share:** number of competing drugs expected at peak, this drug's order of entry (1st, 2nd, etc.), and an optional peak-share override % if a benchmark based on order-of-entry alone would be misleading for a specific competitive situation.
- **Launch curve:** years from launch to peak share.
- **Pricing:** US annual price per patient (raw dollars, e.g., `180000`), **which price basis that number is on** (ASP / WAC / AWP / Retail — the model converts to ASP using Table 4-1 before multiplying by patients), an optional net price realisation % that overrides that conversion with your own gross-to-net, annual price growth %, whether to include ex-US revenue, ex-US price as a % of US price, ex-US patient-count multiplier relative to US. The basis defaults to ASP with no adjustment, so a price supplied without a basis is treated as already net.
- **Exclusivity:** years from launch to loss of exclusivity, and — if known — expected volume-retained % and price-decline % after generic/biosimilar entry.
- This section draws heavily on `BiotechAgent.md` Section 2 (population funnel and natural history) and Section 8 (competition, market access, pricing precedent, payer evidence threshold).

### 1.7 Cost Structure
- **COGS %** of revenue, or blank to use RxNPV's own modality-based benchmark.
- **Sales force:** rep counts by channel (primary care, specialty, hospital), or blank for the benchmark.
- **Marketing spend** as a % of peak revenue, or blank for the benchmark.
- Only override with a specific, sourced reason (a disclosed commercial infrastructure plan, a genuinely atypical distribution model).

### 1.8 R&D-to-Launch Override
- **Total years and total cost** (millions-denominated) remaining to launch, or blank to use RxNPV's own phase/area-cost benchmark.
- Only override with a disclosed company guidance figure or a specific reason the standard benchmark doesn't fit (unusual trial size, an atypical regulatory path).

## Section 2 — Case-Level Fields (whole company)

- **Name, ticker** — plain text.
- **Current price** — raw dollars per share, e.g., `12.50`. State the date/time the price was captured, per `BiotechAgent.md`'s data-cutoff requirement.
- **Corporate G&A:** pre-commercial annual spend (millions-denominated), and the % of a "mature SG&A" benchmark attributable to G&A specifically (as opposed to sales & marketing, which is modeled separately per-program) — 50% is RxNPV's own default split, override only with a specific reason.
- **Discount rate:** whole-number percentage. This is compatible with PoS-weighting already applied elsewhere in the model — per `BiotechAgent.md`'s own double-counting warning, do not derive this from a market-based WACC that already implicitly prices in failure risk.
- **Terminal value:** whether enabled, and if so the exit multiple (a peak-revenue multiple, e.g., `3` for 3x) or a perpetuity growth rate — only relevant if researching a specific comp-based multiple for the asset's therapeutic class.
- **Capital structure:** cash and debt (millions-denominated), diluted shares outstanding (raw whole number, e.g., `100000000`). If reporting a fully diluted figure that accounts for options/warrants/converts, state that explicitly and cite the source filing and its date — dilutive instruments change quickly.
- **Bear/Bull scenario overrides:** optional case-specific multipliers on revenue %, PoS %, and discount rate add, relative to Base — only relevant if a specific reason exists to widen or narrow RxNPV's default Bear/Bull spread for this company.
- **Valuation method:** RxNPV supports two modes — a full bottoms-up DCF (the default, everything above), or a faster Simple Multiple mode (peak revenue × a comp multiple, still PoS-risked and discounted, but skipping cost structure entirely). If a case uses Simple Multiple mode, the relevant research target is a defensible peak-revenue multiple for the asset's therapeutic class and stage — typically drawn from recent M&A or trading comps — reported per scenario (Bear/Base/Bull) if there's a specific reason it should differ by scenario; RxNPV's own default holds the multiple constant across all three unless overridden.

## Section 3 — What RxNPV Produces

Useful context if asked to sanity-check or build on an already-computed case, not something to research independently:

- **Bear / Base / Bull fair value per share**, each with its own enterprise value.
- **Enterprise Value → Equity Value → Per-Share bridge**: EV, plus PRV (if any, PoS-weighted), plus cash, minus debt, divided by diluted shares.
- **Sum-of-the-Parts** (multi-program cases only, DCF mode only): each program's standalone value plus a shared corporate G&A drag, reconciling to the same total as the combined valuation.
- **Implied PoS** (DCF mode only): solved backward from the current price — what probability of success the market's price requires, given the modeled revenue and cost assumptions. Useful as a sanity check against your own PoS override: if the market's implied PoS is far outside what the clinical evidence supports, that gap is itself a research finding worth stating.

Simple Multiple mode produces Bear/Base/Bull fair value and the EV bridge, but not Sum-of-the-Parts or Implied PoS — if reviewing a case in that mode, their absence is expected, not a missing piece.

## Section 4 — Quick Field-to-Diligence-Domain Map

| RxNPV field | Primary `BiotechAgent.md` section(s) |
|---|---|
| PoS override | Section 5 (clinical data/statistics), Section 6 (operations, safety, endpoints) |
| Population/funnel, pricing, market share | Section 2 (disease biology, natural history), Section 8 (competition, market access) |
| PRV enabled / value | Section 7 (regulatory designations) |
| Launch timing, R&D cost/timeline override | Section 5 (trial design/timeline), Section 9 (capital to catalyst) |
| Cash, debt, diluted shares | Section 9 (capital structure and valuation) |
| Exclusivity/LOE timing | Section 7 (IP, patent expiry, exclusivity) |
| Current price | Data-cutoff requirement (top of `BiotechAgent.md`) |
