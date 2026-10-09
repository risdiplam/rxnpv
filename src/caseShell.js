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
    priceAsOf: "", // the date of that price (set when it is typed); the Overview says how old it is
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
      opts: "", optK: "", war: "", warK: "", convFace: "", convPrice: "", prefShares: "",
      cashAsOf: "", monthlyBurn: "", carryCashForward: false
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
    const label = programLabel(p, theCase.programs) || ("Program " + (i + 1));
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
    { id: "program", label: "Drug & indication", state: changed(pick(program, ["name", "drugName", "indication", "therapeuticArea", "modality", "currentPhase", "launchYearOffset", "trialIds", "target"]), pick(dp, ["name", "drugName", "indication", "therapeuticArea", "modality", "currentPhase", "launchYearOffset", "trialIds", "target"])) },
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
    { id: "partner", label: "Partnership", state: (program.partnership || {}).enabled ? "set" : "" },
    { id: "licensor", label: "Owed to a licensor", state: (program.licensor || {}).enabled || sharedLicenceFor(program, theCase.programs) ? "set" : "" });
  groups.push({ label: programLabel(program, theCase.programs), items });
  return groups;
}

const CASE_TABS = [["overview", "Overview"], ["assumptions", "Assumptions"], ["scenarios", "Scenarios"], ["evidence", "Evidence"], ["calibration", "Calibration"], ["saved", "Saved"]];

