// ════════════════════════════════════════════════════════════════════════════
// MATH VERIFICATION SUITE
//
// Scope, deliberately narrow: this verifies that the code COMPUTES WHAT IT
// CLAIMS TO COMPUTE. It does NOT check whether a benchmark value is the right
// one — every benchmark in data.js was derived by hand from the source
// document and is authoritative. Nothing here asserts that "Oncology Phase 2
// = 24.6%" is correct; it asserts that whatever that number is, it composes,
// discounts, and risk-adjusts correctly downstream.
//
// Every expected value below is derived INDEPENDENTLY — from a closed-form
// identity, a published reference constant, or arithmetic worked out by hand
// in the comment above the check — never by running the app and recording
// what it printed. A test that copies the implementation's own output proves
// nothing.
//
// Run: node math_verification.js   (from test/)
// ════════════════════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
// Same concatenation order as build.js MODULE_ORDER for the engine files we
// need. Loaded as one Function body because these are plain-script files with
// cross-file `const` references — separate eval() calls would scope them apart.
const FILES = [
  "data.js", "engine.js", "costEngine.js", "rdEngine.js", "posEngine.js",
  "dcfEngine.js", "capitalEngine.js", "scenarioEngine.js", "helpers.js",
  "ts_statsEngine.js", "ts_simulationEngine.js", "ts_peakSalesEngine.js", "ts_pkpdEngine.js",
  "ts_chart.js", "edgarEngine.js", "ctgovEngine.js", "trialDecoder.js", "trialResults.js", "openTargetsEngine.js", "literatureEngine.js", "assetProgram.js", "cmsEngine.js", "commercialEngine.js", "ts_ctgovEngine.js", "fdaEngine.js", "chart.js", "ts_fdaEngine.js"
];
global.React = { createElement: () => null, useState: () => [null, () => {}], useEffect: () => {}, Fragment: "F", Component: class {} };
global.document = { createElement: () => ({ style: {} }), getElementById: () => null };
global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// ts_simulationEngine.js and ts_peakSalesEngine.js each do
// `const STATS = (module?.exports) ? require(...) : this;` to reach
// statsEngine.js's RNG/test functions from a plain <script> context, where a
// real browser attaches every top-level `function` declaration onto `window`
// (= `this` at top level) automatically. `new Function(...)` bodies do NOT
// replicate that: their own top-level function declarations are ordinary
// function-scoped bindings, invisible on `this` unless put there explicitly.
// This shim closes exactly that gap for this test harness — it does not
// change app behavior, only makes the harness's `this` behave like the real
// runtime's `window` for the specific functions these two files reach for.
const globalScopeShim = "\nthis.randNormal=randNormal;this.randUniform=randUniform;this.randExponential=randExponential;" +
  "this.randBinomialCount=randBinomialCount;this.twoProportionZTest=twoProportionZTest;" +
  "this.twoSampleZTestMeans=twoSampleZTestMeans;this.logRankTest=logRankTest;this.normalInvCDF=normalInvCDF;\n";
const combined = FILES.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n\n") + globalScopeShim;
const EXPORTS = [
  "erf", "normalCDF", "normalInvCDF", "twoProportionZTest", "twoSampleZTestMeans", "logRankTest",
  "fisherExactTwoSided", "computeFragilityIndex", "logGamma", "wilsonScoreInterval",
  "ciFromPValue", "pValueFromCI", "ciFromPValueRatio", "pValueFromCIRatio",
  "closedFormPowerTwoProportion", "closedFormPowerMeans", "schoenfeldPower",
  "solveSampleSizeTwoProportion", "solveSampleSizeMeans", "solveEventsNeeded",
  "solveMinDetectableEffect", "solveMinDetectableRateTwoProportion", "solveMinDetectableDeltaMeans", "solveMinDetectableHazardRatio",
  "projectTreatmentRate", "effectiveNAfterDropout", "inflateForDropout", "stressPowerOver", "stressRange",
  "sampleTriangular", "pearsonCorrelation", "concIVBolus", "concOralFirstOrder",
  "halfLife", "analyticalAUC_IV", "analyticalAUC_Oral", "emaxEffect", "receptorOccupancy",
  "computeNPV", "computeCapitalStructure", "computePoSWeighting", "computePoSModifiers",
  "riskAdjustRnDCost", "brierScore", "peakShareForEntry", "getPosForArea",
  "computeRiskRatio", "computeOddsRatio", "computeRiskDifference", "computeNNT",
  "bonferroniAdjust", "holmBonferroniAdjust",
  "ciToSE", "computeFixedEffectMetaAnalysis", "computeHeterogeneity", "computeRandomEffectsMetaAnalysis",
  "POS_MODIFIERS", "POS_REGULATORY", "POS_REGULATORY_MODIFIERS",
  "SCENARIO_PRESETS", "getEffectiveScenarioPreset", "applyBasePosAdjustment",
  "computeProgramValuation", "computeCaseValuation", "computeProgramRiskWaterfall",
  "computeEffectivePoS", "computeRnDToLaunch", "resolveLaunchYearOffset",
  "computeFullCaseMonteCarlo", "solveImpliedPoSMultiplier", "computeEquityBridgeSteps", "computeRedFlags",
  "computePortfolioSummary", "shrinkBinaryResponseRate", "shrinkHazardRatio",
  "BINARY_SHRINKAGE_FACTOR", "HR_SHRINKAGE_FACTOR",
  "MODALITY_OPTIONS", "getCogsBenchmark", "getErosionDefaults", "resolveErosionParams",
  "COGS_BENCHMARKS", "EXCLUSIVITY_BENCHMARKS",
  "samplePrior", "priorQuantile", "simulateTimeToEventReplicate", "runAssuranceSimulation",
  "runPeakSalesSimulation", "driverSensitivity", "percentSpecToFraction", "percentSpecError",
  "niceTicks", "formatTick", "renderLineChart", "renderHistogram", "renderForestPlot",
  "treasuryMethodShares", "ifConvertedShares", "computeEquityValue", "applyFutureRaise",
  "classifyCatalystFunding", "monthsUntil", "parseCatalystDate", "RUNWAY_CUSHION_MONTHS_DEFAULT",
  "summarizeOrangeBookPatents", "isPediatricExtension", "parseFdaYyyymmdd",
  "computeBinaryEventImpliedPoS", "selectPeakSalesCompWindow",
  "applyTaxToCalendar", "computeMoleculeTypePoSRatios", "POS_BY_MOLECULE",
  "computeProgramValuation",
  "revenueChartYScale", "selectPeakSalesCompWindow",
  "measureStorage", "STORAGE_ASSUMED_QUOTA_BYTES", "STORAGE_WARN_FRACTION", "STORAGE_CRITICAL_FRACTION",
  "computeTreatedPopulation", "launchCurveForYears", "erosionMultiplier", "computeProgramRevenue",
  "resolveNetPrice", "aspPctOfBasis", "PRICE_BASIS_OPTIONS", "getRevenueBuild", "PRICING_CONVERSION_MATRIX", "priceBasisArticle",
  "computeQuickProgramRevenue", "resolveErosionParams", "LAUNCH_CURVE", "LAUNCH_CURVE_EXACT", "scaleRevenueResult",
  "computeCOGS", "computeSalesForceCost", "computeMarketingCost", "computeCorporateGA", "computeProgramPnL",
  "SALES_REP_COST", "SGA_BENCHMARKS", "SALES_FORCE_COMP_GROWTH_PCT",
  "tsFdaQueryString", "computeDilutionPath",
  "extractAnalogEffects", "tsClassifyEffectParam", "summarizeDossier", "positionInAnalogs",
  "decodeTrial", "decodeTrialRedFlags", "classifyAllocation", "classifyMasking", "classifyComparator", "classifyPrimaryEndpoint",
  "parseTrialResults", "parseResultOutcomes", "summarizeParticipantFlow", "summarizeAdverseEvents",
  "classifyPublication", "parseEpmcResult", "summarizeLiterature", "epmcClean",
  "summarizeAssetProgram", "describeEvidenceBase", "studyNamesIntervention", "assetPhaseRank", "ASSET_PROGRAM_FIELDS",
  "parseCmsPeriodLabel", "parseCmsAnnualRow", "parseCmsQuarterlyRow", "pickOverallRows",
  "mergeDrugSpendSeries", "addComparablePeriodGrowth", "impliedAnnualRunRate", "cmsSeriesFreshness", "indexToLaunch", "cmsNum", "CMS_DATASETS", "cmsNormalizeName", "cmsDisplayName",
  "normalizeActualEntry", "impliedAnnualFromActual", "modelYearForCalendar", "compareActualToModel", "actualVsModelSeries",
  "diffTrialSnapshots", "snapshotPredatesDesignFields",
  "resultsRedFlags", "trUnescape", "trNum", "trRate", "trMonthsBetweenDates",
  "applyPartnershipToRevenue", "getProgramRevenueResult", "computePartnershipContribution", "distributeRnDCostByYear",
  "computeSimpleMultipleValuation", "computeSOTPBreakdown",
  "periodMonths", "sumTranchesAtLatestDate", "calcRunwayFromFacts", "extractDebt",
  "extractSharesOutstanding", "extractDilutedShares", "extractOptions", "extractWarrants",
  "summarizeOpenMarketActivity", "FORM4_CODE_LABELS",
  "extractConvertibleNotes", "pickLatestUnit", "isFilingForm", "formatHalfLife"
];
const api = new Function(combined + "\nreturn {" + EXPORTS.join(",") + "};")();

// ── harness ────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function near(label, actual, expected, tol) {
  tol = tol == null ? 1e-9 : tol;
  const ok = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  if (ok) pass++; else { fail++; failures.push(`${label}\n    expected ${expected}, got ${actual} (tol ${tol})`); }
}
function ok(label, cond) {
  if (cond) pass++; else { fail++; failures.push(label + "\n    assertion false"); }
}
function section(name) { console.log("\n── " + name + " " + "─".repeat(Math.max(0, 60 - name.length))); }
const report = () => console.log(`   ${pass} passed, ${fail} failed`);

// ════════════════════════════════════════════════════════════════════════════
section("Normal distribution primitives");
// erf reference values — standard mathematical constants, independent of this app.
// A&S 7.1.26 is an approximation with a documented bound of |ε| < 1.5e-7, so
// it does not return exactly 0 at x=0 (it returns ~1e-9). That is inside spec.
// Tolerance here is the formula's own published bound, not an arbitrary epsilon.
near("erf(0) = 0 (within A&S 7.1.26 bound)", api.erf(0), 0, 1.5e-7);
near("erf(0.5) = 0.5204998778130465", api.erf(0.5), 0.5204998778130465, 1.5e-7);
near("erf(1) = 0.8427007929497149", api.erf(1), 0.8427007929497149, 1.5e-7);
near("erf(2) = 0.9953222650189527", api.erf(2), 0.9953222650189527, 1.5e-7);
near("erf is odd: erf(-1) = -erf(1)", api.erf(-1), -api.erf(1), 1e-12);
// Φ reference values.
near("Φ(0) = 0.5", api.normalCDF(0), 0.5, 1e-9);
near("Φ(1) = 0.8413447460685429", api.normalCDF(1), 0.8413447460685429, 1e-7);
near("Φ(1.96) = 0.9750021048517795", api.normalCDF(1.96), 0.9750021048517795, 1e-7);
near("Φ(-1.6448536269514722) = 0.05", api.normalCDF(-1.6448536269514722), 0.05, 1e-7);
near("Φ symmetry: Φ(-1.3)+Φ(1.3) = 1", api.normalCDF(-1.3) + api.normalCDF(1.3), 1, 1e-9);
// Φ⁻¹ reference values (Acklam).
near("Φ⁻¹(0.5) = 0", api.normalInvCDF(0.5), 0, 1e-9);
near("Φ⁻¹(0.975) = 1.959963984540054", api.normalInvCDF(0.975), 1.959963984540054, 1e-6);
near("Φ⁻¹(0.95) = 1.6448536269514722", api.normalInvCDF(0.95), 1.6448536269514722, 1e-6);
near("Φ⁻¹(0.80) = 0.8416212335729143", api.normalInvCDF(0.80), 0.8416212335729143, 1e-6);
// Round-trip: these two must be mutual inverses or every power/CI calc is off.
[0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99].forEach(p =>
  near("round-trip Φ(Φ⁻¹(" + p + ")) = " + p, api.normalCDF(api.normalInvCDF(p)), p, 1e-6));
report();

// ════════════════════════════════════════════════════════════════════════════
section("Hypothesis tests");
// Two-proportion z-test, hand-worked:
//   x1=45/n1=100 (p1=.45), x2=30/n2=100 (p2=.30)
//   pPool = 75/200 = 0.375
//   se = sqrt(0.375*0.625*(1/100+1/100)) = sqrt(0.234375*0.02) = sqrt(0.0046875)
//      = 0.06846531968814576
//   z  = 0.15 / 0.06846531968814576 = 2.190890230020664
{
  const r = api.twoProportionZTest(45, 100, 30, 100, "two");
  near("2-prop z = 2.190890230020664", r.z, 2.190890230020664, 1e-9);
  near("2-prop two-sided p = 2(1-Φ(z))", r.pValue, 2 * (1 - api.normalCDF(2.190890230020664)), 1e-9);
  const one = api.twoProportionZTest(45, 100, 30, 100, "one");
  near("one-sided p = half of two-sided (z>0)", one.pValue, r.pValue / 2, 1e-9);
  const flipped = api.twoProportionZTest(30, 100, 45, 100, "two");
  near("two-sided p symmetric under arm swap", flipped.pValue, r.pValue, 1e-12);
  ok("z sign flips under arm swap", Math.abs(flipped.z + r.z) < 1e-12);
}
// Two-sample z-test of means, hand-worked:
//   mean1=105, mean2=100, sd=15 both, n=50 both
//   se = sqrt(225/50 + 225/50) = sqrt(4.5+4.5) = sqrt(9) = 3
//   z  = 5/3 = 1.6666666666666667
{
  const r = api.twoSampleZTestMeans(105, 15, 50, 100, 15, 50, "two");
  near("2-sample means z = 5/3", r.z, 5 / 3, 1e-12);
  near("2-sample means p = 2(1-Φ(5/3))", r.pValue, 2 * (1 - api.normalCDF(5 / 3)), 1e-12);
}
// Log-rank, fully hand-worked on a 4-subject dataset (all events, distinct times):
//   treatment(arm1) times {2,5}; control(arm0) times {1,3}
//   t=1: risk 4 (n1=2,n0=2), d=1 in arm0 -> E1 += 1*2/4 = 0.5 ; V += (1*3*2*2)/(4*4*3)=0.25
//   t=2: risk 3 (n1=2,n0=1), d=1 in arm1 -> O1 += 1 ; E1 += 1*2/3 = 0.6666667 ; V += (1*2*2*1)/(3*3*2)=0.2222222
//   t=3: risk 2 (n1=1,n0=1), d=1 in arm0 -> E1 += 1*1/2 = 0.5 ; V += (1*1*1*1)/(2*2*1)=0.25
//   t=5: risk 1 -> nj<=1, skipped
//   O1=1, E1=1.6666667, V=0.7222222, z=(1-1.6666667)/sqrt(0.7222222) = -0.7844645
{
  const subjects = [
    { time: 2, event: 1, arm: 1 }, { time: 5, event: 1, arm: 1 },
    { time: 1, event: 1, arm: 0 }, { time: 3, event: 1, arm: 0 }
  ];
  const r = api.logRankTest(subjects);
  near("log-rank O1 = 1", r.O1, 1, 1e-12);
  near("log-rank E1 = 5/3", r.E1, 0.5 + 2 / 3 + 0.5, 1e-12);
  near("log-rank V = 13/18", r.V, 0.25 + 2 / 9 + 0.25, 1e-12);
  near("log-rank z = (O1-E1)/sqrt(V)", r.z, (1 - (0.5 + 2 / 3 + 0.5)) / Math.sqrt(0.25 + 2 / 9 + 0.25), 1e-12);
}
// Fisher's exact — Fisher's own tea-tasting table, published p = 0.4857142857...
near("Fisher exact tea-tasting p = 17/35", api.fisherExactTwoSided(3, 1, 1, 3), 17 / 35, 1e-12);
// Symmetry: transposing the table must not change a two-sided p.
near("Fisher exact symmetric under transpose", api.fisherExactTwoSided(5, 45, 20, 30), api.fisherExactTwoSided(20, 30, 5, 45), 1e-12);
// logGamma against exact factorials: Γ(n+1) = n!
near("logGamma(5) = ln(4!)", api.logGamma(5), Math.log(24), 1e-10);
near("logGamma(11) = ln(10!)", api.logGamma(11), Math.log(3628800), 1e-9);
report();

