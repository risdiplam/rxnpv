// ════════════════════════════════════════════════════════════════════════════
// Tools → Trial workbench
// Trial Decoder (with the results reader), Asset Program, Trial Explorer, FDA Lookup.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── FDA Lookup: openFDA drug approval history, label summary, and
// adverse-event report volume. Moved here from the Simulation section — this
// is research about an already-approved (or already-filed) drug, the same
// kind of live-lookup work as Company Lookup and Trial Explorer, not a
// simulation. Ported from ts_app.js's vanilla-DOM renderFdaLookupTab/
// runFdaLookup with no functional change; the fuller version (all dates,
// complete label detail) is planned as a separate deepening pass. ──
function fmtFdaSubmissionDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "—";
  return yyyymmdd.slice(0, 4) + "-" + yyyymmdd.slice(4, 6) + "-" + yyyymmdd.slice(6, 8);
}

function FdaLookupTool({ activeCase }) {
  const h = React.createElement;
  const [drugName, setDrugName] = React.useState("");
  const fdaFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).marketedDrug, drugName, setDrugName);
  const [loading, setLoading] = React.useState(false);
  const [approval, setApproval] = React.useState(null);
  const [label, setLabel] = React.useState(null);
  const [adverseEvents, setAdverseEvents] = React.useState(null);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState(null);
  // Guards against an earlier, slower search overwriting a newer one: search
  // "Keytruda", correct yourself to "Opdivo", and whichever response happened
  // to land last used to win regardless of which you actually asked for.
  const reqSeq = React.useRef(0);

  const search = async () => {
    const name = drugName.trim();
    if (!name) return;
    const myReq = ++reqSeq.current;
    setLoading(true); setSearched(true); setError(null);
    setApproval(null); setLabel(null); setAdverseEvents(null);
    const [approvalR, labelR, aeR] = await Promise.allSettled([
      fetchApprovalHistory(name),
      fetchDrugLabel(name),
      fetchAdverseEventSummary(name, { limit: 25 })
    ]);
    if (myReq !== reqSeq.current) return; // a newer search has already started
    if (approvalR.status === "fulfilled") setApproval(approvalR.value);
    if (labelR.status === "fulfilled") setLabel(labelR.value);
    if (aeR.status === "fulfilled") setAdverseEvents(aeR.value);
    // Every one of these throws on a real failure rather than returning a
    // falsy result, and only the fulfilled branch was ever read — so an
    // openFDA outage left all three null and rendered the identical "no data
    // found" message a genuinely unknown drug gets. For an investing tool
    // that is a meaningful difference: "this drug has no FDA record" and "we
    // could not reach the FDA" should never look the same.
    const failures = [approvalR, labelR, aeR].filter(x => x.status === "rejected");
    if (failures.length) {
      const detail = (failures[0].reason && failures[0].reason.message) || "request failed";
      setError(failures.length === 3
        ? "Couldn't reach openFDA — " + detail + ". This is a connection problem, not a result: try again in a moment."
        : "Partial result — " + failures.length + " of 3 openFDA queries failed (" + detail + "). What's shown below is incomplete.");
    }
    setLoading(false);
  };

  const hasApproval = approval && approval.matches;
  const hasLabel = label && label.found;
  const hasAE = adverseEvents && adverseEvents.topReportedReactions.length > 0;
  // Only a genuine zero-result response counts as "not found" — never a failure.
  const noResults = searched && !loading && !error && !hasApproval && !hasLabel && !hasAE;

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search openFDA"),
      h("div", { style: UI.intro },
        "Live query against openFDA (free, public API). Pulls approval history, label summary, and adverse-event report volume for a brand or generic drug name."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("input", { type: "text", value: drugName, placeholder: "Brand or generic name", "aria-label": "Drug name", onChange: e => setDrugName(e.target.value),
          onKeyDown: e => { if (e.key === "Enter") search(); },
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: search, disabled: loading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }
        }, loading ? "Searching…" : "Search openFDA")
      ),
      h(CaseFilledNote, { activeCase, filled: [fdaFromCase && "drug name"] })
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote }, error)),

    noResults && toolCard(h, h("div", { style: UI.captionMd }, "No openFDA data found for that name. Try the exact brand or generic name.")),

    hasApproval && toolCard(h, [
      toolLabel(h, "Drugs@FDA approval history"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        approval.results.map((r, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", paddingBottom: 10, borderBottom: i < approval.results.length - 1 ? "1px solid var(--rule)" : "none" } },
          h("div", { style: { color: "var(--ink-1)", fontWeight: 700, marginBottom: 4 } }, (r.applicationNumber || "—") + " — " + (r.sponsorName || "unknown sponsor")),
          r.products.map((p, pi) => h("div", { key: pi, style: { color: "var(--ink-2)" } }, p.brandName + ": " + [p.dosageForm, p.route, p.marketingStatus].filter(Boolean).join(", "))),
          h("div", { style: { marginTop: 6, maxHeight: 220, overflowY: "auto" } },
            r.submissions.map((s, si) => h("div", { key: si, style: { color: "var(--ink-3)" } }, s.submissionType + " / " + s.submissionStatus + " — " + fmtFdaSubmissionDate(s.submissionStatusDate) + (s.reviewPriority ? " · " + s.reviewPriority : "")))
          )
        ))
      )
    ]),
    approval && !hasApproval && toolCard(h, h("div", { style: UI.captionMd }, "No Drugs@FDA approval-history match.")),

    hasLabel && toolCard(h, [
      toolLabel(h, "Label summary"),
      label.boxedWarning && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10, lineHeight: 1.6 } }, truncatedSpan(h, label.boxedWarning, 3000)),
      label.indicationsAndUsage && h("div", { style: { marginBottom: 10 } },
        h("div", { style: { ...UI.caption, marginBottom: 4 } }, "Indications and usage"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncatedSpan(h, label.indicationsAndUsage, 3000))
      ),
      label.warningsAndPrecautions && h("div", { style: { marginBottom: 10 } },
        h("div", { style: { ...UI.caption, marginBottom: 4 } }, "Warnings and precautions"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncatedSpan(h, label.warningsAndPrecautions, 3000))
      ),
      label.adverseReactionsSummary && h("div", null,
        h("div", { style: { ...UI.caption, marginBottom: 4 } }, "Adverse reactions (from label)"),
        h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, truncatedSpan(h, label.adverseReactionsSummary, 3000))
      )
    ]),

    hasAE && toolCard(h, [
      toolLabel(h, "Most-reported adverse events (FAERS)"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
        adverseEvents.topReportedReactions.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "3px 0", borderBottom: "1px solid var(--rule)" } },
          h("span", null, r.reaction), h("span", { style: { color: "var(--ink-3)" } }, r.reportCount.toLocaleString())
        ))
      ),
      h("div", { style: { ...UI.caption, marginTop: 8 } }, adverseEvents.caveat)
    ])
  );
}

