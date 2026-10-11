# Biotech investing, valuation & trial analysis — baseline context

**What this is.** What was learned while building RxNPV, a personal rNPV valuation sandbox and trial-outcome simulator for a retail biotech investor. It covers practitioner conventions, sourced benchmarks, how to read a trial, regulatory and patent arithmetic, public data sources and their traps, and the working rules that kept the analysis honest. Drop it into a new chat or project as a starting baseline.

**How to treat it.**
- Figures are as of **October 2026** unless dated otherwise. The benchmark tables come from published sources (named in each section) and are averages across many drugs. Use them as defaults to argue against, not as answers.
- Anything about a specific company or drug is dated and will go stale.
- Nothing here is investment advice, and position sizing was deliberately left out.
- The user's own scope line for the tool this came from is worth keeping: *"good enough to help a retail biotech investor improve their analyses. Doesn't need to be institutional grade."*

---

## 1. Working rules that kept the analysis honest

Each of these came from a real mistake that was caught.

1. **Probabilities carry failure; the discount rate carries the cost of capital.** Never use a 20–50% "venture" rate *and* success probabilities together. That double count is the most common valuation error in the sector (§2).
2. **Say what you don't know.** If a registry field is blank, write "not stated", not a default. An unregistered masking field is not "open label". A royalty that was never disclosed is unknown, not "market average".
3. **Hidden is not zero.** Public datasets hide small counts and return a blank. Show the blank as "hidden" (or "≥ X" when only part of the figure is hidden), never $0. If a sum treats a blank as 0, a launch reads as a collapse.
4. **A partial period is not a full one.** Three quarters against a modelled year shows a 25% miss on a drug that is exactly on plan. Compare like with like (same number of quarters), or use an explicitly labelled run rate.
5. **Every rate carries its denominator.** Say "17 extractable of 50 with results", not "17 trials". A summary that quietly drops what it couldn't parse reads as the whole picture.
6. **No composite scores.** Show the evidence base as counts with denominators ("18 of 37 randomised · 11 blinded · 15 with posted results"), never as a weighted score. Invented weights are false precision, and readers anchor on the number. The same goes for press releases: list the phrases and what each means, but don't score them.
7. **Don't infer which arm is the drug.** Name groups as the sponsor named them. Report differences signed, never editorialised. If a registered analysis names only one arm, don't print "A vs B".
8. **Deaths are never dropout,** and neither is moving into an open-label extension. Read as attrition, that once produced "99.8% dropout" on a trial whose real dropout was ~2%.
9. **Label evidence by kind and confidence:** fact / inference / speculation, high / moderate / low. Every model input should be either a disclosed figure or a judgement call with its source and reasoning written down.
10. **Hand-check new math** against values worked out independently, never against the tool's own output. Real bugs caught this way: a units error that inflated dilution ~1,000,000×, a probability-composition bug that understated Bear-case burn, and a fractional launch year that silently zeroed cash flows.
11. **Check every API against the live service, not a saved sample.** Test fixtures encode the same wrong assumptions as the code. Every integration in §11 had at least one surprise that only a live call showed.
12. **Look at the output.** Charts, exports and PDFs passed every automated check while showing the wrong thing. Five separate export bugs were found only by opening the files.
13. **Give two headline values:** "if it works" (unrisked) beside the risk-adjusted value. An odds-weighted Base is otherwise misread as the failure case.
14. **A percentile only means something against a fair reference class.** Peak-sales comps are hand-picked winners, so "above every comp in its area" is a fair flag, but a percentile rank against them misleads.

---

## 2. rNPV — how specialists actually do it

Sources: Stewart, Allison & Johnson, *Nature Biotechnology* 2001 (the paper that introduced rNPV); Chandra & Mazumdar, *J. Investment Management* 2024 (Analysis Group practitioner guide); WIPO valuation guide; Bluestar BioAdvisors 2018; Damodaran (NYU); Alacrita white paper; Lo & Thakor, *Nature Biotechnology* 2017; Yeon et al., *Drug Discovery Today* 2026.

1. **Build the asset's cash flow as if the drug works**: sales, COGS, sales & marketing, overhead and **tax**. Then multiply the whole commercial stream by P(launch).
2. **Weight each development cost by the odds of incurring it.** The current phase counts at 100%; each later phase by the probability of reaching it.
3. **Make the stage odds multiply back to P(launch).** Revenue is weighted by P(launch) and R&D by P(reach phase), so if the two disagree, costs and revenue describe different paths.
4. **Discount at a cost of capital, not a risk-loaded rate.**

   | What | Rate |
   |---|---|
   | Measured cost of capital, public biotech: preclinical | ~17.7% |
   | Clinical stage | **13.3–13.6%** |
   | Commercial | ~8.7% |
   | Big pharma's disclosed rNPV rates for acquired pipeline assets (with explicit probabilities) | Pfizer 13.5%, AstraZeneca 13.0%, J&J 12.2%, Allergan 11.5%, Roche 10.0% |
   | Lo & Thakor CAPM, high-beta biotech | up to ~16% |
   | **Use with rNPV, clinical-stage** | **12–15%** |
   | Plain NPV with *no* probabilities (survey of 242 practitioners) | ~40% early, ~27% mid, ~20% late stage — never pair these with probabilities |

   Bear/Base/Bull keep **the same rate**. The cost of capital doesn't change because a drug's prospects look worse; vary share, price, timing and odds instead.
