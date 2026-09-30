// ════════════════════════════════════════════════════════════════════════════
// Sample case — Stoke Therapeutics (STOK), zorevunersen in Dravet syndrome
// ════════════════════════════════════════════════════════════════════════════
// A complete, sourced case a new user can open to see what a finished model
// looks like: every Workspace input filled, and a worked example for every
// tool and simulation on its Saved tab. Every input is either a disclosed
// figure (10-K for FY2025, the Q1 and Q2 2026 10-Qs, the 2026-08-03 424B5,
// company press releases, NEJM 2026, ClinicalTrials.gov results records) or a
// judgment call written up in the Evidence Log with its reasoning and a
// confidence level. Researched 2026-09-28; the numbers are a snapshot, and the
// case says so in its own evidence entries.
//
// Loaded as a NEW case with fresh ids (see "Load sample case" in the case
// list), so it never touches a case the user built themselves.
const SAMPLE_CASE_AS_OF = "2026-09-28";

// Dravet Phase 3 trials with posted results, used by several worked examples:
// ≥50% reduction in convulsive seizures, drug vs placebo, from each record's
// own results section on ClinicalTrials.gov.
const SAMPLE_DRAVET_RESPONDERS = [
  { label: "Fenfluramine Study 1 (0.8 mg/kg/day)", nct: "NCT02682927", a: 27, na: 40, b: 5, nb: 40 },
  { label: "Fenfluramine Study 3 (0.8 mg/kg/day)", nct: "NCT02682927", a: 35, na: 48, b: 3, nb: 48 },
  { label: "Fenfluramine Study 1504 (with stiripentol)", nct: "NCT02926898", a: 23, na: 43, b: 2, nb: 44 },
  { label: "Cannabidiol GWPCARE1 (20 mg/kg/day)", nct: "NCT02091375", a: 26, na: 61, b: 16, nb: 59 },
  { label: "Cannabidiol GWPCARE2 (20 mg/kg/day)", nct: "NCT02224703", a: 33, na: 67, b: 17, nb: 65 },
  { label: "Soticlestat SKYLINE", nct: "NCT04940624", a: 20, na: 73, b: 7, nb: 71 }
];

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
    // Stoke's own registered trials, lead first: EMPEROR (Phase 3), MONARCH
    // (Phase 1/2a, US) and its open-label extension. ADMIRAL and LONGWING are
    // UK trials registered on ISRCTN, so they have no NCT number.
    trialIds: "NCT06872125, NCT04442295, NCT04740476",
    target: "SCN1A",
    posOverridePct: "65",
    // Company guides a US launch in early 2028, ~1.4 years out. The model works
    // in whole years, and year 1 puts the first sales year's cash at ~Sep 2028
    // under end-of-year discounting — close to the real Feb 2028–Feb 2029
    // first year. Year 2 would push every revenue year back a full year.
    launchYearOffset: "1",
    revenueMode: "full",
    // Napkin (Quick) mode's figures, so switching modes gives a sourced
    // answer: the Full build's own peaks (Stoke's US sales plus the ex-US
    // royalty) for Base, Bear and Bull. Stored in dollars (MillionsField).
    quickRevenue: { peakRevenue: String(1311e6), yearsToPeak: "5", profile: "median",
      scenarioOverrides: { bear: { peakRevenue: String(917e6) }, bull: { peakRevenue: String(1704e6) } } },
    prv: { enabled: true, valueM: "190" },
    rndOverride: { totalYears: "1.4", totalCostM: "200" },
    revenueBuild: {
      // Incidence fields are the "label stays at ages 2–17" alternative: 232
      // births a year × 16 years of eligibility. Unused while mode is
      // prevalence; see the evidence entry on label breadth.
      population: { mode: "prevalence", prevalence: "15700", incidence: "232", diseaseDurationYears: "16", diagnosisRatePct: "75", treatmentRatePct: "60", eligiblePct: "80" },
      adherencePct: "85",
      marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "60" },
      launchCurve: { yearsToPeak: 5, profile: "median" },
      pricing: { usAnnualPrice: "375000", priceBasis: "WAC", netPriceRealizationPct: "80", usAnnualGrowthPct: "3", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "140", exUSLaunchLagYears: "1.5" },
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
        "1 in 15,600 births; ~15,700 living with Dravet in the US and ~38,000 across the US, UK, EU4 and Japan. A company estimate, so read it as the top of the plausible range (the Peak Sales simulation example treats it that way)."),
      ev("Eligible share: 80%", "fact", "high", "Stoke 10-K FY2025",
        "~85% of Dravet cases carry a pathogenic SCN1A variant and >95% of those are loss-of-function; the Breakthrough designation covers SCN1A variants not associated with gain of function. 85% x 95% ≈ 81%, rounded to 80%."),
      ev("Label breadth: all ages, not only EMPEROR's 2–17", "inference", "moderate", "Fintepla and Epidiolex US labels (Dravet, patients 2 and 1 years and older); fenfluramine Study 1 enrolled ages 2–18",
        "EMPEROR enrols ages 2 to 17, but the approved Dravet drugs were labelled by disease and minimum age with no upper limit, although their pivotal trials were also mostly children. So the build uses all 15,700 US patients. The incidence fields hold the alternative: 232 births a year (1 in 15,600 of ~3.6M US births) × 16 years of eligibility ≈ 3,700 children. Switching the population to incidence mode shows what the case is worth if the label stopped at 17 — Base falls to about $7.50, which is why this is worth checking against the final label."),
      ev("Diagnosed 75%, treated 60%", "inference", "low", "Judgment; Goldman Sachs initiation (Sep 2026) cites >6,000 initially addressable US patients",
        "Diagnosis is clinical first and genetic second, so not every Dravet patient has the confirmed SCN1A result the label will likely require. Intrathecal dosing every four months is a real barrier for some families. 15,700 x 75% x 60% x 80% ≈ 5,650 treatable, in line with Goldman's >6,000. The least certain input in the build."),
      ev("Peak share: 60% of treated patients", "inference", "moderate", "The app's benchmark for the first of two disease-modifying entrants; Encoded ETX101 timing",
        "Typed as an explicit 60% — the benchmark the model would use for the first of two entrants — so the share the whole case rests on is visible rather than implied. Bull lifts it to 78%, Bear cuts it to 42%."),
      ev("Price: $375K/yr WAC (Spinraza analog)", "inference", "moderate", "Spinraza maintenance-year WAC ~$375–400K (NY Medicaid DUR 2020; 2016 launch reporting)",
        "Same company (Biogen, ex-US), same modality (intrathecal ASO) and the same every-four-months maintenance cadence. Stoke has not disclosed a price. Entered as WAC, so list price is not treated as revenue."),
      ev("Gross-to-net: 20% (80% of WAC realized)", "inference", "moderate", "Judgment; Medicaid Drug Rebate Program minimum 23.1% for brand drugs",
        "The app's default converts WAC with Table 4-1's all-drug average (12%), and flags that as low for a specialty brand. Dravet patients are mostly children, many on Medicaid or disability coverage, where the statutory rebate is at least 23.1%; commercial rare-disease plans give far smaller discounts. A blended 20% is a middle reading; 30% would cut US revenue by another eighth."),
      ev("Phase 1/2 efficacy", "fact", "high", "Laux et al., Zorevunersen in Children and Adolescents with Dravet Syndrome, NEJM 2026;394:969–982; Stoke AES 2024 poster (MONARCH/ADMIRAL), Figure 3",
        "81 patients in MONARCH and ADMIRAL. Patients given 70 mg (1–3 doses) then up to 45 mg in the extension had median convulsive-seizure reductions of −58.8% to −90.9% across monthly intervals over the first 20 months, with Vineland-3 gains through 36 months. Counted from the poster's waterfall, 3 months after the last dose: 8 of 10 patients on two or three 70 mg doses had at least a 50% reduction, against 2 of 8 on a single dose. Open-label with no control arm, so the size of the effect is not proven — that is EMPEROR's job."),
      ev("What controlled Dravet trials have shown", "fact", "high", "ClinicalTrials.gov results: NCT02682927, NCT02926898, NCT02091375, NCT02224703, NCT04940624",
        "Share of patients with at least a 50% cut in convulsive seizures, drug vs placebo: fenfluramine 68% vs 13% and 73% vs 6% (Studies 1 and 3), 53% vs 5% with stiripentol; cannabidiol 43% vs 27% and 49% vs 26%; soticlestat 27% vs 10% — and soticlestat missed its primary endpoint (p = 0.061). Placebo arms responded 5–27%, 15% pooled (50 of 327). This is the reference class for EMPEROR: the open-label 80% should be read against it, not against zero. The Meta-Analysis and Trial Outcome examples on the Saved tab use these counts."),
      ev("EMPEROR Phase 3 design and timing", "fact", "high", "Q2 2026 10-Q; enrollment press release 2026-06-30; ClinicalTrials.gov NCT06872125",
        "Randomised 1:1, quadruple-blind, sham-controlled; 162 patients enrolled in the US, UK and Japan in 10 months — the population for the US NDA, so ~81 per arm. About 30 more were enrolling in Europe (sham by needle prick, due to complete Aug 2026) and screening is under way in China; neither group is planned for the US filing. ClinicalTrials.gov's 170 is an estimate. 70 mg x2 loading then 45 mg maintenance over 52 weeks. Primary endpoint: % change in major motor seizure frequency at week 28; secondaries at week 52 (seizures, Vineland-3 composite and subdomains). As of Jul 31, 2026 ~60 patients were past week 28 and none had discontinued. Pre-NDA meeting 2H 2026, rolling NDA from Q1 2027, readout Q3 2027, NDA complete 2H 2027, US launch targeted early 2028."),
      ev("PoS to launch: 65%", "inference", "moderate", "Judgment; Goldman Sachs uses 75%",
        "The app's benchmark with both program attributes applied is ~76% (rare disease and a selection biomarker overlap, so the stronger lift at each phase is used rather than both), about Goldman's 75%. An explicit override is used because this case's judgment is more specific than the attribute lift. Above the plain Neurology Phase 3 benchmark because the effect in open-label data is large, the endpoint (seizure frequency vs sham) is one approved Dravet drugs have met, and patients are genetically selected. Held below Goldman's 75% because open-label seizure data overstate controlled effects (placebo arms in Dravet trials responded 5–27%), soticlestat shows a Dravet Phase 3 can miss, and intrathecal CSF-protein findings need a clean safety read."),
      ev("Remaining R&D: $200M over 1.4 yrs, Biogen pays 30%", "inference", "moderate", "Q2 2026 10-Q (R&D $49.5M in Q2, $89.2M in H1); Biogen agreement",
        "R&D ran $89.2M in H1 2026 across all programs and rose to $49.5M in Q2; most is zorevunersen. ~$140M a year of it for the ~1.4 years to launch ≈ $200M. Biogen funds 30% of external clinical costs; applying it to the whole figure slightly overstates the sharing."),
      ev("Corporate G&A: $95M a year, 1 year of it if the program fails", "inference", "moderate", "Q2 2026 10-Q (SG&A $25.3M in Q2, $45.2M in H1)",
        "SG&A rose to $25.3M in Q2 as launch preparation began, ~$100M a year at that rate; $95M is used before launch. Wind-down is set to one year explicitly: after a failed readout a company with a second program (STK-002) cuts back rather than closes, and one year of G&A before any restructuring is the conservative reading."),
      ev("Biogen deal: ex-North America", "fact", "high", "Biogen / Stoke press release (Feb 2025); Q2 2026 10-Q",
        "$165M upfront (received, already in cash — so not entered again here), up to $385M in development and commercial milestones, tiered royalties from low double digits to high teens. Stoke keeps the US, Canada and Mexico. As of Jun 30, 2026 no milestone had been achieved. Modelled at a 15% royalty on ex-US sales, which start 1.5 years after the US launch (the app's benchmark lag: EMA approval follows FDA's, then country-by-country access), and $100M of milestones paid on approval (the model's launch gate, so they carry the approval odds and timing); the split of the $385M is not disclosed, so that entry is an assumption."),
      ev("Exclusivity: ~12 years from launch", "inference", "moderate", "10-K FY2025, Intellectual property",
        "Licensed mechanism patents run to 2035–36; Stoke's own zorevunersen patents run 2038–2046 before extensions, and orphan exclusivity adds 7 years from approval. LOE around 2040 is a middle reading. Erosion is set halfway between the app's two benchmarks — 45% of volume kept and a 35% price decline, so ~29% of revenue survives — because no oligonucleotide has yet faced generic competition, so neither the small-molecule cliff (90% of volume gone in a year) nor the biologic curve (80% kept) has a precedent. Spinraza still has no generic about a decade after approval, though its sales have fallen from a $2.1B peak in 2019 as one-time and oral competitors arrived (the Exclusivity example on the Saved tab looks up its patents)."),
      ev("Terminal value off (multiples filled for reference)", "inference", "high", "Judgment; this case's own cash-flow window",
        "The explicit cash flows already run through loss of exclusivity and the decline after it, so a terminal value on top would count value the model has already written down. The exit multiples are still filled — 4x peak sales for Base, 3x and 5x for Bear and Bull, the same as the Simple Multiple method — so switching terminal value on gives a sourced answer rather than a default."),
      ev("Competition: two disease-modifying entrants", "inference", "moderate", "Encoded Therapeutics releases (BTD Jan 2026, RMAT meeting Mar 2026); ClinicalTrials.gov NCT05419492",
        "Encoded's ETX101 (one-time AAV9 gene therapy) has Breakthrough and RMAT designations and an agreed pivotal design; its Phase 1/2 ENDEAVOR (47 patients) has primary completion in Jan 2028, so a second disease-modifying option around 2029–30 is plausible. Symptomatic drugs (Fintepla, Epidiolex, Diacomit, and bexicaserin in development) are used alongside rather than instead, so they are not counted as share rivals."),
      ev("Launch timing: year 1", "inference", "moderate", "Company guidance (Q2 2026 10-Q): US launch early 2028",
        "Early 2028 is ~1.4 years from this snapshot. The model counts whole years from today and discounts each year's cash at its end, so year 1 places the first year of sales at ~Sep 2028 — close to the real first sales year of roughly Feb 2028 to Feb 2029. Typing 1.5 would be rounded to 2: every revenue year moves back a full year, and fair value falls about $3.50 for a timing error, not a judgment."),
      ev("Bear and Bull: what each one assumes", "inference", "moderate", "Judgment; Goldman Sachs PoS 75% (Sep 2026)",
        "Bull: EMPEROR reads out cleanly and Encoded's ETX101 arrives late or is used after zorevunersen, so peak share is 130% of Base (78% of treated patients) and the odds of launch are 120% of Base (78%, just above Goldman's 75%). Bear: share 70% of Base, odds 75% of Base (49%). The discount rate stays at 12% in both: it is the cost of capital, and the odds already carry the risk of failure — raising the rate in Bear as well would count that risk twice. Both are still probability-weighted — Bull keeps a 22% chance of failure in it."),
      ev("Before the readout: 60% of wins clear, 40% modest", "inference", "moderate", "ClinicalTrials.gov results for the five Dravet Phase 3s that met their primary endpoint",
        "Three of the five were clear wins (fenfluramine, 54–65% placebo-adjusted reductions) and two modest (cannabidiol, 23–26 points), so 60% of wins are counted as clear. A clear win is set at 115% of Base share and 94% odds of approval; a modest one at 75% of share and 91% — the odds this case already has once the readout is positive (65% ÷ 72%, the approval rate after a positive Phase 3 that the benchmark implies)."),
      ev("FDA rejection fixed a year later: 47%", "fact", "moderate", "Sacks et al., JAMA 2014;311(4):378–384 (new molecular entities 2000–2012)",
        "Of 151 new-drug applications not approved the first time, 71 (47%) were approved after resubmission, with a median delay of 435 days. Used for the outcome tree's optional branch: 47% of FDA rejections become 'approved a year late'. It moves probability out of the rejection ending; the gates and the Base PoS are unchanged."),
      ev("Priority review voucher: $190M", "fact", "moderate", "10-K FY2025; 2026 voucher sales (Jazz $200M, Cyprium/Fortress $205M, Rocket $180M)",
        "Rare Pediatric Disease designation (Oct 2022) makes an approval before the program's Sept 30, 2029 sunset eligible for a voucher. Recent sales cluster at $180–205M."),
      ev("Balance sheet", "fact", "high", "Q2 2026 10-Q (filed 2026-08-03)",
        "$354.3M cash and securities at June 30, 2026, plus $65.7M from ~2.1M ATM shares sold after quarter end = $420.0M, and no debt or convertible notes (entered as 0). The cash is dated June 30 and carried forward to the valuation date at the $19.5M monthly burn (~$58M by September 28), so the months since the filing are not charged twice. Company guides cash to fund operations to the early-2028 launch. Shares: 64,526,242 outstanding (July 30) plus 3,703,730 pre-funded warrants at $0.0001, counted as shares, as Stoke does. Options: 11,532,638 outstanding at June 30, 2026 (the 10-Q's anti-dilutive table), at a $13.84 weighted strike — the latest disclosed, for the 10,151,430 outstanding at Dec 2025 (10-K); the 1.87M granted in 2026 were priced higher, so the true strike is somewhat above it. RSUs + PSUs: 2,157,698, entered as zero-strike warrants. The simple-mode share count (81.9M) is all of these added together, for anyone switching modes."),
      ev("Cash burn: $19.5M a month", "fact", "high", "Q2 2026 10-Q, statement of cash flows",
        "Cash used in operations was $117.2M in H1 2026, $19.5M a month, and rising: Q2's net loss was $61.6M against $50.0M in Q1. $420M at that rate lasts about 21½ months — to around April–May 2028, consistent with the company's 'to launch in early 2028'. The Cash Runway example uses these figures."),
      ev("The new $200M ATM, modelled as a future raise", "inference", "moderate", "424B5 and 8-K, 2026-08-03 (up to $200M through Cantor, up to 3% commission)",
        "The August prospectus supplement replaced the earlier one and is a fresh $200M: the ~4.7M shares ($146.4M) sold in H1 and July were under the March supplement. Stoke used the facility heavily in 2026, so the case assumes all of it is sold at today's price: $194M net at $24.06 a share after the 3% commission (8.1M shares). Turn the future raise off to see the value with no further dilution."),
      ev("Dilution path: on, with no share creep", "inference", "moderate", "Q1 and Q2 2026 10-Qs (stock-based compensation $19.6M in H1; 1.87M options and 0.80M RSUs granted)",
        "Switched on to check whether any scenario needs another raise after the ATM: with $100M kept as a minimum, 18 months raised at a time and a 10% discount, none does — the model turns cash-positive in the second sales year. Share creep is set to 0% deliberately: stock compensation (~$40M a year) is already inside the reported R&D and SG&A that the cost inputs are built from, so adding yearly share creep on top would count it twice."),
      ev("Napkin mode check", "inference", "high", "This case, Full vs Napkin",
        "Napkin (Quick) mode has no US/ex-US split, so it treats a partnership as covering all revenue — with Biogen's 15% royalty left on, the Napkin figure is badly understated. With Partnership Economics switched off, Napkin on this case's own peaks ($1.31B Base: US sales plus the ex-US royalty) gives about $30.0 against the Full model's $28.07 — close, and the gap is the Full build's cost detail and its ex-US royalty starting 1.5 years after the US launch, which one Quick curve cannot show. Compare the two modes that way."),
      ev("What the model says (snapshot)", "inference", "moderate", "This case, 2026-09-28",
        "At $24.80: Base fair value ~$28.07 (about 13% above the price), Bear ~$16.57, Bull ~$41.18; peak revenue ~$1.31B in Base (US sales plus the ex-US royalty). The price implies ~56% odds of reaching launch against this case's 65%, so this case is somewhat more confident than the market. If approved, with no failure weighting, a share is worth ~$41.32 on Base inputs; if EMPEROR fails, ~$0.48 is left (cash carried to today, less the Phase 3 still to pay, G&A to the readout and a year of wind-down, before any raise). The judgment that moves it most after peak share and PoS is what happens at loss of exclusivity: a small-molecule generic cliff gives ~$25.18, a biologic-style decline ~$31.46, and this case sits between them. The full $200M ATM costs ~$0.43 a share (Base $28.50 without it); switching terminal value on would add ~$6.50, which is why it stays off."),
      ev("Share price $24.80", "fact", "high", "Close on 2026-09-25 (stockanalysis.com)",
        "Down from $29.20 on Sep 22; the week included a board change (former CEO Edward Kaye resigned as a director, Bo Cumbo appointed; 8-K 2026-09-25). No clinical news. Update the price before relying on the upside figure."),
      ev("Worked examples: what is and is not included", "inference", "high", "This case's Saved tab",
        "Every tool and simulation has a worked example on the Saved tab, set up for this case with its sources. Two parts are deliberately left out. Non-inferiority: EMPEROR is a superiority trial against sham and no Dravet trial has used a non-inferiority design, so any example would be invented. Receptor occupancy and the PK/PD effect model: an antisense oligonucleotide acts by raising NaV1.1 protein over weeks, not by occupying a receptor in proportion to its concentration, so only the PK half of that tool is used. The comps these examples read — UCB–Zogenix, Spinraza, Fintepla and Epidiolex sales, and this Stoke–Biogen deal — were added to the app's tables from primary sources (docs/comps_candidates/2026-09-28-dravet.md).")
    ],
    calibrationLog: [
      { id: newId("cal"), catalystLabel: "EMPEROR Phase 3 topline, through to approval (PoS to launch)", catalystDate: "2027-Q3",
        yourPoS: 65, marketImpliedPoS: 56, outcome: "pending",
        notes: "Both figures are the probability of reaching launch. Market-implied is this case's own reverse-solve at $24.80 on 2026-09-28 (Overview → What the price implies). Score it as success on approval, failure on a failed readout or a rejection." }
    ]
  });

  // A worked example for every tool and simulation: its inputs, the button
  // that runs it, and a note on where each number comes from. They open in
  // their tool and run, so the result is always current (isWorkedExample).
  const tool = (title, toolId, workbench, label, inputs, run, note) => ({
    id: newId("pin"), kind: "example", title, source: "Tools · " + workbench + " · " + label, note,
    capturedAt: Date.parse(SAMPLE_CASE_AS_OF + "T12:00:00"), included: false, savedTo: "case",
    reopen: { view: "tools", tool: toolId, inputs: inputs.map(([l, v]) => ({ label: l, value: v })), run: run || undefined }
  });
  const sim = (title, simTab, simSub, label, inputs, run, note) => ({
    id: newId("pin"), kind: "example", title, source: "Simulation · " + label, note,
    capturedAt: Date.parse(SAMPLE_CASE_AS_OF + "T12:00:00"), included: false, savedTo: "case",
    reopen: { view: "simulation", simTab, simSub: simSub || null, inputs: inputs.map(([id, v]) => ({ id, value: v })), run }
  });
  const responders = SAMPLE_DRAVET_RESPONDERS;
  const metaInputs = [["metaModeSelect", "twoByTwo"]];
  responders.forEach((t, i) => metaInputs.push(["meta_label_" + (i + 1), t.label], ["meta_eventsA_" + (i + 1), String(t.a)], ["meta_nA_" + (i + 1), String(t.na)],
    ["meta_eventsB_" + (i + 1), String(t.b)], ["meta_nB_" + (i + 1), String(t.nb)]));
  const pooledPlacebo = responders.reduce((s, t) => s + t.b, 0) + " of " + responders.reduce((s, t) => s + t.nb, 0);
  const examples = [
    tool("EMPEROR, decoded", "decoder", "Trial", "Trial Decoder", [["ClinicalTrials.gov ID", "NCT06872125"]], "Decode",
      "The Phase 3 this case rests on. Read the design first: randomised 1:1, quadruple-blind, a sham procedure as the comparator (so the lumbar puncture itself cannot unblind anyone), and one primary endpoint at week 28. No results are posted yet — the readout is guided for Q3 2027."),
    tool("EMPEROR against the Dravet Phase 3s that came before it", "compare", "Trial", "Compare Trials",
      [["ClinicalTrials.gov IDs to compare", "NCT06872125, NCT02682927, NCT02091375, NCT04940624"]], "Compare",
      "EMPEROR beside fenfluramine's Study 1 and cannabidiol's GWPCARE1, which both met their primary endpoints, and soticlestat's SKYLINE, which did not (p = 0.061). The differences worth noticing are the comparator (sham vs placebo) and the time point (week 28 vs 14–16 weeks): EMPEROR asks for a longer-lasting effect than any trial before it."),
    tool("Every registered zorevunersen trial", "asset", "Trial", "Asset Program", [["Drug or intervention name", "zorevunersen, STK-001"]], "Build the program",
      "The whole program at once: MONARCH (Phase 1/2a, completed), its open-label extension, and EMPEROR. Both names are searched because MONARCH registered the drug only by its code name, STK-001 — with the INN alone it would be missing. The UK trials, ADMIRAL and LONGWING, are on ISRCTN rather than ClinicalTrials.gov, so they do not appear — the checklist's denominators are the US registry only."),
    tool("Dravet Phase 3 landscape and analog effect sizes", "trialwatch", "Trial", "Trial Explorer", [["Condition", "Dravet syndrome"], ["Phase", "PHASE3"]], "Search ClinicalTrials.gov",
      "Every registered Dravet Phase 3, including the failed and withdrawn ones (soticlestat, lorcaserin, clobazam). Press “Load what these trials actually reported” for the analog effect-size board, which places any effect you type — for example EMPEROR's once it reads out — against what these trials actually posted."),
    tool("Fenfluramine (Fintepla) — how a Dravet drug was approved and labelled", "fdaLookup", "Trial", "FDA Lookup", [["Drug name", "fenfluramine"]], "Search openFDA",
      "The closest approved precedent: a Dravet drug labelled by disease and minimum age (2 years and older), not by the trial's age range — the reason this case models all ages. The label's boxed warning and restricted distribution programme show what a safety finding costs commercially."),
    tool("SCN1A — the genetics behind the target", "target", "Science", "Target Dossier", [["Gene symbol or target name", "SCN1A"]], "Look up target",
      "Human genetic evidence is as strong as it gets here: loss-of-function SCN1A variants cause Dravet syndrome. That is support for the mechanism, not a probability of success, and this case's PoS does not read it."),
    tool("What has been published about zorevunersen", "literature", "Science", "Literature", [["Literature search", "zorevunersen"], ["Sort order", "cited"]], "Search",
      "The primary report is the NEJM 2026 paper (Laux et al.); most of the rest are reviews and conference summaries. The composition line tells you how much of the literature is primary data — for a drug before its Phase 3 readout, very little."),
    tool("Stoke's filings and insiders", "lookup", "Company", "Company Lookup", [["Company name or ticker", "STOK"], ["Indication or condition", "Dravet syndrome"]], "Search",
      "EDGAR financials (the balance-sheet figures in this case come from the same 10-Q), insider transactions — note the split between open-market buys and sells and routine award activity — and the Dravet competitor landscape."),
    tool("Catalysts from this case", "calendar", "Company", "Catalyst Calendar", [], "Pull events",
      "Pulls dated events for Stoke's registered trials; the EMPEROR primary completion date on ClinicalTrials.gov (Mar 2027) is the registry's estimate, while the company guides topline for Q3 2027 — the calendar shows the registry's date, the Calibration Log holds the guided one."),
    tool("Stoke's cash runway", "runway", "Company", "Cash Runway", [["Cash & investments ($M)", "420"], ["Monthly burn ($M)", "19.5"]], null,
      "$420.0M ($354.3M at Jun 30 plus $65.7M of July ATM sales) against $19.5M a month (cash used in operations, H1 2026 ÷ 6). About 22 months — to around April–May 2028, which is the company's 'into the early-2028 launch' with little to spare, and the reason the case models the new $200M ATM."),
    tool("Does the cash reach the readout?", "runwayCatalyst", "Company", "Runway vs. Catalyst", [["Cushion required at readout (months)", "6"]], null,
      "Uses this case's own cash, burn and the EMPEROR readout in its Calibration Log. A 6-month cushion is the usual minimum a company wants in hand when it reports a binary result, so it can raise from strength rather than need."),
    tool("Launch analogs: the Dravet drugs in Medicare", "commercial", "Commercial", "Launch & Actuals", [["Brand name", "Fintepla"], ["Medicare program", "Part D"], ["Analog brand names", "Epidiolex, Diacomit"]], "Track it",
      "Zorevunersen has no sales yet, so this tracks the Dravet drugs that do. Medicare covers only a thin slice of Dravet patients (mostly adults on disability), so read the shape of each ramp, not its size. Zorevunersen itself, given in clinic, would be billed under Part B like Spinraza."),
    tool("Spinraza — does an ASO face a generic?", "exclusivity", "Commercial", "Exclusivity / LOE", [["Brand name", "Spinraza"]], "Look up",
      "The analog behind this case's loss-of-exclusivity assumption: the same modality, the same intrathecal route, approved in 2016 and still without a generic. The case therefore sets erosion between the small-molecule cliff and the biologic curve."),
    tool("What moves this case most", "sensitivity", "Valuation", "Sensitivity", [], null,
      "The tornado and the price grid run on this case. Peak share and PoS dominate; the grid shows which combinations of the two the $24.80 price already assumes."),
    tool("The readout as a binary bet", "binaryEvent", "Valuation", "Binary Event", [], null,
      "Filled from the case: today's price, the value if zorevunersen is approved (100% odds on Base inputs), the failure floor, and the case's 65%. It answers whether the price is a fair bet on those four numbers."),
    tool("Fully diluted market cap", "fdmc", "Valuation", "Diluted Market Cap", [], null,
      "Built from this case's share count: common plus pre-funded warrants, options by the treasury method at $24.80, and RSUs. The difference from the basic market cap is what option-holders own."),
    tool("A takeout at a Dravet precedent's premium", "ma", "Benchmarks", "M&A Premium", [["Assumed takeout premium (%)", "72"]], null,
      "72% is what UCB paid for Zogenix (Fintepla, 2022) over its 30-day average price — the closer precedent: a Dravet-focused company of about Stoke's size (~$1.9B). Jazz paid 50% for GW Pharmaceuticals (Epidiolex, 2021), a larger company with a broader label. Both are in the M&A table; filter it for 'epilepsy'."),
    tool("What the Dravet drugs actually sell", "peaksales", "Benchmarks", "Peak Sales Comps", [["Filter peak sales comps", "Dravet"]], null,
      "Epidiolex ($1.06B in 2025, also sold for Lennox-Gastaut and TSC) and Fintepla (~$0.46B, also Lennox-Gastaut) against this case's Base peak of $1.31B for zorevunersen in Dravet alone. That gap is the case's biggest claim: it rests on a disease-modifying drug at a rare-disease price taking most treated patients. Clear the filter and search 'Spinraza' ($2.1B peak in 2019) for the same modality and dosing — the closest precedent for that price."),
    tool("Neurology licensing deals", "licensing", "Benchmarks", "Licensing Comps", [["Filter licensing comps", "Neurology"]], null,
      "The Stoke–Biogen deal itself (ex-North America; $165M upfront, up to $385M in milestones, low-double-digit to high-teens royalties) next to the other neurology licences in the table."),

    sim("EMPEROR's odds of a positive responder result", "trialOutcome", null, "Trial Outcome / PoS",
      [["endpointType", "binary"], ["nControl", "81"], ["nTreat", "81"], ["controlRate", "0.15"], ["alpha", "0.05"], ["sided", "two"], ["priorType", "normal"], ["iterations", "10000"], ["priorMean", "0.5"], ["priorSd", "0.12"]], "Run simulation",
      "81 per arm (162 randomised 1:1). Sham responder rate 15%: the pooled placebo rate across the six Dravet Phase 3s with posted results (" + pooledPlacebo + "). Prior on the treated responder rate: mean 50%, SD 12 points — centred between cannabidiol (43–49%) and fenfluramine (53–73%), wide enough to include a soticlestat-like 27%, and well below the open-label 80% because uncontrolled data overstate. EMPEROR's primary endpoint is % change in seizure frequency; the responder rate is the one measure every Dravet trial reports, which is why it is used here."),
    sim("Shrinking the open-label responder rate", "p2p3", null, "Phase 2→3 Translator", [["p2p3EndpointType", "binary"], ["p2p3ObservedRate", "80"]], "Translate to Phase 3",
      "80%: 8 of 10 patients given two or three 70 mg doses had at least a 50% cut in convulsive seizures 3 months after the last dose (Stoke AES 2024 poster, Figure 3). Ten patients, no control arm — the translator's shrinkage is the point of the exercise."),
    sim("Dravet responder rates, pooled", "metaAnalysis", null, "Meta-Analysis", metaInputs, "Pool studies",
      "All six Dravet Phase 3s with posted responder counts (at least a 50% cut in convulsive seizures, drug vs placebo), from each trial's ClinicalTrials.gov results record. Expect high heterogeneity: fenfluramine's effect is several times cannabidiol's and soticlestat's, so the pooled figure is less informative than the spread — which is the range EMPEROR's result will be read against."),
    sim("Peak sales with the uncertainty in every input", "peakSales", null, "Peak Sales",
      [["popType", "triangular"], ["popA", "9400"], ["popB", "12000"], ["popC", "12560"], ["dxType", "uniform"], ["dxA", "60"], ["dxB", "85"], ["txType", "uniform"], ["txA", "45"], ["txB", "70"],
       ["shareType", "uniform"], ["shareA", "35.7"], ["shareB", "66.3"], ["priceType", "triangular"], ["priceA", "240000"], ["priceB", "300000"], ["priceC", "320000"], ["peakIterations", "10000"]], "Run simulation",
      "Population: 15,700 × 80% eligible = 12,560 treated as the top, because it is a company estimate; low end 9,400 (the prevalence 40% lower). Diagnosis 60–85% and treatment 45–70% around the case's 75% and 60%. Share: the Bear-to-Bull range × 85% adherence. Net price: WAC $300–400K × 80% realised, most likely $300K. US only — the ex-US royalty is not in this tool."),
    sim("How zorevunersen builds up with dosing every 4 months", "pkpd", null, "PK/PD",
      [["route", "iv"], ["dose", "45"], ["ke", "0.000177"], ["Vd", "45"], ["tau", "2922"], ["numDoses", "6"], ["tEnd", "17532"]], "Run simulation",
      "Shape only, from a class analog. Zorevunersen's CSF half-life is not published; nusinersen's is 135–177 days (FDA clinical pharmacology review, median 163), so ke = ln 2 ÷ (163 × 24 h). 45 mg every 4 months (2,922 h) for two years; volume set to 45 L so 1.0 on the chart means one dose's worth. The build-up across doses is why EMPEROR starts with two 70 mg loading doses. The concentration–effect and receptor-occupancy parts do not apply to an antisense drug and are left at their defaults."),
    sim("How fragile is cannabidiol's GWPCARE2 responder result?", "trialStats", "fragilityIndex", "Trial Statistics · Fragility Index",
      [["fiLabelA", "Cannabidiol 20 mg/kg/day"], ["fiEventsA", "33"], ["fiNA", "67"], ["fiLabelB", "Placebo"], ["fiEventsB", "17"], ["fiNB", "65"], ["fiAlpha", "0.05"]], "Calculate",
      "GWPCARE2 (NCT02224703): 33 of 67 responders on 20 mg/kg vs 17 of 65 on placebo. How many patients would have to change outcome for the result to stop being significant — a way to see how much a modest Dravet effect rests on a few patients."),
    sim("The smallest responder difference EMPEROR can detect", "trialStats", "sampleSizePower", "Trial Statistics · Sample Size / Power",
      [["ssSolveMode", "minDetectableEffect"], ["ssEndpointType", "binary"], ["mdeControlRate", "0.15"], ["mdeN", "81"], ["ssPower", "0.9"], ["ssAlpha", "0.05"], ["ssSided", "two"], ["ssAllocation", "1"]], "Calculate",
      "With 81 per arm, a 15% sham responder rate and 90% power, the smallest treated responder rate EMPEROR would reliably detect. Compare it with the controlled rates in the Meta-Analysis example: an effect like cannabidiol's sits close to that line; one like fenfluramine's is far above it."),
    sim("Checking GWPCARE1's reported p-value from its interval", "trialStats", "pValueCI", "Trial Statistics · P-value ↔ CI",
      [["pciDirection", "ciToP"], ["pciScale", "linear"], ["pciPoint", "-22.79"], ["pciLower", "-41.06"], ["pciUpper", "-5.43"], ["pciLevel", "0.95"]], "Calculate",
      "GWPCARE1 (NCT02091375) registered a median difference of −22.79 points (95% CI −41.06 to −5.43, Hodges-Lehmann) and p = 0.0123 (Wilcoxon). Backing the p-value out of the interval should land close to 0.012 — a quick check that a reported result hangs together."),
    sim("The open-label responder rate, with its real uncertainty", "trialStats", "singleArmCI", "Trial Statistics · Single-Arm CI",
      [["saEvents", "8"], ["saN", "10"], ["saConfidence", "0.95"]], "Calculate",
      "8 of 10 multi-dose 70 mg patients with at least a 50% seizure cut (AES 2024 poster). The interval is wide enough to include cannabidiol-like rates at its lower end — ten patients cannot say much more than 'probably active'."),
    sim("Fenfluramine Study 1 as a 2×2 table", "trialStats", "outcome2x2", "Trial Statistics · 2×2 Outcome Analysis",
      [["o2LabelA", "Fenfluramine 0.8 mg/kg/day"], ["o2EventsA", "27"], ["o2NA", "40"], ["o2LabelB", "Placebo"], ["o2EventsB", "5"], ["o2NB", "40"], ["o2Confidence", "0.95"], ["o2HigherMeans", "better"]], "Calculate",
      "Study 1 (NCT02682927): 27 of 40 responders vs 5 of 40. The strongest controlled result in Dravet so far, and the bar a disease-modifying drug will be compared with. A higher rate here is better — responders, not events."),
    sim("GWPCARE2's four comparisons, adjusted for multiplicity", "trialStats", "multiplicity", "Trial Statistics · Multiplicity Adjustment",
      [["mpLabel0", "CBD 10 mg/kg — convulsive seizures"], ["mpP0", "0.0095"], ["mpLabel1", "CBD 20 mg/kg — convulsive seizures"], ["mpP1", "0.0299"], ["mpLabel2", "CBD 10 mg/kg — ≥50% responders"], ["mpP2", "0.0332"], ["mpLabel3", "CBD 20 mg/kg — ≥50% responders"], ["mpP3", "0.0069"], ["mpAlpha", "0.05"]], "Adjust",
      "GWPCARE2 (NCT02224703) tested two doses on two endpoints. Every p-value is below 0.05 on its own; adjusted for four comparisons, not all survive. The sponsor used a pre-specified testing order, so this is not how the trial was judged — it shows why EMPEROR's single primary endpoint and fixed order of secondaries matter.")
  ];

  return Object.assign(base, {
    name: "Stoke Therapeutics — sample case",
    ticker: "STOK",
    valuationDate: SAMPLE_CASE_AS_OF,
    currentPrice: "24.80",
    discountRatePct: "12",
    valuationMethod: "dcf",
    corporateGA: { preCommercialAnnualM: "95", gaShareOfMatureSgaPct: "50", windDownYears: "1" },
    terminalValue: { enabled: false, method: "exitMultiple", growthPct: "0", exitMultiple: "4" },
    taxation: { enabled: true, effectiveRatePct: "21", startingNOLM: String(301.7e6) }, // dollars (MillionsField)
    capitalStructure: {
      mode: "detailed", dilutedSharesSimple: String(64526242 + 3703730 + 11532638 + 2157698),
      basicShares: String(64526242 + 3703730),
      cash: String(420.0e6), debt: "0",
      // Cash dated at the quarter end and carried forward to valuationDate at
      // the H1 burn, so the months since the filing are not paid for twice.
      // The $420.0M includes July's $65.7M of ATM sales, cash that arrived
      // after the quarter end; only the burn is carried forward.
      cashAsOf: "2026-06-30", monthlyBurn: String(19.5e6),
      opts: "11532638", optK: "13.84",
      war: "2157698", warK: "0",
      convFace: "0", convPrice: "0"
    },
    // The fresh $200M ATM (424B5, 2026-08-03), net of Cantor's 3%: $194M at
    // $24.06 a share, i.e. $200M gross at today's $24.80. Dollars (MillionsField).
    futureRaise: { enabled: true, amountM: String(194e6), priceOverride: "24.06" },
    dilutionPath: { enabled: true, minCashBufferM: String(100e6), targetRunwayMonths: "18", discountToMarketPct: "10", sbcAnnualGrowthPct: "0" },
    basePosAdjustmentPct: "100",
    multipleAssumptions: { bear: "3", base: "4", bull: "5" },
    scenarioOverrides: {
      bear: { shareMultiplierPct: "70", posMultiplierPct: "75", discountRateAddPct: "0", exitMultiple: "3" },
      bull: { shareMultiplierPct: "130", posMultiplierPct: "120", discountRateAddPct: "0", exitMultiple: "5" }
    },
    readoutScenarios: { clearOfWinsPct: "60", clearPosPct: "94", clearSharePct: "115", modestPosPct: "91", modestSharePct: "75" },
    outcomeTree: { resubmitFixPct: "47" },
    modelYearZero: "2026",
    programs: [program],
    pinnedResults: examples
  });
}


