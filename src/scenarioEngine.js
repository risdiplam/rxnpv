// ════════════════════════════════════════════════════════════════════════════
// RxNPV — SCENARIO & SENSITIVITY ENGINE
// Bear/Base/Bull apply multipliers to peak market share, PoS, and discount
// rate. Revenue is rescaled exactly (patient counts scale linearly with
// share by construction — this is not an approximation), then costs/PoS/DCF
// are re-run fresh on the rescaled figures so nothing compounds incorrectly.
// ════════════════════════════════════════════════════════════════════════════
// Bear and Bull vary the commercial assumptions and the odds, not the
// discount rate. The rate is the company's cost of capital — market risk —
// and does not change because a drug's prospects look worse; failure is
// already in the odds. Raising it in Bear (it used to add 5 points, and cut
// 2 in Bull) charged the same risk a second time. The field stays for anyone
// who wants it; Sensitivity is the place to test the rate itself.
// (docs/RxNPV_rNPV_Methodology_Review.md §0)
const SCENARIO_PRESETS = {
  bear: { label: "Bear", shareMultiplierPct: 70, posMultiplierPct: 70, discountRateAddPct: 0, color: "var(--red)" },
  base: { label: "Base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "var(--slate)" },
  bull: { label: "Bull", shareMultiplierPct: 130, posMultiplierPct: 130, discountRateAddPct: 0, color: "var(--green)" }
};

// Case-level Base-PoS control: a multiplier on top of whatever posMultiplierPct
// a scenario would otherwise carry, representing an overarching per-case view
// ("I generally trust/distrust this whole pipeline's odds more than the
// benchmarks alone suggest") distinct from both the per-scenario Bear/Bull
// multiplier and the per-program PoS override. Composes multiplicatively with
// both, the same way the per-program override already composes with the
// scenario multiplier in computeProgramValuation. Applied to Bear/Base/Bull
// alike so their existing 70%/100%/130% relationship holds relative to
// whatever the case's own Base rate now is, not just the fixed preset. Shared
// helper (not inlined into getEffectiveScenarioPreset) because a couple of
// callers need to apply it to an ad-hoc scenario object of their own, not one
// resolved through that function.
function applyBasePosAdjustment(scenario, basePosAdjustmentPct) {
  const adj = basePosAdjustmentPct !== "" && basePosAdjustmentPct != null ? Number(basePosAdjustmentPct) / 100 : 1;
  return { ...scenario, posMultiplierPct: scenario.posMultiplierPct * adj };
}

// Resolves a case's actual effective Bear/Base/Bull preset — starts from
// SCENARIO_PRESETS, applies any per-case override from
// theCase.scenarioOverrides for whichever fields are actually set (Bear/Bull
// only — those are relative-to-Base multipliers by design), then applies the
// case-level Base-PoS adjustment above to all three. Extracted here as the
// single source both the Workspace valuation and the Monte Carlo engine call,
// rather than each having its own copy that could drift.
function getEffectiveScenarioPreset(theCase, key) {
  const base = SCENARIO_PRESETS[key];
  if (key === "base") return applyBasePosAdjustment(base, theCase.basePosAdjustmentPct);
  const scenarioOv = theCase.scenarioOverrides || { bear: {}, bull: {} };
  const ov = scenarioOv[key] || {};
  const resolved = {
    ...base,
    shareMultiplierPct: ov.shareMultiplierPct !== "" && ov.shareMultiplierPct != null ? Number(ov.shareMultiplierPct) : base.shareMultiplierPct,
    posMultiplierPct: ov.posMultiplierPct !== "" && ov.posMultiplierPct != null ? Number(ov.posMultiplierPct) : base.posMultiplierPct,
    discountRateAddPct: ov.discountRateAddPct !== "" && ov.discountRateAddPct != null ? Number(ov.discountRateAddPct) : base.discountRateAddPct
  };
  return applyBasePosAdjustment(resolved, theCase.basePosAdjustmentPct);
}

// A scenario share multiplier scales patients linearly, so a Full-mode share
// near the top multiplied by Bull's 130% could claim more than every eligible
// patient (90% x 1.3 = 117%). FIN-012 caps a typed override at 100%; this caps
// the scenario-scaled share the same way, by limiting the multiplier to
// 100 / share. Quick mode has no share (peakShare is null) — there a multiplier
// scales a revenue figure, which has no such ceiling, so it passes unchanged
// (NEW-002, September 2026 audit pass).
function cappedShareMultiplier(revenueResult, multiplier) {
  const share = revenueResult && typeof revenueResult.peakShare === "number" ? revenueResult.peakShare : null;
  if (share == null || share <= 0) return multiplier;
  return Math.min(multiplier, 100 / share);
}

// Exact rescale — patient counts (and thus revenue, since price is unchanged) scale
// linearly with market share by construction, so this is not an approximation.
// The royalty part of each year and the peak commercial revenue scale with
// everything else. They used to be left at Base size, so on a partnered case
// Bear/Bull charged marketing (a share of peak COMMERCIAL revenue) at the
// Base level and computed COGS on "total − unscaled royalty" — Stoke's Bear
// came out $0.19 low and its Bull $0.35 high against an independent rebuild.
function scaleRevenueResult(revenueResult, multiplier) {
  const years = revenueResult.years.map(y => ({
    ...y,
    onDrugPatientsUS: Math.round(y.onDrugPatientsUS * multiplier),
    usRevenue: Math.round(y.usRevenue * multiplier),
    exUSRevenue: Math.round(y.exUSRevenue * multiplier),
    totalRevenue: Math.round(y.totalRevenue * multiplier),
    ...(y.royaltyRevenue != null ? { royaltyRevenue: Math.round(y.royaltyRevenue * multiplier) } : {})
  }));
  return {
    ...revenueResult, years,
    peakPatients: Math.round(revenueResult.peakPatients * multiplier),
    peakUSRevenue: Math.round(revenueResult.peakUSRevenue * multiplier),
    peakTotalRevenue: Math.round(revenueResult.peakTotalRevenue * multiplier),
    ...(revenueResult.peakCommercialRevenue != null ? { peakCommercialRevenue: Math.round(revenueResult.peakCommercialRevenue * multiplier) } : {})
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ── Effective probability of success for one program under one scenario ──
// The benchmark PoS, the per-program override and the scenario multiplier,
// composed exactly once. Everything that risk-adjusts by a program's odds reads
// this: the DCF program valuation, Simple Multiple, the PRV (through
// programVals) and partnership milestones. Milestones used to call
// computePoSWeighting() fresh and got the raw benchmark, so a Bear PoS haircut
// or a 50%-vs-10% override moved every part of the case except the milestone
// value (FIN-002). Returns the launch probability and the rebuilt stage path.
function computeEffectivePoS(program, scenario) {
  const posBase = computePoSWeighting(program);
  // Optional per-program override: lets you say "I think THIS drug's overall
  // odds are X%, not the area/phase benchmark's Y%" — the one major benchmark
  // in the app that wasn't yet editable at the drug level. Composes with the
  // scenario multiplier rather than replacing it: Bear/Bull still scale
  // relative to whatever the effective Base assumption is (override or not),
  // preserving the existing 70%/100%/130% relationship on top of your own view.
  const posOverridePct = program.posOverridePct;
  const overrideMultiplier = (posOverridePct !== "" && posOverridePct != null && posBase.posToLaunch > 0)
    ? (Number(posOverridePct) / 100) / posBase.posToLaunch
    : 1;
  const effectiveMultiplierPct = overrideMultiplier * scenario.posMultiplierPct;
  const posToLaunch = clamp01(posBase.posToLaunch * (effectiveMultiplierPct / 100));
  // Rescale the STAGE TRANSITION probabilities, then rebuild the cumulative
  // reach probabilities from them — rather than scaling the reach
  // probabilities directly.
  //
  // Scaling reach probabilities was wrong in a way that only showed up once
  // modality widened the gap between the benchmark PoS and a typed override:
  // posToReachStage[0] is 1.0 by definition (you have already reached the
  // stage you are currently in), and multiplying it by an override factor of
  // 0.49 claimed a 49% chance of reaching a phase the drug is already sitting
  // in. That understated the probability of paying near-term R&D cost, so two
  // programs with an IDENTICAL typed cumulative PoS could differ ~8% in value
  // purely by modality — the override was not fully in control of the number.
  //
  // Distributing the adjustment evenly across transitions in log space keeps
  // the product on target (k^n x rawCum = target) while leaving the first
  // stage at 1.0.
  //
  // The stages must ALWAYS multiply back to posToLaunch: revenue is weighted
  // by posToLaunch and each stage's R&D by the odds of reaching it, so if the
  // two disagree the model charges costs at one set of odds and books revenue
  // at another. They used to disagree whenever a stage hit the 99% cap — the
  // excess was simply dropped. Every "if it works" run (posOverridePct 100:
  // the outcome tree's launch ending, the forward runway, the unrisked risk
  // waterfall) got stages of 69% x 99% x 99% on PepGen, so Phase 3's $230M was
  // charged at 69% in a world where the drug certainly launches; Stoke's Bull
  // asked for 84.5% and charged costs at 81%. Now a capped stage hands its
  // excess to the stages below the cap, and only a target no set of 99%
  // stages can reach (above 0.99^n — a literal 100% is the usual one) takes
  // every stage past 99%, evenly.
  // program._passedStages (internal, set by the readout scenarios): that many
  // leading stages are already known to have succeeded — they pass for
  // certain and the odds asked for are spread over the stages after them.
  // Without it "value after a positive Phase 2" kept Phase 2 as a pending
  // gate, so Phase 3's cost was weighted at the odds of starting it (~60% on
  // PepGen) in a scenario defined by Phase 2 having worked.
  const passed = Math.max(0, Math.min(posBase.stages.length, Math.floor(Number(program._passedStages) || 0)));
  const posStages = (() => {
    const stages = posBase.stages;
    if (!stages.length) return [];
    const factor = effectiveMultiplierPct / 100;
    if (Math.abs(factor - 1) < 1e-12 && !passed) return stages.map(s => ({ ...s }));
    const target = clamp01(stages.reduce((a, s) => a * s.pos, 1) * Math.max(factor, 0));
    const rest = stages.slice(passed), n = rest.length;
    const CAP = 0.99;
    let pos;
    if (!n) {
      pos = [];
    } else if (target >= Math.pow(CAP, n)) {
      pos = rest.map(() => Math.pow(target, 1 / n));
    } else {
      const restRaw = rest.reduce((a, s) => a * s.pos, 1);
      const prodAt = k => rest.reduce((a, s) => a * Math.min(CAP, s.pos * k), 1);
      let k = restRaw > 0 ? Math.pow(target / restRaw, 1 / n) : 0;
      if (prodAt(k) < target * (1 - 1e-12)) {
        let lo = k, hi = Math.max(k, 1e-9);
        while (prodAt(hi) < target) hi *= 2;
        for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (prodAt(mid) < target) lo = mid; else hi = mid; }
        k = hi;
      }
      pos = rest.map(s => clamp01(Math.min(CAP, s.pos * k)));
    }
    pos = stages.slice(0, passed).map(() => 1).concat(pos);
    let cum = 1;
    return stages.map((s, i) => {
      const reach = cum;
      cum *= pos[i];
      return { ...s, pos: pos[i], posToReachStage: clamp01(reach) };
    });
  })();
  return { posBase, posToLaunch, posStages };
}

// ── Full per-program valuation under a given scenario ──
// scenarioKey ('bear'|'base'|'bull'|null): when set and the program is in Quick
// mode, checks for an absolute peak-revenue override for that scenario — if
// present, it's used directly instead of scaling the base peak revenue by
// shareMultiplierPct, so Bear/Bull can have a genuinely independent peak
// revenue assumption, not just a percentage of Base.
function computeProgramValuation(program, scenario, scenarioKey) {
  const qOverride = scenarioKey && program.quickRevenue && program.quickRevenue.scenarioOverrides
    ? program.quickRevenue.scenarioOverrides[scenarioKey] : null;
  const hasOverride = (program.revenueMode || "quick") !== "full" && qOverride && qOverride.peakRevenue !== "" && qOverride.peakRevenue != null;

  let scaledRevenue;
  if (hasOverride) {
    const overriddenProgram = { ...program, quickRevenue: { ...program.quickRevenue, peakRevenue: qOverride.peakRevenue } };
    scaledRevenue = getProgramRevenueResult(overriddenProgram, 25); // override IS the absolute value — no % scaling on top
  } else {
    const baseRevenue = getProgramRevenueResult(program, 25);
    scaledRevenue = scaleRevenueResult(baseRevenue, cappedShareMultiplier(baseRevenue, scenario.shareMultiplierPct / 100));
  }

  const cs = program.costStructure || { cogsPct: "", reps: {}, marketingPctOfPeak: "" };
  const cogsBench = getCogsBenchmark(program.modality).value;
  const pnl = computeProgramPnL(scaledRevenue, {
    cogsPct: cs.cogsPct !== "" ? cs.cogsPct : cogsBench,
    reps: { primaryCare: cs.reps.primaryCare || 0, specialty: cs.reps.specialty || 0, hospital: cs.reps.hospital || 0 },
    marketingPctOfPeak: cs.marketingPctOfPeak !== "" ? cs.marketingPctOfPeak : MARKETING_BENCHMARKS.baseCasePctOfPeakRevenue,
    yearsToLOE: getRevenueBuild(program).exclusivity.yearsToLOE,
    launchYearOffset: program.launchYearOffset
  });

  const rnd = computeRnDToLaunch(program);
  const rndOv = program.rndOverride || { totalYears: "", totalCostM: "" };
  // If the user overrode total cost/years, scale each stage item proportionally so the
  // breakdown still sums to the override exactly (rather than ignoring the override).
  let rndForRisk = rnd;
  if (rndOv.totalCostM !== "" && rnd.totalCostM > 0) {
    const f = Number(rndOv.totalCostM) / rnd.totalCostM;
    rndForRisk = { ...rnd, items: rnd.items.map(i => ({ ...i, costM: i.costM * f })) };
  }
  if (rndOv.totalYears !== "" && rnd.totalYears > 0) {
    const f = Number(rndOv.totalYears) / rnd.totalYears;
    rndForRisk = { ...rndForRisk, items: rndForRisk.items.map(i => ({ ...i, years: i.years * f })) };
  }
  // Partnership cost-sharing — the % of remaining R&D cost a partner covers
  // instead of the company, applied after the override scaling above so the
  // two compose correctly (an overridden total gets shared, not the other
  // way around). Reduces the cost side only — the partner's own economics
  // (what they get back for funding this) aren't this app's concern.
  const partnership = program.partnership;
  if (partnership && partnership.enabled && partnership.costSharingPct !== "" && partnership.costSharingPct != null) {
    const keepPct = 1 - (Number(partnership.costSharingPct) / 100);
    rndForRisk = { ...rndForRisk, items: rndForRisk.items.map(i => ({ ...i, costM: i.costM * keepPct })) };
  }

  const { posToLaunch, posStages } = computeEffectivePoS(program, scenario);
  const riskAdj = riskAdjustRnDCost(rndForRisk, { stages: posStages, posToLaunch });

  const launchYearOffset = resolveLaunchYearOffset(program);

  return {
    id: program.id, name: program.drugName || program.name,
    launchYearOffset,
    revenueResult: scaledRevenue, pnl, rnd, posToLaunch, riskAdjItems: riskAdj.items,
    // Exposed so the stage-attrition profile the override produces is
    // inspectable (and testable) rather than only visible in its effect on
    // risk-adjusted R&D cost.
    posStages,
    peakRevenue: scaledRevenue.peakTotalRevenue
  };
}

// ── Full case-level valuation under a given scenario ──
// scenarioKey ('bear'|'base'|'bull'|null): resolves both the per-program peak
// revenue override (see computeProgramValuation) and a scenario-specific exit
// multiple override, if either is set on the case/program. Pass null for
// synthetic/one-off scenarios (e.g. sensitivity perturbations) where no
// override resolution should apply.
// ── The case's cash-flow calendar, taxed ──
// One program: expected tax = P(launch) x the tax if it works (taxSuccessWorld).
// Several: the odds-weighted flow is taxed (there is no single success world).
// Used by the valuation and by the SOTP, so the two stay on the same method.
function taxedCaseCalendar(theCase, programVals, corpGA, scenario, scenarioKey) {
  const risked = computeCompanyRiskAdjustedCF(programVals, corpGA, 25);
  const tax = theCase.taxation;
  if (!tax || !tax.enabled) return risked;
  if (theCase.programs.length !== 1 || programVals.length !== 1 || !(programVals[0].posToLaunch < 1)) return applyTaxToCalendar(risked, tax);
  const pv = programVals[0];
  const prog = theCase.programs.find(p => p.id === pv.id) || theCase.programs[0];
  const sure = computeProgramValuation({ ...prog, posOverridePct: "100" }, { ...scenario, posMultiplierPct: 100 }, scenarioKey);
  return taxSuccessWorld(risked, computeCompanyRiskAdjustedCF([sure], corpGA, 25), pv.posToLaunch, tax);
}

function computeCaseValuation(theCase, scenario, scenarioKey, discountRateBasePct, terminalValueParams) {
  const programVals = theCase.programs.map(p => computeProgramValuation(p, scenario, scenarioKey));
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  const calendar = taxedCaseCalendar(theCase, programVals, corpGA, scenario, scenarioKey);
  const discountRate = (discountRateBasePct != null && discountRateBasePct !== "" && !isNaN(Number(discountRateBasePct)) ? Number(discountRateBasePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0]) + scenario.discountRateAddPct;

  const scenOv = (scenarioKey && theCase.scenarioOverrides) ? theCase.scenarioOverrides[scenarioKey] : null;
  const effectiveTVParams = (scenOv && scenOv.exitMultiple !== "" && scenOv.exitMultiple != null)
    ? { ...terminalValueParams, exitMultiple: scenOv.exitMultiple }
    : terminalValueParams;

  const npvResult = computeNPV(calendar.map(c => c.riskAdjFCF), discountRate, effectiveTVParams, calendar.map(c => c.revenue));

  const capStruct = effectiveCapitalStructure(theCase);
  let capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  capResult = applyFutureRaise(capResult, theCase.futureRaise, theCase.currentPrice);
  let equity = computeEquityValue(npvResult.npv, capResult);

  // Priority Review Voucher — tied to a SPECIFIC program's approval (that's
  // literally how PRVs are granted: only upon approval of the qualifying
  // drug), so it's per-program, risk-adjusted by that program's own PoS, and
  // discounted back from that program's own launch year — not a certain,
  // undiscounted windfall. If the drug doesn't get approved, there's no PRV
  // either; this makes that explicit rather than overstating the case.
  const r = discountRate / 100;
  const prvContribution = computePrvContribution(theCase, programVals, r);
  if (prvContribution > 0) {
    const newEquityValue = equity.equityValue + prvContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, prvValueAdded: prvContribution };
  }

  const partnershipContribution = computePartnershipContribution(theCase, r, scenario);
  if (partnershipContribution > 0) {
    const newEquityValue = equity.equityValue + partnershipContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, partnershipValueAdded: partnershipContribution };
  }
  ({ equity, capResult } = applyDilutionPath(theCase, scenario, discountRateBasePct, equity, capResult));

  return { programVals, calendar, discountRateUsed: discountRate, npvResult, capResult, equity };
}

