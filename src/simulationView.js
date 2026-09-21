// ════════════════════════════════════════════════════════════════════════════
// SIMULATION VIEW — React wrapper mounting TrialSim as a self-contained block
// inside RxNPV's own React tree, rather than a ground-up rewrite of its
// UI into React. TrialSim's own UI code (app.js, further down this bundle)
// is vanilla DOM manipulation, already tested and working standalone; this
// component creates one empty, namespaced container (#ts-root) and hands
// control of everything inside it to TrialSim's own bootTrialSim() function
// exactly once. React never re-renders or touches that subtree's contents
// again — it only owns the outer wrapper div.
//
// These tools don't feed into either valuation mode automatically — the same
// as the Tools tab's comps, which only ever write to a case through an
// explicit, one-time "Export ->" click, never silently. Peak Sales' Monte
// Carlo carries that same explicit-export pattern in, via a small bridge:
// since TrialSim's own code has no React access, this component republishes
// cases/updateCase onto a plain global object on every render, which
// ts_app.js's export button reads/calls directly — the standard way to
// bridge a React-managed island with a vanilla-JS subtree, and the reason
// this needs no restructuring of TrialSim's own code to work.
// ════════════════════════════════════════════════════════════════════════════

function SimulationView({ cases, updateCase }) {
  const h = React.createElement;
  const containerRef = React.useRef(null);
  const bootedRef = React.useRef(false);

  window.pdcfSimBridge = { cases, updateCase };

  React.useEffect(() => {
    if (bootedRef.current) return; // guard against any double-invoke (e.g. StrictMode-style double effects)
    bootedRef.current = true;
    if (typeof bootTrialSim === "function") {
      bootTrialSim();
    }
  }, []);

  return h("div", { style: { minHeight: "calc(100vh - 54px)" } },
    h("div", { id: "ts-root", ref: containerRef })
  );
}