// ── Saved: work kept in this case from Tools and Simulation ────────────────
// Everything saved with "Save to case" or added with "+ Report" — one list
// (theCase.pinnedResults). Each shows what it is and where it came from, can
// be ticked into or out of the PDF report, reopened in its tool with the
// inputs as they were, previewed, or removed.
function SavedPanel({ theCase, onChange, onReopen }) {
  const h = React.createElement;
  const [openId, setOpenId] = React.useState(null);
  const all = pinnedResultsOf(theCase);
  // The case's own saved results, newest first; then any worked examples, in
  // the order they were written (the sample case ships one per tool).
  const pins = all.filter(p => !isWorkedExample(p)).reverse();
  const examples = all.filter(isWorkedExample);
  const save = next => onChange({ ...theCase, pinnedResults: next, updatedAt: Date.now() });
  const fmtWhen = t => t ? new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  const whereTo = r => r.view === "simulation" ? "Simulation" : "Tools";
  const heading = text => h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, text);
  if (!pins.length && !examples.length) return h("div", { className: "saved-empty" },
    h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 6 } }, "Nothing saved to this case yet"),
    h("div", { className: "prose", style: UI.caption }, "In Tools or Simulation, open a result's Export menu and choose “Save to case”. It lands here with the inputs you used, so you can open it again exactly as you left it, and tick it into the PDF report when you want it there."));
  return h("div", null,
    pins.length > 0 && h("div", { style: { marginBottom: examples.length ? 26 : 0 } },
      heading("Saved to this case"),
      h("div", { className: "prose", style: { ...UI.caption, marginBottom: 14 } }, pins.length + " saved · " + pins.filter(p => p.included !== false).length + " in the PDF report · up to " + PINNED_MAX_PER_CASE_V2 + ". Newest first."),
      pins.map(p => h("div", { key: p.id, className: "saved-item" },
        h("div", { className: "saved-row" },
          h("div", { style: { minWidth: 0, flex: "1 1 260px" } },
            h("div", { className: "saved-title" }, p.title || "Untitled section"),
            h("div", { className: "saved-meta" }, [p.source, fmtWhen(p.capturedAt)].filter(Boolean).join(" · "))),
          h("label", { className: "saved-report" },
            h("input", { type: "checkbox", checked: p.included !== false, "aria-label": "Include " + (p.title || "this section") + " in the PDF report",
              onChange: () => save(all.map(x => x === p ? { ...x, included: x.included === false } : x)) }),
            "In the PDF report"),
          p.reopen && onReopen && h("button", { type: "button", className: "saved-btn", onClick: () => onReopen(p.reopen),
            title: "Open the " + (p.reopen.view === "simulation" ? "simulation" : "tool") + " with the inputs you saved; run it again for fresh results" }, "Open in " + whereTo(p.reopen) + " →"),
          h("button", { type: "button", className: "saved-btn", "aria-expanded": openId === p.id, onClick: () => setOpenId(openId === p.id ? null : p.id) }, openId === p.id ? "Hide" : "Show"),
          h(ConfirmXButton, { title: "Remove " + (p.title || "this item") + " from this case", label: "Remove", onConfirm: () => save(all.filter(x => x !== p)) })),
        openId === p.id && h("div", { className: "saved-preview" }, p.kind === "html"
          ? h(ReportSnapshot, { pin: p, dark: document.documentElement.getAttribute("data-theme") === "dark" })
          : p.dataUrl ? h("img", { src: p.dataUrl, alt: p.title || "Saved section", style: { maxWidth: "100%" } }) : null)))),
    examples.length > 0 && h("div", null,
      heading("Worked examples"),
      h("div", { className: "prose", style: { ...UI.caption, marginBottom: 14 } },
        examples.length + " tools and simulations set up for this case, each with where its numbers come from. Opening one fills in the tool and runs it, so the result is always current. To put a result in the PDF, use “Save to case” on it."),
      // Grouped by where they open — the Tools workbench, or Simulation — so
      // thirty rows read as six short lists; each row then names its tool.
      exampleGroups(examples).map(g => h("div", { key: g.name, className: "saved-group" },
        h("div", { className: "saved-group-name" }, g.name),
        g.items.map(({ p, tool }) => h("div", { key: p.id, className: "saved-item" },
        h("div", { className: "saved-row" },
          h("div", { style: { minWidth: 0, flex: "1 1 260px" } },
            h("div", { className: "saved-title" }, p.title || "Worked example"),
            h("div", { className: "saved-meta" }, tool)),
          p.reopen && onReopen && h("button", { type: "button", className: "saved-btn", onClick: () => onReopen(p.reopen),
            title: "Open " + (p.source || "the tool") + " with these inputs and run it" }, "Open in " + whereTo(p.reopen) + " →"),
          p.note && h("button", { type: "button", className: "saved-btn", "aria-expanded": openId === p.id, onClick: () => setOpenId(openId === p.id ? null : p.id) }, openId === p.id ? "Hide" : "Why these inputs"),
          h(ConfirmXButton, { title: "Remove " + (p.title || "this example") + " from this case", label: "Remove", onConfirm: () => save(all.filter(x => x !== p)) })),
        // Dated: a note quotes the case's numbers as they were when it was
        // written; opening the example runs it on today's case.
        openId === p.id && p.note && h("div", { className: "saved-preview prose", style: { ...UI.caption, color: "var(--ink-2)", lineHeight: 1.6 } },
          p.capturedAt && h("span", { style: { color: "var(--ink-3)" } }, "Written " + localDateStamp(new Date(p.capturedAt)) + " — figures as of then; opening it runs it on today's case. "),
          p.note)))))));
}
// "Tools · Trial · Trial Decoder" → group "Tools · Trial", tool "Trial Decoder";
// "Simulation · Trial Statistics · Fragility Index" → "Simulation", the rest.
function exampleGroups(examples) {
  const groups = [];
  examples.forEach(p => {
    const parts = String(p.source || "").split(" · ");
    const n = parts[0] === "Tools" ? 2 : 1;
    const name = parts.slice(0, n).join(" · ") || "Other", tool = parts.slice(n).join(" · ");
    let g = groups.find(x => x.name === name);
    if (!g) groups.push(g = { name, items: [] });
    g.items.push({ p, tool });
  });
  return groups;
}

