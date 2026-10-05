// ════════════════════════════════════════════════════════════════════════════
// Tools → Valuation workbench
// Sensitivity, Binary Event, Diluted Market Cap.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── Sensitivity Analysis: which single assumption swings fair value most ──
// Import-only by design — there's no meaningful standalone sensitivity without
// a case's own assumptions to perturb. Reuses the exact same computeCaseValuation
// pipeline as the workspace (via custom one-off scenario presets), so results are
// guaranteed consistent with what you'd see there — no separate/duplicated math.
function SensitivityTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [caseId, setCaseId] = useActiveCaseId(activeCase);
  const theCase = cases.find(c => c.id === caseId);

  const { rows, error, baseline, gridData } = computeSensitivityDrivers(theCase);

  const maxSwing = rows.length ? Math.max(...rows.map(r => r.swing)) : 1;

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Sensitivity analysis"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? How to read a tornado chart' },
          h("div", { style: { lineHeight: 1.6 } }, 'Each bar is one assumption moved to its low and high case with everything else held at Base, so the bar length is how much fair value per share that single input controls. The longest bar is where your thesis actually lives — it is the assumption worth the most research time, and the one a sceptic will attack first. A short bar means the input barely matters, so precision there is wasted effort. The price-target grid underneath does the opposite job: instead of one driver at a time it shows every Peak Revenue x PoS combination at once, which is the view to use when two assumptions interact.'))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12 } }, "Shows which single assumption swings fair value per share the most, holding everything else at Base. Needs a case to analyze — there's nothing to perturb without one."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        h(CasePicker, { cases, selectedId: caseId, onChange: setCaseId }),
        theCase && h(IncludeInReportToggle, { theCase, updateCase, reportKey: "sensitivity", label: "Include tornado chart in PDF report" })
      )
    ]),
    error && h("div", { style: { padding: 14, borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12, marginBottom: 16 } }, "Calculation error: " + error),
    theCase && !error && toolCard(h, [
      toolLabel(h, "Tornado — which assumption moves fair value most"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 14 } },
        "Base fair value: ", h("b", { style: { color: "var(--teal)" } }, fmtShare(baseline))),
      h(ExportableBlock, { title: (theCase ? theCase.name + " — " : "") + "sensitivity tornado" },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
          rows.map((r, i) => h("div", { key: i },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)", marginBottom: 4 } },
              h("span", { style: { color: "var(--ink-1)", fontWeight: 700 } }, r.name),
              h("span", { style: { color: "var(--ink-3)" } }, r.lo != null ? fmtShare(r.lo) + " — " + fmtShare(r.hi) : "—")),
            h("div", { style: { height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (maxSwing > 0 ? (r.swing / maxSwing) * 100 : 0) + "%", background: "var(--amber)", borderRadius: 4 } })),
            h("div", { style: { display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" } },
              r.values.map((v, j) => h("span", { key: j, style: UI.caption }, v.label + ": " + fmtShare(v.value)))
            )
          ))
        )),
      h(Explain, readTornado(rows.filter(r => r.lo != null).map(r => ({ label: r.name, low: r.lo, high: r.hi })), baseline,
        theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null))
    ]),

    theCase && !error && gridData && toolCard(h, [
      toolLabel(h, "Price target grid — Peak Revenue × PoS"),
      h("div", { style: UI.intro },
        "Every combination at once, not one driver at a time like the tornado chart above — this is the two-way sensitivity table from the old RxNPV tool, rebuilt for this engine's actual value drivers. All other inputs (discount rate, launch timing, exit multiple) held at Base.",
        gridData.currentPrice == null && " Set a current price on the case to enable upside/downside color coding."),
      h("div", { style: { overflowX: "auto" } },
        h("table", { style: { borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--mono)", minWidth: 520 } },
          h("thead", null, h("tr", null,
            h("th", { style: { padding: "6px 10px", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)", textAlign: "left", whiteSpace: "nowrap" } }, "Peak Rev ↓ / PoS →"),
            gridData.posSteps.map(pPct => h("th", { key: pPct, style: { padding: "6px 10px", fontSize: 10, color: "var(--ink-3)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)" } }, pPct + "%"))
          )),
          h("tbody", null, gridData.shareSteps.map((sPct, ri) => h("tr", { key: sPct },
            h("td", { style: { padding: "6px 10px", background: "var(--surface-2)", borderRight: "1px solid var(--rule)", fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap", fontSize: 10 } }, sPct + "%"),
            gridData.posSteps.map((pPct, ci) => {
              const p = gridData.cells[ri][ci];
              const isBase = sPct === 100 && pPct === 100;
              const cp = gridData.currentPrice;
              const upPct = (cp && p != null) ? ((p - cp) / cp * 100) : null;
              const cellBg = (() => {
                if (upPct == null) return "transparent";
                if (upPct > 50) return "rgba(16,185,129,0.22)";
                if (upPct > 20) return "rgba(16,185,129,0.12)";
                if (upPct > -5) return "rgba(245,158,11,0.15)";
                if (upPct > -25) return "rgba(239,68,68,0.1)";
                return "rgba(239,68,68,0.2)";
              })();
              return h("td", {
                key: pPct,
                title: p != null ? ("Peak Rev: " + sPct + "% · PoS: " + pPct + "% · Fair value: " + fmtShare(p) + (upPct != null ? " · " + (upPct >= 0 ? "+" : "") + upPct.toFixed(0) + "% vs current price" : "")) : "Not computable",
                style: { padding: "6px 10px", textAlign: "right", background: cellBg, border: isBase ? "2px solid var(--teal)" : "1px solid var(--rule)",
                  color: p != null ? "var(--ink-1)" : "var(--ink-3)", fontWeight: isBase ? 700 : 400, cursor: p != null ? "help" : "default" }
              }, fmtShare(p));
            })
          )))
        )
      ),
      h("div", { style: { ...UI.caption, marginTop: 8 } }, "Highlighted cell = current Base scenario (100% / 100%). " +
        // The shading is upside against today's price, not the sign of the
        // value — without saying so, a grid of positive values all shaded red
        // (because all are below the price) read as a colouring bug.
        (gridData.currentPrice ? "Shading is fair value vs today's price (" + fmtShare(gridData.currentPrice) + "): green above +20%, amber within -5% to +20%, red below -5%. Hover a cell for its exact upside." : "Enter a current share price on the case to shade cells by upside.")),
      h(Explain, readPriceGrid(gridData.cells, gridData.currentPrice))
    ])
  );
}

// ── Binary Event: what probability is the market already pricing? ──────────
// A biotech trading into one binary readout is close enough to a two-outcome
// bet that today's value implies a probability exactly, with no model:
//   p = (current - fail) / (success - fail)
// The point isn't the number itself — it's the comparison. An edge exists when
// your own PoS differs from the one already in the price, not when you simply
// like the science.
//
// Lighter sibling of the full-case implied-PoS solver in Workspace/Portfolio,
// which binary-searches a whole DCF against market cap. That one is more
// complete and needs a built case; this is a three-number screen.
function BinaryEventTool({ cases, activeCase, updateCase }) {
  const h = React.createElement;
  const [current, setCurrent] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [fail, setFail] = React.useState("");
  const [yourPoS, setYourPoS] = React.useState("");
  const [unit, setUnit] = React.useState("perShare");
  // Per share only: the case's figures are per-share values.
  const bd = React.useMemo(() => caseBinaryDefaults(activeCase), [activeCase]);
  const perShare = unit === "perShare";
  const f1 = useCasePrefill(activeCase, perShare ? bd.price : "", current, setCurrent);
  const f2 = useCasePrefill(activeCase, perShare ? bd.success : "", success, setSuccess);
  const f3 = useCasePrefill(activeCase, perShare ? bd.fail : "", fail, setFail);
  const f4 = useCasePrefill(activeCase, bd.pos, yourPoS, setYourPoS);
  const beRef = React.useRef(null);

  const res = computeBinaryEventImpliedPoS({ currentValue: current, successValue: success, failValue: fail, yourPoSPct: yourPoS });
  const showing = current !== "" && success !== "" && fail !== "";
  const sym = unit === "perShare" ? "$" : "$";
  const suffix = unit === "marketCap" ? "M" : "";
  const fmt = v => sym + (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)) + suffix;

  const field = (label, value, onChange, placeholder, hint) => h("div", { style: { flex: "1 1 150px" } },
    h("div", { style: { ...UI.caption, marginBottom: 4 } }, label),
    h("input", { type: "number", "aria-label": label, value, placeholder, onChange: e => onChange(e.target.value),
      style: { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
    hint && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3, lineHeight: 1.4 } }, hint)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Binary event — implied probability"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? Where the three numbers come from' },
          h("div", { style: { lineHeight: 1.6 } }, "Today is just the current share price (or market cap — pick which with the selector). If it works is what you think the company is worth once the drug is approved and selling: your own fair value, or a comparable approved company's valuation. If it fails is the floor — usually net cash plus whatever the rest of the pipeline is worth, NOT zero, because a failed biotech still has a balance sheet. That failure number is where most of the error lives, and it is worth more thought than the upside: set it too high and the implied probability looks artificially low, making everything seem cheap. Your PoS is optional; leave it blank to just read what the market is pricing, or fill it in to see the gap between your view and the price."))),
      h("div", { style: UI.intro },
        "Given what it's worth if the trial works, what it's worth if it doesn't, and today's price, the probability the market is pricing follows exactly. The useful output is the gap between that and your own estimate."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 } },
        h("span", { style: UI.caption }, "Values are:"),
        h("select", { "aria-label": "Value units", value: unit, onChange: e => setUnit(e.target.value),
          style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "perShare" }, "per share"),
          h("option", { value: "marketCap" }, "market cap ($M)"))
      ),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
        field("Today", current, setCurrent, "e.g. 10", "what it costs now"),
        field("If it works", success, setSuccess, "e.g. 30", "your success-case value"),
        field("If it fails", fail, setFail, "e.g. 5", "cash/other assets left"),
        field("Your PoS (%)", yourPoS, setYourPoS, "e.g. 40", "optional — your own odds")
      ),
      h(CaseFilledNote, { activeCase, filled: [f1 && "today's price", f2 && "the value if it is approved", f3 && "the failure floor", f4 && "your odds of launch"] })
    ]),

    showing && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--warn)" } }, res.error)
    ]),

    showing && res.ok && h("div", { ref: beRef }, toolCard(h, [
      h("div", { style: { display: "flex", gap: 30, flexWrap: "wrap", marginBottom: 16 } },
        h("div", null,
          h("div", { style: UI.caption }, "Market-implied PoS"),
          h("div", { style: { fontSize: 34, fontFamily: "var(--mono)", fontWeight: 800, color: res.rangeFlag ? "var(--warn)" : "var(--teal)" } },
            res.impliedPoSPct.toFixed(1) + "%"),
          h("div", { style: UI.caption }, "also the breakeven — below this you lose money on average")),
        h("div", null,
          h("div", { style: UI.caption }, "Upside / downside"),
          h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, marginTop: 6 } },
            h("span", { style: { color: "var(--teal)" } }, "+" + res.upsidePct.toFixed(0) + "%"),
            h("span", { style: { color: "var(--ink-3)" } }, "  /  "),
            h("span", { style: { color: "var(--red)" } }, res.downsidePct.toFixed(0) + "%")),
          res.riskReward != null && h("div", { style: UI.caption },
            res.riskReward.toFixed(1) + ":1 reward-to-risk")),
        res.edgePoSPct != null && h("div", null,
          h("div", { style: UI.caption }, "Your edge"),
          h("div", { style: { fontSize: 34, fontFamily: "var(--mono)", fontWeight: 800, color: res.edgePoSPct > 0 ? "var(--green)" : res.edgePoSPct < 0 ? "var(--red)" : "var(--ink-2)" } },
            (res.edgePoSPct > 0 ? "+" : "") + res.edgePoSPct.toFixed(1) + "pts"),
          h("div", { style: UI.caption }, "your PoS vs. the market's"))
      ),

      // Probability bar — where the price sits between the two anchors.
      (() => {
        const clamped = Math.max(0, Math.min(1, res.impliedPoS));
        return h("div", { style: { marginBottom: 16 } },
          h("div", { style: { position: "relative", height: 22, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden" } },
            h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (clamped * 100) + "%", background: "var(--teal)", opacity: 0.4 } }),
            res.yourPoSPct != null && h("div", { title: "Your PoS: " + res.yourPoSPct + "%",
              style: { position: "absolute", left: Math.max(0, Math.min(100, res.yourPoSPct)) + "%", top: 0, bottom: 0, width: 3, background: "var(--amber)" } })
          ),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 4 } },
            h("span", null, "0% — fails ", fmt(res.fail)),
            h("span", null, "100% — works ", fmt(res.success))),
          res.yourPoSPct != null && h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--amber)", marginTop: 3 } },
            "amber line = your ", res.yourPoSPct, "% estimate")
        );
      })(),

      res.rangeFlag && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--warn-bg)", border: "1px solid var(--warn)", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6, marginBottom: 14 } },
        res.rangeFlag === "belowFailure"
          ? h("span", null, h("b", null, "Trading below your failure case. "),
              "The implied probability is negative, which can't be true — so one of your inputs is. Either the market disputes that " + fmt(res.fail) + " of value survives a failure (often the case when the cash burns down before liquidation), or it's genuinely mispriced. Check the failure floor before treating this as free money.")
          : h("span", null, h("b", null, "Trading above your success case. "),
              "The implied probability exceeds 100%, so the market is paying for more than this single readout — another asset, a platform, or a takeout premium your two anchors don't capture. The binary frame is too narrow here.")),

      res.expectedValue == null && !res.rangeFlag && h(Explain, readBinaryImplied(res.impliedPoSPct)),
      res.expectedValue != null && h("div", { style: { padding: "12px 14px", borderRadius: 8, lineHeight: 1.65, fontFamily: "var(--sans)", fontSize: 12,
          background: res.evVsCurrentPct > 0 ? "var(--green-bg)" : "var(--red-bg)", border: "1px solid " + (res.evVsCurrentPct > 0 ? "var(--green)" : "var(--red)"), color: "var(--ink-1)" } },
        h("b", { style: { color: res.evVsCurrentPct > 0 ? "var(--green)" : "var(--red)" } },
          "Expected value at your " + res.yourPoSPct + "% : " + fmt(res.expectedValue) + " "),
        res.evVsCurrentPct > 0
          ? "— " + res.evVsCurrentPct.toFixed(0) + "% above today's " + fmt(res.current) + ". You're more optimistic than the market by " + res.edgePoSPct.toFixed(1) + " points; that difference is the whole position, so it's worth asking what the market knows that you don't."
          : "— " + Math.abs(res.evVsCurrentPct).toFixed(0) + "% below today's " + fmt(res.current) + ". On your own odds this is priced above fair value, which is a reason to wait rather than to revise the odds upward to justify it."),

      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "When the binary frame stops holding" },
          h("div", { style: { lineHeight: 1.6 } },
            "This treats the readout as the only thing that matters — exactly true for a single-asset company, progressively less true otherwise. A pipeline, a partner, or a cash-rich balance sheet all put a floor under failure and blur the binary. And the implied probability is only as good as the two values you anchored it with: it is arithmetic on your assumptions, not an independent read on the market.")))
    ])),

    h(OptionsMoveCard, { activeCase, updateCase, price: current, success, fail, yourPoS, impliedPoS: showing && res.ok ? res.impliedPoS : null })
  );
}