// ── Priority review vouchers, as cash to add on top of equity value ──
// programVals: each program's { id, posToLaunch, launchYearOffset } under the
// scenario being valued — the DCF and Simple Multiple program valuations both
// carry these. `r` is the discount rate as a fraction. Used to live inline in
// computeCaseValuation only, so Simple Multiple (the Napkin preset) silently
// dropped every PRV — the same shape as the partnership bug documented at
// computePartnershipContribution (NEW-001, September 2026 audit pass).
function computePrvContribution(theCase, programVals, r) {
  return programVals.reduce((sum, pv) => {
    const prog = theCase.programs.find(p => p.id === pv.id);
    const prv = prog && prog.prv;
    if (!prv || !prv.enabled) return sum;
    const prvRaw = (numOr(prv.valueM, 0)) * 1e6;
    const riskAdjusted = prvRaw * pv.posToLaunch;
    const discounted = pv.launchYearOffset > 0 ? riskAdjusted / Math.pow(1 + r, pv.launchYearOffset) : riskAdjusted;
    return sum + discounted;
  }, 0);
}

// ── The EV -> equity bridge as line items that sum to the equity value ──
// Each item is what actually moved equity away from enterprise value in this
// result, read from the same capResult/equity the per-share figure came from,
// so the displayed bridge always foots. Shared by the Workspace bridge and the
// report's. Both used to build their own list from cash and debt only, which
// left out two things the engine does count (FIN-011): a convertible note that
// does NOT convert stays a debt claim (capitalStructure's detailed mode
// subtracts its face), and a modelled future raise adds its proceeds to net
// cash. The per-share number was right; the chips did not add up to it.
// sign: +1 adds to equity, -1 subtracts, 0 is the starting value.
function computeEquityBridgeSteps(theCase, result) {
  const cap = effectiveCapitalStructure(theCase);
  const capR = result.capResult || {};
  const steps = [
    { key: "ev", label: "Enterprise Value", value: result.npvResult.npv, sign: 0 },
    { key: "cash", label: cap._spentSinceFiling ? "Cash at the filing" : "Cash", value: cap._spentSinceFiling ? cap._cashFiled : numOr(cap.cash, 0), sign: 1 }
  ];
  if (cap._spentSinceFiling) steps.push({ key: "burnSince", label: "Spent since the filing", value: cap._spentSinceFiling, sign: -1 });
  steps.push({ key: "debt", label: "Debt", value: numOr(cap.debt, 0), sign: -1 });
  const convFace = cap.mode === "simple" ? 0 : numOr(cap.convFace, 0);
  if (convFace > 0 && !capR.convertsInTheMoney) steps.push({ key: "convertible", label: "Convertible notes (not converting)", value: convFace, sign: -1 });
  if (capR._futureRaiseAmount) steps.push({ key: "raise", label: "Modeled future raise", value: capR._futureRaiseAmount, sign: 1 });
  if (capR._dilutionRaisedAmount) steps.push({ key: "dilution", label: "Projected raises (dilution path)", value: capR._dilutionRaisedAmount, sign: 1 });
  const eq = result.equity || {};
  if (eq.prvValueAdded) steps.push({ key: "prv", label: "PRV (risk-adj.)", value: eq.prvValueAdded, sign: 1 });
  if (eq.partnershipValueAdded) steps.push({ key: "partnership", label: "Partnership (upfront + milestones)", value: eq.partnershipValueAdded, sign: 1 });
  return steps;
}

// ── Year-by-year projection rows for the Overview's Projections card ──────
// One row per discounted year of a DCF result, built only from numbers the
// valuation already produced: the calendar's odds-weighted lines, and the
// engine's own per-year present values (npvResult.pvByYear), so the running
// total ends exactly at the explicit NPV and nothing here is a second
// derivation that could drift from the headline. The one added figure is
// revenue "if it works" — each program's unweighted revenue on the same
// calendar — so the chart can show what the odds are taking away.
// Rows stop where the NPV stops (an exit multiple truncates at peak).
// Phase labels need a single program: with several, a year is several
// phases at once, so `phase` is null.
function computeProjectionRows(result, theCase) {
  if (!result || !result.calendar || !result.npvResult || !result.npvResult.pvByYear) return [];
  const r = (result.discountRateUsed || 0) / 100;
  const pvs = result.programVals || [];
  const program = pvs.length === 1 && theCase && theCase.programs && theCase.programs.find(p => p.id === pvs[0].id);
  let phaseOf = null;
  if (program) {
    // The same inputs the revenue engine reads: the launch curve's length is
    // the ramp, and erosion starts in the first program year past yearsToLOE
    // (erosionMultiplier), so the labels cannot disagree with the numbers.
    const L = pvs[0].launchYearOffset || 0;
    const rb = getRevenueBuild(program);
    const quick = (program.revenueMode || "quick") === "quick";
    const q = program.quickRevenue || {};
    const rampLen = quick ? launchCurveForYears(q.yearsToPeak || 6, q.profile || "median").length
      : launchCurveForYears(rb.launchCurve.yearsToPeak, rb.launchCurve.profile).length;
    const loeK = Math.floor(resolveErosionParams(rb.exclusivity).yearsToLOE);
    phaseOf = i => {
      const k = i - L;
      if (k < 0) return "Before launch";
      if (k >= loeK) return "After LOE";
      return k < rampLen ? "Launch ramp" : "Peak years";
    };
    phaseOf.launchIndex = L;
    phaseOf.loeIndex = L + loeK;
  }
  let running = 0;
  return result.npvResult.pvByYear.map((pv, i) => {
    const c = result.calendar[i] || {};
    const revenue = c.revenue || 0;
    const unrisked = pvs.reduce((s, p) => {
      const row = p.pnl && p.pnl[i - (p.launchYearOffset || 0)];
      return s + (row ? row.revenue : 0);
    }, 0);
    const commercial = revenue - (c.riskAdjProductContribution || 0);
    running += pv;
    return {
      index: i,
      phase: phaseOf ? phaseOf(i) : null,
      isLaunch: !!phaseOf && i === phaseOf.launchIndex,
      isLOE: !!phaseOf && i === phaseOf.loeIndex,
      revenueIfWorks: unrisked,
      revenue,
      commercialCosts: commercial,
      rnd: c.riskAdjRnDCost || 0,
      ga: c.corporateGA || 0,
      tax: c.tax || 0,
      fcf: c.riskAdjFCF || 0,
      discountFactor: 1 / Math.pow(1 + r, i + 1),
      pv,
      runningPV: running
    };
  });
}

// ── Break-even peak revenue: fair value at every peak-sales level ──────────
// Re-runs the Base valuation with the peak-share multiplier stepped from 30%
// to 200% of Base, recording the resulting peak revenue and fair value, so the
// curve is the model's own answer at each level — never a line drawn between
// two points. Share is capped at 100% of eligible patients by the revenue
// engine, so past that cap peak revenue stops moving and the repeats are
// dropped. The break-even is where fair value crosses today's price,
// interpolated between the two surrounding runs; null when the price sits
// outside what the curve spans (belowRange / aboveRange say which way).
function computeBreakEvenCurve(theCase, discountRateBasePct, terminalValueParams) {
  const base = getEffectiveScenarioPreset(theCase, "base");
  const peakOf = r => (r.programVals || []).reduce((s, p) => s + (p.peakRevenue || 0), 0);
  const points = [];
  for (let m = 30; m <= 200; m += 10) {
    const r = computeCaseValuation(theCase, { ...base, shareMultiplierPct: base.shareMultiplierPct * m / 100 }, "base", discountRateBasePct, terminalValueParams);
    const peak = peakOf(r);
    if (points.length && Math.abs(peak - points[points.length - 1].peak) < 1) continue;
    points.push({ multiplierPct: m, peak, perShare: r.equity.perShare });
  }
  const at = key => computeCaseValuation(theCase, getEffectiveScenarioPreset(theCase, key), key, discountRateBasePct, terminalValueParams);
  const baseR = at("base");
  const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  let breakEvenPeak = null, belowRange = false, aboveRange = false;
  if (price != null && points.length > 1) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if ((a.perShare - price) * (b.perShare - price) <= 0 && b.perShare !== a.perShare) {
        breakEvenPeak = a.peak + (price - a.perShare) / (b.perShare - a.perShare) * (b.peak - a.peak);
        break;
      }
    }
    if (breakEvenPeak == null) {
      const vals = points.map(p => p.perShare);
      belowRange = price < Math.min(...vals);
      aboveRange = price > Math.max(...vals);
    }
  }
  return { points, price, breakEvenPeak, belowRange, aboveRange,
    basePeak: peakOf(baseR), basePerShare: baseR.equity.perShare, bearPeak: peakOf(at("bear")), bullPeak: peakOf(at("bull")) };
}

// ── Failure floor: roughly what a share is worth if the next readout fails ──
// Built as plain cash arithmetic rather than as a valuation with the odds set
// to zero. Since corporate G&A is weighted by the odds the company is still
// going, a zero-odds run charges only the current stage and a wind-down too,
// and lands near the burn estimate (PepGen: $0.93 against $0.89) — but it
// discounts, counts the modelled raise and any partner payments, and spreads
// costs over the stage calendar. The floor is the simpler, explicit picture a
// reader can check by hand: undiscounted, before any raise, floored at zero
// (cashShort says when the cash runs out first). It is:
//   net cash (cash − debt − a convertible that would not convert)
//   − the company's share of the current stage's cost, to the readout
//   − corporate G&A until the readout
//   − corporate G&A for the wind-down (corporateGA.windDownYears, default 1)
// divided by the shares that would exist at that price (options priced there,
// so out-of-the-money ones drop out), before any new raise and undiscounted
// (the horizon is a year or two). Single-program cases only — with more than
// one program, one failure leaves the others' value standing, and that needs
// a real model rather than this arithmetic. Null for an approved program,
// which has no readout left to fail. Anything the other programs, a partner
// or a sale of the platform might fetch is left out: the floor is cautious.
const FAILURE_WIND_DOWN_YEARS_DEFAULT = 1;
// throughStage (default 0): the stage whose readout fails — later stages add
// their cost and time first (the outcome tree values a rejection at the FDA
// this way, after the Phase 3 has been paid for).
//
// An optional, rougher alternative the user switches on
// (theCase.failureFloor.method === "burn"; off by default): instead of the
// stage's benchmark cost and G&A, the cash the company actually burns until
// the readout — the filing's cash less the monthly burn from the filing date
// to the readout date, less the wind-down. The readout date is the earliest
// dated pending entry in the Calibration Log when there is one, else the
// model's own timeline. It uses the burn the company reports rather than a
// benchmark split, so a trial already mostly paid for is not charged again;
// but it assumes today's burn holds to the readout, which is a guess — hence
// opt-in, and it never touches Bear, Base or Bull.
function computeFailureFloor(theCase, throughStage) {
  if (!theCase || !theCase.programs || theCase.programs.length !== 1) return null;
  const pv = computeProgramValuation(theCase.programs[0], SCENARIO_PRESETS.base, "base");
  const items = (pv.riskAdjItems || []).slice(0, (throughStage || 0) + 1);
  const stage = items[items.length - 1];
  if (!stage || items.length !== (throughStage || 0) + 1) return null;
  const ga = theCase.corporateGA || {};
  const gaYear = (ga.preCommercialAnnualM !== "" && ga.preCommercialAnnualM != null ? Number(ga.preCommercialAnnualM) : SGA_BENCHMARKS.preCommercialGA.medianM) * 1e6;
  const windDownYears = ga.windDownYears !== "" && ga.windDownYears != null && isFinite(Number(ga.windDownYears)) ? Math.max(0, Number(ga.windDownYears)) : FAILURE_WIND_DOWN_YEARS_DEFAULT;
  const years = items.reduce((a, it) => a + it.years, 0);
  const windDown = gaYear * windDownYears;
  const burnPlan = failureFloorBurnPlan(theCase, years, items.slice(1).reduce((a, it) => a + it.years, 0));
  // Burn method: from the filing's own cash and date, so the months since the
  // filing are counted once (never with the rolled-forward cash).
  const cap = burnPlan ? ((theCase && theCase.capitalStructure) || {}) : effectiveCapitalStructure(theCase);
  const trialCost = burnPlan ? 0 : items.reduce((a, it) => a + it.costM, 0) * 1e6;
  const gaToReadout = burnPlan ? 0 : gaYear * years;
  const spend = burnPlan ? burnPlan.burnToReadout : trialCost + gaToReadout;
  const netCashAt = p => computeCapitalStructure({ ...cap, currentPrice: p }).netCash;
  // Shares depend on the price, and the price on the shares: two passes from
  // the basic count settle it (options either are or are not in the money).
  let equity = netCashAt(0) - spend - windDown;
  let shares = computeCapitalStructure({ ...cap, currentPrice: 0 }).dilutedShares;
  for (let k = 0; k < 2; k++) {
    const p = shares > 0 ? Math.max(0, equity / shares) : 0;
    equity = netCashAt(p) - spend - windDown;
    shares = computeCapitalStructure({ ...cap, currentPrice: p }).dilutedShares;
  }
  if (!(shares > 0)) return null;
  return Object.assign({ perShare: Math.max(0, equity / shares), equity, shares, netCash: netCashAt(Math.max(0, equity / shares)), trialCost, gaToReadout, windDown, windDownYears, readoutYears: years, stageLabel: stage.label, cashShort: equity < 0,
    method: burnPlan ? "burn" : "stage", burnMissing: failureFloorWantsBurn(theCase) && !burnPlan }, burnPlan || {});
}
// What "the price implies X%" holds fixed (October 2026): the reverse-solve
// moves only the odds, so the figure means nothing without the inputs it
// held still. Single program; null otherwise.
function impliedHeldFixed(theCase) {
  if (!theCase || !theCase.programs || theCase.programs.length !== 1) return null;
  const p = theCase.programs[0];
  const items = [];
  try {
    const peak = getProgramRevenueResult(p, 25).peakTotalRevenue;
    if (peak > 0) items.push("Base peak revenue " + fmtMoney(peak) + ((p.revenueMode || "quick") === "full" ? " (the full build)" : " (Napkin)"));
  } catch (e) { /* no revenue yet */ }
  try { items.push("launch in year " + resolveLaunchYearOffset(p)); } catch (e) { /* no timeline */ }
  const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
  items.push(dr + "% discount rate");
  const cs = computeCapitalStructure({ ...effectiveCapitalStructure(theCase), currentPrice: theCase.currentPrice });
  items.push("net cash " + fmtMoney(cs.netCash));
  if (cs.dilutedShares > 0) items.push((cs.dilutedShares / 1e6).toFixed(1) + "M diluted shares");
  const fr = theCase.futureRaise || {};
  if (fr.enabled) items.push("the modelled raise");
  if ((theCase.dilutionPath || {}).enabled) items.push("the dilution path");
  items.push((theCase.terminalValue || {}).enabled ? "a terminal value" : "no terminal value");
  return items;
}

