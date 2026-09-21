# RxNPV — Full Feature Overview

## What this is

RxNPV is a free, standalone macOS desktop app for valuing pre-revenue and early-commercial biotech companies. It's built for an individual retail biotech investor working from public information only — not an institutional analyst with a Bloomberg terminal, not a fund with paid data feeds. Every data source it uses is free and public (SEC EDGAR, ClinicalTrials.gov, openFDA). There's no cloud component, no account, no subscription — it's a local app that runs entirely on one person's machine.

The core purpose is bottoms-up, probability-of-success-risk-adjusted DCF valuation (rNPV) for biotech assets that don't have current revenue to build a traditional model from. Around that core, it's grown into a broader toolkit: a reference library of sourced industry benchmarks, a set of standalone analyst tools (comps, runway, sensitivity), and — most recently — a simulation suite for the statistical/scientific side of biotech investing (trial-outcome probability, PK/PD, cheminformatics).

We're looking for feedback on the feature set itself — what's missing, what's underdeveloped, what would be genuinely useful to add — from other models' perspectives. Context on what's already been deliberately considered and left out is at the bottom, so suggestions can focus on real gaps rather than re-covering already-settled ground.

---

## 1. Workspace — the core valuation engine

A **Case** represents one company. A Case contains one or more **Programs**, where a Program is one drug/indication pair — a multi-asset biotech is modeled as one Case with several Programs inside it.

### Revenue modeling — two modes per program
- **Quick mode**: enter a single peak revenue estimate directly, plus years-to-peak. Fast, useful for a rough screen.
- **Detailed/Full mode**: genuine bottoms-up build — addressable population → diagnosis rate → treatment rate → eligible share → market share (with order-of-entry logic) → launch curve (years to peak share) → US and ex-US pricing (with separate growth rates) → loss-of-exclusivity timing and post-LOE volume/price erosion.

### Risk and cost inputs
- **Probability of success**: benchmarked by trial phase and therapeutic area, with an override field for a specific reason to deviate (a validated biomarker, a concerning readout, etc.).
- **Priority Review Voucher (PRV)** modeling: optional, risk-adjusted by the program's own PoS, with a benchmarked market value.
- **Cost structure**: COGS, sales force sizing, and marketing spend, all benchmarked by modality/indication with override capability.
- **R&D-to-launch**: remaining time and cost benchmarked by phase/area, overridable.

### Valuation methods — two, switchable per case
- **Full DCF (default)**: the complete bottoms-up build above, PoS-risk-adjusted, discounted to a bottoms-up rNPV.
- **Simple Multiple**: peak revenue × a comparable-transaction multiple, still PoS-risked and discounted the same way, but skipping cost-structure modeling entirely. Faster, cruder, meant as a cross-check against the full DCF rather than a replacement.

### Scenario and capital structure
- **Bear / Base / Bull** scenarios, each an override multiplier on revenue%, PoS%, and discount-rate-add relative to Base, adjustable per case.
- **Terminal value**: optional, either an exit-multiple-at-peak-revenue or a perpetuity growth rate.
- **Capital structure**: simple (cash, debt, diluted share count) or detailed, with options/warrants handled via the treasury-stock method and convertible debt via the if-converted method.
- **Future capital raise** scenario modeling: "if we raise $X at $Y/share, what happens to per-share value" — a simple, explicit overlay, not a timed/discounted financing model.

### Outputs
- Bear/Base/Bull fair value per share, each with its own enterprise value.
- **Enterprise Value → Equity Value → Per-Share bridge**: EV, plus risk-adjusted PRV value if any, plus cash, minus debt, divided by diluted shares.
- **Sum-of-the-Parts** (multi-program cases, DCF mode): each program's standalone value plus a shared corporate G&A drag, reconciling exactly to the combined total.
- **Implied PoS**: solves backward from the current market price — what probability of success would the price require, given the modeled assumptions. A built-in sanity check against the market's own apparent view.
- **Risk waterfall**: unrisked value (if success were certain) vs. risk-adjusted value, both at the single-asset level and, for multi-program cases, at the whole-pipeline level.

---

## 2. Reference Sheet — sourced benchmarks and a live comps database

Eight tabs. Seven are benchmark documentation — every number the valuation engine uses by default (PoS by phase/area, COGS, SG&A, sales-force cost, R&D cost/timeline, discount rate guidance, launch curves, exclusivity/LOE erosion) is shown with its methodological source and reasoning, not just presented as a magic number. The eighth tab is a database of 63 real biotech M&A deals (2016 through 2026, no year gaps), 21 of which have verified acquisition-premium data, with scatter-chart visualization and support for adding your own custom deals that flow into every chart and export alongside the built-in ones.

---

## 3. Tools — standalone analyst utilities

Seven tools, none of which write back into a case's core valuation automatically (a few have an explicit "export this number to a case" button, but nothing happens silently):

