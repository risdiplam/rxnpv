// ════════════════════════════════════════════════════════════════════════════
// The case at a glance — evidence → odds → value, as one picture
// ════════════════════════════════════════════════════════════════════════════
// Top of the Overview and the report's "At a glance" section. Three panels,
// every line drawn from the case itself:
//   * the evidence: a handful of this case's own Evidence Log entries (facts
//     first, then the least certain judgment call), green = fact, orchid =
//     judgment;
//   * the odds: the Bear–Base–Bull probability of reaching launch as a smooth
//     triangle, with the odds today's price implies marked beneath;
//   * the value: a fan from the Base fair value — each line one input's own
//     low/high from the sensitivity tornado, the shading the Bear to Bull
//     range — with today's price across it and the top drivers listed.
// Single-program cases only: the odds panel needs one probability to draw.
// Wide (≥ 980px) it is one row with connectors between the panels; narrower,
// the panels stack and the connectors are dropped, so text never shrinks.

// Up to five entries: high-confidence facts first (in log order), then the
// least certain judgment call — the biggest open question.
const GLANCE_CLASS_RANK = { fact: 0, inference: 1, speculation: 2 };
const GLANCE_CONF_RANK = { high: 0, moderate: 1, low: 2 };
function pickGlanceEvidence(log, n) {
  n = n || 5;
  const items = (log || []).map((e, i) => ({ e, i })).filter(x => x.e && x.e.label);
  const facts = items.filter(x => x.e.classification === "fact")
    .sort((a, b) => (GLANCE_CONF_RANK[a.e.confidence] ?? 1) - (GLANCE_CONF_RANK[b.e.confidence] ?? 1) || a.i - b.i);
  const judgments = items.filter(x => x.e.classification !== "fact")
    .sort((a, b) => (GLANCE_CONF_RANK[b.e.confidence] ?? 1) - (GLANCE_CONF_RANK[a.e.confidence] ?? 1) || (GLANCE_CLASS_RANK[b.e.classification] ?? 1) - (GLANCE_CLASS_RANK[a.e.classification] ?? 1) || a.i - b.i);
  const pick = facts.slice(0, judgments.length ? n - 1 : n).concat(judgments.slice(0, 1));
  const fill = facts.slice(pick.filter(x => x.e.classification === "fact").length).concat(judgments.slice(1));
  while (pick.length < n && fill.length) pick.push(fill.shift());
  return pick.map(x => x.e);
}

// One sentence joining the three panels. Reports the ranges; never says
// whether the price is right.
function readGlance(evidenceCount, posLo, posHi, bear, bull, price, topDriver) {
  if (bear == null || bull == null || posLo == null || posHi == null) return null;
  const lo = Math.min(bear, bull), hi = Math.max(bear, bull);
  const where = !(price > 0) ? "" : price < lo ? ", and today's " + fmtShare(price) + " is below even your Bear case"
    : price > hi ? ", and today's " + fmtShare(price) + " is above even your Bull case"
    : ", and today's " + fmtShare(price) + " sits in the " + (price < (lo + hi) / 2 ? "lower" : "upper") + " half of that range";
  return { verdict: "Your evidence sets the odds; the commercial inputs set the spread.",
    text: (evidenceCount ? evidenceCount + " logged piece" + (evidenceCount === 1 ? "" : "s") + " of evidence sit behind odds of " : "Odds of ") + Math.round(posLo) + "–" + Math.round(posHi) +
      "% of reaching launch. Across your scenarios that becomes " + fmtShare(lo) + " to " + fmtShare(hi) + " a share" + where + "." + (topDriver ? " " + topDriver + " moves the value most." : "") };
}

// Shortens text with an ellipsis until it fits maxW at the given size.
function fitLabel(text, px, weight, maxW) {
  let t = String(text || "");
  if (measureLabel(t, px, weight) <= maxW) return t;
  while (t.length > 1 && measureLabel(t + "…", px, weight) > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, "") + "…";
}

