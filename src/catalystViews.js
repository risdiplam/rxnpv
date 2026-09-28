// ════════════════════════════════════════════════════════════════════════════
// Catalyst views — how the remaining catalysts play out (the outcome tree)
// ════════════════════════════════════════════════════════════════════════════
// Drawn from computeOutcomeTree (scenarioEngine.js). Single-program cases.

const OUTCOME_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthsFromNow(years) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(years * 12));
  return OUTCOME_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

// Where the failures sit, and how the tree's weighted value compares with the
// model's Base. Never calls either number right.
function readOutcomeTree(gates, weighted, base) {
  if (!gates || !gates.length || weighted == null) return null;
  const fails = gates.map(g => g.failProb), total = fails.reduce((a, b) => a + b, 0);
  const top = gates.reduce((b, g) => g.failProb > b.failProb ? g : b, gates[0]);
  const share = total > 0 ? top.failProb / total : 0;
  const verdict = gates.length === 1 ? "One gate left: the " + top.label + "."
    : share >= 0.6 ? "The " + top.label + " is most of the risk." : "The risk is spread across " + gates.length + " gates.";
  const where = total > 0 && gates.length > 1 ? Math.round(share * 100) + "% of the failures in this case happen at the " + top.label + ". " : "";
  const gap = base != null ? " Weighted across the endings it comes to " + fmtShare(weighted) + ", against the model's Base of " + fmtShare(base) +
    (Math.abs(weighted - base) < 0.005 ? "." : "; the gap is because the tree values each ending as it stands, while the model charges costs year by year at the odds of reaching them.") : "";
  return { verdict, text: (where + gap).trim() };
}