5. **Tax applies to the success case's profit, after its own loss carryforward, then gets weighted by P(launch).** Taxing the odds-weighted flow against the full carryforward understates tax.
6. **Corporate overhead is not charged forever in every outcome.** Weight pre-launch G&A by the odds the company is still developing (plus a wind-down year). After launch, size it on revenue-if-launched and weight it by P(launch). Charging 25 years of G&A in worlds where the drug failed made every case too bearish.
7. **Financing: cash and shares together, or not at all.** Either model every cost and divide by today's diluted shares, or model a raise's cash *with* its new shares. Adding shares without the cash double-counts the costs. A raise at a fair price doesn't change value per share.
8. **Company value** = sum of asset rNPVs + net cash − corporate costs, ÷ today's diluted shares.
9. **The horizon runs through peak and loss of exclusivity.** A terminal value is rare for a single asset (it is usually a small part of value).
10. **Common conventions:** ex-US launches lag the US (§4); mid-year discounting is a convention worth 3–5% of value (year-end is the conservative choice).
11. **Use cash as the latest filing reported it**, dated, and say so. Rolling it forward by the monthly burn is optional.
12. **R&D benchmark: DiMasi phase costs, not trial-only costs.** Trial-only costs are 4–6× too low because they leave out manufacturing scale-up, staff and nonclinical work (§4).

**A useful sanity check:** solve for the probability the share price implies and compare it with yours. When the gap is large, the disagreement is usually an input, not the engine. In one case, 15% odds against a 24% price-implied figure explained the whole bearish reading.

**A failure floor** you can check by hand: net cash − the current stage's company-share cost − G&A to the readout − one wind-down year of G&A, ÷ shares, floored at zero, undiscounted, before any raise. It deliberately isn't a 0%-odds valuation, because a reader can't verify that.

**Multi-program companies**, especially one drug in several indications:
- Value each catalyst as "if it passes / if it fails". Count every combination of outcomes exactly rather than simulating; with no G&A or tax, the mean equals Base.
- Optional read-across: a failure cuts a sister program's odds by x%, and a pass raises them by u = (1 − (1 − p)(1 − x))/p. This keeps each program's own launch odds, so Base doesn't move.
- One licence across all of a drug's programs: tiered royalties and sales milestones run on the drug's **total** sales, as an exact expectation over which programs succeed.

---

## 3. Probability of success (PoS)

**Base case by phase** (7-source median: DiMasi 2010, Paul 2010, Hay 2014, Smietana 2015, DiMasi 2016, Smietana 2016, Thomas 2016): **Phase 1 → 2: 60% · Phase 2 → 3: 36% · Phase 3 → filing: 63% · Filing → approval: 88.4%** (range 81.5–93; this step is conditional on Phase 3 success). Cumulative from Phase 1 ≈ 12%.

**By therapeutic area** (Thomas 2016 per-phase rates × 88.4% regulatory; cumulative odds of launch):

| Area | P1 → launch | P2 → launch | P3 → launch |
|---|---|---|---|
| All (base case) | 12.0% | 20.0% | 55.7% |
| Hematology | 27.5% | 37.5% | 66.3% |
| Ophthalmology | 19.5% | 23.0% | 51.5% |
| Infectious disease | 19.1% | 27.4% | 64.3% |
| Musculoskeletal | 18.0% | 24.9% | 70.7% |
| Metabolic | 17.4% | 28.5% | 63.1% |
| Gastrointestinal | 14.5% | 19.1% | 53.6% |
| Allergy | 13.9% | 20.5% | 63.1% |
| Endocrine | 13.6% | 23.2% | 57.5% |
| Respiratory | 13.0% | 19.9% | 62.9% |
| Urology | 11.8% | 20.6% | 63.1% |
| Autoimmune | 11.5% | 17.4% | 55.0% |
| Neurology | 8.9% | 15.0% | 50.7% |
| Cardiovascular | 7.0% | 11.8% | 49.1% |
| Psychiatry | 6.2% | 11.7% | 49.2% |
| Oncology | 5.5% | 8.7% | 35.4% |

**Modifiers** (Thomas 2016; per-phase P1 / P2 / P3, against a baseline of 63.2 / 30.7 / 58.1):

| Modifier | P1 | P2 | P3 |
|---|---|---|---|
| Rare disease | 76.0 | 50.6 | 73.6 |
| Selection biomarker | 76.7 | 46.7 | 76.5 |
| No biomarker | 63.0 | 28.8 | 55.0 |
| Chronic, high prevalence | 58.7 | 27.7 | 61.6 |

