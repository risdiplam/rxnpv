// ════════════════════════════════════════════════════════════════════════════
// Sample case — Stoke Therapeutics (STOK), zorevunersen in Dravet syndrome
// ════════════════════════════════════════════════════════════════════════════
// A complete, sourced case a new user can open to see what a finished model
// looks like. Every input is either a disclosed figure (10-K for FY2025, the
// Q2 2026 10-Q filed 2026-08-03, company press releases, NEJM 2026) or a
// judgment call written up in the Evidence Log with its reasoning and a
// confidence level. Researched 2026-09-27; the numbers are a snapshot, and the
// case says so in its own evidence entries.
//
// Loaded as a NEW case with fresh ids (see "Load sample case" in the case
// list), so it never touches a case the user built themselves.
const SAMPLE_CASE_AS_OF = "2026-09-27";

function sampleCaseStoke() {
  const base = newCase();
  const prog = newProgram();
  const ev = (label, classification, confidence, source, thesis) =>
    ({ id: newId("ev"), label, classification, confidence, source, date: SAMPLE_CASE_AS_OF, thesis });

  const program = Object.assign(prog, {
    name: "Zorevunersen (STK-001)",
    drugName: "Zorevunersen",
    indication: "Dravet syndrome — SCN1A, not gain-of-function (ages 2 to <18 in Phase 3)",
    therapeuticArea: "Neurology",
    // An antisense oligonucleotide is a chemically synthesised drug approved
    // through an NDA (as Spinraza was), not a BLA — so small-molecule
    // exclusivity rules (5-yr NCE + 7-yr orphan), not the 12-yr biologic term.
    modality: "smallMolecule",
    currentPhase: "phase3",
    posBiomarkerUse: "selection",   // genetically confirmed SCN1A patients only
    posDiseaseType: "rare",
    trialIds: "NCT06872125",       // EMPEROR (Phase 3)
    target: "SCN1A",
    posOverridePct: "65",
    // Company guides a US launch in early 2028, ~1.4 years out. The model works
    // in whole years (a typed 1.5 is used as 2), and year 1 puts the first
    // sales year's cash at ~Sep 2028 under end-of-year discounting — close to
    // the real Feb 2028–Feb 2029 first year. Year 2 would push every
    // revenue year back a full year.
    launchYearOffset: "1",
    revenueMode: "full",
    prv: { enabled: true, valueM: "190" },
    rndOverride: { totalYears: "1.4", totalCostM: "200" },
    revenueBuild: {
      population: { mode: "prevalence", prevalence: "15700", incidence: "", diseaseDurationYears: "", diagnosisRatePct: "75", treatmentRatePct: "60", eligiblePct: "80" },
      adherencePct: "85",
      marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "" },
      launchCurve: { yearsToPeak: 5, profile: "median" },
      pricing: { usAnnualPrice: "375000", priceBasis: "WAC", netPriceRealizationPct: "80", usAnnualGrowthPct: "3", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "140" },
      exclusivity: { yearsToLOE: "12", modality: "smallMolecule", volumeRetainedPct: "45", priceDeclinePct: "35" }
    },
    costStructure: { cogsPct: "10", reps: { primaryCare: "0", specialty: "50", hospital: "0" }, marketingPctOfPeak: "3" },
    partnership: {
      enabled: true, territory: "exUS", royaltyPct: "15", upfrontM: "0", costSharingPct: "30",
      milestones: [
        { id: newId("ms"), label: "Ex-US regulatory milestones — assumed part of the undisclosed $385M", gate: "launch", valueM: 100 }
      ]
    },
    evidenceLog: [
      ev("Lead asset and mechanism", "fact", "high", "Stoke 10-K FY2025 (filed 2026-03-16), Business",
        "Zorevunersen is an antisense oligonucleotide that up-regulates NaV1.1 from the working copy of SCN1A — aimed at the cause of Dravet syndrome, not only the seizures. Breakthrough Therapy (Dec 2024), Orphan Drug (US 2019, EU 2022), Rare Pediatric Disease (Oct 2022). Note: elsunersen, sometimes confused with it, is Praxis Precision Medicines' ASO for SCN2A epilepsy."),
      ev("US prevalence: 15,700", "fact", "moderate", "Stoke 10-K FY2025 — company estimate from Wu et al., Pediatrics 2015 incidence, scaled with Clearview Healthcare Partners",
        "1 in 15,600 births; ~15,700 living with Dravet in the US and ~38,000 across the US, UK, EU4 and Japan. A company estimate, so read it as the top of the plausible range."),
      ev("Eligible share: 80%", "fact", "high", "Stoke 10-K FY2025",
        "~85% of Dravet cases carry a pathogenic SCN1A variant and >95% of those are loss-of-function; the Breakthrough designation covers SCN1A variants not associated with gain of function. 85% x 95% ≈ 81%, rounded to 80%."),
      ev("Diagnosed 75%, treated 60%", "inference", "low", "Judgment; Goldman Sachs initiation (Sep 2026) cites >6,000 initially addressable US patients",
        "Diagnosis is clinical first and genetic second, so not every Dravet patient has the confirmed SCN1A result the label will likely require. Intrathecal dosing every four months is a real barrier for some families. 15,700 x 75% x 60% x 80% ≈ 5,650 treatable, in line with Goldman's >6,000. The least certain input in the build."),
      ev("Price: $375K/yr WAC (Spinraza analog)", "inference", "moderate", "Spinraza maintenance-year WAC ~$375–400K (NY Medicaid DUR 2020; 2016 launch reporting)",
        "Same company (Biogen, ex-US), same modality (intrathecal ASO) and the same every-four-months maintenance cadence. Stoke has not disclosed a price. Entered as WAC, so list price is not treated as revenue."),
      ev("Gross-to-net: 20% (80% of WAC realized)", "inference", "moderate", "Judgment; Medicaid Drug Rebate Program minimum 23.1% for brand drugs",
        "The app's default converts WAC with Table 4-1's all-drug average (12%), and flags that as low for a specialty brand. Dravet patients are mostly children, many on Medicaid or disability coverage, where the statutory rebate is at least 23.1%; commercial rare-disease plans give far smaller discounts. A blended 20% is a middle reading; 30% would cut US revenue by another eighth."),
      ev("Phase 1/2 efficacy", "fact", "high", "Zorevunersen in Children and Adolescents with Dravet Syndrome, NEJM 2026;394:969–982 (Mar 5, 2026)",
        "Patients given 70 mg (1–3 doses) then up to 45 mg in the extension had median convulsive-seizure reductions of −58.8% to −90.9% across monthly intervals over the first 20 months, on top of standard anti-seizure drugs, with Vineland-3 gains through 36 months. Open-label: no control arm, so the size of the effect is not proven — that is EMPEROR's job."),
      ev("EMPEROR Phase 3 design and timing", "fact", "high", "10-K FY2025; Q2 2026 10-Q; enrollment press release 2026-06-30; ClinicalTrials.gov NCT06872125",
        "Randomised, double-blind, sham-controlled; 162 patients enrolled in the US, UK and Japan in 10 months (the population for the US NDA; enrollment in China continues — ClinicalTrials.gov lists 170 — but Stoke does not plan to include those patients in the US filing); 70 mg x2 loading then 45 mg x2 over 52 weeks. Primary endpoint: % change in major motor seizure frequency at week 28. Readout Q3 2027, rolling NDA from Q1 2027, US launch targeted early 2028."),
      ev("PoS to launch: 65%", "inference", "moderate", "Judgment; Goldman Sachs uses 75%",
        "The app's benchmark with both program attributes applied stacks to ~97%, and the app itself warns that multiplying the two overstates the odds — so an explicit override is the honest input here. Above the plain Neurology Phase 3 benchmark because the effect in open-label data is large, the endpoint (seizure frequency vs sham) is one approved Dravet drugs have met, and patients are genetically selected. Held below Goldman's 75% because open-label seizure data overstate controlled effects (placebo response in epilepsy trials commonly runs 15–25%) and intrathecal CSF-protein findings need a clean safety read."),
      ev("Remaining R&D: $200M over 1.4 yrs, Biogen pays 30%", "inference", "moderate", "Q2 2026 10-Q (R&D $49.5M in Q2); Biogen agreement",
        "R&D ran $89.2M in H1 2026 across all programs; most is zorevunersen. ~$140M/yr for the ~1.4 years to launch ≈ $200M. Biogen funds 30% of external clinical costs; applying it to the whole figure slightly overstates the sharing."),
      ev("Biogen deal: ex-North America", "fact", "high", "Biogen / Stoke press release (Feb 2025); Q2 2026 10-Q",
        "$165M upfront (received, already in cash — so not entered again here), up to $385M in development and commercial milestones, tiered royalties from low double digits to high teens. Stoke keeps the US, Canada and Mexico. Modelled at a 15% royalty on ex-US sales and $100M of milestones paid on approval (the model's launch gate, so they carry the approval odds and timing); the split of the $385M is not disclosed, so that entry is an assumption."),
      ev("Exclusivity: ~12 years from launch", "inference", "moderate", "10-K FY2025, Intellectual property",
        "Licensed mechanism patents run to 2035–36; Stoke's own zorevunersen patents run 2038–2046 before extensions, and orphan exclusivity adds 7 years from approval. LOE around 2040 is a middle reading. Erosion is set halfway between the app's two benchmarks — 45% of volume kept and a 35% price decline, so ~29% of revenue survives — because no oligonucleotide has yet faced generic competition, so neither the small-molecule cliff (90% of volume gone in a year) nor the biologic curve (80% kept) has a precedent. Spinraza still has no generic about a decade after approval. This input moves fair value by several dollars: see the note in the snapshot entry."),
      ev("Competition: two disease-modifying entrants", "inference", "moderate", "Encoded Therapeutics releases (BTD Jan 2026, RMAT meeting Mar 2026)",
        "Encoded's ETX101 (one-time AAV9 gene therapy) has Breakthrough and RMAT designations and an agreed pivotal design, so a second disease-modifying option around 2029–30 is plausible. Symptomatic drugs (Fintepla, Epidiolex, Diacomit, and bexicaserin in development) are used alongside rather than instead, so they are not counted as share rivals."),
      ev("Launch timing: year 1", "inference", "moderate", "Company guidance (10-K FY2025; Q2 2026 10-Q): US launch early 2028",
        "Early 2028 is ~1.4 years from this snapshot. The model counts whole years from today and discounts each year's cash at its end, so year 1 places the first year of sales at ~Sep 2028 — close to the real first sales year of roughly Feb 2028 to Feb 2029. An earlier version of this case typed 1.5, which the model rounds to 2: every revenue year moved back a full year, and fair value fell about $3.50 for a timing error, not a judgment."),
      ev("Bear and Bull: what each one assumes", "inference", "moderate", "Judgment; Goldman Sachs PoS 75% (Sep 2026)",
        "Bull: EMPEROR reads out cleanly and Encoded's ETX101 arrives late or is used after zorevunersen, so peak share is 130% of Base (78% of treated patients), the odds of launch are 120% of Base (78%, just above Goldman's 75%), and the discount rate is a point lower. Bear: share 70% of Base, odds 75% of Base (49%), discount rate 3 points higher. Both are still probability-weighted — Bull keeps a 22% chance of failure in it. The value if the drug is approved, with no failure weighting at all, is ~$43 a share at Base share and ~$59 at Bull share."),
      ev("Priority review voucher: $190M", "fact", "moderate", "10-K FY2025; 2026 voucher sales (Jazz $200M, Cyprium/Fortress $205M, Rocket $180M)",
        "Rare Pediatric Disease designation (Oct 2022) makes an approval before the program's Sept 30, 2029 sunset eligible for a voucher. Recent sales cluster at $180–205M."),
      ev("Balance sheet", "fact", "high", "Q2 2026 10-Q (filed 2026-08-03)",
        "$354.3M cash and securities at June 30, 2026, plus $65.7M from ~2.1M ATM shares sold after quarter end = $420.0M, and no debt. Company guides cash to fund operations to the early-2028 launch. Shares: 64,526,242 outstanding (July 30) plus 3,703,730 pre-funded warrants at $0.0001, counted as shares, as Stoke does. Options: 11,532,638 at a $13.84 weighted strike (the latest disclosed, Dec 2025; 2026 grants were priced higher). RSUs + PSUs: 2,157,698, entered as zero-strike warrants."),
      ev("Remaining ATM capacity modelled as a future raise", "inference", "moderate", "8-K and 424B5, 2026-08-03 ($200M ATM)",
        "The $200M facility had ~$134M left after the July sales. Launch spending after early 2028 is not funded by current cash, so the case assumes the rest is used at today's price. Turn the future raise off to see the value with no further dilution."),
      ev("What the model says (snapshot)", "inference", "moderate", "This case, 2026-09-27",
        "At $24.80: Base fair value ~$29.05 (about 17% above the price), Bear ~$13.78, Bull ~$46.84; peak revenue ~$1.3B in Base (US sales plus the ex-US royalty). The price implies ~55% odds of reaching launch against this case's 65%, so this case is somewhat more confident than the market. The single judgment that moves it most after peak share and PoS is what happens at loss of exclusivity: a small-molecule generic cliff gives ~$26, a biologic-style decline ~$33, and this case sits between them."),
      ev("Share price $24.80", "fact", "high", "Close on 2026-09-25 (stockanalysis.com)",
        "Down from $29.20 on Sep 22; the week included a board change (former CEO Edward Kaye resigned as a director, Bo Cumbo appointed). No clinical news. Update the price before relying on the upside figure.")
    ],
    calibrationLog: [
      { id: newId("cal"), catalystLabel: "EMPEROR Phase 3 topline, through to approval (PoS to launch)", catalystDate: "2027-Q3",
        yourPoS: 65, marketImpliedPoS: 55, outcome: "pending",
        notes: "Both figures are the probability of reaching launch. Market-implied 55% is this case's own reverse-solve at $24.80 on 2026-09-27 (Overview → What the price implies). Score it as success on approval, failure on a failed readout or a rejection." }
    ]
  });

  return Object.assign(base, {
    name: "Stoke Therapeutics — sample case",
    ticker: "STOK",
    currentPrice: "24.80",
    discountRatePct: "12",
    valuationMethod: "dcf",
    corporateGA: { preCommercialAnnualM: "95", gaShareOfMatureSgaPct: "50" },
    terminalValue: { enabled: false, method: "exitMultiple", growthPct: "0", exitMultiple: "" },
    taxation: { enabled: true, effectiveRatePct: "21", startingNOLM: String(301.7e6) }, // dollars (MillionsField)
    capitalStructure: {
      mode: "detailed", dilutedSharesSimple: "",
      basicShares: String(64526242 + 3703730),
      cash: String(420.0e6), debt: "0",
      opts: "11532638", optK: "13.84",
      war: "2157698", warK: "0",
      convFace: "", convPrice: ""
    },
    futureRaise: { enabled: true, amountM: String(134.3e6), priceOverride: "" }, // stored in dollars (MillionsField)
    multipleAssumptions: { bear: "3", base: "4", bull: "5" },
    scenarioOverrides: {
      bear: { shareMultiplierPct: "70", posMultiplierPct: "75", discountRateAddPct: "3", exitMultiple: "" },
      bull: { shareMultiplierPct: "130", posMultiplierPct: "120", discountRateAddPct: "-1", exitMultiple: "" }
    },
    programs: [program]
  });
}
