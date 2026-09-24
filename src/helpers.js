// ════════════════════════════════════════════════════════════════════════════
// Shared UI primitives + lookup helpers
// ════════════════════════════════════════════════════════════════════════════
let _idCounter = 1;
function newId(prefix) { return (prefix || "id") + "_" + (Date.now().toString(36)) + "_" + (_idCounter++); }

function fmtMoney(v, decimals) {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return (v < 0 ? "-" : "") + "$" + (a / 1e9).toFixed(decimals != null ? decimals : 2) + "B";
  if (a >= 1e6) return (v < 0 ? "-" : "") + "$" + (a / 1e6).toFixed(decimals != null ? decimals : 1) + "M";
  if (a >= 1e3) return (v < 0 ? "-" : "") + "$" + (a / 1e3).toFixed(0) + "K";
  return (v < 0 ? "-" : "") + "$" + a.toFixed(0);
}
// Today's date as YYYY-MM-DD in the user's own time zone. toISOString() is
// UTC, so after ~8pm in the US every report, bundle and auto-logged evidence
// entry was stamped with tomorrow's date.
function localDateStamp(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fmtNum(v) { if (v == null || isNaN(v)) return "—"; return Math.round(v).toLocaleString(); }

// Per-share dollar values (fair value, current price) — unlike fmtMoney,
// always keeps two decimal places (cents matter for a share price) but adds
// thousands separators, since a small enough diluted share count against a
// large modeled equity value produces a genuinely multi-digit-thousands
// fair value per share (a real, if extreme, case — not just a display nit) —
// found via a micro-cap-shaped test case where "$742445.30" printed with no
// separator at all was much harder to read at a glance than it needed to be.
function fmtShare(v) {
  if (v == null || isNaN(v)) return "—";
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The three benchmark tables were sourced from different papers and don't
// share one taxonomy: PoS data is filed under "Neurology"/"Autoimmune"/
// "Infectious disease"/"Urology", while the trial cost and duration tables use
// "CNS"/"Immunomodulation"/"Anti-infective"/"Genitourinary" for the same
// diseases. THERAPEUTIC_AREAS is the union of both, so the dropdown offers
// each pair as if they were separate choices — and picking the term that
// happens to be missing from a given table silently fell through to a generic
// weighted average, even though a perfectly good area-specific number existed
// under the other name. Rather than restate any benchmark, map the synonyms
// onto whatever each table actually calls them.
const AREA_ALIASES = {
  "Neurology": ["CNS"],
  "CNS": ["Neurology"],
  "Psychiatry": ["CNS", "Neurology"],
  "Autoimmune": ["Immunomodulation"],
  "Immunomodulation": ["Autoimmune"],
  "Infectious disease": ["Anti-infective"],
  "Anti-infective": ["Infectious disease"],
  "Urology": ["Genitourinary", "Renal"],
  "Genitourinary": ["Urology"],
  "Renal": ["Genitourinary", "Urology"],
  "Metabolic": ["Endocrine"],
  "Endocrine": ["Metabolic"],
  "Musculoskeletal": ["Other"]
};

// Returns the row plus the name it was actually found under, so a caller can
// be honest about having resolved a synonym rather than pretending the user's
// own choice was in the table.
function lookupAreaRow(byArea, area) {
  if (byArea[area]) return { row: byArea[area], via: null };
  for (const alt of (AREA_ALIASES[area] || [])) {
    if (byArea[alt]) return { row: byArea[alt], via: alt };
  }
  return { row: null, via: null };
}

// Look up PoS for a therapeutic area / phase, falling back to all-indications baseline
function getPosForArea(area, phaseKey) {
  const { row, via } = lookupAreaRow(POS_BY_AREA.byArea, area);
  if (row && row[phaseKey] != null) {
    return { value: row[phaseKey], source: POS_BY_AREA.source + (via ? " — " + via + " data (this source's name for " + area + ")" : ""), matched: true, via };
  }
  return { value: POS_BY_AREA.allIndications[phaseKey], source: POS_BY_AREA.source + " (all-indications baseline — no specific data for this area)", matched: false };
}
function getTrialCostForArea(area, phaseKey) {
  const { row, via } = lookupAreaRow(TRIAL_COST_BY_AREA.byArea, area);
  if (row && row[phaseKey] != null) {
    return { value: row[phaseKey], source: TRIAL_COST_BY_AREA.source + (via ? " — " + via + " data (this source's name for " + area + ")" : ""), matched: true, via };
  }
  return { value: TRIAL_COST_BY_AREA.weightedAvg[phaseKey], source: TRIAL_COST_BY_AREA.source + " (weighted avg — no specific data for this area)", matched: false };
}
function getTrialDurationForArea(area, phaseKey) {
  const { row, via } = lookupAreaRow(TRIAL_DURATION_BY_AREA.byArea, area);
  if (row && row[phaseKey] != null) {
    return { value: row[phaseKey], source: TRIAL_DURATION_BY_AREA.source + (via ? " — " + via + " data (this source's name for " + area + ")" : ""), matched: true, via };
  }
  return { value: TRIAL_DURATION_BY_AREA.weightedAvg[phaseKey], source: TRIAL_DURATION_BY_AREA.source + " (weighted avg)", matched: false };
}

// ── BenchField: the signature input component ──
// props: label, value, onChange (v)=>{}, bench: {value, source} | null, suffix, placeholder, step, type, help
function BenchField({ label, value, onChange, bench, suffix, placeholder, step, type, help, wide }) {
  const h = React.createElement;
  const hasValue = value !== "" && value != null;
  const isBenchmark = bench && hasValue && Math.abs(Number(value) - Number(bench.value)) < 0.001;
  const isCustom = hasValue && !isBenchmark;
  const borderColor = isCustom ? "var(--teal)" : isBenchmark ? "var(--amber)" : "var(--rule)";

  // Capped so a field alone on its row doesn't stretch to the full 1,240px
  // container for a two-digit number; in a row of three each still gets ~370.
  return h("div", { style: { marginBottom: 14, flex: wide ? "1 1 100%" : "1 1 200px", minWidth: 180, maxWidth: wide ? "none" : 420 } },
    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 } },
      label,
      isCustom && h("span", { title: "Overridden from benchmark", style: { color: "var(--teal)", fontSize: 10 } }, "● custom"),
      isBenchmark && h("span", { title: "Using benchmark default", style: { color: "var(--amber)", fontSize: 10 } }, "◆ benchmark")
    ),
    h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
      h("input", {
        type: type || "number", step: step || "any", value: value == null ? "" : value, placeholder: placeholder,
        onChange: e => onChange(e.target.value),
        // The visible label sits two levels up in the DOM, so it isn't
        // programmatically associated with this input — a screen reader
        // announced these as bare, unnamed fields. aria-label carries the same
        // text (plus its unit, which is otherwise a separate sibling span) so
        // the accessible name matches what's on screen.
        "aria-label": label + (suffix ? " (" + suffix + ")" : ""),
        style: {
          flex: 1, padding: "7px 10px", borderRadius: 6, border: "1.5px solid " + borderColor,
          background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13,
          transition: "border-color 0.12s"
        }
      }),
      suffix && h("span", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", minWidth: 18 } }, suffix)
    ),
    bench && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
      "Benchmark: ",
      h("button", {
        onClick: () => onChange(String(bench.value)),
        title: "Use the benchmark value",
        // Vertical padding + negative margin enlarges the clickable area
        // without changing where the text sits on the line — this is an
        // inline chip inside a sentence, so it can't just be made bigger,
        // but at 18x13 it was a genuinely fiddly target.
        style: { background: "none", border: "none", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer", padding: "6px 3px", margin: "-6px -3px", fontWeight: 700, textDecoration: "underline" }
      }, (typeof bench.value === "number" ? bench.value : bench.value) + (suffix || "")),
      h("span", { style: { color: "var(--ink-3)" } }, " · " + bench.source)
    ),
    help && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 3 } }, help)
  );
}

// ── ConfirmDialog: a real "are you sure?" for irreversible actions ─────────
// Deleting a case or a program used to fire on a single click — one misclick
// and hours of assumptions, an Evidence Log, a Calibration Log, are gone with
// no way back. This is the app's first real modal, so it's built generic
// (title/message/confirmLabel) rather than case-specific, for reuse anywhere
// else a destructive one-click action turns up. Backdrop click and Escape
// both cancel; only the explicit button confirms.
// Inline two-step delete for LIST-ITEM removals (a custom comp, a milestone,
// an evidence-log entry, a watched trial). A full modal is right for deleting
// a whole case or program — hours of work — but would be disproportionate
// here, and modal fatigue trains people to click through without reading.
//
// First click arms the button ("Sure?"), second click deletes. Auto-disarms
// after 3s so a half-pressed button never sits armed waiting to catch a
// later, unrelated click. Escape disarms immediately.
// ── Section export — the one export bar every section carries ─────────────
// Replaces the chart-only export rows. It exports the SECTION it sits in —
// title, headline figures, chart, tables, notes — rather than just the chart,
// and it finds that section by walking up the DOM to the nearest
// [data-export-section], so a card only has to declare itself; nothing has to
// be threaded down to the button.
//
// "+ Report" does one of two things, deliberately:
//   · on a Workspace section the report already renders LIVE from the model
//     (it declares data-report-section), it switches that live section on —
//     a frozen copy of something the report recomputes anyway would only
//     drift out of date next to it;
//   · everywhere else it stores a snapshot of exactly what is on screen, which
//     is the only option for a result computed on demand from an API call.
// Either way it then says WHERE it went and links straight there, because the
// previous version said "Pinned" and nothing else, and the user reasonably
// asked where pinned things were supposed to go.
//
// The case list and the navigation come from context rather than props, so
// the ~100 cards that carry this bar did not all need rewiring.
const ReportContext = (typeof React !== "undefined" && React.createContext) ? React.createContext(null) : null;

