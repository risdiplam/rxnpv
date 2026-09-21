// ════════════════════════════════════════════════════════════════════════════
// ToolsView — interactive utilities that sit alongside (not inside) the DCF:
// M&A premium calculator, company lookup (EDGAR + CT.gov), competitor search,
// fully diluted market cap, cash runway, sensitivity analysis. Each tool can
// run fully standalone, or optionally import from / export to any open case —
// never required, always available via the case picker where it makes sense.
// ════════════════════════════════════════════════════════════════════════════

// ── Shared case picker — used by every tool's import/export controls ──
function CasePicker({ cases, selectedId, onChange, placeholder }) {
  const h = React.createElement;
  if (!cases || cases.length === 0) {
    return h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No cases yet — create one in Workspace first.");
  }
  return h("select", { value: selectedId || "", onChange: e => onChange(e.target.value),
    "aria-label": placeholder || "Select a case",
    style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
    h("option", { value: "" }, placeholder || "Select a case…"),
    cases.map(c => h("option", { key: c.id, value: c.id }, c.name + (c.ticker ? " (" + c.ticker + ")" : "")))
  );
}

function ToolsView({ cases, updateCase, activeCase, navRequest }) {
  const h = React.createElement;
  const [tab, setTab] = React.useState("ma");
  // Set by Company Lookup's "Watch this trial" link and consumed once by
  // Trial Watch on arrival — entirely local to ToolsView since both tabs
  // are siblings here, no need to route this through App.
  const [pendingNctId, setPendingNctId] = React.useState(null);
  const goToTrialWatch = (nctId) => { setPendingNctId(nctId); setTab("trialwatch"); };

  // Cross-view navigation arriving from outside ToolsView (e.g. Partnership
  // Economics -> Licensing Comps). requestId changes on every request even
  // if the target tab is the same as before, so this fires every time.
  React.useEffect(() => {
    if (navRequest && navRequest.tab) setTab(navRequest.tab);
  }, [navRequest && navRequest.requestId]);

  // Grouped rather than one flat row of nine: these tabs do three genuinely
  // different kinds of work, and grouping them makes that legible at a
  // glance instead of requiring the user to remember which is which.
  // "Benchmarks" are static reference datasets; "Your case" tools compute
  // against case data already entered; "Live research" hits external APIs.
  const tabGroups = [
    { label: "Benchmarks", tabs: [["ma","M&A Premium"],["peaksales","Peak Sales Comps"],["licensing","Licensing Comps"]] },
    { label: "Your case", tabs: [["fdmc","Diluted Market Cap"],["runway","Cash Runway"],["runwayCatalyst","Runway vs. Catalyst"],["binaryEvent","Binary Event"],["sensitivity","Sensitivity"]] },
    { label: "Live research", tabs: [["lookup","Company Lookup"],["calendar","Catalyst Calendar"],["decoder","Trial Decoder"],["trialwatch","Trial Explorer"],["fdaLookup","FDA Lookup"],["exclusivity","Exclusivity / LOE"],["target","Target Dossier"]] }
  ];

  return h("div", { style: { maxWidth: 900, margin: "0 auto", padding: "24px 28px 60px" } },
    h("div", { style: { display: "flex", gap: 18, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-start" } },
      tabGroups.map(group => h("div", { key: group.label },
        h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, paddingLeft: 2 } }, group.label),
        h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
          group.tabs.map(([id, lbl]) => h("button", { key: id, onClick: () => setTab(id),
            style: { padding: "8px 16px", borderRadius: 8, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12,
              background: tab === id ? "var(--teal-bg)" : "var(--surface)", color: tab === id ? "var(--teal)" : "var(--ink-2)", fontWeight: tab === id ? 700 : 400 } }, lbl))
        )
      ))
    ),
    tab === "ma" ? h(MaPremiumTool, { cases, updateCase, activeCase }) :
    tab === "lookup" ? h(CompanyLookupTool, { cases, updateCase, activeCase, onWatchTrial: goToTrialWatch }) :
    tab === "fdmc" ? h(FdmcTool, { cases, updateCase, activeCase }) :
    tab === "runway" ? h(RunwayTool, { cases, updateCase, activeCase }) :
    tab === "runwayCatalyst" ? h(RunwayVsCatalystTool, { cases, activeCase }) :
    tab === "binaryEvent" ? h(BinaryEventTool, { cases, activeCase }) :
    tab === "peaksales" ? h(PeakSalesCompsTool, { cases, updateCase, activeCase }) :
    tab === "licensing" ? h(LicensingCompsTool, { cases, updateCase, activeCase }) :
    tab === "calendar" ? h(CatalystCalendarTool, { cases, updateCase, activeCase }) :
    tab === "decoder" ? h(TrialDecoderTool, { initialNctId: pendingNctId, onConsumedInitialNctId: () => setPendingNctId(null) }) :
    tab === "target" ? h(TargetDossierTool, null) :
    tab === "trialwatch" ? h(TrialWatchTool, { initialNctId: pendingNctId, onConsumedInitialNctId: () => setPendingNctId(null) }) :
    tab === "fdaLookup" ? h(FdaLookupTool, null) :
    tab === "exclusivity" ? h(ExclusivityTool, { cases, updateCase }) :
    h(SensitivityTool, { cases, updateCase, activeCase })
  );
}

// ── Shared helpers for tool cards (used by every tool component below) ──
function toolCard(h, children) {
  return h.apply(null, ["div", { style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "18px 20px", marginBottom: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" } }].concat(Array.isArray(children) ? children : [children]));
}
function toolLabel(h, t) {
  return h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 } }, t);
}

// ── M&A Target Premium calculator ──
function MaPremiumTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [startValue, setStartValue] = React.useState("");
  const [premiumPct, setPremiumPct] = React.useState("");
  const [importCaseId, setImportCaseId] = React.useState(activeCase ? activeCase.id : "");
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
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "A standalone \"what if this gets acquired\" reference — not part of any case's DCF. Enter a starting value per share, or pull one from an open case."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h(CasePicker, { cases, selectedId: importCaseId, onChange: setImportCaseId }),
        h("button", { onClick: importFromCase, disabled: !importCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: importCaseId ? "pointer" : "default", opacity: importCaseId ? 1 : 0.5 } }, "← Pull Base fair value")
      ),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" } },
        h("div", { style: { flex: "1 1 180px" } },
          h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Starting value per share"),
          h("input", { type: "number", value: startValue, onChange: e => setStartValue(e.target.value), placeholder: "e.g. 12.50",
            style: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } })
        ),
        h("div", { style: { flex: "1 1 180px" } },
          h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Assumed takeout premium"),
          h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            h("input", { type: "number", value: premiumPct, onChange: e => setPremiumPct(e.target.value), placeholder: String(medianPremium),
              style: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
            h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "%"))
        )
      ),
      h("div", { style: { marginBottom: 4 } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 } }, "Or use a specific deal's premium"),
        h("select", { "aria-label": "Or use a specific deal's premium", value: selectedDealIdx, onChange: e => useDealPremium(e.target.value),
          style: { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "" }, "— pick a comparable deal —"),
          dealsWithPremium.map((d, i) => h("option", { key: i, value: i }, d.acquirer + " → " + d.target + " (" + d.premiumPct + "%, " + d.area + ")"))
        )
      ),
      h("div", { style: { marginTop: 14 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Implied takeout value"),
        h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, fmtShare(takeout))
      ),
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
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Each dot is a real M&A deal with a disclosed premium. Import a case above to plot it as the highlighted point — a visual sanity check for whether your assumed premium is reasonable for a deal of that size, not just a table to scroll."),
      h(ExportableBlock, { name: "ma-premium-vs-deal-size", showPanelCapture: true },
        h(ScatterChart, {
          points: allDeals.filter(d => d.premiumPct != null).map(d => ({ x: d.valueB, y: d.premiumPct, label: d.acquirer + "→" + d.target })),
          highlightPoint: (caseValueB != null && start > 0) ? { x: caseValueB, y: pct, label: "Your case" } : null,
          xLabel: "Deal value ($B)", yLabel: "Premium (%)",
          xFmt: v => "$" + v.toFixed(0) + "B", yFmt: v => v.toFixed(0) + "%"
        }))
    ])
  );
}

