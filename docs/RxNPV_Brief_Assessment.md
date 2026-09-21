# Assessment — "Retail Biotech Sandbox" product brief (2026-09-21)

The user brought in an externally-generated product brief (`biotech-sandbox-brief.md`) and asked which parts are worth acting on. This is that assessment: what the app already does, what is genuinely new and worth building, and what conflicts with decisions already made deliberately.

Not a backlog. Nothing here is committed to. It exists so the next session doesn't have to re-derive the same judgements, and so ideas already declined aren't quietly reopened.

**The brief's framing is well aligned with this project.** Its core argument — that Excel already does rNPV, and the differentiated value is decoding the trial rather than tightening the discount rate — matches this app's own scope line. Its anti-patterns list is sound and largely describes things this app already avoids. Where it diverges is mostly scale: it describes a four-room product with a normalized biomedical object model, which is a larger thing than a personal desktop sandbox.

---

## Already built — the brief's own P0/P1 list is substantially covered

Worth stating plainly, because a reader of the brief could easily conclude none of this exists.

| Brief | Already in RxNPV |
|---|---|
| B1 Power / sample-size sanity | **Sample Size / Power** tab — binary, continuous, and Schoenfeld time-to-event |
| B2 Readout Monte Carlo | **Trial Outcome / PoS** — simulates thousands of trials under an uncertain true effect, reports the share reading out positive. This is the brief's B2 spec almost exactly |
| B6 Multiplicity explainer | **Multiplicity Adjustment** tab — Bonferroni and Holm side by side |
| B8 Bayesian PoS update | **Phase 2→3 Translator** — shrinkage from published concordance analyses |
| B10 Fragility intuition | **Fragility Index** tab (Walsh et al.) |
| B11 Survival curve sketchpad | Drawn survival curves in Trial Outcome, from the hazard ratio |
| B13 Non-inferiority decoder | **Non-Inferiority** tab with margin and direction |
| B16 Base-rate PoS picker | `POS_BY_AREA` benchmarks with a user override, **and** a red flag that fires when the override deviates >2x from the benchmark. This is B16's "show the gap" requirement already implemented |
| A2 Protocol-change watcher | **Trial Watch** — snapshot-and-diff against CT.gov (see below for its limits) |
| D1 / D5 label + exclusivity precedent | **FDA Lookup** (Drugs@FDA, labels, FAERS) and **Exclusivity / LOE** (Orange Book) |
| H1 8-K catalyst feed | **Catalyst Calendar** |
| Analog trials (partial) | **Trial Explorer** historical comps — status landscape, median duration, median enrollment |

---

## Worth building — ranked by value per unit of effort

### 1. Analog effect-size board (brief B9) — the best idea in the document
Historical Comps currently answers "how long did trials in this indication take, and how did they end up statusd." It does **not** answer *how big were the effects*. The brief is right that "what has winning actually looked like here" is the more useful question, and it's the one a retail investor can least easily get elsewhere.

CT.gov results modules carry posted outcome measures, and `hasResults` is already parsed. The work is extracting effect estimates from the results module and showing the distribution — so a user can see that the drug they're holding needs an HR of 0.62 in an indication where the last five randomized trials landed between 0.78 and 0.91.

Pairs naturally with the existing Meta-Analysis tab, which already pools effect sizes once you have them.

### 2. Thin-win detector (brief B3) — cheap, and the stats already exist
The app computes confidence intervals, NNT, and risk differences. It does not bucket a result as *statistically positive but clinically thin*. That's mostly a presentation layer over numbers already being calculated — a large NNT or an HR of 0.88 with a CI hugging 1.0 is exactly the "win" a press release will not characterise honestly.

Natural home: the existing **2×2 Outcome Analysis** tab, which already computes NNT.

### 3. Control-arm and dropout stress (brief B4, B5)
A genuinely different lever from anything present. The app varies PoS and effect size; it does not let you ask "what if the placebo response runs 10 points above what the SAP assumed" or "what if differential dropout is 15%." For someone reading a protocol, those are often the most load-bearing assumptions in it. Moderate effort, sits cleanly alongside the existing simulation tools.

