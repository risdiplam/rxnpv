// ════════════════════════════════════════════════════════════════════════════
// App shell — case list, persistence, top nav
// ════════════════════════════════════════════════════════════════════════════
const STORAGE_KEY = "pdcf_cases_v1";

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
      localStorage.removeItem("pdcf_edgar_cache");
      localStorage.removeItem("pdcf_cik_cache");
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
  const [dark, setDark] = React.useState(() => { try { return localStorage.getItem("pdcf_theme") !== "light"; } catch(e) { return true; } });
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
    try { localStorage.setItem("pdcf_theme", dark ? "dark" : "light"); } catch(e) {}
  }, [dark]);

  const activeCase = cases.find(c => c.id === activeCaseId);

  const createCase = () => {
    const c = newCase();
    setCases(prev => [...prev, c]);
    setActiveCaseId(c.id);
    setView("workspace");
  };
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

  return h("div", { style: { minHeight: "100vh", background: "var(--bg)", color: "var(--ink-1)", fontFamily: "var(--sans)" } },
    // Save-failure banner — deliberately loud and persistent. Silently failing
    // to persist a user's work is the single worst failure mode this app has,
    // so it must never be swallowed quietly.
    saveFailed && h("div", { style: { background: "var(--red-fill)", color: "#fff", padding: "10px 20px", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, textAlign: "center" } },
      "⚠ Could not save your changes — this device's local storage is full. Export anything important (PDF or CSV) now, then delete some saved cases to free space."),
    // Proactive counterpart to the banner above: warns while there is still
    // room to act, instead of only once a save has already failed.
    h(StorageWarningBanner, { onCleared: () => setSaveFailed(!saveCases(cases)) }),
    // Top bar
    h("div", { style: { position: "sticky", top: 0, zIndex: 10, background: "var(--bg-2)", borderBottom: "1px solid var(--rule)", padding: "0 20px", display: "flex", alignItems: "center", height: 54, gap: 20 } },
      h("div", { style: { fontFamily: "var(--display)", fontSize: 18, fontWeight: 700, color: "var(--ink-1)", letterSpacing: "-0.01em" } },
        "Rx", h("span", { style: { color: "var(--amber)" } }, "NPV")),
      h("div", { style: { display: "flex", gap: 4 } },
        h("button", { onClick: () => setView("workspace"), style: navBtnStyle(view === "workspace") }, "Workspace"),
        h("button", { onClick: () => setView("reference"), style: navBtnStyle(view === "reference") }, "Reference Sheet"),
        h("button", { onClick: () => setView("tools"), style: navBtnStyle(view === "tools") }, "Tools"),
        h("button", { onClick: () => setView("simulation"), style: navBtnStyle(view === "simulation") }, "Simulation"),
        h("button", { onClick: () => setView("portfolio"), style: navBtnStyle(view === "portfolio") }, "Portfolio")
      ),
      h("div", { style: { flex: 1 } }),
      h("button", { onClick: () => setDark(!dark), title: "Toggle theme",
        style: { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" } }, dark ? "☾" : "☀")
    ),

    view === "report" ? h(ErrorBoundary, { key: "report" }, h(ReportView, { theCase: activeCase, onBack: () => setView("workspace"), updateCase })) :
    view === "reference" ? h(ErrorBoundary, { key: "reference" }, h(ReferenceSheet, { activeCase })) :
    view === "tools" ? h(ErrorBoundary, { key: "tools" }, h(ToolsView, { cases, updateCase, activeCase, navRequest: toolsNavRequest })) :
    view === "simulation" ? h(ErrorBoundary, { key: "simulation" }, h(SimulationView, { cases, updateCase })) :
    view === "portfolio" ? h(ErrorBoundary, { key: "portfolio" }, h(PortfolioView, { cases })) :
    // minHeight, not height. A fixed height here capped this row's parent at
    // 100vh, which silently broke the sticky top bar above: a sticky element
    // can only stick WITHIN its containing block, so once you scrolled past
    // the first screen the containing block ended and the whole nav scrolled
    // away with it. On a workspace that runs six-plus screens that meant
    // losing the view switcher and theme toggle until you scrolled all the
    // way back up. minHeight lets the container grow with its content so the
    // bar stays pinned for the whole page.
    h("div", { style: { display: "flex", minHeight: "calc(100vh - 54px)", alignItems: "flex-start" } },
      // Sidebar: case list. Deliberately OUTSIDE any error boundary — if the
      // active case's own content crashes, this is the recovery path (click
      // a different case), so it must never be taken down by the same
      // crash it exists to let you escape.
      //
      // Sticky in its own right, directly under the top bar: the row is now
      // as tall as the case content, so without this the case list would
      // scroll off and switching cases would need the same round trip the
      // nav bar just stopped needing.
      h("div", { style: { width: 220, borderRight: "1px solid var(--rule)", padding: "18px 14px", flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 54, height: "calc(100vh - 54px)" } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, flexShrink: 0 } }, "Cases"),
        h("div", { style: { flex: 1, overflowY: "auto", minHeight: 0 } },
          cases.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 14, lineHeight: 1.6 } }, "No cases yet. Create one to start building a revenue model."),
          cases.map(c => h("div", { key: c.id, style: { marginBottom: 4 } },
            h("div", {
              onClick: () => setActiveCaseId(c.id),
              style: { padding: "8px 10px", borderRadius: 7, cursor: "pointer", background: activeCaseId === c.id ? "var(--teal-bg)" : "transparent",
                border: "1px solid " + (activeCaseId === c.id ? "var(--teal)" : "transparent"), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }
            },
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontSize: 13, fontFamily: "var(--sans)", fontWeight: 600, color: activeCaseId === c.id ? "var(--teal)" : "var(--ink-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.name),
                h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, (c.programs || []).length + " program" + ((c.programs || []).length === 1 ? "" : "s"))
              )
            )
          ))
        ),
        h("button", { onClick: createCase, style: { width: "100%", marginTop: 10, padding: "8px 10px", borderRadius: 7, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer", flexShrink: 0 } }, "+ New case"),
        activeCase && h("div", { style: { marginTop: 18, display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 } },
          h("button", { onClick: () => duplicateCase(activeCase.id), style: smallBtnStyle() }, "Duplicate case")
        )
      ),
      // Main content — keyed on activeCaseId (not just view) so switching to
      // a different, working case resets a tripped boundary immediately,
      // not just switching views.
      h("div", { style: { flex: 1, padding: "24px 28px 60px", maxWidth: 980, margin: "0 auto", width: "100%" } },
        h(ErrorBoundary, { key: activeCaseId },
          activeCase
            ? h(React.Fragment, null,
                h("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 4 } },
                  h("button", { onClick: () => setView("report"), style: { padding: "6px 14px", borderRadius: 7, border: "1px solid var(--amber)", background: "transparent", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "📄 Generate Report")
                ),
                h(CaseView, { theCase: activeCase, onChange: updateCase, onDelete: () => deleteCase(activeCase.id), onNavigateToTools: navigateToTools })
              )
            : h("div", { style: { textAlign: "center", padding: "80px 20px", color: "var(--ink-3)" } },
                h("div", { style: { fontFamily: "var(--display)", fontSize: 20, marginBottom: 8, color: "var(--ink-2)" } }, "No case open"),
                h("div", { style: { fontFamily: "var(--mono)", fontSize: 13, marginBottom: 20 } }, "Create a case to start building a bottoms-up revenue model."),
                h("button", { onClick: createCase, style: { padding: "10px 22px", borderRadius: 8, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "+ New case")
              )
        )
      )
    )
  );
}
function navBtnStyle(active) {
  return { padding: "7px 14px", borderRadius: 7, border: "none", background: active ? "var(--surface-2)" : "transparent", color: active ? "var(--ink-1)" : "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer" };
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
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(ErrorBoundary, { mode: "outer" }, React.createElement(App)));
