// ════════════════════════════════════════════════════════════════════════════
// ToolsView — interactive utilities that sit alongside (not inside) the DCF:
// M&A premium calculator, company lookup (EDGAR + CT.gov), competitor search,
// fully diluted market cap, cash runway, sensitivity analysis. Each tool can
// run fully standalone, or optionally import from / export to any open case —
// never required, always available via the case picker where it makes sense.
// ════════════════════════════════════════════════════════════════════════════

// ── Shared case picker — used by every tool's import/export controls ──
// Every tool works in the case open in the "Working in" bar (CaseContextBar),
// so a tool no longer carries its own case dropdown — that let one tool sit on
// a different case from the rest, or stay on an old case after a switch. The
// chip keeps the case named inside the tool card, so an exported card still
// says which case it came from. (cases / onChange are kept in the signature
// so the call sites read the same.)
function CasePicker({ cases, selectedId }) {
  const h = React.createElement;
  const c = (cases || []).find(x => x.id === selectedId);
  return h("span", { className: "case-chip", title: "Switch cases in the Working in bar at the top" },
    c ? ["Case: ", h("b", { key: "n" }, caseDisplayName(c))] : "No case open — open or create one in Workspace");
}
// The case a tool works in: always the open case. Returned in useState's shape
// ([id, setter]) so tools that used to hold their own copy read the same.
function useActiveCaseId(activeCase) {
  return [activeCase ? activeCase.id : "", () => {}];
}

// ── The workbench layout ───────────────────────────────────────────────────
// Tools grew to seventeen flat tabs across three groups, and the groups were
// organised by HOW a tool worked — static benchmark, computes against your
// case, hits an external API — which is an implementation detail rather than
// anything a reader is thinking about. Six workbenches replace them, organised
// by the QUESTION being asked, each holding two to four tools that are usually
// used together and can still be used alone.
//
// The tab identifiers are deliberately unchanged. Every cross-view deep link
// in the app (Partnership Economics -> Licensing Comps) and every internal one
// (Company Lookup -> Trial Watch, Asset Program -> Decoder) addresses a TOOL,
// and the workbench is derived from the tool rather than stored separately —
// so an existing link keeps working and cannot drift out of sync with the
// grouping. Tool LABELS are kept as they were too, for the same reason in the
// other direction: the grouping changed, the vocabulary did not, so nothing
// anyone already knows the name of has to be relearned. "Trial Decoder" also
// covers the results reader now, and "Launch & Actuals" is new.
const TOOL_WORKBENCHES = [
  { id: "trial", label: "Trial", question: "What is this trial, what can it prove, and what did it report?",
    tools: [["decoder", "Trial Decoder"], ["compare", "Compare Trials"], ["prReader", "Press-Release Reader"], ["asset", "Asset Program"], ["trialwatch", "Trial Explorer"], ["fdaLookup", "FDA Lookup"]] },
  { id: "science", label: "Science", question: "Is the target real, and what has been published about it?",
    tools: [["target", "Target Dossier"], ["literature", "Literature"]] },
  { id: "company", label: "Company", question: "Can this company reach its next catalyst, and who is buying or selling it?",
    tools: [["lookup", "Company Lookup"], ["calendar", "Catalyst Calendar"], ["runway", "Cash Runway"], ["runwayCatalyst", "Runway vs. Catalyst"]] },
  { id: "commercial", label: "Commercial", question: "It is already selling — is the launch tracking, and when does it end?",
    tools: [["commercial", "Launch & Actuals"], ["exclusivity", "Exclusivity / LOE"]] },
  { id: "valuation", label: "Valuation", question: "What is the case worth, and what is it most sensitive to?",
    tools: [["sensitivity", "Sensitivity"], ["binaryEvent", "Binary Event"], ["fdmc", "Diluted Market Cap"]] },
  { id: "benchmarks", label: "Benchmarks", question: "What have comparable deals and drugs actually done?",
    tools: [["ma", "M&A Premium"], ["peaksales", "Peak Sales Comps"], ["licensing", "Licensing Comps"]] }
];

