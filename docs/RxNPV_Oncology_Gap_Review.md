# Oncology gap review: building Summit Therapeutics (SMMT)

October 9, 2026. The user asked for an oncology sample case built for real, to find out what the app misses when it parses an oncology stock. Spark's book-sourced handoff (October 9) was reviewed against the code on the same day, and several of its items were held back until this exercise showed whether they mattered. This is the record of what the attempt found.

## The case

Summit Therapeutics: one molecule, ivonescimab (a PD-1 × VEGF bispecific in-licensed from Akeso), in several indications at different stages. It is modelled as one program per indication. The draft lives in `sampleCaseSummit()`; its inputs are not final.

| Program | Stage | Next gate | Trial |
|---|---|---|---|
| 2L+ EGFR-mutant NSCLC, with chemo | BLA filed (Q4 2025, standard review) | FDA decision, November 14, 2026 | HARMONi, NCT06396065 |
| 1L squamous NSCLC, vs pembrolizumab + chemo | Phase 3 | PFS events 2H 2026, interim OS alongside | HARMONi-3, NCT05899608 |
| 1L non-squamous NSCLC (with PD-L1-high monotherapy) | Phase 3 | PFS events 1H 2027 | HARMONi-3 / HARMONi-7, NCT06767514 |
| 1L metastatic colorectal, vs bevacizumab + FOLFOX | Phase 3 | ~2028 | HARMONi-GI3, NCT07228832 |

**Sources:**
- Q2 2026 10-Q:
  - 797,749,602 shares at July 17.
  - $690.7M cash and investments at June 30.
  - 118.4M options at $4.45 and 730K RSUs.
  - Burn: $263.4M of cash used in H1.
- AstraZeneca's $2.0B Class A convertible preferred (8-K, September 29, 2026): 108,955.37 preferred shares, each converting into 1,000 common, at $18.3561.
- The new $380M ATM (July 23, 2026).
- The Akeso licence (FY2025 10-K):
  - a low-double-digit royalty;
  - up to $1.05B of regulatory milestones;
  - up to $3.505B of commercial milestones on annual revenue.
- Patents expire 2039–2040.
- HARMONi:
  - PFS HR 0.52 (0.41–0.66).
  - Primary OS HR 0.79 (0.62–1.01; p = 0.057 against the required 0.0448).
  - Updated OS 0.76 (0.61–0.95), a nominal p-value.
  - Western-patient OS HR: 0.98 → 0.84 → 0.76 as follow-up grew.
- ACS 2026: 229,410 lung and 158,850 colorectal cases.
- Medicare Part B 2024, Keytruda:
  - $55.72 per mg;
  - $79,464 per beneficiary per year.
- Price $17.17 (October 8 close).

**Draft valuation:**
- Bear $5.22, Base $8.50, Bull $12.96.
- **If every indication works: $15.03, still below the $17.17 price.**
- The market is paying for more than these four indications (16 Phase 3s exist across the molecule), a premium price, or odds this case does not grant.

## What the attempt found

### Defects (fix regardless)
1. **Every indication is labelled with the drug name.** Program tabs, the section list, Sum-of-the-Parts and the company revenue legend all say "ivonescimab", four times over (SOTP numbers them 1–4). A drug in several indications is the normal oncology case. Labels should fall back to the program name when two programs share a drug name.
2. **The simulator's "Program to apply the odds to" picker is 22px tall.** It only appears on multi-program cases; ui_audit flagged it (control under 28px).

### Gaps that matter for oncology (and for any multi-program company)
3. **The catalyst features are single-program only.** A multi-program case gets none of these:
   - the failure floor ("No failure floor with more than one program");
   - the outcome tree;
   - Before the next readout;
   - the case at a glance;
   - the memo's odds;
   - the Binary Event prefill;
   - the Overview's implied odds (it shows a multiple instead).

   The questions an SMMT holder asks are exactly these, per catalyst: what is the November 14 decision worth either way, and what is HARMONi-3's squamous PFS readout worth?
4. **Licence terms are drug-level, but the app keeps them per program.** Akeso's $3.5B of commercial milestones trigger on total ivonescimab sales in Summit's territories. Entered per program, a milestone fires on one indication's sales and misses the drug's total. Royalties are linear, so they're unaffected; tiered royalties and sales milestones are not.
5. **Convertible preferred that participates as common.** AstraZeneca's preferred converts 1:1,000, takes dividends as-converted and shares pro rata in liquidation: economically, common stock. The app has only an if-converted *note* field. It treats $2.0B as debt while the price ($17.17) sits below conversion ($18.36), which costs ~$2.20 a share. Non-voting convertible preferred is the usual instrument in biotech PIPEs, so this recurs well beyond Summit. The workaround (adding the shares to basic shares by hand) is invisible in the case.
6. **Oncology revenue is time on treatment, but the field says disease duration.** Incidence mode's "Disease duration (yrs pt lives w/ disease)" is the right arithmetic for oncology only if typed as *time on drug* (~0.6–0.85 years here, against a disease course twice that). Typing the disease duration would overstate revenue. Medicare's spend per beneficiary ($79K a year for Keytruda, far below a $200K full-year list price) is the real-world anchor and is already fetched by Launch & Actuals.
7. **"Who reads out first" is noise in a big indication.** There are 342 active Phase 3 trials in NSCLC. Searching by the rival drugs' names (pumitamig/BNT327, PF-08634404/SSGJ-707, MK-2010/LM-299) gives 13 Phase 3s, reading out 2028–2032: the answer an investor wants.

### Spark's items that this case makes concrete
8. **Dead or just underpowered:** HARMONi's primary OS, 0.79 with an upper bound of 1.01, is a miss that still includes a meaningful benefit.
9. **Subgroup claim check:** Western versus Asian HRs, the debate around the BLA.
10. **FDA decision date from the submission date:** the BLA was submitted in Q4 2025 with standard review, giving November 14, 2026. That is 12 months for an original BLA, which Spark's 10-from-submission reading would get wrong.
11. **Patent term extension:**
    - patents 2039–2040;
    - the biologic floor at 2038;
    - the 14-years-after-approval cap at 2040.
12. **Nominal p-values:** HARMONi's later OS p-values (0.0332, 0.0151) come from unplanned follow-up and are not confirmatory. That is worth a reading wherever a p-value is typed.
13. **Interim analyses as catalysts:** HARMONi-3 runs an interim OS alongside the PFS readout and another in 1H 2027. "What hazard ratio clears this interim" is a small calculator, not the group-sequential engine that was declined.

### Considered, not proposed
- **Spark's surrogate grader (P1) and meaningful-benefit table (P8):** both need tables that do not exist (Spark says so). A judgment entry in the Evidence Log carries the PFS-versus-OS question better.
- **A comparator going biosimilar** (Keytruda around 2028 lowers the price of the regimen ivonescimab is compared with): a price-growth input already expresses it, and an evidence entry should say so.
- **A guard against counting the same patients in two indications** (HARMONi-7's PD-L1-high patients are inside 1L NSCLC): a modelling judgment, recorded in evidence.