// ── Asset programme view ───────────────────────────────────────────────────
// Every registered trial for one drug at once. Engine in assetProgram.js; this
// only lays it out. The evidence-base checklist sits at the top on purpose —
// the shape of a programme is what a reader should meet before the list.
function AssetProgramTool({ activeCase, onDecodeTrial, onWatchTrial }) {
  const h = React.createElement;
  const [drug, setDrug] = React.useState("");
  const drugFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).drugName, drug, setDrug);
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [openPhase, setOpenPhase] = React.useState(null);
  const seq = React.useRef(0);

  const run = async () => {
    if (!drug.trim()) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setSummary(null); setOpenPhase(null);
    const r = await fetchAssetProgram(drug, { pageSize: 100 });
    if (mine !== seq.current) return;      // superseded by a newer lookup
    if (!r.ok) setError(r.error); else { setSummary(r.summary); setOpenPhase(r.summary.phases.length ? r.summary.phases[0].phase : null); }
    setLoading(false);
  };

  const toneColor = (tone) => tone === "thin" ? "var(--warn)" : tone === "watch" ? "var(--red)"
    : tone === "solid" ? "var(--teal)" : "var(--ink-2)";
  const statusColor = (s) => /TERMINATED|WITHDRAWN|SUSPENDED/.test(s) ? "var(--red)"
    : /COMPLETED/.test(s) ? "var(--teal)" : "var(--ink-2)";

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "One asset, every trial"),
      h(Note, { summary: "Why look at a program rather than a trial" },
        h("div", { style: { lineHeight: 1.6 } },
          "Nobody holds a thesis about a trial; they hold one about an asset, and an asset is usually eight to forty trials across different sponsors, phases, indications and fates. Three things are invisible when you read them one at a time: how much of the program is randomized rather than single-arm, whether this is one focused indication or a platform being tried everywhere, and which trials were quietly stopped. ",
          "The checklist at the top is deliberately a set of counts with their own denominators and not a score. A single “evidence strength” number would need invented weights, and you would anchor on it instead of on the four facts underneath it.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: drug, placeholder: "drug name — add code names after a comma, e.g. zorevunersen, STK-001",
          "aria-label": "Drug or intervention name",
          onChange: e => setDrug(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 260px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: run, disabled: loading || !drug.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: drug.trim() ? 1 : 0.5 } },
          loading ? "Reading the registry…" : "Build the program")),
      h(CaseFilledNote, { activeCase, filled: [drugFromCase && "drug name"] })
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote },
      error + " This is a connection problem, not a finding that no trials exist.")),

    summary && summary.trialCount === 0 && toolCard(h, h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
      "The registry returned " + summary.scanned + " record" + (summary.scanned === 1 ? "" : "s") + " for that text, and none of them actually lists “" + summary.drugName + "” as an intervention. ClinicalTrials.gov's intervention search is a loose text match, so a name that only appears in a description will bring back other people's trials. Try the generic name, the brand name, or the development code.")),

    summary && summary.trialCount > 0 && h("div", null,
      toolCard(h, [
        toolLabel(h, "The evidence base for " + summary.drugName),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 10 } },
          summary.trialCount + " registered trial" + (summary.trialCount === 1 ? "" : "s")
            + " · " + summary.evidence.indicationCount + " indication" + (summary.evidence.indicationCount === 1 ? "" : "s")
            + " · " + summary.evidence.sponsorCount + " sponsor" + (summary.evidence.sponsorCount === 1 ? "" : "s")
            + (summary.droppedForName ? "  (" + summary.droppedForName + " search hit" + (summary.droppedForName === 1 ? "" : "s") + " dropped for not listing this intervention)" : "")),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          describeEvidenceBase(summary).map((l, i) =>
            h("div", { key: i, style: { borderLeft: "3px solid " + toneColor(l.tone), paddingLeft: 10, fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.6 } }, l.text))),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 10 } },
          summary.caveat
            + (summary.totalMatchedByRegistry > summary.pageSize
              ? "  The registry reports " + summary.totalMatchedByRegistry.toLocaleString() + " text matches and this read the first " + summary.pageSize + " of them."
              : ""))
      ]),

      summary.stopped.length > 0 && toolCard(h, [
        toolLabel(h, "Trials that stopped (" + summary.stopped.length + ")"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          summary.stopped.map((s, i) => h("div", { key: i, style: { borderLeft: "3px solid var(--red)", paddingLeft: 10 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)" } },
              s.nctId + " · " + s.phase + " · " + s.status + (s.enrollment ? " · n=" + s.enrollment.toLocaleString() : "")),
            h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.5, marginTop: 2 } }, truncatedSpan(h, s.title || "", 110)),
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: s.whyStopped ? "var(--warn)" : "var(--ink-3)", marginTop: 3 } },
              s.whyStopped ? "Reason given: " + s.whyStopped : "No reason registered.")))),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 10 } },
          "A sponsor stops a trial for business reasons — reprioritization, funding, a partner walking — about as often as for scientific ones, and the registered reason is frequently a single vague sentence or absent entirely. Read the reason, not the fact.")
      ]),

      toolCard(h, [
        toolLabel(h, "By phase"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
          summary.phases.map(p => h("div", { key: p.phase },
            h("button", { onClick: () => setOpenPhase(openPhase === p.phase ? null : p.phase),
              style: { width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--rule)", padding: "7px 0", cursor: "pointer",
                fontSize: 11.5, fontFamily: "var(--mono)", color: "var(--ink-1)" } },
              (openPhase === p.phase ? "▾ " : "▸ ") + p.label + " — " + p.count + " trial" + (p.count === 1 ? "" : "s")
                + (p.enrolled ? " · " + p.enrolled.toLocaleString() + " registered participants" : "")),
            openPhase === p.phase && h("div", { style: { display: "flex", flexDirection: "column", gap: 4, padding: "6px 0 10px 12px" } },
              p.trials.map(s => h("div", { key: s.nctId, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "5px 0", borderBottom: "1px solid var(--rule)" } },
                h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" } },
                  h("span", { style: { color: "var(--ink-1)" } }, s.nctId),
                  h("span", { style: { color: statusColor(s.status) } }, s.status),
                  s.enrollment != null && h("span", { style: { color: "var(--ink-3)" } }, "n=" + s.enrollment.toLocaleString()),
                  s.hasResults && h("span", { style: { color: "var(--teal)", fontSize: 10, fontWeight: 700 } }, "Results posted"),
                  s.allocation === "RANDOMIZED" && h("span", { style: { color: "var(--ink-3)", fontSize: 10 } }, "randomized"),
                  s.masking && s.masking !== "NONE" && h("span", { style: { color: "var(--ink-3)", fontSize: 10 } }, "blinded")),
                h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.5, marginTop: 2 } }, truncatedSpan(h, s.title || "", 110)),
                h("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 2 } },
                  [s.sponsor, (s.conditions || []).slice(0, 2).join(", "), s.startDate ? "started " + s.startDate : null].filter(Boolean).join(" · ")),
                h("div", { style: { display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" } },
                  onDecodeTrial && h("span", { onClick: () => onDecodeTrial(s.nctId), role: "button", tabIndex: 0,
                    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDecodeTrial(s.nctId); } },
                    style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--teal)", cursor: "pointer", textDecoration: "underline" } }, "Decode this trial →"),
                  onWatchTrial && h("span", { onClick: () => onWatchTrial(s.nctId), role: "button", tabIndex: 0,
                    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWatchTrial(s.nctId); } },
                    style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--teal)", cursor: "pointer", textDecoration: "underline" } }, "Watch it →"),
                  h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId, style: { fontSize: 10 } }, "→ Registry"))
              )))
          )))
      ]),

      summary.indications.length > 1 && toolCard(h, [
        toolLabel(h, "Where it is being tried (" + summary.indications.length + " registered conditions)"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
          summary.indications.slice(0, 30).map((ind, i) => h("span", { key: i,
            style: { fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-2)", background: "var(--surface-2)", borderRadius: 5, padding: "3px 8px" } },
            ind.condition + " · " + ind.trials))),
        summary.indications.length > 30 && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6 } },
          "…and " + (summary.indications.length - 30) + " more."),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } },
          "These are the sponsor's own registered condition strings, not a normalized vocabulary — the same disease often appears two or three ways, which inflates the count. Read the spread, not the number.")
      ])
    )
  );
}