// ── Company Lookup: EDGAR financials + CT.gov pipeline, combined ──
function CompanyLookupTool({ cases, updateCase, activeCase, onWatchTrial }) {
  const h = React.createElement;
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [edgarResult, setEdgarResult] = React.useState(null);
  const [edgarError, setEdgarError] = React.useState(null);
  const [trialsResult, setTrialsResult] = React.useState(null);
  const [trialsError, setTrialsError] = React.useState(null);
  const [condQuery, setCondQuery] = React.useState("");
  const [competitors, setCompetitors] = React.useState(null);
  const [competitorsError, setCompetitorsError] = React.useState(null);
  const [competitorsLoading, setCompetitorsLoading] = React.useState(false);
  const [exportCaseId, setExportCaseId] = React.useState(activeCase ? activeCase.id : "");
  const [exportMsg, setExportMsg] = React.useState(null);
  const [insiderResult, setInsiderResult] = React.useState(null);
  const [insiderError, setInsiderError] = React.useState(null);
  const [insiderLoading, setInsiderLoading] = React.useState(false);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  // Without these, correcting a search mid-flight ("Moderna" -> "Merck") let
  // whichever response happened to land last win, so the screen could show one
  // company's data under another company's name with nothing to indicate it.
  const searchSeq = React.useRef(0);
  const compSeq = React.useRef(0);

  const search = async () => {
    if (!query.trim()) return;
    const myReq = ++searchSeq.current;
    setLoading(true); setEdgarError(null); setTrialsError(null); setEdgarResult(null); setTrialsResult(null); setExportMsg(null);
    const [edgarR, trialsR] = await Promise.all([
      isDesktop ? pullEdgarFinancials(query.trim(), false) : Promise.resolve({ ok: false, error: "EDGAR requires the desktop app." }),
      searchTrialsBySponsor(query.trim(), 20)
    ]);
    if (myReq !== searchSeq.current) return; // a newer search is already in flight
    if (edgarR.ok) setEdgarResult(edgarR); else setEdgarError(edgarR.error);
    if (trialsR.ok) setTrialsResult(trialsR); else setTrialsError(trialsR.error);
    setLoading(false);
  };

  const searchCompetitors = async () => {
    if (!condQuery.trim()) { setCompetitorsError("Enter an indication or condition."); return; }
    const myReq = ++compSeq.current;
    setCompetitorsLoading(true); setCompetitorsError(null);
    const r = await searchCompetitorLandscape(condQuery.trim(), null, 15);
    if (myReq !== compSeq.current) return;
    if (!r.ok) { setCompetitorsError(r.error); setCompetitors(null); setCompetitorsLoading(false); return; }
    if (isDesktop) { try { r.studies = await enrichSponsorsWithPublicStatus(r.studies); } catch (e) {} }
    if (myReq !== compSeq.current) return; // enrichment is a second await point
    setCompetitors(r);
    setCompetitorsLoading(false);
  };

  const exportToCase = () => {
    const c = cases.find(x => x.id === exportCaseId);
    if (!c || !edgarResult) return;
    const cap = c.capitalStructure || { mode: "simple" };
    const patch = { cash: edgarResult.cash != null ? String(edgarResult.cash) : cap.cash, debt: edgarResult.debt != null ? String(edgarResult.debt) : cap.debt };
    if (cap.mode === "simple") {
      patch.dilutedSharesSimple = edgarResult.dilutedShares != null ? String(edgarResult.dilutedShares) : (edgarResult.basicShares != null ? String(edgarResult.basicShares) : cap.dilutedSharesSimple);
    } else {
      patch.basicShares = edgarResult.basicShares != null ? String(edgarResult.basicShares) : cap.basicShares;
      if (edgarResult.options && edgarResult.options.count != null) patch.opts = String(edgarResult.options.count);
      if (edgarResult.options && edgarResult.options.avgStrike != null) patch.optK = String(edgarResult.options.avgStrike);
      if (edgarResult.warrants && edgarResult.warrants.count != null) patch.war = String(edgarResult.warrants.count);
      if (edgarResult.warrants && edgarResult.warrants.avgStrike != null) patch.warK = String(edgarResult.warrants.avgStrike);
      if (edgarResult.convertibleFace != null) patch.convFace = String(edgarResult.convertibleFace);
    }
    updateCase({
      ...c, capitalStructure: { ...cap, ...patch },
      programs: appendEdgarEvidenceToPrograms(c.programs, edgarResult, "Company Lookup's EDGAR pull"),
      updatedAt: Date.now()
    });
    setExportMsg("Exported to \"" + c.name + "\"");
  };

  const loadInsiderActivity = async () => {
    if (!edgarResult || !edgarResult.cik) return;
    setInsiderLoading(true); setInsiderError(null); setInsiderResult(null);
    const r = await fetchInsiderTransactions(edgarResult.cik, 20);
    if (r.ok) setInsiderResult(r); else setInsiderError(r.error || "Couldn't load insider activity.");
    setInsiderLoading(false);
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search a company"),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: query, placeholder: "Company name or ticker", "aria-label": "Company name or ticker", onChange: e => setQuery(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
        }, loading ? "Searching…" : "Search")
      ),
      !isDesktop && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8 } }, "EDGAR financials require the desktop app — trial pipeline search works either way."),

      edgarResult && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", marginBottom: 10 } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } }, "EDGAR financials"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
          h("div", null, "✓ ", h("b", { style: { color: "var(--teal)" } }, edgarResult.name), " · CIK ", edgarResult.cik, edgarResult.ticker ? " · " + edgarResult.ticker : ""),
          h("div", null, "Basic shares: ", edgarResult.basicShares != null ? fmtNum(edgarResult.basicShares) : "n/a", " · Diluted: ", edgarResult.dilutedShares != null ? fmtNum(edgarResult.dilutedShares) : "n/a"),
          h("div", null, "Cash: ", edgarResult.cash != null ? fmtMoney(edgarResult.cash) : "n/a", " · Debt: ", edgarResult.debt != null ? fmtMoney(edgarResult.debt) : "n/a"),
          (edgarResult.options || edgarResult.warrants) && h("div", null,
            edgarResult.options && edgarResult.options.count != null && ("Options: " + fmtNum(edgarResult.options.count) + (edgarResult.options.priceFound ? " @ avg $" + edgarResult.options.avgStrike.toFixed(2) : " (strike not tagged)")),
            edgarResult.options && edgarResult.warrants ? " · " : "",
            edgarResult.warrants && edgarResult.warrants.count != null && ("Warrants: " + fmtNum(edgarResult.warrants.count) + (edgarResult.warrants.priceFound ? " @ avg $" + edgarResult.warrants.avgStrike.toFixed(2) : " (strike not tagged)"))
          ),
          edgarResult.sourceFilingUrl && h("div", { style: { marginTop: 4 } }, h(ExternalLink, { href: edgarResult.sourceFilingUrl, style: { fontSize: 10 } }, "→ View source filing" + (edgarResult.sourceFilingLabel ? " (" + edgarResult.sourceFilingLabel + ")" : "")))
        ),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
          h("button", { onClick: exportToCase, disabled: !exportCaseId,
            style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export financials to case →"),
          exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
        )
      ),
      edgarError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, edgarError),

      // Insider transactions (Form 4) — a separate, explicit action rather
      // than auto-loaded with the main search, since it's a genuinely
      // heavier call (one full-text search plus up to 20 individual XML
      // fetches, one per filing) than everything else on this tab.
      edgarResult && h("div", { style: { marginBottom: 10 } },
        !insiderResult && h("button", { onClick: loadInsiderActivity, disabled: insiderLoading,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: insiderLoading ? "default" : "pointer" }
        }, insiderLoading ? "Loading insider activity…" : "Load insider activity (Form 4)"),
        insiderError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 6 } }, insiderError),
        insiderResult && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)", marginTop: 6 } },
          h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
            "Insider transactions (" + insiderResult.transactions.length + " from last " + insiderResult.filingsChecked + " Form 4 filings)"),
          // Worded carefully: this tool only parses NON-derivative Form 4
          // activity (direct buys and sells). Option grants and RSU vesting
          // are filed as derivative transactions and are not read at all, so a
          // bare "no transactions found" could mean a CEO's large option grant
          // happened the same week and simply isn't shown.
          insiderResult.transactions.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", lineHeight: 1.6 } },
            "No direct buy/sell transactions in the filings checked. Note this covers non-derivative Form 4 activity only — option grants and RSU vesting aren't parsed yet, so they wouldn't appear here even if they happened."),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" } },
            insiderResult.transactions.map((t, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                h("span", { style: { color: t.acquiredDisposed === "A" ? "var(--teal)" : t.acquiredDisposed === "D" ? "var(--red)" : "var(--ink-2)", fontWeight: 700 } }, t.codeLabel),
                h("span", null, t.date), h("span", { style: { color: "var(--ink-3)" } }, "· " + t.ownerName + " (" + t.role + ")")),
              h("div", null,
                fmtNum(t.shares) + " shares" + (t.pricePerShare ? " @ $" + t.pricePerShare.toFixed(2) : "") + (t.valueUsd ? " (" + fmtMoney(t.valueUsd) + ")" : ""),
                h(ExternalLink, { href: t.sourceUrl, style: { fontSize: 9, marginLeft: 8 } }, "→ Filing"))
            ))
          )
        )
      ),

      trialsResult && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } }, "Trial pipeline (" + trialsResult.studies.length + ")"),
        trialsResult.studies.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No trials found with that sponsor name on ClinicalTrials.gov."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
          trialsResult.studies.map((s, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
              h("span", { style: { color: "var(--ink-1)" } }, s.nctId + " · " + s.phase + " · " + s.status),
              s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 9, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"),
              onWatchTrial && h("span", { onClick: () => onWatchTrial(s.nctId),
                role: "button", tabIndex: 0,
                onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatchTrial(s.nctId); } },
                style: { fontSize: 9, color: "var(--ink-3)", cursor: "pointer", textDecoration: "underline" } }, "Watch this trial →")),
            h("div", null, (s.interventions[0] || s.title) + " — " + (s.conditions[0] || ""))
          ))
        )
      ),
      trialsError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)" } }, trialsError)
    ]),
    toolCard(h, [
      toolLabel(h, "Competitor search by indication"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 10 } }, "Not tied to any case — a general research tool. Cross-references sponsors against EDGAR when running as the desktop app."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: condQuery, placeholder: "Indication / condition", onChange: e => setCondQuery(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: searchCompetitors, disabled: competitorsLoading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: competitorsLoading ? "default" : "pointer" }
        }, competitorsLoading ? "Searching…" : "Search")
      ),
      competitorsError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 8 } }, competitorsError),
      competitors && h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        competitors.studies.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No trials found for that indication."),
        competitors.studies.map((s, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 } },
            h("div", { style: { color: "var(--ink-1)", fontWeight: 700 } }, s.sponsor || "(sponsor not listed)"),
            s.publicStatus && s.publicStatus.isPublic != null && h("span", {
              style: { fontSize: 10, padding: "2px 8px", borderRadius: 10, background: s.publicStatus.isPublic ? "var(--teal-bg)" : "var(--surface)", color: s.publicStatus.isPublic ? "var(--teal)" : "var(--ink-3)", border: "1px solid " + (s.publicStatus.isPublic ? "var(--teal)" : "var(--rule)") }
            }, s.publicStatus.isPublic ? "Public" + (s.publicStatus.ticker ? " · " + s.publicStatus.ticker : "") : "Private/not found")
          ),
          h("div", { style: { color: "var(--ink-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", null, (s.interventions[0] || s.title) + " · " + s.phase + " · " + s.status),
            s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 9, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"))
        ))
      )
    ])
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
  const [importCaseId, setImportCaseId] = React.useState(activeCase ? activeCase.id : "");
  const [exportCaseId, setExportCaseId] = React.useState(activeCase ? activeCase.id : "");
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
        dilutedSharesSimple: r.dilutedShares != null ? String(r.dilutedShares) : fields.dilutedSharesSimple,
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
        h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "or"),
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
        h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Diluted shares"),
          h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtNum(capResult.dilutedShares))),
        mode === "detailed" && h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "From dilutive securities"),
          h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)" } }, "+" + fmtNum(capResult.optionShares + capResult.warrantShares + capResult.convertShares))),
        h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Fully diluted market cap"),
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

// ── Cash Runway / Burn Rate ──
function RunwayTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [companyName, setCompanyName] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [pullError, setPullError] = React.useState(null);
  const [pullResult, setPullResult] = React.useState(null);
  const [manualCash, setManualCash] = React.useState("");
  const [manualMonthlyBurn, setManualMonthlyBurn] = React.useState("");
  const [exportCaseId, setExportCaseId] = React.useState(activeCase ? activeCase.id : "");
  const [exportMsg, setExportMsg] = React.useState(null);
  const [forwardCaseId, setForwardCaseId] = React.useState(activeCase ? activeCase.id : "");
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const pull = async () => {
    if (!companyName.trim()) { setPullError("Enter a company name or ticker first."); return; }
    if (!isDesktop) { setPullError("EDGAR pull requires the desktop app — use manual entry below instead."); return; }
    setPulling(true); setPullError(null); setExportMsg(null);
    const r = await pullEdgarFinancials(companyName.trim(), false);
    if (!r.ok) { setPullError(r.error); setPullResult(null); } else { setPullResult(r); }
    setPulling(false);
  };

  const manualCashNum = Number(manualCash) || 0;
  const manualBurnNum = Number(manualMonthlyBurn) || 0;
  const manualRunway = manualBurnNum > 0 ? manualCashNum / manualBurnNum : null;

  const exportToCase = () => {
    const c = cases.find(x => x.id === exportCaseId);
    if (!c) return;
    const cash = pullResult ? pullResult.cash : (manualCashNum || null);
    const debt = pullResult ? pullResult.debt : null;
    if (cash == null) return;
    const cap = c.capitalStructure || {};
    updateCase({
      ...c, capitalStructure: { ...cap, cash: String(cash), debt: debt != null ? String(debt) : cap.debt },
      programs: appendEdgarEvidenceToPrograms(c.programs, pullResult, "Cash Runway's EDGAR pull"),
      updatedAt: Date.now()
    });
    setExportMsg("Exported to \"" + c.name + "\"");
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Cash runway — pull from EDGAR"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? Trailing vs. forward runway' },
          h("div", { style: { lineHeight: 1.6 } }, 'Two different numbers, both useful. Trailing runway divides the last reported cash balance by recent actual burn from EDGAR filings — it answers "at the rate they have really been spending, how long does the money last?" Forward runway instead uses this case\'s own modelled R&D and G&A costs, which is the right basis when you expect spending to change: a company about to start a Phase 3 will burn far more than its trailing rate implies. Neither knows about an ATM facility, an undrawn credit line, or partnership milestone cash, all of which extend the line.'))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12 } }, "Latest reported cash + quarterly operating burn from the most recent 10-Q, converted to a runway estimate."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: companyName, placeholder: "Company name or ticker", "aria-label": "Company name or ticker", onChange: e => setCompanyName(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: pull, disabled: pulling,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: pulling ? "default" : "pointer" } }, pulling ? "Pulling…" : "Pull from EDGAR")
      ),
      !isDesktop && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8 } }, "Requires the desktop app — use manual entry below in the meantime."),
      pullError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, pullError),

      pullResult && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 8 } }, "✓ ", h("b", { style: { color: "var(--teal)" } }, pullResult.name), pullResult.asOf ? " · as of " + pullResult.asOf : ""),
        h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
          h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Cash & investments"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, pullResult.cash != null ? fmtMoney(pullResult.cash) : "n/a")),
          h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Quarterly burn"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, pullResult.quarterlyBurnUSD != null ? fmtMoney(pullResult.quarterlyBurnUSD) : "n/a")),
          h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Runway"),
            h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: pullResult.runwayMonths != null && pullResult.runwayMonths < 12 ? "var(--red)" : "var(--teal)" } },
              pullResult.runwayMonths != null ? pullResult.runwayMonths.toFixed(0) + " mo" : "n/a"))
        ),
        pullResult.runwayNote && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, pullResult.runwayNote)
      )
    ]),
    toolCard(h, [
      toolLabel(h, "Manual entry"),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 } },
        h(MillionsField, { label: "Cash & investments", value: manualCash, onChange: setManualCash }),
        h(MillionsField, { label: "Monthly burn", value: manualMonthlyBurn, onChange: setManualMonthlyBurn })
      ),
      h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Runway"),
        h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: manualRunway != null && manualRunway < 12 ? "var(--red)" : "var(--teal)" } },
          manualRunway != null ? manualRunway.toFixed(0) + " months" : "—"))
    ]),

    // Forward-looking runway — from the case's own model (R&D cost timeline,
    // corporate G&A), not trailing EDGAR data. Deliberately UNRISKED (see
    // computeForwardRunway) since this answers "if the current plan
    // proceeds, when do we run out of cash," not an expected-value question.
    (() => {
      const fc = cases.find(c => c.id === forwardCaseId);
      let fr = null, frError = null;
      if (fc) {
        try { fr = computeForwardRunway(fc); } catch (e) { frError = e.message; }
      }
      return toolCard(h, [
        toolLabel(h, "Forward-looking runway — from your model"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
          "Projects the case's own cash balance forward using its modeled R&D-to-launch cost timeline and corporate G&A — not the trailing EDGAR burn rate above. Deliberately unrisked (full cost, full revenue, no PoS-weighting): this answers \"if the current plan proceeds, when do we run out of money,\" which is a cash-forecasting question, not a valuation one. Starting cash is gross, not net of debt."),
        h(CasePicker, { cases, selectedId: forwardCaseId, onChange: setForwardCaseId }),
        fc && h(IncludeInReportToggle, { theCase: fc, updateCase, reportKey: "cashRunway", label: "Include cash balance chart in PDF report" }),
        frError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 10 } }, "Calculation error: " + frError),
        fr && !frError && h("div", { style: { marginTop: 14 } },
          h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 14 } },
            h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Starting cash"),
              h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtMoney(fr.startingCash))),
            h("div", null, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Modeled runway"),
              h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 800, color: fr.runwayMonths != null && fr.runwayMonths < 12 ? "var(--red)" : "var(--teal)" } },
                fr.runwayMonths != null ? fr.runwayMonths.toFixed(0) + " mo" : "25yr+ (beyond projection window)"))
          ),
          h(ExportableBlock, { name: (fc ? fc.name : "case") + "-cash-runway", showPanelCapture: true, compact: true },
            h(RevenueChart, {
              series: [{ name: "Projected cash balance", color: "var(--teal)", points: fr.path.map(p => ({ v: p.balanceEnd, label: p.year })) }],
              height: 160, showLegend: false
            })),
          h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4 } }, "Clamped to zero for display — the model doesn't project negative cash, it projects when a raise becomes necessary.")
        )
      ]);
    })(),

    (pullResult || manualCashNum > 0) && toolCard(h, [
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: setExportCaseId }),
        h("button", { onClick: exportToCase, disabled: !exportCaseId,
          style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--amber)", background: "var(--amber-bg)", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export cash/debt to case →"),
        exportMsg && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, exportMsg)
      )
    ])
  );
}