- Regulatory-step deltas: biomarker +9.2 pts, rare disease +3.9, chronic +1.9, no biomarker −1.4. SPA −3.2 and orphan −2.2 (Hay 2014): these have higher clinical success but similar regulatory success.
- By molecule (P1 / P2 / P3): biologic 68.5 / 42.9 / 70.8; NME 56.6 / 31.4 / 59.6.
- **Combine overlapping modifiers by overlap, not independence.** When rare disease and a selection biomarker push the same way, take the stronger ratio per phase, not the product. The product put a Phase 2 neurology program at 74% odds of launch against ~34% for Thomas's own rare-disease cohort. Opposite-direction effects can multiply.
- **Partnering lens:** about 24–25% of Phase 1–2 terminations are commercial or portfolio decisions, not science. For an acquirer's view, a base case of P1 70% and P2 52% is sometimes used. Don't use it for a company's own asset.
- **Never write a trial's chance of a positive readout ("assurance") in as the launch probability.** P(launch) = P(win the readout in the expected direction) × the benchmark odds of every later step.
- An Open Targets genetic-association score is **not** a probability. It aggregates very different kinds of evidence; keep it qualitative.

---

## 4. Benchmarks for the revenue and cost build

Primary source unless noted: a Pharmagellan-style biotech forecasting reference (table numbers in brackets).

**Development cost (default): DiMasi, Grabowski & Hansen 2016**, median out-of-pocket cost per compound entering each phase, 2023 dollars: **Phase 1 $20.8M · Phase 2 $53.8M · Phase 3 $240.0M**. It's weighted towards large-pharma programs, so a company's own reported R&D is better where known.
- Trial-only "typical asset" costs, for reference: $4M / $13M / $40M (1 Ph1, 1 Ph2, 2 Ph3 trials).
- Per-patient trial cost, weighted average: P1 $114K, P2 $181K, P3 $58K [12-9]. Oncology 167 / 244 / 58; CNS 130 / 232 / 65; hematology Phase 2 is high at $384K. Phase 3 orphan vs non-orphan median: $157K vs $54K per patient.

**Trial duration** (initiation to results [12-3]):
- Weighted average: P2 1.8 years, P3 1.7 years. Oncology 2.6 / 2.8; hematology 2.4 / 2.5; CNS 2.0 / 2.3; renal 2.1 / 2.5; dermatology 0.9 / 1.1; respiratory 0.8 / 1.5.
- Phase 1 ~1.5 years. Total development ~6.5 years.
- Breakthrough designation in oncology: 5.2 vs 7.4 years. Other expedited pathways showed no duration difference.

**Regulatory:** review 1–1.5 years; US filing fee ~$2.6M.

**Launch curve** (Robey & David 2016; % of peak by year, median 6 years to peak): **11, 31, 58, 76, 89, 100**. Slow (25th percentile): 3, 20, 41, 66, 85, 100. Fast (75th): 21, 41, 67, 85, 96, 100. Exact curves exist for 3–10-year ramps, for example:
- 3 years: 31, 76, 100
- 4 years: 21, 58, 83, 100
- 5 years: 15, 42, 68, 86, 100
- 8 years: 8, 21, 37, 58, 71, 83, 92, 100

**Peak share by order of entry** [5-1]:

| Drugs in class | Share by order of entry |
|---|---|
| 2 | 60 / 40 |
| 3 | 40 / 30 / 30 |
| 4 | 31 / 23 / 23 / 23 |
| 5 | 24 / 19 / 19 / 19 / 19 |

**Price bases** (Table 4-1; each row as % of the column basis = 100):

| Basis = 100 | AWP | Retail | WAC | ASP |
|---|---|---|---|---|
| AWP | 100 | 93 | 84 | **74** |
| Retail | 107 | 100 | 90 | 79 |
| WAC | 120 | 112 | 100 | **88** |
| ASP | 135 | 126 | 113 | 100 |

- **ASP is net of rebates and discounts; use it in models.** Entering AWP where ASP belongs overstates revenue by about a quarter. These are cross-drug averages: a modern specialty brand's gross-to-net is often 40–50%, so override with a real figure where you have one.
- Clinic-administered drugs (Medicare Part B, buy-and-bill) are usually quoted as ASP; pharmacy drugs (Part D) as WAC.
- US price growth 2–3% a year (high case up to 10%).

**Ex-US:**
- Price ≈ 50% of US (Germany 0.53, Japan 0.51, UK 0.51, France 0.47, Spain 0.42, Italy 0.41). Growth flat to slightly negative. The UK caps spending growth; Germany discounts above ~€250M; Japan cuts ~2.8% a year.
- Usual sales split: **US ~65% / Europe ~25% / Japan ~10%**, so ex-US ≈ 54% of US.
- **Launch lag ~1.5 years:** EMA approval follows FDA by a median ~6 months, and EU patient access follows EMA by ~1.6 years on average (EFPIA W.A.I.T. 2025; Germany near zero, France, Italy and Spain 1.5–2 years). Japan runs 1–2 years behind the US.

