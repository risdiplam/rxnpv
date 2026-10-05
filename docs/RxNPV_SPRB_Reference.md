# Spruce Biosciences (SPRB) — reference sheet for the manual trial case

Researched 2026-10-05 from Spruce's own filings and the public registries. Use it to build the SPRB case by hand and to check what the app shows. It is a crib sheet, not a finished case. The **judgment calls** below are left for you, because making them is half of what the trial is testing.

Every figure has its source. Anything marked *verify* came from a secondary summary and should be checked on the primary document before you rely on it.

## The company in one paragraph

Spruce is a single-asset company. Its asset is **tralesinidase alfa (TA-ERT)**, an enzyme replacement therapy for **Sanfilippo syndrome type B (MPS IIIB)**, given into the brain (intracerebroventricular, ICV) every week. There is no approved treatment. Spruce in-licensed TA-ERT (via Allievex, originally BioMarin's BMN 250) after its own drug, tildacerfont, failed in congenital adrenal hyperplasia (CAH). The **BLA is guided for Q4 2026**. It seeks **accelerated approval** on a biomarker, CSF heparan sulfate (HS-NRE), as a "reasonably likely" surrogate. The FDA asked that the confirmatory study (TrAnsform) start while the BLA is under review. The CEO's words: "a potential U.S. commercial launch next year" (Q2 2026 results release, 2026-08-12).

## Facts to type in (sourced)

| Input | Value | Source |
|---|---|---|
| Ticker / price | SPRB, **$45.52** | Close 2026-10-05 (stockanalysis.com). Re-check on the day you build it; the price date field stamps itself |
| Basic shares | **2,874,013** | 10-Q cover, as of 2026-08-10: 2,752,810 at June 30 plus 121,203 sold privately on Aug 10 |
| RSUs | 127,084 | 10-Q Q2 2026, note 9 (shares reserved). Always dilutive: no strike |
| Warrants | 169,147 at **$297** (Feb 2023 private placement, $3.96 before the 1-for-75 reverse split; expire Feb 2028) and 64,000 at **$50** (Avenue lender warrant, $3.2M ÷ $50) | 10-K FY2025, note 8; 8-K 2023-02-09; 10-Q Q2 2026, note 6 |
| Options | 49,174; weighted-average strike **$244.86** on the 42,421 held at Dec 31, 2025 | 10-Q Q2 2026, note 9; 10-K FY2025, options table |
| Convertible feature | Lender may convert up to **$4.0M** of the loan at **$60.00** | 10-Q Q2 2026, note 6 |
| Cash | **$96.3M** at 2026-06-30 (cash and equivalents only) | 10-Q Q2 2026 balance sheet |
| Cash after the quarter | +$5.5M private placement on 2026-08-10 (Cure Sanfilippo Foundation and National MPS Society, at $45.38) | 10-Q, note 13 (subsequent events) |
| Debt | **$7.1M on the balance sheet**; **$16.6M face** ($15.0M principal plus a $1.6M final payment), at ≥12.25% interest | 10-Q Q2 2026, note 6 |
| More debt available | Tranche 2: up to $10M (Mar 1 – Sep 30, 2026, on a regulatory milestone). Tranche 3: up to $15M (Sep 1, 2026 – Mar 31, 2027, on another). Tranche 4: up to $10M discretionary (2027–28) | 10-Q, note 6 |
| ATM | **$75M** with Jefferies, **unused** at June 30 | 10-Q, Liquidity |
| Burn | Cash used in operations H1 2026 ≈ **$30.9M** (≈ $5.1M a month). Q2 operating expenses $16.5M, including $0.9M of stock compensation | EDGAR XBRL; Q2 2026 results release |
| Company runway guidance | "into the second half of 2027" | Q2 2026 results release |
| Owed to BioMarin (licensor) | Up to **$25.5M** for the first MPS IIIB product; up to **$100M per licensed product** in sales milestones; **high-single- to low-double-digit tiered royalties** on net sales | 10-Q Q2 2026, note 3 (Allievex obligations assumed) |
| Designations | Breakthrough, Rare Pediatric Disease (**PRV-eligible**; the program was reauthorized in Feb 2026 through Sep 30, 2029), Fast Track, Orphan (US and EU) | Q2 2026 release; 10-K FY2025 |
| Trials (`trialIds`) | NCT02754076 (Phase 1/2, completed, n=23), NCT03784287 (extension), NCT05492799 (long-term ICV; registered as "Phase 4" by Allievex), **NCT07579910** (TrAnsform, the confirmatory study, Phase 3, n=14, not yet recruiting, start 2026-12), NCT07733856 (expanded access) | ClinicalTrials.gov, read 2026-10-05 |
| Target | **NAGLU** (ENSG00000108784) | Open Targets |
| Key paper | Muschol et al., *J Clin Invest* 2023 (PMID 36413418): the Phase I/II study of ICV tralesinidase alfa | Europe PMC |
| Analog | **Brineura** (BioMarin's ICV ERT for CLN2; Spruce's new CMO helped launch it): net sales $161.9M (2023), $169.1M (2024), **$186.4M (2025)**; first licensed 2017-04-27 | BioMarin 10-K FY2025 |

## Judgment calls — yours to make (log each in the Evidence Log)

- **Current phase.** The pivotal evidence is the Phase 1/2 study plus natural history, and the next gate is the BLA. Choosing **Filed (NDA/BLA)** applies the regulatory-stage odds (median 88% conditional on filing). Choosing Phase 3 would apply Phase 3 odds to a trial that is not the approval gate. Accelerated approval on a surrogate, plus a CMC requirement (two process-validation batches), is the case for a lower figure. Expect to type your own odds.
- **Launch year.** BLA in Q4 2026, and probably priority review given Breakthrough and Rare Pediatric (six months plus the 60-day filing period), would mean a decision around mid-to-late 2027. That makes launch **year 1** from today. A standard review pushes it to year 1–2. The PDUFA date is derived, not company-stated, so it isn't pinnable yet.
- **Patients.** Spruce's August 12, 2026 corporate deck reportedly estimates **~450 patients in North America** and **>3,000 across key territories** (*verify* on the deck's market slide). Spruce's 10-K says only that true prevalence is hard to know (no newborn screening). Severe, early-onset patients are the label population; attenuated patients are in the expanded-access program.
- **Price.** No company figure. The analog is Brineura's list price (look it up; ultra-rare ICV ERTs sit in the high hundreds of thousands a year). This one input moves the value most.
- **Ex-US.** Spruce intends to commercialize globally itself (10-K strategy section), with EU orphan designation. Ex-US timing and price are yours.
- **Debt to enter.** The balance sheet's $7.1M, or the $16.6M face that will actually be repaid. The app's EDGAR pull exports $7.1M and shows the face beside it. Using the face is the stricter choice. Don't also enter the $4M convertible: it's part of the same loan, and at $60 it's out of the money.
- **Fully diluted shares.** At $45.52 only the RSUs are in the money, so about **3.0M** (2,874,013 + 127,084). Simple mode: type it. Detailed mode is the better test: basic shares; options 127,084 at $0 (the RSUs); warrants 64,000 at $50; leave out the $297 warrants (far out of the money).