// Both definitions of "if it fails", side by side (October 2026): the
// stage-cost floor (the default) and the rough burn floor, with which one
// the failure figures use. The swing between them was invisible unless the
// switch was opened. burn is null when there is no monthly burn to use.
function computeFailureFloorPair(theCase) {
  if (!theCase || !theCase.programs || theCase.programs.length !== 1) return null;
  const ff = theCase.failureFloor || {};
  const stage = computeFailureFloor({ ...theCase, failureFloor: { ...ff, method: "stage" } });
  if (!stage) return null;
  const burnRun = computeFailureFloor({ ...theCase, failureFloor: { ...ff, method: "burn" } });
  const burn = burnRun && burnRun.method === "burn" ? burnRun : null;
  return { stage, burn, active: failureFloorWantsBurn(theCase) && burn ? "burn" : "stage" };
}
// Why a floor reads $0, in words — a bare $0 reads as "worthless" rather
// than "this definition spends more than the cash". Null when it is above 0.
function floorZeroReason(f) {
  if (!f || f.perShare > 0) return null;
  const wind = f.windDown > 0 ? fmtMoney(f.windDown) + " of wind-down" : null;
  if (f.method === "burn") return andList([fmtMoney(f.burnToReadout) + " of burn over " + f.monthsToReadout.toFixed(1) + " months to the readout", wind].filter(Boolean)) + " use up the " + fmtMoney(f.netCash) + " of net cash";
  return andList([fmtMoney(f.trialCost) + " still to pay for " + f.stageLabel, fmtMoney(f.gaToReadout) + " of G&A to the readout", wind].filter(Boolean)) + " use up the " + fmtMoney(f.netCash) + " of net cash";
}
function failureFloorWantsBurn(theCase) {
  return !!(theCase && theCase.failureFloor && theCase.failureFloor.method === "burn");
}
// The burn method's inputs, or null when it is off or cannot run (no burn).
// laterYears: the model's years from the first readout to this one, for the
// outcome tree's later gates.
function failureFloorBurnPlan(theCase, modelYears, laterYears) {
  if (!failureFloorWantsBurn(theCase)) return null;
  const cap = theCase.capitalStructure || {};
  const burn = numOr(cap.monthlyBurn, 0);
  if (!(burn > 0)) return null;
  const DAY = 86400000, MONTH = DAY * 365.25 / 12;
  const now = new Date();
  const today = parseIsoDay(theCase.valuationDate) != null ? parseIsoDay(theCase.valuationDate) : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const cashDate = parseIsoDay(cap.cashAsOf) != null ? parseIsoDay(cap.cashAsOf) : today;
  // The next readout: the pinned catalyst if there is one, else the earliest
  // pending dated Calibration Log entry still to come — burned to the END of
  // its window ("2026-11" is the end of November, "H1 2027" 30 June 2027).
  const todayDate = new Date(new Date(today).getUTCFullYear(), new Date(today).getUTCMonth(), new Date(today).getUTCDate());
  const nc = nextCaseCatalyst(theCase, todayDate, [theCase.programs[0]]);
  const logged = nc ? { t: Date.UTC(nc.window.end.getFullYear(), nc.window.end.getMonth(), nc.window.end.getDate()), label: nc.entry.catalystLabel || "the logged catalyst", date: nc.entry.catalystDate, pinned: nc.pinned } : null;
  const readout = logged ? logged.t + laterYears * 12 * MONTH : today + modelYears * 12 * MONTH;
  const months = Math.max(0, (readout - cashDate) / MONTH);
  return { burnToReadout: burn * months, monthsToReadout: months, monthlyBurn: burn,
    readoutSource: logged ? (laterYears > 0 ? (logged.pinned ? "the pinned " : "the Calibration Log's ") + logged.date + " plus the model's later stages" : (logged.pinned ? "the pinned catalyst (" : "the Calibration Log (") + logged.date + (/^\d{4}-\d{2}-\d{2}$/.test(logged.date) ? ")" : ", to the end of that window)")) : "the model's timeline" };
}

// ── Outcome tree: how the remaining catalysts play out ─────────────────────
// One gate per remaining development stage (a readout at the end of each
// trial, then the FDA's decision), each with the case's own odds of passing:
// the chance of reaching the next stage over the chance of reaching this one,
// and at the last gate the odds of launch over the odds of filing — so the
// branches multiply back exactly to the Base PoS. Every ending is valued by
// the model: success at literal 100% odds on Base inputs (the range strip's
// "if it works"), each failure with computeFailureFloor after the stages paid
// for so far. The weighted sum is shown beside the model's Base, which it
// should sit near but not equal: the tree values each ending as it stands,
// the DCF charges costs year by year at the odds of reaching them.
// Single-program, not yet approved.
function computeOutcomeTree(theCase, discountRateBasePct, terminalValueParams) {
  if (!theCase || !theCase.programs || theCase.programs.length !== 1) return null;
  const program = theCase.programs[0];
  const pv = computeProgramValuation(program, getEffectiveScenarioPreset(theCase, "base"), "base");
  const items = pv.riskAdjItems || [];
  if (!items.length || !(pv.posToLaunch > 0)) return null;
  const success = computeCaseValuation({ ...theCase, programs: [{ ...program, posOverridePct: "100" }] }, SCENARIO_PRESETS.base, "base", discountRateBasePct, terminalValueParams).equity.perShare;
  let cum = 0;
  const gates = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const reach = it.posToReachStage != null ? it.posToReachStage : 1;
    const next = i + 1 < items.length ? (items[i + 1].posToReachStage != null ? items[i + 1].posToReachStage : 1) : pv.posToLaunch;
    const pass = reach > 0 ? Math.min(1, next / reach) : 0;
    cum += it.years;
    const fl = computeFailureFloor(theCase, i);
    if (!fl) return null;
    const regulatory = it.key === "regulatory";
    gates.push({ key: it.key, label: regulatory ? "FDA decision" : it.label + " readout", passWord: regulatory ? "approved" : "positive", failWord: regulatory ? "not approved" : "negative",
      endYears: cum, reach, pass, failProb: reach * (1 - pass), failValue: fl.perShare, failDetail: fl });
  }
  // Optional resubmission branch (theCase.outcomeTree.resubmitFixPct, blank
  // or 0 = off): that share of FDA rejections is fixed and approved a year
  // later, valued as the success case with launch pushed back a year. It
  // moves probability out of the rejection ending; the gates' odds (and so
  // the case's own PoS) are untouched — the branch is a view on what a
  // rejection means, not a second opinion on the odds.
  let late = null;
  const last = gates[gates.length - 1];
  const fixPct = Number(((theCase.outcomeTree || {}).resubmitFixPct) || 0);
  if (last && last.key === "regulatory" && fixPct > 0) {
    const fix = Math.min(100, fixPct) / 100;
    const offset = resolveLaunchYearOffset(program);
    const value = computeCaseValuation({ ...theCase, programs: [{ ...program, posOverridePct: "100", launchYearOffset: String(offset + 1) }] }, SCENARIO_PRESETS.base, "base", discountRateBasePct, terminalValueParams).equity.perShare;
    late = { prob: last.failProb * fix, value, fixPct: fix * 100 };
  }
  const leaves = [{ kind: "success", prob: pv.posToLaunch, value: success }]
    .concat(late ? [{ kind: "late", prob: late.prob, value: late.value }] : [])
    .concat(gates.map((g, i) => ({ kind: "fail", gate: i, prob: late && i === gates.length - 1 ? g.failProb - late.prob : g.failProb, value: g.failValue })));
  const weighted = leaves.reduce((a, l) => a + l.prob * l.value, 0);
  return { gates, leaves, success, late, weighted, posToLaunch: pv.posToLaunch };
}

// ── Before the next readout: what each result would do to the value ────────
// Three results for the next gate in the outcome tree — a clear win, a modest
// win, a miss — each run through the model "as if already known": the
// program's odds of launch set to what they would be after that result, its
// peak share scaled, everything else at Base. The chance of a positive readout
// is the case's own (the tree's first gate); how wins split between clear and
// modest is the user's call. Defaults, all editable (theCase.readoutScenarios):
//   modest win — odds of launch after a positive readout, from the case itself
//                (posToLaunch / pass at this gate), 75% of Base share;
//   clear win  — 40% of the way from those odds to certainty, 115% of share;
//   clear share of wins — 60%.
// A miss is the failure floor. Single-program; null when there is no readout.
const READOUT_DEFAULTS = { clearSharePct: 115, modestSharePct: 75, clearOfWinsPct: 60, clearLiftToward100: 0.4 };
function computeReadoutScenarios(theCase, discountRateBasePct, terminalValueParams) {
  const tree = computeOutcomeTree(theCase, discountRateBasePct, terminalValueParams);
  if (!tree || !tree.gates.length) return null;
  const g = tree.gates[0];
  const s = theCase.readoutScenarios || {};
  const num = (v, d) => v !== "" && v != null && isFinite(Number(v)) ? Number(v) : d;
  const conditional = g.pass > 0 ? Math.min(100, tree.posToLaunch / g.pass * 100) : 0;
  const defaults = { clearPosPct: conditional + (100 - conditional) * READOUT_DEFAULTS.clearLiftToward100, modestPosPct: conditional };
  const set = {
    clearPosPct: Math.max(0, Math.min(100, num(s.clearPosPct, defaults.clearPosPct))),
    clearSharePct: Math.max(0, num(s.clearSharePct, READOUT_DEFAULTS.clearSharePct)),
    modestPosPct: Math.max(0, Math.min(100, num(s.modestPosPct, defaults.modestPosPct))),
    modestSharePct: Math.max(0, num(s.modestSharePct, READOUT_DEFAULTS.modestSharePct)),
    clearOfWinsPct: Math.max(0, Math.min(100, num(s.clearOfWinsPct, READOUT_DEFAULTS.clearOfWinsPct)))
  };
  const program = theCase.programs[0];
  // The readout is known to have gone well, so its gate is passed
  // (_passedStages: 1) and posPct is the odds of the stages after it.
  const valueAt = (posPct, sharePct) => computeCaseValuation({ ...theCase, programs: [{ ...program, posOverridePct: String(posPct), _passedStages: 1 }] },
    { ...SCENARIO_PRESETS.base, shareMultiplierPct: sharePct }, "base", discountRateBasePct, terminalValueParams).equity.perShare;
  const pWin = g.pass, clearOf = set.clearOfWinsPct / 100;
  const rows = [
    { key: "clear", posPct: set.clearPosPct, sharePct: set.clearSharePct, prob: pWin * clearOf, value: valueAt(set.clearPosPct, set.clearSharePct) },
    { key: "modest", posPct: set.modestPosPct, sharePct: set.modestSharePct, prob: pWin * (1 - clearOf), value: valueAt(set.modestPosPct, set.modestSharePct) },
    { key: "miss", posPct: null, sharePct: null, prob: 1 - pWin, value: g.failValue }
  ];
  return { gate: g, conditionalPosPct: conditional, defaults, settings: set, rows, weighted: rows.reduce((a, r) => a + r.prob * r.value, 0) };
}

// ── Partnership economics — upfront and milestones, as a cash figure to add
// on top of a computed equity value. Upfront is added directly (near-certain /
// already-contracted, so not PoS-risked and not discounted — same treatment as
// cash). Each milestone is risk-adjusted by the cumulative probability of
// REACHING its own gate (mirroring how R&D cost itself is weighted, not
// completing the gate) and discounted from that gate's own expected timing
// rather than lumped in at launch, so an earlier milestone is worth more than
// a later one at the same face value. Royalty revenue is deliberately NOT
// handled here — it is already inside the revenue line via
// getProgramRevenueResult's own substitution, and adding it again would
// double-count it.
//
// This lives in its own function because it used to be inline in
// computeCaseValuation, which meant the Simple Multiple valuation method never
// ran it at all: a case with a $100M upfront and a $70M risk-adjusted
// milestone package showed ~$170M less under Simple Multiple than under DCF
// for identical deal terms, silently, because both call sites read the result
// defensively as `partnershipValueAdded || 0`. `r` is the discount rate as a
// fraction, not a percentage.
function computePartnershipContribution(theCase, r, scenario) {
  let upfrontContribution = 0, milestoneContribution = 0;
  (theCase.programs || []).forEach(prog => {
    const partnership = prog.partnership;
    if (!partnership || !partnership.enabled) return;
    upfrontContribution += (numOr(partnership.upfrontM, 0)) * 1e6;
    if (!partnership.milestones || !partnership.milestones.length) return;
    // The same effective odds the program itself is valued at — override-aware
    // and scenario-scaled — so a milestone moves with Bear/Bull and with a
    // typed PoS exactly as the asset does. A missing scenario means Base (100%).
    const eff = computeEffectivePoS(prog, scenario || { posMultiplierPct: 100 });
    // Timing comes from the case's own calendar, the one its R&D costs,
    // revenue and PRV run on: a launch milestone is paid in the launch year,
    // a stage milestone when that stage starts on the override-scaled (and,
    // like distributeRnDCostByYear, squeezed-to-fit) stage timeline. It used
    // to read the raw benchmark timeline, so Stoke's approval milestone was
    // discounted over 4.35 years for a launch the case puts in year 1 —
    // $18M (~$0.22 a share) understated.
    const rndFull = computeRnDToLaunch(prog);
    const launchYear = resolveLaunchYearOffset(prog);
    const rndOv = prog.rndOverride || {};
    const scale = rndOv.totalYears !== "" && rndOv.totalYears != null && rndFull.totalYears > 0 ? Number(rndOv.totalYears) / rndFull.totalYears : 1;
    const window = Math.max(1, launchYear);
    const squeeze = rndFull.totalYears * scale > window ? window / (rndFull.totalYears * scale) : 1;
    let cumYears = 0;
    const yearsToReachStage = {};
    rndFull.items.forEach(item => { yearsToReachStage[item.key] = cumYears * scale * squeeze; cumYears += item.years; });
    partnership.milestones.forEach(m => {
      const valueM = numOr(m.valueM, 0);
      if (valueM <= 0) return;
      let posToGate, yearsToGate;
      if (m.gate === "launch") {
        posToGate = eff.posToLaunch;
        yearsToGate = launchYear;
      } else {
        const stage = eff.posStages.find(s => s.key === m.gate);
        posToGate = stage ? stage.posToReachStage : 1; // gate already behind current phase -> certain
        yearsToGate = yearsToReachStage[m.gate] != null ? yearsToReachStage[m.gate] : 0;
      }
      const riskAdjusted = (valueM * 1e6) * posToGate;
      const discounted = yearsToGate > 0 ? riskAdjusted / Math.pow(1 + r, yearsToGate) : riskAdjusted;
      milestoneContribution += discounted;
    });
  });
  return upfrontContribution + milestoneContribution;
}