// ── Runway vs. Catalyst ────────────────────────────────────────────────────
// Answers the question that breaks more retail biotech theses than bad
// science: can this company actually reach its next readout without raising?
// Both halves already existed and were never crossed — runway from the case's
// own modeled burn (computeForwardRunway), catalyst dates from each program's
// calibration log. Import-only for the same reason SensitivityTool is: there
// is no meaningful standalone answer without a case's own burn and dates.
function RunwayVsCatalystTool({ cases, activeCase }) {
  const h = React.createElement;
  const [caseId, setCaseId] = React.useState(activeCase ? activeCase.id : "");
  const [cushion, setCushion] = React.useState("6");
  const theCase = cases.find(c => c.id === caseId);
  const rvcRef = React.useRef(null);
  const cushionNum = cushion === "" ? 0 : Number(cushion);
  const res = theCase ? computeRunwayVsCatalysts(theCase, { cushionMonths: isFinite(cushionNum) ? cushionNum : 6 }) : null;

  const STATUS = {
    funded: { color: "var(--teal)", word: "Funded through it" },
    tight:  { color: "var(--amber)", word: "Reaches it, but on fumes" },
    gap:    { color: "var(--red)", word: "Runs out first" }
  };
  const fmtMonths = m => (m >= 0 ? "" : "−") + Math.abs(m).toFixed(1) + " mo";

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Runway vs. catalyst"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Does the company reach its next readout without having to raise first? A financing on the last few months of cash lands before any upside, usually at a discount."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        h(CasePicker, { cases, selectedId: caseId, onChange: setCaseId }),
        h("label", { style: { display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" } },
          "Cushion required at readout",
          h("input", { type: "number", value: cushion, min: 0, step: 1, onChange: e => setCushion(e.target.value),
            style: { width: 62, padding: "5px 8px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
          "mo")
      )
    ]),

    !theCase && toolCard(h, [h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)" } },
      "Pick a case. It needs starting cash and a cost model (for runway), plus at least one calibration-log entry with a date like 2027-Q2 (for the catalyst).")]),

    theCase && res && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)" } }, res.error)
    ]),

    theCase && res && res.ok && h("div", { ref: rvcRef }, toolCard(h, [
      h("div", { style: { display: "flex", gap: 26, flexWrap: "wrap", marginBottom: 14 } },
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "MODELED RUNWAY"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: (!res.beyondHorizon && res.runwayMonths < 12) ? "var(--red)" : "var(--teal)" } },
            res.beyondHorizon ? "No end" : res.runwayMonths.toFixed(0) + " mo"),
          res.beyondHorizon && h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", maxWidth: 150, lineHeight: 1.4 } },
            "modeled cash flow turns positive before cash runs out")),
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "DATED CATALYSTS"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, String(res.rows.length))),
        res.gapCount > 0 && h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "UNFUNDED"),
          h("div", { style: { fontSize: 26, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--red)" } }, String(res.gapCount)))
      ),

      // The headline judgment, stated in words rather than left to be inferred
      // from the chart.
      res.rows.length === 0
        ? h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 } },
            "No dated catalysts on this case yet. Add one in a program's calibration log with a date like \"2027-Q2\" — free-text dates such as \"H1 2027\" are deliberately left undated rather than guessed at."
            + (res.undatedCount ? " (" + res.undatedCount + " undated prediction" + (res.undatedCount > 1 ? "s" : "") + " skipped.)" : ""))
        : h("div", { style: {
            padding: "12px 14px", borderRadius: 8, lineHeight: 1.65, fontFamily: "var(--sans)", fontSize: 12,
            background: res.firstProblem ? (res.firstProblem.status === "gap" ? "var(--red-bg)" : "var(--amber-bg)") : "var(--teal-bg)",
            border: "1px solid " + (res.firstProblem ? STATUS[res.firstProblem.status].color : "var(--teal)"),
            color: "var(--ink-1)"
          } },
            res.firstProblem
              ? h("span", null,
                  h("b", { style: { color: STATUS[res.firstProblem.status].color } },
                    res.firstProblem.status === "gap" ? "Financing needed before the readout. " : "Reaches the readout with very little left. "),
                  "\"", res.firstProblem.label, "\" (", res.firstProblem.programName, ") is ",
                  res.firstProblem.monthsAway.toFixed(1), " months out, against ", res.runwayMonths.toFixed(1), " months of runway — ",
                  res.firstProblem.status === "gap"
                    ? "about " + Math.abs(res.firstProblem.cushionAtCatalyst).toFixed(1) + " months short. Expect a raise before the catalyst, and size the dilution into your entry rather than after it."
                    : "roughly " + res.firstProblem.cushionAtCatalyst.toFixed(1) + " months of cash left when it reads out, below the " + res.cushionMonths + "-month cushion. A company this close to the line usually finances ahead of the event anyway.")
              : h("span", null,
                  h("b", { style: { color: "var(--teal)" } }, "Funded through every dated catalyst. "),
                  res.beyondHorizon
                    ? "This case never runs out of cash in the 25-year projection — modeled cash flow turns positive first, so no dated catalyst is financing-constrained. That is a property of your revenue assumptions, so it is only as safe as they are."
                    : "Runway covers all " + res.rows.length + " with at least the " + res.cushionMonths + "-month cushion. That removes forced-financing risk from the thesis — it does not remove the risk of an opportunistic raise into strength.")
          ),

      // Timeline: runway as a bar, catalysts as markers along the same axis.
      (() => {
        if (!res.rows.length) return null;
        const horizon = (res.beyondHorizon ? Math.max(...res.rows.map(r => r.monthsAway)) : Math.max(res.runwayMonths, ...res.rows.map(r => r.monthsAway))) * 1.15 || 12;
        const pct = m => Math.max(0, Math.min(100, (m / horizon) * 100));
        return h("div", { style: { marginTop: 18 } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 } }, "Timeline from today"),
          h("div", { style: { position: "relative", height: 26, borderRadius: 5, background: "var(--surface-2)", overflow: "hidden", marginBottom: 6 } },
            h("div", { title: res.beyondHorizon ? "Cash never runs out in the projection window" : "Modeled runway: " + res.runwayMonths.toFixed(1) + " months",
              style: { position: "absolute", left: 0, top: 0, bottom: 0, width: (res.beyondHorizon ? 100 : pct(res.runwayMonths)) + "%", background: "var(--teal)", opacity: 0.35 } }),
            !res.beyondHorizon && h("div", { style: { position: "absolute", left: pct(res.runwayMonths) + "%", top: 0, bottom: 0, width: 2, background: "var(--teal)" } })
          ),
          h("div", { style: { position: "relative", height: 8 + res.rows.length * 26 } },
            res.rows.map((r, i) => h("div", { key: i, style: { position: "absolute", top: i * 26, left: 0, right: 0, height: 22 } },
              h("div", { title: r.label + " — " + r.dateText, style: { position: "absolute", left: pct(r.monthsAway) + "%", top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" } },
                h("div", { style: { width: 2, height: 8, background: STATUS[r.status].color } }),
                h("div", { style: { width: 9, height: 9, borderRadius: "50%", background: STATUS[r.status].color, marginTop: -1 } })),
              h("div", { style: { position: "absolute", left: "calc(" + pct(r.monthsAway) + "% + 10px)", top: 1, fontFamily: "var(--mono)", fontSize: 10, color: STATUS[r.status].color, whiteSpace: "nowrap" } },
                r.label + " · " + r.dateText)
            ))
          ),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", marginTop: 4 } },
            h("span", null, "today"), h("span", null, "+" + (horizon / 2).toFixed(0) + " mo"), h("span", null, "+" + horizon.toFixed(0) + " mo")),
          h(ExportControls, { targetRef: rvcRef, name: (theCase ? theCase.name : "case") + "-runway-vs-catalyst", panelOnly: true, compact: true })
        );
      })(),

      // Per-catalyst detail.
      res.rows.length > 0 && h("div", { style: { marginTop: 20, display: "flex", flexDirection: "column", gap: 7 } },
        res.rows.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "9px 12px", borderRadius: 7, background: "var(--surface-2)", borderLeft: "3px solid " + STATUS[r.status].color } },
          h("div", null,
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-1)" } }, r.label),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } },
              r.programName, " · ", r.dateText, " · ", r.monthsAway.toFixed(1), " mo out")),
          h("div", { style: { textAlign: "right", flexShrink: 0 } },
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: STATUS[r.status].color } }, STATUS[r.status].word),
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } },
              res.beyondHorizon ? "never runs out" : fmtMonths(r.cushionAtCatalyst) + " of cash at readout"))
        ))
      ),

      res.undatedCount > 0 && res.rows.length > 0 && h("div", { style: { marginTop: 12, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" } },
        res.undatedCount, " further prediction" + (res.undatedCount > 1 ? "s" : "") + " had no parseable date and " + (res.undatedCount > 1 ? "were" : "was") + " left out rather than guessed at."),

      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "What this runway figure doesn't know about" },
          h("div", { style: { lineHeight: 1.6 } },
            "It is the case's own modeled burn carried forward in nominal dollars. It does not know about an ATM already in place, an undrawn credit facility, or partnership milestone cash — all of which push the line right. Treat a gap as \"check how they intend to fund this\", not as a prediction that they won't.")))
    ]))
  );
}


