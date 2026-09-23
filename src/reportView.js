// ════════════════════════════════════════════════════════════════════════════
// ReportView — a dedicated, print-friendly layout for PDF export. Always
// rendered in light theme regardless of the app's current theme (reports
// print better light, and read better dropped into a write-up). Uses the same
// computeCaseValuation pipeline as the interactive workspace, so the numbers
// in the PDF are guaranteed to match what you saw on screen.
// ════════════════════════════════════════════════════════════════════════════
// ── Report section registry ────────────────────────────────────────────────
// Every section of the report, in the order it renders, so one list drives
// both what gets rendered and what the picker offers. Adding a section means
// adding it here and guarding it with inc() — the picker then gets it for free.
//
// defaultOn encodes an existing distinction rather than inventing one: the
// core valuation sections have always been part of every report, while the
// three appendices are opt-in from their own tool (Sensitivity, Peak Sales
// Comps, Cash Runway) and stay off until asked for. Keeping their ids identical
// to the reportInclusions keys those toggles already write means the Tools-tab
// checkboxes and this picker are two views of the same stored state, not two
// competing ones.
const REPORT_SECTIONS = [
  { id: "summary",      label: "Valuation summary",        defaultOn: true,  group: "Core" },
  { id: "programs",     label: "Programs & assumptions",   defaultOn: true,  group: "Core" },
  { id: "revenueChart", label: "Revenue projection chart", defaultOn: true,  group: "Charts" },
  { id: "cashFlow",     label: "Risk-adjusted cash flow",  defaultOn: true,  group: "Charts" },
  { id: "sotp",         label: "Sum-of-the-parts",         defaultOn: true,  group: "Core" },
  { id: "bridge",       label: "EV → per-share bridge",    defaultOn: true,  group: "Core" },
  { id: "priceVsValue", label: "Price vs. fair value",     defaultOn: true,  group: "Core" },
  { id: "sensitivity",  label: "Sensitivity tornado",      defaultOn: false, group: "Appendices" },
  { id: "peakSalesComps", label: "Peak sales comps",       defaultOn: false, group: "Appendices" },
  { id: "cashRunway",   label: "Cash runway chart",        defaultOn: false, group: "Appendices" },
  // Sections added with "+ Report" from anywhere in the app. Defaults ON
  // because adding one is an explicit act. The id stays "pinned" so existing
  // cases keep their saved choice; which added sections appear, and in what
  // order, is chosen per item in the Sections panel.
  { id: "pinned",       label: "Added sections",           defaultOn: true,  group: "Appendices" }
];

