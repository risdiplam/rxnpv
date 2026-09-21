// ════════════════════════════════════════════════════════════════════════════
// RxNPV — SCENARIO & SENSITIVITY ENGINE
// Bear/Base/Bull apply multipliers to peak market share, PoS, and discount
// rate. Revenue is rescaled exactly (patient counts scale linearly with
// share by construction — this is not an approximation), then costs/PoS/DCF
// are re-run fresh on the rescaled figures so nothing compounds incorrectly.
// ════════════════════════════════════════════════════════════════════════════
const SCENARIO_PRESETS = {
  bear: { label: "Bear", shareMultiplierPct: 70, posMultiplierPct: 70, discountRateAddPct: 5, color: "var(--red)" },
  base: { label: "Base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "var(--slate)" },
  bull: { label: "Bull", shareMultiplierPct: 130, posMultiplierPct: 130, discountRateAddPct: -2, color: "var(--teal)" }
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
// single source both ValuationPanel's UI and the Monte Carlo engine call,
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

// Exact rescale — patient counts (and thus revenue, since price is unchanged) scale
// linearly with market share by construction, so this is not an approximation.
function scaleRevenueResult(revenueResult, multiplier) {
  const years = revenueResult.years.map(y => ({
    ...y,
    onDrugPatientsUS: Math.round(y.onDrugPatientsUS * multiplier),
    usRevenue: Math.round(y.usRevenue * multiplier),
    exUSRevenue: Math.round(y.exUSRevenue * multiplier),
    totalRevenue: Math.round(y.totalRevenue * multiplier)
  }));
  return {
    ...revenueResult, years,
    peakPatients: Math.round(revenueResult.peakPatients * multiplier),
    peakUSRevenue: Math.round(revenueResult.peakUSRevenue * multiplier),
    peakTotalRevenue: Math.round(revenueResult.peakTotalRevenue * multiplier)
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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
    scaledRevenue = scaleRevenueResult(baseRevenue, scenario.shareMultiplierPct / 100);
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
  const posScaleFactor = posBase.posToLaunch > 0 ? posToLaunch / posBase.posToLaunch : 0;
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
  // the product exactly on target (k^n x rawCum = target) while leaving the
  // first stage at 1.0. Each stage is still capped, so an extreme target can
  // fall short of its own request rather than fabricating a certainty.
  const posStages = (() => {
    const stages = posBase.stages;
    if (!stages.length) return [];
    const factor = effectiveMultiplierPct / 100;
    if (Math.abs(factor - 1) < 1e-12) return stages.map(s => ({ ...s }));
    const k = Math.pow(Math.max(factor, 0), 1 / stages.length);
    let cum = 1;
    return stages.map(s => {
      const reach = cum;
      const scaledPos = clamp01(Math.min(0.99, s.pos * k));
      cum *= scaledPos;
      return { ...s, pos: scaledPos, posToReachStage: clamp01(reach) };
    });
  })();
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
function computeCaseValuation(theCase, scenario, scenarioKey, discountRateBasePct, terminalValueParams) {
  const programVals = theCase.programs.map(p => computeProgramValuation(p, scenario, scenarioKey));
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  const calendar = applyTaxToCalendar(computeCompanyRiskAdjustedCF(programVals, corpGA, 25), theCase.taxation);
  const discountRate = (discountRateBasePct != null && discountRateBasePct !== "" && !isNaN(Number(discountRateBasePct)) ? Number(discountRateBasePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0]) + scenario.discountRateAddPct;

  const scenOv = (scenarioKey && theCase.scenarioOverrides) ? theCase.scenarioOverrides[scenarioKey] : null;
  const effectiveTVParams = (scenOv && scenOv.exitMultiple !== "" && scenOv.exitMultiple != null)
    ? { ...terminalValueParams, exitMultiple: scenOv.exitMultiple }
    : terminalValueParams;

  const npvResult = computeNPV(calendar.map(c => c.riskAdjFCF), discountRate, effectiveTVParams, calendar.map(c => c.revenue));

  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
  let capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  capResult = applyFutureRaise(capResult, theCase.futureRaise, theCase.currentPrice);
  const dilutionPath = computeDilutionPath(theCase, scenario, discountRateBasePct);
  if (dilutionPath.enabled) capResult = { ...capResult, dilutedShares: dilutionPath.finalDilutedShares };
  let equity = computeEquityValue(npvResult.npv, capResult);

  // Priority Review Voucher — tied to a SPECIFIC program's approval (that's
  // literally how PRVs are granted: only upon approval of the qualifying
  // drug), so it's per-program, risk-adjusted by that program's own PoS, and
  // discounted back from that program's own launch year — not a certain,
  // undiscounted windfall. If the drug doesn't get approved, there's no PRV
  // either; this makes that explicit rather than overstating the case.
  const r = discountRate / 100;
  const prvContribution = programVals.reduce((sum, pv) => {
    const prog = theCase.programs.find(p => p.id === pv.id);
    const prv = prog && prog.prv;
    if (!prv || !prv.enabled) return sum;
    const prvRaw = (numOr(prv.valueM, 0)) * 1e6;
    const riskAdjusted = prvRaw * pv.posToLaunch;
    const discounted = pv.launchYearOffset > 0 ? riskAdjusted / Math.pow(1 + r, pv.launchYearOffset) : riskAdjusted;
    return sum + discounted;
  }, 0);
  if (prvContribution > 0) {
    const newEquityValue = equity.equityValue + prvContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, prvValueAdded: prvContribution };
  }

  // Partnership economics — upfront and milestones. Upfront is added
  // directly (near-certain/already-contracted, not PoS-risked or
  // discounted — same treatment as cash). Each milestone is risk-adjusted
  // by the cumulative probability of REACHING its own gate (mirroring how
  // R&D cost itself is weighted, not completing the gate) and discounted
  // from that gate's own expected timing, not lumped in with launch —
  // an earlier milestone is worth more than a later one even at the same
  // face value, exactly as it should be. Royalty revenue is NOT handled
  // here — it's already inside npvResult via getProgramRevenueResult's own
  // substitution, so it doesn't need a second addition.
  let upfrontContribution = 0, milestoneContribution = 0;
  theCase.programs.forEach(prog => {
    const partnership = prog.partnership;
    if (!partnership || !partnership.enabled) return;
    upfrontContribution += (numOr(partnership.upfrontM, 0)) * 1e6;
    if (!partnership.milestones || !partnership.milestones.length) return;
    const posW = computePoSWeighting(prog);
    const rndFull = computeRnDToLaunch(prog);
    let cumYears = 0;
    const yearsToReachStage = {};
    rndFull.items.forEach(item => { yearsToReachStage[item.key] = cumYears; cumYears += item.years; });
    partnership.milestones.forEach(m => {
      const valueM = numOr(m.valueM, 0);
      if (valueM <= 0) return;
      let posToGate, yearsToGate;
      if (m.gate === "launch") {
        posToGate = posW.posToLaunch;
        yearsToGate = rndFull.totalYears;
      } else {
        const stage = posW.stages.find(s => s.key === m.gate);
        posToGate = stage ? stage.posToReachStage : 1; // gate already behind current phase -> certain
        yearsToGate = yearsToReachStage[m.gate] != null ? yearsToReachStage[m.gate] : 0;
      }
      const riskAdjusted = (valueM * 1e6) * posToGate;
      const discounted = yearsToGate > 0 ? riskAdjusted / Math.pow(1 + r, yearsToGate) : riskAdjusted;
      milestoneContribution += discounted;
    });
  });
  const partnershipContribution = upfrontContribution + milestoneContribution;
  if (partnershipContribution > 0) {
    const newEquityValue = equity.equityValue + partnershipContribution;
    equity = { ...equity, equityValue: newEquityValue, perShare: equity.dilutedShares > 0 ? newEquityValue / equity.dilutedShares : null, partnershipValueAdded: partnershipContribution };
  }

  return { programVals, calendar, discountRateUsed: discountRate, npvResult, capResult, equity };
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
    const calendar = applyTaxToCalendar(computeCompanyRiskAdjustedCF([pv], zeroGA, 25), theCase.taxation);
    const scenOv = (scenarioKey && theCase.scenarioOverrides) ? theCase.scenarioOverrides[scenarioKey] : null;
    const effectiveTVParams = (scenOv && scenOv.exitMultiple !== "" && scenOv.exitMultiple != null)
      ? { ...terminalValueParams, exitMultiple: scenOv.exitMultiple } : terminalValueParams;
    const npv = computeNPV(calendar.map(c => c.riskAdjFCF), discountRate, effectiveTVParams, calendar.map(c => c.revenue));
    return { id: p.id, name: p.drugName || p.name, npv: npv.npv, peakRevenue: pv.peakRevenue, posToLaunch: pv.posToLaunch };
  });

  // Company-level G&A drag, discounted on its own (negative contribution)
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  const fullCalendar = computeCompanyRiskAdjustedCF(theCase.programs.map(p => computeProgramValuation(p, scenario, scenarioKey)), corpGA, 25);
  const gaOnlyCF = fullCalendar.map(c => -c.corporateGA);
  const gaNPV = computeNPV(gaOnlyCF, discountRate, { enabled: false }, fullCalendar.map(() => 0));

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
      peakRevenue = getProgramRevenueResult(p, 25).peakTotalRevenue * (scenario.shareMultiplierPct / 100);
    }

    const yearsToPeakFromLaunch = (p.revenueMode || "quick") === "full"
      ? numOr(getRevenueBuild(p).launchCurve.yearsToPeak, 6) : numOr((p.quickRevenue || {}).yearsToPeak, 6);
    const launchYearOffset = resolveLaunchYearOffset(p);
    const yearsToPeakFromToday = launchYearOffset + yearsToPeakFromLaunch;

    const posBase = computePoSWeighting(p);
    const overrideMultiplier = (p.posOverridePct !== "" && p.posOverridePct != null && posBase.posToLaunch > 0)
      ? (Number(p.posOverridePct) / 100) / posBase.posToLaunch : 1;
    const posToLaunch = clamp01(posBase.posToLaunch * (overrideMultiplier * scenario.posMultiplierPct / 100));

    const peakEV = peakRevenue * multiple;
    const riskedEV = peakEV * posToLaunch;
    const pv = riskedEV / Math.pow(1 + r, yearsToPeakFromToday);

    return { id: p.id, name: p.drugName || p.name, peakRevenue, posToLaunch, pv, launchYearOffset, peakEV, riskedEV };
  });

  const npv = programVals.reduce((s, pv) => s + pv.pv, 0);
  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
  let capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  capResult = applyFutureRaise(capResult, theCase.futureRaise, theCase.currentPrice);
  const dilutionPath2 = computeDilutionPath(theCase, scenario, discountRateBasePct);
  if (dilutionPath2.enabled) capResult = { ...capResult, dilutedShares: dilutionPath2.finalDilutedShares };
  const equity = computeEquityValue(npv, capResult);

  // Shape matches computeCaseValuation's return where a field has a real
  // equivalent (equity, capResult, programVals with peakRevenue) so existing
  // UI (scenario cards, EV bridge, the implied-multiple note) works
  // unmodified. `calendar` has no equivalent here — there's no year-by-year
  // cash flow to show — so callers that need it must guard its absence.
  return { programVals, npvResult: { npv }, capResult, equity };
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
  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
  const capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  if (!capResult.dilutedShares || capResult.dilutedShares <= 0) return { ok: false, error: "Set diluted shares first." };

  const targetEquityValue = Number(theCase.currentPrice) * capResult.dilutedShares;

  const equityAt = (posMultiplierPct) => {
    const scenario = { label: "implied", shareMultiplierPct: 100, posMultiplierPct, discountRateAddPct: 0, color: "" };
    // Solving for what TODAY's price implies must use today's actual capital
    // structure — a modeled future raise is a hypothetical overlay on the
    // forward-looking valuation, not something priced into the market today.
    const caseForSolve = theCase.futureRaise ? { ...theCase, futureRaise: null } : theCase;
    const r = computeCaseValuation(caseForSolve, scenario, null, discountRateBasePct, terminalValueParams);
    return r.equity.equityValue;
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
  if (theCase.programs.length === 1) {
    const posInfo = computePoSWeighting(theCase.programs[0]);
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

  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
  const capResult = computeCapitalStructure({ ...capStruct, currentPrice: theCase.currentPrice });
  if (!capResult.dilutedShares || capResult.dilutedShares <= 0) return { ok: false, error: "Set diluted shares first." };
  const targetEquityValue = Number(theCase.currentPrice) * capResult.dilutedShares;

  const equityAtCase = (caseForSolve0) => {
    const caseForSolve = caseForSolve0.futureRaise ? { ...caseForSolve0, futureRaise: null } : caseForSolve0;
    const scenario = { label: "implied", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
    return computeCaseValuation(caseForSolve, scenario, null, discountRateBasePct, terminalValueParams).equity.equityValue;
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
function computeForwardRunway(theCase) {
  const scenario = { label: "unrisked", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
  const programVals = theCase.programs.map(p => computeProgramValuation({ ...p, posOverridePct: "100" }, scenario, null));

  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  // Cash tax is a real outflow, so it belongs in a runway/financing projection
  // just as much as in a valuation.
  const calendar = applyTaxToCalendar(computeCompanyRiskAdjustedCF(programVals, corpGA, 25), theCase.taxation);

  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
  const startingCash = numOr(capStruct.cash, 0);

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
function computeDilutionPath(theCase, scenario, discountRateBasePct) {
  const capStruct = theCase.capitalStructure || { mode: "simple", dilutedSharesSimple: "" };
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
  const raisePrice = numOr(theCase.currentPrice, 0) * (1 - discount);

  // The manual raise's proceeds are real cash on hand before any projected
  // raise, so the runway projection has to see them too — otherwise the model
  // would raise again to cover a gap the user already said was funded.
  let balance = numOr(capStruct.cash, 0) + manualRaiseAmount;
  let shares = capResult0.dilutedShares;
  const path = [];
  let totalRaisedM = 0;

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
        shares += raiseAmount / raisePrice;
        balance += raiseAmount;
        totalRaisedM += raiseAmount / 1e6;
      }
    }
    path.push({ year: y, flow, balanceEnd: balance, dilutedShares: shares, raiseAmount });
  }

  const atHorizon = path[Math.min(horizonYear, path.length - 1)];
  return { enabled: true, finalDilutedShares: atHorizon ? atHorizon.dilutedShares : shares, path, totalRaisedM, horizonYear };
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
function computeRedFlags(theCase) {
  const flags = [];
  const programs = theCase.programs || [];

  programs.forEach(program => {
    const progName = program.drugName || program.name || "Program";

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
        if (benchShare > 0 && overrideShare > benchShare * 2) {
          flags.push({
            programId: program.id, programName: progName, severity: overrideShare > benchShare * 3 ? "high" : "medium",
            message: `Peak share override of ${overrideShare.toFixed(0)}% is well above what the order-of-entry model would predict for the ${ms.orderOfEntry}${ms.orderOfEntry === 1 ? "st" : ms.orderOfEntry === 2 ? "nd" : ms.orderOfEntry === 3 ? "rd" : "th"} entrant among ${ms.numDrugs} drugs (${benchShare.toFixed(0)}%) — real differentiation (efficacy, safety, dosing convenience) would need to be unusually strong to clear a bar this high.`
          });
        }
      }
    }
    // 5. Both PoS-modifier axes set at once, with no explicit override.
    // computePoSModifiers multiplies the two ratios, which assumes the
    // attributes are independent — a real assumption the source doesn't
    // support, and one that compounds into every downstream number. Only
    // flagged while the computed value is actually in use; typing an explicit
    // override is exactly the intended resolution, so it stops flagging then.
    if ((program.posOverridePct === "" || program.posOverridePct == null)) {
      const mods = computePoSModifiers(program);
      if (mods.compoundedAxes) {
        const withMods = computePoSWeighting(program).posToLaunch * 100;
        const withoutMods = computePoSWeighting({ ...program, posBiomarkerUse: "", posDiseaseType: "" }).posToLaunch * 100;
        flags.push({
          programId: program.id, programName: progName, severity: "medium",
          message: `Two PoS attributes are set at once (${mods.applied.map(a => a.label.toLowerCase()).join(" + ")}), lifting cumulative PoS from ${withoutMods.toFixed(1)}% to ${withMods.toFixed(1)}%. Their effects are multiplied on an independence assumption the source doesn't publish, and these categories overlap in practice — worth setting an explicit PoS override instead if that combined figure looks generous.`
        });
      }
    }
  });

  // 6. Case-level: cash runway shorter than the nearest program's own launch timeline.
  // Only runs once cash has actually been entered — an unset field defaults
  // through as $0, which would make every brand-new, not-yet-filled-out case
  // "flag" on a runway of zero. That's not a real tension, just an empty form.
  if (programs.length > 0 && theCase.capitalStructure && theCase.capitalStructure.cash !== "" && theCase.capitalStructure.cash != null) {
    const runway = computeForwardRunway(theCase);
    if (runway.runwayYears != null) {
      const launchTimelines = programs.map(p => ({ name: p.drugName || p.name || "Program", years: resolveLaunchYearOffset(p) }));
      const nearest = launchTimelines.reduce((min, cur) => cur.years < min.years ? cur : min, launchTimelines[0]);
      if (nearest && runway.runwayYears < nearest.years) {
        flags.push({
          programId: null, programName: null, severity: runway.runwayYears < nearest.years * 0.7 ? "high" : "medium",
          message: `Modeled cash runway (${runway.runwayYears.toFixed(1)} years) is shorter than the time to ${nearest.name}'s own modeled launch (${nearest.years.toFixed(1)} years) — reaching that catalyst as modeled would require financing not yet reflected in the capital structure.`
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
function computeSensitivityDrivers(theCase) {
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
            if (!p.costStructure) p.costStructure = {};
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

      const shareSteps = [60, 80, 100, 120, 150, 180];
      const posSteps = [60, 80, 100, 120, 150, 180];
      const cp = theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null;
      gridData = {
        shareSteps, posSteps, currentPrice: cp,
        cells: shareSteps.map(sPct => posSteps.map(pPct => perShareAt(sPct, pPct, null)))
      };
    } catch (e) { error = e.message; }
  }
  return { rows, error, baseline, gridData };
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

      let impliedPoSPct = null;
      if (valMethod === "dcf" && theCase.programs && theCase.programs.length === 1 && price > 0) {
        const solved = solveImpliedPoSMultiplier(theCase, discountRateBasePct, tv);
        if (solved.ok && solved.impliedAbsolutePct != null) impliedPoSPct = solved.impliedAbsolutePct;
      }

      return {
        id: theCase.id, name: theCase.name || "Untitled case", error: null,
        price, fairValue, upsidePct,
        runwayYears: runway.runwayYears,
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
  const valMethod = theCase.valuationMethod || "dcf";
  const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };

  const posLow = Math.min(bear.posMultiplierPct, bull.posMultiplierPct), posHigh = Math.max(bear.posMultiplierPct, bull.posMultiplierPct);
  const shareLow = Math.min(bear.shareMultiplierPct, bull.shareMultiplierPct), shareHigh = Math.max(bear.shareMultiplierPct, bull.shareMultiplierPct);
  const drLow = Math.min(bear.discountRateAddPct, bull.discountRateAddPct), drHigh = Math.max(bear.discountRateAddPct, bull.discountRateAddPct);

  const perShares = [], posSamples = [], shareSamples = [], drSamples = [];
  let errors = 0;

  for (let i = 0; i < iterations; i++) {
    const sampledPos = posLow === posHigh ? 100 : sampleTriangular(posLow, 100, posHigh);
    const sampledShare = shareLow === shareHigh ? 100 : sampleTriangular(shareLow, 100, shareHigh);
    const sampledDR = drLow === drHigh ? 0 : sampleTriangular(drLow, 0, drHigh);
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