// ── Exclusivity / Loss of Exclusivity ──────────────────────────────────────
// The app already models revenue erosion AFTER loss of exclusivity, but the
// LOE year itself was a pure user guess. This replaces the guess with the real
// patent set FDA publishes for a comparable approved drug.
//
// Deliberately does NOT collapse to a single "LOE year". The last patent to
// expire is often a formulation or method-of-use patent a generic can design
// around or challenge under Paragraph IV; the drug SUBSTANCE (compound) patent
// is the hard floor. Showing both, labelled, is honest — one number would be
// false precision dressed up as sourced data.
function ExclusivityTool({ cases, updateCase }) {
  const h = React.createElement;
  const [name, setName] = React.useState("");
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const exRef = React.useRef(null);

  const run = async () => {
    if (!name.trim()) return;
    setLoading(true); setRes(null);
    try { setRes(await fetchExclusivity(name)); }
    catch (e) { setRes({ ok: false, error: e.message }); }
    setLoading(false);
  };
  const fmtDate = d => d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") : "—";
  const fmtYears = y => y == null ? "" : (y < 0 ? "expired " + Math.abs(y).toFixed(1) + "y ago" : "in " + y.toFixed(1) + "y");

  const s = res && res.ok ? res.summary : null;
  const KeyDate = ({ label, row, tone, note }) => h("div", { style: { flex: "1 1 190px" } },
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, label),
    h("div", { style: { fontSize: 24, fontFamily: "var(--mono)", fontWeight: 800, color: tone } }, row ? fmtDate(row.expiry) : "—"),
    row && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, fmtYears(row.yearsAway), " · US", row.patentNumber),
    note && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45, maxWidth: 230 } }, note)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Exclusivity / loss of exclusivity"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? What to look up and why' },
          h("div", { style: { lineHeight: 1.6 } }, 'Search an already-approved drug that resembles the one you are modelling — same modality, similar class. What you are after is how long its protection actually ran, which is the sourced basis for the loss-of-exclusivity year in your revenue build instead of a guess. Use the brand name (Eliquis, not apixaban) since that is how the Orange Book indexes products. Two dates come back and they can be many years apart: the substance-patent floor is the compound patent, the hardest barrier for a generic to design around, and the last-expiry date includes formulation and method-of-use patents that are far easier to challenge. The substance floor is usually the more defensible read. Biologics are not in the Orange Book at all — the tool says so rather than returning an empty result.'))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Live patent expiry from FDA's Orange Book — where the LOE year comes from instead of a guess. Look up an approved comparable in the same class."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("input", { value: name, placeholder: "Brand name — e.g. Eliquis, Jardiance, Uptravi",
          onChange: e => setName(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 300px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: run, disabled: loading || !name.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: name.trim() ? 1 : 0.5 } },
          loading ? "Searching…" : "Look up")
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } },
        "Small molecules only — the Orange Book does not cover biologics.")
    ]),

    res && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: res.isBiologic ? "var(--ink-1)" : "var(--amber)" } }, res.error)
    ]),

    s && h("div", { ref: exRef }, toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginBottom: 14 } },
        res.brandName.toUpperCase(), " · ", s.uniquePatentCount, " distinct patent", s.uniquePatentCount === 1 ? "" : "s",
        s.pediatricExtensionCount > 0 ? " + " + s.pediatricExtensionCount + " pediatric extension" + (s.pediatricExtensionCount === 1 ? "" : "s") : "",
        " across ", res.recordCount, " Orange Book listing", res.recordCount === 1 ? "" : "s"),

      h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 } },
        h(KeyDate, { label: "Substance patent floor", row: s.latestSubstance, tone: "var(--teal)",
          note: "The compound patent — the hardest to design around. Usually the most defensible read on when generics can realistically enter." }),
        h(KeyDate, { label: "Last patent to expire", row: s.latest, tone: "var(--amber)",
          note: "Includes formulation and method-of-use patents, which a generic may design around or challenge. Treat as an upper bound, not a promise." }),
        h(KeyDate, { label: "First patent to expire", row: s.earliest, tone: "var(--ink-2)",
          note: "The earliest date any listed protection lapses." })
      ),

      !s.latestSubstance && h("div", { style: { padding: "10px 12px", borderRadius: 7, background: "var(--amber-bg)", border: "1px solid var(--amber)", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-1)", lineHeight: 1.55, marginBottom: 14 } },
        "No patent here is flagged as a drug-substance (compound) patent — every listed patent is formulation or method-of-use. That's a genuinely weaker position: those are the patents most often designed around or challenged, so the last-expiry date above is a soft ceiling."),

      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 } }, "All listed patents"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" } },
        s.all.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 11px", borderRadius: 6, background: "var(--surface-2)" } },
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-1)" } },
            "US", r.patentNumber,
            r.isSubstance && h("span", { style: { color: "var(--teal)", marginLeft: 8, fontSize: 10 } }, "substance"),
            r.pediatric && h("span", { style: { color: "var(--amber)", marginLeft: 8, fontSize: 10 } }, "+6mo pediatric"),
            r.useCode && !r.isSubstance && h("span", { style: { color: "var(--ink-3)", marginLeft: 8, fontSize: 10 } }, "method-of-use")),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", flexShrink: 0 } },
            fmtDate(r.expiry), h("span", { style: { color: "var(--ink-3)", marginLeft: 8 } }, fmtYears(r.yearsAway)))
        ))
      ),

      h("div", { style: { marginTop: 12 } },
        h(PinToReportButton, { targetRef: exRef, title: "Exclusivity / LOE — " + (res.brandName || "").toUpperCase(), source: "Tools", cases, updateCase, compact: true })),
      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "Patent expiry is not the same as loss of exclusivity" },
          h("div", { style: { lineHeight: 1.6 } },
            "A generic can challenge a patent before it expires (Paragraph IV), settle for an earlier agreed entry date, or design around a formulation patent entirely. Separately, regulatory exclusivities — new chemical entity, orphan — can run past a patent. This is the published patent landscape: a sourced starting point, not the verdict."))),
      h("div", { style: { marginTop: 10 } },
        h(ExportControls, { targetRef: exRef, name: "exclusivity-" + (res.brandName || "drug").toLowerCase(), panelOnly: true, compact: true }))
    ]))
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
function BinaryEventTool({ cases, activeCase }) {
  const h = React.createElement;
  const [current, setCurrent] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [fail, setFail] = React.useState("");
  const [yourPoS, setYourPoS] = React.useState("");
  const [unit, setUnit] = React.useState("perShare");
  const beRef = React.useRef(null);

  const res = computeBinaryEventImpliedPoS({ currentValue: current, successValue: success, failValue: fail, yourPoSPct: yourPoS });
  const showing = current !== "" && success !== "" && fail !== "";
  const sym = unit === "perShare" ? "$" : "$";
  const suffix = unit === "marketCap" ? "M" : "";
  const fmt = v => sym + (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)) + suffix;

  const field = (label, value, onChange, placeholder, hint) => h("div", { style: { flex: "1 1 150px" } },
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 4 } }, label),
    h("input", { type: "number", value, placeholder, onChange: e => onChange(e.target.value),
      style: { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
    hint && h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3, lineHeight: 1.4 } }, hint)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Binary event — implied probability"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? Where the three numbers come from' },
          h("div", { style: { lineHeight: 1.6 } }, "Today is just the current share price (or market cap — pick which with the selector). If it works is what you think the company is worth once the drug is approved and selling: your own fair value, or a comparable approved company's valuation. If it fails is the floor — usually net cash plus whatever the rest of the pipeline is worth, NOT zero, because a failed biotech still has a balance sheet. That failure number is where most of the error lives, and it is worth more thought than the upside: set it too high and the implied probability looks artificially low, making everything seem cheap. Your PoS is optional; leave it blank to just read what the market is pricing, or fill it in to see the gap between your view and the price."))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Given what it's worth if the trial works, what it's worth if it doesn't, and today's price, the probability the market is pricing follows exactly. The useful output is the gap between that and your own estimate."),
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 } },
        h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Values are:"),
        h("select", { "aria-label": "Value units", value: unit, onChange: e => setUnit(e.target.value),
          style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "perShare" }, "per share"),
          h("option", { value: "marketCap" }, "market cap ($M)"))
      ),
      h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
        field("Today", current, setCurrent, "10", "what it costs now"),
        field("If it works", success, setSuccess, "30", "your success-case value"),
        field("If it fails", fail, setFail, "5", "cash/other assets left"),
        field("Your PoS (%)", yourPoS, setYourPoS, "40", "optional — your own odds")
      )
    ]),

    showing && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)" } }, res.error)
    ]),

    showing && res.ok && h("div", { ref: beRef }, toolCard(h, [
      h("div", { style: { display: "flex", gap: 30, flexWrap: "wrap", marginBottom: 16 } },
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Market-implied PoS"),
          h("div", { style: { fontSize: 34, fontFamily: "var(--mono)", fontWeight: 800, color: res.rangeFlag ? "var(--amber)" : "var(--teal)" } },
            res.impliedPoSPct.toFixed(1) + "%"),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "also the breakeven — below this you lose money on average")),
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Upside / downside"),
          h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, marginTop: 6 } },
            h("span", { style: { color: "var(--teal)" } }, "+" + res.upsidePct.toFixed(0) + "%"),
            h("span", { style: { color: "var(--ink-3)" } }, "  /  "),
            h("span", { style: { color: "var(--red)" } }, res.downsidePct.toFixed(0) + "%")),
          res.riskReward != null && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
            res.riskReward.toFixed(1) + ":1 reward-to-risk")),
        res.edgePoSPct != null && h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Your edge"),
          h("div", { style: { fontSize: 34, fontFamily: "var(--mono)", fontWeight: 800, color: res.edgePoSPct > 0 ? "var(--teal)" : res.edgePoSPct < 0 ? "var(--red)" : "var(--ink-2)" } },
            (res.edgePoSPct > 0 ? "+" : "") + res.edgePoSPct.toFixed(1) + "pts"),
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "your PoS vs. the market's"))
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
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", marginTop: 4 } },
            h("span", null, "0% — fails ", fmt(res.fail)),
            h("span", null, "100% — works ", fmt(res.success))),
          res.yourPoSPct != null && h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--amber)", marginTop: 3 } },
            "amber line = your ", res.yourPoSPct, "% estimate")
        );
      })(),

      res.rangeFlag && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--amber-bg)", border: "1px solid var(--amber)", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-1)", lineHeight: 1.6, marginBottom: 14 } },
        res.rangeFlag === "belowFailure"
          ? h("span", null, h("b", null, "Trading below your failure case. "),
              "The implied probability is negative, which can't be true — so one of your inputs is. Either the market disputes that " + fmt(res.fail) + " of value survives a failure (often the case when the cash burns down before liquidation), or it's genuinely mispriced. Check the failure floor before treating this as free money.")
          : h("span", null, h("b", null, "Trading above your success case. "),
              "The implied probability exceeds 100%, so the market is paying for more than this single readout — another asset, a platform, or a takeout premium your two anchors don't capture. The binary frame is too narrow here.")),

      res.expectedValue != null && h("div", { style: { padding: "12px 14px", borderRadius: 8, lineHeight: 1.65, fontFamily: "var(--sans)", fontSize: 12,
          background: res.evVsCurrentPct > 0 ? "var(--teal-bg)" : "var(--red-bg)", border: "1px solid " + (res.evVsCurrentPct > 0 ? "var(--teal)" : "var(--red)"), color: "var(--ink-1)" } },
        h("b", { style: { color: res.evVsCurrentPct > 0 ? "var(--teal)" : "var(--red)" } },
          "Expected value at your " + res.yourPoSPct + "% : " + fmt(res.expectedValue) + " "),
        res.evVsCurrentPct > 0
          ? "— " + res.evVsCurrentPct.toFixed(0) + "% above today's " + fmt(res.current) + ". You're more optimistic than the market by " + res.edgePoSPct.toFixed(1) + " points; that difference is the whole position, so it's worth asking what the market knows that you don't."
          : "— " + Math.abs(res.evVsCurrentPct).toFixed(0) + "% below today's " + fmt(res.current) + ". On your own odds this is priced above fair value, which is a reason to wait rather than to revise the odds upward to justify it."),

      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "When the binary frame stops holding" },
          h("div", { style: { lineHeight: 1.6 } },
            "This treats the readout as the only thing that matters — exactly true for a single-asset company, progressively less true otherwise. A pipeline, a partner, or a cash-rich balance sheet all put a floor under failure and blur the binary. And the implied probability is only as good as the two values you anchored it with: it is arithmetic on your assumptions, not an independent read on the market."))),
      h("div", { style: { marginTop: 10 } },
        h(ExportControls, { targetRef: beRef, name: "binary-event-implied-probability", panelOnly: true, compact: true }))
    ]))
  );
}