function ReportView({ theCase, onBack, updateCase }) {
  const h = React.createElement;
  const [exporting, setExporting] = React.useState(false);
  const [reportDark, setReportDark] = React.useState(false); // reports default to light — better for printing/embedding in a write-up
  const [exportMsg, setExportMsg] = React.useState(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Undefined means "never explicitly chosen", which falls back to the
  // section's own default — so a case saved before the picker existed still
  // produces exactly the report it produced before.
  const inclusions = theCase.reportInclusions || {};
  const inc = (id) => {
    const s = REPORT_SECTIONS.find(x => x.id === id);
    const stored = inclusions[id];
    return stored != null ? !!stored : !!(s && s.defaultOn);
  };
  const setSections = (patch) => {
    if (!updateCase) return;
    updateCase({ ...theCase, reportInclusions: { ...inclusions, ...patch }, updatedAt: Date.now() });
  };
  const setAll = (val) => {
    const patch = {};
    REPORT_SECTIONS.forEach(s => { patch[s.id] = val; });
    setSections(patch);
  };
  const setPreset = (ids) => {
    const patch = {};
    REPORT_SECTIONS.forEach(s => { patch[s.id] = ids.indexOf(s.id) !== -1; });
    setSections(patch);
  };
  const includedCount = REPORT_SECTIONS.filter(s => inc(s.id)).length;

  let scenarioResults = null, error = null;
  const valMethod = theCase.valuationMethod || "dcf";
  const multipleAssumptions = theCase.multipleAssumptions || { bear: "3", base: "3", bull: "3" };
  try {
    const drBase = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    const tv = theCase.terminalValue || { enabled: false, growthPct: "0" };
    // Resolved through getEffectiveScenarioPreset (case-level Bear/Bull
    // overrides + the Base-PoS adjustment), not the raw SCENARIO_PRESETS —
    // this used to read the raw preset directly, silently ignoring any
    // per-case scenario customization so the PDF could show different
    // numbers than what the Workspace screen actually displayed.
    scenarioResults = ["bear", "base", "bull"].map(key => {
      const preset = getEffectiveScenarioPreset(theCase, key);
      return {
        key, preset,
        result: valMethod === "multiple"
          ? computeSimpleMultipleValuation(theCase, preset, key, numOr(multipleAssumptions[key], 3), drBase)
          : computeCaseValuation(theCase, preset, key, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple })
      };
    });
  } catch (e) { error = e.message; }

  const baseResult = scenarioResults && scenarioResults.find(s => s.key === "base").result;

  const rpt = reportDark
    ? { bg: "#181B20", ink1: "#E5E2DA", ink2: "#A19C8E", ink3: "#6E695C", rule: "#2C3038", teal: "#6FAF9A", amber: "#C9A66B", red: "#C17A6B", surface2: "#20242B" }
    : { bg: "#FFFFFF", ink1: "#26241F", ink2: "#5C574A", ink3: "#8F897A", rule: "#DDD7C9", teal: "#4A8B78", amber: "#A6793D", red: "#B0574A", surface2: "#F5F3EC" };
  const revenueSeries = (baseResult && baseResult.calendar) ? [{ name: "Company revenue", color: rpt.teal, points: baseResult.calendar.map(c => ({ v: c.revenue, label: c.calendarYear })) }] : [];
  const fcfSeries = (baseResult && baseResult.calendar) ? [{ name: "Risk-adjusted FCF", color: rpt.amber, points: baseResult.calendar.map(c => ({ v: c.riskAdjFCF, label: c.calendarYear })) }] : [];

  const doExport = async () => {
    if (!window.electronAPI || !window.electronAPI.exportPDF) { setExportMsg("PDF export requires the desktop app."); return; }
    setExporting(true); setExportMsg(null);
    const fileName = (theCase.name || "RxNPV-Report").replace(/[^a-z0-9\- ]/gi, "").trim() + ".pdf";
    const r = await window.electronAPI.exportPDF(fileName);
    setExporting(false);
    if (r.canceled) return;
    setExportMsg(r.ok ? "Saved to " + r.filePath : "Export failed: " + r.error);
  };

  const doExportCSV = () => {
    const baseFileName = (theCase.name || "RxNPV-Report").replace(/[^a-z0-9\- ]/gi, "").trim();
    // Sheet 1 spirit: scenario comparison
    const scenarioRows = (scenarioResults || []).map(s => [s.preset.label, s.result.npvResult.npv, s.result.equity.equityValue, s.result.equity.perShare]);
    downloadCSV(baseFileName + "-scenarios.csv", ["Scenario", valMethod === "multiple" ? "NPV (Simple Multiple)" : "rNPV", "Equity Value", "Per Share"], scenarioRows);
    // Sheet 2 spirit: year-by-year cash flow (DCF mode only — Simple Multiple has no calendar)
    if (baseResult && baseResult.calendar) {
      const cfRows = baseResult.calendar.map(c => [c.calendarYear, c.revenue, c.riskAdjProductContribution, c.riskAdjRnDCost, c.corporateGA, c.riskAdjFCF]);
      downloadCSV(baseFileName + "-cashflow.csv", ["Year", "Revenue", "Risk-Adj Product Contribution", "Risk-Adj R&D Cost", "Corporate G&A", "Risk-Adj FCF"], cfRows);
    }
  };

  const cardStyle = { border: "1px solid " + rpt.rule, borderRadius: 8, padding: "16px 18px", marginBottom: 16, breakInside: "avoid" };

  return h("div", { style: { minHeight: "100vh", background: rpt.bg, color: rpt.ink1, fontFamily: "'IBM Plex Sans', sans-serif", padding: "0" } },
    // Toolbar — hidden in the actual PDF via no-print class
    h("div", { className: "no-print", style: { position: "sticky", top: 0, background: rpt.surface2, borderBottom: "1px solid " + rpt.rule, padding: "10px 20px", display: "flex", gap: 10, alignItems: "center", zIndex: 10 } },
      h("button", { onClick: onBack, style: { padding: "6px 14px", borderRadius: 6, border: "1px solid " + rpt.rule, background: "transparent", color: rpt.ink2, fontFamily: "monospace", fontSize: 12, cursor: "pointer" } }, "← Back to Workspace"),
      h("button", { onClick: () => setReportDark(!reportDark), style: { padding: "6px 14px", borderRadius: 6, border: "1px solid " + rpt.rule, background: "transparent", color: rpt.ink2, fontFamily: "monospace", fontSize: 12, cursor: "pointer" } }, reportDark ? "☀ Light report" : "☾ Dark report"),
      h("button", { onClick: doExport, disabled: exporting,
        style: { padding: "6px 14px", borderRadius: 6, border: "1px solid " + rpt.teal, background: rpt.teal, color: "#fff", fontFamily: "monospace", fontSize: 12, fontWeight: 700, cursor: exporting ? "default" : "pointer" }
      }, exporting ? "Exporting…" : "Export as PDF"),
      h("button", { onClick: doExportCSV,
        style: { padding: "6px 14px", borderRadius: 6, border: "1px solid " + rpt.rule, background: "transparent", color: rpt.ink2, fontFamily: "monospace", fontSize: 12, cursor: "pointer" }
      }, "Export CSV"),
      // Section picker — the report updates live as sections are toggled, so
      // what's on screen is exactly what the PDF will contain. No separate
      // preview step to drift out of sync with the export.
      updateCase && h("button", {
        onClick: () => setPickerOpen(!pickerOpen),
        style: { padding: "6px 14px", borderRadius: 6, border: "1px solid " + (pickerOpen ? rpt.teal : rpt.rule), background: "transparent", color: pickerOpen ? rpt.teal : rpt.ink2, fontFamily: "monospace", fontSize: 12, cursor: "pointer" }
      }, "Sections (" + includedCount + "/" + REPORT_SECTIONS.length + ") " + (pickerOpen ? "▲" : "▼")),
      exportMsg && h("span", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.ink2 } }, exportMsg)
    ),

    // Picker panel
    updateCase && pickerOpen && h("div", { className: "no-print", style: { position: "sticky", top: 47, zIndex: 9, background: rpt.surface2, borderBottom: "1px solid " + rpt.rule, padding: "14px 20px" } },
      h("div", { style: { maxWidth: 800, margin: "0 auto" } },
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 } },
          h("span", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.ink3, textTransform: "uppercase", letterSpacing: "0.05em" } }, "Include in report"),
          h("div", { style: { flex: 1 } }),
          [["Everything", () => setAll(true)],
           ["Summary only", () => setPreset(["summary", "priceVsValue"])],
           ["Charts only", () => setPreset(["revenueChart", "cashFlow", "sensitivity", "cashRunway", "peakSalesComps", "pinned"])],
           ["Clear", () => setAll(false)]
          ].map(([label, fn]) => h("button", { key: label, onClick: fn,
            style: { padding: "4px 10px", borderRadius: 5, border: "1px solid " + rpt.rule, background: "transparent", color: rpt.ink2, fontFamily: "monospace", fontSize: 10, cursor: "pointer" } }, label))
        ),
        ["Core", "Charts", "Appendices"].map(group => {
          const items = REPORT_SECTIONS.filter(s => s.group === group);
          if (!items.length) return null;
          return h("div", { key: group, style: { marginBottom: 10 } },
            h("div", { style: { fontSize: 9, fontFamily: "monospace", color: rpt.ink3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 } }, group),
            h("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" } },
              items.map(s => h("label", { key: s.id,
                style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "monospace", color: inc(s.id) ? rpt.ink1 : rpt.ink3, cursor: "pointer" } },
                h("input", { type: "checkbox", checked: inc(s.id), onChange: () => setSections({ [s.id]: !inc(s.id) }) }),
                s.label))
            ));
        }),
        includedCount === 0 && h("div", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.amber, marginTop: 4 } },
          "Nothing selected — the report is empty. Pick at least one section, or use Everything."),
        h("div", { style: { fontSize: 10, fontFamily: "monospace", color: rpt.ink3, marginTop: 8, lineHeight: 1.6 } },
          "Sections that don't apply to this case stay hidden even when ticked — Sum-of-the-parts needs more than one program, and the year-by-year charts need DCF mode rather than Simple Multiple."),
        // Added-section management: include or leave out each one, put them
        // in order, remove them. Lives here rather than in the report body
        // because these are editing actions, not part of the document.
        (() => {
          const pins = pinnedResultsOf(theCase);
          const save = next => updateCase({ ...theCase, pinnedResults: next, updatedAt: Date.now() });
          const move = (i, by) => { const next = pins.slice(); const [x] = next.splice(i, 1); next.splice(i + by, 0, x); save(next); };
          const arrow = (label, tip, disabled, onClick) => h("button", { type: "button", title: tip, "aria-label": tip, disabled, onClick,
            style: { padding: "1px 6px", borderRadius: 4, border: "1px solid " + rpt.rule, background: "transparent", color: disabled ? rpt.rule : rpt.ink2, fontFamily: "monospace", fontSize: 10, cursor: disabled ? "default" : "pointer" } }, label);
          return h("div", { id: "report-added-picker", style: { marginTop: 12, paddingTop: 10, borderTop: "1px solid " + rpt.rule } },
            h("div", { style: { fontSize: 9, fontFamily: "monospace", color: rpt.ink3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 } },
              "Added sections (" + pins.filter(p => p.included !== false).length + " of " + pins.length + " included · up to " + PINNED_MAX_PER_CASE_V2 + ")"),
            !pins.length && h("div", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.ink3, lineHeight: 1.6 } },
              "None yet. Every section in Tools, Simulation, the Reference Sheet, Portfolio and the Workspace has a “+ Report” button — each one you click lands here, and you choose and order them."),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
              pins.map((pin, i) => h("div", { key: pin.id || i, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "monospace", color: pin.included === false ? rpt.ink3 : rpt.ink2 } },
                h("input", { type: "checkbox", checked: pin.included !== false, "aria-label": "Include " + (pin.title || "this section"),
                  onChange: () => save(pins.map(x => x === pin ? { ...x, included: x.included === false } : x)) }),
                h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: pin.included === false ? "line-through" : "none" } },
                  pin.title, pin.source ? h("span", { style: { color: rpt.ink3 } }, " · " + pin.source) : null),
                arrow("↑", "Move up", i === 0, () => move(i, -1)),
                arrow("↓", "Move down", i === pins.length - 1, () => move(i, 1)),
                h(ConfirmXButton, { onConfirm: () => save(pins.filter(x => x !== pin)),
                  title: "Remove this section from the report", style: { padding: "2px 8px", fontSize: 10 } })
              ))
            ));
        })()
      )
    ),

    h("div", { style: { maxWidth: 800, margin: "0 auto", padding: "32px 40px" } },
      // Header
      h("div", { style: { borderBottom: "2px solid " + rpt.ink1, paddingBottom: 14, marginBottom: 20 } },
        h("div", { style: { fontSize: 26, fontWeight: 700, fontFamily: "Georgia, serif" } }, theCase.name || "Untitled Case", theCase.ticker ? h("span", { style: { color: rpt.ink3, fontWeight: 400, marginLeft: 10 } }, theCase.ticker) : null),
        h("div", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.ink3, marginTop: 4 } },
          "RxNPV valuation report — generated " + new Date().toISOString().slice(0,10) + " — " + (valMethod === "multiple" ? "Simple Multiple method" : "DCF method"))
      ),

      error ? h("div", { style: { color: rpt.red } }, "Could not compute valuation: " + error) : h("div", null,
        // Executive summary
        inc("summary") && h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Valuation Summary"),
          h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
            scenarioResults.map(s => h("div", { key: s.key, style: { flex: "1 1 150px" } },
              h("div", { style: { fontSize: 10, fontFamily: "monospace", color: rpt.ink3, textTransform: "uppercase" } }, s.preset.label),
              h("div", { style: { fontSize: 24, fontFamily: "monospace", fontWeight: 700, color: s.key === "base" ? rpt.teal : rpt.ink2 } },
                fmtShare(s.result.equity.perShare)),
              h("div", { style: { fontSize: 10, fontFamily: "monospace", color: rpt.ink3 } }, (valMethod === "multiple" ? "NPV (Simple Multiple) " : "rNPV ") + fmtMoney(s.result.npvResult.npv))
            ))
          )
        ),

        // Key assumptions
        inc("programs") && h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Programs & Key Assumptions"),
          h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
            h("thead", null, h("tr", null, ["Program","Phase","Area","Mode","Peak Rev.","Launch Yr"].map(hd => h("th", { key: hd, style: { textAlign: "left", padding: "5px 8px", borderBottom: "1px solid " + rpt.rule, color: rpt.ink3, fontSize: 10, textTransform: "uppercase" } }, hd)))),
            h("tbody", null, theCase.programs.map((p, i) => {
              const pv = baseResult ? baseResult.programVals.find(pv => pv.id === p.id) : null;
              return h("tr", { key: i, style: { borderBottom: "1px solid " + rpt.rule } },
                h("td", { style: { padding: "5px 8px" } }, p.drugName || p.name),
                h("td", { style: { padding: "5px 8px" } }, (p.currentPhase || "").replace("phase","Phase ")),
                h("td", { style: { padding: "5px 8px" } }, p.therapeuticArea),
                h("td", { style: { padding: "5px 8px" } }, p.revenueMode === "full" ? "Full" : "Quick"),
                h("td", { style: { padding: "5px 8px" } }, pv ? fmtMoney(pv.peakRevenue) : "—"),
                h("td", { style: { padding: "5px 8px" } }, pv ? pv.launchYearOffset : "—")
              );
            }))
          ),
          h("div", { style: { fontSize: 11, fontFamily: "monospace", color: rpt.ink3, marginTop: 10 } },
            "Discount rate: " + (theCase.discountRatePct || "15") + "% · Diluted shares: " + (theCase.capitalStructure ? fmtNum(computeCapitalStructure(theCase.capitalStructure).dilutedShares) : "—"))
        ),

        // Revenue chart (DCF-only — Simple Multiple doesn't compute year-by-year cash flows)
        inc("revenueChart") && (valMethod === "dcf" ? h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Company Revenue Projection (Base Case)"),
          h(RevenueChart, { series: revenueSeries, height: 200 })
        ) : h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Company Revenue Projection"),
          h("div", { style: { fontSize: 11, color: rpt.ink3 } }, "Not shown — this case uses Simple Multiple valuation, which doesn't build a year-by-year revenue projection. Switch to DCF mode to see this chart.")
        )),

        // Cash flow chart (DCF-only, same reason)
        inc("cashFlow") && valMethod === "dcf" ? h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Risk-Adjusted Cash Flow (Base Case)"),
          h(RevenueChart, { series: fcfSeries, height: 180 })
        ) : null,

        // Sum-of-the-Parts — multi-program, DCF-mode only, same rule as the
        // Workspace. This is the section that shows how each program blends
        // into the total, so it needs to be in the exported report, not just
        // on-screen.
        inc("sotp") && theCase.programs.length > 1 && valMethod === "dcf" && (() => {
          let sotp = null;
          try {
            const drBase = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
            const tv = theCase.terminalValue || { enabled: false, growthPct: "0" };
            sotp = computeSOTPBreakdown(theCase, getEffectiveScenarioPreset(theCase, "base"), "base", drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
          } catch (e) { return null; }
          if (!sotp) return null;
          return h("div", { style: cardStyle },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Sum-of-the-Parts (Base Case)"),
            h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
              h("tbody", null,
                sotp.programBreakdown.map((p, i) => h("tr", { key: i, style: { borderBottom: "1px solid " + rpt.rule } },
                  h("td", { style: { padding: "5px 8px" } }, p.name),
                  h("td", { style: { padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: p.npv >= 0 ? rpt.teal : rpt.red } }, fmtMoney(p.npv)))),
                h("tr", { style: { borderBottom: "1px solid " + rpt.rule } },
                  h("td", { style: { padding: "5px 8px", color: rpt.ink3 } }, "Corporate G&A (shared)"),
                  h("td", { style: { padding: "5px 8px", textAlign: "right", fontFamily: "monospace", color: rpt.red } }, fmtMoney(sotp.gaDrag))),
                h("tr", null,
                  h("td", { style: { padding: "5px 8px", fontWeight: 700 } }, "Total Enterprise Value"),
                  h("td", { style: { padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 } }, fmtMoney(sotp.sumOfParts)))
              )
            )
          );
        })(),

        // EV → Per-Share bridge — works in either valuation method, so its only
        // condition is whether it's been included.
        inc("bridge") && (() => {
          const baseR = scenarioResults.find(s => s.key === "base").result;
          const prvAdded = baseR.equity.prvValueAdded || 0;
          const partnershipAdded = baseR.equity.partnershipValueAdded || 0;
          const cap = theCase.capitalStructure || { mode: "simple" };
          const cash = Number(cap.cash) || 0, debt = Number(cap.debt) || 0;
          const rows = [
            ["Enterprise Value", fmtMoney(baseR.npvResult.npv)],
            prvAdded > 0 ? ["+ PRV (risk-adjusted)", fmtMoney(prvAdded)] : null,
            partnershipAdded > 0 ? ["+ Partnership (upfront + milestones)", fmtMoney(partnershipAdded)] : null,
            ["+ Cash", fmtMoney(cash)],
            ["- Debt", fmtMoney(debt)],
            ["= Equity Value", fmtMoney(baseR.equity.equityValue)],
            ["÷ Diluted shares", fmtNum(baseR.equity.dilutedShares)],
            ["= Per Share", fmtShare(baseR.equity.perShare)]
          ].filter(Boolean);
          return h("div", { style: cardStyle },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Enterprise Value → Per-Share Bridge (Base Case)"),
            h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
              h("tbody", null, rows.map((r, i) => h("tr", { key: i, style: { borderBottom: i < rows.length - 1 ? "1px solid " + rpt.rule : "none" } },
                h("td", { style: { padding: "5px 8px", fontWeight: r[0].startsWith("=") ? 700 : 400 } }, r[0]),
                h("td", { style: { padding: "5px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: r[0].startsWith("=") ? 700 : 400 } }, r[1])
              )))
            )
          );
        })(),

        // Current price vs. fair value (only if a current price is set)
        inc("priceVsValue") && theCase.currentPrice !== "" && theCase.currentPrice != null && h("div", { style: cardStyle },
          h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Current Price vs. Fair Value"),
          h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
            h("div", null, h("div", { style: { fontSize: 10, color: rpt.ink3 } }, "Current price"), h("div", { style: { fontSize: 16, fontWeight: 700 } }, fmtShare(Number(theCase.currentPrice)))),
            scenarioResults.map(s => {
              const fv = s.result.equity.perShare;
              // Same zero-price guard as the workspace panel — a report must
              // never render "+Infinity%" to whoever reads the exported PDF.
              const cp = Number(theCase.currentPrice);
              const upside = (fv != null && cp > 0) ? ((fv / cp) - 1) * 100 : null;
              return h("div", { key: s.key },
                h("div", { style: { fontSize: 10, color: rpt.ink3 } }, s.preset.label + " fair value"),
                h("div", { style: { fontSize: 16, fontWeight: 700 } }, fmtShare(fv), upside != null ? h("span", { style: { fontSize: 11, color: upside >= 0 ? rpt.teal : rpt.red, marginLeft: 6 } }, (upside >= 0 ? "+" : "") + upside.toFixed(0) + "%") : null)
              );
            })
          )
        ),

        // Optional appendices — only rendered when explicitly toggled on
        // from the corresponding Tool, via theCase.reportInclusions. Each
        // recomputes from the same shared functions the Tools views use
        // (computeSensitivityDrivers, computeForwardRunway) rather than a
        // second hand-written copy, so these numbers can't drift from what's
        // shown on-screen.
        inc("sensitivity") && (() => {
          const sens = computeSensitivityDrivers(theCase);
          if (sens.error || !sens.rows.length) return null;
          const maxSwing = Math.max(...sens.rows.map(r => r.swing), 1);
          return h("div", { style: cardStyle },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Sensitivity — Base fair value " + (sens.baseline != null ? fmtShare(sens.baseline) : "—")),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
              sens.rows.map((r, i) => h("div", { key: i },
                h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 } },
                  h("span", { style: { fontWeight: 700 } }, r.name),
                  h("span", { style: { color: rpt.ink3 } }, r.lo != null ? fmtShare(r.lo) + " — " + fmtShare(r.hi) : "—")),
                h("div", { style: { height: 7, borderRadius: 4, background: rpt.surface2, overflow: "hidden" } },
                  h("div", { style: { height: "100%", width: (maxSwing > 0 ? (r.swing / maxSwing) * 100 : 0) + "%", background: rpt.amber, borderRadius: 4 } }))
              ))
            )
          );
        })(),

        inc("peakSalesComps") && (() => {
          const ownDrugs = theCase.programs.map(p => {
            let peakB = null;
            try { peakB = getProgramRevenueResult(p, 25).peakTotalRevenue / 1e9; } catch (e) {}
            return peakB != null && peakB > 0 ? { drug: p.drugName || p.name, peakSalesB: peakB, _own: true } : null;
          }).filter(Boolean);
          if (!ownDrugs.length) return null;
          const allDrugs = [...PEAK_SALES_COMPS.drugs, ...loadCustomComps(CUSTOM_PEAKSALES_KEY)];
          // Shared selection logic with the in-app Peak Sales Comps chart —
          // same comps, same rank, rendered here with print-safe tokens.
          const sel = selectPeakSalesCompWindow(ownDrugs, allDrugs, 6);
          if (!sel) return null;
          const chartDrugs = sel.rows, maxB = sel.maxB;
          return h("div", { style: cardStyle },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Peak Sales — Where This Case Sits Among Real Comps"),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 3 } },
              chartDrugs.map((d, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8 } },
                h("div", { style: { width: 100, fontSize: 9, color: d._own ? rpt.amber : rpt.ink3, fontWeight: d._own ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 } }, d.drug),
                h("div", { style: { flex: 1, height: 11, borderRadius: 3, background: rpt.surface2, overflow: "hidden" } },
                  h("div", { style: { height: "100%", width: (d.peakSalesB / maxB) * 100 + "%", background: d._own ? rpt.amber : rpt.teal, borderRadius: 3 } })),
                h("div", { style: { width: 46, fontSize: 9, color: d._own ? rpt.amber : rpt.ink2, fontWeight: d._own ? 700 : 400, textAlign: "right", flexShrink: 0 } }, "$" + d.peakSalesB.toFixed(1) + "B")
              ))
            )
          );
        })(),

        // Sections added with "+ Report" from anywhere in the app, in the order
        // chosen in the Sections panel. Snapshots are real HTML, re-themed to
        // this page, so a section added in dark mode prints cleanly on a light
        // report. Older image pins still render as the images they are.
        inc("pinned") && (() => {
          const pins = pinnedResultsOf(theCase).filter(p => p.included !== false);
          if (!pins.length) return null;
          const imgs = pins.filter(p => p.kind !== "html");
          const mism = imgs.filter(p => p.theme && p.theme !== (reportDark ? "dark" : "light"));
          return h("div", { id: "report-added", style: { marginBottom: 16 } },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Added Sections"),
            h("div", { style: { fontSize: 11, color: rpt.ink3, marginBottom: 12 } },
              pins.length + " section" + (pins.length === 1 ? "" : "s") + " added from across the app.",
              updateCase && h("span", { className: "no-print" }, " Choose which appear, and their order, under Sections ▼.")),
            // An older image pin is pixels of the screen, so one taken in the
            // other theme cannot be re-coloured. Flagged rather than hidden.
            mism.length > 0 && h("div", { className: "no-print", style: { fontSize: 10, color: rpt.amber, marginBottom: 10, lineHeight: 1.5 } },
              "⚠ " + mism.length + " older image pin" + (mism.length === 1 ? " was" : "s were") + " captured in " + (reportDark ? "light" : "dark") +
              " mode and will print that way. Re-adding it with “+ Report” stores it as a section that follows this page’s theme."),
            pins.map((pin, i) => h("div", { key: pin.id || i, style: { ...cardStyle, pageBreakInside: "avoid" } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8 } },
                h("div", { style: { fontSize: 12, fontWeight: 700, color: rpt.ink1 } }, pin.title || "Section"),
                h("div", { style: { fontSize: 10, color: rpt.ink3, flexShrink: 0 } },
                  (pin.source ? pin.source + " · " : "") + (pin.capturedAt ? "captured " + new Date(pin.capturedAt).toLocaleDateString() : ""))),
              pin.note && h("div", { style: { fontSize: 11, color: rpt.ink2, marginBottom: 6, lineHeight: 1.5 } }, pin.note),
              pin.kind === "html"
                ? h(ReportSnapshot, { pin, dark: reportDark })
                : h("img", { src: pin.dataUrl, alt: pin.title || "Added section",
                    style: { width: "100%", maxWidth: (pin.width || 900) + "px", border: "1px solid " + rpt.rule, borderRadius: 6, display: "block" } })
            ))
          );
        })(),

        inc("cashRunway") && (() => {
          let fr = null;
          try { fr = computeForwardRunway(theCase); } catch (e) { return null; }
          if (!fr) return null;
          return h("div", { style: cardStyle },
            h("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: rpt.ink2 } }, "Forward-Looking Cash Runway"),
            h("div", { style: { fontSize: 11, marginBottom: 10, color: rpt.ink2 } },
              "Starting cash " + fmtMoney(fr.startingCash) + " — modeled runway " + (fr.runwayMonths != null ? fr.runwayMonths.toFixed(0) + " months" : "25yr+")),
            h(RevenueChart, { series: [{ name: "Projected cash balance", color: rpt.teal, points: fr.path.map(p => ({ v: p.balanceEnd, label: p.year })) }], height: 160 })
          );
        })(),

        h("div", { style: { fontSize: 9, fontFamily: "monospace", color: rpt.ink3, marginTop: 20, borderTop: "1px solid " + rpt.rule, paddingTop: 10, lineHeight: 1.6 } },
          "Generated by RxNPV. This is a modeling exercise built on stated assumptions, benchmark data, and simplifications documented in the app's Reference Sheet — it is not investment advice and should not be relied on as the sole basis for any investment decision.")
      )
    )
  );
}