// ── Trial results reader — the panels the decoder gains once a trial has
// actually reported. Deliberately rendered below the design cards, in that
// order, because the whole point is to read the architecture first and the
// outcome second. Engine in trialResults.js; this file only lays it out.
function TrialResultsPanels({ results, study, onReopen }) {
  const h = React.createElement;
  const [openSecondary, setOpenSecondary] = React.useState(false);
  const [openPeriods, setOpenPeriods] = React.useState(false);
  const [aeView, setAeView] = React.useState("serious");

  const pct = (x) => x == null ? "—" : (x * 100).toFixed(1) + "%";
  const num = (x) => x == null ? "—" : x.toLocaleString();
  const sevColor = (s) => s === "high" ? "var(--red)" : s === "medium" ? "var(--warn)" : "var(--ink-2)";
  const thS = { padding: "6px 10px", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" };
  const thL = Object.assign({}, thS, { textAlign: "left" });
  const tdS = { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-1)", textAlign: "right", whiteSpace: "nowrap" };
  const tdL = Object.assign({}, tdS, { textAlign: "left", whiteSpace: "normal", minWidth: 170 });
  const caveat = (t) => h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } }, t);
  const scroll = (child) => h("div", { style: { overflowX: "auto" } }, child);

  // "NA" is a real, meaningful answer for a median — it means the endpoint was
  // not reached — so the registered string is shown when it isn't a number,
  // rather than a dash that reads as missing data.
  const armValue = (a) => {
    if (a.value == null) return a.rawValue || "—";
    let s = String(a.value);
    if (a.lower != null && a.upper != null) s += "  [" + a.lower + " – " + a.upper + "]";
    else if (a.spread != null) s += "  ± " + a.spread;
    return s;
  };

  // A posted hazard ratio can seed the trial simulator (October 2026). Only
  // what the record holds: the ratio, its interval (as a normal prior's SD,
  // from the log-scale standard error), and the compared arms' sizes in the
  // order registered. The control arm's median is never seeded — the record
  // does not say which arm is the drug — so the simulator asks for it.
  const nct = study && study.protocolSection && study.protocolSection.identificationModule ? study.protocolSection.identificationModule.nctId : "";
  const seedButton = (a, nByGroup) => {
    const spec = typeof tsClassifyEffectParam === "function" ? tsClassifyEffectParam(a.paramType) : null;
    const hr = Number(a.value);
    if (!onReopen || !spec || spec.label !== "Hazard ratio" || !(hr > 0)) return null;
    const lo = Number(a.lower), hi = Number(a.upper);
    const z = { "90": 1.645, "95": 1.96, "99": 2.576 }[String(a.ciPct || "95")] || 1.96;
    const sd = lo > 0 && hi > lo ? hr * (Math.log(hi) - Math.log(lo)) / (2 * z) : null;
    const ns = (a.groupIds || []).map(g => nByGroup[g]).filter(v => v > 0);
    const inputs = [{ id: "endpointType", value: "timeToEvent" }, { id: "priorType", value: sd ? "normal" : "point" }, { id: "priorMean", value: hr.toFixed(3) }];
    if (sd) inputs.push({ id: "priorSd", value: sd.toFixed(3) });
    if (ns.length === 2) { inputs.push({ id: "nTreat", value: String(ns[0]) }, { id: "nControl", value: String(ns[1]) }); }
    inputs.push({ id: "medianControl", value: "" });
    inputs.push({ id: "priorSource", value: nct + "'s posted primary result (hazard ratio " + hr + (sd ? ", " + (a.ciPct || "95") + "% CI " + a.lower + "–" + a.upper : "") + "), read " + localDateStamp() + (ns.length === 2 ? "; arm sizes " + ns.join(" and ") + " in registered order" : "") });
    return h("button", { type: "button", "data-no-export": "", onClick: () => onReopen({ view: "simulation", simTab: "trialOutcome", inputs }),
      title: "Opens Trial Outcome / PoS with this hazard ratio as the prior; you enter the control arm's median",
      style: { marginTop: 6, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--teal)", background: "transparent", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer" } }, "Use as a simulator starting point →");
  };

  const analysisLine = (a, groupsById, nByGroup) => {
    const bits = [];
    bits.push((a.paramType || "Estimate") + " " + (a.value != null ? a.value : "—"));
    if (a.lower != null && a.upper != null) bits.push("(" + (a.ciPct || "95") + "% CI " + a.lower + " – " + a.upper + ")");
    if (a.pValue) bits.push(formatRegisteredP(a.pValue));
    const compared = (a.groupIds || []).map(g => groupsById[g]).filter(Boolean);
    // A sponsor can register an analysis naming FEWER than two arms — DAPA-HF
    // files its primary hazard ratio against `["OG001"]` alone. Printing that
    // single title where "A vs B" belongs reads as though the estimate runs
    // against nothing, or worse, as though that arm is the numerator. When the
    // record does not name both sides, it says so instead of implying one.
    const comparedLine = compared.length >= 2 ? compared.join(" vs ") : null;
    return h("div", { style: { marginTop: 8, paddingLeft: 10, borderLeft: "2px solid var(--teal)" } },
      h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-1)" } }, bits.join("   ")),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } },
        [comparedLine,
         a.method || null,
         a.comparisonType ? a.comparisonType.toLowerCase().replace(/_/g, " ") : null].filter(Boolean).join("  ·  ")),
      compared.length === 1 && h("div", { className: "prose", style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 } },
        "The sponsor registered only \u201C" + compared[0] + "\u201D against this comparison, so the record does not state which two arms the estimate runs between, or which way round. Read the direction from the per-arm numbers above rather than from the ratio."),
      compared.length === 0 && h("div", { className: "prose", style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 } },
        "No arms are registered against this comparison, so the record does not state what it was computed between."),
      a.crossesNull === true && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--warn)", marginTop: 4, lineHeight: 1.5 } },
        "This interval spans " + a.nullValue + ", the value meaning no difference — the data are consistent with no effect."),
      a.crossesNull === false && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } },
        "The interval excludes " + a.nullValue + " (no difference). That is a statement about this endpoint only."),
      a.comment && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 } }, a.comment),
      seedButton(a, nByGroup || {})
    );
  };

  const outcomeBlock = (o, key) => {
    const groupsById = {};
    (o.groups || []).forEach(g => { groupsById[g.id] = g.title; });
    return h("div", { key: key, style: { paddingTop: 12, marginTop: 12, borderTop: "1px solid var(--rule)" } },
      h("div", { style: { fontSize: 12.5, fontFamily: "var(--sans)", fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.5 } }, o.title),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 3 } },
        [o.timeFrame ? "at " + o.timeFrame : null,
         o.estimateType ? o.estimateType + (o.unit ? " (" + o.unit + ")" : "") : null,
         o.dispersionType || null].filter(Boolean).join("  ·  ")),
      o.population && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 } }, o.population),

      !o.posted
        ? h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--warn)", marginTop: 8, lineHeight: 1.6 } },
            "Registered as an endpoint but not reported in the results record. That is a gap, not a null result.")
      : o.layout === "simple"
        ? scroll(h("table", { style: { borderCollapse: "collapse", marginTop: 8, fontFamily: "var(--mono)", minWidth: 380 } },
            h("thead", null, h("tr", null, h("th", { style: thL }, "Arm"), h("th", { style: thS }, "n"), h("th", { style: thS }, o.unit || "Value"))),
            h("tbody", null, (o.arms || []).map((a, i) => h("tr", { key: i },
              h("td", { style: tdL }, groupsById[a.groupId] || a.groupId),
              h("td", { style: tdS }, num(a.n)),
              h("td", { style: tdS }, armValue(a)))))))
      : o.layout === "categories"
        ? scroll(h("table", { style: { borderCollapse: "collapse", marginTop: 8, fontFamily: "var(--mono)", minWidth: 380 } },
            h("thead", null, h("tr", null, h("th", { style: thL }, "Category"),
              (o.groups || []).map(g => h("th", { key: g.id, style: thS }, g.title)))),
            h("tbody", null, o.categoryRows.slice(0, 12).map((c, i) => h("tr", { key: i },
              h("td", { style: tdL }, c.title || "—"),
              (o.groups || []).map(g => {
                const m = (c.arms || []).find(a => a.groupId === g.id);
                return h("td", { key: g.id, style: tdS }, m ? armValue(m) : "—");
              }))))))
      : o.layout === "stratified"
        ? h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6 } },
            "Reported across " + o.classCount + " separate strata rather than as one number. Collapsing those into a single headline would be inventing a result the sponsor did not register — open the record to read them.")
        : h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 8 } }, "No measurements registered."),

      o.categoryRows && o.categoryRows.length > 12 && caveat("Showing the first 12 of " + o.categoryRows.length + " categories."),
      (o.analyses || []).map((a, i) => h("div", { key: i }, analysisLine(a, groupsById, Object.fromEntries((o.arms || []).filter(x => x.n > 0).map(x => [x.groupId, x.n]))))),
      o.posted && o.analyses.length === 0 && o.layout !== "stratified" && caveat("No between-group comparison was registered for this endpoint — the arms above are reported, the difference between them is not.")
    );
  };

  const flow = results.flow;
  const safety = results.safety;
  const flagList = resultsRedFlags(results, study);
  const aeRows = aeView === "serious"
    ? (safety && (safety.comparable ? safety.biggestSeriousGaps : safety.topSerious))
    : (safety && (safety.comparable ? safety.biggestOtherGaps : safety.topOther));

  const flowTable = (period) => scroll(h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 620 } },
    h("thead", null, h("tr", null,
      h("th", { style: thL }, "Arm"), h("th", { style: thS }, "Started"), h("th", { style: thS }, "Completed"),
      h("th", { style: thS }, "Left (excl. deaths)"), h("th", { style: thS }, "Deaths"),
      h("th", { style: thS }, "Left for an AE"), h("th", { style: thS }, "Lost to f/u"))),
    h("tbody", null, period.rows.map((r, i) => h("tr", { key: i },
      h("td", { style: tdL }, r.title),
      h("td", { style: tdS }, num(r.started)),
      h("td", { style: tdS }, num(r.completed) + (r.completionRate != null ? "  (" + pct(r.completionRate) + ")" : "")),
      h("td", { style: Object.assign({}, tdS, { color: r.nonDeathDiscontinuationRate != null && r.nonDeathDiscontinuationRate >= 0.2 ? "var(--warn)" : "var(--ink-1)" }) },
        num(r.nonDeathDiscontinued) + (r.nonDeathDiscontinuationRate != null ? "  (" + pct(r.nonDeathDiscontinuationRate) + ")" : "")),
      h("td", { style: tdS }, r.deaths == null ? "not registered" : num(r.deaths)),
      h("td", { style: tdS }, r.withdrewForAE == null ? "not registered" : num(r.withdrewForAE) + "  (" + pct(r.aeWithdrawalRate) + ")"),
      h("td", { style: tdS }, r.lostToFollowUp == null ? "not registered" : num(r.lostToFollowUp)))))));

  return h("div", null,
    h("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "26px 0 14px" } },
      h("div", { style: { height: 1, background: "var(--rule)", flex: 1 } }),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--teal)", } }, "What it actually reported"),
      h("div", { style: { height: 1, background: "var(--rule)", flex: 1 } })),

    // Under the divider, not a card of its own: one fold and one sentence.
    h("div", { style: { marginBottom: 14 } },
      h(Note, { summary: "How to read the results below" },
        h("div", { style: { lineHeight: 1.6 } }, "Everything above this line is the design as the sponsor registered it before the trial ran. Everything below is what got posted afterwards. The numbers are read straight out of ClinicalTrials.gov's structured results fields — nothing is inferred, and nothing here knows which arm is the investigational drug, so arms are named exactly as the sponsor named them and any difference is shown signed rather than described as good or bad. A measure reported across several strata is not collapsed into one headline number. Deaths are separated from every other reason for leaving, because in a serious indication most of an arm can be “did not complete — death”, and folding that into a dropout rate produces a large, confident, meaningless figure.")),
      caveat("Posted results are the sponsor's own submission. They are not peer reviewed, not audited, and often thinner than the eventual publication.")
    ),

    toolCard(h, [
      toolLabel(h, "Primary endpoint" + (results.primaryOutcomes.length > 1 ? "s (" + results.primaryOutcomes.length + ")" : "")),
      results.primaryOutcomes.length === 0
        ? h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
            "No outcome is registered as primary in the results record.")
        : h("div", null, results.primaryOutcomes.slice(0, 8).map((o, i) => outcomeBlock(o, i))),
      results.primaryOutcomes.length > 8 && caveat("Showing the first 8 of " + results.primaryOutcomes.length
        + " registered primary endpoints. A record with this many is usually a master protocol covering several sub-studies rather than one comparison.")
    ]),

    results.secondaryOutcomes.length > 0 && toolCard(h, [
      h("button", { onClick: () => setOpenSecondary(v => !v), "aria-expanded": openSecondary,
        style: { background: "none", border: "none", padding: "6px 0", minHeight: 24, cursor: "pointer", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", } },
        (openSecondary ? "▾" : "▸") + " Secondary endpoints (" + results.secondaryOutcomes.length + ")"),
      openSecondary
        ? h("div", null, results.secondaryOutcomes.slice(0, 10).map((o, i) => outcomeBlock(o, i)),
            results.secondaryOutcomes.length > 10 && caveat("Showing the first 10 of " + results.secondaryOutcomes.length + "."))
        : caveat("A secondary endpoint is not what the trial was powered on. It is worth reading and it is not what the trial proved.")
    ]),

    flow && flow.primaryPeriod && toolCard(h, [
      toolLabel(h, "Who finished — " + (flow.primaryPeriod.title || "participant flow")),
      flowTable(flow.primaryPeriod),
      caveat("“Left (excl. deaths)” removes deaths and any move into an open-label or extension period from the not-completed count, because neither is someone dropping out. The other columns are the sponsor's own registered reasons and can overlap with each other; “not registered” means the sponsor filed no such reason at all, which is not the same as filing zero."
        + (flow.primaryPeriod.groupsNotInPeriod ? "  " + flow.primaryPeriod.groupsNotInPeriod + " registered group(s) belong to a different period of this record and are not shown here." : "")),
      flow.multiPeriod && h("div", { style: { marginTop: 10 } },
        h("button", { onClick: () => setOpenPeriods(v => !v),
          style: { background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
          (openPeriods ? "▾" : "▸") + " This record has " + flow.periods.length + " periods — show the others"),
        openPeriods && h("div", null, flow.periods.filter(p => p !== flow.primaryPeriod).map((p, i) =>
          h("div", { key: i, style: { marginTop: 14 } },
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } }, p.title || "(untitled period)"),
            flowTable(p))))),
      flow.preAssignmentDetails && caveat("Before assignment: " + flow.preAssignmentDetails)
    ]),

    safety && toolCard(h, [
      toolLabel(h, "Safety as reported"),
      scroll(h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 520 } },
        h("thead", null, h("tr", null,
          h("th", { style: thL }, "Group"), h("th", { style: thS }, "Serious AE"),
          h("th", { style: thS }, "Other AE"), h("th", { style: thS }, "Deaths"))),
        h("tbody", null, safety.groups.map((g, i) => h("tr", { key: i },
          h("td", { style: tdL }, g.title),
          h("td", { style: tdS }, pct(g.serious.rate) + (g.serious.atRisk ? "  (" + num(g.serious.affected) + "/" + num(g.serious.atRisk) + ")" : "")),
          h("td", { style: tdS }, pct(g.other.rate) + (g.other.atRisk ? "  (" + num(g.other.affected) + "/" + num(g.other.atRisk) + ")" : "")),
          h("td", { style: tdS }, pct(g.deaths.rate) + (g.deaths.atRisk ? "  (" + num(g.deaths.affected) + "/" + num(g.deaths.atRisk) + ")" : ""))))))),
      caveat("For a drug that is not approved, this is the only real safety data that exists — FAERS has no denominator and a label does not exist yet. Denominators are the safety population, which is not the randomized population. Deaths are every death recorded in the safety window, not deaths attributed to the drug."
        + (safety.timeFrame ? "  Collected over: " + safety.timeFrame + "." : "")
        + (safety.comparable ? "" : "  This record registers " + safety.groups.length + " event groups, which usually means crossover or extension cohorts are included alongside the randomized arms — so these rows are not a clean two-arm comparison.")),

      h("div", { style: { display: "flex", gap: 8, marginTop: 16, marginBottom: 8, flexWrap: "wrap" } },
        ["serious", "other"].map(v => h("button", { key: v, onClick: () => setAeView(v),
          style: { padding: "5px 12px", borderRadius: 6, fontSize: 10, fontFamily: "var(--mono)", cursor: "pointer",
            border: "1px solid " + (aeView === v ? "var(--teal)" : "var(--rule)"),
            background: aeView === v ? "var(--teal-bg)" : "transparent",
            color: aeView === v ? "var(--teal)" : "var(--ink-3)" } },
          v === "serious" ? "Serious events (" + safety.seriousTermCount + ")" : "Other events (" + safety.otherTermCount + ")"))),

      (aeRows && aeRows.length)
        ? scroll(h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 560 } },
            h("thead", null, h("tr", null,
              h("th", { style: thL }, "Event"),
              safety.primaryGroups.map(g => h("th", { key: g.id, style: thS }, g.title.length > 26 ? g.title.slice(0, 24) + "…" : g.title)),
              safety.comparable && h("th", { style: thS }, "Difference"))),
            h("tbody", null, aeRows.map((e, i) => h("tr", { key: i },
              h("td", { style: tdL },
                h("div", null, e.term),
                e.organSystem && h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, e.organSystem)),
              // Every rate carries its denominator, as in the summary table
              // above: 50% of 4 and 50% of 400 are not the same finding (FIN-004).
              safety.primaryGroups.map(g => { const c = e.byGroup[g.id]; return h("td", { key: g.id, style: tdS },
                c ? pct(c.rate) + (c.atRisk ? "  (" + num(c.affected) + "/" + num(c.atRisk) + ")" : "") : "—"); }),
              safety.comparable && h("td", { style: Object.assign({}, tdS, { color: e.pairDiff == null ? "var(--ink-3)" : Math.abs(e.pairDiff) >= 0.05 ? "var(--warn)" : "var(--ink-2)" }) },
                e.pairDiff == null ? "—" : (e.pairDiff > 0 ? "+" : "") + (e.pairDiff * 100).toFixed(1) + " pt"))))))
        : h("div", { style: UI.captionMd }, "No events of this kind are registered."),

      caveat((safety.comparable
          ? "Ranked by the biggest gap between the two groups, signed as “" + safety.groups[0].title + "” minus “" + safety.groups[1].title + "”. CT.gov does not mark which group is the investigational arm — read that from the titles."
          : "Ranked by the highest rate in any group, because with more than two groups there is no single comparison to sign.")
        + (safety.frequencyThreshold != null
          ? "  Non-serious events only have to be listed once they reached " + safety.frequencyThreshold + "% of a group, so that list is a floor on what occurred, never a census."
          : "")
        + (safety.groups.length > safety.primaryGroups.length
          ? "  Showing the " + safety.primaryGroups.length + " groups with the largest safety populations, of " + safety.groups.length
            + " registered — and ranking against those, so a nine-patient re-treatment cohort cannot decide what the top row is."
          : ""))
    ]),

    toolCard(h, [
      toolLabel(h, "Results flags (" + flagList.length + ")"),
      flagList.length === 0
        ? h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
            "Nothing in the posted results tripped a flag — no differential dropout, no unreported primary, no interval spanning no-effect, no large safety gap between arms. That is a statement about the reported data only. It does not mean the effect is large, durable, or commercially relevant.")
        : h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
            flagList.map((f, i) => h("div", { key: i, style: { borderLeft: "3px solid " + sevColor(f.severity), paddingLeft: 10 } },
              h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700, color: sevColor(f.severity), marginBottom: 3 } }, f.label),
              h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, f.detail)))),
      caveat("These check the posted results. They are separate from the design flags above, which check the registered protocol, and from the red-flag checks on the Workspace, which check your own modeling inputs.")
    ]),

    (results.limitations || results.agreementRestriction) && toolCard(h, [
      toolLabel(h, "The sponsor's own caveats"),
      results.limitations && h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, results.limitations),
      results.agreementRestriction && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 } },
        "Publication agreement: " + results.agreementRestriction.toLowerCase().replace(/_/g, " ")
        + " — the sponsor retains some right to review or delay what investigators publish, which affects how quickly independent analysis of this trial appears."),
      caveat("This is the one caveat in the record written by the people who ran the trial, and it is routinely more candid than the press release was.")
    ])
  );
}