// ── Sensitivity Analysis: which single assumption swings fair value most ──
// Import-only by design — there's no meaningful standalone sensitivity without
// a case's own assumptions to perturb. Reuses the exact same computeCaseValuation
// pipeline as the workspace (via custom one-off scenario presets), so results are
// guaranteed consistent with what you'd see there — no separate/duplicated math.
function SensitivityTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [caseId, setCaseId] = React.useState(activeCase ? activeCase.id : "");
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
      h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 14 } },
        "Base fair value: ", h("b", { style: { color: "var(--teal)" } }, fmtShare(baseline))),
      h(ExportableBlock, { name: (theCase ? theCase.name : "case") + "-sensitivity-tornado", panelOnly: true, compact: true },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
          rows.map((r, i) => h("div", { key: i },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)", marginBottom: 4 } },
              h("span", { style: { color: "var(--ink-1)", fontWeight: 700 } }, r.name),
              h("span", { style: { color: "var(--ink-3)" } }, r.lo != null ? fmtShare(r.lo) + " — " + fmtShare(r.hi) : "—")),
            h("div", { style: { height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (maxSwing > 0 ? (r.swing / maxSwing) * 100 : 0) + "%", background: "var(--amber)", borderRadius: 4 } })),
            h("div", { style: { display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" } },
              r.values.map((v, j) => h("span", { key: j, style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, v.label + ": " + fmtShare(v.value)))
            )
          ))
        ))
    ]),

    theCase && !error && gridData && toolCard(h, [
      toolLabel(h, "Price target grid — Peak Revenue × PoS"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
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
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, "Highlighted cell = current Base scenario (100% / 100%).")
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
  const [exportCaseId, setExportCaseId] = React.useState(activeCase ? activeCase.id : "");
  const [exportProgramId, setExportProgramId] = React.useState(activeCase && activeCase.programs[0] ? activeCase.programs[0].id : "");
  const [selectedDrugIdx, setSelectedDrugIdx] = React.useState(null);
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
    return peakB != null && peakB > 0 ? { drug: (p.drugName || p.name) + " (your case)", company: exportCase.name, peakSalesB: peakB, _own: true } : null;
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
    setExportMsg("Exported " + drug.drug + "'s peak sales ($" + drug.peakSalesB + "B) to \"" + (progName ? (progName.drugName || progName.name) : "program") + "\" in \"" + exportCase.name + "\"");
  };

  // Every program in the export-target case, not just the one selected for
  // export — a multi-asset company should show all its assets on the chart,
  // each in its own correctly-sorted position, not just one.
  const ownDrugs = (exportCase ? exportCase.programs : []).map(p => {
    let peakB = null;
    try { peakB = getProgramRevenueResult(p, 25).peakTotalRevenue / 1e9; } catch (e) {}
    return peakB != null && peakB > 0 ? { drug: p.drugName || p.name, peakSalesB: peakB, _own: true } : null;
  }).filter(Boolean);

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Peak sales comps"),
      customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10 } },
        "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
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
            "Amber = " + (exportCase ? exportCase.name : "your case") + "'s own asset" + (ownDrugs.length > 1 ? "s" : "") + " (" + ownDrugs.map(d => d.drug + " $" + d.peakSalesB.toFixed(2) + "B").join(", ") + ") — shown in its correct position among real comps, not pinned to the bottom."),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 3, maxHeight: 320, overflowY: "auto" } },
            chartDrugs.map((d, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8 } },
              h("div", { style: { width: 90, fontSize: 9, fontFamily: "var(--mono)", color: d._own ? "var(--amber)" : "var(--ink-3)", fontWeight: d._own ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 } }, d.drug),
              h("div", { style: { flex: 1, height: 12, borderRadius: 3, background: "var(--surface)", overflow: "hidden" } },
                h("div", { style: { height: "100%", width: (d.peakSalesB / maxB) * 100 + "%", background: d._own ? "var(--amber)" : "var(--teal)", opacity: d._own ? 1 : 0.75, borderRadius: 3 } })),
              h("div", { style: { width: 46, fontSize: 9, fontFamily: "var(--mono)", color: d._own ? "var(--amber)" : "var(--ink-2)", fontWeight: d._own ? 700 : 400, textAlign: "right", flexShrink: 0 } }, "$" + d.peakSalesB.toFixed(1) + "B")
            ))
          )
        );
      })(),

      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("input", { type: "text", value: filter, placeholder: "Filter by drug, company, area…", onChange: e => setFilter(e.target.value),
          style: { flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => downloadCSV("RxNPV-Peak-Sales-Comps.csv",
            ["Drug", "Company", "Area", "Modality", "Peak Sales ($B)", "As Of Year", "Status"],
            filtered.map(d => [d.drug, d.company, d.area, d.modality, d.peakSalesB, d.asOfYear, d.status])),
          style: { padding: "7px 14px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Export CSV")
      ),

      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
        h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Export target:"),
        h(CasePicker, { cases, selectedId: exportCaseId, onChange: id => { setExportCaseId(id); setExportMsg(null); } }),
        exportCase && h(IncludeInReportToggle, { theCase: exportCase, updateCase, reportKey: "peakSalesComps", label: "Include comp chart in PDF report" }),
        exportCase && h("select", { "aria-label": "Program to export to", value: exportProgramId, onChange: e => setExportProgramId(e.target.value),
          style: { padding: "6px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          exportCase.programs.map(p => h("option", { key: p.id, value: p.id }, p.drugName || p.name))
        )
      ),
      exportMsg && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)", marginBottom: 10 } }, exportMsg),

      h("div", { style: { marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--rule)" } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 } }, "Where this case sits among real comps"),
        h(ExportableBlock, { name: (exportCase ? exportCase.name : "case") + "-peak-sales-rank", panelOnly: true, compact: true },
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
              h("span", { style: { fontFamily: "var(--mono)", fontSize: 15, fontWeight: 700, color: "var(--amber)" } }, "$" + d.peakSalesB + "B"),
              h("button", { onClick: () => exportToCase(d), disabled: !exportCaseId || !exportProgramId,
                style: { padding: "4px 10px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: exportCaseId ? "pointer" : "default", opacity: exportCaseId ? 1 : 0.5 } }, "Export →"),
              d._custom && h("button", { onClick: () => { setEditingDrugIdx(customPeakSales.indexOf(d)); setShowAddDrug(false); }, style: { padding: "4px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Edit"),
              d._custom && h(ConfirmXButton, { onConfirm: () => deleteCustomDrug(customPeakSales.indexOf(d)), title: "Delete this custom drug" }))
          ),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", marginTop: 3 } },
            d.area, " · ", d.modality, d.asOfYear ? " · " + d.asOfYear : ""),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2 } }, d.status),
          h("div", { style: { marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--rule)" } },
            !fdaData[d.drug] && h("button", { onClick: () => lookupFDA(d.drug), disabled: fdaLoading === d.drug,
              style: { padding: "5px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 9, cursor: fdaLoading === d.drug ? "default" : "pointer" } },
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
  const [exportCaseId, setExportCaseId] = React.useState(activeCase ? activeCase.id : "");
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
    setExportMsg("Exported " + deal.licensor + "/" + deal.licensee + " terms to \"" + (progName ? (progName.drugName || progName.name) : "program") + "\" — enabled Partnership Economics with this deal's upfront" + (deal.royaltyLow != null ? " and royalty midpoint" : "") + ".");
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Licensing / royalty deal comps"),
      customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10 } },
        "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Real out-license deals — what a company received for granting a partner development/commercialization rights, in upfront cash, milestones, and royalties. A sanity check for the Partnership Economics overlay, and exportable straight into it. Every deal below is confirmed against the companies' own disclosures, not a single secondary source."),

      h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
        h("input", { type: "text", value: filter, placeholder: "Filter by company, asset, area…", onChange: e => setFilter(e.target.value),
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
          exportCase.programs.map(p => h("option", { key: p.id, value: p.id }, p.drugName || p.name))),
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
                  style: { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: (exportCase && exportProgramId) ? "pointer" : "default", opacity: (exportCase && exportProgramId) ? 1 : 0.5 } }, "Export →"),
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

// ── Catalyst Calendar: pulls upcoming events across multiple cases at once.
// HONEST SCOPE: there is no public, structured API for actual PDUFA/FDA
// decision dates — those get reported by companies via press release/8-K only
// once announced, not published anywhere queryable in advance. What IS
// genuinely available: each trial's own estimated completion date from
// ClinicalTrials.gov (a real signal for "when might we see a readout"), and
// each company's most recent SEC filings for context on what's already
// happened. This tool is upfront about that distinction rather than implying
// more certainty than the data supports.
function CatalystCalendarTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [selectedIds, setSelectedIds] = React.useState(() => new Set(cases.map(c => c.id)));
  const [loading, setLoading] = React.useState(false);
  const [upcomingEvents, setUpcomingEvents] = React.useState(null);
  const [recentFilings, setRecentFilings] = React.useState(null);
  const [catalystFilings, setCatalystFilings] = React.useState(null);
  const [error, setError] = React.useState(null);
  const reqSeq = React.useRef(0);
  const isDesktop = typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

  const toggleCase = (id) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const pullEvents = async () => {
    const myReq = ++reqSeq.current;
    setLoading(true); setError(null); setUpcomingEvents(null); setRecentFilings(null); setCatalystFilings(null);
    const selectedCases = cases.filter(c => selectedIds.has(c.id));
    const today = new Date();
    // Per-source failure counts. Every one of these used to be dropped on the
    // floor, so a total outage produced "No future-dated trial completion
    // estimates found" — visually identical to a genuinely quiet calendar.
    let ctTried = 0, ctFailed = 0, edgarTried = 0, edgarFailed = 0;

    // CT.gov: upcoming trial completion estimates, per program
    const trialPromises = [];
    selectedCases.forEach(c => c.programs.forEach(p => {
      if (p.drugName && p.drugName.trim()) {
        ctTried++;
        trialPromises.push(
          searchTrialsForDrug(p.drugName, 5)
            .then(r => ({ caseName: c.name, progName: p.drugName, result: r }))
            .catch(e => ({ caseName: c.name, progName: p.drugName, result: { ok: false, error: e && e.message } }))
        );
      }
    }));
    const trialResults = await Promise.all(trialPromises);
    if (myReq !== reqSeq.current) return; // superseded by a newer pull
    const events = [];
    trialResults.forEach(({ caseName, progName, result }) => {
      if (!result.ok) { ctFailed++; return; }
      result.studies.forEach(s => {
        const dateStr = s.primaryCompletionDate || s.completionDate;
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d.getTime()) || d < today) return; // only future estimates
        events.push({ caseName, progName, date: dateStr, dateObj: d, nctId: s.nctId, phase: s.phase, status: s.status, title: s.title, hasResults: s.hasResults });
      });
    });
    events.sort((a, b) => a.dateObj - b.dateObj);
    setUpcomingEvents(events);

    // EDGAR: recent filings + catalyst-keyword full-text search, per case (desktop only)
    if (isDesktop) {
      const filingPromises = selectedCases.filter(c => c.ticker || c.name).map(c => {
        edgarTried++;
        return pullEdgarFinancials(c.ticker || c.name, false)
          .then(r => ({ caseName: c.name, result: r }))
          .catch(e => ({ caseName: c.name, result: { ok: false, error: e && e.message } }));
      });
      const filingResults = await Promise.all(filingPromises);
      if (myReq !== reqSeq.current) return;
      const filings = [];
      filingResults.forEach(({ caseName, result }) => {
        // Only a reachability failure counts against us here — a company that
        // genuinely has no CIK is a real answer, not an outage.
        if (!result.ok) { if (result.unreachable) edgarFailed++; return; }
        (result.recentFilings || []).forEach(f => filings.push({ caseName, ...f }));
      });
      filings.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentFilings(filings);

      // Catalyst-keyword search: resolve each case's CIK, then search its own
      // filing TEXT for catalyst language (PDUFA, topline, advisory committee,
      // etc.) rather than just listing recent filings by type.
      const catalystPromises = selectedCases.filter(c => c.ticker || c.name).map(async c => {
        try {
          const cikInfo = await findCIK(c.ticker || c.name);
          if (!cikInfo || !cikInfo.cik) return { caseName: c.name, hits: [] };
          const r = await searchCatalystFilings(cikInfo.cik, 12);
          return { caseName: c.name, hits: r.ok ? r.hits : [], failed: !r.ok };
        } catch (e) { return { caseName: c.name, hits: [], failed: true }; }
      });
      const catalystResults = await Promise.all(catalystPromises);
      if (myReq !== reqSeq.current) return;
      const catalystHits = [];
      catalystResults.forEach(({ caseName, hits, failed }) => {
        if (failed) edgarFailed++;
        hits.forEach(h => catalystHits.push({ caseName, ...h }));
      });
      catalystHits.sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
      setCatalystFilings(catalystHits);
    }

    // Say so when the empty result below is actually a failed lookup. Without
    // this, an outage and a genuinely quiet calendar render identically.
    const parts = [];
    if (ctTried && ctFailed) parts.push(ctFailed === ctTried
      ? "none of the " + ctTried + " ClinicalTrials.gov lookups succeeded"
      : ctFailed + " of " + ctTried + " ClinicalTrials.gov lookups failed");
    if (edgarTried && edgarFailed) parts.push(edgarFailed >= edgarTried
      ? "SEC EDGAR could not be reached"
      : "some SEC EDGAR lookups failed");
    if (parts.length) setError("Incomplete results — " + parts.join(", ") + ". Anything missing below may be a connection problem rather than a genuinely empty calendar.");

    setLoading(false);
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Catalyst calendar"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Pulls estimated trial completion dates from ClinicalTrials.gov, plus searches each company's own SEC filings for catalyst language (PDUFA, topline results, advisory committee, breakthrough/priority designations) instead of just listing recent filings by type. ",
        h("b", { style: { color: "var(--amber)" } }, "Worth knowing: "), "there's still no public structured API for actual PDUFA/FDA decision dates — a filing search finds where a company has already *mentioned* one, not a calendar of dates that haven't been announced yet."),

      h("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, maxHeight: 150, overflowY: "auto" } },
        cases.map(c => h("label", { key: c.id, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)", cursor: "pointer" } },
          h("input", { type: "checkbox", checked: selectedIds.has(c.id), onChange: () => toggleCase(c.id) }),
          c.name + (c.ticker ? " (" + c.ticker + ")" : "") + " — " + c.programs.length + " program" + (c.programs.length !== 1 ? "s" : "")
        )),
        cases.length === 0 && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No cases yet — create one in Workspace first.")
      ),

      h("button", { onClick: pullEvents, disabled: loading || selectedIds.size === 0,
        style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
      }, loading ? "Pulling…" : "Pull events"),
      error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 10 } }, error)
    ]),

    upcomingEvents && toolCard(h, [
      toolLabel(h, "Upcoming — estimated trial completions (" + upcomingEvents.length + ")"),
      upcomingEvents.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No future-dated trial completion estimates found for these programs."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
        upcomingEvents.map((e, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("span", { style: { color: "var(--teal)", fontWeight: 700 } }, e.date),
            h("span", { style: { color: "var(--ink-3)" } }, e.caseName + " · " + e.progName)),
          h("div", { style: { color: "var(--ink-1)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            h("span", null, e.nctId + " · " + e.phase + " · " + e.status),
            e.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + e.nctId + "?tab=results", style: { fontSize: 9, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →")),
          h("div", { style: { color: "var(--ink-2)", marginTop: 2 } }, e.title)
        ))
      )
    ]),

    catalystFilings && toolCard(h, [
      toolLabel(h, "Catalyst-language filings (" + catalystFilings.length + ")"),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10 } },
        "Filings from the last 12 months whose text matches catalyst-relevant language (PDUFA, topline results, advisory committee, breakthrough/priority/fast-track designations, NDA/BLA submissions)."),
      catalystFilings.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No catalyst-language matches found in the last 12 months."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" } },
        catalystFilings.map((f, i) => h("div", { key: i, style: { padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("span", { style: { color: "var(--ink-1)", fontWeight: 700 } }, f.fileDate + " · " + f.formType),
            h("span", { style: { color: "var(--ink-3)" } }, f.caseName)),
          f.filingUrl && h(ExternalLink, { href: f.filingUrl, style: { fontSize: 10, marginTop: 2, display: "inline-block" } }, "→ View filing")
        ))
      )
    ]),

    recentFilings && toolCard(h, [
      toolLabel(h, "Recent SEC filings (" + recentFilings.length + ")"),
      recentFilings.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No recent filings found."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" } },
        recentFilings.map((f, i) => h("div", { key: i, style: { padding: "6px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 11, fontFamily: "var(--mono)", display: "flex", justifyContent: "space-between" } },
          h("span", { style: { color: "var(--ink-1)" } }, f.date + " · " + f.form),
          h("span", { style: { color: "var(--ink-3)" } }, f.caseName)
        ))
      )
    ]),
    !isDesktop && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "0 4px" } }, "SEC filing search (recent filings and catalyst-language matches) requires the desktop app — trial completion estimates work either way.")
  );
}

