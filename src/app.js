// ════════════════════════════════════════════════════════════════════════════
// App shell — case list, persistence, top nav
// ════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "rxnpv_cases_v1";

// ── One-time migration of persisted keys from this project's earlier name ───
// Every localStorage key used to be prefixed "pdcf_", after an earlier name
// for this project. The prefix was invisible to users but sat in plain sight
// in the public repo, where it is a fairly guessable contraction of that name
// — the last breadcrumb left after the rename work.
//
// Renaming the keys alone would have silently orphaned every saved case behind
// a key nothing reads any more: the data would still be on disk, but the app
// would start up looking empty. So each old key is copied forward first, and
// the original is removed ONLY after the copy has been read back and confirmed
// byte-identical. If anything fails, the original is left exactly where it is
// and the next launch simply tries again.
//
// Caches are deliberately discarded rather than migrated — they re-fetch in
// seconds, and copying them forward would waste quota the real cases need.
// This must run before anything reads storage, so it is called at the bottom
// of this file, immediately before the app mounts.
function migrateLegacyStorageKeys() {
  const EXACT = [
    ["pdcf_cases_v1", "rxnpv_cases_v1"],
    ["pdcf_theme", "rxnpv_theme"],
    ["pdcf_custom_ma", "rxnpv_custom_ma"],
    ["pdcf_custom_peaksales", "rxnpv_custom_peaksales"],
    ["pdcf_custom_licensing", "rxnpv_custom_licensing"]
  ];
  const PREFIXES = [
    ["pdcf_ctgov_snapshot_", "rxnpv_ctgov_snapshot_"],
    ["pdcf_cik_", "rxnpv_cik_"]
  ];
  // Note "pdcf_cik_cache" also starts with the "pdcf_cik_" prefix above, so it
  // is excluded explicitly rather than being migrated as a manual CIK override.
  const DISCARD = ["pdcf_edgar_cache", "pdcf_cik_cache"];

  const carryForward = (oldK, newK) => {
    const oldV = localStorage.getItem(oldK);
    if (oldV == null || localStorage.getItem(newK) != null) return;
    localStorage.setItem(newK, oldV);
    if (localStorage.getItem(newK) === oldV) localStorage.removeItem(oldK);
  };

  try {
    EXACT.forEach(([o, n]) => carryForward(o, n));
    // Snapshot the key list first — the loop mutates storage as it goes, and
    // localStorage.key(i) is index-based, so removing while iterating skips entries.
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.forEach(k => {
      if (k == null || DISCARD.indexOf(k) !== -1) return;
      PREFIXES.forEach(([oldP, newP]) => {
        if (k.indexOf(oldP) === 0) carryForward(k, newP + k.slice(oldP.length));
      });
    });
    DISCARD.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
  } catch (e) {
    // Storage unavailable or full — the app still runs, and the migration
    // simply retries on the next launch rather than failing the boot.
  }
}

function loadCases() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}
// Returns true on success, false if the write genuinely failed.
// If localStorage is full, the EDGAR/CIK response caches are sacrificed first —
// they're disposable (re-fetchable in seconds) whereas a user's cases are not.
// Only if the retry still fails do we report failure so the UI can warn, rather
// than silently losing the user's work the way a bare try/catch would.
function saveCases(cases) {
  const payload = JSON.stringify(cases);
  try { localStorage.setItem(STORAGE_KEY, payload); return true; }
  catch (e) {
    try {
      localStorage.removeItem("rxnpv_edgar_cache");
      localStorage.removeItem("rxnpv_cik_cache");
      localStorage.setItem(STORAGE_KEY, payload);
      return true;
    } catch (e2) { return false; }
  }
}