## What the app can't model directly for SPRB — and the workaround

- **Royalties and milestones owed to a licensor.** Partnership Economics models money a partner pays *to* the company, not money the company owes. Workarounds:
  - Add the royalty (about 10%) to **COGS %** in Cost Structure. Mathematically it's the same thing: a percentage of revenue, before tax.
  - Add the **$25.5M** milestone to **R&D to Launch → Override total cost**. It's then charged before launch, close to the odds of approval, which is slightly conservative.
  - Write both down in the Evidence Log.
  - This is a real gap for in-licensed assets; whether to build a proper input is your decision.
- **Medicare launch data.** Brineura (a children's drug) has **no Medicare record**, and the Launch tracker will say so. Medicare Part B does carry older MPS ERTs: Vimizim, Elaprase, Aldurazyme and Naglazyme, plus Lamzede (launched 2023). They're useful for the shape of a ramp only; their Medicare dollars are tiny.

## What the app should show (expected results)

- **Company Lookup → SPRB:** SPRUCE BIOSCIENCES, INC.; basic shares 2,874,013 (2026-08-10); cash $96.3M (2026-06-30); debt **$7.1M on the balance sheet ($16.6M face)**. An amber line says options and warrants are not tagged and that the filing excludes **409,850** potentially dilutive shares from EPS. That figure is the 233,147 warrants, 49,174 options and 127,084 RSUs, plus a few ESPP shares. Weighted-average diluted (EPS) is about 1.9M; this is not a fully diluted count.
- **Company Lookup → Trial pipeline:** 8 Spruce-sponsored trials, including the tildacerfont studies (CAH, PCOS; most terminated) from before the pivot, the TrAnsform Phase 3 and the expanded-access record. The older TA-ERT trials are sponsored by Allievex, so they appear in Asset Program, not here.
- **Load insider activity (Form 4):** about 15 recent filings, **no open-market buys or sells** (all awards, vesting and withholding), and no buying cluster.
- **Cash Runway → Pull from EDGAR:** about $15.4M a quarter (cash used in operations, a 6-month span); a trailing runway of about 19 months from June 30.
- **Asset Program → "tralesinidase alfa, TA-ERT, AX 250, BMN 250":** 5 trials. A testosterone study matched only by the text "TRT" is dropped and counted. The highest phase reads "Phase 4" because Allievex registered NCT05492799 that way; the drug is not approved.
- **Trial Decoder → NCT07579910:** randomised, single-blind (outcome assessor), parallel, no-treatment control, n=14 (estimated). The primary endpoint is the Bayley-III cognition score at week 260. No posted results.
- **Target Dossier → NAGLU;** **Literature → "tralesinidase alfa":** 12 records, led by the JCI Phase I/II paper.
- **Exclusivity / LOE → Brineura:** biologic, so no Orange Book. Statutory floor **2029-04-27** (12 years from 2017-04-27).
- **Catalysts to log:** "TA-ERT BLA submission", dated **2026-Q4**, pinned as *Other*, source "Q2 2026 results release". The PDUFA decision, about **2027-Q3**, goes in as an unpinned prediction with your odds, since it's derived.
