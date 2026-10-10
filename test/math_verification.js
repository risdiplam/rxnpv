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
  "ts_chart.js", "netEngine.js", "edgarEngine.js", "ctgovEngine.js", "trialDecoder.js", "trialResults.js", "openTargetsEngine.js", "literatureEngine.js", "assetProgram.js", "cmsEngine.js", "commercialEngine.js", "ts_ctgovEngine.js", "fdaEngine.js", "chart.js", "ts_fdaEngine.js"
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
  "computeProgramValuation", "computeCaseValuation", "baseCaseFairValue", "computeProjectionRows", "computeSensitivityDrivers", "computeProgramRiskWaterfall",
  "computeEffectivePoS", "computeRnDToLaunch", "launchCurveForYears", "resolveLaunchYearOffset",
  "computeFullCaseMonteCarlo", "solveImpliedPoSMultiplier", "solveImpliedVariable", "computeCompanyActiveByYear", "computeCompanyRiskAdjustedCF", "computeFailureFloor", "redFlagKey", "splitConsideredFlags", "markFlagConsidered", "futureRaisePrice", "napkinBuildPeakMismatch", "buildModelSnapshot", "EXUS_LAUNCH_LAG_BENCHMARK", "effectiveCapitalStructure", "computeEquityBridgeSteps", "computeRedFlags", "quickModeTerritoryMismatch",
  "computePortfolioSummary", "shrinkBinaryResponseRate", "shrinkHazardRatio",
  "BINARY_SHRINKAGE_FACTOR", "HR_SHRINKAGE_FACTOR",
  "MODALITY_OPTIONS", "getCogsBenchmark", "getErosionDefaults", "resolveErosionParams",
  "COGS_BENCHMARKS", "EXCLUSIVITY_BENCHMARKS",
  "samplePrior", "priorQuantile", "simulateTimeToEventReplicate", "runAssuranceSimulation",
  "runPeakSalesSimulation", "driverSensitivity", "percentSpecToFraction", "percentSpecError", "renderIconArray",
  "niceTicks", "formatTick", "formatRegisteredP", "parseCatalystHit", "sponsorNameFromEntity", "renderLineChart", "renderHistogram", "renderForestPlot",
  "treasuryMethodShares", "ifConvertedShares", "computeEquityValue", "applyFutureRaise",
  "classifyCatalystFunding", "computeRunwayVsCatalysts", "monthsUntil", "parseCatalystDate", "parseCatalystWindow", "nextCaseCatalyst", "computeFreshness", "newerFinancialFiling", "catalystPinLabel", "computeFailureFloorPair", "floorZeroReason", "impliedHeldFixed", "summarizeObservedEffects", "analogPriorPresets", "applyIraClock", "suggestedIraYears", "matchLaunchShape", "applyConditionMerges", "summarizeAssetProgram", "findInsiderBuyCluster", "extractLimitationsOfUse", "labelDate", "biologicExclusivityFloor", "optionsImpliedMove", "modelImpliedMove", "readImpliedMove", "orderByCompletion", "computePortfolioCatalysts", "addModelSnapshot", "isModelSnapshot", "modelSnapshotLabel", "buildDecisionMemo", "computeCaseValuation", "getEffectiveScenarioPreset", "caseFacilities", "facilitiesPhrase", "computeForwardRunway", "computeFinancingBridge", "forwardBalanceAt", "edgarCashSource", "baseCaseFairValue", "assuranceToCaseOdds", "applyAssuranceToProgram", "posFromSimulator", "describePosSource", "pendingCalibrationEntries", "failureFloorBurnPlan", "RUNWAY_CUSHION_MONTHS_DEFAULT",
  "summarizeOrangeBookPatents", "isPediatricExtension", "parseFdaYyyymmdd",
  "computeBinaryEventImpliedPoS", "selectPeakSalesCompWindow",
  "applyTaxToCalendar", "computeMoleculeTypePoSRatios", "POS_BY_MOLECULE",
  "computeProgramValuation",
  "revenueChartYScale", "niceAxisTicks", "placeDiagonalLabel", "placePointLabel", "measureLabel", "histogramBins", "spreadLabels", "localDateStamp", "selectPeakSalesCompWindow",
  "readPriceVsScenarios", "readMonteCarlo", "readCashFlow", "readSotp", "readRiskWaterfall", "readTornado", "readPriceGrid", "readInterval", "readPValue", "readSingleArm", "readAssurance", "readPeakSalesRange", "readBinaryImplied", "readPremium", "readForwardRunway", "readBreakEven", "readPriceGap", "readOutcomeRange", "possessive", "aNum", "filterStudiesByCondition", "conditionQueryWords", "conditionDropNote", "compareTrials", "compareTrialsWeeks", "readTrialComparison",
  "measureStorage", "STORAGE_ASSUMED_QUOTA_BYTES", "STORAGE_WARN_FRACTION", "STORAGE_CRITICAL_FRACTION",
  "computeTreatedPopulation", "launchCurveForYears", "erosionMultiplier", "computeProgramRevenue",
  "resolveNetPrice", "aspPctOfBasis", "PRICE_BASIS_OPTIONS", "getRevenueBuild", "PRICING_CONVERSION_MATRIX", "priceBasisArticle",
  "computeQuickProgramRevenue", "resolveErosionParams", "LAUNCH_CURVE", "LAUNCH_CURVE_EXACT", "scaleRevenueResult",
  "computeCOGS", "computeSalesForceCost", "computeMarketingCost", "computeCorporateGA", "computeProgramPnL", "licensorObligationsByYear", "hasLicensorObligations",
  "SALES_REP_COST", "SGA_BENCHMARKS", "SALES_FORCE_COMP_GROWTH_PCT",
  "tsFdaQueryString", "computeDilutionPath",
  "extractAnalogEffects", "tsClassifyEffectParam", "summarizeDossier", "positionInAnalogs",
  "decodeTrial", "decodeTrialRedFlags", "classifyAllocation", "classifyMasking", "classifyComparator", "classifyPrimaryEndpoint",
  "parseTrialResults", "parseResultOutcomes", "summarizeParticipantFlow", "summarizeAdverseEvents",
  "classifyPublication", "parseEpmcResult", "summarizeLiterature", "epmcClean",
  "summarizeAssetProgram", "describeEvidenceBase", "studyNamesIntervention", "assetProgramNames", "assetPhaseRank", "ASSET_PROGRAM_FIELDS",
  "parseCmsPeriodLabel", "parseCmsAnnualRow", "parseCmsQuarterlyRow", "pickOverallRows",
  "mergeDrugSpendSeries", "addComparablePeriodGrowth", "impliedAnnualRunRate", "cmsSeriesFreshness", "indexToLaunch", "cmsNum", "CMS_DATASETS", "cmsNormalizeName", "cmsDisplayName",
  "combineSamePeriods", "parseCmsAnnualRows", "drugNameKey", "ndcProductCodes", "pickDrugIdentity", "sdudNameMatches", "summariseSdudQuarters", "sdudPeriod",
  "addComparableMedicaidGrowth", "combinePayerSeries", "payerTotalSeries", "payerPriceFigures", "PART_B_ASP_ADD_ON",
  "normalizeActualEntry", "impliedAnnualFromActual", "modelYearForCalendar", "compareActualToModel", "actualVsModelSeries",
  "diffTrialSnapshots", "snapshotPredatesDesignFields",
  "resultsRedFlags", "trUnescape", "trNum", "trRate", "trMonthsBetweenDates",
  "applyPartnershipToRevenue", "getProgramRevenueResult", "computePartnershipContribution", "distributeRnDCostByYear",
  "computeSimpleMultipleValuation", "computeSOTPBreakdown",
  "periodMonths", "sumTranchesAtLatestDate", "calcRunwayFromFacts", "extractDebt", "edgarFullyDilutedShares", "edgarAsOf",
  "extractSharesOutstanding", "extractDilutedShares", "extractOptions", "extractWarrants",
  "summarizeOpenMarketActivity", "FORM4_CODE_LABELS",
  "extractConvertibleNotes", "pickLatestUnit", "isFilingForm", "formatHalfLife",
  "programLabel", "extractPreferredShares", "studyNamesAnyDrug",
  "licenceRoyaltyOn", "licenceTiers", "sharedLicenceFor", "effectiveLicensor", "drugLicenceExpectedByYear", "computeSOTPBreakdown",
  "computeCatalystLadder", "computeRangeOfEndings",
  "subgroupInteraction", "falsePositiveRisk", "safetyUpperBound", "interimBoundary", "hazardRatioForZ", "conditionalPower",
  "readMeaningfulEffect", "readSubgroup", "readSafetyExposure", "scanPressRelease", "peakAboveAreaComps",
  "fdaGoalDate", "estimatePatentTermExtension"
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
  // Both attributes pushing the same way: the STRONGER single effect, not the
  // product. Oncology Phase 2 = 24.6%. Rare: 50.6/30.7 = 1.64821; biomarker:
  // 46.7/30.7 = 1.52117 → max 1.64821 → 24.6 × 1.64821 = 40.546%. (The old
  // product rule gave 24.6 × 2.50722 = 61.68%.) Regulatory: max(+3.9, +9.2)
  // = +9.2 → 88.4 + 9.2 = 97.6% (was 101.5, clamped).
  near("both lifts: Phase 2 uses the stronger one (40.546%, not 61.68%)", both.stages.find(s => s.key === "phase2").pos * 100, 24.6 * (50.6 / 30.7), 1e-9);
  near("both lifts: Phase 3 = 40.1 × max(73.6, 76.5)/58.1 = 52.799%", both.stages.find(s => s.key === "phase3").pos * 100, 40.1 * (76.5 / 58.1), 1e-9);
  near("both lifts: regulatory = 88.4 + max(3.9, 9.2) = 97.6%", both.stages.find(s => s.key === "regulatory").pos * 100, 97.6, 1e-9);
  // Both pulling down: the stronger drag. Chronic/high-prevalence 27.7/30.7 =
  // 0.90228, no biomarkers 28.8/30.7 = 0.93811 → min 0.90228 → 24.6 × 0.90228 = 22.196%.
  // Regulatory deltas point opposite ways (+1.9, −1.4) → they offset: +0.5.
  const drag = api.computePoSWeighting({ ...base, posBiomarkerUse: "none", posDiseaseType: "chronicHighPrev" });
  near("both drags: Phase 2 uses the stronger drag (22.196%)", drag.stages.find(s => s.key === "phase2").pos * 100, 24.6 * (27.7 / 30.7), 1e-9);
  near("opposite regulatory deltas offset: 88.4 + 1.9 − 1.4 = 88.9%", drag.stages.find(s => s.key === "regulatory").pos * 100, 88.9, 1e-9);
  // A lift and a drag (rare + no biomarkers) offset: product 1.64821 × 0.93811.
  const mixed = api.computePoSWeighting({ ...base, posBiomarkerUse: "none", posDiseaseType: "rare" });
  near("a lift and a drag offset: 24.6 × 1.64821 × 0.93811 = 38.036%", mixed.stages.find(s => s.key === "phase2").pos * 100, 24.6 * (50.6 / 30.7) * (28.8 / 30.7), 1e-9);
  // The case that exposed it: Neurology Phase 2, rare + biomarker, small molecule.
  // Phase 2: 29.7 × 1.64821 × (31.4/30.7 = 1.02280) = 50.070%;
  // Phase 3: 57.3 × (76.5/58.1 = 1.31670) × (59.6/58.1 = 1.02582) = 77.394%;
  // regulatory 97.6% → launch = 0.50070 × 0.77394 × 0.976 = 37.82%, in line with
  // Thomas's rare-disease cohort from Phase 2 (~34%), not the 74% the product gave.
  const neuro = api.computePoSWeighting({ therapeuticArea: "Neurology", currentPhase: "phase2", modality: "smallMolecule", posBiomarkerUse: "selection", posDiseaseType: "rare" });
  near("Neurology Ph2 rare + biomarker + NME: 37.82% to launch (was 74%)", neuro.posToLaunch * 100,
    29.7 * (50.6 / 30.7) * (31.4 / 30.7) * 57.3 * (76.5 / 58.1) * (59.6 / 58.1) * 97.6 / 1e4, 1e-9);
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
  // Longhand: SE = sqrt(0.2*0.8/100 + 0.4*0.6/100) = sqrt(0.004) = 0.0632456;
  // half-width 1.959964 * 0.0632456 = 0.1239590 -> RD CI (-0.3239590, -0.0760410).
  // NNT CI = (1/0.3239590, 1/0.0760410) = (3.08681, 13.15080), low to high.
  // (These two checks used to assert lower = |1/rd.upper| — the formula the
  // code used — which for a negative RD is the LARGER number, so the suite
  // passed while the UI printed "13.2 to 3.1".)
  near("NNT CI lower = 1/0.3239590 = 3.08681", nnt.lower, 3.08681, 1e-4);
  near("NNT CI upper = 1/0.0760410 = 13.15080", nnt.upper, 13.15080, 1e-4);
  const nntPos = api.computeNNT(40, 100, 20, 100);
  ok("the same table with arms swapped (positive RD) gives the same NNT interval", Math.abs(nntPos.lower - 3.08681) < 1e-4 && Math.abs(nntPos.upper - 13.15080) < 1e-4);

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
// The observed hazard ratio each replicate reports (the assurance tab's
// histogram) must centre on the true one. It was the treatment arm's
// observed/expected alone, O1/E1, which sits between HR and 1: with equal
// arms and most events seen it is ~2HR/(1+HR), 0.82 for a true 0.70, so the
// histogram sat well right of the "prior mean" marker and read as trials
// seeing a weaker effect than the truth. The log-rank estimate divides by
// the control arm's O2/E2. 300 a side, 12-month control median, 18 months
// accrual + 12 follow-up: ~440 events, SE of log HR ~ 2/sqrt(440) = 0.095,
// so the median of 600 replicates is within ~0.005 on the log scale.
{
  const design = { nControl: 300, nTreat: 300, medianControl: 12, accrualPeriod: 18, followupPeriod: 12, sided: "two" };
  for (const hr of [0.6, 0.7, 0.85]) {
    const xs = [];
    for (let i = 0; i < 600; i++) xs.push(api.simulateTimeToEventReplicate(design, hr).observedEffect);
    xs.sort((a, b) => a - b);
    near("observed hazard ratio centres on the true " + hr + " (median of 600 replicates)", xs[300], hr, 0.03);
  }
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
  // Only the decimals the step needs: a $100M step reads 400M, not 400.00M.
  ok("formatTick: 400,000,000 on a 100M step is '400M'", api.formatTick(4e8, 1e8) === "400M");
  ok("formatTick: 1,250,000 on a 250K step is '1.25M'", api.formatTick(1.25e6, 2.5e5) === "1.25M");
  ok("formatTick: 1,000 on a 200 step is '1K'; 2.5B on a 0.5B step is '2.5B'", api.formatTick(1000, 200) === "1K" && api.formatTick(2.5e9, 5e8) === "2.5B");
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
section("Asset Program: merging condition names for one disease");
{
  const st = (id, conds) => ({ nctId: id, phase: "PHASE2", conditions: conds, interventions: ["PGN-EDODM1"], interventionOtherNames: [] });
  const raw = api.summarizeAssetProgram([st("N1", ["Myotonic Dystrophy Type 1"]), st("N2", ["DM1", "Myotonic Dystrophy Type 1"]), st("N3", ["Steinert Disease"]), st("N4", ["Healthy volunteers"])], "PGN-EDODM1");
  ok("unmerged: four registry strings, four indications", raw.indications.length === 4 && raw.evidence.indicationCount === 4);
  const m = api.applyConditionMerges(raw, [{ name: "DM1", members: ["Myotonic Dystrophy Type 1", "dm1", "Steinert Disease"] }]);
  const dm1 = m.indications.find(x => x.condition === "DM1");
  ok("merged: three strings become one, so two indications (the evidence checklist count too)", m.indications.length === 2 && m.evidence.indicationCount === 2);
  ok("a trial naming two members counts once: DM1 in 3 trials, not 4", dm1 && dm1.trials === 3);
  ok("the raw strings are kept on the row (case-insensitive match)", dm1.mergedFrom.length === 3 && dm1.mergedFrom.includes("DM1"));
  ok("no merges: the summary is returned as it was", api.applyConditionMerges(raw, []) === raw);
}
section("An analog's launch shape against the published curves");
{
  // Spending that follows the 5-year median curve (15, 42, 68, 86, 100% of
  // peak) then plateaus: median, 5 years. Scaled to $40M at peak.
  const pt = (i, v, extra) => Object.assign({ spending: v, periodsSinceFirst: i, isFullYear: true }, extra || {});
  const med = [15, 42, 68, 86, 100, 98, 97].map((v, i) => pt(i, v * 0.4e6));
  const m = api.matchLaunchShape(med);
  ok("the 5-year median curve is matched as median, 5 years to peak", m.ok && m.profile === "median" && m.yearsToPeak === 5 && !m.stillRising);
  near("... with no error", m.rmse, 0, 1e-9);
  const fast = [25, 53, 78, 94, 100, 99].map((v, i) => pt(i, v));
  ok("the 5-year fast curve (25, 53, 78, 94, 100) is matched as fast", api.matchLaunchShape(fast).profile === "p75");
  const rising = [10, 30, 55, 75].map((v, i) => pt(i, v));
  ok("still rising in the last full year: flagged, years to peak a lower bound", api.matchLaunchShape(rising).stillRising === true && api.matchLaunchShape(rising).yearsToPeak === 4);
  ok("selling before the data starts: refused, with the reason", !api.matchLaunchShape(med.map((p, i) => i === 0 ? { ...p, launchPredatesData: true } : p)).ok);
  ok("fewer than three full years: refused", !api.matchLaunchShape([pt(0, 10), pt(1, 30)]).ok);
  ok("a partial year is left out of the fit", api.matchLaunchShape(med.concat([pt(7, 10, { isFullYear: false })])).profile === "median");
}
section("Owed to a licensor: royalty, milestones, the share of partner income");
{
  // Year by year, by hand. Own net sales $100M, $200M, $300M; partner royalty
  // income $10M a year. 10% royalty → $10M, $20M, $30M. 5% of partner income
  // → $0.5M a year. $25M on approval → year 1. Sales milestones: $20M at
  // $150M a year (first reached in year 2), $50M at $1B (never reached).
  const lic = { enabled: true, royaltyPct: "10", sublicensePct: "5", approvalMilestoneM: "25", salesMilestones: [{ thresholdM: "150", paymentM: "20" }, { thresholdM: "1000", paymentM: "50" }] };
  const o = api.licensorObligationsByYear([100e6, 200e6, 300e6], [10e6, 10e6, 10e6], lic);
  ok("royalty: 10% of own sales each year", JSON.stringify(o.royalty) === JSON.stringify([10e6, 20e6, 30e6]));
  ok("share of partner income: 5% of $10M each year", JSON.stringify(o.share) === JSON.stringify([5e5, 5e5, 5e5]));
  ok("milestones: $25M on approval in year 1, $20M when sales first reach $150M (year 2), the $1B one never", JSON.stringify(o.milestones) === JSON.stringify([25e6, 20e6, 0]));
  ok("total = the three added: $35.5M, $40.5M, $30.5M", JSON.stringify(o.total) === JSON.stringify([35.5e6, 40.5e6, 30.5e6]));
  ok("off: nothing owed", api.licensorObligationsByYear([100e6], [0], { ...lic, enabled: false }).total[0] === 0);
  ok("ticked with nothing entered is not an obligation", api.hasLicensorObligations({ licensor: { enabled: true, royaltyPct: "", salesMilestones: [] } }) === false && api.hasLicensorObligations({ licensor: lic }) === true);
  ok("rates are clamped to 0–100%", api.licensorObligationsByYear([100e6], [0], { enabled: true, royaltyPct: "250" }).royalty[0] === 100e6);

  // Through the P&L: product contribution falls by exactly what is owed.
  const rr = { years: [{ year: 1, totalRevenue: 100e6 }, { year: 2, totalRevenue: 200e6 }], peakTotalRevenue: 200e6 };
  const cost = { cogsPct: "10", reps: {}, marketingPctOfPeak: "0", yearsToLOE: "12", launchYearOffset: 1 };
  const a = api.computeProgramPnL(rr, cost), b = api.computeProgramPnL(rr, { ...cost, licensor: { enabled: true, royaltyPct: "8", approvalMilestoneM: "5" } });
  ok("product contribution falls by 8% of sales plus $5M in year 1 ($13M), $16M in year 2", a[0].productContribution - b[0].productContribution === 13e6 && a[1].productContribution - b[1].productContribution === 16e6 && b[0].licensorTotal === 13e6);

  // Through the valuation: on the PepGen fixture with tax off, a 5% royalty
  // lowers the enterprise value by exactly the present value of 5% of each
  // year's revenue × the odds of launch — computeNPV on that series alone
  // (linear without a terminal value).
  const pgF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  // Start from the fixture without its own 1% OUI royalty.
  const pg0 = { ...pgF, taxation: { ...(pgF.taxation || {}), enabled: false }, terminalValue: { enabled: false }, programs: [{ ...pgF.programs[0], licensor: { enabled: false } }] };
  const pgL = { ...pg0, programs: [{ ...pg0.programs[0], licensor: { enabled: true, royaltyPct: "5" } }] };
  const dr = Number(pg0.discountRatePct), tvOff = { enabled: false };
  const v0 = api.computeCaseValuation(pg0, api.getEffectiveScenarioPreset(pg0, "base"), "base", dr, tvOff);
  const v1 = api.computeCaseValuation(pgL, api.getEffectiveScenarioPreset(pgL, "base"), "base", dr, tvOff);
  const pv0 = v0.programVals[0], rev = api.getProgramRevenueResult(pg0.programs[0], 25).years.map(y => y.totalRevenue);
  const series = v0.calendar.map((c, cy) => { const i = cy - (pv0.launchYearOffset || 0); return i >= 0 && rev[i] != null ? -Math.round(rev[i] * 0.05) * pv0.posToLaunch : 0; });
  near("PepGen: EV falls by the PV of 5% of revenue × the odds of launch", v1.npvResult.npv - v0.npvResult.npv, api.computeNPV(series, dr, tvOff, series.map(() => 0)).npv, 1);
  ok("... and so does Base per share (" + v0.equity.perShare.toFixed(4) + " → " + v1.equity.perShare.toFixed(4) + ")", v1.equity.perShare < v0.equity.perShare);

  // Partner payments: 5% of an upfront goes on to the licensor.
  const partnered = { programs: [{ ...pg0.programs[0], partnership: { enabled: true, upfrontM: "10", milestones: [] }, licensor: { enabled: true, sublicensePct: "5" } }] };
  near("a $10M upfront with a 5% sublicense fee adds $9.5M", api.computePartnershipContribution(partnered, 0.12), 9.5e6, 1e-6);

  // Napkin: the multiple applies to peak revenue less the royalty at peak;
  // the approval milestone comes off at its odds-weighted present value.
  // Quick program, $500M peak, 4x, launch in year 2, 5 years to peak, 13%:
  // value drop = 500M × 10% × 4 × p / 1.13^7 + 25M × p / 1.13^2.
  const qp = { ...pg0.programs[0], revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "5", profile: "median" }, launchYearOffset: "2", partnership: { enabled: false } };
  const qc = { ...pg0, programs: [qp] };
  const qcL = { ...pg0, programs: [{ ...qp, licensor: { enabled: true, royaltyPct: "10", approvalMilestoneM: "25" } }] };
  const sm0 = api.computeSimpleMultipleValuation(qc, api.getEffectiveScenarioPreset(qc, "base"), "base", 4, 13);
  const sm1 = api.computeSimpleMultipleValuation(qcL, api.getEffectiveScenarioPreset(qcL, "base"), "base", 4, 13);
  const p = sm0.programVals[0].posToLaunch, ly = sm0.programVals[0].launchYearOffset;
  near("Napkin: the drop is the royalty at peak × the multiple plus the approval milestone, both at odds and discounted", sm0.programVals[0].pv - sm1.programVals[0].pv,
    500e6 * 0.10 * 4 * p / Math.pow(1.13, ly + 5) + 25e6 * p / Math.pow(1.13, ly), 1);
}
section("The IRA clock: opt-in, no default cut, US revenue only");
{
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const p = st.programs[0];
  const base = api.getProgramRevenueResult(p, 25);
  const on = api.getProgramRevenueResult({ ...p, ira: { enabled: true, reductionPct: "40", effectiveYears: "9" } }, 25);
  ok("years 1-9 unchanged; from year 10 US revenue is 60%, ex-US untouched",
    on.years.slice(0, 9).every((r, i) => r.usRevenue === base.years[i].usRevenue) &&
    on.years.slice(9).every((r, i) => Math.abs(r.usRevenue - Math.round(base.years[i + 9].usRevenue * 0.6)) <= 1 && r.exUSRevenue === base.years[i + 9].exUSRevenue && r.totalRevenue === r.usRevenue + r.exUSRevenue));
  const blank = api.getProgramRevenueResult({ ...p, ira: { enabled: true, reductionPct: "", effectiveYears: "9" } }, 25);
  ok("ticked with no cut: identical to off", JSON.stringify(blank.years) === JSON.stringify(base.years));
  const quick = { ...p, revenueMode: "quick", quickRevenue: { peakRevenue: "1000000000", yearsToPeak: "5", profile: "median" }, partnership: { enabled: false } };
  const qb = api.getProgramRevenueResult(quick, 25), qo = api.getProgramRevenueResult({ ...quick, ira: { enabled: true, reductionPct: "50", effectiveYears: "9" } }, 25);
  ok("Quick mode (no US/ex-US split): all revenue from year 10 is halved", qo.years.slice(9).every((r, i) => Math.abs(r.totalRevenue - Math.round(qb.years[i + 9].totalRevenue * 0.5)) <= 1));
  ok("suggested effective year: 9 for a small molecule, 13 for a biologic", api.suggestedIraYears({ modality: "smallMolecule" }) === 9 && api.suggestedIraYears({ modality: "biologic" }) === 13);
  const v = c => api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, "base"), "base", Number(st.discountRatePct), st.terminalValue).equity.perShare;
  const withIra = { ...st, programs: [{ ...p, ira: { enabled: true, reductionPct: "40", effectiveYears: "9" } }] };
  ok("on, it lowers Base (" + v(st).toFixed(2) + " → " + v(withIra).toFixed(2) + "); off, the sample is untouched", v(withIra) < v(st) && Math.abs(v({ ...st, programs: [{ ...p, ira: { enabled: false, reductionPct: "40", effectiveYears: "9" } }] }) - v(st)) < 1e-9);
}
section("Smaller items: insider clusters, label limitations, the biologic floor");
{
  const tx = (owner, date, code, usd) => ({ ownerName: owner, date, code, valueUsd: usd, shares: 1000 });
  const cl = api.findInsiderBuyCluster([tx("CEO", "2026-03-01", "P", 100e3), tx("CFO", "2026-03-10", "P", 50e3), tx("Director", "2026-03-25", "P", 25e3), tx("CEO", "2026-05-01", "P", 10e3), tx("COO", "2026-03-12", "A", 0), tx("COO", "2026-03-13", "M", 0)]);
  ok("three insiders buying inside 30 days is a cluster (the award and the exercise do not count)", cl && cl.kind === "cluster" && cl.insiders === 3 && cl.count === 3 && cl.start === "2026-03-01" && cl.end === "2026-03-25");
  near("... $175K total", cl.totalUsd, 175e3, 1e-9);
  const one = api.findInsiderBuyCluster([tx("CEO", "2026-03-01", "P", 1), tx("CEO", "2026-03-05", "P", 1), tx("CEO", "2026-03-20", "P", 1)]);
  ok("one insider, three buys: reported as one insider, not a cluster", one && one.kind === "single" && one.names[0] === "CEO");
  ok("awards only: nothing", api.findInsiderBuyCluster([tx("A", "2026-03-01", "A", 0), tx("B", "2026-03-02", "A", 0), tx("C", "2026-03-03", "A", 0)]) === null);
  ok("three insiders spread over 60 days: no cluster", api.findInsiderBuyCluster([tx("A", "2026-01-01", "P", 1), tx("B", "2026-02-15", "P", 1), tx("C", "2026-03-01", "P", 1)]) === null);

  const ind = "1 INDICATIONS AND USAGE DRUGX is indicated for the treatment of Duchenne muscular dystrophy in patients with a confirmed mutation. This indication is approved under accelerated approval based on an increase in dystrophin. Limitations of Use: DRUGX has not been studied in patients over 18 years. 2 DOSAGE AND ADMINISTRATION 2.1 Dosing";
  ok("limitations of use: the sentence after the heading, up to the next numbered section", api.extractLimitationsOfUse(ind) === "DRUGX has not been studied in patients over 18 years.");
  // The shape of Wegovy's live label (2024-04-23): the limitation, then
  // openFDA's field repeats the highlights, starting "WEGOVY is a …".
  ok("stops where the label's highlights repeat (Wegovy's shape)", api.extractLimitationsOfUse("with obesity. Limitations of Use • WEGOVY contains semaglutide. Coadministration with other GLP-1 receptor agonists is not recommended. WEGOVY is a glucagon-like peptide-1 (GLP-1) receptor agonist indicated in combination with diet") === "WEGOVY contains semaglutide. Coadministration with other GLP-1 receptor agonists is not recommended.");
  ok("no such heading: null (nothing about accelerated approval is extracted)", api.extractLimitationsOfUse("1 INDICATIONS AND USAGE DRUGX is indicated for X.") === null);
  ok("label date from openFDA's effective_time", api.labelDate("20240315") === "2024-03-15" && api.labelDate("") === null);

  const fl = api.biologicExclusivityFloor([{ applicationType: "BLA", firstApprovalDate: "20140904" }, { applicationType: "BLA", firstApprovalDate: "20170101" }, { applicationType: "NDA", firstApprovalDate: "20100101" }]);
  ok("biologic floor: 12 years from the earliest BLA licensure (2014-09-04 → 2026-09-04); NDAs ignored", fl && fl.firstLicensure === "2014-09-04" && fl.floor === "2026-09-04");
  ok("no BLA: no floor", api.biologicExclusivityFloor([{ applicationType: "NDA", firstApprovalDate: "20100101" }]) === null);
}
section("Decision output: options move, completion order, the catalyst list, snapshots, the memo");
{
  // Options-implied move. A $6.50 straddle at $26: 6.5 / 26 = 25%. From
  // implied volatility 140% over 45 days: 1.4 × √(45/365) × √(2/π)
  // = 1.4 × 0.351123 × 0.797885 = 0.392216 → 39.22%.
  near("straddle $6.50 at $26: ±25%", api.optionsImpliedMove({ straddle: "6.5" }, "26").pct, 25, 1e-9);
  near("IV 140% over 45 days: ±39.22%", api.optionsImpliedMove({ iv: "140", days: "45" }, "26").pct, 140 * Math.sqrt(45 / 365) * Math.sqrt(2 / Math.PI), 1e-9);
  ok("the straddle wins when both are given; nothing given: null", api.optionsImpliedMove({ straddle: "6.5", iv: "140", days: "45" }, "26").basis === "straddle" && api.optionsImpliedMove({}, "26") === null);
  // The model's move: at $10, 60% chance of $15 (+50%) and 40% of $4 (−60%):
  // 0.6 × 50 + 0.4 × 60 = 54.
  const mm = api.modelImpliedMove("10", [{ prob: 0.6, value: 15 }, { prob: 0.4, value: 4 }]);
  near("model move ±54%", mm.pct, 54, 1e-9);
  ok("up +50% at 60%, down −60% at 40%", Math.abs(mm.upPct - 50) < 1e-9 && Math.abs(mm.upProb - 0.6) < 1e-9 && Math.abs(mm.downPct + 60) < 1e-9);
  ok("readings: options 80 vs model 54 is bigger (ratio 1.48); 40 vs 54 smaller (0.74); 50 vs 54 about the same",
    /^Options price a bigger move/.test(api.readImpliedMove(80, 54).verdict) && /^Your model expects a bigger move/.test(api.readImpliedMove(40, 54).verdict) && /about the same/.test(api.readImpliedMove(50, 54).verdict));

  // Completion order against a pin opening 1 Jul 2027.
  const now = new Date(2026, 9, 5);
  const studies = [
    { nctId: "A", primaryCompletionDate: "2027-03", sponsor: "Alpha" },
    { nctId: "B", primaryCompletionDate: "2027-11-15", sponsor: "Beta" },
    { nctId: "C", completionDate: "2026-12", sponsor: "Gamma" },
    { nctId: "D", sponsor: "Delta" },
    { nctId: "E", primaryCompletionDate: "2025-01", sponsor: "Old" } ];
  const ord = api.orderByCompletion(studies, { now, pinWindow: api.parseCatalystWindow("H2 2027") });
  ok("ordered by date, the long-past one dropped: C, A, B", ord.rows.map(r => r.nctId).join("") === "CAB");
  ok("reads first: C and A complete before H2 2027 opens; B does not", ord.rows.filter(r => r.readsFirst).map(r => r.nctId).join("") === "CA" && ord.readsFirstCount === 2);
  ok("primary completion is preferred and labelled; the undated one is counted", ord.rows[0].which === "completion" && ord.rows[1].which === "primary completion" && ord.undated === 1);
  const own = api.orderByCompletion(studies, { now, pinWindow: api.parseCatalystWindow("H2 2027"), excludeNcts: ["a"] });
  ok("the case's own trial is left out (case-insensitive) and counted", own.rows.map(r => r.nctId).join("") === "CB" && own.ownExcluded === 1);

  // The catalyst list. PepGen with a pinned Q1 next-year readout, a
  // competitor completing before it, a closed-out pin; a second case with no pin.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const y = now.getFullYear();
  const withPin = { ...pg, id: "c1", name: "PepGen", ticker: "PEPG",
    competitorReads: { condition: "DM1", at: "2026-10-05", rows: [{ nctId: "X1", sponsor: "Rival", phase: "PHASE2", date: y + "-12", which: "primary completion" }, { nctId: "X2", sponsor: "Later", phase: "PHASE2", date: (y + 2) + "-06", which: "primary completion" }] },
    programs: [{ ...pg.programs[0], calibrationLog: [
      { catalystLabel: "10 mg/kg data", catalystDate: (y + 1) + "-Q1", outcome: "pending", pin: { type: "topline", source: "guidance", at: "2026-10-01", sharedTag: "DM1 read" } },
      { catalystLabel: "Old readout", catalystDate: "2026-09", outcome: "success", pin: { type: "topline", source: "x", at: "x" }, closeOut: { at: "2026-10-01", happened: "hit", changed: "more confident" } } ] }] };
  const noPin = { ...pg, id: "c2", name: "NoPin", programs: [{ ...pg.programs[0], calibrationLog: [] }] };
  const twin = { ...withPin, id: "c3", name: "Twin", competitorReads: null };
  const pc = api.computePortfolioCatalysts([withPin, noPin, twin], now);
  ok("two upcoming pins, one case without a pin counted", pc.count === 2 && pc.noPin === 1);
  ok("grouped by the quarter the window opens: " + (y + 1) + " Q1", pc.groups.length === 1 && pc.groups[0].quarter === (y + 1) + " Q1");
  ok("each with its funding state from Runway vs. Catalyst", pc.groups[0].items.every(it => ["funded", "tight", "inside", "gap"].includes(it.funding)));
  ok("only the competitor completing before the pin is listed under it", pc.groups[0].items[0].competitors.map(c => c.nctId).join() === "X1");
  const ownSaved = { ...withPin, programs: [{ ...withPin.programs[0], trialIds: "NCTX1" }], competitorReads: { ...withPin.competitorReads, rows: [{ ...withPin.competitorReads.rows[0], nctId: "NCT12345678" }] } };
  ownSaved.programs[0].trialIds = "NCT12345678";
  ok("a saved row that is the case's own trial is never listed as a competitor", api.computePortfolioCatalysts([ownSaved], now).groups[0].items[0].competitors.length === 0);
  ok("the explicit shared tag on both pins is reported", pc.sharedTags.join() === "DM1 read");
  ok("the closed-out pin is listed as resolved, not upcoming", pc.resolved.length === 2 && pc.resolved[0].closeOut.happened === "hit");

  // Snapshots kept, dated: same day replaces, another day adds.
  const e1 = { label: api.modelSnapshotLabel("2026-10-01"), thesis: "a" };
  let log = api.addModelSnapshot([{ label: "Other" }], e1, () => "id1").log;
  log = api.addModelSnapshot(log, { ...e1, thesis: "b" }, () => "id2").log;
  ok("a second snapshot the same day replaces that day's", log.length === 2 && log[1].thesis === "b" && log[1].id === "id1");
  log = api.addModelSnapshot(log, { label: api.modelSnapshotLabel("2026-11-12"), thesis: "c" }, () => "id3").log;
  ok("another day's is added beside it; both are snapshots, the other entry is not", log.length === 3 && log.filter(api.isModelSnapshot).length === 2 && !api.isModelSnapshot(log[0]) && api.isModelSnapshot({ label: "What the model says (snapshot)" }));

  // Closing out clears the overdue prompt even when left unscored.
  const overdueCase = { programs: [{ id: "p", calibrationLog: [{ id: "e", catalystLabel: "X", catalystDate: "2025-06", outcome: "pending", pin: { type: "topline" } }] }] };
  ok("a passed pin is overdue", api.pendingCalibrationEntries(overdueCase).overdue.length === 1 && api.pendingCalibrationEntries(overdueCase).overdue[0].pinned);
  overdueCase.programs[0].calibrationLog[0].closeOut = { at: "2026-10-05", happened: "", changed: "" };
  ok("closed out, it is not", api.pendingCalibrationEntries(overdueCase).overdue.length === 0);

  // The memo uses the engine's own numbers.
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const memoCase = { ...st, optionsMove: { straddle: "6.2", asOf: "2026-10-05" }, memo: { efficacy: "needs a 40% cut", safety: "", cash: "no raise above $150M", competitor: "" } };
  const m = api.buildDecisionMemo(memoCase, now);
  const v = k => api.computeCaseValuation(memoCase, api.getEffectiveScenarioPreset(memoCase, k), k, Number(st.discountRatePct), st.terminalValue).equity.perShare;
  near("memo Base = the engine's Base", m.scenarios.base, v("base"), 1e-9);
  near("memo Bear = the engine's Bear", m.scenarios.bear, v("bear"), 1e-9);
  ok("odds: yours, implied and the gap in whole points", m.odds && m.odds.gapPts === Math.round(m.odds.impliedPct) - Math.round(m.odds.yoursPct));
  ok("the implied revenue variable for a Full build is peak share", m.implied && m.implied.variable === "peakShare");
  ok("both floors, the stage one in use", m.floors && m.floors.active === "stage" && m.floors.burn != null);
  ok("runway with facilities (Stoke's $194M ATM)", m.runway && m.runway.facilities.total === 194e6);
  near("options: $6.20 at $24.80 = ±25%", m.options.pct, 25, 1e-9);
  ok("the model's readout move is compared", m.options.model && m.options.model.pct > 0 && m.options.reading);
  ok("what would change my mind: the two fields filled", m.changeMyMind.efficacy === "needs a 40% cut" && m.changeMyMind.cash === "no raise above $150M");
}
section("Simulator: delayed separation, readout timing, the editable discount, analog priors");
{
  // Delayed separation, checked against the closed form. Control median 12
  // (λc = ln2/12), HR 0.5 (λt = λc/2), effect from month 6: S(t) = e^(−λc t)
  // to 6, then e^(−6λc − λt (t − 6)). S(6) = 2^(−0.5) = 0.7071 > 0.5, so the
  // treated median is past 6: 6λc + λt(m − 6) = ln2 → m − 6 = (ln2 − ln2/2)/(λc/2)
  // = 12 → median 18 months (24 with the effect from day one).
  const lc = Math.log(2) / 12;
  const S = (t) => t <= 6 ? Math.exp(-lc * t) : Math.exp(-lc * 6 - (lc / 2) * (t - 6));
  near("closed form: the treated median is 18 months", Math.log(2) - (6 * lc + (lc / 2) * 12), 0, 1e-12);
  // A late effect costs power on a fixed design. Every run here draws from a
  // fixed seed (mulberry32 in place of Math.random, restored after), so the
  // checks are exact rather than lucky: an omitted delay and a delay of 0 must
  // give the IDENTICAL hit rate from the same seed. (Before October 2026 these
  // ran on live randomness; twice in a long session the first run read as if
  // delayed — never reproduced in 25 further runs. The seed removes chance
  // from the question either way.)
  const realRandom = Math.random;
  const seeded = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const runSeeded = (seed, design) => { Math.random = seeded(seed); try { return api.runAssuranceSimulation({ endpointType: "timeToEvent", design, prior: { type: "point", value: 0.65 }, alpha: 0.05, sided: "two", iterations: 3000 }); } finally { Math.random = realRandom; } };
  const d = { nControl: 150, nTreat: 150, medianControl: 12, accrualPeriod: 12, followupPeriod: 12 };
  const now0 = runSeeded(1, { ...d });
  const zero = runSeeded(1, { ...d, delayMonths: 0 });
  const late = runSeeded(1, { ...d, delayMonths: 9 });
  ok("effect from month 9 lowers assurance (" + now0.pos.toFixed(3) + " → " + late.pos.toFixed(3) + ")", late.pos < now0.pos - 0.1);
  ok("a delay of 0 is the proportional-hazards model: the same hit rate as no delay field, from the same seed (" + zero.pos.toFixed(4) + ")", zero.pos === now0.pos);
  // And unseeded, a 3,000-run hit rate sits within Monte Carlo error of the
  // seeded one (two independent rates near 0.8: SE of the difference ≈
  // √(2 × 0.8 × 0.2 / 3000) = 0.0103; 0.05 is ~5 SEs).
  near("live randomness agrees with the seeded run within Monte Carlo error", api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { ...d }, prior: { type: "point", value: 0.65 }, alpha: 0.05, sided: "two", iterations: 3000 }).pos, now0.pos, 0.05);
  ok("Math.random is restored after the seeded runs", Math.random === realRandom);

  // Simulate many treated patients through the replicate's own sampler: no
  // censoring (long follow-up), one arm only (nControl 0 is not allowed, so a
  // huge treatment arm and read its events).
  const big = { nControl: 1, nTreat: 6000, medianControl: 12, accrualPeriod: 0.0001, followupPeriod: 1000, delayMonths: 6, targetEvents: 3001 };
  const replSeeded = (seed, design) => { Math.random = seeded(seed); try { return api.simulateTimeToEventReplicate(design, 0.5); } finally { Math.random = realRandom; } };
  const r = replSeeded(7, big);
  // Tolerance: the sample median of n = 6000 has SE ≈ 1 / (2 f(m) √n), with
  // f(18) = λt × S(18) = (ln2/24) × 0.5 = 0.01444, so SE ≈ 1 / (2 × 0.01444 ×
  // 77.46) = 0.447 months. 0.9 was two SEs and failed about one run in twenty
  // (October 2026 audit); 1.8 is four SEs and still far from 12 or 24.
  near("the 3001st event of 6001 patients (the median) lands near 18 months", r.timeToTarget, 18, 1.8);
  const r0 = replSeeded(8, { ...big, delayMonths: 0 });
  near("... and near 24 with the effect from day one", r0.timeToTarget, 24, 1.2);
  ok("S(t) used above is a proper survival curve (S(0)=1, falls)", S(0) === 1 && S(30) < S(10));

  // Readout timing against the expected event count. HR 1 (no effect), 400
  // patients accrued evenly over 12 months, control median 12. Expected
  // events by calendar month T ≥ 12: 400 × (1/12)∫0^12 (1 − e^(−λ(T−u))) du
  // = 400 × [1 − (e^(−λ(T−12)) − e^(−λT)) / (12λ)]. The T where that is 200.
  const lam = Math.log(2) / 12;
  const expected = T => 400 * (1 - (Math.exp(-lam * (T - 12)) - Math.exp(-lam * T)) / (12 * lam));
  let lo = 12, hi = 60; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (expected(m) < 200) lo = m; else hi = m; }
  const tStar = (lo + hi) / 2;
  const rt = api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { nControl: 200, nTreat: 200, medianControl: 12, accrualPeriod: 12, followupPeriod: 12, targetEvents: 200 }, prior: { type: "point", value: 1 }, alpha: 0.05, sided: "two", iterations: 1500 }).readoutTiming;
  near("200 of 400 events: the median timing matches the expected-events solution (" + tStar.toFixed(2) + " months)", rt.median, tStar, 0.5);
  ok("10th ≤ median ≤ 90th percentile", rt.p10 <= rt.median && rt.median <= rt.p90);
  ok("the planned 24 months (12 + 12) is past the median, so few runs miss it (" + (rt.neverShare * 100).toFixed(1) + "%)", rt.planEnd === 24 && rt.neverShare < 0.2);
  const impossible = api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { nControl: 50, nTreat: 50, medianControl: 12, accrualPeriod: 12, followupPeriod: 12, targetEvents: 150 }, prior: { type: "point", value: 0.8 }, alpha: 0.05, sided: "two", iterations: 200 }).readoutTiming;
  ok("a target above the number of patients is never reached", impossible.neverShare === 1);
  ok("no target: no timing", api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { ...d }, prior: { type: "point", value: 0.7 }, alpha: 0.05, sided: "two", iterations: 200 }).readoutTiming === null);

  // The summary line's numbers.
  const sm = api.summarizeObservedEffects([0.6, 0.8, 0.95, 1.05, NaN, 0.7], "timeToEvent");
  ok("summary: median of the five finite values is 0.8; 2 of 5 worse than 0.90, 1 of 5 worse than 1", sm.median === 0.8 && sm.worseThan090 === 0.4 && sm.worseThan100 === 0.2 && sm.n === 5);
  ok("summary for a difference: just the median (even count: mean of the middle two)", api.summarizeObservedEffects([0.1, 0.3, 0.2, 0.4], "binary").median === 0.25);

  // The Phase 2→3 discount, now a parameter.
  near("HR 0.66 × the default 1.09", api.shrinkHazardRatio(0.66).projectedP3HR, 0.7194, 1e-9);
  near("HR 0.66 × a typed 1.20 = 0.792", api.shrinkHazardRatio(0.66, 1.2).projectedP3HR, 0.792, 1e-9);
  near("45% ÷ a typed 1.5 = 30%", api.shrinkBinaryResponseRate(45, 1.5).projectedP3Pct, 30, 1e-9);
  ok("a blank or zero factor falls back to the literature average", api.shrinkHazardRatio(0.66, 0).factor === 1.09 && api.shrinkBinaryResponseRate(45, NaN).factor === 1.2);

  // Analog-board priors: hazard ratios only; the cautious quartile is the
  // less favourable end (nearer 1).
  const rows = [0.5, 0.6, 0.7, 0.8, 0.9].map(v => ({ scale: "ratio", paramLabel: "Hazard ratio", value: v })).concat([{ scale: "ratio", paramLabel: "Odds ratio", value: 0.2 }, { scale: "difference", paramLabel: "Mean difference", value: 3 }]);
  const pre = api.analogPriorPresets(rows);
  ok("presets: 5 hazard ratios (the odds ratio and the difference left out)", pre.n === 5);
  near("median 0.70", pre.median, 0.7, 1e-12);
  near("after the 1.09 discount: 0.763", pre.medianDiscounted, 0.763, 1e-9);
  ok("cautious quartile: the 75th-percentile HR, 0.80 (nearest rank: the 4th of 5)", pre.cautious === 0.8);
  ok("nothing parsed: nothing offered", api.analogPriorPresets([{ scale: "ratio", paramLabel: "Odds ratio", value: 0.5 }]) === null && api.analogPriorPresets([]) === null);

  // A month range pins a simulated window without inventing a day.
  const w = api.parseCatalystWindow("2027-03 to 2027-09");
  ok("'2027-03 to 2027-09' is 1 Mar to 30 Sep 2027", w && w.precision === "range" && w.start.getMonth() === 2 && w.start.getDate() === 1 && w.end.getMonth() === 8 && w.end.getDate() === 30);
  ok("a backwards range is not a date", api.parseCatalystWindow("2027-09 to 2027-03") === null);
}
section("Cash to reach the catalyst: facilities and the financing bridge");
{
  const fac = api.caseFacilities({ capitalStructure: { atmUndrawn: "60000000", debtUndrawn: "25000000", milestoneExpected: "15000000", shelfRemaining: "150000000", facilitiesNote: "Q2 10-Q" } });
  ok("facilities: ATM + debt + milestones = $100M; the shelf is kept apart", fac.total === 100e6 && fac.shelf === 150e6 && fac.note === "Q2 10-Q");
  ok("an ATM and a shelf both entered: the double-count warning", fac.doubleCount === true && api.caseFacilities({ capitalStructure: { atmUndrawn: "1" } }).doubleCount === false);
  ok("blank fields: nothing", api.caseFacilities({ capitalStructure: {} }).any === false);
  // Named from what was entered: all three listed, an ATM alone named alone,
  // milestones alone not called "undrawn".
  ok("facilities named: all three", api.facilitiesPhrase(fac) === "undrawn ATM, debt and expected milestones");
  ok("facilities named: an ATM alone", api.facilitiesPhrase(api.caseFacilities({ capitalStructure: { atmUndrawn: "97000000", shelfRemaining: "400000000" } })) === "undrawn ATM");
  ok("facilities named: milestones alone are not undrawn", api.facilitiesPhrase(api.caseFacilities({ capitalStructure: { milestoneExpected: "5000000" } })) === "expected milestones");

  // PepGen with its cash cut to $40M and a pinned catalyst at the end of
  // 2027: the cash runs out first.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const y = new Date().getFullYear();
  const thin = { ...pg, capitalStructure: { ...pg.capitalStructure, cash: "40000000" }, futureRaise: { enabled: false },
    programs: [{ ...pg.programs[0], calibrationLog: [{ catalystLabel: "Pivotal data", catalystDate: (y + 1) + "-Q4", outcome: "pending", pin: { type: "topline", source: "x", at: "x" } }] }] };
  const fr = api.computeForwardRunway(thin);
  const frX = api.computeForwardRunway(thin, { extraCash: 100e6 });
  ok("extra cash lengthens the runway (" + fr.runwayMonths.toFixed(1) + " → " + frX.runwayMonths.toFixed(1) + " mo) and the yearly flows are the same", frX.runwayMonths > fr.runwayMonths && frX.path[0].flow === fr.path[0].flow);
  // The runway is read from today, not from the filing (October 2026 audit).
  // The fixture's cash is dated 2026-06-30; 92 days later (2026-09-30) is
  // 92 / 30.4375 = 3.0226 months, which come off the path's own runway.
  const dated = { ...thin, valuationDate: "2026-09-30", capitalStructure: { ...thin.capitalStructure, cashAsOf: "2026-06-30" } };
  const frD = api.computeForwardRunway(dated);
  near("the months since the filing: 92 days = 3.0226 months", frD.monthsSinceCash, 92 / 30.4375, 1e-9);
  near("runway from today = the path's runway − the months since the filing", frD.runwayMonths, frD.runwayMonthsFromCash - 92 / 30.4375, 1e-9);
  ok("the path itself is unchanged (it starts on the cash date)", frD.path[0].balanceEnd === fr.path[0].balanceEnd && frD.runwayMonthsFromCash === fr.runwayMonthsFromCash);
  const rolledCase = { ...dated, capitalStructure: { ...dated.capitalStructure, carryCashForward: true, monthlyBurn: "5000000" } };
  ok("rolling the cash forward already brings it to today: nothing more comes off", api.computeForwardRunway(rolledCase).monthsSinceCash === 0);
  const late = { ...dated, valuationDate: "2030-01-01" };
  ok("a runway that ended before today reads 0, never negative", api.computeForwardRunway(late).runwayMonths === 0);
  ok("an explicit now overrides the valuation date", Math.abs(api.computeForwardRunway(dated, { now: new Date(2026, 7, 30) }).monthsSinceCash - 61 / 30.4375) < 1e-9);
  ok("a cash date after today takes nothing off", api.computeForwardRunway({ ...dated, valuationDate: "2026-01-01" }).monthsSinceCash === 0);
  const rvD = api.computeRunwayVsCatalysts(dated, { now: new Date(2026, 8, 30), cushionMonths: 6 });
  near("Runway vs. Catalyst reads the same runway from the same day", rvD.runwayMonths, frD.runwayMonths, 1e-9);
  ok("and says which filing it rests on", rvD.cashAsOf === "2026-06-30" && Math.abs(rvD.monthsSinceCash - 92 / 30.4375) < 1e-9);

  const now = new Date(y, 9, 5);
  const b = api.computeFinancingBridge(thin, { cushionMonths: 6, now, discountPct: 20 });
  // Independent: the balance after T months, read linearly along the yearly
  // path — which starts on the fixture's cash date (2026-06-30), so T is the
  // whole days from then to the window's end (31 Dec of next year) over
  // 30.4375, plus the 6-month cushion. Today does not enter it.
  const T = (Date.UTC(y + 1, 11, 31) - Date.UTC(2026, 5, 30)) / 86400000 / 30.4375 + 6;
  const yr = Math.floor(T / 12), within = T / 12 - yr;
  const startY = yr === 0 ? fr.startingCash : fr.path[yr - 1].balanceEnd;
  const balT = startY + (fr.path[yr].balanceEnd - startY) * within;
  ok("the binding catalyst is the pinned Q4 one", b && b.catalyst.label === "Pivotal data");
  near("dollars needed = the modelled shortfall at the window's end + 6 months", b.needed, -balT, 1);
  ok("with no facilities, all of it is still to raise", b.afterFacilities === b.needed);
  const price = Number(thin.currentPrice);
  near("shares = amount / (price × 0.8)", b.newShares, b.afterFacilities / (price * 0.8), 1e-6);
  // Selling shares at $1.87 when this thin case values them at ~$0.37 brings
  // in more per share than it dilutes, so Base rises; selling below the
  // case's own value lowers it. Either way the direction follows the price.
  ok("a raise above the case's own value per share lifts Base (" + b.baseNow.toFixed(4) + " → " + b.baseWith.toFixed(4) + " at $" + b.raisePrice.toFixed(2) + ")", b.raisePrice > b.baseNow && b.baseWith > b.baseNow);
  const rich = { ...thin, currentPrice: "0.30" };
  const b3 = api.computeFinancingBridge(rich, { cushionMonths: 6, now, discountPct: 20 });
  ok("... and one below it lowers Base (" + b3.baseNow.toFixed(4) + " → " + b3.baseWith.toFixed(4) + " at $" + b3.raisePrice.toFixed(2) + ")", b3.raisePrice < b3.baseNow && b3.baseWith < b3.baseNow);
  const withFac = { ...thin, capitalStructure: { ...thin.capitalStructure, atmUndrawn: "30000000", shelfRemaining: "10000000" } };
  const b2 = api.computeFinancingBridge(withFac, { cushionMonths: 6, now, discountPct: 20 });
  near("facilities come off the amount: needed − $30M", b2.afterFacilities, Math.max(0, b2.needed - 30e6), 1e-6);
  near("a $10M shelf against it: short by the rest", b2.shelfShort, b2.afterFacilities > 10e6 ? b2.afterFacilities - 10e6 : 0, 1e-6);
  ok("no raise modelled: nothing covers it", b.modelledAmount === 0 && b.coveredByModelled === false);
  const modelled = { ...thin, futureRaise: { enabled: true, amountM: String(Math.ceil(b.needed) + 1e6), priceMode: "discount", discountPct: "15" } };
  const bm = api.computeFinancingBridge(modelled, { cushionMonths: 6, now, discountPct: 20 });
  ok("a modelled raise at least as large as the need covers it", bm.coveredByModelled === true && bm.alreadyModelled === true);
  const small = { ...thin, futureRaise: { enabled: true, amountM: "1000000", priceMode: "discount", discountPct: "15" } };
  ok("a smaller modelled raise does not", api.computeFinancingBridge(small, { cushionMonths: 6, now, discountPct: 20 }).coveredByModelled === false);
  ok("a funded case has no bridge", api.computeFinancingBridge({ ...thin, capitalStructure: { ...thin.capitalStructure, cash: "2000000000" } }, { now }) === null);
  // None of the fields touch the valuation.
  near("facility fields leave Base unchanged to the cent", api.baseCaseFairValue(withFac), api.baseCaseFairValue(thin), 1e-9);

  ok("the cash source names the XBRL tags", api.edgarCashSource({ asOf: "2026-06-30", cashTags: [{ tag: "CashAndCashEquivalentsAtCarryingValue", value: 110e6 }, { tag: "AvailableForSaleSecuritiesDebtSecuritiesCurrent", value: 182.8e6 }] }) === "EDGAR XBRL, period ending 2026-06-30: CashAndCashEquivalentsAtCarryingValue $110.0M + AvailableForSaleSecuritiesDebtSecuritiesCurrent $182.8M");
}
section("What 'the price implies' holds fixed");
{
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const held = api.impliedHeldFixed(st);
  const peak = api.getProgramRevenueResult(st.programs[0], 25).peakTotalRevenue;
  ok("Stoke: the Base peak from the full build, to the nearest $10M ($" + (peak / 1e9).toFixed(2) + "B)", held[0] === "Base peak revenue $" + (peak / 1e9).toFixed(2) + "B (the full build)");
  ok("... launch year, discount rate, net cash, shares, raise and terminal value", held.includes("launch in year " + st.programs[0].launchYearOffset) && held.includes(st.discountRatePct + "% discount rate") && held.some(x => /^net cash \$/.test(x)) && held.some(x => /M diluted shares$/.test(x)) && held.includes("no terminal value"));
  ok("... the modelled raise is listed because it is on", held.includes("the modelled raise") === !!(st.futureRaise && st.futureRaise.enabled));
  ok("two programs: nothing (no single implied figure)", api.impliedHeldFixed({ ...st, programs: [st.programs[0], st.programs[0]] }) === null);
}
section("Both failure floors, side by side");
{
  // PepGen: the stage-cost floor charges all of Phase 2's benchmark cost and
  // reads $0; the burn floor (the November readout at $5.7M a month) is the
  // $0.8895 worked out in "The rough failure estimate from the burn".
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  pg.programs[0].calibrationLog = [{ catalystLabel: "FREEDOM2 10 mg/kg data", catalystDate: "2026-11", outcome: "pending" }];
  const pair = api.computeFailureFloorPair(pg);
  ok("PepGen: the stage floor is $0 and the burn floor is positive; the stage one is in use by default", pair.stage.perShare === 0 && pair.burn.perShare > 0.8 && pair.active === "stage");
  near("... the burn floor is the $0.8895 worked out longhand", pair.burn.perShare, (117.238e6 - 5.7e6 * (153 / (365.25 / 12)) - 26e6) / 70360627, 1e-9);
  const why = api.floorZeroReason(pair.stage);
  ok("the $0 says what used the cash up (" + why + ")", /^\$[\d.]+M still to pay for Phase 2, \$[\d.]+M of G&A to the readout and \$26\.0M of wind-down use up the \$[\d.]+M of net cash$/.test(why));
  ok("a positive floor has no $0 reason", api.floorZeroReason(pair.burn) === null);
  ok("switched to the burn method, it is the one in use", api.computeFailureFloorPair({ ...pg, failureFloor: { method: "burn" } }).active === "burn");
  const noBurn = { ...pg, capitalStructure: { ...pg.capitalStructure, monthlyBurn: "" } };
  ok("no monthly burn: the burn figure is absent, the stage one stays", (() => { const p = api.computeFailureFloorPair(noBurn); return p.burn === null && p.active === "stage"; })());
  ok("two programs: no pair", api.computeFailureFloorPair({ ...pg, programs: [pg.programs[0], pg.programs[0]] }) === null);
}
section("Simulator → case odds: a trial's win is not the odds of launch");
{
  // Direction: a two-sided test counts a significant result the WRONG way as
  // a hit too. With a weak true effect (HR 0.97, point prior) and a small
  // trial, wrong-way wins are a visible share; posDirectional drops them.
  const d = { nControl: 60, nTreat: 60, medianControl: 12, accrualPeriod: 12, followupPeriod: 12 };
  const weak = api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { ...d }, prior: { type: "point", value: 0.97 }, alpha: 0.05, sided: "two", iterations: 4000 });
  ok("HR 0.97: wins in the expected direction are fewer than all hits (" + weak.posDirectional.toFixed(3) + " < " + weak.pos.toFixed(3) + ")", weak.posDirectional < weak.pos);
  const strong = api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { ...d, nControl: 200, nTreat: 200 }, prior: { type: "point", value: 0.6 }, alpha: 0.05, sided: "two", iterations: 3000 });
  near("HR 0.6, 200 a side: nearly every hit is the right way", strong.posDirectional, strong.pos, 0.005);
  ok("a prior exactly at the null has no expected direction", api.runAssuranceSimulation({ endpointType: "timeToEvent", design: { ...d }, prior: { type: "point", value: 1 }, alpha: 0.05, sided: "two", iterations: 500 }).posDirectional === null);
  const bin = api.runAssuranceSimulation({ endpointType: "binary", design: { nControl: 80, nTreat: 80, controlRate: 0.3 }, prior: { type: "point", value: 0.45 }, alpha: 0.05, sided: "two", iterations: 3000 });
  ok("binary 45% vs 30%: directional ≤ all hits, both well above alpha", bin.posDirectional <= bin.pos && bin.posDirectional > 0.4);

  // Conversion: a Phase 3 program — the only step left after the trial is
  // the FDA, at this program's own regulatory benchmark. A Phase 2 program
  // — Phase 3 and the FDA both follow. Neurology, no attributes.
  const prog = phase => ({ therapeuticArea: "Neurology", currentPhase: phase, posOverridePct: "", modality: "smallMolecule" });
  const w3 = api.computePoSWeighting(prog("phase3")), w2 = api.computePoSWeighting(prog("phase2"));
  const reg = w3.stages.find(s => s.key === "regulatory").pos;
  const c3 = api.assuranceToCaseOdds(prog("phase3"), 0.70);
  near("Phase 3: odds = 70% × the regulatory benchmark", c3.oddsPct, 70 * reg, 1e-9);
  ok("... the trial is Phase 3, the later step the FDA", c3.trialStage === "Phase 3" && c3.laterStages.length === 1 && c3.laterStages[0].label === "Regulatory" && !c3.looseFit);
  const p3 = w2.stages.find(s => s.key === "phase3").pos;
  const c2 = api.assuranceToCaseOdds(prog("phase2"), 0.70);
  near("Phase 2: odds = 70% × Phase 3 × the FDA", c2.oddsPct, 70 * p3 * w2.stages.find(s => s.key === "regulatory").pos, 1e-9);
  ok("a later stage remains, so the odds move by less than the trial's 70% (" + c2.oddsPct.toFixed(1) + "%)", c2.oddsPct < 70 && c3.oddsPct < 70);
  ok("Phase 2 carries the loose-fit caveat", c2.looseFit === true);
  near("before: the benchmark odds to launch", c2.beforePct, w2.posToLaunch * 100, 1e-9);
  ok("at the FDA stage there is no trial to simulate", api.assuranceToCaseOdds(prog("filed"), 0.7).ok === false);
  ok("approved: nothing to simulate", api.assuranceToCaseOdds(prog("approved"), 0.7).ok === false);

  // Writing it: the override, and the run kept beside it.
  const run = { endpointType: "timeToEvent", design: d, prior: { type: "normal", mean: 0.7, sd: 0.1 }, alpha: 0.05, sided: "two", iterations: 10000, pos: 0.73, posDirectional: 0.70, posStdErr: 0.0045 };
  const before = { ...prog("phase3"), posOverridePct: "65" };
  const cv = api.assuranceToCaseOdds(before, run.posDirectional);
  const after = api.applyAssuranceToProgram(before, cv, run, "2026-10-04");
  ok("written: the override is the converted odds to one decimal, the typed 65% recorded as before", after.posOverridePct === String(Math.round(70 * reg * 10) / 10) && after.posSource.beforePct === 65 && after.posSource.beforeSource === "typed");
  ok("the run is kept: direction-only win, all hits, SE, prior, alpha, sidedness, runs, date", after.posSource.trialWin === 0.70 && after.posSource.assurance === 0.73 && after.posSource.mcSE === 0.0045 && after.posSource.prior.sd === 0.1 && after.posSource.sided === "two" && after.posSource.iterations === 10000 && after.posSource.at === "2026-10-04");
  near("the valuation's odds to launch are the written figure", api.computeEffectivePoS(after, api.SCENARIO_PRESETS.base).posToLaunch, Number(after.posOverridePct) / 100, 1e-9);
  ok("still from the simulator until the field is edited by hand", api.posFromSimulator(after) && !api.posFromSimulator({ ...after, posOverridePct: "60" }));
  ok("the sentence names the trial, the prior and the later odds", /70\.0% chance this Phase 3 reads out significant in the expected direction \(time-to-event; a normal prior, mean 0\.7 \(SD 0\.1\); 60 vs 60 patients; α 0\.05 two-sided; 10,000 runs, ±0\.45pp\)/.test(api.describePosSource(after.posSource)));
  ok("the freshness line says the odds came from the simulator", api.computeFreshness({ currentPrice: "", capitalStructure: {}, programs: [after] }, new Date(2026, 9, 4)).odds.source === "simulator");
}
section("Freshness: how old the inputs behind the headline are");
{
  // A submissions index shaped like SEC's (reverse-chronological, reportDate
  // = period end). Cash dated 2026-06-30: the Q3 10-Q (period 2026-09-30,
  // filed 2026-11-03) is newer; an 8-K never counts; a 10-Q for the same
  // period as the cash is not newer.
  const subs = { filings: { recent: {
    form: ["8-K", "10-Q", "10-Q", "10-K"], filingDate: ["2026-11-05", "2026-11-03", "2026-08-03", "2026-03-16"],
    reportDate: ["2026-11-05", "2026-09-30", "2026-06-30", "2025-12-31"] } } };
  const nf = api.newerFinancialFiling(subs, "2026-06-30");
  ok("cash at 2026-06-30: the Q3 10-Q (period 2026-09-30, filed 2026-11-03) is newer", nf && nf.form === "10-Q" && nf.period === "2026-09-30" && nf.filed === "2026-11-03");
  ok("cash at 2026-09-30: nothing newer (the 8-K does not count)", api.newerFinancialFiling(subs, "2026-09-30") === null);
  ok("no cash date: nothing to compare", api.newerFinancialFiling(subs, "") === null);

  const today = new Date(2026, 9, 4); // 4 Oct 2026
  const base = { currentPrice: "24.80", priceAsOf: "2026-09-25", capitalStructure: { cash: "420000000", cashAsOf: "2026-06-30" },
    programs: [{ posOverridePct: "65", calibrationLog: [{ catalystLabel: "EMPEROR topline, through to approval", catalystDate: "2027-Q3", outcome: "pending", pin: { type: "topline", source: "guidance", at: "2026-09-28" } }] }] };
  const f = api.computeFreshness(base, today, null);
  ok("price entered 2026-09-25 is 9 days old on 4 Oct: stale (more than 7)", f.price.days === 9 && f.price.stale === true);
  const f2 = api.computeFreshness({ ...base, priceAsOf: "2026-09-28" }, today, null);
  ok("... entered 2026-09-28, 6 days: fresh", f2.price.days === 6 && f2.price.stale === false && f2.amber === false);
  ok("cash as of 2026-06-30 is 96 days old on 4 Oct (30+31+31+4)", f.cash.days === 96 && f.cash.newer === null);
  ok("the pinned catalyst, with its type and source", f.catalyst && f.catalyst.pinned && f.catalyst.type === "Topline data" && f.catalyst.source === "guidance" && f.catalyst.date === "2027-Q3");
  ok("odds: the typed 65%", f.odds && f.odds.pct === 65 && f.odds.source === "typed");
  const f3 = api.computeFreshness({ ...base, priceAsOf: "2026-10-03" }, today, nf);
  ok("a newer filing makes it amber even with a fresh price", f3.amber === true && f3.cash.newer.form === "10-Q");
  ok("no price: price is null, not a zero", api.computeFreshness({ ...base, currentPrice: "" }, today, null).price === null);
  ok("a price with no date: days unknown, never stale", (() => { const g = api.computeFreshness({ ...base, priceAsOf: "" }, today, null).price; return g.days === null && g.stale === false; })());
  ok("two programs: no single odds figure", api.computeFreshness({ ...base, programs: [base.programs[0], base.programs[0]] }, today, null).odds === null);
}
section("Catalyst windows: one parser for runway, overdue and the floor");
{
  const W = api.parseCatalystWindow;
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const span = s => { const w = W(s); return w ? ymd(w.start) + ".." + ymd(w.end) + " " + w.precision : null; };
  ok("H1 2027 is 1 Jan to 30 Jun 2027", span("H1 2027") === "2027-01-01..2027-06-30 half");
  ok("H2 2027, 2027-H2 and 2H 2027 are 1 Jul to 31 Dec", span("H2 2027") === "2027-07-01..2027-12-31 half" && span("2027-H2") === span("H2 2027") && span("2H 2027") === span("H2 2027"));
  ok("2027 is the whole year", span("2027") === "2027-01-01..2027-12-31 year");
  ok("2027-Q2 is 1 Apr to 30 Jun; Q2 2027 and 2027 Q2 the same", span("2027-Q2") === "2027-04-01..2027-06-30 quarter" && span("Q2 2027") === span("2027-Q2") && span("2027 Q2") === span("2027-Q2"));
  ok("2027-02 is the whole of February (28 days in 2027)", span("2027-02") === "2027-02-01..2027-02-28 month");
  ok("2027-11-14 is that one day", span("2027-11-14") === "2027-11-14..2027-11-14 day");
  // A day that does not exist is refused, not rolled into the next month.
  ok("2027-02-31, 2027-02-29 and 2027-04-31 are not dates; 2028-02-29 is (a leap year)", W("2027-02-31") === null && W("2027-02-29") === null && W("2027-04-31") === null && span("2028-02-29") === "2028-02-29..2028-02-29 day");
  ok("prose stays undated: 'sometime next year', 'after the FDA meeting', '2027-13'", W("sometime next year") === null && W("after the FDA meeting") === null && W("2027-13") === null);
  // The forms accepted before October 2026 give the same single date as
  // they always did (the last day), so no existing entry moves.
  ok("parseCatalystDate unchanged for day / month / quarter", ymd(api.parseCatalystDate("2026-11-14")) === "2026-11-14" && ymd(api.parseCatalystDate("2026-11")) === "2026-11-30" && ymd(api.parseCatalystDate("2027-Q3")) === "2027-09-30");
  ok("... and now reads H1 2027 as its end, 30 June", ymd(api.parseCatalystDate("H1 2027")) === "2027-06-30");

  // Overdue only once the window has ended. pendingCalibrationEntries reads
  // the real clock, so the windows are placed around today.
  // Runway vs. Catalyst leaves out a window that has already ended (counted)
  // and a closed-out entry (it happened). Case with a fixed 30-month runway.
  {
    const at = new Date(2026, 9, 5);
    const c = { programs: [{ name: "P", calibrationLog: [
      { catalystLabel: "Past", catalystDate: "2026-Q2", outcome: "pending" },
      { catalystLabel: "Closed", catalystDate: "2027-Q1", outcome: "pending", closeOut: { at: "2026-10-01" } },
      { catalystLabel: "Next", catalystDate: "2027-Q3", outcome: "pending" }] }] };
    const rv = api.computeRunwayVsCatalysts(c, { now: at, runwayMonthsOverride: 30, cushionMonths: 6 });
    ok("Runway vs. Catalyst: only the future, open catalyst is listed", rv.rows.length === 1 && rv.rows[0].label === "Next");
    ok("... and the past one is counted, not lost", rv.pastCount === 1);
  }

  const now = new Date(); const y = now.getFullYear();
  const caseWith = dates => ({ programs: [{ name: "P", calibrationLog: dates.map((d, i) => ({ id: "c" + i, catalystLabel: "C" + i, catalystDate: d, outcome: "pending" })) }] });
  const pend = api.pendingCalibrationEntries(caseWith([String(y), String(y - 1), "sometime next year"]));
  ok("this year's window is not overdue; last year's is; prose is open, never overdue", pend.overdue.length === 1 && pend.overdue[0].catalystDate === String(y - 1) && pend.open.length === 2);

  // Runway: a window is never collapsed to a day. Runway 20 months against a
  // window 18-24 months out: cash runs out INSIDE it. Against 25-31: before
  // it opens (gap). Against 10-14, 6-month cushion: 20-14 = 6, funded.
  const c = (label, s, e) => ({ label, monthsToStart: s, monthsAway: e });
  const rw = api.classifyCatalystFunding(20, [c("inside", 18, 24), c("before", 25, 31), c("funded", 10, 14), c("tight", 12, 16)], 6);
  const st = Object.fromEntries(rw.rows.map(r => [r.label, r.status]));
  ok("runway 20 mo vs a window 18-24 mo out: runs out inside it", st.inside === "inside");
  ok("... vs 25-31: runs out before it opens (gap)", st.before === "gap");
  ok("... vs 10-14 with a 6-month cushion: funded (20 - 14 = 6)", st.funded === "funded");
  ok("... vs 12-16: reaches the end with 4 months left, tight", st.tight === "tight");
  ok("counts: 1 gap, 1 inside, 1 tight, 1 funded", rw.gapCount === 1 && rw.insideCount === 1 && rw.tightCount === 1 && rw.fundedCount === 1);
  ok("the binding problem is the earliest not-funded one (tight at 12-16)", rw.firstProblem && rw.firstProblem.label === "tight");
  ok("an exact date (no start) can never be 'inside'", api.classifyCatalystFunding(20, [{ label: "x", monthsAway: 22 }], 6).rows[0].status === "gap");

  // computeRunwayVsCatalysts carries the window through: H1 of next year.
  const rv = api.computeRunwayVsCatalysts(caseWith(["H1 " + (y + 1)]), { runwayMonthsOverride: 600, now: new Date(y, 0, 1) });
  near("H1 next year from 1 Jan: the window opens 12 months out", rv.rows[0].monthsToStart, api.monthsUntil(new Date(y, 0, 1), new Date(y + 1, 0, 1)), 1e-9);
  near("... and ends at 30 June", rv.rows[0].monthsAway, api.monthsUntil(new Date(y, 0, 1), new Date(y + 1, 5, 30)), 1e-9);

  // The next catalyst: a pin wins over an earlier unpinned date; among pins
  // (or among unpinned) the earliest; ended windows and scored entries drop.
  const t0 = new Date(2026, 9, 4);
  const cs = { programs: [{ name: "P", calibrationLog: [
    { catalystLabel: "early unpinned", catalystDate: "2026-11", outcome: "pending" },
    { catalystLabel: "pinned later", catalystDate: "H1 2027", outcome: "pending", pin: { type: "topline", source: "guidance", at: "2026-10-04" } },
    { catalystLabel: "pinned past", catalystDate: "2026-Q2", outcome: "pending", pin: { type: "pdufa", source: "x", at: "2026-01-01" } },
    { catalystLabel: "scored", catalystDate: "2026-12", outcome: "success", pin: { type: "other", source: "x", at: "2026-01-01" } } ] }] };
  const nc = api.nextCaseCatalyst(cs, t0);
  ok("a pinned H1 2027 wins over an unpinned November 2026", nc && nc.entry.catalystLabel === "pinned later" && nc.pinned);
  ok("with no pin the earliest dated still-to-come entry", api.nextCaseCatalyst({ programs: [{ calibrationLog: [cs.programs[0].calibrationLog[0], { catalystLabel: "Dec", catalystDate: "2026-12", outcome: "pending" }] }] }, t0).entry.catalystLabel === "early unpinned");
  ok("nothing left to come: null", api.nextCaseCatalyst({ programs: [{ calibrationLog: [cs.programs[0].calibrationLog[2]] }] }, t0) === null);

  // The floor's burn plan burns to the END of the pinned window: from cash
  // dated 2026-06-30 to 30 Jun 2027 at $10M a month = 12 months, $120M.
  const fcase = { valuationDate: "2026-10-04", failureFloor: { method: "burn" }, capitalStructure: { monthlyBurn: "10000000", cashAsOf: "2026-06-30" }, programs: [{ calibrationLog: cs.programs[0].calibrationLog }] };
  const bp = api.failureFloorBurnPlan(fcase, 3, 0);
  near("floor burns to the end of the pinned H1 2027: 12 months from 30 Jun 2026", bp.monthsToReadout, 12, 0.05);
  ok("... and says it is the pinned catalyst, to the end of that window", /pinned catalyst \(H1 2027, to the end of that window\)/.test(bp.readoutSource));
}
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
  // Until October 2026 "H1 2027" was left undated on purpose; it is a window
  // now (see "Catalyst windows" below). Prose is still never guessed.
  ok("free text is left undated rather than guessed", api.parseCatalystDate("sometime in 2027") === null && api.parseCatalystDate("after the EOP2 meeting") === null);
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
  // riskAdjFCF is in DOLLARS on the real calendar, and so is startingNOLM:
  // it is entered through a MillionsField, which stores dollars. (This check
  // once passed 200 meaning $200M, matching an engine that multiplied by 1e6
  // — both were wrong together, which is how a typed NOL became a shield a
  // million times too large without any test noticing.)
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
  const t4 = api.applyTaxToCalendar(cal([300]), { enabled: true, effectiveRatePct: 21, startingNOLM: 200e6 });
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
section("Runway vs. catalyst: the composing function");
{
  // The pieces are checked elsewhere; this checks what the case-level function
  // feeds them. now = 23 Sep 2026 (local). Log: a pending 2027-Q1 readout, a
  // resolved one (must be skipped), and a pending one with no date (counted,
  // never guessed). 2027-Q1 -> 31 Mar 2027; 23 Sep -> 31 Mar = 7 + 31 + 30 +
  // 31 + 31 + 28 + 31 = 189 days; 189 / 30.4375 = 6.20945 months. With a
  // 12-month runway the cushion is 12 - 6.20945 = 5.79055, under the 6-month
  // default -> "tight".
  const theCase = { programs: [{ drugName: "X", calibrationLog: [
    { catalystLabel: "Ph3 readout", catalystDate: "2027-Q1", outcome: "pending" },
    { catalystLabel: "Ph2 readout", catalystDate: "2026-03", outcome: "yes" },
    { catalystLabel: "Someday", catalystDate: "", outcome: "pending" }
  ] }] };
  const r = api.computeRunwayVsCatalysts(theCase, { now: new Date(2026, 8, 23), runwayMonthsOverride: 12 });
  ok("ok result", r.ok === true);
  near("only the pending dated catalyst is compared", r.rows.length, 1, 0);
  near("its months away = 189 / 30.4375 = 6.20945", r.rows[0].monthsAway, 6.20945, 1e-4);
  near("cushion at the readout = 12 - 6.20945 = 5.79055", r.rows[0].cushionAtCatalyst, 5.79055, 1e-4);
  ok("5.79 months of cash left is under the 6-month cushion -> tight", r.rows[0].status === "tight" && r.firstProblem && r.firstProblem.label === "Ph3 readout");
  near("the undated pending entry is counted, not dropped silently", r.undatedCount, 1, 0);
  const r2 = api.computeRunwayVsCatalysts(theCase, { now: new Date(2026, 8, 23), runwayMonthsOverride: 5 });
  // 2027-Q1 is a window now: it opens 1 Jan 2027, 100 days = 3.2854 months
  // out, and ends 31 Mar, 6.2094 out. Five months of cash runs out INSIDE it;
  // three runs out before it opens.
  // (local dates: the November clock change adds an hour, hence the tolerance)
  near("2027-Q1 opens 100 / 30.4375 = 3.28542 months out", r2.rows[0].monthsToStart, 3.28542, 2e-3);
  ok("a 5-month runway runs out inside the Q1 2027 window -> inside", r2.rows[0].status === "inside" && r2.insideCount === 1);
  const r3 = api.computeRunwayVsCatalysts(theCase, { now: new Date(2026, 8, 23), runwayMonthsOverride: 3 });
  ok("a 3-month runway runs out before the window opens -> gap", r3.rows[0].status === "gap" && r3.gapCount === 1);
}
section("Local date stamp");
{
  // Constructed in local time, so this holds in any time zone the suite runs in.
  ok("11:30pm on 23 Sep stamps as 2026-09-23 (not the UTC next day)", api.localDateStamp(new Date(2026, 8, 23, 23, 30)) === "2026-09-23");
  ok("single-digit month and day are zero-padded", api.localDateStamp(new Date(2026, 0, 5, 0, 1)) === "2026-01-05");
}
section("Scatter: the x = y label clears every point, the line and the gridlines");
{
  // The Portfolio scatter: 560 x 280, padding 60/20/16/40, so the plot is
  // 480 x 224, both axes 0-80 with gridlines every 20 (y = 240, 184, 128, 72,
  // 16). One case at 65% modelled, 55% implied lands at x = 60 + 65/80*480 =
  // 450, y = 16 + 224 - 55/80*224 = 86. The old fixed spot (right edge,
  // baseline at the line's 70% height + 4 = 16 + 224*0.3 + 4 = 87.2) put the
  // text across that dot.
  const g = { minX: 0, maxX: 80, padL: 60, padT: 16, plotW: 480, plotH: 224, gridYs: [240, 184, 128, 72, 16] };
  g.toX = v => 60 + (v / 80) * 480; g.toY = v => 16 + 224 - (v / 80) * 224;
  const text = "same as the market", w = api.measureLabel(text, 10);
  const lineAt = x => g.toY(((x - 60) / 480) * 80);
  const box = at => ({ x0: at.x, x1: at.x + w, y0: at.y - 8, y1: at.y + 3 });
  const ptDist = (b, p) => { const cx = g.toX(p.x), cy = g.toY(p.y); return Math.hypot(Math.max(b.x0 - cx, 0, cx - b.x1), Math.max(b.y0 - cy, 0, cy - b.y1)); };
  const offLine = b => (b.y0 - 4 > lineAt(b.x0)) || (b.y1 + 4 < lineAt(b.x1));
  const offGrid = b => g.gridYs.every(gy => gy < b.y0 - 1 || gy > b.y1 + 1);
  const hug = b => Math.min(Math.abs(b.y0 - lineAt(b.x0)), Math.abs(b.y1 - lineAt(b.x1)));
  const inPlot = b => b.x0 >= 64 && b.x1 <= 536 && b.y0 >= 18 && b.y1 <= 238;
  const pt = [{ x: 65, y: 55 }];
  ok("the old fixed spot did overlap the 65/55 point (what this fixes)", ptDist(box({ x: g.toX(80) - 4 - w, y: 87.2 }), pt[0]) < 5);
  const b1 = box(api.placeDiagonalLabel(text, pt, g));
  ok("with the 65/55 case: 18px+ from it (" + ptDist(b1, pt[0]).toFixed(1) + "px), off the line, off every gridline, inside the plot", ptDist(b1, pt[0]) > 18 && offLine(b1) && offGrid(b1) && inPlot(b1));
  near("... and 5px from the line", hug(b1), 5, 1e-9);
  const b0 = box(api.placeDiagonalLabel(text, [], g));
  ok("nothing in the way: off the line and every gridline, inside the plot", offLine(b0) && offGrid(b0) && inPlot(b0));
  near("... 5px from the line", hug(b0), 5, 1e-9);
  ok("... in the top-right half of the line (left edge past the middle, x " + b0.x0.toFixed(0) + ")", b0.x0 > 300);
  const many = [{ x: 65, y: 55 }, { x: 70, y: 40 }, { x: 50, y: 30 }, { x: 20, y: 60 }, { x: 75, y: 62 }];
  const b2 = box(api.placeDiagonalLabel(text, many, g));
  ok("five scattered points: 18px+ from all of them, off the line and gridlines", many.every(p => ptDist(b2, p) > 18) && offLine(b2) && offGrid(b2) && inPlot(b2));
}
section("Scatter: a highlighted point's label clears the other points");
{
  // Plot 480 x 224 at (60, 16), both axes 0-100: value v sits at
  // x = 60 + 4.8v, y = 240 - 2.24v. "Your case" at (50, 50) -> (300, 128).
  const g = { padL: 60, padT: 16, plotW: 480, plotH: 224 };
  g.toX = v => 60 + 4.8 * v; g.toY = v => 240 - 2.24 * v;
  const text = "Your case", w = api.measureLabel(text, 10, 700), me = { x: 50, y: 50 };
  const clearOf = (at, pts) => pts.every(p => { const cx = g.toX(p.x), cy = g.toY(p.y); const dx = Math.max(at.x - cx, 0, cx - at.x - w), dy = Math.max(at.y - 8 - cy, 0, cy - at.y - 3); return Math.hypot(dx, dy) > 11; });
  const open = api.placePointLabel(text, me, [], g);
  near("nothing nearby: up and to the right, as before: x 312", open.x, 312, 1e-9);
  near("... y 120", open.y, 120, 1e-9);
  // A deal right where the up-right label would go: (55, 54) -> (324, 119).
  const blocker = [{ x: 55, y: 54 }];
  const moved = api.placePointLabel(text, me, blocker, g);
  ok("a deal under the up-right spot: the label moves (" + moved.x + ", " + moved.y + ")", !(Math.abs(moved.x - 312) < 1e-9 && Math.abs(moved.y - 120) < 1e-9) && clearOf(moved, blocker));
  // At the plot's right edge the label goes to the left of the point.
  const edge = api.placePointLabel(text, { x: 98, y: 50 }, [], g);
  ok("at the right edge it sits left of the point", edge.x + w < g.toX(98));
  // A gridline through the up-right spot (box y 112-123): y = 118 moves it.
  const gridded = api.placePointLabel(text, me, [], Object.assign({ gridYs: [118] }, g));
  ok("a gridline through the up-right spot moves it off the line (baseline " + gridded.y.toFixed(0) + ")", gridded.y - 8 > 119 || gridded.y + 3 < 117);
}
section("Chart gridlines: niceAxisTicks");
{
  // The screenshot that prompted this: risk-adjusted FCF from -$17M to $53M
  // was gridded at -17, 1, 18, 35, 53 — the zero line labelled "$1M".
  // Longhand: span 70M / 4 = 17.5M; magnitude 10M, normalised 1.75 -> step 2
  // x 10M = 20M; floor(-17/20) = -1 -> lo = -20M; ceil(53/20) = 3 -> hi = 60M.
  const t = api.niceAxisTicks(-17e6, 53e6);
  near("-17M..53M: step is 20M", t.step, 20e6, 1e-3);
  near("-17M..53M: axis floor -20M", t.lo, -20e6, 1e-3);
  near("-17M..53M: axis top 60M", t.hi, 60e6, 1e-3);
  ok("-17M..53M: ticks are -20, 0, 20, 40, 60 (M)", JSON.stringify(t.ticks) === JSON.stringify([-20e6, 0, 20e6, 40e6, 60e6]));
  // 0..1630: 1630/4 = 407.5; magnitude 100, normalised 4.075 -> 5 -> step 500;
  // top ceil(1630/500) = 4 -> 2000.
  const r = api.niceAxisTicks(0, 1630);
  ok("0..1630: ticks 0, 500, 1000, 1500, 2000", JSON.stringify(r.ticks) === JSON.stringify([0, 500, 1000, 1500, 2000]));
  // 0..9: 9/4 = 2.25; magnitude 1, normalised 2.25 -> 2.5 -> step 2.5; top 10.
  const q = api.niceAxisTicks(0, 9);
  ok("0..9: 2.5 steps up to 10", JSON.stringify(q.ticks) === JSON.stringify([0, 2.5, 5, 7.5, 10]));
  // All-negative, axis to zero: -50..0 -> 12.5 -> magnitude 10, 1.25 -> 2 -> 20;
  // floor(-50/20) = -3 -> -60.
  const n = api.niceAxisTicks(-50, 0);
  ok("-50..0: ticks -60, -40, -20, 0 (zero is the top gridline)", JSON.stringify(n.ticks) === JSON.stringify([-60, -40, -20, 0]));
  // A span that is already an exact multiple is not widened by float drift.
  const e = api.niceAxisTicks(0, 100);
  ok("0..100: exact multiple not widened (ticks 0..100 by 25)", JSON.stringify(e.ticks) === JSON.stringify([0, 25, 50, 75, 100]));
  ok("degenerate 0..0 still yields a finite, increasing axis", api.niceAxisTicks(0, 0).hi > 0);
  // Invariants across a sweep of awkward ranges.
  let allGood = true;
  [[-8.7, 1630], [-3.3e6, 0.4e6], [0.2, 0.9], [-1234567, 7654321], [12, 13]].forEach(([a, b]) => {
    const k = api.niceAxisTicks(a, b);
    if (!(k.lo <= a && k.hi >= b)) allGood = false;
    if (k.lo < 0 && k.hi > 0 && !k.ticks.includes(0)) allGood = false;
    if (k.ticks.length < 2 || k.ticks.length > 11) allGood = false;
  });
  ok("sweep: axis covers the data, includes 0 when it straddles it, 2-11 ticks", allGood);
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
  // The live API says APPROVAL (October 2026); it scored 0 before the fix.
  near("APPROVAL (what the live API returns) counts as 4", api.summarizeDossier(mk("APPROVAL")).drugs[0].maxPhase, 4, 0);
  ok("... is labelled Approved and counted in Phase 3+", api.summarizeDossier(mk("APPROVAL")).drugs[0].stageLabel === "Approved" && api.summarizeDossier(mk("APPROVAL")).approvedOrLateStage === 1);
  const mkW = warnings => { const t = mk("PHASE_4"); t.drugAndClinicalCandidates.rows[0].drug.drugWarnings = warnings; return t; };
  const wd = api.summarizeDossier(mkW([{ warningType: "Withdrawn", country: "United States", year: 2019 }, { warningType: "Black Box Warning", country: "United States", year: null }])).drugs[0];
  ok("a Withdrawn warning reads as withdrawn, with where and when; a black box warning is flagged", wd.withdrawn.join() === "United States 2019" && wd.boxedWarning === true);
  const none = api.summarizeDossier(mk("PHASE_3")).drugs[0];
  ok("no warnings: not withdrawn, no boxed warning — and nothing is ever called stopped", none.withdrawn.length === 0 && none.boxedWarning === false && !("stopped" in none));
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
  // Lattice data: k/81 for k = 0..40, once each (a responder difference with
  // 81 per arm). Raw width 40/81/30 = 0.0165 is 1.33 steps of 1/81, so bins
  // become exactly one step wide, centred on the points: 41 bars of one count
  // each. The old binning gave 30 bars of 1 or 2 — a saw-tooth from nothing.
  {
    const lat = []; for (let k = 0; k <= 40; k++) lat.push(k / 81);
    const hs = [...api.renderHistogram(lat, {}).matchAll(/<rect [^>]*height="([\d.]+)"[^>]*opacity="0.85"/g)].map(m => m[1]);
    ok("lattice data: one bar per step (41), all the same height", hs.length === 41 && hs.every(h => h === hs[0]));
  }
  {
    // The Trial Outcome histogram from the UI audit: effects spanning -0.13 to
    // 0.45 were labelled only at min / mid / max. niceTicks(-0.13, 0.45, 6):
    // raw step 0.58/6 = 0.0967, magnitude 0.01, normalised 9.67 -> 10 -> 0.1,
    // so the labels are -0.1, 0, 0.1, 0.2, 0.3, 0.4.
    const vals = []; for (let i = 0; i <= 58; i++) vals.push(-0.13 + i * 0.01);
    const svg = api.renderHistogram(vals, {});
    const labels = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).filter(t => /^-?[\d.]+$/.test(t));
    ["-0.1", "0", "0.1", "0.2", "0.3", "0.4"].forEach(t => ok("histogram x-axis labels the round value " + t, labels.includes(t)));
    ok("and no longer labels the raw extremes -0.13 / 0.45", !labels.includes("-0.13") && !labels.includes("0.45"));
  }
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

