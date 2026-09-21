// ════════════════════════════════════════════════════════════════════════════
// RxNPV — REVENUE BUILD ENGINE (pure functions, no UI/React dependency)
// Implements the bottoms-up waterfall:
//   population → diagnosis/treatment → adherence → peak patients (market share)
//   → launch ramp → pricing (US + ex-US) → exclusivity/LOE erosion
// ════════════════════════════════════════════════════════════════════════════

// ── Launch curve: returns array of length yearsToPeak, % of peak per year ──
// Uses the exact published empirical curve (Figure 6-2) for ramp lengths 3-10yr — the range
// that's actually tabulated. Outside that range (1-2yr or 11yr+), falls back to interpolating
// the 6yr curve proportionally (verified to reproduce the real 3-10yr values within ~1pp).
function launchCurveForYears(yearsToPeak, profile) {
  const n = Math.max(1, Math.round(yearsToPeak));
  const exactKey = profile === "p25" ? "lo" : profile === "p75" ? "hi" : "median";
  if (typeof LAUNCH_CURVE_EXACT !== "undefined" && LAUNCH_CURVE_EXACT[n]) {
    return LAUNCH_CURVE_EXACT[n][exactKey].slice();
  }
  const base = profile === "p25" ? LAUNCH_CURVE.years6_p25 : profile === "p75" ? LAUNCH_CURVE.years6_p75 : LAUNCH_CURVE.years6;
  if (n === 6) return base.slice();
  const pts = [0].concat(base); // pts[0]=0% at year0
  const out = [];
  for (let y = 1; y <= n; y++) {
    const srcX = (y / n) * 6; // map this year's position onto the 0..6 base curve
    const lo = Math.floor(srcX), hi = Math.ceil(srcX);
    const loPct = pts[lo] !== undefined ? pts[lo] : 100;
    const hiPct = pts[hi] !== undefined ? pts[hi] : 100;
    const frac = srcX - lo;
    out.push(loPct + (hiPct - loPct) * frac);
  }
  out[out.length - 1] = 100; // ensure exact peak at final year
  return out;
}

// Normalizes each modality's erosion defaults to one shape (volRetainedPct,
// priceDeclinePct, rampYears) regardless of how the underlying source data
// happens to be structured — biologic's own table states volume as % LOST
// over a 1-5yr ramp while small molecule's states % RETAINED after a 1yr
// ramp, because that's how each was actually stated in the source; cell/gene
// therapy use the more direct "retained" shape since they're not quoting a
// specific source table. Kept as one small per-modality function rather than
// forcing the raw data into a single shape, so data.js still reads as an
// honest transcription of what each source actually said.
function getErosionDefaults(modality) {
  const e = EXCLUSIVITY_BENCHMARKS.erosion;
  if (modality === "biologic") return { volRetainedPct: 100 - e.biologic.volumeLostOverYears1to5, priceDeclinePct: e.biologic.priceDeclineDefault, rampYears: 5 };
  if (modality === "cellTherapy") return { volRetainedPct: e.cellTherapy.volumeRetainedAfter1yrDefault, priceDeclinePct: e.cellTherapy.usPriceDeclineDefault, rampYears: 1 };
  if (modality === "geneTherapy") return { volRetainedPct: e.geneTherapy.volumeRetainedAfter1yrDefault, priceDeclinePct: e.geneTherapy.usPriceDeclineDefault, rampYears: 1 };
  return { volRetainedPct: e.smallMolecule.volumeRetainedAfter1yrDefault, priceDeclinePct: e.smallMolecule.usPriceDeclineDefault, rampYears: 1 };
}