const SNAPSHOT_MAX_STORED_BYTES = 400000;
const PINNED_MAX_PER_CASE_V2 = 40;

function exportContextOf(el) {
  let n = el;
  while (n && n.getAttribute) {
    const c = n.getAttribute("data-export-context");
    if (c) return c;
    n = n.parentNode;
  }
  return "";
}

function reportSectionIncluded(theCase, id) {
  const stored = ((theCase && theCase.reportInclusions) || {})[id];
  if (stored != null) return !!stored;
  const def = (typeof REPORT_SECTIONS !== "undefined") ? REPORT_SECTIONS.find(x => x.id === id) : null;
  return !!(def && def.defaultOn);
}

// The PDF bundle's current items, kept live: every bar and the top-bar count
// re-read it when any of them changes it (Simulation's bars are separate React
// roots, so a shared event rather than context).
function useBundle() {
  const [items, setItems] = React.useState(() => loadBundle());
  React.useEffect(() => {
    const on = () => setItems(loadBundle());
    window.addEventListener(BUNDLE_EVENT, on);
    window.addEventListener("storage", on);
    return () => { window.removeEventListener(BUNDLE_EVENT, on); window.removeEventListener("storage", on); };
  }, []);
  return items;
}

// Nearest enclosing chart block — [data-export-chart] — for a chart-scoped bar.
function closestChartBlock(el) {
  let n = el;
  while (n && n !== document.body) {
    if (n.hasAttribute && n.hasAttribute("data-export-chart")) return n;
    n = n.parentNode;
  }
  return null;
}