section("Live impact: the panel's number is the Overview's number");
{
  // baseCaseFairValue must reproduce the Base-case per-share value the
  // Valuation card computes (effective Base preset, the case's discount rate)
  // and the Sensitivity tool's baseline — one number, three places.
  const c = {
    name: "LI", currentPrice: "10", discountRatePct: "12",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "50000000", cash: "100000000", debt: "0" },
    corporateGA: { preCommercialAnnualM: "10", gaShareOfMatureSgaPct: "50" },
    programs: [{ id: "p1", name: "A", therapeuticArea: "Oncology", currentPhase: "phase2", modality: "small molecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "1500000000", yearsToPeak: "6" }, launchYearOffset: "5" }]
  };
  const direct = api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, "base"), "base", 12, { enabled: false }).equity.perShare;
  near("baseCaseFairValue equals the Valuation card's Base per-share value", api.baseCaseFairValue(c), direct, 1e-9);
  const sens = api.computeSensitivityDrivers(c, { skipGrid: true });
  near("and the Sensitivity tool's baseline", sens.baseline, direct, 1e-9);
  // This fixture has no saved costStructure — which used to crash the COGS
  // driver and empty the whole list (fixed alongside this check).
  ok("a program with no saved cost structure no longer breaks the drivers", !sens.error);
  ok("skipGrid leaves the price grid out and keeps the drivers", sens.gridData === null && sens.rows.length >= 4);
  ok("an empty case has no value rather than a wrong one", api.baseCaseFairValue({ programs: [] }) === null);
}

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

  // Stoke's Q2 2026 10-Q, as XBRL: cash $110.004M + available-for-sale debt
  // securities $182.814M current + $61.502M noncurrent = $354.320M, the
  // company's own "cash, cash equivalents and marketable securities". A stale
  // noncurrent balance from an earlier date is not added.
  const stok = { facts: { "us-gaap": {
    CashAndCashEquivalentsAtCarryingValue: { units: { USD: [{ end: "2026-06-30", val: 110004000, form: "10-Q" }] } },
    AvailableForSaleSecuritiesDebtSecuritiesCurrent: { units: { USD: [{ end: "2026-06-30", val: 182814000, form: "10-Q" }] } },
    AvailableForSaleSecuritiesDebtSecuritiesNoncurrent: { units: { USD: [{ end: "2026-06-30", val: 61502000, form: "10-Q" }] } },
    OperatingIncomeLoss: { units: { USD: [{ start: "2026-04-01", end: "2026-06-30", val: -65429000, form: "10-Q" }] } }
  } } };
  near("marketable securities, current and long-term, count as cash: $354.32M", api.calcRunwayFromFacts(stok).cashUSD, 354320000, 1e-6);
  // No cash-flow tag here, so the burn falls back to operating loss ($65.429M a quarter).
  ok("without a cash-flow tag, burn is the operating loss", api.calcRunwayFromFacts(stok).burnBasis === "operating loss");
  // With one: $117.167M used over the six months to Jun 30 → $19.528M a month,
  // $58.584M a quarter; runway 354.32 / 19.5278 = 18.14 months.
  const stokCF = JSON.parse(JSON.stringify(stok));
  stokCF.facts["us-gaap"].NetCashProvidedByUsedInOperatingActivities = { units: { USD: [
    { start: "2026-01-01", end: "2026-06-30", val: -117167000, form: "10-Q" },
    { start: "2025-01-01", end: "2025-06-30", val: 106405000, form: "10-Q" }] } };
  const rcf = api.calcRunwayFromFacts(stokCF);
  ok("with a cash-flow tag, burn is cash used in operations over its 6-month span", rcf.burnBasis === "cash used in operations" && rcf.burnPeriodMonths === 6);
  near("quarterly burn $58.584M (117.167 / 6 × 3)", rcf.quarterlyBurnUSD, 58583500, 1);
  near("runway 18.14 months", rcf.runwayMonths, 354320000 / (117167000 / 6), 1e-9);
  // A positive operating cash flow is not a burn: fall back to operating loss.
  const pos = JSON.parse(JSON.stringify(stokCF)); pos.facts["us-gaap"].NetCashProvidedByUsedInOperatingActivities.units.USD[0].val = 5000000;
  ok("a cash inflow is not used as burn", api.calcRunwayFromFacts(pos).burnBasis === "operating loss");
  const stale = JSON.parse(JSON.stringify(stok));
  stale.facts["us-gaap"].AvailableForSaleSecuritiesDebtSecuritiesNoncurrent.units.USD[0].end = "2025-12-31";
  near("a securities balance dated differently from the cash is left out: $292.818M", api.calcRunwayFromFacts(stale).cashUSD, 292818000, 1e-6);

  // Fully diluted from an EDGAR pull, not the EPS weighted average. Stoke-like:
  // 64,526,242 basic, 10,151,430 options at $13.84, no warrants, price $24.80.
  // Treasury method: proceeds 10,151,430 × 13.84 = 140,495,791; buyback at
  // 24.80 = 5,665,153; net new 4,486,277 → 69,012,519. No price → all-in 74,677,672.
  const pull = { basicShares: 64526242, dilutedShares: 64548862, options: { count: 10151430, avgStrike: 13.84 }, warrants: null };
  near("fully diluted by treasury method at $24.80: 69,012,519", api.edgarFullyDilutedShares(pull, "24.80").shares, 69012519, 1);
  near("no price: every option counted, 74,677,672", api.edgarFullyDilutedShares(pull, "").shares, 74677672, 0);
  ok("never the EPS weighted average", api.edgarFullyDilutedShares(pull, "24.80").shares !== pull.dilutedShares);
  ok("no basic shares → null, the case keeps its own", api.edgarFullyDilutedShares({ dilutedShares: 5 }, 10) === null);
  ok("as-of label for a period end", api.edgarAsOf("2025-12-31") === " (as of Dec 31, 2025)" && api.edgarAsOf(null) === "");
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
  // Spruce's own Q2 2026 tags (companyfacts, 2026-10-05): the balance sheet
  // is $2.5M current + $4.591M non-current = $7.091M; LongTermDebt $19.944M is
  // the repayment schedule with interest; DebtInstrumentCarryingAmount $16.6M
  // is the face ($15M principal + the $1.6M final payment).
  const q = v => ({ units: { USD: [{ val: v, end: "2026-06-30", form: "10-Q" }] } });
  const sprb = { LongTermDebtNoncurrent: q(4591000), LongTermDebtCurrent: q(2500000), LongTermDebt: q(19944000), DebtInstrumentCarryingAmount: q(16600000) };
  const dS = api.extractDebt(sprb, "2026-06-30");
  ok("Spruce: the balance sheet's $7.091M, not the $24.5M sum that counted LongTermDebt on top", dS && dS.value === 7091000);
  ok("... with the $16.6M face beside it, the tags named", dS.faceUSD === 16600000 && dS.tags.map(t => t.tag).join("+") === "LongTermDebtNoncurrent+LongTermDebtCurrent");
  ok("only the total filed: the total is used", api.extractDebt({ LongTermDebt: q(30000000) }, "2026-06-30").value === 30000000);
  ok("a loan whose tag stopped being filed years ago is not counted", api.extractDebt({ LongTermDebtNoncurrent: { units: { USD: [{ val: 9e6, end: "2022-12-31", form: "10-K" }] } } }, "2026-06-30") === null);
  ok("no face reported when it is within 10% of the carrying value", api.extractDebt({ LongTermDebtNoncurrent: q(10e6), DebtInstrumentCarryingAmount: q(10.5e6) }, "2026-06-30").faceUSD === null);
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
  ok("Ke = 0 says what actually happened", api.formatHalfLife(0) === "none (Ke = 0, no elimination modeled)");
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
  // Several names for one drug: split on comma, semicolon or " or ", never on
  // a slash (combination products). A trial listing any one of them matches.
  ok("names: 'zorevunersen, STK-001' is two names", JSON.stringify(api.assetProgramNames("zorevunersen, STK-001")) === '["zorevunersen","STK-001"]');
  ok("names: ' or ' and ';' also separate", api.assetProgramNames("a or b; c").length === 3);
  ok("names: a slash joins, not separates", api.assetProgramNames("sofosbuvir/velpatasvir").length === 1);
  ok("a study listing only the code name matches the name list",
    api.studyNamesIntervention(t({ interventions: ["STK-001 - Single Ascending Doses"], interventionsDetailed: [{ name: "STK-001 - Single Ascending Doses", otherNames: [] }], title: "STK-001 in Dravet" }), "zorevunersen, STK-001"));
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
    thinLines.some(l => l.key === "controlled" && /nothing in this program to measure the drug against/.test(l.text)));
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

