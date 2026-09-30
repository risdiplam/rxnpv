# RxNPV — rNPV methodology review (2026-09-30)

Written at the user's request after the PepGen pass: *"we need to step back and really look deeply into how an rNPV for a biotech is done by genuine specialists and the conventions they use."* Every figure in §0–§5 is from the two sample cases (PepGen, Base $1.38 at a $2.34 price; Stoke, Base $29.07 at $24.80), computed on the engine as it stood before the fixes.

## Status — all proposed fixes made (2026-09-30)

The user's instruction: *"alright, work through whatever needs fixing."* Each fix below was made as its own change, hand-checked against the independent year-by-year rebuilds of both samples in `test/math_verification.js` (which re-derive every figure with their own formulas, not the engine's), and pushed.

| # | Fix | What the engine does now | Measured on Base (as each landed) |
|---|---|---|---|
| D | Dilution path | Projected raises bring their cash with their shares, each weighted by the odds the company is still going that year; priced at today's price less the discount, or at the case's own value (value-neutral) | PepGen with the path on read $0.57; now $1.80 against $1.54 with it off (the raises are priced above the case's value); Stoke unchanged (no raise needed) |
| F | Bear/Bull discount rate | Presets add 0 points; Bear and Bull vary share and odds only | Bear/Bull only |
| G | Benchmark R&D | DiMasi 2016 phase costs ($20.8M / $53.8M / $240.0M) instead of trial-only costs; an override still wins | Only cases without an override |
| C | Cash date | Cash as of the filing, carried forward to "Value as of" at the monthly burn (new fields beside Cash; the EDGAR pull fills both) | PepGen −$0.14, Stoke −$0.69 |
| H | Ex-US lag | "Ex-US launch after the US", default 1.5 years; the ex-US ramp is the US curve shifted and read between years; LOE on the US calendar | PepGen −$0.26, Stoke −$0.63 |
| A | Overhead | G&A before launch × the odds of still developing or winding down; after launch, G&A on revenue-if-launched × P(launch) | PepGen +$0.64, Stoke +$0.65 |
| B | Tax | One program: P(launch) × the success case's tax after its own losses. Several programs: the odds-weighted flow is taxed (stated approximation) | PepGen −$0.14, Stoke −$0.31 |
| 9–10 | Presentation | "If it works" beside Bear/Base/Bull with a line saying Base is the odds-weighted average; an If-it-works / × odds toggle on the year-by-year card; a "What each outcome is worth" heading over the per-outcome panels | — |

**The two samples, before → after** (both re-derived: flat Bear/Bull rates, cash dated June 30 and carried to the research date, the 1.5-year ex-US lag, every quoted figure in their evidence recomputed):

| | Bear | Base | Bull | Price implies | If it works | If the next readout fails |
|---|---|---|---|---|---|---|
| PepGen ($2.34) | $0.25 → **$0.75** | $1.38 → **$1.54** | $3.58 → **$2.98** | 24% → **25%** (case: 15%) | $9.83 → **$8.22** | $0 → **$0** |
| Stoke ($24.80) | $14.44 → **$16.57** | $29.07 → **$28.07** | $45.98 → **$41.18** | 54% → **56%** (case: 65%) | $42.92 → **$41.32** | $1.40 → **$0.48** |

The fixes pull in both directions, as §3 predicted, and mostly offset on Base. What changed most is the spread: Bear is no longer charged the same risk three times, and Bull no longer gets a lower discount rate on top of better odds. **PepGen still reads below its price for the reason in §4 — the case's own 15% odds of launch, against the ~25% the price implies — not because of the engine.**

**Left alone, as proposed:** mid-year discounting (I), no terminal value by default, 12–15% discount-rate guidance (E).

---

## 0. Second pass — research verdict (read this first)

The user asked for significant research before any change, and pointed to three guides (Lofotr, DrugPatentWatch, Ambrosia Ventures). They disagree with each other, so I went on to primary and academic sources: Damodaran (NYU), the Alacrita white paper with the measured cost of capital of public biotechs and big-pharma IPR&D disclosures, Lo & Thakor's cost-of-capital work (*Nature Biotechnology* 2017), the Analysis Group practitioner guide, Bluestar BioAdvisors' worked models, the WIPO guide, EFPIA's access data and a 2026 *Drug Discovery Today* paper. **This pass corrects one thing I said in the first pass (the discount rate) and confirms the rest.**

**How the discount rate and the probability of success are meant to combine.** They carry different risks, and each risk must be counted once:
- **The probabilities carry the chance the drug fails.** Clinical failure is specific to the asset and uncorrelated with the market.
- **The discount rate carries the cost of capital** — the return investors require for market-wide risk, which for a small, loss-making, equity-funded company legitimately includes financing and illiquidity risk. It must not *also* carry the chance of failure. Damodaran: squeezing failure into the discount rate "doesn't work"; value the company as if it survives, then bring in the probability of failure.
- **The very high rates (20–50%) are for plain NPV, with no probabilities** — a survey of 242 practitioners using plain NPV averaged 40% early, 27% mid, 20% late stage. Using those rates *and* probabilities is the double count (DrugPatentWatch: "the single most common valuation error in the sector"). Lofotr's table, which pairs stage rates of 20–40% with probabilities, does exactly this.
- **What the rate should be with rNPV:** the measured cost of capital of public biotechs was ~17.7% preclinical, **13.3–13.6% clinical-stage**, 8.7% commercial (Alacrita, 2012 study); big pharma's rNPV rates for acquired pipeline assets, disclosed with explicit probabilities, are Pfizer 13.5%, AstraZeneca 13.0%, J&J 12.2%, Allergan 11.5%, Roche 10.0%; Lo & Thakor's CAPM estimates run up to ~16% for high-beta biotechs.

**So RxNPV already has this right.** Stoke at 12% and PepGen at 14% (both clinical-stage) sit in the measured range, with the probabilities carrying failure. My first-pass suggestion to move to ~10.5% was wrong — that is a large pharma's rate. The app's 15% guidance is at the top of the clinical-stage range and could say so. One real residue: **Bear adds +3 points to the rate** on top of a lower PoS — the cost of capital does not change because the drug's prospects look worse, so that part is a double count.

**Verdict on every item:**

| | Item | Verdict | Evidence |
|---|---|---|---|
| ✓ | Revenue and commercial costs × P(launch); R&D × P(reaching the phase); current phase at 100% | **Already right** | Every source |
| ✓ | Discount rate 12–15% with probabilities | **Already right** | Measured biotech cost of capital; big-pharma IPR&D disclosures |
| ✓ | Horizon through LOE, no terminal value by default | **Already right** | Bluestar ("terminal value… usually a small portion"), WIPO |
| ✓ | Success-case SG&A ~20% of sales (reps + marketing + G&A) | **Already right** | 20–30% single-product; Bluestar 5% G&A + 15% promotion |
| ✗ | Corporate G&A charged in every outcome for 25 years | **Deviates** | Bluestar and BayBridge weight overhead by the odds of being in development, like R&D; sell-side deducts overhead only "during the development period" |
| ✗ | Tax on the odds-weighted flow | **Deviates** | Bluestar: taxes and loss carry-over inside the success-case annual cash flow, *then* risk-adjusted; Analysis Group and BayBridge tax the success-case profit |
| ✗ | Dilution path adds shares without the cash | **Deviates — double count** | Two consistent approaches exist: model every cost and divide by today's shares (or add a raise's cash *with* its shares), *or* leave the funding costs out and dilute instead. The app models the costs *and* dilutes |
| ✗ | Bear raises the discount rate | **Deviates — double count** | Cost of capital does not vary with the scenario; vary share, price, timing and PoS |
| ✗ | Benchmark R&D ($4M / $13M / $40M for Phases 1/2/3) | **Far too low** | Analysis Group, DiMasi-based: $20.8M / $53.8M / $240M (2023 dollars) — 4–6× higher; ours are trial-only costs |
| ~ | Ex-US sells from the US launch day | **Gap** | EMA approval ~6 months after FDA (median); EU access ~580–600 days after EMA approval (EFPIA W.A.I.T.) — a 1.5–2 year lag |
| ~ | Cash from the filing, costs from today | **Internal mismatch, small** | Sources use the latest balance sheet; the fix is to align the dates, not a convention |
| ~ | Year-end discounting | **Convention** | Banks use mid-year; worth 3–5% of value |