// ── FDA Lookup: openFDA drug approval history, label summary, and
// adverse-event report volume. Moved here from the Simulation section — this
// is research about an already-approved (or already-filed) drug, the same
// kind of live-lookup work as Company Lookup and Trial Explorer, not a
// simulation. Ported from ts_app.js's vanilla-DOM renderFdaLookupTab/
// runFdaLookup with no functional change; the fuller version (all dates,
// complete label detail) is planned as a separate deepening pass. ──
function truncateText(str, n) { return str.length > n ? str.slice(0, n) + "…" : str; }

function fmtFdaSubmissionDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "—";
  return yyyymmdd.slice(0, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8);
}

function FdaLookupTool() {
  const h = React.createElement;
  const [drugName, setDrugName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [approval, setApproval] = React.useState(null);
  const [label, setLabel] = React.useState(null);
  const [adverseEvents, setAdverseEvents] = React.useState(null);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState(null);
  // Guards against an earlier, slower search overwriting a newer one: search
  // "Keytruda", correct yourself to "Opdivo", and whichever response happened
  // to land last used to win regardless of which you actually asked for.
  const reqSeq = React.useRef(0);

  const search = async () => {
    const name = drugName.trim();
    if (!name) return;
    const myReq = ++reqSeq.current;
    setLoading(true); setSearched(true); setError(null);
    setApproval(null); setLabel(null); setAdverseEvents(null);
    const [approvalR, labelR, aeR] = await Promise.allSettled([
      fetchApprovalHistory(name),
      fetchDrugLabel(name),
      fetchAdverseEventSummary(name, { limit: 25 })
    ]);
    if (myReq !== reqSeq.current) return; // a newer search has already started
    if (approvalR.status === "fulfilled") setApproval(approvalR.value);
    if (labelR.status === "fulfilled") setLabel(labelR.value);
    if (aeR.status === "fulfilled") setAdverseEvents(aeR.value);
    // Every one of these throws on a real failure rather than returning a
    // falsy result, and only the fulfilled branch was ever read — so an
    // openFDA outage left all three null and rendered the identical "no data
    // found" message a genuinely unknown drug gets. For an investing tool
    // that is a meaningful difference: "this drug has no FDA record" and "we
    // could not reach the FDA" should never look the same.
    const failures = [approvalR, labelR, aeR].filter(x => x.status === "rejected");
    if (failures.length) {
      const detail = (failures[0].reason && failures[0].reason.message) || "request failed";
      setError(failures.length === 3
        ? "Couldn't reach openFDA — " + detail + ". This is a connection problem, not a result: try again in a moment."
        : "Partial result — " + failures.length + " of 3 openFDA queries failed (" + detail + "). What's shown below is incomplete.");
    }
    setLoading(false);
  };

  const hasApproval = approval && approval.matches;
  const hasLabel = label && label.found;
  const hasAE = adverseEvents && adverseEvents.topReportedReactions.length > 0;
  // Only a genuine zero-result response counts as "not found" — never a failure.
  const noResults = searched && !loading && !error && !hasApproval && !hasLabel && !hasAE;

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search openFDA"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Live query against openFDA (free, public API). Pulls approval history, label summary, and adverse-event report volume for a brand or generic drug name."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("input", { type: "text", value: drugName, placeholder: "Brand or generic name", "aria-label": "Drug name", onChange: e => setDrugName(e.target.value),
          onKeyDown: e => { if (e.key === "Enter") search(); },
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
        }, loading ? "Searching…" : "Search openFDA")
      )
    ]),

    error && toolCard(h, h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--amber)", lineHeight: 1.6 } }, error)),

    noResults && toolCard(h, h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No openFDA data found for that name. Try the exact brand or generic name.")),

    hasApproval && toolCard(h, [
      toolLabel(h, "Drugs@FDA approval history"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        approval.results.map((r, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", paddingBottom: 10, borderBottom: i < approval.results.length - 1 ? "1px solid var(--rule)" : "none" } },
          h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 4 } }, (r.applicationNumber || "—") + " — " + (r.sponsorName || "unknown sponsor")),
          r.products.map((p, pi) => h("div", { key: pi, style: { color: "var(--ink-2)" } }, p.brandName + ": " + [p.dosageForm, p.route, p.marketingStatus].filter(Boolean).join(", "))),
          h("div", { style: { marginTop: 6, maxHeight: 220, overflowY: "auto" } },
            r.submissions.map((s, si) => h("div", { key: si, style: { color: "var(--ink-3)" } }, s.submissionType + " / " + s.submissionStatus + " — " + fmtFdaSubmissionDate(s.submissionStatusDate) + (s.reviewPriority ? " · " + s.reviewPriority : "")))
          )
        ))
      )
    ]),
    approval && !hasApproval && toolCard(h, h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No Drugs@FDA approval-history match.")),

    hasLabel && toolCard(h, [
      toolLabel(h, "Label summary"),
      label.boxedWarning && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10, lineHeight: 1.6 } }, truncateText(label.boxedWarning, 3000)),
      label.indicationsAndUsage && h("div", { style: { marginBottom: 10 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Indications and usage"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncateText(label.indicationsAndUsage, 3000))
      ),
      label.warningsAndPrecautions && h("div", { style: { marginBottom: 10 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Warnings and precautions"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncateText(label.warningsAndPrecautions, 3000))
      ),
      label.adverseReactionsSummary && h("div", null,
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Adverse reactions (from label)"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncateText(label.adverseReactionsSummary, 3000))
      )
    ]),

    hasAE && toolCard(h, [
      toolLabel(h, "Most-reported adverse events (FAERS)"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
        adverseEvents.topReportedReactions.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "3px 0", borderBottom: "1px solid var(--rule)" } },
          h("span", null, r.reaction), h("span", { style: { color: "var(--ink-3)" } }, r.reportCount.toLocaleString())
        ))
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, adverseEvents.caveat)
    ])
  );
}

