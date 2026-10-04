// ════════════════════════════════════════════════════════════════════════════
// Shared UI primitives + lookup helpers
// ════════════════════════════════════════════════════════════════════════════
let _idCounter = 1;
function newId(prefix) { return (prefix || "id") + "_" + (Date.now().toString(36)) + "_" + (_idCounter++); }

// Style objects repeated across the React views. Identical to the inline
// objects they replaced; extend with a spread ({ ...UI.caption, marginTop: 8 }).
const UI = {
  caption: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" },
  captionMd: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)" },
  intro: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.6 },
  fieldLabel: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 5 },
  input: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 },
  warnNote: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)", lineHeight: 1.6 },
  stat: { fontSize: 18, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-1)" },
};

// "Stoke's", but "Biologics'" — for case names shown in running text.
function possessive(name) { name = String(name || ""); return /s$/i.test(name) ? name + "'" : name + "'s"; }
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
// "$1,200.50" -> "1200.50"; null when what is left is not a number.
function cleanPastedNumber(text) {
  if (text == null) return null;
  const clean = String(text).replace(/[$,\s]/g, "");
  return clean !== "" && isFinite(Number(clean)) ? clean : null;
}

function BenchField({ label, value, onChange, bench, suffix, placeholder, step, type, help, wide, onFocus, onBlur }) {
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
        onFocus, onBlur,
        // A number input rejects "$1,200.50" outright, so a figure copied
        // from a filing used to vanish with nothing said. Clean it; leave
        // plain numbers and real text to the browser.
        onPaste: (type || "number") === "number" ? (e => {
          const text = e.clipboardData && e.clipboardData.getData("text");
          const clean = cleanPastedNumber(text);
          if (clean != null && clean !== String(text).trim()) { e.preventDefault(); onChange(clean); }
        }) : undefined,
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
    // One line: the benchmark value and the start of its source. The full
    // source shows on hover (title), when the benchmark chip has keyboard
    // focus, and always in exports and the report (see .bench-line in
    // shell.html) — sources that wrapped to three or four lines under every
    // field were most of the Assumptions tab's noise.
    bench && h("div", { className: "bench-line", title: "Benchmark: " + bench.value + (suffix || "") + " · " + bench.source, style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
      "Benchmark: ",
      h("button", {
        onClick: () => onChange(String(bench.value)),
        title: "Use the benchmark value",
        // Vertical padding + negative margin enlarges the clickable area
        // without changing where the text sits on the line — this is an
        // inline chip inside a sentence, so it can't just be made bigger,
        // but at 18x13 it was a genuinely fiddly target.
        style: { background: "none", border: "none", color: "var(--amber)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer", padding: "6px 3px", margin: "-6px -3px", minWidth: 24, display: "inline-block", textAlign: "center", fontWeight: 700, textDecoration: "underline" }
      }, (typeof bench.value === "number" ? bench.value : bench.value) + (suffix || "")),
      h("span", { style: { color: "var(--ink-3)" } }, " · " + bench.source)
    ),
    help && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 3 } }, help)
  );
}

