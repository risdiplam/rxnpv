# RxNPV — rNPV methodology review (2026-09-30)

Written at the user's request after the PepGen pass: *"we need to step back and really look deeply into how an rNPV for a biotech is done by genuine specialists and the conventions they use."* Nothing here has been changed in the code yet. Every figure is from the two sample cases (PepGen, Base $1.38 at a $2.34 price; Stoke, Base $29.07 at $24.80), computed on the engine as it stands.

---

## 1. How specialists build an rNPV

The conventions below are the ones the sources agree on. Where a source gives a number it is quoted.

1. **Build the asset's cash flow as if the drug works, then weight it by the odds.** Sales, cost of goods, sales and marketing, operating overhead and *tax* are modelled for the success case; that whole commercial stream is multiplied by the probability of launch. (Chandra & Mazumdar, *Biotech Asset Valuation Methods: A Practitioner's Guide*, J. Investment Management 2024 — Analysis Group: first-year sales $850M, operating costs 38% of sales, tax 20%, "after-tax cash flow" discounted and then multiplied by the 11.8% probability the drug is commercialised.)
2. **Weight each development cost by the odds of incurring it.** The current phase at 100%; each later phase by the probability of reaching it. (Same source, Table 4; WIPO guide: "we modulate costs by the cumulative probability, as subsequent costs of development will not be incurred if the project fails".)
3. **Discount at a cost of capital, not at a risk-loaded rate.** Technical risk is already in the probabilities. Chandra & Mazumdar use 10.5%; the WIPO guide 10% ("the discount rate should not reflect the drug's specific risk profile… as these factors have been incorporated into the set of cash flows and probabilities"); a practitioner drug-valuation model uses 13% as a blended rate; a survey of large biotechs found a median of 10%. Loading the rate with clinical risk *as well as* using probabilities double-counts it.
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
| Discount at a cost of capital (~10–13%) | App guidance 15%; PepGen 14%, Stoke 12%; Bear adds +3pp | **Deviates** — part double-count of risk |
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
| **E** | Discount rate 12–15% on top of the probabilities (vs ~10.5%) | too bearish | +$0.46 at 10.5% | +$2.89 at 10.5% |
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
6. **E — discount rate guidance:** move the benchmark to the 10–12% practitioners use with rNPV, and say why (risk is in the probabilities).
7. **G — R&D default:** when the user has not overridden it, warn, and offer the company's reported R&D run-rate (from EDGAR) × years to launch.
8. **H — ex-US lag:** a new input, default one year.

**Presentation:**
9. Headline both values — **"if it works"** and **"risk-adjusted"** — and give the year-by-year card a toggle between the two.
10. Move the failure-outcome panels (floor, tree, readout table) under a clear "if it fails / what each outcome is worth" heading so they are not read as the base case.

**Leave alone:** mid-year discounting (I) as an optional setting only; no terminal value by default; the probability-weighting of commercial flows and R&D, which already matches the convention.

**Not valuation, noted:** Medicaid drug-utilisation data would cover the drugs Medicare does not (paediatric rare disease) — a data-source question for the Commercial workbench, for later.

---

### Sources
- A. Chandra & S. Mazumdar, [Biotech Asset Valuation Methods: A Practitioner's Guide](https://www.analysisgroup.com/globalassets/insights/publishing/2024-biotech-asset-valuation-methods.pdf), *Journal of Investment Management*, Q1 2024 (Analysis Group).
- WIPO, [Intellectual Property Valuation in Biotechnology and Pharmaceuticals — 3. The income approach](https://www.wipo.int/web-publications/intellectual-property-valuation-in-biotechnology-and-pharmaceuticals/en/3-the-income-approach.html).
- BayBridgeBio, [How to calculate the value of drugs and biotech companies](https://www.baybridgebio.com/drug_valuation.html).
- Stewart, Allison & Johnson, [Putting a price on biotechnology](https://www.nature.com/articles/nbt0901-813), *Nature Biotechnology* 19, 813–817 (2001) — the paper that introduced rNPV.
- Sum-of-the-parts and corporate-cost conventions: [Valuing a Pharma Company: The Sum-of-the-Parts Approach](https://ibinterviewquestions.com/guides/healthcare-investment-banking/valuing-pharma-company-sotp); discount-rate survey and double-counting warning: [Alacrita, Valuing Pharmaceutical Assets: When to Use NPV vs rNPV](https://www.alacrita.com/whitepapers/valuing-pharmaceutical-assets-when-to-use-npv-vs-rnpv).
