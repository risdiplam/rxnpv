// ════════════════════════════════════════════════════════════════════════════
// Program factory + editor
// ════════════════════════════════════════════════════════════════════════════
function newProgram() {
  return {
    id: newId("prog"),
    name: "New Program",
    drugName: "",
    indication: "",
    therapeuticArea: "Oncology",
    modality: "smallMolecule", // 'smallMolecule' | 'biologic' | 'cellTherapy' | 'geneTherapy' — see MODALITY_OPTIONS
    currentPhase: "phase2",
    posOverridePct: "", // optional per-drug PoS override — blank means use the area/phase benchmark
    // Program attributes that measurably shift PoS (Thomas et al. 2016) —
    // blank means "not specified", which computes exactly as before these existed.
    posBiomarkerUse: "", // "" | "selection" | "none"
    posDiseaseType: "",  // "" | "rare" | "chronicHighPrev"
    prv: { enabled: false, valueM: "150" }, // Priority Review Voucher — tied to this program's own approval
    launchYearOffset: "", // years from Case Year 0 — blank means use the R&D-computed timeline (consistent with every other override in this app); type a number to set it explicitly, including 0 for "launches immediately / already on market"
    revenueMode: "quick", // 'quick' | 'full' — quick starts every new program so a first valuation is fast
    quickRevenue: { peakRevenue: "", yearsToPeak: "6", profile: "median",
      scenarioOverrides: { bear: { peakRevenue: "" }, bull: { peakRevenue: "" } } },
    revenueBuild: {
      population: { mode: "prevalence", prevalence: "", incidence: "", diseaseDurationYears: "", diagnosisRatePct: "", treatmentRatePct: "", eligiblePct: "100" },
      adherencePct: "",
      marketShare: { numDrugs: 2, orderOfEntry: 1, peakShareOverridePct: "" },
      launchCurve: { yearsToPeak: 6, profile: "median" },
      pricing: { usAnnualPrice: "", priceBasis: "ASP", netPriceRealizationPct: "", usAnnualGrowthPct: "3", includeExUS: true, exUSPriceFactorPct: "50", exUSAnnualGrowthPct: "0", exUSPatientMultiplierPct: "100" },
      exclusivity: { yearsToLOE: "13", modality: "smallMolecule", volumeRetainedPct: "", priceDeclinePct: "" }
    },
    costStructure: {
      cogsPct: "",
      reps: { primaryCare: "", specialty: "", hospital: "" },
      marketingPctOfPeak: ""
    },
    rndOverride: { totalYears: "", totalCostM: "" },
    // Evidence log — a place for the "why" behind a judgment-call input to
    // live inside the case itself, rather than in a separate document that
    // drifts out of sync. Deliberately freeform per entry (a label, not a
    // rigid field-name binding) so it holds general program-level thesis
    // notes as well as per-field justifications, and doesn't break if a
    // field gets renamed later. Classification and confidence intentionally
    // mirror the exact vocabulary the Biotech Agent research system already
    // uses (Fact/Inference/Speculation; High/Moderate/Low) so transcribing
    // agent output in here is a direct copy, not a translation.
    evidenceLog: [],
    // Calibration log — record a PoS prediction (yours and the market's
    // implied one) before a catalyst resolves, then the actual outcome
    // after. Deliberately started now even though it's small: its value is
    // purely a function of time — every catalyst not logged is a data point
    // that can never be recovered later. Brier score (lower is better,
    // 0 = perfect) computed once an outcome is recorded, comparing your own
    // calibration against the market's over time.
    calibrationLog: [],
    // Partnership economics — an optional overlay, not a third revenue mode.
    // Quick/Detailed still answer "what's total peak revenue if this company
    // captured all of it"; this answers "how much of that actually flows to
    // the company once a partner is involved." royaltyPct substitutes the
    // partnered territory's revenue (never adds alongside it, to avoid
    // double-counting against Detailed mode's own ex-US modeling). Upfront
    // is a direct, undiscounted add; each milestone is risk-adjusted to its
    // own gate and discounted from its own expected timing, not lumped in
    // with launch.
    partnership: { enabled: false, territory: "exUS", royaltyPct: "", upfrontM: "", costSharingPct: "", milestones: [] }
  };
}