// ── Tools start from the open case ──────────────────────────────────────────
// What a tool can start from when a case is open: the lead program's drug,
// indication, trials and target, and the company's ticker and price. Only
// ever a starting value — the user can type over any of it.
function caseToolDefaults(theCase) {
  if (!theCase) return {};
  const p = (theCase.programs || [])[0] || {};
  const ids = String(p.trialIds || "").toUpperCase().match(/NCT\d{8}/g) || [];
  const onMarket = p.currentPhase === "approved" || p.currentPhase === "filed";
  return {
    drugName: (p.drugName || "").trim(),
    indication: String(p.indication || "").split(/[—(,;]/)[0].trim(),
    nctIds: ids.filter((x, i) => ids.indexOf(x) === i), leadNct: ids[0] || "",
    target: String(p.target || "").trim().toUpperCase(),
    company: (theCase.ticker || theCase.name || "").trim(),
    price: theCase.currentPrice != null ? String(theCase.currentPrice) : "",
    // Tools that read a drug's sales, label or patents only have anything to
    // find once it is on the market.
    marketedDrug: onMarket ? (p.drugName || "").trim() : ""
  };
}
// Fills a tool's field from the open case: when the case opens or changes,
// the field takes the case's value — unless the user has typed their own.
// `replaceable` is a built-in example value that counts as not typed.
// Returns true while the field still holds the case's value.
function useCasePrefill(activeCase, caseValue, value, setValue, replaceable) {
  const last = React.useRef(null);
  const cv = caseValue == null ? "" : String(caseValue);
  React.useEffect(() => {
    const untouched = value === "" || value === last.current || (replaceable != null && value === replaceable);
    if (untouched && cv !== "") setValue(cv);
    else if (untouched && cv === "" && last.current && value === last.current) setValue(replaceable != null ? replaceable : "");
    last.current = cv;
  }, [activeCase ? activeCase.id : "", cv]);
  return cv !== "" && value === cv;
}
// The binary-event view of a case: today's price, what a share is worth if
// the drug is approved (literal 100% odds on Base inputs, as the Overview's
// range strip), what is left if the next readout fails (computeFailureFloor)
// and the case's own odds of launch. Single-program DCF cases only; anything
// it cannot compute honestly comes back blank.
function caseBinaryDefaults(theCase) {
  const out = { price: "", success: "", fail: "", pos: "" };
  if (!theCase || !theCase.programs || theCase.programs.length !== 1 || (theCase.valuationMethod || "dcf") !== "dcf") return out;
  try {
    const dr = theCase.discountRatePct !== "" && theCase.discountRatePct != null ? Number(theCase.discountRatePct) : DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView[0];
    const tv = theCase.terminalValue || { enabled: false };
    const tvp = { enabled: tv.enabled, method: tv.method, growthPct: tv.growthPct, exitMultiple: tv.exitMultiple };
    const p = theCase.programs[0];
    const base = computeCaseValuation(theCase, getEffectiveScenarioPreset(theCase, "base"), "base", dr, tvp);
    const win = computeCaseValuation({ ...theCase, programs: [{ ...p, posOverridePct: "100" }] }, SCENARIO_PRESETS.base, "base", dr, tvp).equity.perShare;
    const fl = computeFailureFloor(theCase);
    const pos = base.programVals && base.programVals[0] ? base.programVals[0].posToLaunch * 100 : null;
    if (theCase.currentPrice !== "" && theCase.currentPrice != null) out.price = String(theCase.currentPrice);
    if (win != null && isFinite(win)) out.success = win.toFixed(2);
    if (fl) out.fail = fl.perShare.toFixed(2);
    if (pos != null && pos < 99.99) out.pos = String(Math.round(pos * 10) / 10);
  } catch (e) { /* blank is the honest answer */ }
  return out;
}

// One line under a tool's inputs saying which of them came from the case.
// A case's label with its ticker — unless the name already carries it
// ("PepGen (PEPG)" read "PepGen (PEPG) (PEPG)").
function caseDisplayName(c) {
  if (!c) return "";
  const name = c.name || "Untitled";
  return c.ticker && name.indexOf(c.ticker) === -1 ? name + " (" + c.ticker + ")" : name;
}

function CaseFilledNote({ activeCase, filled }) {
  const h = React.createElement;
  const list = (filled || []).filter(Boolean);
  if (!activeCase || !list.length) return null;
  // Short: the case's name is already in the "Working in" bar above, and
  // this note appears under several inputs on some tools. The full sentence
  // is the hover text.
  return h("div", { className: "case-filled", "data-no-export": "", title: "Started from " + activeCase.name + ": " + list.join(", ") + ". Type over any of it to use your own." },
    "From the case: " + list.join(", ") + ".");
}

// ── Working in: the case every tool and simulation is tuned to ─────────────
// Top of Tools and Simulation. Switching here switches the app's open case
// (the same one the Workspace shows), so there is exactly one "current case"
// everywhere. Reference material and Portfolio are case-independent and do
// not carry it.
function CaseContextBar({ cases, activeCase, onSelectCase, onOpenWorkspace }) {
  const h = React.createElement;
  if (!cases || !cases.length) {
    return h("div", { className: "case-bar empty", role: "region", "aria-label": "Working in" },
      h("span", null, "No case open — tools start blank. Create a case or load the sample in Workspace and every tool here will work in it."),
      onOpenWorkspace && h("button", { type: "button", className: "link-btn", onClick: onOpenWorkspace }, "Go to Workspace →"));
  }
  const p = activeCase && activeCase.programs && activeCase.programs[0];
  const facts = activeCase ? [
    p && (p.drugName || p.name),
    p && p.indication && p.indication.split(/[—(]/)[0].trim(),
    p && p.currentPhase && p.currentPhase.replace("phase", "Phase ").replace("approved", "Approved").replace("filed", "Filed"),
    activeCase.programs.length > 1 ? activeCase.programs.length + " programs" : null,
    activeCase.ticker ? activeCase.ticker + (activeCase.currentPrice ? " " + fmtShare(Number(activeCase.currentPrice)) : "") : null
  ].filter(Boolean) : [];
  return h("div", { className: "case-bar", role: "region", "aria-label": "Working in" },
    h("span", { className: "case-bar-label" }, "Working in"),
    h("select", { value: activeCase ? activeCase.id : "", "aria-label": "Case these tools work in", onChange: e => onSelectCase && onSelectCase(e.target.value) },
      cases.map(c => h("option", { key: c.id, value: c.id }, caseDisplayName(c)))),
    facts.length > 0 && h("span", { className: "case-bar-facts" }, facts.join(" · ")),
    onOpenWorkspace && h("button", { type: "button", className: "link-btn case-bar-open", onClick: onOpenWorkspace }, "Open in Workspace →"));
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

// ── Saving a tool's work into the case ────────────────────────────────────
// A saved item is the same snapshot "+ Report" stores (theCase.pinnedResults),
// plus `reopen`: which tool or simulation it came from and the inputs as they
// were, so it can be opened again exactly as left. "Save to case" stores it
// out of the report (included: false); "+ Report" stores it in. One list, so a
// saved analysis is always one tick away from the PDF.
// Inputs are keyed by id where the element has one (the Simulation side) and
// by aria-label otherwise (the React tools); anything keyed neither way is
// skipped rather than guessed at.
function captureSectionInputs(root) {
  if (!root) return [];
  const out = [];
  root.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.closest("[data-no-export]") || el.type === "file" || el.type === "button") return;
    const id = el.id && !/^xm-/.test(el.id) ? el.id : null;
    const label = el.getAttribute("aria-label");
    if (!id && !label) return;
    out.push({ id: id || undefined, label: id ? undefined : label, value: el.type === "checkbox" ? undefined : el.value, checked: el.type === "checkbox" ? el.checked : undefined });
  });
  return out.slice(0, 200);
}
function applySavedInputs(container, inputs) {
  if (!container || !inputs) return 0;
  let n = 0;
  inputs.forEach(f => {
    const el = f.id ? container.querySelector("#" + CSS.escape(f.id)) : Array.prototype.find.call(container.querySelectorAll("input, select, textarea"), e => e.getAttribute("aria-label") === f.label);
    if (!el || el.disabled) return;
    if (el.type === "checkbox") { if (f.checked != null && el.checked !== f.checked) { el.click(); n++; } return; }
    if (f.value == null || el.value === f.value) return;
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, f.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    n++;
  });
  return n;
}
// Where a section lives, for reopening it: a Tools tool (by id) or a
// Simulation tab. Workspace sections are the case itself and need no reopen.
function reopenInfoFor(block) {
  let n = block;
  while (n && n.getAttribute) {
    const v = n.getAttribute("data-view");
    if (v === "tools") {
      const t = n.getAttribute("data-tool-id");
      return t ? { view: "tools", tool: t, inputs: captureSectionInputs(block) } : null;
    }
    if (v === "simulation") {
      const tab = typeof activeTab !== "undefined" ? activeTab : null;
      return tab ? { view: "simulation", simTab: tab, simSub: tab === "trialStats" && typeof activeStatsSubtab !== "undefined" ? activeStatsSubtab : null, inputs: captureSectionInputs(block) } : null;
    }
    n = n.parentNode;
  }
  return null;
}

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
    // A section's bar sits in the section's top-right corner (shell.html);
    // the section's first row keeps exactly this much room clear for it, so
    // a title or a header control never runs underneath. Unmeasured (a hidden
    // tab), the CSS falls back to a fixed reservation.
    if (!isChart && b && ref.current) {
      const w = Math.ceil(ref.current.getBoundingClientRect().width);
      if (w > 0) b.style.setProperty("--xbar-pad", (w + 14) + "px");
      // Inset by the section's own padding, so on a padded card the button
      // lines up with the title rather than hugging the border.
      const cs = getComputedStyle(b);
      b.style.setProperty("--xbar-top", (parseFloat(cs.paddingTop) || 0) + "px");
      b.style.setProperty("--xbar-right", (parseFloat(cs.paddingRight) || 0) + "px");
    }
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
        ? { tone: "ok", text: "Removed from " + possessive(live.name || "case") + " report" }
        : { tone: "ok", text: "In " + possessive(live.name || "case") + " report", caseId: live.id }, 7000);
      return;
    }
    const existing = pinnedResultsOf(live).filter(p => !isWorkedExample(p));
    if (existing.length >= PINNED_MAX_PER_CASE_V2) {
      flash({ tone: "err", text: possessive(live.name || "This case") + " report already holds " + PINNED_MAX_PER_CASE_V2 + " added items — remove one there first.", caseId: live.id }, 8000);
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
    const reopen = reopenInfoFor(b);
    src2.updateCase({ ...fresh, pinnedResults: pinnedResultsOf(fresh).concat([reopen ? { ...r.pin, reopen } : r.pin]), updatedAt: Date.now() });
    flash({ tone: "ok", text: "Added to " + possessive(fresh.name || "case") + " report", caseId: fresh.id }, 9000);
  };

  // "Save to case": the same snapshot, kept in the case's Saved tab and out of
  // the report until ticked in. Offered only in Tools and Simulation — a
  // Workspace section is the case already.
  const savable = (() => { let n = ref.current; while (n && n.getAttribute) { const v = n.getAttribute("data-view"); if (v) return v === "tools" || v === "simulation"; n = n.parentNode; } return false; })();
  const doSave = async () => {
    const src = liveSource();
    const live = src && (src.cases || []).find(c => c.id === targetId);
    if (!src || !live) return;
    if (pinnedResultsOf(live).filter(p => !isWorkedExample(p)).length >= PINNED_MAX_PER_CASE_V2) {
      flash({ tone: "err", text: possessive(live.name || "This case") + " saved items are full (" + PINNED_MAX_PER_CASE_V2 + ") — remove one from its Saved tab first." }, 8000);
      return;
    }
    const b = block();
    setBusy("save");
    const r = await buildSectionSnapshot(b, { title: blockTitle(), source: source || exportContextOf(b), heading: isChart && heading !== false ? blockTitle() : null });
    setBusy(null);
    if (!r.ok) { flash({ tone: "err", text: r.error }, 6000); return; }
    if (r.pin.html.length > SNAPSHOT_MAX_STORED_BYTES) {
      flash({ tone: "err", text: "That " + noun + " is too large to save (" + Math.round(r.pin.html.length / 1024) + "KB). Export it as a PDF instead." }, 8000);
      return;
    }
    const src2 = liveSource();
    const fresh = (src2.cases || []).find(c => c.id === targetId) || live;
    const reopen = reopenInfoFor(b);
    src2.updateCase({ ...fresh, pinnedResults: pinnedResultsOf(fresh).concat([{ ...r.pin, included: false, savedTo: "case", reopen: reopen || undefined }]), updatedAt: Date.now() });
    flash({ tone: "ok", text: "Saved to " + (fresh.name || "the case") + " — see its Saved tab" }, 9000);
  };

  const btn = (text, kind, onClick, tip, extra) => h("button", Object.assign({
    key: kind, type: "button", title: tip, disabled: busy != null, onClick
  }, extra || {}), busy === kind ? "…" : text);

  const noCase = !cases.length;
  // One compact "Export" button per section / chart that opens a menu holding
  // EVERY option the old always-visible row had — PNG, PDF, SVG, + Report /
  // ✓ In report, + Bundle, the case picker — so nothing is lost; only the
  // repeated rows (10-20 per Workspace screen) are gone. The menu stays in the
  // DOM while closed (display: none) so tests and harnesses that press these
  // buttons directly keep working unchanged.
  const [open, setOpen] = React.useState(false);
  const [openUp, setOpenUp] = React.useState(false);
  const menuId = React.useRef("xm-" + Math.random().toString(36).slice(2, 9)).current;
  const trigRef = React.useRef(null), menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const first = menuRef.current && menuRef.current.querySelector("button:not([disabled])");
    if (first) first.focus();
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); if (trigRef.current) trigRef.current.focus(); } };
    document.addEventListener("mousedown", onDown); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  // A chart inside a section no longer shows its own "Export chart" button —
  // two stacked buttons per chart was most of the Overview's clutter. Its
  // menu stays (same buttons, same place), opened from the section's menu,
  // which lists the charts it holds under "Just one chart".
  const [inSection, setInSection] = React.useState(false);
  const [charts, setCharts] = React.useState([]);
  React.useEffect(() => {
    if (!isChart || !ref.current) return;
    const s = !!closestExportSection(ref.current);
    if (s !== inSection) setInSection(s);
  });
  const chartsInSection = () => {
    const b = block();
    if (!b || isChart) return [];
    return Array.prototype.filter.call(b.querySelectorAll("[data-export-chart]"), ch => closestExportSection(ch) === b)
      .map(ch => ({ el: ch, title: sectionTitleOf(ch) }));
  };
  const openChartMenu = (ch) => {
    const trig = Array.prototype.find.call(ch.querySelectorAll(".chart-export-bar .xm-trigger"), t => closestChartBlock(t) === ch);
    if (trig) { const bar = trig.parentNode; if (bar && bar.scrollIntoView) bar.scrollIntoView({ block: "nearest" }); trig.click(); }
  };
  const toggle = () => {
    if (!open && trigRef.current) {
      const r = trigRef.current.getBoundingClientRect();
      setOpenUp((window.innerHeight - r.bottom) < 240 && r.top > 240);
    }
    if (!open) setCharts(chartsInSection());
    setOpen(!open);
  };
  // Every action closes the menu so its result message shows by the button.
  const act = (fn) => fn && (() => { setOpen(false); fn(); });
  const menuBtn = (text, kind, onClick, tip, extra) => btn(text, kind, act(onClick), tip,
    Object.assign({ className: "xm-item" }, extra || {}));
  const icon = h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
    h("path", { d: "M12 4v11M7 10l5 5 5-5" }), h("path", { d: "M5 20h14" }));
  return h("div", {
    ref, "data-no-export": "", className: (isChart ? "chart-export-bar" : "section-export-bar") + (isChart && inSection ? " in-section" : "") + (msg || busy || open ? " is-active" : ""),
    // A section's bar is placed by shell.html (top-right of its section); a
    // chart's stays a row under its chart.
    style: isChart ? { position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 4 } : null
  },
    msg && h("span", { role: "status", style: { fontSize: 11, fontFamily: "var(--sans)", color: msg.tone === "ok" ? "var(--green)" : "var(--red)" } },
      msg.text,
      msg.caseId && ctx && ctx.openReport && h("button", { type: "button", onClick: () => { const src = liveSource(); if (src && src.openReport) src.openReport(msg.caseId); },
        style: { marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--teal)", textDecoration: "underline", fontFamily: "var(--sans)", fontSize: 11, cursor: "pointer" } },
        "Open report →"),
      msg.bundle && h("button", { type: "button", onClick: () => { const src = liveSource(); if (src && src.openBundle) src.openBundle(); },
        style: { marginLeft: 8, background: "none", border: "none", padding: 0, color: "var(--teal)", textDecoration: "underline", fontFamily: "var(--sans)", fontSize: 11, cursor: "pointer" } },
        "Open bundle →")),
    // At-a-glance status the old row showed: this live section is in the report.
    inReport && h("span", { className: "xm-status", title: "Included in " + possessive(target && target.name) + " report — open Export to take it out" }, "✓ In report"),
    h("button", { ref: trigRef, type: "button", className: "xm-trigger" + (open ? " on" : ""), onClick: toggle,
      "aria-haspopup": "true", "aria-expanded": open, "aria-controls": menuId,
      title: (isChart ? "Export this chart" : "Export this section") + (label ? " — " + label : "") + ": PNG, PDF" + (isChart && hasSvg ? ", SVG" : "") + ", add to a report or to your PDF bundle" },
      icon, busy ? "Working…" : (isChart ? "Export chart" : "Export")),
    h("div", { id: menuId, ref: menuRef, role: "group", "aria-label": (isChart ? "Export chart" : "Export section") + (label ? ": " + label : ""),
      className: "xm-menu" + (openUp ? " up" : ""), style: { display: open ? "block" : "none" } },
      h("div", { className: "xm-head" }, isChart ? "This chart" : "This whole section", label && h("span", { className: "xm-name", title: label }, label)),
      h("div", { className: "xm-group" },
        h("div", { className: "xm-label" }, "Save as"),
        menuBtn("PNG", "png", () => doExport("png"), isChart
          ? "Just this chart, with its title, as a high-resolution PNG"
          : "This whole section as a PNG — title, inputs, results, every chart, tables and open notes, at full height"),
        menuBtn("PDF", "pdf", () => doExport("pdf"), isChart
          ? "Just this chart, with its title, as a vector PDF"
          : "This whole section as a vector PDF, with selectable text"),
        isChart && hasSvg && menuBtn("SVG", "svg", () => doExport("svg"), "Just this chart as an editable vector SVG")),
      h("div", { className: "xm-group" },
        h("div", { className: "xm-label" }, "Collect"),
        savable && menuBtn("Save to case", "save", noCase ? undefined : doSave,
          noCase ? "Saved work belongs to a case — create one in Workspace first"
            : "Keep " + (isChart ? "this chart" : "this result") + " in " + possessive(target && target.name) + " Saved tab, with its inputs, so you can open it again later. Not added to the PDF until you tick it in.",
          noCase ? { disabled: true, className: "xm-item is-off" } : null),
        menuBtn(reportSection ? (inReport ? "✓ In report" : "+ Report") : "+ Report", "report",
          noCase ? undefined : doReport,
          noCase ? "Reports belong to a case — create one in Workspace first, then sections and charts can be added to its report"
            : reportSection
              ? (inReport ? "This section is in " + possessive(target && target.name) + " report — click to take it out" : "Include this section in " + possessive(target && target.name) + " report (it renders live from the model there)")
              : "Add " + (isChart ? "just this chart" : "this whole section") + " to " + possessive(target && target.name) + " report, to build a PDF of only what you choose",
          noCase ? { disabled: true, className: "xm-item is-off" } : (inReport ? { className: "xm-item is-on" } : null)),
        menuBtn("+ Bundle", "bundle", doBundle, "Collect " + (isChart ? "just this chart" : "this whole section") + " into your PDF bundle — then export everything you collected as one PDF, or each as its own PDF, from Bundle in the rail. No case needed.")),
      charts.length > 0 && h("div", { className: "xm-group" },
        h("div", { className: "xm-label" }, charts.length === 1 ? "Just the chart" : "Just one chart"),
        charts.map((c, i) => h("button", { key: "ch" + i, type: "button", className: "xm-item xm-chart", title: "PNG, PDF, SVG or the report — just " + (c.title || "this chart"),
          onClick: () => { setOpen(false); setTimeout(() => openChartMenu(c.el), 0); } }, (charts.length === 1 ? "Chart options" : (c.title || "Chart " + (i + 1))) + " →"))),
      cases.length > 1 && h("label", { className: "xm-case" }, "Report for",
        h("select", { "aria-label": "Case whose report this goes to", value: targetId || "", onChange: e => setPickedCaseId(e.target.value) },
          cases.map(c => h("option", { key: c.id, value: c.id }, c.name || "Untitled")))))
  );
}
function SectionExportBar(props) { return React.createElement(ExportBar, Object.assign({}, props, { scope: "section" })); }
function ChartExportBar(props) { return React.createElement(ExportBar, Object.assign({}, props, { scope: "chart" })); }

