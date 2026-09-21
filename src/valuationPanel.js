// ════════════════════════════════════════════════════════════════════════════
// ValuationPanel — discount rate, terminal value, capital structure, and the
// Bear/Base/Bull scenario comparison. Lives inside CaseView.
// ════════════════════════════════════════════════════════════════════════════
function ValuationPanel({ theCase, onChange }) {
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
  const [edgarLoading, setEdgarLoading] = React.useState(false);
  const [edgarResult, setEdgarResult] = React.useState(null);
  const [edgarError, setEdgarError] = React.useState(null);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const pullFromEdgar = async (force) => {
    if (!edgarQuery.trim()) { setEdgarError("Enter a company name or ticker first."); return; }
    setEdgarLoading(true); setEdgarError(null);
    try {
      const r = await pullEdgarFinancials(edgarQuery.trim(), force);
      if (!r.ok) { setEdgarError(r.error); setEdgarResult(null); }
      else {
        setEdgarResult(r);
        const patch = { cash: r.cash != null ? String(r.cash) : cap.cash, debt: r.debt != null ? String(r.debt) : cap.debt };
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
  const cfSeries = (baseResult && baseResult.calendar) ? [
    { name: "Risk-adjusted FCF", color: "var(--teal)", points: baseResult.calendar.map(c => ({ v: c.riskAdjFCF, label: c.calendarYear })) }
  ] : [];

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

  return h("div", { id: "ws-valuation", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 22 } },
    h("div", { style: { fontFamily: "var(--display)", fontSize: 16, fontWeight: 600, color: "var(--ink-1)", marginBottom: 14 } }, "Valuation"),

    // Red flags — cross-checks this case's own inputs against the same
    // benchmarks and formulas used elsewhere in the app, before presenting
    // what those inputs produce. Purely descriptive, never a verdict — see
    // computeRedFlags in scenarioEngine.js for exactly what's checked and why.
    (() => {
      const flags = computeRedFlags(theCase);
      if (flags.length === 0) return null;
      const highCount = flags.filter(f => f.severity === "high").length;
      return h("div", { style: { marginBottom: 16, padding: "12px 14px", borderRadius: 8, background: "var(--amber-bg)", border: "1px solid var(--amber)" } },
        h("div", { style: { fontSize: 12, fontFamily: "var(--display)", fontWeight: 600, color: "var(--amber)", marginBottom: 8 } },
          flags.length + " input" + (flags.length > 1 ? "s" : "") + " worth a second look" + (highCount > 0 ? " (" + highCount + " large deviation" + (highCount > 1 ? "s" : "") + ")" : "")),
        flags.map((f, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: i < flags.length - 1 ? 8 : 0, paddingLeft: 10, borderLeft: "2px solid " + (f.severity === "high" ? "var(--red)" : "var(--amber)") } },
          f.programName && h("span", { style: { fontWeight: 700, color: "var(--ink-1)" } }, f.programName + ": "),
          f.message
        ))
      );
    })(),

    // Price vs. model — a prominent, glanceable summary placed ahead of every
    // input section rather than buried after them, so "what does this case
    // say right now" doesn't require scrolling past the whole build to find.
    // Pulls together numbers already computed elsewhere on this panel
    // (scenarioResults for the Bear/Base/Bull targets, impliedSolved for the
    // PoS the price requires) rather than a separate calculation — this is a
    // presentation change, not a new number.
    !error && scenarioResults && (() => {
      const price = theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null;
      const baseShare = baseResult && baseResult.equity.perShare;
      const upsidePct = (price > 0 && baseShare != null) ? (baseShare / price - 1) * 100 : null;
      const showImplied = impliedSolved && impliedSolved.ok && !impliedSolved.degenerate;
      return h("div", { style: { marginBottom: 16, padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", border: "1.5px solid var(--rule)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", marginBottom: 10 } }, "Price vs. model"),
        h("div", { style: { display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" } },
          h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Current price"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, price != null ? fmtShare(price) : "—")),
          scenarioResults.map(s => h("div", { key: s.key },
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: s.preset.color, textTransform: "uppercase" } }, s.preset.label + " fair value"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: s.preset.color } },
              fmtShare(s.result.equity.perShare)))),
          upsidePct != null && h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Base upside/downside"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: upsidePct >= 0 ? "var(--teal)" : "var(--red)" } },
              (upsidePct >= 0 ? "+" : "") + upsidePct.toFixed(0) + "%")),
          showImplied && theCase.programs.length === 1 && impliedSolved.baseAbsolutePct != null && h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Your PoS"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, impliedSolved.baseAbsolutePct.toFixed(0) + "%")),
          showImplied && theCase.programs.length === 1 && impliedSolved.impliedAbsolutePct != null && h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Price implies"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: impliedSolved.impliedAbsolutePct >= impliedSolved.baseAbsolutePct ? "var(--teal)" : "var(--red)" } },
              impliedSolved.impliedAbsolutePct.toFixed(0) + "%"))
        ),
        valMethod === "multiple" && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, "Implied PoS is DCF-only — switch off Simple Multiple to see what the price requires."),
        price == null && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, "Set a current price above to see upside/downside and implied PoS."),
        valMethod === "dcf" && price != null && theCase.programs.length > 1 && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, "Implied PoS as a single absolute number needs one program — see \"as a multiple\" further down for the multi-program version.")
      );
    })(),

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
    (() => {
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
        h("div", { style: { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.45 } }, sub));
      return h("div", { style: { marginBottom: 14 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 } }, "Valuation depth"),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          btn("napkin", "Napkin", "Type a peak revenue, value it off a comp multiple. Fastest sanity check."),
          btn("full", "Full model", "Build peak from epidemiology, then a bottoms-up DCF with costs and timing."),
          active === "custom" && h("div", { key: "custom", style: { flex: "1 1 190px", padding: "9px 12px", borderRadius: 8, border: "1px dashed var(--amber)", background: "transparent" } },
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--amber)" } }, "Custom"),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.45 } },
              valMethod === "multiple" && allFull ? "Epidemiology build valued off a multiple — rigorous peak, comp-based value."
                : valMethod === "dcf" && allQuick ? "Typed peak run through the full cost and timing model."
                : "Programs are mixed between Quick and Full revenue builds."))
        ));
    })(),

    h("div", { style: { marginBottom: 16 } },
      h("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
        [["dcf","DCF (bottoms-up)"],["multiple","Simple Multiple"]].map(([id,lbl]) => h("button", { key: id, onClick: () => update({ valuationMethod: id }),
          style: { padding: "6px 14px", borderRadius: 7, border: "1px solid " + (valMethod === id ? "var(--teal)" : "var(--rule)"), cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12,
            background: valMethod === id ? "var(--teal-bg)" : "transparent", color: valMethod === id ? "var(--teal)" : "var(--ink-2)", fontWeight: valMethod === id ? 700 : 400 } }, lbl))
      ),
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
          return h("div", { style: { marginTop: 10, padding: "10px 12px", borderRadius: 7, background: "var(--amber-bg)", border: "1px solid var(--amber)", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-1)", lineHeight: 1.6 } },
            h("b", { style: { color: "var(--amber)" } }, "Match the multiple to the stage. "),
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
    ),

    // Cash tax + NOL carryforward. Not read by Simple Multiple: a comp multiple
    // is derived from real deal values, which already reflect after-tax
    // economics — taxing on top of it would double-count.
    (() => {
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
                "Projected loss years add to the shield; profits draw it down before any tax is charged. Ignores the 80%-of-income annual cap on post-2017 federal NOL use and any expiry of older losses — both would pull tax slightly forward, so this errs mildly optimistic.")))
        )
      );
    })(),

    // Discount rate + terminal value. Terminal value is a DCF concept — Simple
    // Multiple's peak x multiple IS its own terminal-style value, so showing a
    // second one there would invite adding value twice.
    methodIgnores(valMethod, "terminalValue") && h(NotUsedInThisMode, { what: "Terminal value", compact: true }),
    h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 } },
      h(BenchField, { label: "Discount rate", value: discountRatePct, onChange: v => update({ discountRatePct: v }), suffix: "%",
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
    ),

    // Capital structure
    h("div", { style: { borderTop: "1px dashed var(--rule)", paddingTop: 14, marginBottom: 16 } },
      h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 10 } }, "Capital structure"),

      // EDGAR auto-fill — desktop app only, no proxy/CORS workaround needed here
      isDesktop && h("div", { style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 14 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase" } }, "Pull financials from SEC EDGAR"),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
          h("input", { type: "text", value: edgarQuery, placeholder: "Company name or ticker", onChange: e => setEdgarQuery(e.target.value),
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
            h("div", { style: { color: "var(--amber)", fontSize: 10, marginTop: 3 } }, "Dilutive securities are tagged less reliably — cross-check against the filing's \"Stockholders' Equity\" note.")
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
            h(MillionsField, { label: "Debt", value: cap.debt, onChange: v => setCap({ debt: v }) })
          )
        : h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(BenchField, { label: "Basic shares outstanding", value: cap.basicShares, onChange: v => setCap({ basicShares: v }) }),
            h(MillionsField, { label: "Cash & equivalents", value: cap.cash, onChange: v => setCap({ cash: v }) }),
            h(MillionsField, { label: "Debt", value: cap.debt, onChange: v => setCap({ debt: v }) }),
            h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", margin: "4px 0" } }, "Options / warrants (treasury method — dilutive only if in the money; uses Current price above)"),
            h(BenchField, { label: "Options outstanding", value: cap.opts, onChange: v => setCap({ opts: v }) }),
            h(BenchField, { label: "Options avg strike", value: cap.optK, onChange: v => setCap({ optK: v }), suffix: "$" }),
            h(BenchField, { label: "Warrants outstanding", value: cap.war, onChange: v => setCap({ war: v }) }),
            h(BenchField, { label: "Warrants strike", value: cap.warK, onChange: v => setCap({ warK: v }), suffix: "$" }),
            h("div", { style: { flex: "1 1 100%", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", margin: "4px 0" } }, "Convertible notes (if-converted method — converts to shares only if in the money, else stays as debt)"),
            h(MillionsField, { label: "Convertible face value", value: cap.convFace, onChange: v => setCap({ convFace: v }) }),
            h(BenchField, { label: "Conversion price", value: cap.convPrice, onChange: v => setCap({ convPrice: v }), suffix: "$" })
          )
    ),

    // Future dilution scenario — an optional overlay, applied identically
    // across Bear/Base/Bull so dilution risk shows up consistently, not just
    // in one scenario. Excluded from the Implied PoS solver on purpose (see
    // scenarioEngine.js) since that question is about today's actual share
    // count, not a hypothetical future one.
    (() => {
      const fr = theCase.futureRaise || { enabled: false, amountM: "", priceOverride: "" };
      const setFR = (patch) => update({ futureRaise: { ...fr, ...patch } });
      const fallbackPrice = theCase.currentPrice;
      const impliedPrice = fr.priceOverride !== "" && fr.priceOverride != null ? Number(fr.priceOverride) : Number(fallbackPrice || 0);
      const newShares = (fr.enabled && impliedPrice > 0 && fr.amountM) ? Number(fr.amountM) / impliedPrice : 0;
      return h("div", { style: { borderTop: "1px dashed var(--rule)", paddingTop: 14, marginBottom: 16 } },
        h("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", cursor: "pointer", marginBottom: fr.enabled ? 10 : 0 } },
          h("input", { type: "checkbox", checked: fr.enabled, onChange: e => setFR({ enabled: e.target.checked }) }),
          "Model a future capital raise"),
        fr.enabled && h("div", null,
          h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
            "Applied to every scenario — new shares dilute the count, raised cash adds to net cash dollar for dollar. No underwriting fee, no explicit timing — answers \"what happens at $X raised at $Y,\" not when."),
          h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" } },
            h(MillionsField, { label: "Amount to raise", value: fr.amountM, onChange: v => setFR({ amountM: v }) }),
            h(BenchField, { label: "Assumed raise price", value: fr.priceOverride, onChange: v => setFR({ priceOverride: v }), suffix: "$",
              bench: { value: Number(fallbackPrice || 0), source: "Defaults to the case's current price — override for a raise at a discount (or premium)" } })
          ),
          newShares > 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } },
            "≈ ", h("b", { style: { color: "var(--ink-2)" } }, Math.round(newShares).toLocaleString()), " new shares at $" + impliedPrice.toFixed(2) + "/share.")
        )
      );
    })(),

    // Dilution-path financing — connects cash runway and R&D-to-launch cost
    // (both already computed elsewhere) into a projected sequence of future
    // raises, rather than one manual what-if. See computeDilutionPath in
    // scenarioEngine.js for the actual model. An alternative to the single
    // future-raise overlay above, not additive with it — enabling both at
    // once would double-model financing, so this is deliberately its own
    // separate toggle rather than a refinement of that one.
    (() => {
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
          h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
            "Projects when cash would run out and models a raise there, at current price less the assumed discount — repeated as needed through to launch. Fixes the single most common retail valuation error: fair value per share on today's share count, without the dilution getting there usually costs."),
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
            "Base case: ", h("b", { style: { color: "var(--ink-2)" } }, "$" + preview.totalRaisedM.toFixed(0) + "M"), " raised across the path to launch, diluted shares growing from ",
            h("b", { style: { color: "var(--ink-2)" } }, Math.round(startingShares || 0).toLocaleString()), " to ",
            h("b", { style: { color: "var(--ink-2)" } }, Math.round(preview.finalDilutedShares).toLocaleString()), " by then.")
        )
      );
    })(),

    !error && h(MonteCarloBox, { theCase, discountRatePct, tv }),

    // Scenario comparison
    error ? h("div", { style: { padding: 14, borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12 } }, "Calculation error: " + error)
    : h("div", null,
        h("div", { id: "ws-scenarios", style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 10, borderTop: "1px dashed var(--rule)", paddingTop: 14 } }, "Scenario comparison"),

        h(SectionCard, { title: "Case-level Base-PoS adjustment", subtitle: "An overarching view on this whole case's odds, distinct from any single program's PoS override or the Bear/Bull scenario multipliers below", defaultOpen: false },
          h(BenchField, { label: "Base PoS adjustment", value: basePosAdjustmentPct, onChange: v => update({ basePosAdjustmentPct: v }), suffix: "%",
            bench: { value: 100, source: "100% = no adjustment (the default). Applies as a multiplier on top of every program's own modeled or overridden PoS, across Bear/Base/Bull alike — so their existing 70%/100%/130% relationship still holds relative to your adjusted Base, not the un-adjusted preset." },
            help: "Use this for a company-wide view (management track record, a specific therapeutic-area headwind or tailwind) that should shift every program's odds together — not a substitute for a per-program override when you have a drug-specific reason instead." })
        ),

        h(SectionCard, { title: "Edit Bear / Bull assumptions", subtitle: "Benchmarks shown by default — override per case when a scenario should look different than the standard multiplier", defaultOpen: false },
          [["bear","Bear"],["bull","Bull"]].map(([key, label]) => h("div", { key, style: { flex: "1 1 100%", marginBottom: 10 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", fontWeight: 700, marginBottom: 6 } }, label + " case"),
            h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
              h(BenchField, { label: "Peak share multiplier", value: scenarioOv[key].shareMultiplierPct, onChange: v => setScenarioOv(key, { shareMultiplierPct: v }), suffix: "%",
                bench: { value: SCENARIO_PRESETS[key].shareMultiplierPct, source: "Standard benchmark" } }),
              h(BenchField, { label: "PoS multiplier", value: scenarioOv[key].posMultiplierPct, onChange: v => setScenarioOv(key, { posMultiplierPct: v }), suffix: "%",
                bench: { value: SCENARIO_PRESETS[key].posMultiplierPct, source: "Standard benchmark — lower further if a bad outcome should mean worse odds than a flat 30% haircut" } }),
              h(BenchField, { label: "Discount rate adjustment", value: scenarioOv[key].discountRateAddPct, onChange: v => setScenarioOv(key, { discountRateAddPct: v }), suffix: "pp",
                bench: { value: SCENARIO_PRESETS[key].discountRateAddPct, source: "Standard benchmark, added to your base discount rate" } }),
              (tv.enabled && (tv.method || "exitMultiple") === "exitMultiple") && h(BenchField, { label: "Exit multiple override", value: scenarioOv[key].exitMultiple, onChange: v => setScenarioOv(key, { exitMultiple: v }), suffix: "x",
                help: "Optional — overrides the case's exit multiple just for " + label + ", instead of using the same multiple across all three scenarios." })
            ),
            h("div", { style: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
              h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8 } }, "Optional: give each program an independent peak revenue for " + label + ", instead of scaling Base by the multiplier above"),
              theCase.programs.filter(p => (p.revenueMode || "quick") !== "full").map(p => h(BenchField, {
                key: p.id, label: (p.drugName || p.name) + " — peak revenue override",
                value: ((p.quickRevenue || {}).scenarioOverrides || {})[key] ? p.quickRevenue.scenarioOverrides[key].peakRevenue : "",
                onChange: v => {
                  const nextPrograms = theCase.programs.map(pr => pr.id === p.id
                    ? { ...pr, quickRevenue: { ...pr.quickRevenue, scenarioOverrides: { ...(pr.quickRevenue.scenarioOverrides || { bear: {}, bull: {} }), [key]: { peakRevenue: v ? String(Math.round(Number(v) * 1e6)) : "" } } } }
                    : pr);
                  update({ programs: nextPrograms });
                },
                suffix: "$M", wide: false
              }))
            )
          ))
        ),

        h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
          scenarioResults.map(s => h("div", { key: s.key, style: {
              flex: "1 1 200px", padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)",
              border: "1.5px solid " + s.preset.color
            } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: s.preset.color, textTransform: "uppercase", marginBottom: 8 } }, s.preset.label),
            // "70% PoS" reads as "70% probability of success," which it
            // never is — it's a MULTIPLIER on the modeled PoS (Oncology
            // Phase 2 might model 8.7%; Bear's "70%" means 6.1%, not 70%).
            // A user reported exactly this misreading, and it's the single
            // most important number in the valuation to get right. Single-
            // program cases now show the actual resulting PoS instead of the
            // multiplier; multi-program cases still show the multiplier
            // (there's no one PoS to point at) but reworded so it can't be
            // mistaken for an absolute probability.
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 6 } },
              s.preset.shareMultiplierPct + "% share · " +
              (theCase.programs.length === 1 && s.result.programVals && s.result.programVals[0] && s.result.programVals[0].posToLaunch != null
                ? "PoS " + (s.result.programVals[0].posToLaunch * 100).toFixed(1) + "%"
                : s.preset.posMultiplierPct + "% of modeled PoS")
              + " · " + (s.preset.discountRateAddPct >= 0 ? "+" : "") + s.preset.discountRateAddPct + "pp disc."
              + (valMethod === "multiple" ? " · " + numOr(multipleAssumptions[s.key], 3).toFixed(1) + "x" : "")),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Enterprise value (rNPV)"),
            h("div", { style: { fontSize: 15, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 } }, fmtMoney(s.result.npvResult.npv)),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Equity value"),
            h("div", { style: { fontSize: 15, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 6 } }, fmtMoney(s.result.equity.equityValue)),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Value per share"),
            h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: s.preset.color } },
              fmtShare(s.result.equity.perShare))
          ))
        ),
        h("div", { style: { marginTop: 16 } },
          h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } }, "Base-case risk-adjusted cash flow by year"),
          h(ExportableBlock, { name: (theCase.name || "case") + "-risk-adjusted-cash-flow", showPanelCapture: true },
            h(RevenueChart, { series: cfSeries, showLegend: false, height: 180 })),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4 } }, "Clips negative years to the axis floor — see actual pre-launch values in the P&L panel above.")
        ),

        // Implied PoS — the reverse direction from everything else on this
        // panel: solve backwards from the current price to find what PoS the
        // market must be pricing in. Given a distinct, prominent treatment
        // (amber accent, its own bordered box) rather than blending into the
        // other dashed-divider sections — it's one of the most distinctive,
        // case-specific insights this tool produces, not just another line
        // item. Title names the actual case so it reads as "this company,"
        // not a generic label.
        theCase.currentPrice !== "" && theCase.currentPrice != null && valMethod === "dcf" && (() => {
          // Reuses the solve hoisted near the top of this component (see
          // impliedSolved above) — the prominent summary card and this
          // detailed box now show the exact same computation, never two.
          const solved = impliedSolved, solveError = impliedSolveError;
          if (solveError || !solved) return null;
          const caseLabel = theCase.name || "This case";
          if (!solved.ok) return h("div", { style: { marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "var(--amber-bg)", border: "1px solid var(--amber)", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Implied PoS: " + solved.error);
          return h("div", { style: { marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "var(--amber-bg)", border: "1.5px solid var(--amber)" } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "What " + caseLabel + "'s price implies"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10 } }, "The PoS the current price requires, given your assumptions — the reverse of fair value."),
            solved.degenerate
              ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, solved.note)
              : h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
                  theCase.programs.length === 1 && solved.baseAbsolutePct != null && h("div", null,
                    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Your PoS assumption"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, solved.baseAbsolutePct.toFixed(1) + "%")),
                  theCase.programs.length === 1 && solved.impliedAbsolutePct != null && h("div", null,
                    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Market implies"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: solved.impliedAbsolutePct >= solved.baseAbsolutePct ? "var(--teal)" : "var(--red)" } }, solved.impliedAbsolutePct.toFixed(1) + "%")),
                  h("div", null,
                    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, theCase.programs.length > 1 ? "As a multiple of your PoS" : "As a multiple"),
                    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: solved.multiplierPct >= 100 ? "var(--teal)" : "var(--red)" } }, solved.multiplierPct.toFixed(0) + "%"))
                )
          );
        })(),

        // Reverse-solve beyond PoS — same "what does the price imply" idea
        // as the Implied PoS box above, generalized to a different dial via
        // solveImpliedVariable in scenarioEngine.js. Single-program, DCF-only,
        // matching Implied PoS's own scope for the same reason: with more
        // than one program there's no single unambiguous value to solve for.
        theCase.currentPrice !== "" && theCase.currentPrice != null && valMethod === "dcf" && theCase.programs.length === 1 && (() => {
          const mode = theCase.programs[0].revenueMode;
          const options = [
            mode === "quick" && { key: "peakRevenue", label: "Peak revenue" },
            mode === "full" && { key: "peakShare", label: "Peak market share" },
            { key: "launchYear", label: "Launch timing" }
          ].filter(Boolean);
          return h(ReverseSolveBox, { theCase, discountRatePct, tv, options });
        })(),

        // Enterprise Value -> Equity Value -> Per-Share bridge, Base case. A
        // simple connected flow rather than a proportional waterfall bar —
        // renders correctly regardless of sign (EV, cash, debt can all be
        // negative or positive) without the complexity a true waterfall needs
        // to handle that safely.
        (() => {
          const baseR = scenarioResults.find(s => s.key === "base").result;
          const cash = Number(cap.cash) || 0, debt = Number(cap.debt) || 0;
          const prvAdded = baseR.equity.prvValueAdded || 0;
          const partnershipAdded = baseR.equity.partnershipValueAdded || 0;
          const steps = [
            { label: "Enterprise Value", value: baseR.npvResult.npv, op: null },
            { label: "Cash", value: cash, op: "+" },
            { label: "Debt", value: debt, op: "-" },
          ];
          if (prvAdded) steps.push({ label: "PRV (risk-adj.)", value: prvAdded, op: "+" });
          if (partnershipAdded) steps.push({ label: "Partnership (upfront + milestones)", value: partnershipAdded, op: "+" });
          steps.push({ label: "Equity Value", value: baseR.equity.equityValue, op: "=" });
          return h("div", { id: "ws-bridge", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 10 } }, "Enterprise Value → Per-Share bridge (Base case)"),
            h("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
              steps.map((s, i) => h(React.Fragment, { key: i },
                i > 0 && h("span", { style: { fontSize: 16, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, s.op),
                h("div", { style: { padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", border: s.op === "=" ? "1.5px solid var(--teal)" : "1px solid var(--rule)", textAlign: "center" } },
                  h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, s.label),
                  h("div", { style: { fontSize: 13, fontFamily: "var(--mono)", fontWeight: 700, color: s.op === "=" ? "var(--teal)" : "var(--ink-1)" } }, fmtMoney(s.value)))
              )),
              h("span", { style: { fontSize: 16, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "÷"),
              h("div", { style: { padding: "8px 12px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--rule)", textAlign: "center" } },
                h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Diluted shares"),
                h("div", { style: { fontSize: 13, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtNum(baseR.equity.dilutedShares))),
              h("span", { style: { fontSize: 16, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "="),
              h("div", { style: { padding: "8px 14px", borderRadius: 8, background: "var(--teal-bg)", border: "1.5px solid var(--teal)", textAlign: "center" } },
                h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Per share"),
                h("div", { style: { fontSize: 16, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--teal)" } }, fmtShare(baseR.equity.perShare)))
            )
          );
        })(),

        // Sum-of-the-Parts breakdown — only meaningful with more than one program.
        // Reuses the exact same pipeline as the main valuation (each program run
        // standalone through it), so this always reconciles exactly with the
        // combined Base-case Enterprise Value shown above.
        theCase.programs.length > 1 && valMethod === "dcf" && (() => {
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
          return h("div", { style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Sum-of-the-Parts (Base case)"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "Which program actually drives total value — each run standalone, G&A shown separately. Bar width is proportional to size."),
            h("div", null,
              sotp.programBreakdown.map(p => barRow(p.id, p.name, p.npv, p.npv >= 0 ? "var(--teal)" : "var(--red)")),
              barRow("__ga_drag__", "Corporate G&A (shared)", sotp.gaDrag, "var(--red)")
            ),
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: "var(--mono)", padding: "8px 10px", marginTop: 8, borderTop: "1px solid var(--rule)", fontWeight: 700 } },
              h("span", { style: { color: "var(--ink-1)" } }, "Total Enterprise Value"),
              h("span", { style: { color: "var(--ink-1)" } }, fmtMoney(sotp.sumOfParts)))
          );
        })(),

        // Pipeline-level risk waterfall — the per-program version lives in
        // each program's own editor; this is its case-wide counterpart, so a
        // multi-asset company has both the single-asset view (in Program
        // Editor) and the full-pipeline view (here), not just the former.
        // Built by running the case's own real valuation machinery twice —
        // once normally, once with every program forced to certain success —
        // rather than summing per-program standalone figures, so shared
        // corporate G&A is included correctly the same way it is in the
        // case's actual number, not approximated separately.
        theCase.programs.length > 1 && valMethod === "dcf" && (() => {
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
          return h("div", { style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
            h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Pipeline risk waterfall (Base case)"),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "The whole pipeline's value if every program succeeded for certain, vs. the actual risk-adjusted total — shared G&A included both ways. Each asset's own version is in its own editor above."),
            h(RiskWaterfallChart, { unriskedNPV, riskedNPV, posToLaunchPct: null, height: 190 })
          );
        })(),

        // Simple Multiple's own version of a value-drivers breakdown — fills
        // the same visual space DCF mode uses for Implied PoS/SOTP, rather
        // than leaving Simple Multiple mode looking thinner. Shows how peak
        // EV gets cut down by PoS risk and by time discounting, across all
        // programs — the equivalent of the risk waterfall's story, but at
        // the case level and using this method's own mechanics.
        valMethod === "multiple" && baseResult && baseResult.programVals && baseResult.programVals.length > 0 && (() => {
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
            row("Risked EV (× PoS)", totalRiskedEV, "var(--amber)"),
            row("Present Value (discounted to today)", totalPV, "var(--teal)")
          );
        })(),

        // Current price vs. fair value — the standard write-up headline. Uses
        // the case-level Current Price field (top of the case, near the name).
        theCase.currentPrice !== "" && theCase.currentPrice != null && h("div", { style: { marginTop: 16, padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--rule)" } },
          h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" } },
            h("div", null,
              h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Current price"),
              h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtShare(Number(theCase.currentPrice)))),
            scenarioResults.map(s => {
              const fv = s.result.equity.perShare;
              // Guard against a zero (or non-numeric) current price — dividing by
              // it yields Infinity, which previously rendered as "+Infinity%".
              const cp = Number(theCase.currentPrice);
              const upside = (fv != null && cp > 0) ? ((fv / cp) - 1) * 100 : null;
              return h("div", { key: s.key }, 
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, s.preset.label + " upside/downside"),
                h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: upside == null ? "var(--ink-3)" : upside >= 0 ? "var(--teal)" : "var(--red)" } },
                  upside != null ? (upside >= 0 ? "+" : "") + upside.toFixed(0) + "%" : "—")
              );
            })
          )
        )
      )
  );
}