// ── Sum-of-the-Parts breakdown: each program's OWN standalone PV contribution,
// plus company-level G&A shown as a separate drag — for multi-program cases,
// shows which program is actually driving total value. Reuses the exact same
// tested pipeline as the main valuation (each program run through
// computeCompanyRiskAdjustedCF alone, with zero G&A, then discounted) rather
// than new math, so results are guaranteed consistent with the combined total.
function computeSOTPBreakdown(theCase, scenario, scenarioKey, discountRateBasePct, terminalValueParams) {
  const discountRate = (discountRateBasePct != null && discountRateBasePct !== "" && !isNaN(Number(discountRateBasePct)) ? Number(discountRateBasePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0]) + scenario.discountRateAddPct;
  const zeroGA = { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" };

  const programBreakdown = theCase.programs.map(p => {
    const pv = computeProgramValuation(p, scenario, scenarioKey);
    // Taxed per program so the parts stay in the same (after-tax) units as the
    // headline. Each program accumulates its own NOL shield, whereas real NOLs
    // pool company-wide — so with tax on, the parts are a slightly
    // conservative decomposition rather than an exact split of the whole.
    const calendar = taxedCaseCalendar(theCase, [pv], zeroGA, scenario, scenarioKey);
    const scenOv = (scenarioKey && theCase.scenarioOverrides) ? theCase.scenarioOverrides[scenarioKey] : null;
    const effectiveTVParams = (scenOv && scenOv.exitMultiple !== "" && scenOv.exitMultiple != null)
      ? { ...terminalValueParams, exitMultiple: scenOv.exitMultiple } : terminalValueParams;
    const npv = computeNPV(calendar.map(c => c.riskAdjFCF), discountRate, effectiveTVParams, calendar.map(c => c.revenue));
    return { id: p.id, name: p.drugName || p.name, npv: npv.npv, peakRevenue: pv.peakRevenue, posToLaunch: pv.posToLaunch };
  });

  // Company-level G&A drag, discounted on its own (negative contribution).
  //
  // This used to subtract the RAW, pre-tax G&A figure while every program's
  // NPV above was computed after-tax — so with tax modelling on, G&A got no
  // tax shield in the parts even though it gets one in the combined
  // valuation, and the two stopped reconciling by roughly taxRate x G&A every
  // year. Taking the difference between the taxed calendar WITH G&A and the
  // taxed calendar WITHOUT it yields G&A's true marginal after-tax cost, and
  // gets NOLs and zero-tax years right for free by reusing the same
  // applyTaxToCalendar machinery rather than re-deriving an effective rate.
  // With taxation off this is identical to the old behaviour.
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  const allProgramVals = theCase.programs.map(p => computeProgramValuation(p, scenario, scenarioKey));
  const withGA = taxedCaseCalendar(theCase, allProgramVals, corpGA, scenario, scenarioKey);
  const withoutGA = taxedCaseCalendar(theCase, allProgramVals, zeroGA, scenario, scenarioKey);
  const gaOnlyCF = withGA.map((c, i) => c.riskAdjFCF - (withoutGA[i] ? withoutGA[i].riskAdjFCF : 0));
  const gaNPV = computeNPV(gaOnlyCF, discountRate, { enabled: false }, withGA.map(() => 0));

  const sumOfParts = programBreakdown.reduce((s, p) => s + p.npv, 0) + gaNPV.npv;
  return { programBreakdown, gaDrag: gaNPV.npv, sumOfParts };
}

// ── Per-asset risk waterfall: unrisked value (as if success were certain) vs
// the actual risk-adjusted rNPV, so the size of the risk discount is legible
// on its own rather than buried inside one final number. "Unrisked" is
// computed by forcing this program's effective PoS to 100% via the same
// posOverridePct composition mechanism used for a real per-drug override —
// this correctly un-risk-adjusts BOTH revenue and R&D cost together (if
// success were certain, the full R&D spend would also definitely happen,
// not a probability-weighted portion of it), which is what "Value if
// success" means in the source material's own rNPV framing, not just
// zeroing out the revenue-side discount alone.
function computeProgramRiskWaterfall(program, scenario, scenarioKey, discountRateBasePct, terminalValueParams) {
  const discountRate = (discountRateBasePct != null && discountRateBasePct !== "" && !isNaN(Number(discountRateBasePct)) ? Number(discountRateBasePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0]) + scenario.discountRateAddPct;
  const zeroGA = { preCommercialAnnualM: "0", gaShareOfMatureSgaPct: "0" };

  const npvFor = (prog, scen) => {
    const pv = computeProgramValuation(prog, scen, scenarioKey);
    const calendar = computeCompanyRiskAdjustedCF([pv], zeroGA, 25);
    const npv = computeNPV(calendar.map(c => c.riskAdjFCF), discountRate, terminalValueParams, calendar.map(c => c.revenue));
    return { npv: npv.npv, posToLaunch: pv.posToLaunch };
  };

  const risked = npvFor(program, scenario);
  const unriskedProgram = { ...program, posOverridePct: "100" };
  // "Unrisked" must mean literally 100% PoS regardless of what posMultiplierPct
  // the caller's scenario carries (a case-level Base-PoS adjustment, an
  // already-scaled Bear/Bull, whatever) — forcing it here rather than relying
  // on the caller to pass in an already-neutral scenario.
  const unrisked = npvFor(unriskedProgram, { ...scenario, posMultiplierPct: 100 });

  return {
    unriskedNPV: unrisked.npv,
    riskedNPV: risked.npv,
    riskDiscount: unrisked.npv - risked.npv,
    posToLaunch: risked.posToLaunch
  };
}

// ── Simple Multiple valuation — a genuinely different, faster method, not a
// lesser version of the DCF. This is the RxNPV-style approach: peak
// revenue × a comp-derived multiple, risk-adjusted by PoS and discounted
// back from the peak-revenue year, using the SAME discounting convention as
// the DCF's own exit-multiple terminal value. What it deliberately skips:
// year-by-year cash flow buildup, cost structure (COGS/SG&A/marketing), and
// R&D-to-launch cost modeling — the things that make the DCF slow to fill in
// but don't change a peak-revenue-times-multiple answer. What it does NOT
// skip: PoS risk-adjustment and time discounting, because a real comp
// multiple already trades on risked, present-value terms — dropping those
// would make this a genuinely different (and wrong) kind of number, not
// just a faster one.
function computeSimpleMultipleValuation(theCase, scenario, scenarioKey, multiple, discountRateBasePct) {
  const discountRate = (discountRateBasePct != null && discountRateBasePct !== "" && !isNaN(Number(discountRateBasePct)) ? Number(discountRateBasePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0]) + scenario.discountRateAddPct;
  const r = discountRate / 100;

  const programVals = theCase.programs.map(p => {
    const qOverride = scenarioKey && p.quickRevenue && p.quickRevenue.scenarioOverrides ? p.quickRevenue.scenarioOverrides[scenarioKey] : null;
    const hasOverride = (p.revenueMode || "quick") !== "full" && qOverride && qOverride.peakRevenue !== "" && qOverride.peakRevenue != null;
    let peakRevenue;
    if (hasOverride) {
      const overriddenProgram = { ...p, quickRevenue: { ...p.quickRevenue, peakRevenue: qOverride.peakRevenue } };
      peakRevenue = getProgramRevenueResult(overriddenProgram, 25).peakTotalRevenue;
    } else {
      const baseRev = getProgramRevenueResult(p, 25);
      peakRevenue = baseRev.peakTotalRevenue * cappedShareMultiplier(baseRev, scenario.shareMultiplierPct / 100);
    }

    const yearsToPeakFromLaunch = (p.revenueMode || "quick") === "full"
      ? numOr(getRevenueBuild(p).launchCurve.yearsToPeak, 6) : numOr((p.quickRevenue || {}).yearsToPeak, 6);
    const launchYearOffset = resolveLaunchYearOffset(p);
    const yearsToPeakFromToday = launchYearOffset + yearsToPeakFromLaunch;

    const posToLaunch = computeEffectivePoS(p, scenario).posToLaunch;

    const peakEV = peakRevenue * multiple;
    const riskedEV = peakEV * posToLaunch;
    const pv = riskedEV / Math.pow(1 + r, yearsToPeakFromToday);

    return { id: p.id, name: p.drugName || p.name, peakRevenue, posToLaunch, pv, launchYearOffset, peakEV, riskedEV };
  });

  const npv = programVals.reduce((s, pv) => s + pv.pv, 0);
  const capStruct = effectiveCapitalStructure(theCase);
  let capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  capResult = applyFutureRaise(capResult, theCase.futureRaise, theCase.currentPrice);
  let equity = computeEquityValue(npv, capResult);

  // A PRV is granted on approval whichever method values the asset (NEW-001).
  const prvContribution = computePrvContribution(theCase, programVals, r);
  if (prvContribution > 0) {
    const newEquityValue = equity.equityValue + prvContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, prvValueAdded: prvContribution };
  }

  // Upfront and milestone cash is real regardless of which valuation method
  // values the underlying asset, and used to be dropped entirely here — see
  // computePartnershipContribution. Royalty is already inside peakRevenue via
  // getProgramRevenueResult, so it is not added again.
  const partnershipContribution = computePartnershipContribution(theCase, r, scenario);
  if (partnershipContribution > 0) {
    const newEquityValue = equity.equityValue + partnershipContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, partnershipValueAdded: partnershipContribution };
  }
  ({ equity, capResult } = applyDilutionPath(theCase, scenario, discountRateBasePct, equity, capResult));

  // Shape matches computeCaseValuation's return where a field has a real
  // equivalent (equity, capResult, programVals with peakRevenue) so existing
  // UI (scenario cards, EV bridge, the implied-multiple note) works
  // unmodified. `calendar` has no equivalent here — there's no year-by-year
  // cash flow to show — so callers that need it must guard its absence.
  return { programVals, npvResult: { npv }, capResult, equity };
}

// Projected raises on top of the valued equity: their expected cash and
// their expected shares together (see computeDilutionPath). Applied after the
// PRV and partnership value so a "fair value" raise price is the full value
// per share, which leaves value per share exactly unchanged.
function applyDilutionPath(theCase, scenario, discountRateBasePct, equity, capResult) {
  const dp = computeDilutionPath(theCase, scenario, discountRateBasePct, { fairPrice: equity.perShare });
  if (!dp.enabled) return { equity, capResult };
  const cash = dp.expectedCashRaised || 0;
  const newShares = dp.finalDilutedShares;
  const equityValue = equity.equityValue + cash;
  return {
    equity: { ...equity, equityValue, dilutedShares: newShares, perShare: newShares > 0 ? equityValue / newShares : null, dilutionRaisedValue: cash },
    capResult: { ...capResult, dilutedShares: newShares, _dilutionRaisedAmount: cash }
  };
}

// ── Implied PoS: given the case's current price, solve backwards for what
// probability-of-success multiplier the market must be pricing in — the
// inverse of the normal forward direction (assumptions -> fair value).
// Unlike RxNPV's version (a closed-form formula for a simple peak-sales x
// multiple model), this DCF has no closed form once R&D costs, cost
// structure, and multi-year ramps are involved, so it's a numerical solve:
// binary search over posMultiplierPct until computed equity value matches
// the market-implied equity value (current price x diluted shares).
// Monotonicity (higher PoS multiplier -> higher equity value) holds in
// practice because post-launch revenue is weighted by the FULL cumulative
// PoS while pre-launch R&D costs are only weighted by the probability of
// REACHING each earlier stage — revenue is more sensitive to the multiplier
// than costs are, so equity value increases with it across realistic ranges.
function solveImpliedPoSMultiplier(theCase, discountRateBasePct, terminalValueParams) {
  if (!theCase.currentPrice || Number(theCase.currentPrice) <= 0) return { ok: false, error: "Set a current price first." };
  const capStruct = effectiveCapitalStructure(theCase);
  const capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  if (!capResult.dilutedShares || capResult.dilutedShares <= 0) return { ok: false, error: "Set diluted shares first." };

  // "What the price implies" means the value at which THIS case's fair value
  // per share equals the price, so it solves on the same per-share figure the
  // headline shows — including a modelled future raise. It used to drop the
  // raise and compare equity with today's market cap, which is the same answer
  // when the raise is priced at today's price but not when it is at a
  // discount: PepGen's $100M at $1.99 gave an implied PoS of 22.5%, and typing
  // 22.5% into the case then showed a fair value of $2.19 against a $2.34
  // price, while the break-even chart beside it (which keeps the raise) asked
  // for more peak revenue than the implied share did.
  const targetEquityValue = Number(theCase.currentPrice);

  const equityAt = (posMultiplierPct) => {
    const scenario = { label: "implied", shareMultiplierPct: 100, posMultiplierPct, discountRateAddPct: 0, color: "" };
    const r = computeCaseValuation(theCase, scenario, null, discountRateBasePct, terminalValueParams);
    return r.equity.perShare;
  };

  const atZero = equityAt(0);
  if (atZero >= targetEquityValue) {
    return { ok: true, degenerate: "belowCash", multiplierPct: 0, note: "Even at 0% PoS, fair value already meets or exceeds the current price — cash/PRV alone may account for most of the market cap, or the market may be pricing in something this model doesn't capture." };
  }
  const HIGH = 500;
  const atHigh = equityAt(HIGH);
  if (atHigh < targetEquityValue) {
    return { ok: true, degenerate: "aboveRange", multiplierPct: HIGH, note: "Even at 5x your assumed PoS, fair value doesn't reach the current price — the market may be pricing in upside beyond this model's assumptions (e.g. pipeline optionality, M&A speculation)." };
  }

  let lo = 0, hi = HIGH;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (equityAt(mid) < targetEquityValue) lo = mid; else hi = mid;
  }
  const impliedMultiplierPct = (lo + hi) / 2;

  // For a single-program case, also express as an absolute probability (not
  // just a multiplier) since there's one unambiguous base PoS to scale.
  let impliedAbsolutePct = null, baseAbsolutePct = null;
  // The multiplier above is relative to the EFFECTIVE PoS — computeCaseValuation
  // composes the program's override with it — so the absolute figure must be
  // too. It used to be the raw benchmark, so a case with a 30% override and a
  // 9% benchmark reported "your assumption 9%" and an implied PoS a third of
  // what the price actually implies (FIN-007).
  if (theCase.programs.length === 1) {
    const posInfo = computeEffectivePoS(theCase.programs[0], { posMultiplierPct: 100 });
    baseAbsolutePct = posInfo.posToLaunch * 100;
    impliedAbsolutePct = Math.min(100, baseAbsolutePct * (impliedMultiplierPct / 100));
  }

  return { ok: true, multiplierPct: impliedMultiplierPct, baseAbsolutePct, impliedAbsolutePct };
}

