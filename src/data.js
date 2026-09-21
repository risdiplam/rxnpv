// ════════════════════════════════════════════════════════════════════════════
// RxNPV — BENCHMARK DATA
// Compiled from: (1) "Biotech Financial Modeling" methodology reference
// (Pharmagellan-style biotech forecasting guide), (2) Bay Bridge Bio investing
// notes. Every table below is a real published/derived figure, not an estimate
// invented for this tool. Sources noted per table for the Reference Sheet.
// ════════════════════════════════════════════════════════════════════════════

// ── Launch curve: % of peak reached by year, 6-year median time-to-peak ──
const LAUNCH_CURVE = {
  source: "Robey & David (2016), adapted; Figure 6-1 (6yr detail) + Figure 6-2 (exact curves for 3-10yr ramps)",
  years6: [10.6, 31.5, 58.0, 76.2, 88.4, 100],      // median
  years6_p25: [4.7, 19.9, 40.8, 65.9, 84.8, 100],   // slow (25th pctile)
  years6_p75: [20.8, 40.9, 66.4, 85.1, 96.0, 100]   // fast (75th pctile)
};
// Exact empirical median + IQR curves by ramp length (Figure 6-2). Verified: interpolating the
// 6yr curve to other lengths reproduces these within ~1pp everywhere, but these are the real
// published values, not an approximation, so they're used directly for lengths 3-10.
const LAUNCH_CURVE_EXACT = {
  source: LAUNCH_CURVE.source,
  3:  { median: [31,76,100],                     lo: [20,66,100],                hi: [41,85,100] },
  4:  { median: [21,58,83,100],                  lo: [14,41,78,100],             hi: [30,67,91,100] },
  5:  { median: [15,42,68,86,100],                lo: [7,27,57,82,100],          hi: [25,53,78,94,100] },
  6:  { median: [11,31,58,76,89,100],             lo: [3,20,41,66,85,100],       hi: [21,41,67,85,96,100] },
  7:  { median: [9,25,46,66,80,90,100],           lo: [4,17,30,52,74,87,100],    hi: [18,35,57,75,88,96,100] },
  8:  { median: [8,21,37,58,71,83,92,100],        lo: [3,14,24,41,60,78,88,100], hi: [15,30,48,67,81,91,96,100] },
  9:  { median: [7,18,31,49,64,76,85,93,100],     lo: [3,11,20,33,49,66,80,89,100], hi: [13,27,41,59,73,85,93,96,100] },
  10: { median: [6,15,28,42,58,68,79,86,93,100],  lo: [2,7,18,27,41,57,72,82,90,100], hi: [11,25,37,53,67,78,87,94,97,100] }
};

// ── Market share by order of entry (Table 5-1) ──
const MARKET_SHARE_TABLE = {
  source: "Pharmagellan analysis, reconciliation of published studies (Table 5-1)",
  2: [60, 40],
  3: [40, 30, 30],
  4: [31, 23, 23, 23],
  5: [24, 19, 19, 19, 19]
};

// ── COGS as % of revenue (Table 8-1, real company data) ──
const COGS_BENCHMARKS = {
  source: "Company 10-K filings, n=13 companies/drugs (Table 8-1); cell/gene therapy figures separately sourced — see their own notes below, same rigor, different source class (no equivalent book table exists yet for either)",
  all: 11, biologic: 10, smallMolecule: 15,
  cellTherapy: 22,
  geneTherapy: 55,
  note: "Price (not molecule type) is the biggest COGS driver. Low-priced primary-care small molecules can run up to ~30%.",
  cellTherapyNote: "Cross-checked two ways, both landing close together: a 2019 per-dose CAR-T manufacturing cost estimate (~$95,780) against typical launch pricing (~$424K, Yescarta) implies ~23%; separately, Gilead has publicly stated a ~20% COGS / \"biologics-like\" ~80% gross margin TARGET for its CAR-T business by 2030 (implying current reality is somewhat above that). Roughly double the standard biologic figure — real economics of complex per-patient autologous manufacturing, not a rounding choice.",
  geneTherapyNote: "Genuinely wide, not false precision: AAV vector manufacturing cost runs ~$1-2M/dose against $2.1-3.5M list prices (Zolgensma, Hemgenix) — a real range of roughly 30-90% of revenue depending on the specific product and process efficiency, driven by widely-reported AAV manufacturing inefficiency. 55% is a rough midpoint, not a precise figure — override this one more aggressively than any other COGS benchmark in the app if you have a specific view on a specific program's manufacturing process."
};

// ── SG&A benchmarks ──
const SGA_BENCHMARKS = {
  source: "XBI small/mid-cap analysis 2015 (Fig 9-1); large-cap pharma 2012-2015",
  matureSgaPctOfRevenue: 34,          // stabilizes above ~$400M revenue
  matureSgaRange: [26, 42],
  largeCapSgaPctOfRevenue: 28,
  largeCapSgaRange: [27, 33],
  preCommercialGA: { medianM: 8.7, iqrM: [6.3, 12] },
  gaPerEmployee: { medianK: 225, iqrK: [168, 398] },
  gaByPhaseM: { phase1: 8.1, phase2: 9.2, phase3: 8.7 },
  gaByHeadcountM: { upTo20employees: 6.2, employees70Plus: 14 }, // median G&A at these headcount bands
  medianHeadcount: 35, medianHeadcountIQR: [20, 60],
  maturityRevenueThresholdM: 400
};

// ── Sales rep cost buildup (Table 10-3) ──
const SALES_REP_COST = {
  source: "Pharmagellan analysis (Table 10-3)",
  primaryCare: { comp: 100000, employment: 30000, other: 60000, total: 190000 },
  specialty:   { comp: 170000, employment: 50000, other: 60000, total: 280000 },
  hospital:    { comp: 185000, employment: 55000, other: 60000, total: 300000 }
};
// Typical launch sales-force size (Ch. 10 text) — median 85, average 102 reps across the launches
// in Table 10-1; two rule-of-thumb team sizes stated explicitly in prose:
const SALES_FORCE_SIZE_BENCHMARKS = {
  source: "Ch. 10 — Table 10-1 (n=13 launches: median 85, avg 102 reps) + stated rules of thumb",
  hospitalOrSpecialty: 100, // "you would typically model a sales force of about 100 people to commercialize a hospital based or specialty product"
  primaryCareNoPartner: 500, // "a biotech without partners will field 500 sales reps for a single primary care product"
  observedMedian: 85, observedAverage: 102
};

// ── Marketing spend ──
const MARKETING_BENCHMARKS = {
  source: "Multiple industry analyses (Ch. 10)",
  baseCasePctOfPeakRevenue: 3,
  competitiveScenarioRange: [5, 10],
  competitiveDrivers: ["High competitive intensity", "Entrenched legacy brand competitor", "Low disease/drug awareness", "Historically low-innovation area", "Large heterogeneous prescriber base (primary care)"]
};

// ── Adherence / persistence ──
const ADHERENCE_BENCHMARKS = {
  source: "Multiple adherence literature analyses (Ch. 4)",
  acuteAvg: 85, acuteRange: [79, 97],
  chronicAmbulatoryBase: 70,
  byFactor: {
    asymptomatic: [50, 70],
    highSeverityOrEfficacy: 80,  // leukemia, MS etc can exceed this
    lowerDoseFrequency: "higher MPR",
    fixedDoseCombo: "higher than separate pills",
    bipolarSpecialCase: "<50% typical"
  }
};

// ── Pricing definitions & ex-US ──
const PRICING_DEFS = {
  source: "Ch. 4",
  ASP: "Price paid to manufacturers, net of rebates/discounts — use this in models. Median ~74% of AWP.",
  WAC: "Wholesale acquisition cost — list price paid by wholesaler to manufacturer, before rebates.",
  AWP: "Average wholesale price — manufacturer 'sticker price', capped at 120% of WAC. Retail pharmacy margins over WAC typically 5-15%.",
  Retail: "Price charged by distributor to end user.",
  usAnnualGrowth: [2, 3],
  usAnnualGrowthHighCase: 10,
  exUSPriceFactor: 50,   // % of US price, typical (Table 4-2 average across DE/ES/FR/IT/JP/UK ≈ 47.5%; 50% used as a round default)
  exUSAnnualGrowth: "flat to slightly negative in most ex-US markets",
  exUSNotes: {
    UK: "Government caps growth rate of pharmaceutical spending",
    Germany: "Price discounts kick in once a drug's revenue passes ~€250M",
    Japan: "Mandated price cuts ~2.8%/year"
  }
};
// Exact price interconversion matrix (Table 4-1) — row referenced to column's basis = 100
const PRICING_CONVERSION_MATRIX = {
  source: "Table 4-1",
  // value = [row metric] as % of [column basis]
  refAWP100: { AWP: 100, Retail: 93, WAC: 84, ASP: 74 },
  refRetail100: { AWP: 107, Retail: 100, WAC: 90, ASP: 79 },
  refWAC100: { AWP: 120, Retail: 112, WAC: 100, ASP: 88 },
  refASP100: { AWP: 135, Retail: 126, WAC: 113, ASP: 100 }
};
// Ex-US price factors by country, normalized to US=1.00 (Table 4-2, median across 8 sources)
const EXUS_COUNTRY_PRICE_FACTORS = {
  source: "Table 4-2 — OECD-cited reports, median normalized to US",
  Germany: 0.53, Spain: 0.42, France: 0.47, Italy: 0.41, Japan: 0.51, UK: 0.51
};