**Inputs, not engine (the PepGen case is mine):** PoS 15% against a 37.8% benchmark and a 24% market-implied figure is the biggest single driver of PepGen reading bearish. Its ex-US sales are ~94% of US sales; the usual split is US ~65% / Europe ~25% / Japan ~10% (ex-US ~54% of US).

**Where that leaves the engine's bias.** Of the confirmed deviations, overhead (A), the dilution path (D) and Bear's rate (F) push values *down*; tax (B), benchmark R&D (G), ex-US lag (H) and the cash date (C) push them *up*. The 2026 *Drug Discovery Today* paper (Yeon et al.) argues traditional rNPV implementations undervalue development-stage drugs for reasons of the same kind — how and when risk is applied, and how the cost of failure is charged.

---

## 1. How specialists build an rNPV

The conventions below are the ones the sources agree on. Where a source gives a number it is quoted.

1. **Build the asset's cash flow as if the drug works, then weight it by the odds.** Sales, cost of goods, sales and marketing, operating overhead and *tax* are modelled for the success case; that whole commercial stream is multiplied by the probability of launch. (Chandra & Mazumdar, *Biotech Asset Valuation Methods: A Practitioner's Guide*, J. Investment Management 2024 — Analysis Group: first-year sales $850M, operating costs 38% of sales, tax 20%, "after-tax cash flow" discounted and then multiplied by the 11.8% probability the drug is commercialised.)
2. **Weight each development cost by the odds of incurring it.** The current phase at 100%; each later phase by the probability of reaching it. (Same source, Table 4; WIPO guide: "we modulate costs by the cumulative probability, as subsequent costs of development will not be incurred if the project fails".)
3. **Discount at a cost of capital, not at a risk-loaded rate.** Technical risk is already in the probabilities. (§0 has the fuller evidence: for a clinical-stage biotech the measured cost of capital is ~13%.) Chandra & Mazumdar use 10.5%; the WIPO guide 10% ("the discount rate should not reflect the drug's specific risk profile… as these factors have been incorporated into the set of cash flows and probabilities"); a practitioner drug-valuation model uses 13% as a blended rate; a survey of large biotechs found a median of 10%. Loading the rate with clinical risk *as well as* using probabilities double-counts it.
4. **Tax is charged on the profits of the success case.** A flat rate on profits in each model above; the probability weighting comes after.
5. **Corporate overhead is handled one of two ways, and neither charges it forever.** Either it sits inside the product's cash flow (SG&A as a share of sales once selling; administrative cost as an uplift on R&D before launch, e.g. R&D × 1.25 — so it is risk-weighted like the R&D it supports), or, in a sum-of-the-parts, it is deducted as the present value of the overhead "required to operate the company during the development period".
6. **Company value = sum of the asset rNPVs + net cash − corporate costs, divided by today's diluted shares.** Future financing is not deducted as dilution: raising money at a fair price does not change value per share. Where an analyst does model a raise, the cash and the shares go in together.
7. **The horizon runs through peak and loss of exclusivity; a terminal value is rare for a single asset.**
8. Common in practice though not in the sources above: **mid-year discounting**, and **ex-US launches lagging the US** by about a year (Europe) to two (Japan).