// ── Reverse-solve beyond PoS — the same binary-search pattern as
// solveImpliedPoSMultiplier above, generalized to a different dial. Each
// variable only makes sense in the context it's actually a free input:
// peak revenue is only a direct input in Quick mode; peak share override
// is only a direct input in Full mode; launch year applies to either.
// Single-program cases only, matching the existing solver's own precedent
// for its absolute-PoS expression — with multiple programs there's no one
// unambiguous "the" peak revenue or launch year to solve for.
//
// Monotonicity: peak revenue and peak share both scale revenue directly, so
// higher -> higher equity value, unambiguously. Launch year is assumed
// monotonic decreasing (sooner launch -> higher value) on the same practical
// reasoning the PoS solver already relies on — discounted revenue is more
// sensitive to timing than the discounted cost of getting there is, across
// realistic ranges — not a mathematical guarantee for every conceivable input.
function solveImpliedVariable(theCase, discountRateBasePct, terminalValueParams, variable) {
  if (!theCase.currentPrice || Number(theCase.currentPrice) <= 0) return { ok: false, error: "Set a current price first." };
  if (!theCase.programs || theCase.programs.length !== 1) return { ok: false, error: "Only meaningful for a single-program case — with more than one program there's no single unambiguous value to solve for." };
  const program = theCase.programs[0];

  const capStruct = effectiveCapitalStructure(theCase);
  const capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  if (!capResult.dilutedShares || capResult.dilutedShares <= 0) return { ok: false, error: "Set diluted shares first." };
  // Per share against the price, raise included — see solveImpliedPoSMultiplier.
  const targetEquityValue = Number(theCase.currentPrice);

  const equityAtCase = (caseForSolve) => {
    const scenario = { label: "implied", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
    return computeCaseValuation(caseForSolve, scenario, null, discountRateBasePct, terminalValueParams).equity.perShare;
  };

  // Launch year is handled separately from the two continuous variables
  // below — every downstream cash-flow calendar buckets by whole calendar
  // year, so a fractional launch year gets rounded before it's ever used
  // (see resolveLaunchYearOffset). A continuous binary search over a value
  // that's actually a step function can converge to a technically-correct
  // but misleadingly precise-looking fractional answer; a direct integer
  // scan reports what the model can actually support — a whole year.
  if (variable === "launchYear") {
    const currentValue = resolveLaunchYearOffset(program);
    const equityAt = (v) => equityAtCase({ ...theCase, programs: [{ ...program, launchYearOffset: String(v) }] });
    const atZero = equityAt(0);
    if (atZero < targetEquityValue) {
      return { ok: true, degenerate: "aboveRange", impliedValue: 0, label: "launch timing", suffix: "yr", currentValue,
        note: "Even at an immediate launch, fair value doesn't reach the current price — the market may be pricing in something beyond what launch timing alone can explain." };
    }
    const atMax = equityAt(25);
    if (atMax >= targetEquityValue) {
      return { ok: true, degenerate: "belowRange", impliedValue: 25, label: "launch timing", suffix: "yr", currentValue,
        note: "Even 25 years out, fair value already meets or exceeds the current price for this input alone — something else (cash, PRV, other assumptions) may be doing more of the work than launch timing is." };
    }
    let impliedValue = 0;
    for (let y = 0; y <= 25; y++) {
      if (equityAt(y) >= targetEquityValue) impliedValue = y; else break;
    }
    return { ok: true, impliedValue, label: "launch timing", suffix: "yr", currentValue };
  }

  let currentValue, lo, hi, applyTrial, label, suffix;
  if (variable === "peakRevenue") {
    if (program.revenueMode !== "quick") return { ok: false, error: "Implied peak revenue only applies in Quick revenue mode — in Full mode, peak revenue is derived from population/share/price, not a direct input to solve for." };
    currentValue = numOr(program.quickRevenue.peakRevenue, 0);
    lo = 0; hi = Math.max(currentValue * 20, 50000000000); // generous upper bound — degenerate-range handling below covers cases beyond it
    applyTrial = (v) => ({ ...theCase, programs: [{ ...program, quickRevenue: { ...program.quickRevenue, peakRevenue: String(v) } }] });
    label = "peak revenue"; suffix = "$";
  } else if (variable === "peakShare") {
    if (program.revenueMode !== "full") return { ok: false, error: "Implied peak market share only applies in Full revenue mode." };
    const ms = getRevenueBuild(program).marketShare;
    currentValue = ms.peakShareOverridePct !== "" && ms.peakShareOverridePct != null ? Number(ms.peakShareOverridePct) : peakShareForEntry(ms.numDrugs, ms.orderOfEntry);
    lo = 0; hi = 100;
    applyTrial = (v) => ({ ...theCase, programs: [{ ...program, revenueBuild: { ...getRevenueBuild(program), marketShare: { ...ms, peakShareOverridePct: String(v) } } }] });
    label = "peak market share"; suffix = "%";
  } else {
    return { ok: false, error: "Unknown variable." };
  }

  const equityAt = (v) => equityAtCase(applyTrial(v));
  const atLo = equityAt(lo), atHi = equityAt(hi);

  if (atLo >= targetEquityValue) {
    return { ok: true, degenerate: "belowRange", impliedValue: lo, label, suffix, currentValue,
      note: `Even at the low end of a realistic range, fair value already meets or exceeds the current price for this input alone — something else (cash, PRV, other assumptions) may be doing more of the work than ${label} is.` };
  }
  if (atHi < targetEquityValue) {
    return { ok: true, degenerate: "aboveRange", impliedValue: hi, label, suffix, currentValue,
      note: `Even at the high end of a realistic range, fair value doesn't reach the current price — the market may be pricing in something beyond what varying ${label} alone can explain.` };
  }

  let a = lo, b = hi;
  for (let i = 0; i < 40; i++) {
    const mid = (a + b) / 2;
    if (equityAt(mid) < targetEquityValue) a = mid; else b = mid;
  }
  const impliedValue = (a + b) / 2;

  return { ok: true, impliedValue, label, suffix, currentValue };
}


// ── Forward-looking cash runway: projects the case's ACTUAL cash balance
// year by year using UNRISKED (100% PoS) program cash flows — deliberately
// NOT risk-adjusted, because runway is a cash-forecasting question ("if the
// current plan proceeds, when do we run out of money"), not a valuation
// question. A company spends the full cost of its active trials with
// certainty as they happen; PoS-weighting is for computing expected value
// across possible outcomes, not for predicting the literal bank balance.
// Same unrisking technique as the per-asset risk waterfall (posOverridePct
// forced to 100%), applied here at the whole-company level with REAL
// corporate G&A included (unlike the risk waterfall, which zeroes G&A on
// purpose to isolate one asset's standalone value — runway is inherently a
// whole-company concept). Starting cash is gross, not net of debt: debt is
// a liability serviced on its own schedule, not something spent down like
// operating costs, so subtracting it here would conflate two different
// questions. Cash flows are NOT time-discounted — this walks nominal
// dollars forward year by year, not a present-value calculation.
// Money the company can reach that is not on the balance sheet yet
// (October 2026): an undrawn ATM, an undrawn debt facility, and milestone cash
// expected before the next catalyst — all typed by the user, never parsed,
// none of it in the valuation. Remaining shelf capacity is registration room,
// not money, so it is kept apart (and an ATM usually sits inside the shelf,
// hence the double-count warning).
function caseFacilities(theCase) {
  const cap = (theCase && theCase.capitalStructure) || {};
  const v = k => Math.max(0, numOr(cap[k], 0));
  const atm = v("atmUndrawn"), debt = v("debtUndrawn"), milestones = v("milestoneExpected"), shelf = v("shelfRemaining");
  return { atm, debt, milestones, shelf, total: atm + debt + milestones, note: cap.facilitiesNote || "", doubleCount: atm > 0 && shelf > 0, any: atm + debt + milestones + shelf > 0 };
}

// "undrawn ATM", "undrawn ATM and debt", "undrawn ATM, debt and expected
// milestones" — only the kinds actually entered, so a case with an ATM alone
// is not described as having credit lines and milestones too.
function facilitiesPhrase(fac) {
  const parts = [];
  if (fac.atm > 0) parts.push("ATM");
  if (fac.debt > 0) parts.push("debt");
  if (fac.milestones > 0) parts.push("expected milestones");
  if (!parts.length) return "";
  const list = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return (fac.atm > 0 || fac.debt > 0 ? "undrawn " : "") + list;
}

function computeForwardRunway(theCase, opts) {
  const scenario = { label: "unrisked", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const programVals = theCase.programs.map(p => computeProgramValuation({ ...p, posOverridePct: "100" }, scenario, null));

  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  // Cash tax is a real outflow, so it belongs in a runway/financing projection
  // just as much as in a valuation.
  const calendar = applyTaxToCalendar(computeCompanyRiskAdjustedCF(programVals, corpGA, 25), theCase.taxation);

  const capStruct = effectiveCapitalStructure(theCase);
  // extraCash: the facilities above, for the "with facilities" runway only.
  const startingCash = numOr(capStruct.cash, 0) + ((opts && opts.extraCash) || 0);

  let balance = startingCash;
  const path = [];
  let runwayYears = null;
  for (let y = 0; y < calendar.length; y++) {
    const flow = calendar[y].riskAdjFCF; // unrisked here despite the field name, since posToLaunch=1 throughout
    const balanceStart = balance;
    balance += flow;
    path.push({ year: y, flow, balanceEnd: balance });
    if (runwayYears == null && balanceStart > 0 && balance <= 0) {
      const fraction = balanceStart / (balanceStart - balance);
      runwayYears = y + fraction;
    }
  }
  if (runwayYears == null && startingCash <= 0) runwayYears = 0;

  return { startingCash, path, runwayYears, runwayMonths: runwayYears != null ? runwayYears * 12 : null };
}

// The modelled cash balance after `months`, read along the forward runway's
// yearly path (linear within a year, as the runway itself is).
function forwardBalanceAt(fr, months) {
  const t = months / 12;
  let start = fr.startingCash;
  for (let y = 0; y < fr.path.length; y++) {
    const end = fr.path[y].balanceEnd;
    if (t <= y + 1) return start + (end - start) * Math.max(0, t - y);
    start = end;
  }
  return start;
}

// How much must the company raise to reach its next catalyst with a cushion,
// and what does that do to a share (October 2026)? The binding catalyst is the
// earliest one Runway vs. Catalyst does not call funded; the dollars needed
// are the modelled shortfall at the END of its window plus the cushion. Before
// and after any facilities the user entered (never netted silently), against
// the shelf, and — at a discount to today's price — the shares and the Base
// fair value with that raise in place. Null when nothing is short.
function computeFinancingBridge(theCase, opts) {
  const o = opts || {};
  const cushion = o.cushionMonths == null ? RUNWAY_CUSHION_MONTHS_DEFAULT : o.cushionMonths;
  const rv = computeRunwayVsCatalysts(theCase, { cushionMonths: cushion, now: o.now });
  if (!rv.ok || !rv.firstProblem) return null;
  let fr;
  try { fr = computeForwardRunway(theCase); } catch (e) { return null; }
  const target = rv.firstProblem;
  const months = Math.max(0, target.monthsAway) + cushion;
  const needed = Math.max(0, -forwardBalanceAt(fr, months));
  if (!(needed > 0)) return null;
  const fac = caseFacilities(theCase);
  const afterFacilities = Math.max(0, needed - fac.total);
  const price = numOr(theCase.currentPrice, 0);
  const fr0 = theCase.futureRaise || {};
  const discountPct = o.discountPct != null ? o.discountPct : (fr0.priceMode === "discount" && fr0.discountPct !== "" && fr0.discountPct != null ? Number(fr0.discountPct) : 15);
  const raisePrice = price > 0 ? price * (1 - Math.min(100, Math.max(0, discountPct)) / 100) : 0;
  const amount = afterFacilities;
  const raise = { enabled: true, amountM: String(Math.round(amount)), priceMode: "discount", discountPct: String(discountPct) };
  let baseNow = null, baseWith = null;
  try { baseNow = baseCaseFairValue(theCase); baseWith = amount > 0 && raisePrice > 0 ? baseCaseFairValue({ ...theCase, futureRaise: { ...fr0, ...raise } }) : baseNow; } catch (e) { /* no valuation yet */ }
  // A raise the case already models (futureRaise) brings cash the forward
  // runway does not count; if it is at least what is needed, it covers it.
  const modelledAmount = fr0.enabled ? Math.max(0, numOr(fr0.amountM, 0)) : 0;
  return {
    catalyst: target, cushionMonths: cushion, months, needed, facilities: fac, afterFacilities,
    modelledAmount, coveredByModelled: modelledAmount > 0 && modelledAmount >= afterFacilities,
    shelfShort: fac.shelf > 0 && fac.shelf < afterFacilities ? afterFacilities - fac.shelf : 0,
    discountPct, raisePrice, newShares: raisePrice > 0 ? amount / raisePrice : null,
    raise, alreadyModelled: !!(fr0.enabled && numOr(fr0.amountM, 0) > 0), baseNow, baseWith,
    zeroDate: fr.runwayMonths != null ? fr.runwayMonths : null
  };
}

// ── Dilution-path financing — connects two things the engine already
// computes (cash runway, R&D-to-launch cost) into a projected sequence of
// future raises, rather than the single static what-if the futureRaise
// overlay offers. Whenever projected cash would drop below the maintained
// buffer, a raise is modeled at current price less an assumed discount,
// sized to restore the buffer plus cover a set number of forward months at
// the current burn rate — a deterministic approximation, not a stochastic
// financing simulation. Uses unrisked cash flow (posOverridePct forced to
// 100%, same convention as computeForwardRunway above) because a company
// plans financing assuming it continues, not a probability-blended amount —
// but still passes the scenario through, so Bear's lower revenue assumption
// naturally shows more post-launch dilution than Bull without any separate
// "risk-adjusted dilution" machinery needed on top.
function computeDilutionPath(theCase, scenario, discountRateBasePct, opts) {
  opts = opts || {};
  const capStruct = effectiveCapitalStructure(theCase);
  // Start from the post-manual-raise cap table, not the raw one. Callers
  // OVERWRITE dilutedShares with this function's result, so building from the
  // raw structure silently discarded a configured future raise: a case with a
  // known $300M raise (+10M shares) plus Dilution Path enabled came back at
  // the undiluted 50M share count, as if the raise had never been entered.
  // That is worse than double-counting — the user sees an input they filled
  // in having no effect at all. A known near-term raise now anchors the
  // projection, and further raises are modelled on top of it.
  const capResultRaw = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  const capResult0 = applyFutureRaise(capResultRaw, theCase.futureRaise, theCase.currentPrice);
  const manualRaiseAmount = capResult0._futureRaiseAmount || 0;
  const dp = theCase.dilutionPath;
  if (!dp || !dp.enabled) return { enabled: false, finalDilutedShares: capResult0.dilutedShares, path: [], totalRaisedM: 0 };

  // posMultiplierPct forced to 100 here, separately from posOverridePct below
  // — the two compose multiplicatively inside computeProgramValuation, so
  // leaving the scenario's own posMultiplierPct (70/130 for Bear/Bull) in
  // place would silently pull posToLaunch below 1.0 for Bear specifically,
  // understating exactly the burn this function exists to model. shareMultiplierPct
  // stays real, so revenue — and therefore post-launch dilution — still
  // varies correctly by scenario.
  const programVals = theCase.programs.map(p => computeProgramValuation({ ...p, posOverridePct: "100" }, { ...scenario, posMultiplierPct: 100 }, null));
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  // Cash tax is a real outflow, so it belongs in a runway/financing projection
  // just as much as in a valuation.
  const calendar = applyTaxToCalendar(computeCompanyRiskAdjustedCF(programVals, corpGA, 25), theCase.taxation);

  const minBuffer = numOr(dp.minCashBufferM, 0); // raw dollars, despite the "M" field name — MillionsField converts to raw dollars before storage
  const targetMonths = numOr(dp.targetRunwayMonths, 18);
  const discount = numOr(dp.discountToMarketPct, 0) / 100;
  const sbcGrowth = numOr(dp.sbcAnnualGrowthPct, 0) / 100;
  // No floor here — a genuinely blank/zero current price should skip
  // raising entirely (see the raisePrice > 0 guard below), not fall back to
  // a near-zero price that would issue an absurd number of shares for any
  // real dollar amount raised. Found via testing: with no price set, this
  // was producing billions of shares from a $257M raise.
  // Price of each projected raise. "market" (the default): today's price less
  // the discount. "fair": this case's own value per share, which makes the
  // raises value-neutral — the convention when a model already charges every
  // cost it has to fund (opts.fairPrice, passed by the valuation).
  const priceBasis = dp.priceBasis === "fair" ? "fair" : "market";
  const raisePrice = priceBasis === "fair" && opts.fairPrice > 0 ? opts.fairPrice : numOr(theCase.currentPrice, 0) * (1 - discount);
  // A raise only happens while the company is still pursuing its programs:
  // one sized for after a failed readout never takes place. Weight each year's
  // raise by the odds the company is still going then (risked programs).
  const riskedVals = theCase.programs.map(p => computeProgramValuation(p, scenario, null));
  const active = computeCompanyActiveByYear(riskedVals, (theCase.corporateGA || {}).windDownYears, 25);

  // The manual raise's proceeds are real cash on hand before any projected
  // raise, so the runway projection has to see them too — otherwise the model
  // would raise again to cover a gap the user already said was funded.
  let balance = numOr(capStruct.cash, 0) + manualRaiseAmount;
  let shares = capResult0.dilutedShares;
  const path = [];
  let totalRaisedM = 0;
  let expectedCashToHorizon = 0;

  const launchOffsets = theCase.programs.map(p => resolveLaunchYearOffset(p));
  // +3 years past launch, not launch itself — every calendar year up to
  // launch has identical R&D burn regardless of scenario by construction
  // (that's the whole point of forcing posMultiplierPct to 100 above), so
  // reading the share count exactly at launch would show Bear and Bull as
  // identical, before revenue has had any time to matter. A few years into
  // commercialization is where Bear's lower revenue assumption actually
  // starts requiring more/larger raises than Bull's.
  const horizonYear = launchOffsets.length ? Math.max(...launchOffsets) + 3 : 10;

  for (let y = 0; y < calendar.length; y++) {
    shares *= (1 + sbcGrowth); // continuous creep, independent of whether a raise happens this year
    const flow = calendar[y].riskAdjFCF;
    balance += flow;
    let raiseAmount = 0;
    if (balance < minBuffer && raisePrice > 0) {
      const monthlyBurn = flow < 0 ? -flow / 12 : 0;
      const need = (minBuffer - balance) + monthlyBurn * targetMonths;
      raiseAmount = Math.max(0, need);
      if (raiseAmount > 0) {
        // Planned on the path where the company carries on (balance, sizing);
        // counted in the valuation with the odds it happens (shares, cash).
        const odds = active[y] ? active[y].active : 1;
        shares += raiseAmount * odds / raisePrice;
        balance += raiseAmount;
        totalRaisedM += raiseAmount / 1e6;
        if (y <= horizonYear) expectedCashToHorizon += raiseAmount * odds;
      }
    }
    path.push({ year: y, flow, balanceEnd: balance, dilutedShares: shares, raiseAmount });
  }

  const atHorizon = path[Math.min(horizonYear, path.length - 1)];
  // The cash the new shares bring in goes into equity WITH them. It used to
  // be left out: the cash flows already charge the costs these raises pay
  // for, so adding the shares alone charged those costs twice (PepGen fell
  // from $1.38 to $0.57 with the path switched on).
  return { enabled: true, finalDilutedShares: atHorizon ? atHorizon.dilutedShares : shares, path, totalRaisedM,
    expectedCashRaised: expectedCashToHorizon, raisePrice, priceBasis, horizonYear };
}

// Structured red-flag checks — cross-references a case's own inputs against
// the same benchmark tables and formulas already used elsewhere in the app
// (getPosForArea, computeRnDToLaunch, peakShareForEntry, COGS_BENCHMARKS,
// computeForwardRunway), plus each other. Deliberately descriptive, never
// prescriptive — every message states a tension, never a verdict. Only
// fires on a genuinely large deviation (2x/0.5x ratios, not small nitpicks),
// and only when the user has actually set an override — a program left at
// pure benchmark defaults can never trigger these by construction, since
// the benchmark is being compared against itself.
// ── "What the model says" — the snapshot evidence entry, from the model ──
// The snapshot entry used to be written by hand, and every figure in it went
// stale the moment the price or an input moved (filling two cases meant
// recomputing ~15 numbers each). This builds it from the live model: price,
// Bear/Base/Bull, peak revenue, the odds the price implies against the
// case's, the value if it works, what is left if the next readout fails (by
// whichever floor method the case uses) and the three inputs that move it
// most. Every number is the engine's own; nothing here is a new calculation.
// The Evidence Log replaces its one snapshot entry in place, dated — a
// current reading, not a history (versioned snapshots are deliberately not
// built). today: "YYYY-MM-DD" (defaults to the case's valuationDate or today).
const MODEL_SNAPSHOT_LABEL = "What the model says (snapshot)";
// Snapshots are kept, dated (October 2026): each is labelled with its date,
// so the Evidence Log holds what the model said before a readout beside what
// it said after. A second snapshot on the same day replaces that day's.
function modelSnapshotLabel(date) { return "What the model says (snapshot, " + date + ")"; }
function isModelSnapshot(e) { return !!(e && typeof e.label === "string" && e.label.indexOf("What the model says (snapshot") === 0); }
function addModelSnapshot(log, entry, makeId) {
  const list = log || [];
  const at = list.findIndex(e => e.label === entry.label);
  return { log: at >= 0 ? list.map((e, i) => i === at ? { ...e, ...entry } : e) : [...list, { id: makeId ? makeId() : undefined, ...entry }], replaced: at >= 0 };
}
// How old the inputs behind the headline are (October 2026). The fair value,
// the odds the price implies and the failure floor are all arithmetic on a
// typed price and a filed cash balance; acting on a two-week-old price or a
// two-quarter-old balance is the commonest way a careful case is wrong, and
// nothing said so. Pure: `today` is a local Date, `newerFiling` the result of
// the EDGAR check (newerFinancialFiling) when the caller has one.
// Amber states, and only two: a price entered more than 7 days ago, and a
// newer 10-Q/10-K than the cash on the case.
const FRESHNESS_PRICE_STALE_DAYS = 7;
function computeFreshness(theCase, today, newerFiling) {
  const now = today || new Date();
  const t = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const age = iso => { const p = parseIsoDay(iso); return p == null ? null : Math.round((t - p) / 86400000); };
  const cap = (theCase && theCase.capitalStructure) || {};
  const priceNum = numOr(theCase && theCase.currentPrice, NaN);
  const priceDays = age(theCase && theCase.priceAsOf);
  const price = isFinite(priceNum) && priceNum > 0
    ? { value: priceNum, asOf: (theCase.priceAsOf || null), days: priceDays, stale: priceDays != null && priceDays > FRESHNESS_PRICE_STALE_DAYS }
    : null;
  const cashNum = numOr(cap.cash, NaN);
  const cash = isFinite(cashNum) && cap.cash !== ""
    ? { value: cashNum, asOf: cap.cashAsOf || null, days: age(cap.cashAsOf), rolled: !!cap.carryCashForward, newer: newerFiling || null }
    : null;
  const nc = nextCaseCatalyst(theCase, now);
  const catalyst = nc ? { label: nc.entry.catalystLabel || "Catalyst", date: nc.entry.catalystDate, pinned: nc.pinned,
    type: nc.pinned ? catalystPinLabel(nc.entry.pin) : null, source: nc.pinned ? (nc.entry.pin.source || "") : "", pinnedAt: nc.pinned ? (nc.entry.pin.at || null) : null } : null;
  let odds = null;
  const progs = (theCase && theCase.programs) || [];
  if (progs.length === 1) {
    const p = progs[0];
    const typed = p.posOverridePct !== "" && p.posOverridePct != null;
    let pct = null;
    try { pct = typed ? Number(p.posOverridePct) : computePoSWeighting(p).posToLaunch * 100; } catch (e) { pct = null; }
    const from = posFromSimulator(p) ? p.posSource : null;   // set by "Use as this case's odds" (simulator)
    odds = pct != null && isFinite(pct) ? { pct, source: from ? "simulator" : typed ? "typed" : "benchmark", at: from ? from.at || null : null } : null;
  }
  return { price, cash, catalyst, odds, amber: !!((price && price.stale) || (cash && cash.newer)) };
}

function buildModelSnapshot(theCase, today) {
  if (!theCase || !theCase.programs || !theCase.programs.length) return null;
  const date = today || theCase.valuationDate || localDateStamp();
  const multiple = theCase.valuationMethod === "multiple";
  const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
  const tv = theCase.terminalValue || { enabled: false };
  const value = k => {
    const preset = getEffectiveScenarioPreset(theCase, k);
    const ma = theCase.multipleAssumptions || {};
    return multiple ? computeSimpleMultipleValuation(theCase, preset, k, numOr(ma[k], 3), dr) : computeCaseValuation(theCase, preset, k, dr, tv);
  };
  let bear, base, bull;
  try { bear = value("bear"); base = value("base"); bull = value("bull"); } catch (e) { return null; }
  const ps = r => r && r.equity && isFinite(r.equity.perShare) ? r.equity.perShare : null;
  if (ps(base) == null) return null;
  const sh = v => "$" + v.toFixed(2);
  const price = Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  const single = theCase.programs.length === 1;
  const parts = [];
  const gap = price ? Math.round(Math.abs(ps(base) / price - 1) * 100) : null;
  parts.push((price ? "At " + sh(price) + " on " + date + ": " : "On " + date + ": ") + "Base fair value ~" + sh(ps(base)) +
    (price ? (gap === 0 ? " (at the price)" : " (about " + gap + "% " + (ps(base) > price ? "above" : "below") + " the price)") : "") +
    ", Bear ~" + sh(ps(bear)) + ", Bull ~" + sh(ps(bull)) +
    "; peak revenue ~" + fmtMoney((base.programVals || []).reduce((a, p) => a + (p.peakRevenue || 0), 0), 2) + " in Base" +
    (multiple ? ", valued by Simple Multiple (peak revenue × the multiple, risked by the odds and discounted)." : "."));
  if (!multiple && single && price) {
    try {
      const imp = solveImpliedPoSMultiplier(theCase, dr, tv);
      if (imp && imp.ok && !imp.degenerate && imp.impliedAbsolutePct != null)
        parts.push("The price implies ~" + Math.round(imp.impliedAbsolutePct) + "% odds of launch against this case's " + Math.round(imp.baseAbsolutePct) + "%.");
    } catch (e) { /* no implied odds to quote */ }
  }
  if (!multiple) {
    try {
      const works = ps(computeCaseValuation({ ...theCase, programs: theCase.programs.map(p => ({ ...p, posOverridePct: "100" })) }, SCENARIO_PRESETS.base, "base", dr, tv));
      const fl = single ? computeFailureFloor(theCase) : null;
      if (works != null && Math.abs(works - ps(base)) >= 0.005)
        parts.push("If approved, with no failure weighting, a share is worth ~" + sh(works) + " on Base inputs" +
          (fl ? "; if the next readout fails, " + (fl.perShare < 0.005 ? "about nothing" + (fl.cashShort ? " — the cash runs out first —" : "") : "~" + sh(fl.perShare)) + " is left (" + (fl.method === "burn"
            ? "the rough burn estimate: the filing's cash less " + fmtMoney(fl.monthlyBurn) + " a month for " + fl.monthsToReadout.toFixed(0) + " months to the readout and a wind-down"
            : "the filing's cash less the " + fl.stageLabel + " still to pay, G&A to the readout and a wind-down") + ", before any raise)." : "."));
    } catch (e) { /* skip */ }
    try {
      const rows = (computeSensitivityDrivers(theCase, { skipGrid: true }).rows || []).slice(0, 3);
      if (rows.length) parts.push("What moves it most: " + andList(rows.map(r => r.name.replace(/ \(.*\)$/, "").replace(/ \/ revenue$/, "").replace(/^[A-Z](?![A-Z])/, c => c.toLowerCase()) + " (" + sh(Math.min(r.lo, r.hi)) + " to " + sh(Math.max(r.lo, r.hi)) + ")")) + ".");
    } catch (e) { /* skip */ }
  }
  // How fresh the inputs were when this was written, so a snapshot read
  // months later says what it rested on.
  try {
    const fr = computeFreshness(theCase, new Date());
    const bits = [];
    if (fr.price && fr.price.asOf) bits.push("price entered " + fr.price.asOf);
    if (fr.cash && fr.cash.asOf) bits.push("cash as of " + fr.cash.asOf);
    if (fr.catalyst) bits.push("next catalyst " + fr.catalyst.date + (fr.catalyst.pinned ? " (pinned" + (fr.catalyst.source ? ": " + fr.catalyst.source : "") + ")" : ""));
    if (fr.odds) bits.push("odds " + (fr.odds.source === "simulator" ? "from the simulator" + (fr.odds.at ? " (" + fr.odds.at + ")" : "") : fr.odds.source === "typed" ? "typed" : "the benchmark"));
    if (bits.length) parts.push("Inputs: " + andList(bits) + ".");
  } catch (e) { /* the snapshot stands without it */ }
  return { label: modelSnapshotLabel(date), classification: "inference", confidence: "moderate", source: "Generated from this case's model on " + date, date, thesis: parts.join(" ") };
}

// ── Red flags the user has marked "considered" ─────────────────────────────
// A flag answered once (say, with an Evidence Log entry) used to show on every
// visit, so the flags that still needed a look were lost among the ones that
// did not. A flag is known by its program and its exact message; the message
// carries the input values, so when an input changes the message changes and
// the flag opens again by itself. theCase.consideredFlags: [{ key, at }].
function redFlagKey(flag) { return (flag.programId || "") + "|" + flag.message; }
function splitConsideredFlags(theCase, flags) {
  const marked = {};
  ((theCase && theCase.consideredFlags) || []).forEach(c => { if (c && c.key) marked[c.key] = c.at || ""; });
  const open = [], considered = [];
  flags.forEach(f => { const k = redFlagKey(f); if (k in marked) considered.push({ ...f, key: k, consideredAt: marked[k] }); else open.push({ ...f, key: k }); });
  return { open, considered };
}
// The list after marking (or unmarking) one flag; marks that no longer match
// any current flag are dropped, so the list never grows stale.
function markFlagConsidered(theCase, flags, key, on, today) {
  const live = {}; flags.forEach(f => { live[redFlagKey(f)] = true; });
  const kept = ((theCase && theCase.consideredFlags) || []).filter(c => c && live[c.key] && c.key !== key);
  return on ? kept.concat([{ key, at: today }]) : kept;
}

// The typed Napkin peak against the full build's own peak (US sales plus any
// royalty, as the valuation would use it), when both exist and one is more
// than 1.5x the other. Null otherwise.
function napkinBuildPeakMismatch(program) {
  try {
    const quick = numOr(((program.quickRevenue || {}).peakRevenue), 0);
    if (!(quick > 0)) return null;
    const full = getProgramRevenueResult({ ...program, revenueMode: "full" }, 25).peakTotalRevenue;
    if (!(full > 0)) return null;
    const ratio = quick / full;
    if (ratio <= 1.5 && ratio >= 1 / 1.5) return null;
    return { quick, full, ratio, mode: program.revenueMode === "full" ? "full" : "quick" };
  } catch (e) { return null; }
}

function computeRedFlags(theCase) {
  const flags = [];
  const programs = theCase.programs || [];

  programs.forEach(program => {
    const progName = program.drugName || program.name || "Program";

    // 0. A territory-limited royalty in Napkin mode is applied to all revenue.
    if (quickModeTerritoryMismatch(program)) {
      const terr = (program.partnership.territory || "exUS") === "us" ? "US-only" : "ex-US";
      flags.push({
        programId: program.id, programName: progName, severity: "high",
        message: `This ${terr} partnership is applied to all of ${progName}'s revenue: Napkin mode has one revenue figure and no US/ex-US split, so the ${program.partnership.royaltyPct}% royalty replaces the company's own sales everywhere. Switch to the Full model, or turn the partnership off and enter as peak revenue only what the company itself books (its own sales plus the royalty).`
      });
    }

    // 0b. The Napkin peak and the full build disagree by more than half. Only
    // one of them is in the valuation, so the other is silently ignored — a
    // case can carry a $2.5B typed peak while the build says $1.3B, and the
    // two modes then give very different answers without saying why.
    {
      const mismatch = napkinBuildPeakMismatch(program);
      if (mismatch) {
        const inUse = mismatch.mode === "quick" ? "Napkin peak" : "full build";
        flags.push({
          programId: program.id, programName: progName, severity: "medium",
          message: `${progName}'s Napkin peak (${fmtMoney(mismatch.quick)}) is ${mismatch.ratio >= 1 ? mismatch.ratio.toFixed(1) + "x" : (1 / mismatch.ratio).toFixed(1) + "x below"} the full build's (${fmtMoney(mismatch.full)}). Only the ${inUse} is in the valuation now, so switching modes would move the value by roughly that much. Worth deciding which one you believe — the price, the share of patients treated, or a wider label are the usual reasons they differ.`
        });
      }
    }

    // 1. PoS override far from the phase/area benchmark
    if (program.posOverridePct !== "" && program.posOverridePct != null) {
      const overridePos = Number(program.posOverridePct) / 100;
      const benchPos = computePoSWeighting(program).posToLaunch;
      if (benchPos > 0 && overridePos > 0) {
        const ratio = overridePos / benchPos;
        if (ratio > 2 || ratio < 0.5) {
          flags.push({
            programId: program.id, programName: progName, severity: ratio > 3 || ratio < 0.33 ? "high" : "medium",
            message: `PoS override (${(overridePos * 100).toFixed(0)}%) is ${ratio > 1 ? ratio.toFixed(1) + "x above" : (1 / ratio).toFixed(1) + "x below"} the ${program.currentPhase}/${program.therapeuticArea} benchmark (${(benchPos * 100).toFixed(0)}%). Worth having a specific reason on hand — a validated biomarker, a concerning interim signal, a mechanism precedent — beyond a general view on the program.`
          });
        }
      }
    }

    // 2. Cost structure implying an implausible margin — thresholds scale off
    // this program's OWN modality benchmark (+20pp medium / +35pp high, floored
    // at the original fixed 40/55 so small molecule and biologic behave exactly
    // as before) rather than a flat 40%/55% for everyone. Needed once gene
    // therapy's own sourced benchmark (55%) exists — a flat 40% cutoff would
    // flag every program using its own correct default as "implausible."
    if (program.costStructure && program.costStructure.cogsPct !== "" && program.costStructure.cogsPct != null) {
      const cogsPct = Number(program.costStructure.cogsPct);
      const modalityBenchPct = getCogsBenchmark(program.modality).value;
      const mediumThreshold = Math.max(40, modalityBenchPct + 20);
      const highThreshold = Math.max(55, modalityBenchPct + 35);
      if (cogsPct > mediumThreshold) {
        flags.push({
          programId: program.id, programName: progName, severity: cogsPct > highThreshold ? "high" : "medium",
          message: `COGS override of ${cogsPct.toFixed(0)}% is well above this program's own ${MODALITY_OPTIONS.find(m => m.value === (program.modality || "smallMolecule")).label.toLowerCase()} benchmark (${modalityBenchPct}%) and approaching a level that would erode most of the gross margin even before sales force, marketing, and G&A.`
        });
      }
    }

    // 3. R&D timeline override implausibly fast vs. benchmark
    if (program.rndOverride && program.rndOverride.totalYears !== "" && program.rndOverride.totalYears != null) {
      const overrideYears = Number(program.rndOverride.totalYears);
      const benchYears = computeRnDToLaunch(program).totalYears;
      if (benchYears > 0 && overrideYears > 0 && overrideYears < benchYears * 0.5) {
        flags.push({
          programId: program.id, programName: progName, severity: overrideYears < benchYears * 0.33 ? "high" : "medium",
          message: `R&D-to-launch override of ${overrideYears.toFixed(1)} years is under half the ${program.currentPhase}/${program.therapeuticArea} benchmark (${benchYears.toFixed(1)} years). A real, named reason for the acceleration — a Breakthrough/priority designation already granted, a rolling review, a much smaller confirmatory requirement — is worth having on hand.`
        });
      }
    }

    // 4. Peak market share override inconsistent with order-of-entry
    if (program.revenueMode === "full" && program.revenueBuild && program.revenueBuild.marketShare) {
      const ms = program.revenueBuild.marketShare;
      if (ms.peakShareOverridePct !== "" && ms.peakShareOverridePct != null) {
        const overrideShare = Number(ms.peakShareOverridePct);
        const benchShare = peakShareForEntry(ms.numDrugs, ms.orderOfEntry);
        if (overrideShare > 100) {
          // Not a judgement call: a share of the treated population above 100%
          // cannot exist. The revenue engine caps it at 100%; this says so.
          flags.push({
            programId: program.id, programName: progName, severity: "high",
            message: `Peak share override of ${overrideShare.toFixed(0)}% is above 100% — a drug cannot reach more than all of its eligible patients, so the model caps it at 100%. Worth checking for a typo (150 where 15 was meant).`
          });
        } else if (benchShare > 0 && overrideShare > benchShare * 2) {
          flags.push({
            programId: program.id, programName: progName, severity: overrideShare > benchShare * 3 ? "high" : "medium",
            message: `Peak share override of ${overrideShare.toFixed(0)}% is well above what the order-of-entry model would predict for the ${ms.orderOfEntry}${ms.orderOfEntry === 1 ? "st" : ms.orderOfEntry === 2 ? "nd" : ms.orderOfEntry === 3 ? "rd" : "th"} entrant among ${ms.numDrugs} drugs (${benchShare.toFixed(0)}%) — real differentiation (efficacy, safety, dosing convenience) would need to be unusually strong to clear a bar this high.`
          });
        }
      }
    }
    // 5. A list price entered on a list basis, converted with Table 4-1's
    // all-drugs average. That average is the app's own sourced number and is
    // the right default, but it is an average across every drug in the book
    // and understates gross-to-net badly for a modern specialty brand, where
    // 40-50% deductions are ordinary. Only fires once the basis says the entered
    // number really is a list price and the user has not supplied their own
    // realisation figure — so the intended resolution stops the flag.
    if (program.revenueMode === "full" && program.revenueBuild && program.revenueBuild.pricing) {
      const pr = program.revenueBuild.pricing;
      const basis = pr.priceBasis || "ASP";
      const noOverride = pr.netPriceRealizationPct === "" || pr.netPriceRealizationPct == null;
      if (basis !== "ASP" && noOverride && numOr(pr.usAnnualPrice, 0) > 0) {
        const pb = resolveNetPrice(pr);
        flags.push({
          programId: program.id, programName: progName, severity: "low",
          message: `Price is entered on ${priceBasisArticle(basis)} ${basis} basis and converted to net using Table 4-1's ${pb.grossToNetPct.toFixed(0)}% average gross-to-net. That table averages across all drugs in the source; for a modern US specialty brand, deductions of 40-50% are ordinary, and the difference flows straight through peak revenue into the valuation. If you have a real gross-to-net for a close comparable, enter it as the net price realization.`
        });
      }
    }

    // 6. Both PoS-modifier axes set at once, with no explicit override.
    // computePoSModifiers uses the stronger of the two same-direction effects
    // (the source never publishes the joint cell), so the combined benchmark
    // is a floor on the true joint lift and worth a deliberate look. Only
    // flagged while the computed value is actually in use; typing an explicit
    // override is exactly the intended resolution, so it stops flagging then.
    if ((program.posOverridePct === "" || program.posOverridePct == null)) {
      const mods = computePoSModifiers(program);
      if (mods.compoundedAxes) {
        const withMods = computePoSWeighting(program).posToLaunch * 100;
        const withoutMods = computePoSWeighting({ ...program, posBiomarkerUse: "", posDiseaseType: "" }).posToLaunch * 100;
        flags.push({
          programId: program.id, programName: progName, severity: "medium",
          message: `Two PoS attributes are set at once (${mods.applied.map(a => a.label.toLowerCase()).join(" + ")}), lifting cumulative PoS from ${withoutMods.toFixed(1)}% to ${withMods.toFixed(1)}%. The source publishes each attribute's cohort on its own, never the two together, and they overlap in practice (rare diseases are usually biomarker-defined), so the stronger single effect is used rather than both multiplied. Set an explicit PoS override if you have a reason to think the combination is better or worse than that.`
        });
      }
    }
  });

  // 7. Case-level: cash runway shorter than the nearest program's own launch timeline.
  // Only runs once cash has actually been entered — an unset field defaults
  // through as $0, which would make every brand-new, not-yet-filled-out case
  // "flag" on a runway of zero. That's not a real tension, just an empty form.
  if (programs.length > 0 && theCase.capitalStructure && theCase.capitalStructure.cash !== "" && theCase.capitalStructure.cash != null) {
    // A modelled future raise is money the case already counts on, so the
    // runway is measured with it too (it has no date, so it is added up
    // front). Without this the flag told a case with a $100M raise modelled
    // that its financing was "not yet reflected in the capital structure".
    const fr = theCase.futureRaise;
    const raiseAmt = fr && fr.enabled ? numOr(fr.amountM, 0) : 0;
    const runway0 = computeForwardRunway(theCase);
    const runway = raiseAmt > 0
      ? computeForwardRunway({ ...theCase, capitalStructure: { ...theCase.capitalStructure, cash: String(numOr(theCase.capitalStructure.cash, 0) + raiseAmt) } })
      : runway0;
    if (runway.runwayYears != null) {
      const launchTimelines = programs.map(p => ({ name: p.drugName || p.name || "Program", years: resolveLaunchYearOffset(p) }));
      const nearest = launchTimelines.reduce((min, cur) => cur.years < min.years ? cur : min, launchTimelines[0]);
      if (nearest && runway.runwayYears < nearest.years) {
        const withRaise = raiseAmt > 0 && runway0.runwayYears != null;
        flags.push({
          programId: null, programName: null, severity: runway.runwayYears < nearest.years * 0.7 ? "high" : "medium",
          message: withRaise
            ? `Modeled cash runway (${runway0.runwayYears.toFixed(1)} years, ${runway.runwayYears.toFixed(1)} with the modeled ${fmtMoney(raiseAmt)} raise) is shorter than the time to ${nearest.name}'s own modeled launch (${nearest.years.toFixed(1)} years) — reaching launch as modeled would need more financing than the raise already in the case.`
            : `Modeled cash runway (${runway.runwayYears.toFixed(1)} years) is shorter than the time to ${nearest.name}'s own modeled launch (${nearest.years.toFixed(1)} years) — reaching that catalyst as modeled would require financing not yet reflected in the capital structure.`
        });
      }
    }
  }

  return flags;
}


// reusable function (rather than left inline in the Sensitivity tool
// component) specifically so the PDF report can call the exact same logic
// when a chart is included in it, instead of a second, hand-maintained copy
// that could quietly drift out of sync with the tool's own numbers.
function computeSensitivityDrivers(theCase, opts) {
  let rows = [], error = null, baseline = null, gridData = null;
  if (theCase) {
    try {
      const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      const tv = theCase.terminalValue || { enabled: false };
      const tvParams = { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple };
      const valMethod = theCase.valuationMethod || "dcf";
      const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };
      const baseMultiple = numOr(multipleAssumptions.base, 3);
      const valueAt = (preset, drOverride, tvOverride, multipleOverride) =>
        valMethod === "multiple"
          ? computeSimpleMultipleValuation(theCase, preset, null, multipleOverride != null ? multipleOverride : baseMultiple, drOverride != null ? drOverride : dr).equity.perShare
          : computeCaseValuation(theCase, preset, "base", drOverride != null ? drOverride : dr, tvOverride || tvParams).equity.perShare;

      const effectiveBase = getEffectiveScenarioPreset(theCase, "base");
      const baseResult = valMethod === "multiple"
        ? computeSimpleMultipleValuation(theCase, effectiveBase, "base", baseMultiple, dr)
        : computeCaseValuation(theCase, effectiveBase, "base", dr, tvParams);
      baseline = baseResult.equity.perShare;

      const perShareAt = (sharePct, posPct, drOverride) => {
        const preset = { label: "custom", color: "", shareMultiplierPct: sharePct, posMultiplierPct: posPct, discountRateAddPct: 0 };
        return valueAt(preset, drOverride, null, null);
      };

      const drivers = [
        { name: "Peak market share / revenue", values: [70, 85, 100, 115, 130].map(pct => ({ label: pct + "%", value: perShareAt(pct, 100, null) })) },
        { name: "Probability of success (PoS)", values: [70, 85, 100, 115, 130].map(pct => ({ label: pct + "%", value: perShareAt(100, Math.min(pct, 200), null) })) },
        { name: "Discount rate", values: [dr-3, dr-1.5, dr, dr+1.5, dr+3].map(r2 => ({ label: r2.toFixed(1) + "%", value: perShareAt(100, 100, Math.max(1, r2)) })) }
      ];
      if (valMethod === "dcf" && tv.enabled && (tv.method || "exitMultiple") === "exitMultiple") {
        const baseMult = tv.exitMultiple !== "" && tv.exitMultiple != null ? Number(tv.exitMultiple) : 3;
        drivers.push({ name: "Exit multiple (terminal value)", values: [-1, -0.5, 0, 0.5, 1].map(delta => {
          const m = Math.max(0.5, baseMult + delta);
          const r = computeCaseValuation(theCase, effectiveBase, "base", dr, { ...tvParams, exitMultiple: m });
          return { label: m.toFixed(1) + "x", value: r.equity.perShare };
        })});
      }
      if (valMethod === "multiple") {
        drivers.push({ name: "Peak revenue multiple", values: [-1, -0.5, 0, 0.5, 1].map(delta => {
          const m = Math.max(0.5, baseMultiple + delta);
          const preset = { label: "custom", color: "", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0 };
          return { label: m.toFixed(1) + "x", value: valueAt(preset, null, null, m) };
        })});
      }

      if (valMethod === "dcf") {
        const cogsVariant = (mult) => {
          const clone = JSON.parse(JSON.stringify(theCase));
          clone.programs.forEach(p => {
            const bench = getCogsBenchmark(p.modality).value;
            const effective = (p.costStructure && p.costStructure.cogsPct !== "" && p.costStructure.cogsPct != null) ? Number(p.costStructure.cogsPct) : bench;
            // Fill the same defaults the rest of the engine assumes for a
            // program with no saved cost structure: a bare {} here crashed the
            // valuation (reps.primaryCare) and emptied the whole driver list.
            p.costStructure = Object.assign({ cogsPct: "", reps: {}, marketingPctOfPeak: "" }, p.costStructure || {});
            if (!p.costStructure.reps) p.costStructure.reps = {};
            p.costStructure.cogsPct = String(Math.max(0, Math.min(100, effective * mult)));
          });
          const r = computeCaseValuation(clone, effectiveBase, "base", dr, tvParams);
          return r.equity.perShare;
        };
        drivers.push({ name: "COGS (% of revenue)", values: [130, 115, 100, 85, 70].map(pct => ({ label: pct + "%", value: cogsVariant(pct / 100) })) });
      }

      const launchVariant = (deltaYears) => {
        const clone = JSON.parse(JSON.stringify(theCase));
        clone.programs.forEach(p => {
          const effective = resolveLaunchYearOffset(p);
          p.launchYearOffset = String(Math.max(0, effective + deltaYears));
        });
        return valMethod === "multiple"
          ? computeSimpleMultipleValuation(clone, effectiveBase, "base", baseMultiple, dr).equity.perShare
          : computeCaseValuation(clone, effectiveBase, "base", dr, tvParams).equity.perShare;
      };
      drivers.push({ name: "Launch timing", values: [-2, -1, 0, 1, 2].map(d => ({ label: (d >= 0 ? "+" : "") + d + "yr", value: launchVariant(d) })) });

      rows = drivers.map(d => {
        const vals = d.values.map(v => v.value).filter(v => v != null);
        const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null;
        return { ...d, lo, hi, swing: (lo != null && hi != null) ? hi - lo : 0 };
      }).sort((a, b) => b.swing - a.swing);

      // The 36-cell price grid is the expensive half; the live-impact panel
      // only needs the drivers and asks to skip it.
      if (!(opts && opts.skipGrid)) {
        const shareSteps = [60, 80, 100, 120, 150, 180];
        const posSteps = [60, 80, 100, 120, 150, 180];
        const cp = theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null;
        gridData = {
          shareSteps, posSteps, currentPrice: cp,
          cells: shareSteps.map(sPct => posSteps.map(pPct => perShareAt(sPct, pPct, null)))
        };
      }
    } catch (e) { error = e.message; }
  }
  return { rows, error, baseline, gridData };
}

// Base-case fair value per share by exactly the path the Valuation card and
// the Sensitivity tool take (effective Base preset, the case's discount rate,
// terminal value or multiple), so the live-impact panel can never disagree
// with the Overview. Returns null when the case can't be valued yet.
function baseCaseFairValue(theCase) {
  if (!theCase || !theCase.programs || !theCase.programs.length) return null;
  try {
    const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    const tv = theCase.terminalValue || { enabled: false };
    const preset = getEffectiveScenarioPreset(theCase, "base");
    if ((theCase.valuationMethod || "dcf") === "multiple") {
      const m = numOr((theCase.multipleAssumptions || {}).base, 3);
      return computeSimpleMultipleValuation(theCase, preset, "base", m, dr).equity.perShare;
    }
    return computeCaseValuation(theCase, preset, "base", dr, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple }).equity.perShare;
  } catch (e) { return null; }
}