// ── Exclusivity / patent & loss-of-exclusivity erosion ──
const EXCLUSIVITY_BENCHMARKS = {
  source: "Ch. 7",
  avgLaunchToCompetitionYears: 13,
  patentTermYears: 20,               // from filing, not launch
  hatchWaxmanExtensionYears: 5,
  orphanExclusivityYears: 7,
  pediatricExtensionMonths: 6,
  erosion: {
    smallMolecule: {
      // Document's stated typical/base-case default is 90% volume LOSS (=10% retained), not the
      // favorable end of the range: "we typically model a 90% loss of sales volume in the US
      // within a year after drugs face generic competition."
      volumeRetainedAfter1yrDefault: 10,
      volumeRetainedAfter1yrRange: [0, 30],   // 0-30% retained, "influenced by market size and brand loyalty"
      usPriceDeclineDefault: 38,              // midpoint of stated 25-50% range; oral agents ~25%, physician-administered 38-46%
      usPriceDeclineRange: [25, 50],
      note: "88% unit-sales decline at 12mo (93% for pre-LOE sales >$250M); values at 12mo represent a plateau. EU retained sales can be as high as 62% at 24mo."
    },
    biologic: {
      volumeLostOverYears1to5: 20,       // % of volume lost (not retained) over 1-5yr biosimilar entry — explicitly stated
      usDollarValueLostBy5yr: [60, 70],  // total $ value lost; source states "~50% of that will reflect price concessions"
      priceDeclineDefault: 33,           // = half of 65% (midpoint of 60-70%), per source's own "50% of that" framing
      tensionNote: "The source's two biologic-erosion figures don't fully reconcile multiplicatively: 20% volume loss + 33% price decline compounds to ~46% total $ loss, short of the stated 60-70%. Reaching 65% with only 20% volume loss would require ~56% price decline instead. This is a tension in the original source, not a transcription error — adjust whichever lever you trust more for your case.",
      euPriceDeclineRange: [0, 25]       // 12 EU countries, 24mo post generic
    },
    // Cell/gene therapy: deliberately near-zero, not a smaller version of the
    // small-molecule/biologic curves. No cell or gene therapy has ever
    // actually faced biosimilar-style follow-on competition and lost real
    // exclusivity in the market — there is no real precedent to source a
    // curve from, so this doesn't invent one. The real revenue-decline
    // mechanism for a one-time-dose product is the treatable patient POOL
    // being exhausted over time (prevalent patients treated once, only
    // incident/new patients remain) — already captured by the launch curve
    // and market-share assumptions elsewhere in the revenue build, not by
    // this erosion mechanism at all. Override manually only if you have a
    // specific reason to expect real follow-on competition for a specific
    // program (e.g. a named allogeneic or next-gen competitor in late-stage
    // trials targeting the same indication).
    cellTherapy: {
      volumeRetainedAfter1yrDefault: 95,
      usPriceDeclineDefault: 5,
      note: "No real precedent exists for cell therapy losing exclusivity to a follow-on competitor — this models near-zero erosion deliberately rather than fabricate a biosimilar-style curve. The real driver of long-run revenue decline for a one-time-dose product is treatable-patient-pool exhaustion, already handled by the launch curve, not competitive erosion."
    },
    geneTherapy: {
      volumeRetainedAfter1yrDefault: 95,
      usPriceDeclineDefault: 5,
      note: "Same reasoning as cell therapy: no gene therapy has ever faced real follow-on competition, so this models near-zero erosion rather than inventing a curve with no precedent. Treatable-patient-pool exhaustion (incident vs. prevalent patients) is the real long-run revenue driver, already captured by the launch curve."
    }
  }
};

// ── R&D: phase duration (Table 12-3, 12-5) ──
const TRIAL_DURATION_BY_AREA = {
  source: "Pharmagellan analysis of ClinicalTrials.gov data (Table 12-3): initiation-to-results, years",
  weightedAvg: { phase2: 1.8, phase3: 1.7 },
  byArea: {
    "Anti-infective":   { phase2: 1.3, phase3: 1.5 },
    "Cardiovascular":   { phase2: 1.4, phase3: 1.6 },
    "CNS":              { phase2: 2.0, phase3: 2.3 },
    "Dermatology":      { phase2: 0.9, phase3: 1.1 },
    "Endocrine":        { phase2: 1.2, phase3: 1.6 },
    "Gastrointestinal": { phase2: 1.8, phase3: 2.1 },
    "Genitourinary":    { phase2: 1.5, phase3: 1.5 },
    "Hematology":       { phase2: 2.4, phase3: 2.5 },
    "Immunomodulation": { phase2: 1.3, phase3: 1.8 },
    "Oncology":         { phase2: 2.6, phase3: 2.8 },
    "Ophthalmology":    { phase2: 1.7, phase3: 1.8 },
    "Psychiatry":       { phase2: 1.3, phase3: 1.1 },
    "Renal":            { phase2: 2.1, phase3: 2.5 },
    "Respiratory":      { phase2: 0.8, phase3: 1.5 },
    "Other":            { phase2: 1.3, phase3: 1.5 }
  },
  phase1BaseYears: 1.5,
  nonclinicalAddYears: { phase2: 0.7, phase3: 0.8 },
  totalDevBenchmarkYears: 6.5,
  breakthroughDesignation: {
    source: "One study, 29 novel oncology drugs approved 2013-2014",
    withBTD: 5.2, withoutBTD: 7.4,
    note: "No significant duration difference found for other expedited pathways (priority review, accelerated approval, fast track) — only breakthrough designation showed a difference in this study."
  }
};

// ── R&D: per-patient trial cost by phase & area (Table 12-9) ──
const TRIAL_COST_BY_AREA = {
  source: "Pharmagellan analysis, derived per-patient cost ($K) (Table 12-9)",
  weightedAvg: { phase1: 114, phase2: 181, phase3: 58 },
  byArea: {
    "Anti-infective":    { phase1: 105.0, phase2: 112.7, phase3: 56.4 },
    "Cardiovascular":    { phase1: 62.9,  phase2: 102.9, phase3: 61.5 },
    "CNS":               { phase1: 130.0, phase2: 231.7, phase3: 65.1 },
    "Dermatology":       { phase1: 60.0,  phase2: 107.2, phase3: 32.4 },
    "Endocrine":         { phase1: 33.3,  phase2: 118.6, phase3: 46.2 },
    "Gastrointestinal":  { phase1: 66.7,  phase2: 263.3, phase3: 44.6 },
    "Genitourinary":     { phase1: 79.5,  phase2: 146.0, phase3: 45.1 },
    "Hematology":        { phase1: 36.2,  phase2: 384.3, phase3: 69.1 },
    "Immunomodulation":  { phase1: 178.4, phase2: 222.2, phase3: 40.3 },
    "Oncology":          { phase1: 166.7, phase2: 243.5, phase3: 57.7 },
    "Ophthalmology":     { phase1: 143.2, phase2: 138.0, phase3: 89.0 },
    "Pain/Anesthesiology": { phase1: 43.8, phase2: 170.0, phase3: 206.6 },
    "Respiratory":       { phase1: 144.4, phase2: 164.9, phase3: 53.8 }
  },
  typicalAssetTotalM: { phase1: 4, phase2: 13, phase3: 40 }, // 1 Ph1 trial, 1 Ph2 trial, 2 Ph3 trials
  phase3OrphanVsNonOrphanMedianK: { nonOrphan: 54, orphan: 157 }
};

// ── Regulatory ──
const REGULATORY_BENCHMARKS = {
  source: "Ch. 13",
  reviewDurationYears: [1, 1.5],
  usFilingFeeM: 2.6,
  euJapanFilingFeeK: 300
};

// ── PoS by phase & therapeutic area (Tables 14-3, 14-4, 14-5), 3-source reconciliation ──
const POS_BY_AREA = {
  source: "By-area breakdown: DiMasi(2010)/Hay(2014)/Thomas(2016), Tables 14-3/4/5 (Thomas 2016 column shown, most complete coverage). " +
    "Baseline: document's stated base case, Table 14-1, 7-source median (DiMasi 2010, Paul 2010, Hay 2014, Smietana 2015, DiMasi 2016, Smietana 2016, Thomas 2016).",
  // This is the document's own explicit recommendation ("we typically assume base-case
  // success probabilities of 60% for Phase 1, 36% for Phase 2, and 63% for Phase 3") —
  // NOT Thomas(2016)'s individual figure (63.2/30.7/58.1), which is a different, narrower source.
  allIndications: { phase1: 60, phase2: 36, phase3: 63 },
  byArea: {
    // values are Thomas(2016) as primary (most complete coverage); DiMasi/Hay used where Thomas n.d.
    "Allergy":          { phase1: 67.6, phase2: 32.5, phase3: 71.4 },
    "Autoimmune":       { phase1: 65.7, phase2: 31.7, phase3: 62.2 },
    "Cardiovascular":   { phase1: 58.9, phase2: 24.1, phase3: 55.5 },
    "Endocrine":        { phase1: 58.9, phase2: 40.3, phase3: 65.0 },
    "Gastrointestinal": { phase1: 75.6, phase2: 35.7, phase3: 60.6 },
    "Hematology":       { phase1: 73.3, phase2: 56.6, phase3: 75.0 },
    "Infectious disease": { phase1: 69.5, phase2: 42.7, phase3: 72.7 },
    "Metabolic":        { phase1: 61.1, phase2: 45.2, phase3: 71.4 },
    "Musculoskeletal":  { phase1: 72.4, phase2: 35.2, phase3: 80.0 },
    "Neurology":        { phase1: 59.1, phase2: 29.7, phase3: 57.3 },
    "Psychiatry":       { phase1: 53.3, phase2: 23.7, phase3: 55.7 },
    "Oncology":         { phase1: 62.8, phase2: 24.6, phase3: 40.1 },
    "Ophthalmology":    { phase1: 84.8, phase2: 44.6, phase3: 58.3 },
    "Respiratory":      { phase1: 65.3, phase2: 31.6, phase3: 71.1 },
    "Urology":          { phase1: 57.1, phase2: 32.7, phase3: 71.4 }
  }
};