// One added section, rendered from its stored HTML. The snapshot was
// sanitised when it was captured and is sanitised again here, because stored
// data is only as trustworthy as whatever last wrote localStorage — and the
// page CSP (hash-only scripts, no remote loads) backstops both. This is the
// one deliberate dangerouslySetInnerHTML in the app, bounded to content the
// app itself serialised.
//
// It is wrapped in a theme scope matching the REPORT, not the theme it was
// captured in: the snapshot's colours are CSS variables, so it re-themes. And
// it is scaled to fit the report column, since a section captured at the full
// app width is wider than a printed page.
function ReportSnapshot({ pin, dark }) {
  const h = React.createElement;
  const boxRef = React.useRef(null);
  const [html, setHtml] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [avail, setAvail] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    decompressSnapshotText(pin.enc, pin.html)
      .then(t => { if (live) setHtml(sanitizeSnapshotHtml(t)); })
      .catch(e => { if (live) setErr(e.message || "unreadable"); });
    return () => { live = false; };
  }, [pin.id, pin.html]);
  React.useLayoutEffect(() => {
    const measure = () => { if (boxRef.current) setAvail(boxRef.current.clientWidth); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  if (err) return h("div", { style: { fontSize: 11, fontFamily: "monospace", color: "#b45309" } }, "This section could not be read back (" + err + "). Remove it and add it again.");
  const w = pin.width || 0;
  const scale = (w && avail && w > avail) ? avail / w : 1;
  return h("div", { ref: boxRef, style: { width: "100%", overflow: "hidden" } },
    html == null ? h("div", { style: { fontSize: 11, fontFamily: "monospace", opacity: 0.6 } }, "Loading…")
      : h("div", { className: "report-snapshot " + (dark ? "theme-scope-dark" : "theme-scope-light"),
          style: { width: w ? w + "px" : "100%", zoom: scale, color: "var(--ink-1)", fontFamily: "var(--sans)" },
          dangerouslySetInnerHTML: { __html: html } }));
}