// Two scopes, one component, so a reader can take out either or both:
//   scope "section" — the whole card or panel: title, inputs as set, results,
//     every chart, tables and open notes;
//   scope "chart"   — one chart on its own, with its title, as PNG / PDF / SVG,
//     or into the report on its own.
// Each bar says which it is and names what it will export, because two
// unlabelled rows of identical buttons one above the other (a chart inside a
// section inside a panel) was impossible to tell apart.
function ExportBar({ scope, title, heading, reportSection, source }) {
  const h = React.createElement;
  const isChart = scope === "chart";
  const ref = React.useRef(null);
  const reactCtx = (ReportContext && React.useContext) ? React.useContext(ReportContext) : null;
  // Simulation panels are vanilla DOM with the bar mounted in its own small
  // React root, outside the provider — they read the same data off the bridge.
  const ctx = reactCtx || (typeof window !== "undefined" ? window.rxnpvSimBridge : null) || null;
  // Always the CURRENT source, read at click time rather than render time: a
  // bar mounted into a Simulation panel is not re-rendered when cases change,
  // and writing back a stale case object would silently discard newer edits.
  const liveSource = () => reactCtx || (typeof window !== "undefined" ? window.rxnpvSimBridge : null);
  const [busy, setBusy] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [hasSvg, setHasSvg] = React.useState(false);
  const [label, setLabel] = React.useState(title || "");
  const cases = (ctx && ctx.cases) || [];
  const [pickedCaseId, setPickedCaseId] = React.useState(null);
  const targetId = pickedCaseId || (ctx && ctx.activeCaseId) || (cases[0] && cases[0].id);
  const target = cases.find(c => c.id === targetId) || null;

  const block = () => ref.current && (isChart ? closestChartBlock(ref.current) : closestExportSection(ref.current));
  const blockTitle = () => title || sectionTitleOf(block());
  // The name shown on the bar and whether an SVG exists, re-checked after
  // every render because a section's content usually arrives after its data.
  React.useEffect(() => {
    const b = block();
    const t = title || (b ? sectionTitleOf(b) : "");
    if (t !== label) setLabel(t);
    const svg = isChart && b && Array.prototype.some.call(b.querySelectorAll("svg"), n => (n.getBoundingClientRect().width || 0) >= 120);
    if (!!svg !== hasSvg) setHasSvg(!!svg);
  });

  const flash = (m, ms) => { setMsg(m); if (ms) setTimeout(() => setMsg(cur => cur === m ? null : cur), ms); };
  const noun = isChart ? "chart" : "section";

  const doExport = async (kind) => {
    const b = block();
    if (!b) { flash({ tone: "err", text: "Couldn't find the " + noun + " to export." }, 4000); return; }
    setBusy(kind); setMsg(null);
    let r;
    try {
      if (kind === "svg") {
        const svg = Array.prototype.find.call(b.querySelectorAll("svg"), n => (n.getBoundingClientRect().width || 0) >= 120);
        r = svg ? await exportChartAsSvg(svg, blockTitle()) : { ok: false, error: "No chart found to export here." };
      } else {
        r = await exportSectionAs(b, kind, { title: blockTitle(), context: exportContextOf(b), heading: isChart && heading !== false ? blockTitle() : null });
      }
    } catch (e) { r = { ok: false, error: e.message }; }
    setBusy(null);
    if (r && r.ok) flash({ tone: "ok", text: r.viaBrowser ? "Downloaded" : "Saved" }, 3500);
    else if (!(r && r.canceled)) flash({ tone: "err", text: (r && r.error) || "Export failed." }, 6000);
  };

  const inReport = !!(reportSection && target && reportSectionIncluded(target, reportSection));

  // "+ Bundle": the same snapshot "+ Report" stores, into the case-free PDF
  // bundle instead, to be exported with anything else collected — merged into
  // one PDF or as separate files — from the Bundle view.
  const doBundle = async () => {
    const b = block();
    if (!b) { flash({ tone: "err", text: "Couldn't find the " + noun + " to add." }, 4000); return; }
    setBusy("bundle");
    const r = await buildSectionSnapshot(b, { title: blockTitle(), source: source || exportContextOf(b) });
    setBusy(null);
    if (!r.ok) { flash({ tone: "err", text: r.error }, 6000); return; }
    if (r.pin.html.length > SNAPSHOT_MAX_STORED_BYTES) {
      flash({ tone: "err", text: "That " + noun + " is too large to keep in the bundle (" + Math.round(r.pin.html.length / 1024) + "KB). Export it as a PDF directly instead." }, 8000);
      return;
    }
    const added = addToBundle(r.pin);
    if (!added.ok) { flash({ tone: "err", text: added.error }, 8000); return; }
    flash({ tone: "ok", text: "In the PDF bundle (" + added.count + (added.count === 1 ? " item)" : " items)"), bundle: true }, 9000);
  };

  const doReport = async () => {
    const src = liveSource();
    const live = src && (src.cases || []).find(c => c.id === targetId);
    if (!src || !live) return;
    const b = block();
    if (reportSection) {
      const was = reportSectionIncluded(live, reportSection);
      src.updateCase({ ...live, reportInclusions: { ...(live.reportInclusions || {}), [reportSection]: !was }, updatedAt: Date.now() });
      flash(was
        ? { tone: "ok", text: "Removed from " + (live.name || "case") + "'s report" }
        : { tone: "ok", text: "In " + (live.name || "case") + "'s report", caseId: live.id }, 7000);
      return;
    }
    const existing = pinnedResultsOf(live);
    if (existing.length >= PINNED_MAX_PER_CASE_V2) {
      flash({ tone: "err", text: (live.name || "This case") + "'s report already holds " + PINNED_MAX_PER_CASE_V2 + " added items — remove one there first.", caseId: live.id }, 8000);
      return;
    }
    setBusy("report");
    const r = await buildSectionSnapshot(b, { title: blockTitle(), source: source || exportContextOf(b), heading: isChart && heading !== false ? blockTitle() : null });
    setBusy(null);
    if (!r.ok) { flash({ tone: "err", text: r.error }, 6000); return; }
    if (r.pin.html.length > SNAPSHOT_MAX_STORED_BYTES) {
      flash({ tone: "err", text: "That " + noun + " is too large to store in a report (" + Math.round(r.pin.html.length / 1024) + "KB). Export it as a PDF instead." }, 8000);
      return;
    }
    // Re-read once more after the async snapshot, for the same reason.
    const src2 = liveSource();
    const fresh = (src2.cases || []).find(c => c.id === targetId) || live;
    src2.updateCase({ ...fresh, pinnedResults: pinnedResultsOf(fresh).concat([r.pin]), updatedAt: Date.now() });
    flash({ tone: "ok", text: "Added to " + (fresh.name || "case") + "'s report", caseId: fresh.id }, 9000);
  };

  const btn = (text, kind, onClick, tip, extra) => h("button", Object.assign({
    key: kind, type: "button", title: tip, disabled: busy != null, onClick,
    style: { padding: "4px 10px", minHeight: 26, borderRadius: 5, border: "1px solid var(--rule)", background: "transparent",
      color: busy === kind ? "var(--ink-1)" : "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10,
      cursor: busy ? "default" : "pointer", whiteSpace: "nowrap" }
  }, extra || {}), busy === kind ? "…" : text);

  const noCase = !cases.length;
  const shortLabel = label && label.length > 48 ? label.slice(0, 46) + "…" : label;
  return h("div", {
    ref, "data-no-export": "", className: (isChart ? "chart-export-bar" : "section-export-bar") + (msg || busy ? " is-active" : ""),
    style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap", marginTop: isChart ? 6 : 12 }
  },
    msg && h("span", { role: "status", style: { fontSize: 10, fontFamily: "var(--mono)", color: msg.tone === "ok" ? "var(--teal)" : "var(--red)", marginRight: 4 } },
      msg.text,
      msg.caseId && ctx && ctx.openReport && h("button", { type: "button", onClick: () => { const src = liveSource(); if (src && src.openReport) src.openReport(msg.caseId); },
        style: { marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--teal)", textDecoration: "underline", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } },
        "Open report →"),
      msg.bundle && h("button", { type: "button", onClick: () => { const src = liveSource(); if (src && src.openBundle) src.openBundle(); },
        style: { marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--teal)", textDecoration: "underline", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } },
        "Open bundle →")),
    h("span", { title: label, style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
      (isChart ? "Export chart" : "Export section") + (shortLabel ? " · " : ""),
      shortLabel && h("span", { style: { textTransform: "none", letterSpacing: 0 } }, shortLabel)),
    btn("PNG", "png", () => doExport("png"), isChart
      ? "Just this chart, with its title, as a high-resolution PNG"
      : "This whole section as a PNG — title, inputs, results, every chart, tables and open notes, at full height"),
    btn("PDF", "pdf", () => doExport("pdf"), isChart
      ? "Just this chart, with its title, as a vector PDF"
      : "This whole section as a vector PDF, with selectable text"),
    isChart && hasSvg && btn("SVG", "svg", () => doExport("svg"), "Just this chart as an editable vector SVG"),
    h("span", { style: { width: 1, height: 14, background: "var(--rule)", margin: "0 2px" } }),
    btn(reportSection ? (inReport ? "✓ In report" : "+ Report") : "+ Report", "report",
      noCase ? undefined : doReport,
      noCase ? "Reports belong to a case — create one in Workspace first, then sections and charts can be added to its report"
        : reportSection
          ? (inReport ? "This section is in " + (target && target.name) + "'s report — click to take it out" : "Include this section in " + (target && target.name) + "'s report (it renders live from the model there)")
          : "Add " + (isChart ? "just this chart" : "this whole section") + " to " + (target && target.name) + "'s report, to build a PDF of only what you choose",
      noCase ? { disabled: true, style: { padding: "4px 10px", minHeight: 26, borderRadius: 5, border: "1px dashed var(--rule)", background: "transparent", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, opacity: 0.6, cursor: "not-allowed" } }
        : (inReport ? { style: { padding: "4px 10px", minHeight: 26, borderRadius: 5, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10, cursor: busy ? "default" : "pointer", whiteSpace: "nowrap" } } : null)),
    btn("+ Bundle", "bundle", doBundle, "Collect " + (isChart ? "just this chart" : "this whole section") + " into your PDF bundle — then export everything you collected as one PDF, or each as its own PDF, from Bundle in the top bar. No case needed."),
    cases.length > 1 && h("select", { "aria-label": "Case whose report this goes to", value: targetId || "", onChange: e => setPickedCaseId(e.target.value),
      style: { padding: "2px 6px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10, maxWidth: 150 } },
      cases.map(c => h("option", { key: c.id, value: c.id }, c.name || "Untitled")))
  );
}
function SectionExportBar(props) { return React.createElement(ExportBar, Object.assign({}, props, { scope: "section" })); }
function ChartExportBar(props) { return React.createElement(ExportBar, Object.assign({}, props, { scope: "chart" })); }

// Wraps any block as its own exportable section — used for the sub-sections
// packed inside larger cards (the scenario comparison, the bridge, Monte
// Carlo), which a reader should be able to take out on their own.
function ExportSection({ title, reportSection, source, style, className, id, children }) {
  const h = React.createElement;
  return h.apply(null, ["div", {
    id: id || undefined,
    className: "export-section" + (className ? " " + className : ""),
    // Present even when empty: the attribute is what marks the boundary, and an
    // empty value means "take the title from the section's own heading".
    "data-export-section": title || "",
    "data-report-section": reportSection || undefined,
    style: style || null
  }].concat(React.Children.toArray(children), [h(SectionExportBar, { key: "__export", title, reportSection, source })]));
}

// ── Storage headroom ───────────────────────────────────────────────────────
// Browsers/Electron expose no reliable synchronous quota API, and the real
// limit varies (commonly ~5MB per origin). Rather than guess a number and be
// wrong, this measures what IS knowable — bytes actually used, split into the
// user's own irreplaceable data vs. disposable API caches — and warns against
// a conservative assumed ceiling. Being early is the right failure mode here:
// a warning at 60% costs nothing, while discovering the limit at save time
// costs work.
const STORAGE_ASSUMED_QUOTA_BYTES = 5_000_000;
const STORAGE_WARN_FRACTION = 0.6;
const STORAGE_CRITICAL_FRACTION = 0.85;
const STORAGE_CACHE_KEYS = ["rxnpv_edgar_cache", "rxnpv_cik_cache"];

function measureStorage() {
  let userBytes = 0, cacheBytes = 0, keys = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      const n = (localStorage.getItem(k) || "").length;
      keys++;
      if (STORAGE_CACHE_KEYS.indexOf(k) !== -1 || /_snapshot_|_cache$/.test(k)) cacheBytes += n;
      else userBytes += n;
    }
  } catch (e) { return null; }
  const total = userBytes + cacheBytes;
  const frac = total / STORAGE_ASSUMED_QUOTA_BYTES;
  return {
    userBytes, cacheBytes, total, keys, fraction: frac,
    level: frac >= STORAGE_CRITICAL_FRACTION ? "critical" : frac >= STORAGE_WARN_FRACTION ? "warn" : "ok"
  };
}

function clearDisposableCaches() {
  let freed = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      if (STORAGE_CACHE_KEYS.indexOf(k) !== -1 || /_snapshot_|_cache$/.test(k)) {
        freed += (localStorage.getItem(k) || "").length;
        localStorage.removeItem(k);
      }
    }
  } catch (e) {}
  return freed;
}

const fmtBytes = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + " MB" : Math.round(n / 1000) + " KB";

// Banner shown only when headroom is genuinely getting short. Offers the one
// safe remedy (drop re-fetchable caches) rather than only reporting a problem.
function StorageWarningBanner({ onCleared }) {
  const h = React.createElement;
  const [info, setInfo] = React.useState(() => measureStorage());
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    const t = setInterval(() => setInfo(measureStorage()), 20000);
    return () => clearInterval(t);
  }, []);
  if (!info || info.level === "ok" || dismissed) return null;
  const critical = info.level === "critical";
  return h("div", { style: {
      background: critical ? "var(--red-bg)" : "var(--amber-bg)",
      borderBottom: "1px solid " + (critical ? "var(--red)" : "var(--amber)"),
      padding: "9px 20px", fontFamily: "var(--mono)", fontSize: 11,
      color: "var(--ink-1)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"
    } },
    h("span", { style: { color: critical ? "var(--red)" : "var(--amber)", fontWeight: 700 } },
      critical ? "⚠ Storage almost full" : "⚠ Storage filling up"),
    h("span", null,
      fmtBytes(info.total), " used — ", fmtBytes(info.userBytes), " your cases, ",
      fmtBytes(info.cacheBytes), " re-fetchable caches.",
      critical ? " New cases may fail to save." : ""),
    info.cacheBytes > 20000 && h("button", {
      onClick: () => { const freed = clearDisposableCaches(); setInfo(measureStorage()); if (onCleared) onCleared(freed); },
      style: { padding: "4px 11px", borderRadius: 5, border: "1px solid var(--teal)", background: "transparent", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", fontWeight: 700 } },
      "Free " + fmtBytes(info.cacheBytes)),
    !critical && h("button", { onClick: () => setDismissed(true),
      style: { padding: "4px 9px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Dismiss")
  );
}

function ConfirmXButton({ onConfirm, title, label, armedLabel, style }) {
  const h = React.createElement;
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    const onKey = (e) => { if (e.key === "Escape") setArmed(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [armed]);

  const base = {
    padding: "4px 10px", minWidth: 26, minHeight: 26, borderRadius: 5, border: "1px solid var(--red)",
    background: armed ? "var(--red)" : "var(--red-bg)",
    color: armed ? "var(--surface)" : "var(--red)",
    fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer",
    fontWeight: armed ? 700 : 400, whiteSpace: "nowrap", transition: "background 120ms"
  };
  return h("button", {
    title: armed ? "Click again to confirm — or press Escape to cancel" : (title || "Delete"),
    "aria-label": armed ? "Confirm delete" : (title || "Delete"),
    // The armed state is conveyed only by the accessible name changing in
    // place. Most screen readers re-announce that for a focused element, but
    // it isn't guaranteed the way a live region is — and "this click deletes
    // something" is exactly the state worth guaranteeing.
    "aria-live": "polite",
    onClick: (e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); },
    style: Object.assign(base, style || {})
  }, armed ? (armedLabel || "Sure?") : (label || "×"));
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const h = React.createElement;
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    // Remember where focus came from so it can go back — otherwise closing the
    // dialog drops focus onto <body> and a keyboard user has to tab in from
    // the top of the page to get back to where they were.
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    const onKey = (e) => {
      if (e.key === "Escape") { onCancel(); return; }
      // Without containment, Tab walks straight out of the dialog and into the
      // editor behind the dimmed overlay — a keyboard user can start editing
      // fields they can't see while a delete confirmation is still open.
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function") { try { opener.focus(); } catch (e) {} }
    };
  }, [onCancel]);

  return h("div", {
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    onClick: onCancel
  },
    h("div", {
      ref: panelRef,
      role: "dialog", "aria-modal": "true", "aria-label": title,
      style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "22px 24px", width: "min(420px, 90vw)", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" },
      onClick: e => e.stopPropagation()
    },
      h("div", { style: { fontFamily: "var(--display)", fontSize: 17, fontWeight: 700, color: "var(--ink-1)", marginBottom: 8 } }, title),
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 20 } }, message),
      h("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
        h("button", { onClick: onCancel, autoFocus: true,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 12, cursor: "pointer" } }, "Cancel"),
        // Outlined rather than filled: --red is tuned to clear 4.5:1 as TEXT
        // against --surface on both themes (see the contrast pass), but no
        // single fixed text colour clears 4.5:1 against --red as a FILL on
        // both themes at once (white fails dark red ~3.07:1, near-black fails
        // light red ~3.68:1). Matches the existing "Delete case"/"Remove
        // program" buttons' own styling rather than inventing a new one.
        h("button", { onClick: onConfirm,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--red)", background: "var(--red-bg)", color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: "pointer" } }, confirmLabel || "Delete")
      )
    )
  );
}