// ── Fully Diluted Market Cap calculator ──
function FdmcTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [mode, setMode] = React.useState("simple");
  const [companyName, setCompanyName] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [pullError, setPullError] = React.useState(null);
  const [pullResult, setPullResult] = React.useState(null);
  const [fields, setFields] = React.useState({ currentPrice: "", dilutedSharesSimple: "", basicShares: "", opts: "", optK: "", war: "", warK: "", convFace: "", convPrice: "" });
  const [importCaseId, setImportCaseId] = useActiveCaseId(activeCase);
  const [exportCaseId, setExportCaseId] = useActiveCaseId(activeCase);
  const [exportMsg, setExportMsg] = React.useState(null);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;
  const setF = (patch) => setFields(prev => ({ ...prev, ...patch }));

  const pullFromEdgar = async () => {
    if (!companyName.trim()) { setPullError("Enter a company name or ticker first."); return; }
    if (!isDesktop) { setPullError("EDGAR pull requires the desktop app — enter figures manually below instead."); return; }
    setPulling(true); setPullError(null);
    const r = await pullEdgarFinancials(companyName.trim(), false);
    if (!r.ok) { setPullError(r.error); setPullResult(null); }
    else {
      setPullResult(r);
      setF({
        basicShares: r.basicShares != null ? String(r.basicShares) : fields.basicShares,
        // A fully diluted count, not EDGAR's EPS weighted average (see edgarFullyDilutedShares).
        dilutedSharesSimple: (() => { const fd = edgarFullyDilutedShares(r, fields.currentPrice); return fd ? String(fd.shares) : fields.dilutedSharesSimple; })(),
        opts: r.options && r.options.count != null ? String(r.options.count) : fields.opts,
        optK: r.options && r.options.avgStrike != null ? String(r.options.avgStrike) : fields.optK,
        war: r.warrants && r.warrants.count != null ? String(r.warrants.count) : fields.war,
        warK: r.warrants && r.warrants.avgStrike != null ? String(r.warrants.avgStrike) : fields.warK,
        convFace: r.convertibleFace != null ? String(r.convertibleFace) : fields.convFace
      });
    }
    setPulling(false);
  };

  const importFromCase = () => {
    const c = cases.find(x => x.id === importCaseId);
    if (!c) return;
    const cap = c.capitalStructure || {};
    setF({
      currentPrice: c.currentPrice || "",
      dilutedSharesSimple: cap.dilutedSharesSimple || "",
      basicShares: cap.basicShares || "",
      opts: cap.opts || "", optK: cap.optK || "", war: cap.war || "", warK: cap.warK || "",
      convFace: cap.convFace || "", convPrice: cap.convPrice || ""
    });
    if (cap.mode) setMode(cap.mode);
  };

  // Tuned to the open case: its capital structure loads when the case opens
  // or changes (edit freely afterwards; switching cases reloads).
  React.useEffect(() => { if (importCaseId) importFromCase(); }, [importCaseId]);

  const exportToCase = () => {
    const c = cases.find(x => x.id === exportCaseId);
    if (!c) return;
    const patch = { mode, dilutedSharesSimple: fields.dilutedSharesSimple, basicShares: fields.basicShares,
      opts: fields.opts, optK: fields.optK, war: fields.war, warK: fields.warK, convFace: fields.convFace, convPrice: fields.convPrice };
    updateCase({
      ...c, currentPrice: fields.currentPrice || c.currentPrice, capitalStructure: { ...(c.capitalStructure || {}), ...patch },
      programs: appendEdgarEvidenceToPrograms(c.programs, pullResult, "Diluted Market Cap's “Pull from EDGAR”"),
      updatedAt: Date.now()
    });
    setExportMsg("Exported to \"" + c.name + "\"");
  };

  const capResult = computeCapitalStructure({ mode, currentPrice: fields.currentPrice, dilutedSharesSimple: fields.dilutedSharesSimple,
    basicShares: fields.basicShares, opts: fields.opts, optK: fields.optK, war: fields.war, warK: fields.warK, convFace: fields.convFace, convPrice: fields.convPrice, cash: "0", debt: "0" });
  const price = Number(fields.currentPrice) || 0;
  const fdmc = price > 0 ? capResult.dilutedShares * price : null;

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Fully diluted market cap"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? Why diluted shares matter more than the headline count' },
          h("div", { style: { lineHeight: 1.6 } }, 'The share count quoted on most finance sites is BASIC — it excludes options, warrants and convertible notes that turn into stock the moment the price rises. For a biotech that is exactly when they convert, so the basic count flatters the company precisely in the scenario you are underwriting. This applies the treasury-stock method (options and warrants raise cash at their strike, which buys back some shares, so only the net dilution counts) and the if-converted method for notes. Simple mode wants one already-diluted number; Detailed mode builds it up from the pieces, which is worth doing when the option strike sits near the current price. Cash and debt then bridge enterprise value to equity value.'))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12 } }, "Standalone — a quick gut-check on what a company is worth on a fully diluted basis, independent of any DCF. Build it up here, then push it into a case if you decide to model that company."),

      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h("input", { type: "text", value: companyName, placeholder: "Company name or ticker", "aria-label": "Company name or ticker", onChange: e => setCompanyName(e.target.value),
          style: { flex: "1 1 200px", padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
        h("button", { onClick: pullFromEdgar, disabled: pulling,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: pulling ? "default" : "pointer" } }, pulling ? "Pulling…" : "Pull from EDGAR"),
        h("span", { style: UI.caption }, "or"),
        h(CasePicker, { cases, selectedId: importCaseId, onChange: setImportCaseId }),
        h("button", { onClick: importFromCase, disabled: !importCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: importCaseId ? "pointer" : "default", opacity: importCaseId ? 1 : 0.5 } }, "← Import from case")
      ),
      pullError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, pullError),
      pullResult && mode === "detailed" && (pullResult.options || pullResult.warrants) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } },
        pullResult.options && pullResult.options.count != null && !pullResult.options.priceFound && "Options strike price wasn't tagged in XBRL — check the filing's own equity note. ",
        pullResult.warrants && pullResult.warrants.count != null && !pullResult.warrants.priceFound && "Warrants strike price wasn't tagged in XBRL — check the filing's own equity note."
      ),

      h("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
        [["simple","Simple"],["detailed","Detailed"]].map(([id,lbl]) => h("button", { key: id, onClick: () => setMode(id),
          style: { padding: "5px 12px", borderRadius: 7, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11,
            background: mode === id ? "var(--teal-bg)" : "transparent", color: mode === id ? "var(--teal)" : "var(--ink-2)", fontWeight: mode === id ? 700 : 400 } }, lbl))
      ),

      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 } },
        h(BenchField, { label: "Current price", value: fields.currentPrice, onChange: v => setF({ currentPrice: v }), suffix: "$" }),
        mode === "simple"
          ? h(BenchField, { label: "Fully diluted shares outstanding", value: fields.dilutedSharesSimple, onChange: v => setF({ dilutedSharesSimple: v }) })
          : h(React.Fragment, null,
              h(BenchField, { label: "Basic shares outstanding", value: fields.basicShares, onChange: v => setF({ basicShares: v }) }),
              h(BenchField, { label: "Options outstanding", value: fields.opts, onChange: v => setF({ opts: v }) }),
              h(BenchField, { label: "Options avg strike", value: fields.optK, onChange: v => setF({ optK: v }), suffix: "$" }),
              h(BenchField, { label: "Warrants outstanding", value: fields.war, onChange: v => setF({ war: v }) }),
              h(BenchField, { label: "Warrants strike", value: fields.warK, onChange: v => setF({ warK: v }), suffix: "$" }),
              h(MillionsField, { label: "Convertible face value", value: fields.convFace, onChange: v => setF({ convFace: v }) }),
              h(BenchField, { label: "Conversion price", value: fields.convPrice, onChange: v => setF({ convPrice: v }), suffix: "$" })
            )
      ),

      h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 12 } },
        h("div", null, h("div", { style: UI.caption }, "Diluted shares"),
          h("div", { style: UI.stat }, fmtNum(capResult.dilutedShares))),
        mode === "detailed" && h("div", null, h("div", { style: UI.caption }, "From dilutive securities"),
          h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)" } }, "+" + fmtNum(capResult.optionShares + capResult.warrantShares + capResult.convertShares))),
        h("div", null, h("div", { style: UI.caption }, "Fully diluted market cap"),
          h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--teal)" } }, fdmc != null ? fmtMoney(fdmc) : "—"))
      ),

      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
        h("button", { onClick: exportToCase, disabled: !exportCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export share count to case →"),
        exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
      )
    ])
  );
}