// ── PoS by molecule type (Table 14-6), 5-source reconciliation ──
const POS_BY_MOLECULE = {
  source: "DiMasi(2010), Hay(2014), KMR(2015), Smietana(2016), Thomas(2016) (Table 14-6)",
  all:     { phase1: 63.2, phase2: 30.7, phase3: 58.1 },
  nme:     { phase1: 56.6, phase2: 31.4, phase3: 59.6 },  // avg across sources
  biologic:{ phase1: 68.5, phase2: 42.9, phase3: 70.8 }   // avg across sources
};

// ── PoS modifiers — precise per-phase deltas, NOT a flat multiplier (Table 14-7) ──
const POS_MODIFIERS = {
  source: "Thomas et al. (2016) (Table 14-7)",
  baseline:  { phase1: 63.2, phase2: 30.7, phase3: 58.1 },
  rareDisease:        { phase1: 76.0, phase2: 50.6, phase3: 73.6 },
  chronicHighPrevalence: { phase1: 58.7, phase2: 27.7, phase3: 61.6 },
  selectionBiomarkers: { phase1: 76.7, phase2: 46.7, phase3: 76.5 },
  noBiomarkers:        { phase1: 63.0, phase2: 28.8, phase3: 55.0 }
};

// ── Regulatory (NDA/BLA → Approval) PoS — 6-source reconciliation (Table 14-8) ──
// Regulatory-STAGE-specific modifiers (distinct from the clinical-phase modifiers in
// POS_MODIFIERS above, which apply to Phase 1/2/3 transitions, not the filing→launch step)
const POS_REGULATORY_MODIFIERS = {
  source: "Thomas et al. (2016) and Hay et al. (2014), cited in Ch. 14",
  thomas2016: {
    selectionBiomarkers: 9.2, noBiomarkers: -1.4,
    chronicHighPrevalence: 1.9, rareDisease: 3.9
  },
  hay2014: {
    specialProtocolAssessment: -3.2, orphanDesignation: -2.2,
    note: "SPA/orphan drugs have higher clinical-phase success rates but regulatory-stage success similar to (slightly below) the overall cohort"
  }
};
const POS_REGULATORY = {
  // IMPORTANT: this is NOT overall probability of success. It is the probability a drug is approved
  // GIVEN it already completed Phase 3 successfully — the document's own phrase: "probability of
  // success from the end of Phase 3 to launch." Composing with the Phase 1/2/3 rates above (e.g.
  // 60% x 36% x 63% x 88% ≈ 12%) gives the actual overall/cumulative probability of success.
  source: "DiMasi(2010), Paul(2010), Hay(2014), Smietana(2015), DiMasi(2016), Thomas(2016) (Table 14-8)",
  definition: "Phase 3 completion → Launch (filing + FDA review), CONDITIONAL on having already succeeded through Phase 3 — not overall PoS",
  median: 88.4,
  range: [81.5, 93],
  docStatedRoundNumber: 88
};

// ── Discount rate guidance ──
const DISCOUNT_RATE_GUIDANCE = {
  source: "Multiple surveys/analyses reconciled (Ch. 15)",
  largePharmaOrAcquirerLens: 10,
  preCommercialBiotech: 20, // document's own words: "for pre-commercial biotechs, up to 20%, depending on the stage of the portfolio"
  earlyBiotechSelfView: [15, 20],
  warning: "The document's own 15-20% pre-commercial-biotech range is explicitly stated to be \"compatible with independently risk-adjusting the cash flows\" — i.e. it's meant to be used ALONGSIDE PoS-weighting, not instead of it. The double-counting risk it actually warns against is using a naive, market-derived biotech WACC (e.g. straight from stock-beta/CAPM, which already reflects binary trial-outcome risk) on top of PoS-adjusted cash flows — not using this document's own prescribed rate.",
  surveyRanges: {
    "2008 analysis, public drug cos": [7, 28],
    "2008 analysis — 4-asset portfolio (1 NDA+Ph3+Ph2+Ph1)": 12,
    "2008 analysis — 4-asset portfolio (1 Ph2 + 3 preclinical)": 19.5,
    "2012 analysis, 186 public biotech/pharma — market-stage WACC": 8.7,
    "2012 analysis — clinical-stage WACC": [13.3, 13.6],
    "2012 analysis — preclinical WACC": 17.7,
    "2011 survey, 242 biopharma finance pros — early-stage": [12, 28],
    "2011 survey — mid-stage": [10, 22],
    "2011 survey — late-stage": [9, 20],
    "Survey, 12 large-cap BD/finance pros — internal projects": 10
  },
  irr: {
    source: "2010 modeling exercise + 2015 analysis of 12 pharma companies",
    theoreticalSmallMolecule: 7.5, theoreticalBiologic: 13,
    historicalTrend: { y2010: 10.1, y2015: 4.2 },
    y2013to2015Range: [-1.4, 10.2],
    note: "Some pharma companies use current-activity IRR as a floor for the hurdle rate applied to acquisition candidates."
  }
};

// Master 7-source PoS reconciliation (Table 14-1) — the literal source of the 60/36/63 base case above
const POS_MASTER_RECONCILIATION = {
  source: "7-source median (Table 14-1): DiMasi(2010) 65/40/64, Paul(2010) 54/34/70, Hay(2014) 66.5/39.5/67.6, " +
    "Smietana(2015) 56/30/59, DiMasi(2016) 59.52/35.52/61.95, Smietana(2016) 55/37/63, Thomas(2016) 63.2/30.7/58.1",
  median: { phase1: 60, phase2: 36, phase3: 63 }
};

// Alternate base case adjusting for NON-SCIENTIFIC terminations (Table 14-2: ~24-25% of Phase
// 1/2 terminations are "portfolio rationalization" or "commercial/budget reasons," not drug failure).
// The document: "we sometimes use base-case success rates for Phase 1 of 70% and for Phase 2 of
// 52%... particularly appropriate for biotech models developed for partnering purposes — under the
// assumption that an acquirer is unlikely to terminate an in-licensed program for nonscientific reasons."
const POS_NONSCIENTIFIC_ADJUSTED = {
  source: "Ch. 14, adjusting Table 14-1 median for Table 14-2's ~24-25% nonscientific-termination rate",
  phase1: 70, phase2: 52, phase3: null, // doc does not state an adjusted Phase 3 figure
  useWhen: "Partnering / licensing / acquirer-perspective models — not for modeling a company's own asset where management could still deprioritize it for business reasons",
  nonscientificTerminationRate: { phase1: 25, phase2: 24 }
};

const THERAPEUTIC_AREAS = ["Allergy","Anti-infective","Autoimmune","Cardiovascular","CNS","Dermatology",
  "Endocrine","Gastrointestinal","Genitourinary","Hematology","Immunomodulation","Infectious disease",
  "Metabolic","Musculoskeletal","Neurology","Oncology","Ophthalmology","Pain/Anesthesiology","Psychiatry",
  "Renal","Respiratory","Urology","Other"];