// Wraps any block as its own exportable section — used for the sub-sections
// packed inside larger cards (the scenario comparison, the bridge, Monte
// Carlo), which a reader should be able to take out on their own.
function ExportSection({ title, reportSection, source, style, className, id, nav, children }) {
  const h = React.createElement;
  return h.apply(null, ["div", {
    id: id || undefined,
    "data-nav": nav || undefined,
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
      background: critical ? "var(--red-bg)" : "var(--warn-bg)",
      borderBottom: "1px solid " + (critical ? "var(--red)" : "var(--warn)"),
      padding: "9px 20px", fontFamily: "var(--mono)", fontSize: 11,
      color: "var(--ink-1)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"
    } },
    h("span", { style: { color: critical ? "var(--red)" : "var(--warn)", fontWeight: 700 } },
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

// Keyboard behaviour every modal here shares: Escape closes, Tab stays inside
// the panel, and focus goes back to whatever opened it.
function useDialogKeys(panelRef, onClose) {
  React.useEffect(() => {
    // Remember where focus came from so it can go back — otherwise closing the
    // dialog drops focus onto <body> and a keyboard user has to tab in from
    // the top of the page to get back to where they were.
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
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
  }, [onClose]);
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const h = React.createElement;
  const panelRef = React.useRef(null);
  useDialogKeys(panelRef, onCancel);

  // Portalled to <body> so no sticky ancestor can paint over it (see BackupDialog).
  return ReactDOM.createPortal(h("div", {
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
  ), document.body);
}

// ── Note: collapsed-by-default explanatory copy ────────────────────────────
// React counterpart to the details.note pattern already used in the
// Simulation tab. Several of this app's explanations are genuinely load-
// bearing — why the unrisked figure can be more negative than the risked
// one, why the G&A slider exists at all — but rendered as permanent
// paragraphs they push the actual numbers off screen and make a panel look
// heavier than it is. One muted line, expandable, styling shared with the
// vanilla-DOM version so both halves of the app read identically.
// open: start unfolded (set once; the reader can still fold it).
function Note({ summary, children, open }) {
  const h = React.createElement;
  return h("details", { className: "note", open: open || undefined },
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

function MillionsField({ label, value, onChange, bench, help, wide, placeholder }) {
  const h = React.createElement;
  // Up to three decimals ($117.238M is a real balance). It used to round
  // anything from $100M up to whole millions — and because the field showed
  // that rounded number back on every keystroke, typing "117.2" snapped to
  // "117", the next "3" made it 1173, and $117.238M was stored as $11.7B.
  const toMillions = (raw) => {
    if (raw === "" || raw == null) return "";
    const n = Number(raw);
    if (isNaN(n)) return "";
    return String(Math.round((n / 1e6) * 1000) / 1000);
  };
  const fromMillions = (m) => {
    if (m === "" || m == null) return "";
    const n = Number(m);
    if (isNaN(n)) return "";
    return String(Math.round(n * 1e6));
  };
  const displayValue = toMillions(value);
  // While the field has focus it shows exactly what was typed; the stored
  // dollars are converted on every keystroke, but the text is not rebuilt
  // from them until the field is left.
  const [editing, setEditing] = React.useState(null);
  const displayBench = bench ? { ...bench, value: typeof bench.value === "number" ? Math.round((bench.value / 1e6) * 100) / 100 : bench.value } : null;
  return h(BenchField, {
    label, wide, help, placeholder,
    value: editing != null ? editing : displayValue,
    onChange: (v) => { setEditing(v); onChange(fromMillions(v)); },
    onFocus: () => setEditing(displayValue),
    onBlur: () => setEditing(null),
    bench: displayBench,
    suffix: "$M"
  });
}

// Props that make a non-button element behave like one for the keyboard:
// reachable with Tab, activated with Enter or Space, announced as a button.
// For block-level clickable rows where a real <button> would fight the layout
// (a card header holding a title and subtitle, a case row). Never nest a real
// button inside an element given these props.
function buttonLikeProps(onActivate, extra) {
  return Object.assign({
    role: "button", tabIndex: 0, onClick: onActivate,
    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onActivate(e); } }
  }, extra || {});
}

function SectionCard({ title, subtitle, children, defaultOpen, nav }) {
  const h = React.createElement;
  const [open, setOpen] = React.useState(defaultOpen !== false);
  // An exportable section like any other card — the inputs as set ARE the
  // relevant information for an assumptions card. The bar only shows while the
  // card is open, since a collapsed card has nothing in it to export.
  return h("div", { "data-nav": nav || undefined, className: open ? "export-section section-card" : "section-card", "data-export-section": open ? (typeof title === "string" ? title : "") : undefined, style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, marginBottom: 14, overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" } },
    // Was a bare onClick div: no Tab stop, so a keyboard user could not open
    // a single input card in the Workspace.
    h("div", buttonLikeProps(() => setOpen(!open), {
      "aria-expanded": open,
      // While open, the right of the header keeps room for the Export button
      // (placed over it by shell.html), with the chevron just to its left.
      style: { padding: open ? "13px calc(var(--xbar-pad, 104px) + 6px) 13px 18px" : "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "var(--surface-2)" }
    }),
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
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 } },
          f.label + (f.key === requiredKey ? " *" : "")),
        h("input", {
          type: f.numeric ? "number" : "text", value: vals[f.key], placeholder: f.placeholder,
          onChange: e => setVals(p => ({ ...p, [f.key]: e.target.value })), style: inputStyle
        })
      ))
    ),
    // Name the specific problem rather than just disabling the button, so it's
    // obvious which field is holding the save back.
    (numericProblem || missingRequired) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--warn)", marginBottom: 8 } },
      numericProblem ? ("“" + numericProblem.label + "” must be a number.")
        : ("“" + missingRequired.label + "” is required.")),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", {
        onClick: () => { if (!canSave) return; onSave(vals); },
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: canSave ? "pointer" : "default" }
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
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 };
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
        style: { padding: "5px 14px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, cursor: "pointer" }
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
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 };
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
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }
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
  const fieldLabelStyle = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginBottom: 3 };
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
        style: { padding: "6px 16px", borderRadius: 6, border: "none", background: canSave ? "var(--teal-fill)" : "var(--rule)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" }
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