function workbenchForTool(toolId) {
  return TOOL_WORKBENCHES.find(w => w.tools.some(t => t[0] === toolId)) || TOOL_WORKBENCHES[0];
}

function ToolsView({ cases, updateCase, activeCase, navRequest, onSelectCase, onOpenWorkspace, onReopen }) {
  const h = React.createElement;
  const [tab, setTab] = React.useState("decoder");
  // Set by Company Lookup's "Watch this trial" link and consumed once by
  // Trial Watch on arrival — entirely local to ToolsView since both tabs
  // are siblings here, no need to route this through App.
  const [pendingNctId, setPendingNctId] = React.useState(null);
  const goToTrialWatch = (nctId) => { setPendingNctId(nctId); setTab("trialwatch"); };
  const goToTrialDecoder = (nctId) => { setPendingNctId(nctId); setTab("decoder"); };

  // Cross-view navigation arriving from outside ToolsView (e.g. Partnership
  // Economics -> Licensing Comps). requestId changes on every request even
  // if the target tab is the same as before, so this fires every time.
  // A saved analysis being reopened carries its inputs; they are applied once
  // the tool has rendered (and again shortly after, for tools that fill from
  // the case on mount and would otherwise write over them).
  const rootRef = React.useRef(null);
  React.useEffect(() => {
    if (navRequest && navRequest.tab) setTab(navRequest.tab);
    if (navRequest && navRequest.restore) {
      const apply = () => applySavedInputs(rootRef.current, navRequest.restore);
      // A worked example also presses the tool's own button (Decode, Look up,
      // Compare …) once its inputs are in, so it opens showing a result.
      const run = () => {
        // Only the tool's own card: the tab row holds buttons like "Compare
        // Trials" that would otherwise match "Compare".
        const b = navRequest.run && rootRef.current && Array.prototype.find.call(rootRef.current.querySelectorAll("[data-export-section] button"),
          x => !x.disabled && !x.closest("[data-no-export]") && x.textContent.trim().indexOf(navRequest.run) === 0);
        if (b) b.click();
      };
      const t1 = setTimeout(apply, 60), t2 = setTimeout(apply, 400), t3 = setTimeout(run, 750);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [navRequest && navRequest.requestId]);

  const bench = workbenchForTool(tab);

  const toolEntry = bench.tools.find(([id]) => id === tab);
  return h("div", { ref: rootRef, "data-view": "tools", "data-tool-id": tab, "data-export-context": "Tools · " + bench.label + (toolEntry ? " · " + toolEntry[1] : ""), style: { maxWidth: "var(--app-max-width)", margin: "0 auto", padding: "24px 28px 60px" } },
    h(CaseContextBar, { cases, activeCase, onSelectCase, onOpenWorkspace }),
    h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 } },
      TOOL_WORKBENCHES.map(w => h("button", { key: w.id,
        // Selecting a workbench lands on its first tool, which is the one most
        // people want; the others are one click away on the row below.
        onClick: () => setTab(w.tools[0][0]),
        title: w.question,
        "aria-current": bench.id === w.id ? "page" : undefined,
        style: { padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12.5,
          border: "1px solid " + (bench.id === w.id ? "var(--teal)" : "var(--rule)"),
          background: bench.id === w.id ? "var(--teal-bg)" : "var(--surface)",
          color: bench.id === w.id ? "var(--teal)" : "var(--ink-2)", fontWeight: bench.id === w.id ? 700 : 400 } }, w.label))),

    h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 10 } }, bench.question),

    h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--rule)" } },
      bench.tools.map(([id, lbl]) => h("button", { key: id, onClick: () => setTab(id),
        "aria-current": tab === id ? "page" : undefined,
        style: { padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11.5,
          border: "1px solid " + (tab === id ? "var(--rule)" : "transparent"),
          background: tab === id ? "var(--surface-2)" : "transparent",
          color: tab === id ? "var(--ink-1)" : "var(--ink-3)", fontWeight: tab === id ? 700 : 400 } }, lbl))),

    tab === "ma" ? h(MaPremiumTool, { cases, updateCase, activeCase }) :
    tab === "lookup" ? h(CompanyLookupTool, { cases, updateCase, activeCase, onWatchTrial: goToTrialWatch }) :
    tab === "fdmc" ? h(FdmcTool, { cases, updateCase, activeCase }) :
    tab === "runway" ? h(RunwayTool, { cases, updateCase, activeCase }) :
    tab === "runwayCatalyst" ? h(RunwayVsCatalystTool, { cases, updateCase, activeCase }) :
    tab === "binaryEvent" ? h(BinaryEventTool, { cases, activeCase, updateCase }) :
    tab === "peaksales" ? h(PeakSalesCompsTool, { cases, updateCase, activeCase }) :
    tab === "licensing" ? h(LicensingCompsTool, { cases, updateCase, activeCase }) :
    tab === "calendar" ? h(CatalystCalendarTool, { cases, updateCase, activeCase }) :
    tab === "decoder" ? h(TrialDecoderTool, { activeCase, initialNctId: pendingNctId, onConsumedInitialNctId: () => setPendingNctId(null), onReopen }) :
    tab === "compare" ? h(TrialCompareTool, { activeCase }) :
    tab === "prReader" ? h(PressReleaseTool, { activeCase }) :
    tab === "target" ? h(TargetDossierTool, { activeCase }) :
    tab === "literature" ? h(LiteratureTool, { activeCase }) :
    tab === "asset" ? h(AssetProgramTool, { activeCase, onDecodeTrial: goToTrialDecoder, onWatchTrial: goToTrialWatch }) :
    tab === "commercial" ? h(CommercialTool, { cases, updateCase, activeCase }) :
    tab === "trialwatch" ? h(TrialWatchTool, { activeCase, updateCase, initialNctId: pendingNctId, onConsumedInitialNctId: () => setPendingNctId(null), onReopen }) :
    tab === "fdaLookup" ? h(FdaLookupTool, { activeCase }) :
    tab === "exclusivity" ? h(ExclusivityTool, { cases, updateCase, activeCase }) :
    h(SensitivityTool, { cases, updateCase, activeCase })
  );
}