function CaseView({ theCase, onChange, onDelete, onNavigateToTools, onReopenSaved }) {
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
    return { id: p.id, name: programLabel(p, theCase.programs), launchYearOffset: resolvedOffset, revenueResult: rev, program: p };
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
        launchYearOffset: p.launchYearOffset,
        licensor: effectiveLicensor(p.program, theCase.programs)
      });
    } catch (e) {}
    return { id: p.id, launchYearOffset: p.launchYearOffset, pnl };
  });
  // "If every program works": a licence shared across one drug's programs is
  // owed on their combined sales, every one of them selling (October 2026).
  const companyPnL = (() => {
    const rows = programPnLs.length ? computeCompanyPnL(programPnLs, corpGA, COMPANY_CALENDAR_YEARS) : [];
    const owed = drugLicenceExpectedByYear(programPnLs.map(p => ({ ...p, posToLaunch: 1 })), theCase.programs, rows.length);
    if (!owed.groups.length) return rows;
    return rows.map((c, i) => ({ ...c, licensor: (c.licensor || 0) + owed.total[i], productContribution: c.productContribution - owed.total[i], ebit: c.ebit - owed.total[i] }));
  })();
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
          title: multi ? "Show " + programLabel(p, theCase.programs) : undefined,
          style: { padding: multi ? "6px 14px" : "7px 16px", borderRadius: 7, border: "1px solid " + (isActive ? "var(--teal)" : "var(--rule)"),
            background: isActive ? "var(--teal-bg)" : "var(--surface)", color: isActive ? "var(--teal)" : "var(--ink-2)",
            fontFamily: "var(--mono)", fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: "pointer",
            textAlign: "left", lineHeight: 1.35 }
        },
          h("div", null, programLabel(p, theCase.programs)),
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
      onNavigateToTools,
      // Read at click time by the Evidence Log's "snapshot from the model".
      theCase
    });

  return h("div", { "data-export-context": "Workspace · " + (theCase.name || "Untitled case") },
    // Case header
    h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" } },
      h("input", { value: theCase.name, onChange: e => update({ name: e.target.value }), "aria-label": "Case name",
        style: { fontFamily: "var(--display)", fontSize: 26, fontWeight: 700, color: "var(--ink-1)", background: "transparent", border: "none", borderBottom: "2px solid var(--rule)", padding: "4px 0", flex: "1 1 260px", minWidth: 200 } }),
      // A leading "$" (cashtag habit) is dropped: tools search EDGAR and
      // ClinicalTrials.gov with this, and "$STOK" finds nothing.
      h("input", { value: theCase.ticker, onChange: e => update({ ticker: e.target.value.replace(/^\s*\$+/, "").toUpperCase() }), placeholder: "TICKER", "aria-label": "Ticker symbol",
        style: { width: 100, fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px" } }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
        h("span", { style: UI.captionMd }, "Current price"),
        h("span", { style: { fontSize: 13, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "$"),
        // Typing a price stamps it with today's date (theCase.priceAsOf) so
        // the Overview can say how old it is; the date can be set to the
        // close the price came from.
        h("input", { type: "number", value: theCase.currentPrice, onChange: e => update({ currentPrice: e.target.value, priceAsOf: localDateStamp() }), placeholder: "0.00", "aria-label": "Current share price in dollars",
          style: { width: 80, fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink-1)", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px" } }),
        theCase.currentPrice !== "" && theCase.currentPrice != null && h("input", { type: "date", value: theCase.priceAsOf || "", onChange: e => update({ priceAsOf: e.target.value }), "aria-label": "Price as of", title: "The date of this price",
          style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "5px 6px", minHeight: 28 } })
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
    h(CalibrationNudge, { theCase, update, tab, setTab }),

    // ── Case sub-tabs (September 2026) ────────────────────────────────────
    // One long page became five tabs. Every tab stays mounted and the
    // inactive ones are hidden, so results (a Monte Carlo run, an open card)
    // survive switching, and every section and export control still exists.
    h("div", { className: "case-tabs", role: "tablist", "aria-label": "Case sections" },
      CASE_TABS.map(([id, label]) => h("button", { key: id, type: "button", role: "tab", id: "casetab-" + id, "aria-selected": tab === id,
          "aria-controls": "casepanel-" + id, className: "case-tab" + (tab === id ? " on" : ""), onClick: () => setTab(id) },
        label,
        id === "evidence" && vs.flagCount > 0 && h("span", { className: "case-tab-count warn", title: vs.flagCount + " input" + (vs.flagCount > 1 ? "s" : "") + " worth a second look" }, String(vs.flagCount)),
        id === "calibration" && openPredictions > 0 && h("span", { className: "case-tab-count", title: openPredictions + " open prediction" + (openPredictions > 1 ? "s" : "") }, String(openPredictions)),
        id === "saved" && pinnedResultsOf(theCase).length > 0 && h("span", { className: "case-tab-count", title: pinnedResultsOf(theCase).length + " saved" }, String(pinnedResultsOf(theCase).length))))),

    panel("overview",
      theCase.programs.length === 0 && h("div", { className: "empty-note" }, "This case has no programs yet. ",
        h("button", { type: "button", className: "link-btn", onClick: () => setTab("assumptions") }, "Add one on Assumptions →")),
      vs.overview,
    // Company revenue and P&L, if every program works — one card. They were
    // two: the rollup chart, then a P&L card whose "Revenue" setting showed
    // nothing at all (the revenue chart was the card above), so by default
    // it was a heading, a line about G&A and two buttons.
    theCase.programs.length > 0 && h(ExportSection, { id: "ws-revenue", title: "Company revenue and P&L", reportSection: "revenueChart", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22, marginTop: 16 } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 4 } },
        h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)" } }, "Company revenue and P&L"),
        rollupView === "ebit" && companyPnL.length > 0 && peakEbitYear
          ? h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Peak EBIT: ", h("b", { style: { color: "var(--ink-1)" } }, fmtMoney(peakEbitYear.ebit)), " in ", new Date().getFullYear() + peakEbitYear.calendarYear)
          : peakCalendarYear && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Peak: ", h("b", { style: { color: "var(--ink-1)" } }, fmtMoney(peakCalendarYear.totalRevenue)), " in ", new Date().getFullYear() + peakCalendarYear.calendarYear)),
      h("div", { className: "prose", style: { ...UI.caption, marginBottom: 10 } },
        "If " + (theCase.programs.length > 1 ? "every program works" : "it works") + " — no odds applied. Corporate G&A $" + (corpGA.preCommercialAnnualM || SGA_BENCHMARKS.preCommercialGA.medianM) + "M a year before revenue, " + (corpGA.gaShareOfMatureSgaPct || 50) + "% of mature SG&A after. ",
        h("button", { type: "button", className: "link-btn", onClick: () => setTab("assumptions") }, "Edit on Assumptions →")),
      companyPnL.length > 0 && h("div", { role: "group", "aria-label": "Company chart", className: "proj-toggle", "data-no-export": "", style: { marginBottom: 12, display: "inline-flex" } },
        [["revenue", "Revenue"], ["ebit", "P&L waterfall"]].map(([id, lbl]) => h("button", { key: id, type: "button", "aria-pressed": rollupView === id, className: rollupView === id ? "on" : "", onClick: () => setRollupView(id) }, lbl))),
      excludedPrograms.length > 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)", background: "var(--warn-bg)", border: "1px solid var(--warn)", borderRadius: 6, padding: "6px 10px", marginBottom: 10 } },
        (excludedPrograms.length === 1 ? "“" + excludedPrograms[0] + "” is" : excludedPrograms.length + " programs are")
        + " not included in this rollup or in any valuation below — their revenue build couldn't be computed, usually because a required field is still blank. "
        + "Every total on this page excludes " + (excludedPrograms.length === 1 ? "it" : "them") + "."),
      (rollupView !== "ebit" || !companyPnL.length) && h(ExportableBlock, { title: (theCase.name || "Case") + " — company revenue rollup" },
        h(RevenueChart, { series: totalSeries.concat(aggChartSeries.length > 1 ? aggChartSeries : []), showLegend: theCase.programs.length > 1, height: 200, xPrefix: "", xAxisPrefix: "" })),
      rollupView === "ebit" && companyPnL.length > 0 && h(ExportableBlock, { title: (theCase.name || "Case") + " — P&L by year" },
        h(RevenueChart, { series: ebitSeries, showLegend: true, height: 200, xPrefix: "", xAxisPrefix: "" })),
      rollupView === "ebit" && companyPnL.length > 0 && (() => {
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
    // "Set entire case: All Quick / All Detailed" now lives in the Company
    // card's "Mix and match" fold, next to the presets it overlapped.
    navHidden && theCase.programs.length > 0 && h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 } },
      h("button", { type: "button", className: "link-btn", onClick: () => setNavHiddenSaved(false) }, "Show section list")),

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
        // How long overhead keeps running after a failed readout before the
        // company is wound down or restructured. Blank = one year. Read by the
        // failure floor (computeFailureFloor) and by the valuation's overhead,
        // which stops that long after each failure (computeCompanyActiveByYear).
        // Same width as the two fields above when it wraps under them.
        h("div", { style: { flex: "0 1 calc(50% - 6px)", minWidth: 200 } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Wind-down after a failed readout"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", min: 0, step: 0.5, value: corpGA.windDownYears == null ? "" : corpGA.windDownYears, placeholder: String(FAILURE_WIND_DOWN_YEARS_DEFAULT), onChange: e => updateCorpGA({ windDownYears: e.target.value }), "aria-label": "Wind-down after a failed readout (years of G&A)",
              style: { flex: 1, padding: "6px 9px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
            h("span", { style: { fontSize: 11, color: "var(--ink-3)" } }, "yrs")),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } }, "Years of G&A a failure still costs — in the valuation and the failure floor")
        ),
        h("div", { style: { flex: "1 1 100%" } },
          h(Note, { summary: "Why this split exists" },
            "The " + SGA_BENCHMARKS.matureSgaPctOfRevenue + "% mature SG&A/revenue figure bundles G&A + Sales + Marketing. Sales & Marketing are already modeled per-program above, so this slider carves out the G&A-only share to avoid double-counting. 50% is a reasonable starting split, not a sourced number.",
            h("div", { style: { marginTop: 8 } }, "How it is charged: overhead is weighted by the odds the company is still there to pay it, the same way R&D is. Before launch it is the pre-commercial figure times the odds the programme is still in development (or winding down after a failure); after launch it is set by the revenue the drug has if it launched, times the odds it did. A company that fails stops paying it once the wind-down ends.")))
      )),
      programPicker(true),
      editorFor("inputs")
    ), theCase.programs.length > 0 && h(LiveImpactPanel, { theCase, active: tab === "assumptions" }))),

    panel("scenarios", vs.scenarios),

    panel("evidence",
      vs.evidence,
      theCase.programs.length > 0 && h(ChangeMyMindCard, { theCase, update }),
      theCase.programs.length > 0 && programPicker(false),
      editorFor("evidence")
    ),

    panel("calibration",
      theCase.programs.length > 0 && programPicker(false),
      editorFor("calibration")
    ),
    panel("saved", tab === "saved" && h(SavedPanel, { theCase, onChange: update, onReopen: onReopenSaved }))
  );
}

