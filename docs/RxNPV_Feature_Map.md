# RxNPV — Feature Map

**Purpose of this document: stop re-litigating scope.** It is the decided inventory of what this app has, what it will have, and what it deliberately will not have. If a future session (or the user) asks "do we have / do we need feature X?", the answer should be in here. If it isn't, add it here as part of deciding.

Status key: **BUILT** · **DECIDED — build** · **DECIDED — no** · **OPEN — needs a call**

Governing scope line, unchanged: *good enough to help a retail biotech investor improve their analyses. Doesn't need to be institutional grade, doesn't need every conceivable feature.* Second principle, added September 2026: **not every feature has to connect to the valuation.** A tool that helps someone understand the science or the trial earns its place on its own.

Organising principle, added September 2026: **fewer tabs, each a workbench.** A workbench holds several related tools that can be used separately or together, rather than one tab per function. The Trial Statistics tab is the existing model for this.

---

## 1. Trial workbench — one NCT in, everything about that trial

The intended flow: decode the design → watch it for changes → read the result when it lands → compare it against what has been posted before.

| Tool | Status | Notes |
|---|---|---|
| Trial Decoder | **BUILT** | Design in plain English, can/cannot prove, design red flags |
| Trial change watch (snapshot/diff) | **BUILT** | Diffs 13 fields, each ranked by what the change means (Phase 19) |
| Analog effect-size board | **BUILT** | Posted effect sizes in an indication, with honest denominators |
| Comparable-trial landscape | **BUILT** | Status/duration/enrolment rollup |
| **Results reader** | **BUILT** | Outcomes, participant flow and adverse events, inside the decoder. See below |
| **Richer change classification** | **BUILT** | Eligibility, arms, masking, allocation, why-stopped; high / medium / routine |
| **Thin-win detector** | **BUILT** | Place any number in the posted distribution — works before a readout and after it |
| **Multi-trial program view** | **BUILT** | Every NCT for one asset, by phase, with stopped trials and their reasons (Phase 22) |

### Results reader — built (Phase 17)

When a readout lands — the single most important moment for an investor — the app used to offer a hyperlink. `ctgovEngine.js` deliberately did not parse `resultsSection`, and that was the right call when the extraction machinery didn't exist. It does now (the analog board reads the same schema). Engine: `src/trialResults.js`. Full account in the tracker, Phase 17.

Three panels, one fetch:
- **Outcomes** — what the primary actually returned, with CI and p-value. Reuses the analog extractor.
- **Participant flow** — completion and dropout by arm. **Differential dropout is a red flag the decoder structurally cannot see before results exist.**
- **Adverse events** — for an *investigational* drug this is the only real safety data there is. FAERS has no denominator; labels only exist post-approval. The app currently has no honest safety view for anything unapproved.

Folded into the Trial Decoder rather than given its own tab: same input, and it makes the before/after framing explicit.

---

## 2. Statistics workbench (existing "Trial Statistics" + Simulation)

Already the model for how a workbench should work. Mature.

| Tool | Status |
|---|---|
| Fragility Index · Sample Size/Power · P↔CI · Single-Arm CI · 2×2 Outcome · Non-Inferiority · Multiplicity | **BUILT** |
| Trial Outcome / PoS assurance (with survival curves) | **BUILT** |
| Phase 2→3 Translator | **BUILT** |
| Meta-Analysis (fixed/random, forest plot) | **BUILT** |
| Peak Sales Monte Carlo | **BUILT** |
| PK/PD + receptor occupancy | **BUILT** |
| **Control-arm / dropout stress** | **BUILT** | Under every Sample Size/Power result. Forces a choice between a constant-absolute and a constant-relative effect model, because they disagree materially (Phase 23) |

### Survival-model refinements (external review by Grok, October 2026)

Grok's case: the assurance simulator's time-to-event model (exponential survival, proportional hazards, log-rank, Schoenfeld) "flatters the readout", so add Weibull or piecewise hazards, a delayed effect, dropout as its own clock, and the distribution of observed effects. Checked against the code and the statistics, item by item:

| Item | Status | Why |
|---|---|---|
| Distribution of the observed effect | **BUILT · bug fixed** | Already there (the assurance histogram); Grok said the loop "collapses to a hit rate", which is wrong. But for time-to-event its "observed HR" was O1/E1, biased toward 1 (~0.84 for a true 0.70), so the histogram sat right of its own marker. Now the log-rank estimate (O1/E1)/(O2/E2); 2026-10-04. |
| Weibull / piecewise baseline hazard | **DECIDED — no** | Under proportional hazards, log-rank power depends on the number of events and the HR, not on the baseline curve's shape (Schoenfeld). A different shape changes only *when* events arrive, which a user can already vary through the control median and follow-up. It would not change the PoS the way the review claims. |
| Delayed separation (non-proportional hazards) | **BUILT** (October product pass, Batch 4: `design.delayMonths`, a piecewise hazard, with the Schoenfeld figure captioned; decided on the user: "if we are likely to come across these situations, we should just build now") | The one item that really can make the PoS optimistic: when curves separate late (typical of immuno-oncology), log-rank loses power and Schoenfeld overstates it. Worth building — one "effect starts at month X" field and a caveat on the Schoenfeld figure — the first time the user models an oncology or IO readout. Neither current case (Stoke, PepGen) has a time-to-event primary. |
| Calendar time to the target event count | **BUILT** (October product pass, Batch 4: `design.targetEvents` → the readout month, pinnable as a catalyst window) | When an event-driven trial reads out is itself a catalyst date. Cheap to add to the simulator; build it alongside delayed separation if an event-driven case comes up. |
| Dropout as its own clock | **DECIDED — no** | Random dropout only reduces events, which the dropout stress panel already covers. Dropout that differs between arms is a bias question, not a power one; the Trial Decoder's results reader looks at it once results exist. |
| Group sequential / alpha spending, MaxCombo, RMST, weighted log-rank, correlated PFS/OS, cure models, stratification, digitised Kaplan–Meier control arms | **DECIDED — no** | Trial-design-team tools. Group sequential was already declined (section 8). Fails the scope line. |

---

## 3. Science workbench

| Tool | Status | Notes |
|---|---|---|
| Target Dossier (Open Targets) | **BUILT** | Genetic support, disease associations, drugs on target |
| Class neighbours / other drugs on target | **BUILT** | Inside the dossier |
| Literature shelf (Europe PMC) | **BUILT** | Typed by MEDLINE publication type, so primary evidence is separable from reviews of it (Phase 21) |
| Evidence-thinness indicator | **BUILT** | Lives on the Asset Program view as a checklist of counts with denominators — no composite score, by design (Phase 22) |
| Mechanism one-pager (UniProt/Reactome/STRING) | **DECIDED — no** | Pretty, but doesn't change a retail investor's mind about anything |
| Molecule / structure card (PubChem) | **DECIDED — no** | Chemistry was built and deliberately removed. Fails the product test: molecular weight changes no decision. Do not reopen without an explicit reversal. |

---

## 4. Company workbench

| Tool | Status | Notes |
|---|---|---|
| Company Lookup (EDGAR financials, full-text search) | **BUILT** | |
| Catalyst Calendar | **BUILT** | |
| Cash Runway · Runway vs Catalyst | **BUILT** | |
| Insider transactions (Form 4) | **BUILT** | Both tables, split by transaction code — P/S on one tab, awards and vesting on another (Phase 20) |
| **Form 4 derivative coverage** | **BUILT** | Plus two real bugs found on the way: relevance-ordered discovery, and officer titles read as “Other” |
| Pipeline view / 10-K vs CT.gov mismatch | **OPEN** | The two sources routinely disagree, and the disagreement is itself the signal. Moved from "DECIDED — build" to OPEN on 2026-10-03 (October audit, GAP-001; the user accepted the recommendation). The CT.gov half already exists (Company Lookup, Asset Program). The 10-K half means reading free-text pipeline tables out of annual reports, the fragile kind of parsing this app has been burned by before. Worth building only if a structured source for company pipelines turns up. |
| 13F institutional holdings | **DECIDED — no** | Different filing type, previously declined, still out |

---

## 5. Commercial workbench — **entirely new, and a real gap**

The app assumes pre-revenue. A user modelling an early-commercial name (launched, 1–3 products) is asking different questions, and none of them are served today.

### The one that is arguably a defect, not a feature