// UI-facing bench {value, source} pairs for the two exclusivity BenchFields —
// shared by the Program Editor so it isn't hand-rolling per-modality source
// text inline (previously a 2-way ternary that only covered biologic vs.
// everything-else).
function getExclusivityBenchText(modality) {
  const e = EXCLUSIVITY_BENCHMARKS.erosion;
  const d = getErosionDefaults(modality);
  if (modality === "biologic") {
    return {
      volRetained: { value: d.volRetainedPct, source: EXCLUSIVITY_BENCHMARKS.source + " — biologics lose ~20% volume over 1-5yr of biosimilar entry (explicitly stated typical assumption)" },
      priceDecline: { value: d.priceDeclinePct, source: EXCLUSIVITY_BENCHMARKS.source + " — half of the 60-70% 5yr USD value loss, per \"50% of that will reflect price concessions\". " + e.biologic.tensionNote }
    };
  }
  if (modality === "cellTherapy") {
    return {
      volRetained: { value: d.volRetainedPct, source: e.cellTherapy.note },
      priceDecline: { value: d.priceDeclinePct, source: e.cellTherapy.note }
    };
  }
  if (modality === "geneTherapy") {
    return {
      volRetained: { value: d.volRetainedPct, source: e.geneTherapy.note },
      priceDecline: { value: d.priceDeclinePct, source: e.geneTherapy.note }
    };
  }
  return {
    volRetained: { value: d.volRetainedPct, source: EXCLUSIVITY_BENCHMARKS.source + " — \"we typically model a 90% loss of sales volume\" within 1yr of generic entry (0-30% retained range, wide by brand loyalty)" },
    priceDecline: { value: d.priceDeclinePct, source: EXCLUSIVITY_BENCHMARKS.source + " — midpoint of stated 25-50% range (oral agents ~25%, physician-administered 38-46%)" }
  };
}

// ── Resolve exclusivity/erosion parameters with source-benchmark defaults (shared by
// full and quick revenue engines so both apply identical LOE mechanics) ──
function resolveErosionParams(exclusivity) {
  const yearsToLOE = exclusivity.yearsToLOE !== "" && exclusivity.yearsToLOE != null ? Number(exclusivity.yearsToLOE) : 13;
  const modality = exclusivity.modality || "smallMolecule";
  const erosionDefaults = getErosionDefaults(modality);
  const volRetained = (exclusivity.volumeRetainedPct != null && exclusivity.volumeRetainedPct !== ""
    ? Number(exclusivity.volumeRetainedPct)
    : erosionDefaults.volRetainedPct) / 100;
  const priceDecline = (exclusivity.priceDeclinePct != null && exclusivity.priceDeclinePct !== ""
    ? Number(exclusivity.priceDeclinePct)
    : erosionDefaults.priceDeclinePct) / 100;
  const erosionRampYears = erosionDefaults.rampYears;
  return { yearsToLOE, modality, volRetained, priceDecline, erosionRampYears };
}
// Returns the [0,1] multiplier to apply to revenue in year y, given resolved erosion params.
function erosionMultiplier(y, erosion) {
  if (y <= erosion.yearsToLOE) return 1;
  const yearsPastLOE = y - erosion.yearsToLOE;
  const erosionFrac = Math.min(1, yearsPastLOE / erosion.erosionRampYears);
  const volMultiplier = 1 - erosionFrac * (1 - erosion.volRetained);
  const priceMultiplier = 1 - erosionFrac * erosion.priceDecline;
  return volMultiplier * priceMultiplier;
}

// ── Market share: peak % share for a given order of entry into an N-drug market ──
function peakShareForEntry(numDrugs, orderOfEntry) {
  const n = Math.round(numDrugs);
  if (n <= 1) return 100;
  const capped = Math.min(Math.max(n, 2), 5);
  const row = MARKET_SHARE_TABLE[capped];
  const idx = Math.min(Math.max(Math.round(orderOfEntry), 1), capped) - 1;
  return row[idx];
}

// ── Population funnel: addressable → diagnosed/treated → eligible for this drug ──
// pop = { mode: 'prevalence'|'incidence', prevalence, incidence, diseaseDurationYears,
//         diagnosisRatePct, treatmentRatePct, eligiblePct }
function computeTreatedPopulation(pop) {
  let addressable;
  if (pop.mode === "incidence") {
    addressable = (numOr(pop.incidence, 0)) * (Number(pop.diseaseDurationYears) || 1);
  } else {
    addressable = numOr(pop.prevalence, 0);
  }
  const diagnosed = addressable * ((pop.diagnosisRatePct !== "" && pop.diagnosisRatePct != null ? Number(pop.diagnosisRatePct) : 100) / 100);
  const treated = diagnosed * ((pop.treatmentRatePct !== "" && pop.treatmentRatePct != null ? Number(pop.treatmentRatePct) : 100) / 100);
  const eligible = treated * ((pop.eligiblePct !== "" && pop.eligiblePct != null ? Number(pop.eligiblePct) : 100) / 100);
  return { addressable, diagnosed, treated, eligible };
}