// ── Note: collapsed-by-default explanatory copy ────────────────────────────
// React counterpart to the details.note pattern already used in the
// Simulation tab. Several of this app's explanations are genuinely load-
// bearing — why the unrisked figure can be more negative than the risked
// one, why the G&A slider exists at all — but rendered as permanent
// paragraphs they push the actual numbers off screen and make a panel look
// heavier than it is. One muted line, expandable, styling shared with the
// vanilla-DOM version so both halves of the app read identically.
function Note({ summary, children }) {
  const h = React.createElement;
  return h("details", { className: "note" },
    h("summary", null, summary || "Why this matters"),
    h("div", { className: "note-body" }, children)
  );
}

// ── MillionsField: thin wrapper around BenchField for fields that are ALWAYS
// large dollar amounts (peak revenue, cash, debt, convertible face value).
// The user types/sees the number in millions ("800" not "800000000"); the
// underlying stored value stays in raw dollars, so no calculation code needs
// to know this display convenience exists. Not used for fields that can be
// small-to-mid-size (per-patient price, corporate G&A already in $M UI, etc.)
// — applied intentionally, not everywhere.
// ── ExternalLink: opens in the user's real default browser when running as
// the desktop app (via the Electron bridge), falls back to window.open in a
// plain browser context. Never navigates the app's own window away. ──
function ExternalLink({ href, children, style }) {
  const h = React.createElement;
  const openLink = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(href);
    } else if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };
  return h("a", { href, onClick: openLink, style: { color: "var(--teal)", textDecoration: "underline", cursor: "pointer", ...style } }, children);
}

function MillionsField({ label, value, onChange, bench, help, wide }) {
  const h = React.createElement;
  const toMillions = (raw) => {
    if (raw === "" || raw == null) return "";
    const n = Number(raw);
    if (isNaN(n)) return "";
    const m = n / 1e6;
    return Math.abs(m) >= 100 ? String(Math.round(m)) : String(Math.round(m * 100) / 100);
  };
  const fromMillions = (m) => {
    if (m === "" || m == null) return "";
    const n = Number(m);
    if (isNaN(n)) return "";
    return String(Math.round(n * 1e6));
  };
  const displayValue = toMillions(value);
  const displayBench = bench ? { ...bench, value: typeof bench.value === "number" ? Math.round((bench.value / 1e6) * 100) / 100 : bench.value } : null;
  return h(BenchField, {
    label, wide, help,
    value: displayValue,
    onChange: (v) => onChange(fromMillions(v)),
    bench: displayBench,
    suffix: "$M"
  });
}

function SectionCard({ title, subtitle, children, defaultOpen }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(defaultOpen !== false);
  // An exportable section like any other card — the inputs as set ARE the
  // relevant information for an assumptions card. The bar only shows while the
  // card is open, since a collapsed card has nothing in it to export.
  return h("div", { className: open ? "export-section" : undefined, "data-export-section": open ? (typeof title === "string" ? title : "") : undefined, style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, marginBottom: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" } },
    h("div", {
      onClick: () => setOpen(!open),
      style: { padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "var(--surface-2)" }
    },
      h("div", null,
        h("div", { style: { fontFamily: "var(--display)", fontSize: 15, fontWeight: 600, color: "var(--ink-1)" } }, title),
        subtitle && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 2 } }, subtitle)
      ),
      h("span", { style: { color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)" } }, open ? "▾" : "▸")
    ),
    open && h("div", { style: { padding: "16px 18px", display: "flex", flexWrap: "wrap", gap: "0 16px" } }, children,
      h("div", { style: { flexBasis: "100%" } }, h(SectionExportBar, { title: typeof title === "string" ? title : undefined })))
  );
}

// ── Shared numeric fallback helper — use this instead of `Number(x) || y`
// anywhere y is not itself 0. `Number(x) || y` silently treats an explicitly-
// entered "0" the same as "field left blank" (since 0 is falsy in JS), which
// has been a real, previously-invisible bug source in this app (corporate
// G&A, discount rate, years-to-LOE, population funnel percentages all hit
// this before being found and fixed). numOr distinguishes "unset" from
// "explicitly zero" correctly. Safe to use even where the fallback IS 0,
// for consistency — it just makes the intent explicit either way. ──
function numOr(value, fallback) {
  return (value !== "" && value != null && !isNaN(Number(value))) ? Number(value) : fallback;
}

// ── CSV export — pure browser Blob + <a download>, no Electron-specific
// bridge needed (unlike PDF export, which needs native print capability).
// Works identically in the desktop app's renderer and a plain browser.
function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(",")].concat(rows.map(r => r.map(esc).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Custom comps (M&A deals, peak sales drugs) — user-added entries that
// merge into the built-in reference datasets, same idea as RxNPV's custom
// comp feature. Persisted to localStorage (not tied to a case) so they're
// available everywhere the underlying dataset is used, same as the built-in
// entries — Reference Sheet, the M&A scatter chart, the Peak Sales bar
// chart, and CSV export all read from the SAME merged array, not a
// second parallel list, so a custom entry behaves identically to a
// built-in one everywhere except that it can be deleted.
function loadCustomComps(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; }
}
function saveCustomComps(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); return true; }
  catch (e) { return false; }
}
const CUSTOM_MA_KEY = "rxnpv_custom_ma";
const CUSTOM_PEAKSALES_KEY = "rxnpv_custom_peaksales";
const CUSTOM_LICENSING_KEY = "rxnpv_custom_licensing";

// Generic add-custom-comp form — same shape used for both M&A deals and
// Peak Sales drugs, just with a different field spec. First field in the
// spec is treated as required (mirrors RxNPV's "brand name required"
// convention) since everything else here is optional context.
function CustomCompForm({ fields, onSave, onCancel, initialValues, saveLabel }) {
  const h = React.createElement;
  const empty = {}; fields.forEach(f => { empty[f.key] = (initialValues && initialValues[f.key] != null) ? String(initialValues[f.key]) : ""; });
  const [vals, setVals] = React.useState(empty);
  const requiredKey = fields[0].key;
  // Only the first field used to be required, so a numeric field left blank
  // was silently saved as a real 0 (parseFloat("") || 0) and merged into the
  // same array as the built-in, source-verified comps — quietly dragging down
  // any average or multiple computed from that table, with nothing to show the
  // entry was incomplete. A numeric field that is filled in must parse, and
  // fields marked required must be present. MilestoneEntryForm already worked
  // this way; this brings the shared form in line with it.
  const numericProblem = fields.find(f => f.numeric && vals[f.key] !== "" && vals[f.key] != null && !isFinite(Number(vals[f.key])));
  const missingRequired = fields.find(f => (f.required || f.key === requiredKey) && (!vals[f.key] || !String(vals[f.key]).trim()));
  const canSave = !numericProblem && !missingRequired;
  const inputStyle = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };

  return h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", marginTop: 8 } },
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 } },
      fields.map(f => h("div", { key: f.key },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 } },
          f.label + (f.key === requiredKey ? " *" : "")),
        h("input", {
          type: f.numeric ? "number" : "text", value: vals[f.key], placeholder: f.placeholder,
          onChange: e => setVals(p => ({ ...p, [f.key]: e.target.value })), style: inputStyle
        })
      ))
    ),
    // Name the specific problem rather than just disabling the button, so it's
    // obvious which field is holding the save back.
    (numericProblem || missingRequired) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--amber)", marginBottom: 8 } },
      numericProblem ? ("“" + numericProblem.label + "” must be a number.")
        : ("“" + missingRequired.label + "” is required.")),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", {
        onClick: () => { if (!canSave) return; onSave(vals); },
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "#101414", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: canSave ? "pointer" : "default" }
      }, saveLabel || "Add"),
      h("button", { onClick: onCancel, style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Cancel")
    )
  );
}