**COGS (% of revenue)** [8-1]: all drugs 11%, biologic 10%, small molecule 15% (up to ~30% for cheap primary-care drugs), cell therapy ~22%, gene therapy ~55%. AAV gene therapy really ranges 30–90%: about $1–2M a dose against $2.1–3.5M list. Price drives COGS more than modality does.

**SG&A and overhead:**
- Mature SG&A ~34% of revenue (26–42%), reached above ~$400M of revenue; large-cap 28%.
- Success-case SG&A for a single product ~20–30% of sales (Bluestar: 5% G&A + 15% promotion).
- Pre-commercial G&A median $8.7M a year (IQR $6.3–12M): by phase P1 $8.1M, P2 $9.2M, P3 $8.7M. ~$225K per employee. Median headcount 35.

**Sales force** [10-3]:
- Fully loaded cost per rep: primary care $190K, specialty $280K, hospital $300K.
- Size: ~100 for a hospital or specialty launch (observed median 85); ~500 for an unpartnered primary-care launch.
- Marketing ~3% of peak revenue as base case, 5–10% in competitive markets.

**Adherence:** acute ~85%; chronic ambulatory ~70%; asymptomatic conditions 50–70%; severe disease ~80%+. **Don't apply adherence twice.** Real-world spend per patient (§10) already includes patients who stop.

**Loss of exclusivity** (LOE):
- Average ~13 years from launch to competition.
- **Small molecule:** ~90% of US volume lost within a year of generics (0–30% retained), plus a 25–50% price fall (oral ~25%, physician-administered 38–46%). 88% unit decline at 12 months (93% for drugs above $250M).
- **Biologic:** ~20% volume loss over years 1–5 and 60–70% of dollar value lost by year 5 (about half of that from price). The source's two figures don't fully reconcile, so decide which lever you trust.
- **Cell and gene therapy:** no precedent for follow-on competition, so model near-zero erosion. Their real decline is the treatable pool running out, which belongs in the launch curve, not in erosion.

**Multiples and deal comps** (77 M&A deals collected, 32 with a disclosed premium):
- **Takeout premium to the undisturbed price: median ~67% (IQR 46–86%)**. Commonly 40–100%+, higher for contested or single-asset de-risked oncology. A positive Phase 2 or 3 readout is the single biggest premium driver.
- Simple multiple, deal value ÷ peak sales: median **7.8×** across 7 precedents (3.6–16.2×). Post-approval M&A multiples don't apply to pre-approval assets without risk-adjusting.
- Acquirer sweet spot: ~$500M–$15B market cap with an approved drug or positive Phase 3 data.
- A healthy early biotech trades at ~2–4× cash. Below 1× means the market sees further R&D spending as value-destroying.

**Licensing heuristics:**
- Upfront is ~5–15% of headline value for preclinical or Phase 1 deals, rising to 20–30%+ for Phase 3 or approved assets. Most headline value is milestones that may never be paid.
- Royalties scale with stage: single digits preclinical (1–4% seen), low-to-mid teens for de-risked clinical assets (10–15% common), high teens for late-stage or differentiated data (15–19% seen).
- A disclosed royalty rate is the exception; "tiered royalties" with no number is the norm. Mega-deals between two large companies often use profit share instead.
- **Model in-licence obligations**: royalty to the licensor on net sales, approval and sales milestones, and a share of sublicence income. They come out of product contribution, so they're weighted by P(launch) and taxed in the success case.

**Revenue-model red flags worth automating:**
- A "napkin" peak and a bottom-up peak that differ by more than 1.5×.
- A territory-limited partnership applied to worldwide revenue.
- Post-approval M&A multiples applied to a pre-approval asset.
- A peak above every comp in its area.
- Cash that runs out before the next dated catalyst.
- PoS modifiers stacked independently.

---

## 5. Reading a clinical trial

**Read the design before the result:** allocation (randomised?), masking (who is blinded?), comparator (placebo, active, standard of care, none), arms, primary endpoint and time point, and superiority vs non-inferiority. Then ask what that design can and can't establish.
- **Phase 1** shows safety and dose.
- **Single-arm Phase 2** shows activity, not efficacy; regression to the mean and selection make it look better than it is.
- **Randomised, blinded Phase 3** can show efficacy.

**Results reader rules** (registry results):
- Never collapse a measure reported across strata into a headline the sponsor didn't register.
- Show "not registered" rather than 0.0%.
- Rank adverse events only against the groups with real denominators. Crossover and re-treatment cohorts of 2 or 9 patients will otherwise top the table.