// ── Target Dossier: is this target real? ───────────────────────────────────
// Deliberately NOT wired into the valuation. Open Targets' association score
// is a weighted aggregate over very heterogeneous evidence, and turning it
// into a PoS input would be precisely the kind of false precision this
// project avoids. What it answers is a conviction question the rest of the
// app can't: does human genetics point at this target, and what has already
// been tried against it.
function TargetDossierTool() {
  const h = React.createElement;
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [candidates, setCandidates] = React.useState(null);
  const [dossier, setDossier] = React.useState(null);
  const [error, setError] = React.useState(null);
  const seq = React.useRef(0);

  const search = async () => {
    if (!query.trim()) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setCandidates(null); setDossier(null);
    const r = await resolveTarget(query);
    if (mine !== seq.current) return;
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    if (r.hits.length === 1) { await load(r.hits[0].ensemblId, mine); return; }
    setCandidates(r.hits); setLoading(false);
  };

  const load = async (ensemblId, mine) => {
    const token = mine || ++seq.current;
    setLoading(true); setError(null); setCandidates(null);
    const r = await fetchTargetDossier(ensemblId);
    if (token !== seq.current) return;
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    setDossier(r.dossier); setLoading(false);
  };

  // Prefer the stage string the API actually returned over a re-derived one.
  const phaseLabel = (d) => d.stageLabel || (d.maxPhase >= 4 ? "Approved" : d.maxPhase > 0 ? "Phase " + d.maxPhase : "Preclinical/unknown");

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Target dossier"),
      h(Note, { summary: "New here? Why the target matters before the trial does" },
        h("div", { style: { lineHeight: 1.6 } }, "Before asking whether a trial is well designed, it's worth asking whether the biology it rests on is real. The most durable public signal for that is human genetics: if variants in a gene change a person's risk of the disease, a drug aimed at that gene is working with nature rather than against it. Targets with that kind of support have historically been about twice as likely to survive clinical development (Nelson et al., Nature Genetics 2015, replicated since). This pulls what Open Targets knows — which diseases the target is associated with, whether the association has direct human genetic evidence behind it or rests on animal models and pathway inference, and what drugs have already been tried against it and how far they got. It is context, not a score to plug into a model: no number from this page feeds the valuation, deliberately.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: query, placeholder: "Gene symbol — e.g. TTR, EGFR, SOD1, PCSK9",
          "aria-label": "Gene symbol or target name",
          onChange: e => setQuery(e.target.value), onKeyDown: e => { if (e.key === "Enter") search(); },
          style: { flex: "1 1 240px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading || !query.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: query.trim() ? 1 : 0.5 } },
          loading ? "Looking up…" : "Look up target")
      )
    ]),

    error && toolCard(h, h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--amber)", lineHeight: 1.6 } }, error)),

    candidates && toolCard(h, [
      toolLabel(h, "Which target did you mean?"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        candidates.map(c => h("button", { key: c.ensemblId, onClick: () => load(c.ensemblId),
          style: { textAlign: "left", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--surface)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-1)" } },
          h("b", null, c.symbol), " · ", h("span", { style: { color: "var(--ink-3)" } }, c.ensemblId),
          c.description && h("div", { style: { fontFamily: "var(--sans)", fontSize: 10.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 } }, truncateText(c.description, 160)))))
    ]),

    dossier && h("div", null,
      toolCard(h, [
        h("div", { style: { fontSize: 16, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)" } }, dossier.symbol),
        h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 2, marginBottom: 10 } }, dossier.name),
        h("div", { style: { display: "flex", gap: 22, flexWrap: "wrap" } },
          h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Human genetic evidence"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: dossier.anyGeneticEvidence ? "var(--teal)" : "var(--ink-2)" } },
              dossier.anyGeneticEvidence ? "Present" : "None found")),
          h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Associated diseases"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.diseaseCount.toLocaleString())),
          h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Drugs against it"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.drugCount.toLocaleString())),
          h("div", null,
            h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Reached Phase 3+"),
            h("div", { style: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, dossier.approvedOrLateStage))
        ),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 12, lineHeight: 1.6 } },
          dossier.anyGeneticEvidence
            ? "At least one disease association here carries direct human genetic evidence. That is the supportive case — but check below whether the genetics point at YOUR indication specifically, not merely at some disease involving this gene."
            : "No direct human genetic evidence appears among the top associations. That is not evidence the target is wrong — plenty of approved drugs hit targets with no genetic signal — but it does mean the biological case rests on models and pathway reasoning rather than on human variation."),
        h("div", { style: { marginTop: 10 } },
          h(ExternalLink, { href: "https://platform.opentargets.org/target/" + dossier.ensemblId, style: { fontSize: 10 } }, "→ Full target profile on Open Targets"))
      ]),

      dossier.diseases.length > 0 && toolCard(h, [
        toolLabel(h, "Top disease associations"),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
          "“Genetic” means direct human genetic evidence for this specific target–disease link. A high overall score with no genetic component is built from other evidence types — animal models, pathway inference, expression, text mining — which are weaker grounds for believing the target causes the disease in people."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
          dossier.diseases.map((d, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--rule)", fontSize: 11, fontFamily: "var(--mono)" } },
            h("span", { style: { color: "var(--ink-1)", flex: "1 1 auto" } }, d.name),
            h("span", { style: { color: d.hasGeneticEvidence ? "var(--teal)" : "var(--ink-3)", fontSize: 10, whiteSpace: "nowrap" } },
              d.hasGeneticEvidence ? "genetic " + d.geneticScore.toFixed(2) : "no genetic"),
            h("span", { style: { color: "var(--ink-2)", minWidth: 42, textAlign: "right" } }, d.overallScore.toFixed(2)))))
      ]),

      dossier.drugs.length > 0 && toolCard(h, [
        toolLabel(h, "Drugs already aimed at this target (" + dossier.drugs.length + " shown)"),
        h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginBottom: 10, lineHeight: 1.6 } },
          "What has been tried and how far it got. A target with approved drugs is validated but crowded; one where several programmes stalled in Phase 2 is a different kind of warning than one nobody has attempted."),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 340, overflowY: "auto" } },
          dossier.drugs.map((d, i) => h("div", { key: i, style: { padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, fontFamily: "var(--mono)" } },
              h("span", { style: { color: "var(--ink-1)" } }, d.name),
              h("span", { style: { color: d.maxPhase >= 4 ? "var(--teal)" : "var(--ink-2)", whiteSpace: "nowrap" } }, phaseLabel(d))),
            d.mechanism && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 2 } }, d.mechanism),
            d.indications.length > 0 && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 2 } },
              truncateText(d.indications.slice(0, 4).join(", ") + (d.indications.length > 4 ? " +" + (d.indications.length - 4) + " more" : ""), 150)))))
      ])
    )
  );
}

// Emphasises a count inline without a wrapper span (which would inherit
// block display in some of these lists).
function h0(n) { return String(n); }

// ── Trial Decoder: one NCT, explained ──────────────────────────────────────
// The gap this fills: the app could already search trials and watch them for
// changes, but never explain one. Someone who has just read a press release
// and wants to know whether the trial behind it is any good had nowhere to go.
//
// Everything shown is derived from registered CT.gov fields only — see
// trialDecoder.js. Nothing here predicts success, and nothing is inferred
// from the sponsor or the drug.
function TrialDecoderTool({ initialNctId, onConsumedInitialNctId }) {
  const h = React.createElement;
  const [nctInput, setNctInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [decoded, setDecoded] = React.useState(null);
  const [raw, setRaw] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const seq = React.useRef(0);

  const run = async (nctId) => {
    const id = (nctId || nctInput).trim();
    if (!id) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setDecoded(null); setRaw(null);
    const r = await fetchStudyByNctId(id);
    if (mine !== seq.current) return;      // superseded by a newer lookup
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    setRaw(r.study);
    setDecoded(decodeTrial(r.study));
    setLoading(false);
  };

  // Arriving from a "decode this trial" link elsewhere — run immediately
  // rather than making the user paste an ID they just clicked.
  React.useEffect(() => {
    if (initialNctId) {
      setNctInput(initialNctId);
      run(initialNctId);
      if (onConsumedInitialNctId) onConsumedInitialNctId();
    }
  }, [initialNctId]);

  const sevColor = (s) => s === "high" ? "var(--red)" : s === "medium" ? "var(--amber)" : "var(--ink-2)";
  const factRow = (label, value, note) => h("div", { style: { display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)", alignItems: "baseline", flexWrap: "wrap" } },
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 150 } }, label),
    h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-1)", flex: "1 1 200px" } }, value),
    note && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", flex: "1 1 100%", lineHeight: 1.5 } }, note)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Decode a trial"),
      h(Note, { summary: "New here? What this does and what it deliberately won't do" },
        h("div", { style: { lineHeight: 1.6 } }, "Paste a ClinicalTrials.gov ID and this lays out the trial's architecture in plain English: who's in it, what it's compared against, who's blinded, what the primary endpoint actually measures, and — the part worth reading — what the design can and cannot establish. Every line comes from fields the sponsor registered; where CT.gov is silent, this says “not stated” rather than assuming a default. It does not predict whether the trial will succeed, and it knows nothing about the company, the drug, or the stock. A clean design can still fail and a flawed one can still read out positive — the point is to see the design clearly before the result arrives and anchors you.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: nctInput, placeholder: "NCT number — e.g. NCT04368728",
          "aria-label": "ClinicalTrials.gov ID",
          onChange: e => setNctInput(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 260px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => run(), disabled: loading || !nctInput.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: nctInput.trim() ? 1 : 0.5 } },
          loading ? "Decoding…" : "Decode")
      )
    ]),

    error && toolCard(h, h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--amber)", lineHeight: 1.6 } }, error)),

    decoded && h("div", null,
      toolCard(h, [
        h("div", { style: { fontSize: 15, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4, lineHeight: 1.4 } }, decoded.title || decoded.nctId),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)", marginBottom: 12 } }, decoded.architecture),
        factRow("Sponsor", decoded.sponsor || "—"),
        factRow("Phase / status", (decoded.phase || "—") + " · " + (decoded.status || "—")),
        factRow("Condition", (decoded.conditions || []).join(", ") || "—"),
        factRow("Intervention", (decoded.interventions || []).join(", ") || "—"),
        factRow("Allocation", decoded.allocation.value,
          decoded.allocation.stated ? null : "CT.gov has no allocation registered for this trial — treat the architecture as unknown rather than assuming."),
        factRow("Masking", decoded.masking.value + (decoded.masking.who && decoded.masking.who.length ? " (" + decoded.masking.who.map(w => w.toLowerCase()).join(", ") + ")" : ""),
          decoded.masking.stated ? null : "Masking not registered."),
        factRow("Comparator", decoded.comparator.value),
        factRow("Arms", decoded.armCount
          ? decoded.armCount + (decoded.armLabels.length ? " — " + decoded.armLabels.slice(0, 4).join(" | ")
              + (decoded.armLabels.length > 4 ? "  … +" + (decoded.armLabels.length - 4) + " more" : "") : "")
          : "—",
          decoded.armCount > 6 ? "A trial with this many arms is usually a master protocol spanning several sub-studies rather than one comparison — read the registered arms directly before treating any single result as “the” outcome." : null),
        factRow("Enrolment", decoded.enrollment != null ? decoded.enrollment.toLocaleString() : "—"),
        decoded.endpoint.stated && factRow("Primary endpoint" + (decoded.endpoint.count > 1 ? "s (" + decoded.endpoint.count + ")" : ""),
          decoded.endpoint.items.slice(0, 5).map(o => o.measure + (o.timeFrame ? " @ " + o.timeFrame : "")).join("  •  ")
            + (decoded.endpoint.items.length > 5 ? "  … and " + (decoded.endpoint.items.length - 5) + " more" : ""),
          decoded.endpoint.subjective ? "This endpoint involves assessment or self-report rather than a hard event, which is why the masking line above matters."
            : decoded.endpoint.objective ? "This is a hard event or an independently assessed measure, so it is less sensitive to who knew what."
            : null),
        h("div", { style: { marginTop: 10 } },
          h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + decoded.nctId, style: { fontSize: 10 } }, "→ Full record on ClinicalTrials.gov"))
      ]),

      toolCard(h, [
        toolLabel(h, "What this trial can establish"),
        decoded.canProve.length
          ? h("ul", { style: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 } },
              decoded.canProve.map((t, i) => h("li", { key: i, style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, t)))
          : h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "Not enough registered design detail to say.")
      ]),

      toolCard(h, [
        toolLabel(h, "What it cannot"),
        h("ul", { style: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 } },
          decoded.cannotProve.map((t, i) => h("li", { key: i, style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, t)))
      ]),

      toolCard(h, [
        toolLabel(h, "Design flags (" + decoded.redFlags.length + ")"),
        decoded.redFlags.length === 0
          ? h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
              "Nothing in the registered design tripped a flag. That is a statement about the architecture only — it says nothing about whether the drug works, whether the effect size assumed is realistic, or whether the trial will read out positive.")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
              decoded.redFlags.map((f, i) => h("div", { key: i, style: { borderLeft: "3px solid " + sevColor(f.severity), paddingLeft: 10 } },
                h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700, color: sevColor(f.severity), marginBottom: 3 } }, f.label),
                h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, f.detail)
              )))
      ]),

      raw && toolCard(h, [
        h("button", { onClick: () => setShowRaw(v => !v),
          style: { background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
          (showRaw ? "▾" : "▸") + " Registered fields this was derived from"),
        showRaw && h("pre", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", background: "var(--surface-2)", padding: 10, borderRadius: 6, overflowX: "auto", marginTop: 8, lineHeight: 1.5 } },
          JSON.stringify({ allocation: raw.allocation, interventionModel: raw.interventionModel, masking: raw.masking,
            whoMasked: raw.whoMasked, armTypes: raw.armTypes, primaryOutcomes: raw.primaryOutcomesFull,
            enrollment: raw.enrollment, status: raw.status, primaryCompletionDate: raw.primaryCompletionDate,
            hasResults: raw.hasResults, whyStopped: raw.whyStopped }, null, 2))
      ])
    )
  );
}