// Reverse-solve box — companion to the Implied PoS box on the Overview tab,
// same visual language (amber accent), but lets the user pick which variable
// to solve for via solveImpliedVariable in scenarioEngine.js. Its own small
// component (not inlined like Implied PoS) because it needs local state for
// which variable is selected.
// Monte Carlo box — the capstone feature. Button-triggered rather than
// computed on every render, since thousands of full DCF runs per click is
// meaningfully more expensive than anything else on this panel; running it
// on every keystroke would make the UI feel sluggish for no benefit.
function MonteCarloBox({ theCase, discountRatePct, tv, baseValue }) {
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

  const price = theCase.currentPrice !== "" && theCase.currentPrice != null && Number(theCase.currentPrice) > 0 ? Number(theCase.currentPrice) : null;
  const aboveCount = result && price != null ? result.sortedValues.filter(v => v >= price).length : null;
  const stat = (label, value, sub, color) => h("div", { key: label, className: "mc-stat" },
    h("div", { style: UI.caption }, label),
    h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 700, color: color || "var(--ink-1)" } }, value),
    sub && h("div", { style: { ...UI.caption, marginTop: 2 } }, sub));

  return h(ExportSection, { title: "Full-case Monte Carlo", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "Full-case Monte Carlo"),
    h("div", { className: "prose", style: { ...UI.caption, marginBottom: 10 } },
      "3,000 trials, each drawing PoS and peak share (and the discount rate, if your scenarios vary it) between your Bear and Bull values, Base the most likely — the whole spread of fair values, not three points."),
    h("button", { onClick: run, disabled: running,
      style: { padding: "6px 16px", borderRadius: 6, border: "none", background: running ? "var(--rule)" : "var(--teal-fill)", color: "var(--on-teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: running ? "default" : "pointer" }
    }, running ? "Running…" : result ? "Re-run" : "Run 3,000 trials"),
    error && h("div", { style: { marginTop: 10, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, error),
    result && h("div", { style: { marginTop: 14 } },
      // Every trial, not five summary points: the histogram shows the shape
      // (a long tail, a lump at failure) that percentiles alone hide.
      h("div", { className: "mc-stats" },
        stat("P10", fmtShare(result.percentiles.p10)),
        stat("Median", fmtShare(result.percentiles.p50), baseValue != null ? "Base point estimate " + fmtShare(baseValue) : null),
        stat("P90", fmtShare(result.percentiles.p90)),
        aboveCount != null && stat("Above today's price", Math.round(aboveCount / result.sortedValues.length * 100) + "%", aboveCount.toLocaleString() + " of " + result.sortedValues.length.toLocaleString(), aboveCount / result.sortedValues.length >= 0.5 ? "var(--green)" : "var(--red)")),
      h(ExportableBlock, { title: (theCase.name || "Case") + " — Monte Carlo fair-value distribution" },
        h(HistogramChart, { sortedValues: result.sortedValues, price, height: 250,
          label: "Histogram of " + result.sortedValues.length.toLocaleString() + " simulated fair values per share",
          markers: [
            { value: result.percentiles.p10, label: "P10", color: "var(--ink-3)", dash: "4,3" },
            { value: result.percentiles.p50, label: "Median", color: "var(--ink-1)", dash: "4,3" },
            { value: result.percentiles.p90, label: "P90", color: "var(--ink-3)", dash: "4,3" },
            price != null && { value: price, label: "Today", color: "var(--warn)" },
            baseValue != null && { value: baseValue, label: "Base", color: "var(--teal)", dash: "2,3" }
          ].filter(Boolean) }),
        h("div", { style: { ...UI.caption, marginTop: 4 } }, "Fair value per share across " + result.sortedValues.length.toLocaleString() + " simulations. P25 " + fmtShare(result.percentiles.p25) + " · P75 " + fmtShare(result.percentiles.p75) + (price != null ? ". Green bars are outcomes at or above today's price." : "."))),
      h(Explain, Object.assign({ onTint: true }, readMonteCarlo(result.sortedValues, result.percentiles.p10, result.percentiles.p90, theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null, result.drivers))),
      // Secondary detail, one click away rather than always on screen.
      h("div", { style: { marginTop: 10 } }, h(Note, { summary: "Why the median differs from Base, and what drives the spread" },
        h("div", { style: { marginBottom: 8 } }, "Median can differ from the Base-case point estimate above — that's expected, not a discrepancy: the Bear-to-Bull ranges are rarely symmetric around Base, and value does not move in a straight line with each input (odds and share multiply, and a discount rate, where your scenarios vary it, hurts more going up than it helps going down), so averaging across a range captures what three fixed points can't."),
      h("div", { style: { marginTop: 4 } },
        h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } }, "What's driving the spread (correlation with fair value)"),
        // An input the scenarios do not vary (usually the discount rate) has
        // no spread to drive, so it is left out rather than listed at +0.00.
        result.drivers.filter(d => Math.abs(d.correlation) >= 0.005).map(d => h("div", { key: d.key, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 3 } },
          h("span", null, d.label), h("span", null, (d.correlation >= 0 ? "+" : "") + d.correlation.toFixed(2))))
      )))
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
        setResult({ total: r.studies.length, lateStage: lateStage.length, excludedNonIndustry, pairs, totalCount: r.totalCount, droppedUnrelated: r.droppedUnrelated || 0, query: indication.trim() });
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
      h("span", { style: UI.caption },
        indication && indication.trim() ? "Searches: " + indication.trim() : "Set an indication above first")),
    error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginTop: 8 } }, error),
    result && h("div", { style: { marginTop: 10, fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
      h("div", null, "Found ", h("b", { style: { color: "var(--ink-1)" } }, String(result.pairs.length)),
        " distinct industry-sponsored late-stage (Phase 2/3) sponsor+drug pairs, from ", String(result.total), " trials scanned",
        result.totalCount > result.total ? " (of " + result.totalCount + " matching CT.gov records)" : "", ".",
        result.excludedNonIndustry > 0 && h("span", { style: { color: "var(--ink-3)" } },
          " " + result.excludedNonIndustry + " academic/government-sponsored late-stage trial" + (result.excludedNonIndustry > 1 ? "s" : "") + " excluded — real science, but not a product launching into this market."),
        result.droppedUnrelated > 0 && h("span", { style: { color: "var(--ink-3)" } }, " " + conditionDropNote(result.droppedUnrelated, result.query))),
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
    h("span", { style: { color: "var(--teal)", flexShrink: 0 } }, "◇"),
    h("span", null, what || "This section", " is not used while Simple Multiple is the valuation method — that method values peak revenue directly and never builds a year-by-year cash flow. Switch to DCF to make it count."));
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

  return h(ExportSection, { title: "What else " + possessive(caseLabel) + " price implies", style: { marginTop: 16, borderTop: "1px dashed var(--rule)", paddingTop: 14 } },
    h("div", { style: { fontSize: 13, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "What else " + possessive(caseLabel) + " price implies"),
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10 } }, "Same idea as Implied PoS above, holding every other assumption fixed and solving for this one instead."),
    options.length > 1 && h("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
      options.map(o => h("button", {
        key: o.key, onClick: () => setVariable(o.key), "aria-pressed": variable === o.key,
        style: { padding: "4px 10px", minHeight: 26, borderRadius: 6, border: "1px solid " + (variable === o.key ? "var(--amber)" : "var(--rule)"), background: variable === o.key ? "var(--amber)" : "transparent", color: variable === o.key ? "var(--on-teal)" : "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, cursor: "pointer" }
      }, o.label))
    ),
    solveError || !solved ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "Couldn't solve: " + (solveError || "unknown error"))
    : !solved.ok ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, solved.error)
    : h("div", null,
        h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" } },
          h("div", null,
            h("div", { style: UI.caption }, "Your assumption"),
            h("div", { style: { fontSize: 20, fontFamily: "var(--mono)", fontWeight: 800, color: "var(--ink-1)" } }, fmtVal(solved.currentValue, solved.suffix))),
          h("div", null,
            h("div", { style: UI.caption }, "Market implies"),
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

// ── Live impact (Workspace › Assumptions) ─────────────────────────────────
// The thing a spreadsheet can't give you: while you edit, the base-case fair
// value, what your last edit did to it, and which inputs move it most — in
// view the whole time, not a scroll away. The headline number is one cheap
// valuation (baseCaseFairValue, the same path as the Overview); the drivers
// reuse the Sensitivity tool's own engine, skip its price grid, and run a
// moment after typing stops, only while the tab is open.
function LiveImpactPanel({ theCase, active }) {
  const h = React.createElement;
  const value = baseCaseFairValue(theCase);
  const prev = React.useRef(value);
  const [lastChange, setLastChange] = React.useState(null);
  const [drivers, setDrivers] = React.useState(null);
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    if (value != null && prev.current != null && Math.abs(value - prev.current) > 0.0005) setLastChange(value - prev.current);
    prev.current = value;
  }, [value]);
  const sig = JSON.stringify(theCase.programs) + "|" + theCase.discountRatePct + "|" + JSON.stringify(theCase.capitalStructure) + "|" + theCase.valuationMethod + "|" + JSON.stringify(theCase.terminalValue);
  React.useEffect(() => {
    if (!active || value == null) return;
    setPending(true);
    const t = setTimeout(() => {
      const r = computeSensitivityDrivers(theCase, { skipGrid: true });
      setDrivers(r.error ? null : r.rows.slice(0, 4));
      setPending(false);
    }, 450);
    return () => clearTimeout(t);
  }, [active, sig]);

  const cp = theCase.currentPrice !== "" && theCase.currentPrice != null ? Number(theCase.currentPrice) : null;
  const gap = (value != null && cp > 0) ? value - cp : null;
  // Every driver is drawn as its low-to-high range on ONE shared axis, with a
  // tick at today's value — so the bars show direction and reach, not just
  // swing sizes that all look full when the drivers are similar.
  const axLo = drivers && drivers.length ? Math.min(value, ...drivers.map(d => d.lo)) : 0;
  const axHi = drivers && drivers.length ? Math.max(value, ...drivers.map(d => d.hi)) : 1;
  const pos = (v) => ((v - axLo) / ((axHi - axLo) || 1)) * 100;
  const top = drivers && drivers[0];
  return h("aside", { className: "live-impact", "aria-label": "Live impact", "aria-live": "polite" },
    h("div", { className: "li-title" }, "Live impact"),
    h("div", { className: "li-label" }, "Fair value per share · Base"),
    h("div", { className: "li-value" + (value != null && value < 0 ? " neg" : "") }, value == null ? "—" : fmtShare(value)),
    value == null
      ? h("div", { className: "li-sub" }, "Fill in the inputs flagged above to see a value.")
      : h("div", { className: "li-sub" }, cp > 0
          ? (gap >= 0 ? fmtShare(gap) + " above today's " : fmtShare(-gap) + " below today's ") + fmtShare(cp)
          : "Add a current price to compare"),
    lastChange != null && h("div", { className: "li-delta " + (lastChange >= 0 ? "up" : "down") },
      (lastChange >= 0 ? "▲ +" : "▼ ") + fmtShare(lastChange).replace("-", "") + " from your last change"),
    value != null && h("div", { className: "li-drivers" },
      h("div", { className: "li-label", style: { marginBottom: 8 } }, "What moves it most", pending && h("span", { className: "li-pending" }, " · updating…")),
      (drivers || []).map(d => {
        const lo = d.lo, hi = d.hi;
        return h("div", { key: d.name, className: "li-row", title: d.name + ": " + fmtShare(lo) + " to " + fmtShare(hi) },
          h("span", { className: "li-name" }, d.name.replace(" / revenue", "").replace(" (PoS)", "").replace(" (% of revenue)", "")),
          h("span", { className: "li-bar" },
            h("i", { style: { left: pos(lo) + "%", width: Math.max(2, pos(hi) - pos(lo)) + "%" } }),
            h("b", { style: { left: pos(value) + "%" }, "aria-hidden": "true" })),
          h("span", { className: "li-range" }, fmtShare(lo) + " – " + fmtShare(hi)));
      }),
      top && h("div", { className: "li-explain" },
        h("b", null, top.name.replace(" / revenue", "").replace(" (PoS)", "")), " swings fair value by " + fmtShare(top.swing) + " across its tested range — it's the input most worth getting right.")));
}

// ── Section list beside the Assumptions tab ─────────────────────────────────
// A table of contents for a long page of inputs: click to jump (a collapsed
// card opens on arrival), the section on screen is highlighted, and a dot
// marks each section changed from its default, or still missing a required
// input. The states come from assumptionNavSections() in caseShell.js, i.e.
// from the case data, never from reading the page. Only sections actually on
// the page are listed, so a card a mode hides never becomes a dead link.
const SECNAV_STATE_TEXT = { set: "changed from default", todo: "needs an input", result: "a result", unused: "not used by this valuation method" };
function SectionNav({ groups, rootId, active: tabActive, onHide }) {
  const h = React.createElement;
  const [current, setCurrent] = React.useState(null);
  const [present, setPresent] = React.useState(null);
  const ids = groups.flatMap(g => g.items.map(i => i.id));
  const idKey = ids.join("|");
  React.useLayoutEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const onPage = ids.filter(id => root.querySelector('[data-nav="' + id + '"]'));
    if (!present || onPage.join("|") !== present.join("|")) setPresent(onPage);
  });
  React.useEffect(() => {
    if (!tabActive) return;
    const root = document.getElementById(rootId);
    if (!root) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const els = Array.from(root.querySelectorAll("[data-nav]"));
      if (!els.length) return;
      let cur = els[0].getAttribute("data-nav");
      for (const e of els) { if (e.getBoundingClientRect().top <= 140) cur = e.getAttribute("data-nav"); else break; }
      // Scrolled to the bottom: the last section is the one being read, even
      // if it is too short to ever reach the top of the window.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1].getAttribute("data-nav");
      setCurrent(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [rootId, idKey, tabActive]);
  const go = (id) => {
    const root = document.getElementById(rootId);
    const el = root && root.querySelector('[data-nav="' + id + '"]');
    if (!el) return;
    const closed = el.querySelector(':scope > [aria-expanded="false"]');
    if (closed) closed.click();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    // Move focus with the view, so a keyboard or screen-reader user lands in
    // the section too rather than staying up in the list.
    const target = el.querySelector(":scope > [aria-expanded]") || el;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    setCurrent(id);
  };
  const shown = groups.map(g => Object.assign({}, g, { items: g.items.filter(i => !present || present.includes(i.id)) })).filter(g => g.items.length);
  const todo = shown.reduce((n, g) => n + g.items.filter(i => i.state === "todo").length, 0);
  return h("nav", { className: "secnav", "aria-label": "Sections on this tab", "data-no-export": "" },
    h("div", { className: "secnav-head" },
      h("span", null, "On this tab"),
      h("button", { type: "button", className: "secnav-hide", onClick: onHide, title: "Hide the section list (bring it back from the top of the tab)" }, "Hide")),
    todo > 0 && h("div", { className: "secnav-todo" }, todo === 1 ? "1 input still needed" : todo + " inputs still needed"),
    shown.map(g => h("div", { key: g.label, className: "secnav-group" },
      h("div", { className: "secnav-grp", title: g.label }, g.label),
      g.items.map(i => h("button", {
        key: i.id, type: "button", onClick: () => go(i.id),
        className: "secnav-item" + (current === i.id ? " on" : "") + (i.state ? " " + i.state : ""),
        "aria-current": current === i.id ? "location" : undefined,
        title: SECNAV_STATE_TEXT[i.state] ? i.label + ": " + SECNAV_STATE_TEXT[i.state] : undefined
      },
        h("span", { className: "secnav-label" }, i.label),
        SECNAV_STATE_TEXT[i.state] && h("span", { className: "sr-only" }, ", " + SECNAV_STATE_TEXT[i.state]),
        (i.state === "set" || i.state === "todo") && h("span", { className: "secnav-dot " + i.state, "aria-hidden": "true" }),
        i.state === "unused" && h("span", { className: "secnav-tag", "aria-hidden": "true" }, "not used"))))),
    h("div", { className: "secnav-legend", "aria-hidden": "true" },
      h("span", null, h("i", { className: "secnav-dot set" }), "changed from default"),
      h("span", null, h("i", { className: "secnav-dot todo" }), "needs an input")));
}

// ── Plain-English readings of a result ──────────────────────────────────────
// One bold verdict and one sentence under a result, saying what THIS result
// means rather than how the tool works (the "New here?" notes do that). Each
// reading is a pure function of numbers already on screen, returns null when
// it has nothing honest to say, and is checked against hand-worked cases in
// math_verification.js. None of them computes a new number.
function Explain({ verdict, text, onTint }) {
  const h = React.createElement;
  if (!verdict && !text) return null;
  return h("div", { className: "explain" + (onTint ? " on-tint" : "") },
    h("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": "true" },
      h("circle", { cx: 12, cy: 12, r: 9 }), h("path", { d: "M12 11v5M12 8h.01" })),
    h("div", null, verdict && h("b", null, verdict), verdict && text ? " " : null, text));
}
// Same box for the Simulation side, which builds plain DOM.
function explainNode(reading) {
  if (!reading || (!reading.verdict && !reading.text)) return null;
  const box = document.createElement("div");
  box.className = "explain";
  box.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
  const body = document.createElement("div");
  if (reading.verdict) { const b = document.createElement("b"); b.textContent = reading.verdict; body.appendChild(b); }
  if (reading.text) body.appendChild(document.createTextNode((reading.verdict ? " " : "") + reading.text));
  box.appendChild(body);
  return box;
}
const pctWord = (x) => Math.round(x) + "%";
// "$0.71 is 7% above" style helper: how far a sits from b, as a share of b.
function relGap(a, b) { return b !== 0 ? Math.abs(a / b - 1) * 100 : null; }