// ── Placebo response benchmarks — how much of a trial's placebo arm typically
// "improves" with no active drug, by indication. High placebo response compresses
// the achievable treatment effect (active minus placebo) and is a real, recurring
// driver of Phase 2/3 readout risk independent of whether the drug itself works —
// worth knowing BEFORE a trial reads out, not just diagnosing after a miss.
// Each entry cites the specific published meta-analysis behind it; figures are
// each source's own pooled/headline estimate, not re-derived or averaged across sources.
const PLACEBO_RESPONSE_BENCHMARKS = {
  note: "Placebo response rate here means the fraction of the PLACEBO arm meeting the stated responder/improvement threshold — not an estimate of the true placebo effect net of natural history/regression to the mean, which these designs cannot isolate.",
  areas: {
    "Depression (MDD)": {
      therapeuticArea: "Psychiatry",
      rate: 37.5, range: [35, 40],
      endpoint: "Responder rate, antidepressant RCTs",
      source: "30-year meta-analytic reviews of antidepressant RCTs (e.g. Rutherford & Roose 2013; Khan et al.) — placebo response has held roughly in the 35-40% band since 1991",
      note: "One widely cited estimate: placebo response accounts for a majority of total antidepressant-arm improvement, leaving a comparatively small drug-specific effect — a structural reason CNS/depression trials are read with extra skepticism."
    },
    "Chronic / neuropathic pain": {
      therapeuticArea: "Pain/Anesthesiology",
      rate: 38, range: [7, 43],
      endpoint: "≥30% pain intensity reduction, placebo arm (≥50% threshold: 23% pooled)",
      source: "Systematic review/meta-analysis, 50 neuropathic-pain RCTs, 5,693 placebo patients, 1998-2020 (medRxiv 2022)",
      note: "Highly syndrome-dependent: postherpetic neuralgia and central pain run low (~7-12% at the ≥50% threshold); HIV-related neuropathic pain runs very high (~43%). Check the specific pain syndrome, not just \"pain.\""
    },
    "Irritable bowel syndrome (IBS)": {
      therapeuticArea: "Gastrointestinal",
      rate: 37.5, range: [34.4, 40.6],
      endpoint: "Pooled placebo response, all-endpoint types",
      source: "Systematic review and meta-analysis of IBS pharmacological trials (2021)",
      note: "Endpoint choice moves this a lot: an abdominal-pain-only endpoint runs ~34%, a composite FDA endpoint (the modern regulatory bar) runs closer to ~18-20% — the composite-endpoint figure is the more relevant one for a trial designed to today's FDA standard."
    },
    "Migraine prevention": {
      therapeuticArea: "Neurology",
      rate: 21, range: [13, 33],
      endpoint: "≥50% responder rate (reduction in monthly migraine days), placebo arm",
      source: "Meta-analysis of 32 oral migraine-prophylaxis RCTs (placebo response ~21%, 95% CI 13-28%); anti-CGRP mAb trials specifically run higher, ~29-33%",
      note: "Modality-dependent: newer anti-CGRP monoclonal antibody trials show a meaningfully higher placebo responder rate than older oral small-molecule prophylaxis trials — a real trend worth factoring into cross-era comps, not a comparison of like with like."
    },
    "Psoriasis (biologics)": {
      therapeuticArea: "Dermatology",
      rate: 4, range: [4, 9],
      endpoint: "PASI-75, placebo arm",
      source: "Systematic review/meta-analysis of biologic psoriasis RCTs, 31 trials (2012)",
      note: "One of the lowest placebo-response indications in the benchmark set — psoriasis lesions are well-demarcated and objectively scored, leaving little room for rater/patient-expectation effects to move the number."
    },
    "Atopic dermatitis (biologics)": {
      therapeuticArea: "Dermatology",
      rate: 13,
      endpoint: "EASI-75, placebo arm, weeks 12-16",
      source: "Pooled placebo-arm data, 575 patients, systemic AD biologic trials",
      note: "Markedly higher than psoriasis's ~4% despite being the same organ system — AD lesions are flatter and blend into non-lesional skin, making the endpoint itself noisier and more expectation-sensitive to score."
    }
  }
};