- **M&A Premium** — the 63-deal comps database as a deal-value-vs-premium scatter plot.
- **Company Lookup** — pulls a company's SEC filings (via EDGAR) and its clinical trial landscape / competitor trials (via ClinicalTrials.gov) for a given ticker or drug.
- **Diluted Market Cap** — a treasury-method/if-converted-method fully-diluted share count calculator, independent of any specific case.
- **Cash Runway** — two modes: trailing (computed from a company's actual reported EDGAR financials) and forward-looking (modeled from a case's own R&D cost timeline, deliberately unrisked since it's answering "how long does the cash last," not "what's it worth").
- **Peak Sales Comps** — 37 real drugs spanning $44M to $29.5B in actual peak sales (deliberately including real commercial underperformers, not just blockbusters, for an honest comp set), with a bar chart that positions your own case's asset(s) at their correct value rank rather than pinning them to the bottom regardless of size. Supports custom entries.
- **Catalyst Calendar** — pulls upcoming/recent regulatory and trial events for a company via EDGAR full-text search and ClinicalTrials.gov, including whether a trial has posted results.
- **Sensitivity** — a tornado chart (ranking which single assumption swings fair value the most) and a two-way grid (peak revenue × PoS, every combination at once), both correctly aware of whether the case uses DCF or Simple Multiple valuation.

---

## 4. Simulation — biostatistics, PK/PD, and cheminformatics

The newest addition, built as a genuinely separate simulation sandbox rather than folding weak statistical shortcuts into the core valuation tool. The reasoning: a well-reasoned probability or peak-sales distribution has to come from real methodology, not from just re-packaging a single point estimate as a spread. These tools are standalone — they don't feed into a case's Quick/Detailed revenue modes automatically, the same way most of the Tools tab doesn't either.

- **Trial Outcome / PoS (Bayesian assurance Monte Carlo)** — draws a true treatment effect from an uncertainty prior, simulates a trial replicate under that effect, runs the actual statistical test, repeats thousands of times, and reports the share of replicates that would read out positive. Covers binary (response rate), continuous (mean change), and time-to-event (hazard ratio, log-rank) endpoints.
- **Peak Sales Monte Carlo** — propagates uncertainty through population → diagnosis rate → treatment rate → peak market share → price, with each input settable as a fixed value or a distribution (uniform, normal, triangular). Reports a driver-sensitivity ranking (correlation between each varying input and the output) showing what's actually driving the range, not just the range itself.
- **PK/PD forward simulation** — one-compartment IV/oral concentration-time modeling plus an Emax dose-response curve. Deliberately a forward projection from parameters you supply (from a label or a paper), not population-PK model fitting, which needs patient-level data this tool doesn't have access to.
- **Cheminformatics** — wraps RDKit (the standard open-source cheminformatics toolkit, running fully locally via WebAssembly, no network call). Molecular descriptors, Lipinski Rule-of-Five and Veber drug-likeness screens, Tanimoto structural similarity between two compounds, 2D structure rendering from a SMILES string.
- **Historical Comps** — live ClinicalTrials.gov query for trials matching a condition/phase/intervention, showing the status distribution, typical duration, and enrollment landscape. Explicitly labeled as not a win rate — CT.gov doesn't expose one.
- **FDA Lookup** — live openFDA query pulling a drug's approval history, label summary (boxed warnings surfaced specifically), and FAERS adverse-event report volume.

---

## 5. Cross-cutting

- **PDF export** of a case's valuation summary (scenario cards, EV bridge, SOTP, Implied PoS, revenue/cash-flow charts), with three optional appendices — a Sensitivity tornado chart, the Peak Sales positioning chart, and the forward-looking Cash Runway chart — toggled on per-case from the relevant tool, computed from the exact same functions the live tools use rather than a separately-maintained copy.
- **CSV export** for both comps databases.
- **Dark/light theme**, applied consistently across every view including Simulation.

---

## What's been deliberately left out, and why

Worth knowing before suggesting these — they've been considered and specifically declined, not overlooked:

- **No FDA Orange Book integration.** The API basis identified for this rests on a field structure that credible independent sources don't corroborate actually exists.
- **No AACT bulk clinical-trials database.** ClinicalTrials.gov's own live API is used instead since it's genuinely free and live; AACT would need a separate bulk-download/ETL pipeline to use well.
- **No ADMET/toxicity ML predictions.** The tool identified for this (ADMETlab) has no official public API — only a reverse-engineered endpoint pattern found via an unrelated third-party project. Building against a guessed schema was judged worse than leaving the gap open.
- **No population-PK model fitting.** That needs patient-level data and is genuinely the territory of professional tools (NONMEM, nlmixr2, mrgsolve) — forward simulation from published parameters is what's realistic here.
- **Simulation tools don't auto-feed into case valuation.** Deliberately standalone, matching how most of Tools already works — a PoS distribution from the Trial Outcome simulator doesn't silently overwrite a case's PoS override; the user carries the number over themselves if they want to use it.
- **No investment recommendations or "should I buy this" outputs anywhere.** The whole tool is built around methodology transparency (every benchmark sourced, every override requiring a stated reason) rather than a black-box verdict.

---

## What kind of feedback is useful here

Feature ideas, methodology gaps, things that feel underdeveloped relative to the rest, or entire capabilities a biotech-focused retail investor would reasonably expect that aren't here at all. Practical constraints worth keeping in mind: free/public data sources only, no paid APIs or subscriptions, runs as a local desktop app with no server-side component.