section("Medicare and Medicaid together — one drug, three spellings, and hidden is not zero");
{
  // ── Names: "Exondys 51" (FDA), "Exondys-51" (CMS's Medicaid summary),
  // "EXONDYS 51" (the state file) are one drug ──
  ok("FDA, CMS and state-file spellings share one key", api.drugNameKey("Exondys 51") === "exondys51" && api.drugNameKey("Exondys-51") === "exondys51" && api.drugNameKey(" EXONDYS 51 ") === "exondys51");
  ok("CMS's footnote asterisk is not part of the key", api.drugNameKey("Uptravi*") === "uptravi");
  ok("a different product of the same family is not the same key", api.drugNameKey("Opdivo Qvantig") !== api.drugNameKey("Opdivo"));

  // ── Package codes: FDA writes labeler-product in three widths; the state
  // file writes the 11-digit 5-4-2 form, zero padded ──
  const c1 = api.ndcProductCodes("60923-284");   // 5-3-2: product padded to 4
  ok("5-3-2: 60923-284 → 60923 / 0284", c1.labeler === "60923" && c1.product === "0284");
  const c2 = api.ndcProductCodes("1234-5678");   // 4-4-2: labeler padded to 5
  ok("4-4-2: 1234-5678 → 01234 / 5678", c2.labeler === "01234" && c2.product === "5678");
  const c3 = api.ndcProductCodes("12345-6789");  // 5-4-1: both already full width
  ok("5-4-1: 12345-6789 → 12345 / 6789", c3.labeler === "12345" && c3.product === "6789");
  ok("not an NDC → null", api.ndcProductCodes("Evrysdi") === null && api.ndcProductCodes("") === null);

  // ── Which drug was meant ──
  const evr = api.pickDrugIdentity("risdiplam", [
    { brand_name: "Evrysdi", generic_name: "risdiplam", product_ndc: "50242-175" },
    { brand_name: "EVRYSDI", generic_name: "RISDIPLAM", product_ndc: "50242-176" },
    { brand_name: "EVRYSDI", generic_name: "RISDIPLAM", product_ndc: "50242-176" }]);
  ok("a generic with one brand picks that brand", evr.brand === "Evrysdi" && evr.matchedBy === "generic");
  ok("and keeps each package code once (2, not 3)", evr.products.length === 2 && evr.products[1].product === "0176");
  const ada = api.pickDrugIdentity("adalimumab", [
    { brand_name: "Humira", generic_name: "adalimumab", product_ndc: "0074-0554" },
    { brand_name: "Hadlima", generic_name: "adalimumab-bwwd", product_ndc: "0006-4133" },
    { brand_name: "Hyrimoz", generic_name: "adalimumab", product_ndc: "61314-454" }]);
  ok("a generic with two brands picks neither, and offers both", ada.brand === null && ada.candidates.length === 2 && ada.products.length === 0);
  const exo = api.pickDrugIdentity("Exondys", [{ brand_name: "Exondys 51", generic_name: "eteplirsen", product_ndc: "60923-284" }]);
  ok("the one brand a partial name finds is taken, and says so", exo.brand === "Exondys 51" && exo.matchedBy === "partial");
  const brandHit = api.pickDrugIdentity("exondys-51", [{ brand_name: "Exondys 51", generic_name: "eteplirsen", product_ndc: "60923-284" }]);
  ok("a brand typed with CMS's hyphen is still the brand", brandHit.matchedBy === "brand");

  // ── The state file's ten-character name ──
  ok("'EVRYSDI (r' is Evrysdi", api.sdudNameMatches("EVRYSDI (r", "Evrysdi"));
  ok("'XYZAL' is not 'Xyz' (a letter follows)", !api.sdudNameMatches("XYZAL", "Xyz"));
  ok("padding is ignored", api.sdudNameMatches("ZOLGENSMA ", "Zolgensma"));
  ok("a brand of ten letters or more matches on its first ten", api.sdudNameMatches("KEYTRUDA Q", "Keytruda Qlex"));
  ok("CMS's hyphen and the state file's space agree", api.sdudNameMatches("EXONDYS 51", "Exondys-51"));

  // ── A year of national rows → quarters. Hidden is never zero ──
  // Q1: two packages, $100 + $50, 6 + 4 prescriptions → $150, 10, complete.
  // Q2: $200 (8 prescriptions) and one hidden package → $200 is a floor.
  // Q3: every package hidden → no figure at all.
  // A state's row (AL) is not national and must not be added.
  const rows = [
    { state: "XX", quarter: "1", suppression_used: "false", total_amount_reimbursed: "100", number_of_prescriptions: "6", units_reimbursed: "60" },
    { state: "XX", quarter: "1", suppression_used: "false", total_amount_reimbursed: "50", number_of_prescriptions: "4", units_reimbursed: "40" },
    { state: "XX", quarter: "2", suppression_used: "false", total_amount_reimbursed: "200", number_of_prescriptions: "8", units_reimbursed: "80" },
    { state: "XX", quarter: "2", suppression_used: "true", total_amount_reimbursed: null, number_of_prescriptions: null, units_reimbursed: null },
    { state: "XX", quarter: "3", suppression_used: "true", total_amount_reimbursed: null },
    { state: "AL", quarter: "1", suppression_used: "false", total_amount_reimbursed: "999", number_of_prescriptions: "99" }];
  const qs = api.summariseSdudQuarters(rows, 2025);
  near("Q1: $100 + $50 = $150 (the state row left out)", qs[0].spending, 150, 0);
  ok("Q1: 10 prescriptions, complete", qs[0].prescriptions === 10 && qs[0].status === "complete");
  ok("Q2: $200 with one package hidden is partial", qs[1].spending === 200 && qs[1].status === "partial" && qs[1].hiddenRows === 1);
  ok("Q3: all hidden → null, not 0", qs[2].status === "hidden" && qs[2].spending === null);
  // Three quarters published: Q1–Q3, $150 + $200 = $350, a floor (Q2 partial, Q3 hidden).
  const p3 = api.sdudPeriod(qs, 2025, 3);
  ok("three quarters out → '2025 (Q1-Q3)', partial", p3.label === "2025 (Q1-Q3)" && p3.quarterCount === 3 && !p3.isFullYear);
  near("the year so far is $150 + $200 = $350", p3.spending, 350, 0);
  ok("a floor, not hidden, with no spend per prescription", p3.floor && !p3.hidden && p3.avgSpendPerClaim === null && p3.hiddenRows === 2);
  // Four published, no Q4 rows at all: Q4 had no prescriptions, so the
  // year is $350 still — and still a floor.
  const p4 = api.sdudPeriod(qs, 2025, 4);
  ok("four quarters out → the whole year, labelled '2025'", p4.label === "2025" && p4.isFullYear && p4.quarterCount === 4);
  near("an unpublished-looking Q4 with no rows adds nothing", p4.spending, 350, 0);
  // One published quarter, complete: $150 over 10 prescriptions = $15 each.
  const p1 = api.sdudPeriod(qs, 2025, 1);
  ok("one complete quarter → '2025 (Q1)', not a floor", p1.label === "2025 (Q1)" && !p1.floor);
  near("spend per prescription $150 / 10 = $15", p1.avgSpendPerClaim, 15, 1e-9);
  const hiddenYear = api.sdudPeriod(api.summariseSdudQuarters([{ state: "XX", quarter: "1", suppression_used: "true" }, { state: "XX", quarter: "2", suppression_used: "true" }], 2025), 2025, 2);
  ok("a year where every package is hidden is 'hidden', spending null", hiddenYear.hidden && hiddenYear.spending === null);
  ok("nothing published yet → no period", api.sdudPeriod(qs, 2025, 0) === null);
  // Growth never runs from or to a floor.
  const g = api.addComparableMedicaidGrowth([
    { label: "2023", quarterCount: 4, spending: 100 }, { label: "2024", quarterCount: 4, spending: 150 }, { label: "2025", quarterCount: 4, spending: 200, floor: true }]);
  near("2024 vs 2023: 150 / 100 − 1 = +50%", g[1].growthVsComparable, 0.5, 1e-12);
  ok("2025 is a floor, so no growth is claimed", g[2].growthVsComparable === null);

  // ── Part B lists a drug once per billing code ──
  // $100 + $50 = $150 and 10 + 5 = 15 claims add; patients (4 and 3) do not,
  // since one patient can sit under both codes. $150 / 15 = $10 a claim.
  const comb = api.combineSamePeriods([
    { label: "2024", sortKey: 20244, quarterCount: 4, spending: 100, claims: 10, beneficiaries: 4, avgSpendPerBene: 25 },
    { label: "2024", sortKey: 20244, quarterCount: 4, spending: 50, claims: 5, beneficiaries: 3, avgSpendPerBene: 16.7 }]);
  ok("two codes, one period", comb.length === 1 && comb[0].codes === 2);
  near("spending adds: $150", comb[0].spending, 150, 0);
  ok("patients and spend per patient are dropped, not summed", comb[0].beneficiaries === null && comb[0].avgSpendPerBene === null);
  near("spend per claim recomputed: $150 / 15 = $10", comb[0].avgSpendPerClaim, 10, 1e-12);
  // Part B spells its averages "Spndng"; Keytruda 2024: $79,464.46 a patient.
  const pb = api.parseCmsAnnualRow({ Brnd_Name: "Keytruda", Tot_Spndng_2024: "5988521233", Tot_Benes_2024: "75361", Tot_Clms_2024: "455858",
    Avg_Spndng_Per_Bene_2024: "79464.46084", Avg_Spndng_Per_Clm_2024: "13136.81285", Avg_Spndng_Per_Dsg_Unt_2024: "55.71920754", Tot_Spndng_2023: "" });
  near("Part B's 'Spndng' spend per patient is read", pb.periods[0].avgSpendPerBene, 79464.46084, 1e-6);
  near("and its spend per unit ($55.72 a mg)", pb.periods[0].avgSpendPerUnit, 55.71920754, 1e-9);
  ok("the dataset's last year is 2024", pb.dataEndYear === 2024 && pb.dataStartYear === 2023);

  // ── Payers combined ──
  // Part D: 2024 $100, 2025 $120, 2026 Q1 $30. Medicaid: 2024 $300, 2025 $350
  // (a floor). Part B starts 2025 at $10, so in 2024 it had nothing (0).
  const P = (label, year, qc, spending, extra) => Object.assign({ label, year, quarterCount: qc, quarters: qc === 4 ? [1, 2, 3, 4] : [1], isFullYear: qc === 4, sortKey: year * 10 + (qc === 4 ? 4 : 1), spending }, extra || {});
  const src = (key, series) => ({ key, result: { found: true, series } });
  const cmb = api.combinePayerSeries([
    src("partD", [P("2024", 2024, 4, 100), P("2025 (Q1-Q4)", 2025, 4, 120), P("2026 (Q1)", 2026, 1, 30)]),
    src("partB", [P("2025 (Q1-Q4)", 2025, 4, 10)]),
    src("medicaid", [P("2024", 2024, 4, 300), P("2025", 2025, 4, 350, { floor: true })])]);
  ok("three periods, labelled by the shorter name", cmb.length === 3 && cmb[1].label === "2025");
  near("2024: $100 + $300 (Part B not yet selling: 0) = $400", cmb[0].total, 400, 0);
  ok("2024 is complete — a payer that starts later had nothing then", cmb[0].complete && cmb[0].noFigure.length === 0);
  near("2025: $120 + $10 + $350 = $480", cmb[1].total, 480, 0);
  ok("2025 is a floor (Medicaid's is), so no growth is claimed", !cmb[1].complete && cmb[1].growthVsComparable === null);
  ok("2026 Q1: Part B and Medicaid have no figure — incomplete, never a fall", cmb[2].noFigure.join(",") === "partB,medicaid" && !cmb[2].complete && cmb[2].total === 30);
  const tot = api.payerTotalSeries(cmb);
  ok("the total series carries every readable row, floors marked", tot.length === 3 && tot[0].floor === false && tot[1].floor === true);

  // ── What payers pay, as a price ──
  // Evrysdi-like: Part D $332,072.80 a patient, 6,132 claims / 554 patients.
  // Part B $106,000 a patient → ÷ 1.06 = $100,000 at ASP.
  // Medicaid $23,735.13 a prescription × (6,132 / 554 = 11.068592) prescriptions
  //   = 23,735.13 × 11 + 23,735.13 × 0.068592 = 261,086.43 + 1,628.04 = $262,714.47.
  const res = { sources: [
    src("partD", [P("2025 (Q1-Q4)", 2025, 4, 1, { avgSpendPerBene: 332072.8, claims: 6132, beneficiaries: 554 })]),
    src("partB", [P("2024", 2024, 4, 1, { avgSpendPerBene: 106000, beneficiaries: 12 }), P("2025 (Q1)", 2025, 1, 1, { avgSpendPerBene: 50000 })]),
    src("medicaid", [P("2024", 2024, 4, 1, { avgSpendPerClaim: 23735.13 }), P("2025", 2025, 4, 1, { avgSpendPerClaim: 99999, floor: true })])] };
  const figs = api.payerPriceFigures(res);
  const fig = k => figs.find(f => f.key === k);
  near("Part D: the year's spend per patient, on a WAC basis", fig("partD").value, 332072.8, 1e-9);
  ok("Part D's basis is WAC", fig("partD").basis === "WAC");
  near("Part B: $106,000 ÷ 1.06 = $100,000 at ASP (the partial year is skipped)", fig("partB").value, 100000, 1e-6);
  ok("Part B's basis is ASP", fig("partB").basis === "ASP" && fig("partB").period === "2024" && api.PART_B_ASP_ADD_ON === 1.06);
  near("Medicaid prescriptions a year from Part D: 6,132 / 554", fig("medicaid").fills, 11.068592057761733, 1e-12);
  near("Medicaid: $23,735.13 × 11.068592 = $262,714.47 (the 2025 floor is skipped)", fig("medicaid").value, 262714.47, 0.01);
  near("with 12 prescriptions typed: $23,735.13 × 12 = $284,821.56", api.payerPriceFigures(res, "12").find(f => f.key === "medicaid").value, 284821.56, 1e-6);
  const noFills = api.payerPriceFigures({ sources: [src("medicaid", [P("2024", 2024, 4, 1, { avgSpendPerClaim: 1367213.56 })])] });
  ok("Medicaid alone with no prescriptions a year gives no price, not a guess", noFills.length === 1 && noFills[0].value === null && noFills[0].fills === null);
}

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
  // A milestone paid at approval is worth  face × P(launch) ÷ (1+r)^L,  where
  // L is the case's launch year (the benchmark timeline rounded, when the
  // launch year is blank). So with everything else fixed:
  //   · a 50% PoS override vs a 10% one gives exactly 0.50/0.10 = 5× the value;
  //   · a Bear PoS multiplier of 70% on a 50% override gives 0.35/0.50 = 0.7×;
  //   · $100M × 0.35 ÷ 1.12^L in absolute terms.
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
  const T = Math.round(api.computeRnDToLaunch(prog("50", launchM)).totalYears); // = L, the launch year the case uses

  const m50 = api.computePartnershipContribution(mkCase(prog("50", launchM)), 0.12, base);
  const m10 = api.computePartnershipContribution(mkCase(prog("10", launchM)), 0.12, base);
  near("a 50% override is worth exactly 5x a 10% override", m50 / m10, 5, 1e-9);
  near("absolute: $100M x 0.50 / 1.12^L", m50, 100e6 * 0.50 / Math.pow(1.12, T), 1e-3);

  const mBear = api.computePartnershipContribution(mkCase(prog("50", launchM)), 0.12, bear);
  near("a Bear 70% PoS multiplier scales the milestone by exactly 0.7", mBear / m50, 0.7, 1e-9);
  near("absolute Bear: $100M x 0.35 / 1.12^L", mBear, 100e6 * 0.35 / Math.pow(1.12, T), 1e-3);

  // PRV and a launch milestone of equal face on one program: both are face ×
  // the SAME effective P(launch), discounted from the same launch year L = 5,
  // so they are equal — $150M × 0.35 / 1.12^5 each. (They used to differ by
  // 1.12^(T − L): the milestone read the benchmark timeline, not the launch
  // year the case typed.)
  const both = prog("50", [{ label: "Approval", gate: "launch", valueM: "150" }], { launchYearOffset: "5", prv: { enabled: true, valueM: "150" } });
  const cv = api.computeCaseValuation(mkCase(both), bear, null, 12, { enabled: false });
  near("PRV = $150M x 0.35 / 1.12^5", cv.equity.prvValueAdded, 150e6 * 0.35 / Math.pow(1.12, 5), 1e-3);
  near("a launch milestone is paid in the same launch year as the PRV: equal values", cv.equity.partnershipValueAdded, cv.equity.prvValueAdded, 1e-3);
  // With an R&D override the stage calendar is the scaled one the R&D costs
  // run on: a filing milestone on a 3-year override of a T-year timeline is
  // paid at (years before filing) × 3/T.
  const rndItems = api.computeRnDToLaunch(prog("50", launchM)).items;
  const Tfull = rndItems.reduce((a, i) => a + i.years, 0);
  const beforeFiling = rndItems.filter(i => i.key !== "regulatory").reduce((a, i) => a + i.years, 0);
  const ov = prog("50", [{ label: "Filing", gate: "regulatory", valueM: "100" }], { launchYearOffset: "3", rndOverride: { totalYears: "3", totalCostM: "" } });
  const reachFiling = api.computeEffectivePoS(ov, base).posStages.find(st => st.key === "regulatory").posToReachStage;
  near("a filing milestone on an overridden timeline is discounted over the scaled years", api.computePartnershipContribution(mkCase(ov), 0.12, base), 100e6 * reachFiling / Math.pow(1.12, beforeFiling * 3 / Tfull), 1e-3);

  // Simple Multiple calls the same function and must pass its scenario too.
  const sm = api.computeSimpleMultipleValuation(mkCase(prog("50", launchM)), bear, null, 3, 12);
  near("Simple Multiple: milestone = $100M x 0.35 / 1.12^L", sm.equity.partnershipValueAdded, 100e6 * 0.35 / Math.pow(1.12, T), 1e-3);

  // A stage gate reads the rebuilt stage path: the milestone is paid with the
  // probability of REACHING its stage. The stages always multiply back to the
  // override; the factor is spread evenly in log space, and a stage that would
  // pass 99% is held there with its excess spread over the others.
  // Benchmark stages here (Oncology Phase 2, small molecule): P2 0.25161,
  // P3 0.41135, filing 0.884; product 0.091494.
  //   10%: k = (0.10 / 0.091494)^(1/3) = 1.03010, filing 0.884 x 1.03010 =
  //        0.91061 < 99%, nothing capped -> reach(filing) = 0.10 / 0.91061 = 0.109819
  //   50%: k = (0.50 / 0.091494)^(1/3) = 1.7612 would put filing at 1.557, so it
  //        holds at 0.99 -> reach(filing) = 0.50 / 0.99 = 0.505051 (P2 0.5558 and
  //        P3 0.9087 carry the rest, both under the cap)
  // The even split used to ignore the cap and drop the excess, which charged
  // stage costs at lower odds than the revenue (see the next section).
  const stages = api.computePoSWeighting(prog("50", launchM)).stages;
  const j = stages.findIndex(st => st.key === "regulatory");
  const regM = [{ label: "Filing", gate: "regulatory", valueM: "100" }];
  const r50 = api.computePartnershipContribution(mkCase(prog("50", regM)), 0.12, base);
  const r10 = api.computePartnershipContribution(mkCase(prog("10", regM)), 0.12, base);
  ok("the fixture has a regulatory stage after the current one", j > 0);
  const reach10 = 0.10 / (0.884 * Math.pow(0.10 / (0.2516091205211726 * 0.4113528399311532 * 0.884), 1 / 3));
  near("reach(filing) at 10% is 0.109819, worked longhand", reach10, 0.109819, 1e-6);
  near("a filing milestone at 50% vs 10% is (0.50/0.99) / 0.109819", r50 / r10, (0.50 / 0.99) / reach10, 1e-9);

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