// ── What the options price (October 2026) ──────────────────────────────────
// Typed in from any options chain, never fetched: the straddle, or implied
// volatility and days to expiry. Compared with the move the case's own
// readout outcomes imply (clear win, modest win, miss), else with this tool's
// win and fail values at your odds. Stored on the open case for the memo.
function OptionsMoveCard({ activeCase, updateCase, price, success, fail, yourPoS, impliedPoS }) {
  const h = React.createElement;
  const saved = (activeCase && activeCase.optionsMove) || {};
  const [o, setO] = React.useState({ straddle: saved.straddle || "", iv: saved.iv || "", days: saved.days || "" });
  React.useEffect(() => { const sv = (activeCase && activeCase.optionsMove) || {}; setO({ straddle: sv.straddle || "", iv: sv.iv || "", days: sv.days || "" }); }, [activeCase && activeCase.id]);
  const set = patch => {
    const next = { ...o, ...patch };
    setO(next);
    if (activeCase && updateCase) updateCase({ ...activeCase, optionsMove: { ...next, asOf: localDateStamp() }, updatedAt: Date.now() });
  };
  const P = numOr(price, 0) > 0 ? Number(price) : (activeCase ? numOr(activeCase.currentPrice, 0) : 0);
  const om = optionsImpliedMove(o, P);
  let model = null, modelNote = "";
  if (activeCase && activeCase.programs && activeCase.programs.length === 1) {
    try {
      const dr = activeCase.discountRatePct !== "" && activeCase.discountRatePct != null ? Number(activeCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      const tv = activeCase.terminalValue || { enabled: false };
      const rs = computeReadoutScenarios(activeCase, dr, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
      if (rs) { model = modelImpliedMove(P, rs.rows.map(r => ({ prob: r.prob, value: r.value }))); modelNote = "the case's readout outcomes (Scenarios → Before the next readout)"; }
    } catch (e) { model = null; }
  }
  if (!model && numOr(success, NaN) > 0 && isFinite(numOr(fail, NaN))) {
    const p = numOr(yourPoS, NaN) >= 0 ? Number(yourPoS) / 100 : impliedPoS;
    if (p != null && isFinite(p)) { model = modelImpliedMove(P, [{ prob: Math.max(0, Math.min(1, p)), value: Number(success) }, { prob: 1 - Math.max(0, Math.min(1, p)), value: Number(fail) }]); modelNote = "the win and fail values above at " + (numOr(yourPoS, NaN) >= 0 ? "your" : "the price-implied") + " odds"; }
  }
  const read = om && model ? readImpliedMove(om.pct, model.pct) : null;
  const inp = (label, key, ph) => h("div", { style: { flex: "1 1 140px" } },
    h("div", { style: { ...UI.caption, marginBottom: 4 } }, label),
    h("input", { type: "number", "aria-label": label, value: o[key], placeholder: ph, onChange: e => set({ [key]: e.target.value }),
      style: { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }));
  return toolCard(h, [
    toolLabel(h, "What the options price"),
    h("div", { style: UI.intro }, "From any options chain: the at-the-money straddle for the first expiry after the readout, or its implied volatility and the days to that expiry. The straddle's price is about the move the market expects either way."),
    h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
      inp("Straddle price ($)", "straddle", "e.g. 6.50"),
      inp("Implied volatility (%)", "iv", "e.g. 140"),
      inp("Days to expiry", "days", "e.g. 45")),
    !om && h("div", { style: { ...UI.caption, marginTop: 8 } }, "Enter the straddle, or the implied volatility and days to expiry. Nothing is fetched."),
    om && h("div", { className: "options-move", style: { marginTop: 12, display: "flex", gap: 30, flexWrap: "wrap" } },
      h("div", null, h("div", { style: UI.caption }, "Options price"),
        h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, "±" + om.pct.toFixed(0) + "%"),
        h("div", { style: UI.caption }, om.basis === "straddle" ? "straddle ÷ price" : "σ√t × √(2/π)")),
      model && h("div", null, h("div", { style: UI.caption }, "Your model"),
        h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, "±" + model.pct.toFixed(0) + "%"),
        h("div", { style: UI.caption }, (model.upPct != null ? "+" + model.upPct.toFixed(0) + "% (" + Math.round(model.upProb * 100) + "%)" : "") + (model.upPct != null && model.downPct != null ? " · " : "") + (model.downPct != null ? model.downPct.toFixed(0) + "% (" + Math.round(model.downProb * 100) + "%)" : "")))),
    om && model && h("div", { style: { ...UI.caption, marginTop: 6 } }, "Your side is from " + modelNote + ". The options price the move to expiry, which includes ordinary trading as well as the event."),
    read && h(Explain, read),
    activeCase && om && h("div", { style: { ...UI.caption, marginTop: 6 } }, "Saved to " + caseDisplayName(activeCase) + " for its decision memo.")
  ]);
}