// Evidence Log entry form — deliberately its own component rather than
// reusing CustomCompForm, since classification and confidence genuinely
// need dropdowns (free text would let the vocabulary drift, defeating the
// point of matching the Biotech Agent's controlled terms), and thesis notes
// need more room than a single-line input gives. Styled to match
// CustomCompForm's conventions so it still feels native to the app.
// Calibration Log entry form — same visual conventions as EvidenceEntryForm,
// different fields: a PoS prediction (yours and the market's) recorded
// before a catalyst, with an outcome filled in after it resolves.
// Milestone entry form — one row of a partnership deal's milestone
// schedule. Gate options are deliberately the same phase keys the R&D
// timeline and PoS staging already use (see computeCaseValuation's
// milestone-contribution logic), not freeform text, so every milestone
// maps cleanly onto a real risk weight and a real expected timing.
function MilestoneEntryForm({ onSave, onCancel, initialValues, saveLabel }) {
  const h = React.createElement;
  const iv = initialValues || {};
  const [label, setLabel] = React.useState(iv.label || "");
  const [gate, setGate] = React.useState(iv.gate || "phase3");
  const [valueM, setValueM] = React.useState(iv.valueM != null ? String(iv.valueM) : "");
  const inputStyle = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
  const canSave = label.trim().length > 0 && valueM !== "" && Number(valueM) > 0;

  return h("div", { style: { padding: "10px 12px", borderRadius: 7, background: "var(--surface)", marginTop: 6, border: "1px solid var(--rule)" } },
    h("div", { style: { display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr", gap: 8, marginBottom: 8 } },
      h("div", null, h("div", { style: fieldLabelStyle }, "Milestone *"),
        h("input", { type: "text", value: label, placeholder: "e.g. Phase 3 initiation", onChange: e => setLabel(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Paid on reaching"),
        h("select", { "aria-label": "Paid on reaching", value: gate, onChange: e => setGate(e.target.value), style: inputStyle },
          h("option", { value: "phase1" }, "Phase 1"),
          h("option", { value: "phase2" }, "Phase 2"),
          h("option", { value: "phase3" }, "Phase 3"),
          h("option", { value: "regulatory" }, "Filing"),
          h("option", { value: "launch" }, "Approval/launch"))),
      h("div", null, h("div", { style: fieldLabelStyle }, "Value ($M)"),
        h("input", { type: "number", value: valueM, placeholder: "e.g. 25", onChange: e => setValueM(e.target.value), style: inputStyle }))
    ),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", {
        onClick: () => { if (!canSave) return; onSave({ label: label.trim(), gate, valueM: Number(valueM) }); },
        style: { padding: "5px 14px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "#101414", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: "pointer" }
      }, saveLabel || "Add"),
      h("button", { onClick: onCancel, style: { padding: "5px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Cancel")
    )
  );
}

function CalibrationEntryForm({ onSave, onCancel, initialValues, saveLabel }) {
  const h = React.createElement;
  const iv = initialValues || {};
  const [catalystLabel, setCatalystLabel] = React.useState(iv.catalystLabel || "");
  const [catalystDate, setCatalystDate] = React.useState(iv.catalystDate || "");
  const [yourPoS, setYourPoS] = React.useState(iv.yourPoS != null ? String(iv.yourPoS) : "");
  const [marketImpliedPoS, setMarketImpliedPoS] = React.useState(iv.marketImpliedPoS != null ? String(iv.marketImpliedPoS) : "");
  const [outcome, setOutcome] = React.useState(iv.outcome || "pending");
  const [notes, setNotes] = React.useState(iv.notes || "");
  const inputStyle = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
  const canSave = catalystLabel.trim().length > 0;

  return h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", marginTop: 8 } },
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 } },
      h("div", null, h("div", { style: fieldLabelStyle }, "Catalyst *"),
        h("input", { type: "text", value: catalystLabel, placeholder: "e.g. Phase 2 readout", onChange: e => setCatalystLabel(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Date"),
        h("input", { type: "text", value: catalystDate, placeholder: "e.g. 2026-Q4", onChange: e => setCatalystDate(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Outcome"),
        h("select", { "aria-label": "Outcome", value: outcome, onChange: e => setOutcome(e.target.value), style: inputStyle },
          h("option", { value: "pending" }, "Pending"),
          h("option", { value: "success" }, "Success"),
          h("option", { value: "failure" }, "Failure"))),
      h("div", null, h("div", { style: fieldLabelStyle }, "Your PoS (%)"),
        h("input", { type: "number", value: yourPoS, placeholder: "e.g. 40", onChange: e => setYourPoS(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Market-implied PoS (%)"),
        h("input", { type: "number", value: marketImpliedPoS, placeholder: "from Implied PoS above", onChange: e => setMarketImpliedPoS(e.target.value), style: inputStyle })),
    ),
    h("div", { style: { marginBottom: 10 } },
      h("div", { style: fieldLabelStyle }, "Notes"),
      h("textarea", { value: notes, placeholder: "Anything worth remembering about this call.", onChange: e => setNotes(e.target.value), rows: 2, style: { ...inputStyle, resize: "vertical", fontFamily: "var(--sans)" } })
    ),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", {
        onClick: () => { if (!canSave) return; onSave({ catalystLabel: catalystLabel.trim(), catalystDate: catalystDate.trim(), yourPoS: yourPoS === "" ? null : Number(yourPoS), marketImpliedPoS: marketImpliedPoS === "" ? null : Number(marketImpliedPoS), outcome, notes: notes.trim() }); },
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "#101414", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }
      }, saveLabel || "Add"),
      h("button", { onClick: onCancel, style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Cancel")
    )
  );
}

// Brier score — (forecast probability - actual outcome)^2, standard
// calibration-scoring metric. 0 = perfect, 1 = worst possible. forecastPct
// is 0-100 (matching how PoS is entered everywhere else in the app);
// outcome is "success" or "failure". Returns null if not yet resolvable.
function brierScore(forecastPct, outcome) {
  if (forecastPct == null || (outcome !== "success" && outcome !== "failure")) return null;
  const forecast = forecastPct / 100;
  const actual = outcome === "success" ? 1 : 0;
  return Math.pow(forecast - actual, 2);
}

function EvidenceEntryForm({ onSave, onCancel, initialValues, saveLabel }) {
  const h = React.createElement;
  const iv = initialValues || {};
  const [label, setLabel] = React.useState(iv.label || "");
  const [classification, setClassification] = React.useState(iv.classification || "inference");
  const [confidence, setConfidence] = React.useState(iv.confidence || "moderate");
  const [source, setSource] = React.useState(iv.source || "");
  const [date, setDate] = React.useState(iv.date || "");
  const [thesis, setThesis] = React.useState(iv.thesis || "");
  const inputStyle = { width: "100%", padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11 };
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 };
  const canSave = label.trim().length > 0;

  return h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)", marginTop: 8 } },
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 } },
      h("div", null, h("div", { style: fieldLabelStyle }, "What this justifies *"),
        h("input", { type: "text", value: label, placeholder: "e.g. PoS override, peak share", onChange: e => setLabel(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Classification"),
        h("select", { "aria-label": "Classification", value: classification, onChange: e => setClassification(e.target.value), style: inputStyle },
          h("option", { value: "fact" }, "Fact"),
          h("option", { value: "inference" }, "Inference"),
          h("option", { value: "speculation" }, "Speculation"))),
      h("div", null, h("div", { style: fieldLabelStyle }, "Confidence"),
        h("select", { "aria-label": "Confidence", value: confidence, onChange: e => setConfidence(e.target.value), style: inputStyle },
          h("option", { value: "high" }, "High"),
          h("option", { value: "moderate" }, "Moderate"),
          h("option", { value: "low" }, "Low"))),
      h("div", null, h("div", { style: fieldLabelStyle }, "Source"),
        h("input", { type: "text", value: source, placeholder: "URL, filing, DOI, etc.", onChange: e => setSource(e.target.value), style: inputStyle })),
      h("div", null, h("div", { style: fieldLabelStyle }, "Date"),
        h("input", { type: "text", value: date, placeholder: "e.g. 2026-08-17", onChange: e => setDate(e.target.value), style: inputStyle })),
    ),
    h("div", { style: { marginBottom: 10 } },
      h("div", { style: fieldLabelStyle }, "Thesis / notes"),
      h("textarea", { value: thesis, placeholder: "The actual reasoning — what the source supports, and the main uncertainty if this isn't a plain Fact.", onChange: e => setThesis(e.target.value), rows: 3, style: { ...inputStyle, resize: "vertical", fontFamily: "var(--sans)" } })
    ),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", {
        onClick: () => { if (!canSave) return; onSave({ label: label.trim(), classification, confidence, source: source.trim(), date: date.trim(), thesis: thesis.trim() }); },
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "#101414", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }
      }, saveLabel || "Add"),
      h("button", { onClick: onCancel, style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } }, "Cancel")
    )
  );
}

// Appends an auto-generated Evidence Log entry to every program in a case,
// citing a real SEC filing just pulled via EDGAR — captures a sourced
// capital-structure fact at the moment it's actually used in the valuation,
// rather than leaving it to be remembered and typed in manually later (or
// never). Evidence Log is per-program (drug-specific judgment calls), but
// capital structure is case-wide, so this logs to every program the case
// currently has — cash/debt/dilution genuinely affects each program's own
// valuation, not just one. Deduped by (label, source, date) so repeated
// clicks in one sitting don't spam identical entries; a genuine re-check on
// a later date still logs fresh.
function appendEdgarEvidenceToPrograms(programs, edgarResult, contextLabel) {
  if (!edgarResult || !edgarResult.ok || !programs || !programs.length) return programs;
  const today = localDateStamp();
  const source = edgarResult.sourceFilingUrl || (edgarResult.name ? edgarResult.name + " SEC filing" : "SEC EDGAR");
  const label = "Capital structure (EDGAR)";
  const thesis = "Auto-logged: pulled via " + contextLabel + (edgarResult.sourceFilingLabel ? " from " + edgarResult.sourceFilingLabel : "") + ".";
  return programs.map(p => {
    const log = p.evidenceLog || [];
    const alreadyLogged = log.some(e => e.label === label && e.source === source && e.date === today);
    if (alreadyLogged) return p;
    return { ...p, evidenceLog: [...log, { id: newId("ev"), label, classification: "fact", confidence: "high", source, date: today, thesis }] };
  });
}