**Design red flags:** single-arm or open-label for a subjective endpoint; many co-primary endpoints; endpoint or time-point changes; "stopped for benefit" (early stopping overstates effects); small n with a large effect; a primary completion date passed with no results posted.

**Placebo response** (fraction of the placebo arm meeting the responder threshold):

| Indication | Placebo response |
|---|---|
| Depression | 35–40% |
| Neuropathic pain | ~38% at ≥30% relief (7–43% by syndrome; 23% at ≥50%) |
| IBS | ~37.5% (~18–20% on the FDA composite endpoint) |
| Migraine prevention | ~21% (anti-CGRP antibody trials ~29–33%) |
| Psoriasis, biologics | ~4% (PASI-75) |
| Atopic dermatitis | ~13% (EASI-75) |

Objective endpoints leave little room for expectation effects; subjective ones leave a lot.

**Phase 2 → Phase 3 shrinkage** (use as a planning anchor):
- Response rates: early-phase ORR overstated Phase 3 by about one-fifth, so Phase 3 ≈ Phase 2 ÷ 1.20 (2026 concordance analysis of solid-tumour trials).
- An absolute check: early response rates averaged **12.9 points above** later randomised trials of the same drugs, and the earlier figure was higher in 81% of 49 comparisons (Zia et al.).
- Unconfirmed responses (no second scan ≥4 weeks later) shrink further.
- Hazard ratios: assumed at design 0.66 vs observed 0.72 across 111 Phase 3 oncology trials, so multiply the Phase 2 HR by ~1.09 (*JNCI* 2023). A marginal Phase 2 HR can cross 1.0 after shrinkage, which is itself the finding.

**Statistics that change a reading:**
- **False-positive risk** of a "significant" result = α(1 − prior) ÷ [α(1 − prior) + power × prior]. At α = 0.05, 80% power and a 10% prior, about 36% of positives are false.
- **Dead or underpowered?** Compare the interval with the smallest effect that matters. If the interval excludes it, the drug is "dead"; if it includes it, the trial is "underpowered".
- A **nominal p-value** from a test that wasn't pre-specified or wasn't protected by the hierarchy isn't evidence of efficacy.
- **Subgroups:** test the interaction (do the subgroup effects differ?), not whether each is "significant". Example: HARMONi-2's PD-L1-high HR 0.58 vs PD-L1-low HR 0.85, interaction p ≈ 0.16, so no evidence of a difference.
- **Interim analysis:** an O'Brien-Fleming-like Lan–DeMets boundary at information fraction t is very strict early. The final boundary then needs slightly more than 1.96 (e.g. 1.97). Conditional power says whether a trial is on track.
- **Rule of three:** zero events in n patients rules out a rate above ~3/n at 95% (exactly 1 − 0.05^(1/n)). With events, use the Wilson upper bound.
- **Event counts for a hazard ratio** (Schoenfeld): events ≈ 4(z_α + z_β)² ÷ (ln HR)² for 1:1 randomisation. Time-to-event trials are sized by events, not patients, and read out when the events arrive.
- **Non-inferiority:** check what share of the active comparator's effect the margin gives away.
- **Fragility index:** how many patients changing outcome would flip significance. Small numbers mean a fragile result.

**Oncology endpoints:**
- OS is the only endpoint nobody argues about.
- PFS needs blinded independent central review (BICR) to be trusted in open-label trials.
- ORR needs confirmation.
- Surrogate endpoints (MRD, ctDNA, pCR) only matter where they're validated for that disease.

**Press-release reading:** "met the primary endpoint" with no numbers, "clinically meaningful" without a pre-specified threshold, "trend", "numerically", "nominal", "post hoc", and "not powered" each mean something specific. List them; don't score them.

---

## 6. Regulatory and patent arithmetic (US)

**FDA goal dates (PDUFA)**
- **NME NDAs and original BLAs** ("the Program"): 60-day filing period + 10 months standard or 6 months priority, so ~12 or ~8 months from submission.
- **Non-NME NDAs and efficacy supplements:** 10 months standard or 6 months priority, from submission.
- **Resubmissions:** class 1, 2 months; class 2, 6 months.
- A **major amendment** adds 3 months.
- Example: a BLA submitted 2025-11-14 under standard review has a goal date of 2026-11-13.

**Patent term extension (Hatch-Waxman):** half the testing phase (IND to submission, counting only after the patent issued) + the full approval phase (submission to approval), minus any lack of diligence. Capped at 5 years, and the remaining term after approval can't exceed 14 years.

**Regulatory exclusivities:**
- US: new chemical entity 5 years; new clinical investigation 3 years; orphan 7 years; biologics 12 years; paediatric +6 months.
- EU: 8 + 2 + 1 years; orphan 10 years.
- Patent term runs 20 years from filing, not from launch.

**IRA price negotiation:**
- Selection at ~7 years after approval for small molecules (price effective ~9 years) and ~11 years for biologics (effective ~13).
- Drugs approved only for rare disease are excluded; since July 2025 that covers one *or more* rare diseases.
- A tool shouldn't assume a negotiated cut; the outcome varies by drug.