// ── Portfolio summary — aggregates every case's already-computed valuation,
// runway, and PoS into one cross-case view. Deliberately reuses only what
// each case already computes for itself (computeCaseValuation,
// computeForwardRunway, computePoSWeighting, solveImpliedPoSMultiplier) —
// no new data source, no live fetch, consistent with every build this whole
// phase. A case that errors out (incomplete inputs) is included with an
// error flag rather than silently dropped, so a broken case doesn't just
// disappear from the portfolio without explanation.
function computePortfolioSummary(cases) {
  return cases.map(theCase => {
    try {
      const discountRateBasePct = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      const tv = theCase.terminalValue || { enabled: false };
      const baseScenario = getEffectiveScenarioPreset(theCase, "base");
      const valMethod = theCase.valuationMethod || "dcf";
      const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };
      const result = valMethod === "multiple"
        ? computeSimpleMultipleValuation(theCase, baseScenario, "base", numOr(multipleAssumptions.base, 3), discountRateBasePct)
        : computeCaseValuation(theCase, baseScenario, "base", discountRateBasePct, tv);

      const runway = computeForwardRunway(theCase);
      const price = numOr(theCase.currentPrice, 0);
      const fairValue = result.equity.perShare;
      const upsidePct = (price > 0 && fairValue != null) ? ((fairValue - price) / price) * 100 : null;

      const primaryProgram = theCase.programs && theCase.programs[0];
      let modeledPoSPct = null;
      if (primaryProgram) {
        const posW = computePoSWeighting(primaryProgram);
        const rawPct = primaryProgram.posOverridePct !== "" && primaryProgram.posOverridePct != null
          ? Number(primaryProgram.posOverridePct) : posW.posToLaunch * 100;
        // Reflects the case-level Base-PoS adjustment (baseScenario.posMultiplierPct
        // is 100 when unset, so this is a no-op for cases without one) so this
        // column matches what actually feeds fairValue above, not the pre-adjustment
        // program-only figure.
        modeledPoSPct = Math.max(0, Math.min(100, rawPct * (baseScenario.posMultiplierPct / 100)));
      }

      const cashRaw = (theCase.capitalStructure || {}).cash;
      const cashEntered = cashRaw !== "" && cashRaw != null;
      let impliedPoSPct = null;
      if (valMethod === "dcf" && theCase.programs && theCase.programs.length === 1 && price > 0) {
        const solved = solveImpliedPoSMultiplier(theCase, discountRateBasePct, tv);
        if (solved.ok && solved.impliedAbsolutePct != null) impliedPoSPct = solved.impliedAbsolutePct;
      }

      return {
        id: theCase.id, name: theCase.name || "Untitled case", error: null,
        price, fairValue, upsidePct,
        // null = no cash entered (unknown); runwayOutlasts = cash entered and
        // the modelled balance never runs out inside the projection. Both
        // used to collapse: a blank cash field read as 0.0 years (in red) and
        // a case that turns cash-positive (Stoke) as a bare dash.
        runwayYears: cashEntered ? runway.runwayYears : null,
        runwayOutlasts: cashEntered && runway.runwayYears == null,
        programName: primaryProgram ? (primaryProgram.drugName || primaryProgram.name) : null,
        therapeuticArea: primaryProgram ? primaryProgram.therapeuticArea : null,
        modality: primaryProgram ? primaryProgram.modality : null,
        currentPhase: primaryProgram ? primaryProgram.currentPhase : null,
        modeledPoSPct, impliedPoSPct,
        programCount: theCase.programs ? theCase.programs.length : 0
      };
    } catch (e) {
      return { id: theCase.id, name: theCase.name || "Untitled case", error: e.message };
    }
  });
}

