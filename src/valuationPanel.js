// ════════════════════════════════════════════════════════════════════════════
// Valuation sections — discount rate, terminal value, capital structure, the
// headline results and the Bear/Base/Bull comparison, spread across CaseView's
// Overview, Assumptions, Scenarios and Evidence tabs.
// ════════════════════════════════════════════════════════════════════════════
// Computes the case valuation ONCE and returns each Workspace tab's piece of
// it: { overview, inputs, scenarios, evidence, flagCount }. A hook rather than
// a component, so the heavy work (three scenario valuations, the implied-PoS
// solve) runs once per render instead of once per tab it appears in.
function useValuationSections({ theCase, onChange, goToTab }) {
  const h = React.createElement;
  const update = (patch) => onChange({ ...theCase, ...patch, updatedAt: Date.now() });

  const discountRatePct = theCase.discountRatePct || "";
  const tv = theCase.terminalValue || { enabled: false, growthPct: "0" };
  const cap = theCase.capitalStructure || { mode: "simple" };
  const valMethod = theCase.valuationMethod || "dcf";
  // Defaults to a single constant 3x across all three scenarios — matching
  // how the DCF's own exit multiple behaves by default (one case-level
  // assumption; per-scenario variation is opt-in, not automatic). An earlier
  // version defaulted to 2x/3x/5x, which meant Bear silently compounded
  // THREE haircuts (lower revenue AND lower PoS AND a lower multiple) while
  // DCF's default only compounds two — a real default-behavior mismatch
  // between the two methods, not a math bug, since each multiple was always
  // independently overridable. Fixed so the two methods are consistent by
  // default; a user who wants the multiple to also vary by scenario can
  // still type that in deliberately.
  const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };
  const setMultipleAssumptions = (patch) => update({ multipleAssumptions: { ...multipleAssumptions, ...patch } });
  const basePosAdjustmentPct = theCase.basePosAdjustmentPct || "";

  const setTV = (patch) => update({ terminalValue: { ...tv, ...patch } });
  const setCap = (patch) => update({ capitalStructure: { ...cap, ...patch } });

  const [edgarQuery, setEdgarQuery] = React.useState(theCase.ticker || theCase.name || "");
  // Follows the case's ticker (else its name) until the user types here: it
  // used to be read once, when the card first appeared, so a case created and
  // then named in the header still searched EDGAR for "New Case".
  const edgarTyped = React.useRef(false);
  React.useEffect(() => {
    if (!edgarTyped.current) setEdgarQuery(theCase.ticker || theCase.name || "");
  }, [theCase.id, theCase.ticker, theCase.name]);
  const [edgarLoading, setEdgarLoading] = React.useState(false);
  const [edgarResult, setEdgarResult] = React.useState(null);
  const [edgarError, setEdgarError] = React.useState(null);
  // After every hook call, so the hook order never changes.
  if (!theCase.programs || theCase.programs.length === 0) return { overview: null, inputs: null, scenarios: null, evidence: null, flagCount: 0 };
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const pullFromEdgar = async (force) => {
    if (!edgarQuery.trim()) { setEdgarError("Enter a company name or ticker first."); return; }
    setEdgarLoading(true); setEdgarError(null);
    try {
      const r = await pullEdgarFinancials(edgarQuery.trim(), force);
      if (!r.ok) { setEdgarError(r.error); setEdgarResult(null); }
      else {
        setEdgarResult(r);
        const patch = { cash: r.cash != null ? String(r.cash) : cap.cash, debt: r.debt != null ? String(r.debt) : cap.debt,
          // The balance-sheet date and burn: remembered for Cash Runway, the rough
          // "if it fails" estimate, and rolling cash forward if the user opts in.
          cashAsOf: r.cash != null && r.asOf ? r.asOf : cap.cashAsOf, monthlyBurn: r.quarterlyBurnUSD > 0 ? String(Math.round(r.quarterlyBurnUSD / 3)) : cap.monthlyBurn };
        if (cap.mode === "simple") {
          patch.dilutedSharesSimple = r.dilutedShares != null ? String(r.dilutedShares) : (r.basicShares != null ? String(r.basicShares) : cap.dilutedSharesSimple);
        } else {
          // Detailed mode: also pull options/warrants/convertible face value where XBRL has them.
          // These tags are far less standardized than basic shares/cash/debt, so only fields
          // actually found get overwritten — anything not found is left for you to fill in,
          // and the result panel below tells you exactly which is which.
          patch.basicShares = r.basicShares != null ? String(r.basicShares) : cap.basicShares;
          if (r.options && r.options.count != null) patch.opts = String(r.options.count);
          if (r.options && r.options.avgStrike != null) patch.optK = String(r.options.avgStrike);
          if (r.warrants && r.warrants.count != null) patch.war = String(r.warrants.count);
          if (r.warrants && r.warrants.avgStrike != null) patch.warK = String(r.warrants.avgStrike);
          if (r.convertibleFace != null) patch.convFace = String(r.convertibleFace);
        }
        update({
          capitalStructure: { ...cap, ...patch },
          programs: appendEdgarEvidenceToPrograms(theCase.programs, r, "Capital Structure's “Pull from EDGAR”")
        });
      }
    } catch (e) { setEdgarError(e.message); }
    setEdgarLoading(false);
  };

  // Effective scenario presets = benchmark defaults with any case-level overrides
  // applied. Base case is never overridden (it's the 100%/0pp reference point).
  const scenarioOv = theCase.scenarioOverrides || { bear: {}, bull: {} };
  const effectivePreset = (key) => getEffectiveScenarioPreset(theCase, key);
  const setScenarioOv = (key, patch) => update({ scenarioOverrides: { ...scenarioOv, [key]: { ...(scenarioOv[key] || {}), ...patch } } });

  let scenarioResults = null, error = null;
  try {
    const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    scenarioResults = ["bear", "base", "bull"].map(key => {
      const preset = effectivePreset(key);
      const r = valMethod === "multiple"
        ? computeSimpleMultipleValuation(theCase, preset, key, numOr(multipleAssumptions[key], 3), drBase)
        : computeCaseValuation(theCase, preset, key, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
      return { key, preset, result: r };
    });
  } catch (e) { error = e.message; }

  const baseResult = scenarioResults && scenarioResults.find(s => s.key === "base").result;
  // The same case with every program at literal 100% odds on the raw Base
  // preset: what the model says the company is worth if the drug works. Shown
  // beside the odds-weighted scenarios so Base never reads as the failure case,
  // and used by the range strip and the Projections card's "If it works" view.
  let successResult = null;
  if (valMethod === "dcf" && !error && scenarioResults) {
    try {
      const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      successResult = computeCaseValuation({ ...theCase, programs: theCase.programs.map(p => ({ ...p, posOverridePct: "100" })) }, SCENARIO_PRESETS.base, "base", drBase,
        { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
    } catch (e) { successResult = null; }
  }
  const successPerShare = successResult && successResult.equity && isFinite(successResult.equity.perShare) ? successResult.equity.perShare : null;
  // Already approved (or 100% odds typed in): "if it works" is just Base.
  const showSuccess = successPerShare != null && baseResult && baseResult.equity && Math.abs(successPerShare - baseResult.equity.perShare) >= 0.005;

  // Hoisted out of the detailed "What this case's price implies" box further
  // down so the prominent summary card at the top of this panel can use the
  // exact same solve — one computation, two presentations, never two chances
  // to quietly disagree with each other.
  let impliedSolved = null, impliedSolveError = null;
  if (theCase.currentPrice !== "" && theCase.currentPrice != null && valMethod === "dcf" && !error) {
    try {
      const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      impliedSolved = solveImpliedPoSMultiplier(theCase, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
    } catch (e) { impliedSolveError = e.message; }
  }

  // The whole card is one exportable section, and each distinct analysis packed
  // inside it is its own as well, so a reader can take out just the bridge or
  // just the scenarios. Where the report already renders the same analysis live
  // from the model, "+ Report" switches that section on rather than storing a
  // snapshot of it.
  const PART_TITLES = { overview: "Valuation", inputs: "Company-level assumptions", scenarios: "Scenarios", evidence: "Inputs worth a second look" };
  const allFlags = computeRedFlags(theCase);
  // Flags marked "considered" collapse and stop counting toward the pointer
  // and the Evidence tab's badge (splitConsideredFlags).
  const { open: flags, considered: consideredFlags } = splitConsideredFlags(theCase, allFlags);
  const today = localDateStamp();
  const setConsidered = (key, on) => update({ consideredFlags: markFlagConsidered(theCase, allFlags, key, on, today) });
  const renderPart = (part) => {
    const show = (p) => p.split("|").includes(part);
    // The Scenarios tab holds exactly one section (the scenario comparison,
    // which exports itself), so its wrapper is a plain card — a second Export
    // around it would only duplicate it.
    return h(part === "scenarios" ? "div" : ExportSection, { id: part === "overview" ? "ws-valuation" : undefined, nav: part === "inputs" ? "company" : undefined, title: part === "scenarios" ? undefined : PART_TITLES[part], style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22 } },
    part !== "scenarios" && h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 14 } }, PART_TITLES[part]),

    // A one-line pointer to the red-flag checks, which live on Evidence.
    (show("overview") || show("inputs")) && flags.length > 0 && h("button", { type: "button", onClick: () => goToTab && goToTab("evidence"), className: "flag-pointer" },
      h("span", { "aria-hidden": "true" }, "●"),
      flags.length + " input" + (flags.length > 1 ? "s" : "") + " worth a second look", h("span", { className: "flag-pointer-go" }, "Review on Evidence →")),
    show("evidence") && allFlags.length === 0 && h("div", { style: { fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 } },
      "Nothing stands out: every input this app checks sits within its benchmark range."),
    show("evidence") && allFlags.length > 0 && flags.length === 0 && h("div", { style: { fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 10 } },
      "Nothing new to look at: every flag below has been marked considered. Change the input behind one and it opens again."),

    // Red flags — cross-checks this case's own inputs against the same
    // benchmarks and formulas used elsewhere in the app, before presenting
    // what those inputs produce. Purely descriptive, never a verdict — see
    // computeRedFlags in scenarioEngine.js for exactly what's checked and why.
    show("evidence") && flags.length > 0 && ((() => {
      const highCount = flags.filter(f => f.severity === "high").length;
      return h("div", { style: { marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "var(--warn-bg)", border: "1px solid var(--warn)" } },
        h("div", { style: { fontSize: 12, fontFamily: "var(--display)", fontWeight: 600, color: "var(--warn)", marginBottom: 8 } },
          flags.length + " input" + (flags.length > 1 ? "s" : "") + " worth a second look" + (highCount > 0 ? " (" + highCount + " large deviation" + (highCount > 1 ? "s" : "") + ")" : "")),
        flags.map((f, i) => h("div", { key: f.key, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: i < flags.length - 1 ? 8 : 0, paddingLeft: 10, borderLeft: "2px solid " + (f.severity === "high" ? "var(--red)" : "var(--amber)") } },
          f.programName && h("span", { style: { fontWeight: 700, color: "var(--ink-1)" } }, f.programName + ": "),
          f.message, " ",
          h("button", { type: "button", className: "link-btn", "data-no-export": "", style: { fontSize: 11 }, onClick: () => setConsidered(f.key, true),
            title: "You have looked at this and have a reason (an Evidence Log entry, say). It collapses and stops counting; it opens again if the input behind it changes." }, "Mark considered")
        ))
      );
    })()),
    // Considered flags: one line each, dated, with a way back.
    show("evidence") && consideredFlags.length > 0 && h("div", { style: { marginBottom: 16 } },
      h("div", { style: { ...UI.captionMd, marginBottom: 6 } }, consideredFlags.length + " considered"),
      consideredFlags.map(f => h("div", { key: f.key, style: { ...UI.caption, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 } },
        h("span", { title: f.message, style: { flex: "1 1 300px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          "Considered" + (f.consideredAt ? " " + f.consideredAt : "") + " — " + (f.programName ? f.programName + ": " : "") + f.message),
        h("button", { type: "button", className: "link-btn", "data-no-export": "", style: { fontSize: 11 }, onClick: () => setConsidered(f.key, false) }, "Reopen")))),

    // Price vs. model — a prominent, glanceable summary placed ahead of every
    // input section rather than buried after them, so "what does this case
    // say right now" doesn't require scrolling past the whole build to find.
    // Pulls together numbers already computed elsewhere on this panel
    // (scenarioResults for the Bear/Base/Bull targets, impliedSolved for the
    // PoS the price requires) rather than a separate calculation — this is a
    // presentation change, not a new number.
    show("overview") && (!error && scenarioResults && (() => {
      const price = theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null;
      const showImplied = impliedSolved && impliedSolved.ok && !impliedSolved.degenerate;
      return h("div", { style: { marginBottom: 16, padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", border: "1.5px solid var(--rule)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } }, "Price vs. model"),
        h("div", { style: { display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" } },
          h("div", null,
            h("div", { style: UI.caption }, "Current price"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, price != null ? fmtShare(price) : "—")),
          // Each scenario's move from today's price sits under its value — it
          // used to be a second row of the same three numbers at the foot of
          // the Overview.
          scenarioResults.map(s => h("div", { key: s.key },
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: s.preset.color, } }, s.preset.label + " fair value"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: s.preset.color } },
              fmtShare(s.result.equity.perShare)),
            price > 0 && s.result.equity.perShare != null && isFinite(s.result.equity.perShare) && h("div", { className: "pvm-move" + (s.result.equity.perShare >= price ? " up" : " down") },
              (s.result.equity.perShare >= price ? "+" : "−") + Math.abs(Math.round((s.result.equity.perShare / price - 1) * 100)) + "% vs today"))),

          showSuccess && h("div", { className: "pvm-works" },
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--green)" } }, "If it works"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--green)" } }, fmtShare(successPerShare)),
            price > 0 && h("div", { className: "pvm-move" + (successPerShare >= price ? " up" : " down") },
              (successPerShare >= price ? "+" : "−") + Math.abs(Math.round((successPerShare / price - 1) * 100)) + "% vs today")),
          showImplied && theCase.programs.length === 1 && impliedSolved.baseAbsolutePct != null && h("div", null,
            h("div", { style: UI.caption }, "Your PoS"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, impliedSolved.baseAbsolutePct.toFixed(0) + "%")),
          showImplied && theCase.programs.length === 1 && impliedSolved.impliedAbsolutePct != null && h("div", null,
            h("div", { style: UI.caption }, "Price implies"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: impliedSolved.impliedAbsolutePct >= impliedSolved.baseAbsolutePct ? "var(--green)" : "var(--red)" } },
              impliedSolved.impliedAbsolutePct.toFixed(0) + "%"),
            h("div", { className: "pvm-move" }, impliedSolved.multiplierPct.toFixed(0) + "% of your odds"))
        ),
        h(FreshnessStrip, { theCase }),
        (() => { const by = k => (scenarioResults.find(s => s.key === k) || { result: { equity: {} } }).result.equity.perShare;
          const r = readPriceVsScenarios(price, by("bear"), by("base"), by("bull"));
          return r && h(Explain, Object.assign({ onTint: true }, r)); })(),
        showSuccess && h("div", { className: "prose", style: { ...UI.caption, marginTop: 8 } },
          "Bear, Base and Bull are each weighted by the odds of launch" + (theCase.programs.length === 1 && baseResult.programVals && baseResult.programVals[0] ? " (Base: " + Math.round(baseResult.programVals[0].posToLaunch * 100) + "%)" : "") +
          " — the average across the ways it can go, not the failure case. \u201cIf it works\u201d is Base with the drug approved: the value if every remaining readout and the FDA go its way."),
        // The case at a glance — evidence, odds and value as one picture
        // (caseGlance.js) — inside this card, under the numbers it pictures.
        valMethod === "dcf" && theCase.programs.length === 1 && h(CaseGlance, { theCase, scenarioResults, impliedSolved, embedded: true }),
        valMethod === "multiple" && h("div", { style: { ...UI.caption, marginTop: 8 } }, "Implied PoS is DCF-only — switch off Simple Multiple to see what the price requires."),
        price == null && h("div", { style: { ...UI.caption, marginTop: 8 } }, "Set a current price above to see upside/downside and implied PoS."),
        valMethod === "dcf" && price != null && theCase.programs.length > 1 && h("div", { style: { ...UI.caption, marginTop: 8 } }, "Implied PoS as a single absolute number needs one program — see \"as a multiple\" further down for the multi-program version.")
      );
    })()),

    // The panels below value each OUTCOME on its own (works / fails at each
    // gate) rather than the odds-weighted average above. A heading says so,
    // so "if it fails" never reads as the model's view of the company.
    show("overview") && (!error && scenarioResults && valMethod === "dcf" && theCase.programs.length === 1 && showSuccess && h("div", { style: { margin: "6px 0 10px" } },
      h("div", { style: { fontSize: 15, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)" } }, "What each outcome is worth"),
      h("div", { className: "prose", style: { ...UI.caption, marginTop: 3 } }, "The figures above average over success and failure. These value each ending on its own — the drug approved, or stopped at each readout — with the odds of each, so you can see what a win and a miss would each mean for the share price."))),

    // The whole range on one line: what is left if the readout fails, your
    // three scenarios, today's price, and the value if the drug works.
    show("overview") && (!error && scenarioResults && valMethod === "dcf" && (() => {
      // Literal 100% odds on the raw Base preset (successResult, above) —
      // "works" means certain success, not certain relative to any case-level
      // PoS adjustment.
      const success = successPerShare;
      let floor = null;
      try { floor = computeFailureFloor(theCase); } catch (e) { return null; }
      const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
      const by = k => scenarioResults.find(s => s.key === k).result.equity.perShare;
      // Nothing to place on a per-share line until there is a share count.
      if (![by("bear"), by("base"), by("bull")].every(v => v != null && isFinite(v))) return null;
      const one = theCase.programs.length === 1 && impliedSolved && impliedSolved.ok && !impliedSolved.degenerate;
      const marks = [
        floor && { value: floor.perShare, name: "If it fails", text: "≈" + fmtShare(floor.perShare), color: "var(--red)", row: "above" },
        price != null && { value: price, name: "Today", text: fmtShare(price), color: "var(--warn)", row: "above" },
        // Already approved: "if it works" is simply Base, so not marked twice.
        success != null && Math.abs(success - by("base")) >= 0.005 && { value: success, name: "If it works", text: fmtShare(success) + (theCase.programs.length === 1 ? " at Base share" : ""), color: "var(--green)", row: "above" },
        { value: by("bear"), name: "Bear", text: fmtShare(by("bear")), color: "var(--red)", row: "below" },
        { value: by("base"), name: "Base", text: fmtShare(by("base")), color: "var(--slate)", row: "below" },
        { value: by("bull"), name: "Bull", text: fmtShare(by("bull")), color: "var(--green)", row: "below" }
      ].filter(Boolean);
      return h(ExportSection, { title: "The whole range, on one line", style: { marginBottom: 16 } },
        h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "The whole range, on one line"),
        h("div", { className: "prose", style: { ...UI.caption, marginBottom: 6 } }, (Math.abs((success || 0) - by("base")) < 0.005 ? "Your scenarios and today's price on one line; with no catalyst left to fail, there is no failure floor." : (floor ? "From what is left if the next readout fails" : "From your Bear case") + " to what it is worth if it works, with your scenarios and today's price in between.") + " The shaded stretch is Bear to Bull."),
        h(ExportableBlock, { title: (theCase.name || "Case") + " — range of outcomes per share" },
          h(OutcomeRangeStrip, { marks, band: [Math.min(by("bear"), by("bull")), Math.max(by("bear"), by("bull"))], label: "Range of outcomes per share: failure, scenarios, today's price and success" })),
        floor && h(Explain, readOutcomeRange(floor.perShare, success, price, one ? impliedSolved.impliedAbsolutePct : null)),
        floor && h("div", { style: { marginTop: 8 } }, h(Note, { summary: "How “if it fails” is worked out" + (floor.method === "burn" ? " (rough estimate on)" : ""), open: floor.method === "burn" || floor.burnMissing },
          h("div", null,
            floor.method === "burn"
              ? "Net cash at the filing " + fmtMoney(floor.netCash) + " − " + fmtMoney(floor.monthlyBurn) + " a month for " + floor.monthsToReadout.toFixed(1) + " months to the readout (" + fmtMoney(floor.burnToReadout) + "; the date from " + floor.readoutSource + ")"
              : "Net cash " + fmtMoney(floor.netCash) + " − " + floor.stageLabel + " cost to the readout " + fmtMoney(floor.trialCost) + " (the company's share) − G&A to the readout " + fmtMoney(floor.gaToReadout),
            " − " + floor.windDownYears + " year" + (floor.windDownYears === 1 ? "" : "s") + " of wind-down G&A " + fmtMoney(floor.windDown) + " = " + fmtMoney(floor.equity) + ", ÷ " + fmtNum(Math.round(floor.shares)) + " shares at that price" +
            (floor.cashShort ? " — cash runs out first, so without new money the equity is worth about nothing" : "") +
            ". Before any new raise and not discounted; anything the platform or other assets might fetch is left out. The wind-down is set under Assumptions → Corporate G&A." +
            (floor.method === "burn" ? "" : " This default assumes the whole current stage is still to pay, so for a trial already mostly paid for it reads low.")),
          // Opt-in: a rough alternative from the reported burn. It only moves
          // the failure figures (this strip, the outcome tree's failure
          // endings, the readout table's miss) — never Bear, Base or Bull.
          h("label", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer", color: "var(--ink-1)" } },
            h("input", { type: "checkbox", checked: floor.method === "burn" || !!floor.burnMissing, onChange: e => update({ failureFloor: { ...(theCase.failureFloor || {}), method: e.target.checked ? "burn" : "stage" } }) }),
            "Rough estimate from the monthly burn instead"),
          h("div", { style: { marginTop: 4 } },
            floor.burnMissing
              ? "On, but it needs a monthly burn (Assumptions → Capital structure) — showing the stage method until then."
              : "Uses the burn the company reports to the readout date (your Calibration Log's next catalyst, else the model's timeline) instead of the stage's benchmark cost, so a trial that is already mostly paid for is not charged again. It assumes today's burn holds, so it is a rough figure; it never changes Bear, Base or Bull."))),
        !floor && theCase.programs.length > 1 && h("div", { style: { ...UI.caption, marginTop: 8 } }, "No failure floor with more than one program — one failure leaves the others' value standing, which needs more than this arithmetic.")
      );
    })()),

    // How the remaining catalysts play out (catalystViews.js).
    show("overview") && (!error && scenarioResults && valMethod === "dcf" && theCase.programs.length === 1 && h(OutcomeTreeSection, { theCase, discountRatePct, tv, onChange, baseValue: baseResult && baseResult.equity ? baseResult.equity.perShare : null })),

    // Valuation method toggle — DCF is the full bottoms-up build everything
    // else on this panel assumes; Simple Multiple is the RxNPV-style
    // shortcut (peak revenue x a comp multiple, still PoS-risked and time-
    // discounted the same way, just skipping cost structure and year-by-year
    // cash flow buildup). A genuinely different, faster method — not a
    // lesser version of the DCF — so several DCF-specific sections below
    // (Implied PoS, SOTP) hide themselves rather than show numbers computed
    // a different way than the headline scenario cards.
    // ── Mode presets ───────────────────────────────────────────────────────
    // The two toggles that decide what kind of valuation this is sit on
    // different scopes — revenue mode is per program, valuation method is per
    // case — so the two coherent combinations ("napkin" and "full model") were
    // only reachable by setting several controls in the right pattern and
    // knowing which pattern was right.
    //
    // These presets make those two the one-click default path. The other two
    // combinations stay reachable on purpose, because both are real workflows:
    // a trusted consensus peak fed through a proper cost/timing model (Quick +
    // DCF), and a bottoms-up epidemiology build valued off comps rather than
    // modelled costs (Full + Multiple). Collapsing to a strict either/or would
    // delete those, so the presets lead without forbidding.
    show("inputs") && ((() => {
      const modes = theCase.programs.map(p => p.revenueMode || "quick");
      const allQuick = modes.length > 0 && modes.every(m => m !== "full");
      const allFull = modes.length > 0 && modes.every(m => m === "full");
      const active = (allQuick && valMethod === "multiple") ? "napkin"
                   : (allFull && valMethod === "dcf") ? "full" : "custom";
      const setPreset = (id) => update({
        valuationMethod: id === "napkin" ? "multiple" : "dcf",
        programs: theCase.programs.map(p => ({ ...p, revenueMode: id === "napkin" ? "quick" : "full" }))
      });
      const btn = (id, label, sub) => h("button", { key: id, onClick: () => setPreset(id),
        style: { flex: "1 1 190px", textAlign: "left", padding: "9px 12px", borderRadius: 8, cursor: "pointer",
          border: "1px solid " + (active === id ? "var(--teal)" : "var(--rule)"),
          background: active === id ? "var(--teal-bg)" : "transparent" } },
        h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: active === id ? "var(--teal)" : "var(--ink-1)" } }, label),
        h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.45 } }, sub));
      return h("div", { style: { marginBottom: 14 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6 } }, "Valuation depth"),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          btn("napkin", "Napkin", "Type a peak revenue, value it off a comp multiple. Fastest sanity check."),
          btn("full", "Full model", "Build peak from epidemiology, then a bottoms-up DCF with costs and timing."),
          active === "custom" && h("div", { key: "custom", style: { flex: "1 1 190px", padding: "9px 12px", borderRadius: 8, border: "1px dashed var(--amber)", background: "transparent" } },
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--amber)" } }, "Custom"),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.45 } },
              valMethod === "multiple" && allFull ? "Epidemiology build valued off a multiple — rigorous peak, comp-based value."
                : valMethod === "dcf" && allQuick ? "Typed peak run through the full cost and timing model."
                : "Programs are mixed between Quick and Full revenue builds."))
        ),
        // The finer controls the two presets set for you, one fold down: the
        // revenue build of every program (with the capital table's detail),
        // and the valuation method on its own. They used to be two more rows
        // of buttons on this tab, one above the card and one below it.
        (() => {
          const capModeNow = cap.mode || "simple";
          const caseQuick = allQuick && capModeNow === "simple";
          const caseDetailed = allFull && capModeNow === "detailed";
          const setAll = (mode) => update({
            programs: theCase.programs.map(p => ({ ...p, revenueMode: mode === "quick" ? "quick" : "full" })),
            capitalStructure: { ...(theCase.capitalStructure || {}), mode: mode === "quick" ? "simple" : "detailed" }
          });
          const pill = (on, label, onClick, tone) => h("button", { type: "button", key: label, onClick, "aria-pressed": on,
            style: { padding: "5px 14px", minHeight: 28, borderRadius: 7, border: "1px solid " + (on ? "var(--" + tone + ")" : "var(--rule)"), cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12,
              background: on ? "var(--" + tone + "-bg)" : "transparent", color: on ? "var(--" + tone + ")" : "var(--ink-2)", fontWeight: on ? 700 : 400 } }, label);
          const row = (label, kids, note) => h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "4px 0 8px" } },
            h("span", { style: { ...UI.captionMd, minWidth: 190 } }, label), kids, note && h("span", { style: UI.caption }, note));
          return h(Note, { summary: "Mix and match", open: active === "custom" },
            row("Every program and the cap table", [pill(caseQuick, "All Quick", () => setAll("quick"), "teal"), pill(caseDetailed, "All Detailed", () => setAll("detailed"), "amber")],
              caseQuick ? "— fully Quick" : caseDetailed ? "— fully Detailed" : "— mixed"),
            row("Valuation method", [["dcf", "DCF (bottoms-up)"], ["multiple", "Simple Multiple"]].map(([id, lbl]) => pill(valMethod === id, lbl, () => update({ valuationMethod: id }), "teal"))),
            h("div", null, "Quick types a peak revenue and a simple share count; Detailed builds peak from epidemiology and the cap table line by line. The two presets above pair the revenue build with the method that suits it; these let you combine them any other way."));
        })());
    })()),

    show("inputs") && (h("div", { style: { marginBottom: 16 } },
      valMethod === "multiple" && h("div", { style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
          "Peak revenue × multiple, still PoS-risked and discounted back to today — same convention as the DCF's exit multiple. Skips cost structure and year-by-year cash flows, so it's fast but cruder. A quick cross-check, not a replacement for the DCF."),
        h("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } },
          [["bear","Bear"],["base","Base"],["bull","Bull"]].map(([key,lbl]) => h(BenchField, { key, label: lbl + " multiple", value: multipleAssumptions[key], onChange: v => setMultipleAssumptions({ [key]: v }), suffix: "x",
            bench: { value: 3, source: "Real single-asset biotech M&A deal-value ÷ peak-sales multiples span " + SIMPLE_MULTIPLE_PRECEDENTS.deals.length + " precedents from " + Math.min(...SIMPLE_MULTIPLE_PRECEDENTS.deals.map(d => d.multiple)).toFixed(2) + "x to " + Math.max(...SIMPLE_MULTIPLE_PRECEDENTS.deals.map(d => d.multiple)).toFixed(2) + "x, median " + SIMPLE_MULTIPLE_PRECEDENTS.medianMultiple + "x — see the precedents below. The 3 shown here is a deliberately conservative default, not that median, since most cases modeled here are less de-risked than an already-approved, already-commercial acquisition target. Defaults equal across scenarios on purpose — Bear/Base/Bull already vary by revenue % and PoS %; only change this if you want the multiple to also differ." } }))
        ),
        // The precedents are overwhelmingly post-approval acquisitions, so the
        // multiple they imply already prices an asset with no clinical risk
        // left. Applying one to a pre-approval program and THEN risking it by
        // PoS is the standard, correct composition — but only if you picked
        // the multiple knowing that's what it represents. Said here, at the
        // point of choosing, rather than buried in the precedent notes.
        (() => {
          const postApproval = SIMPLE_MULTIPLE_PRECEDENTS.deals.filter(d => /post-approval/i.test(d.timing)).length;
          const preApprovalPrograms = theCase.programs.filter(p => (p.currentPhase || "phase1") !== "approved");
          if (!preApprovalPrograms.length) return null;
          return h("div", { style: { marginTop: 10, padding: "10px 12px", borderRadius: 7, background: "var(--warn-bg)", border: "1px solid var(--warn)", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-1)", lineHeight: 1.6 } },
            h("b", { style: { color: "var(--warn)" } }, "Match the multiple to the stage. "),
            postApproval, " of ", SIMPLE_MULTIPLE_PRECEDENTS.deals.length, " precedents are post-approval, and this case has ",
            preApprovalPrograms.length, " pre-approval program", preApprovalPrograms.length > 1 ? "s" : "", ".",
            h("div", { style: { marginTop: 6 } },
              h(Note, { summary: "Why that matters when picking a number" },
                h("div", { style: { lineHeight: 1.6 } },
                  "A post-approval multiple prices an asset with essentially no clinical risk left. Applying one and then risk-adjusting by PoS is the right composition — but it is the wrong ",
                  h("i", null, "starting point"), " for an early asset. Published rules of thumb put unadjusted peak-sales multiples nearer 1-2x for Phase 2 and 3-5x for Phase 3, against the ",
                  SIMPLE_MULTIPLE_PRECEDENTS.medianMultiple, "x median here — which is why the default is 3x."))));
        })(),
        h(Note, { summary: "Real deal precedents this multiple is benchmarked against (" + SIMPLE_MULTIPLE_PRECEDENTS.deals.length + " deals, median " + SIMPLE_MULTIPLE_PRECEDENTS.medianMultiple + "x)" },
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            SIMPLE_MULTIPLE_PRECEDENTS.deals.slice().sort((a, b) => a.multiple - b.multiple).map((d, i) => h("div", { key: i },
              h("div", { style: { fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-1)" } },
                d.acquirer + " / " + d.target + " (" + d.year + ") — " + d.drug + ": $" + d.valueB + "B ÷ $" + d.peakSalesB + "B peak = " + d.multiple.toFixed(2) + "x"),
              h("div", { style: { fontSize: 11, color: "var(--ink-3)" } }, d.note + " (" + d.timing + ")")
            ))
          )
        )
      )
    )),

    // Cash tax + NOL carryforward. Not read by Simple Multiple: a comp multiple
    // is derived from real deal values, which already reflect after-tax
    // economics — taxing on top of it would double-count.
    show("inputs") && ((() => {
      if (methodIgnores(valMethod, "taxation")) return null;
      const tax = theCase.taxation || { enabled: false, effectiveRatePct: "21", startingNOLM: "" };
      const setTax = (patch) => update({ taxation: { ...tax, ...patch } });
      return h("div", { style: { marginBottom: 16 } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer", marginBottom: tax.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: !!tax.enabled, onChange: e => setTax({ enabled: e.target.checked }) }),
          "Apply cash tax (with NOL carryforward)"),
        !tax.enabled && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4, maxWidth: 640, lineHeight: 1.5 } },
          "Off — flows are pre-tax. Fine pre-revenue; understates tax for anything already selling."),
        tax.enabled && h("div", null,
          h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(BenchField, { label: "Effective tax rate", value: tax.effectiveRatePct, onChange: v => setTax({ effectiveRatePct: v }), suffix: "%",
              bench: { value: 21, source: "US federal statutory rate; state and foreign mix typically pushes the effective rate a few points higher" },
              help: "Applied only to profit beyond the accumulated loss shield below." }),
            h(MillionsField, { label: "Existing NOL carryforward", value: tax.startingNOLM, onChange: v => setTax({ startingNOLM: v }),
              help: "Losses already banked before Year 0 — check the latest 10-K's income-tax note. Leave blank to start the shield at zero and let the model's own projected losses build it." })
          ),
          h("div", { style: { marginTop: 8 } },
            h(Note, { summary: "How the shield is applied" },
              h("div", { style: { lineHeight: 1.6 } },
                "Tax is worked out for the world where the drug works — its own loss years add to the shield, its profits draw it down — and then weighted by the odds of launch, since a drug that fails earns nothing to tax. (With several programmes the odds-weighted flow is taxed instead, an approximation.) Ignores the 80%-of-income annual cap on post-2017 federal NOL use and any expiry of older losses — both would pull tax slightly forward, so this errs mildly optimistic.")))
        )
      );
    })()),

    // Discount rate + terminal value. Terminal value is a DCF concept — Simple
    // Multiple's peak x multiple IS its own terminal-style value, so showing a
    // second one there would invite adding value twice.
    show("inputs") && (methodIgnores(valMethod, "terminalValue") && h(NotUsedInThisMode, { what: "Terminal value", compact: true })),
    show("inputs") && (h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 } },
      h(BenchField, { label: "Discount rate", value: discountRatePct, onChange: v => update({ discountRatePct: v }), suffix: "%",
        // Blank means the benchmark is used — say so in the box itself.
        placeholder: DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0] + " (benchmark, used while blank)",
        bench: { value: DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0], source: "Ch. 15 — \"for pre-commercial biotechs, up to 20%, depending on stage of portfolio\"" },
        help: "Compatible with the PoS risk-adjustment already applied here — avoid double-counting by not also using a naive market WACC." }),
      !methodIgnores(valMethod, "terminalValue") && h("div", { style: { flex: "1 1 100%" } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer", marginBottom: tv.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: tv.enabled, onChange: e => setTV({ enabled: e.target.checked }) }),
          "Include terminal value beyond the projection window"),
        tv.enabled && h("div", null,
          h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
            [["exitMultiple","Exit multiple"],["perpetuityGrowth","Perpetuity growth"]].map(([id,lbl]) => h("button", { key: id, onClick: () => setTV({ method: id }),
              style: { padding: "5px 12px", borderRadius: 7, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11,
                background: (tv.method || "exitMultiple") === id ? "var(--teal-bg)" : "transparent", color: (tv.method || "exitMultiple") === id ? "var(--teal)" : "var(--ink-2)", fontWeight: (tv.method || "exitMultiple") === id ? 700 : 400 } }, lbl))
          ),
          (tv.method || "exitMultiple") === "exitMultiple"
            ? h("div", null,
                h(BenchField, { label: "EV / peak revenue multiple", value: tv.exitMultiple, onChange: v => setTV({ exitMultiple: v }), suffix: "x",
                  bench: { value: 3, source: "Common industry rule of thumb, not derived from the app's source documents" },
                  help: "Models an acquisition at peak revenue — cash flows after that point are dropped, discounted back from the peak year." }),
                (() => {
                  if (theCase.currentPrice === "" || theCase.currentPrice == null || !baseResult) return null;
                  const totalPeakRevenue = baseResult.programVals.reduce((s, pv) => s + (pv.peakRevenue || 0), 0);
                  if (totalPeakRevenue <= 0) return null;
                  const impliedEV = Number(theCase.currentPrice) * baseResult.capResult.dilutedShares - baseResult.capResult.netCash;
                  const impliedMultiple = impliedEV / totalPeakRevenue;
                  return h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6 } },
                    "For reference — at the current price, the market is implying roughly ",
                    h("b", { style: { color: "var(--ink-2)" } }, impliedMultiple.toFixed(1) + "x"),
                    " EV/peak-revenue across this case's programs. Not a comp — just your own current-price math, restated as a multiple to compare against the benchmark above.");
                })()
              )
            : h("div", null,
                h(BenchField, { label: "Terminal growth rate", value: tv.growthPct, onChange: v => setTV({ growthPct: v }), suffix: "%",
                  help: "Usually overstates value for a single asset, since the window already runs through LOE — better for an ongoing multi-program platform." })
              )
        )
      )
    )),

    // Capital structure
    show("inputs") && (h("div", { "data-nav": "capital", style: { borderTop: "1px dashed var(--rule)", paddingTop: 14, marginBottom: 16 } },
      h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 10 } }, "Capital structure"),

      // EDGAR auto-fill — desktop app only, no proxy/CORS workaround needed here
      isDesktop && h("div", { style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 14 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6, } }, "Pull financials from SEC EDGAR"),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
          h("input", { type: "text", "aria-label": "Company name or ticker to pull from EDGAR", value: edgarQuery, placeholder: "Company name or ticker", onChange: e => { edgarTyped.current = true; setEdgarQuery(e.target.value); },
            style: { flex: "1 1 200px", padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
          h("button", { onClick: () => pullFromEdgar(false), disabled: edgarLoading,
            style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: edgarLoading ? "default" : "pointer" }
          }, edgarLoading ? "Pulling…" : "Pull from EDGAR"),
          edgarResult && h("button", { onClick: () => pullFromEdgar(true), disabled: edgarLoading,
            title: "Bypass cache and re-fetch",
            style: { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }
          }, "⟳")
        ),
        edgarError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 8, lineHeight: 1.5 } }, edgarError,
          h("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 4 } }, "No luck? Try the exact legal name (e.g. \"Acme Therapeutics Inc\") or the ticker instead.")),
        edgarResult && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8, lineHeight: 1.7 } },
          h("div", null, "✓ ", h("b", { style: { color: "var(--teal)" } }, edgarResult.name), " · CIK ", edgarResult.cik, edgarResult.ticker ? " · " + edgarResult.ticker : ""),
          h("div", null, "Basic shares: ", edgarResult.basicShares != null ? fmtNum(edgarResult.basicShares) : "n/a",
            " · Diluted: ", edgarResult.dilutedShares != null ? fmtNum(edgarResult.dilutedShares) : "n/a"),
          h("div", null, "Cash: ", edgarResult.cash != null ? fmtMoney(edgarResult.cash) : "n/a", " · Debt: ", edgarResult.debt != null ? fmtMoney(edgarResult.debt) : "n/a",
            edgarResult.asOf ? " (as of " + edgarResult.asOf + ")" : ""),
          cap.mode === "detailed" && h("div", { style: { marginTop: 4, paddingTop: 4, borderTop: "1px dashed var(--rule)" } },
            h("div", null, "Options: ", edgarResult.options ? fmtNum(edgarResult.options.count) + (edgarResult.options.priceFound ? " @ avg $" + edgarResult.options.avgStrike.toFixed(2) : " (strike price not tagged — enter manually)") : "not found in XBRL — enter manually"),
            h("div", null, "Warrants: ", edgarResult.warrants ? fmtNum(edgarResult.warrants.count) + (edgarResult.warrants.priceFound ? " @ avg $" + edgarResult.warrants.avgStrike.toFixed(2) : " (strike price not tagged — enter manually)") : "not found in XBRL — enter manually"),
            h("div", null, "Convertible notes: ", edgarResult.convertibleFace != null ? fmtMoney(edgarResult.convertibleFace) + " face value (conversion price is never in XBRL — enter manually)" : "not found in XBRL — enter manually"),
            h("div", { style: { color: "var(--warn)", fontSize: 10, marginTop: 3 } }, "Dilutive securities are tagged less reliably — cross-check against the filing's \"Stockholders' Equity\" note.")
          ),
          h("div", { style: { color: "var(--ink-3)", fontSize: 10, marginTop: 2 } }, "Filled into the fields below where found — double-check before relying on them."),
          h("div", { style: { marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" } },
            edgarResult.sourceFilingUrl && h(ExternalLink, { href: edgarResult.sourceFilingUrl, style: { fontSize: 10 } },
              "→ View source filing" + (edgarResult.sourceFilingLabel ? " (" + edgarResult.sourceFilingLabel + ")" : "")),
            edgarResult.edgarCompanyPageUrl && h(ExternalLink, { href: edgarResult.edgarCompanyPageUrl, style: { fontSize: 10 } }, "→ All filings on EDGAR")
          )
        )
      ),
      !isDesktop && h("div", { style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 14, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
        "EDGAR auto-fill is available in the RxNPV desktop app. Enter shares/cash/debt manually below."),

      h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
        [["simple","Simple"],["detailed","Detailed"]].map(([id,lbl]) => h("button", { key: id, onClick: () => setCap({ mode: id }),
          style: { padding: "5px 12px", borderRadius: 7, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11,
            background: cap.mode === id ? "var(--teal-bg)" : "transparent", color: cap.mode === id ? "var(--teal)" : "var(--ink-2)", fontWeight: cap.mode === id ? 700 : 400 } }, lbl))
      ),
      cap.mode === "simple"
        ? h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(BenchField, { label: "Fully diluted shares outstanding", value: cap.dilutedSharesSimple, onChange: v => setCap({ dilutedSharesSimple: v }), placeholder: "e.g. 50000000" }),
            h(MillionsField, { label: "Cash & equivalents", value: cap.cash, onChange: v => setCap({ cash: v }) }),
            h(MillionsField, { label: "Debt", value: cap.debt, onChange: v => setCap({ debt: v }) }),
            h(CashAsOfFields, { cap, setCap, theCase, update })
          )
        : h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(BenchField, { label: "Basic shares outstanding", value: cap.basicShares, onChange: v => setCap({ basicShares: v }) }),
            h(MillionsField, { label: "Cash & equivalents", value: cap.cash, onChange: v => setCap({ cash: v }) }),
            h(MillionsField, { label: "Debt", value: cap.debt, onChange: v => setCap({ debt: v }) }),
            h(CashAsOfFields, { cap, setCap, theCase, update }),
            h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", margin: "4px 0" } }, "Options / warrants (treasury method — dilutive only if in the money; uses Current price above)"),
            h(BenchField, { label: "Options outstanding", value: cap.opts, onChange: v => setCap({ opts: v }) }),
            h(BenchField, { label: "Options avg strike", value: cap.optK, onChange: v => setCap({ optK: v }), suffix: "$" }),
            h(BenchField, { label: "Warrants outstanding", value: cap.war, onChange: v => setCap({ war: v }) }),
            h(BenchField, { label: "Warrants strike", value: cap.warK, onChange: v => setCap({ warK: v }), suffix: "$" }),
            h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", margin: "4px 0" } }, "Convertible notes (if-converted method — converts to shares only if in the money, else stays as debt)"),
            h(MillionsField, { label: "Convertible face value", value: cap.convFace, onChange: v => setCap({ convFace: v }), placeholder: "none" }),
            h(BenchField, { label: "Conversion price", value: cap.convPrice, onChange: v => setCap({ convPrice: v }), suffix: "$", placeholder: "none" })
          )
    )),

    // Future dilution scenario — an optional overlay, applied identically
    // across Bear/Base/Bull so dilution risk shows up consistently, not just
    // in one scenario. The implied-PoS and other reverse-solvers include it
    // too, so "the price implies X" is the X at which this fair value equals
    // the price (see solveImpliedPoSMultiplier).
    show("inputs") && ((() => {
      // A case that has never set a raise starts on "% below today's price".
      const fr = theCase.futureRaise || { enabled: false, amountM: "", priceOverride: "", priceMode: "discount", discountPct: "" };
      const setFR = (patch) => update({ futureRaise: { ...fr, ...patch } });
      const fallbackPrice = theCase.currentPrice;
      const byDiscount = fr.priceMode === "discount";
      const impliedPrice = futureRaisePrice(fr, fallbackPrice);
      const newShares = (fr.enabled && impliedPrice > 0 && fr.amountM) ? Number(fr.amountM) / impliedPrice : 0;
      return h("div", { "data-nav": "financing", style: { borderTop: "1px dashed var(--rule)", paddingTop: 14, marginBottom: 16 } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", cursor: "pointer", marginBottom: fr.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: fr.enabled, onChange: e => setFR({ enabled: e.target.checked }) }),
          "Model a future capital raise"),
        fr.enabled && h("div", null,
          h("div", { style: UI.intro },
            "Applied to every scenario — new shares dilute the count, raised cash adds to net cash dollar for dollar. No underwriting fee, no explicit timing — answers \"what happens at $X raised at $Y,\" not when."),
          h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(MillionsField, { label: "Amount to raise", value: fr.amountM, onChange: v => setFR({ amountM: v }) }),
            h("div", { style: { flex: "1 1 200px", minWidth: 180, maxWidth: 420, marginBottom: 14 } },
              h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Price the raise"),
              h("select", { "aria-label": "Price the raise", value: byDiscount ? "discount" : "fixed", onChange: e => setFR({ priceMode: e.target.value }), style: UI.input },
                h("option", { value: "discount" }, "% below today's price (follows the stock)"),
                h("option", { value: "fixed" }, "At a fixed price"))),
            byDiscount
              ? h(BenchField, { label: "Discount to today's price", value: fr.discountPct == null ? "" : fr.discountPct, onChange: v => setFR({ discountPct: v }), suffix: "%", placeholder: "0",
                  help: "An ATM sells near the market less the agent's commission (~3%); a follow-on offering usually prices 10–20% below." })
              : h(BenchField, { label: "Assumed raise price", value: fr.priceOverride, onChange: v => setFR({ priceOverride: v }), suffix: "$", placeholder: "today's price",
                  bench: { value: Number(fallbackPrice || 0), source: "Defaults to the case's current price — a fixed figure does not move when the price does" } })
          ),
          newShares > 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } },
            "≈ ", h("b", { style: { color: "var(--ink-2)" } }, Math.round(newShares).toLocaleString()), " new shares at $" + impliedPrice.toFixed(2) + "/share.")
        )
      );
    })()),

    // Dilution-path financing — connects cash runway and R&D-to-launch cost
    // (both already computed elsewhere) into a projected sequence of future
    // raises, rather than one manual what-if. See computeDilutionPath in
    // scenarioEngine.js for the actual model. An alternative to the single
    // future-raise overlay above, not additive with it — enabling both at
    // once would double-model financing, so this is deliberately its own
    // separate toggle rather than a refinement of that one.
    show("inputs") && ((() => {
      const dpInput = theCase.dilutionPath || { enabled: false, minCashBufferM: "", targetRunwayMonths: "18", discountToMarketPct: "15", sbcAnnualGrowthPct: "" };
      const setDP = (patch) => update({ dilutionPath: { ...dpInput, ...patch } });
      let preview = null;
      if (dpInput.enabled) {
        const baseScenario = { label: "base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0, color: "" };
        try { preview = computeDilutionPath({ ...theCase, dilutionPath: dpInput }, baseScenario, discountRatePct); } catch (e) { preview = null; }
      }
      const startingShares = computeCapitalStructure({ ...cap, currentPrice: theCase.currentPrice }).dilutedShares;
      return h("div", { style: { borderTop: "1px dashed var(--rule)", paddingTop: 14, marginBottom: 16 } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", cursor: "pointer", marginBottom: dpInput.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: dpInput.enabled, onChange: e => setDP({ enabled: e.target.checked }) }),
          "Model dilution path to launch"),
        dpInput.enabled && h("div", null,
          h("div", { style: UI.intro },
            "Projects when cash would run out and models a raise there, repeated as needed. Each raise is counted with the odds it actually happens (none after a failed readout), and its cash goes into the value together with its new shares — the cash flows already pay for what the raises fund, so shares alone would charge those costs twice. Priced at this case's own value, raises leave value per share unchanged (the practitioners' convention); priced at today's price less a discount, they add value if investors pay more than the model thinks a share is worth, and cost value if they pay less."),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 } },
            h("span", { style: UI.caption }, "Price raises at"),
            h("select", { "aria-label": "Price projected raises at", value: dpInput.priceBasis === "fair" ? "fair" : "market", onChange: e => setDP({ priceBasis: e.target.value }),
              style: { padding: "4px 8px", minHeight: 28, borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
              h("option", { value: "market" }, "today's price, less the discount"),
              h("option", { value: "fair" }, "this case's own value (value-neutral)"))),
          h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(MillionsField, { label: "Minimum cash buffer", value: dpInput.minCashBufferM, onChange: v => setDP({ minCashBufferM: v }) }),
            h(BenchField, { label: "Each raise covers", value: dpInput.targetRunwayMonths, onChange: v => setDP({ targetRunwayMonths: v }), suffix: "mo",
              bench: { value: 18, source: "Typical biotech follow-on sizing — enough runway to reach the next real catalyst, not just survive" } }),
            h(BenchField, { label: "Discount to market", value: dpInput.discountToMarketPct, onChange: v => setDP({ discountToMarketPct: v }), suffix: "%",
              bench: { value: 15, source: "Typical follow-on/PIPE pricing discount to the pre-deal market price" } }),
            h(BenchField, { label: "Annual SBC share creep", value: dpInput.sbcAnnualGrowthPct, onChange: v => setDP({ sbcAnnualGrowthPct: v }), suffix: "%",
              help: "Ongoing dilution from stock-based comp, independent of whether a raise happens that year." })
          ),
          preview && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6 } },
            "Base case, if the company carries on: ", h("b", { style: { color: "var(--ink-2)" } }, "$" + preview.totalRaisedM.toFixed(0) + "M"), " raised across the path to launch. Weighted by the odds each raise happens, ",
            h("b", { style: { color: "var(--ink-2)" } }, "$" + ((preview.expectedCashRaised || 0) / 1e6).toFixed(0) + "M"), " of cash comes in and diluted shares grow from ",
            h("b", { style: { color: "var(--ink-2)" } }, Math.round(startingShares || 0).toLocaleString()), " to ",
            h("b", { style: { color: "var(--ink-2)" } }, Math.round(preview.finalDilutedShares).toLocaleString()),
            preview.priceBasis === "fair" ? ", at this case's own value per share." : ", at $" + (preview.raisePrice || 0).toFixed(2) + " a share.")
        )
      );
    })()),

    show("overview") && (!error && h(MonteCarloBox, { theCase, discountRatePct, tv, baseValue: baseResult && baseResult.equity ? baseResult.equity.perShare : null })),

    // Scenario comparison
    show("overview|scenarios") && (error ? h("div", { style: { padding: 14, borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12 } }, "Calculation error: " + error)
    : h("div", null,
        // Scenarios tab only: the Overview's "Price vs. model" already leads
        // with the same three per-share values, and the editors that change
        // them live here.
        show("scenarios") && h(ExportSection, { title: "Scenario comparison", reportSection: "summary" },
        h("div", { id: part === "scenarios" ? "ws-scenarios" : undefined, style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 10, borderTop: part === "scenarios" ? "none" : "1px dashed var(--rule)", paddingTop: part === "scenarios" ? 0 : 14 } }, "Scenario comparison"),

        show("scenarios") && (h(SectionCard, { title: "Case-level Base-PoS adjustment", subtitle: "An overarching view on this whole case's odds, distinct from any single program's PoS override or the Bear/Bull scenario multipliers below", defaultOpen: false },
          h(BenchField, { label: "Base PoS adjustment", value: basePosAdjustmentPct, onChange: v => update({ basePosAdjustmentPct: v }), suffix: "%",
            bench: { value: 100, source: "100% = no adjustment (the default). Applies as a multiplier on top of every program's own modeled or overridden PoS, across Bear/Base/Bull alike — so their existing 70%/100%/130% relationship still holds relative to your adjusted Base, not the un-adjusted preset." },
            help: "Use this for a company-wide view (management track record, a specific therapeutic-area headwind or tailwind) that should shift every program's odds together — not a substitute for a per-program override when you have a drug-specific reason instead." })
        )),

        show("scenarios") && (h(SectionCard, { title: "Edit Bear / Bull assumptions", subtitle: "Benchmarks shown by default — override per case when a scenario should look different than the standard multiplier", defaultOpen: false },
          [["bear","Bear"],["bull","Bull"]].map(([key, label]) => h("div", { key, style: { flex: "1 1 100%", marginBottom: 10 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", fontWeight: 700, marginBottom: 6 } }, label + " case"),
            h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
              h(BenchField, { label: "Peak share multiplier", value: scenarioOv[key].shareMultiplierPct, onChange: v => setScenarioOv(key, { shareMultiplierPct: v }), suffix: "%",
                bench: { value: SCENARIO_PRESETS[key].shareMultiplierPct, source: "Standard benchmark" } }),
              h(BenchField, { label: "PoS multiplier", value: scenarioOv[key].posMultiplierPct, onChange: v => setScenarioOv(key, { posMultiplierPct: v }), suffix: "%",
                bench: { value: SCENARIO_PRESETS[key].posMultiplierPct, source: "Standard benchmark — lower further if a bad outcome should mean worse odds than a flat 30% haircut" } }),
              h(BenchField, { label: "Discount rate adjustment", value: scenarioOv[key].discountRateAddPct, onChange: v => setScenarioOv(key, { discountRateAddPct: v }), suffix: "pp",
                bench: { value: SCENARIO_PRESETS[key].discountRateAddPct, source: "Normally 0: the discount rate is the company's cost of capital, which does not change with the drug's prospects — failure is already in the odds, so moving the rate here charges that risk twice. Test the rate itself in Tools → Sensitivity." } }),
              (tv.enabled && (tv.method || "exitMultiple") === "exitMultiple") && h(BenchField, { label: "Exit multiple override", value: scenarioOv[key].exitMultiple, onChange: v => setScenarioOv(key, { exitMultiple: v }), suffix: "x",
                help: "Optional — overrides the case's exit multiple just for " + label + ", instead of using the same multiple across all three scenarios." })
            ),
            h("div", { style: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
              h("div", { style: { ...UI.caption, marginBottom: 8 } }, "Optional: give each program an independent peak revenue for " + label + ", instead of scaling Base by the multiplier above"),
              // Stored in raw dollars, exactly like quickRevenue.peakRevenue,
              // because that is what computeProgramValuation and the Simple
              // Multiple path read. MillionsField shows and accepts $M and
              // converts at the edge. This used to be a BenchField that
              // multiplied by 1e6 on write but displayed the stored dollars
              // next to "$M" — so the field read 1000000000 $M, and editing it
              // again multiplied the assumption by another million (FIN-001).
              theCase.programs.filter(p => (p.revenueMode || "quick") !== "full").map(p => h(MillionsField, {
                key: p.id, label: (p.drugName || p.name) + " — peak revenue override",
                value: ((p.quickRevenue || {}).scenarioOverrides || {})[key] ? p.quickRevenue.scenarioOverrides[key].peakRevenue : "",
                onChange: raw => {
                  const nextPrograms = theCase.programs.map(pr => pr.id === p.id
                    ? { ...pr, quickRevenue: { ...pr.quickRevenue, scenarioOverrides: { ...(pr.quickRevenue.scenarioOverrides || { bear: {}, bull: {} }), [key]: { peakRevenue: raw } } } }
                    : pr);
                  update({ programs: nextPrograms });
                },
                wide: false
              }))
            )
          ))
        )),

        // A grid, so the three cards stay a row of three (or, very narrow, a
        // column) instead of wrapping two-and-one with Bull stretched alone.
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 } },
          scenarioResults.map(s => h("div", { key: s.key, style: {
              minWidth: 0, padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)",
              border: "1.5px solid " + s.preset.color
            } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: s.preset.color, marginBottom: 8 } }, s.preset.label),
            // "70% PoS" reads as "70% probability of success," which it
            // never is — it's a MULTIPLIER on the modeled PoS (Oncology
            // Phase 2 might model 8.7%; Bear's "70%" means 6.1%, not 70%).
            // A user reported exactly this misreading, and it's the single
            // most important number in the valuation to get right. Single-
            // program cases now show the actual resulting PoS instead of the
            // multiplier; multi-program cases still show the multiplier
            // (there's no one PoS to point at) but reworded so it can't be
            // mistaken for an absolute probability.
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6 } },
              s.preset.shareMultiplierPct + "% share · " +
              (theCase.programs.length === 1 && s.result.programVals && s.result.programVals[0] && s.result.programVals[0].posToLaunch != null
                ? "PoS " + (s.result.programVals[0].posToLaunch * 100).toFixed(1) + "%"
                : s.preset.posMultiplierPct + "% of modeled PoS")
              // The rate is normally the same in every scenario (the odds carry
              // the risk), so it is only mentioned when a scenario changes it.
              + (Number(s.preset.discountRateAddPct) ? " · " + (s.preset.discountRateAddPct > 0 ? "+" : "") + s.preset.discountRateAddPct + "pp disc." : "")
              + (valMethod === "multiple" ? " · " + numOr(multipleAssumptions[s.key], 3).toFixed(1) + "x" : "")),
            h("div", { style: UI.caption }, "Enterprise value (rNPV)"),
            h("div", { style: { fontSize: 15, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 } }, fmtMoney(s.result.npvResult.npv)),
            h("div", { style: UI.caption }, "Equity value"),
            h("div", { style: { fontSize: 15, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 } }, fmtMoney(s.result.equity.equityValue)),
            h("div", { style: UI.caption }, "Value per share"),
            h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: s.preset.color } },
              fmtShare(s.result.equity.perShare))
          ))
        )),
        show("scenarios") && (valMethod === "dcf" && theCase.programs.length === 1 && h(ReadoutScenariosSection, { theCase, discountRatePct, tv, baseValue: baseResult && baseResult.equity ? baseResult.equity.perShare : null, onChange })),
        show("overview") && (valMethod === "dcf" && baseResult && h(ProjectionsCard, { theCase, result: baseResult, successResult: showSuccess ? successResult : null })),

        // Implied PoS — the reverse direction from everything else on this
        // panel: solve backwards from the current price to find what PoS the
        // market must be pricing in. Given a distinct, prominent treatment
        // (amber accent, its own bordered box) rather than blending into the
        // other dashed-divider sections — it's one of the most distinctive,
        // case-specific insights this tool produces, not just another line
        // item. Title names the actual case so it reads as "this company,"
        // not a generic label.
        show("overview") && (theCase.currentPrice !== "" && theCase.currentPrice != null && valMethod === "dcf" && (() => {
          // Reuses the solve hoisted near the top of this component (see
          // impliedSolved above) — the prominent summary card and this
          // detailed box now show the exact same computation, never two.
          const solved = impliedSolved, solveError = impliedSolveError;
          if (solveError || !solved) return null;
          // With one program, every figure here is already in "Price vs.
          // model" at the top (your odds, the price's odds, and the ratio).
          // The box stays for several programs, where only the ratio exists.
          if (solved.ok && !solved.degenerate && theCase.programs.length === 1) return null;
          const caseLabel = theCase.name || "This case";
          if (!solved.ok) return h("div", { style: { marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "var(--warn-bg)", border: "1px solid var(--warn)", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Implied PoS: " + solved.error);
          return h(ExportSection, { title: "What " + possessive(caseLabel) + " price implies", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "What " + possessive(caseLabel) + " price implies"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10 } }, "The PoS the current price requires, given your assumptions — the reverse of fair value."),
            solved.degenerate
              ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, solved.note)
              : h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
                  theCase.programs.length === 1 && solved.baseAbsolutePct != null && h("div", null,
                    h("div", { style: UI.caption }, "Your PoS assumption"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, solved.baseAbsolutePct.toFixed(1) + "%")),
                  theCase.programs.length === 1 && solved.impliedAbsolutePct != null && h("div", null,
                    h("div", { style: UI.caption }, "Market implies"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: solved.impliedAbsolutePct >= solved.baseAbsolutePct ? "var(--green)" : "var(--red)" } }, solved.impliedAbsolutePct.toFixed(1) + "%")),
                  h("div", null,
                    h("div", { style: UI.caption }, theCase.programs.length > 1 ? "As a multiple of your PoS" : "As a multiple"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: solved.multiplierPct >= 100 ? "var(--green)" : "var(--red)" } }, solved.multiplierPct.toFixed(0) + "%"))
                )
          );
        })()),

        // Reverse-solve beyond PoS — same "what does the price imply" idea
        // as the Implied PoS box above, generalized to a different dial via
        // solveImpliedVariable in scenarioEngine.js. Single-program, DCF-only,
        // matching Implied PoS's own scope for the same reason: with more
        // than one program there's no single unambiguous value to solve for.
        show("overview") && (theCase.currentPrice !== "" && theCase.currentPrice != null && valMethod === "dcf" && theCase.programs.length === 1 && (() => {
          const mode = theCase.programs[0].revenueMode;
          const options = [
            mode === "quick" && { key: "peakRevenue", label: "Peak revenue" },
            mode === "full" && { key: "peakShare", label: "Peak market share" },
            { key: "launchYear", label: "Launch timing" }
          ].filter(Boolean);
          return h(ReverseSolveBox, { theCase, discountRatePct, tv, options });
        })()),

        // Break-even peak revenue beside the value bridge — two views of the
        // same question: how far is the price from this case, and in what.
        show("overview") && ((() => {
          const baseR = scenarioResults.find(s => s.key === "base").result;
          const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
          const tvParams = { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple };
          const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
          let curve = null;
          if (valMethod === "dcf") { try { curve = computeBreakEvenCurve(theCase, drBase, tvParams); } catch (e) { curve = null; } }
          // A curve needs per-share values (a share count) and some revenue to vary.
          if (curve && !(curve.points.length > 1 && curve.points.every(p => p.perShare != null && isFinite(p.perShare)) && curve.basePeak > 0)) curve = null;
          // Line items come from the result itself, so they always sum to the
          // equity value shown (see computeEquityBridgeSteps).
          const steps = computeEquityBridgeSteps(theCase, baseR);
          const eq = baseR.equity, mcap = price != null ? price * eq.dilutedShares : null;
          const gap = mcap != null ? mcap - eq.equityValue : null;
          const oneProgram = theCase.programs.length === 1 && impliedSolved && impliedSolved.ok && !impliedSolved.degenerate;
          const heading = gap == null ? "From enterprise value to a price per share"
            : Math.abs(gap) < 0.5e6 ? "The price matches what this case finds"
            : gap < 0 ? "The price is " + fmtMoney(-gap) + " below what this case finds" : "The price asks for " + fmtMoney(gap) + " more than this case finds";
          const shortLabel = { "Enterprise Value": "Programs (rNPV)", "Modeled future raise": "Future raise", "PRV (risk-adj.)": "Voucher (PRV)", "Partnership (upfront + milestones)": "Partner payments", "Convertible notes (not converting)": "Convertible notes" };
          return h("div", { className: "pair-grid", style: { marginTop: 16 } },
            curve && h(ExportSection, { title: "Break-even peak revenue", style: { borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
              h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } },
                curve.breakEvenPeak != null ? "The price needs about " + fmtMoney(curve.breakEvenPeak) + " of peak revenue" : "Fair value at every peak-revenue level"),
              h("div", { className: "prose", style: { ...UI.caption, marginBottom: 8 } }, "Base case, re-run at each level of peak market share with everything else held — computed, not drawn between two points."),
              h(ExportableBlock, { title: (theCase.name || "Case") + " — break-even peak revenue" },
                h(BreakEvenChart, { curve, height: 300, label: "Fair value per share at each peak revenue level, with today's price" })),
              h(Explain, readBreakEven(curve.basePeak, curve.breakEvenPeak, curve.bearPeak, curve.bullPeak, curve.belowRange, curve.aboveRange))),
            h(ExportSection, { id: "ws-bridge", title: "Enterprise Value → Per-Share bridge (Base case)", reportSection: "bridge", style: { borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
              h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, heading),
              h("div", { className: "prose", style: { ...UI.caption, marginBottom: 8 } }, "Base case, built up piece by piece" + (mcap != null ? ", then the gap to what the market pays." : ".")),
              h(ExportableBlock, { title: (theCase.name || "Case") + " — value bridge (Base case)" },
                h(WaterfallChart, { height: 320, label: "Value bridge from enterprise value to equity value" + (mcap != null ? " and the market value" : ""),
                  steps: steps.map(st => ({ label: shortLabel[st.label] || st.label, value: st.sign < 0 ? -st.value : st.value })),
                  total: { label: "Your fair value", value: eq.equityValue, sub: eq.perShare != null && isFinite(eq.perShare) ? fmtShare(eq.perShare) + "/sh" : null },
                  compare: mcap != null ? { label: "Market value", value: mcap, sub: fmtShare(price) + "/sh" } : null })),
              // The same figures as one line of text, exact to the dollar.
              h("div", { className: "bridge-line" },
                steps.map((st, i) => h("span", { key: i }, (i ? (st.sign < 0 ? " − " : " + ") : "") + st.label + " ", h("b", null, fmtMoney(st.value)))),
                eq.dilutedShares > 0
                  ? h("span", null, " = Equity value ", h("b", null, fmtMoney(eq.equityValue)), " ÷ ", fmtNum(eq.dilutedShares), " diluted shares = ", h("b", null, fmtShare(eq.perShare)), " a share")
                  : h("span", null, " = Equity value ", h("b", null, fmtMoney(eq.equityValue)), ". Add diluted shares under Assumptions → Capital structure to turn this into a price per share.")),
              mcap != null && h(Explain, readPriceGap(eq.perShare, price, oneProgram ? impliedSolved.impliedAbsolutePct : null, oneProgram ? impliedSolved.baseAbsolutePct : null))));
        })()),

        // Sum-of-the-Parts breakdown — only meaningful with more than one program.
        // Reuses the exact same pipeline as the main valuation (each program run
        // standalone through it), so this always reconciles exactly with the
        // combined Base-case Enterprise Value shown above.
        show("overview") && (theCase.programs.length > 1 && valMethod === "dcf" && (() => {
          let sotp = null, sotpError = null;
          try {
            const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
            sotp = computeSOTPBreakdown(theCase, getEffectiveScenarioPreset(theCase, "base"), "base", drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
          } catch (e) { sotpError = e.message; }
          if (sotpError) return h("div", { style: { color: "var(--red)", fontSize: 11, fontFamily: "var(--mono)" } }, "SOTP error: " + sotpError);
          const maxAbs = Math.max(...sotp.programBreakdown.map(p => Math.abs(p.npv)), Math.abs(sotp.gaDrag), 1);
          const barRow = (key, label, value, color) => h("div", { key, style: { marginBottom: 6 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)", marginBottom: 3 } },
              h("span", { style: { color: "var(--ink-1)" } }, label),
              h("span", { style: { color, fontWeight: 700 } }, fmtMoney(value))),
            h("div", { style: { height: 7, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (Math.abs(value) / maxAbs) * 100 + "%", background: color, borderRadius: 4, opacity: 0.8 } })));
          return h(ExportSection, { title: "Sum-of-the-Parts (Base case)", reportSection: "sotp", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Sum-of-the-Parts (Base case)"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "Which program actually drives total value — each run standalone, G&A shown separately. Bar width is proportional to size."),
            h("div", null,
              // Two programs with the same name would be two identical rows;
              // number repeats the way readSotp does in its sentence.
              sotp.programBreakdown.map((p, i, all) => {
                const same = all.filter(q => q.name === p.name);
                const label = same.length > 1 ? p.name + " (" + (same.indexOf(p) + 1) + ")" : p.name;
                return barRow(p.id, label, p.npv, p.npv >= 0 ? "var(--green)" : "var(--red)");
              }),
              barRow("__ga_drag__", "Corporate G&A (shared)", sotp.gaDrag, "var(--red)")
            ),
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "var(--mono)", padding: "8px 10px", marginTop: 8, borderTop: "1px solid var(--rule)", fontWeight: 700 } },
              h("span", { style: { color: "var(--ink-1)" } }, "Total Enterprise Value"),
              h("span", { style: { color: "var(--ink-1)" } }, fmtMoney(sotp.sumOfParts))),
            h(Explain, readSotp(sotp.programBreakdown, sotp.gaDrag))
          );
        })()),

        // Pipeline-level risk waterfall — the per-program version lives in
        // each program's own editor; this is its case-wide counterpart, so a
        // multi-asset company has both the single-asset view (in Program
        // Editor) and the full-pipeline view (here), not just the former.
        // Built by running the case's own real valuation machinery twice —
        // once normally, once with every program forced to certain success —
        // rather than summing per-program standalone figures, so shared
        // corporate G&A is included correctly the same way it is in the
        // case's actual number, not approximated separately.
        show("overview") && (theCase.programs.length > 1 && valMethod === "dcf" && (() => {
          let unriskedNPV = null, riskedNPV = null, rwError = null;
          try {
            const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
            const tvParams = { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple };
            riskedNPV = computeCaseValuation(theCase, getEffectiveScenarioPreset(theCase, "base"), "base", drBase, tvParams).npvResult.npv;
            // Unrisked side deliberately stays on the raw, unadjusted preset (literal
            // 100% PoS) — it must mean genuinely certain success, not certain-relative-
            // to-whatever-the-case's-Base-PoS-adjustment-currently-is.
            const unriskedCase = { ...theCase, programs: theCase.programs.map(p => ({ ...p, posOverridePct: "100" })) };
            unriskedNPV = computeCaseValuation(unriskedCase, SCENARIO_PRESETS.base, "base", drBase, tvParams).npvResult.npv;
          } catch (e) { rwError = e.message; }
          if (rwError) return h("div", { style: { color: "var(--red)", fontSize: 11, fontFamily: "var(--mono)" } }, "Pipeline risk waterfall error: " + rwError);
          return h(ExportSection, { style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { "data-section-title": "", style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Pipeline risk waterfall (Base case)"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "The whole pipeline's value if every program succeeded for certain, vs. the actual risk-adjusted total — shared G&A included both ways. Each asset's own version is in its own editor above."),
            h(ExportableBlock, { title: (theCase.name || "Case") + " — pipeline risk waterfall" },
              h(RiskWaterfallChart, { unriskedNPV, riskedNPV, posToLaunchPct: null, height: 190 })),
            h(Explain, readRiskWaterfall(unriskedNPV, riskedNPV))
          );
        })()),

        // Simple Multiple's own version of a value-drivers breakdown — fills
        // the same visual space DCF mode uses for Implied PoS/SOTP, rather
        // than leaving Simple Multiple mode looking thinner. Shows how peak
        // EV gets cut down by PoS risk and by time discounting, across all
        // programs — the equivalent of the risk waterfall's story, but at
        // the case level and using this method's own mechanics.
        show("overview") && (valMethod === "multiple" && baseResult && baseResult.programVals && baseResult.programVals.length > 0 && (() => {
          const totalPeakEV = baseResult.programVals.reduce((s, p) => s + (p.peakEV || 0), 0);
          const totalRiskedEV = baseResult.programVals.reduce((s, p) => s + (p.riskedEV || 0), 0);
          const totalPV = baseResult.programVals.reduce((s, p) => s + (p.pv || 0), 0);
          const maxAbs = Math.max(Math.abs(totalPeakEV), Math.abs(totalRiskedEV), Math.abs(totalPV), 1);
          const row = (label, value, color) => h("div", { key: label, style: { marginBottom: 8 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)", marginBottom: 3 } },
              h("span", { style: { color: "var(--ink-1)" } }, label),
              h("span", { style: { color, fontWeight: 700 } }, fmtMoney(value))),
            h("div", { style: { height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (Math.abs(value) / maxAbs) * 100 + "%", background: color, borderRadius: 4, opacity: 0.8 } })));
          return h("div", { style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Value drivers (Base case)"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } },
              "Peak EV (if success were certain) → cut by PoS risk → discounted to today. Same logic as the risk waterfall, applied to this method's own multiple mechanic, summed across all programs."),
            row("Peak EV (unrisked, at peak year)", totalPeakEV, "var(--ink-3)"),
            row("Risked EV (× PoS)", totalRiskedEV, "var(--ink-1)"),
            row("Present Value (discounted to today)", totalPV, "var(--teal)")
          );
        })()),

        // (The "Current price / Bear, Base, Bull upside" row that closed the
        // Overview now sits under each value in "Price vs. model" at the top.)
      ))
  );
  };
  return { overview: renderPart("overview"), inputs: renderPart("inputs"), scenarios: renderPart("scenarios"), evidence: renderPart("evidence"), flagCount: flags.length };
}