**Catalyst dates are windows.** Store "Q3 2027" or "H2 2026" as a range. A catalyst is overdue only once its window ends, and cash running out *inside* a window is its own state.

**Stage-specific framing:**
- For a filed drug, the next gate is the FDA decision: broad label, narrow label or not approved.
- A rejected filing often comes back. A resubmission branch ("approved a year late") is a reasonable optional scenario.

---

## 7. Capital structure and company financials

- **Cash is mostly marketable securities, under many XBRL tags.** Reading only `CashAndCashEquivalents` once reported $110M of a real $354M. Count current and long-term debt securities dated with the cash; don't count general long-term investments, which can be equity stakes.
- **Burn = cash used in operations** (`NetCashProvidedByUsedInOperatingActivities`, with the year-to-date span divided out), not operating loss. Operating loss includes stock compensation and overstated one company's burn by ~12%.
- **Measure runway from today**, not from the filing date. Subtract the months since the balance-sheet date, or every runway reads long.
- **"Diluted shares" in EDGAR is the EPS weighted average,** which excludes anti-dilutive options for loss-makers. Fully diluted = period-end basic + options and warrants (treasury method at the current price) + RSUs + **convertible preferred as its as-converted common shares** (never treat it as debt).
- **`LongTermDebt` is a total, not a component.** Adding it to `LongTermDebtNoncurrent` double-counted one company's debt. Show a face amount well above carrying value (heavy discount) beside the balance-sheet figure, not in place of it.
- Some filers tag no option counts at all, only the anti-dilutive total. Say "basic shares only" rather than calling them fully diluted.
- **Post-filing events** (8-K placements, ATM sales, preferred issuance) aren't in XBRL. Add them by hand and cite them.
- **Facilities** (undrawn ATM, undrawn debt, shelf capacity, expected milestones) are context, not cash. A shelf isn't runway.
- **A modelled raise priced as "x% below today's price"** follows the stock; a fixed typed price goes stale.

---

## 8. Commercial reality checks

- **Real uptake proxy:** public-payer spending (§10). Read the **shape and direction**, never the level, because it's before rebates and excludes commercial insurance.
- **Launch-shape matching:** index analogs to their first year in the data, compare whole years only, and flag any analog that was already selling when the data begins (its "year 1" is a plateau). Fit years-to-peak to the published median, slow or fast curve.
- **Reported vs modelled revenue:** use the product revenue line, not total revenue (collaboration and milestone income is a different number). Compare full years, or explicitly labelled run rates.
- **Price per patient-year from a price per dose:** doses a year × price per dose. Time on treatment belongs in the population step (for cancer, "years each patient is treated").
- **Real-world spend per patient sits well below list.** Keytruda's 2024 Medicare Part B spend was ~$79K per patient against ~$194K for a full year at Medicare's rate ($55.72/mg, 200 mg every 3 weeks), because most patients aren't on it all year.

---

## 9. Free public data sources (all without keys)

| Source | What it gives | Endpoint |
|---|---|---|
| ClinicalTrials.gov v2 | Trial records, results, search | `clinicaltrials.gov/api/v2/studies` |
| openFDA | Drugs@FDA approvals, labels, FAERS, NDC directory | `api.fda.gov/drug/{drugsfda,label,event,ndc}.json` |
| Orange Book / Purple Book | Patents and exclusivities | via openFDA / FDA files |
| SEC EDGAR | XBRL company facts, submissions index, full-text search, Form 4 XML | `data.sec.gov/api/xbrl/companyfacts/CIK##########.json`, `data.sec.gov/submissions/CIK…json`, `efts.sec.gov/LATEST/search-index` |
| CMS (data.cms.gov) | Medicare Part D & B spending (annual + quarterly), Medicaid Spending by Drug (annual) | `data.cms.gov/data-api/v1/dataset/{id}/data` |
| Medicaid (data.medicaid.gov) | State Drug Utilization Data, one file per year | `data.medicaid.gov/api/1/datastore/query/{id}/0` |
| Open Targets | Target–disease genetics, drugs against a target | GraphQL `api.platform.opentargets.org/api/v4/graphql` |
| Europe PMC | MEDLINE + PMC + preprints, with publication types | `ebi.ac.uk/europepmc/webservices/rest/search` |

- **EDGAR requires a descriptive User-Agent with a contact address**, and isn't CORS-open (call it server-side).
- Europe PMC isn't "European": its MED source is all of MEDLINE/PubMed. Its value is that it labels each paper's type (RCT, meta-analysis, review, preprint).