// ── Full-case Monte Carlo — the capstone of this build phase, deliberately
// last per two independent external models' own advice, and built to reuse
// as much already-proven machinery as possible rather than invent a new
// methodology: computeCaseValuation itself (unchanged, called thousands of
// times with a freshly sampled synthetic scenario each trial), the exact
// same triangular-sampling and Pearson-correlation functions the Peak Sales
// Monte Carlo in Simulation already uses and has been verified against, and
// the Bear/Base/Bull bounds a case already defines (respecting any per-case
// override via getEffectiveScenarioPreset) as the natural distribution
// anchors — Base as the triangular mode, Bear/Bull as the low/high bounds —
// rather than asking for three more numbers no one has a good answer for.
// Deliberately doesn't vary launch timing — the existing three-point
// scenario system doesn't either, and this stays consistent with it rather
// than introducing a new axis of variation nothing else in the app has.
function computeFullCaseMonteCarlo(theCase, discountRateBasePct, terminalValueParams, iterations) {
  iterations = iterations || 3000;
  const bear = getEffectiveScenarioPreset(theCase, "bear");
  const bull = getEffectiveScenarioPreset(theCase, "bull");
  const base = getEffectiveScenarioPreset(theCase, "base");
  const valMethod = theCase.valuationMethod || "dcf";
  const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };

  const posLow = Math.min(bear.posMultiplierPct, bull.posMultiplierPct), posHigh = Math.max(bear.posMultiplierPct, bull.posMultiplierPct);
  const shareLow = Math.min(bear.shareMultiplierPct, bull.shareMultiplierPct), shareHigh = Math.max(bear.shareMultiplierPct, bull.shareMultiplierPct);
  const drLow = Math.min(bear.discountRateAddPct, bull.discountRateAddPct), drHigh = Math.max(bear.discountRateAddPct, bull.discountRateAddPct);

  const perShares = [], posSamples = [], shareSamples = [], drSamples = [];
  let errors = 0;

  // Triangular between the Bear and Bull bounds with Base as the most likely
  // value. Two ways this used to go wrong (FIN-010): equal bounds returned a
  // hardcoded 100 (or 0) instead of the bound, and the mode was hardcoded too —
  // so with a case-level Base-PoS adjustment of 50% (Bear 35, Base 50, Bull 65)
  // the mode sat at 100, outside its own range, and sampleTriangular drew
  // values up to ~79, past Bull. The mode is now the case's effective Base,
  // clamped into [low, high]; equal bounds return the bound.
  const tri = (lo, mode, hi) => lo === hi ? lo : sampleTriangular(lo, Math.min(hi, Math.max(lo, mode)), hi);
  for (let i = 0; i < iterations; i++) {
    const sampledPos = tri(posLow, base.posMultiplierPct, posHigh);
    const sampledShare = tri(shareLow, base.shareMultiplierPct, shareHigh);
    const sampledDR = tri(drLow, base.discountRateAddPct, drHigh);
    const trialScenario = { label: "mc", shareMultiplierPct: sampledShare, posMultiplierPct: sampledPos, discountRateAddPct: sampledDR, color: "" };
    try {
      const result = valMethod === "multiple"
        ? computeSimpleMultipleValuation(theCase, trialScenario, null, numOr(multipleAssumptions.base, 3), discountRateBasePct)
        : computeCaseValuation(theCase, trialScenario, null, discountRateBasePct, terminalValueParams);
      const ps = result.equity.perShare;
      if (ps != null && !isNaN(ps)) {
        perShares.push(ps); posSamples.push(sampledPos); shareSamples.push(sampledShare); drSamples.push(sampledDR);
      } else { errors++; }
    } catch (e) { errors++; }
  }

  if (perShares.length === 0) return { ok: false, error: "Every trial failed — check the case's inputs.", iterations, errors };

  const sorted = perShares.slice().sort((a, b) => a - b);
  const pctiles = { p10: percentile(sorted, 0.10), p25: percentile(sorted, 0.25), p50: percentile(sorted, 0.50), p75: percentile(sorted, 0.75), p90: percentile(sorted, 0.90) };
  const mean = perShares.reduce((s, v) => s + v, 0) / perShares.length;

  const drivers = [
    { key: "posMultiplierPct", label: "PoS", correlation: pearsonCorrelation(posSamples, perShares) },
    { key: "shareMultiplierPct", label: "Peak share/revenue", correlation: pearsonCorrelation(shareSamples, perShares) },
    { key: "discountRateAddPct", label: "Discount rate", correlation: pearsonCorrelation(drSamples, perShares) }
  ].sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return { ok: true, iterations, validTrials: perShares.length, errors, mean, percentiles: pctiles, drivers, sortedValues: sorted };
}