function OutcomeTreeChart({ tree, price, label }) {
  const h = React.createElement;
  const wrapRef = React.useRef(null);
  const W = Math.max(320, useMeasuredWidth(wrapRef, 1100));
  const N = tree.gates.length;
  // Three gates fit from ~1,090px: consecutive gates then sit far enough apart
  // vertically (S below) that a pill between them clears both boxes even
  // where the boxes are close side by side.
  const leafW = N >= 3 ? 250 : 272, gateW = N >= 3 ? 150 : 172, todayW = N >= 3 ? 110 : 124, pillGap = N >= 3 ? 150 : 165;
  const leafX = W - leafW;
  const firstGateX = todayW + (N >= 3 ? 36 : 44), lastGateX = leafX - pillGap - gateW;
  const step = N > 1 ? (lastGateX - firstGateX) / (N - 1) : 0;
  const fits = N === 1 ? lastGateX >= firstGateX : step >= gateW + 28;
  const pct = p => Math.round(p * 100) + "%";
  if (!fits) {
    // Too narrow for the tree to stay clean: the same facts as a list.
    return h("div", { ref: wrapRef, className: "tree-list" },
      tree.gates.map((g, i) => h("div", { key: i, className: "tree-list-gate" },
        h("b", null, g.label), " · ~" + monthsFromNow(g.endYears) + ": " + g.passWord + " " + pct(g.pass) + ", " + g.failWord + " " + pct(1 - g.pass) + " → ≈" + fmtShare(g.failValue) + " a share")),
      h("div", { className: "tree-list-gate" }, h("b", null, "Launch"), " · " + pct(tree.posToLaunch) + " of outcomes → " + fmtShare(tree.success) + " a share"),
      tree.late && h("div", { className: "tree-list-gate" }, h("b", null, "Approved a year late"), " · " + pct(tree.late.prob) + " of outcomes → " + fmtShare(tree.late.value) + " a share"));
  }
  const els = [];
  const node = (key, x, y, w, lines, kind) => {
    const hh = 20 + lines.length * 17;
    const stroke = kind === "good" ? "var(--green)" : kind === "bad" ? "var(--red)" : kind === "root" ? "var(--warn)" : "var(--rule)";
    const fill = kind === "good" ? "var(--green-bg)" : kind === "bad" ? "var(--red-bg)" : kind === "root" ? "var(--warn-bg)" : "var(--surface-2)";
    els.push(h("g", { key },
      h("rect", { x, y: y - hh / 2, width: w, height: hh, rx: 10, fill, stroke, strokeWidth: 1.2 }),
      lines.map((l, i) => h("text", { key: i, x: x + 14, y: y - hh / 2 + 24 + i * 17, fontSize: i === 0 ? 12.5 : 12, fontWeight: i === 0 || l.bold ? 600 : 400,
        fontFamily: l.mono ? "var(--mono)" : "var(--sans)", fill: l.color || (i === 0 ? "var(--ink-1)" : "var(--ink-2)") }, l.t || l))));
    return { x, y, w };
  };
  const edges = [];
  // at: where along the edge the label sits (0.5 = midway). A label on a
  // straight edge that shares its start with two curving ones goes further
  // along, where the curves have already moved away from it.
  const edge = (key, a, b, text, color, at) => {
    const x1 = a.x + a.w, y1 = a.y, x2 = b.x, y2 = b.y, mx = (x1 + x2) / 2;
    const pw = text ? measureLabel(text, 12, 600) + 16 : 0;
    // Never closer than 10px to either box, wherever `at` would put it.
    const lx = Math.min(x2 - pw / 2 - 10, Math.max(x1 + pw / 2 + 10, x1 + (x2 - x1) * (at || 0.5))), ly = y1 + (y2 - y1) * ((lx - x1) / ((x2 - x1) || 1));
    edges.push(h("g", { key },
      h("path", { d: "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2, fill: "none", stroke: color, strokeWidth: 1.6 }),
      text && h("rect", { x: lx - pw / 2, y: ly - 11, width: pw, height: 22, rx: 11, fill: "var(--surface)", stroke: color }),
      text && h("text", { x: lx, y: ly + 4, textAnchor: "middle", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", fill: color }, text)));
  };
  // Leaves down the right: success at the top, then the failure at each gate,
  // last gate first. Each gate sits halfway between the branch it passes to
  // and its own failure, so the passing lines climb and the failing ones fall.
  // With the resubmission branch on, its leaf sits under "Launches" and the
  // failures move down one slot; the last gate then lines up with it.
  const E = tree.late ? 1 : 0;
  const S = 116, L0 = 44;
  const leafY = j => L0 + j * S;
  const gy = new Array(N);
  gy[N - 1] = (leafY(0) + leafY(1 + E)) / 2;
  for (let k = N - 2; k >= 0; k--) gy[k] = (gy[k + 1] + leafY(N - k + E)) / 2;
  const H = leafY(N + E) + 44;
  const succ = node("leaf-s", leafX, leafY(0), leafW, ["Launches", { t: fmtShare(tree.success) + " a share", mono: true, bold: true, color: "var(--green)" }, { t: pct(tree.posToLaunch) + " of outcomes" }], "good");
  const lateLeaf = tree.late && node("leaf-l", leafX, leafY(1), leafW, ["Approved a year late", { t: fmtShare(tree.late.value) + " a share", mono: true, bold: true, color: "var(--green)" }, { t: pct(tree.late.prob) + " of outcomes" }], "good");
  const failProbOf = k => tree.leaves.find(l => l.kind === "fail" && l.gate === k).prob;
  const fails = tree.gates.map((g, k) => node("leaf-f" + k, leafX, leafY(N - k + E), leafW,
    [k === N - 1 && g.key === "regulatory" ? "Not approved after a positive readout" : g.label.replace(/ readout$/, "") + (k === 0 ? " fails" : " fails after earlier success"),
      { t: "≈" + fmtShare(g.failValue) + " a share", mono: true, bold: true, color: "var(--red)" }, { t: pct(failProbOf(k)) + " of outcomes" }], "bad"));
  const gates = tree.gates.map((g, k) => node("gate" + k, firstGateX + k * step, gy[k], gateW, [g.label, { t: "~" + monthsFromNow(g.endYears) + " in the model" }]));
  const today = node("today", 0, gy[0], todayW, ["Today", { t: price > 0 ? fmtShare(price) + " a share" : "—", mono: true }], "root");
  edge("e-t", today, gates[0], "", "var(--ink-3)");
  tree.gates.forEach((g, k) => {
    edge("e-p" + k, gates[k], k === N - 1 ? succ : gates[k + 1], g.passWord + " · " + pct(g.pass), "var(--green)");
    const fixShare = tree.late && k === N - 1 ? tree.late.fixPct / 100 : 0;
    edge("e-f" + k, gates[k], fails[k], g.failWord + " · " + pct((1 - g.pass) * (1 - fixShare)), "var(--red)");
    if (fixShare) edge("e-l", gates[k], lateLeaf, "resubmitted · " + pct((1 - g.pass) * fixShare), "var(--green)", 0.72);
  });
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Outcome tree", "data-titled": "1", style: { width: "100%", height: H, display: "block" } }, edges, els));
}

function OutcomeTreeSection({ theCase, discountRatePct, tv, baseValue, onChange }) {
  const h = React.createElement;
  let tree = null;
  try {
    const drBase = discountRatePct !== "" && discountRatePct != null ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    tree = computeOutcomeTree(theCase, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
  } catch (e) { tree = null; }
  if (!tree) return null;
  const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  const pct = p => Math.round(p * 100) + "%";
  const title = tree.gates.length > 1 ? "How the next " + tree.gates.length + " catalysts play out" : "How the next catalyst plays out";
  return h(ExportSection, { title: "How the catalysts play out", style: { marginBottom: 16 } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, title),
    h("div", { className: "prose", style: { ...UI.caption, marginBottom: 8 } },
      "Each branch uses this case's own odds (" + tree.gates.map(g => pct(g.pass) + " at the " + g.label).join(", ") + ", together the Base " + pct(tree.posToLaunch) +
      "). Each ending is valued by the model: launch at Base inputs, or the cash left after a failure and the wind-down set under Corporate G&A."),
    h(ExportableBlock, { title: (theCase.name || "Case") + " — outcome tree" },
      h(OutcomeTreeChart, { tree, price, label: "Outcome tree: each remaining catalyst, its odds, and what each ending is worth per share" })),
    h("div", { className: "mc-stats", style: { marginTop: 10 } },
      h("div", { className: "mc-stat" }, h("div", { style: UI.caption }, "Weighted across the endings"),
        h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtShare(tree.weighted)),
        h("div", { style: { ...UI.caption, marginTop: 2 } }, tree.leaves.map(l => l.prob.toFixed(2) + " × " + fmtShare(l.value)).join(" + "))),
      baseValue != null && h("div", { className: "mc-stat" }, h("div", { style: UI.caption }, "Model Base"),
        h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" } }, fmtShare(baseValue)))),
    h(Explain, readOutcomeTree(tree.gates, tree.weighted, baseValue)),
    onChange && tree.gates[tree.gates.length - 1].key === "regulatory" && h("div", { className: "prose", style: { ...UI.caption, marginTop: 10 } },
      h("label", { style: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "nowrap" } },
      h("span", null, "Optional: FDA rejections fixed and approved a year later"),
      h("input", { type: "number", min: 0, max: 100, step: 5, className: "rs-input", placeholder: "0", "aria-label": "Share of FDA rejections fixed on resubmission (%)",
        value: ((theCase.outcomeTree || {}).resubmitFixPct) == null ? "" : theCase.outcomeTree.resubmitFixPct,
        onChange: e => onChange({ ...theCase, outcomeTree: { ...(theCase.outcomeTree || {}), resubmitFixPct: e.target.value }, updatedAt: Date.now() }) }),
      h("span", null, "%")),
      h("div", { style: { marginTop: 4 } }, "Blank or 0 leaves the branch off. The case's own odds do not change; this only says what a rejection turns into.")));
}

// ── Before the next readout: the three results as a table ──────────────────
function readReadoutScenarios(rows, weighted, price, base) {
  if (!rows || rows.length !== 3) return null;
  const [clear, modest, miss] = rows;
  const move = v => (v >= price ? "+" : "−") + Math.abs(Math.round((v / price - 1) * 100)) + "%";
  if (!(price > 0)) return { verdict: "A win is worth " + fmtShare(modest.value) + " to " + fmtShare(clear.value) + "; a miss leaves ≈" + fmtShare(miss.value) + ".",
    text: "Weighted by these chances, " + fmtShare(weighted) + (base != null ? ", against the Base case's " + fmtShare(base) : "") + "." };
  const lo = Math.min(clear.value, modest.value), hi = Math.max(clear.value, modest.value);
  const winText = lo >= price ? "A win is worth " + move(lo) + " to " + move(hi) : hi >= price ? "A clear win is worth " + move(hi) + ", a modest one " + move(lo) : "Even a win is worth " + move(hi) + " at best";
  const oneIn = miss.prob > 0 ? Math.round(1 / miss.prob) : null;
  return { verdict: winText + "; a miss " + (miss.value < price ? "costs " + Math.abs(Math.round((miss.value / price - 1) * 100)) + "%" : "still clears today's price") + ".",
    text: "Weighted by these chances, the three come to " + fmtShare(weighted) + " — " + Math.abs(Math.round((weighted / price - 1) * 100)) + "% " + (weighted >= price ? "above" : "below") + " today's price" +
      (base != null ? ", against the Base case's " + fmtShare(base) : "") + "." + (oneIn && oneIn > 1 ? " The miss happens about one time in " + (["", "", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][oneIn] || oneIn) + " in this case, so the question the price is asking is whether that is too generous." : "") };
}

function ReadoutScenariosSection({ theCase, discountRatePct, tv, baseValue, onChange }) {
  const h = React.createElement;
  let r = null;
  try {
    const drBase = discountRatePct !== "" && discountRatePct != null ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    r = computeReadoutScenarios(theCase, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple });
  } catch (e) { r = null; }
  if (!r) return null;
  const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  const s = theCase.readoutScenarios || {};
  const setS = patch => onChange({ ...theCase, readoutScenarios: { ...s, ...patch }, updatedAt: Date.now() });
  // The catalyst's own name when the Calibration Log has one pending.
  const pending = ((theCase.programs[0] || {}).calibrationLog || []).find(e => !e.outcome || e.outcome === "pending");
  const name = pending && pending.catalystLabel ? pending.catalystLabel.split(/[,(]/)[0].trim() : r.gate.label;
  const pct1 = v => Math.round(v * 10) / 10;
  const input = (key, placeholder, label) => h("input", { type: "number", min: 0, max: key.endsWith("SharePct") ? undefined : 100, step: 1, className: "rs-input",
    value: s[key] == null ? "" : s[key], placeholder: String(Math.round(placeholder)), "aria-label": label, onChange: e => setS({ [key]: e.target.value }) });
  const names = { clear: "Clear win", modest: "Modest win", miss: "Miss" };
  const colors = { clear: "var(--green)", modest: "var(--teal)", miss: "var(--red)" };
  const axisHi = niceAxisTicks(0, Math.max(...r.rows.map(x => x.value), price || 0), 4).hi;
  const bar = row => h("svg", { viewBox: "0 0 220 22", width: 220, height: 22, "aria-hidden": "true", style: { display: "block" } },
    h("rect", { x: 4, y: 6, width: Math.max(2, row.value / axisHi * 212), height: 10, rx: 3, fill: colors[row.key], opacity: 0.75 }),
    price != null && h("line", { x1: 4 + price / axisHi * 212, x2: 4 + price / axisHi * 212, y1: 1, y2: 21, stroke: "var(--warn)", strokeWidth: 1.5 }));
  const move = v => price ? (v >= price ? "+" : "−") + Math.abs(Math.round((v / price - 1) * 100)) + "%" : "—";
  return h(ExportSection, { title: "Before the next readout", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 } }, name + ": what each result would do to the value"),
    h("div", { className: "prose", style: { ...UI.caption, marginBottom: 10 } },
      "Each result run through the model as if already known. The chance of a positive readout (" + Math.round(r.gate.pass * 100) + "%) is this case's own; how wins split between clear and modest, and what each does to the odds and the share, are yours to set — blank fields use the defaults shown."),
    h("div", { className: "proj-table-wrap" },
      h("table", { className: "proj-table rs-table" },
        h("thead", null, h("tr", null, ["Result", "Odds to launch after it", "Peak share vs Base", "Chance", "Value / share", "vs today", price != null ? "│ today " + fmtShare(price) : ""].map((c, i) => h("th", { key: i, scope: "col", className: i === 0 || i === 6 ? "l" : "", style: i === 6 ? { color: "var(--warn)" } : null }, c)))),
        h("tbody", null, r.rows.map(row => h("tr", { key: row.key },
          h("td", { className: "l", style: { color: colors[row.key], fontWeight: 600, fontFamily: "var(--sans)" } }, names[row.key]),
          h("td", null, row.key === "miss" ? "—" : h("span", { className: "rs-cell" }, input(row.key + "PosPct", r.defaults[row.key + "PosPct"], names[row.key] + " odds to launch (%)"), "%")),
          h("td", null, row.key === "miss" ? "—" : h("span", { className: "rs-cell" }, input(row.key + "SharePct", row.key === "clear" ? READOUT_DEFAULTS.clearSharePct : READOUT_DEFAULTS.modestSharePct, names[row.key] + " peak share vs Base (%)"), "%")),
          h("td", null, Math.round(row.prob * 100) + "%"),
          h("td", { className: "strong" }, (row.key === "miss" ? "≈" : "") + fmtShare(row.value)),
          h("td", { className: row.value < (price || 0) ? "neg" : "" , style: price && row.value >= price ? { color: "var(--green)" } : null }, move(row.value)),
          h("td", { className: "l" }, bar(row))))),
        h("tfoot", null, h("tr", null,
          h("td", { className: "l" }, "Weighted by chance"),
          h("td", { className: "l", colSpan: 2 }, h("span", { className: "rs-cell" }, "Clear wins are ", input("clearOfWinsPct", READOUT_DEFAULTS.clearOfWinsPct, "Clear wins as a share of all wins (%)"), "% of wins")),
          h("td", null, "100%"),
          h("td", null, fmtShare(r.weighted)),
          h("td", { style: price && r.weighted >= price ? { color: "var(--green)" } : null, className: price && r.weighted < price ? "neg" : "" }, move(r.weighted)),
          h("td", null, ""))))),
    h(Explain, readReadoutScenarios(r.rows, r.weighted, price, baseValue)),
    h("div", { className: "prose", style: { ...UI.caption, marginTop: 8 } },
      "Defaults: a modest win leaves the odds this case already has after a positive readout (" + pct1(r.conditionalPosPct) + "%); a clear win closes 40% of the gap to certainty (" + pct1(r.defaults.clearPosPct) + "%). A miss is the failure floor. Values are the model re-run, not a forecast of the share price on the day."));
}
