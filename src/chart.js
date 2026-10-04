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
// Gridline values a person would pick: steps of 1, 2, 2.5 or 5 x 10^n, with
// the axis widened to whole steps. Because every tick is a multiple of the
// step, zero is always one of them whenever the axis spans it — the old
// quarter-of-the-range gridlines labelled the profit/loss line "$1M".
function niceAxisTicks(minV, maxV, target) {
  target = target || 4;
  if (!(maxV > minV)) maxV = minV + 1;
  const rough = (maxV - minV) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(minV / step + 1e-9) * step, hi = Math.ceil(maxV / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  return { lo, hi, step, ticks };
}

function revenueChartYScale(allVals) {
  const maxV = Math.max(1, ...allVals);
  const minV = Math.min(0, ...allVals);
  const range = maxV - minV || 1;
  return { minV, maxV, range };
}

// xPrefix defaults to "Year " because every original caller plots the model's
// own relative calendar. The commercial tools plot real period labels
// ("2026 (Q1)"), where "Year 2026 (Q1)" would read as a mistake.
// The width a chart is actually drawn at, followed as the window resizes. A
// chart drawn on a fixed 900-wide canvas and scaled to fit shrank its axis text
// with it — to 7.5px at the 900px window minimum. Drawing at the real width
// keeps every label at its designed size. (jsdom has no layout: fallback.)
function useMeasuredWidth(ref, fallback) {
  const [w, setW] = React.useState(fallback);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const cw = Math.round(el.getBoundingClientRect().width); if (cw > 0) setW(prev => Math.abs(prev - cw) > 1 ? cw : prev); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function RevenueChart({ series, height, showLegend, xPrefix, xAxisPrefix, label }) {
  const h = React.createElement;
  height = height || 220;
  const wrapRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 900);
  const W = Math.max(320, measured), H = height, padL = 56, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const svgRef = React.useRef(null);

  if (!series || !series.length || !series[0].points || !series[0].points.length) {
    return h("div", { ref: wrapRef, style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "No data yet — fill in the revenue build to see a projection.");
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
  const scale = revenueChartYScale(allVals);
  // For an all-negative series the scale's maxV is floored at 1 (see its
  // tests); the axis itself only needs to reach 0.
  // An all-zero series (a fresh case) used to build a $0-$1 axis and print it
  // in millions — "$0.00M" four times. Give it a real $0-$1M scale and say
  // plainly that there is nothing to plot yet.
  const allZero = allVals.every(v => v === 0);
  const axis = niceAxisTicks(scale.minV, allZero ? 1e6 : allVals.some(v => v > 0) ? scale.maxV : 0);
  const minV = axis.lo, maxV = axis.hi, range = (maxV - minV) || 1;
  const nPoints = series[0].points.length;
  const x = i => padL + (i / Math.max(1, nPoints - 1)) * plotW;
  const y = v => padT + plotH - ((v - minV) / range) * plotH;

  const fmtM = v => {
    const av = Math.abs(v);
    // Enough decimals that neighbouring ticks never print the same label
    // (a 2.5M step would otherwise read $3M, $5M, $8M).
    const s = av >= 1e9 ? "$" + (av / 1e9).toFixed(axis.step < 1e8 ? 2 : 1).replace(/\.?0+$/, "") + "B"
      : av === 0 ? "$0" : "$" + (av / 1e6).toFixed(axis.step < 1e6 ? 2 : axis.step % 1e6 ? 1 : 0) + "M";
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
  const gridLines = axis.ticks.map(v => ({ v, yy: y(v) }));
  const hasZeroLine = minV < 0;
  const zeroY = y(0);
  const tooltipOnRight = hoverIdx != null && x(hoverIdx) > padL + plotW * 0.65;

  return h("div", { ref: wrapRef, style: { position: "relative" } },
    h("svg", { ref: svgRef, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Chart by year", style: { width: "100%", height, display: "block", cursor: "crosshair" },
        onMouseMove: handleMove, onMouseLeave: () => setHoverIdx(null) },
      gridLines.map((g, i) => h("g", { key: i },
        h("line", { x1: padL, x2: W - padR, y1: g.yy, y2: g.yy, stroke: "var(--rule)", strokeWidth: 1, strokeDasharray: i === 0 || g.v === 0 ? "none" : "3,3" }),
        h("text", { x: padL - 8, y: g.yy + 3, textAnchor: "end", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtM(g.v))
      )),
      hasZeroLine && h("line", { x1: padL, x2: W - padR, y1: zeroY, y2: zeroY, stroke: "var(--ink-3)", strokeWidth: 1.25 }),
      allZero && h("text", { x: padL + plotW / 2, y: padT + plotH / 2, textAnchor: "middle", fontSize: 12, fontFamily: "var(--sans)", fill: "var(--ink-3)" }, "Nothing to plot yet — every year is $0 so far"),
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
        key: i, x: x(i), y: H - 6, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)"
      }, (xAxisPrefix != null ? xAxisPrefix : "Y") + p.label)),
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
      h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 2 } }, (xPrefix != null ? xPrefix : "Year ") + series[0].points[hoverIdx].label),
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
// Year-by-year projection chart — each year's odds-weighted cash flows as a
// stacked bar (revenue up, the costs that eat it down), the revenue the odds
// are taking away as a pale cap, and the running present value as a line.
// rows come from computeProjectionRows; startYear labels index 0.
// ════════════════════════════════════════════════════════════════════════════
const PROJECTION_PARTS = [
  { key: "revenue", label: "Revenue, odds-weighted", color: "var(--teal)" },
  { key: "atRisk", label: "Revenue at risk", color: "var(--teal)", opacity: 0.22 },
  { key: "commercialCosts", label: "COGS, sales & marketing", color: "var(--amber)", opacity: 0.8 },
  { key: "rnd", label: "R&D", color: "var(--red)", opacity: 0.8 },
  { key: "ga", label: "Corporate G&A", color: "var(--ink-3)", opacity: 0.8 },
  { key: "tax", label: "Cash tax", color: "var(--warn)", opacity: 0.8 }
];
// works: the rows are the if-it-works world (no odds), so the legend and the
// tooltip say plain "Revenue" and there is no revenue at risk to key.
function ProjectionChart({ rows, startYear, height, label, works }) {
  const h = React.createElement;
  height = height || 300;
  const wrapRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 900);
  const [hoverIdx, setHoverIdx] = React.useState(null);
  if (!rows || !rows.length) return h("div", { ref: wrapRef, style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "No projection yet — fill in the revenue build to see one.");

  const costOf = r => r.commercialCosts + r.rnd + r.ga + r.tax;
  const top = Math.max(...rows.map(r => Math.max(r.revenueIfWorks, r.revenue, r.runningPV)), 1);
  const bottom = Math.min(0, ...rows.map(r => Math.min(-costOf(r), r.runningPV)));
  const axis = niceAxisTicks(bottom, top, 5);
  // The right margin holds the running total's end label, so it never sits
  // on a bar; the top margin keeps the tallest bar off the card edge.
  const W = Math.max(360, measured), H = height, padL = 58, padR = 92, padT = 10, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const y = v => padT + (axis.hi - v) / ((axis.hi - axis.lo) || 1) * plotH;
  const bw = plotW / rows.length;
  const barX = i => padL + i * bw + bw * 0.18, barW = bw * 0.64;
  const cx = i => padL + i * bw + bw / 2;
  const fmtAxis = v => {
    const a = Math.abs(v);
    const s = a === 0 ? "$0" : a >= 1e9 ? "$" + (a / 1e9).toFixed(axis.step < 1e8 ? 2 : 1).replace(/\.?0+$/, "") + "B" : "$" + (a / 1e6).toFixed(0) + "M";
    return (v < 0 ? "-" : "") + s;
  };
  const labelEvery = bw >= 38 ? 1 : bw >= 19 ? 2 : Math.ceil(34 / bw);
  const line = rows.map((r, i) => (i ? "L" : "M") + cx(i).toFixed(1) + "," + y(r.runningPV).toFixed(1)).join("");
  const last = rows[rows.length - 1];
  const handleMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width * W - padL) / bw);
    setHoverIdx(i >= 0 && i < rows.length ? i : null);
  };
  const hr = hoverIdx != null ? rows[hoverIdx] : null;
  const tipRight = hoverIdx != null && cx(hoverIdx) > padL + plotW * 0.6;

  return h("div", { ref: wrapRef, style: { position: "relative" } },
    h("div", { className: "proj-legend" },
      PROJECTION_PARTS.filter(p => !(works && p.key === "atRisk")).map(p => h("span", { key: p.key }, h("i", { style: { background: p.color, opacity: p.opacity || 1 } }), works && p.key === "revenue" ? "Revenue" : p.label)),
      h("span", null, h("i", { className: "proj-legend-line" }), "Running present value"),
      rows.some(r => r.isLaunch) && h("span", null, h("i", { className: "proj-legend-band launch" }), "Launch year"),
      rows.some(r => r.isLOE) && h("span", null, h("i", { className: "proj-legend-band loe" }), "Loss of exclusivity")),
    h("svg", { ref: svgRef, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Year-by-year cash flows", "data-titled": "1", style: { width: "100%", height, display: "block" },
        onMouseMove: handleMove, onMouseLeave: () => setHoverIdx(null) },
      rows.map((r, i) => (r.isLaunch || r.isLOE) && h("rect", { key: "band" + i, x: padL + i * bw + 1, y: padT, width: bw - 2, height: plotH, rx: 4,
        fill: r.isLaunch ? "var(--teal)" : "var(--warn)", opacity: 0.07 })),
      axis.ticks.map((v, i) => h("g", { key: "t" + i },
        h("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v === 0 ? "var(--ink-3)" : "var(--rule)", strokeWidth: v === 0 ? 1.25 : 1, strokeDasharray: v === 0 ? "none" : "3,3" }),
        h("text", { x: padL - 8, y: y(v) + 3.5, textAnchor: "end", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtAxis(v)))),
      hoverIdx != null && h("rect", { x: padL + hoverIdx * bw, y: padT, width: bw, height: plotH, fill: "var(--ink-3)", opacity: 0.08 }),
      rows.map((r, i) => {
        const parts = [];
        const atRisk = Math.max(0, r.revenueIfWorks - r.revenue);
        if (r.revenue > 0) parts.push(h("rect", { key: "rv", x: barX(i), y: y(r.revenue), width: barW, height: y(0) - y(r.revenue), fill: "var(--teal)" }));
        if (atRisk > 0) parts.push(h("rect", { key: "ar", x: barX(i), y: y(r.revenue + atRisk), width: barW, height: y(r.revenue) - y(r.revenue + atRisk), fill: "var(--teal)", opacity: 0.22 }));
        let base = 0;
        PROJECTION_PARTS.slice(2).forEach(p => {
          const v = r[p.key];
          if (v > 0) { parts.push(h("rect", { key: p.key, x: barX(i), y: y(-base), width: barW, height: y(-base - v) - y(-base), fill: p.color, opacity: p.opacity })); base += v; }
        });
        return h("g", { key: "b" + i }, parts,
          i % labelEvery === 0 && h("text", { x: cx(i), y: H - 6, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, String(startYear + r.index)));
      }),
      h("path", { d: line, fill: "none", stroke: "var(--surface)", strokeWidth: 6, strokeLinejoin: "round" }),
      h("path", { d: line, fill: "none", stroke: "var(--amber)", strokeWidth: 2.5, strokeLinejoin: "round" }),
      h("circle", { cx: cx(rows.length - 1), cy: y(last.runningPV), r: 4, fill: "var(--amber)" }),
      // From the last bar's right edge, not its centre: at ~34px per year the
      // bar's half-width reached the old centre + 12 offset and the label
      // touched the 2050 bar (seen exporting the PepGen case).
      h("text", { x: Math.max(cx(rows.length - 1) + 12, barX(rows.length - 1) + barW + 8), y: y(last.runningPV) - 1, fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", fill: "var(--amber)" }, fmtMoney(last.runningPV)),
      h("text", { x: Math.max(cx(rows.length - 1) + 12, barX(rows.length - 1) + barW + 8), y: y(last.runningPV) + 13, fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, "by " + (startYear + last.index))
    ),
    hr && h("div", { className: "proj-tip", style: {
        top: padT + 4, left: tipRight ? "auto" : (cx(hoverIdx) / W * 100) + "%", right: tipRight ? ((W - cx(hoverIdx)) / W * 100) + "%" : "auto",
        transform: tipRight ? "translate(-10px, 0)" : "translate(10px, 0)" } },
      h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 3 } }, String(startYear + hr.index) + (hr.phase ? " · " + hr.phase : "")),
      h("div", null, (works ? "Revenue: " : "Revenue × odds: ") + fmtMoney(hr.revenue)),
      hr.revenueIfWorks > hr.revenue && h("div", null, "If it works: " + fmtMoney(hr.revenueIfWorks)),
      h("div", null, "Costs: " + fmtMoney(-costOf(hr))),
      h("div", { style: { color: "var(--ink-1)" } }, "Cash flow: " + fmtMoney(hr.fcf)),
      h("div", { style: { color: "var(--amber)" } }, "Running PV: " + fmtMoney(hr.runningPV)))
  );
}

// ── Label placement shared by the marker charts ────────────────────────────
// Text width in px for a label drawn in the app's mono face. Measured with a
// canvas where there is one; jsdom has none, so a per-character estimate
// stands in (mono glyphs are ~0.6em wide).
let _labelCanvas = null;
function measureLabel(text, px, weight) {
  try {
    // jsdom has no 2D context (and logs an error when asked for one).
    if (!_labelCanvas && typeof CanvasRenderingContext2D !== "undefined") _labelCanvas = document.createElement("canvas").getContext("2d");
    if (_labelCanvas) {
      const mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "monospace";
      _labelCanvas.font = (weight || 400) + " " + px + "px " + mono;
      const w = _labelCanvas.measureText(text).width;
      if (w > 0) return w;
    }
  } catch (e) { /* fall through to the estimate */ }
  return String(text).length * px * 0.62;
}
// Spreads labels along one row so none overlap, keeping them in the same
// left-to-right order as the points they name and each as close to its own
// point as the others allow. Because the order is preserved, the leader lines
// from each label down to its point can never cross each other or another
// label — which stacked rows of labels could not promise (a line from the top
// row ran through a label in the row below). items: [{ x, w }]; returns the
// centre x for each label. If they cannot all fit, they spill past the edge
// rather than overlap.
function spreadLabels(items, minX, maxX, gap) {
  const order = items.map((_, i) => i).sort((a, b) => items[a].x - items[b].x);
  const c = items.map(it => it.x);
  let prevRight = -Infinity;
  order.forEach(i => { const w = items[i].w, l = Math.max(c[i] - w / 2, prevRight + gap, minX); c[i] = l + w / 2; prevRight = l + w; });
  let nextLeft = Infinity;
  order.slice().reverse().forEach(i => { const w = items[i].w, r = Math.min(c[i] + w / 2, nextLeft - gap, maxX); c[i] = r - w / 2; nextLeft = r - w; });
  return c;
}

// ════════════════════════════════════════════════════════════════════════════
// Histogram of simulated values — every trial, binned on round-number steps,
// with the bins at or above a reference price shaded green and labelled
// marker lines (percentiles, today's price, the point estimate) whose labels
// sit in their own lanes above the bars.
// markers: [{ value, label, color, dash }]; price: bins >= price go green.
// ════════════════════════════════════════════════════════════════════════════
function histogramBins(sortedValues, targetBins) {
  const lo0 = sortedValues[0], hi0 = sortedValues[sortedValues.length - 1];
  if (!(hi0 > lo0)) return { lo: lo0 - 0.5, width: 1, counts: [sortedValues.length] };
  const width = niceAxisTicks(0, hi0 - lo0, targetBins || 30).step;
  const lo = Math.floor(lo0 / width) * width;
  const n = Math.max(1, Math.ceil((hi0 - lo) / width - 1e-9));
  const counts = new Array(n).fill(0);
  sortedValues.forEach(v => { counts[Math.min(n - 1, Math.floor((v - lo) / width + 1e-9))]++; });
  return { lo, width, counts };
}
function HistogramChart({ sortedValues, markers, price, height, label, fmt }) {
  const h = React.createElement;
  height = height || 260;
  fmt = fmt || fmtShare;
  const wrapRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 900);
  const [hoverBin, setHoverBin] = React.useState(null);
  if (!sortedValues || !sortedValues.length) return h("div", { ref: wrapRef });
  const bins = histogramBins(sortedValues, 30);
  const hi = bins.lo + bins.width * bins.counts.length;
  const W = Math.max(360, measured), padL = 16, padR = 16, padB = 30;
  const x = v => padL + (v - bins.lo) / (hi - bins.lo) * (W - padL - padR);
  const ms = (markers || []).filter(m => m.value != null && isFinite(m.value) && m.value >= bins.lo && m.value <= hi)
    .map(m => ({ ...m, text: m.label + " " + fmt(m.value) })).sort((a, b) => a.value - b.value);
  // One row of labels, spread apart in marker order, each joined to its
  // marker by a leader; the marker lines start below the leaders.
  const labelY = 14, top = ms.length ? 44 : 10;
  const centers = spreadLabels(ms.map(m => ({ x: x(m.value), w: measureLabel(m.text, 11, 600) })), padL, W - padR, 14);
  const H = height, y1 = H - padB;
  const maxC = Math.max(...bins.counts, 1);
  const yc = c => y1 - c / maxC * (y1 - top);
  const axisT = niceAxisTicks(bins.lo, hi, 8);
  const ticks = axisT.ticks.filter(v => v >= bins.lo - 1e-9 && v <= hi + 1e-9);
  // Whole-number steps read as "$20", not "$20.00".
  const tickFmt = v => axisT.step >= 1 && Number.isInteger(v) && fmt === fmtShare ? (v < 0 ? "-$" : "$") + Math.abs(v) : fmt(v);
  const handleMove = e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width * W - padL) / ((W - padL - padR) / bins.counts.length));
    setHoverBin(i >= 0 && i < bins.counts.length ? i : null);
  };
  const tipRight = hoverBin != null && hoverBin > bins.counts.length * 0.6;
  return h("div", { ref: wrapRef, style: { position: "relative" } },
    h("svg", { ref: svgRef, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Distribution of simulated values", "data-titled": "1", style: { width: "100%", height: H, display: "block" },
        onMouseMove: handleMove, onMouseLeave: () => setHoverBin(null) },
      bins.counts.map((c, i) => {
        const a = bins.lo + i * bins.width, above = price > 0 && a + bins.width / 2 >= price;
        const bx = x(a) + 1.5, bw = Math.max(1, x(a + bins.width) - x(a) - 3);
        return c > 0 && h("rect", { key: i, x: bx, y: yc(c), width: bw, height: y1 - yc(c), rx: 2,
          fill: above ? "var(--green)" : "var(--teal)", opacity: hoverBin === i ? 0.95 : above ? 0.7 : 0.5 });
      }),
      h("line", { x1: padL, x2: W - padR, y1: y1, y2: y1, stroke: "var(--ink-3)" }),
      ticks.map((v, i) => h("text", { key: "t" + i, x: x(v), y: y1 + 18, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, tickFmt(v))),
      ms.map((m, i) => h("g", { key: "m" + i },
        h("polyline", { points: centers[i] + "," + (labelY + 5) + " " + centers[i] + "," + (labelY + 10) + " " + x(m.value) + "," + (top - 4), fill: "none", stroke: m.color, strokeWidth: 1, opacity: 0.8 }),
        h("line", { x1: x(m.value), x2: x(m.value), y1: top - 4, y2: y1, stroke: m.color, strokeWidth: 1.5, strokeDasharray: m.dash || "none" }),
        h("text", { x: centers[i], y: labelY, textAnchor: "middle", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: m.color }, m.text)))
    ),
    hoverBin != null && h("div", { className: "proj-tip", style: { top: top, left: tipRight ? "auto" : (x(bins.lo + (hoverBin + 1) * bins.width) / W * 100) + "%", right: tipRight ? ((W - x(bins.lo + hoverBin * bins.width)) / W * 100) + "%" : "auto", transform: tipRight ? "translate(-6px, 0)" : "translate(6px, 0)" } },
      h("div", { style: { color: "var(--ink-1)", fontWeight: 700 } }, fmt(bins.lo + hoverBin * bins.width) + " – " + fmt(bins.lo + (hoverBin + 1) * bins.width)),
      h("div", null, bins.counts[hoverBin].toLocaleString() + " of " + sortedValues.length.toLocaleString() + " trials"))
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Break-even curve — fair value per share at every peak-revenue level (from
// computeBreakEvenCurve), today's price as a line, this case's point, the
// break-even where they cross, and the Bear→Bull peak range as a band. Each
// label is placed on the side of its point the rising curve leaves empty:
// this case above-left, the break-even below-right.
// ════════════════════════════════════════════════════════════════════════════
function BreakEvenChart({ curve, height, label }) {
  const h = React.createElement;
  height = height || 300;
  const wrapRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 560);
  if (!curve || !curve.points || curve.points.length < 2) return h("div", { ref: wrapRef });
  const pts = curve.points;
  const W = Math.max(320, measured), H = height, padL = 52, padR = 14, padT = 12, padB = 44;
  const xs = niceAxisTicks(Math.min(pts[0].peak, curve.bearPeak), Math.max(pts[pts.length - 1].peak, curve.bullPeak), 4);
  const ys = niceAxisTicks(Math.min(0, ...pts.map(p => p.perShare), curve.price || 0), Math.max(...pts.map(p => p.perShare), curve.price || 0), 4);
  const x = v => padL + (v - xs.lo) / ((xs.hi - xs.lo) || 1) * (W - padL - padR);
  const y = v => padT + (ys.hi - v) / ((ys.hi - ys.lo) || 1) * (H - padT - padB);
  const path = pts.map((p, i) => (i ? "L" : "M") + x(p.peak).toFixed(1) + "," + y(p.perShare).toFixed(1)).join("");
  // Curve height (screen y) at a given peak, interpolated between runs.
  const curveY = v => { for (let i = 1; i < pts.length; i++) if (v <= pts[i].peak) { const a = pts[i - 1], b = pts[i]; return y(a.perShare + (v - a.peak) / ((b.peak - a.peak) || 1) * (b.perShare - a.perShare)); } return y(pts[pts.length - 1].perShare); };
  const bx0 = x(curve.bearPeak), bx1 = x(curve.bullPeak);
  const bandText = "Bear → Bull peak", bandW = measureLabel(bandText, 10.5);
  const bandTopY = padT + 14, bandBotY = H - padB - 6;
  const clearAt = ty => [bx0 + (bx1 - bx0) / 2 - bandW / 2, bx0 + (bx1 - bx0) / 2 + bandW / 2].every(xx => Math.abs(curveY(xs.lo + (xx - padL) / (W - padL - padR) * (xs.hi - xs.lo)) - ty) > 14);
  const bandLabelY = bx1 - bx0 > bandW + 8 ? (clearAt(bandTopY - 4) ? bandTopY : clearAt(bandBotY - 4) ? bandBotY : null) : null;
  const price = curve.price, py = price != null ? y(price) : null;
  const priceText = "today " + fmtShare(price || 0);
  const bp = curve.basePeak, bv = curve.basePerShare;
  const caseText = "this case: " + fmtMoney(bp) + " → " + fmtShare(bv);
  const caseW = measureLabel(caseText, 11, 600);
  // The curve rises, so above-left and below-right of any point on it are
  // empty. This case's label goes into whichever of those is away from the
  // price line; the break-even label takes the other one, so the two never
  // meet however close the points are.
  const caseBelow = price != null && bv < price;
  const caseLeft = caseBelow ? x(bp) + 16 + caseW > W - padR : x(bp) - 16 - caseW > padL;
  const caseDy = caseBelow ? 20 : -20, caseTy = caseBelow ? y(bv) + 34 : y(bv) - 23;
  const beAbove = caseBelow;
  const beX = curve.breakEvenPeak != null ? x(curve.breakEvenPeak) : null;
  const beW = beX != null ? measureLabel("break-even ≈ " + fmtMoney(curve.breakEvenPeak), 11, 600) : 0;
  const priceW = measureLabel(priceText, 11, 600), priceL = W - padR - 2 - priceW;
  // "today" sits at the right end of its line: above it, unless the curve
  // runs there, or the break-even label would reach it from the same side.
  let priceBelow = price != null && curveY(xs.hi) > py - 22;
  if (beX != null && beAbove && !priceBelow && beX - 13 > priceL - 8) priceBelow = true;
  if (beX != null && !beAbove && priceBelow && beX + 13 + beW > priceL - 8) priceBelow = false;
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Fair value at each peak revenue level", "data-titled": "1", style: { width: "100%", height: H, display: "block" } },
      ys.ticks.map((v, i) => h("g", { key: "y" + i },
        h("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v === 0 ? "var(--ink-3)" : "var(--rule)", strokeDasharray: v === 0 ? "none" : "3,3" }),
        h("text", { x: padL - 8, y: y(v) + 3.5, textAnchor: "end", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, (v < 0 ? "-$" : "$") + Math.abs(v)))),
      xs.ticks.map((v, i) => h("text", { key: "x" + i, x: x(v), y: H - padB + 17, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtMoney(v, v >= 1e9 ? 1 : 0))),
      h("text", { x: padL + (W - padL - padR) / 2, y: H - 6, textAnchor: "middle", fontSize: 11, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, "Peak revenue"),
      h("rect", { x: bx0, y: padT, width: Math.max(0, bx1 - bx0), height: H - padT - padB, fill: "var(--teal)", opacity: 0.07 }),
      bandLabelY != null && h("text", { x: (bx0 + bx1) / 2, y: bandLabelY, textAnchor: "middle", fontSize: 10.5, fontFamily: "var(--mono)", fill: "var(--teal)" }, bandText),
      h("path", { d: path, fill: "none", stroke: "var(--teal)", strokeWidth: 2.5, strokeLinejoin: "round" }),
      price != null && h("line", { x1: padL, x2: W - padR, y1: py, y2: py, stroke: "var(--warn)", strokeWidth: 1.5 }),
      price != null && h("text", { x: W - padR - 2, y: priceBelow ? py + 16 : py - 7, textAnchor: "end", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--warn)" }, priceText),
      h("line", { x1: x(bp), y1: y(bv) + (caseBelow ? 6 : -6), x2: x(bp) + (caseLeft ? -12 : 12), y2: y(bv) + caseDy, stroke: "var(--ink-1)" }),
      h("text", { x: x(bp) + (caseLeft ? -15 : 15), y: caseTy, textAnchor: caseLeft ? "end" : "start", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--ink-1)" }, caseText),
      h("circle", { cx: x(bp), cy: y(bv), r: 5, fill: "var(--surface)", stroke: "var(--ink-1)", strokeWidth: 2 }),
      curve.breakEvenPeak != null && h("g", null,
        h("line", { x1: x(curve.breakEvenPeak), y1: py + (beAbove ? -6 : 6), x2: x(curve.breakEvenPeak) + (beAbove ? -10 : 10), y2: py + (beAbove ? -18 : 18), stroke: "var(--warn)" }),
        h("text", { x: x(curve.breakEvenPeak) + (beAbove ? -13 : 13), y: beAbove ? py - 21 : py + 30, textAnchor: beAbove ? "end" : "start", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--warn)" }, "break-even ≈ " + fmtMoney(curve.breakEvenPeak)),
        h("circle", { cx: x(curve.breakEvenPeak), cy: py, r: 5, fill: "var(--surface)", stroke: "var(--warn)", strokeWidth: 2 })))
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Waterfall — a value built up step by step to a total, then optionally the
// gap to a comparison (the market value), drawn as its own floating bar.
// steps: [{ label, value }] — the first is the starting amount, the rest are
// signed changes. total / compare: { label, value, sub }. Labels: amounts
// above each bar (a falling step's amount sits above its top too); the gap's
// amount goes under its floating bar, where its column is always empty.
// ════════════════════════════════════════════════════════════════════════════
function WaterfallChart({ steps, total, compare, height, label }) {
  const h = React.createElement;
  height = height || 320;
  const wrapRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 560);
  if (!steps || !steps.length) return h("div", { ref: wrapRef });
  const bars = [];
  let run = 0;
  // Whole millions above $100M and two-decimal billions keep the amounts short
  // enough that neighbouring labels never meet.
  const money = v => Math.abs(v) >= 1e9 ? fmtMoney(v, 2) : Math.abs(v) >= 1e8 ? fmtMoney(v, 0) : fmtMoney(v, 1);
  // A zero step (no debt) is a bar with nothing in it; the text line under the
  // chart still lists it.
  steps = steps.filter((s, i) => i === 0 || Math.abs(s.value) >= 0.5);
  steps.forEach((s, i) => {
    const a = i === 0 ? 0 : run, b = i === 0 ? s.value : run + s.value;
    bars.push({ kind: i === 0 ? "start" : "step", label: s.label, a, b, text: (i === 0 ? "" : s.value >= 0 ? "+" : "−") + money(i === 0 ? s.value : Math.abs(s.value)) });
    run = b;
  });
  if (total) bars.push({ kind: "total", label: total.label, sub: total.sub, a: 0, b: total.value, text: money(total.value) });
  if (compare && total) {
    const gap = compare.value - total.value;
    bars.push({ kind: "gap", label: gap >= 0 ? "Price premium" : "Price discount", a: total.value, b: compare.value, text: (gap >= 0 ? "+" : "−") + money(Math.abs(gap)), up: gap >= 0 });
    bars.push({ kind: "compare", label: compare.label, sub: compare.sub, a: 0, b: compare.value, text: money(compare.value) });
  }
  // The right margin fits half of the last bar's widest label, so a per-share
  // line under the last bar is never cut at the card edge.
  const lastW = Math.max(measureLabel(bars[bars.length - 1].sub || "", 11, 700), measureLabel(bars[bars.length - 1].text, 11, 600));
  const W = Math.max(320, measured), H = height, padL = 50, padT = 24, padB = 58;
  const padR = Math.max(8, lastW / 2 - (W - padL) / bars.length * 0.33 + 4);
  const ax = niceAxisTicks(Math.min(0, ...bars.map(b => Math.min(b.a, b.b))), Math.max(0, ...bars.map(b => Math.max(b.a, b.b))), 5);
  const y = v => padT + (ax.hi - v) / ((ax.hi - ax.lo) || 1) * (H - padT - padB);
  const pitch = (W - padL - padR) / bars.length, bw = pitch * 0.66;
  const fontV = Math.max(...bars.map(b => measureLabel(b.text, 11, 600))) > pitch - 6 ? 10 : 11;
  // Category names wrap onto two lines at the space nearest the middle.
  const wrap = t => { const w = String(t).split(" "); if (w.length < 2) return [t, ""]; let best = 1, bd = Infinity; for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length); if (d < bd) { bd = d; best = i; } } return [w.slice(0, best).join(" "), w.slice(best).join(" ")]; };
  const fill = b => b.kind === "total" ? "var(--slate)" : b.kind === "compare" ? "var(--warn)" : b.kind === "gap" ? (b.up ? "var(--red)" : "var(--green)") : b.b < b.a ? "var(--red)" : "var(--teal)";
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Value bridge", "data-titled": "1", style: { width: "100%", height: H, display: "block" } },
      ax.ticks.map((v, i) => h("g", { key: "t" + i },
        h("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), stroke: v === 0 ? "var(--ink-3)" : "var(--rule)", strokeDasharray: v === 0 ? "none" : "3,3" }),
        h("text", { x: padL - 6, y: y(v) + 3.5, textAnchor: "end", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtMoney(v, Math.abs(ax.step) >= 1e9 ? 0 : 1).replace(/\.0([MB])$/, "$1")))),
      bars.map((b, i) => {
        const bx = padL + i * pitch + (pitch - bw) / 2, cx = bx + bw / 2, top = y(Math.max(b.a, b.b)), bot = y(Math.min(b.a, b.b));
        const [l1, l2] = wrap(b.label);
        return h("g", { key: i },
          h("rect", { x: bx, y: top, width: bw, height: Math.max(2, bot - top), rx: 3, fill: fill(b), opacity: b.kind === "step" ? 0.75 : b.kind === "gap" ? 0.8 : 1 }),
          // A bar standing on zero is labelled above; one hanging below zero
          // (a negative enterprise value or total) and the gap bar, below.
          h("text", { x: cx, y: b.kind === "gap" || (b.kind !== "step" && b.b < 0) ? bot + 15 : top - 7, textAnchor: "middle", fontSize: fontV, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--ink-1)" }, b.text),
          h("text", { x: cx, y: H - padB + 16, textAnchor: "middle", fontSize: 10, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, l1),
          l2 && h("text", { x: cx, y: H - padB + 29, textAnchor: "middle", fontSize: 10, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, l2),
          b.sub && h("text", { x: cx, y: H - padB + 47, textAnchor: "middle", fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", fill: "var(--ink-1)" }, b.sub));
      }))
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Outcome range strip — every value that matters on one line: what is left if
// the readout fails, your Bear/Base/Bull, today's price, and the value if the
// drug works. marks: [{ value, name, text, color, row: "above" | "below" }].
// Each row's two-line labels are spread in order (spreadLabels) with a leader
// to the strip, so no label meets another and no leader crosses a label.
// band: [lo, hi] shaded along the strip (the Bear–Bull range).
// ════════════════════════════════════════════════════════════════════════════
function OutcomeRangeStrip({ marks, band, label }) {
  const h = React.createElement;
  const wrapRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 900);
  const ms = (marks || []).filter(m => m.value != null && isFinite(m.value));
  if (ms.length < 2) return h("div", { ref: wrapRef });
  const W = Math.max(360, measured), padL = 24, padR = 24;
  const ax = niceAxisTicks(Math.min(0, ...ms.map(m => m.value)), Math.max(...ms.map(m => m.value)), 5);
  const x = v => padL + (v - ax.lo) / ((ax.hi - ax.lo) || 1) * (W - padL - padR);
  const above = ms.filter(m => m.row !== "below").sort((a, b) => a.value - b.value);
  const below = ms.filter(m => m.row === "below").sort((a, b) => a.value - b.value);
  const widthOf = m => Math.max(measureLabel(m.name, 12, 600), measureLabel(m.text, 12));
  const place = row => spreadLabels(row.map(m => ({ x: x(m.value), w: widthOf(m) })), padL / 2, W - padR / 2, 16);
  const cAbove = place(above), cBelow = place(below);
  const stripY = above.length ? 66 : 20, tickY = stripY + 24, rowTop = stripY + 46;
  const H = below.length ? rowTop + 36 : tickY + 8;
  const lo = Math.min(...ms.map(m => m.value)), hi = Math.max(...ms.map(m => m.value));
  // A below-row leader crosses the tick row; skip any tick label it would touch.
  const leaderXAtTick = below.map((m, i) => x(m.value) + (cBelow[i] - x(m.value)) * ((tickY - 4 - stripY) / (rowTop - 14 - stripY)));
  const tickOk = v => leaderXAtTick.every(lx => Math.abs(lx - x(v)) > 22);
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Range of outcomes per share", "data-titled": "1", style: { width: "100%", height: H, display: "block" } },
      h("rect", { x: x(lo) - 5, y: stripY - 5, width: x(hi) - x(lo) + 10, height: 10, rx: 5, fill: "var(--surface-2)", stroke: "var(--rule)" }),
      band && h("rect", { x: x(band[0]) - 5, y: stripY - 5, width: Math.max(10, x(band[1]) - x(band[0]) + 10), height: 10, rx: 5, fill: "var(--teal)", opacity: 0.22 }),
      ax.ticks.filter(tickOk).map((v, i) => h("text", { key: "t" + i, x: x(v), y: tickY, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, (v < 0 ? "-$" : "$") + Math.abs(v))),
      above.map((m, i) => h("g", { key: "a" + i },
        h("polyline", { points: cAbove[i] + ",38 " + cAbove[i] + ",42 " + x(m.value) + "," + (stripY - 9), fill: "none", stroke: m.color, strokeWidth: 1.25 }),
        h("text", { x: cAbove[i], y: 15, textAnchor: "middle", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", fill: m.color }, m.name),
        h("text", { x: cAbove[i], y: 31, textAnchor: "middle", fontSize: 12, fontFamily: "var(--mono)", fill: "var(--ink-1)" }, m.text))),
      below.map((m, i) => h("g", { key: "b" + i },
        h("polyline", { points: x(m.value) + "," + (stripY + 9) + " " + cBelow[i] + "," + (rowTop - 18) + " " + cBelow[i] + "," + (rowTop - 14), fill: "none", stroke: m.color, strokeWidth: 1.25 }),
        h("text", { x: cBelow[i], y: rowTop, textAnchor: "middle", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", fill: m.color }, m.name),
        h("text", { x: cBelow[i], y: rowTop + 16, textAnchor: "middle", fontSize: 12, fontFamily: "var(--mono)", fill: "var(--ink-1)" }, m.text))),
      ms.map((m, i) => h("circle", { key: "d" + i, cx: x(m.value), cy: stripY, r: 5, fill: m.color, stroke: "var(--surface)", strokeWidth: 1.5 })))
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Scatter chart — for comp positioning (e.g. deal value vs. premium), with an
// optional single "your case" point rendered distinctly so you can see where
// your own assumption sits among real comps.
// ════════════════════════════════════════════════════════════════════════════
// Where the x = y line's label goes: the spot nearest the line's top-right
// end (below the line) whose box stays 4px clear of the line and clear of
// every point by its hover radius plus 4px. It used to sit at that one fixed
// spot, which is exactly where the Portfolio's case landed at 65% modelled
// against 55% implied — the label was drawn over the dot. Returns the text's
// left edge and baseline; the fixed spot if nothing clears (never seen).
function placeDiagonalLabel(text, pts, g) {
  const w = measureLabel(text, 10), asc = 8, desc = 3, clear = 11;
  const value = x => g.minX + ((x - g.padL) / g.plotW) * (g.maxX - g.minX);
  const lineY = x => g.toY(value(x));
  const fits = (x0, base) => {
    const x1 = x0 + w, y0 = base - asc, y1 = base + desc;
    if (x0 < g.padL + 4 || x1 > g.padL + g.plotW - 4 || y0 < g.padT + 2 || y1 > g.padT + g.plotH - 2) return false;
    // The line rises to the right, so the box clears it if its top is below
    // the line at its left edge, or its bottom above the line at its right.
    if (!(y0 - 4 > lineY(x0)) && !(y1 + 4 < lineY(x1))) return false;
    return pts.every(p => {
      const cx = g.toX(p.x), cy = g.toY(p.y);
      const dx = Math.max(x0 - cx, 0, cx - x1), dy = Math.max(y0 - cy, 0, cy - y1);
      return dx * dx + dy * dy > clear * clear;
    });
  };
  const px = g.toX(g.maxX) - 4 - w, py = g.toY(g.minX + 0.7 * (g.maxX - g.minX)) + 4;
  let best = null, bestD = Infinity;
  for (let x0 = g.padL + 4; x0 + w <= g.padL + g.plotW - 4; x0 += 4) {
    for (let base = g.padT + 2 + asc; base + desc <= g.padT + g.plotH - 2; base += 3) {
      const d = (x0 - px) * (x0 - px) + (base - py) * (base - py);
      if (d < bestD && fits(x0, base)) { best = { x: x0, y: base }; bestD = d; }
    }
  }
  return best || { x: px, y: py };
}

// A highlighted point's own label ("Your case"): the first of eight spots
// around it (up-right first, as before) that stays inside the plot and clear
// of every other point by its hover radius plus 4px. It used to sit up-right
// whatever was there, so a case among a cluster of deals could have its name
// drawn across one. Falls back to up-right.
function placePointLabel(text, anchor, pts, g) {
  const w = measureLabel(text, 10, 700), asc = 8, desc = 3, clear = 11;
  const cx = g.toX(anchor.x), cy = g.toY(anchor.y);
  const spots = [[12, -8], [12, 14], [-12 - w, -8], [-12 - w, 14], [-w / 2, -14], [-w / 2, 22], [12, 3], [-12 - w, 3]];
  for (const [dx, dy] of spots) {
    const x0 = cx + dx, base = cy + dy, x1 = x0 + w, y0 = base - asc, y1 = base + desc;
    if (x0 < g.padL + 2 || x1 > g.padL + g.plotW || y0 < g.padT || y1 > g.padT + g.plotH) continue;
    if (pts.every(p => {
      const px = g.toX(p.x), py = g.toY(p.y);
      const ex = Math.max(x0 - px, 0, px - x1), ey = Math.max(y0 - py, 0, py - y1);
      return ex * ex + ey * ey > clear * clear;
    })) return { x: x0, y: base };
  }
  return { x: cx + 12, y: cy - 8 };
}

function ScatterChart({ points, highlightPoint, xLabel, yLabel, xFmt, yFmt, height, label, diagonal }) {
  const h = React.createElement;
  height = height || 280;
  // Drawn at the card's real width (a fixed 560 left half the M&A card
  // empty). A chart with the x = y diagonal stays near-square, so the line
  // still reads as "the same on both axes".
  const wrapRef = React.useRef(null);
  const measured = useMeasuredWidth(wrapRef, 560);
  const W = diagonal ? 560 : Math.max(360, measured), H = height, padL = 60, padR = 20, padT = 16, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const [hover, setHover] = React.useState(null); // { kind: 'point'|'highlight', idx }

  const allPoints = highlightPoint ? [...points, highlightPoint] : points;
  if (!allPoints.length) {
    return h("div", { ref: wrapRef, style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "No comp data to plot.");
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
  // Round-number gridlines (niceAxisTicks), like every other chart here. With
  // `diagonal` (true, or the line's label), both axes share one scale and the
  // x = y line is drawn, so "above / below the diagonal" means what it says.
  let xAxis = padAxis(xVals), yAxis = padAxis(yVals);
  if (diagonal) { const lo = Math.min(xAxis.lo, yAxis.lo), hi = Math.max(xAxis.hi, yAxis.hi); xAxis = yAxis = { lo, hi }; }
  const xT = niceAxisTicks(xAxis.lo, xAxis.hi, 4), yT = diagonal ? xT : niceAxisTicks(yAxis.lo, yAxis.hi, 4);
  const maxX = xT.hi, minX = xT.lo;
  const maxY = yT.hi, minY = yT.lo;
  const toX = v => padL + ((v - minX) / (maxX - minX || 1)) * plotW;
  const toY = v => padT + plotH - ((v - minY) / (maxY - minY || 1)) * plotH;

  const fmtX = xFmt || (v => v.toFixed(0));
  const fmtY = yFmt || (v => v.toFixed(0));

  const hoveredPoint = hover ? (hover.kind === "highlight" ? highlightPoint : points[hover.idx]) : null;
  const tooltipOnRight = hoveredPoint && toX(hoveredPoint.x) > padL + plotW * 0.6;

  return h("div", { ref: wrapRef, style: { position: "relative" } },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || ((yLabel || "") + " against " + (xLabel || "")), style: { width: "100%", maxWidth: diagonal ? 560 : "none", height: "auto", display: "block" } },
      yT.ticks.map((v, i) => h("g", { key: "y" + i },
        h("line", { x1: padL, x2: W - padR, y1: toY(v), y2: toY(v), stroke: "var(--rule)", strokeWidth: 1, strokeDasharray: "3,3" }),
        h("text", { x: padL - 8, y: toY(v) + 3, textAnchor: "end", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtY(v))
      )),
      diagonal && h("line", { x1: toX(minX), y1: toY(minX), x2: toX(maxX), y2: toY(maxX), stroke: "var(--ink-3)", strokeWidth: 1.2, strokeDasharray: "6,4" }),
      diagonal && (() => {
        const text = typeof diagonal === "string" ? diagonal : "x = y";
        const at = placeDiagonalLabel(text, allPoints, { toX, toY, minX, maxX, padL, padT, plotW, plotH });
        return h("text", { x: at.x, y: at.y, textAnchor: "start", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-2)" }, text);
      })(),
      xT.ticks.map((v, i) => h("text", { key: "x" + i, x: toX(v), y: H - padB + 16, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtX(v))),
      h("text", { x: padL + plotW / 2, y: H - 4, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-2)" }, xLabel || ""),
      h("text", { x: 14, y: padT + plotH / 2, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-2)", transform: `rotate(-90, 14, ${padT + plotH / 2})` }, yLabel || ""),
      points.map((p, i) => h("circle", {
        key: i, cx: toX(p.x), cy: toY(p.y), r: hover && hover.kind === "point" && hover.idx === i ? 7 : 5,
        fill: "var(--teal)", fillOpacity: hover && hover.kind === "point" && hover.idx === i ? 0.85 : 0.55, stroke: "var(--teal)", strokeWidth: 1,
        style: { cursor: "help" }, onMouseEnter: () => setHover({ kind: "point", idx: i }), onMouseLeave: () => setHover(null)
      })),
      highlightPoint && h("g", null,
        h("circle", {
          cx: toX(highlightPoint.x), cy: toY(highlightPoint.y), r: hover && hover.kind === "highlight" ? 10 : 8,
          fill: "var(--amber)", stroke: "var(--ink-1)", strokeWidth: 2, style: { cursor: "help" },
          onMouseEnter: () => setHover({ kind: "highlight" }), onMouseLeave: () => setHover(null)
        }),
        (() => {
          const text = highlightPoint.label || "Your case";
          const at = placePointLabel(text, highlightPoint, points, { toX, toY, padL, padT, plotW, plotH });
          return h("text", { x: at.x, y: at.y, fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--amber)" }, text);
        })()
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
function RiskWaterfallChart({ unriskedNPV, riskedNPV, posToLaunchPct, height, label }) {
  const h = React.createElement;
  height = height || 190;
  const wrapRef = React.useRef(null);
  // Drawn at its real width (capped — two bars don't need 1,200px), not a
  // fixed 420 canvas pinned to the left of a wide panel.
  const measured = useMeasuredWidth(wrapRef, 520);
  const W = Math.max(340, Math.min(640, measured)), H = height, padL = 16, padR = 16, padT = 22, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  if (unriskedNPV == null || riskedNPV == null) {
    return h("div", { ref: wrapRef, style: { height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, "Not computable yet.");
  }

  const fmtM = v => {
    const av = Math.abs(v);
    const s = av >= 1e9 ? "$" + (av / 1e9).toFixed(2) + "B" : "$" + Math.round(av / 1e6) + "M";
    return (v < 0 ? "-" : "") + s;
  };

  // The axis spans exactly [min(0, values), max(0, values)]. Zero used to be
  // pinned at mid-height, which left the lower half empty whenever both values
  // were positive — the usual case — and stranded the labels far below the bars.
  const hi = Math.max(0, unriskedNPV, riskedNPV), lo = Math.min(0, unriskedNPV, riskedNPV);
  const span = (hi - lo) || 1;
  const valueRoom = 16; // space above/below a bar for its value label
  const y = v => padT + valueRoom + (hi - v) / span * (plotH - valueRoom * (lo < 0 ? 2 : 1));
  const zeroY = y(0);
  const barY = v => Math.min(y(v), zeroY);
  const barH = v => Math.abs(y(v) - zeroY);

  const barW = Math.min(96, plotW * 0.2);
  const bars = [
    { label: "Unrisked", sub: "if success were certain", v: unriskedNPV, x: padL + plotW * 0.25, color: "var(--ink-3)" },
    { label: "Risk-adjusted", sub: posToLaunchPct != null ? posToLaunchPct.toFixed(1) + "% PoS" : "rNPV", v: riskedNPV, x: padL + plotW * 0.75, color: "var(--teal)" }
  ];
  const delta = riskedNPV - unriskedNPV;
  const valueY = b => b.v >= 0 ? barY(b.v) - 6 : barY(b.v) + barH(b.v) + 13;

  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Risk waterfall: unrisked vs. risk-adjusted value", style: { width: W, maxWidth: "100%", height: "auto", display: "block" } },
      h("line", { x1: padL, x2: W - padR, y1: zeroY, y2: zeroY, stroke: "var(--rule)", strokeWidth: 1 }),
      // Connector from the top of one bar to the other, so the gap reads as
      // the thing being measured rather than as empty space.
      h("line", { x1: bars[0].x + barW / 2, x2: bars[1].x - barW / 2, y1: y(unriskedNPV), y2: y(unriskedNPV), stroke: "var(--ink-3)", strokeWidth: 1, strokeDasharray: "3,3" }),
      h("line", { x1: bars[1].x - barW / 2 - 6, x2: bars[1].x - barW / 2 - 6, y1: y(unriskedNPV), y2: y(riskedNPV), stroke: delta >= 0 ? "var(--green)" : "var(--red)", strokeWidth: 1.5 }),
      bars.map((b, i) => h("g", { key: i },
        h("rect", { x: b.x - barW / 2, y: barY(b.v), width: barW, height: Math.max(1, barH(b.v)), fill: b.color, fillOpacity: 0.75, rx: 3 }),
        h("text", { x: b.x, y: valueY(b), textAnchor: "middle", fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--ink-1)" }, fmtM(b.v)),
        h("text", { x: b.x, y: H - 18, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fontWeight: 700, fill: "var(--ink-2)" }, b.label),
        h("text", { x: b.x, y: H - 5, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, b.sub)
      )),
      // Delta annotation between the two bars — the number alone doesn't say
      // what it is, so it needs its own caption same as the two bars do.
      h("text", { x: padL + plotW * 0.5, y: (y(unriskedNPV) + y(riskedNPV)) / 2 - 2, textAnchor: "middle", fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, fill: delta >= 0 ? "var(--green)" : "var(--red)" },
        (delta >= 0 ? "+" : "") + fmtM(delta)),
      h("text", { x: padL + plotW * 0.5, y: (y(unriskedNPV) + y(riskedNPV)) / 2 + 11, textAnchor: "middle", fontSize: 10, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, "risk-adjustment")
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
        h("div", { title: d.drug, style: { width: 170, fontFamily: "var(--mono)", fontSize: 10, color: d._own ? "var(--amber)" : "var(--ink-3)", fontWeight: d._own ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 } }, d.drug),
        h("div", { style: { flex: 1, height: 13, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" } },
          h("div", { style: { height: "100%", width: (d.peakSalesB / maxB) * 100 + "%", background: d._own ? "var(--amber)" : "var(--teal)", borderRadius: 3, opacity: d._own ? 1 : 0.75 } })),
        h("div", { style: { width: 52, textAlign: "right", fontFamily: "var(--mono)", fontSize: 10, color: d._own ? "var(--amber)" : "var(--ink-2)", fontWeight: d._own ? 700 : 400, flexShrink: 0 } },
          "$" + (d.peakSalesB >= 10 ? d.peakSalesB.toFixed(0) : d.peakSalesB.toFixed(1)) + "B")
      ))
    )
  );
}
