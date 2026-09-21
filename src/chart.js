// ════════════════════════════════════════════════════════════════════════════
// Hand-rolled SVG revenue chart — no external chart library needed
// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// Pure Y-axis scaling for RevenueChart, extracted so it is testable without a
// DOM or React — the bug this fixed (charted values silently clamped to 0,
// flattening real early-year losses into a flat $0 line) was exactly the kind
// of thing a DOM-free numeric check would have caught immediately if this
// logic had been a standalone function from the start.
// allVals must include every point across every series being charted.
function revenueChartYScale(allVals) {
  const maxV = Math.max(1, ...allVals);
  const minV = Math.min(0, ...allVals);
  const range = maxV - minV || 1;
  return { minV, maxV, range };
}

function RevenueChart({ series, height, showLegend }) {
  const h = React.createElement;
  height = height || 220;
  const W = 900, H = height, padL = 56, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const svgRef = React.useRef(null);

  if (!series || !series.length || !series[0].points || !series[0].points.length) {
    return h("div", { style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "No data yet — fill in the revenue build to see a projection.");
  }

  // Was fixed at [0, maxV] on the assumption every series is non-negative —
  // true for a pure revenue ramp, false for EBIT, product contribution, or
  // risk-adjusted FCF, all of which are genuinely negative in early years for
  // a pre-revenue biotech (the exact case this app exists for). Callers were
  // routing around that by clamping their own data to 0 before charting it,
  // which silently flattened real burn-year losses into a flat $0 line — the
  // callout numbers next to the chart stayed correct, only the picture lied.
  // Supporting the true [minV, maxV] range here removes the need for any
  // caller to pre-clamp its own data.
  const allVals = series.flatMap(s => s.points.map(p => p.v));
  const { minV, maxV, range } = revenueChartYScale(allVals);
  const nPoints = series[0].points.length;
  const x = i => padL + (i / Math.max(1, nPoints - 1)) * plotW;
  const y = v => padT + plotH - ((v - minV) / range) * plotH;

  const fmtM = v => {
    const av = Math.abs(v);
    const s = av >= 1e9 ? "$" + (av / 1e9).toFixed(1) + "B" : "$" + Math.round(av / 1e6) + "M";
    return (v < 0 ? "-" : "") + s;
  };

  const handleMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * W;
    const idx = Math.round(((svgX - padL) / plotW) * (nPoints - 1));
    setHoverIdx(Math.max(0, Math.min(nPoints - 1, idx)));
  };

  // Y-axis gridlines (4 bands across the full [minV, maxV] span). When the
  // series dips negative, 0 itself won't generally land on a 0/0.25/0.5 band —
  // it gets its own explicit, distinct gridline so the profit/loss threshold
  // stays visible rather than only implied by where the line crosses.
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: minV + range * f, yy: y(minV + range * f) }));
  const hasZeroLine = minV < 0 && maxV > 0;
  const zeroY = y(0);
  const tooltipOnRight = hoverIdx != null && x(hoverIdx) > padL + plotW * 0.65;

  return h("div", { style: { position: "relative" } },
    h("svg", { ref: svgRef, viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height, display: "block", cursor: "crosshair" },
        onMouseMove: handleMove, onMouseLeave: () => setHoverIdx(null) },
      gridLines.map((g, i) => h("g", { key: i },
        h("line", { x1: padL, x2: W - padR, y1: g.yy, y2: g.yy, stroke: "var(--rule)", strokeWidth: 1, strokeDasharray: i === 0 ? "none" : "3,3" }),
        h("text", { x: padL - 8, y: g.yy + 3, textAnchor: "end", fontSize: 9, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtM(g.v))
      )),
      hasZeroLine && h("line", { x1: padL, x2: W - padR, y1: zeroY, y2: zeroY, stroke: "var(--ink-3)", strokeWidth: 1.25 }),
      series.map((s, si) => {
        const d = s.points.map((p, i) => (i === 0 ? "M" : "L") + x(i) + "," + y(p.v)).join(" ");
        const areaD = d + ` L${x(nPoints - 1)},${y(0)} L${x(0)},${y(0)} Z`;
        return h("g", { key: si },
          s.fill !== false && h("path", { d: areaD, fill: s.color, fillOpacity: 0.12, stroke: "none" }),
          h("path", { d, fill: "none", stroke: s.color, strokeWidth: 2 })
        );
      }),
      // X-axis year labels (every ~3rd year)
      series[0].points.map((p, i) => (i % Math.ceil(nPoints / 8) === 0) && h("text", {
        key: i, x: x(i), y: H - 6, textAnchor: "middle", fontSize: 9, fontFamily: "var(--mono)", fill: "var(--ink-3)"
      }, "Y" + p.label)),
      // Hover guideline + point markers
      hoverIdx != null && h("g", null,
        h("line", { x1: x(hoverIdx), x2: x(hoverIdx), y1: padT, y2: padT + plotH, stroke: "var(--ink-3)", strokeWidth: 1, strokeDasharray: "2,2" }),
        series.map((s, si) => h("circle", { key: si, cx: x(hoverIdx), cy: y(s.points[hoverIdx].v), r: 3.5, fill: s.color, stroke: "var(--bg)", strokeWidth: 1.5 }))
      )
    ),
    hoverIdx != null && h("div", {
      style: {
        position: "absolute", top: padT / H * 100 + "%",
        left: tooltipOnRight ? "auto" : (x(hoverIdx) / W * 100) + "%",
        right: tooltipOnRight ? ((W - x(hoverIdx)) / W * 100) + "%" : "auto",
        transform: tooltipOnRight ? "translate(8px, 0)" : "translate(8px, 0)",
        background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px",
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
      }
    },
      h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 2 } }, "Year " + series[0].points[hoverIdx].label),
      series.map((s, si) => h("div", { key: si, style: { color: s.color } }, s.name + ": " + fmtM(s.points[hoverIdx].v)))
    ),
    showLegend && h("div", { style: { display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" } },
      series.map((s, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
        h("span", { style: { width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" } }),
        s.name
      ))
    )
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Scatter chart — for comp positioning (e.g. deal value vs. premium), with an
// optional single "your case" point rendered distinctly so you can see where
// your own assumption sits among real comps.
// ════════════════════════════════════════════════════════════════════════════
function ScatterChart({ points, highlightPoint, xLabel, yLabel, xFmt, yFmt, height }) {
  const h = React.createElement;
  height = height || 280;
  const W = 560, H = height, padL = 60, padR = 20, padT = 16, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const [hover, setHover] = React.useState(null); // { kind: 'point'|'highlight', idx }

  const allPoints = highlightPoint ? [...points, highlightPoint] : points;
  if (!allPoints.length) {
    return h("div", { style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "No comp data to plot.");
  }

  const xVals = allPoints.map(p => p.x), yVals = allPoints.map(p => p.y);
  // The 15% headroom has to be added ABOVE the max, not multiplied into it. On
  // an all-negative axis — a deal struck at a negative premium is unusual but
  // real — multiplying a negative max by 1.15 pushes it further negative, so
  // the computed max ends up BELOW the min: the axis silently inverts, and a
  // point past the (wrong) max plots outside the chart entirely. RevenueChart
  // in this same file already floors its domain at zero for the same reason.
  const padAxis = (vals) => {
    const lo = Math.min(0, ...vals), hi = Math.max(...vals);
    const span = hi - lo;
    return { lo, hi: hi + (span > 0 ? span * 0.15 : Math.max(Math.abs(hi) * 0.15, 1)) };
  };
  const xAxis = padAxis(xVals), yAxis = padAxis(yVals);
  const maxX = xAxis.hi, minX = xAxis.lo;
  const maxY = yAxis.hi, minY = yAxis.lo;
  const toX = v => padL + ((v - minX) / (maxX - minX || 1)) * plotW;
  const toY = v => padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const fmtX = xFmt || (v => v.toFixed(0));
  const fmtY = yFmt || (v => v.toFixed(0));
  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  const hoveredPoint = hover ? (hover.kind === "highlight" ? highlightPoint : points[hover.idx]) : null;
  const tooltipOnRight = hoveredPoint && toX(hoveredPoint.x) > padL + plotW * 0.6;

  return h("div", { style: { position: "relative" } },
    h("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", maxWidth: 560, height: "auto", display: "block" } },
      gridFracs.map((f, i) => h("g", { key: "y" + i },
        h("line", { x1: padL, x2: W - padR, y1: toY(minY + f * (maxY - minY)), y2: toY(minY + f * (maxY - minY)), stroke: "var(--rule)", strokeWidth: 1, strokeDasharray: "3,3" }),
        h("text", { x: padL - 8, y: toY(minY + f * (maxY - minY)) + 3, textAnchor: "end", fontSize: 9, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtY(minY + f * (maxY - minY)))
      )),
      gridFracs.map((f, i) => h("text", { key: "x" + i, x: toX(minX + f * (maxX - minX)), y: H - padB + 16, textAnchor: "middle", fontSize: 9, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtX(minX + f * (maxX - minX)))),
      h("text", { x: padL + plotW / 2, y: H - 4, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-2)" }, xLabel || ""),
      h("text", { x: 14, y: padT + plotH / 2, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-2)", transform: `rotate(-90, 14, ${padT + plotH / 2})` }, yLabel || ""),
      points.map((p, i) => h("circle", {
        key: i, cx: toX(p.x), cy: toY(p.y), r: hover && hover.kind === "point" && hover.idx === i ? 7 : 5,
        fill: "var(--teal)", fillOpacity: hover && hover.kind === "point" && hover.idx === i ? 0.85 : 0.55, stroke: "var(--teal)", strokeWidth: 1,
        style: { cursor: "pointer" }, onMouseEnter: () => setHover({ kind: "point", idx: i }), onMouseLeave: () => setHover(null)
      })),
      highlightPoint && h("g", null,
        h("circle", {
          cx: toX(highlightPoint.x), cy: toY(highlightPoint.y), r: hover && hover.kind === "highlight" ? 10 : 8,
          fill: "var(--amber)", stroke: "var(--ink-1)", strokeWidth: 2, style: { cursor: "pointer" },
          onMouseEnter: () => setHover({ kind: "highlight" }), onMouseLeave: () => setHover(null)
        }),
        h("text", { x: toX(highlightPoint.x) + 12, y: toY(highlightPoint.y) - 8, fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--amber)" }, highlightPoint.label || "Your case")
      )
    ),
    hoveredPoint && h("div", {
      style: {
        position: "absolute", top: Math.max(0, toY(hoveredPoint.y) / H * 100 - 8) + "%",
        left: tooltipOnRight ? "auto" : (toX(hoveredPoint.x) / W * 100) + "%",
        right: tooltipOnRight ? ((W - toX(hoveredPoint.x)) / W * 100) + "%" : "auto",
        transform: "translate(10px, 0)",
        background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, padding: "6px 10px",
        fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
      }
    },
      h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 2 } }, hoveredPoint.label || "Point"),
      h("div", null, (xLabel || "x") + ": " + fmtX(hoveredPoint.x)),
      h("div", null, (yLabel || "y") + ": " + fmtY(hoveredPoint.y))
    )
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Risk waterfall — a signed before/after comparison, NOT a classic floating-
// segment waterfall. That choice is deliberate: for early-stage assets, the
// "unrisked" value can legitimately come out MORE negative than the risked
// value (100% PoS also means paying the full R&D cost with certainty, and
// that near-term certain cost can outweigh distant, heavily time-discounted
// revenue). A floating-segment waterfall assumes a single consistent
// direction; a signed two-bar comparison stays honest and legible whichever
// way the delta actually points.
// ════════════════════════════════════════════════════════════════════════════
function RiskWaterfallChart({ unriskedNPV, riskedNPV, posToLaunchPct, height }) {
  const h = React.createElement;
  height = height || 190;
  const W = 420, H = height, padL = 74, padR = 24, padT = 20, padB = 42;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  if (unriskedNPV == null || riskedNPV == null) {
    return h("div", { style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "Not computable yet.");
  }

  const fmtM = v => {
    const av = Math.abs(v);
    const s = av >= 1e9 ? "$" + (av / 1e9).toFixed(2) + "B" : "$" + Math.round(av / 1e6) + "M";
    return (v < 0 ? "-" : "") + s;
  };

  const maxAbs = Math.max(Math.abs(unriskedNPV), Math.abs(riskedNPV), 1);
  const zeroY = padT + plotH / 2; // zero line at vertical center; bars extend up (positive) or down (negative)
  const scale = (plotH / 2 - 8) / maxAbs;
  const barY = v => v >= 0 ? zeroY - v * scale : zeroY;
  const barH = v => Math.abs(v) * scale;

  const bars = [
    { label: "Unrisked", sub: "if success were certain", v: unriskedNPV, x: padL + plotW * 0.18, color: "var(--ink-3)" },
    { label: "Risk-adjusted", sub: posToLaunchPct != null ? posToLaunchPct.toFixed(1) + "% PoS" : "rNPV", v: riskedNPV, x: padL + plotW * 0.68, color: "var(--teal)" }
  ];
  const barW = 64;
  const delta = riskedNPV - unriskedNPV;

  return h("div", null,
    h("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", maxWidth: 420, height: "auto", display: "block" } },
      h("line", { x1: padL, x2: W - padR, y1: zeroY, y2: zeroY, stroke: "var(--rule)", strokeWidth: 1 }),
      bars.map((b, i) => h("g", { key: i },
        h("rect", { x: b.x - barW / 2, y: barY(b.v), width: barW, height: Math.max(1, barH(b.v)), fill: b.color, fillOpacity: 0.75, rx: 3 }),
        h("text", { x: b.x, y: b.v >= 0 ? barY(b.v) - 8 : barY(b.v) + barH(b.v) + 16, textAnchor: "middle", fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--ink-1)" }, fmtM(b.v)),
        h("text", { x: b.x, y: H - 16, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--ink-2)" }, b.label),
        h("text", { x: b.x, y: H - 5, textAnchor: "middle", fontSize: 9, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, b.sub)
      )),
      // Delta annotation between the two bars — the number alone doesn't say
      // what it is, so it needs its own caption same as the two bars do.
      h("text", { x: padL + plotW * 0.43, y: padT + 8, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, fill: delta >= 0 ? "var(--green)" : "var(--red)" },
        (delta >= 0 ? "+" : "") + fmtM(delta)),
      h("text", { x: padL + plotW * 0.43, y: padT + 19, textAnchor: "middle", fontSize: 8, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, "risk-adjustment"),
    )
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Peak-sales comp ranking — your own program's projected peak revenue placed
// in rank order among real comparable drugs, with your entry highlighted.
//
// This visual already existed, but ONLY inside the generated PDF report — the
// Peak Sales Comps tool that owns the underlying data showed a table and
// nothing else, so the single most useful way to read "is my peak-sales
// assumption plausible?" required exporting a PDF to see. Surfaced here as a
// real component so the tool can show it inline.
//
// Deliberately NOT refactored into reportView.js's copy in the same pass:
// that path is verified working and print-styled against its own colour
// tokens, and this project's conventions are explicit that an architecture
// change gets its own isolated commit rather than riding along with a feature.
// ════════════════════════════════════════════════════════════════════════════
// Pure selection logic shared by the in-app chart and the PDF report. Only the
// LOGIC is shared, not the rendering: the report needs print-safe colour tokens
// and tighter sizing, so forcing both through one component would need more
// config props than it saves. What genuinely must not diverge is which comps
// get shown and where the case ranks — a bug fixed in one copy of that and not
// the other is the real failure mode, so it lives in one tested function.
function selectPeakSalesCompWindow(ownDrugs, allDrugs, windowSize) {
  const own = (ownDrugs || []).filter(d => d && d.peakSalesB > 0);
  if (!own.length) return null;
  const win = windowSize == null ? 6 : windowSize;
  const combined = [...(allDrugs || []), ...own].sort((a, b) => b.peakSalesB - a.peakSalesB);
  const ownIdx = combined.map((d, i) => d._own ? i : -1).filter(i => i >= 0);
  if (!ownIdx.length) return null;
  const lo = Math.max(0, Math.min(...ownIdx) - win);
  const hi = Math.min(combined.length, Math.max(...ownIdx) + win + 1);
  const rows = combined.slice(lo, hi);
  return {
    rows,
    maxB: Math.max(...rows.map(d => d.peakSalesB), 1),
    rank: Math.min(...ownIdx) + 1,
    total: combined.length
  };
}

function PeakSalesCompsChart({ ownDrugs, allDrugs, windowSize, height }) {
  const h = React.createElement;
  const own = (ownDrugs || []).filter(d => d && d.peakSalesB > 0);
  if (!own.length) {
    return h("div", { style: { padding: "14px 16px", borderRadius: 8, background: "var(--surface-2)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" } },
      "Pick an export-target case above with a modeled peak revenue to see where it ranks against these comps.");
  }
  const sel = selectPeakSalesCompWindow(ownDrugs, allDrugs, windowSize);
  if (!sel) return null;
  const { rows, maxB, rank, total } = sel;

  return h("div", null,
    h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", marginBottom: 10 } },
      "Your case ranks ", h("b", { style: { color: "var(--amber)" } }, "#" + rank), " of ", total,
      " by peak sales. Showing the ", rows.length, " comps nearest that rank — the ones your assumption is implicitly claiming to be comparable to."),
    h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
      rows.map((d, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8 }, title: d.drug + " — $" + d.peakSalesB + "B" + (d.company ? " (" + d.company + ")" : "") },
        h("div", { style: { width: 120, fontFamily: "var(--mono)", fontSize: 10, color: d._own ? "var(--amber)" : "var(--ink-3)", fontWeight: d._own ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 } }, d.drug),
        h("div", { style: { flex: 1, height: 13, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" } },
          h("div", { style: { height: "100%", width: (d.peakSalesB / maxB) * 100 + "%", background: d._own ? "var(--amber)" : "var(--teal)", borderRadius: 3, opacity: d._own ? 1 : 0.75 } })),
        h("div", { style: { width: 52, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10, color: d._own ? "var(--amber)" : "var(--ink-2)", fontWeight: d._own ? 700 : 400, flexShrink: 0 } },
          "$" + (d.peakSalesB >= 10 ? d.peakSalesB.toFixed(0) : d.peakSalesB.toFixed(1)) + "B")
      ))
    )
  );
}