// Reverse-solve box — companion to the Implied PoS box in ValuationPanel,
// same visual language (amber accent), but lets the user pick which variable
// to solve for via solveImpliedVariable in scenarioEngine.js. Its own small
// component (not inlined like Implied PoS) because it needs local state for
// which variable is selected.
// Monte Carlo box — the capstone feature. Button-triggered rather than
// computed on every render, since thousands of full DCF runs per click is
// meaningfully more expensive than anything else on this panel; running it
// on every keystroke would make the UI feel sluggish for no benefit.
function MonteCarloBox({ theCase, discountRatePct, tv }) {
  const h = React.createElement;
  const [result, setResult] = React.useState(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState(null);

  const run = () => {
    setRunning(true); setError(null);
    setTimeout(() => {
      try {
        const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
        const mc = computeFullCaseMonteCarlo(theCase, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple }, 3000);
        if (!mc.ok) setError(mc.error); else setResult(mc);
      } catch (e) { setError(e.message); }
      setRunning(false);
    }, 10); // yield one tick so the "Running..." state actually paints before the heavy loop blocks the thread
  };

  const fmt = fmtShare;
  // All five bars share one axis that always contains zero, and each bar runs
  // from zero to its value. Scaling by v / P90 (as this once did) drew every
  // negative percentile as a 2% stub and a small positive P90 as the full
  // width — so a distribution centred on -$0.15 looked like it sat at +$0.05.
  const axisLo = result ? Math.min(0, result.percentiles.p10) : 0;
  const axisHi = result ? Math.max(0, result.percentiles.p90) : 1;
  const axisSpan = (axisHi - axisLo) || 1;
  const axisPos = v => ((v - axisLo) / axisSpan) * 100;
  const zeroPct = axisPos(0);
  const barStyle = (v, color) => {
    const a = axisPos(v), left = Math.min(a, zeroPct), width = Math.abs(a - zeroPct);
    return { position: "absolute", top: 0, bottom: 0, left: left + "%", width: "max(3px, " + width + "%)", borderRadius: 3, background: color };
  };

  return h(ExportSection, { title: "Full-case Monte Carlo", style: { marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", border: "1.5px solid var(--teal)" } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "Full-case Monte Carlo"),
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.6 } },
      "3,000 trials, sampling PoS, peak share, and discount rate continuously between your Bear and Bull bounds (Base as the most likely value) instead of only the three fixed points — a full fair-value distribution, not just three scenarios."),
    h("button", { onClick: run, disabled: running,
      style: { padding: "6px 16px", borderRadius: 6, border: "none", background: running ? "var(--rule)" : "var(--teal-fill)", color: "#101414", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: running ? "default" : "pointer" }
    }, running ? "Running…" : result ? "Re-run" : "Run 3,000 trials"),
    error && h("div", { style: { marginTop: 10, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, error),
    result && h("div", { style: { marginTop: 14 } },
      h(ExportableBlock, { title: (theCase.name || "Case") + " — Monte Carlo fair-value distribution" },
      h("div", { style: { display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 } },
        [["P10", result.percentiles.p10], ["P25", result.percentiles.p25], ["P50 (median)", result.percentiles.p50], ["P75", result.percentiles.p75], ["P90", result.percentiles.p90]].map(([label, v]) =>
          h("div", { key: label }, h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, label),
            h("div", { style: { fontSize: 15, fontFamily: "var(--mono)", fontWeight: 700, color: label.startsWith("P50") ? "var(--teal)" : "var(--ink-1)" } }, fmt(v))))
      ),
      [["P10", result.percentiles.p10, "var(--ink-3)"], ["P25", result.percentiles.p25, "var(--amber)"], ["P50", result.percentiles.p50, "var(--teal)"], ["P75", result.percentiles.p75, "var(--amber)"], ["P90", result.percentiles.p90, "var(--ink-3)"]].map(([label, v, color]) =>
        h("div", { key: label, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } },
          h("div", { style: { width: 28, fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, label),
          h("div", { style: { position: "relative", flex: 1, height: 6, borderRadius: 3, background: "var(--surface)" } },
            axisLo < 0 && axisHi > 0 && h("div", { style: { position: "absolute", top: -3, bottom: -3, left: zeroPct + "%", width: 1, background: "var(--ink-3)" } }),
            h("div", { style: barStyle(v, color) })))
      ),
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 2 } },
        h("div", { style: { width: 28 } }),
        h("div", { style: { position: "relative", flex: 1, height: 14, fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
          h("span", { style: { position: "absolute", left: 0 } }, fmt(axisLo)),
          axisLo < 0 && axisHi > 0 && zeroPct > 8 && zeroPct < 92 && h("span", { style: { position: "absolute", left: zeroPct + "%", transform: "translateX(-50%)" } }, "0"),
          h("span", { style: { position: "absolute", right: 0 } }, fmt(axisHi))))
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6 } },
        "Median can differ from the Base-case point estimate above — that's expected, not a discrepancy: discounting is non-linear (a higher rate hurts value more than an equal-sized lower rate helps it), so averaging across a range captures that in a way three fixed points can't."),
      h("div", { style: { marginTop: 12 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } }, "What's driving the spread"),
        result.drivers.map(d => h("div", { key: d.key, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 3 } },
          h("span", null, d.label), h("span", null, (d.correlation >= 0 ? "+" : "") + d.correlation.toFixed(2))))
      )
    )
  );
}

// ── Competitor scan → order-of-entry ────────────────────────────────────────
// The peak-share model keys off "how many drugs are in this market" and "when
// does this one arrive," but until now both were pure guesses typed by hand.
// This reuses the CT.gov competitor search the Tools tab already has, scoped
// to this program's own indication, and counts distinct late-stage
// (Phase 2/3) sponsor+drug pairs — the ones plausibly reaching market — so
// the number has a source behind it. One-click apply, never automatic:
// CT.gov lists trials, not launches, so this is a starting point for a
// judgment call, not the answer.
function CompetitorScanBox({ indication, drugName, currentNumDrugs, onApplyNumDrugs }) {
  const h = React.createElement;
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const scan = async () => {
    if (!indication || !indication.trim()) { setError("Set this program's indication first — that's what gets searched."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await searchCompetitorLandscape(indication.trim(), drugName, 40);
      if (!r.ok) { setError(r.error); }
      else {
        // Late-stage = the phase string mentions 2 or 3. CT.gov returns
        // combined labels like "PHASE1/PHASE2", so substring-match rather
        // than equality, and count each sponsor+drug pair once.
        const lateStage = r.studies.filter(s => {
          const ph = (s.phase || "").toUpperCase();
          return ph.includes("2") || ph.includes("3");
        });
        // INDUSTRY-sponsored only, and this filter is load-bearing rather
        // than cosmetic. Verified against a live NSCLC search: the unfiltered
        // late-stage list returned 20 "competitors" including a Mayo Clinic
        // care-delivery study, a topical steroid for a skin side-effect, and
        // several academic trials of decades-old generic chemo. Counting
        // those as market entrants would have replaced an honest guess with a
        // confidently wrong number — worse than the guess. Academic and
        // cooperative-group trials are real science but they don't launch a
        // competing product and take share, which is the only thing the
        // order-of-entry model is asking about.
        const industry = lateStage.filter(s => (s.sponsorClass || "").toUpperCase() === "INDUSTRY");
        const pairs = [...new Set(industry.map(s => (s.sponsor || "?") + " — " + (s.interventions[0] || s.title)))];
        const excludedNonIndustry = lateStage.length - industry.length;
        setResult({ total: r.studies.length, lateStage: lateStage.length, excludedNonIndustry, pairs, totalCount: r.totalCount });
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const suggested = result ? Math.min(5, result.pairs.length + 1) : null;
  return h("div", { style: { flex: "1 1 100%", marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)" } },
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
      h("button", { onClick: scan, disabled: loading,
        style: { padding: "6px 14px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: loading ? "default" : "pointer" }
      }, loading ? "Scanning…" : "Scan competitors on ClinicalTrials.gov"),
      h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
        indication && indication.trim() ? "Searches: " + indication.trim() : "Set an indication above first")),
    error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 8 } }, error),
    result && h("div", { style: { marginTop: 10, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
      h("div", null, "Found ", h("b", { style: { color: "var(--ink-1)" } }, String(result.pairs.length)),
        " distinct industry-sponsored late-stage (Phase 2/3) sponsor+drug pairs, from ", String(result.total), " trials scanned",
        result.totalCount > result.total ? " (of " + result.totalCount + " matching CT.gov records)" : "", ".",
        result.excludedNonIndustry > 0 && h("span", { style: { color: "var(--ink-3)" } },
          " " + result.excludedNonIndustry + " academic/government-sponsored late-stage trial" + (result.excludedNonIndustry > 1 ? "s" : "") + " excluded — real science, but not a product launching into this market.")),
      result.pairs.length > 0 && h("div", { style: { marginTop: 6, maxHeight: 150, overflowY: "auto", paddingLeft: 10, borderLeft: "2px solid var(--rule)" } },
        result.pairs.slice(0, 12).map((p, i) => h("div", { key: i, style: { fontSize: 10, color: "var(--ink-3)" } }, p)),
        result.pairs.length > 12 && h("div", { style: { fontSize: 10, color: "var(--ink-3)", fontStyle: "italic" } }, "+" + (result.pairs.length - 12) + " more")),
      suggested != null && h("div", { style: { marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        h("span", null, "Implies ", h("b", { style: { color: "var(--amber)" } }, String(suggested)), " drugs at peak (competitors + this one)",
          result.pairs.length + 1 > 5 ? ", capped at the model's max of 5" : ""),
        suggested !== currentNumDrugs && h("button", { onClick: () => onApplyNumDrugs(suggested),
          style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--amber)", background: "transparent", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" }
        }, "Use " + suggested + " →")),
      h("div", { style: { marginTop: 8, fontSize: 10, color: "var(--ink-3)", lineHeight: 1.6 } },
        "CT.gov lists trials, not launches — some of these fail, some never file, and some aren't real competitors for your specific line/subtype. Treat this as a sourced starting point for your own judgment, not the answer."))
  );
}

// ── Calibration catalyst dates ──────────────────────────────────────────────
// The catalyst date is a free-text field on purpose (real catalysts get
// described as "2026-Q4" or "H1 2027" as often as a real date), so parse the
// formats that ARE unambiguous and treat everything else as simply undated
// rather than guessing. An unparseable date is never reported as overdue.
function parseCatalystDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{4})[-\s]?Q([1-4])$/i);
  if (m) return new Date(Number(m[1]), Number(m[2]) * 3, 0); // last day of that quarter
  m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]), 0); // last day of that month
  return null;
}

// Pending calibration predictions across a whole case, split into ones whose
// stated catalyst date has already passed (actionable now) and ones that are
// simply still open. Returns counts plus the program names, so the nudge can
// say something specific instead of a bare number.
function pendingCalibrationEntries(theCase) {
  const now = new Date();
  const overdue = [], open = [];
  (theCase.programs || []).forEach(p => {
    (p.calibrationLog || []).forEach(entry => {
      if (entry.outcome && entry.outcome !== "pending") return;
      const d = parseCatalystDate(entry.catalystDate);
      const row = { programName: p.drugName || p.name || "Program", catalystLabel: entry.catalystLabel, catalystDate: entry.catalystDate };
      if (d && d < now) overdue.push(row); else open.push(row);
    });
  });
  return { overdue, open };
}