// ════════════════════════════════════════════════════════════════════════════
// Sample case — PepGen (PEPG), PGN-EDODM1 in myotonic dystrophy type 1
// ════════════════════════════════════════════════════════════════════════════
// The second sample, deliberately unlike the first: a single-asset company
// in Phase 2 with a small cash pile, a weak first multi-dose result, a
// competitor's Phase 3 failure in the same disease, and a price the model
// finds too high. Every input was typed into the packaged app's own fields by
// test/packaged/case_fill.js (plan: test/packaged/fixtures/
// pepgen_fill_inputs.json) and this function holds the same values; the math
// suite rebuilds its valuation year by year from these inputs
// (test/fixtures/pepgen_case.json). Researched 2026-09-30 from the FY2025
// 10-K, the Q2 2026 10-Q, company releases and ClinicalTrials.gov.
const SAMPLE_PEPGEN_AS_OF = "2026-09-30";

function sampleCasePepGen() {
  const base = newCase();
  const prog = newProgram();
  const ev = (label, classification, confidence, source, thesis) =>
    ({ id: newId("ev"), label, classification, confidence, source, date: SAMPLE_PEPGEN_AS_OF, thesis });

  const program = Object.assign(prog, {
    name: "PGN-EDODM1",
    drugName: "PGN-EDODM1",
    indication: "Myotonic dystrophy type 1 — adults",
    therapeuticArea: "Neurology",
    // A peptide-conjugated PMO is a synthetic oligonucleotide approved through
    // an NDA, as Sarepta's PMOs were — small-molecule exclusivity rules.
    modality: "smallMolecule",
    currentPhase: "phase2",
    posBiomarkerUse: "selection",   // genetically confirmed DM1 (CTG repeat expansion)
    posDiseaseType: "rare",
    // FREEDOM2 (Phase 2 MAD, lead), FREEDOM (single dose), and the open-label extension.
    trialIds: "NCT06667453, NCT06204809, NCT07220603",
    target: "DMPK",
    posOverridePct: "15",
    launchYearOffset: "5",
    revenueMode: "full",
    // Napkin figures = the Full build's own peaks. Dollars (MillionsField).
    quickRevenue: { peakRevenue: String(1257e6), yearsToPeak: "6", profile: "median",
      scenarioOverrides: { bear: { peakRevenue: String(754e6) }, bull: { peakRevenue: String(1760e6) } } },
    prv: { enabled: false, valueM: "150" },
    rndOverride: { totalYears: "4.5", totalCostM: "320" },
    revenueBuild: {
      // Incidence fields: the alternative if the company's 40,000 is high
      // (450 a year x 55 years); unused while mode is prevalence.
      population: { mode: "prevalence", prevalence: "40000", incidence: "450", diseaseDurationYears: "55", diagnosisRatePct: "60", treatmentRatePct: "55", eligiblePct: "75" },
      adherencePct: "85",
      marketShare: { numDrugs: 4, orderOfEntry: 3, peakShareOverridePct: "23" },
      launchCurve: { yearsToPeak: "6", profile: "median" },
      pricing: { usAnnualPrice: "350000", priceBasis: "WAC", netPriceRealizationPct: "80", usAnnualGrowthPct: "2", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "180", exUSLaunchLagYears: "1.5" },
      exclusivity: { yearsToLOE: "10", modality: "smallMolecule", volumeRetainedPct: "45", priceDeclinePct: "35" }
    },
    costStructure: { cogsPct: "12", reps: { primaryCare: "0", specialty: "60", hospital: "0" }, marketingPctOfPeak: "3" },
    // PepGen in-licenses its peptide technology (Oxford University Innovation /
    // MRC, a low-single-digit royalty folded into COGS); it has not
    // out-licensed PGN-EDODM1, so Partnership Economics stays off.
    partnership: { enabled: false, territory: "exUS", royaltyPct: "", upfrontM: "", costSharingPct: "", milestones: [] },
    evidenceLog: [
      ev("Lead asset and mechanism", "fact", "high", "PepGen 10-K FY2025 (filed 2026-03-04); Q2 2026 results release (2026-08-06)",
        "PGN-EDODM1 is a phosphorodiamidate morpholino oligonucleotide carried into muscle by PepGen's EDO cell-penetrating peptide. It binds the CUG repeat expansion in DMPK transcripts so they stop sequestering MBNL1, restoring normal splicing without knocking DMPK down. FDA Orphan Drug and Fast Track; EMA orphan designation. PepGen stopped its DMD program (PGN-EDO51) in May 2025 after CONNECT1, so this is a single-asset company."),
      ev("FREEDOM single-dose data: 12% / 29% / 54% splicing correction", "fact", "high", "8-K Ex. 99.1, 2025-09-24 (FREEDOM-DM1, NCT06204809)",
        "Mean splicing correction on the 22-gene panel at day 28 after one dose: 12.3% at 5 mg/kg (n=6), 29.1% at 10 mg/kg (n=4), 53.7% at 15 mg/kg (n=6), greater than dose-proportional, with muscle concentrations rising the same way. One transient kidney-biomarker elevation at 15 mg/kg met the protocol's dose-limiting-toxicity definition; no serious treatment-related events. Splicing is a mechanism biomarker, not a functional benefit."),
      ev("FREEDOM2 5 mg/kg: splicing no better than placebo", "fact", "high", "8-K Ex. 99.1, 2026-03-30 (FREEDOM2-DM1, NCT06667453)",
        "Four doses of 5 mg/kg every four weeks (n=6) against placebo (n=2): mean splicing correction 7.3% vs 6.8%; 22.9% excluding one patient whose splicing worsened 70.8%. A vHOT trend in favour, no improvement in the 10-metre walk/run or grip strength, no serious adverse events, no renal events. The first multi-dose result did not reproduce the single-dose splicing signal at this dose."),
      ev("FREEDOM2 design, timeline and the partial clinical hold", "fact", "high", "Q2 2026 results release; August 2026 corporate presentation; ClinicalTrials.gov NCT06667453",
        "Randomised 6:2, double-blind, placebo-controlled multiple-ascending-dose study, ~24 adults, doses every four weeks, escalating 5 → 10 → 12.5 mg/kg. The 10 mg/kg cohort is fully enrolled; data expected in November 2026. The DSMB cleared the 12.5 mg/kg cohort; results expected 1H 2027, then an end-of-Phase-2 meeting on the registrational design. The corporate presentation refers to a partial FDA clinical hold on FREEDOM2: it is enrolling in Canada, the UK and South Korea, not the US."),
      ev("HARBOR failure: the field's first Phase 3 missed on vHOT", "fact", "high", "Novartis media release, 2026-09-08 (HARBOR, NCT06411288)",
        "Novartis's del-desiran (acquired with Avidity) missed its primary endpoint, video hand-opening time, in a ~150-patient Phase 3 in DM1, with activity claimed on secondary and exploratory measures. It is the first registrational read-out in DM1, and on the very functional measure PepGen cites from FREEDOM2 — a read-through on endpoint choice and on how much splicing correction translates into function."),
      ev("Competition: third of about four disease-modifying drugs", "inference", "moderate", "Dyne Q2 2026 results (BLA for accelerated approval Q3 2027, launch 1H 2028); ClinicalTrials.gov NCT05481879, NCT06185764, NCT06138743",
        "Dyne's z-basivarsen (DYNE-101) has Breakthrough designation, a 71-patient registrational expansion cohort reading out Q1 2027 and a confirmatory Phase 3 dosing since July 2026 — about three years ahead of PepGen. Del-desiran's path is uncertain after HARBOR. Vertex's VX-670 and Sarepta's SRP-1003 (ARO-DM1) are in Phase 1/2. PepGen launching around 2031 would be third of about four: the model's order-of-entry benchmark gives 23%, typed explicitly."),
      ev("PoS to launch: 15% (benchmark 38%)", "inference", "moderate", "Judgment; app benchmark (Neurology Phase 2, rare + selection biomarker, Thomas 2016 overlap rule); price-implied ~25%",
        "The benchmark for a rare, genetically selected Phase 2 neurology program is 37.8%. Cut to 15% for three program-specific reasons: the only multi-dose data so far show splicing no better than placebo; HARBOR has just failed on vHOT; and FREEDOM2 carries a partial US clinical hold. The price implies about 25%, so the market is less pessimistic than this case. The November 10 mg/kg data are the next test of it."),
      ev("US prevalence 40,000; 9,900 treatable adults", "inference", "moderate", "PepGen 10-K FY2025 (1 in 8,000; ~40,000 US, 75,000 Europe, 15,000 Japan); Johnson et al., Neurology 2021 (1 in 2,100 genetic carriers)",
        "The company's 40,000 is a clinical-prevalence figure; genetic screening suggests many more carriers, about half symptomatic. Diagnosed 60% (DM1 is under-diagnosed; symptoms can start after 50), treated 55% (a monthly IV infusion), eligible 75% (adult, non-congenital — FREEDOM2 enrols adults): 40,000 × 60% × 55% × 75% ≈ 9,900. The least certain part of the build after peak share."),
      ev("Price: $350K a year WAC, 80% realised", "inference", "low", "Judgment; no approved DM1 disease-modifier; Spinraza maintenance WAC ~$375–400K; Sarepta's exon-skipping PMOs weight-based, ~$300K+ for adults",
        "Weight-based IV dosing every four weeks, like the PMO class it belongs to. No DM1 drug has a disclosed price, so this rests on analogs, and Dyne's launch in 2028 will set the real anchor before PepGen's. Entered as WAC with 80% realised (Medicaid and commercial rebates for an adult specialty drug)."),
      ev("Ex-US: 180% of US patients at 50% of list", "inference", "low", "PepGen 10-K FY2025; the app's Table 4-2 list-price factor",
        "Europe and Japan together have about 90,000 patients to the US's 40,000 (225%), cut to 180% for slower reimbursement and access. Priced at 50% of the US list price — the app's convention compares list prices and does not model ex-US gross-to-net. Ex-US sales start 1.5 years after the US launch, the app's benchmark: EMA approval follows FDA's by about six months and EU access takes a further year or more."),
      ev("Launch in year 5 (2031); $320M of R&D over 4.5 years", "inference", "moderate", "Q2 2026 10-Q (R&D $12.5M in Q2, cash guidance into Q4 2027); timeline judgment",
        "FREEDOM2 completes in 1H 2027, then an end-of-Phase-2 meeting, a registrational trial around 2028–2030, filing about 2030 and approval about 2031 — year 5. R&D runs ~$50M a year today and would rise to ~$80M a year for a registrational trial plus commercial manufacturing: about $320M in all, entered as an override because the Phase 2 is already mostly paid for."),
      ev("Loss of exclusivity: 10 years from launch", "inference", "moderate", "PepGen 10-K FY2025, Intellectual property and the OUI/MRC licence",
        "The licensed composition-of-matter patent (US 12,465,646) and related applications expire 2039–2042 before extensions; orphan exclusivity gives 7 years from a 2031 approval. About 2041 is a middle reading. Erosion is set halfway between the app's small-molecule and biologic benchmarks (45% of volume kept, 35% price decline), as no oligonucleotide has yet faced generic competition. The licence also carries a low-single-digit royalty above £20–30M of sales, which is folded into the 12% COGS."),
      ev("Balance sheet", "fact", "high", "Q2 2026 10-Q (filed 2026-08-06)",
        "$117.2M of cash, equivalents and marketable securities at June 30, 2026; no debt. 69,259,517 shares outstanding at August 2, 2026. Options 8,139,082 at a $4.89 weighted strike — all out of the money at $2.34, so they add nothing by the treasury method. 1,101,110 unvested RSUs, entered as zero-strike warrants. Federal NOLs $177.3M. The company guides cash into Q4 2027. The cash is dated June 30 and carried forward to the valuation date at the $5.7M monthly burn (~$17M by September 30, leaving ~$100M), so the months since the filing are not charged twice."),
      ev("Cash burn: $5.7M a month", "fact", "high", "Q2 2026 10-Q, statement of cash flows",
        "Cash used in operations was $34.2M in H1 2026, $5.7M a month; Q2 R&D $12.5M and G&A $6.4M (so G&A runs ~$26M a year). $117.2M at that rate lasts about 20 months, but spending rises with the 12.5 mg/kg cohort and registrational preparation, which is why the company says Q4 2027."),
      ev("A $100M raise at $1.99; the dilution path left off", "inference", "moderate", "Judgment; runway guidance into Q4 2027",
        "Cash runs out before a registrational trial could even start, so a raise is certain: $100M at $1.99 (15% below $2.34) is modelled as the next financing (50.3M shares). Without it Base is ~$1.22, lower than with it — the raise is priced above this case's own fair value, so new investors pay more per share than the case thinks a share is worth. The dilution-path inputs are filled but switched off. Switched on, it projects ~$379M of raises over the years to launch, each counted with the odds the company is still going when it would happen (~$312M expected) and bringing its cash with its shares; at today's price less 15% they end with ~278M shares and Base ~$1.80, and priced at the case's own value they leave Base unchanged. Raises after positive data would be priced far higher than today's."),
      ev("Share price $2.34", "fact", "high", "Close on 2026-09-29 (stockanalysis.com)",
        "Down 9.7% that day and about 60% year to date, after the March 5 mg/kg data and HARBOR's failure on September 8. At $2.34 the market capitalisation is ~$162M against $117M of cash — an enterprise value of about $45M for the program. Update the price before relying on the upside figure."),
      ev("Incidence alternative: 450 a year for 55 years", "inference", "low", "Johnson et al., Neurology 2021 (genetic prevalence); PepGen 10-K FY2025 (clinical prevalence 1 in 8,000)",
        "Unused while the build is in prevalence mode. ~450 people a year develop symptomatic adult DM1 in the US (onset mostly in the 20s–40s) and live ~55 years with it: 24,750 addressable against the prevalence build's 40,000. Switching the population to incidence mode shows what the case is worth if the company's 40,000 is too high — Base falls to about $0.63."),
      ev("Bear and Bull: what each one assumes", "inference", "moderate", "Judgment",
        "Bull: the 10 and 12.5 mg/kg cohorts show clear dose-dependent splicing correction and a functional signal, del-desiran's path stays blocked, so peak share is 140% of Base (32%) and the odds of launch 150% of Base (22.5% — close to the ~25% the price implies). Bear: share 60% of Base, odds 60% (9%). The discount rate stays at 14% in both: it is the cost of capital, and the odds already carry the risk of failure, so raising it in Bear would count that risk twice. Both are still probability-weighted."),
      ev("Before the 10 mg/kg data: 30% of wins clear, 70% modest", "inference", "low", "Judgment; FREEDOM single-dose and FREEDOM2 5 mg/kg results",
        "A 'win' here is a splicing result clearly above placebo; a clear win also shows a functional trend. With 6 treated and 2 placebo patients per cohort, most positive readouts will be modest, so 30% of wins are counted as clear. Clear win: 64% odds of launch after it and 110% of Base share; modest win: 41% (the odds this case already has after a positive Phase 2) and 70% of share."),
      ev("FDA rejection fixed a year later: 47%", "fact", "moderate", "Sacks et al., JAMA 2014;311(4):378–384 (new molecular entities 2000–2012)",
        "Of 151 new-drug applications not approved the first time, 71 (47%) were approved after resubmission, with a median delay of 435 days. Used for the outcome tree's optional branch; it moves probability out of the rejection ending and never changes the gates."),
      ev("No priority review voucher", "fact", "high", "FDA Rare Pediatric Disease program; FREEDOM2 enrols adults",
        "A voucher needs a Rare Pediatric Disease designation, and PGN-EDODM1 is developed in adults (congenital DM1 is a separate, paediatric population PepGen has not targeted). The PRV input is filled at a typical $150M for reference and left off."),
      ev("Terminal value off (multiples filled for reference)", "inference", "high", "Judgment; this case's own cash-flow window",
        "The explicit cash flows run through loss of exclusivity and the decline after it, so a terminal value on top would count value already written down. The exit multiples (3x / 4x / 5x) are filled so switching it on gives a sourced answer: Base would rise to ~$2.16."),
      ev("Napkin mode check", "inference", "high", "This case, Full vs Napkin",
        "The Napkin peaks are the Full build's own peak revenues ($1.26B Base, $0.75B Bear, $1.76B Bull). Napkin on those gives ~$1.82 against the Full model's $1.54. The gap is the Full build's cost detail and its ex-US sales starting 1.5 years after the US; one Quick curve starts everything on launch day, so it reads higher."),
      ev("Worked examples: what is and is not included", "inference", "high", "This case's Saved tab",
        "Each tool and simulation with real DM1 data behind it has a worked example on the Saved tab. Left out, because there is nothing honest to put in: Launch & Actuals (no DM1 drug is approved, and Sarepta's PMOs, the closest modality, do not appear in Medicare's Part B or Part D spending files — checked 2026-09-30); the Phase 2→3 Translator, Meta-Analysis, Fragility Index, P-value↔CI, Single-Arm CI, 2×2 and Multiplicity (DM1 trials report splicing indices and timed functional tests, not responder counts, and none has posted controlled results); Non-Inferiority (no DM1 trial uses one). The PK/PD example is plasma pharmacokinetics from the approved PMO class, which clears within hours — muscle exposure is what PepGen measures, and the tool does not model tissue."),
      ev("What the model says (snapshot)", "inference", "moderate", "This case, 2026-09-30",
        "At $2.34: Base fair value ~$1.54 (about 34% below the price), Bear ~$0.75, Bull ~$2.98, after the modelled $100M raise; peak revenue ~$1.26B in Base ($648M US). The price implies ~25% odds of launch against this case's 15%. If PGN-EDODM1 is approved it is worth ~$8.22 a share on Base inputs. The failure floor reads $0: from the ~$100M left today the model charges the whole benchmark-proportioned Phase 2 cost (~$58M) as still to come, plus G&A to the readout and a year of wind-down, although FREEDOM2 is mostly paid for — roughly $20M (~$0.30 a share) would more likely remain after a Phase 2 failure. Loss of exclusivity: a small-molecule cliff gives ~$1.37, a biologic-style decline ~$1.79.")
    ],
    calibrationLog: [
      { id: newId("cal"), catalystLabel: "FREEDOM2 10 mg/kg data, through to approval (PoS to launch)", catalystDate: "2026-11",
        yourPoS: 15, marketImpliedPoS: 25, outcome: "pending",
        notes: "Both figures are the probability of reaching launch. Market-implied is this case's own reverse-solve at $2.34 on 2026-09-30. The November data are the first multi-dose look at 10 mg/kg; a positive read should move both figures up." }
    ]
  });

  const tool = (title, toolId, workbench, label, inputs, run, note) => ({
    id: newId("pin"), kind: "example", title, source: "Tools · " + workbench + " · " + label, note,
    capturedAt: Date.parse(SAMPLE_PEPGEN_AS_OF + "T12:00:00"), included: false, savedTo: "case",
    reopen: { view: "tools", tool: toolId, inputs: inputs.map(([l, v]) => ({ label: l, value: v })), run: run || undefined }
  });
  const sim = (title, simTab, simSub, label, inputs, run, note) => ({
    id: newId("pin"), kind: "example", title, source: "Simulation · " + label, note,
    capturedAt: Date.parse(SAMPLE_PEPGEN_AS_OF + "T12:00:00"), included: false, savedTo: "case",
    reopen: { view: "simulation", simTab, simSub: simSub || null, inputs: inputs.map(([id, v]) => ({ id, value: v })), run }
  });
  const examples = [
    tool("FREEDOM2, decoded", "decoder", "Trial", "Trial Decoder", [["ClinicalTrials.gov ID", "NCT06667453"]], "Decode",
      "The trial this case rests on: randomised 6:2 against placebo, double-blind, doses escalating 5 → 10 → 12.5 mg/kg every four weeks. Read what the design can establish — with two placebo patients per cohort it is built to show safety and a splicing signal, not a functional benefit."),
    tool("FREEDOM2 against the DM1 trials around it", "compare", "Trial", "Compare Trials",
      [["ClinicalTrials.gov IDs to compare", "NCT06667453, NCT05481879, NCT06411288, NCT06185764"]], "Compare",
      "FREEDOM2 beside Dyne's ACHIEVE (DYNE-101, heading for an accelerated-approval filing), Novartis's HARBOR (del-desiran, the Phase 3 that missed on video hand-opening time in September 2026) and Vertex's VX-670 Phase 1/2. The differences worth noticing are size and endpoint: HARBOR's ~150 patients and a functional primary endpoint against FREEDOM2's ~24 and a splicing one."),
    tool("Every registered PGN-EDODM1 trial", "asset", "Trial", "Asset Program", [["Drug or intervention name", "PGN-EDODM1"]], "Build the program",
      "FREEDOM (single dose, completed), FREEDOM2 (the Phase 2) and the open-label extension — three trials, none randomised at registrational scale and none with posted results yet. The checklist's denominators are the whole evidence base: small."),
    tool("DM1 Phase 2 landscape, without the T-DM1 trials", "trialwatch", "Trial", "Trial Explorer", [["Condition", "Myotonic dystrophy type 1"], ["Phase", "PHASE2"]], "Search ClinicalTrials.gov",
      "ClinicalTrials.gov expands \u201cDM1\u201d to T-DM1 (trastuzumab emtansine), so this search returns breast- and gastric-cancer trials; the tool leaves them out and says how many. Press \u201cLoad what these trials actually reported\u201d for the effect-size board — for DM1 it is empty: on 2026-09-30 five DM1 Phase 2 trials had posted results and none registered a structured effect estimate, which says as much about the field's evidence as any number would."),
    tool("Vyondys 53 — a PMO approved on a biomarker, with a kidney warning", "fdaLookup", "Trial", "FDA Lookup", [["Drug name", "Vyondys 53"]], "Search openFDA",
      "Golodirsen: the same PMO chemistry as PGN-EDODM1, given IV, approved in 2019 under accelerated approval on a biomarker (dystrophin) rather than function. Its label warns of kidney toxicity (from animal data) and asks for kidney function to be monitored — relevant because FREEDOM's one dose-limiting event at 15 mg/kg was a transient kidney-biomarker rise."),
    tool("DMPK — the genetics behind the target", "target", "Science", "Target Dossier", [["Gene symbol or target name", "DMPK"]], "Look up target",
      "DM1 is caused by a CTG repeat expansion in DMPK; the expanded transcript traps MBNL1, which is what PGN-EDODM1 frees. As strong as genetic support gets for the mechanism — not a probability that this drug works, and this case's PoS does not read it."),
    tool("What has been published about PGN-EDODM1", "literature", "Science", "Literature", [["Literature search", "PGN-EDODM1"], ["Sort order", "cited"]], "Search",
      "Eight records on 2026-09-30, and the composition line says what they are: reviews of the DM1 field, no primary report. For a Phase 2 drug everything so far is company releases."),
    tool("PepGen's filings and insiders", "lookup", "Company", "Company Lookup", [["Company name or ticker", "PEPG"], ["Indication or condition", "Myotonic dystrophy type 1"]], "Search",
      "EDGAR financials (cash and securities $117.2M, 69.26M shares, 8.14M options at $4.89 — the same figures as this case's balance sheet), insider transactions, and PepGen's registered trials. The unvested RSUs (1.1M) are not tagged in PepGen's XBRL, so they come from the 10-Q text, not the pull."),
    tool("Catalysts from this case", "calendar", "Company", "Catalyst Calendar", [], "Pull events",
      "Dated events for PepGen's registered trials. The registry's completion dates are estimates; the 10 mg/kg data (November 2026) and the 12.5 mg/kg data (1H 2027) come from company guidance and sit in the Calibration Log."),
    tool("PepGen's cash runway", "runway", "Company", "Cash Runway", [["Cash & investments ($M)", "117.2"], ["Monthly burn ($M)", "5.7"]], null,
      "$117.2M against $5.7M a month (cash used in operations, H1 2026 ÷ 6): about 20 months from June 30, to around March 2028 at that rate. The company guides into Q4 2027 because spending rises with the 12.5 mg/kg cohort — either way, well short of a registrational trial."),
    tool("Does the cash reach the 12.5 mg/kg readout?", "runwayCatalyst", "Company", "Runway vs. Catalyst", [["Cushion required at readout (months)", "6"]], null,
      "Uses this case's own cash, burn and the pending catalyst in its Calibration Log. The November readout is covered with room to spare; the question the case turns on is what the company raises on after it."),
    tool("Exondys 51 — does a PMO face a generic?", "exclusivity", "Commercial", "Exclusivity / LOE", [["Brand name", "Exondys 51"]], "Look up",
      "The first approved PMO (2016): five Orange Book patents, the last to 2034, and still no generic a decade on. Why this case sets erosion between the small-molecule cliff and the biologic curve."),
    tool("What moves this case most", "sensitivity", "Valuation", "Sensitivity", [], null,
      "Peak share, launch timing, the discount rate and PoS each swing Base by $0.70–0.85 a share — against a $1.54 Base, the case is a bet on all four. The grid shows which combinations the $2.34 price assumes."),
    tool("The 10 mg/kg readout as a binary bet", "binaryEvent", "Valuation", "Binary Event", [], null,
      "Filled from the case: today's price, the value if PGN-EDODM1 is approved (100% odds on Base inputs), the failure floor, and the case's 15%. With a failure floor of $0 the question is simply whether 15% odds of ~$8.22 justify $2.34."),
    tool("Fully diluted market cap", "fdmc", "Valuation", "Diluted Market Cap", [], null,
      "From this case's share count: 69.26M common, the 8.14M options (all out of the money at $4.89, so they add nothing at $2.34) and 1.1M RSUs. Fully diluted it is ~$165M — about $47M more than the cash."),
    tool("A takeout at the DM1 precedent's premium", "ma", "Benchmarks", "M&A Premium", [["Assumed takeout premium (%)", "46"]], null,
      "46% is what Novartis paid for Avidity Biosciences (2025, ~$12B) — the DM1 precedent, bought for del-desiran and its RNA-delivery platform before HARBOR read out. HARBOR's miss is a reminder that the premium was paid for a Phase 3 that then failed on its primary endpoint."),
    tool("What rare-disease drugs actually sell", "peaksales", "Benchmarks", "Peak Sales Comps", [["Filter peak sales comps", "Rare disease"]], null,
      "This case's Base peak is $1.26B. Spinraza (an intrathecal ASO, $2.1B peak) and Elevidys (DMD gene therapy, $0.82B) bracket it; most rare-disease launches sit below $1B. The claim the case rests on is a third-to-market drug reaching Spinraza-like scale in a disease with ~40,000 US patients."),
    tool("Neurology licensing deals", "licensing", "Benchmarks", "Licensing Comps", [["Filter licensing comps", "Neurology"]], null,
      "No DM1 licence is in the table; these are the neurology deals it holds, for a sense of what a partner pays before Phase 3 if PepGen licenses ex-US rights to fund a registrational trial."),

    sim("Can the 10 mg/kg cohort show a splicing difference?", "trialOutcome", null, "Trial Outcome / PoS",
      [["endpointType", "continuous"], ["nControl", "2"], ["nTreat", "6"], ["controlMean", "6.8"], ["sd", "30"], ["alpha", "0.05"], ["sided", "two"], ["priorType", "normal"], ["iterations", "10000"], ["priorMean", "15"], ["priorSd", "12"]], "Run simulation",
      "6 treated and 2 placebo patients, splicing correction as the endpoint. Placebo mean 6.8% (the 5 mg/kg cohort's placebo). SD 30 points — a judgment from the 5 mg/kg cohort, where one patient moved the mean from 22.9% to 7.3%. Prior on the true difference: mean 15 points, SD 12 — below the single-dose 29.1% at 10 mg/kg because the 5 mg/kg multi-dose result (7.3%) came in below its single-dose 12.3%. The answer is low whatever the prior: a cohort this size is not built to be significant, so read November's result as a trend."),
    sim("How big an effect a HARBOR-sized Phase 3 can detect", "trialStats", "sampleSizePower", "Trial Statistics · Sample Size / Power",
      [["ssSolveMode", "minDetectableEffect"], ["ssEndpointType", "continuous"], ["mdeSd", "1"], ["mdeN", "75"], ["ssPower", "0.9"], ["ssAlpha", "0.05"], ["ssSided", "two"], ["ssAllocation", "1"]], "Calculate",
      "HARBOR randomised ~150 patients. With 75 per arm, 90% power and the SD set to 1, the answer is in standard deviations: about half an SD is the smallest effect such a trial reliably detects. A registrational PepGen trial would need its functional effect at least that large."),
    sim("Peak sales with the uncertainty in every input", "peakSales", null, "Peak Sales",
      [["popType", "triangular"], ["popA", "24000"], ["popB", "30000"], ["popC", "45000"], ["dxType", "uniform"], ["dxA", "45"], ["dxB", "75"], ["txType", "uniform"], ["txA", "40"], ["txB", "70"],
       ["shareType", "uniform"], ["shareA", "11.7"], ["shareB", "27.4"], ["priceType", "triangular"], ["priceA", "240000"], ["priceB", "280000"], ["priceC", "320000"], ["peakIterations", "10000"]], "Run simulation",
      "Population: 40,000 × 75% eligible = 30,000 most likely; low 24,000 (a fifth fewer); high 45,000, because genetic screening finds far more carriers than the clinical 40,000 (Johnson 2021). Diagnosis 45–75% and treatment 40–70% around the case's 60% and 55%. Share: the Bear-to-Bull range (13.8–32.2%) × 85% adherence. Net price: $300–400K WAC × 80%, most likely $280K. US only."),
    sim("A PMO in plasma: gone within a day", "pkpd", null, "PK/PD",
      [["route", "iv"], ["dose", "700"], ["ke", "0.198"], ["Vd", "42"], ["tau", "672"], ["numDoses", "3"], ["tEnd", "2016"]], "Run simulation",
      "Class analog, not PGN-EDODM1's own (unpublished): eteplirsen's plasma half-life is 3–4 hours and its volume of distribution ~600 mL/kg (Exondys 51 label), so ke = ln 2 ÷ 3.5 h and Vd = 42 L for a 70 kg adult at 10 mg/kg (700 mg) every four weeks. Plasma is empty long before the next dose; what matters is how much reaches and stays in muscle — the whole point of PepGen's peptide — which this tool does not model. The effect and receptor-occupancy parts do not apply.")
  ];

  return Object.assign(base, {
    name: "PepGen — sample case",
    ticker: "PEPG",
    valuationDate: "2026-09-30",
    currentPrice: "2.34",
    discountRatePct: "14",
    valuationMethod: "dcf",
    corporateGA: { preCommercialAnnualM: "26", gaShareOfMatureSgaPct: "50", windDownYears: "1" },
    terminalValue: { enabled: false, method: "exitMultiple", growthPct: "0", exitMultiple: "4" },
    taxation: { enabled: true, effectiveRatePct: "21", startingNOLM: String(177.3e6) }, // dollars (MillionsField)
    capitalStructure: {
      // Simple mode's count for anyone switching: common + RSUs (the options
      // are out of the money at $2.34).
      mode: "detailed", dilutedSharesSimple: String(69259517 + 1101110),
      basicShares: "69259517",
      cash: String(117.238e6), debt: "0",
      // Dated at the quarter end, carried forward to valuationDate at the H1 burn.
      cashAsOf: "2026-06-30", monthlyBurn: String(5.7e6),
      opts: "8139082", optK: "4.89",
      war: "1101110", warK: "0",
      convFace: "0", convPrice: "0"
    },
    futureRaise: { enabled: true, amountM: String(100e6), priceOverride: "1.99" },
    dilutionPath: { enabled: false, minCashBufferM: String(40e6), targetRunwayMonths: "18", discountToMarketPct: "15", sbcAnnualGrowthPct: "0" },
    basePosAdjustmentPct: "100",
    multipleAssumptions: { bear: "3", base: "4", bull: "5" },
    scenarioOverrides: {
      bear: { shareMultiplierPct: "60", posMultiplierPct: "60", discountRateAddPct: "0", exitMultiple: "3" },
      bull: { shareMultiplierPct: "140", posMultiplierPct: "150", discountRateAddPct: "0", exitMultiple: "5" }
    },
    readoutScenarios: { clearOfWinsPct: "30", clearPosPct: "64", clearSharePct: "110", modestPosPct: "41", modestSharePct: "70" },
    outcomeTree: { resubmitFixPct: "47" },
    modelYearZero: "2026",
    programs: [program],
    pinnedResults: examples
  });
}
