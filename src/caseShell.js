// ════════════════════════════════════════════════════════════════════════════
// Case: a company + its programs, with an aggregate revenue rollup
// ════════════════════════════════════════════════════════════════════════════
const COMPANY_CALENDAR_YEARS = 22; // shared window: revenue rollup + P&L both use this
function newCase() {
  return {
    id: newId("case"),
    name: "New Case",
    ticker: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    programs: [newProgram()],
    currentPrice: "", // manually entered, lives at the top near company name — drives upside/downside and treasury-method dilution
    corporateGA: { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50", windDownYears: "" },
    discountRatePct: "",
    terminalValue: { enabled: false, method: "exitMultiple", growthPct: "0", exitMultiple: "" },
    // Off by default, deliberately: every case built before taxation existed
    // assumed pre-tax flows, and defaulting this on would silently re-price
    // all of them. 21% is the US federal statutory rate; state and foreign mix
    // pushes most real effective rates a few points higher.
    taxation: { enabled: false, effectiveRatePct: "21", startingNOLM: "" },
    capitalStructure: {
      mode: "simple", dilutedSharesSimple: "",
      basicShares: "", cash: "", debt: "",
      opts: "", optK: "", war: "", warK: "", convFace: "", convPrice: ""
    },
    scenarioOverrides: {
      bear: { shareMultiplierPct: "", posMultiplierPct: "", discountRateAddPct: "", exitMultiple: "" },
      bull: { shareMultiplierPct: "", posMultiplierPct: "", discountRateAddPct: "", exitMultiple: "" }
    }
  };
}

function caseMissingInputs(theCase) {
  const missing = [];
  if (!theCase.currentPrice) missing.push("current price");
  const cap = theCase.capitalStructure || { mode: "simple" };
  if ((cap.mode || "simple") === "simple" && !cap.dilutedSharesSimple) missing.push("diluted shares");
  if (cap.mode === "detailed" && !cap.basicShares) missing.push("basic shares");
  theCase.programs.forEach((p, i) => {
    const label = p.drugName || p.name || ("Program " + (i + 1));
    if ((p.revenueMode || "quick") === "quick") {
      if (!p.quickRevenue || !p.quickRevenue.peakRevenue) missing.push(label + " peak revenue");
    } else {
      const pop = (p.revenueBuild || {}).population || {};
      if (pop.mode === "prevalence" && !pop.prevalence) missing.push(label + " prevalence");
      if (pop.mode === "incidence" && !pop.incidence) missing.push(label + " incidence");
      if (!(p.revenueBuild || {}).pricing || !p.revenueBuild.pricing.usAnnualPrice) missing.push(label + " price");
    }
  });
  return missing;
}

// True when a user-entered value differs from a fresh case's or program's.
// Blank means "use the benchmark" everywhere in this app, so a blank value is
// never a change. Only the default's own keys are compared, so a field an
// older saved case still carries cannot light up a section.
function differsFromDefault(value, def) {
  const blank = (x) => x === "" || x == null;
  if (Array.isArray(def)) return Array.isArray(value) && value.length > 0;
  if (def && typeof def === "object") {
    if (!value || typeof value !== "object") return false;
    return Object.keys(def).some(k => k !== "id" && differsFromDefault(value[k], def[k]));
  }
  if (blank(value)) return false;
  if (blank(def)) return true;
  if (typeof def === "boolean" || typeof value === "boolean") return Boolean(value) !== Boolean(def);
  if (!isNaN(Number(value)) && !isNaN(Number(def))) return Number(value) !== Number(def);
  return String(value) !== String(def);
}

// The Assumptions tab's section list: what is on the page, in page order, and
// the state of each — "set" (changed from the default), "todo" (a required
// input is still blank), "result" (an output, never marked), "unused" (the
// valuation method does not read it) or "" (on its benchmark defaults). Each
// id matches a data-nav attribute on the page.
function assumptionNavSections(theCase, program) {
  const dc = newCase(), dp = newProgram();
  const pick = (obj, keys) => keys.reduce((o, k) => { o[k] = obj[k]; return o; }, {});
  const changed = (v, d) => differsFromDefault(v, d) ? "set" : "";
  const cap = theCase.capitalStructure || {};
  const capMode = cap.mode || "simple";
  const capTodo = capMode === "simple" ? !cap.dilutedSharesSimple : !cap.basicShares;
  const groups = [{ label: "Company", items: [
    { id: "company", label: "Valuation settings", state: changed(pick(theCase, ["discountRatePct", "taxation", "terminalValue"]), pick(dc, ["discountRatePct", "taxation", "terminalValue"])) || ((theCase.valuationMethod || "dcf") !== "dcf" ? "set" : "") },
    { id: "capital", label: "Capital structure", state: capTodo ? "todo" : changed(cap, dc.capitalStructure) },
    { id: "financing", label: "Future financing", state: ((theCase.futureRaise || {}).enabled || (theCase.dilutionPath || {}).enabled) ? "set" : "" },
    { id: "ga", label: "Corporate G&A", state: changed(theCase.corporateGA, dc.corporateGA) }
  ] }];
  if (!program) return groups;
  const rb = program.revenueBuild || {}, drb = dp.revenueBuild;
  const pop = rb.population || {};
  const quick = (program.revenueMode || "quick") === "quick";
  const method = theCase.valuationMethod || "dcf";
  const items = [
    { id: "program", label: "Drug & indication", state: changed(pick(program, ["name", "drugName", "indication", "therapeuticArea", "modality", "currentPhase", "launchYearOffset"]), pick(dp, ["name", "drugName", "indication", "therapeuticArea", "modality", "currentPhase", "launchYearOffset"])) },
    { id: "rnd", label: "R&D to launch", state: changed(program.rndOverride, dp.rndOverride) }
  ];
  if (quick) {
    items.push({ id: "revenue", label: "Quick revenue", state: !(program.quickRevenue || {}).peakRevenue ? "todo" : "set" });
  } else {
    const popTodo = (pop.mode || "prevalence") === "prevalence" ? !pop.prevalence : !pop.incidence;
    items.push(
      { id: "pop", label: "Population", state: popTodo ? "todo" : "set" },
      { id: "adherence", label: "Adherence", state: changed(rb.adherencePct, drb.adherencePct) },
      { id: "share", label: "Market share", state: changed(rb.marketShare, drb.marketShare) },
      { id: "curve", label: "Launch curve", state: changed(rb.launchCurve, drb.launchCurve) },
      { id: "price", label: "Pricing", state: !(rb.pricing || {}).usAnnualPrice ? "todo" : "set" });
  }
  // Exclusivity's modality follows the program's own, so it is not a choice.
  const exNoMod = (x) => { const o = Object.assign({}, x || {}); delete o.modality; return o; };
  items.push(
    { id: "loe", label: "Exclusivity & LOE", state: changed(exNoMod(rb.exclusivity), exNoMod(drb.exclusivity)) },
    { id: "cost", label: "Cost structure", state: methodIgnores(method, "costStructure") ? "unused" : changed(program.costStructure, dp.costStructure) },
    { id: "output", label: "Revenue by year", state: "result" },
    { id: "pos", label: "Probability of success", state: changed(pick(program, ["posOverridePct", "posBiomarkerUse", "posDiseaseType"]), pick(dp, ["posOverridePct", "posBiomarkerUse", "posDiseaseType"])) },
    { id: "waterfall", label: "Risk waterfall", state: "result" },
    { id: "prv", label: "Priority review voucher", state: (program.prv || {}).enabled ? "set" : "" },
    { id: "partner", label: "Partnership", state: (program.partnership || {}).enabled ? "set" : "" });
  groups.push({ label: program.drugName || program.name || "Program", items });
  return groups;
}

const CASE_TABS = [["overview", "Overview"], ["assumptions", "Assumptions"], ["scenarios", "Scenarios"], ["evidence", "Evidence"], ["calibration", "Calibration"]];

function CaseView({ theCase, onChange, onDelete, onNavigateToTools }) {
  const h = React.createElement;
  const [activeProgId, setActiveProgId] = React.useState(theCase.programs[0] && theCase.programs[0].id);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [tab, setTab] = React.useState(() => caseMissingInputs(theCase).length > 0 ? "assumptions" : "overview");
  // The Assumptions section list can be hidden to give the inputs more width;
  // the choice is remembered across cases and restarts.
  const [navHidden, setNavHidden] = React.useState(() => { try { return localStorage.getItem("rxnpv_secnav_hidden") === "1"; } catch (e) { return false; } });
  const setNavHiddenSaved = (v) => { setNavHidden(v); try { localStorage.setItem("rxnpv_secnav_hidden", v ? "1" : "0"); } catch (e) {} };

  React.useEffect(() => {
    if (!theCase.programs.find(p => p.id === activeProgId)) {
      setActiveProgId(theCase.programs[0] && theCase.programs[0].id);
    }
  }, [theCase.programs.map(p => p.id).join(",")]);

  const update = (patch) => onChange({ ...theCase, ...patch, updatedAt: Date.now() });
  const updateProgram = (progId, nextProg) => {
    update({ programs: theCase.programs.map(p => p.id === progId ? nextProg : p) });
  };
  const addProgram = () => {
    const p = newProgram();
    update({ programs: [...theCase.programs, p] });
    setActiveProgId(p.id);
  };
  const removeProgram = (progId) => {
    const remaining = theCase.programs.filter(p => p.id !== progId);
    update({ programs: remaining.length ? remaining : [newProgram()] });
  };

  const [rollupView, setRollupView] = React.useState("revenue"); // 'revenue' | 'ebit'
  const corpGA = theCase.corporateGA || { preCommercialAnnualM: "", gaShareOfMatureSgaPct: "50" };
  const updateCorpGA = (patch) => update({ corporateGA: { ...corpGA, ...patch } });

  // Compute all program results + aggregate
  const allProgramAttempts = theCase.programs.map(p => {
    let rev = null;
    const resolvedOffset = resolveLaunchYearOffset(p);
    const projYears = Math.max(20, COMPANY_CALENDAR_YEARS - resolvedOffset + 2);
    try { rev = getProgramRevenueResult(p, projYears); } catch (e) {}
    return { id: p.id, name: p.drugName || p.name, launchYearOffset: resolvedOffset, revenueResult: rev, program: p };
  });
  const programResults = allProgramAttempts.filter(p => p.revenueResult);
  // Dropping a program that fails to compute is the right behaviour — one
  // half-filled program shouldn't take the whole company rollup down with it.
  // Doing it SILENTLY is not: the headline valuation just came out lower, with
  // nothing on screen to say a program was left out of it.
  const excludedPrograms = allProgramAttempts.filter(p => !p.revenueResult).map(p => p.name || "Unnamed program");

  const calendar = programResults.length ? aggregateCompanyRevenue(programResults, COMPANY_CALENDAR_YEARS) : [];
  const peakCalendarYear = calendar.length ? calendar.reduce((best, c) => c.totalRevenue > best.totalRevenue ? c : best, calendar[0]) : null;

  // Company-level P&L (revenue → COGS → gross profit → sales/marketing → product contribution → G&A → EBIT)
  const programPnLs = programResults.map(p => {
    const cs = p.program.costStructure || { cogsPct: "", reps: {}, marketingPctOfPeak: "" };
    const cogsBenchPct = getCogsBenchmark(p.program.modality).value;
    let pnl = [];
    try {
      pnl = computeProgramPnL(p.revenueResult, {
        cogsPct: cs.cogsPct !== "" ? cs.cogsPct : cogsBenchPct,
        reps: { primaryCare: cs.reps.primaryCare || 0, specialty: cs.reps.specialty || 0, hospital: cs.reps.hospital || 0 },
        marketingPctOfPeak: cs.marketingPctOfPeak !== "" ? cs.marketingPctOfPeak : MARKETING_BENCHMARKS.baseCasePctOfPeakRevenue,
        yearsToLOE: getRevenueBuild(p.program).exclusivity.yearsToLOE,
        launchYearOffset: p.launchYearOffset
      });
    } catch (e) {}
    return { id: p.id, launchYearOffset: p.launchYearOffset, pnl };
  });
  const companyPnL = programPnLs.length ? computeCompanyPnL(programPnLs, corpGA, COMPANY_CALENDAR_YEARS) : [];
  const peakEbitYear = companyPnL.length ? companyPnL.reduce((best, c) => c.ebit > best.ebit ? c : best, companyPnL[0]) : null;
  const ebitSeries = companyPnL.length ? [
    { name: "Revenue", color: "var(--ink-2)", points: companyPnL.map(c => ({ v: c.revenue, label: new Date().getFullYear() + c.calendarYear })) },
    { name: "Product contribution", color: "var(--teal)", points: companyPnL.map(c => ({ v: c.productContribution, label: new Date().getFullYear() + c.calendarYear })) },
    { name: "EBIT (after corporate G&A)", color: "var(--amber)", points: companyPnL.map(c => ({ v: c.ebit, label: new Date().getFullYear() + c.calendarYear })) }
  ] : [];

  // Theme-aware for the first 5 (reuses the existing semantic tokens, so
  // these correctly adapt to light/dark); one genuinely custom color for a
  // 6th program, chosen to have reasonable contrast against both surfaces.
  const PROGRAM_COLORS = ["var(--teal)", "var(--amber)", "var(--slate)", "var(--red)", "var(--green)", "#9B7FA6"];
  const aggChartSeries = programResults.map((p, i) => ({
    name: p.name, color: PROGRAM_COLORS[i % PROGRAM_COLORS.length], fill: false,
    points: calendar.map(c => ({ v: (c.byProgram.find(bp => bp.id === p.id) || { revenue: 0 }).revenue, label: new Date().getFullYear() + c.calendarYear }))
  }));
  const totalSeries = calendar.length ? [{ name: "Total company revenue", color: "var(--ink-2)", points: calendar.map(c => ({ v: c.totalRevenue, label: new Date().getFullYear() + c.calendarYear })) }] : [];

  const activeProg = theCase.programs.find(p => p.id === activeProgId) || theCase.programs[0];

  // Names the case in the footer of anything exported from this page.
  // ── Sub-tab plumbing ──
  const vs = useValuationSections({ theCase, onChange: update, goToTab: (t) => setTab(t) });
  const openPredictions = (() => { const pc = pendingCalibrationEntries(theCase); return pc.overdue.length + pc.open.length; })();
  const panel = (id, ...kids) => h.apply(null, ["div", { key: id, role: "tabpanel", id: "casepanel-" + id, "aria-labelledby": "casetab-" + id, hidden: tab !== id, className: "case-panel" }].concat(kids));
  const programPicker = (withId) => h("div", { id: withId ? "ws-programs" : undefined, style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" } },
      // Each tab carries its program's phase and peak revenue, not just a
      // name. Only one program renders at a time, so without this the only
      // way to compare a pipeline was to click through every tab and hold the
      // numbers in your head. Suppressed for a single-program case, where
      // there's nothing to compare against and it would just be noise.
      theCase.programs.map(p => {
        const isActive = activeProgId === p.id;
        const multi = theCase.programs.length > 1;
        const pr = programResults.find(r => r.id === p.id);
        const peak = pr && pr.revenueResult ? pr.revenueResult.peakTotalRevenue : null;
        const phaseLabel = (p.currentPhase || "").replace("phase", "Ph");
        return h("button", {
          key: p.id, onClick: () => setActiveProgId(p.id),
          title: multi ? "Show " + (p.drugName || p.name) : undefined,
          style: { padding: multi ? "6px 14px" : "7px 16px", borderRadius: 7, border: "1px solid " + (isActive ? "var(--teal)" : "var(--rule)"),
            background: isActive ? "var(--teal-bg)" : "var(--surface)", color: isActive ? "var(--teal)" : "var(--ink-2)",
            fontFamily: "var(--mono)", fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: "pointer",
            textAlign: "left", lineHeight: 1.35 }
        },
          h("div", null, p.drugName || p.name),
          multi && h("div", { style: { fontSize: 10, color: isActive ? "var(--teal)" : "var(--ink-3)", fontWeight: 400 } },
            [phaseLabel, peak ? fmtMoney(peak) + " peak" : null].filter(Boolean).join(" · "))
        );
      }),
      h("button", { onClick: addProgram, style: { padding: "7px 14px", borderRadius: 7, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" } }, "+ Add program")
    );
  const editorFor = (part) => activeProg && h(ProgramEditor, {
      key: part + "-" + activeProg.id, part, program: activeProg,
      onChange: next => updateProgram(activeProg.id, next),
      onDelete: () => removeProgram(activeProg.id),
      discountRatePct: theCase.discountRatePct, terminalValue: theCase.terminalValue,
      valuationMethod: theCase.valuationMethod || "dcf",
      basePosAdjustmentPct: theCase.basePosAdjustmentPct,
      onNavigateToTools
    });

  return h("div", { "data-export-context": "Workspace · " + (theCase.name || "Untitled case") },
    // Case header
    h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" } },
      h("input", { value: theCase.name, onChange: e => update({ name: e.target.value }), "aria-label": "Case name",
        style: { fontFamily: "var(--display)", fontSize: 26, fontWeight: 700, color: "var(--ink-1)", background: "transparent", border: "none", borderBottom: "2px solid var(--rule)", padding: "4px 0", flex: "1 1 260px", minWidth: 200 } }),
      h("input", { value: theCase.ticker, onChange: e => update({ ticker: e.target.value }), placeholder: "TICKER", "aria-label": "Ticker symbol",
        style: { width: 100, fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px" } }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
        h("span", { style: UI.captionMd }, "Current price"),
        h("span", { style: { fontSize: 13, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "$"),
        h("input", { type: "number", value: theCase.currentPrice, onChange: e => update({ currentPrice: e.target.value }), placeholder: "0.00", "aria-label": "Current share price in dollars",
          style: { width: 80, fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-1)", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px" } })
      ),
      h("button", { onClick: () => setConfirmingDelete(true), style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--red)", background: "transparent", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Delete case")
    ),

    // A single misclick here used to be unrecoverable — every program, the
    // Evidence Log, the Calibration Log, all gone with no confirmation.
    confirmingDelete && h(ConfirmDialog, {
      title: "Delete " + (theCase.name || "this case") + "?",
      message: "This removes " + (theCase.programs.length === 1 ? "its 1 program" : "all " + theCase.programs.length + " programs") +
        " and everything attached to them — revenue builds, the Evidence Log, the Calibration Log. This can't be undone.",
      confirmLabel: "Delete case",
      onCancel: () => setConfirmingDelete(false),
      onConfirm: () => { setConfirmingDelete(false); onDelete(); }
    }),

    // Missing-fields checklist — one prominent, dynamic line telling you
    // exactly what's still needed for a complete valuation, instead of
    // incomplete values quietly showing as "$0" or "—" scattered across
    // different sections with no single place to check.
    (() => {
      const missing = caseMissingInputs(theCase);
      if (missing.length === 0) return null;
      const shown = missing.slice(0, 4).join(", ") + (missing.length > 4 ? ", +" + (missing.length - 4) + " more" : "");
      return h("div", { style: { padding: "7px 14px", marginBottom: 16, background: "var(--surface)", borderLeft: "2px solid var(--warn)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 8 } },
        h("span", { style: { color: "var(--warn)", fontSize: 10 } }, "●"),
        h("span", null, "Add to complete the model: " + shown),
        tab !== "assumptions" && h("button", { type: "button", className: "link-btn", style: { marginLeft: "auto" }, onClick: () => setTab("assumptions") }, "Go to Assumptions →")
      );
    })(),

    // Calibration nudge — the Calibration Log only pays off if predictions
    // actually get scored after the catalyst resolves, and nothing prompted
    // that before: the entries sat inside a collapsed per-program section
    // with no reason to ever go back and look. Surfaced at case level so an
    // unscored prediction is visible without hunting for it. Only counts a
    // catalyst as overdue when its date is unambiguously parseable — see
    // parseCatalystDate; a "H1 2027"-style entry stays simply open.
    (() => {
      const { overdue, open } = pendingCalibrationEntries(theCase);
      if (overdue.length === 0 && open.length === 0) return null;
      const detail = overdue.slice(0, 3).map(e => e.programName + " — " + (e.catalystLabel || "prediction") + (e.catalystDate ? " (" + e.catalystDate + ")" : "")).join(" · ");
      return h("div", { style: { padding: "7px 14px", marginBottom: 16, background: "var(--surface)", borderLeft: "2px solid " + (overdue.length ? "var(--teal)" : "var(--rule)"), borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.6 } },
        overdue.length > 0
          ? h("div", null,
              h("span", { style: { color: "var(--teal)", fontWeight: 700 } }, overdue.length + " calibration prediction" + (overdue.length > 1 ? "s" : "") + " past its catalyst date"),
              " — score " + (overdue.length > 1 ? "them" : "it") + " against what actually happened, in the program's Calibration Log. ",
              tab !== "calibration" && h("button", { type: "button", className: "link-btn", onClick: () => setTab("calibration") }, "Open Calibration →"),
              h("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 3 } }, detail + (overdue.length > 3 ? " · +" + (overdue.length - 3) + " more" : "")))
          : h("div", { style: { color: "var(--ink-3)" } },
              open.length + " calibration prediction" + (open.length > 1 ? "s" : "") + " still open — score " + (open.length > 1 ? "them" : "it") + " once the catalyst reads out.")
      );
    })(),

    // ── Case sub-tabs (September 2026) ────────────────────────────────────
    // One long page became five tabs. Every tab stays mounted and the
    // inactive ones are hidden, so results (a Monte Carlo run, an open card)
    // survive switching, and every section and export control still exists.
    h("div", { className: "case-tabs", role: "tablist", "aria-label": "Case sections" },
      CASE_TABS.map(([id, label]) => h("button", { key: id, type: "button", role: "tab", id: "casetab-" + id, "aria-selected": tab === id,
          "aria-controls": "casepanel-" + id, className: "case-tab" + (tab === id ? " on" : ""), onClick: () => setTab(id) },
        label,
        id === "evidence" && vs.flagCount > 0 && h("span", { className: "case-tab-count warn", title: vs.flagCount + " input" + (vs.flagCount > 1 ? "s" : "") + " worth a second look" }, String(vs.flagCount)),
        id === "calibration" && openPredictions > 0 && h("span", { className: "case-tab-count", title: openPredictions + " open prediction" + (openPredictions > 1 ? "s" : "") }, String(openPredictions))))),

    panel("overview",
      theCase.programs.length === 0 && h("div", { className: "empty-note" }, "This case has no programs yet. ",
        h("button", { type: "button", className: "link-btn", onClick: () => setTab("assumptions") }, "Add one on Assumptions →")),
      vs.overview,
    // Company-level aggregate
    theCase.programs.length > 0 && h(ExportSection, { id: "ws-revenue", title: "Company revenue rollup — all programs", reportSection: "revenueChart", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22, marginTop: 16 } },
      h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 } },
        h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)" } }, "Company revenue rollup — all programs"),
        peakCalendarYear && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
          "Peak: ", h("b", { style: { color: "var(--ink-1)" } }, fmtMoney(peakCalendarYear.totalRevenue)), " in ", new Date().getFullYear() + peakCalendarYear.calendarYear)
      ),
      excludedPrograms.length > 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)", background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: 6, padding: "8px 10px", marginBottom: 10, lineHeight: 1.6 } },
        (excludedPrograms.length === 1 ? "“" + excludedPrograms[0] + "” is" : excludedPrograms.length + " programs are")
        + " not included in this rollup or in any valuation below — their revenue build couldn't be computed, usually because a required field is still blank. "
        + "Every total on this page excludes " + (excludedPrograms.length === 1 ? "it" : "them") + "."),
      h(ExportableBlock, { title: (theCase.name || "Case") + " — company revenue rollup" },
        h(RevenueChart, { series: totalSeries.concat(aggChartSeries.length > 1 ? aggChartSeries : []), showLegend: theCase.programs.length > 1, height: 200, xPrefix: "", xAxisPrefix: "" }))
    ),

    // Company-level P&L / EBIT panel
    companyPnL.length > 0 && h(ExportSection, { id: "ws-pnl", title: "Company P&L — costs applied", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22 } },
      h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 } },
        h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)" } }, "Company P&L — costs applied"),
        peakEbitYear && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
          "Peak EBIT: ", h("b", { style: { color: "var(--ink-1)" } }, fmtMoney(peakEbitYear.ebit)), " in ", new Date().getFullYear() + peakEbitYear.calendarYear)
      ),
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--ink-2)", marginBottom: 12 } },
        h("span", null, "Corporate G&A: ", h("b", { style: { color: "var(--ink-1)" } }, "$" + (corpGA.preCommercialAnnualM || SGA_BENCHMARKS.preCommercialGA.medianM) + "M/yr"), " before launch · ",
          h("b", { style: { color: "var(--ink-1)" } }, (corpGA.gaShareOfMatureSgaPct || 50) + "%"), " of mature SG&A after"),
        h("button", { type: "button", className: "link-btn", onClick: () => setTab("assumptions") }, "Edit on Assumptions →")),
      h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
        [["revenue","Revenue"],["ebit","P&L waterfall"]].map(([id,lbl]) => h("button", { key: id, onClick: () => setRollupView(id),
          style: { padding: "5px 12px", borderRadius: 7, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11,
            background: rollupView === id ? "var(--teal-bg)" : "transparent", color: rollupView === id ? "var(--teal)" : "var(--ink-2)", fontWeight: rollupView === id ? 700 : 400 } }, lbl))
      ),
      rollupView === "ebit" && h(ExportableBlock, { title: (theCase.name || "Case") + " — P&L by year" },
        h(RevenueChart, { series: ebitSeries, showLegend: true, height: 200, xPrefix: "", xAxisPrefix: "" })),
      rollupView === "ebit" && (() => {
        const troughYear = companyPnL.reduce((worst, c) => c.ebit < worst.ebit ? c : worst, companyPnL[0]);
        return h("div", { style: { display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" } },
          h("div", null,
            h("div", { style: UI.caption }, troughYear.ebit < 0 ? "Deepest annual loss (burn)" : "Lowest annual EBIT (still profitable)"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: troughYear.ebit < 0 ? "var(--red)" : "var(--ink-1)" } },
              fmtMoney(troughYear.ebit), " (yr " + troughYear.calendarYear + ")")),
          h("div", null,
            h("div", { style: UI.caption }, "Peak EBIT"),
            h("div", { style: UI.stat }, fmtMoney(peakEbitYear.ebit), " (yr " + peakEbitYear.calendarYear + ")"))
        );
      })()
    ),

    ),

    panel("assumptions", h("div", { className: "assume-grid" + (theCase.programs.length > 0 && !navHidden ? " has-nav" : "") },
      theCase.programs.length > 0 && !navHidden && h(SectionNav, { groups: assumptionNavSections(theCase, activeProg), rootId: "casepanel-assumptions", active: tab === "assumptions", onHide: () => setNavHiddenSaved(true) }),
      h("div", { className: "assume-main" },
    // Case-level master mode — one click sets every program's revenue mode AND
    // the capital structure mode at once. Per-section toggles still work
    // afterward if you want to mix modes within the case. Highlighted state is
    // DERIVED from actual program/capital-structure modes (not a separate stored
    // flag) so it can never drift out of sync with what's really set — if you
    // manually change one program afterward, neither button stays highlighted,
    // which is the honest answer ("this case is now mixed").
    (() => {
      const capModeNow = (theCase.capitalStructure || {}).mode || "simple";
      const allQuick = theCase.programs.every(p => (p.revenueMode || "quick") === "quick") && capModeNow === "simple";
      const allDetailed = theCase.programs.every(p => p.revenueMode === "full") && capModeNow === "detailed";
      const setAll = (mode) => update({
        programs: theCase.programs.map(p => ({ ...p, revenueMode: mode === "quick" ? "quick" : "full" })),
        capitalStructure: { ...(theCase.capitalStructure || {}), mode: mode === "quick" ? "simple" : "detailed" }
      });
      return h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" } },
        h("span", { style: UI.captionMd }, "Set entire case:"),
        h("button", {
          onClick: () => setAll("quick"),
          style: { padding: "5px 14px", borderRadius: 7, border: "1px solid " + (allQuick ? "var(--teal)" : "var(--rule)"),
            background: allQuick ? "var(--teal-bg)" : "transparent", color: allQuick ? "var(--teal)" : "var(--ink-2)",
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: allQuick ? 700 : 400, cursor: "pointer" }
        }, "All Quick"),
        h("button", {
          onClick: () => setAll("detailed"),
          style: { padding: "5px 14px", borderRadius: 7, border: "1px solid " + (allDetailed ? "var(--amber)" : "var(--rule)"),
            background: allDetailed ? "var(--amber-bg)" : "transparent", color: allDetailed ? "var(--amber)" : "var(--ink-2)",
            fontFamily: "var(--mono)", fontSize: 11, fontWeight: allDetailed ? 700 : 400, cursor: "pointer" }
        }, "All Detailed"),
        h("span", { style: UI.caption },
          allQuick ? "— case is fully in Quick mode" : allDetailed ? "— case is fully in Detailed mode" : "— mixed: click to set every program + capital structure at once"),
        navHidden && theCase.programs.length > 0 && h("button", { type: "button", className: "link-btn", style: { marginLeft: "auto" }, onClick: () => setNavHiddenSaved(false) }, "Show section list")
      );
    })(),

      vs.inputs,
      theCase.programs.length > 0 && h(ExportSection, { nav: "ga", title: "Corporate G&A", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22 } },
        h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 12 } }, "Corporate G&A"),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8 } },
        h("div", { style: { flex: "1 1 200px" } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Pre-commercial corporate G&A"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", "aria-label": "Pre-commercial corporate G&A ($M per year)", value: corpGA.preCommercialAnnualM, placeholder: String(SGA_BENCHMARKS.preCommercialGA.medianM), onChange: e => updateCorpGA({ preCommercialAnnualM: e.target.value }),
              style: { flex: 1, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
            h("span", { style: { fontSize: 11, color: "var(--ink-3)" } }, "$M/yr")),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } }, "Benchmark: $" + SGA_BENCHMARKS.preCommercialGA.medianM + "M median")
        ),
        h("div", { style: { flex: "1 1 200px" } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "G&A share of mature SG&A"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", value: corpGA.gaShareOfMatureSgaPct, onChange: e => updateCorpGA({ gaShareOfMatureSgaPct: e.target.value }), "aria-label": "G&A share of mature SG&A (%)",
              style: { flex: 1, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
            h("span", { style: { fontSize: 11, color: "var(--ink-3)" } }, "%")),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } }, "Judgment call, not a sourced figure — see help below")
        ),
        // Read only by the failure floor on the Overview (computeFailureFloor):
        // how long overhead keeps running after a failed readout before the
        // company is wound down or restructured. Blank = one year.
        // Same width as the two fields above when it wraps under them.
        h("div", { style: { flex: "0 1 calc(50% - 6px)", minWidth: 200 } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Wind-down after a failed readout"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", min: 0, step: 0.5, value: corpGA.windDownYears == null ? "" : corpGA.windDownYears, placeholder: String(FAILURE_WIND_DOWN_YEARS_DEFAULT), onChange: e => updateCorpGA({ windDownYears: e.target.value }), "aria-label": "Wind-down after a failed readout (years of G&A)",
              style: { flex: 1, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
            h("span", { style: { fontSize: 11, color: "var(--ink-3)" } }, "yrs")),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } }, "Years of G&A a failure still costs; sets the Overview's failure floor")
        ),
        h("div", { style: { flex: "1 1 100%" } },
          h(Note, { summary: "Why this split exists" },
            "The " + SGA_BENCHMARKS.matureSgaPctOfRevenue + "% mature SG&A/revenue figure bundles G&A + Sales + Marketing. Sales & Marketing are already modeled per-program above, so this slider carves out the G&A-only share to avoid double-counting. 50% is a reasonable starting split, not a sourced number."))
      )),
      programPicker(true),
      editorFor("inputs")
    ), theCase.programs.length > 0 && h(LiveImpactPanel, { theCase, active: tab === "assumptions" }))),

    panel("scenarios", vs.scenarios),

    panel("evidence",
      vs.evidence,
      theCase.programs.length > 0 && programPicker(false),
      editorFor("evidence")
    ),

    panel("calibration",
      theCase.programs.length > 0 && programPicker(false),
      editorFor("calibration")
    )
  );
}