// ════════════════════════════════════════════════════════════════════════════
section("Confidence intervals");
// Wilson score vs the algebraically-independent Newcombe proportion form.
function wilsonIndependent(r, n, z) {
  const p = r / n, denom = 1 + z * z / n;
  const centre = p + z * z / (2 * n);
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lower: (centre - half) / denom, upper: (centre + half) / denom };
}
[[9, 20], [1, 10], [45, 100], [0, 20], [20, 20], [1, 3]].forEach(([r, n]) => {
  const a = api.wilsonScoreInterval(r, n, 0.95);
  const b = wilsonIndependent(r, n, api.normalInvCDF(0.975));
  near(`Wilson ${r}/${n} lower matches independent form`, a.lower, b.lower, 1e-10);
  near(`Wilson ${r}/${n} upper matches independent form`, a.upper, b.upper, 1e-10);
});
// Boundedness — the whole reason Wilson is used instead of the normal approx.
[[0, 20], [20, 20], [1, 200]].forEach(([r, n]) => {
  const w = api.wilsonScoreInterval(r, n, 0.95);
  ok(`Wilson ${r}/${n} stays within [0,1]`, w.lower >= 0 && w.upper <= 1);
});
// Altman & Bland round-trip.
[0.001, 0.01, 0.03, 0.05, 0.2, 0.5, 0.8].forEach(p => {
  const ci = api.ciFromPValue(5.2, p);
  const back = api.pValueFromCI(5.2, ci.lower, ci.upper);
  near(`Altman-Bland round-trip P=${p}`, back.pValue, p, 1e-4);
});
// SIDEDNESS. The z-recovery formula is defined on TWO-SIDED P values. Proof by
// reference constant: P=0.05 must recover ~1.96 (two-sided crit), not 1.6449.
{
  const zAt05 = api.ciFromPValue(1, 0.05).z;
  near("z recovered from P=0.05 is the two-sided critical value", zAt05, 1.96, 5e-3);
  ok("...and is NOT the one-sided critical value", Math.abs(zAt05 - 1.6448536) > 0.2);
  // A one-sided P must be doubled first, so one-sided 0.025 === two-sided 0.05.
  const oneSided = api.ciFromPValue(5, 0.025, { sided: "one" });
  const twoSided = api.ciFromPValue(5, 0.05, { sided: "two" });
  near("one-sided P=0.025 equals two-sided P=0.05 (lower)", oneSided.lower, twoSided.lower, 1e-12);
  near("one-sided P=0.025 equals two-sided P=0.05 (upper)", oneSided.upper, twoSided.upper, 1e-12);
  ok("one-sided input is recorded as its two-sided equivalent", Math.abs(oneSided.pTwoSided - 0.05) < 1e-12);
  // Direction of the error matters and is counter-intuitive: a one-sided P is
  // NUMERICALLY SMALLER than its two-sided equivalent, so feeding it in raw
  // yields a LARGER z, a SMALLER SE, and therefore a NARROWER interval. The
  // failure mode is overstated precision — a result that looks more certain
  // than it is — which is the more dangerous direction for a valuation input.
  const misread = api.ciFromPValue(5, 0.025, { sided: "two" });
  ok("mis-reading a one-sided P as two-sided NARROWS the interval (overstates precision)",
    (misread.upper - misread.lower) < (oneSided.upper - oneSided.lower));
  ok("...via a larger recovered z", misread.z > oneSided.z);
}
// CONFIDENCE LEVEL. Half-width must be z_{1-(1-level)/2} x SE, not a fixed 1.96.
{
  const c95 = api.ciFromPValue(5, 0.03, { confidenceLevel: 0.95 });
  const c90 = api.ciFromPValue(5, 0.03, { confidenceLevel: 0.90 });
  const c99 = api.ciFromPValue(5, 0.03, { confidenceLevel: 0.99 });
  near("95% critical z = 1.959964", c95.zCrit, 1.959963984540054, 1e-6);
  near("90% critical z = 1.644854", c90.zCrit, 1.6448536269514722, 1e-6);
  near("99% critical z = 2.575829", c99.zCrit, 2.5758293035489004, 1e-6);
  ok("90% CI is strictly narrower than 95%", (c90.upper - c90.lower) < (c95.upper - c95.lower));
  ok("99% CI is strictly wider than 95%", (c99.upper - c99.lower) > (c95.upper - c95.lower));
  near("half-width = zCrit x SE", (c95.upper - c95.lower) / 2, c95.zCrit * c95.se, 1e-12);
  // Reverse direction must invert the SAME level it was given.
  const back = api.pValueFromCI(5, c90.lower, c90.upper, { confidenceLevel: 0.90 });
  near("CI->P round-trip honours a 90% level", back.pTwoSided, 0.03, 1e-4);
  // Using the wrong level on the way back is a real error, and must show up.
  const wrong = api.pValueFromCI(5, c90.lower, c90.upper, { confidenceLevel: 0.95 });
  ok("inverting a 90% CI as if 95% gives a different P", Math.abs(wrong.pTwoSided - 0.03) > 1e-3);
}
// One-sided output is exactly half the two-sided output.
{
  const r = api.pValueFromCI(5, 0.5, 9.9);
  near("pOneSided = pTwoSided / 2", r.pOneSided, r.pTwoSided / 2, 1e-15);
  near("pValue alias equals pTwoSided", r.pValue, r.pTwoSided, 1e-15);
}
// Backward compatibility: omitting opts must behave as two-sided / 95%.
{
  const bare = api.ciFromPValue(5, 0.03);
  const explicit = api.ciFromPValue(5, 0.03, { sided: "two", confidenceLevel: 0.95 });
  near("default opts = two-sided 95% (lower)", bare.lower, explicit.lower, 1e-15);
  near("default opts = two-sided 95% (upper)", bare.upper, explicit.upper, 1e-15);
}
// Ratio-scale wrappers must be the log-scale image of the linear ones.
{
  const lin = api.ciFromPValue(Math.log(0.65), 0.02);
  const rat = api.ciFromPValueRatio(0.65, 0.02);
  near("ratio CI lower = exp(linear log-scale lower)", rat.lower, Math.exp(lin.lower), 1e-12);
  near("ratio CI upper = exp(linear log-scale upper)", rat.upper, Math.exp(lin.upper), 1e-12);
  const backRat = api.pValueFromCIRatio(0.65, rat.lower, rat.upper);
  near("ratio round-trip returns P=0.02", backRat.pValue, 0.02, 1e-4);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Fragility Index");
// Hand-traced: 5/50 vs 20/50 at alpha .05. Flipping non-events to events in
// the LOW-event arm (treatment) one at a time, Fisher p climbs monotonically
// and first crosses .05 at the 6th flip (11/50 vs 20/50).
{
  const fi = api.computeFragilityIndex(5, 50, 20, 50, 0.05);
  ok("significant to begin with", fi.significant === true);
  near("FI = 6", fi.fragilityIndex, 6, 0);
  ok("flips the smaller-event arm (A)", fi.flipArm === "A");
  ok("observed p < alpha", fi.observedP < 0.05);
  ok("final p >= alpha", fi.finalP >= 0.05);
  // Independent confirmation of the stopping point, recomputing Fisher directly.
  near("p at 5 flips still significant", api.fisherExactTwoSided(10, 40, 20, 30), fi.path[5].pValue, 1e-12);
  ok("p at 5 flips < 0.05", api.fisherExactTwoSided(10, 40, 20, 30) < 0.05);
  ok("p at 6 flips >= 0.05", api.fisherExactTwoSided(11, 39, 20, 30) >= 0.05);
  // Monotonicity of the walk — if this breaks, the index is meaningless.
  let mono = true;
  for (let i = 1; i < fi.path.length; i++) if (fi.path[i].pValue < fi.path[i - 1].pValue) mono = false;
  ok("p-value increases monotonically along the flip path", mono);
}
// A non-significant table must be refused, not assigned an index.
{
  const fi = api.computeFragilityIndex(20, 50, 22, 50, 0.05);
  ok("non-significant table returns significant=false", fi.significant === false);
  ok("non-significant table has null FI", fi.fragilityIndex === null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Power and sample size");
// Power must be monotone in n and in effect size, and land in (0,1).
{
  const p1 = 0.45, p2 = 0.30;
  const pw = n => api.closedFormPowerTwoProportion(p1, p2, n, n, 0.05, "two");
  ok("power in (0,1)", pw(100) > 0 && pw(100) < 1);
  ok("power increases with n", pw(50) < pw(100) && pw(100) < pw(400));
  ok("power increases with effect size",
    api.closedFormPowerTwoProportion(0.35, 0.30, 200, 200, 0.05, "two") <
    api.closedFormPowerTwoProportion(0.55, 0.30, 200, 200, 0.05, "two"));
  ok("one-sided power >= two-sided at same n",
    api.closedFormPowerTwoProportion(p1, p2, 100, 100, 0.05, "one") >=
    api.closedFormPowerTwoProportion(p1, p2, 100, 100, 0.05, "two"));
}
// Means power against the textbook closed form, computed independently here:
//   power = Φ(|Δ|/se − z_{1−α/2}),  se = sqrt(sd²/n1 + sd²/n2)
{
  const delta = 5, sd = 10, n = 64;
  const se = Math.sqrt(sd * sd / n + sd * sd / n);
  const expected = api.normalCDF(Math.abs(delta) / se - api.normalInvCDF(0.975));
  near("means power matches closed form", api.closedFormPowerMeans(delta, sd, n, n, 0.05, "two"), expected, 1e-12);
}
// Schoenfeld: power = Φ(|ln HR|·sqrt(E·θ(1−θ)) − z_{1−α/2}); θ=0.5 for 1:1.
{
  const hr = 0.7, events = 200;
  const expected = api.normalCDF(Math.abs(Math.log(hr)) * Math.sqrt(events * 0.25) - api.normalInvCDF(0.975));
  near("Schoenfeld power matches closed form", api.schoenfeldPower(hr, events, 1, 0.05), expected, 1e-12);
}
// The solvers are searches over the SAME power functions, so the defining
// property is: the returned n achieves target power, and one less does not.
{
  const r = api.solveSampleSizeTwoProportion(0.30, 0.45, 0.80, 0.05, "two", 1);
  ok("2-prop solver reaches target power", r.achievedPower >= 0.80);
  ok("2-prop solver is minimal (n-1 falls short)",
    api.closedFormPowerTwoProportion(0.30, 0.45, r.n1 - 1, r.n2 - 1, 0.05, "two") < 0.80);
  const m = api.solveSampleSizeMeans(5, 10, 0.90, 0.05, "two", 1);
  ok("means solver reaches target power", m.achievedPower >= 0.90);
  ok("means solver is minimal", api.closedFormPowerMeans(5, 10, m.n1 - 1, m.n2 - 1, 0.05, "two") < 0.90);
  const e = api.solveEventsNeeded(0.7, 0.80, 0.05, 1);
  ok("events solver reaches target power", e.achievedPower >= 0.80);
  ok("events solver is minimal", api.schoenfeldPower(0.7, e.n - 1, 1, 0.05) < 0.80);
}
// Minimum Detectable Effect (MDE) solvers — the inverse direction. Two kinds
// of check: (1) the fixed-point property directly (the solved effect, fed
// back into the SAME power function, must reproduce target power almost
// exactly — this is what "minimum detectable effect" actually means), and
// (2) round-trip against the sample-size solvers above, which independently
// validates both directions agree with each other, not just with themselves.
{
  // (1) Fixed-point property, one check per endpoint type.
  const rEff = api.solveMinDetectableRateTwoProportion(0.30, 163, 163, 0.80, 0.05, "two");
  ok("MDE binary: solved p2 is not null (achievable at n=163)", rEff.p2 != null);
  near("MDE binary: power at solved p2 hits target power almost exactly", api.closedFormPowerTwoProportion(0.30, rEff.p2, 163, 163, 0.05, "two"), 0.80, 1e-5);

  const mEff = api.solveMinDetectableDeltaMeans(10, 85, 85, 0.90, 0.05, "two");
  ok("MDE means: solved delta is not null", mEff.delta != null);
  near("MDE means: power at solved delta hits target power almost exactly", api.closedFormPowerMeans(mEff.delta, 10, 85, 85, 0.05, "two"), 0.90, 1e-5);

  const hEff = api.solveMinDetectableHazardRatio(200, 1, 0.80, 0.05);
  ok("MDE hazard ratio: solved HR is not null", hEff.hazardRatio != null);
  ok("MDE hazard ratio: solved HR is on the beneficial side (< 1)", hEff.hazardRatio < 1);
  near("MDE hazard ratio: power at solved HR hits target power almost exactly", api.schoenfeldPower(hEff.hazardRatio, 200, 1, 0.05), 0.80, 1e-5);

  // (2) Round-trip: solveSampleSizeTwoProportion(0.30, 0.45, 80% power) ->
  // n1=163 (already verified above). Feeding that SAME n back into the MDE
  // solver must recover a p2 close to the original 0.45 — the two solvers
  // are answering the same underlying equation from opposite directions and
  // must agree, not just be independently self-consistent.
  const forward = api.solveSampleSizeTwoProportion(0.30, 0.45, 0.80, 0.05, "two", 1);
  const backward = api.solveMinDetectableRateTwoProportion(0.30, forward.n1, forward.n2, 0.80, 0.05, "two");
  near("round-trip: MDE at the sample-size solver's own n recovers ~the same p2", backward.p2, 0.45, 0.01);

  const forwardM = api.solveSampleSizeMeans(5, 10, 0.90, 0.05, "two", 1);
  const backwardM = api.solveMinDetectableDeltaMeans(10, forwardM.n1, forwardM.n2, 0.90, 0.05, "two");
  near("round-trip: MDE (means) at the sample-size solver's own n recovers ~the same delta", backwardM.delta, 5, 0.05);

  const forwardE = api.solveEventsNeeded(0.7, 0.80, 0.05, 1);
  const backwardE = api.solveMinDetectableHazardRatio(forwardE.n, 1, 0.80, 0.05);
  near("round-trip: MDE (HR) at the sample-size solver's own event count recovers ~the same HR", backwardE.hazardRatio, 0.7, 0.005);

  // Monotonicity: more N must never make the minimum detectable effect
  // WORSE (larger) — power only increases with N, holding everything else fixed.
  const smallN = api.solveMinDetectableRateTwoProportion(0.30, 50, 50, 0.80, 0.05, "two");
  const bigN = api.solveMinDetectableRateTwoProportion(0.30, 500, 500, 0.80, 0.05, "two");
  ok("MDE binary: larger N detects a smaller effect, not a larger one", bigN.delta < smallN.delta);

  // Not-achievable case: with p1 already at 0.98, p2 can only range up to
  // just under 1.0 — a genuinely bounded search space (unlike means/HR,
  // where the search ceiling is deliberately generous and essentially never
  // binds). At n=2 per arm, even the largest possible gap (0.98 -> ~1.0)
  // can't reach 99.9% power, so this must correctly report null rather than
  // an unbounded/garbage effect size.
  const tiny = api.solveMinDetectableRateTwoProportion(0.98, 2, 2, 0.999, 0.05, "two");
  ok("MDE binary: an unreachable target power at tiny N/high p1 reports null, not a fake number", tiny.p2 == null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Sampling and correlation");
// Triangular distribution: E[X] = (a+m+b)/3. Law of large numbers check with a
// tolerance sized to the sampling error, not an arbitrary epsilon.
{
  const a = 10, m = 20, b = 60, N = 400000;
  let sum = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < N; i++) { const x = api.sampleTriangular(a, m, b); sum += x; if (x < min) min = x; if (x > max) max = x; }
  near("triangular mean = (a+m+b)/3", sum / N, (a + m + b) / 3, 0.15);
  ok("triangular samples stay within [low, high]", min >= a && max <= b);
}
// Pearson correlation: exact ±1 on perfectly linear data, 0 on orthogonal.
{
  const x = [1, 2, 3, 4, 5];
  near("Pearson r = +1 for y = 2x+1", api.pearsonCorrelation(x, x.map(v => 2 * v + 1)), 1, 1e-12);
  near("Pearson r = -1 for y = -3x", api.pearsonCorrelation(x, x.map(v => -3 * v)), -1, 1e-12);
  // Hand-worked: x=[1,2,3,4], y=[1,3,2,4]; both means 2.5
  //   dx = [-1.5,-0.5, 0.5, 1.5]
  //   dy = [-1.5, 0.5,-0.5, 1.5]
  //   Sxy = 2.25 - 0.25 - 0.25 + 2.25 = 4 ;  Sxx = Syy = 5
  //   r = 4 / sqrt(5·5) = 0.8
  near("Pearson r = 0.8 on hand-worked pair", api.pearsonCorrelation([1, 2, 3, 4], [1, 3, 2, 4]), 0.8, 1e-12);
}
// Brier score = (forecast − outcome)². Lower is better.
near("Brier(70%, success) = 0.09", api.brierScore(70, "success"), 0.09, 1e-12);
near("Brier(70%, failure) = 0.49", api.brierScore(70, "failure"), 0.49, 1e-12);
near("Brier(100%, success) = 0", api.brierScore(100, "success"), 0, 1e-12);
report();

// ════════════════════════════════════════════════════════════════════════════
section("PK/PD");
// IV bolus: C(t) = (dose/Vd)·e^(−ke·t); C(0) = dose/Vd exactly.
near("IV C(0) = dose/Vd", api.concIVBolus(0, 100, 0.1, 50), 2, 1e-12);
near("IV C(t) = (dose/Vd)e^(-ke t)", api.concIVBolus(7, 100, 0.1, 50), 2 * Math.exp(-0.7), 1e-12);
// Half-life identity: t½ = ln2/ke, and C(t½) must be exactly half of C(0).
near("halfLife = ln2/ke", api.halfLife(0.1), Math.LN2 / 0.1, 1e-12);
near("C(t½) = C(0)/2", api.concIVBolus(api.halfLife(0.1), 100, 0.1, 50), 1, 1e-12);
// AUC identities: IV = dose/(Vd·ke); oral = F·dose/(Vd·ke) (complete absorption).
near("AUC_IV = dose/(Vd·ke)", api.analyticalAUC_IV(100, 0.1, 50), 100 / (50 * 0.1), 1e-12);
near("AUC_oral = F·dose/(Vd·ke)", api.analyticalAUC_Oral(100, 0.1, 50, 0.8), 0.8 * 100 / (50 * 0.1), 1e-12);
// Bateman function for first-order oral absorption, closed form:
//   C(t) = (F·D·ka)/(Vd(ka−ke))·(e^(−ke t) − e^(−ka t))
{
  const D = 100, ka = 1.2, ke = 0.15, Vd = 40, F = 0.9, t = 3;
  const expected = (F * D * ka) / (Vd * (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
  near("oral C(t) matches Bateman closed form", api.concOralFirstOrder(t, D, ka, ke, Vd, F), expected, 1e-12);
  near("oral C(0) = 0", api.concOralFirstOrder(0, D, ka, ke, Vd, F), 0, 1e-12);
  // tmax = ln(ka/ke)/(ka−ke): the analytic peak. Perturbing either side must lower C.
  const tmax = Math.log(ka / ke) / (ka - ke);
  const cmax = api.concOralFirstOrder(tmax, D, ka, ke, Vd, F);
  ok("oral C(tmax) is the analytic maximum",
    cmax > api.concOralFirstOrder(tmax - 0.05, D, ka, ke, Vd, F) &&
    cmax > api.concOralFirstOrder(tmax + 0.05, D, ka, ke, Vd, F));
}
// Emax/Hill: effect at EC50 is exactly the half-maximal point, regardless of hill.
[1, 2, 0.5].forEach(hill => {
  near(`Emax at EC50 = E0 + Emax/2 (hill=${hill})`,
    api.emaxEffect(25, { E0: 10, Emax: 80, EC50: 25, hill }), 10 + 40, 1e-12);
});
near("Emax at conc=0 = E0", api.emaxEffect(0, { E0: 10, Emax: 80, EC50: 25, hill: 1 }), 10, 1e-12);
// Hill-Langmuir occupancy: exactly half-maximal when concentration equals K_D.
// NOTE ON UNITS: this returns PERCENT (0-100), not a fraction — verified that
// both call sites treat it as percent (one formats "...%", the other plots it
// against a "% occupied" axis). Checked deliberately, since a fraction/percent
// mismatch between producer and consumer would be a silent 100x error.
[1, 2].forEach(hill => near(`occupancy at K_D = 50% (hill=${hill})`, api.receptorOccupancy(4, 4, hill), 50, 1e-12));
near("occupancy is 0 at zero concentration", api.receptorOccupancy(0, 4, 1), 0, 1e-12);
ok("occupancy asymptotes toward 100% but never exceeds it", api.receptorOccupancy(1e9, 4, 1) < 100);
report();

// ════════════════════════════════════════════════════════════════════════════
section("Valuation engine");
// Discounting: with a flat 10% rate, PV of 100 in each of years 0..2 is
// 100 + 100/1.1 + 100/1.21 = 100 + 90.909090909... + 82.644628099...
{
  const npv = api.computeNPV([100, 100, 100], 10, { enabled: false }, null);
  const expectedUndiscountedYear0 = 100 + 100 / 1.1 + 100 / 1.21;
  const expectedDiscountedYear0 = 100 / 1.1 + 100 / 1.21 + 100 / 1.331;
  const v = npv.npv != null ? npv.npv : npv;
  ok("NPV uses one of the two standard year conventions, exactly",
    Math.abs(v - expectedUndiscountedYear0) < 1e-9 || Math.abs(v - expectedDiscountedYear0) < 1e-9);
  console.log("   (year-0 convention: " +
    (Math.abs(v - expectedUndiscountedYear0) < 1e-9 ? "year 0 undiscounted" : "year 0 discounted once") + ")");
  // A zero discount rate must return the plain sum.
  const zero = api.computeNPV([100, 100, 100], 0, { enabled: false }, null);
  near("0% discount rate returns the undiscounted sum", zero.npv != null ? zero.npv : zero, 300, 1e-9);
  // Higher rate must reduce PV, strictly.
  const hi = api.computeNPV([100, 100, 100], 20, { enabled: false }, null);
  ok("higher discount rate strictly lowers NPV", (hi.npv != null ? hi.npv : hi) < v);
}
// PoS composition: cumulative = product of remaining stages, including regulatory.
{
  const prog = { therapeuticArea: "Oncology", currentPhase: "phase2" };
  const w = api.computePoSWeighting(prog);
  const product = w.stages.reduce((acc, s) => acc * s.pos, 1);
  near("cumulative PoS = product of stage PoS", w.posToLaunch, product, 1e-12);
  ok("stage list starts at the program's current phase", w.stages[0].key === "phase2");
  ok("regulatory stage is included", w.stages.some(s => s.key === "regulatory"));
  // posToReachStage is the running product of everything BEFORE that stage.
  near("first stage is reached with probability 1", w.stages[0].posToReachStage, 1, 1e-12);
  near("second stage reached with prob = first stage PoS", w.stages[1].posToReachStage, w.stages[0].pos, 1e-12);
  // A later-phase program must have strictly higher cumulative PoS than an earlier one.
  const ph3 = api.computePoSWeighting({ therapeuticArea: "Oncology", currentPhase: "phase3" });
  ok("Phase 3 program has higher cumulative PoS than Phase 2", ph3.posToLaunch > w.posToLaunch);
}
// PoS modifiers: applied as a RELATIVE ratio against Thomas's own baseline, so
// that the therapeutic-area benchmark still sets the base rate. Verified here
// against the published table values rather than the implementation's output.
{
  const base = { therapeuticArea: "Oncology", currentPhase: "phase2" };
  const areaPh2 = api.getPosForArea("Oncology", "phase2").value;
  const ratio = api.POS_MODIFIERS.selectionBiomarkers.phase2 / api.POS_MODIFIERS.baseline.phase2;
  const bio = api.computePoSWeighting({ ...base, posBiomarkerUse: "selection" });
  near("biomarker Phase 2 stage = area benchmark x Thomas ratio",
    bio.stages.find(s => s.key === "phase2").pos * 100, areaPh2 * ratio, 1e-9);
  // Regulatory modifiers are ADDITIVE percentage points per the source text.
  near("biomarker regulatory stage = median + 9.2pp",
    bio.stages.find(s => s.key === "regulatory").pos * 100,
    api.POS_REGULATORY.median + api.POS_REGULATORY_MODIFIERS.thomas2016.selectionBiomarkers, 1e-9);
  // Unset attributes must reproduce legacy behaviour exactly — backward compatibility.
  const plain = api.computePoSWeighting(base);
  near("unset modifiers identical to no-modifier case",
    api.computePoSWeighting({ ...base, posBiomarkerUse: "", posDiseaseType: "" }).posToLaunch, plain.posToLaunch, 0);
  ok("selection biomarkers raise cumulative PoS", bio.posToLaunch > plain.posToLaunch);
  ok("absence of biomarkers lowers cumulative PoS",
    api.computePoSWeighting({ ...base, posBiomarkerUse: "none" }).posToLaunch < plain.posToLaunch);
  // No modifier may ever push a stage to certainty.
  const both = api.computePoSWeighting({ ...base, posBiomarkerUse: "selection", posDiseaseType: "rare" });
  ok("no stage PoS reaches or exceeds 100%", both.stages.every(s => s.pos < 1));
  ok("compounding both axes is flagged", both.modifiers.compoundedAxes === true);
}
// Treasury-stock method, hand-worked:
//   1,000,000 options at $5 strike, share price $10.
//   Proceeds = $5,000,000 -> buys back 500,000 shares at $10.
//   Net new shares = 1,000,000 - 500,000 = 500,000.
{
  const cap = api.computeCapitalStructure({
    mode: "detailed", basicShares: "10000000", currentPrice: "10",
    opts: "1000000", optK: "5", war: "", warK: "", convFace: "", convPrice: "", cash: "0", debt: "0"
  });
  near("treasury method: 10,000,000 + 500,000 net new shares", cap.dilutedShares, 10500000, 1);
  // Out-of-the-money options are non-dilutive — strike above the share price.
  const otm = api.computeCapitalStructure({
    mode: "detailed", basicShares: "10000000", currentPrice: "10",
    opts: "1000000", optK: "25", war: "", warK: "", convFace: "", convPrice: "", cash: "0", debt: "0"
  });
  near("out-of-the-money options add no shares", otm.dilutedShares, 10000000, 1);
}
// Order-of-entry share model: must be monotone decreasing in entry order and
// sum sensibly. (Values themselves come from the source table — not asserted.)
{
  const shares = [1, 2, 3, 4].map(o => api.peakShareForEntry(4, o));
  ok("peak share decreases with later entry", shares[0] > shares[1] && shares[1] >= shares[2] && shares[2] >= shares[3]);
  ok("first entrant in a monopoly gets the largest share",
    api.peakShareForEntry(1, 1) >= api.peakShareForEntry(2, 1));
  ok("all shares are percentages in (0,100]", shares.every(s => s > 0 && s <= 100));
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Case-level Base-PoS adjustment");
{
  const program = {
    id: "p1", drugName: "TestDrug", therapeuticArea: "Oncology", currentPhase: "phase2",
    revenueMode: "quick", quickRevenue: { peakRevenue: "1000000000", yearsToPeak: "6", profile: "median" }
  };
  const modeledPoS = api.computePoSWeighting(program).posToLaunch;

  // No adjustment set (theCase.basePosAdjustmentPct === "") must reproduce the
  // exact original preset values — backward compatibility with every case
  // saved before this field existed.
  const noAdj = { basePosAdjustmentPct: "" };
  near("no adjustment: base posMultiplierPct unchanged (100)", api.getEffectiveScenarioPreset(noAdj, "base").posMultiplierPct, 100, 1e-9);
  near("no adjustment: bear posMultiplierPct unchanged (70)", api.getEffectiveScenarioPreset(noAdj, "bear").posMultiplierPct, 70, 1e-9);
  near("no adjustment: bull posMultiplierPct unchanged (130)", api.getEffectiveScenarioPreset(noAdj, "bull").posMultiplierPct, 130, 1e-9);

  // 80% case-level adjustment must scale ALL THREE scenarios' posMultiplierPct
  // by the same 0.8 factor, preserving the existing 70/100/130 relationship
  // relative to the new (adjusted) base — independently derived: 70*0.8=56,
  // 100*0.8=80, 130*0.8=104.
  const adj80 = { basePosAdjustmentPct: "80" };
  near("80% adjustment: base posMultiplierPct = 80", api.getEffectiveScenarioPreset(adj80, "base").posMultiplierPct, 80, 1e-9);
  near("80% adjustment: bear posMultiplierPct = 56", api.getEffectiveScenarioPreset(adj80, "bear").posMultiplierPct, 56, 1e-9);
  near("80% adjustment: bull posMultiplierPct = 104", api.getEffectiveScenarioPreset(adj80, "bull").posMultiplierPct, 104, 1e-9);

  // Case-level Bear/Bull overrides must still compose correctly on top of the
  // case-level adjustment: override to 50, adjustment 80% -> 50*0.8=40.
  const adjPlusOverride = { basePosAdjustmentPct: "80", scenarioOverrides: { bear: { posMultiplierPct: "50" }, bull: {} } };
  near("80% adjustment + bear override(50): bear posMultiplierPct = 40", api.getEffectiveScenarioPreset(adjPlusOverride, "bear").posMultiplierPct, 40, 1e-9);

  // computeProgramValuation: the actual posToLaunch a real case would show for
  // Base, with an 80% case-level adjustment and no per-program override, must
  // equal the program's own modeled PoS times 0.8 exactly (independently
  // computed from computePoSWeighting above, not copied from the implementation).
  const baseScenario80 = api.getEffectiveScenarioPreset(adj80, "base");
  const pv = api.computeProgramValuation(program, baseScenario80, "base");
  near("computeProgramValuation: Base posToLaunch = modeled PoS * 0.8", pv.posToLaunch, Math.max(0, Math.min(1, modeledPoS * 0.8)), 1e-9);

  // Composition with a per-program override: override sets the program's own
  // baseline to exactly 50%, the case-level 80% adjustment then applies on
  // top of THAT (not on top of the original modeled rate) -> 0.50*0.80=0.40.
  const overriddenProgram = { ...program, posOverridePct: "50" };
  const pvOv = api.computeProgramValuation(overriddenProgram, baseScenario80, "base");
  near("override(50%) + 80% case adjustment composes to 40%", pvOv.posToLaunch, 0.40, 1e-9);

  // Clamping: override 90% + case adjustment 150% = 135% raw, must clamp to
  // exactly 100%, never overshoot or silently wrap.
  const overriddenProgram2 = { ...program, posOverridePct: "90" };
  const adj150 = { basePosAdjustmentPct: "150" };
  const baseScenario150 = api.getEffectiveScenarioPreset(adj150, "base");
  const pvClamp = api.computeProgramValuation(overriddenProgram2, baseScenario150, "base");
  near("90% override + 150% case adjustment clamps to exactly 100%", pvClamp.posToLaunch, 1.0, 1e-9);

  // Risk waterfall: "unrisked" must mean literally 100% PoS regardless of the
  // case-level adjustment — compare the SAME program's unriskedNPV with and
  // without an 80% adjustment; they must be bit-for-bit identical, while the
  // risked side must differ (lower with the adjustment, since 80% < 100%).
  const dr = 12, tv = { enabled: false };
  const wfNoAdj = api.computeProgramRiskWaterfall(program, api.getEffectiveScenarioPreset(noAdj, "base"), "base", dr, tv);
  const wfAdj80 = api.computeProgramRiskWaterfall(program, baseScenario80, "base", dr, tv);
  near("unrisked NPV is identical regardless of case-level PoS adjustment", wfAdj80.unriskedNPV, wfNoAdj.unriskedNPV, 1e-6);
  ok("risked NPV is strictly lower with an 80% case-level adjustment", wfAdj80.riskedNPV < wfNoAdj.riskedNPV);

  // computeCaseValuation must show the SAME clamped posToLaunch on its
  // programVals as computeProgramValuation does directly, for internal
  // consistency between the two entry points every UI surface calls.
  const theCase = { programs: [overriddenProgram], basePosAdjustmentPct: "80", discountRatePct: String(dr) };
  const caseResult = api.computeCaseValuation(theCase, baseScenario80, "base", dr, tv);
  near("computeCaseValuation programVals matches computeProgramValuation directly", caseResult.programVals[0].posToLaunch, pvOv.posToLaunch, 1e-9);

  // Portfolio summary's modeledPoSPct must reflect the case-level adjustment
  // (50% override * 80% case adjustment = 40%), not just the raw override.
  const portfolioCase = { id: "c1", name: "Test", programs: [overriddenProgram], basePosAdjustmentPct: "80", currentPrice: "10" };
  const summary = api.computePortfolioSummary([portfolioCase]);
  near("Portfolio modeledPoSPct reflects case-level adjustment (50%*80%=40%)", summary[0].modeledPoSPct, 40, 1e-6);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Phase 2 -> 3 effect-size shrinkage");
{
  // Binary: factor is a flat divide-by-1.20, independently computed here.
  const r45 = api.shrinkBinaryResponseRate(45);
  near("45% observed -> 37.5% projected (45/1.20)", r45.projectedP3Pct, 37.5, 1e-9);
  const r0 = api.shrinkBinaryResponseRate(0);
  near("0% observed -> 0% projected", r0.projectedP3Pct, 0, 1e-9);

  // The HR factor's own real-world calibration check: applying it to the
  // JNCI paper's own reported "expected" HR (0.66) must reproduce their own
  // reported "observed" HR (0.72) to within the paper's own rounding —
  // this validates the constant against the actual source numbers, not just
  // internal arithmetic self-consistency.
  const rCal = api.shrinkHazardRatio(0.66);
  near("HR shrinkage reproduces JNCI's reported observed HR (0.66*1.09~=0.72)", rCal.projectedP3HR, 0.72, 0.002);
  ok("0.66 -> projected HR does not cross the null", !rCal.crossesNull);

  // A weak (near-null) Phase 2 HR must be flagged as potentially crossing
  // into "no real effect" territory after shrinkage — independently derived:
  // 0.95 * 1.09 = 1.0355, which is >= 1.
  const rWeak = api.shrinkHazardRatio(0.95);
  near("0.95 * 1.09 = 1.0355", rWeak.projectedP3HR, 1.0355, 1e-9);
  ok("weak HR (0.95) crosses the null after shrinkage", rWeak.crossesNull);

  // A strong Phase 2 HR must NOT cross the null.
  const rStrong = api.shrinkHazardRatio(0.5);
  near("0.5 * 1.09 = 0.545", rStrong.projectedP3HR, 0.545, 1e-9);
  ok("strong HR (0.5) does not cross the null after shrinkage", !rStrong.crossesNull);

  // Monotonicity: a better (lower) Phase 2 HR must always project to a
  // better (lower) Phase 3 HR — the shrinkage factor is a flat multiplier,
  // so ordering is preserved by construction, but worth asserting directly.
  ok("shrinkage preserves ordering: lower P2 HR -> lower projected HR",
    api.shrinkHazardRatio(0.4).projectedP3HR < api.shrinkHazardRatio(0.6).projectedP3HR);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Cell/gene therapy modality expansion");
{
  ok("MODALITY_OPTIONS has exactly 4 entries", api.MODALITY_OPTIONS.length === 4);
  ok("MODALITY_OPTIONS includes cellTherapy and geneTherapy", api.MODALITY_OPTIONS.some(m => m.value === "cellTherapy") && api.MODALITY_OPTIONS.some(m => m.value === "geneTherapy"));

  // getCogsBenchmark: each modality resolves to exactly the sourced constant
  // in data.js, not a stale/duplicated copy — independently re-read from
  // COGS_BENCHMARKS itself so this can't pass by both sides sharing a bug.
  near("getCogsBenchmark(smallMolecule) = COGS_BENCHMARKS.smallMolecule", api.getCogsBenchmark("smallMolecule").value, api.COGS_BENCHMARKS.smallMolecule, 1e-9);
  near("getCogsBenchmark(biologic) = COGS_BENCHMARKS.biologic", api.getCogsBenchmark("biologic").value, api.COGS_BENCHMARKS.biologic, 1e-9);
  near("getCogsBenchmark(cellTherapy) = COGS_BENCHMARKS.cellTherapy (22%)", api.getCogsBenchmark("cellTherapy").value, 22, 1e-9);
  near("getCogsBenchmark(geneTherapy) = COGS_BENCHMARKS.geneTherapy (55%)", api.getCogsBenchmark("geneTherapy").value, 55, 1e-9);
  near("unknown/undefined modality falls back to smallMolecule", api.getCogsBenchmark(undefined).value, api.COGS_BENCHMARKS.smallMolecule, 1e-9);
  ok("gene therapy COGS is strictly higher than cell therapy (real economics, not a typo)", api.COGS_BENCHMARKS.geneTherapy > api.COGS_BENCHMARKS.cellTherapy);
  ok("cell therapy COGS is strictly higher than standard biologic", api.COGS_BENCHMARKS.cellTherapy > api.COGS_BENCHMARKS.biologic);

  // getErosionDefaults: biologic's shape (100 - volumeLostOverYears1to5) must
  // still resolve correctly through the new normalization function — this is
  // the one modality whose raw source data is stated as "% LOST" rather than
  // "% retained", so it's the case most likely to have an off-by-inversion bug.
  const bioErosion = api.getErosionDefaults("biologic");
  near("biologic volRetainedPct = 100 - volumeLostOverYears1to5 (100-20=80)", bioErosion.volRetainedPct, 80, 1e-9);
  near("biologic rampYears = 5", bioErosion.rampYears, 5, 1e-9);
  const smErosion = api.getErosionDefaults("smallMolecule");
  near("smallMolecule volRetainedPct = 10 (direct read, no inversion needed)", smErosion.volRetainedPct, 10, 1e-9);
  near("smallMolecule rampYears = 1", smErosion.rampYears, 1, 1e-9);

  // Cell/gene therapy: near-zero erosion by design, not a smaller version of
  // an existing curve — independently confirms the deliberate "no real
  // precedent" modeling choice actually landed in the resolved numbers.
  const ctErosion = api.getErosionDefaults("cellTherapy");
  const gtErosion = api.getErosionDefaults("geneTherapy");
  ok("cell therapy erosion is near-zero (>=90% retained)", ctErosion.volRetainedPct >= 90);
  ok("gene therapy erosion is near-zero (>=90% retained)", gtErosion.volRetainedPct >= 90);
  ok("cell/gene therapy price decline default is small (<=10%)", ctErosion.priceDeclinePct <= 10 && gtErosion.priceDeclinePct <= 10);

  // resolveErosionParams end-to-end: a program with no explicit override
  // must use the modality's own resolved default, converted to a 0-1
  // fraction (not left as a 0-100 percentage) — this is the actual function
  // every DCF year's erosionMultiplier() call depends on.
  const resolved = api.resolveErosionParams({ modality: "geneTherapy", yearsToLOE: "13" });
  near("resolveErosionParams(geneTherapy).volRetained is a 0-1 fraction (0.95)", resolved.volRetained, 0.95, 1e-9);
  near("resolveErosionParams(geneTherapy).priceDecline is a 0-1 fraction (0.05)", resolved.priceDecline, 0.05, 1e-9);
  near("resolveErosionParams(geneTherapy).erosionRampYears = 1", resolved.erosionRampYears, 1, 1e-9);
  // Explicit override still wins over the modality default, exactly as it
  // already does for small molecule/biologic — this composition shouldn't
  // have changed just because the lookup mechanism did.
  const resolvedOverridden = api.resolveErosionParams({ modality: "geneTherapy", yearsToLOE: "13", volumeRetainedPct: "50", priceDeclinePct: "20" });
  near("explicit volumeRetainedPct override still wins over the modality default", resolvedOverridden.volRetained, 0.50, 1e-9);
  near("explicit priceDeclinePct override still wins over the modality default", resolvedOverridden.priceDecline, 0.20, 1e-9);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("2x2 outcome measures (RR/OR/RD/NNT)");
// One shared example, hand-computed independently: eventsA=20/nA=100 (treatment),
// eventsB=40/nB=100 (control). pA=0.20, pB=0.40.
{
  const rr = api.computeRiskRatio(20, 100, 40, 100);
  near("RR = pA/pB = 0.20/0.40 = 0.5", rr.rr, 0.5, 1e-9);
  // SE(log RR) = sqrt(1/20 - 1/100 + 1/40 - 1/100) = sqrt(0.055)
  const seLogRR = Math.sqrt(1/20 - 1/100 + 1/40 - 1/100);
  const zRR = api.normalInvCDF(0.975);
  const expLoRR = Math.exp(Math.log(0.5) - zRR * seLogRR);
  const expHiRR = Math.exp(Math.log(0.5) + zRR * seLogRR);
  near("RR CI lower matches independently-computed log-scale Wald bound", rr.lower, expLoRR, 1e-9);
  near("RR CI upper matches independently-computed log-scale Wald bound", rr.upper, expHiRR, 1e-9);

  const or_ = api.computeOddsRatio(20, 100, 40, 100);
  // a=20,b=80,c=40,d=60 -> OR = (20*60)/(80*40) = 1200/3200 = 0.375
  near("OR = (a*d)/(b*c) = 0.375", or_.or, 0.375, 1e-9);
  const seLogOR = Math.sqrt(1/20 + 1/80 + 1/40 + 1/60);
  const zOR = api.normalInvCDF(0.975);
  near("OR CI lower matches independently-computed Woolf log-scale bound", or_.lower, Math.exp(Math.log(0.375) - zOR * seLogOR), 1e-9);
  near("OR CI upper matches independently-computed Woolf log-scale bound", or_.upper, Math.exp(Math.log(0.375) + zOR * seLogOR), 1e-9);
  ok("OR is further from 1 than RR for the same table (a known property when the outcome isn't rare)", Math.abs(Math.log(or_.or)) > Math.abs(Math.log(rr.rr)));

  const rd = api.computeRiskDifference(20, 100, 40, 100);
  near("RD = pA - pB = 0.20 - 0.40 = -0.20", rd.rd, -0.20, 1e-9);
  const seRD = Math.sqrt(0.20*0.80/100 + 0.40*0.60/100);
  near("RD SE matches independently-computed Wald SE (sqrt(0.004))", rd.se, seRD, 1e-9);
  near("RD CI lower", rd.lower, -0.20 - api.normalInvCDF(0.975)*seRD, 1e-9);
  near("RD CI upper", rd.upper, -0.20 + api.normalInvCDF(0.975)*seRD, 1e-9);

  const nnt = api.computeNNT(20, 100, 40, 100);
  near("NNT = 1/|RD| = 1/0.20 = 5", nnt.nnt, 5, 1e-9);
  ok("eventsHigherInArmA correctly false (arm A's rate is LOWER, 20% vs 40%)", nnt.eventsHigherInArmA === false);
  ok("RD CI doesn't cross zero for this table -> NNT CI is a real interval", !nnt.crossesNull);
  near("NNT CI bounds are the RD CI bounds inverted", nnt.lower, Math.abs(1/rd.upper), 1e-9);
  near("NNT CI bounds are the RD CI bounds inverted (other side)", nnt.upper, Math.abs(1/rd.lower), 1e-9);

  // A table with no real difference must produce a risk difference CI that
  // crosses zero, and NNT must correctly report crossesNull rather than a
  // nonsense finite number.
  const nntNull = api.computeNNT(30, 100, 32, 100);
  ok("near-identical arms produce an RD CI crossing zero", nntNull.crossesNull);
  ok("NNT bounds are null when the RD CI crosses zero (not a fake finite number)", nntNull.lower == null && nntNull.upper == null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Multiplicity adjustment (Bonferroni / Holm)");
// p-values engineered to show Holm's real advantage over flat Bonferroni:
// [0.012, 0.013, 0.014, 0.20], alpha=0.05, m=4.
{
  const pvals = [0.012, 0.013, 0.014, 0.20];
  const bonf = api.bonferroniAdjust(pvals, 0.05);
  // Bonferroni: adjusted = min(1, p*4) -> [0.048, 0.052, 0.056, 0.8]
  near("Bonferroni adjusted p[0] = 0.012*4 = 0.048", bonf[0].adjustedP, 0.048, 1e-9);
  near("Bonferroni adjusted p[1] = 0.013*4 = 0.052", bonf[1].adjustedP, 0.052, 1e-9);
  ok("Bonferroni: only the first hypothesis survives at alpha=0.05", bonf[0].significant && !bonf[1].significant && !bonf[2].significant && !bonf[3].significant);

  const holm = api.holmBonferroniAdjust(pvals, 0.05);
  // Holm (hand-derived): raw(k) = (m-k)*p(k) for 0-indexed k, then running max.
  // k=0: 4*0.012=0.048 -> max=0.048
  // k=1: 3*0.013=0.039 -> max=0.048 (monotonicity enforced)
  // k=2: 2*0.014=0.028 -> max=0.048
  // k=3: 1*0.20=0.20   -> max=0.20
  near("Holm adjusted p[0] = 0.048", holm[0].adjustedP, 0.048, 1e-9);
  near("Holm adjusted p[1] = 0.048 (monotonicity-enforced, not the raw 0.039)", holm[1].adjustedP, 0.048, 1e-9);
  near("Holm adjusted p[2] = 0.048", holm[2].adjustedP, 0.048, 1e-9);
  near("Holm adjusted p[3] = 0.20", holm[3].adjustedP, 0.20, 1e-9);
  ok("Holm: the first THREE hypotheses survive at alpha=0.05 (real power gain over Bonferroni's one)",
    holm[0].significant && holm[1].significant && holm[2].significant && !holm[3].significant);
  ok("Holm rejects at least as many hypotheses as Bonferroni on the same data (a general property, not specific to this example)",
    holm.filter(h => h.significant).length >= bonf.filter(b => b.significant).length);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Meta-analysis (fixed-effect / random-effects / heterogeneity)");
{
  // Example A: genuine heterogeneity. Three studies, equal SE=1, but
  // divergent point estimates (2, 8, 5) -> real between-study disagreement.
  const studiesA = [{ estimate: 2, se: 1 }, { estimate: 8, se: 1 }, { estimate: 5, se: 1 }];
  const feA = api.computeFixedEffectMetaAnalysis(studiesA);
  near("FE pooled = simple mean when all SEs equal = (2+8+5)/3", feA.estimate, 5, 1e-9);
  near("FE SE = sqrt(1/3)", feA.se, Math.sqrt(1/3), 1e-9);

  const hetA = api.computeHeterogeneity(studiesA);
  // Q = sum((x_i - mean)^2) when weights are all 1 = (2-5)^2+(8-5)^2+(5-5)^2 = 9+9+0=18
  near("Q = 18 (hand-computed sum of squared deviations)", hetA.q, 18, 1e-9);
  near("df = k-1 = 2", hetA.df, 2, 1e-9);
  near("I^2 = (Q-df)/Q * 100 = (18-2)/18*100 = 88.888...%", hetA.iSquared, (18-2)/18*100, 1e-9);

  const reA = api.computeRandomEffectsMetaAnalysis(studiesA);
  // c = sumW - sumW^2/sumW = 3 - 3/3 = 2; tau^2 = (Q-df)/c = 16/2 = 8
  near("tau^2 = (Q-df)/c = 16/2 = 8", reA.tauSquared, 8, 1e-9);
  near("RE pooled = 5.0 (equals FE here since weights stay symmetric even after adding tau^2)", reA.estimate, 5, 1e-9);
  // RE SE = sqrt(1/sum(1/(se^2+tau^2))) = sqrt(1/(3/9)) = sqrt(3)
  near("RE SE = sqrt(3) (hand-computed from the DerSimonian-Laird weights)", reA.se, Math.sqrt(3), 1e-9);
  ok("RE confidence interval is meaningfully WIDER than FE's — real heterogeneity must widen the pooled CI, not narrow it",
    (reA.upper - reA.lower) > (feA.upper - feA.lower) * 1.5);

  // Example B: no detectable heterogeneity (Q < df) -> tau^2 must floor at
  // 0, not go negative, and RE must then collapse to exactly FE.
  const studiesB = [{ estimate: 5, se: 1 }, { estimate: 6, se: 2 }, { estimate: 4, se: 0.5 }];
  const feB = api.computeFixedEffectMetaAnalysis(studiesB);
  const w1 = 1, w2 = 0.25, w3 = 4, sumWB = w1 + w2 + w3;
  near("FE pooled matches hand-computed inverse-variance weighted mean", feB.estimate, (w1*5 + w2*6 + w3*4) / sumWB, 1e-9);
  const reB = api.computeRandomEffectsMetaAnalysis(studiesB);
  ok("tau^2 floors at 0 when Q < df (no negative variance)", reB.tauSquared === 0);
  near("RE collapses to exactly the FE estimate when tau^2 = 0", reB.estimate, feB.estimate, 1e-9);
  near("RE collapses to exactly the FE SE when tau^2 = 0", reB.se, feB.se, 1e-9);

  // ciToSE round-trip: deriving SE from a CI and feeding it back through
  // normalInvCDF must reproduce the same CI half-width.
  const seFromCI = api.ciToSE(2, 8, 0.95);
  const z95 = api.normalInvCDF(0.975);
  near("ciToSE recovers the SE that would reproduce the original CI half-width", seFromCI * z95, (8-2)/2, 1e-9);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// This section closes a real gap found during a review pass: every individual
// stats primitive used by the Trial Outcome/PoS Monte Carlo (twoProportionZTest,
// twoSampleZTestMeans, logRankTest, randNormal, randBinomialCount) was already
// hand-verified above, but the ORCHESTRATION that wires them into the actual
// Monte Carlo loop (samplePrior -> replicate -> hit/miss, repeated) had never
// been checked end-to-end anywhere in this suite — despite a comment in
// ts_statsEngine.js explicitly saying the sample-size solvers exist partly
// "to cross-check the Trial Outcome simulator." That cross-check is made real
// and automated here, not left as an unverified claim.
section("Trial-outcome assurance Monte Carlo (orchestration cross-check)");
// Exact, deterministic checks first (no Monte Carlo noise) — a point prior
// has zero uncertainty, so every draw and every quantile must equal it exactly.
near("samplePrior(point) returns the exact value, not a draw", api.samplePrior({ type: "point", value: 0.42 }), 0.42, 1e-15);
[0.1, 0.5, 0.9].forEach(q =>
  near(`priorQuantile(point, ${q}) = the point value at every quantile`, api.priorQuantile({ type: "point", value: 0.42 }, q), 0.42, 1e-15));
// Quantiles of a Normal prior are closed-form (mean + sd*z) — independent of
// any sampling, checked against normalInvCDF directly.
near("priorQuantile(normal) median = the mean", api.priorQuantile({ type: "normal", mean: 0.5, sd: 0.1 }, 0.5), 0.5, 1e-12);
near("priorQuantile(normal, 0.975) = mean + sd*Φ⁻¹(0.975)", api.priorQuantile({ type: "normal", mean: 0.5, sd: 0.1 }, 0.975), 0.5 + 0.1 * api.normalInvCDF(0.975), 1e-9);

// Binary endpoint: with a POINT (fixed) prior, the Monte Carlo's empirical hit
// rate over many replicates is exactly what closedFormPowerTwoProportion
// predicts, since twoProportionZTest (used per-replicate) and
// closedFormPowerTwoProportion use the same pooled-variance rejection rule —
// confirmed by inspection of both functions before writing this check, not
// assumed. This is a genuine cross-implementation consistency check between
// the simulator and the already-verified closed-form formula, not a
// re-derivation of the formula itself.
{
  const design = { nControl: 150, nTreat: 150, controlRate: 0.30 };
  const prior = { type: "point", value: 0.45 };
  const iterations = 30000;
  const r = api.runAssuranceSimulation({ endpointType: "binary", design: { ...design }, prior, alpha: 0.05, sided: "two", iterations });
  const theoretical = api.closedFormPowerTwoProportion(0.30, 0.45, 150, 150, 0.05, "two");
  near("binary assurance (point prior) converges to closed-form power", r.pos, theoretical, 0.05);
  near("binary assurance's mean observed effect ~ unbiased around the true 15pp gap", r.observedEffects.reduce((a, b) => a + b, 0) / r.observedEffects.length, 0.15, 0.02);
}

// Continuous endpoint: same cross-check against closedFormPowerMeans.
{
  const design = { nControl: 100, nTreat: 100, controlMean: 20, sd: 15 };
  const prior = { type: "point", value: 5 };
  const iterations = 30000;
  const r = api.runAssuranceSimulation({ endpointType: "continuous", design: { ...design }, prior, alpha: 0.05, sided: "two", iterations });
  const theoretical = api.closedFormPowerMeans(5, 15, 100, 100, 0.05, "two");
  near("continuous assurance (point prior) converges to closed-form power", r.pos, theoretical, 0.05);
  near("continuous assurance's mean observed effect ~ unbiased around the true delta of 5", r.observedEffects.reduce((a, b) => a + b, 0) / r.observedEffects.length, 5, 0.5);
}

// Time-to-event: schoenfeldPower takes TOTAL EVENTS directly, but the
// simulator's accrual/censoring model only determines how many events actually
// occur per replicate (fewer than N, since not everyone has an event by
// database lock) — so this calls simulateTimeToEventReplicate directly (not
// through runAssuranceSimulation, which discards totalEvents) to get the
// empirical average event count, then feeds that average into schoenfeldPower
// for the comparison. Wider tolerance than the other two endpoint types: on
// top of Monte Carlo noise, Schoenfeld (1983) is itself only an asymptotic
// approximation, and totalEvents varies replicate-to-replicate rather than
// being fixed like N is for the other two endpoint types.
{
  const design = { nControl: 150, nTreat: 150, medianControl: 12, accrualPeriod: 18, followupPeriod: 12, sided: "two" };
  const hazardRatio = 0.65;
  const iterations = 15000;
  let hits = 0, totalEventsSum = 0;
  for (let i = 0; i < iterations; i++) {
    const rep = api.simulateTimeToEventReplicate(design, hazardRatio);
    if (rep.pValue < 0.05) hits++;
    totalEventsSum += rep.totalEvents;
  }
  const empiricalPower = hits / iterations;
  const avgEvents = totalEventsSum / iterations;
  const theoretical = api.schoenfeldPower(hazardRatio, avgEvents, 1, 0.05);
  near("time-to-event assurance converges to Schoenfeld power at the average observed event count", empiricalPower, theoretical, 0.08);
  ok("time-to-event replicate produces a plausible event count (between 0 and total N)", avgEvents > 0 && avgEvents < design.nControl + design.nTreat);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Same gap, same fix, for the Peak Sales Monte Carlo — runPeakSalesSimulation
// and driverSensitivity had no end-to-end check anywhere; only their small
// helper functions (sampleTriangular, pearsonCorrelation) were covered above.
section("Peak Sales Monte Carlo (orchestration cross-check)");
{
  // All-point (fixed) inputs -> zero variance -> every summary statistic
  // must equal the exact hand-computed product, not just "close to it." No
  // Monte Carlo tolerance needed here; this is an exact check.
  const point = v => ({ type: "point", value: v });
  const allPointInputs = {
    addressablePopulation: point(800000),
    diagnosisRate: point(0.55),
    treatmentRate: point(0.40),
    peakShare: point(0.25),
    annualPriceUSD: point(120000)
  };
  const expected = 800000 * 0.55 * 0.40 * 0.25 * 120000; // = 5,280,000,000
  const r = api.runPeakSalesSimulation(allPointInputs, 500);
  ["mean", "p10", "p25", "p50", "p75", "p90", "min", "max"].forEach(k =>
    near(`all-fixed-inputs peak sales: ${k} = exact hand-computed product`, r.summary[k], expected, 1e-6));

  const drivers = api.driverSensitivity(r);
  drivers.forEach(d => near(`all-fixed-inputs: "${d.driver}" has zero variance -> correlation exactly 0`, d.correlation, 0, 1e-12));
}
{
  // One input (peak share) varies via Uniform(0.15, 0.35), everything else
  // fixed -> peakSalesUSD is an exact LINEAR function of peakShare (slope =
  // population*diagnosisRate*treatmentRate*price, a positive constant), so
  // Pearson correlation must be exactly 1.0 up to floating-point precision —
  // not "close to 1," an exact property of correlating any variable against
  // an affine transform of itself. The mean is the one genuinely stochastic
  // check here, verified against the closed-form E[peakSalesUSD] using the
  // known mean of a Uniform(low,high) distribution.
  const point = v => ({ type: "point", value: v });
  const inputs = {
    addressablePopulation: point(1000000),
    diagnosisRate: point(0.6),
    treatmentRate: point(0.5),
    peakShare: { type: "uniform", low: 0.15, high: 0.35 },
    annualPriceUSD: point(100000)
  };
  const iterations = 20000;
  const r = api.runPeakSalesSimulation(inputs, iterations);
  const k = 1000000 * 0.6 * 0.5 * 100000; // per-unit-peakShare multiplier
  const expectedMean = k * (0.15 + 0.35) / 2; // Uniform(low,high) has mean (low+high)/2
  near("one-varying-driver peak sales: mean converges to closed-form E[peakShare] * multiplier", r.summary.mean, expectedMean, 1e8);

  const drivers = api.driverSensitivity(r);
  const peakShareDriver = drivers.find(d => d.driver === "peakShare");
  near("peakShare correlation is exactly 1.0 (output is an affine function of it, positive slope)", peakShareDriver.correlation, 1.0, 1e-9);
  drivers.filter(d => d.driver !== "peakShare").forEach(d =>
    near(`fixed driver "${d.driver}" still shows exactly 0 correlation`, d.correlation, 0, 1e-12));
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Axis-tick logic is presentation code, but it is still LOGIC — a wrong step
// size silently mislabels every chart it touches, and formatTick exists
// specifically because the previous flat-2-decimal formatter collapsed
// distinct p-value ticks to identical labels. Verified against hand-worked
// expectations, same standard as the numeric engines.
section("Chart axis ticks (niceTicks / formatTick)");
{
  // 0..100 at ~5 steps -> rawStep 20 -> mag 10, norm 2 -> niceStep 20.
  const t = api.niceTicks(0, 100, 5);
  ok("niceTicks(0,100) starts at 0", t[0] === 0);
  ok("niceTicks(0,100) uses a step of 20", t.length > 1 && Math.abs((t[1] - t[0]) - 20) < 1e-9);
  ok("niceTicks(0,100) covers the top of the range", t[t.length - 1] === 100);

  // 0..1 (a power axis) at ~5 steps -> rawStep 0.2 -> mag 0.1, norm 2 -> 0.2.
  const p = api.niceTicks(0, 1, 5);
  ok("niceTicks(0,1) uses a step of 0.2", p.length > 1 && Math.abs((p[1] - p[0]) - 0.2) < 1e-9);
  ok("niceTicks(0,1) produces exactly 6 ticks (0,0.2,...,1.0)", p.length === 6);
  ok("niceTicks never emits a tick above the max", p.every(v => v <= 1 + 1e-9));

  // Every step must be one of {1,2,5} x 10^k — the whole point of "nice".
  [[0, 7], [0, 3200], [0, 0.045], [12, 88]].forEach(([lo, hi]) => {
    const ticks = api.niceTicks(lo, hi, 5);
    if (ticks.length > 1) {
      const step = ticks[1] - ticks[0];
      const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
      ok(`niceTicks(${lo},${hi}) step mantissa is 1, 2, 5 or 10 (got ${mantissa.toFixed(3)})`,
        [1, 2, 5, 10].some(m => Math.abs(mantissa - m) < 1e-6));
    }
  });

  // Regression guard for the geometric-midpoint threshold fix: a power axis
  // running 0..~1.05 (yMax is padded 10% above a ~0.95 max) must NOT collapse
  // to just 0/0.5/1 — at that resolution you can't see where the 80% power
  // target falls, which is the single thing a power curve exists to show.
  const powerAxis = api.niceTicks(0, 1.045, 5);
  ok("power axis 0..1.045 uses a 0.2 step, not 0.5",
    powerAxis.length > 1 && Math.abs((powerAxis[1] - powerAxis[0]) - 0.2) < 1e-9);
  ok("power axis therefore includes a tick at 0.8 (the standard power target)",
    powerAxis.some(v => Math.abs(v - 0.8) < 1e-9));

  // Degenerate inputs must not throw or emit garbage.
  ok("niceTicks handles a zero-width range without throwing", Array.isArray(api.niceTicks(5, 5, 5)));
  ok("niceTicks handles a reversed range without throwing", Array.isArray(api.niceTicks(10, 2, 5)));

  // formatTick: the exact defect it was written to fix — a p-value axis whose
  // ticks differ at the 3rd decimal must not render as identical labels.
  ok("formatTick keeps 0.012 and 0.05 visually distinct at a 0.01 step",
    api.formatTick(0.012, 0.01) !== api.formatTick(0.05, 0.01));
  ok("formatTick renders a whole number without trailing decimals", api.formatTick(20, 20) === "20");
  ok("formatTick renders exact zero as \"0\"", api.formatTick(0, 20) === "0");
  ok("formatTick falls back to compact notation above 1000", api.formatTick(2.5e9, 1e9).endsWith("B"));
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Backs the Tools > Diluted Market Cap tool. Found unverified during the Tools
// audit: the aggregate computeCapitalStructure had two treasury-method checks,
// but if-converted convertible notes, the enterprise->equity bridge, and the
// future-raise overlay had NO coverage at all — despite convertible debt being
// a real dilution source the tool exposes as its own input.
section("Capital structure: convertibles, equity bridge, future raise");
{
  // If-converted, hand-worked: $50,000,000 face at a $5 conversion price with
  // the stock at $10. Conversion is favourable (5 < 10), so the note becomes
  // 50,000,000 / 5 = 10,000,000 shares.
  const conv = api.ifConvertedShares(50000000, 5, 10);
  ok("in-the-money convertible reports converts=true", conv.converts === true);
  near("if-converted shares = face / conversion price", conv.shares, 10000000, 1e-6);

  // Conversion price ABOVE the share price: the holder would lose money
  // converting, so it stays debt and adds no shares.
  const noConv = api.ifConvertedShares(50000000, 25, 10);
  ok("out-of-the-money convertible reports converts=false", noConv.converts === false);
  near("out-of-the-money convertible adds no shares", noConv.shares, 0, 1e-9);

  // The subtle part, and the reason this needed a test: the SAME note must be
  // counted either as equity (shares, dropping out of net cash) or as debt
  // (subtracted from net cash) — never both, and never neither.
  const base = { mode: "detailed", basicShares: "10000000", currentPrice: "10",
                 opts: "", optK: "", war: "", warK: "", cash: "100000000", debt: "20000000" };
  const converts = api.computeCapitalStructure({ ...base, convFace: "50000000", convPrice: "5" });
  near("converting note adds its shares to the diluted count", converts.convertShares, 10000000, 1e-6);
  near("converting note is NOT also subtracted from net cash", converts.netCash, 100000000 - 20000000, 1e-6);

  const stays = api.computeCapitalStructure({ ...base, convFace: "50000000", convPrice: "25" });
  near("non-converting note adds no shares", stays.convertShares, 0, 1e-9);
  near("non-converting note IS subtracted from net cash as debt", stays.netCash, 100000000 - 20000000 - 50000000, 1e-6);

  // Enterprise -> equity bridge: equity = EV + net cash, per share = equity / diluted.
  const capNoConv = api.computeCapitalStructure({ ...base, convFace: "", convPrice: "" });
  const eq = api.computeEquityValue(500000000, capNoConv);
  near("equity value = EV + net cash", eq.equityValue, 500000000 + 80000000, 1e-6);
  near("per-share = equity / diluted shares", eq.perShare, 580000000 / 10000000, 1e-9);
  // Net cash can legitimately be negative (debt-heavy); the bridge must
  // subtract, not clamp at zero.
  const debtHeavy = api.computeCapitalStructure({ ...base, cash: "10000000", debt: "90000000", convFace: "", convPrice: "" });
  near("net cash goes negative when debt exceeds cash", debtHeavy.netCash, -80000000, 1e-6);
  near("equity value is reduced by negative net cash", api.computeEquityValue(500000000, debtHeavy).equityValue, 420000000, 1e-6);

  // Future raise — verified against a closed-form IDENTITY rather than the
  // implementation's own output: raising at exactly the current per-share
  // equity value is value-neutral. per-share after = (E+X)/(S + X/P); setting
  // P = E/S gives (E+X)/(S(E+X)/E) = E/S, unchanged. Anything below that price
  // must dilute, anything above must accrete.
  const S = capNoConv.dilutedShares;                 // 10,000,000 shares
  const preEquity = api.computeEquityValue(500000000, capNoConv).equityValue;  // 580,000,000
  const fairPrice = preEquity / S;                   // $58.00/share
  const raiseAt = (price) => {
    const after = api.applyFutureRaise(capNoConv, { enabled: true, amountM: 58000000, priceOverride: String(price) }, price);
    return api.computeEquityValue(500000000, after).perShare;
  };
  near("raising at exactly fair value leaves per-share unchanged", raiseAt(fairPrice), fairPrice, 1e-6);
  ok("raising BELOW fair value is dilutive", raiseAt(fairPrice * 0.5) < fairPrice - 1e-9);
  ok("raising ABOVE fair value is accretive", raiseAt(fairPrice * 2) > fairPrice + 1e-9);

  // Share/cash bookkeeping must both move, and by the right amounts.
  const raised = api.applyFutureRaise(capNoConv, { enabled: true, amountM: 58000000, priceOverride: "58" }, 58);
  near("future raise adds amount / price new shares", raised.dilutedShares - S, 1000000, 1e-6);
  near("future raise adds the full amount to net cash (no fee assumed)", raised.netCash - capNoConv.netCash, 58000000, 1e-6);
  // A disabled or zero raise must be a true no-op.
  ok("disabled raise returns the capital structure untouched",
    api.applyFutureRaise(capNoConv, { enabled: false, amountM: 58000000 }, 58).dilutedShares === S);
  ok("zero-amount raise is a no-op", api.applyFutureRaise(capNoConv, { enabled: true, amountM: 0 }, 58).dilutedShares === S);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Backs the new Runway vs. Catalyst tool. The judgment this makes — can the
// company actually reach each readout, and with how much cash left — is the
// whole point of the tool, so it is tested directly rather than only through
// the UI. Boundaries matter here: "reaches it with exactly zero cushion" and
// "runs out one day early" are different answers to an investor.
section("Runway vs. catalyst funding classification");
{
  const cat = (label, monthsAway) => ({ label, monthsAway });

  // Runway 24 months, default 6-month cushion:
  //   readout at 12mo -> 12 months of cash left at readout   -> funded
  //   readout at 20mo ->  4 months left (< 6 cushion)        -> tight
  //   readout at 30mo -> -6 months (runs out first)          -> gap
  const r = api.classifyCatalystFunding(24, [cat("A", 12), cat("B", 20), cat("C", 30)], 6);
  ok("classification succeeds with a valid runway", r.ok === true);
  near("cushion at a 12-month readout on 24 months of runway = 12", r.rows[0].cushionAtCatalyst, 12, 1e-9);
  ok("comfortably-covered readout is 'funded'", r.rows[0].status === "funded");
  ok("readout reached with less than the cushion is 'tight'", r.rows[1].status === "tight");
  ok("readout beyond runway is a 'gap'", r.rows[2].status === "gap");
  near("negative cushion equals the shortfall in months", r.rows[2].cushionAtCatalyst, -6, 1e-9);
  ok("counts tally to the row count", r.fundedCount + r.tightCount + r.gapCount === r.rows.length);

  // The binding constraint is the EARLIEST non-funded catalyst — a later gap
  // doesn't matter if an earlier one already forces the raise.
  ok("firstProblem is the earliest non-funded catalyst", r.firstProblem.label === "B");
  const allFunded = api.classifyCatalystFunding(60, [cat("A", 12), cat("B", 20)], 6);
  ok("firstProblem is null when everything is comfortably funded", allFunded.firstProblem === null);

  // Boundary behaviour, stated exactly: cushion is a ">= cushion" test, and
  // running out exactly AT the readout is a gap only when strictly negative.
  const atExactCushion = api.classifyCatalystFunding(24, [cat("X", 18)], 6);
  ok("exactly the cushion counts as funded, not tight", atExactCushion.rows[0].status === "funded");
  const atExactZero = api.classifyCatalystFunding(24, [cat("X", 24)], 6);
  ok("reaching the readout with exactly zero cash left is 'tight', not a gap", atExactZero.rows[0].status === "tight");
  const justShort = api.classifyCatalystFunding(24, [cat("X", 24.01)], 6);
  ok("falling even fractionally short is a gap", justShort.rows[0].status === "gap");

  // Rows must come back in chronological order regardless of input order.
  const unsorted = api.classifyCatalystFunding(24, [cat("late", 30), cat("early", 5), cat("mid", 15)], 6);
  ok("rows are sorted earliest-first", unsorted.rows.map(x => x.label).join(",") === "early,mid,late");

  // A zero cushion must be honoured, not silently replaced by the default.
  const zeroCushion = api.classifyCatalystFunding(24, [cat("X", 20)], 0);
  ok("an explicit zero cushion is respected (not overridden by the default)", zeroCushion.rows[0].status === "funded");
  ok("omitting the cushion falls back to the stated default",
    api.classifyCatalystFunding(24, [cat("X", 20)]).cushionMonths === api.RUNWAY_CUSHION_MONTHS_DEFAULT);

  // No runway figure is an honest failure, not a fabricated answer.
  ok("a null runway reports an error rather than guessing", api.classifyCatalystFunding(null, [cat("X", 10)]).ok === false);

  // Regression guard for a real bug found in live testing: computeForwardRunway
  // returns null BOTH for "no data" and for "cash flow turns positive, so the
  // balance never hits zero". Treating them alike told a fully funded company
  // it was misconfigured. An infinite runway is a valid answer: every catalyst
  // is funded, and nothing may render as "Infinity mo".
  const infinite = api.classifyCatalystFunding(Infinity, [cat("A", 12), cat("B", 240)], 6);
  ok("an infinite runway is a valid result, not an error", infinite.ok === true);
  ok("an infinite runway is flagged as beyondHorizon", infinite.beyondHorizon === true);
  ok("every catalyst is funded under an infinite runway", infinite.rows.every(r => r.status === "funded"));
  ok("no catalyst is a gap under an infinite runway", infinite.gapCount === 0);
  ok("firstProblem is null under an infinite runway", infinite.firstProblem === null);
  ok("a finite runway is NOT flagged beyondHorizon", api.classifyCatalystFunding(24, [cat("X", 10)], 6).beyondHorizon === false);
  ok("NaN is still rejected as an unknown runway", api.classifyCatalystFunding(NaN, [cat("X", 10)]).ok === false);
  // Catalysts with no parseable date are dropped upstream; an unparseable
  // monthsAway must never silently become a row here either.
  ok("non-finite monthsAway rows are excluded", api.classifyCatalystFunding(24, [{ label: "bad", monthsAway: NaN }], 6).rows.length === 0);
}
{
  // parseCatalystDate: the real formats a catalyst actually gets written in.
  // Quarter and month forms must resolve to the LAST day of the period, since
  // "2027-Q1" has not passed until Q1 is over.
  const q = api.parseCatalystDate("2027-Q1");
  ok("YYYY-Qn parses", q instanceof Date && !isNaN(q));
  ok("2027-Q1 resolves to the last day of March 2027", q.getFullYear() === 2027 && q.getMonth() === 2 && q.getDate() === 31);
  const m = api.parseCatalystDate("2027-02");
  ok("2027-02 resolves to the last day of February 2027", m.getFullYear() === 2027 && m.getMonth() === 1 && m.getDate() === 28);
  const d = api.parseCatalystDate("2027-06-15");
  ok("full ISO date parses to that exact day", d.getFullYear() === 2027 && d.getMonth() === 5 && d.getDate() === 15);
  ok("free text is left undated rather than guessed", api.parseCatalystDate("H1 2027") === null);
  ok("empty input is undated", api.parseCatalystDate("") === null);

  // monthsUntil sign and scale.
  const a = new Date(2026, 0, 1), b = new Date(2027, 0, 1);
  near("one year is ~12 months", api.monthsUntil(a, b), 12, 0.05);
  ok("a past date is negative", api.monthsUntil(b, a) < 0);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Backs the new Exclusivity / LOE tool. The summarizer is where a wrong number
// would come from: the Orange Book lists the SAME patent once per product and
// strength, so a naive count of the raw array overstates distinct patents by a
// large factor (Uptravi returns 128 patent rows for a handful of real ones).
section("Orange Book patent summary (loss of exclusivity)");
{
  ok("a *PED suffix is recognised as a pediatric extension", api.isPediatricExtension("10821108*PED") === true);
  ok("a plain patent number is not a pediatric extension", api.isPediatricExtension("10821108") === false);
  ok("non-string input is handled", api.isPediatricExtension(null) === false);

  const d = api.parseFdaYyyymmdd("20361201");
  ok("YYYYMMDD parses to the right day", d.getFullYear() === 2036 && d.getMonth() === 11 && d.getDate() === 1);
  ok("malformed date returns null rather than an Invalid Date", api.parseFdaYyyymmdd("2036") === null);

  // Hand-built set mirroring real Orange Book shape: one substance patent, two
  // method-of-use patents, the SAME substance patent duplicated across a second
  // product listing, and a pediatric extension of the latest one.
  const patents = [
    { patent_number: "1000", expiration_date: "20280101", drug_substance_flag: true, drug_product_flag: true },
    { patent_number: "1000", expiration_date: "20280101", drug_substance_flag: true, drug_product_flag: true }, // dup listing
    { patent_number: "2000", expiration_date: "20310615", patent_use_code: "U-1" },
    { patent_number: "3000", expiration_date: "20340301", patent_use_code: "U-2" },
    { patent_number: "3000*PED", expiration_date: "20340901" }
  ];
  const now = new Date(2026, 0, 1);
  const s = api.summarizeOrangeBookPatents(patents, now);

  near("duplicate listings collapse to distinct patents only", s.uniquePatentCount, 3, 1e-9);
  near("pediatric extensions are counted separately, not as patents", s.pediatricExtensionCount, 1, 1e-9);
  ok("earliest expiry is the substance patent here", s.earliest.patentNumber === "1000");
  ok("latest expiry is the pediatric extension", s.latest.patentNumber === "3000*PED");
  ok("latest SUBSTANCE patent is tracked separately from latest overall", s.latestSubstance.patentNumber === "1000");
  // The whole point of tracking both: the hard compound-patent floor can be
  // years earlier than the last-expiring peripheral patent.
  ok("substance floor is earlier than the last patent to expire",
    s.latestSubstance.expiry.getTime() < s.latest.expiry.getTime());
  near("years-away is measured from the supplied date, not the clock", s.earliest.yearsAway, 2.0, 0.02);
  ok("all[] is sorted earliest-first", s.all.every((r, i, a) => i === 0 || a[i-1].expiry <= r.expiry));
  near("all[] holds every distinct patent plus the extension", s.all.length, 4, 1e-9);

  // Degenerate input must not throw or fabricate.
  ok("an empty patent array summarises to null", api.summarizeOrangeBookPatents([], now) === null);
  ok("patents with no usable expiry date summarise to null",
    api.summarizeOrangeBookPatents([{ patent_number: "9", expiration_date: "bad" }], now) === null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Backs the new Binary Event tool. Closed-form, so every check below is exact
// arithmetic worked longhand rather than a tolerance against the implementation.
section("Binary-event implied probability");
{
  // Hand-worked: current 10, success 30, fail 5.
  //   implied p = (10 - 5) / (30 - 5) = 5/25 = 0.20
  //   upside    = (30 - 10)/10 = +200%
  //   downside  = (5 - 10)/10  = -50%
  //   r:r       = 200/50 = 4
  const r = api.computeBinaryEventImpliedPoS({ currentValue: 10, successValue: 30, failValue: 5 });
  ok("solves cleanly", r.ok === true);
  near("implied PoS = (current - fail) / (success - fail)", r.impliedPoS, 0.20, 1e-12);
  near("implied PoS as a percentage", r.impliedPoSPct, 20, 1e-12);
  near("upside to the success case", r.upsidePct, 200, 1e-12);
  near("downside to the failure case", r.downsidePct, -50, 1e-12);
  near("risk/reward is upside over downside, unsigned", r.riskReward, 4, 1e-12);
  ok("in-range implied probability sets no range flag", r.rangeFlag === null);

  // Identity: pricing the implied probability back through the payoffs must
  // reproduce today's value exactly. This is the real correctness check.
  near("implied p, priced back through the payoffs, returns the current value",
    r.impliedPoS * 30 + (1 - r.impliedPoS) * 5, 10, 1e-12);

  // Your own view vs the market's. yourPoS 40%:
  //   EV = 0.4*30 + 0.6*5 = 12 + 3 = 15  -> +50% vs a current of 10
  //   edge = 40 - 20 = +20 points
  const withView = api.computeBinaryEventImpliedPoS({ currentValue: 10, successValue: 30, failValue: 5, yourPoSPct: 40 });
  near("expected value at your own PoS", withView.expectedValue, 15, 1e-12);
  near("EV vs current price", withView.evVsCurrentPct, 50, 1e-12);
  near("edge is your PoS minus the implied PoS, in points", withView.edgePoSPct, 20, 1e-12);
  // Agreeing exactly with the market must produce zero edge and zero EV gap.
  const agrees = api.computeBinaryEventImpliedPoS({ currentValue: 10, successValue: 30, failValue: 5, yourPoSPct: 20 });
  near("agreeing with the implied PoS gives zero edge", agrees.edgePoSPct, 0, 1e-12);
  near("agreeing with the implied PoS gives zero EV gap", agrees.evVsCurrentPct, 0, 1e-12);

  // Out-of-range implied probabilities are the most informative output, so they
  // are reported and flagged rather than clamped into [0,1].
  const below = api.computeBinaryEventImpliedPoS({ currentValue: 3, successValue: 30, failValue: 5 });
  ok("trading below the failure case flags belowFailure", below.rangeFlag === "belowFailure");
  ok("implied probability is allowed to go negative rather than being clamped", below.impliedPoS < 0);
  const above = api.computeBinaryEventImpliedPoS({ currentValue: 35, successValue: 30, failValue: 5 });
  ok("trading above the success case flags aboveSuccess", above.rangeFlag === "aboveSuccess");
  ok("implied probability is allowed to exceed 1 rather than being clamped", above.impliedPoS > 1);

  // Guards.
  ok("success must exceed failure", api.computeBinaryEventImpliedPoS({ currentValue: 10, successValue: 5, failValue: 5 }).ok === false);
  ok("non-numeric input is rejected", api.computeBinaryEventImpliedPoS({ currentValue: "x", successValue: 30, failValue: 5 }).ok === false);
  ok("zero current value is rejected", api.computeBinaryEventImpliedPoS({ currentValue: 0, successValue: 30, failValue: 5 }).ok === false);
  ok("an out-of-range personal PoS is ignored rather than used",
    api.computeBinaryEventImpliedPoS({ currentValue: 10, successValue: 30, failValue: 5, yourPoSPct: 150 }).edgePoSPct === undefined);
  // A zero failure floor is legitimate (a single-asset company whose asset fails).
  const zeroFloor = api.computeBinaryEventImpliedPoS({ currentValue: 6, successValue: 30, failValue: 0 });
  near("a zero failure value is handled: p = current/success", zeroFloor.impliedPoS, 0.2, 1e-12);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Shared by the in-app Peak Sales Comps chart AND the PDF report. Rendering is
// deliberately NOT shared (the report needs print-safe tokens and tighter
// sizing), but this selection logic must not diverge between them — a window
// or rank fixed in one copy and not the other is the actual failure mode, so
// it lives here and is tested once.
section("Peak-sales comp window selection");
{
  const comps = [40, 30, 20, 10, 8, 6, 4, 2].map((b, i) => ({ drug: "C" + i, peakSalesB: b }));
  const own = [{ drug: "Mine", peakSalesB: 9, _own: true }];

  const s = api.selectPeakSalesCompWindow(own, comps, 2);
  // Sorted desc: 40,30,20,10,[9=mine],8,6,4,2 -> mine is index 4, so rank 5 of 9.
  near("rank is 1-indexed position among all comps", s.rank, 5, 1e-9);
  near("total counts comps plus own entries", s.total, 9, 1e-9);
  // Window of 2 either side -> indices 2..6 inclusive = 5 rows.
  near("window returns 2 either side plus the case itself", s.rows.length, 5, 1e-9);
  ok("the case is inside the returned window", s.rows.some(r => r._own));
  ok("rows stay sorted descending by peak sales", s.rows.every((r, i, a) => i === 0 || a[i-1].peakSalesB >= r.peakSalesB));
  near("maxB is the largest value in the window, not the whole set", s.maxB, 20, 1e-9);

  // Clamping at the top of the ranking must not produce negative indices.
  const top = api.selectPeakSalesCompWindow([{ drug: "Top", peakSalesB: 100, _own: true }], comps, 3);
  near("a top-ranked case clamps to rank 1", top.rank, 1, 1e-9);
  ok("no window overrun at the top of the list", top.rows.length <= comps.length + 1 && top.rows.length > 0);
  ok("top-ranked case is included", top.rows.some(r => r._own));

  // ...nor overrun at the bottom.
  const bottom = api.selectPeakSalesCompWindow([{ drug: "Low", peakSalesB: 0.5, _own: true }], comps, 3);
  near("a bottom-ranked case ranks last", bottom.rank, comps.length + 1, 1e-9);
  ok("no window overrun at the bottom of the list", bottom.rows.some(r => r._own));

  // Degenerate inputs return null rather than throwing or rendering nonsense.
  ok("no own drugs returns null", api.selectPeakSalesCompWindow([], comps, 2) === null);
  ok("own drug with zero peak sales is filtered out", api.selectPeakSalesCompWindow([{ drug: "Z", peakSalesB: 0, _own: true }], comps, 2) === null);
  ok("an empty comp set still works with just the case", api.selectPeakSalesCompWindow(own, [], 2).rows.length === 1);

  // The report calls this with an explicit window of 6; the component defaults
  // to the same. Both must agree, or the two views would silently differ.
  const dflt = api.selectPeakSalesCompWindow(own, comps);
  const six = api.selectPeakSalesCompWindow(own, comps, 6);
  ok("the default window matches the report's explicit 6", dflt.rows.length === six.rows.length && dflt.rank === six.rank);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Cash tax with NOL carryforward");
{
  // riskAdjFCF is in DOLLARS on the real calendar (startingNOLM is the one
  // field in millions, matching the app's MillionsField convention). Writing
  // bare numbers here and expecting millions was a test-side units error on
  // the first run — the engine was right.
  const cal = f => f.map((v, i) => ({ calendarYear: i, riskAdjFCF: v * 1e6 }));
  const off = api.applyTaxToCalendar(cal([-100, -50, 300]), { enabled: false, effectiveRatePct: 21 });
  ok("disabled taxation returns the calendar untouched", off[2].riskAdjFCF === 300e6 && off[2].tax === undefined);
  ok("a zero rate is also a no-op", api.applyTaxToCalendar(cal([300]), { enabled: true, effectiveRatePct: 0 })[0].riskAdjFCF === 300e6);

  // Hand-worked. Losses of 100 then 50 build a 150 shield. A 300 profit is
  // shielded by all 150, leaving 150 taxable at 21% = 31.5 tax.
  const t = api.applyTaxToCalendar(cal([-100, -50, 300]), { enabled: true, effectiveRatePct: 21 });
  near("loss years pay no tax", t[0].tax + t[1].tax, 0, 1e-12);
  near("accumulated losses build the shield", t[1].nolPoolEnd, 150e6, 1e-6);
  near("the whole shield is consumed against the first profit", t[2].nolUsed, 150e6, 1e-6);
  near("only income beyond the shield is taxed: 150 x 21% = 31.5", t[2].tax, 31.5e6, 1e-6);
  near("after-tax flow = pre-tax minus tax", t[2].riskAdjFCF, 300e6 - 31.5e6, 1e-6);
  near("pre-tax flow is preserved for display", t[2].preTaxFCF, 300e6, 1e-6);
  near("shield is exhausted after use", t[2].nolPoolEnd, 0, 1e-9);

  // Once exhausted, later profits are taxed in full.
  const t2 = api.applyTaxToCalendar(cal([-100, 300, 200]), { enabled: true, effectiveRatePct: 21 });
  near("year 2 taxes only the excess over the 100 shield", t2[1].tax, 200e6 * 0.21, 1e-6);
  near("year 3 is fully taxed once the shield is gone", t2[2].tax, 200e6 * 0.21, 1e-6);

  // A shield larger than the profit wipes tax out entirely, and the remainder
  // carries forward rather than being lost.
  const t3 = api.applyTaxToCalendar(cal([-500, 100, 100]), { enabled: true, effectiveRatePct: 21 });
  near("a large shield fully covers a small profit", t3[1].tax, 0, 1e-12);
  near("unused shield carries forward", t3[1].nolPoolEnd, 400e6, 1e-6);
  near("and still covers the next year", t3[2].tax, 0, 1e-12);

  // Pre-existing NOLs from prior years are honoured.
  const t4 = api.applyTaxToCalendar(cal([300]), { enabled: true, effectiveRatePct: 21, startingNOLM: 200 });
  near("a starting NOL balance shields the first profit", t4[0].tax, 100e6 * 0.21, 1e-6);

  // Tax can never turn a profit into a loss, or create a refund.
  const t5 = api.applyTaxToCalendar(cal([-100]), { enabled: true, effectiveRatePct: 21 });
  near("a loss year generates no refund", t5[0].tax, 0, 1e-12);
  ok("taxed flow never exceeds pre-tax flow", t[2].riskAdjFCF <= t[2].preTaxFCF);
  ok("input calendar is not mutated", cal([-100, -50, 300])[2].tax === undefined);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Molecule-type PoS adjustment");
{
  // POS_BY_MOLECULE.all is the baseline every ratio composes against, and it
  // is deliberately the same 63.2/30.7/58.1 triple as POS_MODIFIERS.baseline.
  const base = api.POS_BY_MOLECULE.all;
  const bio = api.computeMoleculeTypePoSRatios("biologic");
  ok("biologic is adjusted", bio.applied === true);
  near("biologic Phase 2 ratio = 42.9 / 30.7", bio.ratios.phase2, api.POS_BY_MOLECULE.biologic.phase2 / base.phase2, 1e-12);
  ok("biologic Phase 2 is a real uplift, not noise", bio.ratios.phase2 > 1.3);

  const sm = api.computeMoleculeTypePoSRatios("smallMolecule");
  ok("small molecule is adjusted", sm.applied === true);
  near("small-molecule Phase 1 ratio = 56.6 / 63.2", sm.ratios.phase1, api.POS_BY_MOLECULE.nme.phase1 / base.phase1, 1e-12);
  ok("small molecule is penalised at Phase 1 relative to the blend", sm.ratios.phase1 < 1);

  // Cell and gene therapy must NOT borrow the biologic number — the sources
  // predate those modalities entirely.
  ["cellTherapy", "geneTherapy"].forEach(m => {
    const r = api.computeMoleculeTypePoSRatios(m);
    ok(m + " gets no molecule adjustment (source has no such cohort)", r.applied === false);
    ok(m + " ratios are exactly 1 across all phases",
      r.ratios.phase1 === 1 && r.ratios.phase2 === 1 && r.ratios.phase3 === 1);
  });
  // Unknown/missing modality must be inert, not throw.
  ok("unknown modality is inert", api.computeMoleculeTypePoSRatios("nonsense").applied === false);
  ok("undefined modality is inert", api.computeMoleculeTypePoSRatios(undefined).applied === false);

  // End-to-end: a biologic must now out-score an otherwise identical small
  // molecule, and neither may breach the 99% per-stage cap.
  const mk = (modality) => ({ therapeuticArea: "Oncology", currentPhase: "phase1", modality });
  const bioPos = api.computePoSWeighting(mk("biologic")).posToLaunch;
  const smPos = api.computePoSWeighting(mk("smallMolecule")).posToLaunch;
  ok("a biologic now has a higher cumulative PoS than an identical small molecule", bioPos > smPos);
  ok("every stage stays under the 99% cap",
    api.computePoSWeighting(mk("biologic")).stages.every(s => s.pos <= 0.99));
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Regression guards for a real bug found while re-checking the Workspace work:
// a typed cumulative-PoS override rescaled the CUMULATIVE REACH probabilities,
// including the first stage — which is 1.0 by definition, because the drug is
// already in that phase. Scaling it claimed a <100% chance of reaching a stage
// already reached, understating near-term R&D cost. Two programs with an
// IDENTICAL typed override could differ ~8% in value purely by modality.
section("PoS override rescaling (stage transitions, not reach)");
{
  const prog = (modality, override) => ({
    therapeuticArea: "Oncology", currentPhase: "phase1", modality,
    posOverridePct: override == null ? "" : String(override)
  });
  const scen = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const pv = (modality, override) => api.computeProgramValuation(prog(modality, override), scen, null);

  // The stage you are already in must always be reached with certainty,
  // override or not — this is the exact invariant the bug violated.
  [[null], [25], [5], [80]].forEach(([ov]) => {
    ["smallMolecule", "biologic"].forEach(m => {
      const r = pv(m, ov);
      near(`first stage reach stays 1.0 (${m}, override ${ov == null ? "none" : ov + "%"})`,
        r.posStages[0].posToReachStage, 1, 1e-9);
    });
  });

  // The override must still land on its target cumulative PoS.
  [5, 25, 60].forEach(ov => {
    ["smallMolecule", "biologic"].forEach(m => {
      near(`override of ${ov}% is hit exactly (${m})`, pv(m, ov).posToLaunch * 100, ov, 0.01);
    });
  });

  // Reach probabilities must be non-increasing — you cannot be more likely to
  // reach a later stage than an earlier one.
  ["smallMolecule", "biologic"].forEach(m => {
    const st = pv(m, 25).posStages.map(s => s.posToReachStage);
    ok(`reach probabilities are non-increasing (${m})`, st.every((v, i) => i === 0 || v <= st[i-1] + 1e-12));
    ok(`every reach probability is a valid probability (${m})`, st.every(v => v >= 0 && v <= 1));
  });

  // With no override the benchmark shape is untouched.
  const plain = pv("smallMolecule", null);
  near("no override leaves cumulative PoS at the benchmark", plain.posToLaunch,
    api.computePoSWeighting(prog("smallMolecule", null)).posToLaunch, 1e-12);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("PoS modifier cap reporting");
{
  // Three multiplicative axes can compute well past 100%. The clamp is right,
  // but it must be REPORTED rather than silently returning a confident 99%.
  const favourable = { therapeuticArea: "Hematology", currentPhase: "phase1", modality: "biologic",
                       posBiomarkerUse: "selection", posDiseaseType: "rare" };
  const w = api.computePoSWeighting(favourable);
  ok("an over-100% composition is flagged as capped", w.capBound === true);
  ok("the uncapped peak is reported so the overshoot is visible", w.maxUncappedPct > 100);
  ok("all three axes are counted", w.axesApplied === 3);
  ok("no stage escapes the cap regardless", w.stages.every(s => s.pos <= 0.99 + 1e-12));

  // A plain small molecule with no attributes must NOT be flagged.
  const plain = api.computePoSWeighting({ therapeuticArea: "Oncology", currentPhase: "phase1", modality: "smallMolecule" });
  ok("an ordinary case is not flagged as capped", plain.capBound === false);
  ok("molecule type alone counts as one axis", plain.axesApplied === 1);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Regression guard for a real accuracy bug found in a visual re-audit:
// RevenueChart (the chart behind Revenue/P&L, cash runway, and every FCF
// view) assumed every series was non-negative. Four call sites routed around
// that by pre-clamping their own data to 0 before charting it — silently
// flattening real burn-year losses (a pre-revenue biotech's defining
// characteristic) into a flat $0 line, while the text callout beside the
// chart kept showing the real negative number. The picture lied; the words
// didn't. Fixed by extending the scale to the true [minV, maxV] range and
// removing every clamp. This tests the extracted pure scaling function.
section("RevenueChart Y-axis scaling (negative-value support)");
{
  // All-positive series: must behave exactly as before the fix (minV pinned
  // at 0, not the series' own minimum) — a pure revenue ramp should never
  // show a negative baseline just because it doesn't start at exactly zero.
  const allPos = api.revenueChartYScale([0, 10, 50, 100]);
  near("all-positive series floors minV at 0, not its own min", allPos.minV, 0, 1e-12);
  near("all-positive series maxV is the series max", allPos.maxV, 100, 1e-12);
  near("range is maxV - minV", allPos.range, 100, 1e-12);

  // The exact shape of the bug: an early loss year mixed with later profit.
  const mixed = api.revenueChartYScale([-8.7, 0, 50, 1630]);
  near("mixed series extends minV below zero to the true minimum", mixed.minV, -8.7, 1e-9);
  near("mixed series maxV is unaffected", mixed.maxV, 1630, 1e-9);
  near("range spans the full negative-to-positive extent", mixed.range, 1630 - (-8.7), 1e-9);

  // All-negative series (e.g. a company that never turns EBIT-positive in the
  // projection window) must still produce a finite, sensible scale rather
  // than degenerating.
  const allNeg = api.revenueChartYScale([-50, -30, -10]);
  // maxV floors at 1, not 0 — deliberately, so it stays strictly > 0. That is
  // what keeps hasZeroLine (minV < 0 && maxV > 0) true for an all-negative
  // series: flooring at exactly 0 would make maxV > 0 false and the zero
  // line — the one gridline that matters most for an always-losing company —
  // would stop rendering. Confirmed by construction, not by re-deriving the
  // component's own output.
  near("all-negative series maxV floors at 1 (stays > 0 so the zero line still renders)", allNeg.maxV, 1, 1e-12);
  near("all-negative series minV is the true minimum", allNeg.minV, -50, 1e-9);
  ok("all-negative range is positive and finite", allNeg.range > 0 && isFinite(allNeg.range));
  ok("maxV > 0 holds for an all-negative series (zero-line precondition)", allNeg.maxV > 0);

  // Degenerate: every value exactly 0 must not produce a divide-by-zero range.
  const allZero = api.revenueChartYScale([0, 0, 0]);
  ok("an all-zero series has a positive, finite range (no /0)", allZero.range > 0 && isFinite(allZero.range));

  // The invariant that actually matters: y=0 must always be mappable within
  // [minV, maxV] whenever the data crosses zero, since that is the
  // profit/loss threshold the chart's zero-line depends on.
  [mixed, allNeg].forEach((s, i) => {
    ok(`scale ${i}: zero falls within [minV, maxV]`, 0 >= s.minV && 0 <= s.maxV);
  });
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Storage accounting. The distinction that matters is user data (a case, which
// cannot be recovered) vs. disposable API caches (re-fetchable in seconds) —
// getting that split wrong would either cry wolf over a harmless cache or, far
// worse, stay quiet while real work is at risk.
section("Storage headroom accounting");
{
  const realLS = global.localStorage;
  const mock = (obj) => {
    global.localStorage = {
      getItem: k => (k in obj ? obj[k] : null),
      setItem: (k, v) => { obj[k] = v; },
      removeItem: k => { delete obj[k]; }
    };
    // Object.keys(localStorage) is what measureStorage iterates
    Object.keys(obj).forEach(k => { global.localStorage[k] = obj[k]; });
  };

  mock({ pdcf_cases_v1: "x".repeat(1000), pdcf_edgar_cache: "y".repeat(4000), pdcf_theme: "dark" });
  const m = api.measureStorage();
  near("user bytes exclude the API caches", m.userBytes, 1000 + 4, 1);
  near("cache bytes are counted separately", m.cacheBytes, 4000, 1);
  near("total is the sum of both", m.total, m.userBytes + m.cacheBytes, 1e-9);
  ok("a nearly-empty store reports level ok", m.level === "ok");

  // Threshold behaviour at the two boundaries.
  const atWarn = Math.ceil(api.STORAGE_ASSUMED_QUOTA_BYTES * api.STORAGE_WARN_FRACTION);
  mock({ pdcf_cases_v1: "x".repeat(atWarn) });
  ok("crossing the warn fraction reports 'warn'", api.measureStorage().level === "warn");

  const atCrit = Math.ceil(api.STORAGE_ASSUMED_QUOTA_BYTES * api.STORAGE_CRITICAL_FRACTION);
  mock({ pdcf_cases_v1: "x".repeat(atCrit) });
  ok("crossing the critical fraction reports 'critical'", api.measureStorage().level === "critical");

  // A store that is huge ONLY because of caches must still surface — the
  // remedy differs (drop caches vs. delete cases) but the risk to the next
  // save is identical.
  mock({ pdcf_edgar_cache: "y".repeat(atCrit) });
  const cacheHeavy = api.measureStorage();
  ok("a cache-only overflow is still reported as critical", cacheHeavy.level === "critical");
  near("...and is attributed to caches, not user data", cacheHeavy.userBytes, 0, 1e-9);
  ok("thresholds are ordered warn < critical", api.STORAGE_WARN_FRACTION < api.STORAGE_CRITICAL_FRACTION);

  global.localStorage = realLS;
}
report();

// ════════════════════════════════════════════════════════════════════════════
// THE REVENUE BUILD — the core of every valuation this app produces, and until
// now the largest unverified surface in it. A coverage audit found 81 of 180
// engine functions independently checked, with the entire population -> share
// -> adherence -> price -> erosion chain among the gaps. Every expected value
// below is worked longhand in its comment.
section("Revenue build: population funnel");
{
  // Prevalence mode: 100,000 prevalent x 80% diagnosed x 60% treated x 50% eligible
  //   diagnosed = 80,000 ; treated = 48,000 ; eligible = 24,000
  const f = api.computeTreatedPopulation({ mode: "prevalence", prevalence: "100000",
    diagnosisRatePct: "80", treatmentRatePct: "60", eligiblePct: "50" });
  near("addressable = prevalence", f.addressable, 100000, 1e-9);
  near("diagnosed = 100k x 0.80", f.diagnosed, 80000, 1e-9);
  near("treated = 80k x 0.60", f.treated, 48000, 1e-9);
  near("eligible = 48k x 0.50", f.eligible, 24000, 1e-9);

  // Incidence mode: addressable = incidence x disease duration (a prevalence proxy).
  //   5,000/yr x 8 years = 40,000
  const inc = api.computeTreatedPopulation({ mode: "incidence", incidence: "5000",
    diseaseDurationYears: "8", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" });
  near("incidence mode: addressable = incidence x duration", inc.addressable, 40000, 1e-9);
  near("100% rates pass the pool through unchanged", inc.eligible, 40000, 1e-9);

  // Blank rates must default to 100%, not 0 — a blank field silently zeroing
  // the whole funnel would produce a $0 valuation with no visible cause.
  const blank = api.computeTreatedPopulation({ mode: "prevalence", prevalence: "1000",
    diagnosisRatePct: "", treatmentRatePct: "", eligiblePct: "" });
  near("blank funnel rates default to 100%, not 0", blank.eligible, 1000, 1e-9);

  // Monotonicity: each stage can only shrink the pool.
  ok("funnel is non-increasing at every stage",
    f.addressable >= f.diagnosed && f.diagnosed >= f.treated && f.treated >= f.eligible);
}
report();

section("Revenue build: launch curve");
{
  // Two curve sources exist and the priority between them is deliberate:
  // LAUNCH_CURVE_EXACT holds the source's exact empirical curves per ramp
  // length (Figure 6-2) and takes precedence over LAUNCH_CURVE's adapted
  // 6-year curve (Figure 6-1). Verified here explicitly because the two
  // disagree slightly (11 vs 10.6 at year 1) and silently reading the wrong
  // one would shift every early-year revenue figure in the app.
  const six = api.launchCurveForYears(6, "median");
  ok("6yr median uses the EXACT empirical curve, not the adapted one",
    JSON.stringify(six) === JSON.stringify(api.LAUNCH_CURVE_EXACT[6].median));
  ok("the two curve sources genuinely differ (so the priority matters)",
    JSON.stringify(api.LAUNCH_CURVE_EXACT[6].median) !== JSON.stringify(api.LAUNCH_CURVE.years6));
  ["median", "p25", "p75"].forEach(prof => {
    const cur = api.launchCurveForYears(6, prof);
    near(`${prof} curve ends at exactly 100% of peak`, cur[cur.length - 1], 100, 1e-9);
    ok(`${prof} curve is monotonically increasing`, cur.every((v, i) => i === 0 || v >= cur[i-1]));
    ok(`${prof} curve stays within 0-100%`, cur.every(v => v >= 0 && v <= 100));
  });
  // Any ramp length must still terminate at exactly peak and stay monotonic —
  // this is what makes "years to peak" a safe free parameter.
  [3, 4, 5, 7, 8, 10].forEach(n => {
    const cur = api.launchCurveForYears(n, "median");
    near(`${n}yr ramp has exactly ${n} points`, cur.length, n, 1e-9);
    near(`${n}yr ramp ends at 100%`, cur[cur.length - 1], 100, 1e-9);
    ok(`${n}yr ramp is monotonic`, cur.every((v, i) => i === 0 || v >= cur[i-1]));
  });
  // p75 (fast) must be at or above median at every point; p25 (slow) at or below.
  const med = api.launchCurveForYears(6, "median"), fast = api.launchCurveForYears(6, "p75"), slow = api.launchCurveForYears(6, "p25");
  ok("fast ramp is never below median", fast.every((v, i) => v >= med[i] - 1e-9));
  ok("slow ramp is never above median", slow.every((v, i) => v <= med[i] + 1e-9));
}
report();

section("Revenue build: exclusivity erosion");
{
  // Erosion params: 10% volume retained, 38% price decline, 3-year ramp, LOE yr 13.
  const er = { yearsToLOE: 13, volRetained: 0.10, priceDecline: 0.38, erosionRampYears: 3 };
  near("no erosion before LOE", api.erosionMultiplier(13, er), 1, 1e-12);
  near("no erosion well before LOE", api.erosionMultiplier(5, er), 1, 1e-12);
  // Year 14 = 1/3 through the ramp:
  //   vol   = 1 - (1/3)(1 - 0.10) = 1 - 0.30 = 0.70
  //   price = 1 - (1/3)(0.38)     = 1 - 0.126666... = 0.873333...
  //   total = 0.70 x 0.8733333... = 0.6113333...
  near("1 year past LOE = 1/3 of the erosion ramp", api.erosionMultiplier(14, er), 0.70 * (1 - 0.38/3), 1e-12);
  // Fully eroded at/after the ramp end: 0.10 x (1 - 0.38) = 0.062
  near("fully eroded at ramp end", api.erosionMultiplier(16, er), 0.10 * 0.62, 1e-12);
  near("erosion does not deepen past the ramp", api.erosionMultiplier(25, er), 0.10 * 0.62, 1e-12);
  // Monotonic decline through the ramp.
  const seq = [13,14,15,16,17].map(y => api.erosionMultiplier(y, er));
  ok("erosion multiplier is non-increasing over time", seq.every((v,i)=> i===0 || v <= seq[i-1] + 1e-12));
  ok("erosion multiplier never leaves [0,1]", seq.every(v => v >= 0 && v <= 1));
}
report();

section("Revenue build: full program revenue");
{
  // Deliberately simple so peak revenue is hand-computable:
  //   pool 100,000 x 100% x 100% x 100%          = 100,000 eligible
  //   peak share override 20%                     =  20,000 patients
  //   adherence 80%                               =  16,000 peak patients
  //   US price $10,000, 0% growth                 -> peak US revenue $160,000,000
  //   ex-US at 50% price and 100% patient pool    -> + $80,000,000 = $240,000,000
  const rb = {
    population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "80",
    marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "20" },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: true,
               exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" },
    exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
  };
  const r = api.computeProgramRevenue(rb, 20);
  near("peak patients = 100k x 20% share x 80% adherence", r.peakPatients, 16000, 1e-9);
  near("peak US revenue = 16,000 x $10,000", r.peakUSRevenue, 160e6, 1);
  near("peak total revenue adds ex-US at half price", r.peakTotalRevenue, 240e6, 1);
  // Year 1 = peak x the exact curve's first point (11% on the 6yr median).
  near("year 1 US revenue = peak x 11%", r.years[0].usRevenue, 160e6 * 0.11, 2);
  // Peak is reached exactly at yearsToPeak and held until LOE.
  near("year 6 hits full peak", r.years[5].usRevenue, 160e6, 1);
  near("year 13 (LOE year) still at peak", r.years[12].usRevenue, 160e6, 1);
  ok("year 14 is below peak (erosion has begun)", r.years[13].usRevenue < 160e6);
  // Turning ex-US off must remove exactly the ex-US component.
  const usOnly = api.computeProgramRevenue({ ...rb, pricing: { ...rb.pricing, includeExUS: false } }, 20);
  near("disabling ex-US leaves US revenue untouched", usOnly.peakUSRevenue, 160e6, 1);
  near("disabling ex-US makes total equal US", usOnly.peakTotalRevenue, 160e6, 1);
  // Price growth compounds from year 1 (not year 0).
  const grown = api.computeProgramRevenue({ ...rb, pricing: { ...rb.pricing, usAnnualGrowthPct: "10", includeExUS: false } }, 20);
  near("year 1 price is ungrown (growth compounds from yr 1)", grown.years[0].usRevenue, 160e6 * 0.11, 2);
  near("year 2 price is grown once (x1.10)", grown.years[1].usRevenue, 160e6 * 0.31 * 1.10, 2);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// The cost side of the DCF — the other half of the previously-unverified core.
// Constants cross-checked against the source document this session: reps at
// $190k/$280k/$300k fully loaded (Table 10-3), pre-commercial G&A $8.7M
// median, mature SG&A 34% of revenue stabilizing above $400M (Fig 9-1).
section("Cost structure: COGS, sales force, marketing, corporate G&A");
{
  // COGS is a flat percentage of revenue, per year.
  const cogs = api.computeCOGS([0, 100e6, 500e6], "22");
  near("COGS is 0 on 0 revenue", cogs[0], 0, 1e-9);
  near("COGS = 22% of $100M", cogs[1], 22e6, 1);
  near("COGS scales linearly", cogs[2], 110e6, 1);
  near("blank COGS% yields 0, not NaN", api.computeCOGS([100e6], "")[0], 0, 1e-9);

  // Sales force: 10 primary care x $190k + 5 specialty x $280k + 2 hospital x $300k
  //   = 1,900,000 + 1,400,000 + 600,000 = $3,900,000 in year 1
  const reps = { primaryCare: "10", specialty: "5", hospital: "2" };
  const sf = api.computeSalesForceCost([1,2,3], reps, 13, 0);
  near("year 1 sales force = fully-loaded per-rep costs x headcount", sf[0], 3.9e6, 1);
  // Compensation grows 2%/yr from year 1.
  near("year 2 grows once at 2%", sf[1], 3.9e6 * 1.02, 1);
  near("year 3 grows twice", sf[2], 3.9e6 * Math.pow(1.02, 2), 1);
  // Eliminated entirely after LOE, per the source's own treatment.
  const sfLoe = api.computeSalesForceCost([12,13,14], reps, 13, 0);
  ok("sales force persists through the LOE year", sfLoe[1] > 0);
  near("sales force is eliminated the year after LOE", sfLoe[2], 0, 1e-9);
  near("zero reps costs nothing", api.computeSalesForceCost([1], { primaryCare: "", specialty: "", hospital: "" }, 13, 0)[0], 0, 1e-9);

  // Marketing is a flat % of PEAK revenue (not current-year revenue), held
  // constant, and also stops after LOE.
  const mk = api.computeMarketingCost([1,2,13,14], 1e9, "5", 13);
  near("marketing = 5% of $1B peak", mk[0], 50e6, 1);
  near("...held constant year to year", mk[1], 50e6, 1);
  near("...still spent in the LOE year", mk[2], 50e6, 1);
  near("...zero after LOE", mk[3], 0, 1e-9);

  // Corporate G&A: flat pre-commercial baseline, ramping linearly to the
  // mature 34%-of-revenue x G&A-share once revenue clears the $400M threshold.
  const gaShare = 50, matureGaPct = (api.SGA_BENCHMARKS.matureSgaPctOfRevenue / 100) * (gaShare / 100);
  const threshold = api.SGA_BENCHMARKS.maturityRevenueThresholdM * 1e6;
  const ga = api.computeCorporateGA([0, threshold, threshold * 2], "", String(gaShare));
  near("pre-revenue G&A is the flat benchmark baseline", ga[0], api.SGA_BENCHMARKS.preCommercialGA.medianM * 1e6, 1);
  near("at the maturity threshold G&A = revenue x mature rate", ga[1], threshold * matureGaPct, 1);
  near("above threshold G&A stays proportional", ga[2], threshold * 2 * matureGaPct, 1);
  // Mid-ramp must interpolate between the two, never jump.
  const mid = api.computeCorporateGA([threshold * 0.5], "", String(gaShare))[0];
  ok("mid-ramp G&A sits between the baseline and the mature figure",
    mid > api.SGA_BENCHMARKS.preCommercialGA.medianM * 1e6 * 0.5 && mid < threshold * matureGaPct);
  // Monotonic in revenue — more revenue must never mean less G&A.
  const series = api.computeCorporateGA([0, 100e6, 200e6, 400e6, 800e6], "", String(gaShare));
  ok("G&A is non-decreasing as revenue grows", series.every((v,i)=> i===0 || v >= series[i-1] - 1));
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Regression guard for a real integration bug found by live-testing every API:
// openFDA drug-label lookups returned "not found" for EVERY drug. The cause
// was encoding, not the query — URLSearchParams percent-encodes "+" to %2B,
// and openFDA reads %2B as a literal plus character inside the search string
// rather than a clause separator, so the compound query matched nothing.
// Verified against the live API before and after: the %2B form returns
// NOT_FOUND for Eliquis, the properly-separated form returns the real label.
section("openFDA query encoding");
{
  const q = api.tsFdaQueryString({ search: 'openfda.brand_name:"Eliquis" OR openfda.generic_name:"Eliquis"', limit: 1 });
  ok("the OR separator survives as a real separator, not %2B", q.indexOf("+OR+") !== -1);
  ok("no literal %2B is emitted into the search", q.indexOf("%2B") === -1);
  ok("quoted terms are still percent-encoded", q.indexOf("%22Eliquis%22") !== -1);
  ok("the field colon is encoded", q.indexOf("%3A") !== -1);
  ok("non-search params are encoded normally", q.indexOf("limit=1") !== -1);
  // A single-clause search (no operator) must still encode cleanly.
  const single = api.tsFdaQueryString({ search: 'patient.drug.medicinalproduct:"Eliquis"', count: 'x.exact' });
  ok("a single-clause search encodes without introducing separators", single.indexOf("+OR+") === -1 && single.indexOf("%2B") === -1);
  ok("count parameter passes through", single.indexOf("count=") !== -1);
  // AND must be preserved the same way OR is.
  const andQ = api.tsFdaQueryString({ search: 'a:"1" AND b:"2"' });
  ok("AND is preserved as a separator too", andQ.indexOf("+AND+") !== -1);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// Regression guard for a real correctness bug: callers OVERWRITE dilutedShares
// with computeDilutionPath's result, and the function built from the RAW cap
// table — so enabling Dilution Path silently discarded a manually configured
// future raise. A case with a known $300M raise (+10M shares) came back at the
// undiluted count, as if the input had never been entered. That is worse than
// double-counting: the user sees a field they filled in having no effect.
section("Dilution path composes with a manual future raise");
{
  const mkCase = (futureRaise, dilutionPath) => ({
    currentPrice: "30",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "50000000", cash: "200000000", debt: "" },
    corporateGA: { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" },
    programs: [],
    futureRaise, dilutionPath
  });
  const scen = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const raise = { enabled: true, amountM: "300000000", priceDiscountPct: "20" };
  const path = { enabled: true, minCashBufferM: "50000000", targetRunwayMonths: "18", discountToMarketPct: "15" };

  // $300M at $30/share = 10M new shares on top of 50M.
  const withRaiseOnly = api.computeDilutionPath(mkCase(raise, { enabled: false }), scen, 15);
  near("with the path OFF, the manual raise still shows through", withRaiseOnly.finalDilutedShares, 60e6, 1);

  const bothOn = api.computeDilutionPath(mkCase(raise, path), scen, 15);
  ok("with the path ON, the manual raise is NOT discarded", bothOn.finalDilutedShares >= 60e6 - 1);

  const neither = api.computeDilutionPath(mkCase({ enabled: false }, { enabled: false }), scen, 15);
  near("with both off, the raw diluted count is returned unchanged", neither.finalDilutedShares, 50e6, 1);

  // The projection must never REDUCE the share count below its starting point.
  ok("a dilution path never issues negative dilution", bothOn.finalDilutedShares >= neither.finalDilutedShares - 1);
  // A disabled path reports enabled:false so callers know not to overwrite.
  ok("a disabled path reports enabled:false", neither.enabled === false && withRaiseOnly.enabled === false);
  ok("an enabled path reports enabled:true", bothOn.enabled === true);
}
report();

// ════════════════════════════════════════════════════════════════════════════
// EDGAR XBRL EXTRACTION
// These parse real SEC filing data straight into capital-structure, dilution
// and runway math, and had no coverage at all until an audit found four real
// bugs in them. Fixtures below are shaped like genuine companyfacts responses
// and are the exact cases that reproduced each bug.
// ════════════════════════════════════════════════════════════════════════════
section("Analog effect-size board — extracts only what is structured, and says so");
{
  // A response shaped like the real thing: one clean hazard ratio, one
  // unrecognised parameter type, one results-free trial, and one where the
  // only structured analysis sits on a SECONDARY endpoint.
  const mk = (nct, opts) => ({
    protocolSection: {
      identificationModule: { nctId: nct, briefTitle: "Trial " + nct },
      statusModule: { overallStatus: "COMPLETED", completionDateStruct: { date: "2024-01-01" } },
      designModule: { enrollmentInfo: { count: opts.n || 300 } }
    },
    resultsSection: opts.measures ? { outcomeMeasuresModule: { outcomeMeasures: opts.measures } } : undefined
  });
  const primaryHR = (value, lo, hi) => ([{ type: "PRIMARY", title: "Overall survival",
    analyses: [{ paramType: "Hazard Ratio (HR)", paramValue: String(value), ciLowerLimit: String(lo), ciUpperLimit: String(hi), pValue: "0.03" }] }]);

  const data = { totalCount: 40, studies: [
    mk("NCT01", { measures: primaryHR(0.72, 0.58, 0.90) }),          // clean, excludes null
    mk("NCT02", { measures: primaryHR(0.88, 0.74, 1.05) }),          // crosses null
    mk("NCT03", { measures: [{ type: "PRIMARY", title: "Change in score",
      analyses: [{ paramType: "Geometric mean ratio of something odd", paramValue: "4.2" }] }] }),   // unrecognised type
    mk("NCT04", {}),                                                  // no results at all
    mk("NCT05", { measures: [{ type: "SECONDARY", title: "PFS",
      analyses: [{ paramType: "Hazard Ratio (HR)", paramValue: "0.5" }] }] })     // secondary only
  ]};
  const r = api.extractAnalogEffects(data, { condition: "X", phase: "PHASE3" });

  near("two trials yield an extractable primary effect", r.withExtractableEffect, 2, 0);
  near("four of the five posted results at all", r.withPostedResults, 4, 0);
  near("the API's own total is preserved as the outer denominator", r.totalMatched, 40, 0);
  ok("a secondary-only analysis is excluded from the board",
    !r.rows.some(x => x.nctId === "NCT05"));
  ok("an unrecognised parameter type is excluded rather than guessed at",
    !r.rows.some(x => x.nctId === "NCT03"));

  // Direction and conclusiveness must be separate ideas.
  const hr72 = r.rows.find(x => x.nctId === "NCT01");
  const hr88 = r.rows.find(x => x.nctId === "NCT02");
  ok("an HR below 1 is marked as favouring treatment", hr72.favoursTreatment === true);
  ok("an interval excluding 1 is marked conclusive", hr72.crossesNull === false);
  ok("an HR below 1 whose interval crosses 1 still favours treatment directionally", hr88.favoursTreatment === true);
  ok("but is correctly marked as crossing the null", hr88.crossesNull === true);

  const summary = r.summaryByScale.ratio;
  near("median of the two ratios", summary.median, 0.80, 1e-9);
  near("range low", summary.min, 0.72, 1e-9);
  near("range high", summary.max, 0.88, 1e-9);
  near("only one interval excluded no-effect", summary.intervalExcludesNull, 1, 0);

  // Ratios and differences must never be pooled onto one axis.
  const mixed = { totalCount: 2, studies: [
    mk("NCT10", { measures: primaryHR(0.7, 0.6, 0.85) }),
    mk("NCT11", { measures: [{ type: "PRIMARY", title: "Change from baseline",
      analyses: [{ paramType: "Least Squares Mean Difference", paramValue: "-2.4", ciLowerLimit: "-3.9", ciUpperLimit: "-0.9" }] }] })
  ]};
  const m = api.extractAnalogEffects(mixed, {});
  ok("ratios and differences are kept on separate scales",
    m.byScale.ratio.length === 1 && m.byScale.difference.length === 1);
  ok("a negative mean difference favours treatment on the difference scale",
    m.byScale.difference[0].favoursTreatment === false);

  // The real API registers paramType as free text, which is why this is
  // pattern-matched rather than looked up. Confirmed against live records:
  // "Hazard Ratio (HR)" and "CMH ESTIMATE OF COMMON ODDS RATIO" both appear.
  ok("plain 'Hazard Ratio (HR)' is recognised", api.tsClassifyEffectParam("Hazard Ratio (HR)").scale === "ratio");
  ok("a CMH common odds ratio is recognised", api.tsClassifyEffectParam("CMH ESTIMATE OF COMMON ODDS RATIO").scale === "ratio");
  ok("relative risk is recognised", api.tsClassifyEffectParam("Relative Risk").scale === "ratio");
  ok("an LS mean difference lands on the difference scale", api.tsClassifyEffectParam("Least Squares Mean Difference").scale === "difference");
  // The important refusals: a transformed scale has a different null value, so
  // matching it as a plain ratio would corrupt every summary on the board.
  ok("a LOG hazard ratio is refused rather than treated as a ratio", api.tsClassifyEffectParam("Log Hazard Ratio") === null);
  ok("a slope is refused", api.tsClassifyEffectParam("Slope per unit time") === null);
  ok("an unrecognised measure is refused", api.tsClassifyEffectParam("Number of participants") === null);
  ok("empty input is refused", api.tsClassifyEffectParam("") === null);

  // Empty input must not throw or imply a landscape.
  const empty = api.extractAnalogEffects({ studies: [] }, {});
  ok("an empty response yields an empty board, not a crash", empty.rows.length === 0);
  near("with honest zero denominators", empty.withExtractableEffect, 0, 0);
}
report();

section("Open Targets dossier — stage parsing and evidence split");
{
  const mk = (stage) => ({ id: "ENSG1", approvedSymbol: "X", approvedName: "x", biotype: "protein_coding",
    associatedDiseases: { count: 2, rows: [
      { score: 0.85, disease: { id: "D1", name: "with genetics" },
        datatypeScores: [{ id: "genetic_association", score: 0.86 }, { id: "animal_model", score: 0.4 }] },
      { score: 0.5, disease: { id: "D2", name: "no genetics" },
        datatypeScores: [{ id: "animal_model", score: 0.5 }, { id: "literature", score: 0.3 }] }
    ] },
    drugAndClinicalCandidates: { count: 1, rows: [
      { id: "CHEMBL1", maxClinicalStage: stage, drug: { id: "CHEMBL1", name: "DrugA" }, diseases: [{ disease: { name: "Some indication" } }] }
    ] } });

  // The live API returns PHASE_3, not roman numerals. Matching only roman
  // numerals scored every drug 0, so a target with four Phase 3 programmes
  // reported "0 reached Phase 3+".
  near("PHASE_3 parses as phase 3", api.summarizeDossier(mk("PHASE_3")).drugs[0].maxPhase, 3, 0);
  near("Phase III still parses as 3", api.summarizeDossier(mk("Phase III")).drugs[0].maxPhase, 3, 0);
  near("PHASE_2 does not get mistaken for 3", api.summarizeDossier(mk("PHASE_2")).drugs[0].maxPhase, 2, 0);
  near("Phase II is not matched by the Phase III rule", api.summarizeDossier(mk("Phase II")).drugs[0].maxPhase, 2, 0);
  near("APPROVED counts as 4", api.summarizeDossier(mk("APPROVED")).drugs[0].maxPhase, 4, 0);
  near("an unknown stage is 0, not guessed", api.summarizeDossier(mk("")).drugs[0].maxPhase, 0, 0);
  near("phase 3+ count reflects the parse", api.summarizeDossier(mk("PHASE_3")).approvedOrLateStage, 1, 0);

  const d = api.summarizeDossier(mk("PHASE_3"));
  ok("a machine token is prettified for display", d.drugs[0].stageLabel === "Phase 3");
  ok("genetic evidence is detected where present", d.diseases[0].hasGeneticEvidence === true);
  ok("and not claimed where the evidence is animal/literature only", d.diseases[1].hasGeneticEvidence === false);
  ok("the headline flag is true when any association has genetics", d.anyGeneticEvidence === true);
  ok("a clinical row's indication is unwrapped from its list item",
    d.drugs[0].indications[0] === "Some indication");
  ok("a null target summarises to null rather than throwing", api.summarizeDossier(null) === null);
}
report();

section("Trial decoder — design classification");
{
  const base = { nctId: "NCT00000001", title: "T", status: "RECRUITING", phase: "PHASE3", enrollment: 400, armTypes: [], armCount: 2, primaryOutcomesFull: [] };

  // A textbook Phase 3: randomised, double blind, placebo-controlled.
  const clean = { ...base, allocation: "RANDOMIZED", interventionModel: "PARALLEL", masking: "DOUBLE",
    whoMasked: ["PARTICIPANT", "INVESTIGATOR"], armTypes: ["EXPERIMENTAL", "PLACEBO_COMPARATOR"],
    primaryOutcomesFull: [{ measure: "Overall survival", timeFrame: "36 months" }] };
  const d1 = api.decodeTrial(clean);
  ok("randomised allocation is recognised", d1.allocation.randomized === true);
  ok("double blind is recognised", d1.masking.blinded === true);
  ok("a placebo arm makes it controlled", d1.comparator.controlled === true);
  ok("it can support a causal comparison", d1.canProve.some(t => t.indexOf("causal comparison") !== -1));
  ok("overall survival is read as objective, not subjective", d1.endpoint.subjective === false);
  ok("and as a time-to-event endpoint", d1.endpoint.timeToEvent === true);
  ok("a clean design raises no design red flags", d1.redFlags.length === 0);

  // Single-arm: must lose the causal claim, and say so explicitly.
  const singleArm = { ...base, interventionModel: "SINGLE_GROUP", armCount: 1, masking: "NONE",
    armTypes: ["EXPERIMENTAL"], primaryOutcomesFull: [{ measure: "Objective response rate", timeFrame: "24 weeks" }] };
  const d2 = api.decodeTrial(singleArm);
  ok("single-arm is recognised", d2.allocation.value === "single-arm");
  ok("it cannot make a causal claim", d2.cannotProve.some(t => t.indexOf("causal claim") !== -1));
  ok("and that is flagged", d2.redFlags.some(f => f.label.indexOf("Single-arm") !== -1));

  // The highest-value flag: open label + a judgement-based endpoint.
  ok("open label + ORR raises the expectation-bias flag",
    d2.redFlags.some(f => f.label.indexOf("Open label") !== -1 && f.severity === "high"));
  ok("ORR is classified subjective", d2.endpoint.subjective === true);

  // An independent blinded read should rescue an otherwise subjective endpoint.
  const bicr = { ...singleArm, primaryOutcomesFull: [{ measure: "Progression-free survival by BICR", timeFrame: "24 months" }] };
  ok("a BICR-assessed endpoint is not treated as subjective",
    api.decodeTrial(bicr).endpoint.subjective === false);

  // A registration with dozens of primaries is a master protocol, not a
  // trial with dozens of co-primaries — found against NCT04368728, which
  // registers 64. The wording has to change with it.
  const master = { ...clean, primaryOutcomesFull: Array.from({ length: 64 }, (_, i) => ({ measure: "Outcome " + i, timeFrame: "1 week" })) };
  {
    const f = api.decodeTrial(master).redFlags.find(x => x.label.indexOf("primary endpoints") !== -1);
    ok("64 primaries is described as a master protocol, not co-primaries", !!f && f.label.indexOf("registered primary endpoints") !== -1);
    ok("and the alpha-splitting framing is not applied to it", !!f && f.detail.indexOf("alpha") === -1);
  }

  // Co-primaries raise the bar and must be called out.
  const coPrimary = { ...clean, primaryOutcomesFull: [
    { measure: "Overall survival", timeFrame: "36 months" },
    { measure: "Progression-free survival", timeFrame: "24 months" }] };
  ok("two co-primary endpoints are flagged",
    api.decodeTrial(coPrimary).redFlags.some(f => f.label.indexOf("co-primary") !== -1));

  // Tiny time-to-event trial.
  const tiny = { ...clean, enrollment: 30 };
  ok("a 30-patient survival trial is flagged as underpowered-by-design",
    api.decodeTrial(tiny).redFlags.some(f => f.label.indexOf("Small trial") !== -1));

  // Stopped early.
  ok("an early termination is surfaced with its stated reason",
    api.decodeTrial({ ...clean, whyStopped: "Slow accrual" })
      .redFlags.some(f => f.label.indexOf("stopped early") !== -1 && f.detail.indexOf("Slow accrual") !== -1));

  // Completed long ago with nothing posted.
  const silent = { ...clean, status: "COMPLETED", primaryCompletionDate: "2022-01-01", hasResults: false };
  ok("a completed trial with no results past a year is flagged",
    api.decodeTrial(silent, { now: new Date("2026-09-21") })
      .redFlags.some(f => f.label.indexOf("no posted results") !== -1));
  ok("but not if results were actually posted",
    !api.decodeTrial({ ...silent, hasResults: true }, { now: new Date("2026-09-21") })
      .redFlags.some(f => f.label.indexOf("no posted results") !== -1));

  // Missing fields must read as "not stated", never as a default.
  const bare = { nctId: "NCT2", title: "B", armTypes: [], armCount: 0, primaryOutcomesFull: [] };
  const d3 = api.decodeTrial(bare);
  ok("an unregistered allocation says 'not stated'", d3.allocation.stated === false);
  ok("unregistered masking is not silently read as open label", d3.masking.blinded === null);
  ok("and no open-label flag is raised on unknown masking",
    !d3.redFlags.some(f => f.label.indexOf("Open label") !== -1));

  // The universal caveat must always be present.
  ok("every decode states that a win is not an approval",
    d1.cannotProve.some(t => t.indexOf("Regulatory approval") !== -1) &&
    d3.cannotProve.some(t => t.indexOf("Regulatory approval") !== -1));

  ok("a malformed study decodes to null rather than throwing", api.decodeTrial(null) === null);
  ok("architecture summary reads like a reviewer would say it",
    d1.architecture.indexOf("randomized") !== -1 && d1.architecture.indexOf("n=400") !== -1);
}
report();

section("Charts stay valid at data extremes");
{
  // An SVG attribute of "NaN" or "Infinity" is silently dropped by the
  // browser, so these render as missing elements rather than as an error —
  // which is exactly why they went unnoticed. Assert on the markup.
  const clean = (svg) => svg.indexOf("NaN") === -1 && svg.indexOf("Infinity") === -1;

  // renderLineChart hard-coded yMin to 0, so negatives mapped below the plot
  // area and were clipped out of sight with nothing on the axis to show it.
  const negSeries = [{ name: "n", color: "var(--teal)", points: [{ x: 0, y: -50 }, { x: 1, y: -20 }, { x: 2, y: 10 }] }];
  const negSvg = api.renderLineChart(negSeries, { title: "t" });
  ok("a line chart with negative values renders without NaN", clean(negSvg));
  ok("and its y-axis actually reaches below zero", negSvg.indexOf("-50") !== -1 || negSvg.indexOf("−50") !== -1);

  // A single-point series was "M x y" with nothing to draw to — an invisible
  // chart that looked like missing data.
  const onePoint = api.renderLineChart([{ name: "one", color: "var(--teal)", points: [{ x: 1, y: 5 }] }], {});
  ok("a single-point series draws something visible", onePoint.indexOf("<circle") !== -1);
  ok("and does so without NaN coordinates", clean(onePoint));

  // Identical values collapse the domain; the guard kept the maths safe but
  // the axis labels still read "100, 100.5, 100".
  const flatHist = api.renderHistogram([100, 100, 100, 100], { title: "flat" });
  ok("an all-identical histogram renders without NaN", clean(flatHist));
  {
    // Check the rendered LABELS, not the raw markup — pixel coordinates in the
    // attributes contain decimals of their own and would match anything.
    const labels = [...flatHist.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
    const numeric = labels.filter(t => /^[\d.]+$/.test(t)).map(parseFloat);
    // The value axis should show 100 and nothing above it — never a 100.5
    // midpoint implying a spread that doesn't exist.
    ok("no axis label sits above the single real value", numeric.every(v => v <= 100));
    ok("and the real value is labelled", labels.some(t => parseFloat(t) === 100));
  }

  ok("an empty histogram is an empty svg, not a crash", api.renderHistogram([], {}) === "<svg></svg>");
  ok("an empty line chart is an empty svg", api.renderLineChart([{ name: "e", color: "c", points: [] }], {}) === "<svg></svg>");

  // Forest plot: no rows and nothing to anchor a domain produced Infinity
  // domain bounds and x="NaN" tick labels.
  ok("a forest plot with nothing to anchor it returns an empty svg",
    api.renderForestPlot([], {}) === "<svg></svg>");
  ok("a forest plot with only a reference line still renders cleanly",
    clean(api.renderForestPlot([], { referenceLine: 1 })));

  // A zero-width CI is a legitimate input (a bare point estimate).
  ok("a zero-width interval renders cleanly",
    clean(api.renderForestPlot([{ label: "a", estimate: 1, lower: 1, upper: 1 }], {})));

  // A malformed pooled row (lower > upper) drew a self-intersecting bowtie
  // instead of a diamond. The polygon's first and third points must now be
  // ordered left-to-right.
  const bowtie = api.renderForestPlot([{ label: "s", estimate: 1, lower: 0.8, upper: 1.2 }],
    { pooled: { label: "Pooled", estimate: 1.0, lower: 1.2, upper: 0.8 } });
  ok("a reversed pooled interval still renders cleanly", clean(bowtie));
  {
    const m = bowtie.match(/<polygon points="([\d.]+),[\d.]+ ([\d.]+),[\d.]+ ([\d.]+),/);
    ok("and its diamond is not inverted", !!m && parseFloat(m[1]) <= parseFloat(m[3]));
  }
}
report();

section("R&D cost is never silently dropped or dumped into one year");
{
  const items = [
    { key: "phase2", years: 3.3, riskAdjCostM: 13 },
    { key: "phase3", years: 3.6, riskAdjCostM: 40 },
    { key: "regulatory", years: 1.25, riskAdjCostM: 2.6 }
  ];
  const totalUSD = 55.6e6;
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  // Baseline: a window that matches the real timeline still allocates evenly
  // and loses nothing.
  const normal = api.distributeRnDCostByYear(items, 8);
  near("a matched window distributes the full $55.6M", sum(normal), totalUSD, 1);

  // THE BUG: launchYearOffset 0 on a program that still has remaining R&D
  // returned an empty array, so the whole spend vanished from the calendar.
  const atZero = api.distributeRnDCostByYear(items, 0);
  ok("a launch year of 0 still produces a cost row", atZero.length >= 1);
  near("and the full $55.6M is still accounted for", sum(atZero), totalUSD, 1);

  // A window far shorter than the timeline used to leave ~$47.7M of the
  // $55.6M piled into the single final year by shortfall recovery.
  const squeezed = api.distributeRnDCostByYear(items, 2);
  near("a 2-year window still totals $55.6M", sum(squeezed), totalUSD, 1);
  ok("no single year absorbs almost the entire programme cost",
    Math.max(...squeezed) < totalUSD * 0.85);
  ok("cost is spread across the whole window, not just the last year",
    squeezed[0] > 0 && squeezed[1] > 0);

  // Ordering must survive compression: Phase 3 is the expensive stage and
  // comes second, so the later year should carry more than the first.
  ok("stage ordering survives compression", squeezed[1] > squeezed[0]);

  // Degenerate input must not produce Infinity.
  const zeroSpan = api.distributeRnDCostByYear([{ key: "x", years: 0, riskAdjCostM: 10 }], 3);
  ok("a zero-duration stage does not produce Infinity", zeroSpan.every(v => isFinite(v)));
  near("and its cost is still counted", sum(zeroSpan), 10e6, 1);

  // No items at all is still a no-op of the requested length.
  ok("no R&D items yields an all-zero window", sum(api.distributeRnDCostByYear([], 5)) === 0);
}
report();

section("Partnership royalty applies in Quick mode, not just Full");
{
  // Quick mode puts 100% of revenue in usRevenue and never shows the territory
  // selector, so the default "exUS" applied the royalty to a base of zero and
  // let full commercial revenue through untouched — a 15% deal changed nothing.
  const quickProgram = {
    id: "p1", name: "Test", revenueMode: "quick",
    quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" },
    partnership: { enabled: true, royaltyPct: "15" }   // no territory set, as the UI leaves it
  };
  const partnered = api.getProgramRevenueResult(quickProgram, 25);
  const unpartnered = api.getProgramRevenueResult({ ...quickProgram, partnership: null }, 25);
  ok("a Quick-mode royalty actually changes the revenue line", partnered.peakTotalRevenue !== unpartnered.peakTotalRevenue);
  // 15% of peak, i.e. the royalty the user actually typed.
  near("Quick-mode peak revenue becomes 15% of the unpartnered peak",
    partnered.peakTotalRevenue, Math.round(unpartnered.peakTotalRevenue * 0.15), 2);

  // Full mode must keep honouring an explicit territory choice.
  const fullBase = {
    population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "80",
    marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "20" },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" },
    exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" } };
  const fullProgram = { id: "p2", name: "Full", revenueMode: "full", revenueBuild: fullBase,
    partnership: { enabled: true, royaltyPct: "15", territory: "exUS" } };
  const fullPlain = api.getProgramRevenueResult({ ...fullProgram, partnership: null }, 25);
  const fullExUS = api.getProgramRevenueResult(fullProgram, 25);
  ok("Full mode still leaves US revenue untouched for an ex-US deal",
    fullExUS.years[8].usRevenue === fullPlain.years[8].usRevenue);
  ok("Full mode still royalty-substitutes the ex-US side",
    fullExUS.years[8].exUSRevenue < fullPlain.years[8].exUSRevenue);
}
report();

section("Royalty income carries no COGS or marketing — the partner bears those");
{
  // A licensed-out territory is commercialised by the PARTNER: they
  // manufacture and they sell. The licensor's royalty is close to pure
  // margin, which is the entire economic trade of doing the deal. Charging
  // the licensor's own COGS and marketing against that royalty understated a
  // partnered asset by roughly a third on a typical 15% deal.
  const prog = (partnership) => ({
    id: "p1", name: "Asset", revenueMode: "quick",
    quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" },
    partnership
  });
  const costs = { cogsPct: "15", reps: { primaryCare: 0, specialty: 0, hospital: 0 },
                  marketingPctOfPeak: "20", yearsToLOE: "13", launchYearOffset: 0 };

  const partnered = api.getProgramRevenueResult(prog({ enabled: true, royaltyPct: "15" }), 25);
  const solo = api.getProgramRevenueResult(prog(null), 25);

  // The revenue line itself is the royalty: 15% of the commercial peak.
  near("partnered peak revenue is 15% of the unpartnered peak",
    partnered.peakTotalRevenue, Math.round(solo.peakTotalRevenue * 0.15), 2);
  // And all of it is flagged as royalty rather than own-commercial revenue.
  ok("every dollar of a global royalty deal is tagged as royalty income",
    partnered.years.every(y => y.royaltyRevenue === y.totalRevenue));
  near("peak COMMERCIAL revenue is zero when everything is licensed out",
    partnered.peakCommercialRevenue, 0, 0);

  const pnl = api.computeProgramPnL(partnered, costs);
  const peakRow = pnl.reduce((b, r) => r.revenue > b.revenue ? r : b, pnl[0]);
  near("no COGS is charged against royalty income", peakRow.cogs, 0, 0);
  near("no marketing is charged against royalty income", peakRow.marketing, 0, 0);
  // Product contribution should now equal the royalty itself, not ~65% of it.
  near("product contribution equals the royalty received", peakRow.productContribution, peakRow.revenue, 2);

  // An unpartnered programme must be completely unaffected by any of this.
  const soloPnl = api.computeProgramPnL(solo, costs);
  const soloPeak = soloPnl.reduce((b, r) => r.revenue > b.revenue ? r : b, soloPnl[0]);
  near("an unpartnered programme still pays full COGS", soloPeak.cogs, Math.round(soloPeak.revenue * 0.15), 2);
  ok("an unpartnered programme still pays marketing", soloPeak.marketing > 0);

  // A territory-limited deal must still charge costs on the side the company
  // actually sells itself — this is not a blanket exemption.
  const fullBuild = {
    population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "80",
    marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "20" },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" },
    exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
  };
  const exUSDeal = api.getProgramRevenueResult({
    id: "p2", name: "Split", revenueMode: "full", revenueBuild: fullBuild,
    partnership: { enabled: true, royaltyPct: "15", territory: "exUS" }
  }, 25);
  const splitPnl = api.computeProgramPnL(exUSDeal, costs);
  const splitPeak = splitPnl.reduce((b, r) => r.revenue > b.revenue ? r : b, splitPnl[0]);
  ok("an ex-US-only deal still charges COGS on the retained US business", splitPeak.cogs > 0);
  ok("but less than it would if the whole book were commercial",
    splitPeak.cogs < Math.round(splitPeak.revenue * 0.15));
}
report();

section("Upfront and milestone value survives the Simple Multiple method");
{
  const baseCase = {
    name: "T", currentPrice: "10", discountRatePct: "12",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "0", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{
      id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" },
      launchYearOffset: "8",
      partnership: { enabled: true, upfrontM: "100", milestones: [{ label: "Filing", gate: "regulatory", valueM: "100" }] }
    }]
  };
  const noDeal = JSON.parse(JSON.stringify(baseCase));
  noDeal.programs[0].partnership = { enabled: false };
  const preset = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };

  const withDeal = api.computeSimpleMultipleValuation(baseCase, preset, "base", 3, 12);
  const without = api.computeSimpleMultipleValuation(noDeal, preset, "base", 3, 12);
  ok("Simple Multiple now reports a partnership contribution at all",
    withDeal.equity.partnershipValueAdded > 0);
  // The $100M upfront is added undiscounted and unrisked, so the gap must be
  // at least that much (the milestone adds more on top).
  ok("the contribution is at least the $100M upfront",
    withDeal.equity.equityValue - without.equity.equityValue >= 100000000 - 1);
  ok("and it raises per-share value too",
    withDeal.equity.perShare > without.equity.perShare);

  // The same deal under DCF should land in the same ballpark — the point of
  // the fix is that the two methods stop disagreeing by the whole deal value.
  const dcfWith = api.computeCaseValuation(baseCase, preset, "base", 12, { enabled: false });
  const dcfWithout = api.computeCaseValuation(noDeal, preset, "base", 12, { enabled: false });
  const smGap = withDeal.equity.equityValue - without.equity.equityValue;
  const dcfGap = dcfWith.equity.equityValue - dcfWithout.equity.equityValue;
  near("both valuation methods credit the same deal value", smGap, dcfGap, Math.abs(dcfGap) * 0.001 + 1);
}
report();

section("Sum-of-the-Parts tax-shields G&A like the combined valuation does");
{
  const mk = (taxEnabled) => ({
    name: "T", currentPrice: "10", discountRatePct: "12",
    taxation: { enabled: taxEnabled, ratePct: "21", startingNOLM: "0" },
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "0", debt: "0" },
    corporateGA: { preCommercialAnnualM: "20", gaShareOfMatureSgaPct: "50" },
    programs: [{
      id: "p1", name: "Asset", currentPhase: "phase3", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "1000000000", yearsToPeak: "6", profile: "median" },
      launchYearOffset: "4"
    }]
  });
  const preset = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };

  // With tax OFF the fix must be a no-op — G&A has no shield to apply.
  const offSOTP = api.computeSOTPBreakdown(mk(false), preset, "base", 12, { enabled: false });
  ok("with tax off, G&A is still a straight negative drag", offSOTP.gaDrag < 0);

  // With tax ON, G&A costs the company LESS than its face value, because it
  // reduces taxable income. A raw pre-tax drag would be strictly larger.
  const onSOTP = api.computeSOTPBreakdown(mk(true), preset, "base", 12, { enabled: false });
  ok("with tax on, the after-tax G&A drag is smaller than the pre-tax one",
    Math.abs(onSOTP.gaDrag) < Math.abs(offSOTP.gaDrag));
  ok("the G&A drag is still a real cost, not zeroed out", onSOTP.gaDrag < 0);

  // The whole point: the parts should now reconcile with the combined number.
  const combined = api.computeCaseValuation(mk(true), preset, "base", 12, { enabled: false });
  const gap = Math.abs(onSOTP.sumOfParts - combined.npvResult.npv);
  ok("sum of the parts now lands within 2% of the combined enterprise value",
    gap <= Math.abs(combined.npvResult.npv) * 0.02);
}
report();

section("EDGAR — reporting-period classification (periodMonths)");
{
  near("a standalone quarter (Jan 1 - Mar 31) reads as 3 months", api.periodMonths({ start: "2024-01-01", end: "2024-03-31" }), 3, 0);
  near("a half-year-to-date span (Jan 1 - Jun 30) reads as 6 months", api.periodMonths({ start: "2024-01-01", end: "2024-06-30" }), 6, 0);
  near("a nine-month span (Jan 1 - Sep 30) reads as 9 months", api.periodMonths({ start: "2024-01-01", end: "2024-09-30" }), 9, 0);
  near("a full year (Jan 1 - Dec 31) reads as 12 months", api.periodMonths({ start: "2024-01-01", end: "2024-12-31" }), 12, 0);
  // An instant fact (a balance-sheet item) has no start, and an unrecognised
  // span must return null rather than being silently rounded to something.
  ok("an instant fact (no start date) is not classified", api.periodMonths({ end: "2024-06-30" }) === null);
  ok("a two-month span is not force-fitted to a known period", api.periodMonths({ start: "2024-01-01", end: "2024-03-01" }) === null);
}
report();

section("EDGAR — cash runway picks the standalone quarter, not year-to-date");
{
  // THE BUG: a Q2 10-Q reports OperatingIncomeLoss for BOTH the 3-month and
  // the 6-month period, both ending 6/30. Picking the 6-month figure and
  // dividing by 3 halves the reported runway.
  // Hand-derived: $60M cash, true quarterly burn $12M -> $4M/mo -> 15.0 months.
  const q2Facts = {
    facts: { "us-gaap": {
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [
        { end: "2024-06-30", val: 60000000, form: "10-Q" }
      ] } },
      OperatingIncomeLoss: { units: { USD: [
        // year-to-date row deliberately FIRST, which is what made array order decide
        { start: "2024-01-01", end: "2024-06-30", val: -24000000, form: "10-Q", fp: "Q2" },
        { start: "2024-04-01", end: "2024-06-30", val: -12000000, form: "10-Q", fp: "Q2" }
      ] } }
    } }
  };
  const r = api.calcRunwayFromFacts(q2Facts);
  near("runway uses the 3-month figure: $60M / ($12M/3) = 15.0 months", r.runwayMonths, 15.0, 1e-9);
  near("the span actually used is reported as 3 months", r.burnPeriodMonths, 3, 0);
  near("quarterly burn is normalised to $12M", r.quarterlyBurnUSD, 12000000, 1e-6);

  // Same company, same numbers, rows in the opposite order — the answer must
  // not depend on the order EDGAR happened to return them in.
  const flipped = JSON.parse(JSON.stringify(q2Facts));
  flipped.facts["us-gaap"].OperatingIncomeLoss.units.USD.reverse();
  near("row order does not change the answer", api.calcRunwayFromFacts(flipped).runwayMonths, 15.0, 1e-9);

  // A 10-K filer reporting only a full year is now usable instead of ignored:
  // $60M cash, $48M annual burn -> $4M/mo -> 15.0 months.
  const annualFacts = {
    facts: { "us-gaap": {
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [{ end: "2024-12-31", val: 60000000, form: "10-K" }] } },
      OperatingIncomeLoss: { units: { USD: [
        { start: "2024-01-01", end: "2024-12-31", val: -48000000, form: "10-K", fp: "FY" }
      ] } }
    } }
  };
  const ar = api.calcRunwayFromFacts(annualFacts);
  near("an annual-only filer: $60M / ($48M/12) = 15.0 months", ar.runwayMonths, 15.0, 1e-9);
  near("the span used is reported as 12 months", ar.burnPeriodMonths, 12, 0);
}
report();

section("EDGAR — same-date tranches are summed, restatements are not");
{
  // Two genuinely different tranches on one date (a de-SPAC's public and
  // private warrants) must add up: 5,000,000 + 3,333,333 = 8,333,333.
  const twoTranches = api.sumTranchesAtLatestDate([
    { end: "2024-06-30", val: 5000000, form: "10-Q" },
    { end: "2024-06-30", val: 3333333, form: "10-Q" }
  ]);
  near("two distinct same-date tranches are summed", twoTranches.value, 8333333, 0);
  near("and the tranche count is reported", twoTranches.tranches, 2, 0);

  // The SAME fact restated by an amended filing must NOT be double-counted.
  const restated = api.sumTranchesAtLatestDate([
    { end: "2024-06-30", val: 5000000, form: "10-Q" },
    { end: "2024-06-30", val: 5000000, form: "10-Q" }
  ]);
  near("an identical same-date row is treated as a restatement, not a tranche", restated.value, 5000000, 0);
  near("and reports a single tranche", restated.tranches, 1, 0);

  // An older period must never be mixed into the latest one.
  const older = api.sumTranchesAtLatestDate([
    { end: "2024-06-30", val: 5000000, form: "10-Q" },
    { end: "2023-12-31", val: 9000000, form: "10-K" }
  ]);
  near("a stale earlier period is excluded", older.value, 5000000, 0);

  // End to end through extractWarrants, which is what the app actually calls.
  const warrantFacts = { facts: { "us-gaap": { ClassOfWarrantOrRightOutstanding: { units: { shares: [
    { end: "2024-06-30", val: 5000000, form: "10-Q" },
    { end: "2024-06-30", val: 3333333, form: "10-Q" }
  ] } } } } };
  near("extractWarrants sums both tranches", api.extractWarrants(warrantFacts).count, 8333333, 0);

  // A per-share PRICE must never be summed — two $25 strikes are not a $50 strike.
  const pricedFacts = { facts: { "us-gaap": {
    ClassOfWarrantOrRightOutstanding: { units: { shares: [{ end: "2024-06-30", val: 1000000, form: "10-Q" }] } },
    ClassOfWarrantOrRightExercisePriceOfWarrantsOrRights: { units: { "USD/shares": [
      { end: "2024-06-30", val: 25, form: "10-Q" },
      { end: "2024-06-30", val: 25, form: "10-Q" }
    ] } }
  } } };
  near("an exercise price is read, never summed", api.extractWarrants(pricedFacts).avgStrike, 25, 0);
}
report();

section("EDGAR — convertible notes sum current + noncurrent");
{
  // THE BUG: stopping at the first matching tag reported $15M of a $20M note.
  const split = { facts: { "us-gaap": {
    ConvertibleNotesPayableCurrent: { units: { USD: [{ end: "2024-06-30", val: 5000000, form: "10-Q" }] } },
    ConvertibleNotesPayableNoncurrent: { units: { USD: [{ end: "2024-06-30", val: 15000000, form: "10-Q" }] } }
  } } };
  near("a $5M current + $15M noncurrent note totals $20M", api.extractConvertibleNotes(split).faceValue, 20000000, 0);

  // The ConvertibleDebt* tag family needed a symmetric current/noncurrent pair;
  // a filer reporting only a current balance under it used to fall through.
  const debtFamily = { facts: { "us-gaap": {
    ConvertibleDebtCurrent: { units: { USD: [{ end: "2024-06-30", val: 7000000, form: "10-Q" }] } }
  } } };
  near("a ConvertibleDebtCurrent-only filer is found", api.extractConvertibleNotes(debtFamily).faceValue, 7000000, 0);

  // A filer that reports the combined total AND both parts must not be doubled.
  const both = { facts: { "us-gaap": {
    ConvertibleNotesPayable: { units: { USD: [{ end: "2024-06-30", val: 20000000, form: "10-Q" }] } },
    ConvertibleNotesPayableCurrent: { units: { USD: [{ end: "2024-06-30", val: 5000000, form: "10-Q" }] } },
    ConvertibleNotesPayableNoncurrent: { units: { USD: [{ end: "2024-06-30", val: 15000000, form: "10-Q" }] } }
  } } };
  near("a combined total reported alongside its parts is not double-counted", api.extractConvertibleNotes(both).faceValue, 20000000, 0);

  ok("a company with no convertible notes returns null, not zero", api.extractConvertibleNotes({ facts: { "us-gaap": {} } }) === null);
}
report();

section("EDGAR — shares outstanding prefers a point-in-time count");
{
  // THE BUG: a micro-cap doubles its share count mid-quarter in a raise.
  // The EPS weighted-average (26.5M) is a period AVERAGE; the real count as of
  // the period end is 40M. Ranking the average first understated it by 34%.
  const postRaise = { facts: { "us-gaap": {
    WeightedAverageNumberOfShareOutstandingBasicAndDiluted: { units: { shares: [
      { end: "2024-06-30", val: 26500000, form: "10-Q" }
    ] } },
    CommonStockSharesIssued: { units: { shares: [
      { end: "2024-06-30", val: 40000000, form: "10-Q" }
    ] } }
  } } };
  const s = api.extractSharesOutstanding(postRaise);
  near("the point-in-time count wins over the period average", s.shares, 40000000, 0);
  ok("and it is not flagged as a period average", s.periodAverage === false);

  // With only an average available it is still used — but flagged, so a caller
  // can say so rather than presenting it as a hard count.
  const avgOnly = { facts: { "us-gaap": {
    WeightedAverageNumberOfShareOutstandingBasicAndDiluted: { units: { shares: [
      { end: "2024-06-30", val: 26500000, form: "10-Q" }
    ] } }
  } } };
  const a = api.extractSharesOutstanding(avgOnly);
  near("a period average is still used as a last resort", a.shares, 26500000, 0);
  ok("but it is flagged as a period average", a.periodAverage === true);

  // The cover-page dei tag outranks everything.
  const withDei = { facts: {
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: "2024-08-01", val: 41000000, form: "10-Q" }] } } },
    "us-gaap": { CommonStockSharesIssued: { units: { shares: [{ end: "2024-06-30", val: 40000000, form: "10-Q" }] } } }
  } };
  near("the cover-page count outranks the balance-sheet one", api.extractSharesOutstanding(withDei).shares, 41000000, 0);

  // A dollar figure must never be returned as a share count.
  const usdOnly = { facts: { "us-gaap": {
    CommonStockSharesOutstanding: { units: { USD: [{ end: "2024-06-30", val: 12345678, form: "10-Q" }] } }
  } } };
  ok("a USD-only fact is never read as a share count", api.extractSharesOutstanding(usdOnly) === null);
}
report();

section("EDGAR — missing data degrades cleanly instead of throwing");
{
  // A smaller or foreign private issuer may report none of this. Every
  // extractor must return null rather than taking down the whole EDGAR pull.
  const empty = { facts: { "us-gaap": {} } };
  ok("extractOptions returns null", api.extractOptions(empty) === null);
  ok("extractWarrants returns null", api.extractWarrants(empty) === null);
  ok("extractConvertibleNotes returns null", api.extractConvertibleNotes(empty) === null);
  ok("extractSharesOutstanding returns null", api.extractSharesOutstanding(empty) === null);
  ok("extractDilutedShares returns null", api.extractDilutedShares(empty) === null);
  ok("extractDebt returns null", api.extractDebt({}) === null);
  ok("calcRunwayFromFacts returns null", api.calcRunwayFromFacts(empty) === null);
  ok("calcRunwayFromFacts survives a malformed response", api.calcRunwayFromFacts(null) === null);
}
report();

section("Treasury method rejects a negative strike");
{
  // 1,000,000 options at a $10 strike and a $40 price: net new shares
  // = n(p-k)/p = 1,000,000 x 30/40 = 750,000.
  near("a normal in-the-money grant dilutes by 750,000", api.treasuryMethodShares(1000000, 10, 40), 750000, 1e-9);
  // A negative strike inverted the arithmetic and returned 1,250,000 — more
  // net new shares than the pool even contains, which is impossible.
  const neg = api.treasuryMethodShares(1000000, -10, 40);
  ok("a negative strike never dilutes beyond the pool size", neg <= 1000000);
  near("a negative strike is treated as zero exercise proceeds", neg, 1000000, 1e-9);
  near("a zero strike gives full dilution", api.treasuryMethodShares(1000000, 0, 40), 1000000, 1e-9);
  near("an at-the-money grant dilutes by nothing", api.treasuryMethodShares(1000000, 40, 40), 0, 0);
}
report();

section("PK/PD half-life formats a zero elimination rate");
{
  near("a 6-hour half-life comes from Ke = ln(2)/6", api.halfLife(Math.log(2) / 6), 6, 1e-9);
  ok("a normal half-life prints with units", api.formatHalfLife(Math.log(2) / 6) === "6.00hr");
  // Ke = 0 is a legitimate input; ln(2)/0 = Infinity is correct maths, but
  // "Infinityhr" is not a readable answer.
  ok("Ke = 0 does not print 'Infinityhr'", api.formatHalfLife(0).indexOf("Infinity") === -1);
  ok("Ke = 0 says what actually happened", api.formatHalfLife(0) === "none (Ke = 0, no elimination modelled)");
}
report();

// ════════════════════════════════════════════════════════════════════════════
// TRIAL RESULTS READER
// Fixtures are shaped exactly like the live CT.gov v2 responses these were
// written against (NCT02578680 and a 60-study multiple-sclerosis sweep):
// numSubjects/value/numAffected are STRINGS, milestone types are free text
// apart from the three standard ones, and event groups can include crossover
// cohorts that are not the randomised arms. Every expected number below is
// worked out longhand in the comment above it.
// ════════════════════════════════════════════════════════════════════════════
section("Trial results — participant flow, with death separated from dropout");
{
  // 200 started / 140 completed / 60 did not, of which 30 were deaths,
  // 20 adverse events, 10 lost to follow-up.
  //   completion            140/200 = 0.70
  //   discontinuation        60/200 = 0.30
  //   non-death dropout  (60-30)/200 = 0.15
  //   AE withdrawal          20/200 = 0.10
  // Control: 100 / 90 / 10, of which 5 deaths, 2 AEs, 3 lost.
  //   completion             90/100 = 0.90
  //   discontinuation        10/100 = 0.10
  //   non-death dropout   (10-5)/100 = 0.05
  //   AE withdrawal           2/100 = 0.02
  const flowSection = {
    participantFlowModule: {
      groups: [{ id: "FG000", title: "Drug" }, { id: "FG001", title: "Placebo" }],
      periods: [{
        title: "Overall Study",
        milestones: [
          { type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "200" }, { groupId: "FG001", numSubjects: "100" }] },
          { type: "COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "140" }, { groupId: "FG001", numSubjects: "90" }] },
          { type: "NOT COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "60" }, { groupId: "FG001", numSubjects: "10" }] },
          // Free-text bookkeeping milestone — must be ignored, not mistaken
          // for a completion step.
          { type: "Safety Population", achievements: [{ groupId: "FG000", numSubjects: "198" }] }
        ],
        dropWithdraws: [
          { type: "Death", reasons: [{ groupId: "FG000", numSubjects: "30" }, { groupId: "FG001", numSubjects: "5" }] },
          { type: "Adverse Event", reasons: [{ groupId: "FG000", numSubjects: "20" }, { groupId: "FG001", numSubjects: "2" }] },
          { type: "Lost to Follow-up", reasons: [{ groupId: "FG000", numSubjects: "10" }, { groupId: "FG001", numSubjects: "3" }] }
        ]
      }]
    }
  };
  const flow = api.summarizeParticipantFlow(flowSection);
  const drug = flow.primaryPeriod.rows[0], pbo = flow.primaryPeriod.rows[1];
  near("completion rate is completed/started", drug.completionRate, 0.70, 1e-12);
  near("raw discontinuation is notCompleted/started", drug.discontinuationRate, 0.30, 1e-12);
  near("non-death dropout removes the 30 deaths", drug.nonDeathDiscontinuationRate, 0.15, 1e-12);
  near("AE withdrawal rate is 20/200", drug.aeWithdrawalRate, 0.10, 1e-12);
  near("control non-death dropout is (10-5)/100", pbo.nonDeathDiscontinuationRate, 0.05, 1e-12);
  ok("string numSubjects parse to numbers", drug.started === 200 && pbo.started === 100);
  ok("a non-standard milestone is not read as completion", drug.completed === 140);
  ok("deaths are bucketed separately from other reasons", drug.deaths === 30 && drug.withdrewForAE === 20 && drug.lostToFollowUp === 10);
  // KEYNOTE-189 registers Death, Lost to Follow-up, Physician Decision, Protocol
  // Violation, Sponsor Decision and Withdrawal by Subject — and no Adverse Event
  // row at all. Printing 0.0% there turns a gap in the record into a clean
  // tolerability result.
  const noAeRow = api.summarizeParticipantFlow({ participantFlowModule: {
    groups: [{ id: "FG000", title: "Drug" }],
    periods: [{ title: "Overall Study", milestones: [
      { type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "410" }] },
      { type: "NOT COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "410" }] }
    ], dropWithdraws: [{ type: "Death", reasons: [{ groupId: "FG000", numSubjects: "329" }] }] }]
  } });
  ok("a reason the sponsor never registered reads as unknown, not as zero",
    noAeRow.primaryPeriod.rows[0].withdrewForAE === null && noAeRow.primaryPeriod.rows[0].aeWithdrawalRate === null);
  ok("a reason the sponsor did register still reports its count", noAeRow.primaryPeriod.rows[0].deaths === 329);

  // NOT COMPLETED is sometimes not registered. 200 started, 150 completed
  // leaves 50, which is arithmetic on the sponsor's own two numbers.
  const derived = api.summarizeParticipantFlow({ participantFlowModule: {
    groups: [{ id: "FG000", title: "Only arm" }],
    periods: [{ title: "Overall Study", milestones: [
      { type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "200" }] },
      { type: "COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "150" }] }
    ] }]
  } });
  near("missing NOT COMPLETED is derived as started - completed", derived.primaryPeriod.rows[0].notCompleted, 50, 0);

  // Multi-period records: the flagged period is the one most people were in,
  // not whichever came first. Run-in 40, randomised 300.
  const multi = api.summarizeParticipantFlow({ participantFlowModule: {
    groups: [{ id: "FG000", title: "A" }],
    periods: [
      { title: "Run-in", milestones: [{ type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "40" }] }] },
      { title: "Randomised phase", milestones: [{ type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "300" }] }] }
    ]
  } });
  ok("the primary period is the largest, not the first", multi.primaryPeriod.title === "Randomised phase");
  ok("multi-period records are marked as such", multi.multiPeriod === true);

  // Real record, NCT04368728: 22,071 started the blinded period, 21 are marked
  // completed, and ~22,000 "did not complete" because they moved into the
  // open-label period. Counting that as dropout produced a 99.8% attrition
  // flag on a trial whose real dropout was about 2%.
  const extension = api.summarizeParticipantFlow({ participantFlowModule: {
    groups: [{ id: "FG000", title: "Vaccine" }, { id: "FG001", title: "Placebo" }],
    periods: [{ title: "Blinded Period", milestones: [
      { type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "1000" }, { groupId: "FG001", numSubjects: "1000" }] },
      { type: "COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "10" }, { groupId: "FG001", numSubjects: "10" }] },
      { type: "NOT COMPLETED", achievements: [{ groupId: "FG000", numSubjects: "990" }, { groupId: "FG001", numSubjects: "990" }] }
    ], dropWithdraws: [
      { type: "Participants entered open label period", reasons: [{ groupId: "FG000", numSubjects: "950" }, { groupId: "FG001", numSubjects: "950" }] },
      { type: "Death", reasons: [{ groupId: "FG000", numSubjects: "10" }, { groupId: "FG001", numSubjects: "10" }] },
      { type: "Withdrawal by Subject", reasons: [{ groupId: "FG000", numSubjects: "30" }, { groupId: "FG001", numSubjects: "30" }] }
    ] }]
  } });
  const extRow = extension.primaryPeriod.rows[0];
  near("entering an open-label extension is not dropout", extRow.transitioned, 950, 0);
  // (990 not completed - 10 deaths - 950 transitions) / 1000 = 30/1000 = 0.03
  near("real dropout is what is left after deaths and transitions", extRow.nonDeathDiscontinuationRate, 0.03, 1e-12);
  ok("a 99% 'not completed' period does not trip high attrition when it is a protocol transition",
    !api.resultsRedFlags({ outcomes: [], flow: extension, safety: null }, null)
      .some(f => f.label.indexOf("High overall attrition") !== -1));

  // A multi-period record registers one group list spanning every period, so
  // groups belonging to another period appear here with nothing in them.
  const spanning = api.summarizeParticipantFlow({ participantFlowModule: {
    groups: [{ id: "FG000", title: "Phase 1 cohort" }, { id: "FG001", title: "Phase 3 drug" }, { id: "FG002", title: "Phase 3 placebo" }],
    periods: [{ title: "Phase 3", milestones: [
      { type: "STARTED", achievements: [{ groupId: "FG000", numSubjects: "0" }, { groupId: "FG001", numSubjects: "500" }, { groupId: "FG002", numSubjects: "500" }] }
    ] }]
  } });
  ok("groups that are not part of a period are dropped from its table", spanning.primaryPeriod.rows.length === 2);
  near("and counted so the omission is visible", spanning.primaryPeriod.groupsNotInPeriod, 1, 0);

  // ── The flags that come out of this flow ──
  const flags = api.resultsRedFlags({ outcomes: [], flow, safety: null }, null);
  const spread = flags.find(f => f.label.indexOf("Differential dropout") !== -1);
  ok("a 0.15 vs 0.05 non-death gap trips differential dropout at the 10pt threshold", !!spread);
  ok("the differential-dropout flag is high severity", spread && spread.severity === "high");
  ok("a 10% vs 2% AE-withdrawal gap trips its own flag",
    flags.some(f => f.label.indexOf("adverse events differ by arm") !== -1));
  // The whole point of separating death: 30% of the drug arm did not complete,
  // but only 15% left for a reason other than dying, so the 20% high-attrition
  // flag must NOT fire.
  ok("30% not-completed does not trip high attrition when half of it is deaths",
    !flags.some(f => f.label.indexOf("High overall attrition") !== -1));
}
report();

section("Trial results — outcome measures and registered analyses");
{
  const mk = (analyses, classes) => ({ outcomeMeasuresModule: { outcomeMeasures: [{
    type: "PRIMARY", title: "Progression-free survival", reportingStatus: "POSTED",
    paramType: "MEDIAN", dispersionType: "95% Confidence Interval", unitOfMeasure: "Months",
    groups: [{ id: "OG000", title: "Drug" }, { id: "OG001", title: "Control" }],
    denoms: [{ units: "Participants", counts: [{ groupId: "OG000", value: "410" }, { groupId: "OG001", value: "206" }] },
             { units: "Events", counts: [{ groupId: "OG000", value: "9999" }] }],
    classes: classes, analyses: analyses
  }] } });
  const simpleClasses = [{ categories: [{ measurements: [
    { groupId: "OG000", value: "8.8", lowerLimit: "7.6", upperLimit: "9.2" },
    { groupId: "OG001", value: "4.9", lowerLimit: "4.7", upperLimit: "5.5" }
  ] }] }];

  // HR 0.52, 95% CI 0.43–0.64. The null for a ratio is 1, which is outside
  // [0.43, 0.64], so the interval excludes no-effect.
  const win = api.parseResultOutcomes(mk([{ groupIds: ["OG000", "OG001"], paramType: "Hazard Ratio (HR)",
    paramValue: "0.52", ciPctValue: "95", ciLowerLimit: "0.43", ciUpperLimit: "0.64", pValue: "<0.00001",
    statisticalMethod: "Log Rank", nonInferiorityType: "SUPERIORITY",
    estimateComment: "PD-L1 status (\\<1%) \\& smoking" }], simpleClasses))[0];
  ok("a single class with a single category reads as a plain per-arm result", win.layout === "simple");
  near("the drug arm's point estimate is read", win.arms[0].value, 8.8, 1e-12);
  near("its interval is read", win.arms[0].lower, 7.6, 1e-12);
  near("the arm n comes from the participants denominator, not the events one", win.arms[0].n, 410, 0);
  near("the hazard ratio is parsed from its string", win.analyses[0].value, 0.52, 1e-12);
  ok("a ratio scale is recognised with a null of 1", win.analyses[0].scale === "ratio" && win.analyses[0].nullValue === 1);
  ok("0.43-0.64 excludes 1, so the interval does not cross the null", win.analyses[0].crossesNull === false);
  ok("the p-value stays a string so '<0.00001' survives", win.analyses[0].pValue === "<0.00001");
  // DAPA-HF registers its primary hazard ratio against groupIds ["OG001"] --
  // ONE arm, for a two-arm comparison. The engine passes the list through
  // untouched rather than inventing the missing side; the UI is what has to
  // refuse to print a bare arm title where "A vs B" belongs.
  const oneSided = api.parseResultOutcomes(mk([{ groupIds: ["OG001"], paramType: "Hazard Ratio (HR)",
    paramValue: "0.74", ciLowerLimit: "0.65", ciUpperLimit: "0.85" }], simpleClasses))[0];
  ok("an analysis naming one arm keeps exactly that one arm", oneSided.analyses[0].groupIds.length === 1);
  ok("and an analysis naming none reports none, rather than defaulting to all",
    api.parseResultOutcomes(mk([{ paramType: "Hazard Ratio (HR)", paramValue: "0.74" }], simpleClasses))[0].analyses[0].groupIds.length === 0);
  ok("CT.gov's backslash escapes are removed from free text", win.analyses[0].comment.indexOf("\\") === -1);
  ok("the measure's own paramType is prettified, not shown as MEDIAN", win.estimateType === "Median");

  // HR 0.90, 95% CI 0.75–1.08. 1 lies inside the interval.
  const miss = api.parseResultOutcomes(mk([{ groupIds: ["OG000", "OG001"], paramType: "Hazard Ratio (HR)",
    paramValue: "0.90", ciPctValue: "95", ciLowerLimit: "0.75", ciUpperLimit: "1.08" }], simpleClasses))[0];
  ok("0.75-1.08 contains 1, so the interval crosses the null", miss.analyses[0].crossesNull === true);
  const missFlags = api.resultsRedFlags({ outcomes: [miss], flow: null, safety: null }, null);
  ok("an interval spanning no-effect is flagged high", missFlags.some(f => f.label === "Primary interval includes no effect" && f.severity === "high"));

  // A four-category measure must not collapse to its first category.
  const cats = api.parseResultOutcomes(mk([], [{ categories: [
    { title: "Grade 1", measurements: [{ groupId: "OG000", value: "10" }] },
    { title: "Grade 2", measurements: [{ groupId: "OG000", value: "20" }] },
    { title: "Grade 3", measurements: [{ groupId: "OG000", value: "5" }] },
    { title: "Grade 4", measurements: [{ groupId: "OG000", value: "1" }] }
  ] }]))[0];
  ok("a multi-category measure is reported as categories, not one headline", cats.layout === "categories" && cats.arms === null);
  ok("all four categories survive", cats.categoryRows.length === 4 && cats.categoryRows[2].title === "Grade 3");

  // Several strata — no single number is claimed at all.
  const strat = api.parseResultOutcomes(mk([], [
    { title: "PD-L1 >= 50%", categories: [{ measurements: [{ groupId: "OG000", value: "1" }] }] },
    { title: "PD-L1 1-49%", categories: [{ measurements: [{ groupId: "OG000", value: "2" }] }] },
    { title: "PD-L1 < 1%", categories: [{ measurements: [{ groupId: "OG000", value: "3" }] }] }
  ]))[0];
  ok("a stratified measure claims no headline value", strat.layout === "stratified" && strat.arms === null && strat.classCount === 3);

  // A registered-but-unreported primary is a gap in the record, not a null result.
  const deferred = api.parseResultOutcomes({ outcomeMeasuresModule: { outcomeMeasures: [
    { type: "PRIMARY", title: "Overall survival", reportingStatus: "NOT_POSTED", groups: [], denoms: [], classes: [], analyses: [] }
  ] } })[0];
  ok("NOT_POSTED is carried through as not posted", deferred.posted === false);
  ok("an unreported primary is flagged high",
    api.resultsRedFlags({ outcomes: [deferred], flow: null, safety: null }, null)
      .some(f => f.label.indexOf("registered but not posted") !== -1 && f.severity === "high"));

  // Per-arm numbers with no comparison registered.
  ok("a primary with no registered analysis is flagged",
    api.resultsRedFlags({ outcomes: [api.parseResultOutcomes(mk([], simpleClasses))[0]], flow: null, safety: null }, null)
      .some(f => f.label.indexOf("No between-group analysis") !== -1));

  // Non-inferiority read as superiority is the classic over-read.
  const ni = api.parseResultOutcomes(mk([{ groupIds: ["OG000", "OG001"], paramType: "Hazard Ratio (HR)",
    paramValue: "0.95", ciLowerLimit: "0.80", ciUpperLimit: "1.12", nonInferiorityType: "NON_INFERIORITY" }], simpleClasses))[0];
  ok("a non-inferiority comparison is called out as not superiority",
    api.resultsRedFlags({ outcomes: [ni], flow: null, safety: null }, null)
      .some(f => f.label.indexOf("not superiority") !== -1));

  // A master protocol registers the same analysis across dozens of sub-studies.
  // Sixty copies of one sentence is not sixty findings.
  ok("an identical flag raised by many endpoints is stated once",
    api.resultsRedFlags({ outcomes: [ni, ni, ni, ni], flow: null, safety: null }, null)
      .filter(f => f.label.indexOf("not superiority") !== -1).length === 1);
}
report();

section("Trial results — adverse events");
{
  // Two arms. Serious: 60/200 = 0.30 vs 20/100 = 0.20, a 10pt gap.
  // Deaths:  40/200 = 0.20 vs 10/100 = 0.10, a 10pt gap.
  // Neutropenia: 40/200 = 0.20 vs 5/100 = 0.05 -> pair difference +0.15.
  // Nausea:      10/200 = 0.05 vs 12/100 = 0.12 -> pair difference -0.07.
  const aeSection = { adverseEventsModule: {
    frequencyThreshold: 5, timeFrame: "Up to 24 months",
    eventGroups: [
      { id: "EG000", title: "Drug", seriousNumAffected: 60, seriousNumAtRisk: 200, otherNumAffected: 190, otherNumAtRisk: 200, deathsNumAffected: 40, deathsNumAtRisk: 200 },
      { id: "EG001", title: "Placebo", seriousNumAffected: 20, seriousNumAtRisk: 100, otherNumAffected: 80, otherNumAtRisk: 100, deathsNumAffected: 10, deathsNumAtRisk: 100 }
    ],
    seriousEvents: [
      { term: "Neutropenia", organSystem: "Blood", stats: [
        { groupId: "EG000", numEvents: 90, numAffected: 40, numAtRisk: 200 },
        { groupId: "EG001", numEvents: 6, numAffected: 5, numAtRisk: 100 }] },
      { term: "Nausea", organSystem: "GI", stats: [
        { groupId: "EG000", numEvents: 10, numAffected: 10, numAtRisk: 200 },
        { groupId: "EG001", numEvents: 12, numAffected: 12, numAtRisk: 100 }] }
    ],
    otherEvents: []
  } };
  const ae = api.summarizeAdverseEvents(aeSection);
  near("serious AE rate is affected/at-risk", ae.groups[0].serious.rate, 0.30, 1e-12);
  near("the control serious rate is 20/100", ae.groups[1].serious.rate, 0.20, 1e-12);
  near("death rate is 40/200", ae.groups[0].deaths.rate, 0.20, 1e-12);
  const neut = ae.seriousEvents[0];
  // 90 episodes across 40 people: a rate built from numEvents would be 0.45.
  near("an event rate counts people, not episodes", neut.byGroup.EG000.rate, 0.20, 1e-12);
  near("the pair difference is drug minus control", neut.pairDiff, 0.15, 1e-12);
  near("a difference favouring the control arm comes out negative", ae.seriousEvents[1].pairDiff, -0.07, 1e-12);
  ok("the biggest gap is ranked by absolute difference", ae.biggestSeriousGaps[0].term === "Neutropenia");
  ok("two event groups are comparable", ae.comparable === true);
  near("the frequency threshold is kept so the 'other events' list is not read as complete", ae.frequencyThreshold, 5, 0);

  const aeFlags = api.resultsRedFlags({ outcomes: [], flow: null, safety: ae }, null);
  ok("a 10pt serious-AE gap is flagged", aeFlags.some(f => f.label.indexOf("Serious adverse events differ") !== -1));
  ok("a death-rate gap is flagged", aeFlags.some(f => f.label.indexOf("All-cause deaths differ") !== -1));

  // Five event groups (crossover + extension cohorts, as in KEYNOTE-189) is
  // not a two-arm comparison and must not be presented as one.
  const many = api.summarizeAdverseEvents({ adverseEventsModule: {
    eventGroups: [0, 1, 2, 3, 4].map(i => ({ id: "EG00" + i, title: "Cohort " + i, seriousNumAffected: 10 * (i + 1), seriousNumAtRisk: 100 })),
    seriousEvents: [{ term: "Anaemia", stats: [{ groupId: "EG000", numAffected: 50, numAtRisk: 100 }, { groupId: "EG001", numAffected: 1, numAtRisk: 100 }] }]
  } });
  ok("five event groups are not treated as comparable", many.comparable === false);
  // KEYNOTE-189 again: three of its five event groups are crossover and
  // re-treatment cohorts, one with nine patients. Ranking across all five put a
  // 2-of-9 event at the top of a table whose every visible column read 0.0%.
  const lopsided = api.summarizeAdverseEvents({ adverseEventsModule: {
    eventGroups: [
      { id: "EG000", title: "Drug", seriousNumAffected: 200, seriousNumAtRisk: 405 },
      { id: "EG001", title: "Control", seriousNumAffected: 100, seriousNumAtRisk: 202 },
      { id: "EG002", title: "Second course", seriousNumAffected: 2, seriousNumAtRisk: 9 }
    ],
    seriousEvents: [
      { term: "Rare thing in a tiny cohort", stats: [
        { groupId: "EG000", numAffected: 0, numAtRisk: 405 },
        { groupId: "EG001", numAffected: 0, numAtRisk: 202 },
        { groupId: "EG002", numAffected: 2, numAtRisk: 9 }] },
      { term: "Pneumonia", stats: [
        { groupId: "EG000", numAffected: 40, numAtRisk: 405 },
        { groupId: "EG001", numAffected: 10, numAtRisk: 202 }] }
    ]
  } });
  ok("the two largest safety populations are the ones shown", lopsided.primaryGroups.length === 2
    && lopsided.primaryGroups[0].id === "EG000" && lopsided.primaryGroups[1].id === "EG001");
  // 2/9 = 22.2% is the highest rate anywhere, but it is invisible in the table,
  // so it must not outrank 40/405 = 9.9% in the arms actually shown.
  ok("a tiny unshown cohort does not decide the top row", lopsided.topSerious[0].term === "Pneumonia");
  near("and the ranking rate comes from the shown groups", lopsided.topSerious[0].maxRate, 40 / 405, 1e-12);
  ok("no pair difference is computed when there are not exactly two groups", many.seriousEvents[0].pairDiff === null);
  ok("and no two-arm safety flag is produced",
    api.resultsRedFlags({ outcomes: [], flow: null, safety: many }, null).length === 0);
}
report();

section("Trial results — parsing primitives and reporting delay");
{
  near("a thousands separator parses", api.trNum("1,234"), 1234, 0);
  ok("an empty string is null, never zero", api.trNum("") === null);
  ok("a non-numeric value is null, never zero", api.trNum("NA") === null);
  ok("a zero denominator gives null rather than Infinity", api.trRate(5, 0) === null);
  ok("CT.gov's escaped less-than is unescaped", api.trUnescape("PD-L1 \\<1%") === "PD-L1 <1%");
  // 2023-06 to 2025-01 is (2025-2023)*12 + (0-5) = 24 - 5 = 19 months.
  near("a YYYY-MM gap is counted in whole months", api.trMonthsBetweenDates("2023-06", "2025-01"), 19, 0);
  ok("a missing date gives null", api.trMonthsBetweenDates(null, "2025-01") === null);
  ok("19 months from primary completion to posting is flagged",
    api.resultsRedFlags({ outcomes: [], flow: null, safety: null },
      { primaryCompletionDate: "2023-06", resultsFirstPostDate: "2025-01" })
      .some(f => f.label.indexOf("months after primary completion") !== -1));
  ok("a study with no results section parses to null", api.parseTrialResults({ protocolSection: {} }) === null);
  ok("a null study does not throw", api.parseTrialResults(null) === null);
}
report();

section("Gross-to-net — an entered price converted to the one the model uses");
{
  // Table 4-1 states ASP as a percentage of each basis directly. These are the
  // source's own figures, not derived ratios, and nothing here may "correct" them.
  near("ASP is 74% of AWP", api.aspPctOfBasis("AWP"), 74, 0);
  near("ASP is 88% of WAC", api.aspPctOfBasis("WAC"), 88, 0);
  near("ASP is 79% of retail", api.aspPctOfBasis("Retail"), 79, 0);
  near("ASP against itself is 100%", api.aspPctOfBasis("ASP"), 100, 0);
  near("an unrecognised basis applies no adjustment", api.aspPctOfBasis("nonsense"), 100, 0);
  ok("AWP and ASP take 'an', WAC and Retail take 'a'",
    api.priceBasisArticle("AWP") === "an" && api.priceBasisArticle("ASP") === "an"
    && api.priceBasisArticle("WAC") === "a" && api.priceBasisArticle("Retail") === "a");
  ok("every offered basis has a conversion figure behind it",
    api.PRICE_BASIS_OPTIONS.every(o => api.aspPctOfBasis(o.value) > 0 && api.aspPctOfBasis(o.value) <= 100));

  // $200,000 entered on an AWP basis -> 200,000 x 0.74 = $148,000 net.
  const awp = api.resolveNetPrice({ usAnnualPrice: "200000", priceBasis: "AWP" });
  near("an AWP price converts to 74% of itself", awp.netPrice, 148000, 1e-9);
  near("and reports the deduction as 26% gross-to-net", awp.grossToNetPct, 26, 1e-12);
  ok("the conversion is marked as coming from the benchmark", awp.fromOverride === false && awp.adjusted === true);

  // An explicit realisation always wins over the table. 55% realisation is a
  // 45% gross-to-net, which is ordinary for a modern US specialty brand and
  // nothing like Table 4-1's all-drugs average.
  const own = api.resolveNetPrice({ usAnnualPrice: "200000", priceBasis: "WAC", netPriceRealizationPct: "55" });
  near("an explicit realisation overrides the table", own.netPrice, 110000, 1e-9);
  near("and its complement is the gross-to-net", own.grossToNetPct, 45, 1e-12);
  ok("the override is marked as the user's own", own.fromOverride === true);
  // 0% realisation is a legitimate (if extreme) input and must not be read as
  // "blank, fall back to the benchmark".
  near("a zero realisation is honoured, not treated as missing",
    api.resolveNetPrice({ usAnnualPrice: "200000", priceBasis: "AWP", netPriceRealizationPct: "0" }).netPrice, 0, 0);

  // ── Backward compatibility. This is the whole reason the default is ASP with
  // no adjustment: a case saved before any of this existed must value the same.
  const legacyPricing = { usAnnualPrice: "200000", usAnnualGrowthPct: "3", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" };
  const legacy = api.resolveNetPrice(legacyPricing);
  near("a price saved before the basis field existed is used unchanged", legacy.netPrice, 200000, 0);
  ok("and is reported as unadjusted", legacy.adjusted === false && legacy.basis === "ASP");
  const backfilled = api.getRevenueBuild({ revenueBuild: { pricing: legacyPricing } });
  ok("the normalizer backfills the basis without touching what was saved",
    backfilled.pricing.priceBasis === "ASP" && backfilled.pricing.netPriceRealizationPct === ""
    && backfilled.pricing.usAnnualPrice === "200000" && backfilled.pricing.exUSPriceFactorPct === "50");

  // ── End to end through the revenue build ──
  // 100,000 prevalent, all diagnosed/treated/eligible, 100% adherence, a 10%
  // peak share override -> 10,000 patients at peak.
  //   ASP basis:  10,000 x 200,000           = $2.000B US at peak
  //   AWP basis:  10,000 x 200,000 x 0.74    = $1.480B US at peak
  //   ex-US:      10,000 x 200,000 x 0.50    = $1.000B, off the ENTERED price
  //               in both cases, because Table 4-2's country factors compare
  //               list prices and discounting twice would be wrong.
  const build = (pricing) => api.computeProgramRevenue({
    population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "100",
    marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "10" },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: pricing,
    exclusivity: { yearsToLOE: "30", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
  }, 20);
  const base = { usAnnualPrice: "200000", usAnnualGrowthPct: "0", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" };
  const asp = build(Object.assign({}, base, { priceBasis: "ASP" }));
  const awpBuild = build(Object.assign({}, base, { priceBasis: "AWP" }));
  near("10,000 patients at peak", asp.peakPatients, 10000, 0);
  near("an ASP basis prices peak US revenue at 10,000 x $200k", asp.peakUSRevenue, 2.0e9, 1);
  near("an AWP basis nets it down to 10,000 x $148k", awpBuild.peakUSRevenue, 1.48e9, 1);
  // The whole point of the feature, stated as a ratio: entering a list price
  // where a net one belongs overstates US revenue by 1/0.74 = 35.1%.
  near("the overstatement from entering AWP as if it were ASP is 1/0.74",
    asp.peakUSRevenue / awpBuild.peakUSRevenue, 1 / 0.74, 1e-6);
  near("ex-US prices off the entered figure, not the netted one",
    Math.max.apply(null, awpBuild.years.map(y => y.exUSRevenue)), 1.0e9, 1);
  ok("ex-US is identical either way, so nothing is discounted twice",
    Math.max.apply(null, asp.years.map(y => y.exUSRevenue)) === Math.max.apply(null, awpBuild.years.map(y => y.exUSRevenue)));
  ok("the result carries the conversion so the UI can explain it",
    awpBuild.pricing.basis === "AWP" && awpBuild.pricing.netPrice === 148000);
  // A case with no basis field at all values exactly as it did before.
  near("a legacy pricing object still produces the unadjusted $2.0B",
    build(base).peakUSRevenue, 2.0e9, 1);
}
report();

section("Trial Watch — a protocol amendment is not the same event as a status flip");
{
  // A complete baseline, so nothing is skipped for being absent.
  const base = {
    status: "RECRUITING", phase: "PHASE3", enrollment: 500,
    primaryCompletionDate: "2027-06", completionDate: "2028-01",
    allocation: "RANDOMIZED", masking: "DOUBLE", armCount: 2,
    armLabels: ["Drug", "Placebo"], whyStopped: null,
    primaryOutcomes: ["Overall survival"],
    secondaryOutcomes: [{ measure: "ORR", timeFrame: "24 wk" }],
    eligibilityCriteria: "Adults with confirmed disease."
  };
  const after = (over) => api.diffTrialSnapshots(base, Object.assign({}, base, over));
  const sevOf = (changes, field) => { const c = changes.find(x => x.field === field); return c && c.severity; };

  ok("replacing the primary endpoint is high", sevOf(after({ primaryOutcomes: ["Progression-free survival"] }), "primaryOutcomes") === "high");
  ok("losing the blind is high", sevOf(after({ masking: "NONE" }), "masking") === "high");
  ok("tightening the blind is not", sevOf(after({ masking: "QUADRUPLE" }), "masking") === "medium");
  ok("changing the randomisation is high", sevOf(after({ allocation: "NON_RANDOMIZED" }), "allocation") === "high");
  ok("a trial being terminated is high", sevOf(after({ status: "TERMINATED" }), "status") === "high");
  ok("a reason for stopping appearing is high", sevOf(after({ whyStopped: "Slow accrual" }), "whyStopped") === "high");
  // 500 -> 380 is a 24% cut, past the one-fifth line; 500 -> 450 is 10% and is not.
  ok("cutting enrolment by a quarter is high", sevOf(after({ enrollment: 380 }), "enrollment") === "high");
  ok("trimming it by a tenth is not", sevOf(after({ enrollment: 450 }), "enrollment") === "medium");
  ok("expanding enrolment is not high", sevOf(after({ enrollment: 900 }), "enrollment") === "medium");
  ok("recruiting to active-not-recruiting is routine", sevOf(after({ status: "ACTIVE_NOT_RECRUITING" }), "status") === "routine");
  ok("a completion-date shift is routine", sevOf(after({ completionDate: "2029-01" }), "completionDate") === "routine");
  ok("a secondary endpoint moving is routine", sevOf(after({ secondaryOutcomes: [{ measure: "DoR", timeFrame: "24 wk" }] }), "secondaryOutcomes") === "routine");

  // Ordering: the reader should meet the amendment before the housekeeping.
  const mixed = after({ status: "ACTIVE_NOT_RECRUITING", primaryOutcomes: ["Progression-free survival"], completionDate: "2029-01" });
  ok("changes are ranked with the consequential ones first", mixed[0].severity === "high");
  ok("and the routine ones last", mixed[mixed.length - 1].severity === "routine");

  // Eligibility: reported as changed and by how much, never interpreted.
  const elig = after({ eligibilityCriteria: "Adults with confirmed disease and no prior therapy." });
  const ec = elig.find(c => c.field === "eligibilityCriteria");
  ok("an eligibility change is reported without a direction", !!ec && ec.from === undefined && /widened or narrowed/.test(ec.note));

  // Nothing changed at all.
  ok("an unchanged study produces no changes", api.diffTrialSnapshots(base, Object.assign({}, base)).length === 0);

  // ── The one that would fabricate findings if unguarded. A baseline saved
  // before masking/armLabels were ever parsed has `undefined` there, and
  // `undefined -> "DOUBLE"` is not a protocol amendment.
  const oldBaseline = { status: "RECRUITING", phase: "PHASE3", enrollment: 500, primaryCompletionDate: "2027-06", primaryOutcomes: ["Overall survival"] };
  const vsOld = api.diffTrialSnapshots(oldBaseline, base);
  ok("a pre-design-fields baseline reports no phantom design changes",
    !vsOld.some(c => ["masking", "allocation", "armCount", "armLabels", "eligibilityCriteria", "secondaryOutcomes", "completionDate"].indexOf(c.field) !== -1));
  ok("and the caller is told the baseline is older than the fields",
    api.snapshotPredatesDesignFields(oldBaseline) === true && api.snapshotPredatesDesignFields(base) === false);
  // It must still diff the fields it does have.
  ok("a pre-design-fields baseline still catches what it did record",
    api.diffTrialSnapshots(oldBaseline, Object.assign({}, oldBaseline, { enrollment: 300 })).length === 1);
}
report();

section("Analog board — placing one number in the posted reference class");
{
  // Five posted hazard ratios: 0.62, 0.71, 0.80, 0.88, 0.95. Lower is more
  // favourable on a ratio scale, and the null is 1.
  const ratios = [0.62, 0.71, 0.80, 0.88, 0.95].map(v => ({ value: v, scale: "ratio", nullValue: 1 }));
  // 0.75 beats 0.80, 0.88 and 0.95 -> 3 of 5 = 60th percentile.
  const mid = api.positionInAnalogs(ratios, 0.75);
  near("a mid-pack ratio beats three of five", mid.beats, 3, 0);
  near("which is the 60th percentile", mid.percentile, 0.6, 1e-12);
  near("the median of the five is 0.80", mid.median, 0.80, 1e-12);
  ok("and it is on the favourable side of 1", mid.favoursTreatment === true);
  // 0.55 beats all five.
  near("a ratio better than everything posted is the 100th percentile", api.positionInAnalogs(ratios, 0.55).percentile, 1, 0);
  // 0.99 beats none of them, and is still below the null.
  const thin = api.positionInAnalogs(ratios, 0.99);
  near("a ratio worse than everything posted is the 0th percentile", thin.percentile, 0, 0);
  ok("but is still reported as favouring treatment, because 0.99 < 1", thin.favoursTreatment === true);
  // 1.10 is on the wrong side of no-effect entirely.
  ok("a ratio above 1 does not favour treatment", api.positionInAnalogs(ratios, 1.10).favoursTreatment === false);
  // An exact tie beats nobody but is counted as a tie rather than vanishing.
  const tie = api.positionInAnalogs(ratios, 0.80);
  near("an exact match beats the two above it", tie.beats, 2, 0);
  near("and is recorded as a tie", tie.ties, 1, 0);

  // Difference scale runs the other way: higher is more favourable, null is 0.
  const diffs = [0.02, 0.05, 0.09].map(v => ({ value: v, scale: "difference", nullValue: 0 }));
  const d = api.positionInAnalogs(diffs, 0.07);
  near("a mean difference of 0.07 beats two of three", d.beats, 2, 0);
  ok("direction is reversed on a difference scale", d.favoursTreatment === true);
  ok("a negative difference does not favour treatment", api.positionInAnalogs(diffs, -0.01).favoursTreatment === false);

  ok("an empty reference class yields nothing rather than a fake percentile", api.positionInAnalogs([], 0.75) === null);
  ok("a non-numeric input yields nothing", api.positionInAnalogs(ratios, NaN) === null);
}
report();

section("Form 4 — a grant is not a purchase");
{
  // Only codes P (open-market buy) and S (open-market sell) are somebody
  // choosing to transact at a market price. Everything else on a Form 4 is a
  // transfer, an award, a withholding or a conversion, and rolling them into a
  // "net insider buying" figure is exactly how that figure stops meaning
  // anything. 10,000 @ $12 = $120,000 bought; 4,000 @ $15 = $60,000 sold.
  const txns = [
    { code: "P", shares: 10000, valueUsd: 120000, ownerName: "A. Chen" },
    { code: "S", shares: 4000, valueUsd: 60000, ownerName: "B. Okafor" },
    { code: "A", shares: 50000, valueUsd: null, ownerName: "A. Chen" },     // grant
    { code: "F", shares: 1200, valueUsd: 18000, ownerName: "B. Okafor" },   // tax withholding
    { code: "M", shares: 25000, valueUsd: null, ownerName: "C. Silva" },    // option exercise
    { code: "G", shares: 3000, valueUsd: null, ownerName: "A. Chen" }       // gift
  ];
  const sum = api.summarizeOpenMarketActivity(txns);
  near("only the P is counted as buying", sum.boughtShares, 10000, 0);
  near("and only at its own dollar value", sum.boughtUsd, 120000, 0);
  near("only the S is counted as selling", sum.soldShares, 4000, 0);
  near("net is purchases minus sales, nothing else", sum.netUsd, 60000, 0);
  ok("a 50,000-share grant is not counted as buying", sum.boughtShares === 10000);
  ok("tax withholding is not counted as selling", sum.soldShares === 4000);
  near("one distinct buyer", sum.buyerCount, 1, 0);
  near("one distinct seller", sum.sellerCount, 1, 0);

  // An empty filing set must read as "nothing happened here", not as zero
  // net buying dressed up as a finding.
  const none = api.summarizeOpenMarketActivity([]);
  ok("no transactions means nothing to report", none.any === false && none.netUsd === 0);
  // Grants alone must not make the summary claim open-market activity.
  ok("grants alone do not count as open-market activity",
    api.summarizeOpenMarketActivity([{ code: "A", shares: 50000, valueUsd: null }]).any === false);
  // The same insider on both sides counts once each way, not twice.
  const both = api.summarizeOpenMarketActivity([
    { code: "P", shares: 100, valueUsd: 1000, ownerName: "A" },
    { code: "P", shares: 200, valueUsd: 2000, ownerName: "A" },
    { code: "S", shares: 50, valueUsd: 500, ownerName: "A" }
  ]);
  ok("repeat transactions by one insider count as one buyer and one seller",
    both.buyerCount === 1 && both.sellerCount === 1);
  near("but their shares still add up", both.boughtShares, 300, 0);

  // Derivative codes need labels, or the grants tab prints raw letters.
  ok("the derivative codes have labels",
    ["A", "M", "F", "D", "C", "X"].every(c => typeof api.FORM4_CODE_LABELS[c] === "string" && api.FORM4_CODE_LABELS[c].length > 2));
}
report();

section("Literature shelf — what kind of paper is this");
{
  // Real pubTypeList from the KEYNOTE-189 record: four types at once. The
  // randomised-trial tag has to win over the plain "Journal Article", or the
  // primary report of the trial reads as an ordinary article.
  const k189 = ["Clinical Trial, Phase III", "Research Support, Non-U.S. Gov't", "Multicenter Study", "Randomized Controlled Trial", "Journal Article"];
  const c = api.classifyPublication(k189, "MED");
  ok("a randomised trial report is recognised as primary evidence", c.kind === "rct" && c.evidence === "primary");
  ok("a meta-analysis is synthesis, not primary", api.classifyPublication(["Meta-Analysis", "Journal Article"], "MED").evidence === "synthesis");
  ok("a systematic review is synthesis", api.classifyPublication(["Systematic Review"], "MED").kind === "systematic");
  ok("a narrative review is secondary", api.classifyPublication(["Review", "Journal Article"], "MED").evidence === "secondary");
  ok("a case report is an anecdote, and said so", api.classifyPublication(["Case Reports"], "MED").evidence === "anecdote");
  ok("an editorial is opinion", api.classifyPublication(["Editorial"], "MED").evidence === "opinion");
  ok("a bare journal article is not upgraded to anything", api.classifyPublication(["Journal Article"], "MED").kind === "article");
  ok("an unreviewed manuscript is a preprint whatever else it claims",
    api.classifyPublication(["Randomized Controlled Trial"], "PPR").kind === "preprint");
  ok("and its evidence status says unreviewed", api.classifyPublication([], "PPR").evidence === "unreviewed");
  const abs = api.classifyPublication(["Abstract"], "MED");
  ok("a conference abstract is its own tier, not a paper", abs.kind === "abstract" && abs.evidence === "abstract");
  // A non-randomised trial still counts as primary, one tier below an RCT.
  const nonRand = api.classifyPublication(["Clinical Trial, Phase II", "Journal Article"], "MED");
  ok("a single-arm trial report is primary but not an RCT", nonRand.kind === "trial" && nonRand.evidence === "primary");

  // MEDLINE escapes its own markup, so a decode has to happen before a strip
  // or "&lt;i&gt;KRAS&lt;/i&gt;" survives as literal angle brackets.
  ok("escaped markup is decoded then stripped", api.epmcClean("Efficacy in &lt;i&gt;KRAS&lt;/i&gt; tumours") === "Efficacy in KRAS tumours");
  ok("structured-abstract headings are removed", api.epmcClean("<h4>Background</h4>First-line therapy") === "Background First-line therapy");
  ok("an ampersand survives as an ampersand", api.epmcClean("Smith &amp; Jones") === "Smith & Jones");
  ok("null text is an empty string, not the word null", api.epmcClean(null) === "");

  // Full record parsing, shaped exactly as the live API returns it.
  const row = api.parseEpmcResult({
    id: "29658856", source: "MED", pmid: "29658856", doi: "10.1056/nejmoa1801005",
    title: "Pembrolizumab plus Chemotherapy in Metastatic Non-Small-Cell Lung Cancer",
    authorString: "Gandhi L, Rodriguez-Abreu D, et al.",
    journalInfo: { journal: { title: "The New England journal of medicine" } },
    pubYear: 2018, citedByCount: 5399, isOpenAccess: "N", inEPMC: "N", inPMC: "N",
    pubTypeList: { pubType: k189 }, abstractText: "<h4>Background</h4>First-line therapy."
  });
  ok("a DOI becomes the link when there is one", row.url === "https://doi.org/10.1056/nejmoa1801005");
  ok("the citation count is carried through", row.citedBy === 5399);
  ok("a closed-access NEJM paper is not marked as free to read", row.freeFullText === false);
  ok("it is typed as a randomised trial report", row.kind === "rct");
  // A preprint has no journal, and its server lives in a different field.
  const pre = api.parseEpmcResult({ id: "PPR1258317", source: "PPR", title: "A finding",
    bookOrReportDetails: { publisher: "bioRxiv" }, pubYear: 2026, pubTypeList: { pubType: [] } });
  ok("a preprint's server is read as its venue", pre.venue === "bioRxiv");
  ok("and a preprint is always free to read", pre.freeFullText === true);
  ok("with no DOI or PMID it still gets a working link", pre.url.indexOf("europepmc.org/article/PPR/PPR1258317") !== -1);

  // The composition of the shelf, which is the part worth reading first:
  // eleven reviews of one trial is not the same evidence base as eleven trials.
  const mix = api.summarizeLiterature([
    { evidence: "primary", freeFullText: false }, { evidence: "primary", freeFullText: true },
    { evidence: "secondary", freeFullText: true }, { evidence: "secondary", freeFullText: true },
    { evidence: "secondary", freeFullText: false }, { evidence: "unreviewed", freeFullText: true }
  ]);
  near("two primary papers out of six", mix.byEvidence.primary, 2, 0);
  near("three reviews", mix.byEvidence.secondary, 3, 0);
  near("one preprint", mix.byEvidence.unreviewed, 1, 0);
  near("four are readable without a subscription", mix.freeFullText, 4, 0);
  near("and the total is stated", mix.total, 6, 0);
}
report();

section("Asset programme — the shape of an evidence base, never a score");
{
  const t = (over) => Object.assign({
    nctId: "NCT00000001", title: "A study", phase: "PHASE2", status: "COMPLETED",
    sponsor: "Acme Bio", conditions: ["Disease X"], enrollment: 100,
    interventions: ["acmezumab"], interventionsDetailed: [{ name: "acmezumab", otherNames: [] }],
    allocation: "RANDOMIZED", masking: "DOUBLE", armTypes: ["EXPERIMENTAL", "PLACEBO_COMPARATOR"],
    hasResults: false, whyStopped: null, startDate: "2022-01"
  }, over);

  // ── The matching problem. CT.gov's query.intr is a loose text search:
  // asking for pembrolizumab returns single-arm nivolumab studies. A view that
  // silently kept those would overstate the programme.
  ok("a study listing the drug matches", api.studyNamesIntervention(t({}), "acmezumab"));
  ok("a study listing only another drug does not",
    !api.studyNamesIntervention(t({ interventions: ["nivolumab"], interventionsDetailed: [{ name: "nivolumab", otherNames: [] }], title: "Nivolumab study" }), "acmezumab"));
  ok("a brand name in otherNames matches the generic search",
    api.studyNamesIntervention(t({ interventions: ["Acmeda"], interventionsDetailed: [{ name: "Acmeda", otherNames: ["acmezumab"] }] }), "acmezumab"));
  ok("matching is case-insensitive", api.studyNamesIntervention(t({}), "ACMEZUMAB"));
  ok("a drug named only in the title still matches, as the weakest case",
    api.studyNamesIntervention(t({ interventions: ["placebo"], interventionsDetailed: [{ name: "placebo", otherNames: [] }], title: "Acmezumab versus placebo" }), "acmezumab"));

  // Phase ordering, so "furthest reached" is a real maximum.
  ok("Phase 3 outranks Phase 2", api.assetPhaseRank("PHASE3") > api.assetPhaseRank("PHASE2"));
  ok("Phase 1/2 sits between them", api.assetPhaseRank("PHASE1/PHASE2") > api.assetPhaseRank("PHASE1")
    && api.assetPhaseRank("PHASE1/PHASE2") < api.assetPhaseRank("PHASE2"));
  ok("an unknown phase ranks lowest, it does not throw", api.assetPhaseRank("NONSENSE") === 0);

  // ── A programme with a deliberately mixed shape ──
  // 6 trials named right, 1 that isn't. 2 randomised of 5 with a stated
  // allocation (one registers none at all). 1 blinded. 2 with a comparator.
  // 1 with results. 1 terminated. Largest n = 740, total = 100+40+740+60+30+12.
  const prog = api.summarizeAssetProgram([
    t({ nctId: "NCT1", phase: "PHASE3", enrollment: 740, allocation: "RANDOMIZED", masking: "QUADRUPLE", hasResults: true }),
    t({ nctId: "NCT2", phase: "PHASE2", enrollment: 100, allocation: "RANDOMIZED", masking: "NONE", armTypes: ["EXPERIMENTAL", "ACTIVE_COMPARATOR"] }),
    t({ nctId: "NCT3", phase: "PHASE1", enrollment: 40, allocation: "NA", masking: "NONE", armTypes: ["EXPERIMENTAL"] }),
    t({ nctId: "NCT4", phase: "PHASE2", enrollment: 60, allocation: "NON_RANDOMIZED", masking: "NONE", armTypes: ["EXPERIMENTAL"], conditions: ["Disease Y"] }),
    t({ nctId: "NCT5", phase: "PHASE1", enrollment: 30, allocation: null, masking: null, armTypes: [], status: "TERMINATED", whyStopped: "Business decision", sponsor: "Other Bio" }),
    t({ nctId: "NCT6", phase: "PHASE2", enrollment: 12, allocation: "NA", masking: "NONE", armTypes: ["EXPERIMENTAL"] }),
    t({ nctId: "NCT7", interventions: ["somethingelse"], interventionsDetailed: [{ name: "somethingelse", otherNames: [] }], title: "Unrelated" })
  ], "acmezumab");

  near("the study that does not name the drug is dropped", prog.trialCount, 6, 0);
  near("and the drop is counted, not hidden", prog.droppedForName, 1, 0);
  near("two of the five with a stated allocation are randomised", prog.evidence.randomised, 2, 0);
  near("and that denominator excludes the one registering none", prog.evidence.withStatedAllocation, 5, 0);
  near("one trial is blinded", prog.evidence.blinded, 1, 0);
  near("two register a comparator arm", prog.evidence.controlled, 2, 0);
  near("one has posted results", prog.evidence.withPostedResults, 1, 0);
  near("one was stopped", prog.evidence.stopped, 1, 0);
  ok("and the registered reason travels with it", prog.stopped[0].whyStopped === "Business decision");
  near("largest single trial is 740", prog.evidence.largestEnrolment, 740, 0);
  // 740 + 100 + 60 + 40 + 30 + 12 = 982
  near("total registered enrolment is 982", prog.evidence.totalEnrolment, 982, 0);
  ok("furthest reached is Phase 3", prog.evidence.highestPhase === "PHASE3");
  near("two distinct indications", prog.evidence.indicationCount, 2, 0);
  near("two sponsors", prog.evidence.sponsorCount, 2, 0);
  ok("phases are listed highest first", prog.phases[0].phase === "PHASE3");
  // Disease X appears in five of the six, Disease Y in one.
  ok("indications are ranked by trial count", prog.indications[0].condition === "Disease X" && prog.indications[0].trials === 5);

  // Duplicates from a repeated or paged query must not inflate anything.
  const dup = api.summarizeAssetProgram([t({ nctId: "NCT1" }), t({ nctId: "NCT1" }), t({ nctId: "NCT2" })], "acmezumab");
  near("the same NCT twice counts once", dup.trialCount, 2, 0);

  // ── The description, which must stay a checklist ──
  const lines = api.describeEvidenceBase(prog);
  ok("every line carries its own denominator or a plain fact", lines.length >= 5);
  ok("no line reports a composite score", !lines.some(l => /score|rating|out of 10|\/100|strength:/i.test(l.text)));
  ok("the randomised line states both numbers", lines.some(l => l.key === "randomised" && /2 of 5/.test(l.text)));

  // A single-arm-only programme has to say so plainly — this is the case the
  // whole checklist exists for.
  const thin = api.summarizeAssetProgram([
    t({ nctId: "NCT1", allocation: "NA", masking: "NONE", armTypes: ["EXPERIMENTAL"], enrollment: 40, phase: "PHASE2", hasResults: false }),
    t({ nctId: "NCT2", allocation: "NA", masking: "NONE", armTypes: ["EXPERIMENTAL"], enrollment: 22, phase: "PHASE1", hasResults: false })
  ], "acmezumab");
  const thinLines = api.describeEvidenceBase(thin);
  ok("a programme with no randomised trial says exactly that",
    thinLines.some(l => l.key === "randomised" && /None of the/.test(l.text) && l.tone === "thin"));
  ok("no comparator anywhere is stated plainly",
    thinLines.some(l => l.key === "controlled" && /nothing in this programme to measure the drug against/.test(l.text)));
  ok("nothing posted is stated plainly",
    thinLines.some(l => l.key === "results" && /No trial has posted results/.test(l.text)));
  ok("a 40-patient largest trial is flagged as too small to detect a modest effect",
    thinLines.some(l => l.key === "size" && /modest effect/.test(l.text)));

  // ── The field list is asserted, not assumed. CT.gov v2 drops `hasResults`
  // from the response when `fields` is specified and it is not requested, and
  // parseStudy coerces the missing value to false. The checklist then stated
  // in a full sentence that no trial had posted results, for a drug with
  // sixteen that had. Every field the view reads must be requested.
  ["NCTId", "OverallStatus", "WhyStopped", "Phase", "Condition", "InterventionName",
   "InterventionOtherName", "EnrollmentCount", "DesignInfo", "ArmGroup", "HasResults",
   "LeadSponsorName", "StartDate"].forEach(f => {
    ok("the asset-programme query asks for " + f, api.ASSET_PROGRAM_FIELDS.indexOf(f) !== -1);
  });

  // An empty programme must produce nothing rather than a confident nothing.
  ok("an empty programme yields no description", api.describeEvidenceBase(api.summarizeAssetProgram([], "acmezumab")).length === 0);
  ok("and does not throw", api.summarizeAssetProgram(null, "x").trialCount === 0);
}
report();

section("Assumption stress — what a power calculation does when its inputs are wrong");
{
  // A trial planned at 30% control, 45% treatment. If the control arm actually
  // responds at 40%, the two coherent projections disagree and the difference
  // is material:
  //   absolute:  0.40 + (0.45 - 0.30) = 0.55
  //   relative:  0.40 x (0.45 / 0.30) = 0.40 x 1.5 = 0.60
  near("a constant absolute benefit puts treatment at 55%",
    api.projectTreatmentRate(0.30, 0.45, 0.40, "absolute").rate, 0.55, 1e-12);
  near("a constant relative benefit puts it at 60%",
    api.projectTreatmentRate(0.30, 0.45, 0.40, "relative").rate, 0.60, 1e-12);
  // At the planned control rate both models must return the planned treatment
  // rate, or the baseline column would disagree with the calculation above it.
  near("at the planned control rate, absolute reproduces the plan",
    api.projectTreatmentRate(0.30, 0.45, 0.30, "absolute").rate, 0.45, 1e-12);
  near("and so does relative", api.projectTreatmentRate(0.30, 0.45, 0.30, "relative").rate, 0.45, 1e-12);
  // A relative projection from a high control rate runs past 1. Clamping is
  // the honest answer; silently handing 1.05 to a power function is not.
  const over = api.projectTreatmentRate(0.30, 0.45, 0.70, "relative");   // 0.70 x 1.5 = 1.05
  ok("a projection past certainty is clamped and says so", over.rate < 1 && over.clamped === true);
  ok("a projection inside the range is not marked clamped",
    api.projectTreatmentRate(0.30, 0.45, 0.40, "relative").clamped === false);
  ok("an impossible input yields null rather than a number", api.projectTreatmentRate(0, 0.45, 0.4, "absolute") === null);

  // Dropout. 400 randomised with 15% lost leaves 340 to analyse.
  near("15% dropout from 400 leaves 340", api.effectiveNAfterDropout(400, 0.15), 340, 0);
  near("no dropout changes nothing", api.effectiveNAfterDropout(400, 0), 400, 0);
  ok("an arm is never emptied entirely", api.effectiveNAfterDropout(10, 0.999) >= 1);
  // The inflation is N/(1-d), not N*(1+d) -- the common mistake. At 20%,
  // 400/0.8 = 500, which is 25% more patients, not 20%.
  near("to keep 400 analysable at 20% dropout, randomise 500", api.inflateForDropout(400, 0.20), 500, 0);
  ok("and that is more than the naive N*(1+d) of 480", api.inflateForDropout(400, 0.20) > 480);
  near("zero dropout needs no inflation", api.inflateForDropout(400, 0), 400, 0);

  // The sweep range must always contain the planned value, so the baseline is
  // visible in the same column as the stresses.
  const rng = api.stressRange(0.30);
  ok("the planned value is in its own sweep", rng.some(v => Math.abs(v - 0.30) < 1e-12));
  ok("the sweep is ordered", rng.every((v, i) => i === 0 || v >= rng[i - 1]));
  near("it spans 60% to 140% of the plan", rng[0], 0.18, 1e-12);
  near("at the top end", rng[rng.length - 1], 0.42, 1e-12);

  // The sweep itself, against the real power function. Power must rise with N.
  const swept = api.stressPowerOver([100, 200, 400], n =>
    api.closedFormPowerTwoProportion(0.30, 0.45, n, n, 0.05, "two"));
  ok("power increases with sample size across the sweep",
    swept[0].power < swept[1].power && swept[1].power < swept[2].power);
  // A power function that throws must produce a null cell, not kill the table.
  const broken = api.stressPowerOver([1, 2], () => { throw new Error("boom"); });
  ok("a failing cell is null, not a crash", broken.length === 2 && broken[0].power === null);
  ok("a non-finite power is also null", api.stressPowerOver([1], () => NaN)[0].power === null);

  // End to end, and the whole claim the panel makes — worked longhand so the
  // expected numbers come from arithmetic rather than from the app.
  //
  // Planned: 165/arm, 30% vs 45%, two-sided alpha 0.05.
  //   pbar = 0.375
  //   SE0  = sqrt(2 x 0.375 x 0.625 / 165) = sqrt(0.0028409) = 0.053301
  //   SE1  = sqrt((0.30x0.70 + 0.45x0.55) / 165) = sqrt(0.0027727) = 0.052657
  //   z    = (0.15 - 1.96 x 0.053301) / 0.052657 = 0.045530 / 0.052657 = 0.8647
  //   power = PHI(0.8647) = 0.8064
  const planned = api.closedFormPowerTwoProportion(0.30, 0.45, 165, 165, 0.05, "two");
  near("165 per arm is the ~80%-power design point for 30% vs 45%", planned, 0.8064, 0.003);

  // Lose 20% and 132 remain analysable per arm:
  //   SE0 = sqrt(0.46875 / 132) = 0.059591
  //   SE1 = sqrt(0.45750 / 132) = 0.058872
  //   z   = (0.15 - 1.96 x 0.059591) / 0.058872 = 0.033202 / 0.058872 = 0.5640
  //   power = PHI(0.5640) = 0.7136
  const nAfter = api.effectiveNAfterDropout(165, 0.20);
  near("20% dropout leaves 132 per arm", nAfter, 132, 0);
  const afterDropout = api.closedFormPowerTwoProportion(0.30, 0.45, nAfter, nAfter, 0.05, "two");
  near("and power falls to about 71%", afterDropout, 0.7136, 0.003);
  ok("which is a real loss, not a rounding one", planned - afterDropout > 0.08);
  // The fix, and the reason the inflation formula matters: randomise 207 and
  // 165 survive, restoring the planned power.
  near("randomising 207 restores 165 analysable", api.effectiveNAfterDropout(api.inflateForDropout(165, 0.20), 0.20), 165, 0);
}
report();

section("CMS drug spending — a quarter is not a year");
{
  // The quarterly dataset writes its period as free text, mixing a rolling
  // full year with a partial one in the same column. These are the two real
  // shapes, verified live against the Winrevair record.
  const fy = api.parseCmsPeriodLabel("2025 (Q1-Q4)");
  ok("a Q1-Q4 label is a full year", fy.isFullYear === true && fy.quarterCount === 4 && fy.year === 2025);
  const q1 = api.parseCmsPeriodLabel("2026 (Q1)");
  ok("a single-quarter label is not", q1.isFullYear === false && q1.quarterCount === 1 && q1.year === 2026);
  ok("2026 Q1 sorts after all of 2025", q1.sortKey > fy.sortKey);
  const h1 = api.parseCmsPeriodLabel("2026 (Q1-Q2)");
  ok("a half-year covers two quarters", h1.quarterCount === 2 && h1.isFullYear === false);
  ok("an unparseable label yields nothing", api.parseCmsPeriodLabel("no year here") === null);

  // Both CMS datasets repeat each drug once per manufacturer AND once as
  // "Overall" with the same totals. Summing the rows double-counts every
  // single-manufacturer drug exactly twice.
  const rows = [
    { Brnd_Name: "Winrevair", Mftr_Name: "Overall", Tot_Spndng: "499382409.13" },
    { Brnd_Name: "Winrevair", Mftr_Name: "Merck Sharp & D", Tot_Spndng: "499382409.13" },
    { Brnd_Name: "Something Else", Mftr_Name: "Overall", Tot_Spndng: "1" }
  ];
  const picked = api.pickOverallRows(rows, "Winrevair");
  ok("only the Overall row survives", picked.length === 1 && picked[0].Mftr_Name === "Overall");
  ok("and a different brand is not swept in", picked[0].Brnd_Name === "Winrevair");
  // CMS appends a footnote asterisk to some names and does it INCONSISTENTLY
  // BETWEEN ITS OWN DATASETS: selexipag is "Uptravi" in the quarterly file and
  // "Uptravi*" in the annual one. Exact matching returned the recent quarters
  // and silently dropped the whole annual history, leaving a mature drug's
  // plateau sitting where its ramp should have been on the analog chart.
  ok("a trailing asterisk is not part of the name", api.cmsNormalizeName("Uptravi*") === "uptravi");
  ok("neither are several of them", api.cmsNormalizeName("Uptravi**  ") === "uptravi");
  ok("case and padding are ignored", api.cmsNormalizeName("  OPSUMIT ") === "opsumit");
  ok("the footnote marker is stripped for display without lowercasing", api.cmsDisplayName("Uptravi*") === "Uptravi");
  ok("an asterisked row matches the plain search term",
    api.pickOverallRows([{ Brnd_Name: "Uptravi*", Mftr_Name: "Overall", Tot_Spndng: "1" }], "Uptravi").length === 1);
  ok("and an asterisked manufacturer is still recognised as Overall",
    api.pickOverallRows([
      { Brnd_Name: "Uptravi*", Mftr_Name: "Overall*", Tot_Spndng: "1" },
      { Brnd_Name: "Uptravi*", Mftr_Name: "Actelion Pharma*", Tot_Spndng: "1" }
    ], "Uptravi").length === 1);

  // If a drug somehow has no Overall row, fall back rather than returning none.
  ok("a record with no Overall row still returns something",
    api.pickOverallRows([{ Brnd_Name: "X", Mftr_Name: "Acme", Tot_Spndng: "5" }], "X").length === 1);

  // The annual dataset is WIDE: Tot_Spndng_2020, Tot_Spndng_2021 ... on one row,
  // with pre-launch years blank rather than zero.
  const annual = api.parseCmsAnnualRow({
    Brnd_Name: "Winrevair", Gnrc_Name: "Sotatercept-Csrk", Mftr_Name: "Overall",
    Tot_Spndng_2022: "", Tot_Benes_2022: "",
    Tot_Spndng_2023: "", Tot_Benes_2023: "",
    Tot_Spndng_2024: "177600000", Tot_Benes_2024: "1923", Tot_Clms_2024: "10663", Outlier_Flag_2024: "0"
  });
  ok("a year before launch is absent, not zero", annual.periods.length === 1 && annual.periods[0].year === 2024);
  near("and the year that exists carries its spend", annual.periods[0].spending, 177600000, 0);
  ok("every annual period is a full year", annual.periods.every(p => p.isFullYear));

  // ── The merge, and the mistake it exists to prevent ──
  // Real Winrevair shape: 2024 annual $177.6M, 2025 rolling year $499.4M,
  // 2026 Q1 $179.2M. Comparing that Q1 to the 2025 full year shows a 64% fall
  // in a drug that is in fact tripling.
  const merged = api.mergeDrugSpendSeries(
    [ { label: "2024", year: 2024, quarters: [1,2,3,4], quarterCount: 4, isFullYear: true, sortKey: 20244, source: "annual", spending: 177600000 } ],
    [ { label: "2025 (Q1-Q4)", year: 2025, quarters: [1,2,3,4], quarterCount: 4, isFullYear: true, sortKey: 20254, source: "quarterly", spending: 499382409 },
      { label: "2026 (Q1)", year: 2026, quarters: [1], quarterCount: 1, isFullYear: false, sortKey: 20261, source: "quarterly", spending: 179167695 } ]);
  ok("the merged series is in chronological order",
    merged.map(p => p.label).join("|") === "2024|2025 (Q1-Q4)|2026 (Q1)");

  const grown = api.addComparablePeriodGrowth(merged);
  // 499382409 / 177600000 - 1 = 1.8119...
  near("2025 against 2024 is a like-for-like +181%", grown[1].growthVsComparable, 499382409 / 177600000 - 1, 1e-9);
  ok("and it says which period it compared against", grown[1].comparableTo === "2024");
  // The Q1 row has no earlier single-quarter period to compare to, so it must
  // report nothing rather than compare itself to a full year.
  ok("a lone quarter has no comparable prior period", grown[2].growthVsComparable === null && grown[2].comparableTo === null);

  // A finalised annual row must win over a rolling quarterly one for the same
  // year -- the rolling figure can still move.
  const dedup = api.mergeDrugSpendSeries(
    [ { label: "2025", year: 2025, quarters: [1,2,3,4], quarterCount: 4, isFullYear: true, sortKey: 20254, source: "annual", spending: 500 } ],
    [ { label: "2025 (Q1-Q4)", year: 2025, quarters: [1,2,3,4], quarterCount: 4, isFullYear: true, sortKey: 20254, source: "quarterly", spending: 499 } ]);
  ok("one row per full year, and it is the finalised one", dedup.length === 1 && dedup[0].spending === 500);

  // The run rate is offered but labelled: 179,167,695 x 4 = 716,670,780.
  near("a single quarter annualises by four", api.impliedAnnualRunRate(grown[2]), 179167695 * 4, 1e-6);
  ok("a full year is not annualised again", api.impliedAnnualRunRate(grown[1]) === null);

  // Staleness: the pinned dataset id is checked by looking at the data, not by
  // trusting that CMS still publishes at that address.
  const fresh = api.cmsSeriesFreshness(merged, new Date("2026-09-21"));
  // 2026 Q1 ends in March; September is six months later.
  near("2026 Q1 read in September is six months behind", fresh.monthsBehind, 6, 0);
  ok("which is not stale", fresh.stale === false);
  const old = api.cmsSeriesFreshness([{ label: "2023", year: 2023, quarters: [1,2,3,4] }], new Date("2026-09-21"));
  ok("a series ending in 2023 read in 2026 is stale", old.stale === true);
  ok("an empty series has no freshness to report", api.cmsSeriesFreshness([], new Date()) === null);

  // ── Re-indexing for an analog comparison, and the trap in it ──
  // A drug whose first figure is the dataset's own first year was almost
  // certainly selling before that. Aligning it as if year one were its launch
  // puts a mature drug's plateau exactly where a new drug's ramp belongs,
  // which makes the comparison read backwards rather than merely imprecise.
  const mature = api.indexToLaunch(
    [{ label: "2020", year: 2020, quarters: [1,2,3,4], spending: 768.7e6 },
     { label: "2021", year: 2021, quarters: [1,2,3,4], spending: 863.2e6 }], 2020);
  ok("an analog already selling when the data starts is flagged", mature[0].launchPredatesData === true);
  ok("a drug that first appears after the data starts is not",
    api.indexToLaunch([{ label: "2024", year: 2024, quarters: [1,2,3,4], spending: 177.6e6 }], 2020)[0].launchPredatesData === false);
  ok("with no dataset start year known, nothing is claimed either way",
    api.indexToLaunch([{ label: "2020", year: 2020, quarters: [1,2,3,4], spending: 1 }])[0].launchPredatesData === false);
  // The wide annual row also reports where the dataset itself begins, taken
  // from every year column present rather than only the populated ones.
  const wide = api.parseCmsAnnualRow({ Brnd_Name: "X", Mftr_Name: "Overall",
    Tot_Spndng_2020: "", Tot_Spndng_2021: "", Tot_Spndng_2022: "500" });
  near("the dataset start year comes from the blank columns too", wide.dataStartYear, 2020, 0);
  ok("while the drug's own first period is the first populated one", wide.periods[0].year === 2022);

  const indexed = api.indexToLaunch(merged);
  near("the launch year is period zero", indexed[0].periodsSinceFirst, 0, 0);
  near("and 2026 is two years on", indexed[2].periodsSinceFirst, 2, 0);
  ok("the first period is flagged, since it is rarely a full commercial year", indexed[0].isFirstPeriod === true);

  near("a dollar string with separators parses", api.cmsNum("$1,234.56"), 1234.56, 1e-9);
  ok("a suppressed (blank) count is null, never zero", api.cmsNum("") === null);
}
report();

section("Actual versus modelled revenue — a partial year is not a full one");
{
  // A model whose Year 0 is 2025: $100M, $300M, $600M, $900M.
  const cal = [100e6, 300e6, 600e6, 900e6].map((v, i) => ({ calendarYear: i, totalRevenue: v }));

  ok("an entry defaults to a full year when quarters are unstated",
    api.normalizeActualEntry({ year: 2025, revenueUsd: 90e6 }).quarters === 4);
  ok("a dollar string with separators parses",
    api.normalizeActualEntry({ year: 2025, quarters: 4, revenueUsd: "$90,000,000" }).revenueUsd === 90e6);
  ok("more than four quarters is clamped", api.normalizeActualEntry({ year: 2025, quarters: 9, revenueUsd: 1 }).quarters === 4);
  ok("a junk year is rejected outright", api.normalizeActualEntry({ year: "soon", revenueUsd: 1 }) === null);
  ok("negative revenue is rejected", api.normalizeActualEntry({ year: 2025, revenueUsd: -5 }) === null);

  // Three quarters at $60M implies $80M for the year: 60 x 4/3.
  near("three quarters annualise by four thirds",
    api.impliedAnnualFromActual(api.normalizeActualEntry({ year: 2026, quarters: 3, revenueUsd: 60e6 })), 80e6, 1e-6);
  ok("a full year is not annualised again",
    api.impliedAnnualFromActual(api.normalizeActualEntry({ year: 2026, quarters: 4, revenueUsd: 60e6 })) === null);

  // ── The mistake this file exists to prevent ──
  // 2026 is modelled at $300M. Three quarters of it came in at $240M.
  // Comparing $240M to $300M reads as a 20% MISS. The run rate is
  // 240 x 4/3 = $320M, which is a 6.7% BEAT. Same facts, opposite conclusions.
  const cmp = api.compareActualToModel(cal, [
    { year: 2025, quarters: 4, revenueUsd: 90e6 },
    { year: 2026, quarters: 3, revenueUsd: 240e6 }
  ], 2025);
  const y2025 = cmp.rows[0], y2026 = cmp.rows[1];
  near("a completed year compares directly: 90 against 100 is -10%", y2025.deltaVsModel, -0.10, 1e-12);
  ok("and it says so", y2025.comparisonBasis === "reported full year");
  near("a three-quarter year compares on its run rate, not its face value",
    y2026.deltaVsModel, (320e6 / 300e6) - 1, 1e-12);
  ok("which is a beat, where the naive comparison would have shown a miss", y2026.deltaVsModel > 0);
  ok("and the basis is spelled out", /implied run rate from 3 of 4 quarters/.test(y2026.comparisonBasis));
  near("the implied annual figure is carried through", y2026.impliedAnnualUsd, 320e6, 1e-6);

  // The headline uses the most recent COMPLETED year only, because that is the
  // only comparison where both sides are reported numbers.
  ok("the headline is the last completed year", cmp.latestCompleted && cmp.latestCompleted.year === 2025);
  ok("and there is no verdict attached", !("verdict" in cmp) && !("onTrack" in cmp));

  // A year outside the model is a distinct answer from a miss — it almost
  // always means Year 0 is set wrong, and calling it a 100% shortfall would
  // send the reader after the wrong problem.
  const outside = api.compareActualToModel(cal, [{ year: 2019, quarters: 4, revenueUsd: 50e6 }], 2025);
  ok("a year before the model starts is flagged as outside it", outside.rows[0].outsideModel === true);
  ok("and gets no delta", outside.rows[0].deltaVsModel === null);
  const beyond = api.compareActualToModel(cal, [{ year: 2099, quarters: 4, revenueUsd: 50e6 }], 2025);
  ok("so is a year past the end of the projection", beyond.rows[0].outsideModel === true);

  // A modelled zero in a year the drug was selling means the model has the
  // launch in the wrong place, which is a different finding from a shortfall.
  const preLaunch = api.compareActualToModel(
    [{ calendarYear: 0, totalRevenue: 0 }, { calendarYear: 1, totalRevenue: 500e6 }],
    [{ year: 2025, quarters: 4, revenueUsd: 40e6 }], 2025);
  ok("revenue in a year the model has pre-launch is flagged", preLaunch.rows[0].modelPreLaunch === true);
  ok("and produces no percentage, since the denominator is zero", preLaunch.rows[0].deltaVsModel === null);

  // ── Chart series ──
  const ser = api.actualVsModelSeries(cal, [
    { year: 2025, quarters: 4, revenueUsd: 90e6 },
    { year: 2027, quarters: 4, revenueUsd: 700e6 }
  ], 2025, { yearsAhead: 1 });
  ok("the axis runs from Year 0", ser.years[0] === 2025);
  // A year with nothing reported must be a gap, not a zero -- plotting zero
  // would draw a collapse to nothing and back that never happened.
  ok("an unreported year is a gap in the actual line, not a zero",
    ser.actual[1].v === null && ser.actual[0].v === 90e6 && ser.actual[2].v === 700e6);
  ok("the modelled line has a value every year", ser.modelled.every(p => typeof p.v === "number"));
  near("and the modelled 2027 is the third calendar entry", ser.modelled[2].v, 600e6, 0);
  ok("the modelled line runs past the last reported year", ser.years[ser.years.length - 1] > 2027);

  ok("no model calendar yields empty series rather than throwing",
    api.actualVsModelSeries([], [{ year: 2025, quarters: 4, revenueUsd: 1 }], 2025).modelled.length === 0);
  ok("a missing Year 0 anchor yields empty series", api.actualVsModelSeries(cal, [], "").modelled.length === 0);
  near("the calendar mapping is a plain offset", api.modelYearForCalendar(2028, 2025), 3, 0);
}
report();

section("FIN-002: partnership milestones use the program's effective PoS");
{
  // A milestone paid at approval is worth  face × P(launch) ÷ (1+r)^T,  where
  // T is the R&D timeline to launch. So with everything else fixed:
  //   · a 50% PoS override vs a 10% one gives exactly 0.50/0.10 = 5× the value;
  //   · a Bear PoS multiplier of 70% on a 50% override gives 0.35/0.50 = 0.7×;
  //   · $100M × 0.35 ÷ 1.12^T in absolute terms.
  // On f49689f milestones re-read the raw benchmark, so every ratio was 1.
  const prog = (overridePct, milestones, extra) => Object.assign({
    id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
    revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" },
    posOverridePct: overridePct,
    partnership: { enabled: true, upfrontM: "0", milestones }
  }, extra || {});
  const mkCase = (p) => ({
    name: "T", currentPrice: "10",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "0", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" }, programs: [p]
  });
  const base = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const bear = { label: "bear", shareMultiplierPct: 100, posMultiplierPct: 70, discountRateAddPct: 0, color: "" };
  const launchM = [{ label: "Approval", gate: "launch", valueM: "100" }];
  const T = api.computeRnDToLaunch(prog("50", launchM)).totalYears;

  const m50 = api.computePartnershipContribution(mkCase(prog("50", launchM)), 0.12, base);
  const m10 = api.computePartnershipContribution(mkCase(prog("10", launchM)), 0.12, base);
  near("a 50% override is worth exactly 5x a 10% override", m50 / m10, 5, 1e-9);
  near("absolute: $100M x 0.50 / 1.12^T", m50, 100e6 * 0.50 / Math.pow(1.12, T), 1e-3);

  const mBear = api.computePartnershipContribution(mkCase(prog("50", launchM)), 0.12, bear);
  near("a Bear 70% PoS multiplier scales the milestone by exactly 0.7", mBear / m50, 0.7, 1e-9);
  near("absolute Bear: $100M x 0.35 / 1.12^T", mBear, 100e6 * 0.35 / Math.pow(1.12, T), 1e-3);

  // PRV and a launch milestone of equal face on one program: both are
  // face × the SAME effective P(launch), discounted from launch — the PRV from
  // the program's launch year L, the milestone from T. So
  //   PRV / milestone = 1.12^(T − L)   exactly, and PRV = $150M × 0.35 / 1.12^L.
  const both = prog("50", [{ label: "Approval", gate: "launch", valueM: "150" }], { launchYearOffset: "5", prv: { enabled: true, valueM: "150" } });
  const cv = api.computeCaseValuation(mkCase(both), bear, null, 12, { enabled: false });
  near("PRV = $150M x 0.35 / 1.12^5", cv.equity.prvValueAdded, 150e6 * 0.35 / Math.pow(1.12, 5), 1e-3);
  near("PRV and milestone share one effective PoS: ratio is 1.12^(T-5)",
    cv.equity.prvValueAdded / cv.equity.partnershipValueAdded, Math.pow(1.12, T - 5), 1e-9);

  // Simple Multiple calls the same function and must pass its scenario too.
  const sm = api.computeSimpleMultipleValuation(mkCase(prog("50", launchM)), bear, null, 3, 12);
  near("Simple Multiple: milestone = $100M x 0.35 / 1.12^T", sm.equity.partnershipValueAdded, 100e6 * 0.35 / Math.pow(1.12, T), 1e-3);

  // A stage gate reads the rebuilt stage path. The override factor f is spread
  // evenly across the n stage transitions (k = f^(1/n)), so the probability of
  // REACHING stage j scales by k^j, and 50% vs 10% differs by 5^(j/n).
  const stages = api.computePoSWeighting(prog("50", launchM)).stages;
  const j = stages.findIndex(st => st.key === "regulatory");
  const regM = [{ label: "Filing", gate: "regulatory", valueM: "100" }];
  const r50 = api.computePartnershipContribution(mkCase(prog("50", regM)), 0.12, base);
  const r10 = api.computePartnershipContribution(mkCase(prog("10", regM)), 0.12, base);
  ok("the fixture has a regulatory stage after the current one", j > 0);
  near("a stage-gate milestone scales by 5^(j/n) between 50% and 10% overrides", r50 / r10, Math.pow(5, j / stages.length), 1e-9);

  // No override, Base scenario: unchanged from before (benchmark odds).
  const plain = api.computePartnershipContribution(mkCase(prog("", launchM)), 0.12, base);
  near("with no override at Base, the milestone uses the benchmark P(launch)",
    plain, 100e6 * api.computePoSWeighting(prog("", launchM)).posToLaunch / Math.pow(1.12, T), 1e-3);
}
report();

section("FIN-003: Peak Sales rates are entered as whole percents");
{
  // The form takes 60 for 60%; the engine works in fractions. Every parameter
  // of a rate's spec divides by 100 — a Normal's SD too, being in the mean's units.
  near("point 60 -> 0.60", api.percentSpecToFraction({ type: "point", value: 60 }).value, 0.60, 1e-12);
  const u = api.percentSpecToFraction({ type: "uniform", low: 15, high: 35 });
  near("uniform 15-35 -> low 0.15", u.low, 0.15, 1e-12);
  near("uniform 15-35 -> high 0.35", u.high, 0.35, 1e-12);
  const nrm = api.percentSpecToFraction({ type: "normal", mean: 40, sd: 5 });
  near("normal SD scales with its mean (5 -> 0.05)", nrm.sd, 0.05, 1e-12);
  ok("the spec type is kept", nrm.type === "normal");
  // A rate outside 0-100 is refused, not clamped.
  ok("60% is accepted", api.percentSpecError({ type: "point", value: 60 }, "Share") === null);
  ok("150% share is refused with a message", /between 0 and 100/.test(api.percentSpecError({ type: "point", value: 150 }, "Share") || ""));
  ok("a negative rate is refused", !!api.percentSpecError({ type: "uniform", low: -5, high: 20 }, "Share"));
  ok("a blank (NaN) rate is refused", !!api.percentSpecError({ type: "point", value: NaN }, "Share"));
  ok("a triangular high above 100 is refused", !!api.percentSpecError({ type: "triangular", low: 50, mode: 80, high: 120 }, "Share"));
  ok("a negative Normal SD is refused", !!api.percentSpecError({ type: "normal", mean: 50, sd: -1 }, "Share"));
  // End to end with fixed inputs: 1,000,000 people x 60% diagnosed x 50%
  // treated x 25% share x $100,000 = 1e6 x 0.6 x 0.5 x 0.25 x 1e5 = $7.5e9.
  const r = api.runPeakSalesSimulation({
    addressablePopulation: { type: "point", value: 1e6 },
    diagnosisRate: api.percentSpecToFraction({ type: "point", value: 60 }),
    treatmentRate: api.percentSpecToFraction({ type: "point", value: 50 }),
    peakShare: api.percentSpecToFraction({ type: "point", value: 25 }),
    annualPriceUSD: { type: "point", value: 1e5 }
  }, 1000);
  near("60/50/25 percent inputs give $7.5B peak sales, not a clamped 100%", r.summary.p50, 7.5e9, 1e-3);
}
report();

section("FIN-009/010: full-case Monte Carlo bounds and degenerate cases");
{
  const mkCase = (extra) => Object.assign({
    name: "MC", currentPrice: "10",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "50000000", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "800000000", yearsToPeak: "6", profile: "median" } }]
  }, extra || {});
  const tv = { enabled: false };
  const at = (c, pos, share, dr) => api.computeCaseValuation(c,
    { label: "x", shareMultiplierPct: share, posMultiplierPct: pos, discountRateAddPct: dr, color: "" }, null, 12, tv).equity.perShare;

  // FIN-010 (a): Bear = Bull = 80 on PoS, share and discount rate held equal
  // too. Every draw must BE the bound, so the whole distribution collapses to
  // the deterministic valuation at PoS 80%. f49689f drew 100 instead.
  const flat80 = mkCase({ scenarioOverrides: {
    bear: { posMultiplierPct: "80", shareMultiplierPct: "100", discountRateAddPct: "0" },
    bull: { posMultiplierPct: "80", shareMultiplierPct: "100", discountRateAddPct: "0" } } });
  const mc80 = api.computeFullCaseMonteCarlo(flat80, 12, tv, 200);
  const want80 = at(flat80, 80, 100, 0);
  near("Bear = Bull = 80: p10 is the valuation at PoS 80%", mc80.percentiles.p10, want80, 1e-6);
  near("Bear = Bull = 80: p90 is the same value", mc80.percentiles.p90, want80, 1e-6);
  ok("and differs from the value at 100% (so the test can tell them apart)", Math.abs(want80 - at(flat80, 100, 100, 0)) > 1e-3);

  // FIN-010 (b): a 50% case-level Base-PoS adjustment scales all three presets:
  // Bear 70 x 0.5 = 35, Base 100 x 0.5 = 50, Bull 130 x 0.5 = 65. Per-share
  // value rises with PoS, so every trial must land within
  // [value at 35%, value at 65%]. With the mode stuck at 100, f49689f drew up
  // to 35 + sqrt(1 x 30 x 65) = 35 + 44.2 = ~79, past Bull.
  const adj = mkCase({ basePosAdjustmentPct: "50", scenarioOverrides: {
    bear: { shareMultiplierPct: "100", discountRateAddPct: "0" },
    bull: { shareMultiplierPct: "100", discountRateAddPct: "0" } } });
  const lo = at(adj, 35, 100, 0), hi = at(adj, 65, 100, 0);
  const mcAdj = api.computeFullCaseMonteCarlo(adj, 12, tv, 600);
  const vals = mcAdj.sortedValues;
  ok("with a Base-PoS adjustment every trial stays at or above the Bear value", vals[0] >= lo - 1e-6);
  ok("and at or below the Bull value", vals[vals.length - 1] <= hi + 1e-6);
  ok("600 trials, none failed", mcAdj.validTrials === 600 && mcAdj.errors === 0);

  // FIN-009: everything degenerate AT Base (Bear = Base = Bull on all three
  // dials) — the Monte Carlo must reproduce the deterministic Base per-share
  // value at every percentile and in the mean.
  const flatBase = mkCase({ scenarioOverrides: {
    bear: { posMultiplierPct: "100", shareMultiplierPct: "100", discountRateAddPct: "0" },
    bull: { posMultiplierPct: "100", shareMultiplierPct: "100", discountRateAddPct: "0" } } });
  const det = api.computeCaseValuation(flatBase, api.getEffectiveScenarioPreset(flatBase, "base"), "base", 12, tv).equity.perShare;
  const mcB = api.computeFullCaseMonteCarlo(flatBase, 12, tv, 150);
  ["p10", "p25", "p50", "p75", "p90"].forEach(k => near("degenerate at Base: " + k + " = deterministic Base per-share", mcB.percentiles[k], det, 1e-6));
  near("degenerate at Base: the mean too", mcB.mean, det, 1e-6);
  ok("the requested iteration count is honoured", mcB.iterations === 150 && mcB.validTrials === 150);
}
report();

section("FIN-007: implied PoS is expressed against the override baseline");
{
  // A 30% PoS override means "my assumption is 30%" — by definition, whatever
  // the Oncology Phase 2 benchmark says. The solver finds the multiplier M that
  // makes fair value equal the price; the implied absolute PoS is then
  // 30% x M/100. Round trip: re-valuing the case with the override SET TO that
  // implied figure must reproduce the market price (equity = price x shares).
  const c = {
    name: "IP", currentPrice: "12",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "20000000", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "800000000", yearsToPeak: "6", profile: "median" }, posOverridePct: "30" }]
  };
  const tv = { enabled: false };
  const sol = api.solveImpliedPoSMultiplier(c, 12, tv);
  ok("the fixture solves without hitting a range limit", sol.ok && !sol.degenerate);
  near("'your PoS assumption' is the 30% override, not the benchmark", sol.baseAbsolutePct, 30, 1e-9);
  near("implied absolute = 30% x multiplier", sol.impliedAbsolutePct, 30 * sol.multiplierPct / 100, 1e-9);
  const c2 = JSON.parse(JSON.stringify(c)); c2.programs[0].posOverridePct = String(sol.impliedAbsolutePct);
  const ps = api.computeCaseValuation(c2, { label: "b", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" }, null, 12, tv).equity.perShare;
  near("valuing at the implied PoS reproduces the $12 price", ps, 12, 1e-4);
}
report();

section("FIN-008: PRV contribution, worked longhand");
{
  // A $150M priority review voucher, granted only on approval, so risked by the
  // program's P(launch) and discounted from its launch year:
  //   P(launch) = 10% (a 10% override at a 100% Base multiplier)
  //   launch year 3, discount rate 12%:  1.12^3 = 1.12 x 1.12 x 1.12 = 1.404928
  //   $150,000,000 x 0.10 = $15,000,000;  15,000,000 / 1.404928 = $10,676,703.72
  //   (1.12^3 = 21952/15625 exactly; check: 10,676,703.72 x 1.404928 = 15,000,000.00.
  //   This comment first said 10,676,774.3 — a slip in the long division, which
  //   the engine's figure exposed; verified with exact rational arithmetic.)
  const c = {
    name: "PRV", currentPrice: "10",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "0", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase3", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "400000000", yearsToPeak: "6", profile: "median" },
      posOverridePct: "10", launchYearOffset: "3", prv: { enabled: true, valueM: "150" } }]
  };
  const base = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const withPrv = api.computeCaseValuation(c, base, null, 12, { enabled: false });
  near("PRV added = $150M x 10% / 1.12^3 = $10,676,703.72", withPrv.equity.prvValueAdded, 10676703.72, 0.01);
  const noPrv = JSON.parse(JSON.stringify(c)); noPrv.programs[0].prv = { enabled: false, valueM: "150" };
  const without = api.computeCaseValuation(noPrv, base, null, 12, { enabled: false });
  near("and it is exactly the equity-value difference", withPrv.equity.equityValue - without.equity.equityValue, 10676703.72, 0.01);
  near("which is $1.0676704 per share on 10M shares", withPrv.equity.perShare - without.equity.perShare, 1.067670372, 1e-8);
  // Launch year 0 means already launched: no discounting, still risked.
  const now = JSON.parse(JSON.stringify(c)); now.programs[0].launchYearOffset = "0";
  near("launch year 0: $150M x 10% undiscounted = $15,000,000",
    api.computeCaseValuation(now, base, null, 12, { enabled: false }).equity.prvValueAdded, 15000000, 0.1);
}
report();

section("FIN-011: the EV -> equity bridge foots");
{
  // Detailed capital structure at a $10 price:
  //   cash $100M, ordinary debt $20M, a $50M convertible with a $100 conversion
  //   price (so it does NOT convert and stays a debt claim), and a modelled
  //   $30M future raise.
  //   net cash = 100 - 20 - 50 + 30 = +$60M, so equity = EV + $60M.
  // The bridge's signed items must sum to exactly that. The old chip list
  // (EV + cash - debt) summed to EV + $80M: $20M off (= -50 + 30).
  const mk = (convPrice) => ({
    name: "B", currentPrice: "10",
    capitalStructure: { mode: "detailed", cash: "100000000", debt: "20000000", basicShares: "10000000",
      opts: "", optK: "", war: "", warK: "", convFace: "50000000", convPrice },
    futureRaise: { enabled: true, amountM: "30000000", priceOverride: "" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "600000000", yearsToPeak: "6", profile: "median" } }]
  });
  const base = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const sum = (steps) => steps.reduce((t, st) => t + (st.sign === 0 ? st.value : st.sign * st.value), 0);

  const r = api.computeCaseValuation(mk("100"), base, null, 12, { enabled: false });
  const steps = api.computeEquityBridgeSteps(mk("100"), r);
  near("non-converting convertible: the bridge sums to the equity value", sum(steps), r.equity.equityValue, 1e-3);
  near("equity = EV + $60M net cash (100 - 20 - 50 + 30)", r.equity.equityValue - r.npvResult.npv, 60e6, 1e-3);
  const conv = steps.find(st => st.key === "convertible");
  ok("the convertible appears as its own subtracted line", conv && conv.sign === -1 && conv.value === 50e6);
  const raise = steps.find(st => st.key === "raise");
  ok("the modelled raise appears as its own added line", raise && raise.sign === 1 && raise.value === 30e6);
  near("the old cash-and-debt-only list was off by exactly -$20M",
    r.equity.equityValue - (r.npvResult.npv + 100e6 - 20e6), -20e6, 1e-3);

  // $5 conversion price at a $10 share price: it converts into 50M / 5 = 10M
  // shares and leaves net cash, so no convertible line; net cash = 100 - 20 + 30.
  const r2 = api.computeCaseValuation(mk("5"), base, null, 12, { enabled: false });
  const steps2 = api.computeEquityBridgeSteps(mk("5"), r2);
  ok("a converting note is not shown as debt", !steps2.some(st => st.key === "convertible"));
  near("converting: the bridge still sums to the equity value", sum(steps2), r2.equity.equityValue, 1e-3);
  near("converting: equity = EV + $110M", r2.equity.equityValue - r2.npvResult.npv, 110e6, 1e-3);
  // 10M basic + 10M from conversion + 30M / $10 = 3M from the raise = 23M.
  near("converting: diluted shares = 10M + 10M + 3M", r2.equity.dilutedShares, 23e6, 1e-6);
}
report();

section("FIN-012: a Workspace peak-share override above 100% is capped and flagged");
{
  // 100,000 prevalent x 100% diagnosed x 100% treated x 100% eligible =
  // 100,000 eligible; adherence 80%.
  //   share 60%  -> 100,000 x 0.60 x 0.80 = 48,000 peak patients
  //   share 150% -> impossible; capped at 100% -> 100,000 x 1.00 x 0.80 = 80,000
  //   (f49689f computed 100,000 x 1.50 x 0.80 = 120,000)
  const rb = (share) => ({
    population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "80",
    marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: share },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: false },
    exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
  });
  near("share 60% -> 48,000 peak patients", api.computeProgramRevenue(rb("60"), 20).peakPatients, 48000, 1e-6);
  near("share 150% is capped: 80,000 peak patients, not 120,000", api.computeProgramRevenue(rb("150"), 20).peakPatients, 80000, 1e-6);
  near("share 100% is the cap itself", api.computeProgramRevenue(rb("100"), 20).peakPatients, 80000, 1e-6);
  const mkCase = (share) => ({ name: "S", capitalStructure: { mode: "simple", dilutedSharesSimple: "1" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "full", revenueBuild: rb(share) }] });
  const f150 = api.computeRedFlags(mkCase("150"));
  ok("a 150% override raises a high-severity flag that names the cap",
    f150.some(f => f.severity === "high" && /above 100%/.test(f.message) && /caps it at 100%/.test(f.message)));
  ok("and not a second, contradictory 'above benchmark' flag for the same field",
    f150.filter(f => /Peak share override/.test(f.message)).length === 1);
  ok("an override within 100% does not raise the cap flag", !api.computeRedFlags(mkCase("60")).some(f => /above 100%/.test(f.message)));
}
report();

section("NEW-001: Simple Multiple includes the PRV");
{
  // Same voucher as FIN-008: $150M x 10% P(launch) / 1.12^3 = $10,676,703.72.
  // It is granted on approval whichever method values the asset, so Simple
  // Multiple must add exactly the same amount the DCF does. f49689f added none.
  const c = {
    name: "PRV-SM", currentPrice: "10",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "0", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase3", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "400000000", yearsToPeak: "6", profile: "median" },
      posOverridePct: "10", launchYearOffset: "3", prv: { enabled: true, valueM: "150" } }]
  };
  const base = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const sm = api.computeSimpleMultipleValuation(c, base, null, 3, 12);
  near("Simple Multiple adds the PRV: $10,676,703.72", sm.equity.prvValueAdded, 10676703.72, 0.01);
  const off = JSON.parse(JSON.stringify(c)); off.programs[0].prv = { enabled: false, valueM: "150" };
  near("and it is exactly the equity difference", sm.equity.equityValue - api.computeSimpleMultipleValuation(off, base, null, 3, 12).equity.equityValue, 10676703.72, 0.01);
  near("the two methods add the identical PRV", sm.equity.prvValueAdded,
    api.computeCaseValuation(c, base, null, 12, { enabled: false }).equity.prvValueAdded, 1e-6);
  // Bear PoS 70% scales the voucher like the asset: 10% x 0.7 = 7% -> 0.7x.
  const bear = { label: "bear", shareMultiplierPct: 100, posMultiplierPct: 70, discountRateAddPct: 0, color: "" };
  near("Simple Multiple Bear: the PRV scales by exactly 0.7", api.computeSimpleMultipleValuation(c, bear, null, 3, 12).equity.prvValueAdded / sm.equity.prvValueAdded, 0.7, 1e-9);
  const steps = api.computeEquityBridgeSteps(c, sm);
  ok("and the bridge shows it as a line", steps.some(st => st.key === "prv" && Math.abs(st.value - 10676703.72) < 0.01));
}
report();

section("NEW-002: a scenario share multiplier cannot push share past 100%");
{
  // Scenario share multipliers scale patients linearly. With a 90% share,
  // Bull's 130% would mean 117% of eligible patients; capped, the most it can
  // be is 100%, so Bull/Base revenue = 100/90 = 1.1111..., not 1.3.
  // With a 50% share, 50% x 1.3 = 65% is possible, so the ratio stays 1.3.
  // Quick mode has no share and scales revenue by the full 1.3.
  const full = (share) => ({ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
    revenueMode: "full", revenueBuild: {
      population: { mode: "prevalence", prevalence: "100000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
      adherencePct: "80", marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: share },
      launchCurve: { yearsToPeak: 6, profile: "median" },
      pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: false },
      exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" } } });
  const quick = { id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
    revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" } };
  const base = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const bull = { label: "bull", shareMultiplierPct: 130, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const ratio = (prog) => api.computeProgramValuation(prog, bull, null).peakRevenue / api.computeProgramValuation(prog, base, null).peakRevenue;
  near("DCF: a 90% share under Bull scales by 100/90, not 1.3", ratio(full("90")), 100 / 90, 1e-3);
  near("DCF: a 50% share under Bull still scales by 1.3", ratio(full("50")), 1.3, 1e-3);
  near("DCF: Quick mode scales by the full 1.3", ratio(quick), 1.3, 1e-9);
  const mk = (prog) => ({ name: "S", currentPrice: "10", capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" }, programs: [prog] });
  const smRatio = (prog) => api.computeSimpleMultipleValuation(mk(prog), bull, null, 3, 12).programVals[0].peakRevenue
    / api.computeSimpleMultipleValuation(mk(prog), base, null, 3, 12).programVals[0].peakRevenue;
  near("Simple Multiple: a 90% share under Bull scales by 100/90", smRatio(full("90")), 100 / 90, 1e-3);
  near("Simple Multiple: a 50% share under Bull scales by 1.3", smRatio(full("50")), 1.3, 1e-3);
  // Bear (a multiplier below 1) is never capped.
  const bear = { label: "bear", shareMultiplierPct: 70, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  near("Bear scales a 90% share by the full 0.7",
    api.computeProgramValuation(full("90"), bear, null).peakRevenue / api.computeProgramValuation(full("90"), base, null).peakRevenue, 0.7, 1e-3);
}
report();

// ════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(64));
if (fail === 0) {
  console.log(`ALL MATH VERIFICATION PASSED — ${pass} checks`);
} else {
  console.log(`${pass} passed, ${fail} FAILED\n`);
  failures.forEach(f => console.log("  ✗ " + f));
}
console.log("═".repeat(64));
process.exit(fail === 0 ? 0 : 1);
