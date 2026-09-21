// ════════════════════════════════════════════════════════════════════════════
// RxNPV — POS RISK-ADJUSTMENT ENGINE
// Standard rNPV methodology: each remaining R&D cost is weighted by the
// probability of REACHING that stage (so you only "pay" for trials you'd
// actually run); every post-launch cash flow is weighted by the cumulative
// probability of reaching launch at all. Mirrors the same phase structure as
// the R&D-to-Launch engine (rdEngine.js) for consistency.
// ════════════════════════════════════════════════════════════════════════════
// ── Program-attribute PoS modifiers (Thomas et al. 2016, Table 14-7) ────────
// Two independent axes, each optional and defaulting to "not specified" so a
// case saved before this existed computes exactly as it did before.
//
// METHOD NOTE, because this is a real choice and not the only defensible one:
// Thomas 2016 publishes ABSOLUTE per-phase success rates for each cohort
// (e.g. Phase 2: 30.7% baseline, 46.7% with selection biomarkers), while this
// app's own phase benchmarks come from a DIFFERENT source keyed by
// therapeutic area. Substituting Thomas's absolute rates would throw away the
// area specificity, which is usually the stronger signal. So each attribute
// is applied as a RELATIVE ratio against Thomas's own baseline
// (46.7/30.7 = 1.52x for biomarkers at Phase 2) and multiplied onto the
// area benchmark. That preserves both: the area sets the base rate, the
// attribute scales it by the effect Thomas actually measured.
const POS_MODIFIER_AXES = {
  biomarkerUse: { selection: "selectionBiomarkers", none: "noBiomarkers" },
  diseaseType:  { rare: "rareDisease", chronicHighPrev: "chronicHighPrevalence" }
};
const POS_MODIFIER_LABELS = {
  selectionBiomarkers: "Selection biomarkers",
  noBiomarkers: "No biomarkers",
  rareDisease: "Rare disease",
  chronicHighPrevalence: "Chronic / high-prevalence"
};

function computePoSModifiers(program) {
  // Read defensively — these fields postdate earlier saved cases.
  const chosen = [];
  const bm = program && program.posBiomarkerUse;
  const dt = program && program.posDiseaseType;
  if (bm && POS_MODIFIER_AXES.biomarkerUse[bm]) chosen.push(POS_MODIFIER_AXES.biomarkerUse[bm]);
  if (dt && POS_MODIFIER_AXES.diseaseType[dt]) chosen.push(POS_MODIFIER_AXES.diseaseType[dt]);

  const ratios = { phase1: 1, phase2: 1, phase3: 1 };
  let regulatoryDeltaPct = 0;
  const applied = [];

  chosen.forEach(key => {
    const row = POS_MODIFIERS[key];
    if (!row) return;
    const perPhase = {};
    ["phase1", "phase2", "phase3"].forEach(ph => {
      const r = row[ph] / POS_MODIFIERS.baseline[ph];
      perPhase[ph] = r;
      ratios[ph] *= r;
    });
    const regDelta = (POS_REGULATORY_MODIFIERS.thomas2016 || {})[key];
    if (regDelta != null) regulatoryDeltaPct += regDelta;
    applied.push({ key, label: POS_MODIFIER_LABELS[key] || key, perPhase, regulatoryDeltaPct: regDelta != null ? regDelta : 0 });
  });

  return {
    applied,
    ratios,
    regulatoryDeltaPct,
    // Both axes set at once multiplies two ratios, which assumes the two
    // effects are independent. Thomas 2016 doesn't publish the joint cell, and
    // the categories plainly overlap in practice (rare diseases are often
    // biomarker-defined), so that assumption likely overstates the combined
    // lift. Flagged rather than silently corrected — the size of the overlap
    // isn't something this app can honestly estimate.
    compoundedAxes: applied.length > 1,
    source: POS_MODIFIERS.source
  };
}

// ── Molecule-type PoS adjustment ───────────────────────────────────────────
// POS_BY_MOLECULE was sourced and displayed but never reached the PoS
// calculation, even though every program already carries a modality that
// drives COGS and erosion. Biologics clear Phase 2 at 42.9% against a 30.7%
// baseline — a ~40% relative uplift the model was ignoring.
//
// Composed as a RATIO against POS_BY_MOLECULE.all, exactly as the biomarker/
// disease-type modifiers are composed against POS_MODIFIERS.baseline. That is
// the only correct composition here: the app's area benchmarks are a blended
// base case, so a raw cohort figure can't be substituted for one directly —
// see the same reasoning already applied to the Thomas modifiers. Conveniently
// POS_BY_MOLECULE.all and POS_MODIFIERS.baseline are the identical
// 63.2/30.7/58.1 triple, so both axes share one baseline.
//
// Cell and gene therapy deliberately get NO adjustment. The underlying sources
// (DiMasi 2010 through Thomas 2016) predate any meaningful cell/gene cohort,
// and their "biologic" bucket is monoclonals and proteins. Mapping gene
// therapy onto that number because both happen to file as BLAs would be
// inventing a datapoint, not sourcing one.
const POS_MOLECULE_KEY_BY_MODALITY = {
  smallMolecule: "nme",
  biologic: "biologic",
  cellTherapy: null,
  geneTherapy: null
};