// ── Trial Decoder: one NCT, explained ──────────────────────────────────────
// The gap this fills: the app could already search trials and watch them for
// changes, but never explain one. Someone who has just read a press release
// and wants to know whether the trial behind it is any good had nowhere to go.
//
// Everything shown is derived from registered CT.gov fields only — see
// trialDecoder.js. Nothing here predicts success, and nothing is inferred
// from the sponsor or the drug.
function TrialDecoderTool({ activeCase, initialNctId, onConsumedInitialNctId, onReopen }) {
  const h = React.createElement;
  const [nctInput, setNctInput] = React.useState("");
  const nctFromCase = useCasePrefill(activeCase, initialNctId ? "" : caseToolDefaults(activeCase).leadNct, nctInput, setNctInput);
  const [loading, setLoading] = React.useState(false);
  const [decoded, setDecoded] = React.useState(null);
  const [raw, setRaw] = React.useState(null);
  const [results, setResults] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const seq = React.useRef(0);
  // Papers are a separate, explicit call: a trial lookup should not silently
  // become two API round trips, and plenty of the time the registered design
  // is all a reader wanted.
  const [papers, setPapers] = React.useState(null);
  const [papersLoading, setPapersLoading] = React.useState(false);
  const [papersError, setPapersError] = React.useState(null);
  const papersSeq = React.useRef(0);

  const loadPapers = async (nctId) => {
    const mine = ++papersSeq.current;
    setPapersLoading(true); setPapersError(null); setPapers(null);
    const r = await publicationsForTrial(nctId);
    if (mine !== papersSeq.current) return;
    if (!r.ok) setPapersError(r.error); else setPapers(r);
    setPapersLoading(false);
  };

  const run = async (nctId) => {
    const id = (nctId || nctInput).trim();
    if (!id) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setDecoded(null); setRaw(null); setResults(null);
    setPapers(null); setPapersError(null); papersSeq.current++;
    const r = await fetchStudyByNctId(id);
    if (mine !== seq.current) return;      // superseded by a newer lookup
    if (!r.ok) { setError(r.error); setLoading(false); return; }
    setRaw(r.study);
    setDecoded(decodeTrial(r.study));
    // The same response carries the results section when one exists, so the
    // readout costs no second call.
    setResults(r.results || null);
    setLoading(false);
  };

  // Arriving from a "decode this trial" link elsewhere — run immediately
  // rather than making the user paste an ID they just clicked.
  React.useEffect(() => {
    if (initialNctId) {
      setNctInput(initialNctId);
      run(initialNctId);
      if (onConsumedInitialNctId) onConsumedInitialNctId();
    }
  }, [initialNctId]);

  const sevColor = (s) => s === "high" ? "var(--red)" : s === "medium" ? "var(--warn)" : "var(--ink-2)";
  const factRow = (label, value, note) => h("div", { style: { display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)", alignItems: "baseline", flexWrap: "wrap" } },
    h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", minWidth: 150 } }, label),
    h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-1)", flex: "1 1 200px" } }, value),
    note && h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", flex: "1 1 100%", lineHeight: 1.5 } }, note)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Decode a trial"),
      h(Note, { summary: "New here? What this does and what it deliberately won't do" },
        h("div", { style: { lineHeight: 1.6 } }, "Paste a ClinicalTrials.gov ID and this lays out the trial's architecture in plain English: who's in it, what it's compared against, who's blinded, what the primary endpoint actually measures, and — the part worth reading — what the design can and cannot establish. Every line comes from fields the sponsor registered; where CT.gov is silent, this says “not stated” rather than assuming a default. It does not predict whether the trial will succeed, and it knows nothing about the company, the drug, or the stock. A clean design can still fail and a flawed one can still read out positive — the point is to see the design clearly before the result arrives and anchors you.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: nctInput, placeholder: "NCT number — e.g. NCT04368728",
          "aria-label": "ClinicalTrials.gov ID",
          onChange: e => setNctInput(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 260px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => run(), disabled: loading || !nctInput.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: nctInput.trim() ? 1 : 0.5 } },
          loading ? "Decoding…" : "Decode")
      ),
      h(CaseFilledNote, { activeCase, filled: [nctFromCase && "the lead trial"] })
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote }, error)),

    decoded && h("div", null,
      toolCard(h, [
        h("div", { style: { fontSize: 15, fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-1)", marginBottom: 4, lineHeight: 1.4 } }, decoded.title || decoded.nctId),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)", marginBottom: 12 } }, decoded.architecture),
        factRow("Sponsor", decoded.sponsor || "—"),
        factRow("Phase / status", (decoded.phase || "—") + " · " + (decoded.status || "—")),
        factRow("Condition", (decoded.conditions || []).join(", ") || "—"),
        factRow("Intervention", (decoded.interventions || []).join(", ") || "—"),
        factRow("Allocation", decoded.allocation.value,
          decoded.allocation.stated ? null : "CT.gov has no allocation registered for this trial — treat the architecture as unknown rather than assuming."),
        factRow("Masking", decoded.masking.value + (decoded.masking.who && decoded.masking.who.length ? " (" + decoded.masking.who.map(w => w.toLowerCase()).join(", ") + ")" : ""),
          decoded.masking.stated ? null : "Masking not registered."),
        factRow("Comparator", decoded.comparator.value),
        factRow("Arms", decoded.armCount
          ? decoded.armCount + (decoded.armLabels.length ? " — " + decoded.armLabels.slice(0, 4).join(" | ")
              + (decoded.armLabels.length > 4 ? "  … +" + (decoded.armLabels.length - 4) + " more" : "") : "")
          : "—",
          decoded.armCount > 6 ? "A trial with this many arms is usually a master protocol spanning several sub-studies rather than one comparison — read the registered arms directly before treating any single result as “the” outcome." : null),
        factRow("Enrollment", decoded.enrollment != null ? decoded.enrollment.toLocaleString() : "—"),
        decoded.endpoint.stated && factRow("Primary endpoint" + (decoded.endpoint.count > 1 ? "s (" + decoded.endpoint.count + ")" : ""),
          decoded.endpoint.items.slice(0, 5).map(o => o.measure + (o.timeFrame ? " @ " + o.timeFrame : "")).join("  •  ")
            + (decoded.endpoint.items.length > 5 ? "  … and " + (decoded.endpoint.items.length - 5) + " more" : ""),
          decoded.endpoint.subjective ? "This endpoint involves assessment or self-report rather than a hard event, which is why the masking line above matters."
            : decoded.endpoint.objective ? "This is a hard event or an independently assessed measure, so it is less sensitive to who knew what."
            : null),
        h("div", { style: { marginTop: 10 } },
          h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + decoded.nctId, style: { fontSize: 10 } }, "→ Full record on ClinicalTrials.gov"))
      ]),

      // One card, three parts: what the design can establish, what it cannot,
      // and its red flags. They were three cards, each with its own Export
      // button, and the flags card usually said only that there were none.
      toolCard(h, [
        toolLabel(h, "What the design can and cannot establish"),
        h("div", { style: decoderSubhead(true) }, "What this trial can establish"),
        decoded.canProve.length
          ? h("ul", { style: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 } },
              decoded.canProve.map((t, i) => h("li", { key: i, className: "prose", style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, t)))
          : h("div", { style: UI.captionMd }, "Not enough registered design detail to say."),
        h("div", { style: decoderSubhead() }, "What it cannot"),
        h("ul", { style: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 } },
          decoded.cannotProve.map((t, i) => h("li", { key: i, className: "prose", style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, t))),
        h("div", { style: decoderSubhead() }, "Design flags (" + decoded.redFlags.length + ")"),
        decoded.redFlags.length === 0
          ? h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
              "Nothing in the registered design tripped a flag. That is a statement about the architecture only — it says nothing about whether the drug works, whether the effect size assumed is realistic, or whether the trial will read out positive.")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
              decoded.redFlags.map((f, i) => h("div", { key: i, style: { borderLeft: "3px solid " + sevColor(f.severity), paddingLeft: 10 } },
                h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", fontWeight: 700, color: sevColor(f.severity), marginBottom: 3 } }, f.label),
                h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, f.detail)
              )))
      ]),

      results && h(TrialResultsPanels, { results: results, study: raw, onReopen }),

      !results && decoded.hasResults && toolCard(h, [
        h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--warn)", lineHeight: 1.6 } },
          "ClinicalTrials.gov marks this trial as having posted results, but the results section could not be read from the record. That is a parsing gap on this side, not a finding about the trial — open the record directly.")
      ]),

      !results && !decoded.hasResults && toolCard(h, [
        h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
          "No results are posted for this trial yet. When they are, this page gains what the endpoints returned, who finished and who left by arm, and the adverse events as reported — read against the design above rather than after it.")
      ]),

      toolCard(h, [
        toolLabel(h, "What has been published about this trial"),
        !papers && !papersLoading && !papersError && h("div", null,
          h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 10 } },
            "A registry record is what the sponsor filed. A publication is what survived review, and it carries the things the registry never does — the actual numbers in context, the limitations section, and whether anyone independent has since disagreed. This searches Europe PMC for papers naming this NCT number, most-cited first, because a trial's own primary report is almost always the one everything else cites."),
          h("button", { onClick: () => loadPapers(decoded.nctId),
            style: { padding: "7px 16px", borderRadius: 7, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" } },
            "Find the papers")),
        papersLoading && h("div", { style: UI.captionMd }, "Searching Europe PMC…"),
        papersError && h("div", { style: UI.warnNote },
          papersError + " This is a connection problem, not a finding that nothing has been published."),
        papers && h("div", null,
          h(LiteratureList, { result: papers,
            emptyText: "No indexed paper names this NCT number. For a trial that has not read out, that is expected. For one that reported years ago, it is worth noticing — either the result was never published, or it was published without citing its own registration." }),
          papers.rows.length > 0 && h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
            "These are papers that MENTION this NCT number, which is mostly other people's reviews. The trial's own report is usually the most-cited one here, but that is a heuristic and not a guarantee — check that the top result's title actually describes this trial before treating it as the primary publication."))
      ]),

      raw && toolCard(h, [
        h("button", { onClick: () => setShowRaw(v => !v), "aria-expanded": showRaw,
          style: { background: "none", border: "none", padding: "6px 0", minHeight: 24, cursor: "pointer", fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
          (showRaw ? "▾" : "▸") + " Registered fields this was derived from"),
        showRaw && h("pre", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-2)", background: "var(--surface-2)", padding: 10, borderRadius: 6, overflowX: "auto", marginTop: 8, lineHeight: 1.5 } },
          JSON.stringify({ allocation: raw.allocation, interventionModel: raw.interventionModel, masking: raw.masking,
            whoMasked: raw.whoMasked, armTypes: raw.armTypes, primaryOutcomes: raw.primaryOutcomesFull,
            enrollment: raw.enrollment, status: raw.status, primaryCompletionDate: raw.primaryCompletionDate,
            hasResults: raw.hasResults, whyStopped: raw.whyStopped }, null, 2))
      ])
    )
  );
}