// ── Runway vs. catalyst crossover ──────────────────────────────────────────
// The most common way a retail biotech thesis breaks isn't the science — it's
// buying into a catalyst without noticing the company must finance BEFORE the
// readout. The app already had both halves and never crossed them: runway
// comes from computeForwardRunway (the case's own modeled burn), catalyst
// dates come from each program's calibration log. This joins them.
//
// Split into a pure classifier plus a case-gathering wrapper on purpose: the
// judgment (funded / tight / gap) is the part worth testing, and testing it
// shouldn't require constructing a whole valuation case.
//
// A "cushion" is not decoration. A company cannot realistically raise on
// fumes — financing gets arranged months ahead, and a raise negotiated with
// almost no cash left is negotiated from the weakest possible position. So
// "runway technically reaches the readout" and "funded through the readout"
// are different claims, and this reports them differently.
const RUNWAY_CUSHION_MONTHS_DEFAULT = 6;

function classifyCatalystFunding(runwayMonths, catalysts, cushionMonths) {
  const cushion = cushionMonths == null ? RUNWAY_CUSHION_MONTHS_DEFAULT : cushionMonths;
  // Infinity is a REAL, valid answer here, not a failure: a case whose modeled
  // cash flow turns positive before the cash runs out never has a runway "end"
  // at all. computeForwardRunway reports that as null, which is the same value
  // it reports for genuinely missing inputs — conflating the two told a fully
  // funded company it was misconfigured. The caller disambiguates and passes
  // Infinity for the funded case; only a truly unknown runway errors here.
  if (runwayMonths == null || Number.isNaN(runwayMonths)) {
    return { ok: false, error: "No runway figure available — set starting cash and a cost model on the case first." };
  }
  const beyondHorizon = !isFinite(runwayMonths);
  const rows = (catalysts || [])
    .filter(c => c && isFinite(c.monthsAway))
    .map(c => {
      const cushionAtCatalyst = runwayMonths - c.monthsAway;   // months of cash left when it reads out
      let status;
      if (cushionAtCatalyst < 0) status = "gap";               // runs out BEFORE the readout
      else if (cushionAtCatalyst < cushion) status = "tight";  // reaches it, but on fumes
      else status = "funded";
      return { ...c, cushionAtCatalyst, status };
    })
    .sort((a, b) => a.monthsAway - b.monthsAway);

  const gaps = rows.filter(r => r.status === "gap");
  const tights = rows.filter(r => r.status === "tight");
  // The binding constraint is the EARLIEST catalyst that isn't comfortably
  // funded — that's the one that forces a raise, regardless of what follows.
  const firstProblem = rows.find(r => r.status !== "funded") || null;
  return {
    ok: true, runwayMonths, beyondHorizon, cushionMonths: cushion, rows,
    gapCount: gaps.length, tightCount: tights.length, fundedCount: rows.length - gaps.length - tights.length,
    firstProblem
  };
}

// Months from `from` to `to`, fractional. Uses average month length rather
// than calendar-month stepping — this feeds a runway comparison that is itself
// an approximation, and false calendar precision would imply accuracy the
// underlying burn estimate doesn't have.
function monthsUntil(from, to) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function computeRunwayVsCatalysts(theCase, opts) {
  const o = opts || {};
  const now = o.now || new Date();
  let runwayMonths = o.runwayMonthsOverride;
  if (runwayMonths == null) {
    try {
      const fr = computeForwardRunway(theCase);
      // null from computeForwardRunway is ambiguous — it means "balance never
      // crossed zero in the 25-year window", which is either "no cash modelled
      // at all" or "turns cash-flow positive and never runs out". Starting cash
      // is what separates them.
      runwayMonths = fr.runwayMonths != null ? fr.runwayMonths
        : (fr.startingCash > 0 ? Infinity : null);
    } catch (e) { runwayMonths = null; }
  }
  const catalysts = [];
  (theCase && theCase.programs ? theCase.programs : []).forEach(p => {
    (p.calibrationLog || []).forEach(entry => {
      if (entry.outcome && entry.outcome !== "pending") return; // already read out
      const d = parseCatalystDate(entry.catalystDate);
      if (!d) return;                                            // undated stays out, never guessed
      catalysts.push({
        programName: p.drugName || p.name || "Program",
        label: entry.catalystLabel || "Catalyst",
        dateText: entry.catalystDate,
        monthsAway: monthsUntil(now, d)
      });
    });
  });
  const undatedCount = (theCase && theCase.programs ? theCase.programs : []).reduce((n, p) =>
    n + (p.calibrationLog || []).filter(e => (!e.outcome || e.outcome === "pending") && !parseCatalystDate(e.catalystDate)).length, 0);

  const result = classifyCatalystFunding(runwayMonths, catalysts, o.cushionMonths);
  return { ...result, undatedCount };
}

// ── Binary-event implied probability ───────────────────────────────────────
// A biotech trading into a single binary readout is, to a first approximation,
// a two-outcome bet. If the market cap sits between what the company is worth
// on success and what it's worth on failure, then today's price implies a
// probability — solvable exactly, no model required:
//
//     current = p x success + (1 - p) x fail
//         =>  p = (current - fail) / (success - fail)
//
// This is the mirror of the app's existing full-case implied-PoS solver, which
// binary-searches a whole DCF against the market cap. That one is more complete
// and needs a built case; this one needs three numbers and works as a screen.
// Both answer "what does the market already believe", which is the number worth
// having an opinion against.
function computeBinaryEventImpliedPoS(inputs) {
  const current = Number(inputs.currentValue);
  const success = Number(inputs.successValue);
  const fail = Number(inputs.failValue);
  if (![current, success, fail].every(v => isFinite(v))) {
    return { ok: false, error: "Enter current, success-case and failure-case values." };
  }
  if (success <= fail) {
    return { ok: false, error: "The success case has to be worth more than the failure case — otherwise there's no bet to price." };
  }
  if (current <= 0) return { ok: false, error: "Current value must be greater than zero." };

  const impliedPoS = (current - fail) / (success - fail);
  // An implied probability outside [0,1] is not an error to clamp away — it is
  // the single most interesting output this tool produces, because it means the
  // market disagrees with one of your two anchors rather than with your odds.
  let rangeFlag = null;
  if (impliedPoS < 0) rangeFlag = "belowFailure";
  else if (impliedPoS > 1) rangeFlag = "aboveSuccess";

  const upsidePct = ((success - current) / current) * 100;
  const downsidePct = ((fail - current) / current) * 100;
  const riskReward = downsidePct !== 0 ? Math.abs(upsidePct / downsidePct) : null;

  const out = {
    ok: true, impliedPoS, impliedPoSPct: impliedPoS * 100, rangeFlag,
    upsidePct, downsidePct, riskReward, current, success, fail
  };

  const yourPct = inputs.yourPoSPct === "" || inputs.yourPoSPct == null ? null : Number(inputs.yourPoSPct);
  if (yourPct != null && isFinite(yourPct) && yourPct >= 0 && yourPct <= 100) {
    const yp = yourPct / 100;
    const expectedValue = yp * success + (1 - yp) * fail;
    out.yourPoSPct = yourPct;
    out.expectedValue = expectedValue;
    out.evVsCurrentPct = ((expectedValue - current) / current) * 100;
    out.edgePoSPct = yourPct - impliedPoS * 100;   // positive = you're more optimistic than the market
  }
  return out;
}

// ── Which inputs each valuation method actually reads ──────────────────────
// Simple Multiple values peak revenue directly, so a whole set of inputs the
// DCF depends on are read by nothing at all in that mode. They were still
// shown and fully editable, which meant you could spend real effort tuning a
// COGS percentage that never touched the number.
//
// Derived by reading computeSimpleMultipleValuation directly rather than by
// assumption, and kept in ONE place so the UI gating can't drift from what the
// engine really does. Note the deliberate asymmetry on R&D: the stage timeline
// IS used (it sets how far back the value gets discounted, via
// resolveLaunchYearOffset) while the per-stage COSTS are not — so the R&D
// section stays visible with its cost fields marked, rather than being hidden
// wholesale.
const VALUATION_METHOD_USAGE = {
  dcf: { ignores: [] },
  multiple: {
    ignores: ["costStructure", "rndCost", "corporateGA", "terminalValue", "taxation"],
    uses: ["peakRevenue", "yearsToPeak", "rndTimeline", "pos", "capitalStructure", "financing", "discountRate", "multiple"]
  }
};

function methodIgnores(valuationMethod, key) {
  const m = VALUATION_METHOD_USAGE[valuationMethod || "dcf"] || VALUATION_METHOD_USAGE.dcf;
  return (m.ignores || []).indexOf(key) !== -1;
}

// Compact banner marking a section the active method does not read. Says what
// to switch to rather than just greying something out with no explanation.
function NotUsedInThisMode({ what, compact }) {
  const h = React.createElement;
  return h("div", {
    style: {
      display: "flex", gap: 8, alignItems: "flex-start",
      padding: compact ? "7px 10px" : "10px 12px", borderRadius: 7,
      background: "var(--surface-2)", border: "1px dashed var(--rule)",
      fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
      lineHeight: 1.55, marginBottom: 10
    }
  },
    h("span", { style: { color: "var(--amber)", flexShrink: 0 } }, "◇"),
    h("span", null, what || "This section", " is not used while Simple Multiple is the valuation method — that method values peak revenue directly and never builds a year-by-year cash flow. Switch to DCF to make it count."));
}

// ── Workspace section navigation ───────────────────────────────────────────
// A populated two-program case runs about six screens of continuous scroll in
// Quick mode, and considerably more in Detailed — measured, not estimated.
// Nothing was wrong with that layout (it has no overflow at any supported
// width), but there was no way to get from the revenue rollup to the EV bridge
// except by scrolling past everything in between, and no way to tell where you
// were once you had.
//
// This is a jump bar rather than a restructure on purpose: the single-document
// flow is right for a valuation model — you want to scroll through the whole
// thing while iterating — so the fix is making that document navigable, not
// chopping it into tabs that hide half the model from you.
//
// Uses the same chip visual language as the Tools and Simulation tab rows, so
// it reads as an existing pattern rather than a new one to learn.
const WORKSPACE_NAV_OFFSET = 54 + 44; // app header (54) + this bar's own height