const GLANCE_DRIVER_NAME = n => /success|PoS/i.test(n) ? "PoS" : /share/i.test(n) ? "Peak share" : /Launch/i.test(n) ? "Launch timing" : /Discount/i.test(n) ? "Discount rate" : n;

function CaseGlanceChart({ evidence, moreCount, pos, value, label }) {
  const h = React.createElement;
  const wrapRef = React.useRef(null);
  const W = Math.max(340, useMeasuredWidth(wrapRef, 1100));
  // wide: one row with connectors; medium (the report's page): evidence in two
  // columns, odds and value side by side below; narrow: everything stacked.
  const wide = W >= 980, medium = !wide && W >= 600;
  const els = [];
  const caption = (x, y, t) => els.push(h("text", { key: "cap" + x + "-" + y, x, y, fontSize: 10.5, fontWeight: 600, letterSpacing: 1, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, t));
  const rule = (x1, x2, y) => els.push(h("line", { key: "rule" + x1 + "-" + y, x1, x2, y1: y, y2: y, stroke: "var(--rule)" }));

  const cols = medium ? 2 : 1;
  const EV_H = 64 * Math.max(1, Math.ceil(evidence.length / cols)) + (moreCount ? 22 : 0);
  let ev, od, va, H;
  if (wide) {
    ev = { x: 0, y: 44, w: Math.min(310, W * 0.27) };
    od = { x: ev.w + W * 0.05, y: 44, w: W * 0.2, h: 330 };
    va = { x: od.x + od.w + W * 0.05, y: 44, w: W - (od.x + od.w + W * 0.05), h: 330 };
    H = Math.max(44 + EV_H, 44 + 330) + 46;
  } else if (medium) {
    ev = { x: 0, y: 44, w: W };
    od = { x: 8, y: 44 + EV_H + 56, w: W * 0.4, h: 290 };
    va = { x: W * 0.52, y: od.y, w: W * 0.48, h: 290 };
    H = od.y + od.h + 10;
  } else {
    ev = { x: 0, y: 44, w: W };
    od = { x: 8, y: 44 + EV_H + 56, w: W - 16, h: 250 };
    va = { x: 0, y: od.y + od.h + 56, w: W, h: 300 };
    H = va.y + va.h + 10;
  }

  // ── Evidence ──
  caption(ev.x, 18, "WHAT THE EVIDENCE SAYS"); rule(ev.x, ev.x + ev.w, 28);
  const cardW = wide ? ev.w : medium ? (W - 16) / 2 : Math.min(W, 520);
  const anchors = [];
  evidence.forEach((e, i) => {
    const cx0 = ev.x + (i % cols) * (cardW + 16), y = ev.y + Math.floor(i / cols) * 64, fact = e.classification === "fact", col = fact ? "var(--green)" : "var(--amber)";
    const kind = fact ? "Fact" : e.classification === "speculation" ? "Speculation" : "Judgment";
    // A source that itself opens "Judgment; …" would read "Judgment · low · Judgment; …".
    const src = String(e.source || "").replace(new RegExp("^" + kind + "[;:,]?\\s*", "i"), "");
    const sub = kind + (e.confidence ? " · " + e.confidence : "") + (src ? " · " + src : "");
    els.push(h("g", { key: "ev" + i },
      h("rect", { x: cx0, y, width: cardW, height: 50, rx: 9, fill: "var(--surface-2)" }),
      h("text", { x: cx0 + 14, y: y + 20, fontSize: 12.5, fontWeight: 600, fontFamily: "var(--sans)", fill: "var(--ink-1)" }, fitLabel(e.label, 12.5, 600, cardW - 34)),
      h("text", { x: cx0 + 14, y: y + 38, fontSize: 11, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, fitLabel(sub, 11, 400, cardW - 34)),
      // Wide: a dot where the connector leaves the card. Otherwise there are
      // no connectors, and a dot on the card's edge would be cut off at the
      // page edge, so the card's left edge carries the colour instead.
      wide ? h("circle", { cx: cx0 + cardW, cy: y + 25, r: 3.5, fill: col })
        : h("rect", { x: cx0, y: y + 8, width: 3, height: 34, rx: 1.5, fill: col })));
    anchors.push({ y: y + 25, col, dashed: !fact });
  });
  if (moreCount) els.push(h("text", { key: "more", x: ev.x + 2, y: ev.y + Math.ceil(evidence.length / cols) * 64 + 10, fontSize: 11, fontFamily: "var(--sans)", fill: "var(--ink-3)" }, "+" + moreCount + " more in the Evidence Log"));

  // ── Odds ──
  caption(od.x - 8, wide ? 18 : od.y - 26, "ODDS OF REACHING LAUNCH");
  rule(od.x - 8, od.x + od.w + 10, wide ? 28 : od.y - 16);
  const lo = Math.max(0, Math.min(pos.bear, pos.implied != null ? pos.implied : pos.bear) - 12);
  const hi = Math.min(100, Math.max(pos.bull, pos.implied != null ? pos.implied : pos.bull) + 12);
  const oTicks = niceAxisTicks(lo, hi, 4).ticks.filter(t => t >= lo && t <= hi);
  const my = od.y + od.h - 60, mh = Math.min(150, od.h - 150);
  const px = p => od.x + (p - lo) / ((hi - lo) || 1) * od.w;
  const tri = p => p <= pos.bear || p >= pos.bull ? 0 : p <= pos.base ? (p - pos.bear) / ((pos.base - pos.bear) || 1) : (pos.bull - p) / ((pos.bull - pos.base) || 1);
  let curve = "";
  for (let p = pos.bear - 3; p <= pos.bull + 3; p += 0.25) { const t = tri(p); const s = t * t * (3 - 2 * t); curve += (curve ? "L" : "M") + px(Math.max(lo, Math.min(hi, p))).toFixed(1) + "," + (my - s * mh).toFixed(1); }
  els.push(h("g", { key: "odds" },
    h("path", { d: curve + " L" + px(Math.min(hi, pos.bull + 3)) + "," + my + " L" + px(Math.max(lo, pos.bear - 3)) + "," + my + " Z", fill: "var(--teal)", opacity: 0.1 }),
    h("path", { d: curve, fill: "none", stroke: "var(--teal)", strokeWidth: 2 }),
    h("line", { x1: px(pos.base), x2: px(pos.base), y1: my - mh, y2: my, stroke: "var(--teal)", strokeDasharray: "3,3" }),
    h("circle", { cx: px(pos.base), cy: my - mh, r: 5, fill: "var(--teal)" }),
    h("text", { x: px(pos.base), y: my - mh - 40, textAnchor: "middle", fontSize: 30, fontWeight: 600, fontFamily: "var(--sans)", fill: "var(--ink-1)" }, Math.round(pos.base) + "%"),
    h("text", { x: px(pos.base), y: my - mh - 18, textAnchor: "middle", fontSize: 11.5, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, "your PoS · range " + Math.round(pos.bear) + "–" + Math.round(pos.bull) + "%"),
    h("line", { x1: od.x - 8, x2: od.x + od.w + 8, y1: my, y2: my, stroke: "var(--ink-3)" }),
    oTicks.map(t => h("g", { key: "ot" + t },
      h("line", { x1: px(t), x2: px(t), y1: my, y2: my + 4, stroke: "var(--ink-3)" }),
      h("text", { x: px(t), y: my + 18, textAnchor: "middle", fontSize: 10.5, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, t + "%"))),
    pos.implied != null && h("path", { d: "M" + px(pos.implied) + "," + (my + 24) + " l-5,8 h10 z", fill: "var(--amber)" }),
    pos.implied != null && h("text", { x: px(pos.implied), y: my + 46, textAnchor: "middle", fontSize: 11, fontWeight: 600, fontFamily: "var(--sans)", fill: "var(--amber)" }, "price implies " + Math.round(pos.implied) + "%")));
  if (wide) anchors.forEach((a, i) => els.push(h("path", { key: "flow" + i, d: "M" + (ev.x + cardW) + "," + a.y + " C" + (ev.x + cardW + 55) + "," + a.y + " " + (od.x - 45) + "," + my + " " + px(Math.max(lo, pos.bear - 3)) + "," + my,
    fill: "none", stroke: a.col, strokeOpacity: 0.45, strokeWidth: 1.4, strokeDasharray: a.dashed ? "4,3" : "none" })));

  // ── Value ──
  caption(va.x - (wide ? 20 : 0), wide ? 18 : va.y - 26, "WHAT IT'S WORTH, $ / SHARE");
  rule(va.x - (wide ? 20 : 0), W, wide ? 28 : va.y - 16);
  // Outside the wide row nothing sits left of the fan, so start it far enough
  // in that the Base label centred on its first point is not cut off; then
  // leave ~110px right of the axis for its labels and today's price tag.
  const fx0 = va.x + (wide ? 0 : measureLabel("Base " + fmtShare(value.base), 12, 600) / 2 + 4);
  const fanW = wide ? Math.min(220, va.w * 0.46) : medium ? va.x + va.w - 110 - fx0 : Math.min(260, W * 0.46);
  const fx1 = fx0 + fanW;
  const drivers = (value.drivers || []).slice(0, 4);
  const vals = [value.base, value.bear, value.bull].concat(value.price > 0 ? [value.price] : [], drivers.flatMap(d => [d.lo, d.hi]));
  const vt = niceAxisTicks(Math.min(...vals), Math.max(...vals), 4);
  const vTop = va.y + 30, vBot = va.y + va.h - 50;
  const vy = v => vBot - (v - vt.lo) / ((vt.hi - vt.lo) || 1) * (vBot - vTop);
  const sy = vy(value.base);
  const band = (a, b) => "M" + fx0 + "," + sy + " C" + (fx0 + 100) + "," + sy + " " + (fx1 - 100) + "," + vy(b) + " " + fx1 + "," + vy(b) + " L" + fx1 + "," + vy(a) + " C" + (fx1 - 100) + "," + vy(a) + " " + (fx0 + 100) + "," + sy + " " + fx0 + "," + sy + " Z";
  const bLo = Math.min(value.bear, value.bull), bHi = Math.max(value.bear, value.bull);
  const priceY = value.price > 0 ? vy(value.price) : null;
  els.push(h("g", { key: "fan" },
    h("path", { d: band(bLo, bHi), fill: "var(--amber)", opacity: 0.12 }),
    drivers.map((d, i) => [d.lo, d.hi].map((v, k) => h("path", { key: "d" + i + k, d: "M" + fx0 + "," + sy + " C" + (fx0 + 90) + "," + sy + " " + (fx1 - 100) + "," + vy(v) + " " + fx1 + "," + vy(v),
      fill: "none", stroke: "var(--amber)", strokeOpacity: 0.62 - i * 0.1, strokeWidth: 1.2, strokeDasharray: k ? "none" : "4,3" }))),
    priceY != null && h("line", { x1: fx0 + 8, x2: fx1, y1: priceY, y2: priceY, stroke: "var(--warn)", strokeDasharray: "5,4", strokeWidth: 1.3 }),
    h("line", { x1: fx1, x2: fx1, y1: vy(vt.hi), y2: vy(vt.lo), stroke: "var(--rule)" }),
    vt.ticks.map(t => h("g", { key: "vt" + t },
      h("line", { x1: fx1, x2: fx1 + 4, y1: vy(t), y2: vy(t), stroke: "var(--ink-3)" }),
      (priceY == null || Math.abs(vy(t) - priceY) > 15) && h("text", { x: fx1 + 9, y: vy(t) + 4, fontSize: 10.5, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, (t < 0 ? "-$" : "$") + Math.abs(t)))),
    h("line", { x1: fx1, x2: fx1, y1: vy(bLo), y2: vy(bHi), stroke: "var(--amber)", strokeWidth: 2.5 }),
    priceY != null && h("text", { x: fx1 + 9, y: priceY + 4, fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--warn)" }, "today " + fmtShare(value.price)),
    h("circle", { cx: fx0, cy: sy, r: 5, fill: "var(--amber)" }),
    h("text", { x: fx0, y: sy - 13, textAnchor: "middle", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", fill: "var(--ink-1)" }, "Base " + fmtShare(value.base)),
    h("text", { x: fx1 - 4, y: Math.max(vy(vt.lo), ...drivers.map(d => vy(d.lo))) + 26, textAnchor: "end", fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", fill: "var(--amber)" }, "Bear " + fmtShare(bLo) + " – Bull " + fmtShare(bHi))));
  if (wide) els.push(h("path", { key: "link", d: "M" + (od.x + od.w + 8) + "," + my + " C" + (od.x + od.w + 38) + "," + my + " " + (fx0 - 34) + "," + sy + " " + fx0 + "," + sy, fill: "none", stroke: "var(--ink-3)", strokeWidth: 1.4 }));
  // The drivers, listed to the right of the axis labels.
  const listX = fx1 + 104, listW = W - listX;
  if (drivers.length && listW > 120) {
    els.push(h("text", { key: "dlh", x: listX, y: vTop - 4, fontSize: 10.5, fontWeight: 600, letterSpacing: 1, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, "MOVES IT MOST"));
    drivers.forEach((d, i) => els.push(h("g", { key: "dl" + i },
      h("text", { x: listX, y: vTop + 22 + i * 40, fontSize: 12, fontWeight: 500, fontFamily: "var(--sans)", fill: "var(--ink-1)" }, fitLabel((i + 1) + ". " + GLANCE_DRIVER_NAME(d.name), 12, 500, listW)),
      h("text", { x: listX, y: vTop + 38 + i * 40, fontSize: 11, fontFamily: "var(--mono)", fill: "var(--ink-3)" }, fmtShare(d.lo) + " – " + fmtShare(d.hi)))));
    els.push(h("text", { key: "dln1", x: listX, y: vTop + 38 + drivers.length * 40, fontSize: 10.5, fontFamily: "var(--sans)", fill: "var(--ink-3)" }, "Lines: each input alone."),
      h("text", { key: "dln2", x: listX, y: vTop + 54 + drivers.length * 40, fontSize: 10.5, fontFamily: "var(--sans)", fill: "var(--ink-3)" }, "Shading: Bear to Bull."));
  }
  if (wide) {
    els.push(h("line", { key: "bl1", x1: 0, x2: od.x + od.w + 10, y1: H - 30, y2: H - 30, stroke: "var(--ink-2)" }),
      h("text", { key: "bt1", x: 0, y: H - 11, fontSize: 11, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, "NARROWER · your evidence sets the odds"),
      h("line", { key: "bl2", x1: va.x - 20, x2: W, y1: H - 30, y2: H - 30, stroke: "var(--ink-2)" }),
      h("text", { key: "bt2", x: va.x - 20, y: H - 11, fontSize: 11, fontFamily: "var(--sans)", fill: "var(--ink-2)" }, "WIDER · the commercial inputs set the spread"));
  }
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "The case at a glance: evidence, odds of launch and value per share", "data-titled": "1", style: { width: "100%", height: H, display: "block" } }, els));
}

// Everything the chart needs, from a case and its three scenario results.
// drivers: the sensitivity rows (name, lo, hi), computed by the caller.
function glanceInputs(theCase, scenarioResults, impliedSolved, drivers) {
  if (!theCase || !theCase.programs || theCase.programs.length !== 1 || !scenarioResults) return null;
  const by = k => (scenarioResults.find(s => s.key === k) || {}).result;
  const posOf = k => { const r = by(k); return r && r.programVals && r.programVals[0] ? r.programVals[0].posToLaunch * 100 : null; };
  const pos = { bear: posOf("bear"), base: posOf("base"), bull: posOf("bull"), implied: impliedSolved && impliedSolved.ok && !impliedSolved.degenerate ? impliedSolved.impliedAbsolutePct : null };
  if ([pos.bear, pos.base, pos.bull].some(v => v == null || !isFinite(v))) return null;
  // An approved drug (odds already 100%) has no odds to picture.
  if (pos.base >= 99.99) return null;
  const log = theCase.programs[0].evidenceLog || [];
  const evidence = pickGlanceEvidence(log, 5);
  const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  const value = { base: by("base").equity.perShare, bear: by("bear").equity.perShare, bull: by("bull").equity.perShare, price, drivers: drivers || [] };
  if ([value.base, value.bear, value.bull].some(v => v == null || !isFinite(v))) return null;
  return { evidence, moreCount: Math.max(0, log.length - evidence.length), evidenceCount: log.length, pos, value };
}

const GLANCE_HIDDEN_KEY = "rxnpv_glance_hidden";
function CaseGlance({ theCase, scenarioResults, impliedSolved }) {
  const h = React.createElement;
  const [hidden, setHidden] = React.useState(() => { try { return localStorage.getItem(GLANCE_HIDDEN_KEY) === "1"; } catch (e) { return false; } });
  const setHiddenSaved = v => { setHidden(v); try { localStorage.setItem(GLANCE_HIDDEN_KEY, v ? "1" : "0"); } catch (e) {} };
  const [drivers, setDrivers] = React.useState(null);
  // The drivers cost ~20 valuations, so they run a moment after typing stops
  // (as Live impact's do), and the chart draws without them until then.
  const sig = JSON.stringify({ ...theCase, updatedAt: 0, programs: (theCase.programs || []).map(p => ({ ...p, evidenceLog: null, calibrationLog: null })) });
  React.useEffect(() => {
    if (hidden) return;
    const t = setTimeout(() => {
      try { const r = computeSensitivityDrivers(theCase, { skipGrid: true }); setDrivers(r.error ? [] : r.rows.slice(0, 4)); } catch (e) { setDrivers([]); }
    }, drivers ? 450 : 0);
    return () => clearTimeout(t);
  }, [sig, hidden]);
  if (hidden) return h("div", { style: { marginBottom: 10 } }, h("button", { type: "button", className: "link-btn", onClick: () => setHiddenSaved(false) }, "Show the case at a glance"));
  const g = glanceInputs(theCase, scenarioResults, impliedSolved, drivers);
  if (!g) return null;
  const reading = readGlance(g.evidenceCount, Math.min(g.pos.bear, g.pos.bull), Math.max(g.pos.bear, g.pos.bull), g.value.bear, g.value.bull, g.value.price, drivers && drivers[0] ? GLANCE_DRIVER_NAME(drivers[0].name) : null);
  return h(ExportSection, { title: "The case at a glance", reportSection: "glance", style: { marginBottom: 18 } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 } },
      h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)" } }, "The case at a glance"),
      h("button", { type: "button", className: "link-btn", "data-no-export": "", onClick: () => setHiddenSaved(true) }, "Hide")),
    h("div", { className: "prose", style: { ...UI.caption, marginBottom: 10 } }, "Every line is this case's own data: the evidence is its Evidence Log, the odds curve is your Bear–Base–Bull probability of launch, each line on the right is one input's own range, and the shading is your Bear to Bull range."),
    h(ExportableBlock, { title: (theCase.name || "Case") + " — the case at a glance" },
      h(CaseGlanceChart, { evidence: g.evidence, moreCount: g.moreCount, pos: g.pos, value: g.value })),
    h(Explain, reading));
}
