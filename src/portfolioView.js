// ════════════════════════════════════════════════════════════════════════════
// PORTFOLIO VIEW — aggregates every saved case's already-computed valuation,
// runway, and PoS into one cross-case view. Built once the case-level
// features it depends on for genuinely meaningful output already existed:
// Evidence Log (assumptions behind the numbers), Dilution-Path Financing
// (realistic runway), and the existing Implied PoS solver. No new data
// source — everything here is computePortfolioSummary (scenarioEngine.js)
// re-running each case's own existing valuation, nothing case-specific
// gets touched or written back.
// ════════════════════════════════════════════════════════════════════════════

function PortfolioView({ cases }) {
  const h = React.createElement;

  const summary = React.useMemo(() => computePortfolioSummary(cases), [JSON.stringify(cases)]);
  const valid = summary.filter(s => !s.error);
  const broken = summary.filter(s => s.error);

  if (cases.length === 0) {
    return h("div", { style: { padding: 40, textAlign: "center", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 13 } },
      "No cases yet — build a case in Workspace first, then come back here to see them together.");
  }

  const fmtPct = (v) => v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(0) + "%";
  const fmtYears = (v) => v == null ? "—" : v.toFixed(1) + "yr";
  const fmtPrice = (v) => v == null || v === 0 ? "—" : fmtShare(v);

  return h("div", { style: { padding: "20px 24px", maxWidth: 1100, margin: "0 auto" } },
    h("div", { style: { fontFamily: "var(--display)", fontSize: 18, fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "Portfolio"),
    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 20 } },
      valid.length + " case" + (valid.length === 1 ? "" : "s") + (broken.length ? ", " + broken.length + " couldn't be computed (see below)" : "")),

    // ── Summary table ──
    h("div", { style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px", marginBottom: 18, overflowX: "auto" } },
      h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--mono)" } },
        h("thead", null, h("tr", { style: { borderBottom: "1px solid var(--rule)" } },
          ["Case", "Program", "Price", "Fair value", "Upside", "Runway", "Modeled PoS", "Implied PoS"].map(col =>
            h("th", { key: col, style: { textAlign: "left", padding: "6px 10px", color: "var(--ink-3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" } }, col))
        )),
        h("tbody", null, valid.map(s => h("tr", { key: s.id, style: { borderBottom: "1px solid var(--rule)" } },
          h("td", { style: { padding: "8px 10px", color: "var(--ink-1)", fontWeight: 600 } }, s.name),
          h("td", { style: { padding: "8px 10px", color: "var(--ink-2)" } }, s.programName || "—"),
          h("td", { style: { padding: "8px 10px", color: "var(--ink-2)" } }, fmtPrice(s.price)),
          h("td", { style: { padding: "8px 10px", color: "var(--ink-2)" } }, fmtPrice(s.fairValue)),
          h("td", { style: { padding: "8px 10px", color: s.upsidePct == null ? "var(--ink-3)" : s.upsidePct >= 0 ? "var(--teal)" : "var(--red)", fontWeight: 600 } }, fmtPct(s.upsidePct)),
          h("td", { style: { padding: "8px 10px", color: s.runwayYears != null && s.runwayYears < 1 ? "var(--red)" : "var(--ink-2)" } }, fmtYears(s.runwayYears)),
          h("td", { style: { padding: "8px 10px", color: "var(--ink-2)" } }, s.modeledPoSPct != null ? s.modeledPoSPct.toFixed(0) + "%" : "—"),
          h("td", { style: { padding: "8px 10px", color: "var(--ink-2)" } }, s.impliedPoSPct != null ? s.impliedPoSPct.toFixed(0) + "%" : "—")
        )))
      )
    ),

    broken.length > 0 && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", marginBottom: 18, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
      broken.map(s => h("div", { key: s.id }, h("b", { style: { color: "var(--red)" } }, s.name), ": " + s.error))
    ),

    h("div", { style: { display: "flex", gap: 18, flexWrap: "wrap" } },
      // ── PoS dispersion ──
      h("div", { style: { flex: "1 1 320px", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px" } },
        h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 12 } }, "PoS across the portfolio"),
        (() => {
          const withPoS = valid.filter(s => s.modeledPoSPct != null).sort((a, b) => b.modeledPoSPct - a.modeledPoSPct);
          if (!withPoS.length) return h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "No programs with a computable PoS yet.");
          const maxPoS = Math.max(...withPoS.map(s => s.modeledPoSPct), 1);
          return withPoS.map(s => h("div", { key: s.id, style: { marginBottom: 8 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 2 } },
              h("span", null, s.name), h("span", null, s.modeledPoSPct.toFixed(0) + "%")),
            h("div", { style: { height: 6, borderRadius: 3, background: "var(--surface-2)" } },
              h("div", { style: { height: "100%", borderRadius: 3, width: (s.modeledPoSPct / maxPoS * 100) + "%", background: "var(--teal)" } }))
          ));
        })()
      ),

      // ── Cash runway ranking ──
      h("div", { style: { flex: "1 1 320px", background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px" } },
        h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Cash runway, shortest first"),
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "Under 12 months flagged — worth checking against any near-term catalyst."),
        (() => {
          const withRunway = valid.filter(s => s.runwayYears != null).sort((a, b) => a.runwayYears - b.runwayYears);
          // runwayYears is null both for "no cash entered" (computeForwardRunway
          // only zeroes it when startingCash<=0) AND for a well-funded case whose
          // cash never runs out inside the 25yr projection window — the same
          // null either way, so the empty-state message can't claim it's the
          // former without checking, or it's simply wrong for the latter case.
          if (!withRunway.length) return h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
            "No cases with a runway inside the 25-year projection window yet — either no cash entered, or the modeled runway runs past 25 years.");
          const maxRunway = Math.max(...withRunway.map(s => s.runwayYears), 1);
          return withRunway.map(s => h("div", { key: s.id, style: { marginBottom: 8 } },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: s.runwayYears < 1 ? "var(--red)" : "var(--ink-2)", marginBottom: 2 } },
              h("span", null, s.name), h("span", null, fmtYears(s.runwayYears))),
            h("div", { style: { height: 6, borderRadius: 3, background: "var(--surface-2)" } },
              h("div", { style: { height: "100%", borderRadius: 3, width: Math.max(2, s.runwayYears / maxRunway * 100) + "%", background: s.runwayYears < 1 ? "var(--red)" : "var(--amber)" } }))
          ));
        })()
      )
    ),

    // ── Implied vs modeled PoS ──
    (() => {
      const withBoth = valid.filter(s => s.modeledPoSPct != null && s.impliedPoSPct != null);
      if (!withBoth.length) return null;
      const points = withBoth.map(s => ({ x: s.modeledPoSPct, y: s.impliedPoSPct, label: s.name }));
      const maxAxis = Math.max(...points.map(p => Math.max(p.x, p.y)), 10) * 1.15;
      return h("div", { style: { marginTop: 18, background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "16px 18px" } },
        h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, "Your PoS vs. what the market implies"),
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 12 } }, "Single-program cases with a price set only. Below the diagonal: you're more bullish than the market. Above: less."),
        h(ExportableBlock, { name: "portfolio-modeled-vs-implied-pos", showPanelCapture: true },
          h(ScatterChart, { points, xLabel: "Your modeled PoS (%)", yLabel: "Market-implied PoS (%)", xFmt: v => v.toFixed(0), yFmt: v => v.toFixed(0) }))
      );
    })()
  );
}