function WorkspaceNav({ sections }) {
  const h = React.createElement;
  const [activeId, setActiveId] = React.useState(sections.length ? sections[0].id : null);
  const visible = sections.filter(s => s && s.id);

  // Scroll-spy: which section "owns" the highlight. Previously an
  // IntersectionObserver with a rootMargin band covering roughly the top 45%
  // of the viewport — that had two real bugs, both reported as "buggy and
  // hit or miss":
  //   1. A short section (ws-programs is a ~32px tab strip) can pass through
  //      that band without ever registering, or exit it once you've scrolled
  //      past it — at which point NOTHING is intersecting, the observer stops
  //      firing, and the highlight goes stale on whatever was active before.
  //      This is exactly why the last button in the bar tended to "not work."
  //   2. jump() below sets activeId immediately, then starts a smooth scroll —
  //      but the observer keeps firing DURING that animation and overwrites
  //      the click with whatever section happens to be passing by mid-flight.
  // Replaced with a direct position check instead of intersection bands: the
  // active section is simply the last one whose top has scrolled above the
  // offset line, computed on scroll (rAF-throttled). No band to fall out of,
  // and it's suppressed entirely while a programmatic jump is in flight (see
  // jumpingRef below), which removes the race at its source rather than
  // trying to win it.
  const jumpingRef = React.useRef(false);
  React.useEffect(() => {
    const els = visible.map(s => ({ id: s.id, el: document.getElementById(s.id) })).filter(s => s.el);
    if (!els.length) return;
    const line = WORKSPACE_NAV_OFFSET + 1;
    let ticking = false;
    const update = () => {
      ticking = false;
      if (jumpingRef.current) return;
      let current = els[0].id;
      for (const s of els) { if (s.el.getBoundingClientRect().top <= line) current = s.id; }
      setActiveId(current);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [visible.map(s => s.id).join(",")]);

  const jump = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    jumpingRef.current = true;
    setActiveId(id);
    const y = el.getBoundingClientRect().top + window.scrollY - WORKSPACE_NAV_OFFSET;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    // Re-enable the scroll-spy once the smooth scroll has actually settled,
    // rather than guessing a fixed delay — a jump of 200px and one of 4000px
    // take very different amounts of time. Polls scrollY via rAF and treats
    // a few consecutive unchanged frames as "done"; a hard cap guards against
    // never re-enabling if something (a resize, another scroll) interrupts it.
    let lastY = window.scrollY, stableFrames = 0, elapsed = 0;
    const checkSettled = () => {
      elapsed++;
      if (window.scrollY === lastY) { stableFrames++; } else { stableFrames = 0; lastY = window.scrollY; }
      if (stableFrames > 4 || elapsed > 120) { jumpingRef.current = false; return; }
      requestAnimationFrame(checkSettled);
    };
    requestAnimationFrame(checkSettled);
  };

  if (visible.length < 2) return null;
  return h("div", { className: "no-print", style: {
      position: "sticky", top: 54, zIndex: 9, marginBottom: 16,
      background: "var(--bg)", borderBottom: "1px solid var(--rule)",
      padding: "9px 0", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center"
    } },
    h("span", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 } }, "Jump to"),
    visible.map(s => h("button", {
      key: s.id, onClick: () => jump(s.id),
      style: {
        padding: "4px 11px", borderRadius: 6,
        border: "1px solid " + (activeId === s.id ? "var(--teal)" : "var(--rule)"),
        background: activeId === s.id ? "var(--teal-bg)" : "transparent",
        color: activeId === s.id ? "var(--teal)" : "var(--ink-2)",
        fontFamily: "var(--mono)", fontSize: 11, fontWeight: activeId === s.id ? 700 : 400,
        cursor: "pointer", transition: "color 120ms, border-color 120ms, background 120ms"
      }
    }, s.label))
  );
}

// Wraps a chart. Its row exports the chart alone (titled); the enclosing
// section's row exports the whole card, chart included — either or both.
function ExportableBlock({ title, style, children }) {
  // A chart block: the chart plus its own "Export chart" row, so a chart can
  // be taken out on its own (with its title) as well as inside its section.
  // The section's bar still exports everything, chart included.
  const h = React.createElement;
  const ref = React.useRef(null);
  // A screen reader announces a bare <svg> as "graphic"; the block's title is
  // the chart's name, so give it to any chart inside that has none better.
  React.useEffect(() => {
    if (!ref.current || !title) return;
    ref.current.querySelectorAll("svg").forEach(s => {
      if (s.getAttribute("data-titled") === "1" || (s.getBoundingClientRect().width || 0) < 120 && s.getBoundingClientRect().width !== 0) return;
      s.setAttribute("role", "img"); s.setAttribute("aria-label", title); s.setAttribute("data-titled", "1");
    });
  });
  return h("div", { ref, "data-export-chart": title || "", style: style || null },
    children, h(ChartExportBar, { title }));
}

function ReverseSolveBox({ theCase, discountRatePct, tv, options }) {
  const h = React.createElement;
  const [variable, setVariable] = React.useState(options[0].key);
  const caseLabel = theCase.name || "This case";

  let solved = null, solveError = null;
  try {
    const drBase = discountRatePct !== "" ? Number(discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    solved = solveImpliedVariable(theCase, drBase, { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple }, variable);
  } catch (e) { solveError = e.message; }

  // Money in the same compact form as every other figure on the panel: an
  // eleven-digit "$14,417,500,064" is easy to misread by a factor of ten.
  const fmtVal = (v, suffix) => suffix === "$" ? fmtMoney(v) : v.toFixed(suffix === "yr" ? 0 : 1) + suffix;

  return h(ExportSection, { title: "What else " + caseLabel + "'s price implies", style: { marginTop: 16, padding: "14px 16px", borderRadius: 10, background: "var(--amber-bg)", border: "1.5px solid var(--amber)" } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "What else " + caseLabel + "'s price implies"),
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10 } }, "Same idea as Implied PoS above, holding every other assumption fixed and solving for this one instead."),
    options.length > 1 && h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
      options.map(o => h("button", {
        key: o.key, onClick: () => setVariable(o.key),
        style: { padding: "4px 10px", borderRadius: 6, border: "1px solid " + (variable === o.key ? "var(--amber)" : "var(--rule)"), background: variable === o.key ? "var(--amber)" : "transparent", color: variable === o.key ? "#101414" : "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, cursor: "pointer" }
      }, o.label))
    ),
    solveError || !solved ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Couldn't solve: " + (solveError || "unknown error"))
    : !solved.ok ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, solved.error)
    : h("div", null,
        h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
          h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Your assumption"),
            h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, fmtVal(solved.currentValue, solved.suffix))),
          h("div", null,
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase" } }, "Market implies"),
            h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, fmtVal(solved.impliedValue, solved.suffix)))
        ),
        solved.degenerate && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.5 } }, solved.note)
      )
  );
}

// Small "include this in the PDF report" checkbox, reused across Tools
// charts. Stores a flag on the selected case itself (theCase.reportInclusions),
// not separate app state — so it persists the same way everything else does,
// and the report only needs to read the case it's already rendering.
function IncludeInReportToggle({ theCase, updateCase, reportKey, label }) {
  const h = React.createElement;
  if (!theCase) return null;
  const included = !!(theCase.reportInclusions && theCase.reportInclusions[reportKey]);
  const toggle = () => {
    const reportInclusions = { ...(theCase.reportInclusions || {}), [reportKey]: !included };
    updateCase({ ...theCase, reportInclusions, updatedAt: Date.now() });
  };
  return h("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--mono)", color: included ? "var(--teal)" : "var(--ink-2)", cursor: "pointer" } },
    h("input", { type: "checkbox", checked: included, onChange: toggle }),
    label || "Include in PDF report"
  );
}

// ── Error boundary — the one class component in an otherwise all-functional
// codebase, because React only supports catching render errors via
// getDerivedStateFromError/componentDidCatch, neither of which exists for
// hooks. Wraps the current view's content in app.js (not the whole app, and
// specifically not the top nav bar) so a crash in one view's render — a
// malformed case, a future bug this doesn't yet know about — fails that one
// view in place rather than white-screening the entire application. The nav
// bar staying outside this boundary means the user can always click to a
// different, working view without reloading.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Logged, not swallowed — the goal is graceful degradation, not hiding
    // that something broke. A future crash-telemetry hook would attach here.
    console.error("RxNPV failed to render:", error, info && info.componentStack);
  }
  render() {
    const h = React.createElement;
    if (this.state.error) {
      // "outer" = this boundary wraps the whole App component from outside
      // (the last-resort catch for a crash in App's own render code, e.g.
      // the case-list sidebar — nothing else could have caught it). In that
      // case the nav bar is gone too, so "switch tabs" would be wrong
      // advice; a reload is the only real recovery path, and is safe here
      // since all case data lives in localStorage, not React state.
      const isOuter = this.props.mode === "outer";
      return h("div", { style: { padding: "48px 32px", maxWidth: 620, margin: "0 auto" } },
        h("div", { style: { fontSize: 16, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 10 } },
          isOuter ? "RxNPV hit a problem and couldn't render." : "This view hit a problem and couldn't render."),
        h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 16 } },
          isOuter
            ? "Your saved cases are safe — they live on this device independently of this screen. Reloading is the way to recover from here."
            : "Nothing else is affected — the rest of the app, including your other cases and saved data, is fine. Switch to another tab above to keep working. If it's a specific case causing this, opening a different one first, then coming back, often narrows it down."),
        isOuter && h("button", { onClick: () => window.location.reload(),
          style: { padding: "8px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 16 } }, "Reload"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" } },
          String((this.state.error && this.state.error.message) || this.state.error))
      );
    }
    return this.props.children;
  }
}