function ProgramEditor({ program, onChange, onDelete, discountRatePct, terminalValue, valuationMethod, basePosAdjustmentPct, onNavigateToTools }) {
  const h = React.createElement;
  // Read through the shared normalizer rather than dereferencing directly:
  // a program missing (or partially missing) revenueBuild would otherwise
  // throw during render and take down the whole React tree, not just this
  // panel. Every rb.* read below depends on this.
  const rb = getRevenueBuild(program);
  // Scratch state for the biomarker eligible-% calculator below — intentionally
  // not persisted onto the program: it's a way to arrive at eligiblePct, not a
  // second stored copy of it that could drift from the value in use.
  const [eligibleHelper, setEligibleHelper] = React.useState({ biomarkerPrevalence: "", testingRate: "" });
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const set = (path, val) => {
    const next = JSON.parse(JSON.stringify(program));
    // Backfill revenueBuild before walking the path, so writing to
    // e.g. "revenueBuild.population.prevalence" can't crash on a program
    // that doesn't have that sub-object yet.
    if (path.indexOf("revenueBuild") === 0) next.revenueBuild = getRevenueBuild(next);
    let obj = next;
    const parts = path.split(".");
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = val;
    // keep exclusivity.modality synced with program.modality — backfill first
    // so this is safe on a program missing that sub-object
    if (path === "modality") { next.revenueBuild = getRevenueBuild(next); next.revenueBuild.exclusivity = { ...next.revenueBuild.exclusivity, modality: val }; }
    onChange(next);
  };

  const areaKey = program.therapeuticArea;
  const phaseKey = program.currentPhase;
  const posInfo = getPosForArea(areaKey, phaseKey);
  const trialCostInfo = getTrialCostForArea(areaKey, phaseKey);
  const trialDurInfo = getTrialDurationForArea(areaKey, phaseKey === "phase1" ? "phase2" : phaseKey); // duration table has no phase1 col
  const rnd = computeRnDToLaunch(program);
  const rndOv = program.rndOverride || { totalYears: "", totalCostM: "" };
  const rndYearsUsed = rndOv.totalYears !== "" ? Number(rndOv.totalYears) : rnd.totalYears;

  // adherence benchmark: chronic base 70 vs acute 85 — use disease-duration as heuristic
  const isChronic = rb.population.mode === "incidence" ? Number(rb.population.diseaseDurationYears) > 2 : true;
  const adherenceBench = { value: isChronic ? ADHERENCE_BENCHMARKS.chronicAmbulatoryBase : ADHERENCE_BENCHMARKS.acuteAvg, source: ADHERENCE_BENCHMARKS.source + (isChronic ? " (chronic ambulatory base)" : " (acute average)") };

  const revenueMode = program.revenueMode || "quick";
  const quick = program.quickRevenue || { peakRevenue: "", yearsToPeak: "6", profile: "median" };
  let result = null, error = null;
  try {
    result = getProgramRevenueResult(program, 25);
  } catch (e) { error = e.message; }

  const cs = program.costStructure || { cogsPct: "", reps: {}, marketingPctOfPeak: "" };
  const cogsBench = getCogsBenchmark(program.modality);
  let pnl = null;
  if (result) {
    try {
      pnl = computeProgramPnL(result, {
        cogsPct: cs.cogsPct !== "" ? cs.cogsPct : cogsBench.value,
        reps: { primaryCare: cs.reps.primaryCare || 0, specialty: cs.reps.specialty || 0, hospital: cs.reps.hospital || 0 },
        marketingPctOfPeak: cs.marketingPctOfPeak !== "" ? cs.marketingPctOfPeak : MARKETING_BENCHMARKS.baseCasePctOfPeakRevenue,
        yearsToLOE: rb.exclusivity.yearsToLOE,
        launchYearOffset: program.launchYearOffset
      });
    } catch (e) {}
  }

  const chartSeries = result ? [{ name: (program.drugName || program.name) + " — US", color: "var(--teal)", points: result.years.map(y => ({ v: y.usRevenue, label: y.year })) },
    rb.pricing.includeExUS ? { name: (program.drugName || program.name) + " — Total (US + ex-US)", color: "var(--amber)", points: result.years.map(y => ({ v: y.totalRevenue, label: y.year })) } : null,
    pnl ? { name: (program.drugName || program.name) + " — Product contribution", color: "var(--slate)", points: pnl.map(y => ({ v: y.productContribution, label: y.year })) } : null
  ].filter(Boolean) : [];

  return h("div", { style: { marginBottom: 30 } },
    // Header
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" } },
      h("input", {
        value: program.name, onChange: e => set("name", e.target.value), "aria-label": "Program name",
        style: { fontFamily: "var(--display)", fontSize: 20, fontWeight: 700, color: "var(--ink-1)", background: "transparent", border: "none", borderBottom: "2px solid var(--rule)", padding: "2px 0", flex: "1 1 240px", minWidth: 180 }
      }),
      h("button", { onClick: () => setConfirmingDelete(true), style: { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--red)", background: "transparent", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Remove program")
    ),

    // Same one-click-and-it's-gone problem as Delete case, at the program
    // level — a program carries its own revenue build, Evidence Log and
    // Calibration Log, all lost with no confirmation before this existed.
    confirmingDelete && h(ConfirmDialog, {
      title: "Remove " + (program.drugName || program.name || "this program") + "?",
      message: "This removes its revenue build, cost structure, Evidence Log and Calibration Log entries. This can't be undone.",
      confirmLabel: "Remove program",
      onCancel: () => setConfirmingDelete(false),
      onConfirm: () => { setConfirmingDelete(false); onDelete(); }
    }),

    // Identity row
    h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 } },
      h("div", { style: { flex: "1 1 180px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Drug name"),
        h("input", { value: program.drugName, onChange: e => set("drugName", e.target.value), placeholder: "e.g. XYZ-101",
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } })),
      h("div", { style: { flex: "1 1 180px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Indication"),
        h("input", { value: program.indication, onChange: e => set("indication", e.target.value), placeholder: "e.g. 2L NSCLC",
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } })),
      h("div", { style: { flex: "1 1 180px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Therapeutic area"),
        h("select", { "aria-label": "Therapeutic area", value: program.therapeuticArea, onChange: e => set("therapeuticArea", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          THERAPEUTIC_AREAS.map(a => h("option", { key: a, value: a }, a))),
        h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } }, "Drives benchmarks below")),
      h("div", { style: { flex: "1 1 140px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Modality"),
        h("select", { "aria-label": "Modality", value: program.modality, onChange: e => set("modality", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          MODALITY_OPTIONS.map(m => h("option", { key: m.value, value: m.value }, m.label)))),
      h("div", { style: { flex: "1 1 140px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Current phase"),
        h("select", { "aria-label": "Current phase", value: program.currentPhase, onChange: e => set("currentPhase", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          ["phase1","phase2","phase3","filed","approved"].map(p => h("option", { key: p, value: p }, p.replace("phase","Phase "))))),
      h("div", { style: { flex: "1 1 140px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Launch in year (from today)"),
        h("input", { type: "number", value: program.launchYearOffset, onChange: e => set("launchYearOffset", e.target.value),
          placeholder: "e.g. " + Math.round(rndYearsUsed),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }))
    ),

    // ── 0. R&D to Launch ──
    h(SectionCard, { title: "R&D to Launch", subtitle: "Remaining time and cost to launch, area-specific — benchmarks apply below, expand to customize", defaultOpen: false },
      // Deliberately NOT hidden wholesale in Simple Multiple mode. The stage
      // TIMELINE still matters there — it sets how many years the value is
      // discounted back across — while the per-stage costs are read by nothing.
      // Hiding the section would take a live input away with it.
      methodIgnores(valuationMethod, "rndCost") && h("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 10px", borderRadius: 7, background: "var(--surface-2)", border: "1px dashed var(--rule)", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 10 } },
        h("span", { style: { color: "var(--amber)", flexShrink: 0 } }, "◇"),
        h("span", null, "Simple Multiple reads the ", h("b", { style: { color: "var(--ink-2)" } }, "timeline"), " here — it sets how far back the value is discounted — but not the ", h("b", { style: { color: "var(--ink-2)" } }, "costs"), ". Switch to DCF to have R&D spend affect the valuation.")),
      rnd.items.length === 0
        ? h("div", { style: { flex: "1 1 100%", fontSize: 12, fontFamily: "var(--mono)", color: "var(--green)" } }, "Already approved — nothing remaining.")
        : h("div", { style: { flex: "1 1 100%" } },
            h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } },
              rnd.items.map((it, i) => h("div", { key: i, style: {
                  display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, fontFamily: "var(--mono)",
                  padding: "7px 12px", background: "var(--surface-2)", borderRadius: 6
                } },
                h("span", { style: { color: "var(--ink-1)" } }, it.label),
                h("span", { style: { color: "var(--ink-2)" } }, it.years.toFixed(1) + "yr · $" + it.costM.toFixed(1) + "M")
              ))
            ),
            h("div", { style: { display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" } },
              h("div", null,
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Total time to launch"),
                h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--teal)" } }, rnd.totalYears.toFixed(1) + "yr")),
              h("div", null,
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Total cost to launch"),
                h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, "$" + rnd.totalCostM.toFixed(1) + "M"))
            ),
            h(BenchField, { label: "Override total years (optional)", value: rndOv.totalYears, onChange: v => set("rndOverride.totalYears", v), suffix: "yr",
              bench: { value: rnd.totalYears.toFixed(1), source: "Computed from the breakdown above" } }),
            h(BenchField, { label: "Override total cost (optional)", value: rndOv.totalCostM, onChange: v => set("rndOverride.totalCostM", v), suffix: "$M",
              bench: { value: rnd.totalCostM.toFixed(1), source: "Computed from the breakdown above" } }),
            h("button", {
              onClick: () => set("launchYearOffset", Math.round(rndYearsUsed)),
              style: { marginTop: 6, padding: "7px 16px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: "pointer" }
            }, "Apply → set launch year to " + Math.round(rndYearsUsed)),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 } },
              "Assumes \"current phase\" means the program is at the start of that phase — full remaining cost/time for it and everything after. Phase 2/3 durations are area-specific; costs use the weighted-average \"typical asset\" benchmark (area-specific patient counts aren't available to scale per-patient cost).")
          )
    ),

    // ── Revenue mode toggle ──
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } },
      h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Revenue build:"),
      h("div", { style: { display: "flex", gap: 6 } },
        [["quick","Quick — enter peak revenue directly"],["full","Full — build up from population & pricing"]].map(([id,lbl]) => h("button", {
          key: id, onClick: () => set("revenueMode", id),
          style: { padding: "6px 14px", borderRadius: 7, border: "1px solid " + (revenueMode === id ? "var(--teal)" : "var(--rule)"),
            background: revenueMode === id ? "var(--teal-bg)" : "transparent", color: revenueMode === id ? "var(--teal)" : "var(--ink-2)",
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: revenueMode === id ? 700 : 400, cursor: "pointer" }
        }, lbl))
      )
    ),

    // ── Quick Revenue (quick mode only) ──
    revenueMode === "quick" && h(SectionCard, { title: "Quick Revenue", subtitle: "Enter your own peak revenue estimate — skips the population/pricing build-up below", defaultOpen: true },
      h(MillionsField, { label: "Peak worldwide revenue estimate", value: quick.peakRevenue, onChange: v => set("quickRevenue.peakRevenue", v),
        help: "Enter in millions (e.g. 800 for $800M). Anchor to a comparable marketed drug's peak sales, or a quick TAM × penetration guess." }),
      h(BenchField, { label: "Years to peak", value: quick.yearsToPeak, onChange: v => set("quickRevenue.yearsToPeak", v), suffix: "yrs",
        bench: { value: 6, source: LAUNCH_CURVE.source + " — 6yr median" } }),
      h("div", { style: { flex: "1 1 200px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Ramp shape"),
        h("select", { "aria-label": "Ramp shape", value: quick.profile, onChange: e => set("quickRevenue.profile", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          h("option", { value: "p25" }, "Slow (25th pctile)"), h("option", { value: "median" }, "Median"), h("option", { value: "p75" }, "Fast (75th pctile)"))),
      h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } },
        "LOE timing and erosion still apply below. Switch to Full for a bottoms-up build instead of a direct peak-revenue guess.")
    ),

    // ── 1. Population ── (full mode only)
    revenueMode === "full" && h(SectionCard, { title: "Step 1 of 5 · Addressable Population", subtitle: "Prevalence/incidence → diagnosed → treated → eligible for this drug" },
      h("div", { style: { flex: "1 1 100%", display: "flex", gap: 10, marginBottom: 10 } },
        ["prevalence", "incidence"].map(m => h("button", {
          key: m, onClick: () => set("revenueBuild.population.mode", m),
          style: { padding: "5px 14px", borderRadius: 6, border: "1px solid " + (rb.population.mode === m ? "var(--teal)" : "var(--rule)"), background: rb.population.mode === m ? "var(--teal-bg)" : "transparent", color: rb.population.mode === m ? "var(--teal)" : "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" }
        }, m === "prevalence" ? "I know prevalence" : "I know incidence"))
      ),
      rb.population.mode === "prevalence"
        ? h(BenchField, { label: "Prevalence (existing cases, target region)", value: rb.population.prevalence, onChange: v => set("revenueBuild.population.prevalence", v), placeholder: "e.g. 20000", suffix: "pts" })
        : h(React.Fragment, null,
            h(BenchField, { label: "Annual incidence (new cases/yr)", value: rb.population.incidence, onChange: v => set("revenueBuild.population.incidence", v), placeholder: "e.g. 50000", suffix: "pts/yr" }),
            h(BenchField, { label: "Disease duration (yrs pt lives w/ disease)", value: rb.population.diseaseDurationYears, onChange: v => set("revenueBuild.population.diseaseDurationYears", v), placeholder: "e.g. 5", suffix: "yrs",
              help: "Prevalence = Incidence × Disease duration" })
          ),
      h(BenchField, { label: "Diagnosis rate", value: rb.population.diagnosisRatePct, onChange: v => set("revenueBuild.population.diagnosisRatePct", v), suffix: "%", placeholder: "% of cases diagnosed" }),
      h(BenchField, { label: "Treatment rate", value: rb.population.treatmentRatePct, onChange: v => set("revenueBuild.population.treatmentRatePct", v), suffix: "%", placeholder: "% of diagnosed who get treated" }),
      h(BenchField, { label: "Eligible subgroup", value: rb.population.eligiblePct, onChange: v => set("revenueBuild.population.eligiblePct", v), suffix: "%",
        help: "Narrow further for biomarker-selected / line-of-therapy / severity subgroup" }),
      // For a biomarker-selected drug this single number quietly bundles two
      // very different things — how many patients carry the marker, and how
      // many actually get tested for it. Real-world testing rates are often
      // well below 100%, and that gap is a commercial risk worth seeing
      // separately. This is a calculator that writes into the field above,
      // deliberately NOT extra stored fields feeding the engine: one input
      // stays the single source of truth, so there's no way for a stored
      // breakdown to silently disagree with the number actually being used.
      program.posBiomarkerUse === "selection" && (() => {
        const bp = eligibleHelper.biomarkerPrevalence, tr = eligibleHelper.testingRate;
        const computed = (bp !== "" && tr !== "") ? (Number(bp) * Number(tr) / 100) : null;
        const fieldStyle = { width: 90, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };
        return h("div", { style: { flex: "1 1 100%", marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8, lineHeight: 1.6 } },
            "This program uses a selection biomarker — optional helper to build the eligible % from its two parts:"),
          h("div", { style: { display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" } },
            h("div", null, h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 } }, "Biomarker prevalence %"),
              h("input", { type: "number", value: bp, placeholder: "e.g. 30", style: fieldStyle,
                onChange: e => setEligibleHelper({ ...eligibleHelper, biomarkerPrevalence: e.target.value }) })),
            h("span", { style: { fontSize: 12, color: "var(--ink-3)", paddingBottom: 6 } }, "×"),
            h("div", null, h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 } }, "Tested in practice %"),
              h("input", { type: "number", value: tr, placeholder: "e.g. 70", style: fieldStyle,
                onChange: e => setEligibleHelper({ ...eligibleHelper, testingRate: e.target.value }) })),
            computed != null && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", paddingBottom: 6 } },
              "= ", h("b", { style: { color: "var(--amber)" } }, computed.toFixed(1) + "%")),
            computed != null && h("button", { onClick: () => set("revenueBuild.population.eligiblePct", String(Math.round(computed * 10) / 10)),
              style: { padding: "5px 10px", borderRadius: 5, border: "1px solid var(--amber)", background: "transparent", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" }
            }, "Use as eligible % →")));
      })()
    ),

    // ── 2-5. Adherence, Market Share, Launch Curve, Pricing (full mode only) ──
    revenueMode === "full" && h(React.Fragment, null,
    h(SectionCard, { title: "Step 2 of 5 · Adherence", subtitle: "Discounts treated patients for real-world persistence/compliance" },
      h(BenchField, { label: "Adherence / persistence rate", value: rb.adherencePct, onChange: v => set("revenueBuild.adherencePct", v), suffix: "%", bench: adherenceBench,
        help: "Asymptomatic/chronic conditions run 50-70% MPR; high-severity (leukemia, MS) can exceed 80%." })
    ),

    // ── 3. Market share ──
    h(SectionCard, { title: "Step 3 of 5 · Peak Market Share", subtitle: "Order-of-entry model — first mover retains outsized share, decaying with more competitors" },
      h(CompetitorScanBox, {
        indication: program.indication,
        drugName: program.drugName,
        currentNumDrugs: rb.marketShare.numDrugs,
        onApplyNumDrugs: (n) => set("revenueBuild.marketShare.numDrugs", n)
      }),
      h("div", { style: { flex: "1 1 200px", marginBottom: 14 } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Total drugs in market at peak (incl. this one)"),
        h("select", { "aria-label": "Total drugs in market at peak (incl. this one)", value: rb.marketShare.numDrugs, onChange: e => set("revenueBuild.marketShare.numDrugs", Number(e.target.value)),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          [1,2,3,4,5].map(n => h("option", { key: n, value: n }, n === 1 ? "1 (monopoly)" : n)))),
      rb.marketShare.numDrugs > 1 && h("div", { style: { flex: "1 1 200px", marginBottom: 14 } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "This drug's order of entry"),
        h("select", { "aria-label": "This drug's order of entry", value: rb.marketShare.orderOfEntry, onChange: e => set("revenueBuild.marketShare.orderOfEntry", Number(e.target.value)),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          Array.from({length: rb.marketShare.numDrugs}, (_,i)=>i+1).map(n => h("option", { key: n, value: n }, n + (n===1?"st":n===2?"nd":n===3?"rd":"th") + " to market")))),
      h(BenchField, { label: "Override peak share (optional)", value: rb.marketShare.peakShareOverridePct, onChange: v => set("revenueBuild.marketShare.peakShareOverridePct", v), suffix: "%",
        bench: { value: peakShareForEntry(rb.marketShare.numDrugs, rb.marketShare.orderOfEntry), source: MARKET_SHARE_TABLE.source },
        help: "Leave blank to use the order-of-entry model above; override if efficacy/dosing differentiation justifies it." })
    ),

    // ── 4. Launch curve ──
    h(SectionCard, { title: "Step 4 of 5 · Launch Curve", subtitle: "Time from launch to peak penetration" },
      h("div", { style: { flex: "1 1 200px" } },
        h(BenchField, { label: "Years to peak", value: rb.launchCurve.yearsToPeak, onChange: v => set("revenueBuild.launchCurve.yearsToPeak", v), suffix: "yrs",
          bench: { value: 6, source: LAUNCH_CURVE.source + " — 6yr median across biologics/small molecules, first movers/followers. Exact published curves used for any 3-10yr ramp." } })),
      h("div", { style: { flex: "1 1 220px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Ramp shape"),
        h("select", { "aria-label": "Ramp shape", value: rb.launchCurve.profile, onChange: e => set("revenueBuild.launchCurve.profile", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          h("option", { value: "p25" }, "Slow (25th pctile)"), h("option", { value: "median" }, "Median"), h("option", { value: "p75" }, "Fast (75th pctile)")))
    ),

    // ── 5. Pricing ──
    h(SectionCard, { title: "Step 5 of 5 · Pricing", subtitle: "US annual price per patient — and which price basis that number is on" },
      h(BenchField, { label: "US annual price per patient", value: rb.pricing.usAnnualPrice, onChange: v => set("revenueBuild.pricing.usAnnualPrice", v), suffix: "$/yr", placeholder: "e.g. 150000",
        help: "Whatever number you have — list or net. Tell the model which basis it's on below and it converts." }),
      h("div", { style: { flex: "1 1 220px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "That price is on a…"),
        h("select", { "aria-label": "Price basis", value: rb.pricing.priceBasis || "ASP", onChange: e => set("revenueBuild.pricing.priceBasis", e.target.value),
          style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } },
          PRICE_BASIS_OPTIONS.map(o => h("option", { key: o.value, value: o.value }, o.label)))),
      h(BenchField, { label: "Net price realisation", value: rb.pricing.netPriceRealizationPct, onChange: v => set("revenueBuild.pricing.netPriceRealizationPct", v), suffix: "%",
        placeholder: String(aspPctOfBasis(rb.pricing.priceBasis || "ASP")),
        help: "What share of the entered price the manufacturer actually keeps — the other side of gross-to-net (45% gross-to-net = 55% realisation). Leave blank to use Table 4-1's average for the basis above. Override it if you have a real figure: that table averages across all drugs and understates gross-to-net badly for a modern specialty brand, where 40-50% deductions are ordinary." }),
      (() => {
        // Show the conversion as it will actually be applied. A price basis
        // control that silently changes the valuation would be worse than not
        // having one — the point is that the deduction becomes visible.
        const pb = resolveNetPrice(rb.pricing);
        if (!pb.entered) return null;
        return h("div", { style: { flex: "1 1 100%", marginTop: -2, marginBottom: 8, fontSize: 11, fontFamily: "var(--mono)", lineHeight: 1.7,
            color: pb.adjusted ? "var(--teal)" : "var(--ink-3)" } },
          pb.adjusted
            ? "$" + Math.round(pb.entered).toLocaleString() + " on " + priceBasisArticle(pb.basis) + " " + pb.basis + " basis → $" + Math.round(pb.netPrice).toLocaleString()
              + " net per patient-year, a " + pb.grossToNetPct.toFixed(0) + "% gross-to-net deduction"
              + (pb.fromOverride ? " (your figure)." : " (Table 4-1 average — ASP is " + pb.realizationPct + "% of " + pb.basis + ").")
              + "  Ex-US revenue still prices off the $" + Math.round(pb.entered).toLocaleString() + " you entered, because the published cross-country factors compare list prices."
            : "No gross-to-net deduction applied — the model is treating $" + Math.round(pb.entered).toLocaleString() + " as already net of rebates and discounts. If that number came off a price list, change the basis above."
        );
      })(),
      h(BenchField, { label: "Annual US price growth", value: rb.pricing.usAnnualGrowthPct, onChange: v => set("revenueBuild.pricing.usAnnualGrowthPct", v), suffix: "%",
        bench: { value: 3, source: PRICING_DEFS.source + " — 2-3% conservative base case, tracks inflation" } }),
      h("div", { style: { flex: "1 1 100%", marginTop: 4, marginBottom: 10 } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer" } },
          h("input", { type: "checkbox", checked: rb.pricing.includeExUS, onChange: e => set("revenueBuild.pricing.includeExUS", e.target.checked) }),
          "Include ex-US revenue")),
      rb.pricing.includeExUS && h(React.Fragment, null,
        h(BenchField, { label: "Ex-US price as % of US price", value: rb.pricing.exUSPriceFactorPct, onChange: v => set("revenueBuild.pricing.exUSPriceFactorPct", v), suffix: "%",
          bench: { value: 50, source: PRICING_DEFS.source + " — typical correction factor for major ex-US markets" } }),
        h(BenchField, { label: "Ex-US annual price growth", value: rb.pricing.exUSAnnualGrowthPct, onChange: v => set("revenueBuild.pricing.exUSAnnualGrowthPct", v), suffix: "%",
          bench: { value: 0, source: "Most ex-US markets: flat to slightly negative (UK spending caps, Germany post-€250M discounts, Japan ~2.8%/yr mandated cuts)" } }),
        h(BenchField, { label: "Ex-US patient pool vs US", value: rb.pricing.exUSPatientMultiplierPct, onChange: v => set("revenueBuild.pricing.exUSPatientMultiplierPct", v), suffix: "%",
          help: "Region-specific — no generic benchmark. 100% = same patient count as US; adjust to your own estimate." })
      )
    ),

    ), // close Fragment wrapping sections 2-5

    // ── 6. Exclusivity / LOE ──
    h(SectionCard, { key: "exclusivity-" + revenueMode, title: "Exclusivity & Loss of Exclusivity", subtitle: "When generic/biosimilar competition arrives, and how much it costs you" + (revenueMode === "quick" ? " — using benchmarks below, expand to customize" : ""), defaultOpen: revenueMode === "full" },
      h(BenchField, { label: "Years from launch to LOE", value: rb.exclusivity.yearsToLOE, onChange: v => set("revenueBuild.exclusivity.yearsToLOE", v), suffix: "yrs",
        bench: { value: 13, source: EXCLUSIVITY_BENCHMARKS.source + " — average launch-to-competition. 20yr patent from filing, +5yr Hatch-Waxman, +7yr if orphan, +6mo pediatric." } }),
      h(BenchField, { label: "Volume retained after LOE", value: rb.exclusivity.volumeRetainedPct, onChange: v => set("revenueBuild.exclusivity.volumeRetainedPct", v), suffix: "%",
        bench: getExclusivityBenchText(program.modality).volRetained }),
      h(BenchField, { label: "Price decline after LOE", value: rb.exclusivity.priceDeclinePct, onChange: v => set("revenueBuild.exclusivity.priceDeclinePct", v), suffix: "%",
        bench: getExclusivityBenchText(program.modality).priceDecline })
    ),

    // ── 7. Cost Structure ──
    methodIgnores(valuationMethod, "costStructure") && h(NotUsedInThisMode, { what: "Cost Structure (COGS, sales force, marketing)" }),
    !methodIgnores(valuationMethod, "costStructure") && h(SectionCard, { key: "coststructure-" + revenueMode, title: "Cost Structure", subtitle: "COGS, sales force, marketing — produces per-year product contribution (before corporate G&A)" + (revenueMode === "quick" ? " — using benchmarks below, expand to customize" : ""), defaultOpen: revenueMode === "full" },
      h(BenchField, { label: "COGS (% of revenue)", value: cs.cogsPct, onChange: v => set("costStructure.cogsPct", v), suffix: "%", bench: cogsBench,
        help: cogsBench.value + "% keys off modality above — price is the bigger driver in reality, but this is the best generic anchor." }),
      h("div", { style: { flex: "1 1 100%", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", margin: "6px 0 2px", fontWeight: 700 } }, "Sales force (active reps at peak)"),
      h(BenchField, { label: "Primary care reps", value: cs.reps.primaryCare, onChange: v => set("costStructure.reps.primaryCare", v),
        help: "$" + (SALES_REP_COST.primaryCare.total/1000).toFixed(0) + "K/rep fully loaded" }),
      h(BenchField, { label: "Specialty reps", value: cs.reps.specialty, onChange: v => set("costStructure.reps.specialty", v),
        help: "$" + (SALES_REP_COST.specialty.total/1000).toFixed(0) + "K/rep fully loaded" }),
      h(BenchField, { label: "Hospital-based reps", value: cs.reps.hospital, onChange: v => set("costStructure.reps.hospital", v),
        help: "$" + (SALES_REP_COST.hospital.total/1000).toFixed(0) + "K/rep fully loaded" }),
      h(BenchField, { label: "Marketing (% of peak revenue)", value: cs.marketingPctOfPeak, onChange: v => set("costStructure.marketingPctOfPeak", v), suffix: "%",
        bench: { value: MARKETING_BENCHMARKS.baseCasePctOfPeakRevenue, source: MARKETING_BENCHMARKS.source + " — base case; " + MARKETING_BENCHMARKS.competitiveScenarioRange.join("-") + "% if highly competitive" } }),
      h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6, lineHeight: 1.6 } },
        "Sales force ramps to " + SALES_FORCE_PRELAUNCH_RAMP_PCT + "% one year before launch, grows " + SALES_FORCE_COMP_GROWTH_PCT + "%/yr, fully eliminated the year after LOE. Typical team size: ~" + SALES_FORCE_SIZE_BENCHMARKS.hospitalOrSpecialty + " reps (specialty/hospital) or ~" + SALES_FORCE_SIZE_BENCHMARKS.primaryCareNoPartner + " (primary care, unpartnered).")
    ),

    // ── Output readout ──
    error ? h("div", { style: { padding: 14, borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12 } }, "Calculation error: " + error)
    : h(ExportSection, { title: (program.drugName || program.name || "Program") + " — revenue build output", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px" } },
        h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 } },
          h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Peak patients on drug (US)"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, result ? fmtNum(result.peakPatients) : "—")),
          h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Peak US revenue"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--teal)" } }, result ? fmtMoney(result.peakUSRevenue) : "—")),
          rb.pricing.includeExUS && h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Peak total revenue (WW)"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, result ? fmtMoney(result.peakTotalRevenue) : "—")),
          revenueMode === "full" && h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Peak share used"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, (result && result.peakShare != null) ? result.peakShare + "%" : "—")),
          pnl && h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Peak product contribution"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtMoney(Math.max(...pnl.map(y => y.productContribution)))),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "revenue − COGS − sales − marketing"))
        ),
        h(ExportableBlock, { name: (program.drugName || program.name || "program") + "-revenue", showPanelCapture: true, compact: true },
          h(RevenueChart, { series: chartSeries, showLegend: true }))
      ),

    // ── R&D & PoS context strip ──
    (() => {
      const posWeighting = computePoSWeighting(program);
      const cumulativePoS = posWeighting.posToLaunch * 100;
      const overridePct = program.posOverridePct;
      const mods = posWeighting.modifiers;
      // Unmodified cumulative PoS, for showing what the attributes actually
      // changed rather than just asserting a number.
      const baseline = computePoSWeighting({ ...program, posBiomarkerUse: "", posDiseaseType: "" }).posToLaunch * 100;
      const selectStyle = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 };
      const attrSelect = (field, label, options) => h("div", { style: { flex: "1 1 220px" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, label),
        h("select", { "aria-label": label, value: program[field] || "", onChange: e => set(field, e.target.value), style: selectStyle },
          options.map(([v, lbl]) => h("option", { key: v, value: v }, lbl))));

      return h("div", { style: { marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", border: "1px dashed var(--rule)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", lineHeight: 1.7, marginBottom: 10 } },
          "For reference — ", program.therapeuticArea, ", ", phaseKey.replace("phase","Phase "), ": ",
          "PoS to next stage ", h("b", { style: { color: "var(--ink-2)" } }, posInfo.value + "%"),
          " · per-patient trial cost ", h("b", { style: { color: "var(--ink-2)" } }, "$" + trialCostInfo.value + "K"),
          " · trial duration ", h("b", { style: { color: "var(--ink-2)" } }, trialDurInfo.value + "yr")),

        // ── Program attributes that measurably shift PoS ──────────────────
        // These drive the computed benchmark directly rather than leaving you
        // to read the Reference Sheet's modifier table and do the arithmetic
        // by hand. Both default to "not specified", so nothing changes for a
        // case saved before this existed.
        h("div", { style: { marginBottom: 12 } },
          h("div", { style: { fontSize: 11, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 3 } }, "Program attributes affecting PoS"),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8, lineHeight: 1.6 } },
            "Applied to the area benchmark as the relative effect ", h("b", null, mods.source), " measured, so the therapeutic area still sets the base rate."),
          h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
            attrSelect("posBiomarkerUse", "Patient selection", [
              ["", "Not specified"],
              ["selection", "Selection biomarker used"],
              ["none", "No selection biomarker"]
            ]),
            attrSelect("posDiseaseType", "Disease population", [
              ["", "Not specified"],
              ["rare", "Rare disease"],
              ["chronicHighPrev", "Chronic / high-prevalence"]
            ])
          ),
          mods.applied.length > 0 && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 } },
            mods.applied.map(a => a.label + " (Phase 2 ×" + a.perPhase.phase2.toFixed(2) + (a.regulatoryDeltaPct ? ", regulatory " + (a.regulatoryDeltaPct > 0 ? "+" : "") + a.regulatoryDeltaPct + "pp" : "") + ")").join(" · "),
            h("div", { style: { marginTop: 3 } },
              "Cumulative PoS to launch: ", h("b", { style: { color: "var(--ink-3)" } }, baseline.toFixed(1) + "%"), " → ",
              h("b", { style: { color: cumulativePoS >= baseline ? "var(--teal)" : "var(--red)" } }, cumulativePoS.toFixed(1) + "%"))),
          // Modality now shifts PoS too (POS_BY_MOLECULE), and it is applied
          // automatically from the program's own modality rather than chosen
          // here — so it has to be stated, or a number would move for reasons
          // the user can't see on this panel.
          (() => {
            const mt = computeMoleculeTypePoSRatios(program.modality);
            if (!mt.applied) {
              return (program.modality === "cellTherapy" || program.modality === "geneTherapy") &&
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6, lineHeight: 1.6 } },
                  "No molecule-type PoS adjustment applied — the source's molecule-type data (2010-2016) predates cell and gene therapy and its \"biologic\" cohort is antibodies and proteins, so borrowing that number here would be inventing a datapoint rather than sourcing one.");
            }
            const pct = (mt.ratios.phase2 - 1) * 100;
            return h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 6, lineHeight: 1.6 } },
              "Molecule type (", program.modality === "biologic" ? "biologic" : "small molecule", ") applied automatically: Phase 2 ×",
              mt.ratios.phase2.toFixed(2), " (", pct >= 0 ? "+" : "", pct.toFixed(0), "%), Phase 1 ×", mt.ratios.phase1.toFixed(2),
              ", Phase 3 ×", mt.ratios.phase3.toFixed(2), ". Source: ", mt.source);
          })(),
          (() => {
            const w = computePoSWeighting(program);
            if (w.capBound) {
              return h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 6, lineHeight: 1.6, paddingLeft: 8, borderLeft: "2px solid var(--red)" } },
                "Modifiers computed past 100% and were capped at 99% on ", w.cappedStages, " stage", w.cappedStages > 1 ? "s" : "",
                " (peak ", w.maxUncappedPct.toFixed(0), "%). Multiplying ", w.axesApplied,
                " adjustments together assumes they're independent, and at this combination they clearly aren't — a rare disease is often biomarker-defined, and both correlate with modality. The capped number is a floor on the absurdity, not a real estimate: set an explicit override below instead of trusting it.");
            }
            if (w.axesApplied > 1) {
              return h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--amber)", marginTop: 6, lineHeight: 1.6, paddingLeft: 8, borderLeft: "2px solid var(--amber)" } },
                w.axesApplied, " adjustments are being multiplied together (", 
                [mods.applied.map(a => a.label.toLowerCase()), w.moleculeType.applied ? ["molecule type"] : []].flat().join(", "),
                "), which assumes they're independent. The source doesn't publish the combined cell, and these categories overlap in practice, so this likely overstates the combined lift. Consider an explicit override below instead.");
            }
            return null;
          })()
        ),

        h(BenchField, { label: "Cumulative PoS to launch (Base case)", value: overridePct, onChange: v => set("posOverridePct", v), suffix: "%",
          bench: { value: Math.round(cumulativePoS * 10) / 10, source: "Computed from " + program.therapeuticArea + " phase-by-phase benchmarks through to launch" + (mods.applied.length ? ", adjusted for " + mods.applied.map(a => a.label.toLowerCase()).join(" + ") + " (" + mods.source + ")" : "") },
          help: "Override when you have a specific reason beyond the attributes above. Fixes the CUMULATIVE odds to launch — not how attrition spreads across phases, which still comes from the benchmarks. So two programs with the same override but different modality can still differ modestly in value, since they spend different amounts on late-stage trials getting there. Bear/Bull scale off whatever you set." })
      );
    })(),

    // ── Risk waterfall: this asset's value if success were certain vs its
    // actual risk-adjusted rNPV. Uses Base scenario + the case's own discount
    // rate/terminal value settings for consistency with the rest of the app.
    (() => {
      let wf = null, wfError = null;
      try {
        const tv = terminalValue || { enabled: false };
        const scenario = applyBasePosAdjustment(SCENARIO_PRESETS.base, basePosAdjustmentPct);
        wf = computeProgramRiskWaterfall(program, scenario, "base", discountRatePct,
          { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
      } catch (e) { wfError = e.message; }
      if (wfError) return null;
      return h(ExportSection, { title: "Risk waterfall — " + (program.drugName || program.name || "this asset"), style: { marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--rule)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Risk waterfall — this asset only"),
        h(Note, { summary: "What \"unrisked\" means, and why it can look worse" },
          "\"Unrisked\" means 100% PoS on both sides — the full peak revenue AND the full R&D cost paid with certainty, not just revenue scaled up. For early-stage assets this can come out more negative than the risk-adjusted number: paying the full R&D cost for certain can outweigh a distant, heavily time-discounted payoff — that's a real feature of rNPV, not an error.",
          valuationMethod === "multiple" && " This waterfall always uses the full DCF/cost-structure math, regardless of the case's Simple Multiple setting — it's a diagnostic, not the number driving your headline valuation while Simple Multiple is active."),
        h(ExportableBlock, { name: (program.drugName || program.name || "program") + "-risk-waterfall", showPanelCapture: true, compact: true },
          h(RiskWaterfallChart, { unriskedNPV: wf.unriskedNPV, riskedNPV: wf.riskedNPV, posToLaunchPct: wf.posToLaunch * 100 }))
      );
    })(),

    // ── Priority Review Voucher — tied to THIS program's own approval, since
    // that's literally how PRVs work (granted only upon qualifying approval).
    // Risk-adjusted by this program's PoS and discounted from its launch year,
    // not a flat certain amount — matches the actual mechanics of the asset.
    (() => {
      const prv = program.prv || { enabled: false, valueM: "150" };
      const setPrv = (patch) => set("prv", { ...prv, ...patch });
      // Gentle nudge only — NOT an eligibility determination. PRV programs (rare
      // pediatric disease, tropical disease) have specific FDA-defined qualifying
      // disease lists; broad keyword matching on free-text indication can't
      // reliably confirm or rule out eligibility, so this only prompts a check
      // rather than asserting anything.
      const indicationText = ((program.indication || "") + " " + (program.therapeuticArea || "")).toLowerCase();
      const nudgeKeywords = ["pediatric", "paediatric", "rare", "orphan", "tropical", "neglected"];
      const showNudge = !prv.enabled && nudgeKeywords.some(k => indicationText.includes(k));
      return h("div", { style: { marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", border: "1px dashed var(--rule)" } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer", marginBottom: prv.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: prv.enabled, onChange: e => setPrv({ enabled: e.target.checked }) }),
          "Priority Review Voucher-eligible (e.g. rare pediatric disease designation)"),
        showNudge && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--amber)", marginBottom: 8 } },
          "Worth checking against FDA's rare pediatric / tropical disease PRV lists — not a determination, just a prompt to look."),
        prv.enabled && h(BenchField, { label: "PRV value", value: prv.valueM, onChange: v => setPrv({ valueM: v }), suffix: "$M",
          bench: { value: 150, source: "Representative PRV market value — actual trading value has ranged $100-350M" },
          help: "Weighted by this program's PoS and discounted back from its launch year — a PRV is only granted on approval, so it isn't a certain, undiscounted amount." })
      );
    })(),

    // ── Partnership economics — an optional overlay on top of whichever
    // revenue mode is active (Quick or Detailed), not a third mode. See the
    // factory default above and computeCaseValuation/getProgramRevenueResult
    // for the actual math this feeds.
    (() => {
      const partnership = program.partnership || { enabled: false, territory: "exUS", royaltyPct: "", upfrontM: "", costSharingPct: "", milestones: [] };
      const setPartnership = (patch) => set("partnership", { ...partnership, ...patch });
      const [showMilestoneForm, setShowMilestoneForm] = React.useState(false);
      const [editingMilestoneIdx, setEditingMilestoneIdx] = React.useState(null);
      const milestones = partnership.milestones || [];
      const gateLabel = { phase1: "Phase 1", phase2: "Phase 2", phase3: "Phase 3", regulatory: "Filing", launch: "Approval/launch" };

      const addMilestone = (m) => { setPartnership({ milestones: [...milestones, { id: newId("ms"), ...m }] }); setShowMilestoneForm(false); };
      const updateMilestone = (idx, m) => { const next = milestones.slice(); next[idx] = { ...next[idx], ...m }; setPartnership({ milestones: next }); setEditingMilestoneIdx(null); };
      const deleteMilestone = (idx) => setPartnership({ milestones: milestones.filter((_, i) => i !== idx) });

      return h("div", { style: { marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", border: "1px dashed var(--rule)" } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer", marginBottom: partnership.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: partnership.enabled, onChange: e => setPartnership({ enabled: e.target.checked }) }),
          "Partnered asset (licensed rights, royalty/milestone deal)"),
        partnership.enabled && h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
            "Royalty replaces the partnered territory's revenue rather than adding to it — Detailed mode's own ex-US pricing above should be turned off for a territory that's actually licensed out, or its revenue and the royalty on it would both be counted. Royalty income is treated as near-pure margin: no COGS and no marketing are charged against it, because the partner is the one manufacturing and selling there. Sales reps are the exception — they're an explicit headcount you enter, so set them to zero yourself for a programme you've fully licensed out."),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: "0 16px" } },
            h(BenchField, { label: "Royalty rate", value: partnership.royaltyPct, onChange: v => setPartnership({ royaltyPct: v }), suffix: "%",
              help: "Applied to what the partnered territory's revenue would otherwise have been." }),
            h(BenchField, { label: "Upfront received", value: partnership.upfrontM, onChange: v => setPartnership({ upfrontM: v }), suffix: "$M",
              help: "Added directly, undiscounted — treated as near-certain/already-contracted, same as cash." }),
            h(BenchField, { label: "Partner-funded R&D", value: partnership.costSharingPct, onChange: v => setPartnership({ costSharingPct: v }), suffix: "%",
              help: "% of this program's remaining R&D cost the partner covers instead of the company." })
          ),
          onNavigateToTools && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6 } },
            "Sanity-check these terms against real deals — ",
            h("span", { onClick: () => onNavigateToTools("licensing"),
              // A bare onClick span is invisible to the keyboard: Tab skips it
              // entirely, so this navigation had no non-mouse route at all.
              role: "button", tabIndex: 0,
              onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigateToTools("licensing"); } },
              style: { color: "var(--teal)", cursor: "pointer", textDecoration: "underline" } }, "Tools → Licensing Comps"), "."),
          program.revenueMode === "full" && h("div", { style: { marginTop: 4, marginBottom: 4 } },
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 } }, "Territory partnered"),
            h("div", { style: { display: "flex", gap: 6 } },
              ["us", "exUS", "global"].map(t => h("button", {
                key: t, onClick: () => setPartnership({ territory: t }),
                style: { padding: "3px 10px", borderRadius: 5, border: "1px solid " + (partnership.territory === t ? "var(--teal)" : "var(--rule)"), background: partnership.territory === t ? "var(--teal-bg)" : "transparent", color: partnership.territory === t ? "var(--teal)" : "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" }
              }, t === "us" ? "US" : t === "exUS" ? "Ex-US" : "Global"))
            )
          ),
          h("div", { style: { marginTop: 12 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } }, "Milestones"),
            milestones.length === 0 && !showMilestoneForm && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6 } }, "None added."),
            milestones.map((m, idx) => editingMilestoneIdx === idx
              ? h(MilestoneEntryForm, { key: m.id, initialValues: m, saveLabel: "Save", onSave: (v) => updateMilestone(idx, v), onCancel: () => setEditingMilestoneIdx(null) })
              : h("div", { key: m.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "var(--surface)", marginBottom: 6, fontSize: 11, fontFamily: "var(--mono)" } },
                  h("div", null, h("span", { style: { color: "var(--ink-1)", fontWeight: 600 } }, m.label), h("span", { style: { color: "var(--ink-3)" } }, " · " + gateLabel[m.gate] + " · $" + m.valueM + "M")),
                  h("div", { style: { display: "flex", gap: 6 } },
                    h("button", { onClick: () => setEditingMilestoneIdx(idx), style: { padding: "3px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 9, cursor: "pointer" } }, "Edit"),
                    h(ConfirmXButton, { onConfirm: () => deleteMilestone(idx), title: "Delete this milestone", style: { padding: "3px 8px", fontSize: 10 } })
                  )
                )
            ),
            showMilestoneForm
              ? h(MilestoneEntryForm, { saveLabel: "Add", onSave: addMilestone, onCancel: () => setShowMilestoneForm(false) })
              : h("button", { onClick: () => setShowMilestoneForm(true), style: { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "+ Add milestone")
          )
        )
      );
    })(),

    // ── Evidence Log — the "why" behind judgment-call inputs, living inside
    // the case itself rather than a separate document that drifts out of
    // sync. Deliberately general-purpose: entries aren't tied to a specific
    // internal field, so this holds per-field justifications (PoS override,
    // peak share) and general program-level thesis notes equally well.
    (() => {
      const [showForm, setShowForm] = React.useState(false);
      const [editingIdx, setEditingIdx] = React.useState(null);
      const log = program.evidenceLog || [];

      const addEntry = (entry) => {
        set("evidenceLog", [...log, { id: newId("ev"), ...entry }]);
        setShowForm(false);
      };
      const updateEntry = (idx, entry) => {
        const next = log.slice();
        next[idx] = { ...next[idx], ...entry };
        set("evidenceLog", next);
        setEditingIdx(null);
      };
      const deleteEntry = (idx) => {
        set("evidenceLog", log.filter((_, i) => i !== idx));
      };

      const classColor = { fact: "var(--teal)", inference: "var(--amber)", speculation: "var(--red)" };
      const classLabel = { fact: "Fact", inference: "Inference", speculation: "Speculation" };
      const confLabel = { high: "High", moderate: "Moderate", low: "Low" };

      return h(SectionCard, { title: "Evidence Log", subtitle: "The source and reasoning behind this program's judgment-call inputs — built to match what the Biotech Agent research system already produces, so its output drops straight in", defaultOpen: log.length > 0 },
        log.length === 0 && !showForm && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } }, "No entries yet."),
        log.map((entry, idx) =>
          editingIdx === idx
            ? h(EvidenceEntryForm, { key: entry.id, initialValues: entry, saveLabel: "Save", onSave: (v) => updateEntry(idx, v), onCancel: () => setEditingIdx(null) })
            : h("div", { key: entry.id, style: { padding: "10px 12px", borderRadius: 7, background: "var(--surface-2)", marginBottom: 8 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
                  h("div", { style: { flex: 1 } },
                    h("div", { style: { fontSize: 12, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 3 } }, entry.label),
                    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9, fontFamily: "var(--mono)", marginBottom: 4 } },
                      h("span", { style: { color: classColor[entry.classification] || "var(--ink-2)", fontWeight: 700 } }, classLabel[entry.classification] || entry.classification),
                      h("span", { style: { color: "var(--ink-3)" } }, "· " + (confLabel[entry.confidence] || entry.confidence) + " confidence"),
                      entry.date && h("span", { style: { color: "var(--ink-3)" } }, "· " + entry.date)
                    ),
                    entry.source && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: entry.thesis ? 4 : 0, wordBreak: "break-word" } }, entry.source),
                    entry.thesis && h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.5 } }, entry.thesis)
                  ),
                  h("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
                    h("button", { onClick: () => setEditingIdx(idx), style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Edit"),
                    h(ConfirmXButton, { onConfirm: () => deleteEntry(idx), title: "Delete this entry" })
                  )
                )
              )
        ),
        showForm
          ? h(EvidenceEntryForm, { saveLabel: "Add", onSave: addEntry, onCancel: () => setShowForm(false) })
          : h("button", { onClick: () => setShowForm(true), style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", marginTop: log.length > 0 ? 4 : 0 } }, "+ Add evidence")
      );
    })(),

    // ── Calibration Log — record a PoS prediction (yours and the market's)
    // before a catalyst resolves, the actual outcome after. Brier score
    // (lower is better, 0 = perfect) computed once an outcome is recorded.
    // Deliberately simple for now — manual entry, no auto-fill from the
    // Implied PoS box above (that would need theCase threaded down into
    // this component, which nothing else here currently needs) — the
    // number is already visible elsewhere on this same screen to copy over.
    (() => {
      const [showForm, setShowForm] = React.useState(false);
      const [editingIdx, setEditingIdx] = React.useState(null);
      const log = program.calibrationLog || [];

      const addEntry = (entry) => {
        set("calibrationLog", [...log, { id: newId("cal"), ...entry }]);
        setShowForm(false);
      };
      const updateEntry = (idx, entry) => {
        const next = log.slice();
        next[idx] = { ...next[idx], ...entry };
        set("calibrationLog", next);
        setEditingIdx(null);
      };
      const deleteEntry = (idx) => {
        set("calibrationLog", log.filter((_, i) => i !== idx));
      };

      const outcomeColor = { pending: "var(--ink-3)", success: "var(--teal)", failure: "var(--red)" };
      const outcomeLabel = { pending: "Pending", success: "Success", failure: "Failure" };

      return h(SectionCard, { title: "Calibration Log", subtitle: "Your PoS call vs. the market's, recorded before a catalyst — score both against the actual outcome after", defaultOpen: log.length > 0 },
        log.length === 0 && !showForm && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } }, "No entries yet."),
        log.map((entry, idx) => {
          const yourScore = brierScore(entry.yourPoS, entry.outcome);
          const marketScore = brierScore(entry.marketImpliedPoS, entry.outcome);
          return editingIdx === idx
            ? h(CalibrationEntryForm, { key: entry.id, initialValues: entry, saveLabel: "Save", onSave: (v) => updateEntry(idx, v), onCancel: () => setEditingIdx(null) })
            : h("div", { key: entry.id, style: { padding: "10px 12px", borderRadius: 7, background: "var(--surface-2)", marginBottom: 8 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
                  h("div", { style: { flex: 1 } },
                    h("div", { style: { fontSize: 12, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 3 } }, entry.catalystLabel),
                    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9, fontFamily: "var(--mono)", marginBottom: 4 } },
                      h("span", { style: { color: outcomeColor[entry.outcome] || "var(--ink-2)", fontWeight: 700 } }, outcomeLabel[entry.outcome] || entry.outcome),
                      entry.catalystDate && h("span", { style: { color: "var(--ink-3)" } }, "· " + entry.catalystDate),
                      entry.yourPoS != null && h("span", { style: { color: "var(--ink-3)" } }, "· your PoS " + entry.yourPoS + "%"),
                      entry.marketImpliedPoS != null && h("span", { style: { color: "var(--ink-3)" } }, "· market " + entry.marketImpliedPoS + "%")
                    ),
                    (yourScore != null || marketScore != null) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: entry.notes ? 4 : 0 } },
                      yourScore != null && "Your Brier score: " + yourScore.toFixed(3),
                      yourScore != null && marketScore != null && "  ·  ",
                      marketScore != null && "Market's: " + marketScore.toFixed(3),
                      yourScore != null && marketScore != null && (yourScore < marketScore ? "  (you were better calibrated)" : yourScore > marketScore ? "  (market was better calibrated)" : "")
                    ),
                    entry.notes && h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.5 } }, entry.notes)
                  ),
                  h("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
                    h("button", { onClick: () => setEditingIdx(idx), style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Edit"),
                    h(ConfirmXButton, { onConfirm: () => deleteEntry(idx), title: "Delete this entry" })
                  )
                )
              );
        }),
        showForm
          ? h(CalibrationEntryForm, { saveLabel: "Add", onSave: addEntry, onCancel: () => setShowForm(false) })
          : h("button", { onClick: () => setShowForm(true), style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", marginTop: log.length > 0 ? 4 : 0 } }, "+ Add prediction")
      );
    })(),
  );
}