// Emphasises a count inline without a wrapper span (which would inherit
// block display in some of these lists).
function h0(n) { return String(n); }

// ── Trial Explorer: comparable-trial search (ClinicalTrials.gov design/
// status landscape for a condition+phase) plus Trial Watch's snapshot-and-
// diff for a specific trial by NCT ID, in one tab — these are two sides of
// the same "what does the trial landscape around my thesis look like"
// question, one broad (search a condition) and one narrow (track one known
// trial), so they belong together rather than split across sections.
// Watchlist/snapshot state is not tied to any case — a real program can have
// several relevant trials and forcing a one-trial-per-program data model
// would be the wrong shape for that. First check on any NCT ID saves the
// baseline with nothing to compare yet — that's expected, not an error.
function TrialWatchTool({ activeCase, initialNctId, onConsumedInitialNctId, onReopen }) {
  const h = React.createElement;
  const [ctCondition, setCtCondition] = React.useState("non-small cell lung cancer");
  const [ctPhase, setCtPhase] = React.useState("PHASE2");
  const cd = caseToolDefaults(activeCase);
  const condFromCase = useCasePrefill(activeCase, cd.indication, ctCondition, setCtCondition, "non-small cell lung cancer");
  const casePhase = activeCase && activeCase.programs && activeCase.programs[0] && /^phase[123]$/.test(activeCase.programs[0].currentPhase) ? activeCase.programs[0].currentPhase.toUpperCase() : "";
  const phaseFromCase = useCasePrefill(activeCase, casePhase, ctPhase, setCtPhase, "PHASE2");
  const [ctIntervention, setCtIntervention] = React.useState("");
  const [ctLoading, setCtLoading] = React.useState(false);
  const [ctSummary, setCtSummary] = React.useState(null);
  const [ctError, setCtError] = React.useState(null);

  // Same out-of-order-response guard as Company Lookup: a slower earlier
  // search must not overwrite the results of a newer one.
  const compsSeq = React.useRef(0);

  // Analog effect-size board — a separate call from the status landscape above
  // because it needs the results section, which the landscape query
  // deliberately filters out for speed.
  const [effects, setEffects] = React.useState(null);
  const [effectsLoading, setEffectsLoading] = React.useState(false);
  const [effectsError, setEffectsError] = React.useState(null);
  const effectsSeq = React.useRef(0);
  // "Where does my number sit in that?" — the question a reader has the moment
  // the board finishes loading, in both directions: an assumption before a
  // readout, or a posted result afterwards.
  const [myEffect, setMyEffect] = React.useState("");

  const loadEffects = async () => {
    const mine = ++effectsSeq.current;
    setEffectsLoading(true); setEffectsError(null); setEffects(null);
    try {
      const r = await fetchAnalogEffects(ctCondition, ctPhase, { intervention: ctIntervention.trim() || undefined, pageSize: 50 });
      if (mine !== effectsSeq.current) return;
      setEffects(r);
    } catch (e) {
      if (mine !== effectsSeq.current) return;
      setEffectsError("Couldn't reach ClinicalTrials.gov for posted results: " + e.message + ". This is a connection problem, not a finding of no effect data.");
    }
    setEffectsLoading(false);
  };

  const searchComps = async () => {
    const myReq = ++compsSeq.current;
    setCtLoading(true); setCtError(null); setCtSummary(null);
    try {
      const summary = await fetchHistoricalComps(ctCondition, ctPhase, { intervention: ctIntervention.trim() || undefined, pageSize: 100 });
      if (myReq !== compsSeq.current) return;
      setCtSummary(summary);
    } catch (e) {
      if (myReq !== compsSeq.current) return;
      setCtError("ClinicalTrials.gov request failed: " + e.message);
    }
    setCtLoading(false);
  };

  const [nctInput, setNctInput] = React.useState("");
  const watchFromCase = useCasePrefill(activeCase, initialNctId ? "" : cd.leadNct, nctInput, setNctInput);
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [watchlist, setWatchlist] = React.useState(() => listWatchedTrials());

  const refreshWatchlist = () => setWatchlist(listWatchedTrials());

  const checkSeq = React.useRef(0);

  const check = async (nctId) => {
    const id = (nctId || nctInput).trim();
    if (!id) return;
    const myReq = ++checkSeq.current;
    setChecking(true); setError(null); setResult(null);
    const r = await checkTrialForChanges(id);
    if (myReq !== checkSeq.current) return; // a newer check has superseded this
    if (r.ok) { setResult({ ...r, nctId: id.toUpperCase() }); refreshWatchlist(); } else { setError(r.error); }
    setChecking(false);
  };

  // Arriving from Company Lookup's "Watch this trial" link — pre-fill and
  // run immediately, rather than making the user paste the NCT ID again
  // right after they just clicked it. Consumed once (parent clears the
  // pending value) so this doesn't re-fire on every re-render.
  React.useEffect(() => {
    if (initialNctId) {
      setNctInput(initialNctId);
      check(initialNctId);
      if (onConsumedInitialNctId) onConsumedInitialNctId();
    }
  }, [initialNctId]);

  const forget = (nctId) => { forgetTrialSnapshot(nctId); refreshWatchlist(); if (result && result.nctId === nctId) setResult(null); };

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Search comparable trials"),
      h("div", { style: UI.intro },
        "Live query against ClinicalTrials.gov (free, public v2 API). Shows the design and status landscape of comparable trials, not a win rate — CT.gov does not expose one."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: ctCondition, placeholder: "Condition", "aria-label": "Condition", onChange: e => setCtCondition(e.target.value),
          style: { flex: "1 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("select", { value: ctPhase, "aria-label": "Phase", onChange: e => setCtPhase(e.target.value),
          style: { padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "PHASE1" }, "Phase 1"), h("option", { value: "PHASE2" }, "Phase 2"),
          h("option", { value: "PHASE3" }, "Phase 3"), h("option", { value: "PHASE4" }, "Phase 4")),
        h("input", { type: "text", value: ctIntervention, placeholder: "Intervention (optional)", "aria-label": "Intervention", onChange: e => setCtIntervention(e.target.value),
          style: { flex: "1 1 180px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: searchComps, disabled: ctLoading,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: ctLoading ? "default" : "pointer" }
        }, ctLoading ? "Searching…" : "Search ClinicalTrials.gov")
      ),
      h(CaseFilledNote, { activeCase, filled: [condFromCase && "condition", phaseFromCase && "phase"] }),
      ctError && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)" } }, ctError),
      ctSummary && h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
          ctSummary.totalMatched + " matching trials on ClinicalTrials.gov (showing " + ctSummary.sampleSize + ")"),
        ctSummary.droppedUnrelated > 0 && h("div", { style: { ...UI.caption, marginBottom: 6 } }, conditionDropNote(ctSummary.droppedUnrelated, ctSummary.query.condition)),
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7 } },
          ctSummary.medianDurationMonths != null && h("div", null, "Median start-to-completion: " + ctSummary.medianDurationMonths + " months"),
          ctSummary.medianEnrollment != null && h("div", null, "Median enrollment: " + ctSummary.medianEnrollment)
        ),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 3, marginTop: 8 } },
          ctSummary.statusLandscape.map((s, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "3px 0", borderBottom: "1px solid var(--rule)" } },
            h("span", null, s.status), h("span", { style: { color: "var(--ink-3)" } }, s.count + " (" + (s.share * 100).toFixed(0) + "%)")
          ))
        ),
        h("div", { style: { ...UI.caption, marginTop: 8 } }, ctSummary.caveat),

        // ── Analog effect-size board ──────────────────────────────────────
        // The status landscape says how these trials ENDED. This says how big
        // the effects were, which is the reference class a modelled hazard
        // ratio should actually be read against.
        h("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 } },
            h("div", { style: UI.caption }, "Posted effect sizes"),
            h("button", { onClick: loadEffects, disabled: effectsLoading,
              style: { padding: "4px 12px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: effectsLoading ? "default" : "pointer" } },
              effectsLoading ? "Reading results\u2026" : (effects ? "Refresh" : "Load what these trials actually reported"))),
          !effects && !effectsLoading && !effectsError && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
            "A separate call, because posted results are excluded from the landscape query above for speed. This reads the structured analysis fields of trials that posted results, so you can see what winning has actually looked like here rather than only how often it happened."),
          effectsError && h("div", { style: { fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--warn)", lineHeight: 1.6 } }, effectsError),
          effects && h("div", null,
            h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 8 } },
              h("div", null, effects.sampleSize + " trials read \u00B7 " + effects.withPostedResults + " posted results \u00B7 " +
                h0(effects.withExtractableEffect) + " with a structured primary effect estimate"),
              effects.droppedUnrelated > 0 && h("div", { style: { color: "var(--ink-3)" } }, conditionDropNote(effects.droppedUnrelated, (effects.query && effects.query.condition) || ctCondition))),
            Object.keys(effects.summaryByScale).length === 0
              ? h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
                  "None of these trials registered a primary effect estimate in a form that can be read without guessing. That is common \u2014 many sponsors post results as narrative tables only \u2014 and it is reported here rather than hidden.")
              : Object.keys(effects.summaryByScale).map(scale => {
                  const sum = effects.summaryByScale[scale];
                  const rows = effects.byScale[scale];
                  if (!sum) return null;
                  return h("div", { key: scale, style: { marginBottom: 12 } },
                    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", fontWeight: 700, marginBottom: 4 } },
                      (scale === "ratio" ? "Ratio-scale endpoints" : "Difference-scale endpoints") + " (" + sum.n + ")"),
                    h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginBottom: 6 } },
                      "median " + sum.median.toFixed(2) + " \u00B7 range " + sum.min.toFixed(2) + " to " + sum.max.toFixed(2) +
                      " \u00B7 " + sum.intervalExcludesNull + " of " + sum.intervalReported + " with a CI excluding no-effect"),
                    // Starting points for the trial simulator's prior: hazard
                    // ratios only, offered, never filled on their own.
                    scale === "ratio" && onReopen && (() => {
                      const pre = analogPriorPresets(rows);
                      if (!pre) return null;
                      const cond = (effects.query && effects.query.condition) || ctCondition || "this search";
                      const open = (value, what) => onReopen({ view: "simulation", simTab: "trialOutcome", inputs: [
                        { id: "endpointType", value: "timeToEvent" }, { id: "priorType", value: "point" }, { id: "priorMean", value: value.toFixed(2) },
                        { id: "priorSource", value: "the analog board for \u201c" + cond + "\u201d (" + localDateStamp() + "): " + what + " of " + pre.n + " posted hazard ratio" + (pre.n === 1 ? "" : "s") + " — a percentile of what parsed, not of every trial" }] });
                      const b = (label, value, what, title) => h("button", { type: "button", title, onClick: () => open(value, what),
                        style: { padding: "3px 9px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, label);
                      return h("div", { className: "analog-presets", style: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-3)" } },
                        "Simulator prior from the " + pre.n + " hazard ratio" + (pre.n === 1 ? "" : "s") + ":",
                        b("median " + pre.median.toFixed(2), pre.median, "the class median", "Open Trial Outcome / PoS with the class median as a fixed prior"),
                        b("after Phase 2→3 discount " + pre.medianDiscounted.toFixed(2), pre.medianDiscounted, "the class median × " + pre.discountFactor + " (Phase 2→3 discount)", "The median moved toward no effect by the literature's average Phase 2→3 attenuation"),
                        b("cautious " + pre.cautious.toFixed(2), pre.cautious, "the cautious quartile (75th-percentile hazard ratio, the less favourable end)", "The 75th-percentile hazard ratio: closer to 1, so a deliberately cautious read of the same board"));
                    })(),
                    h("div", { style: { display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" } },
                      rows.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "4px 0", borderBottom: "1px solid var(--rule)" } },
                        h("span", { style: { flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                          r.nctId + " \u00B7 " + truncateText(r.outcomeTitle || "primary", 42)),
                        h("span", { style: { whiteSpace: "nowrap", color: r.crossesNull === false ? "var(--teal)" : "var(--ink-3)" } },
                          r.paramLabel + " " + r.value.toFixed(2) +
                          (r.lower != null && r.upper != null ? " (" + r.lower.toFixed(2) + "\u2013" + r.upper.toFixed(2) + ")" : "")))))
                  );
                }),
            // ── Where one number sits in the reference class ──────────────
            Object.keys(effects.byScale).length > 0 && h("div", { style: { marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--rule)" } },
              h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
                h("label", { style: { fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-2)" }, htmlFor: "analog-position-input" },
                  "Place a number in this distribution"),
                h("input", { id: "analog-position-input", type: "text", value: myEffect, placeholder: "e.g. 0.75",
                  "aria-label": "Effect size to place in the analog distribution",
                  onChange: e => setMyEffect(e.target.value),
                  style: { width: 110, padding: "5px 9px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } })),
              (() => {
                const v = parseFloat(myEffect);
                if (!isFinite(v)) return h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
                  "Your modeled effect before a readout, or the one a trial just posted. It is compared only against results on the same scale — a hazard ratio against hazard ratios, never against a mean difference.");
                return h("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 8 } },
                  Object.keys(effects.byScale).map(scale => {
                    const pos = positionInAnalogs(effects.byScale[scale], v);
                    if (!pos) return null;
                    const pct = Math.round(pos.percentile * 100);
                    // Deliberately not a verdict. Rank, denominator, and the
                    // one thing a percentile cannot tell you.
                    const read = pct >= 80
                      ? "More favorable than almost everything posted in this indication. That is a real claim about being better than the field, and it wants a specific reason — a mechanism, a biomarker-selected population, a genuinely different comparator."
                      : pct <= 20
                        ? "Towards the thin end of what has been posted here. It can still clear a p-value and still be a modest result, which is exactly the gap between statistically real and commercially interesting."
                        : "Squarely inside the range this indication has actually produced.";
                    return h("div", { key: scale, style: { borderLeft: "3px solid " + (pct >= 80 ? "var(--warn)" : "var(--teal)"), paddingLeft: 10 } },
                      h("div", { style: { fontSize: 11.5, fontFamily: "var(--mono)", color: "var(--ink-1)" } },
                        v + " is more favorable than " + pos.beats + " of " + pos.n + " posted "
                          + (scale === "ratio" ? "ratio-scale" : "difference-scale") + " results (" + pct + "th percentile)"
                          + (pos.ties ? ", and ties " + pos.ties : "")),
                      h("div", { style: { fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 2 } },
                        "median here is " + pos.median.toFixed(2) + ", range " + pos.min.toFixed(2) + " to " + pos.max.toFixed(2)
                          + (pos.favoursTreatment ? "" : " \u2014 and this number is on the wrong side of " + pos.nullValue + " altogether")),
                      h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 4, lineHeight: 1.6 } }, read));
                  }),
                  h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
                    "A percentile of " + effects.withExtractableEffect + " extractable results, not of every trial ever run here — and it says nothing about precision. A point estimate with a wide interval can sit high in this ranking and still be consistent with no effect.")
                );
              })()),
            h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 } }, effects.caveat))
        ),

        ctSummary.studies.length > 0 && h("div", { style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
          h("div", { style: { ...UI.caption, marginBottom: 8 } },
            "Matched trials (" + ctSummary.studies.length + ")"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" } },
            ctSummary.studies.map((s, i) => h("div", { key: s.nctId || i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)" } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                h("span", { style: { color: "var(--ink-1)" } }, (s.nctId || "—") + " · " + (s.phase || "—") + " · " + (s.status || "—")),
                s.hasResults && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId + "?tab=results", style: { fontSize: 10, color: "var(--teal)", fontWeight: 700 } }, "✓ Results posted →"),
                s.nctId && h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + s.nctId, style: { fontSize: 10 } }, "→ View on ClinicalTrials.gov"),
                s.nctId && h("span", { onClick: () => { setNctInput(s.nctId); check(s.nctId); },
                  role: "button", tabIndex: 0,
                  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNctInput(s.nctId); check(s.nctId); } },
                  style: { fontSize: 10, color: "var(--ink-3)", cursor: "pointer", textDecoration: "underline" } }, "Watch this trial →")
              ),
              h("div", null, (s.title || "untitled") + (s.sponsor ? " — " + s.sponsor : "") + (s.enrollment ? " · n=" + s.enrollment : ""))
            ))
          )
        )
      )
    ]),

    toolCard(h, [
      toolLabel(h, "Check a trial for changes"),
      h("div", { style: UI.intro },
        "Saves a snapshot of a trial's status, enrollment, completion date, and primary endpoint(s) each time you check — and compares against whatever was saved last time. The first check on any trial just sets the baseline; there's nothing to compare yet."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 } },
        h("input", { type: "text", value: nctInput, placeholder: "NCT12345678", onChange: e => setNctInput(e.target.value),
          onKeyDown: e => { if (e.key === "Enter") check(); },
          "aria-label": "ClinicalTrials.gov NCT identifier",
          // An NCT ID is a fixed 11-character identifier — it was stretching to
          // 638px to fill the row, which read as a free-text search box and
          // made a precise, single-value field look like something it isn't.
          style: { flex: "0 1 220px", padding: "7px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: () => check(), disabled: checking,
          style: { padding: "7px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: checking ? "default" : "pointer" }
        }, checking ? "Checking…" : "Check for changes")
      ),
      h(CaseFilledNote, { activeCase, filled: [watchFromCase && "the lead trial"] }),
      error && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", marginBottom: 10 } }, error),

      result && h("div", { style: { padding: "12px 14px", borderRadius: 8, background: "var(--surface-2)" } },
        h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 } },
          result.nctId + " — " + (result.study.title || "untitled") + " (" + result.study.status + ")"),
        result.baselinePredatesDesignFields && !result.isFirstSnapshot && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 8 } },
          "Your saved baseline for this trial was taken before the watch recorded allocation, masking and arm labels, so those three are not compared this time. They will be from the next check onward — this check has just re-saved the baseline with them."),
        result.isFirstSnapshot
          ? h("div", { style: UI.captionMd }, "First check — saved as the baseline. Check again later to see what's changed.")
          : result.changes.length === 0
            ? h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--teal)" } }, "No changes since the last check (" + fmtDate(result.previousCheckedAt) + ").")
            : (() => {
                // Ranked by what the change means, not by field order: an
                // endpoint swap and a status flip are not the same event.
                const sevColor = (sv) => sv === "high" ? "var(--red)" : sv === "medium" ? "var(--warn)" : "var(--ink-3)";
                const sevWord = (sv) => sv === "high" ? "changes what the trial can show"
                  : sv === "medium" ? "changes the terms" : "routine";
                const worth = result.changes.filter(c => c.severity === "high" || c.severity === "medium").length;
                return h("div", null,
                  h("div", { style: { ...UI.caption, marginBottom: 8 } },
                    result.changes.length + " change" + (result.changes.length === 1 ? "" : "s") + " since " + fmtDate(result.previousCheckedAt)
                      + (worth ? " — " + worth + " worth reading" : " — all routine") + ":"),
                  result.changes.map((c, i) => h("div", { key: i, style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-1)", padding: "6px 0 6px 9px", marginTop: i > 0 ? 4 : 0, borderLeft: "3px solid " + sevColor(c.severity) } },
                    h("b", { style: { color: sevColor(c.severity) } }, c.label),
                    h("span", { style: { color: "var(--ink-3)", fontSize: 10, marginLeft: 7 } }, "· " + sevWord(c.severity)),
                    c.note
                      ? h("div", { style: { marginTop: 3, fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.6 } }, c.note)
                      : c.from !== undefined
                        ? h("div", { style: { marginTop: 2 } }, h("span", { style: { color: "var(--ink-3)" } }, String(c.from)), " → ", h("span", { style: { color: "var(--amber)", fontWeight: 700 } }, String(c.to)))
                        : h("div", { style: { marginTop: 2 } },
                            c.removed.length > 0 && h("div", { style: { color: "var(--red)" } }, "− " + c.removed.join("; ")),
                            c.added.length > 0 && h("div", { style: { color: "var(--teal)" } }, "+ " + c.added.join("; "))
                          )
                  )),
                  h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 10 } },
                    "This compares your last two checks, not every revision the sponsor filed. CT.gov keeps a full version history; if something important moved, read it there rather than assuming this caught the whole sequence.")
                );
              })(),
        h(ExternalLink, { href: "https://clinicaltrials.gov/study/" + result.nctId, style: { fontSize: 10, marginTop: 8, display: "inline-block" } }, "→ View on ClinicalTrials.gov")
      )
    ]),

    watchlist.length > 0 && toolCard(h, [
      toolLabel(h, "Watched trials (" + watchlist.length + ")"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" } },
        watchlist.map(w => h("div", { key: w.nctId, style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--rule)", gap: 8 } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { color: "var(--ink-1)" } }, w.nctId + " (" + w.study.status + ")"),
            h("div", { style: { color: "var(--ink-3)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, (w.study.title || "") + " · last checked " + fmtDate(w.checkedAt))
          ),
          h("div", { style: { display: "flex", gap: 6, flexShrink: 0 } },
            h("button", { onClick: () => check(w.nctId), style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Re-check"),
            h(ConfirmXButton, { onConfirm: () => forget(w.nctId), title: "Stop watching this trial and discard its saved snapshot", label: "Forget", armedLabel: "Forget?", style: { padding: "4px 10px", fontSize: 10 } })
          )
        ))
      )
    ])
  );
}

// ── Compare trials ─────────────────────────────────────────────────────────
// Two to four registered trials side by side, from the same records and the
// same classifications the Trial Decoder uses (compareTrials in
// trialDecoder.js), including each sponsor's own primary analysis where one
// was posted. Rows where the first trial differs from every other are shaded.
// Typical use: a Phase 3 you are modelling next to the trials that got drugs
// approved in the same indication.
function TrialCompareTool({ activeCase }) {
  const h = React.createElement;
  const [input, setInput] = React.useState("");
  const cmpFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).nctIds.join(", "), input, setInput);
  const [loading, setLoading] = React.useState(false);
  const [cmp, setCmp] = React.useState(null);
  const [errors, setErrors] = React.useState([]);
  const seq = React.useRef(0);
  const ids = input.toUpperCase().match(/NCT\d{8}/g) || [];
  const unique = ids.filter((x, i) => ids.indexOf(x) === i).slice(0, 4);
  const run = async () => {
    if (unique.length < 2) return;
    const mine = ++seq.current;
    setLoading(true); setErrors([]); setCmp(null);
    const got = await Promise.all(unique.map(id => fetchStudyByNctId(id).then(r => ({ id, r }))));
    if (mine !== seq.current) return;
    setErrors(got.filter(g => !g.r.ok).map(g => g.id + ": " + g.r.error));
    const ok = got.filter(g => g.r.ok).map(g => ({ study: g.r.study, results: g.r.results }));
    setCmp(ok.length >= 2 ? compareTrials(ok) : null);
    setLoading(false);
  };
  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Compare trials side by side"),
      h(Note, { summary: "New here? What this does" },
        h("div", { style: { lineHeight: 1.6 } }, "Paste two to four ClinicalTrials.gov IDs — the first is the one you are studying — and this lines up how each was registered: design, patients, ages, primary endpoint and when it is measured, and the result each sponsor posted. Shaded rows are where the first trial differs from all the others. It reads the same fields as the Trial Decoder and adds nothing of its own: results are quoted as the sponsor registered them, and results on different measures are never ranked against each other.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: input, placeholder: "NCT numbers, e.g. NCT06872125, NCT02682927, NCT02091375", "aria-label": "ClinicalTrials.gov IDs to compare",
          onChange: e => setInput(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 360px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: run, disabled: loading || unique.length < 2,
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: unique.length >= 2 ? 1 : 0.5 } },
          loading ? "Fetching…" : "Compare " + (unique.length || "") + (unique.length ? " trials" : ""))),
      ids.length > 4 && h("div", { style: { ...UI.caption, marginTop: 6 } }, "Up to four trials at a time; the first four are used."),
      h(CaseFilledNote, { activeCase, filled: [cmpFromCase && "this case's trials" + (unique.length < 2 ? " (add the trials you want to compare against)" : "")] })
    ]),
    errors.length > 0 && toolCard(h, errors.map((e, i) => h("div", { key: i, style: UI.warnNote }, e))),
    cmp && toolCard(h, [
      toolLabel(h, cmp.cols.map(c => c.drugs[0] || c.nctId).join(" vs ")),
      h("div", { className: "proj-table-wrap" },
        h("table", { className: "proj-table cmp-table" },
          h("thead", null, h("tr", null,
            h("th", { scope: "col", className: "l" }, ""),
            cmp.cols.map((c, i) => h("th", { key: c.nctId, scope: "col", className: "l" + (i === 0 ? " first" : "") },
              c.drugs.slice(0, 2).join(" + ") || c.nctId,
              h("div", { className: "cmp-sub" }, c.nctId + " · " + (c.sponsor || "sponsor not stated")))))),
          h("tbody", null, cmp.rows.map(r => h("tr", { key: r.key, className: r.differs ? "differs" : "" },
            h("th", { scope: "row", className: "l" }, r.label),
            r.values.map((v, i) => h("td", { key: i, className: "l" }, v))))))),
      h(Explain, readTrialComparison(cmp)),
      h("div", { style: { ...UI.caption, marginTop: 8 } }, "Shaded: the first trial differs from every other. Figures are as registered on ClinicalTrials.gov; open any trial in the Trial Decoder for its full design, flow and safety tables.")
    ])
  );
}