// Where today's price sits against the Bear / Base / Bull fair values.
function readPriceVsScenarios(price, bear, base, bull) {
  if (!(price > 0) || ![bear, base, bull].every(isFinite)) return null;
  const lo = Math.min(bear, base, bull), hi = Math.max(bear, base, bull);
  if (price > hi) return { verdict: "Priced above even your Bull case.",
    text: "Today's " + fmtShare(price) + " is " + fmtShare(price - hi) + " more than your most optimistic fair value (" + fmtShare(hi) + "). Either the market sees something this case leaves out, such as other programs, better odds or a takeover, or your assumptions are more cautious than the market's." };
  if (price < lo) return { verdict: "Priced below even your Bear case.",
    text: "Your most cautious fair value (" + fmtShare(lo) + ") is " + pctWord(relGap(lo, price)) + " above today's " + fmtShare(price) + ". If your assumptions hold, the market is pricing in something worse than your worst case, which is worth understanding before calling it cheap." };
  if (price >= base) return { verdict: "Priced between your Base and Bull cases.",
    text: "The market already pays more than your Base case (" + fmtShare(base) + ") but less than your Bull case (" + fmtShare(bull) + "). Owning it at " + fmtShare(price) + " is a bet that things go better than your central view." };
  return { verdict: "Priced between your Bear and Base cases.",
    text: "Your Base case (" + fmtShare(base) + ") is " + pctWord(relGap(base, price)) + " above today's " + fmtShare(price) + ", and your Bear case (" + fmtShare(bear) + ") is the downside if things go worse than you expect." };
}