### 4. Richer protocol-change detection (brief A2, extending what exists)
Trial Watch diffs five fields: status, phase, enrollment, primary completion date, primary outcomes. The brief's list is a superset — eligibility widening, added interim analyses, arm changes, masking changes. Two upgrades, both cheap because the diff machinery already works:
- diff more fields
- **classify** each change as routine vs. red flag, rather than listing them flat. An endpoint swap or an N cut late in a trial is a different animal from a site being added.

### 5. Missing-results flag (brief's red-flag list)
"Completed, past the reporting deadline, no posted results." Both inputs are already parsed (`completionDate`, `hasResults`). This is nearly free and is a real signal.

### 6. Single-arm honesty check (brief A7)
Flag a single-arm trial in an indication where randomized precedent now exists. Depends on the analog data from #1, so it follows naturally from that rather than standing alone.

---

## Conflicts with decisions already made — do not quietly reopen

**Molecule / structure card (brief C2).** Chemistry was *built and then deliberately removed* from this project (RDKit WASM, cut after the user judged it not worth keeping; no trace remains in `src/` or `electron/`). A PubChem structure image is lighter than what was removed, but it is the same category, and the brief itself warns against "building chemistry theater before the trial decoder works." Honour the existing decision unless the user explicitly revisits it.

**Interim / alpha-spending explainer (brief B7).** CLAUDE.md lists group-sequential trial modeling under "Deliberately not built." The brief ranks this P2 itself. Consistent to keep declining.

**AACT bulk download (brief section 10, and its implementation notes).** This is the brief's strongest *infrastructure* insight — use bulk data for analog mining rather than hammering the live API — and it is genuinely good advice for a server-backed product. It does not fit this one. RxNPV is a local Electron app with no server, no database, and a ~5MB localStorage budget; AACT is a multi-gigabyte Postgres dump. Adopting it would change what this application *is*. The live CT.gov API, cached, remains the right call here. Idea #1 above should be built against the API, not AACT.

**Target dossier via Open Targets (brief C1).** Genuinely different from the removed chemistry work — target–disease association and human genetic support are *context*, not cheminformatics, and would inform "is this target real" in a way nothing in the app currently does. But it is a new external API, a new data domain, and a new failure surface. Flagging as a real question for the user rather than assuming either way.

**Full evidence-tag taxonomy (brief section 2).** The discipline is right and partially present already: `BenchField` distinguishes a benchmark from a user override throughout, and the Evidence Log carries explicit classifications. The brief's fuller six-tag scheme applied to *every number in the UI* would be a large cross-cutting retrofit. Better treated as a principle to hold when building new surfaces than as a refactor to undertake.

**Identifier normalization (brief section 4 — MONDO, Ensembl, InChIKey).** Correct engineering advice in general, and the brief is right that free-text indication matching makes analog search dumb. But it is a substantial refactor of a tool that currently works acceptably on free text, and its payoff is concentrated in the analog-mining features. Revisit only if #1 above is built and free-text matching proves to be the thing limiting it.

---

## Open questions the brief asks that are already answered

The brief's section 17 asks five questions. For the record:
1. **Stack** — no bundler, no framework build step: 31 plain JS files concatenated into one inline `<script>` inside an Electron shell. See CLAUDE.md.
2. **Therapeutic areas** — not specialised; the benchmark tables cover the major areas and the app is indication-agnostic.
3. **AACT** — not operationally acceptable here, for the architectural reasons above.
4. **Should scientific modules write into the DCF?** — this is already the established pattern and it works: every cross-feature connection in the app (Peak Sales Monte Carlo → case export, Partnership → Licensing Comps, any result → Pin to report) is explicit, one-click, and never automatic. Keep that.
5. **Repo** — `github.com/risdiplam/rxnpv`.
