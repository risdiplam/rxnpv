# Build workflow: October 2026 (Summit findings + Spark handoff v2)

Prepared October 9, 2026, for decision before any building starts. It brings together:
- the oncology gap review from building Summit Therapeutics (`RxNPV_Oncology_Gap_Review.md`);
- Spark's book-sourced handoff v2 (98 items: V/F/M/R/P/G/D from v1, plus the new E-series and its desk items).

**How each item was judged:** does it help a retail biotech investor make a better call? Does it show something the app doesn't already show? Can it be fed from public data without inventing inputs? No area of the app is treated as closed (the user, October 9). Every number gets a hand-worked check, and nothing ships until it has been seen in the packaged app.

---

## Part 1 — Verdicts on every Spark item

### Build (in the batches below)
| Spark item | What gets built | Batch |
|---|---|---|
| M2 + G3 + P8 | **"Dead, or just underpowered?"** An optional "smallest effect that matters" on P-value ↔ CI. A miss is definitive only if the whole interval sits below it. Fojo's 2.1-month median OS gain is shown as context, labelled as not a threshold. | 3 |
| M12 | **Subgroup claim check**, a new Trial Statistics tool. It tests whether two subgroup effects actually differ, on the log scale for ratios, with a multiplicity note. | 3 |
| M9 | **Chance a significant result is a false positive**, given a prior. This is a reading on P-value ↔ CI, with the prior typed by the user and never defaulted silently. | 3 |
| F6 + F7 | **Interim analysis: what result crosses?** Takes the information fraction and a spending rule (O'Brien–Fleming-type, Pocock, Haybittle–Peto). Returns the boundary z, the nominal p, the hazard ratio needed at that event count, and conditional power under the design and under the current trend. Spark's winner's-curse discount is left out (designer-made, not book). | 3 |
| F8 + M5 | **What a clean safety record can rule out.** A reading on Single-Arm CI: "0 of 800 cannot rule out events rarer than about 1 in 270". | 3 |
| E10 (reduced) | **Press-release reader.** Paste a release; it lists the phrases that usually signal spin ("trend toward", "numerically", "nominal p", "clinically meaningful" with no statistic), p-values just under 0.05 and subgroup claims, each with what it usually means. **No risk score or tier**, consistent with the app's no-composite-scores rule. *Decision 2.* | 3 |
| E1 (reduced) + E4 (reduced) | **Results overdue.** The Trial Decoder flags a trial past its primary completion by more than 12 months with no posted results. Asset Program counts a program's completed-but-silent trials. The full outcome-switching comparison isn't possible: ClinicalTrials.gov's version history is internal-only (403 on October 9). Trial Watch already catches changes after a snapshot. | 3 |
| E2 (reduced) | **Enrolment shortfall or early stop:** a Decoder flag when actual enrolment is under 80% of planned, or the trial stopped. The ~25% overstatement figure is shown as context, never applied automatically. | 3 |
| E6 (computable part) | **Dropout asymmetry:** a results-reader flag when dropout differs between arms by more than 10 points or exceeds 20%. It uses the existing dropout rules (deaths and moves into an extension never count). | 3 |
| M16 (as a caution) | **Regression to the mean:** a Decoder caution on single-arm trials that enrol by severity. Spark's calculator runs on an unsourced r = 0.6 default, so no calculator. | 3 |
| P5 + RD-E7 | **NI margin as a share of the comparator's effect:** an optional field on Non-Inferiority, reading "this margin gives away X% of what the comparator achieves against placebo". | 3 |
| P2 | **An absolute response-rate haircut preset** (Zia: −12.9 points) on the Phase 2→3 Translator, beside the existing ratio factor. | 3 |
| V4 (as a red flag) | **"Your peak is above X% of approved drugs in this area"**, measured against the app's own Peak Sales Comps rather than the book's 2000s medians. It carries a survivorship caveat (the table holds successes only). | 3 |
| D4 | **FDA decision date from the submission date.** New molecular entities and original BLAs: 60-day filing plus 10 months (standard) or 6 (priority). Other NDAs: from submission. A major amendment adds 3 months. The result pins as a catalyst window. Spark's rule is corrected (it doesn't separate the two clocks). | 4 |
| D5 | **Patent term extension estimate:** half the trial period plus the review period, at most 5 years, capped at 14 years after approval. Effective LOE = the later of the extended patent and the regulatory floors. | 4 |
| V12 (tiers only) | **Marginal royalty tiers**, as part of the drug-level licence in batch 2, used when a deal discloses its tiers. | 2 |
| V9 (reworked) | **Range of endings** for multi-program cases (*Decision 1*). Each program succeeds or fails at its own odds, with an optional user-set read-across between programs of the same drug. Spark ships it uncorrelated, which overstates diversification for one drug in several indications. | 2 |
| Spark's worked examples | Added to `math_verification.js` as independent cross-checks where they overlap existing code: Lachin 952.3, Schoenfeld 256 events, Lehr 63/group, power 0.793, Fisher 0.0257. The fragility example is left out because it uses a non-standard method. | 0 |