// ── M&A comparables — recent biotech/pharma acquisitions, for gauging what an
// asset with a similar profile might fetch. Compiled from public deal
// announcements and SEC filings; refreshed periodically, not real-time. ──
const MA_COMPS = {
  asOf: "August 2026",
  marketContext: {
    // dealValue2025B, dealValue2024B, and the avgDealValue figures below are
    // all from the same source (PitchBook data via CNBC, reported ~June
    // 2026) — corrected from an earlier, differently-sourced 2025 figure so
    // these numbers are internally consistent rather than mixed-source.
    dealValue2025B: 209, dealValue2024B: 114.8, dealValue2025GrowthPct: 82,
    dealsOver1B2025: 17,
    avgPremium2025Range: [60, 120],
    q1_2026DealValueB: 65, q1_2026DealsOver1B: 16,
    avgDealValue2026M: 527.3, avgDealValue2025M: 365
  },
  heuristics: [
    "Healthy early-stage biotech typically trades ~2x-4x cash; below 1x cash implies the market sees further R&D spend as value-destructive (common in downturns).",
    "Acquirer sweet spot: ~$500M-$15B market cap with >=1 approved drug OR a Phase 3 asset with positive data.",
    "A de-risking inflection (positive Ph2/Ph3 readout) is the single biggest premium driver.",
    "Takeout premiums to undisturbed price commonly range ~40-100%+, higher for contested or single-asset de-risked oncology."
  ],
  // Deals with differing figures across sources (e.g. upfront vs. total-with-CVR) are
  // noted rather than silently picking one number.
  deals: [
    { acquirer: "Bristol Myers Squibb", target: "Celgene", year: 2019, valueB: 74, premiumPct: 53.7, perShare: 102.43, area: "Oncology / hematology", stage: "Multiple approved", asset: "Revlimid, Imbruvica pipeline" },
    { acquirer: "Takeda", target: "Shire", year: 2019, valueB: 62, premiumPct: 69, area: "Rare disease / GI / hematology", stage: "Multiple approved", note: "~$80B including assumed debt" },
    { acquirer: "AbbVie", target: "Allergan", year: 2019, valueB: 63, premiumPct: 45, perShare: 188.24, area: "Diversified pharma / aesthetics", stage: "Commercial", note: "Broader pharma deal, not a pure biotech comp — included for scale reference" },
    { acquirer: "J&J", target: "Actelion", year: 2017, valueB: 30, premiumPct: 80, perShare: 280, area: "Pulmonary arterial hypertension", stage: "Multiple approved", asset: "Tracleer, Opsumit, Uptravi" },
    { acquirer: "Gilead", target: "Kite Pharma", year: 2017, valueB: 11.9, area: "Oncology / CAR-T", stage: "Approved (Yescarta)" },
    { acquirer: "AstraZeneca", target: "Alexion", year: 2021, valueB: 39, premiumPct: 45, area: "Rare disease", stage: "Multiple approved", asset: "Soliris" },
    { acquirer: "Gilead", target: "Immunomedics", year: 2020, valueB: 21, perShare: 88, premiumPct: 108, area: "Oncology / ADC", stage: "Approved", asset: "Trodelvy — metastatic triple-negative breast cancer" },
    { acquirer: "Sanofi", target: "Bioverativ", year: 2018, valueB: 11.6, area: "Rare disease / hemophilia", stage: "Multiple approved" },
    { acquirer: "Eli Lilly", target: "Loxo Oncology", year: 2019, valueB: 8, premiumPct: 68, area: "Oncology / precision", stage: "Approved (Vitrakvi)" },
    { acquirer: "Amgen", target: "Otezla (from Celgene)", year: 2019, valueB: 13.4, area: "Immunology / psoriasis", stage: "Approved", note: "Program/brand divestiture (BMS-Celgene antitrust condition), not a full company acquisition" },
    { acquirer: "Pfizer", target: "Seagen", year: 2023, valueB: 43, premiumPct: 33, area: "Oncology / ADC", stage: "Multiple approved" },
    { acquirer: "Amgen", target: "Horizon Therapeutics", year: 2023, valueB: 27.8, premiumPct: 48, area: "Rare / immunology", stage: "Multiple approved" },
    { acquirer: "J&J", target: "Intra-Cellular Therapies", year: 2025, valueB: 14.6, perShare: 132, premiumPct: 39, area: "CNS / psychiatry", stage: "Approved + pipeline", asset: "Caplyta (schizophrenia, bipolar depression)" },
    { acquirer: "BMS", target: "Karuna Therapeutics", year: 2024, valueB: 14, premiumPct: 53, area: "Neuro / psychiatry", stage: "Filed (NDA)" },
    { acquirer: "BMS", target: "Cerevel Therapeutics", year: 2024, valueB: 12.7, premiumPct: 73, area: "Neuroscience", stage: "Phase 2/3" },
    { acquirer: "Novartis", target: "Avidity Biosciences", year: 2025, valueB: 12, premiumPct: 46, area: "Neuromuscular / RNA", stage: "Phase 3", asset: "AOC RNA-delivery platform" },
    { acquirer: "Sun Pharma", target: "Organon", year: 2026, valueB: 11.75, perShare: 14, area: "Women's health / established brands", stage: "Commercial (legacy/generics)", note: "Different risk profile than a clinical-stage comp — scale reference only" },
    { acquirer: "AbbVie", target: "ImmunoGen", year: 2024, valueB: 10.1, premiumPct: 95, area: "Oncology / ADC", stage: "Approved (Elahere)" },
    { acquirer: "Merck", target: "Verona Pharma", year: 2025, valueB: 10, area: "Respiratory / COPD", stage: "Approved (Ohtuvayre)" },
    { acquirer: "Sanofi", target: "Blueprint Medicines", year: 2025, valueB: 9.5, area: "Rare disease / oncology", stage: "Approved + pipeline", asset: "Ayvakit (GIST, systemic mastocytosis)", note: "Sources range $9.1-9.5B" },
    { acquirer: "Novo Nordisk", target: "Akero Therapeutics", year: 2025, valueB: 5.2, perShare: 54, area: "Metabolic / MASH", stage: "Clinical (Ph3)", asset: "Efruxifermin (EFX)", note: "$54/sh cash (~$4.7B) + $6/sh CVR (~$500M) on approval" },
    { acquirer: "BioMarin", target: "Amicus Therapeutics", year: 2025, valueB: 4.8, perShare: 14.5, premiumPct: 33, area: "Rare disease", stage: "Multiple approved", asset: "Galafold (Fabry), Pombiliti+Opfolda (Pompe)" },
    { acquirer: "Vertex", target: "Alpine Immune Sciences", year: 2024, valueB: 4.9, premiumPct: 67, area: "Immunology", stage: "Phase 2", asset: "Lupus pipeline" },
    { acquirer: "Gilead", target: "CymaBay Therapeutics", year: 2024, valueB: 4.3, area: "Rare liver disease", stage: "Approved-stage", asset: "Seladelpar — PBC" },
    { acquirer: "Eli Lilly", target: "atai/Beckley psychedelics JV", year: 2026, valueB: 3.8, perShare: 6.75, area: "CNS / psychiatry", stage: "Clinical", asset: "BPL-003, VLS-01", note: "$6.75/sh cash (~$2.8B) + CVR up to $2.50/sh (~$1.0B) on milestones" },
    { acquirer: "Roche", target: "89bio", year: 2025, valueB: 3.5, area: "Metabolic / MASH", stage: "Late-stage", asset: "Pegozafermin", note: "Sources range $2.4-3.5B depending on CVR treatment" },
    { acquirer: "Merck KGaA", target: "SpringWorks Therapeutics", year: 2025, valueB: 3.5, area: "Oncology / rare tumors", stage: "Approved", asset: "Ogsiveo — desmoid tumors" },
    { acquirer: "Novartis", target: "Anthos Therapeutics", year: 2025, valueB: 3.1, area: "Cardiovascular", stage: "Clinical", asset: "Abelacimab — AFib", note: "$925M upfront + $2.2B milestones" },
    { acquirer: "Merck", target: "EyeBio", year: 2024, valueB: 3, area: "Ophthalmology", stage: "Clinical", asset: "Restoret — retinal disease", note: "Up to $3B total" },
    { acquirer: "Eli Lilly", target: "Morphic Therapeutic", year: 2024, valueB: 3.2, area: "Immunology / IBD", stage: "Clinical", asset: "MORF-057" },
    { acquirer: "Eli Lilly", target: "Scorpion Therapeutics (asset)", year: 2025, valueB: 2.5, area: "Oncology", stage: "Clinical", asset: "STX-478 — PI3Kalpha inhibitor", note: "Program/asset acquisition, not full company" },
    { acquirer: "AstraZeneca", target: "Fusion Pharmaceuticals", year: 2024, valueB: 2.4, area: "Radiopharmaceuticals", stage: "Clinical", asset: "FPI-2265 — prostate cancer" },
    { acquirer: "Sanofi", target: "Dynavax Technologies", year: 2026, valueB: 2.2, perShare: 15.5, area: "Vaccines", stage: "Commercial", structure: "all-cash" },
    { acquirer: "AbbVie", target: "Capstan Therapeutics", year: 2025, valueB: 2.1, area: "Autoimmune / cell therapy", stage: "Early / preclinical", asset: "In vivo CAR-T platform" },
    { acquirer: "GSK", target: "Boston Pharmaceuticals (efimosfermin)", year: 2025, valueB: 1.2, area: "Metabolic / MASH", stage: "Clinical" },
    { acquirer: "GSK", target: "IDRx", year: 2025, valueB: 1.15, area: "Oncology", stage: "Clinical", asset: "Precision GI cancer therapies", note: "$1B upfront + milestones" },
    { acquirer: "Roche", target: "Poseida Therapeutics", year: 2025, valueB: 1.5, area: "Cell therapy", stage: "Clinical", asset: "Allogeneic CAR-T — oncology/autoimmune" },
    { acquirer: "AstraZeneca", target: "Amolyt Pharma", year: 2024, valueB: 1.05, area: "Rare endocrine", stage: "Phase 3 (was private)" },
    { acquirer: "Sun Pharma", target: "Checkpoint Therapeutics", year: 2025, valueB: 0.355, perShare: 4.1, premiumPct: 66, area: "Oncology / dermatology", stage: "Approved", asset: "Unloxcyt — advanced skin cancer" },
    // Additions — filling 2016 and 2022 (previously no deals at all) plus
    // broader coverage across 2018-2026. Every figure cross-checked against
    // at least two independent sources; where sources disagreed (announced
    // vs. closed value, upfront vs. total-with-CVR), the note says so.
    { acquirer: "Shire", target: "Baxalta", year: 2016, valueB: 32, area: "Rare disease / hematology", stage: "Multiple approved" },
    { acquirer: "Pfizer", target: "Medivation", year: 2016, valueB: 14, area: "Oncology", stage: "Approved", asset: "Xtandi — prostate cancer" },
    { acquirer: "Pfizer", target: "Anacor Pharmaceuticals", year: 2016, valueB: 5.2, area: "Dermatology", stage: "Approved", asset: "Eucrisa — eczema" },
    { acquirer: "Celgene", target: "Juno Therapeutics", year: 2018, valueB: 9, area: "Oncology / cell therapy", stage: "Clinical (Ph3)", asset: "JCAR017 (later Breyanzi) — CAR-T lymphoma" },
    { acquirer: "Novartis", target: "AveXis", year: 2018, valueB: 8.7, area: "Rare disease / gene therapy", stage: "Clinical (Ph3)", asset: "AVXS-101 — later approved as Zolgensma (SMA)" },
    { acquirer: "GSK", target: "Tesaro", year: 2018, valueB: 5.1, area: "Oncology", stage: "Approved", asset: "Zejula — PARP inhibitor" },
    { acquirer: "Sanofi", target: "Ablynx", year: 2018, valueB: 4.8, area: "Rare disease / nanobodies", stage: "Approved-stage", asset: "Cablivi — aTTP", note: "€3.9B; USD figure approximate at time of deal" },
    { acquirer: "Roche", target: "Spark Therapeutics", year: 2019, valueB: 4.8, area: "Rare disease / gene therapy", stage: "Multiple approved", asset: "Luxturna (inherited blindness), hemophilia pipeline" },
    { acquirer: "Alexion", target: "Portola Pharmaceuticals", year: 2020, valueB: 1.4, premiumPct: 132, area: "Hematology", stage: "Approved", asset: "Andexxa — Factor Xa reversal" },
    { acquirer: "Pfizer", target: "Biohaven Pharmaceutical", year: 2022, valueB: 11.6, area: "CNS / migraine", stage: "Approved", asset: "Nurtec ODT" },
    { acquirer: "Pfizer", target: "Global Blood Therapeutics", year: 2022, valueB: 5.4, perShare: 68.5, area: "Rare disease / hematology", stage: "Approved", asset: "Oxbryta — sickle cell disease" },
    { acquirer: "Bristol Myers Squibb", target: "Turning Point Therapeutics", year: 2022, valueB: 4.1, perShare: 76, premiumPct: 122, area: "Oncology", stage: "Clinical", asset: "Repotrectinib — ROS1/TRK inhibitor" },
    { acquirer: "Amgen", target: "ChemoCentryx", year: 2022, valueB: 3.7, perShare: 52, premiumPct: 116, area: "Immunology / nephrology", stage: "Approved", asset: "Tavneos — ANCA vasculitis" },
    // 2021 filled in — was thin (1 deal) relative to how dense 2024-2025
    // coverage had become; real, well-documented deals from that year's
    // actual biggest transactions (2021 was itself a comparatively quiet
    // M&A year industry-wide, per multiple trade-press year-end recaps —
    // not an artifact of under-research).
    { acquirer: "Merck & Co.", target: "Acceleron Pharma", year: 2021, valueB: 11.5, perShare: 180, area: "Cardiovascular / rare disease", stage: "Phase 3", asset: "Sotatercept — pulmonary arterial hypertension (later approved as Winrevair); deal also included Reblozyl, already FDA-approved for anemia in certain rare blood disorders" },
    { acquirer: "Jazz Pharmaceuticals", target: "GW Pharmaceuticals", year: 2021, valueB: 7.2, premiumPct: 50, area: "CNS / epilepsy", stage: "Approved", asset: "Epidiolex — Lennox-Gastaut, Dravet, and tuberous sclerosis complex seizures", note: "$220/ADS ($200 cash + $20 stock); $6.7B excluding GW's own cash on hand" },
    { acquirer: "Merck & Co.", target: "Pandion Therapeutics", year: 2021, valueB: 1.85, perShare: 60, area: "Autoimmune / immunology", stage: "Phase 1 (completed)", asset: "PT101 — Treg-selective IL-2 mutein for ulcerative colitis and lupus" },
    { acquirer: "Astellas", target: "Iveric Bio", year: 2023, valueB: 5.9, perShare: 40, premiumPct: 64, area: "Ophthalmology", stage: "Filed/approval-pending", asset: "Izervay (avacincaptad pegol) — geographic atrophy" },
    { acquirer: "Merck", target: "Prometheus Biosciences", year: 2023, valueB: 10.8, area: "Immunology / IBD", stage: "Clinical (Ph3)", asset: "PRA023 (later tulisokibart)" },
    { acquirer: "Pfizer", target: "Metsera", year: 2025, valueB: 10, area: "Metabolic / obesity (GLP-1)", stage: "Clinical", note: "Won a bidding war against Novo Nordisk and others; up to $10B including contingent payments" },
    { acquirer: "Merck", target: "Terns Pharmaceuticals", year: 2026, valueB: 6.7, area: "Oncology", stage: "Clinical", asset: "TERN-701 — oral CML" },
    { acquirer: "AbbVie", target: "Apogee Therapeutics", year: 2026, valueB: 10.9, premiumPct: 53, area: "Immunology", stage: "Clinical (Phase 3 pending)", asset: "Zumilokibart (APG777) — IL-13 mAb, atopic dermatitis/asthma" },
    { acquirer: "GSK", target: "Nuvalent", year: 2026, valueB: 10.6, premiumPct: 40, area: "Oncology", stage: "Under FDA review (2 assets) + Phase 1", asset: "Zidesamtinib (ROS1), neladalkib (ALK) — NSCLC" },
    { acquirer: "Eli Lilly", target: "Centessa Pharmaceuticals", year: 2026, valueB: 6.3, area: "CNS / sleep disorders", stage: "Clinical", note: "$6.3B upfront + up to $1.5B in contingent value rights" },
    { acquirer: "UCB", target: "Neurona Therapeutics", year: 2026, valueB: 1.15, area: "Neurology / cell therapy", stage: "Clinical", asset: "NRTX-1001 — epilepsy", note: "Up to $1.15B including milestones" },
    // Round 2 — specifically targeting the $0.5-1B range, which had zero
    // entries at all. Most real early/mid-stage biotech acquisitions land
    // here, not in the $5B+ range the list skewed toward.
    { acquirer: "Recordati", target: "Sanofi (Enjaymo asset)", year: 2024, valueB: 0.825, area: "Rare disease / hematology", stage: "Approved", asset: "Enjaymo — cold agglutinin disease", note: "Asset acquisition, not full company" },
    { acquirer: "Boehringer Ingelheim", target: "Nerio Therapeutics", year: 2024, valueB: 0.6, area: "Oncology / immuno-oncology", stage: "Preclinical" },
    { acquirer: "Novartis", target: "Regulus Therapeutics", year: 2025, valueB: 0.8, area: "Rare disease / RNA therapeutics", stage: "Clinical", asset: "Farabursen — ADPKD (kidney)", note: "$800M upfront + up to $900M milestones ($1.7B total)" },
    { acquirer: "BioNTech", target: "Biotheus", year: 2025, valueB: 0.8, area: "Oncology / bispecific antibody", stage: "Clinical", note: "$800M upfront + up to $150M milestones" },
    { acquirer: "J&J", target: "Halda Therapeutics", year: 2025, valueB: 3.05, area: "Oncology", stage: "Clinical", asset: "Prostate cancer (oral targeted therapy)" }
  ]
};