// ── Shared helpers for tool cards (used by every tool component below) ──
// Every tool card is its own exportable section: PNG / PDF of the whole card
// (inputs as set, results, chart, caveats) and "+ Report" to snapshot it into
// a case's report. The title comes from the card's toolLabel heading.
function toolCard(h, children) {
  const kids = (Array.isArray(children) ? children : [children]).concat([h(SectionExportBar, { key: "__export" })]);
  return h.apply(null, ["div", { className: "export-section", "data-export-section": "", style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "18px 20px", marginBottom: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)" } }].concat(kids));
}
function toolLabel(h, t) {
  return h("div", { "data-section-title": "", style: { fontSize: 14, fontWeight: 600, fontFamily: "var(--sans)", color: "var(--ink-1)", letterSpacing: "-0.005em", marginBottom: 12 } }, t);
}

// A subhead inside a decoder card (the card's own title is toolLabel).
function decoderSubhead(first) {
  return { fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)", color: "var(--ink-1)", margin: (first ? 2 : 16) + "px 0 7px" };
}

// ── Text truncation shared by the Trial, Science and FDA tools ──
function truncateText(str, n) { return str.length > n ? str.slice(0, n) + "…" : str; }
// On-screen truncation that exports don't inherit: the full text rides along in
// data-full-text, which serializeSection() restores, and in a hover title.
function truncatedSpan(h, str, n) {
  str = str == null ? "" : String(str);
  if (str.length <= n) return str;
  return h("span", { title: str, "data-full-text": str }, str.slice(0, n) + "…");
}