### Reference text only (Trial Glossary and captions, batch 5)
- **Trial design:**
  - F5 (cluster randomisation: headcount is not effective sample size).
  - RD-E1 (enrichment and generalisability).
  - RD-E4 (blinding: block size, guess tests, side effects that unblind, DMC independence).
  - RD-E5 (seamless Phase 2/3 and why α must be controlled).
  - RD-E8 (3+3 dose escalation underestimates the MTD).
- **Reading results:**
  - E3 (composite endpoints; PFS is itself progression *or* death).
  - E7 (per-protocol vs ITT).
  - E8 (is the comparator the standard of care, at the right dose?).
  - LOCF from E6.
  - F2/F9/P4 (crossover and drop-in dilute an OS result).
  - E4 (publication bias, the Turner 2008 numbers).
- RD-E6 as a caption under Sample Size: "a power calculation built on a small pilot is a guess".

### Already built (Spark's numbers cross-checked against the app on October 9; they agree)
- **Valuation:** V1 rNPV, V2 stage odds (the app uses Thomas 2016 and a seven-source baseline; Hay 2014 is the older source), V3 revenue build, V6 sensitivity, V10 binary event, V14 sum of the parts.
- **Trial statistics:** F1/M4/F3 sample size and events, F10 minimum detectable effect, M8 multiplicity, M10 fragility (the app follows Walsh's method), M19 non-inferiority, M20 single-arm interval (Wilson, which is better than Agresti–Coull for small n).
- **Benchmarks:** D1/D2 phase odds and costs, and D5's exclusivity table and erosion (except the PTE estimate, built above).

### Declined, with reasons
| Item | Why not |
|---|---|
| V5 discount-rate ladder | Ladders up to 17–20% by stage put development risk in the rate *and* in the odds, which the methodology review removed. |
| V7 real options, V8 GBM sales paths | Both need a sales volatility no one can source; stage-weighted costs already capture abandonment at failure. |
| V11 deal value-share ladder | Vintage bands (2000s), and it informs no decision the investor makes. |
| V12 two-party option valuation | Values the licensee's flexibility; not the investor's question. |
| V13 platform feed-rate value | Rests on a claimed project feed rate; the book itself says it is usually small beside the lead asset. |
| V3 market-growth compounding | Price growth already exists; separate market growth invites the manipulation the book warns about. |
| F4 event-count health check | Event counts are rarely disclosed. |
| M1 t-test from summary statistics, M6, M7 | P-value ↔ CI and 2×2 already cover them. |
| M15 potency comparison | Preclinical. |
| R10, R11, R19 PK/PD fitting | Fitting a curve to 2–3 published dose means prints a confident "flat top" verdict the data cannot support. |
| P1 surrogate grader, P8 benefit table | The tables they need do not exist (Spark says so); an Evidence Log judgment carries the PFS-vs-OS question better. |
| P3 accelerated-approval risk | Inferring accelerated-approval status was declined earlier; revisit if an approved accelerated-approval case is built. |
| P6, P7 imaging-noise gates | Specific to oncology imaging, and mostly not computable from public data. |
| G1, G2, D3 | Diagnostics and first-in-human dosing; not investor tools. |
| E5 amendment screen | Needs registry history (not public); Trial Watch catches amendments from the first snapshot on. |
| E9 seeding trials | Marketing-era trials, irrelevant to the investment case. |
| E10 risk tiers | Invented cutoffs on a score; the phrase list without a score is built instead. |

**Two errors in Spark's document worth knowing:**
1. Its fragility "regression test" (15/60 vs 5/60 → 2) uses a non-standard method. Walsh gives 1, as the app does.
2. Its FDA-clock rule applies only to NMEs and original BLAs.

---

## Part 2 — From building Summit (all accepted)
1. **Bug:** every indication of one drug is labelled with the drug name (tabs, section list, SOTP, legends). → batch 1
2. **Bug:** the simulator's program picker is 22px tall. → batch 1
3. **Convertible preferred that converts to common:** AstraZeneca's $2B at $18.36. The only current option (the note field) treats it as debt below conversion, costing about $2.20 a share. → batch 1
4. **The incidence field is labelled for chronic disease:** oncology revenue comes from time on treatment. → batch 1
5. **"Who reads out first" by rival drug names**, not only condition (342 Phase 3 NSCLC trials vs the 13 that matter). → batch 1
6. **Catalyst features for multi-program cases:** a per-catalyst table. → batch 2
7. **Licence terms that belong to the drug, not one indication** (Akeso's $3.5B of milestones on total sales). → batch 2

---

## Part 3 — The workflow

Every batch runs the same loop:
1. Build.
2. Hand-worked math checks.
3. Both test builds, plus lint.
4. Packaged harnesses (ui_audit, button sweep, export sweep where exports are touched, case_fill where inputs change).
5. Look at the screenshots and exported files.
6. Docs (README, Feature Map, CLAUDE.md, build log).
7. Commit and push.

New fields start blank and change nothing, so Stoke, PepGen, Spruce and the user's own cases value exactly as before. Their pinned numbers are re-run at every batch.

### Batch 0 — Groundwork (small)
- Record the decisions above in the Feature Map (reversals marked as reversals; "no further DCF mechanics" retired).
- Add Spark's matching worked examples as independent checks.
- **Done when:** both test builds pass, and the Feature Map reflects every verdict.

### Batch 1 — Defects and the oncology basics
1. **Program labels:** the program name whenever two programs share a drug name, everywhere a program is named. A test asserts no two labels on one case are equal.
2. **Simulator picker:** at least 28px tall; ui_audit clean on Summit.
3. **Convertible preferred:** a capital-structure input, "Preferred that converts to common: shares as converted". Counted as shares at any price, never as debt, with its own line in the dilution bridge. Company Lookup warns when the latest filing tags preferred stock outstanding. Summit enters AstraZeneca's 108,955,369 shares there.
4. **Time on treatment:** incidence mode relabelled to "Years each patient is treated" (disease duration for a chronic disease, time on drug for cancer). A note points to Launch & Actuals' Medicare spend per patient. An optional price-per-dose × doses-a-year helper fills the annual price. The arithmetic doesn't change.
5. **Rival-drug search:** "Who reads out first" (Trial Explorer) and Company Lookup's competitor scan take optional drug names, searched with OR and re-checked against each trial's registered interventions. Cases store the names.
- **Done when:**
  - Summit's tabs read as four different indications;
  - the preferred line gives the same value as adding the shares by hand;
  - the rival-drug search returns the 13 class Phase 3s live;
  - the pins of every existing sample are unchanged.

### Batch 2 — Multi-program catalysts and drug-level licences (the largest)
6. **What each catalyst is worth** (Overview, multi-program DCF cases). One row per program's next gate, in date order (the pinned Calibration entry first, otherwise the stage). Each row shows:
   - the gate's odds;
   - value per share if it passes (that program's odds after the gate, the others unchanged);
   - value if it fails (that program at zero, its remaining costs avoided, the others unchanged);
   - the move from today's price.

   Optional read-across, off by default: "if this fails, cut the other programs of the same drug by X%". Reading: `readCatalystLadder`.

   The report, the decision memo and Binary Event (which gains a program picker) read the same rows. Single-program cases keep the outcome tree and failure floor unchanged.
7. **Range of endings** (*Decision 1*): a seeded simulation of which programs succeed, using the same read-across. It shows a histogram of per-share outcomes, the chance of ending below today's price, and the most likely combinations. Its mean must equal the Base value (held equal by a math check), which shows it is the same model.
8. **Drug-level licence:**
   - one licence per licensor and drug, shared by all programs of that drug;
   - the royalty on all of the drug's own net sales, optionally in marginal tiers;
   - sales milestones on the drug's *total* sales;
   - a regulatory milestone per approval event (per program);
   - partner-income share as now.

   An existing per-program licence migrates unchanged; Stoke and PepGen (one program each) must value identically. Both independent rebuilds in `math_verification.js` are extended.
- **Done when:**
  - the catalyst table's pass/fail values match hand-built valuations;
  - the range of endings matches the Base value;
  - a milestone on Summit fires in the year total ivonescimab sales cross its level;
  - every existing pin is unchanged.

### Batch 3 — Reading a readout
Items 10–18 from Part 1: dead-or-underpowered, subgroup check, false-positive chance, interim boundaries, safety exposure, results-overdue and enrolment-shortfall flags, dropout asymmetry, the regression-to-the-mean caution, NI margin as a share, the Zia preset, the peak-vs-comps red flag, and the press-release reader (*Decision 2*).

Each comes with:
- a pure function;
- a `read*()` reading;
- a hand-worked check (Spark's verified examples where they exist: HR 0.61 → 6–61%; interaction z = 1.627, p = 0.104; CP = 0.787; 0/800 → 1 in 268).

Each also has a Summit example: OS 0.79 (0.62–1.01) reads as not definitive; Western 0.98 vs Asian 0.76 reads as "no evidence the regions differ".
- **Done when:** worked examples open each new tool, and `worked_examples_test.js` covers them.

### Batch 4 — Regulatory and exclusivity dates
19. **FDA decision date helper:** Summit's Q4 2025 BLA under standard review → November 14, 2026; Spruce's BLA → its window.
20. **Patent term extension estimate:** Summit's patents 2039–40, the 14-year cap, and the 2038 biologic floor → LOE about 2040.
- **Done when:** both reproduce the hand-worked dates, and the helper's pin appears in Runway vs. Catalyst and Portfolio.

### Batch 5 — Reference text
The glossary and caption items from Part 1, each with its source and vintage noted.
- **Done when:** ui_audit is clean and the export sweep shows the new glossary cards.

### Batch 6 — Summit as the third full sample
- **Programs:** the four indications, plus a fifth Quick-mode program, "Further tumour types". The price pays for more than four indications (16 Phase 3s exist), and leaving them out would make the case read wrongly cheap.
- **Inputs:** every input sourced or entered as a judgment with an Evidence Log entry (the same standard as Stoke and PepGen). The preferred input, drug-level licence, rival-drug search and pinned PDUFA date are all used.
- **Worked examples** for every tool with honest oncology data:
  - HARMONi decoded;
  - HARMONi vs HARMONi-3 vs HARMONi-7 compared;
  - the NSCLC analog board;
  - Keytruda through FDA Lookup, Exclusivity and Launch & Actuals;
  - the HARMONi-3 simulation with delayed separation and target events;
  - the subgroup check;
  - the interim calculator;
  - and the rest.
- **Tests:**
  - an independent multi-program rebuild in `math_verification.js`;
  - a fixture;
  - pins in `backup_test` and `audit_regressions`;
  - full harness runs on `--sample=summit`.
- **Docs:** a Summit reference sheet, plus an oncology section in the trial checklist.
- **Done when:** Summit meets the same done test as the other samples, and every harness is clean on all three.

### Batch 7 — Final verification and install
- Full suite in both builds and lint.
- Packaged checks:
  - packaged_check, all three modes;
  - apihealth;
  - ui_audit on all three samples;
  - button sweeps on all three samples and the real cases;
  - export sweeps;
  - case_fill.
- Install, commit and push.
- Update the build log, README, Feature Map and CLAUDE.md.

**Order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Batches 3–5 are independent of each other and could swap. Batch 6 comes last because it uses everything before it.

---

## Part 4 — Decisions for the user
1. **Range of endings** (batch 2, item 7): build it, or stop at the per-catalyst table? Recommended: build. It is the multi-program counterpart of the outcome tree, and the read-across keeps it honest for one drug in several indications.
2. **Press-release reader** (batch 3): build it as a phrase-and-number highlighter with no score? Recommended: build. Releases are what retail investors actually read, and Summit's own ("positive trend", "nominal p = 0.0151") shows why.
3. **When to install:**
   - Option A: after each batch, so you can try each one, at the cost of the build changing during your Spruce trial.
   - Option B: once, at batch 7.

   Recommended: B if the Spruce trial is under way; A if it is paused.
4. **Summit's judgment inputs** (odds per indication, share, price parity with Keytruda): set by me, each with an evidence entry; you review them at batch 6.