// ── Simple Multiple precedents — real deal-value / peak-sales multiples,
// cross-referenced from the two comps datasets already above and below
// (MA_COMPS.deals × PEAK_SALES_COMPS.drugs), not a separate research pass.
// Replaces an earlier flat "3x, industry shorthand, not sourced from the
// app's benchmark data" default with something that actually is.
//
// Deliberately a small, hand-picked set, not every possible pairing: only
// included where the M&A deal was genuinely ABOUT that one drug (a
// single-asset or clearly asset-driven acquisition), not a case where the
// named drug was one piece of a much larger, multi-asset deal — e.g.
// BMS/Celgene ($74B) is excluded even though Imbruvica appears in both
// datasets, because Revlimid (not in either comps list) drove that deal's
// value, not Imbruvica, and dividing the whole deal price by one minor
// asset's peak sales would produce a meaningless number.
//
// Two genuinely different flavors are mixed here, and both are labeled
// rather than blended into a false single "the" multiple: some deals
// happened BEFORE approval (a genuine bet, multiple = deal price ÷ what the
// asset eventually realized — real hindsight, not deal-time knowledge) and
// some happened AFTER the asset was already commercial and de-risked
// (multiple = deal price ÷ the peak-sales figure already tracked as this
// specific comp elsewhere in the app). Real precedent multiples span a wide
// range (3.55x-16.22x here) — that spread is itself the honest finding, not
// noise to average away into one number.
const SIMPLE_MULTIPLE_PRECEDENTS = {
  asOf: "August 2026",
  medianMultiple: 7.8,
  deals: [
    { acquirer: "AstraZeneca", target: "Alexion", year: 2021, valueB: 39, drug: "Soliris", peakSalesB: 5.0, multiple: 7.8, timing: "post-approval", note: "Soliris was already Alexion's flagship, peaked pre-acquisition — cited directly in AZ's own deal commentary, the cleanest comp here." },
    { acquirer: "Gilead", target: "Immunomedics", year: 2020, valueB: 21, drug: "Trodelvy", peakSalesB: 4.0, multiple: 5.25, timing: "post-approval", note: "Uses the 2020 deal-time consensus peak estimate, not the eventual actual (which ran far lower, ~$1.4B by FY2025) — genuinely what the market thought it was paying for at the time." },
    { acquirer: "J&J", target: "Intra-Cellular Therapies", year: 2025, valueB: 14.6, drug: "Caplyta", peakSalesB: 0.9, multiple: 16.22, timing: "post-approval", note: "Caplyta was already commercial and still growing at deal time — a premium multiple for an already-de-risked, already-scaling CNS asset." },
    { acquirer: "Sanofi", target: "Blueprint Medicines", year: 2025, valueB: 9.5, drug: "Ayvakit", peakSalesB: 0.6, multiple: 15.83, timing: "post-approval", note: "Blueprint's approved flagship asset, though the company had pipeline beyond it too." },
    { acquirer: "Sun Pharma", target: "Checkpoint Therapeutics", year: 2025, valueB: 0.355, drug: "Unloxcyt", peakSalesB: 0.1, multiple: 3.55, timing: "post-approval", note: "Small-scale end of the range — both deal size and peak sales are modest." },
    { acquirer: "Novartis", target: "AveXis", year: 2018, valueB: 8.7, drug: "Zolgensma", peakSalesB: 1.2, multiple: 7.25, timing: "pre-approval, retrospective", note: "AveXis was acquired in 2018, before AVXS-101 was approved as Zolgensma — this multiple uses the asset's actual eventual peak, a real bet that paid off, not deal-time knowledge." },
    { acquirer: "Gilead", target: "Kite Pharma", year: 2017, valueB: 11.9, drug: "Yescarta", peakSalesB: 1.5, multiple: 7.93, timing: "pre-approval, retrospective", note: "Kite was acquired in 2017, before axi-cel was approved as Yescarta — same retrospective caveat as AveXis/Zolgensma." }
  ]
};