## 2. RxNPV against those conventions

| Convention | RxNPV today | Verdict |
|---|---|---|
| Success-case commercial flow × P(launch) | Yes — product contribution × posToLaunch | Matches |
| Development cost × P(reach phase), current phase at 100% | Yes (and, since tonight, stages always multiply back to the stated odds) | Matches |
| Discount at a cost of capital (clinical-stage biotech ~13%) | App guidance 15%; PepGen 14%, Stoke 12%; Bear adds +3pp | **Matches**, except Bear's +3pp (§0) |
| Tax on success-case profit, then weighted | Tax on the odds-weighted flow, against the full loss carryforward | **Deviates** — tax understated |
| Overhead not charged forever | Corporate G&A charged at full rate every year for 25 years, in every outcome; after launch it is sized from odds-weighted revenue | **Deviates** — overhead over-counted |
| Future financing: cash and shares together, or not at all | Dilution path adds shares but not the cash they raise; manual raise adds both | **Deviates** — dilution path double-counts costs |
| Net cash as of the valuation date | Cash from the last filing, with costs charged from today | **Deviates** — one quarter's burn counted twice |
| Horizon through LOE, no terminal value | 25 years, terminal value off by default | Matches |
| Mid-year discounting | Year-end | Convention choice (conservative) |
| Ex-US lag | Ex-US sells from the same day as the US | Gap |

## 3. Double counts and over-counts, measured