// A Monte Carlo distribution against today's price.
function readMonteCarlo(sortedValues, p10, p90, price, drivers) {
  if (!sortedValues || !sortedValues.length) return null;
  const n = sortedValues.length;
  const top = (drivers || []).slice().sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))[0];
  const range = "The middle 80% of outcomes runs from " + fmtShare(p10) + " to " + fmtShare(p90) + "." + (top ? " " + top.label + " moves the answer most." : "");
  if (!(price > 0)) return { verdict: null, text: range };
  const above = sortedValues.filter(v => v >= price).length / n;
  const verdict = above < 0.01 ? "Fair value beats today's price in almost none of the " + n.toLocaleString() + " simulations."
    : above > 0.99 ? "Fair value beats today's price in almost every simulation."
    : "Fair value beats today's price in " + pctWord(above * 100) + " of simulations.";
  return { verdict, text: range };
}

// Year-by-year risk-adjusted cash flow: when it turns positive and when the
// spending before that is earned back. points: [{ v, label }], label = year.
function readCashFlow(points) {
  if (!points || points.length < 2) return null;
  const firstPos = points.findIndex(p => p.v > 0);
  if (firstPos === -1) return { verdict: "Never turns positive.", text: "At these odds, no year's expected cash flow covers its costs, so the programs subtract value rather than add it." };
  const peak = points.reduce((b, p) => p.v > b.v ? p : b, points[0]);
  // Deepest point of the running total, then the first year after it where
  // the running total is back to zero or better.
  const cums = []; let cum = 0;
  points.forEach(p => { cum += p.v; cums.push(cum); });
  let ti = 0; cums.forEach((c, i) => { if (c < cums[ti]) ti = i; });
  const trough = Math.min(0, cums[ti]), troughAt = points[ti].label;
  const pi = cums.findIndex((c, i) => i > ti && c >= 0);
  const payback = pi === -1 ? null : points[pi].label;
  if (firstPos === 0) return { verdict: "Positive from the start.", text: "Expected cash flow peaks at " + fmtMoney(peak.v) + " in year " + peak.label + "." };
  return { verdict: "Spends cash until year " + points[firstPos].label + ".",
    text: "The net outlay reaches " + fmtMoney(-trough) + " by year " + troughAt + (payback != null ? " and is earned back by year " + payback : " and is not earned back within the model") + "; the best single year is " + fmtMoney(peak.v) + " in year " + peak.label + ". These are odds-weighted amounts, not what happens if the drug works." };
}