// ── Peak sales comps — real drugs and their actual (or consensus-estimated,
// clearly labeled) peak annual sales, spanning blockbuster-scale down to
// modest/early-launch scale so there's a genuine comp regardless of how big
// your own asset's ambitions are. Compiled from company disclosures and
// public deal/analyst commentary; refreshed periodically, not a live feed. ──
const PEAK_SALES_COMPS = {
  asOf: "August 2026",
  drugs: [
    { drug: "Keytruda", company: "Merck", area: "Oncology (broad, PD-1)", modality: "biologic", peakSalesB: 29.5, asOfYear: 2024, status: "still growing" },
    { drug: "Humira", company: "AbbVie", area: "Immunology", modality: "biologic", peakSalesB: 21.2, asOfYear: 2022, status: "peaked, now eroding to biosimilars" },
    { drug: "Eliquis", company: "BMS / Pfizer", area: "Cardiovascular", modality: "small molecule", peakSalesB: 12.9, asOfYear: 2024, status: "still growing" },
    { drug: "Stelara", company: "J&J", area: "Immunology", modality: "biologic", peakSalesB: 10.36, asOfYear: 2024, status: "peaked, now eroding to biosimilars" },
    { drug: "Trikafta / Vanzatri", company: "Vertex", area: "Rare disease (cystic fibrosis)", modality: "small molecule", peakSalesB: 10.2, asOfYear: 2024, status: "still growing" },
    { drug: "Darzalex", company: "J&J", area: "Oncology (multiple myeloma)", modality: "biologic", peakSalesB: 11.7, asOfYear: 2024, status: "still growing" },
    { drug: "Opdivo", company: "Bristol Myers Squibb", area: "Oncology (PD-1)", modality: "biologic", peakSalesB: 9.0, asOfYear: 2023, status: "roughly plateaued" },
    { drug: "Imbruvica", company: "AbbVie / J&J", area: "Oncology (hematology, BTK)", modality: "small molecule", peakSalesB: 9.5, asOfYear: 2021, status: "peaked, now declining" },
    { drug: "Biktarvy", company: "Gilead", area: "Infectious disease (HIV)", modality: "small molecule", peakSalesB: 12.9, asOfYear: 2024, status: "still growing" },
    { drug: "Ocrevus", company: "Roche", area: "Neurology (multiple sclerosis)", modality: "biologic", peakSalesB: 7.5, asOfYear: 2024, status: "still growing" },
    { drug: "Soliris", company: "Alexion / AstraZeneca", area: "Rare disease (PNH)", modality: "biologic", peakSalesB: 5.0, asOfYear: 2020, status: "peaked pre-acquisition, cited directly in AZ deal commentary" },
    { drug: "Skyrizi", company: "AbbVie", area: "Immunology", modality: "biologic", peakSalesB: 11.7, asOfYear: 2024, status: "still growing rapidly (Humira successor)" },
    { drug: "Vyndaqel / Vyndamax", company: "Pfizer", area: "Rare disease (ATTR-CM)", modality: "small molecule", peakSalesB: 3.3, asOfYear: 2023, status: "still growing" },
    { drug: "Trodelvy", company: "Gilead (ex-Immunomedics)", area: "Oncology (TNBC, ADC)", modality: "biologic (ADC)", peakSalesB: 4.0, asOfYear: null, status: "2020 deal-time consensus estimate — actual FY2025 sales were $1.4B (still growing, boosted by positive Phase 3 ASCENT-03/04 readouts), a useful reminder of how far early deal-time estimates can run from reality years later" },
    { drug: "Enhertu", company: "Daiichi Sankyo / AstraZeneca", area: "Oncology (HER2, ADC)", modality: "biologic (ADC)", peakSalesB: 15.0, asOfYear: null, status: "analyst consensus peak, driven by ongoing indication expansion — real combined FY2025 sales already reached ~$5.0B and still growing, so this is a forward projection, not yet a realized figure. Complements the Daiichi Sankyo/AstraZeneca profit-share licensing entry in Licensing Comps — same asset, deal-economics vs. commercial-scale view of it" },
    { drug: "Ayvakit", company: "Blueprint Medicines / Sanofi", area: "Oncology / rare (GIST, systemic mastocytosis)", modality: "small molecule", peakSalesB: 0.6, asOfYear: 2024, status: "still growing — smaller-indication comp" },
    { drug: "Caplyta", company: "Intra-Cellular / J&J", area: "CNS (schizophrenia, bipolar depression)", modality: "small molecule", peakSalesB: 0.9, asOfYear: 2024, status: "still growing — mid-scale CNS comp" },
    { drug: "Ohtuvayre", company: "Verona Pharma / Merck", area: "Respiratory (COPD)", modality: "small molecule", peakSalesB: 0.3, asOfYear: 2024, status: "early launch — smaller/newer-launch comp" },
    { drug: "Unloxcyt", company: "Checkpoint Therapeutics / Sun Pharma", area: "Oncology (dermatology, skin cancer)", modality: "biologic", peakSalesB: 0.1, asOfYear: 2025, status: "early launch — very small-scale comp" },
    // Additions — closing two real gaps: (1) GLP-1/obesity, the largest
    // recent value story in the industry, was entirely absent; (2) genuine
    // gene/cell therapy examples (vs. only traditional biologics/small
    // molecules) were missing despite modality being a live discussion for
    // this app. All figures are actual reported FY2024 (or FY2025 where
    // noted), not projections, except Casgevy which is explicitly labeled
    // as a single analyst's (Goldman's) estimate, above the broader
    // consensus, since it's too newly launched to have an actual figure.
    { drug: "Ozempic", company: "Novo Nordisk", area: "Metabolic (type 2 diabetes, GLP-1)", modality: "biologic", peakSalesB: 17.5, asOfYear: 2024, status: "still growing" },
    { drug: "Mounjaro", company: "Eli Lilly", area: "Metabolic (type 2 diabetes, GLP-1/GIP)", modality: "biologic", peakSalesB: 11.5, asOfYear: 2024, status: "still growing rapidly" },
    { drug: "Dupixent", company: "Sanofi / Regeneron", area: "Immunology (atopic dermatitis, asthma, COPD)", modality: "biologic", peakSalesB: 13.6, asOfYear: 2024, status: "still growing" },
    { drug: "Wegovy", company: "Novo Nordisk", area: "Metabolic (obesity, GLP-1)", modality: "biologic", peakSalesB: 8.4, asOfYear: 2024, status: "still growing rapidly" },
    { drug: "Zepbound", company: "Eli Lilly", area: "Metabolic (obesity, GLP-1/GIP)", modality: "biologic", peakSalesB: 4.93, asOfYear: 2024, status: "still growing very rapidly — launched Nov 2023" },
    { drug: "Yescarta", company: "Gilead / Kite Pharma", area: "Oncology (CAR-T, large B-cell lymphoma)", modality: "biologic", peakSalesB: 1.5, asOfYear: 2024, status: "still growing modestly — leading CAR-T product by sales" },
    { drug: "Zolgensma", company: "Novartis", area: "Rare disease (gene therapy, spinal muscular atrophy)", modality: "biologic", peakSalesB: 1.2, asOfYear: 2024, status: "stabilized — one-time dosing means revenue is driven by incident (new) patients, not repeat purchase" },
    { drug: "Elevidys", company: "Sarepta Therapeutics", area: "Rare disease (gene therapy, Duchenne muscular dystrophy)", modality: "biologic", peakSalesB: 0.82, asOfYear: 2024, status: "still growing rapidly — launched mid-2023" },
    { drug: "Casgevy", company: "Vertex / CRISPR Therapeutics", area: "Rare disease (CRISPR gene editing, sickle cell / beta-thalassemia)", modality: "biologic", peakSalesB: 3.9, asOfYear: 2024, status: "Goldman Sachs estimate, above the broader Street consensus (~$2.2B per Bloomberg) — too newly launched for an actual figure yet" },
    // Round 2 — the list still skewed heavily toward mega-blockbusters
    // (41% were >$10B). These specifically target the low-to-mid range
    // ($100M-$2B), which is what most real drugs actually look like, and
    // includes genuine commercial underperformers (Krazati, Abecma) —
    // valuable comps precisely because not every approved drug is a hit.
    { drug: "Vyvgart", company: "argenx", area: "Immunology (myasthenia gravis, CIDP)", modality: "biologic", peakSalesB: 2.2, asOfYear: 2024, status: "still growing rapidly" },
    { drug: "Reblozyl", company: "Bristol Myers Squibb", area: "Hematology (anemia in MDS)", modality: "biologic", peakSalesB: 1.77, asOfYear: 2024, status: "still growing" },
    { drug: "Tezspire", company: "Amgen / AstraZeneca", area: "Immunology (severe asthma)", modality: "biologic", peakSalesB: 1.22, asOfYear: 2024, status: "still growing rapidly" },
    { drug: "Opdualag", company: "Bristol Myers Squibb", area: "Oncology (melanoma)", modality: "biologic", peakSalesB: 0.928, asOfYear: 2024, status: "still growing" },
    { drug: "Camzyos", company: "Bristol Myers Squibb", area: "Cardiovascular (obstructive hypertrophic cardiomyopathy)", modality: "small molecule", peakSalesB: 0.602, asOfYear: 2024, status: "still growing rapidly, more than doubled from 2023" },
    { drug: "Abecma", company: "2seventy bio / Bristol Myers Squibb", area: "Oncology (CAR-T, multiple myeloma)", modality: "biologic", peakSalesB: 0.242, asOfYear: 2024, status: "modest — a real example of an approved CAR-T that hasn't scaled the way Yescarta has; figure is 2seventy's reported US share, global total somewhat higher" },
    { drug: "Krazati", company: "Bristol Myers Squibb / Mirati", area: "Oncology (KRAS G12C, non-small cell lung cancer)", modality: "small molecule", peakSalesB: 0.126, asOfYear: 2024, status: "modest — a real example of a KRAS inhibitor underperforming the early hype around this drug class" },
    // Round 3 — genuinely small, early-stage comps. Most real approved
    // drugs look like these three, not like Keytruda — a representative
    // comp set needs this end of the range properly populated, not just
    // token examples.
    { drug: "Fabhalta", company: "Novartis", area: "Rare disease (IgA nephropathy, kidney)", modality: "small molecule", peakSalesB: 0.505, asOfYear: 2024, status: "still growing very rapidly (+291% YoY)" },
    { drug: "Rezdiffra", company: "Madrigal Pharmaceuticals", area: "Metabolic (MASH/NASH, first-in-class)", modality: "small molecule", peakSalesB: 0.18, asOfYear: 2024, status: "still growing extremely rapidly — first full year of launch; run-rate implied >$1B annualized by Q3 2025" },
    { drug: "Wainua", company: "AstraZeneca / Ionis", area: "Rare disease (hereditary ATTR amyloidosis, nerve)", modality: "small molecule", peakSalesB: 0.044, asOfYear: 2024, status: "very early launch — small-scale comp, useful floor reference" }
  ]
};