**Retry policy:** retry only what a second try can fix: no connection, a timeout (once), 408/425/429/5xx. Do it up to twice with jitter (~0.7s, then ~1.75s), honouring Retry-After capped at ~8s. **Never retry 400/403/404**; let each caller interpret those (openFDA's 404 means "no matches").

---

## 10. Medicare and Medicaid drug spending — what it is and its traps

**Datasets:**
- **Medicare Part D** (pharmacy) and **Part B** (clinic-administered). Annual files lag ~1.5–2 years; **quarterly files are only ~1 quarter behind** (2026 Q1 was out by July 2026). They give spending, beneficiaries, claims and averages per beneficiary, claim and unit.
- **Medicaid:**
  - CMS's **annual Medicaid Spending by Drug** (same API as Medicare; 2020–2024 as of Oct 2026) is totalled *before* small counts are hidden.
  - The **State Drug Utilization Data** has one file per year and each quarter about **3 months** after it ends. It gives units, prescriptions and amount reimbursed per package (NDC), per state, fee-for-service and managed care. State `"XX"` rows are the national totals.
  - Where both files cover a year they agree within a few percent; the annual file is CMS's cleaned summary.
- For **children's drugs Medicaid is most of the public picture**: Fintepla 2024, $190M Medicaid vs $41M Medicare; Exondys 51, $257M vs $27M. Some drugs are **absent from Medicare's Part B file entirely** (Spinraza) but present in Medicaid ($113M in 2024).

**Traps** (each found only with live calls):
1. **One drug, several spellings:** "Exondys 51" (FDA), "Exondys-51" (CMS Medicaid summary), "EXONDYS 51" cut to ten characters (state file). Normalise names to letters and digits only. Resolve brand or generic through the FDA NDC directory, and match the state file on **labeler + product code** (11-digit NDC 5-4-2, zero-padded: "60923-284" → labeler 60923, product 0284).
2. **A generic name may also be a brand.** Unbranded biosimilars are sold under the molecule's name ("adalimumab"). When a generic has several brands, ask which one; never auto-pick.
3. **Small-count hiding:** the state file hides any package-quarter under 11 prescriptions and returns a blank. One-dose gene therapies split across many weight-based kits (Zolgensma, Elevidys) are hidden in every quarter, though the annual summary has them ($119M and $170M in 2024).
4. **CMS appends a footnote asterisk to some names, inconsistently between its own datasets** ("Uptravi" vs "Uptravi*"). Retry with the asterisk.
5. **Part B lists a drug once per billing code (HCPCS)** and spells its average columns `Avg_Spndng_…` where Part D and Medicaid write `Avg_Spnd_…`. Sum codes for spending and claims, but not patients (one patient can sit under two codes).
6. **Medicare files repeat each drug per manufacturer plus an "Overall" row.** Summing them double-counts.
7. **Medicare's quarterly file labels periods as free text** ("2025 (Q1-Q4)", "2026 (Q1)"). Parse quarter counts and never compare a quarter with a year.
8. **Inpatient hospital drugs never appear** (they're paid inside the hospital fee).

**Spend figures as a price per patient-year** (all before rebates, so set the price basis accordingly):
- Medicare Part D average per beneficiary → **WAC-ish basis** (gross pharmacy payment).
- Medicare Part B average per beneficiary ÷ **1.06** → **ASP basis** (Part B pays ASP + 6%).
- Medicaid average per prescription × prescriptions a year (Medicare's claims per patient is a stand-in; a child's dosing differs) → WAC-ish basis. Medicaid's own rebate is not netted: the basic rebate for a brand drug is 23.1% of AMP or AMP − best price, whichever is larger, plus an inflation penalty.
- All of these are per patient **in** a year, part-year patients included, so don't apply an adherence haircut on top.
- Example, Keytruda 2025: Part D ~$77K, Part B ~$77K at ASP, Medicaid ~$71K. Three payers agreeing is a good sign the figure is real.

---

## 11. API lessons from the other integrations

**ClinicalTrials.gov:**
- **v2 drops top-level fields you don't request.** `hasResults` sits outside `protocolSection`; a filtered query omits it, and a parser that defaults it to false states, confidently, that no trial posted results. Assert field lists in tests.
- **`paramType` is free text** ("Hazard Ratio (HR)", "CMH ESTIMATE OF COMMON ODDS RATIO"). Pattern-match it narrowly, and refuse transformed scales (log HR has a null of 0, not 1).
- **Condition search expands synonyms into other diseases.** "Myotonic dystrophy type 1" → "DM1" → T-DM1 (trastuzumab emtansine): 18 of 23 hits were cancer trials. Re-check each hit against its own conditions, keywords, titles and MeSH terms, and count the drops.
- **`query.intr` is a loose text search** that returns other drugs' trials. Re-check each hit against its registered intervention names (including `otherNames`).
- **Drugs have many names:** zorevunersen is registered only as "STK-001". Search all names with OR.
- **Sponsors are names, not tickers.** Use the company's registered name with the legal suffix dropped.
- **An analysis can register fewer arms than it compares** (DAPA-HF lists one group for a two-arm HR). Don't print "A vs B" unless both are named.
- **Mega-trials break assumptions.** NCT04368728 registers 64 primary endpoints and 20 arms; KEYNOTE-189 registers ~44,000 "not completed" who actually entered the open-label period. Test against them.
- **Version history is internal-only** (403). Outcome switching can't be read retroactively; snapshot records and diff them yourself.

**EDGAR:**
- **Full-text search returns hits in relevance order, not date order** (2008 filings among the top 10). For "most recent filings of type X", use the submissions index, which is reverse-chronological.
- A submission's `primaryDocument` is the rendered view (`xslF345X06/ownership.xml`); strip the stylesheet folder for the raw XML.
- **Form 4 flags are written as `1`/`0` and as `true`/`false`.**
- Split insider activity by **transaction code**, not by table: only P and S are open-market buys and sells. Restricted-stock awards sit in the non-derivative table and would otherwise read as "bought".
- Full-text search names the form `form` / `root_forms` (not `form_type`).

**openFDA:**
- The label section is `warnings_and_cautions` (`warnings` on older labels); `warnings_and_precautions` doesn't exist.
- 404 means no match.
- Open Targets returns `APPROVAL` for approved drugs; match `/APPROV/`.

**Open Targets v4 has moved:** `knownDrugs` is now `drugAndClinicalCandidates`, disease entries are wrappers without `name`, and stages arrive as `"PHASE_3"`. Introspect the live schema first.

---

## 12. Worked reference cases (dated; for calibration, not current advice)

| Case | Setup | Read (as of research date) |
|---|---|---|
| **Stoke / zorevunersen** (Dravet, Phase 3 ASO, Sep 2026) | 12% discount rate; Southampton licence (2% royalty judged + 5% of partner income) | Bear / Base / Bull $16.86 / $28.01 / $40.71 vs $24.80; price implies ~56% odds vs the case's 65%; if it fails ~$1.30 |
| **PepGen / PGN-EDODM1** (DM1, Phase 2, Sep 2026) | 15% odds (below a 37.8% benchmark, after a flat dose cohort, a rival's Phase 3 miss and a partial clinical hold); 1% royalty to OUI | Bear / Base / Bull $0.89 / $1.66 / $3.07 vs $2.34; price implies ~24% odds. At 24% the model matches the price, so the gap is the odds input, not the engine |
| **Summit / ivonescimab** (PD-1×VEGF bispecific, BLA filed, 5 indications, Oct 2026) | Akeso licence at 11% plus $3.5B of sales milestones across all programs; AstraZeneca's $2.0B convertible preferred counted as ~109M common shares | Bear / Base / Bull $5.13 / $8.35 / $12.79 vs $17.17. Every program working ≈ $18.06; ~92% of the 214 possible endings sit below the price |

What these taught:
- A case reads bearish or bullish mostly because of its **odds input**. Write down why the odds differ from the benchmark.
- Licences and preferred stock are easy to miss and material: ~$2.20 a share at Summit if the preferred is treated as debt.
- A multi-indication drug needs its catalysts valued jointly (read-across), not one at a time.

---

## 13. Scope traps — deliberately not done, with reasons

- **Position sizing of any kind:** investment-advice territory with no clear criterion.
- **Composite "quality" or "conviction" scores** for trials, evidence or press releases: false precision.
- **Open Targets scores as PoS inputs:** heterogeneous evidence, not a probability.
- **Group-sequential design engines:** past the retail scope. A single "what result crosses this interim" calculator is enough.
- **13F institutional holdings, regulatory precedent libraries, platform-correlation SOTP, molecular-property metrics:** each was considered and judged not to change a retail decision.
- **Payer formulary/coverage data:** genuinely drives uptake, but no reliable free source exists. Don't fake it.
- **Reading pipelines out of 10-K free text:** fragile parsing. Worth doing only with a structured source.

---

## 14. If you're building software for this

- Keep the math in pure functions with hand-worked checks in comments. Fix random seeds where results are compared, and set Monte Carlo tolerances ≥ 4 standard errors.
- **String-replace traps:** in JavaScript, `str.replace(x, bigString)` interprets `$'`, `$&` and `$$` in the replacement. Use a replacement *function* for arbitrary content.
- Format dates without timezone drift: build ISO dates from UTC parts by hand, never `toISOString().slice(0, 10)` on a local date.
- jsdom doesn't enforce Content-Security-Policy. Any CSP change (e.g. adding a new API host) must be checked in the real app.
- Persistence that fails silently loses user data. Return success or failure from every save and warn on failure.
- A clickable `div` isn't keyboard-reachable; use real buttons or the equivalent ARIA and keyboard handling.
- Chart axes should use round steps (1, 2, 2.5 or 5 × 10ⁿ) so zero is a labelled gridline. Draw probabilities against 100%, not against the largest value shown. Don't let labels collide with marks or each other.
- Readings ("what this result means") should be pure, never compute a new number, return nothing when there's nothing honest to say, and say which way a result sits, not which way is good when the tool can't know.