// Sum of the parts: which program carries the value, and which subtract it.
function readSotp(parts, gaDrag) {
  if (!parts || parts.length < 2) return null;
  // Two programs left as "New Program" would read as one: number the repeats.
  const seen = {};
  parts = parts.map(p => { const n = (seen[p.name] = (seen[p.name] || 0) + 1); return n > 1 || parts.filter(q => q.name === p.name).length > 1 ? Object.assign({}, p, { name: p.name + " (" + n + ")" }) : p; });
  const pos = parts.filter(p => p.npv > 0).sort((a, b) => b.npv - a.npv);
  const neg = parts.filter(p => p.npv < 0).sort((a, b) => a.npv - b.npv);
  if (!pos.length) return { verdict: "No program adds value at its current odds.", text: "Every program's expected costs outweigh its expected revenue, before " + fmtMoney(-gaDrag) + " of shared G&A." };
  const gross = pos.reduce((s, p) => s + p.npv, 0);
  const share = pos[0].npv / gross * 100;
  const text = (pos.length > 1 ? pos[0].name + " is " + pctWord(share) + " of the value the programs add. " : "") +
    (neg.length ? andList(neg.map(p => p.name)) + (neg.length > 1 ? " subtract" : " subtracts") + " " + fmtMoney(-neg.reduce((s, p) => s + p.npv, 0)) + ": at current odds, expected costs outweigh expected revenue. " : "") +
    "Shared G&A costs " + fmtMoney(-gaDrag) + " on top.";
  return { verdict: pos.length === 1 ? pos[0].name + " carries all of the value." : pos[0].name + " carries most of the value.", text };
}

// Risk waterfall: how much of the success-certain value survives the odds.
function readRiskWaterfall(unrisked, risked) {
  if (![unrisked, risked].every(isFinite)) return null;
  if (unrisked <= 0) return { verdict: "Even certain success doesn't pay back the costs.", text: "With every trial assumed to work, value is still " + fmtMoney(unrisked) + ", so the issue is the revenue and cost assumptions, not the odds." };
  // "Unrisked" pays every remaining trial's cost for certain too, so it can
  // come out below the odds-weighted value when late costs outrun revenue.
  if (risked > unrisked) return { verdict: "Certain success is worth less than today's odds-weighted value.",
    text: "Paying for every remaining trial for certain costs more than the extra revenue it brings (" + fmtMoney(unrisked) + " against " + fmtMoney(risked) + "), which usually means the revenue looks thin for what it costs to get there." };
  if (risked < 0) return { verdict: "Worth " + fmtMoney(unrisked) + " if it works, negative at today's odds.", text: "The odds of failure cost " + fmtMoney(unrisked - risked) + ": expected spending on the way to launch outweighs the odds-weighted revenue." };
  return { verdict: "You keep " + pctWord(risked / unrisked * 100) + " of the success-case value.", text: "Certain success would be worth " + fmtMoney(unrisked) + "; the odds of failing along the way take " + fmtMoney(unrisked - risked) + " off that." };
}

