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
| **Pipeline view / 10-K vs CT.gov mismatch** | **DECIDED — build** | The two sources routinely disagree; the disagreement is itself the signal |
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
| Public dispensing/spend data | **BUILT** | **The lag assumption was wrong, and checking it changed the decision.** The *annual* CMS datasets do lag 1–2 years, but CMS also publishes **quarterly** Part D and Part B spending — current to 2026 Q1 as of July 2026, about one quarter behind. That is a live uptake read, not just an analog source. Medicaid SDUD not used: Part D/B covers the same question with better recency. |
| Channel/inventory stocking distortion | **DECIDED — no** | Real phenomenon, but not reliably observable from public data — would be guesswork dressed as analysis |
| Payer coverage / formulary access | **OPEN** | Genuinely drives uptake; no reliable free source found yet |
| HTA / ICER / payer value modelling | **DECIDED — no** | Out of scope, institutional |
| Post-LOE erosion | **BUILT** | Exclusivity/LOE tool + erosion curves in the revenue build |

---

## 6. Benchmarks and reference

| Tool | Status | Notes |
|---|---|---|
| M&A comps (68) · Peak Sales (38) · Licensing (15) | **BUILT** | With custom add/edit/delete |
| Reference Sheet (9 tabs, incl. Trial Glossary) | **BUILT** | |
| Placebo-response benchmarks | **BUILT, thin** | Only ~2 therapeutic areas, and display-only — nothing computes with it. Expand if control-arm stress wants a default. |
| Published PoS base rates | **BUILT** | With the deviate-from-benchmark red flag |

---

## 7. Valuation (mature — leave alone)

rNPV/DCF, Quick + Detailed revenue, scenarios, Simple Multiple, PRV, capital structure and dilution, dilution-path financing, partnership economics, full-case Monte Carlo, sensitivity, sum-of-the-parts, risk waterfall, reverse-solve, binary-event implied PoS, portfolio aggregation, PDF report.

**DECIDED — no further DCF mechanics.** This side is complete and heavily verified. New work goes into the workbenches above.

---

## 8. Decided against — do not reopen without an explicit reversal

Each of these has been considered and declined on the merits. Recording them here is the point of this document.

- **Chemistry / molecule cards / cheminformatics** — built, then removed; fails the product test
- **QSP, PBPK, NONMEM-class modelling** — institutional, out of scope
- **Docking, structure prediction** — out of scope
- **Group-sequential / adaptive design engines** — previously declined, unchanged
- **Black-box AI outcome prediction** — actively unwanted; the app's value is showing its reasoning
- **HTA / ICER / payer value models** — institutional
- **13F institutional holdings** — different filing type from Form 4
- **Versioned case snapshots** — previously declined
- **AACT bulk download** — good advice for a server-backed product; this is a local app with no database. Live API, cached, is correct here.
- **Full identifier normalisation (MONDO / Ensembl / InChIKey)** — correct engineering in principle, large refactor, payoff concentrated in analog matching. Revisit *only* if free-text matching demonstrably limits the analog board.
- **Code signing / notarisation** — $99/yr buys nothing for local use
- **Real bundler** — legitimate future improvement, but a deliberate isolated architecture change, never bundled into feature work
- **Channel/inventory stocking analysis** — not reliably observable from public data

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
