// ════════════════════════════════════════════════════════════════════════════
// Tools → Benchmarks workbench
// M&A Premium, Peak Sales Comps, Licensing Comps.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── M&A Target Premium calculator ──
function MaPremiumTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [startValue, setStartValue] = React.useState("");
  const [premiumPct, setPremiumPct] = React.useState("");
  const [importCaseId, setImportCaseId] = useActiveCaseId(activeCase);
  const [caseValueB, setCaseValueB] = React.useState(null); // total equity value in $B, for the scatter's x-axis
  // Full read/write here now, matching Peak Sales Comps and Licensing Comps
  // exactly — this used to be read-only with add/edit/delete living only on
  // the Reference Sheet, which meant a user looking for "add a custom deal"
  // in the place they'd naturally expect (this tool) wouldn't find it. Both
  // locations read/write the same CUSTOM_MA_KEY, so an entry added here
  // shows up on the Reference Sheet too, and vice versa — one dataset, two
  // places to edit it, not two datasets to keep in sync.
  const [customMa, setCustomMa] = React.useState(() => loadCustomComps(CUSTOM_MA_KEY));
  const [showAddMa, setShowAddMa] = React.useState(false);
  const [editingMaIdx, setEditingMaIdx] = React.useState(null);
  // Surfaces when the browser's storage is full/unavailable — without this,
  // a custom entry would appear to save fine (React state updates
  // immediately regardless of whether the underlying persist call actually
  // worked) and then silently vanish next launch, with the user never
  // knowing why. Refreshed on every save attempt, not just failures, so it
  // also clears itself the moment a later save succeeds.
  const [customSaveFailed, setCustomSaveFailed] = React.useState(false);
  const allDeals = [...MA_COMPS.deals, ...customMa];

  const parseMaVals = (vals) => ({
    acquirer: vals.acquirer, target: vals.target,
    year: parseInt(vals.year) || new Date().getFullYear(),
    valueB: parseFloat(vals.valueB) || 0,
    area: vals.area || "Other", stage: vals.stage || "",
    asset: vals.asset || undefined, premiumPct: vals.premiumPct ? parseFloat(vals.premiumPct) : undefined,
    note: vals.note || undefined, _custom: true
  });
  const addCustomMa = (vals) => {
    const u = [...customMa, parseMaVals(vals)];
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    setShowAddMa(false);
  };
  const updateCustomMa = (idx, vals) => {
    const u = customMa.map((e, i) => i === idx ? parseMaVals(vals) : e);
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    setEditingMaIdx(null);
  };
  const deleteCustomMa = (idx) => {
    const u = customMa.filter((_, i) => i !== idx);
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    if (editingMaIdx === idx) setEditingMaIdx(null);
  };
  const maFormFields = [
    { key: "acquirer", label: "Acquirer", placeholder: "e.g. Pfizer" },
    { key: "target", label: "Target", placeholder: "e.g. Seagen" },
    { key: "year", label: "Year", placeholder: "2025", numeric: true },
    { key: "valueB", label: "Deal Value ($B)", placeholder: "5.2", numeric: true },
    { key: "premiumPct", label: "Premium (%)", placeholder: "60", numeric: true },
    { key: "area", label: "Area", placeholder: "Oncology / ADC" },
    { key: "stage", label: "Stage", placeholder: "Approved" },
    { key: "asset", label: "Asset", placeholder: "Lead drug/program" },
    { key: "note", label: "Note", placeholder: "Context, CVR structure…" }
  ];

  const premiumsKnown = allDeals.map(d => d.premiumPct).filter(p => p != null).sort((a,b)=>a-b);
  const medianPremium = premiumsKnown.length ? premiumsKnown[Math.floor(premiumsKnown.length/2)] : 55;

  const importFromCase = () => {
    const c = cases.find(x => x.id === importCaseId);
    if (!c) return;
    try {
      const dr = c.discountRatePct !== "" && c.discountRatePct != null ? Number(c.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
      const tv = c.terminalValue || { enabled: false };
      const r = computeCaseValuation(c, SCENARIO_PRESETS.base, "base", dr, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
      if (r.equity.perShare != null) setStartValue(String(r.equity.perShare.toFixed(2)));
      setCaseValueB(r.equity.equityValue / 1e9);
    } catch (e) {}
  };

  // Starts from the open case's Base fair value, reloaded when the case changes.
  React.useEffect(() => { if (importCaseId) importFromCase(); }, [importCaseId]);

  const start = Number(startValue) || 0;
  const pct = premiumPct !== "" ? Number(premiumPct) : medianPremium;
  const takeout = start > 0 ? start * (1 + pct / 100) : null;

  const dealsWithPremium = allDeals.filter(d => d.premiumPct != null).sort((a,b) => b.valueB - a.valueB);
  const [selectedDealIdx, setSelectedDealIdx] = React.useState("");
  const useDealPremium = (idx) => {
    setSelectedDealIdx(idx);
    if (idx !== "") setPremiumPct(String(dealsWithPremium[Number(idx)].premiumPct));
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "M&A Target Premium calculator"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: "New here? What a takeout premium is and isn't" },
          h("div", { style: { lineHeight: 1.6 } }, 'The premium is how far above the undisturbed share price an acquirer paid. It is a useful reality check on an upside case — if your fair value implies a 400% premium, you are assuming a deal richer than almost anything in the comp set. But a premium is measured against the price the day before the deal leaked, not against fair value, so a stock that had already run up shows a smaller premium for the same absolute payout. Use it as a sanity bound on the acquisition scenario, not as a price target on its own.'))),
      h("div", { style: UI.intro },
        "A standalone \"what if this gets acquired\" reference — not part of any case's DCF. Enter a starting value per share, or pull one from an open case."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h(CasePicker, { cases, selectedId: importCaseId, onChange: setImportCaseId }),
        h("button", { onClick: importFromCase, disabled: !importCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: importCaseId ? "pointer" : "default", opacity: importCaseId ? 1 : 0.5 } }, "← Pull Base fair value")
      ),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" } },
        h("div", { style: { flex: "1 1 180px" } },
          h("div", { style: UI.fieldLabel }, "Starting value per share"),
          h("input", { type: "number", "aria-label": "Starting value per share", value: startValue, onChange: e => setStartValue(e.target.value), placeholder: "e.g. 12.50",
            style: UI.input })
        ),
        h("div", { style: { flex: "1 1 180px" } },
          h("div", { style: UI.fieldLabel }, "Assumed takeout premium"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", "aria-label": "Assumed takeout premium (%)", value: premiumPct, onChange: e => setPremiumPct(e.target.value), placeholder: String(medianPremium),
              style: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
            h("span", { style: UI.captionMd }, "%"))
        )
      ),
      h("div", { style: { marginBottom: 4 } },
        h("div", { style: UI.fieldLabel }, "Or use a specific deal's premium"),
        h("select", { "aria-label": "Or use a specific deal's premium", value: selectedDealIdx, onChange: e => useDealPremium(e.target.value),
          style: { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "" }, "— pick a comparable deal —"),
          dealsWithPremium.map((d, i) => h("option", { key: i, value: i }, d.acquirer + " → " + d.target + " (" + d.premiumPct + "%, " + d.area + ")"))
        )
      ),
      h("div", { style: { marginTop: 14 } },
        h("div", { style: UI.caption }, "Implied takeout value"),
        h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtShare(takeout))
      ),
      takeout != null && h(Explain, readPremium(pct, premiumsKnown)),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 10 } }, "Default premium is the median across " + premiumsKnown.length + " tracked deals with a disclosed premium.")
    ]),
    toolCard(h, [
      toolLabel(h, "Your custom M&A comps (" + customMa.length + ")"),
      customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10 } },
        "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
      customMa.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } }, "None added yet — a custom deal behaves identically to a built-in one everywhere on this page, including the scatter chart below."),
      customMa.length > 0 && h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 } },
        customMa.map((d, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)", gap: 8 } },
          h("div", null, "✦ " + d.acquirer + " → " + d.target + " (" + d.year + ")" + (d.premiumPct != null ? " · " + d.premiumPct + "%" : "")),
          h("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
            h("button", { onClick: () => { setEditingMaIdx(i); setShowAddMa(false); }, style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontSize: 10, fontFamily: "var(--mono)", cursor: "pointer" } }, "Edit"),
            h(ConfirmXButton, { onConfirm: () => deleteCustomMa(i), title: "Delete this custom deal" })
          )
        ))
      ),
      editingMaIdx != null
        ? h(CustomCompForm, { initialValues: customMa[editingMaIdx], saveLabel: "Save changes", fields: maFormFields,
            onSave: (vals) => updateCustomMa(editingMaIdx, vals), onCancel: () => setEditingMaIdx(null) })
        : !showAddMa
          ? h("button", { onClick: () => setShowAddMa(true), style: { padding: "5px 14px", borderRadius: 6, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontSize: 11, fontFamily: "var(--mono)", cursor: "pointer" } }, "+ Add custom deal comp")
          : h(CustomCompForm, { fields: maFormFields, onSave: addCustomMa, onCancel: () => setShowAddMa(false) })
    ]),
    toolCard(h, [
      toolLabel(h, "Deal value vs. premium — where do you sit among real comps"),
      h("div", { style: UI.intro },
        "Each dot is a real M&A deal with a disclosed premium. Import a case above to plot it as the highlighted point — a visual sanity check for whether your assumed premium is reasonable for a deal of that size, not just a table to scroll."),
      h(ExportableBlock, { title: "M&A premium vs. deal size" },
        h(ScatterChart, {
          points: allDeals.filter(d => d.premiumPct != null).map(d => ({ x: d.valueB, y: d.premiumPct, label: d.acquirer + "→" + d.target })),
          highlightPoint: (caseValueB != null && start > 0) ? { x: caseValueB, y: pct, label: "Your case" } : null,
          xLabel: "Deal value ($B)", yLabel: "Premium (%)",
          xFmt: v => "$" + v.toFixed(0) + "B", yFmt: v => v.toFixed(0) + "%"
        }))
    ])
  );
}