// ── Full program revenue build → returns array of {year, usRevenue, exUSRevenue, totalRevenue, onDrugPatients} ──
// program.revenueBuild = {
//   population: {...}, adherencePct, marketShare: {numDrugs, orderOfEntry, peakShareOverridePct},
//   launchCurve: {yearsToPeak, profile},
//   pricing: {usAnnualPrice, usAnnualGrowthPct, includeExUS, exUSPct, exUSPriceFactorPct, exUSAnnualGrowthPct},
//   exclusivity: {yearsToLOE, modality: 'smallMolecule'|'biologic', volumeRetainedPct, priceDeclinePct, tailYears}
// }
// projectionYears: total years to project (post-launch), e.g. 20
function computeProgramRevenue(rb, projectionYears) {
  projectionYears = projectionYears || 20;
  const funnel = computeTreatedPopulation(rb.population);
  const share = rb.marketShare.peakShareOverridePct != null && rb.marketShare.peakShareOverridePct !== ""
    ? Number(rb.marketShare.peakShareOverridePct)
    : peakShareForEntry(rb.marketShare.numDrugs, rb.marketShare.orderOfEntry);
  const adherence = (rb.adherencePct !== "" && rb.adherencePct != null ? Number(rb.adherencePct) : 100) / 100;
  const peakPatients = funnel.eligible * (share / 100) * adherence;

  const ramp = launchCurveForYears(rb.launchCurve.yearsToPeak, rb.launchCurve.profile);
  const yearsToPeak = ramp.length;

  const usPrice0 = numOr(rb.pricing.usAnnualPrice, 0);
  const usGrowth = (numOr(rb.pricing.usAnnualGrowthPct, 0)) / 100;
  const includeExUS = !!rb.pricing.includeExUS;
  const exUSFactor = (numOr(rb.pricing.exUSPriceFactorPct, 0)) / 100;
  const exUSGrowth = (numOr(rb.pricing.exUSAnnualGrowthPct, 0)) / 100;
  const exUSPatientPct = (rb.pricing.exUSPatientMultiplierPct !== "" && rb.pricing.exUSPatientMultiplierPct != null ? Number(rb.pricing.exUSPatientMultiplierPct) : 100) / 100; // ex-US patient pool relative to US pool (user-supplied, since epi data is region-specific)

  const erosion = resolveErosionParams(rb.exclusivity);

  const out = [];
  for (let y = 1; y <= projectionYears; y++) {
    // % of peak from launch curve (post-peak = 100%, pre-launch handled by caller via launchYearOffset)
    const rampPct = y <= yearsToPeak ? ramp[y - 1] / 100 : 1;
    const patientsThisYear = peakPatients * rampPct;

    // Price growth compounds each year pre-LOE
    const usPrice = usPrice0 * Math.pow(1 + usGrowth, y - 1);
    let usRevenue = patientsThisYear * usPrice;

    let exUSRevenue = 0;
    if (includeExUS) {
      const exUSPrice = usPrice0 * exUSFactor * Math.pow(1 + exUSGrowth, y - 1);
      const exUSPatients = patientsThisYear * exUSPatientPct;
      exUSRevenue = exUSPatients * exUSPrice;
    }

    // Exclusivity erosion — identical mechanics for full and quick revenue modes
    const em = erosionMultiplier(y, erosion);
    usRevenue *= em;
    exUSRevenue *= em;

    out.push({
      year: y,
      onDrugPatientsUS: Math.round(patientsThisYear),
      usRevenue: Math.round(usRevenue),
      exUSRevenue: Math.round(exUSRevenue),
      totalRevenue: Math.round(usRevenue + exUSRevenue)
    });
  }

  return {
    funnel, peakPatients: Math.round(peakPatients), peakShare: share,
    peakUSRevenue: Math.round(Math.max(...out.map(r => r.usRevenue))),
    peakTotalRevenue: Math.round(Math.max(...out.map(r => r.totalRevenue))),
    years: out
  };
}