// A tornado chart against today's price: which single input could, on its
// own, carry fair value to the price. drivers: [{ label, low, high }] per share.
function readTornado(drivers, base, price) {
  if (!drivers || !drivers.length || !isFinite(base)) return null;
  const sorted = drivers.slice().sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  const t = sorted[0];
  const lead = t.label + " matters most: across its tested range, fair value runs from " + fmtShare(Math.min(t.low, t.high)) + " to " + fmtShare(Math.max(t.low, t.high)) + ".";
  if (!(price > 0)) return { verdict: null, text: lead };
  const reach = sorted.filter(d => (price >= base ? Math.max(d.low, d.high) >= price : Math.min(d.low, d.high) <= price)).map(d => d.label);
  const verdict = reach.length === 0
    ? "No single input, moved across its range, gets fair value to today's " + fmtShare(price) + "."
    : reach.length === sorted.length ? "Any one of these inputs, moved far enough, reaches today's " + fmtShare(price) + "."
    : "Only " + andList(reach) + (reach.length === 1 ? " reaches" : " each reach") + " today's " + fmtShare(price) + (reach.length === 1 ? " on its own." : " on their own.");
  return { verdict, text: lead };
}
// "a" or "an" before a number as it is read aloud: an 8-point gap, an 11%
// premium, an 80% premium, but a 1 in 10 chance and a 100-point range.
function aNum(n, capital) {
  const digits = String(Math.floor(Math.abs(Number(n)) || 0));
  const an = digits[0] === "8" || ((digits.length === 2 || digits.length === 5) && (digits.slice(0, 2) === "11" || digits.slice(0, 2) === "18"));
  return (capital ? (an ? "An" : "A") : (an ? "an" : "a"));
}
// "A", "A and B", "A, B and C" — a list that reads as a sentence.
function andList(items) {
  return items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

// The two-way grid: how many of its combinations reach today's price.
function readPriceGrid(cells, price) {
  if (!(price > 0) || !cells || !cells.length) return null;
  const all = [].concat.apply([], cells).filter(v => v != null && isFinite(v));
  if (!all.length) return null;
  const n = all.filter(v => v >= price).length;
  if (n === 0) return { verdict: "None of the " + all.length + " combinations reaches today's " + fmtShare(price) + ".", text: "Even the most generous corner of the grid, " + fmtShare(Math.max.apply(null, all)) + ", is below it. Peak revenue and PoS together cannot explain the price on these assumptions." };
  if (n === all.length) return { verdict: "Every combination is above today's " + fmtShare(price) + ".", text: "Even the harshest corner of the grid, " + fmtShare(Math.min.apply(null, all)) + ", clears it." };
  return { verdict: n + " of the " + all.length + " combinations reach today's " + fmtShare(price) + ".", text: "Those are the peak revenue and PoS pairs you would need to believe for today's price to be fair or cheap; hover a cell for its exact gap." };
}

// ── Readings for the Simulation tools ──
// A confidence interval against "no effect" (1 for a ratio, 0 for a
// difference). Says which way the interval sits, never which way is good:
// the tool does not know whether the endpoint is a benefit or a harm.
function readInterval(lower, upper, scale, levelPct) {
  if (![lower, upper].every(isFinite) || upper <= lower) return null;
  const nullV = scale === "ratio" ? 1 : 0;
  const crosses = lower <= nullV && upper >= nullV;
  const words = (v) => {
    if (scale !== "ratio") return (v > 0 ? "+" : "") + (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
    const pct = Math.abs(v - 1) * 100;
    return pct < 0.5 ? "no different" : pctWord(pct) + (v < 1 ? " lower" : " higher");
  };
  const range = scale === "ratio"
    ? "The data fit anything from " + words(lower) + " to " + words(upper) + " than the comparator."
    : "The data fit a true difference anywhere from " + words(lower) + " to " + words(upper) + ".";
  return crosses
    ? { verdict: "The " + levelPct + "% interval includes no effect.", text: range + " A result like this does not rule out that the drug does nothing on this measure." }
    : { verdict: "The " + levelPct + "% interval excludes no effect.", text: range + " How wide that range is tells you how precisely the effect is known." };
}
function readPValue(p) {
  if (!isFinite(p)) return null;
  if (p < 0.01) return { verdict: "Significant at the usual 5% level, and at the stricter 1%.", text: "It would survive the tighter thresholds used when a trial tests several endpoints." };
  if (p < 0.05) return { verdict: "Significant at the usual 5% level, but not at 1%.", text: "If this is one of several endpoints, a multiplicity adjustment could take it past the line; see Multiplicity Adjustment." };
  if (p < 0.10) return { verdict: "Not significant at 5%.", text: "Close enough that companies sometimes call it a 'trend'. That is not evidence the drug works." };
  return { verdict: "Not significant.", text: "A result this far from the threshold is consistent with no effect." };
}
// One observed rate: how much a trial of this size pins it down.
function readSingleArm(n, lower, upper) {
  if (![n, lower, upper].every(isFinite) || n <= 0) return null;
  const width = (upper - lower) * 100;
  const verdict = width >= 30 ? "Too few patients to pin the rate down." : width >= 15 ? "A rough estimate." : "A fairly precise estimate.";
  return { verdict, text: "With " + n + " patient" + (n === 1 ? "" : "s") + ", the true rate could be anywhere from " + (lower * 100).toFixed(0) + "% to " + (upper * 100).toFixed(0) + "%, " + aNum(Math.round(width)) + " " + width.toFixed(0) + "-point range. A comparator's rate inside that range cannot be ruled out." };
}
// Assurance: the share of simulated trials that read out significant.
function readAssurance(pct, sided) {
  if (!isFinite(pct)) return null;
  const inTen = Math.round(pct / 10);
  const verdict = pct >= 99.5 ? "Nearly every simulated trial reads out significant."
    : pct < 0.5 ? "Almost no simulated trial reads out significant."
    : "About " + inTen + " in 10 simulated trials read out significant.";
  return { verdict, text: "That is the chance of a statistically significant result given your belief about the effect and this trial's size, not the chance of approval." + (sided === "two" ? " Two-sided: a significant result in the wrong direction counts too." : "") };
}
// Peak-sales Monte Carlo: how wide the range is, and what drives it.
function readPeakSalesRange(p10, p50, p90, topDriverLabel) {
  if (![p10, p50, p90].every(isFinite) || p10 <= 0) return null;
  const spread = p90 / p10;
  return { verdict: "The optimistic end is " + (spread >= 10 ? spread.toFixed(0) : spread.toFixed(1)) + "× the cautious end.",
    text: "Eight in ten simulations land between " + fmtMoney(p10) + " and " + fmtMoney(p90) + ", around a median of " + fmtMoney(p50) + "." + (topDriverLabel ? " " + topDriverLabel + " moves it most, so that is the input worth researching." : "") };
}

// ── Readings for Tools ──
// Binary event with no PoS of your own: what the price already assumes.
function readBinaryImplied(impliedPct) {
  if (!isFinite(impliedPct) || impliedPct < 0 || impliedPct > 100) return null;
  const inTen = Math.round(impliedPct / 10);
  const odds = inTen === 0 ? "less than a 1 in 10 chance" : inTen === 10 ? "near-certain success" : "roughly " + aNum(inTen) + " " + inTen + " in 10 chance";
  return { verdict: "The price assumes " + odds + " that it works.", text: "If your own odds are higher than " + impliedPct.toFixed(0) + "%, the bet pays on average at these values; if lower, it doesn't. Add your PoS above to see the expected value." };
}
// A takeout premium against the premiums actually paid in tracked deals.
function readPremium(pct, premiumsKnown) {
  if (!isFinite(pct) || !premiumsKnown || premiumsKnown.length < 4) return null;
  const n = premiumsKnown.length;
  const below = premiumsKnown.filter(p => p < pct).length;
  const median = percentile(premiumsKnown.slice().sort((a, b) => a - b), 0.5);
  const verdict = below / n >= 0.75 ? "Richer than most real deals." : below / n <= 0.25 ? "Leaner than most real deals." : "In line with real deals.";
  return { verdict, text: aNum(Math.round(pct), true) + " " + pctWord(pct) + " premium is above " + below + " of the " + n + " tracked deals with a disclosed premium; the median is " + pctWord(median) + "." };
}
// Break-even peak revenue: how much the price needs against what the case
// carries, and whether that sits inside the case's own Bear–Bull range.
function readBreakEven(basePeak, breakEvenPeak, bearPeak, bullPeak, belowRange, aboveRange) {
  if (breakEvenPeak == null) {
    if (belowRange) return { verdict: "The price is below every level on this curve.", text: "Even the lowest peak revenue modelled here is worth more than today's price, so the market is pricing in something worse than a weak launch — a failure, or dilution this case does not model." };
    if (aboveRange) return { verdict: "The price is above every level on this curve.", text: "Even at twice this case's market share the model does not reach today's price, so the market is paying for something beyond peak sales — other programs, a takeover, or odds higher than yours." };
    return null;
  }
  if (!(basePeak > 0)) return null;
  const gap = basePeak / breakEvenPeak - 1;
  const where = breakEvenPeak < bearPeak ? "below your Bear case's " + fmtMoney(bearPeak) + ", so the price assumes a launch weaker than your own worst case"
    : breakEvenPeak > bullPeak ? "above your Bull case's " + fmtMoney(bullPeak) + ", so the price assumes a launch better than your own best case"
    : "inside your Bear–Bull range of " + fmtMoney(bearPeak) + " to " + fmtMoney(bullPeak);
  return { verdict: "The price needs about " + fmtMoney(breakEvenPeak) + " of peak revenue.",
    text: "This case carries " + fmtMoney(basePeak) + ", " + (Math.abs(gap) < 0.005 ? "about the same" : pctWord(Math.abs(gap) * 100) + (gap > 0 ? " more" : " less")) + ". That is " + where + "." };
}

// The gap between this case's fair value and the price, per share, and what
// it means in odds when the implied PoS is known. Never calls the gap a
// mispricing: a model disagreeing with the market is a question, not an answer.
function readPriceGap(fairPerShare, price, impliedPct, basePct) {
  if (!(price > 0) || fairPerShare == null || !isFinite(fairPerShare)) return null;
  const gap = fairPerShare - price;
  const verdict = Math.abs(gap) < 0.005 ? "The price matches this case." : "About " + fmtShare(Math.abs(gap)) + " a share " + (gap > 0 ? "separates the price from this case." : "of the price is not in this case.");
  if (impliedPct == null || basePct == null) return { verdict, text: gap > 0 ? "The market values the company below this case's Base assumptions." : "The market values the company above this case's Base assumptions." };
  const d = basePct - impliedPct;
  return { verdict, text: "In odds, that is the difference between the " + Math.round(impliedPct) + "% the price implies and this case's " + Math.round(basePct) + "%. " +
    (Math.abs(d) <= 5 ? "Close enough to be a matter of judgment." : aNum(Math.round(Math.abs(d)), true) + " " + Math.round(Math.abs(d)) + "-point gap is a real disagreement — worth being able to say why you are " + (d > 0 ? "more" : "less") + " confident than the market.") };
}

// The whole range as a binary bet: what is left if the readout fails, what it
// is worth if it works, and where the price sits between them. The share of
// the way from floor to success is NOT a probability (it ignores timing and
// dilution), so the model's own implied odds are quoted beside it when known.
function readOutcomeRange(floor, success, price, impliedPct) {
  if (floor == null || success == null || !(success > floor)) return null;
  const verdict = "A binary bet: about " + fmtShare(floor) + " if the readout fails, " + fmtShare(success) + " if it works.";
  if (!(price > 0)) return { verdict, text: "Bear, Base and Bull sit between the two because each weighs failure differently." };
  const share = (price - floor) / (success - floor) * 100;
  const where = price <= floor ? "At " + fmtShare(price) + " the price is at or below what is left after a failure."
    : price >= success ? "At " + fmtShare(price) + " the price is above even the value if it works."
    : "At " + fmtShare(price) + " you are paying " + pctWord(share) + " of the way from failure to success.";
  return { verdict, text: where + (impliedPct != null ? " Allowing for timing and dilution, the full model puts the odds the price implies at " + Math.round(impliedPct) + "%." : "") };
}

// Forward runway from the case's own plan: when cash runs out, and how much
// the plan would need raised at its lowest point.
function readForwardRunway(runwayMonths, path) {
  if (!path || !path.length) return null;
  const low = path.reduce((b, p) => p.balanceEnd < b.balanceEnd ? p : b, path[0]);
  if (low.balanceEnd >= 0) return { verdict: "The plan never runs out of cash.", text: "The balance stays positive throughout the projection, lowest at " + fmtMoney(low.balanceEnd) + " in year " + low.year + "." };
  const when = runwayMonths == null ? "" : runwayMonths < 1 ? "The plan needs outside money from the start." : "Cash runs out in about " + Math.round(runwayMonths) + " months.";
  return { verdict: when || "The plan runs short of cash.", text: "At its lowest, in year " + low.year + ", it needs about " + fmtMoney(-low.balanceEnd) + " more than the company holds. That assumes every trial succeeds on schedule and nothing is raised along the way, so real dilution usually starts sooner." };
}