// ── Options-implied move (October 2026) ────────────────────────────────────
// Typed in, never fetched: an at-the-money straddle's price is close to the
// expected absolute move to expiry, so straddle ÷ price; from implied
// volatility, the expected absolute move is σ√t × √(2/π). o: { straddle,
// iv (annual %), days (to expiry) }. Null without enough to compute it.
function optionsImpliedMove(o, price) {
  const P = numOr(price, 0);
  const st = numOr(o && o.straddle, 0), iv = numOr(o && o.iv, 0), days = numOr(o && o.days, 0);
  if (st > 0 && P > 0) return { pct: st / P * 100, basis: "straddle" };
  if (iv > 0 && days > 0) return { pct: (iv / 100) * Math.sqrt(days / 365) * Math.sqrt(2 / Math.PI) * 100, basis: "iv" };
  return null;
}
// The move the model expects across the readout: each outcome's value with
// its probability, against today's price. outcomes: [{ prob, value }].
function modelImpliedMove(price, outcomes) {
  const P = numOr(price, 0);
  if (!(P > 0) || !outcomes || !outcomes.length) return null;
  let pct = 0, upP = 0, up = 0, downP = 0, down = 0;
  outcomes.forEach(o => {
    const m = (o.value - P) / P * 100;
    pct += o.prob * Math.abs(m);
    if (m >= 0) { upP += o.prob; up += o.prob * m; } else { downP += o.prob; down += o.prob * m; }
  });
  return { pct, upPct: upP > 0 ? up / upP : null, upProb: upP, downPct: downP > 0 ? down / downP : null, downProb: downP };
}
// One sentence: which prices the bigger swing. Never says which is right.
function readImpliedMove(optionsPct, modelPct) {
  if (!(optionsPct > 0) || !(modelPct > 0)) return null;
  const r = optionsPct / modelPct;
  if (r > 1.25) return { verdict: "Options price a bigger move than your model.", text: "The market expects a swing of about ±" + optionsPct.toFixed(0) + "%; your outcomes average ±" + modelPct.toFixed(0) + "%. Either your win and miss values are closer together than the market thinks, or the options are rich — buying them pays only if the move beats ±" + optionsPct.toFixed(0) + "%." };
  if (r < 0.8) return { verdict: "Your model expects a bigger move than the options price.", text: "Your outcomes average a ±" + modelPct.toFixed(0) + "% move against about ±" + optionsPct.toFixed(0) + "% in the options. Either the market doubts the readout matters as much as your values say, or the options are cheap for the event." };
  return { verdict: "Options and your model expect about the same move.", text: "About ±" + optionsPct.toFixed(0) + "% in the options against ±" + modelPct.toFixed(0) + "% from your outcomes — the size of the swing is not where you and the market differ." };
}

// ── The one-page decision memo (October 2026) ──────────────────────────────
// Everything the memo prints, from the same functions the Overview uses, so
// the memo and the screen cannot disagree. Pure apart from the clock.
function buildDecisionMemo(theCase, today) {
  if (!theCase || !theCase.programs || !theCase.programs.length) return null;
  const now = today || new Date();
  const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
  const tv0 = theCase.terminalValue || { enabled: false };
  const tv = { enabled: tv0.enabled, method: tv0.method, growthPct: tv0.growthPct, exitMultiple: tv0.exitMultiple };
  const price = numOr(theCase.currentPrice, 0) > 0 ? Number(theCase.currentPrice) : null;
  const one = theCase.programs.length === 1;
  const val = k => { try { return computeCaseValuation(theCase, getEffectiveScenarioPreset(theCase, k), k, dr, tv).equity.perShare; } catch (e) { return null; } };
  let ifWorks = null;
  try { ifWorks = computeCaseValuation({ ...theCase, programs: theCase.programs.map(p => ({ ...p, posOverridePct: "100" })) }, SCENARIO_PRESETS.base, "base", dr, tv).equity.perShare; } catch (e) { ifWorks = null; }
  let odds = null, implied = null;
  if (one && price) {
    try {
      const im = solveImpliedPoSMultiplier(theCase, dr, tv);
      if (im && im.ok && !im.degenerate && im.baseAbsolutePct != null) odds = { yoursPct: im.baseAbsolutePct, impliedPct: im.impliedAbsolutePct, gapPts: Math.round(im.impliedAbsolutePct) - Math.round(im.baseAbsolutePct) };
    } catch (e) { odds = null; }
    try {
      const variable = (theCase.programs[0].revenueMode || "quick") === "full" ? "peakShare" : "peakRevenue";
      const iv = solveImpliedVariable(theCase, dr, tv, variable);
      if (iv && iv.ok) implied = { variable, label: iv.label, impliedValue: iv.impliedValue, currentValue: iv.currentValue, suffix: iv.suffix, degenerate: iv.degenerate || null };
    } catch (e) { implied = null; }
  }
  const fresh = computeFreshness(theCase, now);
  let floors = null;
  try {
    const fp = computeFailureFloorPair(theCase);
    if (fp) floors = { active: fp.active, stage: { perShare: fp.stage.perShare, why: floorZeroReason(fp.stage), stageLabel: fp.stage.stageLabel }, burn: fp.burn ? { perShare: fp.burn.perShare, why: floorZeroReason(fp.burn), source: fp.burn.readoutSource } : null };
  } catch (e) { floors = null; }
  let runway = null;
  try {
    const fr = computeForwardRunway(theCase);
    const fac = caseFacilities(theCase);
    runway = { months: fr.runwayMonths, facilities: fac, withFacilitiesMonths: fac.total > 0 ? computeForwardRunway(theCase, { extraCash: fac.total }).runwayMonths : null };
  } catch (e) { runway = null; }
  let options = null;
  const om = theCase.optionsMove;
  if (om && price) {
    const o = optionsImpliedMove(om, price);
    let model = null;
    try {
      const rs = one ? computeReadoutScenarios(theCase, dr, tv) : null;
      if (rs) model = modelImpliedMove(price, rs.rows.map(r => ({ prob: r.prob, value: r.value })));
    } catch (e) { model = null; }
    if (o) options = { pct: o.pct, basis: o.basis, asOf: om.asOf || null, model, reading: model ? readImpliedMove(o.pct, model.pct) : null };
  }
  const p0 = theCase.programs[0];
  return {
    name: theCase.name || "Case", ticker: theCase.ticker || "", date: localDateStamp(now),
    price, scenarios: { bear: val("bear"), base: val("base"), bull: val("bull") }, ifWorks,
    odds, oddsSource: fresh.odds, oddsSourceText: one && posFromSimulator(p0) ? describePosSource(p0.posSource) : "",
    implied, heldFixed: one ? impliedHeldFixed(theCase) : null,
    floors, multiProgram: !one, runway, catalyst: fresh.catalyst, freshness: fresh, options,
    changeMyMind: theCase.memo || {}
  };
}