| | Issue | Direction | PepGen | Stoke |
|---|---|---|---|---|
| **A** | Corporate G&A charged in outcomes where the drug has already failed, for 25 years | too bearish | +$0.71 | +$0.68 |
| **B** | Tax taxed on the odds-weighted flow | too bullish | −$0.25 | −$0.47 |
| **C** | Cash from the last filing, costs charged from today (one quarter counted twice) | too bullish | −$0.14 | −$0.70 |
| **D** | Dilution path adds shares without the cash they raise | too bearish (when on) | $1.38 → $0.57 | none (no raise needed) |
| **E** | ~~Discount rate 12–15% on top of the probabilities~~ — **withdrawn in the second pass:** 12–15% is the measured cost of capital of clinical-stage biotechs; the probabilities carry failure, the rate carries market risk (§0) | — | (+$0.46 at 10.5%, for reference only) | (+$2.89 at 10.5%) |
| **F** | Bear stacks a lower PoS, lower share *and* a higher discount rate | too bearish in Bear | — | — |
| **G** | Benchmark R&D is trial cost only (no manufacturing, staff, extensions) — only when the user does not override it | too bullish | $1.38 → $2.16 | $29.07 → $30.07 |
| **H** | Ex-US sells from day one | too bullish | −$0.12 per year of lag | −$0.30 per year |
| **I** | Year-end discounting | conservative | ~$0.03 | +$1.15 if mid-year |

These interact; the totals are not additive.

## 4. Why PepGen reads bearish — attribution

| Change from the case as built ($1.38) | Value |
|---|---|
| Odds of launch 24% (what the price implies) instead of my 15% | **$2.35** |
| Odds of launch 37.8% (the app's benchmark) | $3.83 |
| Discount rate 10.5% instead of 14% | $1.84 |
| Corporate G&A only while the company exists (A) | ~$2.09 |
| No modelled raise at all (financing-neutral) | $0.94 |

**The biggest single driver is an input, not the engine: the 15% odds of launch.** I set it well below the benchmark for three reasons written in the case's evidence (a flat 5 mg/kg multi-dose result, HARBOR's Phase 3 miss, a partial clinical hold). At the 24% the market implies, the model values PepGen at the market price almost exactly. That is the model working: it says the price is a bet on better odds than I assumed.

The engine issues are real but second-order: A and E make every case too bearish; B, C and H push the other way. Stoke, with no low-PoS judgment call, already reads 17% above its price.

## 5. The user's two concerns about the charts

**"There's no world where the base case is that the drug fails."** Correct, and the model does not assume it: Base is the probability-weighted average of the outcomes, success and failure together. But the screen makes it easy to read otherwise:
- The **year-by-year chart and table show odds-weighted cash flows.** At 15% odds, each year's revenue is 15% of what the drug would sell, set against development costs the company pays for certain — so the running total never recovers. **If the drug works, PepGen earns $400–660M a year from 2033** (cash flow if it works: −69, −90, −142, −113, −40, +18, +198, +426, +461, +553, +633…). The odds-weighted line turns positive in 2032 but only reaches ~$100M a year, and the overhead charged in every outcome (A) eats much of that.
- Several panels show a **failure outcome on purpose** (the failure floor, the outcome tree's failure endings, the readout table's "miss"). They are labelled, but they sit on the Overview next to the headline, and PepGen's floor reads $0.
- Specialists report **two numbers side by side: the unrisked value (if it works) and the risk-adjusted value.** RxNPV computes both but only headlines the second.

**Bear/Base/Bull.** In the convention, all three scenarios are probability-weighted — failure is inside each of them. They vary the commercial assumptions (share, price, timing) and, separately, the odds. What they should not do is also raise the discount rate (F): that charges the same risk a third time.

## 6. Proposed changes, in order