// ── Aggregate multiple programs onto a shared calendar timeline ──
// programs: [{ id, name, launchYearOffset (years from case's "Year 0"), revenueResult }]
function aggregateCompanyRevenue(programResults, totalYears) {
  totalYears = totalYears || 25;
  const calendar = [];
  for (let cy = 0; cy < totalYears; cy++) {
    let total = 0, us = 0, exUS = 0;
    const byProgram = [];
    programResults.forEach(p => {
      const idx = cy - (p.launchYearOffset || 0); // index into p.revenueResult.years (0-based -> year idx+1)
      const yr = idx >= 0 ? p.revenueResult.years[idx] : null;
      const rev = yr ? yr.totalRevenue : 0;
      total += rev; us += yr ? yr.usRevenue : 0; exUS += yr ? yr.exUSRevenue : 0;
      byProgram.push({ id: p.id, name: p.name, revenue: rev });
    });
    calendar.push({ calendarYear: cy, totalRevenue: total, usRevenue: us, exUSRevenue: exUS, byProgram });
  }
  return calendar;
}

// ── QUICK MODE: build a revenue curve directly from a stated peak revenue,
// skipping the population/pricing waterfall. Same launch-curve and LOE-erosion
// mechanics as the full engine (via the shared helpers above), so switching
// between Quick and Full modes doesn't change how ramp/erosion behave — only
// how the peak number itself gets derived. ──
function computeQuickProgramRevenue(quick, exclusivity, projectionYears) {
  projectionYears = projectionYears || 25;
  const peakRevenue = numOr(quick.peakRevenue, 0);
  const ramp = launchCurveForYears(quick.yearsToPeak || 6, quick.profile || "median");
  const yearsToPeak = ramp.length;
  const erosion = resolveErosionParams(exclusivity);

  const out = [];
  for (let y = 1; y <= projectionYears; y++) {
    const rampPct = y <= yearsToPeak ? ramp[y - 1] / 100 : 1;
    let revenue = peakRevenue * rampPct;
    revenue *= erosionMultiplier(y, erosion);
    out.push({
      year: y, onDrugPatientsUS: 0, // not modeled in quick mode
      usRevenue: Math.round(revenue), exUSRevenue: 0, totalRevenue: Math.round(revenue)
    });
  }
  return {
    funnel: null, peakPatients: 0, peakShare: null,
    peakUSRevenue: Math.round(peakRevenue), peakTotalRevenue: Math.round(peakRevenue),
    years: out
  };
}