// ── Peak Sales Comps: real drugs' actual/consensus peak sales, exportable
// directly into a program's Quick Revenue peak estimate. Peak revenue is a
// per-PROGRAM field (a case can hold several drugs), so export needs both a
// case picker and a program picker, not just a case picker. ──
function PeakSalesCompsTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [filter, setFilter] = React.useState("");
  const [exportCaseId, setExportCaseId] = useActiveCaseId(activeCase);
  const [exportProgramId, setExportProgramId] = React.useState(activeCase && activeCase.programs[0] ? activeCase.programs[0].id : "");
  const [exportMsg, setExportMsg] = React.useState(null);
  const [fdaData, setFdaData] = React.useState({}); // drugName -> result, cached per lookup
  const [fdaLoading, setFdaLoading] = React.useState(null); // drugName currently loading
  const [customPeakSales, setCustomPeakSales] = React.useState(() => loadCustomComps(CUSTOM_PEAKSALES_KEY));
  const [showAddDrug, setShowAddDrug] = React.useState(false);
  const [editingDrugIdx, setEditingDrugIdx] = React.useState(null);
  const [customSaveFailed, setCustomSaveFailed] = React.useState(false);

  const parseDrugVals = (vals) => ({
    drug: vals.drug, company: vals.company || "", area: vals.area || "Other",
    modality: vals.modality || "biologic", peakSalesB: parseFloat(vals.peakSalesB) || 0,
    asOfYear: parseInt(vals.asOfYear) || new Date().getFullYear(),
    status: vals.status || "", _custom: true
  });
  const addCustomDrug = (vals) => {
    const u = [...customPeakSales, parseDrugVals(vals)];
    setCustomPeakSales(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_PEAKSALES_KEY, u));
    setShowAddDrug(false);
  };
  const updateCustomDrug = (idx, vals) => {
    const u = customPeakSales.map((e, i) => i === idx ? parseDrugVals(vals) : e);
    setCustomPeakSales(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_PEAKSALES_KEY, u));
    setEditingDrugIdx(null);
  };
  const deleteCustomDrug = (idx) => {
    const u = customPeakSales.filter((_, i) => i !== idx);
    setCustomPeakSales(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_PEAKSALES_KEY, u));
    if (editingDrugIdx === idx) setEditingDrugIdx(null);
  };

  const lookupFDA = async (drugName) => {
    setFdaLoading(drugName);
    const r = await searchDrugApproval(drugName);
    setFdaData(prev => ({ ...prev, [drugName]: r }));
    setFdaLoading(null);
  };

  const fmtFdaDate = (yyyymmdd) => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
    return yyyymmdd.slice(0,4) + "-" + yyyymmdd.slice(4,6) + "-" + yyyymmdd.slice(6,8);
  };

  const exportCase = cases.find(c => c.id === exportCaseId);
  React.useEffect(() => {
    if (exportCase && exportCase.programs.length && !exportCase.programs.some(p => p.id === exportProgramId)) {
      setExportProgramId(exportCase.programs[0].id);
    }
  }, [exportCaseId]);

  const allPeakSalesDrugs = [...PEAK_SALES_COMPS.drugs, ...customPeakSales];
  // The selected export-target case's own modeled peak revenue, so the ranking
  // chart below can place it among the real comps. Guarded per-program because
  // getProgramRevenueResult throws on an incomplete revenue build, and a
  // half-filled program shouldn't take the whole tool down.
  const ownPeakDrugs = (exportCase ? exportCase.programs : []).map(p => {
    let peakB = null;
    try { peakB = getProgramRevenueResult(p, 25).peakTotalRevenue / 1e9; } catch (e) {}
    return peakB != null && peakB > 0 ? { drug: programLabel(p, exportCase.programs) + " (your case)", company: exportCase.name, peakSalesB: peakB, _own: true } : null;
  }).filter(Boolean);
  const q = filter.trim().toLowerCase();
  const filtered = allPeakSalesDrugs
    .filter(d => !q || [d.drug, d.company, d.area, d.status].some(f => f && f.toLowerCase().includes(q)))
    .sort((a, b) => b.peakSalesB - a.peakSalesB);

  const exportToCase = (drug) => {
    if (!exportCase || !exportProgramId) return;
    const updatedPrograms = exportCase.programs.map(p => p.id === exportProgramId
      ? { ...p, revenueMode: "quick", quickRevenue: { ...(p.quickRevenue || {}), peakRevenue: String(Math.round(drug.peakSalesB * 1e9)) } }
      : p
    );
    updateCase({ ...exportCase, programs: updatedPrograms, updatedAt: Date.now() });
    const progName = exportCase.programs.find(p => p.id === exportProgramId);
    setExportMsg("Exported " + possessive(drug.drug) + " peak sales ($" + drug.peakSalesB + "B) to \"" + (progName ? programLabel(progName, exportCase.programs) : "program") + "\" in \"" + exportCase.name + "\"");
  };

  // Every program in the export-target case, not just the one selected for
  // export — a multi-asset company should show all its assets on the chart,
  // each in its own correctly-sorted position, not just one.
  const ownDrugs = (exportCase ? exportCase.programs : []).map(p => {
    let peakB = null;
    try { peakB = getProgramRevenueResult(p, 25).peakTotalRevenue / 1e9; } catch (e) {}
    return peakB != null && peakB > 0 ? { drug: programLabel(p, exportCase.programs), peakSalesB: peakB, _own: true } : null;
  }).filter(Boolean);

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Peak sales comps"),
      customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10 } },
        "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
      h("div", { style: UI.intro },
        "Real drugs' actual (or clearly-labeled consensus) peak annual sales — a sanity check for your own peak revenue assumption, and exportable straight into a program's Quick Revenue field."),

      (() => {
        // Merge own asset(s) into the sorted comps list at their correct
        // value position, rather than always pinning them at the bottom
        // regardless of size. Show a window that guarantees every own-asset
        // is visible with real comps above and below for context, instead
        // of a flat top-18 cutoff that could exclude a smaller own-asset
        // entirely.
        const combined = [...filtered, ...ownDrugs].sort((a, b) => b.peakSalesB - a.peakSalesB);
        let chartDrugs;
        if (ownDrugs.length === 0) {
          chartDrugs = combined.slice(0, 18);
        } else {
          const ownIdx = combined.map((d, i) => d._own ? i : -1).filter(i => i >= 0);
          const lo = Math.max(0, Math.min(...ownIdx) - 8);
          const hi = Math.min(combined.length, Math.max(...ownIdx) + 9);
          chartDrugs = combined.slice(lo, hi);
        }
        const maxB = Math.max(...chartDrugs.map(d => d.peakSalesB), 1);
        return h("div", { style: { marginBottom: 16, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
          ownDrugs.length > 0 && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--amber)", marginBottom: 8 } },
            "Highlighted: " + (exportCase ? possessive(exportCase.name) : "your case's") + " own asset" + (ownDrugs.length > 1 ? "s" : "") + " (" + ownDrugs.map(d => d.drug + " $" + d.peakSalesB.toFixed(2) + "B").join(", ") + ") — shown in its correct position among real comps, not pinned to the bottom."),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 3, maxHeight: 320, overflowY: "auto" } },
            chartDrugs.map((d, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8 } },
              h("div", { title: d.drug, style: { width: 170, fontSize: 10, fontFamily: "var(--mono)", color: d._own ? "var(--amber)" : "var(--ink-3)", fontWeight: d._own ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 } }, d.drug),
              h("div", { style: { flex: 1, height: 12, borderRadius: 3, background: "var(--surface)", overflow: "hidden" } },
                h("div", { style: { height: "100%", width: (d.peakSalesB / maxB) * 100 + "%", background: d._own ? "var(--amber)" : "var(--teal)", opacity: d._own ? 1 : 0.75, borderRadius: 3 } })),
              h("div", { style: { width: 46, fontSize: 10, fontFamily: "var(--mono)", color: d._own ? "var(--amber)" : "var(--ink-2)", fontWeight: d._own ? 700 : 400, textAlign: "right", flexShrink: 0 } }, "$" + d.peakSalesB.toFixed(1) + "B")
            ))
          )
        );
      })(),

      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("input", { type: "text", "aria-label": "Filter peak sales comps", value: filter, placeholder: "Filter by drug, company, area…", onChange: e => setFilter(e.target.value),
          style: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => downloadCSV("RxNPV-Peak-Sales-Comps.csv",
            ["Drug", "Company", "Area", "Modality", "Peak Sales ($B)", "As Of Year", "Status"],
            filtered.map(d => [d.drug, d.company, d.area, d.modality, d.peakSalesB, d.asOfYear, d.status])),
          style: { padding: "7px 14px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Export CSV")
      ),

      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h("span", { style: UI.caption }, "Export target:"),
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: id => { setExportCaseId(id); setExportMsg(null); } }),
        exportCase && h(IncludeInReportToggle, { theCase: exportCase, updateCase, reportKey: "peakSalesComps", label: "Include comp chart in PDF report" }),
        exportCase && h("select", { "aria-label": "Program to export to", value: exportProgramId, onChange: e => setExportProgramId(e.target.value),
          style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          exportCase.programs.map(p => h("option", { key: p.id, value: p.id }, programLabel(p, exportCase.programs)))
        )
      ),
      exportMsg && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)", marginBottom: 10 } }, exportMsg),

      h("div", { style: { marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--rule)" } },
        h("div", { style: { ...UI.caption, marginBottom: 8 } }, "Where this case sits among real comps"),
        h(ExportableBlock, { title: "Peak sales comps — where this lands" },
          h(PeakSalesCompsChart, { ownDrugs: ownPeakDrugs, allDrugs: allPeakSalesDrugs }))
      ),

      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" } },
        filtered.map((d, i) => h("div", { key: i, style: { padding: "9px 14px", borderRadius: 8, background: "var(--surface-2)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 } },
            h("div", null,
              h("span", { style: { fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" } },
                d._custom && h("span", { style: { color: "var(--amber)", marginRight: 6 } }, "✦"), d.drug),
              h("span", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", marginLeft: 8 } }, d.company)),
            h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
              h("span", { style: { fontFamily: "var(--mono)", fontSize: 15, fontWeight: 700, color: "var(--ink-1)" } }, "$" + d.peakSalesB + "B"),
              h("button", { onClick: () => exportToCase(d), disabled: !exportCaseId || !exportProgramId,
                style: { padding: "5px 10px", minHeight: 26, borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export →"),
              d._custom && h("button", { onClick: () => { setEditingDrugIdx(customPeakSales.indexOf(d)); setShowAddDrug(false); }, style: { padding: "4px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Edit"),
              d._custom && h(ConfirmXButton, { onConfirm: () => deleteCustomDrug(customPeakSales.indexOf(d)), title: "Delete this custom drug" }))
          ),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", marginTop: 3 } },
            d.area, " · ", d.modality, d.asOfYear ? " · " + d.asOfYear : ""),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } }, d.status),
          h("div", { style: { marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--rule)" } },
            !fdaData[d.drug] && h("button", { onClick: () => lookupFDA(d.drug), disabled: fdaLoading === d.drug,
              style: { padding: "5px 10px", minHeight: 26, borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: fdaLoading === d.drug ? "default" : "pointer" } },
              fdaLoading === d.drug ? "Checking FDA…" : "Check real FDA approval →"),
            fdaData[d.drug] && fdaData[d.drug].ok && fdaData[d.drug].results[0] && (() => {
              const f = fdaData[d.drug].results[0];
              // applicationNumber already carries its type as a letter prefix
              // (e.g. "BLA125514") — applicationType is that same prefix
              // re-extracted, so showing both read as "BLA BLA125514".
              return h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--teal)" } },
                "FDA: ", f.applicationNumber || f.applicationType || "?",
                f.firstApprovalDate ? " · approved " + fmtFdaDate(f.firstApprovalDate) : "",
                f.sponsorName ? " · " + f.sponsorName : "");
            })(),
            fdaData[d.drug] && !fdaData[d.drug].ok && h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" } }, fdaData[d.drug].error)
          )
        )),
        filtered.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "12px 0" } }, "No drugs match that filter.")
      ),
      h("div", { style: { marginTop: 10, borderTop: "1px dashed var(--rule)", paddingTop: 10 } },
        editingDrugIdx != null
          ? h(CustomCompForm, {
              initialValues: customPeakSales[editingDrugIdx], saveLabel: "Save changes",
              fields: [
                { key: "drug", label: "Drug", placeholder: "e.g. Spinraza" },
                { key: "company", label: "Company", placeholder: "Biogen" },
                { key: "area", label: "Area", placeholder: "Rare disease (SMA)" },
                { key: "modality", label: "Modality", placeholder: "biologic" },
                { key: "peakSalesB", label: "Peak Sales ($B)", placeholder: "2.0", numeric: true },
                { key: "asOfYear", label: "As Of Year", placeholder: "2024", numeric: true },
                { key: "status", label: "Status", placeholder: "still growing" }
              ],
              onSave: (vals) => updateCustomDrug(editingDrugIdx, vals), onCancel: () => setEditingDrugIdx(null)
            })
        : !showAddDrug
          ? h("button", { onClick: () => setShowAddDrug(true), style: { padding: "5px 14px", borderRadius: 6, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontSize: 11, fontFamily: "var(--mono)", cursor: "pointer" } }, "+ Add custom drug comp")
          : h(CustomCompForm, {
              fields: [
                { key: "drug", label: "Drug", placeholder: "e.g. Spinraza" },
                { key: "company", label: "Company", placeholder: "Biogen" },
                { key: "area", label: "Area", placeholder: "Rare disease (SMA)" },
                { key: "modality", label: "Modality", placeholder: "biologic" },
                { key: "peakSalesB", label: "Peak Sales ($B)", placeholder: "2.0", numeric: true },
                { key: "asOfYear", label: "As Of Year", placeholder: "2024", numeric: true },
                { key: "status", label: "Status", placeholder: "still growing" }
              ],
              onSave: addCustomDrug, onCancel: () => setShowAddDrug(false)
            })
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6 } },
        "Compiled from company disclosures and public analyst commentary as of " + PEAK_SALES_COMPS.asOf + " — refreshed periodically, not a live feed. \"Consensus estimate\" entries are labeled explicitly and haven't necessarily been realized yet.")
    ])
  );
}