// What would change my mind (October 2026): four short, optional answers,
// written before the catalyst and printed verbatim in the decision memo —
// the part to re-read on readout morning. Case-level, stored as theCase.memo.
const CHANGE_MY_MIND_FIELDS = [
  ["efficacy", "Efficacy bar", "e.g. the readout needs at least a 40% cut in seizures against sham"],
  ["safety", "Safety bar", "e.g. any CSF-protein signal that leads to a dosing change"],
  ["cash", "Cash and dilution bar", "e.g. a raise above $150M before the readout"],
  ["competitor", "Competitor bar", "e.g. Encoded's ETX101 showing a comparable effect first"]
];
function ChangeMyMindCard({ theCase, update }) {
  const h = React.createElement;
  const m = theCase.memo || {};
  const filled = CHANGE_MY_MIND_FIELDS.filter(([k]) => (m[k] || "").trim()).length;
  return h(SectionCard, { title: "What would change my mind", subtitle: "Written before the catalyst, printed in the decision memo" + (filled ? " · " + filled + " of 4 filled" : ""), defaultOpen: filled > 0 },
    h("div", { className: "prose", style: { ...UI.caption, marginBottom: 10, lineHeight: 1.6 } }, "Short and specific: the result, event or number that would make you sell, size down or stop waiting. Each is optional and printed as you write it."),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 } },
      CHANGE_MY_MIND_FIELDS.map(([k, label, ph]) => h("label", { key: k, style: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)" } },
        label,
        h("textarea", { value: m[k] || "", rows: 2, placeholder: ph, "aria-label": label, onChange: e => update({ memo: { ...m, [k]: e.target.value } }),
          style: { padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--sans)", fontSize: 12, resize: "vertical" } })))));
}

// Calibration nudge, and closing out a pinned catalyst (October 2026). Once a
// catalyst's date (a window's END) has passed, the banner says so; a pinned
// one gets "Close out": what happened, the result where it was a scored
// prediction, and what it changed — written to the same Calibration Log
// entry — then the offer of a fresh, dated model snapshot, so the before
// and after both exist. Only when the user means to keep it.
function CalibrationNudge({ theCase, update, tab, setTab }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(null); // entryId being closed out
  const [form, setForm] = React.useState({ happened: "", outcome: "pending", changed: "" });
  const [after, setAfter] = React.useState(null); // { programId } once saved
  const { overdue } = pendingCalibrationEntries(theCase);
  const saveCloseOut = (row) => {
    const programs = theCase.programs.map(p => p.id !== row.programId ? p : { ...p, calibrationLog: (p.calibrationLog || []).map(e => e.id !== row.entryId ? e : {
      ...e, outcome: form.outcome === "pending" ? (e.outcome || "pending") : form.outcome,
      closeOut: { at: localDateStamp(), happened: form.happened.trim(), changed: form.changed.trim() } }) });
    update({ programs });
    setOpen(null); setAfter({ programId: row.programId, label: row.catalystLabel });
  };
  const snapshot = () => {
    const prog = theCase.programs.find(p => p.id === after.programId);
    const entry = buildModelSnapshot(theCase);
    if (prog && entry) update({ programs: theCase.programs.map(p => p.id !== prog.id ? p : { ...p, evidenceLog: addModelSnapshot(p.evidenceLog || [], entry, () => newId("ev")).log }) });
    setAfter(null);
  };
  if (after) return h("div", { className: "closeout-done", style: { padding: "7px 14px", marginBottom: 16, background: "var(--surface)", borderLeft: "2px solid var(--teal)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" } },
    h("span", null, "Closed out \u201c" + (after.label || "the catalyst") + "\u201d. Take a fresh model snapshot, so the Evidence Log holds the before and the after?"),
    h("button", { type: "button", className: "link-btn", onClick: snapshot }, "Take a snapshot"),
    h("button", { type: "button", className: "link-btn", onClick: () => setAfter(null) }, "Not now"));
  if (overdue.length === 0) return null;
  const detail = overdue.slice(0, 3).map(e => e.programName + " — " + (e.catalystLabel || "prediction") + (e.catalystDate ? " (" + e.catalystDate + ")" : "")).join(" · ");
  const pinnedDue = overdue.filter(e => e.pinned).slice(0, 3);
  const inputStyle = { padding: "5px 8px", minHeight: 28, borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };
  return h("div", { style: { padding: "7px 14px", marginBottom: 16, background: "var(--surface)", borderLeft: "2px solid var(--teal)", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
    h("div", null,
      h("span", { style: { color: "var(--teal)", fontWeight: 700 } }, overdue.length + " calibration prediction" + (overdue.length > 1 ? "s" : "") + " past its catalyst date"),
      " — score " + (overdue.length > 1 ? "them" : "it") + " against what actually happened, in the program's Calibration Log. ",
      tab !== "calibration" && h("button", { type: "button", className: "link-btn", onClick: () => setTab("calibration") }, "Open Calibration →"),
      h("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 3 } }, detail + (overdue.length > 3 ? " · +" + (overdue.length - 3) + " more" : ""))),
    pinnedDue.map(row => h("div", { key: row.entryId, className: "closeout", style: { marginTop: 6 } },
      open !== row.entryId
        ? h("button", { type: "button", className: "link-btn", onClick: () => { setOpen(row.entryId); setForm({ happened: "", outcome: "pending", changed: "" }); } }, "Close out \u201c" + (row.catalystLabel || "the catalyst").split(/[,(]/)[0].trim() + "\u201d")
        : h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 4, maxWidth: 640 } },
            h("input", { type: "text", value: form.happened, "aria-label": "What happened", placeholder: "What happened (your words)", onChange: e => setForm({ ...form, happened: e.target.value }), style: inputStyle }),
            h("select", { value: form.outcome, "aria-label": "Result", onChange: e => setForm({ ...form, outcome: e.target.value }), style: inputStyle },
              h("option", { value: "pending" }, "Result: leave unscored"), h("option", { value: "success" }, "Success"), h("option", { value: "failure" }, "Failure")),
            h("input", { type: "text", value: form.changed, "aria-label": "What this changed", placeholder: "What this changed in the thesis", onChange: e => setForm({ ...form, changed: e.target.value }), style: inputStyle }),
            h("div", { style: { display: "flex", gap: 8 } },
              h("button", { type: "button", onClick: () => saveCloseOut(row), style: { padding: "4px 12px", minHeight: 28, borderRadius: 5, border: "none", background: "var(--teal-fill)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "Save close-out"),
              h("button", { type: "button", onClick: () => setOpen(null), style: { padding: "4px 12px", minHeight: 28, borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Cancel"))))));
}