**Gross-to-net.** The Reference Sheet correctly says *"ASP — net of rebates/discounts, use this in models. Median ~74% of AWP."* But the revenue model has a single `usAnnualPrice` field and **no gross-to-net adjustment anywhere**. The app dispenses the right advice and then provides no mechanism to follow it, so anyone entering a list price overstates revenue by roughly 25–30% with nothing flagging it. In US pharma, gross-to-net is one of the largest single sources of error in a retail revenue model.

**BUILT** (Phase 18), as an accuracy fix on the existing valuation rather than a new feature. The price field now carries a basis (ASP / WAC / AWP / Retail) and converts to ASP using the app's own sourced Table 4-1 before multiplying by patients, with an optional net-price-realisation override for anyone who has a real gross-to-net for a close comparable. The default is ASP with no adjustment, so every case saved before this existed values identically — verified, not assumed.

### The rest of the workbench

| Tool | Status | Notes |
|---|---|---|
| **Launch trajectory vs analogs** | **BUILT** | CMS Medicare spending, quarterly, with analogs indexed to first Medicare year (Phase 24) |
| **Actual vs modelled revenue** | **BUILT** | Case-linked, persisted, and refuses to compare a partial year to a full one (Phase 24) |
| Public dispensing/spend data | **BUILT** | **The lag assumption was wrong, and checking it changed the decision.** The *annual* CMS datasets do lag 1–2 years, but CMS also publishes **quarterly** Part D and Part B spending — current to 2026 Q1 as of July 2026, about one quarter behind. That is a live uptake read, not just an analog source. **Medicaid added October 2026 (reversed on the user's reason: "i will be tracking drugs for children frequently")** — Medicare barely sees a children's drug (Spinraza is not in Part B's file at all). CMS's annual Medicaid summary plus the State Drug Utilization Data (quarterly, ~3 months behind), beside Medicare with a public-payer total, and a price helper on the Pricing step (Medicare per patient, Medicaid per prescription). |
| Channel/inventory stocking distortion | **DECIDED — no** | Real phenomenon, but not reliably observable from public data — would be guesswork dressed as analysis |
| Payer coverage / formulary access | **OPEN** | Genuinely drives uptake; no reliable free source found yet |
| HTA / ICER / payer value modelling | **DECIDED — no** | Out of scope, institutional |
| Post-LOE erosion | **BUILT** | Exclusivity/LOE tool + erosion curves in the revenue build |

---

## 6. Benchmarks and reference

| Tool | Status | Notes |
|---|---|---|
| M&A comps (77) · Peak Sales (42) · Licensing (19) | **BUILT** | With custom add/edit/delete; counts as of 2026-09-30 |
| Reference Sheet (9 tabs, incl. Trial Glossary) | **BUILT** | |
| Placebo-response benchmarks | **BUILT, thin** | Only ~2 therapeutic areas, and display-only — nothing computes with it. Expand if control-arm stress wants a default. |
| Published PoS base rates | **BUILT** | With the deviate-from-benchmark red flag |

---

## 7. Valuation (mature — leave alone)

rNPV/DCF, Quick + Detailed revenue, scenarios, Simple Multiple, PRV, capital structure and dilution, dilution-path financing, partnership economics, what is owed to a licensor (October 2026: royalty, approval and sales milestones, share of partner income), full-case Monte Carlo, sensitivity, sum-of-the-parts, risk waterfall, reverse-solve, binary-event implied PoS, portfolio aggregation, PDF report.

**No longer closed (October 9, 2026).** The user: "we can absolutely add or fix DCF mechanics if it genuinely improves the product. that applies to every area of the application." The earlier "no further DCF mechanics" line is retired; every area is judged on merit. The licensor input (October 5) was the first exception; the October 2026 workflow (section 12) adds drug-level licences, convertible preferred and multi-program catalyst values.

---

## 8. Decided against — do not reopen without an explicit reversal

Each of these has been considered and declined on the merits. Recording them here is the point of this document.

- **Chemistry / molecule cards / cheminformatics** — built, then removed; fails the product test
- **QSP, PBPK, NONMEM-class modelling** — institutional, out of scope
- **Docking, structure prediction** — out of scope
- **Group-sequential / adaptive design engines** — still declined as engines. *Narrow reversal, October 2026:* a small "what result crosses this interim analysis" calculator (section 12), because interim OS looks are catalysts in oncology
- **Black-box AI outcome prediction** — actively unwanted; the app's value is showing its reasoning
- **HTA / ICER / payer value models** — institutional
- **13F institutional holdings** — different filing type from Form 4
- **Versioned case snapshots** — previously declined
- **AACT bulk download** — good advice for a server-backed product; this is a local app with no database. Live API, cached, is correct here.
- **Full identifier normalisation (MONDO / Ensembl / InChIKey)** — correct engineering in principle, large refactor, payoff concentrated in analog matching. Revisit *only* if free-text matching demonstrably limits the analog board.
- **Code signing / notarisation** — $99/yr buys nothing for local use
- **Real bundler** — legitimate future improvement, but a deliberate isolated architecture change, never bundled into feature work
- **Channel/inventory stocking analysis** — not reliably observable from public data
- **Position sizing of any kind** (October 2026 product pass: Grok's edge-scaled size, Spark's loss-to-floor size, a "loss if it fails" calculator) — the user: "its on the side of investment advice and theres no clear criterion." Grok's formula had no basis (not Kelly, and the odds gap is not an edge — fair value against price already is), and the failure floor already says what is left on a miss.
- **A second dilution path after a failure** (Grok D1) — a raise priced near the post-failure value adds cash and shares in proportion and barely moves the per-share floor; the wind-down case already exists (Corporate G&A wind-down years); and the floor is deliberately hand-checkable arithmetic.
- **A pipeline-disagreement table** (Grok T6) — an Evidence Log entry already holds "the company says X, the registry says Y" with its source and date.
- **A backup reminder banner** (Grok B1) — the sidebar's permanent backup status line is the surface; a dismissible banner on top trains dismissing both.
- **An "accelerated approval" or "confirmatory trial outstanding" flag inferred from label text** (Grok F1) — a regulatory-history fact, not a label fact; keyword matching gives confident wrong answers. Label text may be quoted, labelled as a quotation.
- **A separate reverse-solve screen** (Grok V3) — the existing solvers already answer it; the decision memo shows implied odds and the implied revenue variable together.

---

## 9. Open questions

1. ~~**Tab consolidation.**~~ **Resolved: confirmed by the user and built** (Phase 25). Six workbenches, organised by the question being asked. A sixth — *Valuation* — was added beyond the five originally proposed, because Sensitivity, Binary Event and Diluted Market Cap answer a question none of the other five do.
2. ~~**CMS data lag.**~~ **Resolved: checked, and the assumption was wrong** (Phase 24). The annual datasets lag 1–2 years; the **quarterly** Part D/Part B datasets run about one quarter behind, which makes them a live uptake read rather than an analog-only source.
3. ~~**Literature / paper shelf (Europe PMC).**~~ **Resolved: built** (Phase 21). The user's condition was "not just the European one" — which turned out not to be a constraint, because Europe PMC indexes MEDLINE/PubMed in full rather than European content only. One source, not three.
4. ~~**Evidence-thinness indicator** — useful, or glib?~~ **Resolved: built** (Phase 22), as a checklist on the Asset Program view with no composite score.

---

## 10. Build order

1. ~~**Results reader** (outcomes, dropout, adverse events)~~ — **done**, Phase 17
2. ~~**Gross-to-net** — accuracy fix on existing valuation~~ — **done**, Phase 18
3. ~~**Cheap completions batch**~~ — **all done**: thin-win and change classification (Phase 19), Form 4 derivatives (Phase 20), literature shelf (Phase 21), multi-trial view + evidence checklist (Phase 22), control-arm/dropout stress (Phase 23)
4. ~~**Commercial workbench** — launch trajectory, actual vs modelled~~ — **done**, Phase 24
5. ~~**Tab consolidation**~~ — **done**, Phase 25. Six workbenches (Trial / Science / Company / Commercial / Valuation / Benchmarks), 18 tools.
6. ~~**Electron upgrade**~~ — **done** 2026-09-22: Electron 33.4.11 → **44.4.4** (Phase 27). Every item on this list is now done.

---

## 11. October 2026 product pass (Grok + Spark review, decided with the user)

An external pass by Grok, audited by Spark, reviewed against the code on 2026-10-04 and decided with the user. Built in batches, each verified in the packaged app before the next; the two sample cases are filled with each new field as it lands so every feature is exercised on a real case. New fields start blank and change nothing, so existing cases value as before. Status lines below move to **BUILT** only when an item meets its done test.

**Where new information goes.** The user: new lines that show something the app does not already show are not clutter "if it can be implemented cleanly"; the Overview and the one-page decision memo carry the information, and the interactive screens (Assumptions, Scenarios, Tools) gain controls only where one is needed, folded away by default.

| Batch | Item | Status |
|---|---|---|
| 1 | One window-aware catalyst date parser (`2027-11-14`, `2027-11`, `2027-Q2`, `H1 2027`, `2027`) for Runway vs Catalyst, overdue prompts and the failure floor; a window is overdue only at its end and the floor burns to its end (Grok C1) | **BUILT** |
| 1 | Pinned catalysts as a flag on a Calibration Log entry (type, window, source, date pinned), read first everywhere; registry completion stays, labelled completion (Grok C2, as Spark amended: one object, not two) | **BUILT** |
| 1 | A one-line freshness strip on the Overview: price with its entered date (new), cash with its date plus a real EDGAR check for a newer 10-Q/10-K (stronger than Spark's 100-day rule), the pinned catalyst and where the odds came from (Spark SP-1) | **BUILT** |
| 2 | Simulator → case odds: overall odds = the chance of a significant result *in the right direction* × the benchmark odds of every remaining step after that trial, into the existing override, with before/after shown and the run's provenance kept; a Phase 2 caveat (advancing ≠ hitting the primary) (Grok V1; Spark's stage-not-launch correction, built without a per-stage field the app does not have) | **BUILT** |
| 2 | Both failure floors on the Overview, the active one marked, a $0 floor saying why (Grok V4) | **BUILT** |
| 2 | The odds gap in percentage points beside "your odds / price implies", inputs held fixed listed on demand (Grok V2) | **BUILT** |
| 3 | Undrawn ATM, undrawn debt, expected milestone cash and remaining shelf (one as-of/source note), runway with and without them, the cash tag shown, a warning when the same ATM is entered twice (Grok C3/C4) | **BUILT** |
| 3 | "Dollars needed" on Runway vs Catalyst (to the pin plus the cushion, against the shelf) with "Model this raise" pre-filling the existing raise fields (Spark SP-2, reduced: the dilution path already models the raise itself) | **BUILT** |
| 4 | Delayed separation and readout timing as one simulator change (see the survival table, section 2) | **BUILT** |
| 4 | A one-line summary under the assurance histogram (Grok S3, as downgraded) | **BUILT** |
| 4 | Editable Phase 2→3 discount, per run (Grok S4) | **BUILT** |
| 4 | Analog-board prior presets: median, median after the discount, a cautious quartile (Grok S5 + Spark) | **BUILT** |
| 4 | Trial Decoder → simulator: a posted effect seeds the design, the control arm stays the user's (Grok T1, as amended) | **BUILT** |
| 5 | One-page decision memo (report preset) including "What would change my mind" (Grok R1 + Spark) | **BUILT** |
| 5 | Options-implied move against the model's win/miss values, typed in (no feed) — Claude's addition | **BUILT** |
| 5 | Cross-case catalyst list in Portfolio from pins, each with its funding state, competitor completions that read first (Grok P1/T3 + Spark SP-4) | **BUILT** |
| 5 | Close-out prompt for a passed pin, and snapshots kept dated rather than replaced (Spark SP-5; Claude's snapshot history, which SP-5's before/after needs) | **BUILT** — a narrow reversal of "versioned snapshots": model snapshots only, as dated Evidence Log entries |
| 6 | Insider clusters by distinct insiders (D3); FDA limitations of use quoted (F1, cut down); biologic 12-year floor from first licensure (M1); analog launch shape into a Full build (M3); basis suggested by channel (M4); denominator in the analog headline (T2); condition merge on Asset Program (T4); drug status on the Target Dossier (T5); the IRA clock, opt-in, blank factor, effective ~9 / ~13 years, with the 2025 orphan exclusion noted (M2 — Spark's +11/+15 years double-counted the two-year lag) | **BUILT** |

**How it was built, where it differs from the plan above (October 5, 2026).** Every item met its done test and was checked in the packaged app, live services included.
- **Analog launch shape (M3)** fits the analog's Medicare years to the closest published curve (median / slow / fast) and years to peak, the two settings the revenue build already has, rather than adding a free-form curve to the engine. Verified live: Mounjaro reads as the slow curve, 4 years, still rising; analogs selling before CMS's data begins (Fintepla, Epidiolex, Nurtec, Trulicity) are refused.
- **Condition merges (T4)** are stored per drug search (backed up), not per case, so they work with no case open.
- **Target Dossier status (T5)** found a real bug: Open Targets now returns `APPROVAL`, which scored every approved drug as stage 0 and left them out of "reached Phase 3+" (TTR read far too few; now 13 of 13). Status is approved / withdrawn (from Open Targets' warnings) / furthest stage; Open Targets does not record a program stopping, so nothing is called stopped.
- **The financing bridge (SP-2)** counts a raise the case already models: when it covers the need, the bridge says so and offers nothing.
- **"Who reads out first" (T3)** leaves out the case's own registered trials (its program's trial IDs) — the first live check listed Stoke's own Phase 3 as a competitor.
- **Samples** carry every new field that has a real source: pinned catalysts, price dates, cash sources, ATM and shelf figures from their filings, a window-dated PepGen entry, "What would change my mind". Not filled: options prices (no real chain), competitor lists and condition merges (user actions), the IRA clock (rare-disease drugs, largely excluded). Neither sample has a time-to-event primary, so the delayed-separation and readout-timing features are exercised by test designs. Bear/Base/Bull unchanged throughout.



---

## 12. October 2026 workflow (Spark handoff v2 + the Summit oncology build)

Decided with the user on October 9, 2026; the full verdicts, reasons and done tests are in [`RxNPV_Build_Workflow_Oct2026.md`](RxNPV_Build_Workflow_Oct2026.md), the oncology findings in [`RxNPV_Oncology_Gap_Review.md`](RxNPV_Oncology_Gap_Review.md). The user took every recommendation and asked for one install at the end. Status lines move to **BUILT** as each batch passes its done test.

| Batch | Item | Status |
|---|---|---|
| 0 | Spark's verified textbook examples as independent math checks (Lachin, Schoenfeld, Lehr, Friedman power, Fisher); the fragility example excluded — Walsh's method gives 1, the handoff's 2 | **BUILT** |
| 1 | Program labels when two programs share a drug name; simulator program picker height | **BUILT** |
| 1 | Convertible preferred that converts to common (counted as shares at any price, never as debt) | **BUILT** |
| 1 | Incidence mode labelled as time on treatment; price-per-dose helper | **BUILT** |
| 1 | "Who reads out first" by rival drug names (Trial Explorer; Company Lookup's sponsor landscape left as it is) | **BUILT** |
| 2 | What each catalyst is worth (multi-program), with optional same-drug read-across; Binary Event program picker | **BUILT** |
| 2 | Range of endings (built as exact enumeration rather than a seeded simulation — every launch-or-fail combination, capped at 2,000; read-across; mean equals Base with no G&A or tax) | **BUILT** |
| 2 | Drug-level licence: royalty (optional marginal tiers) and sales milestones on the drug's total sales | **BUILT** |
| 3 | Dead or underpowered; nominal p; false-positive chance; Subgroup Check; Interim Analysis with conditional power; safety exposure; stopped-for-benefit and regression-to-the-mean notes (results-overdue and dropout-asymmetry flags already existed); silent completed trials in Asset Program; NI margin as a share; Zia check; peak above every area comp (not a percentile — the comps are hand-picked winners); Press-Release Reader (no score) | **BUILT** |
| 4 | FDA decision date from the submission date; patent term extension estimate | **BUILT** |
| 5 | Trial Glossary additions (cluster randomisation, enrichment, blinding, seamless designs, 3+3, composites, ITT vs per-protocol, comparator quality, LOCF, crossover dilution, publication bias) | **BUILT** |
| 6 | Summit Therapeutics as the third full sample | **BUILT** |

**Declined from the handoff, with reasons in the workflow document:** V5 discount-rate ladder (double counts risk), V7 real options and V8 sales-path simulation (an unsourceable volatility), V11 value-share ladder, V12 two-party option valuation, V13 platform feed-rate value, V3 market-growth compounding, F4 event health check, M1/M6/M7 (covered), M15, R10/R11/R19 curve fitting, P1/P8 tables (no data), P3, P6, P7, G1, G2, D3, E5 (registry history is not public), E9, E10's risk tiers.
