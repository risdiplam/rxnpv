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
      h("div", { className: "tree-list-gate" }, h("b", null, "Launch"), " · " + pct(tree.posToLaunch) + " of outcomes → " + fmtShare(tree.success) + " a share"));
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
  const edge = (key, a, b, text, color) => {
    const x1 = a.x + a.w, y1 = a.y, x2 = b.x, y2 = b.y, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const pw = text ? measureLabel(text, 12, 600) + 16 : 0;
    edges.push(h("g", { key },
      h("path", { d: "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2, fill: "none", stroke: color, strokeWidth: 1.6 }),
      text && h("rect", { x: mx - pw / 2, y: my - 11, width: pw, height: 22, rx: 11, fill: "var(--surface)", stroke: color }),
      text && h("text", { x: mx, y: my + 4, textAnchor: "middle", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", fill: color }, text)));
  };
  // Leaves down the right: success at the top, then the failure at each gate,
  // last gate first. Each gate sits halfway between the branch it passes to
  // and its own failure, so the passing lines climb and the failing ones fall.
  const S = 116, L0 = 44;
  const leafY = j => L0 + j * S;
  const gy = new Array(N);
  gy[N - 1] = (leafY(0) + leafY(1)) / 2;
  for (let k = N - 2; k >= 0; k--) gy[k] = (gy[k + 1] + leafY(N - k)) / 2;
  const H = leafY(N) + 44;
  const succ = node("leaf-s", leafX, leafY(0), leafW, ["Launches", { t: fmtShare(tree.success) + " a share", mono: true, bold: true, color: "var(--green)" }, { t: pct(tree.posToLaunch) + " of outcomes" }], "good");
  const fails = tree.gates.map((g, k) => node("leaf-f" + k, leafX, leafY(N - k), leafW,
    [k === N - 1 && g.key === "regulatory" ? "Not approved after a positive readout" : g.label.replace(/ readout$/, "") + (k === 0 ? " fails" : " fails after earlier success"),
      { t: "≈" + fmtShare(g.failValue) + " a share", mono: true, bold: true, color: "var(--red)" }, { t: pct(g.failProb) + " of outcomes" }], "bad"));
  const gates = tree.gates.map((g, k) => node("gate" + k, firstGateX + k * step, gy[k], gateW, [g.label, { t: "~" + monthsFromNow(g.endYears) + " in the model" }]));
  const today = node("today", 0, gy[0], todayW, ["Today", { t: price > 0 ? fmtShare(price) + " a share" : "—", mono: true }], "root");
  edge("e-t", today, gates[0], "", "var(--ink-3)");
  tree.gates.forEach((g, k) => {
    edge("e-p" + k, gates[k], k === N - 1 ? succ : gates[k + 1], g.passWord + " · " + pct(g.pass), "var(--green)");
    edge("e-f" + k, gates[k], fails[k], g.failWord + " · " + pct(1 - g.pass), "var(--red)");
  });
  return h("div", { ref: wrapRef },
    h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": label || "Outcome tree", "data-titled": "1", style: { width: "100%", height: H, display: "block" } }, edges, els));
}

function OutcomeTreeSection({ theCase, discountRatePct, tv, baseValue }) {
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
    h(Explain, readOutcomeTree(tree.gates, tree.weighted, baseValue)));
}