function computeMoleculeTypePoSRatios(modality) {
  const key = POS_MOLECULE_KEY_BY_MODALITY[modality];
  const none = { ratios: { phase1: 1, phase2: 1, phase3: 1 }, applied: false, key: null };
  if (!key) return none;
  const row = POS_BY_MOLECULE[key], base = POS_BY_MOLECULE.all;
  if (!row || !base) return none;
  const ratios = {};
  ["phase1", "phase2", "phase3"].forEach(ph => {
    ratios[ph] = base[ph] > 0 ? row[ph] / base[ph] : 1;
  });
  return { ratios, applied: true, key, source: POS_BY_MOLECULE.source };
}

function computePoSWeighting(program) {
  const area = program.therapeuticArea;
  const idx = RD_PHASE_ORDER.indexOf(program.currentPhase);
  const stages = [];
  const mods = computePoSModifiers(program);
  const molecule = computeMoleculeTypePoSRatios(program && program.modality);
  // Never let a modifier push a stage to a certainty — no attribute makes a
  // trial a sure thing, and an uncapped ratio on an already-high area
  // benchmark could otherwise exceed 100% outright. The cap sits after BOTH
  // axes so their product can't sneak past it either.
  // Track when the cap actually binds. Silently returning 99% hides the fact
  // that the composition produced something impossible: with three
  // multiplicative axes (biomarker, disease type, molecule type) a favourable
  // combination can compute well past 100% — a Hematology biologic with a
  // selection biomarker in a rare disease lands near 198% at Phase 2 before
  // clamping. The clamp is the right guard, but the user needs to know the
  // model left its supported range rather than seeing a confident 99%.
  let cappedStages = 0, maxUncapped = 0;
  const applyMod = (posPct, phaseKey) => {
    const raw = posPct * mods.ratios[phaseKey] * molecule.ratios[phaseKey];
    if (raw > maxUncapped) maxUncapped = raw;
    if (raw > 99) cappedStages++;
    return Math.min(99, raw);
  };

  if (idx <= 0) stages.push({ key: "phase1", label: "Phase 1", pos: applyMod(getPosForArea(area, "phase1").value, "phase1") / 100, source: getPosForArea(area, "phase1").source });
  if (idx <= 1) stages.push({ key: "phase2", label: "Phase 2", pos: applyMod(getPosForArea(area, "phase2").value, "phase2") / 100, source: getPosForArea(area, "phase2").source });
  if (idx <= 2) stages.push({ key: "phase3", label: "Phase 3", pos: applyMod(getPosForArea(area, "phase3").value, "phase3") / 100, source: getPosForArea(area, "phase3").source });
  // Regulatory modifiers are published as additive percentage points, not
  // ratios, so they're applied that way rather than converted.
  if (idx <= 3) stages.push({ key: "regulatory", label: "Regulatory", pos: Math.min(99, Math.max(1, POS_REGULATORY.median + mods.regulatoryDeltaPct)) / 100, source: POS_REGULATORY.source });

  let cum = 1; // probability of having reached the start of the next stage in the list
  stages.forEach(s => {
    s.posToReachStage = cum; // probability you get here at all (what R&D cost for this stage should be weighted by)
    cum *= s.pos;
  });
  const posToLaunch = cum; // probability of clearing every remaining stage — weight for all post-launch cash flows

  // Count every multiplicative axis actually in play, so the existing
  // "effects are multiplied" caution reflects all of them rather than only
  // the two selectable attributes.
  const axesApplied = mods.applied.length + (molecule.applied ? 1 : 0);
  return {
    stages, posToLaunch, modifiers: mods, moleculeType: molecule,
    axesApplied,
    capBound: cappedStages > 0,
    cappedStages,
    maxUncappedPct: maxUncapped
  };
}

// ── Apply PoS weighting to a program's R&D-to-launch cost breakdown ──
// (Each stage's cost × probability of reaching it — not completing it.)
function riskAdjustRnDCost(rnd, posWeighting) {
  const byKey = {};
  posWeighting.stages.forEach(s => { byKey[s.key] = s.posToReachStage; });
  const items = rnd.items.map(it => ({
    ...it,
    posToReachStage: byKey[it.key] != null ? byKey[it.key] : 1,
    riskAdjCostM: it.costM * (byKey[it.key] != null ? byKey[it.key] : 1)
  }));
  return { items, totalRiskAdjCostM: items.reduce((s, i) => s + i.riskAdjCostM, 0) };
}