function App() {
  const h = React.createElement;
  const [cases, setCases] = React.useState(loadCases);
  const [activeCaseId, setActiveCaseId] = React.useState(() => { const c = loadCases(); return c[0] && c[0].id; });
  const [view, setView] = React.useState("workspace"); // 'workspace' | 'reference' | 'tools' | 'simulation' | 'portfolio' | 'report'
  // Light is the default. The September 2026 redesign resets a saved theme to
  // light ONCE (marker key below), because every saved preference predates
  // the new palettes — after that, whatever the user picks sticks.
  const [dark, setDark] = React.useState(() => {
    try {
      if (!localStorage.getItem("rxnpv_design_v2")) { localStorage.setItem("rxnpv_design_v2", "1"); localStorage.setItem("rxnpv_theme", "light"); return false; }
      return localStorage.getItem("rxnpv_theme") === "dark";
    } catch(e) { return false; }
  });
  const [saveFailed, setSaveFailed] = React.useState(false);
  // Cross-view navigation request — set by a "see also" link elsewhere (e.g.
  // Partnership Economics -> Licensing Comps) and consumed once by ToolsView.
  // requestId is a fresh value on every request so ToolsView's effect fires
  // even when the target tab is the same as an earlier request.
  const [toolsNavRequest, setToolsNavRequest] = React.useState(null);
  const navigateToTools = (tab) => { setToolsNavRequest({ tab, requestId: Date.now() }); setView("tools"); };

  React.useEffect(() => { setSaveFailed(!saveCases(cases)); }, [cases]);
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("rxnpv_theme", dark ? "dark" : "light"); } catch(e) {}
  }, [dark]);

  const activeCase = cases.find(c => c.id === activeCaseId);
  // Where "Open report →" goes after adding a section: that case's report,
  // made active so the report is the one it was just added to.
  const openReport = (caseId) => { if (caseId) setActiveCaseId(caseId); setView("report"); window.scrollTo(0, 0); };
  const openBundle = () => { setView("bundle"); window.scrollTo(0, 0); };
  const bundleItems = useBundle();
  const reportCtx = { cases, updateCase: (next) => setCases(prev => prev.map(c => c.id === next.id ? next : c)), activeCaseId, openReport, openBundle };

  const createCase = () => {
    const c = newCase();
    setCases(prev => [...prev, c]);
    setActiveCaseId(c.id);
    setView("workspace");
  };
  // A finished, sourced example (sampleCase.js), always added as a new case.
  const loadSampleCase = () => {
    const c = sampleCaseStoke();
    setCases(prev => [...prev, c]);
    setActiveCaseId(c.id);
    setView("workspace");
  };
  const [showBackup, setShowBackup] = React.useState(false);
  const autoBackup = useAutoBackup(true);
  const updateCase = (next) => setCases(prev => prev.map(c => c.id === next.id ? next : c));
  const deleteCase = (id) => {
    setCases(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (activeCaseId === id) setActiveCaseId(remaining[0] && remaining[0].id);
      return remaining;
    });
  };
  const duplicateCase = (id) => {
    const src = cases.find(c => c.id === id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = newId("case");
    copy.name = src.name + " (copy)";
    copy.programs.forEach(p => { p.id = newId("prog"); });
    copy.createdAt = copy.updatedAt = Date.now();
    setCases(prev => [...prev, copy]);
    setActiveCaseId(copy.id);
  };

  // Icon rail (September 2026 redesign) in place of the old top bar: the five
  // views, then the PDF bundle and the theme toggle at the foot. Each item is
  // an icon WITH its name under it — bare icons make people guess, and the
  // names are also what every test and harness clicks by. no-print: app
  // navigation is not part of a printed report.
  const rail = h("nav", { className: "no-print app-rail", "aria-label": "Main" },
    h("div", { className: "app-rail-logo", title: "RxNPV" }, h(RxLogo, { size: 36 })),
    [["workspace", "Workspace"], ["tools", "Tools"], ["simulation", "Simulation"], ["portfolio", "Portfolio"], ["reference", "Reference Sheet"]].map(([id, label]) =>
      h("button", { key: id, onClick: () => setView(id), className: "app-rail-btn" + (view === id ? " on" : ""), "aria-current": view === id ? "page" : undefined },
        h(RailIcon, { name: id }), h("span", null, label))),
    h("div", { style: { flex: 1 } }),
    // The PDF bundle: whatever was collected with "+ Bundle", from any view.
    h("button", { onClick: openBundle, className: "app-rail-btn" + (view === "bundle" ? " on" : ""), "aria-current": view === "bundle" ? "page" : undefined,
      title: "Your PDF bundle — sections and charts collected with “+ Bundle”, to export together as one PDF or each as its own" },
      h("span", { className: "app-rail-ic" }, h(RailIcon, { name: "bundle" }),
        bundleItems.length > 0 && h("b", { className: "app-rail-badge", "aria-label": bundleItems.length + " in bundle" }, String(bundleItems.length))),
      h("span", null, "Bundle")),
    h("button", { onClick: () => setDark(!dark), title: "Toggle theme", "aria-label": dark ? "Switch to light theme" : "Switch to dark theme", className: "app-rail-btn" },
      h(RailIcon, { name: dark ? "sun" : "moon" }), h("span", null, dark ? "Light" : "Dark"))
  );

  return h(ReportContext.Provider, { value: reportCtx }, h("div", { style: { minHeight: "100vh", background: "var(--bg)", color: "var(--ink-1)", fontFamily: "var(--sans)", display: "flex", alignItems: "flex-start" } },
    rail,
    h("div", { className: "app-main", style: { flex: 1, minWidth: 0 } },
    // Save-failure banner — deliberately loud and persistent. Silently failing
    // to persist a user's work is the single worst failure mode this app has,
    // so it must never be swallowed quietly.
    saveFailed && h("div", { className: "no-print", style: { background: "var(--red-fill)", color: "#fff", padding: "10px 20px", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, textAlign: "center" } },
      "⚠ Could not save your changes — this device's local storage is full. Export anything important (PDF or CSV) now, then delete some saved cases to free space."),
    // Proactive counterpart to the banner above: warns while there is still
    // room to act, instead of only once a save has already failed.
    h(StorageWarningBanner, { onCleared: () => setSaveFailed(!saveCases(cases)) }),
    view === "report" ? h(ErrorBoundary, { key: "report" }, h(ReportView, { theCase: activeCase, onBack: () => setView("workspace"), updateCase })) :
    view === "bundle" ? h(ErrorBoundary, { key: "bundle" }, h(BundleView, { onBack: () => setView("workspace") })) :
    view === "reference" ? h(ErrorBoundary, { key: "reference" }, h(ReferenceSheet, { activeCase })) :
    view === "tools" ? h(ErrorBoundary, { key: "tools" }, h(ToolsView, { cases, updateCase, activeCase, navRequest: toolsNavRequest })) :
    view === "simulation" ? h(ErrorBoundary, { key: "simulation" }, h(SimulationView, { cases, updateCase })) :
    view === "portfolio" ? h(ErrorBoundary, { key: "portfolio" }, h(PortfolioView, { cases })) :
    // minHeight, not height. A fixed height here capped this row at 100vh,
    // and a sticky element only sticks WITHIN its containing block: once you
    // scrolled past the first screen the case list scrolled away with it.
    // minHeight lets the row grow with its content so the list stays pinned.
    h("div", { style: { display: "flex", minHeight: "100vh", alignItems: "flex-start" } },
      // Sidebar: case list. Deliberately OUTSIDE any error boundary — if the
      // active case's own content crashes, this is the recovery path (click
      // a different case), so it must never be taken down by the same
      // crash it exists to let you escape.
      //
      // Sticky in its own right: the row is as tall as the case content, so
      // without this the case list would scroll off and switching cases would
      // mean scrolling all the way back up.
      h("div", { style: { width: 220, borderRight: "1px solid var(--rule)", padding: "18px 14px", flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 10, flexShrink: 0 } }, "Cases"),
        h("div", { style: { flex: 1, overflowY: "auto", minHeight: 0 } },
          cases.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 14, lineHeight: 1.6 } }, "No cases yet. Create one to start building a revenue model."),
          cases.map(c => h("div", { key: c.id, style: { marginBottom: 4 } },
            h("div", buttonLikeProps(() => setActiveCaseId(c.id), {
              "aria-current": activeCaseId === c.id ? "true" : undefined,
              "aria-label": "Open case " + c.name + ", " + (c.programs || []).length + " program" + ((c.programs || []).length === 1 ? "" : "s"),
              style: { padding: "8px 10px", borderRadius: 7, cursor: "pointer", background: activeCaseId === c.id ? "var(--teal-bg)" : "transparent",
                border: "1px solid " + (activeCaseId === c.id ? "var(--teal)" : "transparent"), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }
            }),
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontSize: 13, fontFamily: "var(--sans)", fontWeight: 600, color: activeCaseId === c.id ? "var(--teal)" : "var(--ink-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.name),
                h("div", { style: UI.caption }, (c.programs || []).length + " program" + ((c.programs || []).length === 1 ? "" : "s"))
              )
            )
          ))
        ),
        h("button", { onClick: createCase, style: { width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 7, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer", flexShrink: 0 } }, "+ New case"),
        h("div", { style: { marginTop: 18, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 } },
          activeCase && h("button", { onClick: () => duplicateCase(activeCase.id), style: smallBtnStyle() }, "Duplicate case"),
          h("button", { onClick: loadSampleCase, style: smallBtnStyle(), title: "Adds a complete, sourced example case (Stoke Therapeutics) — your own cases are not touched" }, "Load sample case"),
          // Backup status is always visible: the one place a user would
          // notice that nothing is protecting their work.
          h("button", { type: "button", className: "side-link", onClick: () => setShowBackup(true), style: { marginTop: 4 } },
            h("span", { className: "side-dot", "aria-hidden": "true", style: { background: autoBackup.status && autoBackup.status.folder && autoBackup.status.folderExists && !autoBackup.status.lastError ? "var(--green)" : "var(--warn)" } }),
            h("span", null, "Backup & restore",
              h("span", { style: { display: "block", fontWeight: 400, fontSize: 11, color: "var(--ink-3)" } },
                !hasDesktopBackup() ? "Export or import a file"
                : !(autoBackup.status && autoBackup.status.folder) ? "Automatic backup is off"
                : autoBackup.status.lastError || !autoBackup.status.folderExists ? "Needs attention"
                : "Backed up " + describeBackupAge(autoBackup.status.lastAt))))
        ),
        showBackup && h(BackupDialog, {
          cases, activeCase, onClose: () => setShowBackup(false),
          onCasesChange: (next, focusId) => { setCases(next); if (focusId) { setActiveCaseId(focusId); setView("workspace"); } },
          autoStatus: autoBackup.status, refreshAutoStatus: autoBackup.refresh
        })
      ),
      // Main content — keyed on activeCaseId (not just view) so switching to
      // a different, working case resets a tripped boundary immediately,
      // not just switching views.
      h("div", { style: { flex: 1, padding: "24px 28px 60px", maxWidth: "var(--app-max-width)", margin: "0 auto", width: "100%" } },
        h(ErrorBoundary, { key: activeCaseId },
          activeCase
            ? h(React.Fragment, null,
                h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 4 } },
                  h("button", { onClick: () => setView("report"),
                    title: "Build and export a PDF of this case — every Workspace section, plus anything added from Tools, Simulation, the Reference Sheet or Portfolio with “+ Report”",
                    style: { padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--teal-fill)", color: "var(--on-teal)", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center" } },
                    "Generate Report",
                    (() => {
                      const n = pinnedResultsOf(activeCase).length;
                      return n ? h("span", { style: { marginLeft: 8, padding: "1px 7px", borderRadius: 10, background: "rgba(255,255,255,0.22)", fontSize: 11, fontWeight: 500 } }, n + " added") : null;
                    })())
                ),
                h(CaseView, { theCase: activeCase, onChange: updateCase, onDelete: () => deleteCase(activeCase.id), onNavigateToTools: navigateToTools })
              )
            : h("div", { style: { textAlign: "center", padding: "80px 20px", color: "var(--ink-3)" } },
                h("div", { style: { fontFamily: "var(--display)", fontSize: 20, marginBottom: 8, color: "var(--ink-2)" } }, "No case open"),
                h("div", { style: { fontFamily: "var(--mono)", fontSize: 13, marginBottom: 20 } }, "Create a case to start building a bottoms-up revenue model."),
                h("button", { onClick: loadSampleCase, style: { padding: "10px 22px", marginRight: 10, borderRadius: 8, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13, cursor: "pointer" } }, "Open the sample case"),
                h("button", { onClick: createCase, style: { padding: "10px 22px", borderRadius: 8, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "+ New case")
              )
        )
      )
    )
  )));
}
// The RxNPV mark: the prescription sign ℞ as one geometric figure — an R
// whose leg is crossed near its foot by a second stroke, forming the X. The
// same drawing as electron/icon.svg (the Dock icon), cropped to its tile.
function RxLogo({ size }) {
  const h = React.createElement;
  return h("svg", { width: size, height: size, viewBox: "100 100 824 824", role: "img", "aria-label": "RxNPV" },
    h("defs", null, h("linearGradient", { id: "rxlogo-bg", x1: 0, y1: 0, x2: 1, y2: 1 },
      h("stop", { offset: 0, stopColor: "#5B6CF3" }), h("stop", { offset: 1, stopColor: "#2E3BB0" }))),
    h("rect", { x: 100, y: 100, width: 824, height: 824, rx: 186, fill: "url(#rxlogo-bg)" }),
    h("g", { transform: "translate(512 512) scale(0.92) translate(-565 -527)", fill: "none", stroke: "#FFFFFF", strokeWidth: 86, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M378 770 V 262 H 552 A 128 128 0 0 1 552 518 H 378" }),
      h("path", { d: "M478 518 L 752 792" }),
      h("path", { d: "M568 790 L 752 606" })));
}

// Rail icons: 24px line icons drawn inline (no icon font to embed or load).
function RailIcon({ name }) {
  const h = React.createElement;
  const P = {
    workspace: [["rect", { x: 3, y: 3, width: 7, height: 9, rx: 1.5 }], ["rect", { x: 14, y: 3, width: 7, height: 5, rx: 1.5 }], ["rect", { x: 14, y: 12, width: 7, height: 9, rx: 1.5 }], ["rect", { x: 3, y: 16, width: 7, height: 5, rx: 1.5 }]],
    tools: [["path", { d: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" }]],
    simulation: [["path", { d: "M9 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19L15 9V3" }], ["path", { d: "M8 3h8M7 15h10" }]],
    portfolio: [["path", { d: "M4 19V5M4 19h16" }], ["path", { d: "M8 15l3-4 3 2 5-6" }]],
    reference: [["path", { d: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" }], ["path", { d: "M9 9h6M9 13h6" }]],
    bundle: [["path", { d: "M4 7l8-4 8 4-8 4z" }], ["path", { d: "M4 12l8 4 8-4M4 17l8 4 8-4" }]],
    moon: [["path", { d: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" }]],
    sun: [["circle", { cx: 12, cy: 12, r: 4 }], ["path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }]]
  };
  return h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
    (P[name] || []).map(([tag, attrs], i) => h(tag, Object.assign({ key: i }, attrs))));
}
function smallBtnStyle() {
  return { padding: "7px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", textAlign: "left" };
}

// Outer boundary, wrapping App itself from the outside — the only way to
// catch a crash in App's own inline render code (e.g. the case-list
// sidebar), since a boundary placed inside App's body cannot protect App's
// own synchronous execution. The inner boundary around the view switch
// (inside App) stays too, since it catches the far more common case — a
// crash inside a specific view's own component — while preserving the nav
// bar, which this outer one can't do (it replaces literally everything on
// a catch, nav included, since App itself is what threw).
migrateLegacyStorageKeys();

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ErrorBoundary, { mode: "outer" }, React.createElement(App)));