// ── Licensing / royalty deal comps — real, multi-source-verified out-license
// agreements: what a company (usually a smaller biotech) received for
// granting a partner development/commercialization rights to an asset, in
// exchange for upfront cash, milestones, and ongoing royalties (or, in a few
// cases, a profit-share instead of a traditional royalty — noted explicitly
// where that's the structure). Every deal below is confirmed against the
// companies' own press releases and, wherever available, primary-source SEC
// filings (8-K, 10-K, 10-Q, 6-K) — not third-party deal trackers alone.
// Deliberately smaller than the M&A and Peak Sales comps sets: each entry
// here took genuine research to verify precisely (multiple deals initially
// found had inconsistent figures across sources and were excluded or
// resolved against the primary filing rather than included on a guess).
// royaltyLow/royaltyHigh are null when the actual rate wasn't disclosed
// (common — many deals only ever say "tiered royalties") or when the deal
// is profit-shared rather than royalty-based; royaltyNote always describes
// what's actually known, never fills a gap with an assumed figure.
const LICENSING_COMPS = {
  asOf: "August 2026",
  heuristics: [
    "Upfront typically runs 5-15% of total deal value for preclinical/Phase 1 assets, rising to 20-30%+ for Phase 3 or approved products — most of a deal's headline value sits in milestones that may never be paid.",
    "A disclosed royalty rate is the exception, not the rule — most deals only ever say \"tiered royalties,\" without a number. Treat an undisclosed rate as genuinely unknown, not as license to assume a market-average figure.",
    "Royalty rates broadly scale with stage and deal leverage: single digits for preclinical/discovery-stage licenses, low-to-mid double digits for de-risked clinical assets, high teens+ for late-stage or already-differentiated data.",
    "A profit-share structure (no traditional royalty at all) shows up more often than expected in mega-deals between two large, well-capitalized companies — it's a different economic bet than a royalty, not just a different label for one."
  ],
  deals: [
    { licensor: "Kelun-Biotech", licensee: "Merck & Co.", year: 2022, asset: "7 ADC candidates (oncology)", area: "Oncology (ADC)", stage: "Preclinical", territory: "Worldwide ex-Greater China", upfrontM: 175, totalDealValueM: 9300, royaltyLow: null, royaltyHigh: null, royaltyNote: "tiered royalties on net sales, rate undisclosed" },
    { licensor: "Akeso", licensee: "Summit Therapeutics", year: 2022, asset: "Ivonescimab (PD-1/VEGF bispecific)", area: "Oncology", stage: "Approved in China, developing ex-China", territory: "US, Canada, Europe, Japan", upfrontM: 500, totalDealValueM: 5000, royaltyLow: 10, royaltyHigh: 15, royaltyNote: "low double-digit royalties on net sales" },
    { licensor: "Alnylam", licensee: "Roche", year: 2023, asset: "Zilebesiran (RNAi, hypertension)", area: "Cardiovascular", stage: "Phase 2", territory: "Ex-US (co-commercialized in US)", upfrontM: 310, totalDealValueM: 2800, royaltyLow: 10, royaltyHigh: 15, royaltyNote: "low double-digit royalties on ex-US net sales; 50/50 profit share in the US instead of a royalty there" },
    { licensor: "Daiichi Sankyo", licensee: "AstraZeneca", year: 2019, asset: "Trastuzumab deruxtecan / Enhertu (HER2 ADC)", area: "Oncology (ADC)", stage: "Pivotal, pre-approval", territory: "Worldwide ex-Japan", upfrontM: 1350, totalDealValueM: 6900, royaltyLow: null, royaltyHigh: null, royaltyNote: "50/50 worldwide profit share (ex-Japan) — not royalty-based at all" },
    { licensor: "Biocytogen", licensee: "IDEAYA Biosciences", year: 2024, asset: "IDE034 (B7H3/PTK7 bispecific ADC)", area: "Oncology (ADC)", stage: "Preclinical", territory: "Worldwide", upfrontM: 6.5, totalDealValueM: 406.5, royaltyLow: 1, royaltyHigh: 4, royaltyNote: "low-to-mid single-digit royalties on net sales" },
    { licensor: "AC Immune", licensee: "Takeda", year: 2024, asset: "ACI-24.060 (anti-amyloid beta immunotherapy)", area: "Neurology (Alzheimer's)", stage: "Phase 1b/2", territory: "Worldwide", upfrontM: 100, totalDealValueM: 2100, royaltyLow: 15, royaltyHigh: 19, royaltyNote: "tiered, mid-to-high teens royalties on worldwide net sales" },
    { licensor: "Ionis / Akcea", licensee: "Pfizer", year: 2019, asset: "AKCEA-ANGPTL3-LRx (cardiovascular/metabolic)", area: "Cardiovascular / Metabolic", stage: "Clinical", territory: "Worldwide", upfrontM: 250, totalDealValueM: 1550, royaltyLow: null, royaltyHigh: null, royaltyNote: "tiered double-digit royalties on worldwide net sales — reported as \"double-digit\" without a low/high qualifier, so no confident numeric range" },
    { licensor: "RemeGen", licensee: "AbbVie", year: 2026, asset: "RC148 (PD-1/VEGF bispecific antibody)", area: "Oncology", stage: "Phase 2", territory: "Worldwide ex-Greater China", upfrontM: 650, totalDealValueM: 5600, royaltyLow: null, royaltyHigh: null, royaltyNote: "tiered double-digit royalties on net sales outside Greater China — reported without a low/high qualifier, so no confident numeric range" },
    { licensor: "United Biotechnology", licensee: "Novo Nordisk", year: 2025, asset: "UBT251 (GLP-1/GIP/glucagon triple agonist)", area: "Obesity / Metabolic", stage: "Phase 1 ready", territory: "Worldwide ex-Greater China and Taiwan", upfrontM: 200, totalDealValueM: 2000, royaltyLow: null, royaltyHigh: null, royaltyNote: "tiered royalties on net sales, rate undisclosed" },
    { licensor: "Precision BioSciences", licensee: "TG Therapeutics", year: 2024, asset: "Azer-cel (allogeneic CAR T, autoimmune disease)", area: "Autoimmune / Cell therapy", stage: "Clinical", territory: "Worldwide", upfrontM: 17.5, totalDealValueM: 305.5, royaltyLow: 8, royaltyHigh: 12, royaltyNote: "high-single-digit to low-double-digit royalties on net sales; the $17.5M figure combines upfront and near-term payments as reported, not upfront alone" },
    { licensor: "Prime Medicine", licensee: "Bristol Myers Squibb", year: 2024, asset: "Prime-edited ex vivo T-cell therapy reagents (PASSIGE platform)", area: "Gene editing / Cell therapy", stage: "Preclinical/research", territory: "Worldwide", upfrontM: 55, totalDealValueM: 3555, royaltyLow: null, royaltyHigh: null, royaltyNote: "royalties on net sales, rate undisclosed; BMS also made a separate $55M equity investment in Prime Medicine alongside the $55M cash upfront — kept out of upfrontM/totalDealValueM here since equity purchases aren't the same transaction type as payment for rights" },
    // Additions — the PD-1/VEGF bispecific class produced an unusually dense
    // cluster of large, well-documented licensing deals in 2024-2025; three
    // of the largest are added here for real cross-deal comparison within
    // one hot mechanism class, plus one non-oncology (obesity) deal for area
    // diversity. Each figure cross-checked against at least two independent
    // sources (company press release plus trade press) before entry.
    { licensor: "3SBio", licensee: "Pfizer", year: 2025, asset: "SSGJ-707 (PD-1/VEGF bispecific)", area: "Oncology (NSCLC, colorectal, gynecologic)", stage: "Phase 2 (China), entering Phase 3", territory: "Worldwide ex-China", upfrontM: 1250, totalDealValueM: 6050, royaltyLow: null, royaltyHigh: null, royaltyNote: "tiered double-digit royalties on worldwide net sales, no low/high split disclosed; excludes a separate $100M equity investment Pfizer made in 3SBio alongside the license, kept out of upfrontM/totalDealValueM per the same equity-vs-license convention as the BMS/Prime Medicine entry above" },
    { licensor: "BioNTech", licensee: "Bristol Myers Squibb", year: 2025, asset: "BNT327 / pumitamig (PD-L1/VEGF-A bispecific)", area: "Oncology (broad solid tumor)", stage: "Phase 2/3 (multiple registrational trials ongoing or planned)", territory: "Worldwide, co-developed and co-commercialized 50/50", upfrontM: 1500, totalDealValueM: 11100, royaltyLow: null, royaltyHigh: null, royaltyNote: "50/50 global cost-and-profit share — not royalty-based at all; total includes $2B in non-contingent anniversary payments through 2028 on top of the $1.5B upfront, plus up to $7.6B in additional development/regulatory/commercial milestones" },
    { licensor: "LaNova Medicines", licensee: "Merck & Co.", year: 2024, asset: "LM-299 (PD-1/VEGF bispecific)", area: "Oncology", stage: "Phase 1", territory: "Worldwide", upfrontM: 588, totalDealValueM: 3288, royaltyLow: null, royaltyHigh: null, royaltyNote: "milestone-heavy structure ($300M of the $2.7B tied specifically to technology transfer, separate from clinical/regulatory/commercial gates); royalty terms not disclosed in public reporting" },
    { licensor: "Zealand Pharma", licensee: "Roche", year: 2025, asset: "Petrelintide (amylin analog)", area: "Metabolic (obesity)", stage: "Phase 2 (positive results reported; Phase 3 planned H2 2026)", territory: "US & Europe (co-commercialized 50/50), Roche exclusive rest-of-world", upfrontM: 1400, totalDealValueM: 5300, royaltyLow: 10, royaltyHigh: 19, royaltyNote: "tiered double-digit up to high-teens royalties apply only to rest-of-world net sales; US/Europe is a 50/50 profit share instead, not royalty-based there" }
  ]
};