// ── Licensing / Royalty Comps: real out-license deal terms, exportable
// directly into a program's Partnership Economics overlay (royalty rate and
// upfront). The comps set here is intentionally smaller than the M&A and
// Peak Sales lists — each entry took genuine multi-source verification, not
// a database pull, and several candidates found during research had
// inconsistent figures across sources and were left out rather than
// resolved by picking one arbitrarily.
function LicensingCompsTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [filter, setFilter] = React.useState("");
  const [exportCaseId, setExportCaseId] = useActiveCaseId(activeCase);
  const [exportProgramId, setExportProgramId] = React.useState(activeCase && activeCase.programs[0] ? activeCase.programs[0].id : "");
  const [exportMsg, setExportMsg] = React.useState(null);
  const [customDeals, setCustomDeals] = React.useState(() => loadCustomComps(CUSTOM_LICENSING_KEY));
  const [showAddDeal, setShowAddDeal] = React.useState(false);
  const [editingDealIdx, setEditingDealIdx] = React.useState(null);
  const [customSaveFailed, setCustomSaveFailed] = React.useState(false);

  const parseDealVals = (vals) => ({
    licensor: vals.licensor, licensee: vals.licensee || "", asset: vals.asset || "",
    area: vals.area || "Other", stage: vals.stage || "", territory: vals.territory || "",
    year: parseInt(vals.year) || new Date().getFullYear(),
    upfrontM: parseFloat(vals.upfrontM) || 0, totalDealValueM: parseFloat(vals.totalDealValueM) || 0,
    royaltyLow: vals.royaltyLow !== "" ? parseFloat(vals.royaltyLow) : null,
    royaltyHigh: vals.royaltyHigh !== "" ? parseFloat(vals.royaltyHigh) : null,
    royaltyNote: vals.royaltyNote || "", _custom: true
  });
  const addCustomDeal = (vals) => {
    const u = [...customDeals, parseDealVals(vals)];
    setCustomDeals(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_LICENSING_KEY, u));
    setShowAddDeal(false);
  };
  const updateCustomDeal = (idx, vals) => {
    const u = customDeals.map((e, i) => i === idx ? parseDealVals(vals) : e);
    setCustomDeals(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_LICENSING_KEY, u));
    setEditingDealIdx(null);
  };
  const deleteCustomDeal = (idx) => {
    const u = customDeals.filter((_, i) => i !== idx);
    setCustomDeals(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_LICENSING_KEY, u));
    if (editingDealIdx === idx) setEditingDealIdx(null);
  };

  const exportCase = cases.find(c => c.id === exportCaseId);
  React.useEffect(() => {
    if (exportCase && exportCase.programs.length && !exportCase.programs.some(p => p.id === exportProgramId)) {
      setExportProgramId(exportCase.programs[0].id);
    }
  }, [exportCaseId]);

  const allDeals = [...LICENSING_COMPS.deals, ...customDeals];
  const q = filter.trim().toLowerCase();
  const filtered = allDeals
    .filter(d => !q || [d.licensor, d.licensee, d.asset, d.area, d.stage].some(f => f && f.toLowerCase().includes(q)))
    .sort((a, b) => b.totalDealValueM - a.totalDealValueM);

  const exportToCase = (deal) => {
    if (!exportCase || !exportProgramId) return;
    const updatedPrograms = exportCase.programs.map(p => {
      if (p.id !== exportProgramId) return p;
      const existing = p.partnership || { enabled: false, territory: "exUS", royaltyPct: "", upfrontM: "", costSharingPct: "", milestones: [] };
      const royaltyMid = (deal.royaltyLow != null && deal.royaltyHigh != null) ? (deal.royaltyLow + deal.royaltyHigh) / 2 : existing.royaltyPct;
      return { ...p, partnership: { ...existing, enabled: true, royaltyPct: royaltyMid !== "" && royaltyMid != null ? String(royaltyMid) : existing.royaltyPct, upfrontM: String(deal.upfrontM) } };
    });
    updateCase({ ...exportCase, programs: updatedPrograms, updatedAt: Date.now() });
    const progName = exportCase.programs.find(p => p.id === exportProgramId);
    setExportMsg("Exported " + deal.licensor + "/" + deal.licensee + " terms to \"" + (progName ? programLabel(progName, exportCase.programs) : "program") + "\" — enabled Partnership Economics with this deal's upfront" + (deal.royaltyLow != null ? " and royalty midpoint" : "") + ".");
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Licensing / royalty deal comps"),
      customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10 } },
        "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
      h("div", { style: UI.intro },
        "Real out-license deals — what a company received for granting a partner development/commercialization rights, in upfront cash, milestones, and royalties. A sanity check for the Partnership Economics overlay, and exportable straight into it. Every deal below is confirmed against the companies' own disclosures, not a single secondary source."),

      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("input", { type: "text", "aria-label": "Filter licensing comps", value: filter, placeholder: "Filter by company, asset, area…", onChange: e => setFilter(e.target.value),
          style: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => downloadCSV("RxNPV-Licensing-Comps.csv",
            ["Licensor", "Licensee", "Year", "Asset", "Area", "Stage", "Territory", "Upfront ($M)", "Total Deal Value ($M)", "Royalty Low %", "Royalty High %", "Royalty Note"],
            filtered.map(d => [d.licensor, d.licensee, d.year, d.asset, d.area, d.stage, d.territory, d.upfrontM, d.totalDealValueM, d.royaltyLow ?? "", d.royaltyHigh ?? "", d.royaltyNote])),
          style: { padding: "7px 14px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Export CSV")
      ),

      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 } },
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
        exportCase && exportCase.programs.length > 0 && h("select", { "aria-label": "Program to export to", value: exportProgramId, onChange: e => setExportProgramId(e.target.value),
          style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          exportCase.programs.map(p => h("option", { key: p.id, value: p.id }, programLabel(p, exportCase.programs)))),
        exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
      ),

      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" } },
        filtered.map((d, i) => {
          const isCustom = !!d._custom;
          return h("div", { key: i, style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-1)", fontWeight: 700 } },
                  (isCustom && h("span", { style: { color: "var(--amber)", marginRight: 6 } }, "✦")), d.licensor + " → " + d.licensee + " (" + d.year + ")"),
                h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 2 } }, d.asset),
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 2 } },
                  d.area + " · " + d.stage + " · " + d.territory),
                h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", marginTop: 4 } },
                  "$" + d.upfrontM.toLocaleString() + "M upfront · $" + d.totalDealValueM.toLocaleString() + "M total"),
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 2 } }, d.royaltyNote)
              ),
              h("div", { style: { display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 } },
                h("button", { onClick: () => exportToCase(d), disabled: !exportCase || !exportProgramId,
                  style: { padding: "5px 12px", minHeight: 26, borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: (exportCase && exportProgramId) ? "pointer" : "default", opacity: (exportCase && exportProgramId) ? 1 : 0.5 } }, "Export →"),
                isCustom && h("button", { onClick: () => { setEditingDealIdx(customDeals.indexOf(d)); setShowAddDeal(false); },
                  style: { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Edit"),
                isCustom && h(ConfirmXButton, { onConfirm: () => deleteCustomDeal(customDeals.indexOf(d)), title: "Delete this custom licensing deal", style: { padding: "5px 12px", borderRadius: 6 } })
              )
            )
          );
        }),
        filtered.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "12px 0" } }, "No deals match that filter.")
      ),

      h("div", { style: { marginTop: 10, borderTop: "1px dashed var(--rule)", paddingTop: 10 } },
        editingDealIdx != null
          ? h(CustomCompForm, {
              initialValues: customDeals[editingDealIdx], saveLabel: "Save changes",
              fields: [
                { key: "licensor", label: "Licensor", placeholder: "Small Biotech Inc" },
                { key: "licensee", label: "Licensee", placeholder: "Big Pharma Co" },
                { key: "asset", label: "Asset", placeholder: "Drug name / program" },
                { key: "area", label: "Area", placeholder: "Oncology" },
                { key: "stage", label: "Stage at deal", placeholder: "Phase 2" },
                { key: "territory", label: "Territory", placeholder: "Worldwide ex-China" },
                { key: "year", label: "Year", placeholder: "2025", numeric: true },
                { key: "upfrontM", label: "Upfront ($M)", placeholder: "100", numeric: true },
                { key: "totalDealValueM", label: "Total Deal Value ($M)", placeholder: "1000", numeric: true },
                { key: "royaltyLow", label: "Royalty Low (%)", placeholder: "10", numeric: true },
                { key: "royaltyHigh", label: "Royalty High (%)", placeholder: "15", numeric: true },
                { key: "royaltyNote", label: "Royalty Note", placeholder: "low double-digit, tier structure undisclosed" }
              ],
              onSave: (vals) => updateCustomDeal(editingDealIdx, vals), onCancel: () => setEditingDealIdx(null)
            })
        : !showAddDeal
          ? h("button", { onClick: () => setShowAddDeal(true), style: { padding: "5px 14px", borderRadius: 6, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontSize: 11, fontFamily: "var(--mono)", cursor: "pointer" } }, "+ Add custom deal")
          : h(CustomCompForm, {
              fields: [
                { key: "licensor", label: "Licensor", placeholder: "Small Biotech Inc" },
                { key: "licensee", label: "Licensee", placeholder: "Big Pharma Co" },
                { key: "asset", label: "Asset", placeholder: "Drug name / program" },
                { key: "area", label: "Area", placeholder: "Oncology" },
                { key: "stage", label: "Stage at deal", placeholder: "Phase 2" },
                { key: "territory", label: "Territory", placeholder: "Worldwide ex-China" },
                { key: "year", label: "Year", placeholder: "2025", numeric: true },
                { key: "upfrontM", label: "Upfront ($M)", placeholder: "100", numeric: true },
                { key: "totalDealValueM", label: "Total Deal Value ($M)", placeholder: "1000", numeric: true },
                { key: "royaltyLow", label: "Royalty Low (%)", placeholder: "10", numeric: true },
                { key: "royaltyHigh", label: "Royalty High (%)", placeholder: "15", numeric: true },
                { key: "royaltyNote", label: "Royalty Note", placeholder: "low double-digit, tier structure undisclosed" }
              ],
              onSave: addCustomDeal, onCancel: () => setShowAddDeal(false)
            })
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6 } },
        "Compiled from company press releases and, where available, primary SEC filings, as of " + LICENSING_COMPS.asOf + " — refreshed periodically, not a live feed. Royalty low/high are only shown where a specific numeric range was actually disclosed; many real deals only ever say \"tiered royalties\" with no rate given, and that's shown as-is rather than guessed at.")
    ])
  );
}
