// ════════════════════════════════════════════════════════════════════════════
// RxNPV — R&D-TO-LAUNCH ENGINE
// Derives remaining time and cost to launch from a program's current phase,
// using the area-specific duration tables and the per-phase cost
// benchmarks already loaded. Explicit assumption: "current phase" means the
// program is at the START of that phase — its full remaining cost/time is
// still ahead, plus every phase after it.
// ════════════════════════════════════════════════════════════════════════════
const RD_PHASE_ORDER = ["phase1", "phase2", "phase3", "filed", "approved"];

function computeRnDToLaunch(program) {
  const area = program.therapeuticArea;
  const idx = RD_PHASE_ORDER.indexOf(program.currentPhase);
  const items = [];

  if (idx <= 0) {
    items.push({
      key: "phase1", label: "Phase 1",
      years: TRIAL_DURATION_BY_AREA.phase1BaseYears,
      costM: PHASE_COST_BENCHMARKS.phase1,
      yearsSource: TRIAL_DURATION_BY_AREA.source + " — universal base estimate (Phase 1 not modeled by area)",
      costSource: PHASE_COST_BENCHMARKS.source
    });
  }
  if (idx <= 1) {
    const d = getTrialDurationForArea(area, "phase2");
    items.push({
      key: "phase2", label: "Phase 2",
      years: TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase2 + d.value,
      costM: PHASE_COST_BENCHMARKS.phase2,
      yearsSource: d.source + " (clinical) + " + TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase2 + "yr nonclinical",
      costSource: PHASE_COST_BENCHMARKS.source
    });
  }
  if (idx <= 2) {
    const d = getTrialDurationForArea(area, "phase3");
    items.push({
      key: "phase3", label: "Phase 3",
      years: TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase3 + d.value,
      costM: PHASE_COST_BENCHMARKS.phase3,
      yearsSource: d.source + " (clinical) + " + TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase3 + "yr nonclinical",
      costSource: PHASE_COST_BENCHMARKS.source
    });
  }
  if (idx <= 3) {
    const midYears = (REGULATORY_BENCHMARKS.reviewDurationYears[0] + REGULATORY_BENCHMARKS.reviewDurationYears[1]) / 2;
    items.push({
      key: "regulatory", label: "Regulatory review",
      years: midYears, costM: REGULATORY_BENCHMARKS.usFilingFeeM,
      yearsSource: REGULATORY_BENCHMARKS.source + " — midpoint of stated " + REGULATORY_BENCHMARKS.reviewDurationYears.join("-") + "yr range",
      costSource: REGULATORY_BENCHMARKS.source + " — US filing fee only (ex-US ~$" + (REGULATORY_BENCHMARKS.euJapanFilingFeeK/1000).toFixed(1) + "M each, not included)"
    });
  }
  // idx === 4 (approved) → items stays empty, already launched

  const totalYears = items.reduce((s, i) => s + i.years, 0);
  const totalCostM = items.reduce((s, i) => s + i.costM, 0);
  return { items, totalYears, totalCostM };
}

// ── Resolve the launch year offset a program should actually use: an explicit
// user-set value takes priority, otherwise falls back to the R&D-computed
// timeline (respecting any rndOverride). Shared by every consumer so "blank
// means use the computed timeline" behaves identically everywhere, rather
// than each caller reimplementing (or forgetting) the same fallback logic. ──
function resolveLaunchYearOffset(program) {
  // Always rounds to a whole year, regardless of source — every downstream
  // consumer (aggregateCompanyRevenue, computeCompanyPnL,
  // computeCompanyRiskAdjustedCF) indexes directly into annual arrays via
  // `calendarYear - launchYearOffset`, and JS silently returns undefined for
  // a non-integer array index rather than erroring. A fractional override
  // here doesn't fail loudly — it silently zeroes out revenue/cost for every
  // calendar year that lands on a non-integer index, which is exactly the
  // kind of wrong-but-quiet result this app tries hard never to produce.
  // Found via the implied-launch-year solver below, which is the first
  // thing that ever exercised a fractional value here — normal use always
  // types a whole number into this field.
  if (program.launchYearOffset !== "" && program.launchYearOffset != null) return Math.round(Number(program.launchYearOffset));
  const rnd = computeRnDToLaunch(program);
  const rndOv = program.rndOverride || { totalYears: "" };
  return Math.round(rndOv.totalYears !== "" && rndOv.totalYears != null ? Number(rndOv.totalYears) : rnd.totalYears);
}