// ── Trial Explorer: comparable-trial search (ClinicalTrials.gov design/
// status landscape for a condition+phase) plus Trial Watch's snapshot-and-
// diff for a specific trial by NCT ID, in one tab — these are two sides of
// the same "what does the trial landscape around my thesis look like"
// question, one broad (search a condition) and one narrow (track one known
// trial), so they belong together rather than split across sections.
// Watchlist/snapshot state is not tied to any case — a real program can have
// several relevant trials and forcing a one-trial-per-program data model
// would be the wrong shape for that. First check on any NCT ID saves the
// baseline with nothing to compare yet — that's expected, not an error.
function TrialWatchTool({ initialNctId, onConsumedInitialNctId }) {
  const h = React.createElement;
  const [ctCondition, setCtCondition] = React.useState("non-small cell lung cancer");
  const [ctPhase, setCtPhase] = React.useState("PHASE2");
  const [ctIntervention, setCtIntervention] = React.useState("");
  const [ctLoading, setCtLoading] = React.useState(false);
  const [ctSummary, setCtSummary] = React.useState(null);
  const [ctError, setCtError] = React.useState(null);

  // Same out-of-order-response guard as Company Lookup: a slower earlier
  // search must not overwrite the results of a newer one.
  const compsSeq = React.useRef(0);

  // Analog effect-size board — a separate call from the status landscape above
  // because it needs the results section, which the landscape query
  // deliberately filters out for speed.
  const [effects, setEffects] = React.useState(null);
  const [effectsLoading, setEffectsLoading] = React.useState(false);
  const [effectsError, setEffectsError] = React.useState(null);
  const effectsSeq = React.useRef(0);

  const loadEffects = async () => {
    const mine = ++effectsSeq.current;
    setEffectsLoading(true); setEffectsError(null); setEffects(null);
    try {
      const r = await fetchAnalogEffects(ctCondition, ctPhase, { intervention: ctIntervention.trim() || undefined, pageSize: 50 });
      if (mine !== effectsSeq.current) return;
      setEffects(r);
    } catch (e) {
      if (mine !== effectsSeq.current) return;
      setEffectsError("Couldn't reach ClinicalTrials.gov for posted results: " + e.message + ". This is a connection problem, not a finding of no effect data.");
    }
    setEffectsLoading(false);
  };

  const searchComps = async () => {
    const myReq = ++compsSeq.current;
    setCtLoading(true); setCtError(null); setCtSummary(null);
    try {
      const summary = await fetchHistoricalComps(ctCondition, ctPhase, { intervention: ctIntervention.trim() || undefined, pageSize: 100 });
      if (myReq !== compsSeq.current) return;
      setCtSummary(summary);
    } catch (e) {
      if (myReq !== compsSeq.current) return;
      setCtError("ClinicalTrials.gov request failed: " + e.message);
    }
    setCtLoading(false);
  };

  const [nctInput, setNctInput] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [watchlist, setWatchlist] = React.useState(() => listWatchedTrials());

  const refreshWatchlist = () => setWatchlist(listWatchedTrials());

  const checkSeq = React.useRef(0);

  const check = async (nctId) => {
    const id = (nctId || nctInput).trim();
    if (!id) return;
    const myReq = ++checkSeq.current;
    setChecking(true); setError(null); setResult(null);
    const r = await checkTrialForChanges(id);
    if (myReq !== checkSeq.current) return; // a newer check has superseded this
    if (r.ok) { setResult({ ...r, nctId: id.toUpperCase() }); refreshWatchlist(); } else { setError(r.error); }
    setChecking(false);
  };

  // Arriving from Company Lookup's "Watch this trial" link — pre-fill and
  // run immediately, rather than making the user paste the NCT ID again
  // right after they just clicked it. Consumed once (parent clears the
  // pending value) so this doesn't re-fire on every re-render.
  React.useEffect(() => {
    if (initialNctId) {
      setNctInput(initialNctId);
      check(initialNctId);
      if (onConsumedInitialNctId) onConsumedInitialNctId();
    }
  }, [initialNctId]);

  const forget = (nctId) => { forgetTrialSnapshot(nctId); refreshWatchlist(); if (result && result.nctId === nctId) setResult(null); };

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search comparable trials"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Live query against ClinicalTrials.gov (free, public v2 API). Shows the design and status landscape of comparable trials, not a win rate — CT.gov does not expose one."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: ctCondition, placeholder: "Condition", "aria-label": "Condition", onChange: e => setCtCondition(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("select", { value: ctPhase, "aria-label": "Phase", onChange: e => setCtPhase(e.target.value),
          style: { padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "PHASE1" }, "Phase 1"), h("option", { value: "PHASE2" }, "Phase 2"),
          h("option", { value: "PHASE3" }, "Phase 3"), h("option", { value: "PHASE4" }, "Phase 4")),
        h("input", { type: "text", value: ctIntervention, placeholder: "Intervention (optional)", "aria-label": "Intervention", onChange: e => setCtIntervention(e.target.value),
          style: { flex: "1 1 180px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: searchComps, disabled: ctLoading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: ctLoading ? "default" : "pointer" }
        }, ctLoading ? "Searching…" : "Search ClinicalTrials.gov")
      ),
      ctError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)" } }, ctError),
      ctSummary && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
          ctSummary.totalMatched + " matching trials on ClinicalTrials.gov (showing " + ctSummary.sampleSize + ")"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
          ctSummary.medianDurationMonths != null && h("div", null, "Median start-to-completion: " + ctSummary.medianDurationMonths + " months"),
          ctSummary.medianEnrollment != null && h("div", null, "Median enrollment: " + ctSummary.medianEnrollment)
        ),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 3, marginTop: 8 } },
          ctSummary.statusLandscape.map((s, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "3px 0", borderBottom: "1px solid var(--rule)" } },
            h("span", null, s.status), h("span", { style: { color: "var(--ink-3)" } }, s.count + " (" + (s.share * 100).toFixed(0) + "%)")
          ))
        ),
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8 } }, ctSummary.caveat),

        // ── Analog effect-size board ──────────────────────────────────────
        // The status landscape says how these trials ENDED. This says how big
        // the effects were, which is the reference class a modelled hazard
        // ratio should actually be read against.
        h("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 } },
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Posted effect sizes"),
            h("button", { onClick: loadEffects, disabled: effectsLoading,
              style: { padding: "4px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: effectsLoading ? "default" : "pointer" } },
              effectsLoading ? "Reading results\u2026" : (effects ? "Refresh" : "Load what these trials actually reported"))),
          !effects && !effectsLoading && !effectsError && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
            "A separate call, because posted results are excluded from the landscape query above for speed. This reads the structured analysis fields of trials that posted results, so you can see what winning has actually looked like here rather than only how often it happened."),
          effectsError && h("div", { style: { fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--amber)", lineHeight: 1.6 } }, effectsError),
          effects && h("div", null,
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 8 } },
              h("div", null, effects.sampleSize + " trials read \u00B7 " + effects.withPostedResults + " posted results \u00B7 " +
                h0(effects.withExtractableEffect) + " with a structured primary effect estimate")),
            Object.keys(effects.summaryByScale).length === 0
              ? h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
                  "None of these trials registered a primary effect estimate in a form that can be read without guessing. That is common \u2014 many sponsors post results as narrative tables only \u2014 and it is reported here rather than hidden.")
              : Object.keys(effects.summaryByScale).map(scale => {
                  const sum = effects.summaryByScale[scale];
                  const rows = effects.byScale[scale];
                  if (!sum) return null;
                  return h("div", { key: scale, style: { marginBottom: 12 } },
                    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", fontWeight: 700, marginBottom: 4 } },
                      (scale === "ratio" ? "Ratio-scale endpoints" : "Difference-scale endpoints") + " (" + sum.n + ")"),
                    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } },
                      "median " + sum.median.toFixed(2) + " \u00B7 range " + sum.min.toFixed(2) + " to " + sum.max.toFixed(2) +
                      " \u00B7 " + sum.intervalExcludesNull + " of " + sum.intervalReported + " with a CI excluding no-effect"),
                    h("div", { style: { display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" } },
                      rows.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "4px 0", borderBottom: "1px solid var(--rule)" } },
                        h("span", { style: { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          r.nctId + " \u00B7 " + truncateText(r.outcomeTitle || "primary", 42)),
                        h("span", { style: { whiteSpace: "nowrap", color: r.crossesNull === false ? "var(--teal)" : "var(--ink-3)" } },
                          r.paramLabel + " " + r.value.toFixed(2) +
                          (r.lower != null && r.upper != null ? " (" + r.lower.toFixed(2) + "\u2013" + r.upper.toFixed(2) + ")" : "")))))
                  );
                }),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 } }, effects.caveat))
        ),

        ctSummary.studies.length > 0 && h("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 } },
            "Matched trials (" + ctSummary.studies.length + ")"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
            ctSummary.studies.map((s, i) => h("div", { key: s.nctId || i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                h("span", { style: { color: "var(--ink-1)" } }, (s.nctId || "—") + " · " + (s.phase || "—") + " · " + (s.status || "—")),
                s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 9, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"),
                s.nctId && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId, style: { fontSize: 9 } }, "→ View on ClinicalTrials.gov"),
                s.nctId && h("span", { onClick: () => { setNctInput(s.nctId); check(s.nctId); },
                  role: "button", tabIndex: 0,
                  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNctInput(s.nctId); check(s.nctId); } },
                  style: { fontSize: 9, color: "var(--ink-3)", cursor: "pointer", textDecoration: "underline" } }, "Watch this trial →")
              ),
              h("div", null, (s.title || "untitled") + (s.sponsor ? " — " + s.sponsor : "") + (s.enrollment ? " · n=" + s.enrollment : ""))
            ))
          )
        )
      )
    ]),

    toolCard(h, [
      toolLabel(h, "Check a trial for changes"),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 } },
        "Saves a snapshot of a trial's status, enrollment, completion date, and primary endpoint(s) each time you check — and compares against whatever was saved last time. The first check on any trial just sets the baseline; there's nothing to compare yet."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: nctInput, placeholder: "NCT12345678", onChange: e => setNctInput(e.target.value),
          onKeyDown: e => { if (e.key === "Enter") check(); },
          "aria-label": "ClinicalTrials.gov NCT identifier",
          // An NCT ID is a fixed 11-character identifier — it was stretching to
          // 638px to fill the row, which read as a free-text search box and
          // made a precise, single-value field look like something it isn't.
          style: { flex: "0 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => check(), disabled: checking,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: checking ? "default" : "pointer" }
        }, checking ? "Checking…" : "Check for changes")
      ),
      error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, error),

      result && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
          result.nctId + " — " + (result.study.title || "untitled") + " (" + result.study.status + ")"),
        result.isFirstSnapshot
          ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "First check — saved as the baseline. Check again later to see what's changed.")
          : result.changes.length === 0
            ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, "No changes since the last check (" + fmtDate(result.previousCheckedAt) + ").")
            : h("div", null,
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 8 } }, "Changed since " + fmtDate(result.previousCheckedAt) + ":"),
                result.changes.map((c, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", padding: "5px 0", borderTop: i > 0 ? "1px solid var(--rule)" : "none" } },
                  h("b", null, c.label), c.from !== undefined
                    ? h("span", null, ": ", h("span", { style: { color: "var(--ink-3)" } }, String(c.from)), " → ", h("span", { style: { color: "var(--amber)", fontWeight: 700 } }, String(c.to)))
                    : h("div", { style: { marginTop: 2 } },
                        c.removed.length > 0 && h("div", { style: { color: "var(--red)" } }, "− " + c.removed.join("; ")),
                        c.added.length > 0 && h("div", { style: { color: "var(--teal)" } }, "+ " + c.added.join("; "))
                      )
                ))
              ),
        h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + result.nctId, style: { fontSize: 9, marginTop: 8, display: "inline-block" } }, "→ View on ClinicalTrials.gov")
      )
    ]),

    watchlist.length > 0 && toolCard(h, [
      toolLabel(h, "Watched trials (" + watchlist.length + ")"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" } },
        watchlist.map(w => h("div", { key: w.nctId, style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)", gap: 8 } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { color: "var(--ink-1)" } }, w.nctId + " (" + w.study.status + ")"),
            h("div", { style: { color: "var(--ink-3)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (w.study.title || "") + " · last checked " + fmtDate(w.checkedAt))
          ),
          h("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
            h("button", { onClick: () => check(w.nctId), style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Re-check"),
            h(ConfirmXButton, { onConfirm: () => forget(w.nctId), title: "Stop watching this trial and discard its saved snapshot", label: "Forget", armedLabel: "Forget?", style: { padding: "4px 10px", fontSize: 10 } })
          )
        ))
      )
    ])
  );
}