**Fix — engine (each as its own change, hand-checked, both samples re-derived):**
1. **D — dilution path:** add the raised cash with the shares. Price raises from an explicit assumption, not "today less a discount" — the options are the model's own fair value (value-neutral, the convention) or a user-set price.
2. **A — corporate G&A:** charge it while the company is pursuing the drug — before launch weighted by the odds of still being in development, plus the wind-down year already on the Corporate G&A card; after launch, as a share of the *success-case* revenue, weighted by the odds of launch.
3. **B — tax:** compute it on the success-case profits with the company's loss carryforward, then weight by the odds of launch.
4. **C — cash as of today:** keep the filing date and burn from the last 10-Q (the EDGAR pull already returns both) and estimate today's cash; show the estimate and let the user override it. The failure floor then becomes today's cash minus burn to the next readout (the Calibration Log's date) minus the wind-down year — no guessing how far through a trial the company is.
5. **F — scenarios:** keep the discount rate the same across Bear/Base/Bull; vary it only in sensitivity.

**Defaults and guidance:**
6. **E — discount rate guidance (revised):** keep 12–15% for clinical-stage companies — it matches the measured cost of capital — and state the rule in the app: the probabilities carry failure, the rate carries market risk, so never pair a 20–50% rate with probabilities.
7. **G — R&D default:** the benchmark is 4–6× below DiMasi-based phase costs. Replace it with the DiMasi-based figures, and offer the company's reported R&D run-rate (from EDGAR) × years to launch.
8. **H — ex-US lag:** a new input, default one year.

**Presentation:**
9. Headline both values — **"if it works"** and **"risk-adjusted"** — and give the year-by-year card a toggle between the two.
10. Move the failure-outcome panels (floor, tree, readout table) under a clear "if it fails / what each outcome is worth" heading so they are not read as the base case.

**Leave alone:** mid-year discounting (I) as an optional setting only; no terminal value by default; the probability-weighting of commercial flows and R&D, which already matches the convention.

**Not valuation, noted:** Medicaid drug-utilisation data would cover the drugs Medicare does not (paediatric rare disease) — a data-source question for the Commercial workbench, for later.

---

### Sources (second pass)
- Your three: [Lofotr — rNPV valuation](https://lofotrinvestors.com/rnpv-valuation-biotech); [DrugPatentWatch — Valuation of pharma companies](https://www.drugpatentwatch.com/blog/valuation-of-pharma-companies-5-key-considerations-2/); [Ambrosia Ventures — Biotech valuation methods](https://ambrosiaventures.co/insights/guides/biotech-valuation-methods).
- [Alacrita — Valuing Pharmaceutical Assets: When to Use NPV vs rNPV](https://www.alacrita.com/whitepapers/valuing-pharmaceutical-assets-when-to-use-npv-vs-rnpv) (biotech WACC by stage; NPV-rate survey; big-pharma IPR&D rates).
- A. Damodaran, [Valuing Young, Start-up and Growth Companies](https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/younggrowth.pdf).
- Thakor et al., [Just how good an investment is the biopharmaceutical sector?](https://www.nature.com/articles/nbt.4023), *Nature Biotechnology* 35 (2017).
- Hartmann & Hassan, [Application of real options analysis for pharmaceutical R&D project valuation](https://www.researchgate.net/publication/222568571_Application_of_Real_Options_Analysis_for_Pharmaceutical_RD_Project_Valuation-Empirical_Results_from_a_Survey), *Research Policy* 35 (2006).
- [Bluestar BioAdvisors — Approaches to Financial Valuation of Biopharmaceutical Assets](https://bluestarbioadvisors.com/thought-pieces/docs/bluestar-bioadvisors-valuation-case-studies-2018-07.pdf) (2018).
- [EFPIA Patients W.A.I.T. Indicator](https://www.efpia.eu/media/mnfdwzax/efpia-patients-wait-indicator-2025.pdf); FDA–EMA approval gap: [ASCO 2021](https://ascopubs.org/doi/10.1200/JCO.2021.39.15_suppl.1575).
- Yeon et al., [Revisiting risk-adjusted Net Present Value](https://pubmed.ncbi.nlm.nih.gov/42264429/), *Drug Discovery Today* 31 (2026).
- [Biotech Today — Biotech valuation: a practical guide](https://biotechtoday.substack.com/p/biotech-valuation-a-practical-guide) (the dilute-instead-of-cost approach).
- [Wall Street Prep — Mid-year convention](https://www.wallstreetprep.com/knowledge/mid-year-convention/).

### Sources (first pass)
- A. Chandra & S. Mazumdar, [Biotech Asset Valuation Methods: A Practitioner's Guide](https://www.analysisgroup.com/globalassets/insights/publishing/2024-biotech-asset-valuation-methods.pdf), *Journal of Investment Management*, Q1 2024 (Analysis Group).
- WIPO, [Intellectual Property Valuation in Biotechnology and Pharmaceuticals — 3. The income approach](https://www.wipo.int/web-publications/intellectual-property-valuation-in-biotechnology-and-pharmaceuticals/en/3-the-income-approach.html).
- BayBridgeBio, [How to calculate the value of drugs and biotech companies](https://www.baybridgebio.com/drug_valuation.html).
- Stewart, Allison & Johnson, [Putting a price on biotechnology](https://www.nature.com/articles/nbt0901-813), *Nature Biotechnology* 19, 813–817 (2001) — the paper that introduced rNPV.
- Sum-of-the-parts and corporate-cost conventions: [Valuing a Pharma Company: The Sum-of-the-Parts Approach](https://ibinterviewquestions.com/guides/healthcare-investment-banking/valuing-pharma-company-sotp); discount-rate survey and double-counting warning: [Alacrita, Valuing Pharmaceutical Assets: When to Use NPV vs rNPV](https://www.alacrita.com/whitepapers/valuing-pharmaceutical-assets-when-to-use-npv-vs-rnpv).