// ── Projections: the base case year by year ────────────────────────────────
// Replaced a single line of risk-adjusted cash flow. The chart shows what each
// year is made of; the table gives every number behind it, ending at the
// explicit NPV the headline uses (computeProjectionRows reads the engine's own
// per-year present values, so the two cannot disagree). Year labels count from
// today, the same way "Launch in year" does: this year is the next twelve months.
const PROJECTION_VIEW_KEY = "rxnpv_proj_view";
const PROJECTION_TABLE_ROWS = 16;
function projectionsCsv(rows, startYear, npvResult) {
  const cols = ["Year", "Phase", "Revenue if it works", "Revenue x odds", "R&D", "COGS + sales & marketing", "Corporate G&A", "Cash tax", "Cash flow", "Discount factor", "Present value", "Running total"];
  const m = v => (v / 1e6).toFixed(2);
  const lines = [cols.join(",")].concat(rows.map(r => [startYear + r.index, r.phase || "", m(r.revenueIfWorks), m(r.revenue), m(-r.rnd), m(-r.commercialCosts), m(-r.ga), m(-r.tax), m(r.fcf), r.discountFactor.toFixed(4), m(r.pv), m(r.runningPV)].map(x => /[,"]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(",")));
  if (npvResult.terminalValuePV) lines.push(["Terminal value (present value)", "", "", "", "", "", "", "", "", "", m(npvResult.terminalValuePV), m(npvResult.npv)].join(","));
  lines.push("");
  lines.push("Dollar amounts in $M. Odds-weighted except 'Revenue if it works'. Year 0 is the twelve months from today.");
  return lines.join("\n");
}
function ProjectionsCard({ theCase, result, successResult }) {
  const h = React.createElement;
  const [view, setView] = React.useState(() => { try { return localStorage.getItem(PROJECTION_VIEW_KEY) || "both"; } catch (e) { return "both"; } });
  // "weighted": each year x the odds (what the valuation adds up). "works":
  // the same case with the drug approved — the company's own P&L if it
  // succeeds, which is what a reader usually means by "the projections".
  const [world, setWorld] = React.useState("weighted");
  const [showAll, setShowAll] = React.useState(false);
  const [csvMsg, setCsvMsg] = React.useState(null);
  const pickView = v => { setView(v); try { localStorage.setItem(PROJECTION_VIEW_KEY, v); } catch (e) {} };
  const works = world === "works" && successResult;
  const shownResult = works ? successResult : result;
  const rows = computeProjectionRows(shownResult, theCase);
  if (!rows.length) return null;
  const startYear = new Date().getFullYear();
  const npv = shownResult.npvResult;
  const shown = showAll ? rows : rows.slice(0, PROJECTION_TABLE_ROWS);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;
  const saveCsv = async () => {
    const slug = (theCase.ticker || theCase.name || "case").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
    try {
      const r = await window.electronAPI.saveAsset({ data: projectionsCsv(rows, startYear, npv), suggestedName: slug + "-projections.csv", filterName: "CSV", extensions: ["csv"] });
      setCsvMsg(r && r.ok ? "Saved." : r && r.canceled ? null : "Could not save: " + ((r && r.error) || "unknown error"));
    } catch (e) { setCsvMsg("Could not save: " + e.message); }
  };
  const title = "Year by year — where the value comes from";
  return h(ExportSection, { title, reportSection: "cashFlow", style: { marginTop: 16 } },
    h("div", { className: "proj-head" },
      h("div", null,
        h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, title),
        works ? h("div", { className: "prose", style: UI.caption }, "Base case, if the drug is approved: every remaining trial is paid for in full and every year's sales arrive, with no odds applied. The line is the running total of present value — what the company is worth in that world, before cash and shares.")
        : h("div", { className: "prose", style: UI.caption }, "Base case. Bars are each year's odds-weighted cash flows; the pale top is the revenue you would add if success were certain. The line is the running total of present value. " + startYear + " is the next twelve months, counted the same way as “Launch in year”.")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" } },
        successResult && h("div", { className: "proj-toggle", role: "group", "aria-label": "Which world to show", "data-no-export": "" },
          [["weighted", "× odds"], ["works", "If it works"]].map(([k, l]) => h("button", { key: k, type: "button", "aria-pressed": world === k, className: world === k ? "on" : "", onClick: () => setWorld(k) }, l))),
        h("div", { className: "proj-toggle", role: "group", "aria-label": "Projection view", "data-no-export": "" },
          [["both", "Chart + table"], ["chart", "Chart"], ["table", "Table"]].map(([k, l]) => h("button", { key: k, type: "button", "aria-pressed": view === k, className: view === k ? "on" : "", onClick: () => pickView(k) }, l))))),
    view !== "table" && h(ExportableBlock, { title: (theCase.name || "Case") + " — year-by-year cash flows (Base case" + (works ? ", if it works)" : ")") },
      h(ProjectionChart, { rows, startYear, height: 300, works: !!works, label: works ? "Year-by-year cash flows if the drug is approved and running present value, base case" : "Year-by-year odds-weighted cash flows and running present value, base case" })),
    view !== "chart" && h(ProjectionTable, { rows: shown, allCount: rows.length, startYear, npv, works: !!works,
      footer: h(React.Fragment, null,
        rows.length > PROJECTION_TABLE_ROWS && h("button", { type: "button", className: "link-btn", "data-no-export": "", onClick: () => setShowAll(!showAll) },
          showAll ? "Show the first " + PROJECTION_TABLE_ROWS + " years" : "Show all " + rows.length + " years (to " + (startYear + rows[rows.length - 1].index) + ")"),
        isDesktop && h("button", { type: "button", className: "link-btn", "data-no-export": "", onClick: saveCsv, style: { marginLeft: 14 } }, "Save as CSV…"),
        csvMsg && h("span", { role: "status", style: { marginLeft: 10, color: "var(--ink-3)" } }, csvMsg)) }),
    h(Explain, readCashFlow(rows.map(r => ({ v: r.fcf, label: String(startYear + r.index) }))))
  );
}

// The year table on its own, shared by the Overview card and the report.
// rows: the rows to show (possibly a first slice); footer: controls for the
// left of the total line (the report passes none).
// works: the rows are the if-it-works world, so the "× odds" revenue column
// would only repeat the first — it is left out.
function ProjectionTable({ rows, startYear, npv, footer, compact, works }) {
  const h = React.createElement;
  const hasPhase = rows.some(r => r.phase);
  const m = v => v === 0 ? "—" : fmtMoney(v, Math.abs(v) >= 1e9 ? 2 : 0);
  const neg = v => v > 0 ? m(-v) : "—";
  // compact (the report's 800px page): R&D, COGS + S&M and G&A fold into one
  // "Costs" column and the discount factor is left out, so all of it prints.
  const cols = compact
    ? [["Year", "l"], hasPhase && ["Phase", "l"], ["If it works"], !works && ["× odds"], ["Costs"], ["Tax"], ["Cash flow"], ["Present value"], ["Running total"]]
    : [["Year", "l"], hasPhase && ["Phase", "l"], [works ? "Revenue" : "Revenue if it works"], !works && ["Revenue × odds"], ["R&D"], ["COGS + S&M"], ["G&A"], ["Tax"], ["Cash flow"], ["Discount"], ["Present value"], ["Running total"]];
  const shownCols = cols.filter(Boolean);
  const span = shownCols.length - 2;
  const cell = (v, cls) => h("td", { className: cls || "" }, v);
  return h("div", { className: "proj-table-wrap" },
    h("table", { className: "proj-table" + (compact ? " compact" : "") },
      h("thead", null, h("tr", null, shownCols.map((c, i) => h("th", { key: i, scope: "col", className: c[1] || "" }, c[0])))),
      h("tbody", null, rows.map(r => {
        const costs = r.rnd + r.commercialCosts + r.ga;
        return h("tr", { key: r.index, className: r.isLaunch ? "launch" : r.isLOE ? "loe" : "" },
          cell(String(startYear + r.index), "l"),
          hasPhase && cell(r.phase, "l phase"),
          cell(m(r.revenueIfWorks)),
          !works && cell(m(r.revenue)),
          compact ? cell(neg(costs), costs > 0 ? "neg" : "") : [
            h("td", { key: "rd", className: r.rnd > 0 ? "neg" : "" }, neg(r.rnd)),
            h("td", { key: "cm", className: r.commercialCosts > 0 ? "neg" : "" }, neg(r.commercialCosts)),
            h("td", { key: "ga", className: r.ga > 0 ? "neg" : "" }, neg(r.ga))],
          cell(neg(r.tax), r.tax > 0 ? "neg" : ""),
          cell(m(r.fcf), r.fcf < 0 ? "neg" : ""),
          !compact && cell(r.discountFactor.toFixed(3)),
          cell(m(r.pv), r.pv < 0 ? "neg" : ""),
          cell(m(r.runningPV), "strong" + (r.runningPV < 0 ? " neg" : "")));
      })),
      h("tfoot", null,
        npv.terminalValuePV > 0 && h("tr", null, h("td", { className: "l", colSpan: span }, "Terminal value, present value"), h("td", null, m(npv.terminalValuePV)), h("td", null, "")),
        h("tr", null,
          h("td", { className: "l", colSpan: span }, footer || null),
          h("td", { colSpan: 2 }, "Enterprise value " + fmtMoney(npv.npv))))));
}

// Cash as of the balance-sheet date, rolled forward to the valuation date only
// when the user ticks "Roll the cash forward" (off by default)
// (effectiveCapitalStructure). Both fields optional; blank = no adjustment.
function CashAsOfFields({ cap, setCap, theCase, update }) {
  const h = React.createElement;
  const eff = effectiveCapitalStructure(theCase);
  const inputStyle = { padding: "7px 10px", minHeight: 28, borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 };
  return h("div", { style: { flex: "1 1 100%", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" } },
    h("label", { style: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)" } },
      "Cash as of (balance-sheet date)",
      h("input", { type: "date", value: cap.cashAsOf || "", onChange: e => setCap({ cashAsOf: e.target.value }), style: inputStyle })),
    h(MillionsField, { label: "Monthly burn", value: cap.monthlyBurn || "", onChange: v => setCap({ monthlyBurn: v }) }),
    // theCase.valuationDate: the day cash is rolled forward to (if ticked). Blank = today;
    // a sample case sets it so its numbers do not drift day by day.
    h("label", { style: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)" } },
      "Value as of (blank = today)",
      h("input", { type: "date", value: theCase.valuationDate || "", onChange: e => update({ valuationDate: e.target.value }), style: inputStyle })),
    // Off by default: the valuation uses the cash the filing reported.
    h("label", { style: { flex: "1 1 100%", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", cursor: "pointer" } },
      h("input", { type: "checkbox", checked: !!cap.carryCashForward, onChange: e => setCap({ carryCashForward: e.target.checked }) }),
      "Roll the cash forward to the “Value as of” date at this burn (an estimate)"),
    h("div", { style: { ...UI.caption, flex: "1 1 100%", lineHeight: 1.6, marginTop: -8 } },
      eff._spentSinceFiling
        ? "On: " + fmtMoney(eff._cashFiled) + " at the filing − " + fmtMoney(eff._spentSinceFiling) + " burned over " + eff._monthsSinceFiling.toFixed(1) + " months to " + (theCase.valuationDate || "today") + " ≈ " + fmtMoney(Number(eff.cash)) + " used in the valuation."
        : cap.carryCashForward
          ? "On, but it needs the cash date and the monthly burn."
          : "Off: the valuation uses the cash the filing reported. The date and burn are remembered for Cash Runway and the rough “if it fails” estimate; the EDGAR pull fills both."));
}

// ── How fresh the inputs are (October 2026) ────────────────────────────────
// One line under the headline numbers: the price and the date it was
// entered, the cash and its filing date (with a real check for a newer
// 10-Q/10-K on the desktop), the catalyst the case is pointed at, and where
// the odds came from. Amber only for a price over a week old or a newer
// filing — information, never a gate.
function useNewerFiling(theCase) {
  const [res, setRes] = React.useState(null);
  const ticker = theCase.ticker, asOf = (theCase.capitalStructure || {}).cashAsOf;
  React.useEffect(() => {
    let live = true;
    setRes(null);
    // The EDGAR bridge itself, not just "desktop": without it there is
    // nothing to ask, and the check would only log a failed lookup.
    const bridge = typeof window !== "undefined" && window.electronAPI && window.electronAPI.edgarFetch;
    if (!bridge || !ticker || !asOf) return undefined;
    checkNewerFiling(ticker, asOf).then(r => { if (live) setRes(r); });
    return () => { live = false; };
  }, [ticker, asOf]);
  return res;
}
function freshnessAgo(days) {
  if (days == null) return "";
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : days + " days ago";
}
function FreshnessStrip({ theCase }) {
  const h = React.createElement;
  const filing = useNewerFiling(theCase);
  const f = computeFreshness(theCase, new Date(), filing && filing.status === "newer" ? filing.filing : null);
  const amber = { color: "var(--warn)", fontWeight: 600 };
  const parts = [];
  if (f.price) parts.push(h("span", { key: "p", style: f.price.stale ? amber : null },
    "Price " + fmtShare(f.price.value) + (f.price.asOf ? " entered " + f.price.asOf + " (" + freshnessAgo(f.price.days) + ")" : ", date not recorded") + (f.price.stale ? " — re-check it before acting on the gap" : "")));
  else parts.push(h("span", { key: "p" }, "No price entered"));
  if (f.cash) parts.push(h("span", { key: "c", title: filing && filing.status === "unavailable" ? "Could not check SEC for a newer filing: " + filing.reason : undefined },
    "Cash " + fmtMoney(f.cash.value) + (f.cash.asOf ? " as of " + f.cash.asOf + " (" + freshnessAgo(f.cash.days) + ")" : ", date not recorded") + (f.cash.rolled ? ", rolled forward" : "")));
  if (f.cash && f.cash.newer) parts.push(h("span", { key: "n", style: amber },
    "a newer " + f.cash.newer.form + " (period to " + f.cash.newer.period + ") was filed " + f.cash.newer.filed + " — refresh cash, burn and shares"));
  if (f.catalyst) parts.push(h("span", { key: "k" },
    "Next: " + f.catalyst.label.split(/[,(]/)[0].trim() + ", " + f.catalyst.date + (f.catalyst.pinned ? " (pinned" + (f.catalyst.source ? ": " + f.catalyst.source : "") + ")" : " (Calibration Log, not pinned)")));
  if (f.odds) parts.push(h("span", { key: "o" },
    "Odds " + Math.round(f.odds.pct) + "%, " + (f.odds.source === "simulator" ? "from the simulator" + (f.odds.at ? " (" + f.odds.at + ")" : "") : f.odds.source === "typed" ? "your figure" : "the benchmark")));
  return h("div", { className: "freshness", role: "note", "aria-label": "How fresh these inputs are", style: { ...UI.caption, marginTop: 10, lineHeight: 1.6 } },
    parts.reduce((acc, el, i) => i ? acc.concat([h("span", { key: "s" + i, "aria-hidden": "true", style: { color: "var(--ink-3)" } }, " · "), el]) : [el], []));
}