// ── Shared dispatcher: every caller should use this instead of calling
// computeProgramRevenue / computeQuickProgramRevenue directly, so quick vs
// full mode is respected consistently everywhere (Scorecard preview, company
// rollup, and the scenario/DCF pipeline all stay in sync). ──
// Applies partnership royalty economics to an already-computed revenue
// result — substitutes the partnered territory's revenue with a royalty
// stream (royaltyPct of what the company would have earned itself) rather
// than adding to it, so a partnered territory's revenue is never
// double-counted against the company still separately modeling its own
// sales there. Quick mode has no US/ex-US split (exUSRevenue is always 0
// there), so only "global" is meaningful for it — "us"/"exUS" territory
// choices are only actionable in Full mode.
function applyPartnershipToRevenue(revenueResult, partnership, revenueMode) {
  if (!partnership || !partnership.enabled || partnership.royaltyPct === "" || partnership.royaltyPct == null) return revenueResult;
  const royalty = Number(partnership.royaltyPct) / 100;
  if (!(royalty > 0)) return revenueResult;
  // Quick mode puts 100% of revenue in usRevenue and has no ex-US split at
  // all, and its UI never shows the territory selector — so the default of
  // "exUS" left the royalty applying to a base of zero while full commercial
  // revenue passed through untouched. A user who typed 15% saw the same
  // number as if they had modelled no deal whatsoever. There is only one
  // revenue figure in Quick mode, so a deal on it is by definition a deal on
  // all of it: resolve to "global" rather than honouring a territory the user
  // was never given a way to set.
  const territory = revenueMode === "quick" ? "global" : (partnership.territory || "exUS");

  const usIsRoyalty = territory === "us" || territory === "global";
  const exUSIsRoyalty = territory === "exUS" || territory === "global";

  const years = revenueResult.years.map(yr => {
    const us = usIsRoyalty ? Math.round(yr.usRevenue * royalty) : yr.usRevenue;
    const exUS = exUSIsRoyalty ? Math.round(yr.exUSRevenue * royalty) : yr.exUSRevenue;
    // Track how much of the year's revenue is royalty income rather than the
    // company's own commercial sales. Downstream cost logic needs to tell them
    // apart: a royalty cheque carries none of the licensor's own manufacturing
    // or selling costs, because the partner is the one doing both.
    const royaltyRevenue = (usIsRoyalty ? us : 0) + (exUSIsRoyalty ? exUS : 0);
    return { ...yr, usRevenue: us, exUSRevenue: exUS, totalRevenue: us + exUS, royaltyRevenue };
  });
  return {
    ...revenueResult, years,
    peakUSRevenue: Math.round(Math.max(...years.map(r => r.usRevenue), 0)),
    peakTotalRevenue: Math.round(Math.max(...years.map(r => r.totalRevenue), 0)),
    peakCommercialRevenue: Math.round(Math.max(...years.map(r => r.totalRevenue - r.royaltyRevenue), 0))
  };
}

// Every other optional field on a program is read defensively
// (`program.X || default`), but revenueBuild was being dereferenced
// directly in several places — a program missing it (hand-edited or
// imported case, or one written by a future/older schema) crashed the whole
// valuation engine rather than degrading gracefully. This normalizer is the
// single place that default lives, mirroring newProgram()'s shape exactly,
// so every consumer reads it the same way.
const DEFAULT_REVENUE_BUILD = {
  population: { mode: "prevalence", prevalence: "", incidence: "", diseaseDurationYears: "", diagnosisRatePct: "", treatmentRatePct: "", eligiblePct: "100" },
  adherencePct: "",
  marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "" },
  launchCurve: { yearsToPeak: 6, profile: "median" },
  pricing: { usAnnualPrice: "", usAnnualGrowthPct: "3", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" },
  exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
};

function getRevenueBuild(program) {
  const rb = program && program.revenueBuild;
  if (!rb) return DEFAULT_REVENUE_BUILD;
  // Also backfill any individual missing sub-object, so a partially-formed
  // revenueBuild is as safe as a wholly missing one.
  return {
    population: rb.population || DEFAULT_REVENUE_BUILD.population,
    adherencePct: rb.adherencePct != null ? rb.adherencePct : DEFAULT_REVENUE_BUILD.adherencePct,
    marketShare: rb.marketShare || DEFAULT_REVENUE_BUILD.marketShare,
    launchCurve: rb.launchCurve || DEFAULT_REVENUE_BUILD.launchCurve,
    pricing: rb.pricing || DEFAULT_REVENUE_BUILD.pricing,
    exclusivity: rb.exclusivity || DEFAULT_REVENUE_BUILD.exclusivity
  };
}

function getProgramRevenueResult(program, projectionYears) {
  const mode = program.revenueMode || "quick";
  const revenueBuild = getRevenueBuild(program);
  let result;
  if (mode === "quick") {
    const quick = program.quickRevenue || { peakRevenue: "", yearsToPeak: "6", profile: "median" };
    result = computeQuickProgramRevenue(quick, revenueBuild.exclusivity, projectionYears);
  } else {
    result = computeProgramRevenue(revenueBuild, projectionYears);
  }
  return applyPartnershipToRevenue(result, program.partnership, mode);
}