section("Stage odds always multiply back to the odds asked for");
{
  // Revenue is weighted by posToLaunch and each stage's cost by the odds of
  // reaching it; the two must describe the same path. A stage past the 99% cap
  // used to lose its excess, so "certain success" (a 100% override, used by
  // every "if it works" figure) ran on PepGen as 69% x 99% x 99% = 67.9% — its
  // $230M Phase 3 charged at 69% in a world where the drug surely launches.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8")).programs[0];
  const prod = e => e.posStages.reduce((a, st) => a * st.pos, 1);
  const cert = api.computeEffectivePoS({ ...pg, posOverridePct: "100" }, { posMultiplierPct: 100 });
  near("PepGen at 100%: the stages multiply to 1", prod(cert), 1, 1e-12);
  ok("PepGen at 100%: every stage is reached for certain", cert.posStages.every(st => Math.abs(st.posToReachStage - 1) < 1e-12));
  // Where no stage reaches the cap nothing changes: PepGen's Base 15% keeps
  // its gates 36.79% / 56.86% / 71.71% (product 0.1500).
  const b = api.computeEffectivePoS(pg, { posMultiplierPct: 100 });
  near("PepGen Base: stages multiply to 15%", prod(b), 0.15, 1e-12);
  near("PepGen Base: the Phase 2 gate is still 36.79%", b.posStages[0].pos, 0.3679, 5e-5);
  // A capped stage passes its excess on. A 2-stage program whose second stage
  // would pass 99%: P3 0.718, filing 0.905 (product 0.650); asking for 84.5%
  // (x1.3): an even split gives filing 0.905 x 1.3^(1/2) = 1.032 > 0.99, so
  // filing holds at 0.99 and P3 = 0.845 / 0.99 = 0.853535.
  const two = { id: "t", name: "T", currentPhase: "phase3", therapeuticArea: "Neurology", modality: "smallMolecule",
    revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" } };
  const raw = api.computePoSWeighting(two);
  const f = 0.845 / raw.posToLaunch * 100;
  const t = api.computeEffectivePoS(two, { posMultiplierPct: f });
  near("asking for 84.5%: the stages multiply to 84.5%", prod(t), 0.845, 1e-12);
  if (raw.stages[1].pos * Math.sqrt(f / 100) > 0.99) {
    near("the capped stage holds at 99%", t.posStages[1].pos, 0.99, 1e-12);
    near("and the other takes 0.845 / 0.99", t.posStages[0].pos, 0.845 / 0.99, 1e-12);
  } else ok("fixture: the filing stage reaches the cap at 84.5%", false);
}
report();

section("Implied PoS and implied share keep a modelled raise, as the headline does");
{
  // The FIN-007 fixture ($12 price, 10M shares) with a $50M raise at $8:
  // 50,000,000 / 8 = 6,250,000 new shares, 16,250,000 in all. Fair value per
  // share = (equity before the raise + 50M) / 16.25M, so it equals $12 when
  // equity before the raise = 12 x 16,250,000 - 50,000,000 = $145,000,000 —
  // not the $120M (12 x 10M) the solver used to aim for by dropping the raise.
  // Found on the PepGen case: typing its implied PoS back in showed $2.19
  // against a $2.34 price.
  const c = {
    name: "IPR", currentPrice: "12",
    capitalStructure: { mode: "simple", dilutedSharesSimple: "10000000", cash: "20000000", debt: "0" },
    corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" },
    futureRaise: { enabled: true, amountM: "50000000", priceOverride: "8" },
    programs: [{ id: "p1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "800000000", yearsToPeak: "6", profile: "median" }, posOverridePct: "30" }]
  };
  const tv = { enabled: false };
  const flat = { label: "b", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const sol = api.solveImpliedPoSMultiplier(c, 12, tv);
  ok("solves without hitting a range limit", sol.ok && !sol.degenerate);
  const c2 = JSON.parse(JSON.stringify(c)); c2.programs[0].posOverridePct = String(sol.impliedAbsolutePct);
  const r2 = api.computeCaseValuation(c2, flat, null, 12, tv);
  near("at the implied PoS the headline per-share value is the $12 price", r2.equity.perShare, 12, 1e-4);
  near("the modelled raise adds 6,250,000 shares", r2.equity.dilutedShares, 16250000, 1e-6);
  const noRaise = JSON.parse(JSON.stringify(c2)); noRaise.futureRaise = null;
  near("equity before the raise at that PoS is $145,000,000, worked longhand", api.computeCaseValuation(noRaise, flat, null, 12, tv).equity.equityValue, 145000000, 50);
  // A raise AT the price is value-neutral at the break-even point:
  // (12 x 10M + R) / (10M + R/12) = 12 for any R — so the answer must equal
  // the no-raise answer.
  const atPrice = JSON.parse(JSON.stringify(c)); atPrice.futureRaise.priceOverride = "";
  const none = JSON.parse(JSON.stringify(c)); none.futureRaise = null;
  near("a raise at today's price leaves the implied PoS unchanged", api.solveImpliedPoSMultiplier(atPrice, 12, tv).impliedAbsolutePct, api.solveImpliedPoSMultiplier(none, 12, tv).impliedAbsolutePct, 1e-6);
  // The same for the implied peak revenue (Quick mode).
  const v = api.solveImpliedVariable(c, 12, tv, "peakRevenue");
  const c3 = JSON.parse(JSON.stringify(c)); c3.programs[0].quickRevenue.peakRevenue = String(v.impliedValue);
  near("at the implied peak revenue the headline is the $12 price too", api.computeCaseValuation(c3, flat, null, 12, tv).equity.perShare, 12, 1e-4);
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

  // A territory-limited royalty in Quick mode is applied to all revenue, so it
  // is flagged; a global deal, a Full-mode deal and a deal with no royalty are not.
  const qCase = (mode, territory, royaltyPct) => ({ name: "Q", capitalStructure: { mode: "simple", dilutedSharesSimple: "1" },
    programs: [{ id: "q1", name: "Asset", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule", revenueMode: mode,
      quickRevenue: { peakRevenue: "1000000000", yearsToPeak: "6", profile: "median" }, revenueBuild: rb("60"),
      partnership: { enabled: true, territory, royaltyPct, upfrontM: "", costSharingPct: "", milestones: [] } }] });
  const napkinFlag = c => api.computeRedFlags(c).some(f => /Napkin mode has one revenue figure/.test(f.message));
  ok("Quick + ex-US royalty is flagged", napkinFlag(qCase("quick", "exUS", "15")));
  ok("Quick + US-only royalty is flagged", napkinFlag(qCase("quick", "us", "15")));
  ok("Quick + global royalty is not (it means what it says)", !napkinFlag(qCase("quick", "global", "15")));
  ok("Full + ex-US royalty is not (the split is honoured)", !napkinFlag(qCase("full", "exUS", "15")));
  ok("Quick + a deal with no royalty is not", !napkinFlag(qCase("quick", "exUS", "")));
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

section("Icon-array captions wrap instead of being clipped");
{
  // A 400-wide chart holds ~61 characters of 11px text per line
  // ((400 - 20) / 6.2). The 2x2 caption is ~90 characters; drawn as one
  // centred line it was cut off at both ends.
  const cap = "For every 100 treated with Treatment, about 20.0 more benefit than would have with Control";
  const svg = api.renderIconArray(0.2, { title: "NNT = 5", subtitle: cap });
  const lines = (svg.match(/<text[^>]*font-size="11"[^>]*>([^<]*)<\/text>/g) || []).map(t => t.replace(/<[^>]+>/g, ""));
  ok("a long caption is split over more than one line", lines.length >= 2);
  ok("no caption line is longer than fits (61 characters)", lines.every(l => l.length <= 61));
  ok("no words are lost", lines.join(" ") === cap);
  const vb = +(svg.match(/viewBox="0 0 \d+ (\d+)"/) || [])[1];
  ok("the chart grows to make room (taller than the 300 default)", vb > 300);
  ok("a short caption stays on one line", (api.renderIconArray(0.5, { subtitle: "Half" }).match(/font-size="11"/g) || []).length === 1);
  // Fragility Index "6 out of 50" used to draw a 100-dot grid with 12 lit —
  // the right share, the wrong count, under a title stating the count.
  {
    const fi = api.renderIconArray(6 / 50, { units: 50, highlightCount: 6, highlightColor: "HL", baseColor: "BASE", title: "6 out of 50" });
    near("count mode draws exactly 50 dots", (fi.match(/<circle/g) || []).length, 50, 0);
    near("and lights exactly 6 of them", (fi.match(/fill="HL"/g) || []).length, 6, 0);
    const pct = api.renderIconArray(6 / 50, { highlightColor: "HL" });
    near("the default per-100 grid is unchanged: 100 dots", (pct.match(/<circle/g) || []).length, 100, 0);
    near("with 12 lit (6/50 = 12 per 100)", (pct.match(/fill="HL"/g) || []).length, 12, 0);
  }
}
report();

section("Plain-English readings: each sentence matches the numbers under it");
{
  // Price vs scenarios. Bear -0.48 / Base -0.10 / Bull 0.71, price 10:
  // above the highest (0.71) by 10 - 0.71 = 9.29.
  let r = api.readPriceVsScenarios(10, -0.48, -0.10, 0.71);
  ok("price above Bull -> 'above even your Bull case'", r.verdict === "Priced above even your Bull case.");
  ok("gap to Bull is $9.29", r.text.includes("$9.29 more") && r.text.includes("($0.71)"));
  // Price 2, Bear 3, Base 5, Bull 8: below Bear; (3/2 - 1) = 50% above.
  r = api.readPriceVsScenarios(2, 3, 5, 8);
  ok("price below Bear -> 'below even your Bear case', Bear 50% above", r.verdict.startsWith("Priced below even your Bear") && r.text.includes("($3.00) is 50% above"));
  // Price 6 between Base 5 and Bull 8.
  ok("between Base and Bull", api.readPriceVsScenarios(6, 3, 5, 8).verdict === "Priced between your Base and Bull cases.");
  // Price 4 between Bear 3 and Base 5: Base is 5/4 - 1 = 25% above.
  r = api.readPriceVsScenarios(4, 3, 5, 8);
  ok("between Bear and Base, Base 25% above", r.verdict === "Priced between your Bear and Base cases." && r.text.includes("($5.00) is 25% above"));
  ok("no price -> no reading", api.readPriceVsScenarios(null, 3, 5, 8) === null);

  // Monte Carlo: 10 values 1..10, price 8 -> 8, 9, 10 are >= 8 -> 30%.
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  r = api.readMonteCarlo(vals, 1.9, 9.1, 8, [{ label: "PoS", correlation: 0.4 }, { label: "Peak share/revenue", correlation: -0.7 }]);
  ok("30% of trials at or above the price", r.verdict === "Fair value beats today's price in 30% of simulations.");
  ok("top driver by |correlation| is Peak share (|-0.7| > 0.4)", r.text.includes("Peak share/revenue moves the answer most"));
  ok("price above every trial -> 'almost none'", api.readMonteCarlo(vals, 1, 10, 50, []).verdict.includes("almost none of the 10"));

  // Cash flow -5, -10, 4, 8, 6, 3: first positive in year 2; running totals
  // -5, -15, -11, -3, 3, 6 -> lowest -15 in year 1, back to >= 0 in year 4;
  // annual peak 8 in year 3.
  const cf = [-5, -10, 4, 8, 6, 3].map((v, i) => ({ v: v * 1e6, label: i }));
  r = api.readCashFlow(cf);
  ok("spends until year 2", r.verdict === "Spends cash until year 2.");
  ok("outlay $15.0M by year 1, earned back by year 4, best year $8.0M in year 3", r.text.includes("reaches $15.0M by year 1") && r.text.includes("earned back by year 4") && r.text.includes("$8.0M in year 3"));
  ok("all negative -> never turns positive", api.readCashFlow([{ v: -1, label: 0 }, { v: -2, label: 1 }]).verdict === "Never turns positive.");
  // -5, 2, 1: running -5, -3, -2 -> never back to zero.
  ok("never earned back inside the window", api.readCashFlow([-5, 2, 1].map((v, i) => ({ v: v * 1e6, label: i }))).text.includes("not earned back within the model"));

  // SOTP: A 60, B 20, C -10, G&A -15 ($M). Gross positive 80; A = 60/80 = 75%.
  r = api.readSotp([{ name: "A", npv: 60e6 }, { name: "B", npv: 20e6 }, { name: "C", npv: -10e6 }], -15e6);
  ok("A carries most of the value, 75%", r.verdict === "A carries most of the value." && r.text.includes("A is 75% of"));
  ok("C subtracts $10.0M; G&A $15.0M", r.text.includes("C subtracts $10.0M") && r.text.includes("Shared G&A costs $15.0M"));
  r = api.readSotp([{ name: "New Program", npv: 5e6 }, { name: "New Program", npv: -2e6 }], -1e6);
  ok("two programs with one name are numbered, not merged", r.verdict === "New Program (1) carries all of the value." && r.text.includes("New Program (2) subtracts $2.0M"));

  // Risk waterfall: unrisked 200, risked 50 -> keep 25%, risk takes 150.
  r = api.readRiskWaterfall(200e6, 50e6);
  ok("keeps 25%, odds take $150.0M", r.verdict === "You keep 25% of the success-case value." && r.text.includes("take $150.0M"));
  ok("unrisked <= 0 -> costs issue", api.readRiskWaterfall(-5e6, -20e6).verdict.startsWith("Even certain success"));
  ok("risked < 0 < unrisked", api.readRiskWaterfall(100e6, -10e6).verdict.includes("negative at today's odds"));
  ok("risked > unrisked (late costs) is called out, not '150% kept'", api.readRiskWaterfall(40e6, 60e6).verdict.startsWith("Certain success is worth less"));

  // Tornado: base 1, price 1.5. Share range 0.5..1.6 (reaches), PoS 0.7..1.3 (doesn't).
  r = api.readTornado([{ label: "PoS", low: 0.7, high: 1.3 }, { label: "Peak share", low: 0.5, high: 1.6 }], 1, 1.5);
  ok("widest bar first: Peak share (1.1 wide vs 0.6)", r.text.startsWith("Peak share matters most") && r.text.includes("from $0.50 to $1.60"));
  ok("only Peak share reaches $1.50", r.verdict === "Only Peak share reaches today's $1.50 on its own.");
  // Three of four reach 1.5 (widths 1.1, 0.95, 0.72; C at 0.2 tops out at 1.1): a comma list, plural verb.
  ok("three reach -> 'A, B and E each reach … on their own'", api.readTornado([{ label: "C", low: 0.9, high: 1.1 }, { label: "A", low: 0.5, high: 1.6 }, { label: "E", low: 0.8, high: 1.52 }, { label: "B", low: 0.6, high: 1.55 }], 1, 1.5).verdict === "Only A, B and E each reach today's $1.50 on their own.");
  ok("nothing reaches -> says so", api.readTornado([{ label: "PoS", low: 0.7, high: 1.3 }], 1, 10).verdict.startsWith("No single input"));
  // Price BELOW base: reaching means the low end gets down to it.
  ok("price below base: low end at or under it counts", api.readTornado([{ label: "PoS", low: 0.7, high: 1.3 }], 1, 0.8).verdict.startsWith("Any one"));

  // Price grid 2x2 [[1,2],[3,4]] at price 2.5 -> 3 and 4 reach: 2 of 4.
  // EDGAR full-text search hit, in the shape the live service returns (Stoke's
  // 2022-12-02 8-K press release): the type is `form`, the document `file_type`.
  {
    const hit = { _id: "0001193125-22-297163:d428421dex991.htm", _source: { form: "8-K", root_forms: ["8-K"], file_type: "EX-99.1", file_date: "2022-12-02", display_names: ["Stoke Therapeutics, Inc.  (STOK)  (CIK 0001623526)"] } };
    const r = api.parseCatalystHit(hit, "0001623526");
    ok("EDGAR hit: type read from `form`, with the attached document", r.formType === "8-K · EX-99.1");
    ok("EDGAR hit: filing URL built from the accession and file name", r.filingUrl === "https://www.sec.gov/Archives/edgar/data/1623526/000119312522297163/d428421dex991.htm");
    ok("EDGAR hit: the main document shows just its form", api.parseCatalystHit({ _id: "a:b.htm", _source: { form: "10-Q", file_type: "10-Q" } }, "1").formType === "10-Q");
  }
  // SEC entity name → sponsor name for ClinicalTrials.gov.
  ok("sponsor: 'Stoke Therapeutics, Inc.' → 'Stoke Therapeutics'", api.sponsorNameFromEntity("Stoke Therapeutics, Inc.") === "Stoke Therapeutics");
  ok("sponsor: 'Madrigal Pharmaceuticals, Inc.' → 'Madrigal Pharmaceuticals'", api.sponsorNameFromEntity("Madrigal Pharmaceuticals, Inc.") === "Madrigal Pharmaceuticals");
  ok("sponsor: 'argenx SE' → 'argenx'", api.sponsorNameFromEntity("argenx SE") === "argenx");
  ok("sponsor: a name with no suffix is unchanged", api.sponsorNameFromEntity("Vertex Pharmaceuticals") === "Vertex Pharmaceuticals");
  // Registered p-values keep the sponsor's operator; "=" only when none.
  ok("p: plain value", api.formatRegisteredP("0.0123") === "p = 0.0123");
  ok("p: '=0.061' (SKYLINE) is not doubled", api.formatRegisteredP("=0.061") === "p = 0.061");
  ok("p: '<0.001' keeps its operator", api.formatRegisteredP("<0.001") === "p < 0.001");
  ok("p: '< 0.0001' spacing normalised", api.formatRegisteredP("< 0.0001") === "p < 0.0001");
  ok("grid: 2 of 4 reach $2.50", api.readPriceGrid([[1, 2], [3, 4]], 2.5).verdict === "2 of the 4 combinations reach today's $2.50.");
  ok("grid: none reach, best corner $4.00", api.readPriceGrid([[1, 2], [3, 4]], 9).text.includes("$4.00"));

  // Interval, ratio 0.60..0.95: 40% lower to 5% lower, excludes 1.
  r = api.readInterval(0.60, 0.95, "ratio", "95");
  ok("0.60-0.95 excludes no effect; 40% lower to 5% lower", r.verdict === "The 95% interval excludes no effect." && r.text.includes("from 40% lower to 5% lower"));
  r = api.readInterval(0.80, 1.12, "ratio", "95");
  ok("0.80-1.12 includes no effect; 20% lower to 12% higher", r.verdict === "The 95% interval includes no effect." && r.text.includes("from 20% lower to 12% higher"));
  ok("difference -3.2..1.1 includes 0", api.readInterval(-3.2, 1.1, "linear", "95").text.includes("from -3.20 to +1.10"));

  ok("p 0.004 -> significant at 1%", api.readPValue(0.004).verdict.includes("stricter 1%"));
  ok("p 0.03 -> 5% but not 1%", api.readPValue(0.03).verdict === "Significant at the usual 5% level, but not at 1%.");
  ok("p 0.07 -> not significant, 'trend' caveat", api.readPValue(0.07).verdict === "Not significant at 5%.");

  // Wilson 9/20 at 95%: 0.2582..0.6579 -> 26% to 66%, 40 points wide.
  const w = api.wilsonScoreInterval(9, 20, 0.95);
  r = api.readSingleArm(20, w.lower, w.upper);
  ok("9/20: too few patients, 26% to 66%, 40-point range", r.verdict === "Too few patients to pin the rate down." && r.text.includes("from 26% to 66%, a 40-point range"));

  ok("assurance 70.3% -> about 7 in 10", api.readAssurance(70.3, "two").verdict === "About 7 in 10 simulated trials read out significant.");
  ok("two-sided caveat only when two-sided", api.readAssurance(70.3, "two").text.includes("wrong direction") && !api.readAssurance(70.3, "one").text.includes("wrong direction"));

  // Peak sales P10 200M, P50 500M, P90 1.2B -> 1.2B / 200M = 6.0x.
  r = api.readPeakSalesRange(200e6, 500e6, 1.2e9, "Peak market share");
  ok("peak sales: 6.0x spread, $200.0M to $1.20B", r.verdict === "The optimistic end is 6.0× the cautious end." && r.text.includes("between $200.0M and $1.20B"));

  // Binary: 45% implied -> 'roughly a 5 in 10' (45/10 = 4.5 rounds to 5).
  ok("binary 45% -> roughly 5 in 10", api.readBinaryImplied(45).verdict === "The price assumes roughly a 5 in 10 chance that it works.");

  // Premiums [20,30,40,50,60,70,80,90], 75%: 6 below (20..70) of 8 = 0.75 -> richer.
  // Median by linear interpolation: (50+60)/2 = 55.
  r = api.readPremium(75, [20, 30, 40, 50, 60, 70, 80, 90]);
  ok("75% premium above 6 of 8, median 55% -> richer than most", r.verdict === "Richer than most real deals." && r.text.includes("above 6 of the 8") && r.text.includes("median is 55%"));
  ok("45% premium: 3 of 8 below -> in line", api.readPremium(45, [20, 30, 40, 50, 60, 70, 80, 90]).verdict === "In line with real deals.");

  // Forward runway: balances 50, 10, -40, -20 -> lowest -40 in year 2.
  r = api.readForwardRunway(14.4, [50, 10, -40, -20].map((b, i) => ({ year: i, balanceEnd: b * 1e6 })));
  ok("runway 14.4 mo -> about 14 months; needs $40.0M at year 2", r.verdict === "Cash runs out in about 14 months." && r.text.includes("in year 2, it needs about $40.0M"));
  ok("never negative -> never runs out", api.readForwardRunway(null, [{ year: 0, balanceEnd: 5e6 }, { year: 1, balanceEnd: 3e6 }]).verdict === "The plan never runs out of cash.");
}
section("Year-by-year projection rows");
{
  // Two years at 10%. Year 0: $100 R&D + $20 G&A, no revenue -> FCF -120,
  // PV -120/1.1 = -109.0909. Year 1: launch (offset 1), $100 revenue if it
  // works at 50% odds -> $50 weighted; contribution $40, so COGS+S&M = 10;
  // G&A 20, tax 0 -> FCF 50 - 10 - 20 = 20, PV 20/1.21 = 16.5289.
  // Running total -109.0909 + 16.5289 = -92.5620. Discount factor 1/1.21 = 0.8264.
  const res = { discountRateUsed: 10,
    calendar: [{ revenue: 0, riskAdjProductContribution: 0, riskAdjRnDCost: 100, corporateGA: 20, riskAdjFCF: -120 },
               { revenue: 50, riskAdjProductContribution: 40, riskAdjRnDCost: 0, corporateGA: 20, tax: 0, riskAdjFCF: 20 }],
    npvResult: { pvByYear: [-120 / 1.1, 20 / 1.21] },
    programVals: [{ id: "x", launchYearOffset: 1, pnl: [{ year: 1, revenue: 100 }] }] };
  const rows = api.computeProjectionRows(res, null);
  ok("projection: two rows, one per discounted year", rows.length === 2);
  ok("projection: revenue if it works 0 then 100", rows[0].revenueIfWorks === 0 && rows[1].revenueIfWorks === 100);
  ok("projection: COGS + S&M = revenue - contribution = 10", Math.abs(rows[1].commercialCosts - 10) < 1e-9);
  ok("projection: discount factor 0.8264 in year 1", Math.abs(rows[1].discountFactor - 0.826446) < 1e-6);
  ok("projection: running total -92.5620", Math.abs(rows[1].runningPV - -92.56198) < 1e-4);
  ok("projection: no phase without a single matching program", rows[0].phase === null);

}
section("Histogram bins and label lanes");
{
  // [3, 4, 4, 7, 12] aiming for 5 bins: range 9 / 5 = 1.8 -> step 2. Start at
  // floor(3/2)*2 = 2; ceil((12-2)/2) = 5 bins: [2,4) 1 · [4,6) 2 · [6,8) 1 ·
  // [8,10) 0 · [10,12] 1 (the maximum falls in the last bin, not past it).
  const b = api.histogramBins([3, 4, 4, 7, 12], 5);
  ok("histogram: width 2 from 2", b.width === 2 && b.lo === 2);
  ok("histogram: counts 1,2,1,0,1", JSON.stringify(b.counts) === "[1,2,1,0,1]");
  ok("histogram: every value counted once", b.counts.reduce((a, c) => a + c, 0) === 5);
  // Labels 50 wide at 100, 120, 200, 10px apart, room 0-400. Left to right:
  // 100 stays (75-125); 120 must start at 135 -> centre 160 (135-185); 200
  // must start at 195 -> centre 220. Nothing pushes back from the right.
  ok("spread labels: 100, 160, 220", JSON.stringify(api.spreadLabels([{ x: 100, w: 50 }, { x: 120, w: 50 }, { x: 200, w: 50 }], 0, 400, 10)) === "[100,160,220]");
  // Against the right edge at 230: 200's label ends at 225 (fine), but at
  // 180 max the right pass pulls 200 to 155, 120 to 95, 100 to 35.
  ok("spread labels: pushed back from the right edge", JSON.stringify(api.spreadLabels([{ x: 100, w: 50 }, { x: 120, w: 50 }, { x: 200, w: 50 }], 0, 180, 10)) === "[35,95,155]");
}
section("Break-even and price-gap readings");
{
  // Case carries $1.31B, price needs $1.10B: 1.31 / 1.10 - 1 = 19.09% -> "19% more";
  // $1.10B sits between Bear $917M and Bull $1.704B -> inside the range.
  let r = api.readBreakEven(1.31e9, 1.10e9, 0.917e9, 1.704e9);
  ok("break-even: price needs $1.10B", r.verdict === "The price needs about $1.10B of peak revenue.");
  ok("break-even: 19% more, inside Bear-Bull", r.text.includes("This case carries $1.31B, 19% more") && r.text.includes("inside your Bear–Bull range of $917.0M to $1.70B"));
  // Needs $2.0B against Bull $1.704B -> above the best case; 1.31 / 2.0 - 1 = -0.345
  // -> 34.5, which Math.round takes up to 35 -> "35% less".
  r = api.readBreakEven(1.31e9, 2.0e9, 0.917e9, 1.704e9);
  ok("break-even: above Bull says so", r.text.includes("above your Bull case's $1.70B") && r.text.includes("35% less"));
  ok("break-even: price below the whole curve", api.readBreakEven(1e9, null, 0.5e9, 2e9, true, false).verdict === "The price is below every level on this curve.");
  // Fair $29.05 vs $24.80 -> $4.25 a share; odds 65 vs 54.7 -> 10.3 -> "A 10-point gap".
  r = api.readPriceGap(29.05, 24.80, 54.7, 65);
  ok("price gap: $4.25 a share below this case", r.verdict === "About $4.25 a share separates the price from this case.");
  ok("price gap: 10-point disagreement, more confident", r.text.includes("the 55% the price implies and this case's 65%") && r.text.includes("A 10-point gap") && r.text.includes("more confident"));
  // "an 8-point gap", not "a 8-point gap" (PepGen: 23% implied vs 15%).
  ok("price gap: an 8-point gap reads 'An 8-point'", api.readPriceGap(1.38, 2.34, 23, 15).text.includes("An 8-point gap"));
  ok("price gap: a 10-point gap reads 'A 10-point'", api.readPriceGap(1.38, 2.34, 25, 15).text.includes("A 10-point gap"));
  ok("aNum: 8, 11, 18, 80-89, 800, 11,000 take 'an'", [8, 11, 18, 80, 85, 89, 800, 8000, 11000, 18000].every(n => api.aNum(n) === "an"));
  ok("aNum: 1, 10, 12, 81 is an, 100, 110, 1100, 180 take 'a'", [1, 10, 12, 100, 110, 1100, 180, 7, 90].every(n => api.aNum(n) === "a") && api.aNum(81) === "an");
  ok("price gap: within 5 points is judgment", api.readPriceGap(25, 24.8, 62, 65).text.includes("matter of judgment"));
  ok("price gap: price above the case", api.readPriceGap(20, 24.8, null, null).verdict === "About $4.80 a share of the price is not in this case.");
}
section("Outcome range reading");
{
  // Floor $1.40, success $43.24, price $24.80: (24.80 - 1.40) / (43.24 - 1.40)
  // = 23.40 / 41.84 = 55.93% -> "56% of the way"; implied odds 54.7 -> "55%".
  const r = api.readOutcomeRange(1.40, 43.24, 24.80, 54.7);
  ok("range: binary bet verdict", r.verdict === "A binary bet: about $1.40 if the readout fails, $43.24 if it works.");
  ok("range: 56% of the way, model says 55%", r.text.includes("paying 56% of the way from failure to success") && r.text.includes("implies at 55%"));
  ok("range: price above success says so", api.readOutcomeRange(1, 10, 12, null).text.includes("above even the value if it works"));
  ok("range: nothing to say without a spread", api.readOutcomeRange(5, 5, 5, null) === null);
}
section("Trial comparison");
{
  // Time frames to weeks: "Week 28" -> 28; "up to 14 weeks" -> 14; "Day 99"
  // -> 99 / 7 = 14.1 -> 14; "6 months" -> 6 × 4.345 = 26.07 -> 26.
  ok("weeks from time frames", api.compareTrialsWeeks("Week 28") === 28 && api.compareTrialsWeeks("From Baseline up to 14 weeks") === 14 && api.compareTrialsWeeks("Baseline to EOT (Day 99)") === 14 && api.compareTrialsWeeks("6 months") === 26 && api.compareTrialsWeeks("end of study") === null);
  const st = (id, comp, tf, n) => ({ study: { nctId: id, title: id, sponsor: "S", phase: "PHASE3", status: "COMPLETED", interventions: [id + "-drug", "Placebo"], enrollment: n,
    allocation: "RANDOMIZED", interventionModel: "PARALLEL", masking: "QUADRUPLE", armTypes: ["EXPERIMENTAL", comp], primaryOutcomesFull: [{ measure: "Seizures", timeFrame: tf }], minimumAge: "2 Years", maximumAge: "18 Years" }, results: null });
  const c = api.compareTrials([st("A", "SHAM_COMPARATOR", "Week 28", 170), st("B", "PLACEBO_COMPARATOR", "up to 14 weeks", 262), st("C", "PLACEBO_COMPARATOR", "Day 99", 120)]);
  const row = k => c.rows.find(r => r.key === k);
  ok("compare: design and timing shaded, counts and ages not", row("design").differs && row("measuredAt").differs && !row("patients").differs && !row("ages").differs);
  ok("compare: placebo is not listed as a drug; ages read 2 to 18", c.cols[0].drugs.join() === "A-drug" && row("ages").values[0] === "2 to 18");
  ok("compare: a plain 'Week 28' is not repeated; others get their week", row("measuredAt").values[0] === "Week 28" && row("measuredAt").values[1].startsWith("≈ week 14 — "));
  const rd = api.readTrialComparison(c);
  ok("compare: reading names the sham control and the weeks", rd.verdict === "A-drug's trial differs on design and timing." && rd.text.includes("sham-controlled (the others: placebo-controlled)") && rd.text.includes("week 28 against week 14 for both the others"));
  const same = api.compareTrials([st("A", "PLACEBO_COMPARATOR", "Week 14", 1), st("B", "PLACEBO_COMPARATOR", "Week 15", 2)]);
  ok("compare: a week apart is not a difference", !same.designDiff && !same.timeDiff);
}
section("Stoke, the whole case recomputed from its inputs (Bear, Base, Bull)");
{
  // test/fixtures/stoke_sample_case.json is sampleCaseStoke()'s inputs
  // (backup_test holds the two equal). It exercises what PepGen does not: an
  // ex-US royalty replacing ex-US sales, COGS and marketing charged on US
  // sales only, 30% of R&D paid by the partner, R&D squeezed into a one-year
  // launch window, a PRV and a milestone paid in the launch year, in-the-money
  // options by the treasury method, and a raise at a price override.
  //   Treated     15,700 x 75% x 60% x 80% = 5,652; x 60% share x 85% = 2,882.5 at peak
  //   US          $375,000 WAC x 80% = $300,000, +3% a year; 5-year median ramp
  //   Ex-US       140% of US patients x $187,500 (50% of the entered price), flat,
  //               1.5 years behind the US curve, replaced by a 15% royalty on it
  //   LOE         year 12: 45% of volume x 65% of price
  //   Costs       COGS 10% and marketing 3% of peak US sales — on US sales only;
  //               50 specialty reps x $280,000 (+2%/yr), 30% in the year before launch
  //   R&D         $200M split by benchmark, x 70% (Biogen pays 30%), x odds of
  //               reaching each stage, all in year 0 (a 1.4-year timeline in a
  //               1-year window)
  //   G&A $95M before revenue, on revenue-if-launched after, each weighted by
  //       the odds the company is in that state (developing / launched);
  //       tax 21% of the success case's profit after a $301.7M NOL, x P(launch);
  //       discount 12% in every scenario (Bear and Bull vary share and odds)
  //   Owed        to Southampton: 2% of US sales, 5% of the Biogen royalty and of
  //               the milestone
  //   Equity      NPV + $420M cash as filed (rolling forward is off) + PRV $190M x P(launch) / 1.12 + milestone
  //               $100M x 95% x P(launch) / 1.12 + $194M raise
  //   Shares      68,229,972 + 11,532,638 x (1 - 13.84 / 24.80) + 2,157,698
  //               + 194M / ($24.80 x 0.97, the ATM priced 3% below today) = 83,548,148
  // The scenario runs caught a real defect: Bear/Bull left the royalty part of
  // revenue and the peak commercial revenue at Base size (marketing charged
  // at Base level), so Bear read $14.25 against this rebuild's $14.44.
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const p = c.programs[0];
  const rnd = api.computeRnDToLaunch(p);
  const ramp = api.LAUNCH_CURVE_EXACT[5].median.map(x => x / 100);
  const expectPS = { bear: 16.8554, base: 28.0085, bull: 40.7094 };
  for (const [key, share, posMult, addPct] of [["bear", 70, 75, 0], ["base", 100, 100, 0], ["bull", 130, 120, 0]]) {
    const r = (12 + addPct) / 100, N = 25, L = 1;
    const eff = api.computeEffectivePoS(p, { posMultiplierPct: posMult });
    const reach = {}; eff.posStages.forEach(st => { reach[st.key] = st.posToReachStage; });
    const pos = eff.posToLaunch;
    const peakPts = 15700 * 0.75 * 0.60 * 0.80 * 0.60 * (share / 100) * 0.85;
    const us = [], roy = [];
    for (let y = 1; y <= N; y++) {
      const R = k => k < 1 ? 0 : k <= 5 ? ramp[k - 1] : 1;
      const pts = peakPts * R(y), em = y <= 12 ? 1 : 0.45 * 0.65;
      // Ex-US launches 1.5 years after the US: each year sits halfway
      // between the US curve's year y-2 and year y-1 (year 2 = half of year 1).
      const exPts = peakPts * (R(y - 2) + R(y - 1)) / 2;
      us.push(pts * 300000 * Math.pow(1.03, y - 1) * em);
      roy.push(exPts * 1.40 * 187500 * em * 0.15);
    }
    const peakUS = Math.max(...us);
    // Owed to Southampton: 2% of Stoke's own (US) sales and 5% of the Biogen
    // royalty it receives.
    const contrib = us.map((u, i) => u + roy[i] - 0.10 * u - 0.02 * u - 0.05 * roy[i] - (i < 12 ? 50 * 280000 * Math.pow(1.02, i) + 0.03 * peakUS : 0));
    const bCost = rnd.items.reduce((a, i) => a + i.costM, 0);
    const rd0 = rnd.items.reduce((a, i) => a + i.costM * (200 / bCost) * 0.70 * 1e6 * reach[i.key], 0) + 50 * 280000 * 0.30 * pos;
    const ga = v => v <= 0 ? 95e6 : v >= 400e6 ? v * 0.17 : 95e6 + (400e6 * 0.17 - 95e6) * v / 400e6;
    // Overhead only while the company is still going. The stages (benchmark
    // 3.1 + 1.25 years) are squeezed into the one-year window, so Phase 3's
    // gate closes at 3.1 / 4.35 of a year and the FDA's at 1.0; after a
    // failure the company winds down for one more year. Stopped share of year
    // t = each gate's failure odds x the part of [t, t+1) past gate + 1 year.
    const bYrs = rnd.items.reduce((a, i) => a + i.years, 0);
    let cumB = 0;
    const gates = rnd.items.map((it, j) => {
      cumB += it.years;
      return { cut: cumB / bYrs * 1 + 1, fail: reach[it.key] - (j + 1 < rnd.items.length ? reach[rnd.items[j + 1].key] : pos) };
    });
    const active = t => 1 - gates.reduce((a, g) => a + g.fail * Math.min(1, Math.max(0, t + 1 - g.cut)), 0);
    // Tax: the success case's (all R&D, full sales), after its own losses, x P(launch).
    const rdFull = rnd.items.reduce((a, i) => a + i.costM * (200 / bCost) * 0.70 * 1e6, 0) + 50 * 280000 * 0.30;
    let nol = 301.7e6, npv = 0;
    for (let t = 0; t < N; t++) {
      const i = t - L, launched = i >= 0 ? pos : 0;
      const gaT = 95e6 * (active(t) - launched) + (i >= 0 ? launched * ga(us[i] + roy[i]) : 0);
      const pre = (i >= 0 ? contrib[i] * pos : 0) - (t === 0 ? rd0 : 0) - gaT;
      const ifWorks = (i >= 0 ? contrib[i] - ga(us[i] + roy[i]) : -95e6) - (t === 0 ? rdFull : 0);
      let taxIfWorks = 0;
      if (ifWorks < 0) nol -= ifWorks; else { const use = Math.min(nol, ifWorks); nol -= use; taxIfWorks = 0.21 * (ifWorks - use); }
      npv += (pre - pos * taxIfWorks) / Math.pow(1 + r, t + 1);
    }
    const shares = 64526242 + 3703730 + 11532638 * (1 - 13.84 / 24.80) + 2157698 + 194e6 / (24.80 * 0.97);
    const cash = 420e6; // as the filing reported it (rolling forward is off)
    // The $100M Biogen approval milestone less the 5% owed on to Southampton.
    const perShare = (npv + cash + (190e6 + 100e6 * 0.95) * pos / Math.pow(1 + r, L) + 194e6) / shares;
    const app = api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, key), key, 12, c.terminalValue);
    near("Stoke " + key + ": NPV equals the independent rebuild", app.npvResult.npv, npv, 25);
    near("Stoke " + key + ": 83,548,868 diluted shares", app.equity.dilutedShares, shares, 0.5);
    near("Stoke " + key + ": fair value per share equals the rebuild", app.equity.perShare, perShare, 1e-6);
    near("Stoke " + key + ": and is $" + expectPS[key], perShare, expectPS[key], 5e-5);
  }
}
report();

section("Dilution path: raises bring their cash, counted with the odds they happen");
{
  // PepGen, path on. Before: shares were added without the cash they raise,
  // so the costs those raises fund were charged twice (Base $1.38 -> $0.57).
  // Now each year's raise R_y is weighted by the odds the company is still
  // going that year (a_y), and its cash comes in with its shares:
  //   per share = (E + sum R_y a_y) / (S + sum R_y a_y / p)
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const base = api.getEffectiveScenarioPreset(pg, "base");
  const off = api.computeCaseValuation(pg, base, "base", 14, pg.terminalValue);
  const on = JSON.parse(JSON.stringify(pg)); on.dilutionPath.enabled = true;
  const dp = api.computeDilutionPath(on, base, 14, { fairPrice: off.equity.perShare });
  const vals = on.programs.map(p => api.computeProgramValuation(p, base, null));
  const a = api.computeCompanyActiveByYear(vals, on.corporateGA.windDownYears, 25);
  const cash = dp.path.filter(r => r.year <= dp.horizonYear).reduce((s, r) => s + r.raiseAmount * a[r.year].active, 0);
  near("expected cash = each raise x the odds the company is still going", dp.expectedCashRaised, cash, 1);
  near("PepGen gates: still going in year 3 is 1 - 0.632 = 0.368", a[3].active, api.computeEffectivePoS(pg.programs[0], base).posStages[0].pos, 1e-9);
  const r = api.computeCaseValuation(on, base, "base", 14, pg.terminalValue);
  const p = 2.34 * 0.85;
  near("market price: per share = (E + cash) / (S + cash / p)", r.equity.perShare, (off.equity.equityValue + cash) / (off.equity.dilutedShares + cash / p), 1e-6);
  ok("market price: the raises add value when investors pay more than the model's value ($1.99 > $1.69)", r.equity.perShare > off.equity.perShare);
  const fair = JSON.parse(JSON.stringify(on)); fair.dilutionPath.priceBasis = "fair";
  near("fair-value price: value per share is unchanged (value-neutral)", api.computeCaseValuation(fair, base, "base", 14, pg.terminalValue).equity.perShare, off.equity.perShare, 1e-9);
  // Stoke needs no raise: switching the path on changes nothing.
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const stOn = JSON.parse(JSON.stringify(st)); stOn.dilutionPath.enabled = true;
  const sb = api.getEffectiveScenarioPreset(stOn, "base");
  near("Stoke (no raise needed): unchanged with the path on", api.computeCaseValuation(stOn, sb, "base", 12, st.terminalValue).equity.perShare, api.computeCaseValuation(st, sb, "base", 12, st.terminalValue).equity.perShare, 1e-9);
}
report();

section("Cash is carried forward from the filing to the valuation date");
{
  // PepGen: $117,238,000 at June 30, 2026, burning $5.7M a month, valued at
  // Sept 30, 2026. 92 days = 92 / (365.25 / 12) = 3.0226 months, so
  // 5,700,000 x 3.0226 = $17,228,747 spent and $100,009,253 left. Before
  // this, the filed cash was counted in full while the valuation also charged
  // those months' costs from today — paid twice.
  // The fixture carries these dates; "pg" is the same case with them blank.
  // Rolling forward is the user's choice (off by default): the fixture is
  // dated and carries its burn, with the switch off; "c" turns it on.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const c = JSON.parse(JSON.stringify(pg)); c.capitalStructure.carryCashForward = true;
  ok("the fixture is dated: cash June 30, $5.7M a month, valued Sept 30, rolling forward off", pg.capitalStructure.cashAsOf === "2026-06-30" && pg.capitalStructure.monthlyBurn === "5700000" && pg.valuationDate === "2026-09-30" && pg.capitalStructure.carryCashForward === false);
  ok("switched off, the valuation uses the cash as filed", api.effectiveCapitalStructure(pg) === pg.capitalStructure);
  const eff = api.effectiveCapitalStructure(c);
  near("months since the filing: 92 days = 3.0226 months", eff._monthsSinceFiling, 92 / (365.25 / 12), 1e-9);
  near("spent since the filing: $5.7M x 3.0226 = $17,228,747", eff._spentSinceFiling, 5700000 * 92 / (365.25 / 12), 1);
  near("cash carried forward: $117,238,000 - $17,228,747", Number(eff.cash), 117238000 - 5700000 * 92 / (365.25 / 12), 1);
  const base = api.getEffectiveScenarioPreset(pg, "base");
  const before = api.computeCaseValuation(pg, base, "base", 14, pg.terminalValue);
  const after = api.computeCaseValuation(c, base, "base", 14, c.terminalValue);
  near("value per share falls by exactly the spend over the shares", before.equity.perShare - after.equity.perShare, 5700000 * 92 / (365.25 / 12) / before.equity.dilutedShares, 1e-9);
  const steps = api.computeEquityBridgeSteps(c, after);
  ok("the bridge shows the filing's cash and the spend since as their own steps", steps.some(st => st.key === "cash" && st.value === 117238000) && steps.some(st => st.key === "burnSince" && st.sign === -1));
  const blank = JSON.parse(JSON.stringify(c)); blank.capitalStructure.monthlyBurn = "";
  ok("switched on but no burn: no adjustment", api.effectiveCapitalStructure(blank) === blank.capitalStructure);
  const early = JSON.parse(JSON.stringify(c)); early.valuationDate = "2026-06-01";
  ok("a valuation date before the filing spends nothing", Number(api.effectiveCapitalStructure(early).cash) === 117238000);
}
report();

section("Overhead is charged only while the company is still going");
{
  // With certain odds (the unrisked runway, the dilution path's cash walk)
  // nothing changes: G&A is exactly computeCorporateGA of the revenue.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const base = api.getEffectiveScenarioPreset(pg, "base");
  const sure = pg.programs.map(p => api.computeProgramValuation({ ...p, posOverridePct: "100" }, base, null));
  const calSure = api.computeCompanyRiskAdjustedCF(sure, pg.corporateGA, 25);
  const old = api.computeCorporateGA(calSure.map(c => c.revenue), pg.corporateGA.preCommercialAnnualM, pg.corporateGA.gaShareOfMatureSgaPct);
  ok("certain odds: every year's G&A equals the old formula", calSure.every((c, i) => Math.abs(c.corporateGA - old[i]) < 1e-6));
  // Risked (15% to launch, launch in year 5): year 2 is $26M x 0.825 still
  // going; from year 7 the failed worlds have wound down, leaving 15% x G&A on
  // the revenue the launched drug has.
  const risked = pg.programs.map(p => api.computeProgramValuation(p, base, null));
  const cal = api.computeCompanyRiskAdjustedCF(risked, pg.corporateGA, 25);
  near("year 2: $26M x the 82.5% still going", cal[2].corporateGA, 26e6 * cal[2].activeOdds, 1);
  const ifLaunched = api.computeCorporateGA([cal[8].revenue / 0.15], pg.corporateGA.preCommercialAnnualM, pg.corporateGA.gaShareOfMatureSgaPct)[0];
  near("year 8: 15% x G&A on the revenue if launched", cal[8].corporateGA, 0.15 * ifLaunched, 1);
  ok("the old way charged $26M+ every year; now year 8 is under $26M", cal[8].corporateGA < 26e6);
}
report();

section("Tax is owed where the drug works: P(launch) x the tax if it works");
{
  // PepGen Base, tax on (21%, $177.3M of losses carried in). The success case
  // is the program at certain odds; its tax each year (after its own losses)
  // times 15% is the expected tax. Checked year by year against a loop here.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const base = api.getEffectiveScenarioPreset(pg, "base");
  const r = api.computeCaseValuation(pg, base, "base", 14, pg.terminalValue);
  const sure = api.computeProgramValuation({ ...pg.programs[0], posOverridePct: "100" }, base, "base");
  const works = api.computeCompanyRiskAdjustedCF([sure], pg.corporateGA, 25);
  let nol = 177.3e6; const expTax = works.map(c => {
    const f = c.riskAdjFCF; if (f < 0) { nol -= f; return 0; }
    const use = Math.min(nol, f); nol -= use; return 0.21 * (f - use) * 0.15;
  });
  ok("every year's tax = 15% x the success case's tax", r.calendar.every((c, i) => Math.abs((c.tax || 0) - expTax[i]) < 1));
  ok("and the success case does pay tax in some year", expTax.some(t => t > 0));
  const off = JSON.parse(JSON.stringify(pg)); off.taxation.enabled = false;
  ok("tax off: no tax anywhere", api.computeCaseValuation(off, base, "base", 14, off.terminalValue).calendar.every(c => !c.tax));
  // Two programs: no single success world, so the odds-weighted flow is taxed
  // (the old method, kept and stated).
  const two = JSON.parse(JSON.stringify(pg)); two.programs.push({ ...JSON.parse(JSON.stringify(pg.programs[0])), id: "p2" });
  const vals = two.programs.map(p => api.computeProgramValuation(p, base, "base"));
  const expected = api.applyTaxToCalendar(api.computeCompanyRiskAdjustedCF(vals, two.corporateGA, 25), two.taxation);
  const got = api.computeCaseValuation(two, base, "base", 14, two.terminalValue).calendar;
  ok("two programs: the odds-weighted flow is taxed", got.every((c, i) => Math.abs(c.riskAdjFCF - expected[i].riskAdjFCF) < 1e-6));
}
report();

section("Rough failure floor from the monthly burn (opt-in)");
{
  // PepGen, switched on. Cash $117,238,000 at June 30, 2026; the Calibration
  // Log's next catalyst is "2026-11", read as Nov 30: 153 days = 5.0267
  // months x $5.7M = $28,652,156 burned to the readout; less one year of
  // wind-down G&A ($26M): equity $62,585,844. Options strike $4.89 are out of
  // the money at well under $1, so shares = 69,259,517 + 1,101,110 RSUs =
  // 70,360,627 -> $0.8895 a share.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  pg.programs[0].calibrationLog = [{ catalystLabel: "FREEDOM2 10 mg/kg data", catalystDate: "2026-11", outcome: "pending" }];
  const off = api.computeFailureFloor(pg);
  ok("off by default: the stage method", off.method === "stage" && !off.burnMissing);
  const on = JSON.parse(JSON.stringify(pg)); on.failureFloor = { method: "burn" };
  const f = api.computeFailureFloor(on);
  const months = 153 / (365.25 / 12);
  near("months from the cash date to the logged readout: 153 days", f.monthsToReadout, months, 1e-9);
  near("burn to the readout: $5.7M x 5.0267", f.burnToReadout, 5.7e6 * months, 1);
  near("equity: $117.238M - burn - $26M wind-down", f.equity, 117.238e6 - 5.7e6 * months - 26e6, 1);
  near("per share over 70,360,627 shares", f.perShare, (117.238e6 - 5.7e6 * months - 26e6) / 70360627, 1e-9);
  ok("says where the readout date came from, to the end of that month", /Calibration Log \(2026-11, to the end of that window\)/.test(f.readoutSource));
  // No dated catalyst: the model's own timeline (Phase 2 ends 1.72 years
  // after the valuation date of Sept 30, 2026, so 3 months + 1.72 years of burn).
  const noLog = JSON.parse(JSON.stringify(on)); noLog.programs[0].calibrationLog = [];
  const g = api.computeFailureFloor(noLog);
  near("no logged date: valuation date + the model's stage years", g.monthsToReadout, 92 / (365.25 / 12) + g.readoutYears * 12, 1e-6);
  ok("and says so", g.readoutSource === "the model's timeline");
  // Switched on without a burn: falls back to the stage method and says so.
  const noBurn = JSON.parse(JSON.stringify(on)); noBurn.capitalStructure.monthlyBurn = "";
  const h = api.computeFailureFloor(noBurn);
  ok("no burn: stage method, flagged", h.method === "stage" && h.burnMissing === true);
  // Never moves the valuation.
  const base = api.getEffectiveScenarioPreset(pg, "base");
  ok("Bear/Base/Bull are untouched by it", api.computeCaseValuation(on, base, "base", 14, on.terminalValue).equity.perShare === api.computeCaseValuation(pg, base, "base", 14, pg.terminalValue).equity.perShare);
}
report();

section("Raise priced as a discount to today, the Napkin-vs-build flag, the model snapshot");
{
  // A raise priced 15% below today's price follows the price: at $2.34 it is
  // $1.989, at $2.21 $1.8785. A fixed $1.99 stays $1.99; a case saved before
  // the choice existed (no priceMode) reads its typed price as before.
  near("discount mode: 15% below $2.34", api.futureRaisePrice({ priceMode: "discount", discountPct: "15" }, "2.34"), 1.989, 1e-12);
  near("discount mode follows the price: 15% below $2.21", api.futureRaisePrice({ priceMode: "discount", discountPct: "15", priceOverride: "1.99" }, "2.21"), 1.8785, 1e-12);
  ok("fixed mode keeps the typed price", api.futureRaisePrice({ priceMode: "fixed", priceOverride: "1.99" }, "2.21") === 1.99);
  ok("a case saved before the choice reads its typed price", api.futureRaisePrice({ priceOverride: "24.06" }, "26.01") === 24.06);
  ok("nothing typed: today's price", api.futureRaisePrice({}, "26.01") === 26.01);
  // Napkin vs build: the build's own peak (US + royalty) against the typed one.
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  ok("the sample's Napkin peak is the build's own: no flag", api.napkinBuildPeakMismatch(st.programs[0]) === null);
  const big = JSON.parse(JSON.stringify(st.programs[0])); big.quickRevenue.peakRevenue = "2500000000";
  const mm = api.napkinBuildPeakMismatch(big);
  ok("a $2.5B Napkin peak against the build's: flagged, 1.9x", !!mm && Math.abs(mm.ratio - 2.5e9 / mm.full) < 1e-12 && mm.ratio > 1.8 && mm.ratio < 2.0 && mm.mode === "full");
  const close = JSON.parse(JSON.stringify(big)); close.quickRevenue.peakRevenue = String(Math.round(mm.full * 1.4));
  ok("1.4x apart: not flagged (the line is 1.5x)", api.napkinBuildPeakMismatch(close) === null);
  // Exactly 1.5x does not fire ("more than half"); a hair over does; and the
  // other direction (the build 1.5x the typed peak) mirrors it.
  const at = r => { const x = JSON.parse(JSON.stringify(big)); x.quickRevenue.peakRevenue = String(mm.full * r); return api.napkinBuildPeakMismatch(x); };
  ok("exactly 1.5x: not flagged", at(1.5) === null);
  ok("1.51x: flagged", !!at(1.51));
  ok("the build 1.5x the typed peak: not flagged; 1.51x: flagged", at(1 / 1.5) === null && !!at(1 / 1.51));
  // Raise discount edges: negative clamps to 0 (today's price); over 100
  // clamps to 100, a price of 0, which applyFutureRaise skips (no raise).
  ok("discount -5%: today's price", api.futureRaisePrice({ priceMode: "discount", discountPct: "-5" }, "10") === 10);
  ok("discount 150%: a price of 0", api.futureRaisePrice({ priceMode: "discount", discountPct: "150" }, "10") === 0);
  const cap0 = { dilutedShares: 1e6, netCash: 0 };
  ok("a price of 0 adds no raise at all", api.applyFutureRaise(cap0, { enabled: true, amountM: "1000000", priceMode: "discount", discountPct: "150" }, "10") === cap0);
  ok("the flag appears in the red flags", api.computeRedFlags({ ...st, programs: [big] }).some(f => /Napkin peak \(\$2\.50B\) is 1\.9x the full build's/.test(f.message)));
  // The snapshot quotes the engine's own numbers.
  const snap = api.buildModelSnapshot(st, "2026-09-28");
  const v = k => api.computeCaseValuation(st, api.getEffectiveScenarioPreset(st, k), k, 12, st.terminalValue).equity.perShare.toFixed(2);
  ok("snapshot: dated, labelled, and quotes Bear/Base/Bull as the engine computes them", snap.date === "2026-09-28" && snap.label === "What the model says (snapshot, 2026-09-28)" &&
    snap.thesis.includes("Base fair value ~$" + v("base")) && snap.thesis.includes("Bear ~$" + v("bear")) && snap.thesis.includes("Bull ~$" + v("bull")));
  ok("snapshot: the price-implied odds against the case's 65%", /The price implies ~56% odds of launch against this case's 65%/.test(snap.thesis));
  ok("snapshot: the failure floor by the case's method", /if the next readout fails, ~\$1\.30 is left \(the filing's cash/.test(snap.thesis));
  // ... and what it rested on (the fixture has the price date and cash date,
  // no pinned catalyst: its Calibration Log is not in the fixture).
  ok("snapshot: an inputs line with the price and cash dates (" + (snap.thesis.match(/Inputs: [^.]*\./) || [""])[0] + ")", /Inputs: price entered 2026-09-25, cash as of 2026-06-30/.test(snap.thesis));
  const stPinned = { ...st, programs: [{ ...st.programs[0], calibrationLog: [{ catalystLabel: "EMPEROR", catalystDate: "2099-Q3", outcome: "pending", pin: { type: "topline", source: "guidance", at: "2026-09-28" } }] }] };
  ok("snapshot: names the pinned catalyst and its source", /next catalyst 2099-Q3 \(pinned: guidance\)/.test(api.buildModelSnapshot(stPinned, "2026-09-28").thesis));
}
report();

section("Red flags marked considered");
{
  // Stoke's R&D timeline (1.4 years against a 4.3-year benchmark) flags every
  // time. Marked considered, it moves to the considered list; change the input
  // and its message changes, so it is open again; marks that match no current
  // flag are dropped when the list is next written.
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const flags = api.computeRedFlags(st);
  const rd = flags.find(f => /R&D-to-launch override/.test(f.message));
  ok("the sample has the R&D timeline flag", !!rd);
  const marked = { ...st, consideredFlags: api.markFlagConsidered(st, flags, api.redFlagKey(rd), true, "2026-10-02") };
  const split = api.splitConsideredFlags(marked, flags);
  ok("marked: it leaves the open list and joins the considered one, dated", !split.open.some(f => f.key === api.redFlagKey(rd)) && split.considered.length === 1 && split.considered[0].consideredAt === "2026-10-02");
  const changed = JSON.parse(JSON.stringify(marked)); changed.programs[0].rndOverride.totalYears = "1.2";
  const flags2 = api.computeRedFlags(changed);
  ok("the input changes: the flag is open again", api.splitConsideredFlags(changed, flags2).open.some(f => /R&D-to-launch override of 1\.2 years/.test(f.message)) && api.splitConsideredFlags(changed, flags2).considered.length === 0);
  ok("the stale mark is dropped when the list is next written", api.markFlagConsidered(changed, flags2, "x|y", false, "2026-10-02").length === 0);
  ok("unmarking reopens it", api.splitConsideredFlags({ ...st, consideredFlags: api.markFlagConsidered(marked, flags, api.redFlagKey(rd), false, "2026-10-02") }, flags).considered.length === 0);
}
report();

section("Ex-US launches after the US");
{
  // 1,000 US patients at peak on a 6-year median curve (11/31/58/76/89/100%),
  // $10,000 US price flat, ex-US at 50% price and 100% of US patients:
  // ex-US revenue at peak is 1,000 x 5,000 = $5,000,000.
  //   lag 0:   ex-US year y = $5M x curve(y)            -> year 1 = $550,000
  //   lag 1:   ex-US year y = $5M x curve(y - 1)        -> year 1 = 0, year 2 = $550,000
  //   lag 1.5: ex-US year y = $5M x (curve(y-2) + curve(y-1)) / 2
  //            year 2 = 5M x 0.11 / 2 = $275,000; year 3 = 5M x 0.42 / 2 = $1,050,000
  const rb = lag => ({
    population: { mode: "prevalence", prevalence: "1000", diagnosisRatePct: "100", treatmentRatePct: "100", eligiblePct: "100" },
    adherencePct: "100", marketShare: { numDrugs: 1, orderOfEntry: 1, peakShareOverridePct: "100" },
    launchCurve: { yearsToPeak: 6, profile: "median" },
    pricing: { usAnnualPrice: "10000", usAnnualGrowthPct: "0", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100", exUSLaunchLagYears: lag },
    exclusivity: { yearsToLOE: "8", modality: "smallMolecule", volumeRetainedPct: "40", priceDeclinePct: "50" }
  });
  const ex = lag => api.computeProgramRevenue(rb(lag), 12).years.map(y => y.exUSRevenue);
  const us = lag => api.computeProgramRevenue(rb(lag), 12).years.map(y => y.usRevenue);
  near("lag 0: year 1 ex-US = $5M x 11%", ex("0")[0], 550000, 1);
  ok("lag 1: nothing ex-US in year 1, year 2 = the same-day year 1", ex("1")[0] === 0 && ex("1")[1] === ex("0")[0]);
  near("lag 1.5: year 2 = half of curve year 1 = $275,000", ex("1.5")[1], 275000, 1);
  near("lag 1.5: year 3 = the average of curve years 1 and 2 = $1,050,000", ex("1.5")[2], 1050000, 1);
  ok("the US side is untouched by the lag", us("2").every((v, i) => v === us("0")[i]));
  // LOE stays on the US calendar: at year 9 (after an 8-year LOE) both lags
  // are at 40% volume x 50% price of a full ex-US year = $1,000,000.
  near("after LOE ex-US erodes on the US calendar, lag or not", ex("1.5")[8], 5e6 * 0.4 * 0.5, 1);
  ok("blank = the 1.5-year benchmark", ex("").every((v, i) => v === ex("1.5")[i]) && api.EXUS_LAUNCH_LAG_BENCHMARK.years === 1.5);
  const legacy = rb(""); delete legacy.pricing.exUSLaunchLagYears;
  ok("a case saved before the field existed reads the benchmark", api.getRevenueBuild({ revenueBuild: legacy }).pricing.exUSLaunchLagYears === "1.5");
}
report();

section("After a positive readout, its gate is passed");
{
  // "Value if the Phase 2 readout is a clear win" must treat Phase 2 as
  // passed: Phase 3 then starts for certain and is paid in full. It used to
  // keep Phase 2 pending and just raise the overall odds, so PepGen's $230M
  // Phase 3 was weighted at ~60% inside the clear-win value ($7.21, now $6.74).
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8")).programs[0];
  const e = api.computeEffectivePoS({ ...pg, posOverridePct: "64", _passedStages: 1 }, { posMultiplierPct: 100 });
  ok("the readout stage passes for certain", e.posStages[0].pos === 1);
  near("Phase 3 is reached for certain", e.posStages[1].posToReachStage, 1, 1e-12);
  near("the later stages carry the 64%", e.posStages[1].pos * e.posStages[2].pos, 0.64, 1e-12);
  const pv = api.computeProgramValuation({ ...pg, posOverridePct: "64", _passedStages: 1 }, { label: "b", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" }, null);
  near("so Phase 3's R&D is weighted at 1", pv.riskAdjItems.find(i => i.key === "phase3").posToReachStage, 1, 1e-12);
  // No marker, no change: the Base stages are untouched.
  const base = api.computeEffectivePoS(pg, { posMultiplierPct: 100 });
  near("without the marker PepGen's Phase 2 gate is still 36.79%", base.posStages[0].pos, 0.3679, 5e-5);
}
report();

section("Portfolio runway: unknown, runs out, or never runs out");
{
  // Three different states that used to collapse into two (a blank cash
  // field read as 0.0 years in red; a case turning cash-positive as "—").
  const stoke = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "stoke_sample_case.json"), "utf8"));
  const pepgen = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const noCash = JSON.parse(JSON.stringify(pepgen)); noCash.capitalStructure.cash = "";
  const [st, pg, nc] = api.computePortfolioSummary([stoke, pepgen, noCash]);
  ok("Stoke: cash never runs out in the projection", st.runwayOutlasts === true && st.runwayYears == null);
  // 1.664 years from the June 30 filing (1.72-year Phase 2 at $43.5M a year
  // plus $26M G&A, then Phase 3), less the 92 days to the case's valuation
  // date (3.0226 months = 0.2519 years): 1.412 years from today.
  ok("PepGen: runs out ~1.4 years from today (1.664 from the June 30 filing, less the 92 days since)", pg.runwayOutlasts === false && Math.abs(pg.runwayYears - (1.664 - 92 / 30.4375 / 12)) < 0.01);
  ok("no cash entered: unknown, not zero", nc.runwayYears == null && nc.runwayOutlasts === false);
}
report();

section("Condition searches drop hits CT.gov matched only through a synonym");
{
  // Shapes as the v2 API returns them (fields trimmed). CT.gov expands
  // "Myotonic dystrophy type 1" through "DM1" to T-DM1 (trastuzumab
  // emtansine): live, 18 of 23 Phase 2 trials with results were cancer trials.
  const rec = (id, title, conds, kw, mesh) => ({ protocolSection: { identificationModule: { nctId: id, briefTitle: title },
    conditionsModule: { conditions: conds, keywords: kw || [] } }, derivedSection: mesh ? { conditionBrowseModule: { meshes: mesh.map(t => ({ term: t })) } } : undefined });
  const hits = [
    rec("NCT06667453", "A Clinical Study of PGN-EDODM1 in People With Myotonic Dystrophy Type 1", ["Myotonic Dystrophy 1"]),
    rec("NCT00829166", "A Study of Trastuzumab Emtansine Versus Capecitabine + Lapatinib", ["Breast Cancer"], [], ["Breast Neoplasms"]),
    rec("NCT01853748", "T-DM1 vs Paclitaxel/Trastuzumab for Breast (ATEMPT Trial)", ["Breast Cancer"]),
    rec("NCT05027269", "Study of AOC 1001 in Adult DM1 Patients", ["DM1"], ["Steinert disease"], ["Myotonic Dystrophy"]),
    rec("NCT00674843", "The Efficacy of Using Far Infrared Radiation to Manage Muscular Dystrophies", ["Muscular Dystrophies"]),
  ];
  ok("query words: generic words and '1' are not evidence", JSON.stringify(api.conditionQueryWords("Myotonic dystrophy type 1 — adults")) === '["myotonic","dystrophy"]');
  const r = api.filterStudiesByCondition(hits, "Myotonic dystrophy type 1");
  ok("DM1: both T-DM1 cancer trials and the general muscular-dystrophy study dropped, both DM1 trials kept (one only through its MeSH term)",
    r.checked && r.dropped === 3 && r.kept.map(k => k.protocolSection.identificationModule.nctId).join() === "NCT06667453,NCT05027269");
  const one = api.filterStudiesByCondition(hits, "NSCLC");
  ok("a one-word query (an abbreviation CT.gov expands on purpose) is left alone", !one.checked && one.dropped === 0 && one.kept.length === 5);
  // Half the words, on stems: a trial registering only the MeSH form
  // "Carcinoma, Non-Small-Cell Lung" still matches small + cell + lung (3 of 4).
  const lung = api.filterStudiesByCondition([rec("NCT1", "Drug X in NSCLC", ["NSCLC"], [], ["Carcinoma, Non-Small-Cell Lung"])], "non-small cell lung cancer");
  ok("NSCLC trial registered by its MeSH term is kept for 'non-small cell lung cancer'", lung.kept.length === 1);
  ok("'dystrophies' counts for 'dystrophy'", api.filterStudiesByCondition([rec("NCT2", "Myotonic dystrophies registry", ["Myotonic Dystrophies"])], "myotonic dystrophy type 1").kept.length === 1);
  ok("only generic words: nothing to check against, left alone", !api.filterStudiesByCondition(hits, "chronic disease type 2").checked);
  ok("the note counts and names the query", api.conditionDropNote(2, "Myotonic dystrophy type 1").startsWith("2 search hits left out: ClinicalTrials.gov matched them to \u201cMyotonic dystrophy type 1\u201d") && api.conditionDropNote(0, "x") === null);
}
report();

section("Possessive names");
{
  ok("possessive: Stoke's, Biologics', blank case's", api.possessive("Stoke") === "Stoke's" && api.possessive("Edge two-programs") === "Edge two-programs'" && api.possessive("") === "'s");
}
report();

section("PepGen, the whole case recomputed from its inputs (Bear, Base, Bull)");
{
  // test/fixtures/pepgen_case.json is the PepGen case exactly as it was typed
  // into the packaged app's own fields by test/packaged/case_fill.js. Below,
  // every year of every scenario is rebuilt from those inputs with formulas
  // written out here. Only benchmark LOOKUPS come from the app: each stage's
  // benchmark duration and cost (to split the $320M / 4.5-year override), the
  // stage odds under the 15% override, and the six-year median launch curve.
  //   Eligible     40,000 x 60% diagnosed x 55% treated x 75% eligible = 9,900
  //   On drug      9,900 x 23% peak share x 85% adherence = 1,935.45 at peak
  //   US price     $350,000 WAC x 80% realised = $280,000, +2% a year
  //   Ex-US        180% of US patients x 50% of the ENTERED price = $175,000, flat,
  //                1.5 years behind the US curve (year y = halfway between the US
  //                curve's years y-2 and y-1; the benchmark lag, left blank)
  //   After LOE    (year 10) 45% of volume x 65% of price, in one year
  //   Costs        COGS 12%; 60 specialty reps x $280,000 (+2%/yr) to LOE, 30% in
  //                the year before launch; marketing 3% of peak revenue to LOE;
  //                1% royalty owed to OUI on net sales
  //   Corporate    $26M a year before revenue; 17% (34% x 50%) of revenue above
  //   G&A          $400M, straight line between — on the revenue it has if
  //                launched; before launch x the odds it is still developing (or
  //                winding down, one year after a failure), after x P(launch)
  //   Tax          21% of the success case's profit after a $177.3M NOL that also
  //                collects every loss year of the success case, x P(launch)
  //   Discount     end of year: year t (2026 = 0) at 1/(1+r)^(t+1)
  //   Equity       NPV + $117.238M cash as filed (rolling forward is off) + $100M
  //                raise, over 69,259,517 +
  //                1,101,110 RSUs + 50,276,521 raise shares (options at $4.89 are
  //                out of the money at $2.34) = 120,637,148 (the raise 15% below $2.34)
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const p = c.programs[0];
  const rnd = api.computeRnDToLaunch(p);
  const ramp = [11, 31, 58, 76, 89, 100].map(x => x / 100);
  near("the six-year median launch curve is the one typed here", 0, ramp.reduce((s, v, i) => s + Math.abs(v - api.launchCurveForYears(6, "median")[i] / 100), 0), 1e-12);
  const expectPS = { bear: 0.8866, base: 1.6647, bull: 3.0736 };
  for (const [key, share, posMult, addPct] of [["bear", 60, 60, 0], ["base", 100, 100, 0], ["bull", 140, 150, 0]]) {
    const r = (14 + addPct) / 100, N = 25, L = 5;
    const eff = api.computeEffectivePoS(p, { posMultiplierPct: posMult });
    const reach = {}; eff.posStages.forEach(st => { reach[st.key] = st.posToReachStage; });
    const pos = eff.posToLaunch;
    const peakPts = 40000 * 0.60 * 0.55 * 0.75 * 0.23 * (share / 100) * 0.85;
    const rev = [];
    for (let y = 1; y <= N; y++) {
      const R = k => k < 1 ? 0 : k <= 6 ? ramp[k - 1] : 1;
      const pts = peakPts * R(y), exPts = peakPts * (R(y - 2) + R(y - 1)) / 2;
      rev.push((pts * 280000 * Math.pow(1.02, y - 1) + exPts * 1.8 * 175000) * (y <= 10 ? 1 : 0.45 * 0.65));
    }
    const peakRev = Math.max(...rev);
    // Owed to OUI: 1% of every year's net sales (no partner, so the 10%
    // sublicense share has nothing to apply to).
    const contrib = rev.map((R, i) => R - 0.12 * R - 0.01 * R - (i < 10 ? 60 * 280000 * Math.pow(1.02, i) + 0.03 * peakRev : 0));
    const bCost = rnd.items.reduce((s2, i) => s2 + i.costM, 0), bYears = rnd.items.reduce((s2, i) => s2 + i.years, 0);
    const rd = new Array(L).fill(0), rdFull = new Array(L).fill(0); let cur = 0;
    rnd.items.forEach(i => {
      const yrs = i.years * 4.5 / bYears, full = i.costM * (320 / bCost) * 1e6 / yrs, a = cur, b = cur + yrs;
      for (let y = 0; y < L; y++) {
        const part = full * Math.max(0, Math.min(b, y + 1) - Math.max(a, y));
        rd[y] += part * reach[i.key]; rdFull[y] += part;
      }
      cur = b;
    });
    const ga = v => v <= 0 ? 26e6 : v >= 400e6 ? v * 0.17 : 26e6 + (400e6 * 0.17 - 26e6) * v / 400e6;
    // Overhead only while the company is still going: each stage gate closes
    // where its R&D ends on the 4.5-year calendar (Phase 2 at 2.7/7.05 x 4.5 =
    // 1.72, Phase 3 at 3.70, the FDA at 4.5), fails with reach(this) -
    // reach(next), and a failed company winds down for one more year.
    let cumB = 0;
    const gates = rnd.items.map((it, j) => {
      cumB += it.years;
      return { cut: cumB / bYears * 4.5 + 1, fail: reach[it.key] - (j + 1 < rnd.items.length ? reach[rnd.items[j + 1].key] : pos) };
    });
    const active = t => 1 - gates.reduce((a, g) => a + g.fail * Math.min(1, Math.max(0, t + 1 - g.cut)), 0);
    if (key === "base") near("PepGen still going in year 2: 1 - 0.632 x (3 - 2.723) = 0.825", active(2), 1 - (1 - reach.phase3) * (3 - (2.7 / 7.05 * 4.5 + 1)), 1e-9);
    // Tax is owed only where the drug works: the success case (all R&D paid,
    // full revenue, overhead of a launched company) is taxed after its own
    // losses, and that tax is weighted by P(launch).
    let nol = 177.3e6, npv = 0; const cf = [];
    for (let t = 0; t < N; t++) {
      const i = t - L, launched = i >= 0 ? pos : 0;
      const gaT = 26e6 * (active(t) - launched) + (i >= 0 ? launched * ga(rev[i]) : 0);
      const pre = (i >= 0 ? contrib[i] * pos : 0) - (t < L ? rd[t] : 0) - (i === -1 ? 60 * 280000 * 0.3 * pos : 0) - gaT;
      const ifWorks = (i >= 0 ? contrib[i] - ga(rev[i]) : -26e6) - (t < L ? rdFull[t] : 0) - (i === -1 ? 60 * 280000 * 0.3 : 0);
      let taxIfWorks = 0;
      if (ifWorks < 0) nol -= ifWorks; else { const use = Math.min(nol, ifWorks); nol -= use; taxIfWorks = 0.21 * (ifWorks - use); }
      const flow = pre - pos * taxIfWorks;
      cf.push(flow); npv += flow / Math.pow(1 + r, t + 1);
    }
    const shares = 69259517 + 1101110 + 100e6 / (2.34 * 0.85);
    const cash = 117.238e6; // as the filing reported it (rolling forward is off)
    const perShare = (npv + cash + 100e6) / shares;
    const app = api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, key), key, 14, c.terminalValue);
    near(key + ": NPV equals the independent rebuild", app.npvResult.npv, npv, 25);
    near(key + ": diluted shares are 120,637,148", app.equity.dilutedShares, shares, 0.5);
    near(key + ": fair value per share equals the rebuild", app.equity.perShare, perShare, 1e-6);
    near(key + ": and is the $" + expectPS[key] + " the case showed", perShare, expectPS[key], 5e-5);
    const rows = api.computeProjectionRows(app, c);
    ok(key + ": every one of the 25 years' cash flow within $1 of the rebuild", rows.length === N && rows.every((row, t) => Math.abs(row.fcf - cf[t]) < 1));
  }
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Textbook cross-checks (Friedman, Motulsky — Spark handoff, October 2026)");
// Independent worked examples from published textbooks, recomputed by hand in
// the handoff; each is set against the app's own solver, not its output.
{
  // Friedman ch. 8 (Lachin): pC 0.40, pI 0.30, two-sided 5%, 90% power.
  // p = 0.35; 1.96·√(2·0.35·0.65) = 1.3221; 1.2816·√(0.24 + 0.21) = 0.8597;
  // 2N = 2 × 2.1818² / 0.01 = 952.0 → 476.0 a side, so the smallest whole n is 477.
  const zA = 1.959964, zB = 1.281552, pbar = 0.35;
  const twoN = 2 * Math.pow(zA * Math.sqrt(2 * pbar * (1 - pbar)) + zB * Math.sqrt(0.4 * 0.6 + 0.3 * 0.7), 2) / 0.01;
  near("Lachin: 2N = 952 (Friedman's 952.3 with z rounded to 1.282)", twoN, 952.0, 0.5);
  ok("the app's two-proportion solver needs 477 a side", api.solveSampleSizeTwoProportion(0.4, 0.3, 0.9, 0.05, "two", 1).n1 === Math.ceil(twoN / 2));
  // Friedman p. 175: the same trial run at 350 a side. Zβ = (−1.3221 + √350 × 0.1)
  // / √0.45 = (−1.3221 + 1.8708) / 0.6708 = 0.818 → power Φ(0.818) = 0.793.
  near("Friedman: 350 a side gives power 0.793", api.closedFormPowerTwoProportion(0.4, 0.3, 350, 350, 0.05), 0.793, 0.001);
  // Friedman pp. 185–186: hazards 0.30 vs 0.20, 90% power. Events = 4(1.96 + 1.2816)² / ln(1.5)²
  // = 4 × 10.507 / 0.16440 = 255.7 → 256.
  ok("Schoenfeld: hazard ratio 2/3 needs 256 events", api.solveEventsNeeded(0.2 / 0.3, 0.9, 0.05, 1).n === 256);
  // Motulsky ch. 20 (Lehr): SD 10, difference 5, 80% power → 2 × (2.8 × 10 / 5)² = 62.7 → 63 a group.
  ok("Lehr: SD 10, difference 5, 80% power → 63 a group", api.solveSampleSizeMeans(5, 10, 0.8, 0.05, "two", 1).n1 === 63);
  // Fisher's exact, 15/60 vs 5/60: two-sided p = 0.0257 (Motulsky-style worked example).
  near("Fisher: 15/60 vs 5/60, two-sided p = 0.0257", api.fisherExactTwoSided(15, 45, 5, 55), 0.0257, 0.00005);
  // The handoff's fragility index for this table is 2, by removing responders
  // from the treated arm. Walsh (2014) adds events to the arm with fewer:
  // 15/60 vs 6/60 already gives p = 0.0528, so the index is 1 — the app is right.
  ok("fragility follows Walsh: 15/60 vs 5/60 → 1 (not the handoff's 2)", api.computeFragilityIndex(15, 60, 5, 60).fragilityIndex === 1);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("One drug in several indications; convertible preferred (October 2026)");
{
  const mk = (id, drugName, name, indication) => ({ id, drugName, name, indication });
  const a = mk("a", "ivonescimab", "HARMONi — 2L+ EGFRm NSCLC"), b = mk("b", "ivonescimab", "HARMONi-3 — 1L squamous NSCLC"), c = mk("c", "zorevunersen", "Dravet");
  const progs = [a, b, c];
  ok("a drug alone in its case is named by the drug", api.programLabel(c, progs) === "zorevunersen");
  ok("two programs of one drug are named by their programs", api.programLabel(a, progs) === "HARMONi — 2L+ EGFRm NSCLC" && api.programLabel(b, progs) === "HARMONi-3 — 1L squamous NSCLC");
  ok("matching is case-insensitive", api.programLabel(mk("d", "IVONESCIMAB", "X"), [a, mk("d", "IVONESCIMAB", "X")]) === "X");
  const d1 = mk("d1", "ivo", "New Program", "1L NSCLC, all comers"), d2 = mk("d2", "ivo", "New Program", "colorectal");
  ok("default-named twins fall back to drug — indication", api.programLabel(d1, [d1, d2]) === "ivo — 1L NSCLC" && api.programLabel(d2, [d1, d2]) === "ivo — colorectal");
  const e1 = mk("e1", "ivo", "New Program"), e2 = mk("e2", "ivo", "New Program");
  ok("and are numbered when nothing else tells them apart", api.programLabel(e1, [e1, e2]) === "ivo — program (1)" && api.programLabel(e2, [e1, e2]) === "ivo — program (2)");
  ok("no list given: the drug name, as before", api.programLabel(a) === "ivonescimab");

  // Convertible preferred counts as its as-converted shares at any price, and
  // never as debt: AstraZeneca's 108,955,369 at $18.36 with the stock at $17.17.
  const cap = { mode: "detailed", basicShares: "797749602", cash: "1000", debt: "0", currentPrice: "17.17", prefShares: "108955369" };
  const r = api.computeCapitalStructure(cap);
  near("preferred adds its as-converted shares", r.dilutedShares, 797749602 + 108955369, 0);
  near("and takes nothing off net cash", r.netCash, 1000, 0);
  near("the same as adding the shares to basic by hand", r.dilutedShares, api.computeCapitalStructure({ ...cap, prefShares: "", basicShares: String(797749602 + 108955369) }).dilutedShares, 0);
  near("below conversion the note field instead treats $2.0B as debt (why it is the wrong place)", api.computeCapitalStructure({ ...cap, prefShares: "", convFace: "2000000000", convPrice: "18.3561" }).netCash, 1000 - 2e9, 0);
  near("a price above conversion changes nothing for preferred", api.computeCapitalStructure({ ...cap, currentPrice: "25" }).dilutedShares, 797749602 + 108955369, 0);
  near("simple mode ignores the field (the typed diluted count is the whole count)", api.computeCapitalStructure({ mode: "simple", dilutedSharesSimple: "1000", prefShares: "500" }).dilutedShares, 1000, 0);
  near("blank or negative is zero", api.computeCapitalStructure({ ...cap, prefShares: "-5" }).dilutedShares, 797749602, 0);

  // EDGAR: preferred outstanding at the latest 10-Q, from either tag.
  const fact = (val, end, form) => ({ val, end, form: form || "10-Q", fy: 2026, fp: "Q2", filed: "2026-08-01" });
  const facts = { facts: { "us-gaap": {
    PreferredStockSharesOutstanding: { units: { shares: [fact(0, "2025-12-31", "10-K"), fact(5000, "2026-06-30")] } },
    TemporaryEquitySharesOutstanding: { units: { shares: [fact(7000, "2026-03-31")] } } } } };
  const pref = api.extractPreferredShares(facts);
  ok("EDGAR: the latest preferred count is read (5,000 at 2026-06-30, PreferredStockSharesOutstanding)", pref && pref.count === 5000 && pref.asOf === "2026-06-30" && pref.tag === "PreferredStockSharesOutstanding");
  ok("EDGAR: none reported → null", api.extractPreferredShares({ facts: { "us-gaap": { PreferredStockSharesOutstanding: { units: { shares: [fact(0, "2026-06-30")] } } } } }) === null);

  // Who reads out first by rival drugs: a hit must name one of them.
  const st = (title, intr, other) => ({ protocolSection: { identificationModule: { briefTitle: title }, armsInterventionsModule: { interventions: [{ name: intr, otherNames: other || [] }] } } });
  const names = ["pumitamig", "BNT327", "PF-08634404"];
  ok("rival drugs: matched through an intervention's other names", api.studyNamesAnyDrug(st("A study in NSCLC", "Drug X", ["BNT327"]), names));
  ok("rival drugs: matched through the title", api.studyNamesAnyDrug(st("Symbiotic-Lung-01: PF-08634404 plus chemotherapy", "Chemo"), names));
  ok("rival drugs: a pembrolizumab trial is left out", !api.studyNamesAnyDrug(st("Pembrolizumab in NSCLC", "Pembrolizumab"), names));
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Licence: royalty tiers and one licence across a drug's programs (October 2026)");
{
  // Bogdan & Villiger's tiered royalty, applied marginally: 5% to $100M,
  // 6.5% from $100M to $250M, 7.5% above. On $300M: 5 + 9.75 + 3.75 = $18.5M.
  const lic = { tiers: [{ upToM: "250", pct: "6.5" }, { upToM: "", pct: "7.5" }, { upToM: "100", pct: "5" }] }; // unsorted on purpose
  near("tiers: $300M of sales owes $18.5M", api.licenceRoyaltyOn(300e6, lic), 18.5e6, 1e-6);
  near("tiers: $100M owes $5M (the boundary belongs to the lower tier)", api.licenceRoyaltyOn(100e6, lic), 5e6, 1e-6);
  near("tiers: $50M owes $2.5M", api.licenceRoyaltyOn(50e6, lic), 2.5e6, 1e-6);
  near("tiers: sales past the last ceiling pay the last rate", api.licenceRoyaltyOn(300e6, { tiers: [{ upToM: "100", pct: "5" }, { upToM: "200", pct: "8" }] }), 5e6 + 8e6 + 8e6, 1e-6);
  near("no tiers: the flat royaltyPct (11% of $1B)", api.licenceRoyaltyOn(1e9, { royaltyPct: "11", tiers: [] }), 110e6, 1e-6);
  near("a blank tier rate is ignored", api.licenceRoyaltyOn(1e9, { royaltyPct: "11", tiers: [{ upToM: "100", pct: "" }] }), 110e6, 1e-6);

  // One drug, two programs; the licence on A is shared. A: 50% odds, own
  // sales 0 / $100M / $200M; B: 40%, 0 / 0 / $150M. 10% royalty plus $50M
  // when total sales first reach $250M. The four worlds:
  //   both (0.2):  totals 0 / 100 / 350 → royalty 0 / 10 / 35, milestone in year 2
  //   A only (0.3): 0 / 100 / 200 → 0 / 10 / 20      B only (0.2): 0 / 0 / 150 → 0 / 0 / 15
  // Expected royalty: year 1 = 0.5 × 10 = 5; year 2 = 7 + 6 + 3 = 16 (= 10% of
  // the odds-weighted 160 — a flat royalty is linear); milestone 0.2 × 50 = 10.
  const A = { id: "A", drugName: "Ivo", licensor: { enabled: true, shared: true, name: "Akeso", royaltyPct: "10", approvalMilestoneM: "100", sublicensePct: "5", salesMilestones: [{ thresholdM: "250", paymentM: "50" }] } };
  const B = { id: "B", drugName: "ivo ", licensor: { enabled: false, approvalMilestoneM: "40" } };
  const C = { id: "C", drugName: "other", licensor: { enabled: true, royaltyPct: "3" } };
  const progs = [A, B, C];
  const rowsOf = arr => arr.map(v => ({ commercialRevenue: v * 1e6 }));
  const pvs = [{ id: "A", posToLaunch: 0.5, launchYearOffset: 0, pnl: rowsOf([0, 100, 200]) }, { id: "B", posToLaunch: 0.4, launchYearOffset: 0, pnl: rowsOf([0, 0, 150]) }, { id: "C", posToLaunch: 1, launchYearOffset: 0, pnl: rowsOf([5, 5, 5]) }];
  const owed = api.drugLicenceExpectedByYear(pvs, progs, 3);
  near("shared: year-1 royalty $5M", owed.royalty[1], 5e6, 1e-6);
  near("shared: year-2 royalty $16M", owed.royalty[2], 16e6, 1e-6);
  near("shared: the $250M milestone is worth $10M in year 2 (only both together reach it)", owed.milestones[2], 10e6, 1e-6);
  near("shared: nothing in year 0", owed.total[0], 0, 0);
  ok("shared: one group, led by A, covering A and B (drug names matched loosely); C stays per program", owed.groups.length === 1 && owed.groups[0].leadId === "A" && owed.groups[0].memberIds.join() === "A,B");
  // B launching a year later moves its sales: year-2 totals become 0/100/200 + B's 0 → no milestone.
  const late = api.drugLicenceExpectedByYear([pvs[0], { ...pvs[1], launchYearOffset: 1 }, pvs[2]], progs, 3);
  near("shared: offsets are respected (B a year later: year-2 milestone falls away)", late.milestones[2], 0, 0);
  ok("shared: a group with a member missing is left to the caller (SOTP stand-alone parts)", api.drugLicenceExpectedByYear([pvs[0]], progs, 3).groups.length === 0);
  const eA = api.effectiveLicensor(A, progs), eB = api.effectiveLicensor(B, progs);
  ok("per program: the lead keeps its approval milestone and the sublicense share, no royalty or sales milestones", eA.royaltyPct === "0" && eA.approvalMilestoneM === "100" && eA.sublicensePct === "5" && eA.salesMilestones.length === 0);
  ok("per program: a covered program carries only its own approval milestone, enabled", eB.enabled && eB.approvalMilestoneM === "40" && eB.royaltyPct === "0" && eB.sublicensePct === "5");
  ok("per program: an unrelated drug keeps its own licence", api.effectiveLicensor(C, progs) === C.licensor);
  ok("not shared: nothing groups", api.sharedLicenceFor(B, [{ ...A, licensor: { ...A.licensor, shared: false } }, B]) === null);
  ok("shared but alone in the case: inert", api.sharedLicenceFor(A, [A, C]) === null);

  // Whole-case identity: a flat royalty shared across two programs values
  // exactly as the same royalty entered on each (linear; no milestones).
  const pgCase = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const base0 = pgCase.programs[0];
  const twin = { ...JSON.parse(JSON.stringify(base0)), id: "twin", name: "Second indication", launchYearOffset: "7", posOverridePct: "10" };
  const perProg = { ...pgCase, programs: [{ ...base0, name: "First", licensor: { enabled: true, royaltyPct: "8" } }, { ...twin, licensor: { enabled: true, royaltyPct: "8" } }] };
  const shared = { ...pgCase, programs: [{ ...base0, name: "First", licensor: { enabled: true, shared: true, royaltyPct: "8" } }, { ...twin, licensor: { enabled: false } }] };
  const val = c => api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, "base"), "base", 14, { enabled: false }).equity.perShare;
  near("case: a flat 8% shared across two programs = 8% on each", val(shared), val(perProg), 1e-9);
  // And a sales milestone on the drug's total sales costs at least what one on each program's own sales would.
  const withMs = c => ({ ...c, programs: c.programs.map((p, i) => i === 0 ? { ...p, licensor: { ...p.licensor, salesMilestones: [{ thresholdM: "1000", paymentM: "200" }] } } : p) });
  ok("case: the milestone on combined sales costs more than on one program's own sales", val(withMs(shared)) < val(withMs({ ...shared, programs: shared.programs.map(p => ({ ...p, licensor: { ...p.licensor, shared: false } })) })));
  const sotp = api.computeSOTPBreakdown(withMs(shared), api.getEffectiveScenarioPreset(shared, "base"), "base", 14, { enabled: false });
  ok("SOTP: the shared terms are their own line, and the parts still add up", sotp.licenceGroups.length === 1 && sotp.licenceDrag < 0 && Math.abs(sotp.sumOfParts - (sotp.programBreakdown.reduce((a, p) => a + p.npv, 0) + sotp.gaDrag + sotp.licenceDrag)) < 1);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Catalyst table and range of endings for several programs (October 2026)");
{
  // Three programs built from PepGen's inputs: a filed one, a Phase 3 and a
  // Phase 2, two of them one drug. With no G&A and no tax the value is a sum
  // over programs, so every identity below is exact.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const p0 = pg.programs[0];
  const mk = (id, name, drug, phase, odds, launch) => ({ ...JSON.parse(JSON.stringify(p0)), id, name, drugName: drug, currentPhase: phase, posOverridePct: odds, launchYearOffset: launch, rndOverride: { totalYears: "", totalCostM: "" }, calibrationLog: [], licensor: { enabled: false } });
  const lin = { ...pg, corporateGA: { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" }, taxation: { enabled: false }, futureRaise: { enabled: false }, dilutionPath: { enabled: false },
    programs: [mk("f", "Filed", "ivo", "filed", "80", "1"), mk("p3", "Phase 3", "ivo", "phase3", "50", "3"), mk("p2", "Phase 2", "other", "phase2", "25", "5")] };
  const val = c => api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, "base"), "base", 14, { enabled: false }).equity.perShare;
  const base = val(lin);
  const L = api.computeCatalystLadder(lin, 14, { enabled: false });
  ok("ladder: one row per program still in development", L.rows.length === 3);
  L.rows.forEach(r => near("ladder: " + r.program + " — pass × value + fail × value returns Base", r.weighted, base, 1e-9));
  const filed = L.rows.find(r => r.programId === "f");
  near("ladder: the filed program's gate is the FDA decision, passing at its own 80%", filed.pass, 0.8, 1e-12);
  ok("ladder: its gate is named the FDA decision", filed.gate === "FDA decision");
  near("ladder: failing is the case with that program at zero odds", filed.failValue, val({ ...lin, programs: lin.programs.map(p => p.id === "f" ? { ...p, posOverridePct: "0" } : p) }), 1e-12);
  near("ladder: passing an FDA decision means launch", filed.passValue, val({ ...lin, programs: lin.programs.map(p => p.id === "f" ? { ...p, posOverridePct: "100" } : p) }), 1e-9);
  const p3 = L.rows.find(r => r.programId === "p3");
  near("ladder: after a positive Phase 3 the odds are 50% ÷ the gate's pass chance", p3.oddsAfter, 0.5 / p3.pass, 1e-12);
  // Read-across 20%: a failure cuts the other ivo program by 20%; a pass raises
  // it by u = (1 − (1 − p) × 0.8) ÷ p, which leaves its average unchanged.
  const ra = { ...lin, catalystLadder: { readAcrossPct: "20" } };
  const LR = api.computeCatalystLadder(ra, 14, { enabled: false });
  // To within a hundred-thousandth: the odds of launch average exactly, but the
  // stage odds under them are rebuilt in log space, so stage costs are not
  // exactly linear in the odds of launch (here $0.00002 on $53).
  LR.rows.forEach(r => near("read-across: " + r.program + " still averages Base (to 1e-6 of it)", r.weighted, base, base * 1e-6));
  const fR = LR.rows.find(r => r.programId === "f");
  near("read-across: the filed program failing cuts the Phase 3 to 40%", fR.failValue, val({ ...lin, programs: lin.programs.map(p => p.id === "f" ? { ...p, posOverridePct: "0" } : p.id === "p3" ? { ...p, posOverridePct: "40" } : p) }), 1e-9);
  ok("read-across: the other drug's program is untouched (the swing is wider only for the same drug)", Math.abs(LR.rows.find(r => r.programId === "p2").passValue - L.rows.find(r => r.programId === "p2").passValue) < 1e-9);

  const R = api.computeRangeOfEndings(lin, 14, { enabled: false });
  // Endings: filed 2 (fail at the FDA, launch), Phase 3 3, Phase 2 4 → 24.
  ok("endings: every way to end is counted (2 × 3 × 4 = 24)", R.count === 24);
  near("endings: the probabilities add to 1", R.byCount.reduce((a, b) => a + b, 0), 1, 1e-12);
  near("endings: with no G&A or tax, the probability-weighted mean is Base exactly", R.mean, base, 1e-9);
  near("endings: none launch with probability 0.2 × 0.5 × 0.75", R.byCount[0], 0.2 * 0.5 * 0.75, 1e-12);
  near("endings: all three with 0.8 × 0.5 × 0.25", R.byCount[3], 0.8 * 0.5 * 0.25, 1e-12);
  const RR = api.computeRangeOfEndings({ ...lin, catalystLadder: { readAcrossPct: "50" } }, 14, { enabled: false });
  RR.launchOdds.forEach(o => near("endings, 50% read-across: " + o.id + " keeps its own odds of launch", o.odds, { f: 0.8, p3: 0.5, p2: 0.25 }[o.id], 1e-9));
  near("endings, read-across: the mean is still Base (marginals kept, value additive)", RR.mean, base, 1e-9);
  ok("endings, read-across: both ivo programs together become likelier (all-or-nothing)", RR.byCount[0] + RR.byCount[3] > R.byCount[0] + R.byCount[3]);
  ok("single program: neither applies (the outcome tree does)", api.computeCatalystLadder({ ...lin, programs: [lin.programs[0]] }, 14, { enabled: false }) === null && api.computeRangeOfEndings({ ...lin, programs: [lin.programs[0]] }, 14, { enabled: false }) === null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("Reading a readout (October 2026)");
{
  // Motulsky ch. 45 (the handoff's M12): 0.50 (SE 0.12) against 0.20 (SE 0.14),
  // given as 95% intervals: z = 0.30 / √(0.0144 + 0.0196) = 1.627, p = 0.104.
  const sg = api.subgroupInteraction(0.50, 0.50 - 1.959964 * 0.12, 0.50 + 1.959964 * 0.12, 0.20, 0.20 - 1.959964 * 0.14, 0.20 + 1.959964 * 0.14, "linear", 0.95);
  near("subgroup: z = 1.627", sg.z, 0.30 / Math.sqrt(0.0144 + 0.0196), 1e-6);
  near("subgroup: p = 0.104", sg.p, 0.1037, 0.0005);
  // HARMONi-2 OS by PD-L1 (Summit 8-K, 2026-09-13): high 0.58 (0.38–0.89), low
  // 0.85 (0.61–1.18). ln 0.58 = −0.5447, SE (ln 0.89 − ln 0.38)/3.92 = 0.2171;
  // ln 0.85 = −0.1625, SE 0.1683; z = −0.3822 / 0.2747 = −1.391, p = 0.164.
  const h2 = api.subgroupInteraction(0.58, 0.38, 0.89, 0.85, 0.61, 1.18, "ratio", 0.95);
  near("subgroup, HARMONi-2 PD-L1 high vs low: z = −1.39", h2.z, -1.391, 0.005);
  near("…p = 0.164: no evidence the PD-L1 subgroups differ", h2.p, 0.164, 0.002);
  ok("…and the reading says so", /No evidence/.test(api.readSubgroup(h2, 4, "ratio").verdict));
  ok("subgroup: a bad interval is refused", api.subgroupInteraction(0.5, 0.6, 0.4, 0.2, 0.1, 0.3, "linear") === null);

  // Motulsky ch. 18: prior 10%, α 5%, power 80% → 0.045 / 0.125 = 36%; 1% → 86%; 50% → 5.9%.
  near("false positives: prior 10% → 36%", api.falsePositiveRisk(10, 0.05, 80), 0.36, 1e-12);
  near("false positives: prior 1% → 86%", api.falsePositiveRisk(1, 0.05, 80), 0.0495 / (0.0495 + 0.008), 1e-12);
  near("false positives: prior 50% → 5.9%", api.falsePositiveRisk(50, 0.05, 80), 0.025 / 0.425, 1e-12);

  // Rule of three: 0/60 → 1 − 0.05^(1/60) = 4.87%; 0/800 → 0.374%, 1 in 268.
  near("safety: 0 of 60 → 4.87%", api.safetyUpperBound(0, 60).upper, 0.0487, 0.00005);
  near("safety: 0 of 800 → 1 in 268", 1 / api.safetyUpperBound(0, 800).upper, 267.6, 0.5);
  ok("safety: the reading names 1 in 268", /1 in 268/.test(api.readSafetyExposure(0, 800, api.safetyUpperBound(0, 800).upper).verdict));

  // Interim boundaries. O'Brien–Fleming-type spending at t = 0.4: z = 1.96 / √0.4 = 3.099.
  const ob = api.interimBoundary(0.4, 0.05, "obf");
  near("interim, O'Brien–Fleming-type at 40%: z = 3.099 (to the app's inverse-normal precision)", ob.zInterim, 1.959964 / Math.sqrt(0.4), 1e-6);
  // Pocock-type at 50%: α(0.5) = 0.05 ln(1 + 0.8591) = 0.03101 → z = Φ⁻¹(1 − 0.0155) = 2.157.
  near("interim, Pocock-type at 50%: z = 2.157", api.interimBoundary(0.5, 0.05, "pocock").zInterim, 2.157, 0.002);
  near("interim, Haybittle–Peto: z = 3.0", api.interimBoundary(0.5, 0.05, "haybittle").zInterim, 3, 0);
  // The final boundary, checked by an independent seeded simulation: two
  // looks with Z1 = √t × Z2-ish (Z2 = √t Z1 + √(1 − t) W), a trial rejects if
  // |Z1| ≥ c1 or |Z2| ≥ c2; the share rejecting under the null should be 5%
  // (200,000 trials: SE = √(0.05 × 0.95 / 200000) = 0.00049; tolerance 4 SE).
  {
    let seed = 20261009;
    const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const gauss = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
    let rej = 0; const N = 200000, t = 0.4;
    for (let i = 0; i < N; i++) { const z1 = gauss(), z2 = Math.sqrt(t) * z1 + Math.sqrt(1 - t) * gauss(); if (Math.abs(z1) >= ob.zInterim || Math.abs(z2) >= ob.zFinal) rej++; }
    near("interim: the two looks together spend 5% (seeded simulation)", rej / N, 0.05, 4 * Math.sqrt(0.05 * 0.95 / N));
    ok("interim: the final boundary is a little above 1.96 (" + ob.zFinal.toFixed(3) + ")", ob.zFinal > 1.96 && ob.zFinal < 2.0);
  }
  // Schoenfeld: z 1.96 with 256 events at 1:1 → HR = exp(−1.96 / √64) = 0.7827.
  near("hazard ratio for z = 1.96 at 256 events: 0.783", api.hazardRatioForZ(1.959964, 256, 1), Math.exp(-1.959964 / 8), 1e-12);
  // Friedman ch. 17 (the handoff's F7): K = 5, k = 2 → t = 0.4, z = 1.0, θ = 3.24:
  // (1.96 − 1.0 × √0.4 − 3.24 × 0.6) / √0.6 = −0.7959 → CP = 0.787.
  near("conditional power: Friedman's worked example, 0.787", api.conditionalPower(0.4, 1.0, 3.24, 1.959964), 0.787, 0.001);

  // Dead or underpowered, on HARMONi's OS (0.79, 95% CI 0.62–1.01) with 0.80
  // as the smallest effect that matters: includes 1 but reaches 0.62 → not definitive.
  ok("meaningful: HARMONi primary OS (0.62–1.01) is not definitive", /Not definitive/.test(api.readMeaningfulEffect(0.62, 1.01, 0.80, "ratio").verdict));
  ok("meaningful: the updated OS (0.61–0.95) is real, size unsettled", /Real; whether/.test(api.readMeaningfulEffect(0.61, 0.95, 0.80, "ratio").verdict));
  ok("meaningful: 0.90–1.05 rules out a 0.80 effect (definitive negative)", /Definitively negative/.test(api.readMeaningfulEffect(0.90, 1.05, 0.80, "ratio").verdict));
  ok("meaningful: 0.55–0.75 is meaningful whatever the true value", /meaningful effect, whatever/.test(api.readMeaningfulEffect(0.55, 0.75, 0.80, "ratio").verdict));
  ok("meaningful: a difference, benefit upward: −1.2 to +12 against 5 → not definitive (Greenhalgh's heart-failure trial)", /Not definitive/.test(api.readMeaningfulEffect(-1.2, 12, 5, "linear").verdict));
  ok("meaningful: real but smaller than matters (0.5 to 3 against 5)", /smaller than what you said/.test(api.readMeaningfulEffect(0.5, 3, 5, "linear").verdict));

  // Press-release reader on Summit-style wording (paraphrased).
  const pr = api.scanPressRelease("Ivonescimab showed a positive trend in overall survival without achieving statistical significance, with a hazard ratio of 0.79 (95% CI: 0.62 – 1.01; p=0.057). In an updated analysis the HR was 0.76 (95% CI: 0.61 – 0.95; nominal p=0.0151). A clinically meaningful benefit was seen across subgroups; the PFS analysis was pre-specified.");
  ok("press release: both ratio intervals read, one including 1", pr.ratios.length === 2 && pr.ratios[0].includesNull && !pr.ratios[1].includesNull);
  ok("press release: p = 0.057 is a near miss; p = 0.0151 is nominal", pr.pValues.length === 2 && pr.pValues[0].nearMiss && pr.pValues[1].nominal);
  ok("press release: the phrases found", ["postrend", "missed", "updated", "meaningful", "subgroup", "prespecified"].every(k => pr.phrases.some(p => p.key === k)));
  ok("press release: 'pre-specified' is marked as a good sign, not a flag", pr.phrases.find(p => p.key === "prespecified").good && !pr.flagged.some(p => p.key === "prespecified"));

  // Peak above every comp in its area: an oncology program at $40B tops Keytruda's $31.7B.
  const pg = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pepgen_case.json"), "utf8"));
  const big = { ...pg.programs[0], therapeuticArea: "Oncology", revenueMode: "quick", quickRevenue: { peakRevenue: "40000000000", yearsToPeak: "6", profile: "median" } };
  const ab = api.peakAboveAreaComps(big);
  ok("peak vs comps: $40B oncology is above every oncology comp (largest Keytruda)", ab && ab.top.drug === "Keytruda" && ab.count >= 3);
  ok("peak vs comps: $1B oncology is not flagged", api.peakAboveAreaComps({ ...big, quickRevenue: { ...big.quickRevenue, peakRevenue: "1000000000" } }) === null);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("FDA decision date and patent term extension (October 2026)");
{
  // Ng ch. 8 (the handoff's D4): an NME submitted 2026-09-01, priority review:
  // filing 60 days later, 2026-10-31; goal 6 months after that, 2027-04-30.
  const a = api.fdaGoalDate("2026-09-01", "program", "priority");
  ok("FDA: NME priority — filing 2026-10-31, goal 2027-04-30", a.filing === "2026-10-31" && a.goal === "2027-04-30");
  ok("FDA: NME standard — 10 months after filing, 2027-08-31", api.fdaGoalDate("2026-09-01", "program", "standard").goal === "2027-08-31");
  ok("FDA: a non-NME NDA counts from submission (standard: 2027-07-01)", api.fdaGoalDate("2026-09-01", "other", "standard").goal === "2027-07-01");
  ok("FDA: Class 1 resubmission, 2 months", api.fdaGoalDate("2026-09-01", "resub1").goal === "2026-11-01");
  ok("FDA: Class 2 resubmission, 6 months", api.fdaGoalDate("2026-09-01", "resub2").goal === "2027-03-01");
  ok("FDA: a major amendment adds 3 months", api.fdaGoalDate("2026-09-01", "program", "priority", true).goal === "2027-07-30");
  ok("FDA: month ends clamp (2025-12-31 + 2 months = 2026-02-28)", api.fdaGoalDate("2025-12-31", "resub1").goal === "2026-02-28");
  // Summit's BLA: submitted in Q4 2025, standard review, goal 2026-11-14 —
  // the Program's 12 months from a mid-November submission.
  ok("FDA: a 2025-11-14 BLA, standard, lands on 2026-11-13 — a day from Summit's announced 2026-11-14 (FDA counts the filing date inclusively)", api.fdaGoalDate("2025-11-14", "program", "standard").goal === "2026-11-13");

  // Patent term extension: Summit-like dates. Testing phase 2022-06-01 → 2025-11-14
  // (3.45 years, half 1.73) + review 1.0 year = 2.73 years; 2039-06-30 + 2.73 =
  // 2042-03, past approval + 14 years (2040-11-14), so the cap binds.
  const e = api.estimatePatentTermExtension({ expiry: "2039-06-30", ind: "2022-06-01", submitted: "2025-11-14", approval: "2026-11-14" });
  near("PTE: raw extension 2.73 years", e.raw, 3.4537 / 2 + 1.0, 0.002);
  ok("PTE: the 14-years-after-approval cap binds (to about 2040-11)", e.binding === "fourteen-year" && e.extended.slice(0, 7) === "2040-11");
  ok("PTE: the biologic floor from that approval is 2038-11", e.floors.biologic.slice(0, 7) === "2038-11");
  // No cap: 2020-01-01 → 2024-01-01 testing (4.0, half 2.0) + 1.0 review = 3.0 → 2033-01.
  const f = api.estimatePatentTermExtension({ expiry: "2030-01-01", ind: "2020-01-01", submitted: "2024-01-01", approval: "2025-01-01" });
  near("PTE: 2 + 1 = 3.0 years", f.raw, 3.0, 0.005);
  ok("PTE: extended to 2033-01, no cap binding", f.extended.slice(0, 7) === "2033-01" && f.binding === null);
  // Five-year maximum: 10 years of testing (5) + 1 of review = 6 → 5.
  ok("PTE: the five-year maximum", api.estimatePatentTermExtension({ expiry: "2030-01-01", ind: "2010-01-01", submitted: "2020-01-01", approval: "2021-01-01" }).binding === "five-year");
  // Testing counts only after the patent issued: issued 2022-01-01 → testing 2.0 (half 1.0) + 1.0 = 2.0.
  near("PTE: testing counted from the issue date when later than the IND", api.estimatePatentTermExtension({ expiry: "2030-01-01", ind: "2020-01-01", submitted: "2024-01-01", approval: "2025-01-01", issued: "2022-01-01" }).raw, 2.0, 0.005);
}
report();

// ════════════════════════════════════════════════════════════════════════════
section("The Summit (SMMT) sample, rebuilt where it is new (October 2026)");
{
  // test/fixtures/summit_case.json is sampleCaseSummit() without its worked examples.
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "summit_case.json"), "utf8"));
  const byName = re => c.programs.find(p => re.test(p.name));
  // HARMONi's revenue, year by year. US: 14,000 a year × 0.6 years on drug ×
  // 85% treated = 7,140 on drug; × 25% share = 1,785 at peak; × the 4-year
  // median curve (21, 58, 83, 100%); × $183K ASP growing 2% a year from year 2.
  // Ex-US: 150% of the patients at 45% of the price, flat, 1.5 years later —
  // half a year into each curve point, so year k carries the average of the
  // curve at k − 1 and k − 2. From year 14 the IRA clock takes 20% off US sales.
  const curve4 = [0.21, 0.58, 0.83, 1];
  const cAt = k => k <= 0 ? 0 : k > 4 ? 1 : curve4[k - 1];
  const h = byName(/^HARMONi —/);
  const hr = api.getProgramRevenueResult(h, 25);
  const peakUS = 14000 * 0.6 * 0.85 * 0.25, exUSPeak = peakUS * 1.5 * 183000 * 0.45;
  near("HARMONi: 1,785 patients on drug at peak", hr.peakPatients != null ? hr.peakPatients : peakUS, peakUS, 1e-6);
  let okYears = true;
  for (let k = 1; k <= 14; k++) {
    const us = peakUS * cAt(k) * 183000 * Math.pow(1.02, k - 1) * (k > 13 ? 0.8 : 1);
    const ex = exUSPeak * (cAt(k - 1) + cAt(k - 2)) / 2;
    const y = hr.years[k - 1];
    if (Math.abs(y.usRevenue - us) > 1 || Math.abs(y.exUSRevenue - ex) > 1) okYears = false;
  }
  ok("HARMONi: every year 1–14 of US and ex-US revenue within $1 of the rebuild (IRA cut in year 14)", okYears);
  // The squamous program: 29,200 × 0.85 × 80% = 19,856 on drug; × 35% = 6,949.6
  // at peak, the 5-year median curve, launching in year 2 of the case.
  const sq = byName(/squamous NSCLC$/);
  const sr = api.getProgramRevenueResult(sq, 25);
  const curve5 = api.launchCurveForYears(5, "median").map(x => x / 100);
  const c5 = k => k <= 0 ? 0 : k > curve5.length ? 1 : curve5[k - 1];
  const peakSq = 29200 * 0.85 * 0.8 * 0.35;
  let okSq = true;
  for (let k = 1; k <= 12; k++) {
    const us = peakSq * c5(k) * 183000 * Math.pow(1.02, k - 1);
    const ex = peakSq * 1.5 * 183000 * 0.45 * (c5(k - 1) + c5(k - 2)) / 2;
    if (Math.abs(sr.years[k - 1].usRevenue - us) > 1 || Math.abs(sr.years[k - 1].exUSRevenue - ex) > 1) okSq = false;
  }
  ok("squamous: years 1–12 within $1 of the rebuild (6,949.6 patients at peak)", okSq);

  // Shares: 797,749,602 common + 108,955,369 as-converted preferred + options by
  // the treasury method, 118,367,815 × (1 − 4.45/17.17) = 87,690,418 + 730,000 RSUs.
  const opts = 118367815 * (1 - 4.45 / 17.17);
  const r = api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, "base"), "base", 12, c.terminalValue);
  near("shares: 995.1M diluted, the preferred counted as common", r.equity.dilutedShares, 797749602 + 108955369 + opts + 730000, 0.5);

  // Akeso, in the world where every program works: 11% of total ivonescimab
  // own sales each year, plus each sales milestone in the first year the total
  // reaches it — the licence on HARMONi covering all five programs.
  const sure = { ...c, programs: c.programs.map(p => ({ ...p, posOverridePct: "100" })) };
  const pvs = sure.programs.map(p => api.computeProgramValuation(p, api.SCENARIO_PRESETS.base, "base", sure.programs));
  const totalAt = cy => pvs.reduce((a, v) => { const row = v.pnl[cy - (v.launchYearOffset || 0)]; return a + (row ? row.commercialRevenue : 0); }, 0);
  const owed = api.drugLicenceExpectedByYear(pvs, sure.programs, 25);
  let okRoy = true; for (let cy = 0; cy < 25; cy++) if (Math.abs(owed.royalty[cy] - 0.11 * totalAt(cy)) > 1) okRoy = false;
  ok("Akeso: the royalty is 11% of total ivonescimab sales every year", okRoy);
  const ms = [[1000, 250], [2000, 500], [3000, 750], [5000, 1000], [7500, 1005]];
  const expectMs = new Array(25).fill(0);
  ms.forEach(([t, pay]) => { for (let cy = 0; cy < 25; cy++) if (totalAt(cy) > 0 && totalAt(cy) >= t * 1e6) { expectMs[cy] += pay * 1e6; break; } });
  ok("Akeso: $3.505B of sales milestones, each in the first year total sales reach its level", expectMs.every((v, cy) => Math.abs(v - owed.milestones[cy]) < 1) && Math.abs(owed.milestones.reduce((a, b) => a + b, 0) - 3.505e9) < 1);
  ok("Akeso: the covered programs carry only their own approval milestones", pvs.slice(1).every(v => v.pnl.every((row, i) => row.licensorRoyalty === 0 && (i === 0 || row.licensorMilestones === 0))));

  // The catalyst table and the range of endings on the real case (G&A, tax and
  // 30% read-across in play, so the identities hold to within a cent or so).
  const L = api.computeCatalystLadder(c, 12, c.terminalValue);
  ok("Summit catalysts: five rows, the FDA decision (2026-11-14) first", L.rows.length === 5 && L.rows[0].gate === "FDA decision" && L.rows[0].timing.dateText === "2026-11-14");
  L.rows.forEach(row => near("Summit catalysts: " + row.program + " — weighted back to Base within 1%", row.weighted, r.equity.perShare, r.equity.perShare * 0.01));
  const R = api.computeRangeOfEndings(c, 12, c.terminalValue);
  ok("Summit endings: 2 × 3 × 3 × 3 × 4 = 216 possible, the impossible ones dropped (" + R.count + ")", R.count <= 216 && R.count >= 200);
  R.launchOdds.forEach(o => near("Summit endings: " + o.id.slice(-4) + " keeps its own odds of launch", o.odds, (r.programVals.find(v => v.id === o.id) || {}).posToLaunch, 1e-9));
  near("Summit endings: the mean sits within 0.5% of Base", R.mean, r.equity.perShare, r.equity.perShare * 0.005);

  // Scenarios as the case shows them, resting on the checks above.
  const expectSm = { bear: 5.1324, base: 8.3527, bull: 12.7905 };
  ["bear", "base", "bull"].forEach(k => near("Summit " + k + ": $" + expectSm[k], api.computeCaseValuation(c, api.getEffectiveScenarioPreset(c, k), k, 12, c.terminalValue).equity.perShare, expectSm[k], 5e-5));
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
