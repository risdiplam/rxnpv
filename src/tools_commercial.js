// ════════════════════════════════════════════════════════════════════════════
// Tools → Commercial workbench
// Launch & Actuals (launch tracker, actual vs modeled), Exclusivity / LOE.
// Split out of toolsView.js (September 2026); shared helpers (toolCard,
// toolLabel, CasePicker, truncateText) live there.
// ════════════════════════════════════════════════════════════════════════════

// ── Commercial workbench ───────────────────────────────────────────────────
// The half of the app that assumes a drug is already selling. Two tools that
// answer the two questions an early-commercial holder actually has: is the
// launch tracking against comparable launches, and is it tracking against my
// own model. Engines in cmsEngine.js and commercialEngine.js.
const COMMERCIAL_SERIES_COLORS = ["var(--teal)", "var(--amber)", "var(--ink-1)", "var(--red)"];

function CommercialTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [sub, setSub] = React.useState("launch");
  const subTab = (key, label) => h("button", { key: key, onClick: () => setSub(key),
    style: { padding: "7px 16px", borderRadius: 8, fontSize: 12, fontFamily: "var(--mono)", cursor: "pointer",
      border: "1px solid " + (sub === key ? "var(--teal)" : "var(--rule)"),
      background: sub === key ? "var(--teal-bg)" : "var(--surface)",
      color: sub === key ? "var(--teal)" : "var(--ink-2)", fontWeight: sub === key ? 700 : 400 } }, label);

  return h("div", null,
    h("div", { style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } },
      subTab("launch", "Launch tracker"),
      subTab("actual", "Actual vs modeled")),
    sub === "launch" ? h(LaunchTrackerTool, { activeCase, updateCase }) : h(ActualVsModelTool, { cases, updateCase, activeCase })
  );
}

// ── Launch tracker: public-payer spending as an uptake proxy ───────────────
// Medicare Part D and Part B, and Medicaid (October 2026: a children's drug
// barely appears in Medicare). "All public payers" puts them side by side
// with a total; each payer can also be read on its own. Engines in
// cmsEngine.js.
const PAYER_OPTIONS = [
  { value: "All", label: "All public payers — Medicare and Medicaid" },
  { value: "Part D", label: "Medicare Part D — pharmacy dispensed" },
  { value: "Part B", label: "Medicare Part B — clinic administered" },
  { value: "Medicaid", label: "Medicaid — every state" }
];

function launchLookup(name, payer) {
  if (payer === "All") return fetchPublicPayerSpending(name);
  if (payer === "Medicaid") return fetchMedicaidSpending(name);
  return resolveDrugIdentity(name).then(identity => fetchDrugSpending(name, { programme: payer, identity }));
}

// One drug's result, in the shape the chart, the indexing and the shape match
// read: a series of { label, year, spending } — the public total in All.
function launchView(result, payer) {
  if (!result || result.ok === false) return { ok: false, error: result && result.error };
  if (payer === "All") {
    return { ok: true, found: result.found, brand: result.brand, generic: result.generic, result,
      series: payerTotalSeries(result.combined), dataStartYear: result.dataStartYear, candidates: result.candidates || [] };
  }
  return { ok: true, found: result.found, brand: result.brand, generic: result.generic, result,
    series: (result.series || []).filter(p => !p.hidden && p.spending != null).map(p => Object.assign({}, p, { floor: !!p.floor })),
    dataStartYear: result.dataStartYear, candidates: result.candidates || [] };
}

function payerCell(p) {
  if (!p) return null;
  if (p.hidden) return "hidden";
  return (p.floor ? "≥ " : "") + fmtMoney(p.spending);
}

const LT_TH = { padding: "6px 10px", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)", fontWeight: 500, whiteSpace: "nowrap" };
const LT_TD = { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-2)" };
function growthCell(h, g, vs) {
  return h("td", { style: { ...LT_TD, color: g == null ? "var(--ink-3)" : g >= 0 ? "var(--green)" : "var(--red)" } },
    g == null ? "—" : (g >= 0 ? "+" : "") + (g * 100).toFixed(0) + "% vs " + vs);
}

// One payer's detail: Medicare counts patients, Medicaid counts prescriptions.
function PayerDetailTable({ result }) {
  const h = React.createElement;
  const medicaid = result.programme === "Medicaid";
  const cols = medicaid ? ["Period", "Medicaid spend", "Prescriptions", "Spend/prescription", "vs like period"]
    : ["Period", "Medicare spend", "Beneficiaries", "Claims", "Spend/beneficiary", "vs like period"];
  return h("div", { style: { overflowX: "auto" } },
    h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 560 } },
      h("thead", null, h("tr", null, cols.map(t => h("th", { key: t, style: { ...LT_TH, textAlign: t === "Period" ? "left" : "right" } }, t)))),
      h("tbody", null, result.series.map((p, i) => h("tr", { key: i },
        h("td", { style: { ...LT_TD, textAlign: "left", color: "var(--ink-1)", whiteSpace: "nowrap" } },
          p.label, !p.isFullYear && h("span", { style: { color: "var(--warn)", fontSize: 10, marginLeft: 6 } }, "partial"),
          p.source === "state file" && h("span", { style: { color: "var(--ink-3)", fontSize: 10, marginLeft: 6 } }, "state file")),
        h("td", { style: { ...LT_TD, color: p.hidden ? "var(--warn)" : "var(--ink-1)" } }, payerCell(p)),
        medicaid
          ? [h("td", { key: "rx", style: LT_TD }, p.hidden ? "—" : p.claims != null ? (p.floor ? "≥ " : "") + Math.round(p.claims).toLocaleString() : "—"),
             h("td", { key: "pc", style: LT_TD }, p.avgSpendPerClaim != null ? fmtMoney(p.avgSpendPerClaim) : "—")]
          : [h("td", { key: "b", style: LT_TD }, p.beneficiaries != null ? p.beneficiaries.toLocaleString() : (p.codes > 1 ? "—" : "suppressed")),
             h("td", { key: "c", style: LT_TD }, p.claims != null ? p.claims.toLocaleString() : "—"),
             h("td", { key: "pb", style: LT_TD }, p.avgSpendPerBene != null ? fmtMoney(p.avgSpendPerBene) : "—")],
        growthCell(h, p.growthVsComparable, p.comparableTo))))));
}

function LaunchTrackerTool({ activeCase, updateCase }) {
  const h = React.createElement;
  const [brand, setBrand] = React.useState("");
  const brandFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).marketedDrug, brand, setBrand);
  const [payer, setPayer] = React.useState("All");
  const [analogInput, setAnalogInput] = React.useState("");
  const [views, setViews] = React.useState([]);      // the drug first, then analogs
  const [ranPayer, setRanPayer] = React.useState("All");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const seq = React.useRef(0);

  const run = async (nameOverride) => {
    const first = String(nameOverride != null ? nameOverride : brand).trim();
    if (!first) return;
    if (nameOverride != null) setBrand(first);
    const mine = ++seq.current;
    setLoading(true); setError(null); setViews([]);
    const names = [first].concat(analogInput.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3));
    const results = await Promise.all(names.map(n => launchLookup(n, payer).catch(e => ({ ok: false, error: e.message }))));
    if (mine !== seq.current) return;      // superseded by a newer lookup
    const vs = results.map(r => launchView(r, payer));
    const failed = vs.find(v => !v.ok);
    if (failed) { setError(failed.error); setLoading(false); return; }
    setViews(vs); setRanPayer(payer);
    setLoading(false);
  };

  const primary = views[0];
  const all = ranPayer === "All";
  const payerName = all ? "public-payer" : ranPayer === "Medicaid" ? "Medicaid" : "Medicare";
  const sources = all && primary && primary.result ? primary.result.sources : [];
  const foundSources = sources.filter(s => s.result && s.result.found);
  const detailResults = all ? foundSources.map(s => s.result) : (primary && primary.found ? [primary.result] : []);
  const inputStyle = { padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 };

  const matchNote = (r) => {
    const bits = [];
    if (r.matchedBy === "generic") bits.push(r.programme + " lists it as " + r.brand + " — found by its generic name");
    if (r.stateFile && r.stateFile.matchedBy) bits.push("Medicaid's state file matched by " + (r.stateFile.matchedBy === "package codes"
      ? "the FDA's package codes (" + r.stateFile.products + " product" + (r.stateFile.products === 1 ? "" : "s") + ")"
      : "name only — the FDA's directory had no package codes for it, so a different drug starting with the same ten letters could be counted"));
    if (r.billingCodes > 1) bits.push("Part B lists it under " + r.billingCodes + " billing codes, added together (patients are not, since one patient can sit under both)");
    (r.stateFile ? r.stateFile.years : []).filter(y => y.error).forEach(y => bits.push("Medicaid's " + y.year + " state file could not be read (" + y.error + "), so " + y.year + " is missing rather than zero"));
    return bits;
  };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Is the launch tracking?"),
      h(Note, { summary: "What public-payer spending is, and the ways it is not revenue" },
        h("div", { style: { lineHeight: 1.6 } },
          "CMS publishes what Medicare and Medicaid paid for every drug. Medicare's figures come quarterly, about one quarter behind; Medicaid's state file about three months after each quarter, with CMS's cleaned annual summary behind it. Together they are the only free, current, drug-level read on real-world uptake — and for a children's drug Medicaid is most of it, since Medicare barely sees one. ",
          h("b", null, "It is not revenue: "),
          "commercial insurance, cash and ex-US are in neither; every figure is before the manufacturer's rebates (25–50% for Medicare, at least 23.1% of list for Medicaid); and small counts are hidden — Medicaid hides any package-quarter under eleven prescriptions, so a one-dose gene therapy reads ",
          h("i", null, "hidden"), ", never $0. Read the shape and the direction, never the level.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: brand, placeholder: "brand name — e.g. Winrevair",
          "aria-label": "Brand name", onChange: e => setBrand(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { ...inputStyle, flex: "1 1 200px" } }),
        h("select", { value: payer, onChange: e => setPayer(e.target.value), "aria-label": "Payer",
          style: { ...inputStyle, padding: "9px 10px", fontSize: 12 } },
          PAYER_OPTIONS.map(o => h("option", { key: o.value, value: o.value }, o.label))),
        h("button", { onClick: () => run(), disabled: loading || !brand.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: brand.trim() ? 1 : 0.5 } },
          loading ? "Reading CMS…" : "Track it")),
      h("input", { type: "text", value: analogInput, placeholder: "optional: up to 3 analog brands to compare, comma separated",
        "aria-label": "Analog brand names", onChange: e => setAnalogInput(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
        style: { ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 8, padding: "8px 12px", fontSize: 12 } }),
      h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
        "A brand or a generic name works — the FDA's drug directory finds the drug under either, and CMS's files, which spell names their own way (“Exondys-51”, “EXONDYS 51”), are searched under both. Part B covers what a clinician administers; Part D what a pharmacy dispenses; Medicaid both."),
      h(CaseFilledNote, { activeCase, filled: [brandFromCase && "drug name"] })
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote },
      error + " This is a connection problem, not a finding that the drug has no spending.")),

    primary && !primary.found && toolCard(h, [
      h("div", { key: "m", className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
        all ? "No Medicare or Medicaid record for “" + brand.trim() + "”. Try the trade name or the generic name. A drug with no record may not be covered yet, may be given only in hospital (inpatient drugs are paid inside the hospital's fee and never appear), or may fall under CMS's small-count rule."
          : (primary.result && primary.result.error)),
      primary.candidates.length > 0 && h("div", { key: "c", style: { marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } },
        "Did you mean:",
        primary.candidates.map(c => h("button", { key: c.brand, type: "button", className: "link-btn", onClick: () => run(c.brand) },
          c.brand + (c.generic ? " (" + c.generic.toLowerCase() + ")" : ""))))
    ]),

    primary && primary.found && h("div", null,
      all && toolCard(h, [
        toolLabel(h, primary.brand + (primary.generic ? " (" + primary.generic + ")" : "") + " — Medicare and Medicaid"),
        primary.result.failed.length > 0 && h("div", { style: { ...UI.warnNote, marginBottom: 8 } },
          primary.result.failed.map(f => f.label).join(" and ") + " could not be reached, so the totals below leave " + (primary.result.failed.length === 1 ? "it" : "them") + " out — a connection problem, not a finding."),
        (() => {
          const rows = primary.result.combined;
          return h("div", { style: { overflowX: "auto" } },
            h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 560 } },
              h("thead", null, h("tr", null,
                h("th", { style: { ...LT_TH, textAlign: "left" } }, "Period"),
                foundSources.map(s => h("th", { key: s.key, style: { ...LT_TH, textAlign: "right" } }, s.label)),
                h("th", { style: { ...LT_TH, textAlign: "right" } }, "Public total"),
                h("th", { style: { ...LT_TH, textAlign: "right" } }, "vs like period"))),
              h("tbody", null, rows.map((r, i) => h("tr", { key: i },
                h("td", { style: { ...LT_TD, textAlign: "left", color: "var(--ink-1)", whiteSpace: "nowrap" } },
                  r.label, !r.isFullYear && h("span", { style: { color: "var(--warn)", fontSize: 10, marginLeft: 6 } }, "partial")),
                foundSources.map(s => {
                  const p = r.values[s.key];
                  const txt = payerCell(p) || (r.noFigure.indexOf(s.key) >= 0 ? "no figure" : "—");
                  return h("td", { key: s.key, style: { ...LT_TD, color: p && p.hidden || r.noFigure.indexOf(s.key) >= 0 ? "var(--warn)" : "var(--ink-2)" } }, txt);
                }),
                h("td", { style: { ...LT_TD, color: "var(--ink-1)", fontWeight: 700 } }, r.total == null ? "hidden" : (r.complete ? "" : "≥ ") + fmtMoney(r.total)),
                growthCell(h, r.growthVsComparable, r.comparableTo))))));
        })(),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } },
          PAYER_SOURCES.filter(s => !foundSources.some(f => f.key === s.key) && !primary.result.failed.some(f => f.key === s.key)).map(s => s.label).join(" and ")
            ? "No record in " + PAYER_SOURCES.filter(s => !foundSources.some(f => f.key === s.key) && !primary.result.failed.some(f => f.key === s.key)).map(s => s.label).join(" or ") + ". " : "",
          "“≥” is a floor: part of it is hidden under CMS's small-count rule, or a payer has no figure yet for that period (not published, or too few claims — the files do not say which). “Hidden” means none of it can be read; it is never zero. Growth only compares two complete periods covering the same number of quarters. Medicare and Medicaid barely overlap for a drug: Medicare pays for a dual-eligible patient's pharmacy drugs, Medicaid does not."),
        foundSources.some(s => matchNote(s.result).length) && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
          foundSources.map(s => matchNote(s.result)).reduce((a, b) => a.concat(b), []).filter((x, i, arr) => arr.indexOf(x) === i).join(". ") + ".")
      ]),

      detailResults.map((r, di) => toolCard(h, [
        toolLabel(h, r.brand + (r.generic ? " (" + r.generic + ")" : "") + " — " + (r.programme === "Medicaid" ? "Medicaid" : "Medicare " + r.programme) + (all ? " detail" : "")),
        r.freshness && r.freshness.stale && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)", lineHeight: 1.6, marginBottom: 8 } },
          "The newest period in this record is " + r.freshness.latestPeriod + ", which is " + r.freshness.monthsBehind
            + " months old. CMS mints a new dataset address for each release, so this is most likely the app pointing at a version that has stopped being updated rather than CMS having gone quiet."),
        h(PayerDetailTable, { result: r }),
        r.impliedAnnual != null && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8 } },
          "Implied annual run rate from " + r.latest.label + ": " + fmtMoney(r.impliedAnnual)),
        !all && matchNote(r).length > 0 && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } }, matchNote(r).join(". ") + "."),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } },
          (r.programme === "Medicaid"
            ? "Whole years to " + (r.series.filter(p => p.source !== "state file").slice(-1)[0] || { label: "—" }).label + " are CMS's annual summary, totalled before small counts are hidden; later periods are the state file (national rows, fee for service and managed care), within a few percent of the summary where both cover a year. "
            : "The last column only ever compares periods covering the same number of quarters — a single quarter against a full year would show a collapse in a drug that is tripling. ")
          + "A run rate assumes the remaining quarters look exactly like the reported ones, which for a ramping launch understates it. " + r.caveat)
      ])),

      toolCard(h, [
        toolLabel(h, views.length > 1 ? "Against its analogs, indexed to first " + payerName + " year" : "Trajectory"),
        (() => {
          const indexed = views.filter(v => v.found && v.series.length).map((v, i) => ({
            v, i, points: indexToLaunch(v.series, v.dataStartYear)
          })).filter(x => x.points.length);
          const predating = indexed.filter(x => x.points[0].launchPredatesData);
          // One drug in All: a line per payer and the total, over the periods
          // every payer has a readable figure for.
          const byPayer = all && views.length === 1;
          const chartRows = byPayer ? primary.result.combined.filter(r => r.complete) : [];
          const left = byPayer ? primary.result.combined.filter(r => !r.complete).map(r => r.label) : [];
          const series = byPayer
            ? foundSources.map((s, i) => ({ name: s.label, color: COMMERCIAL_SERIES_COLORS[(i + 1) % COMMERCIAL_SERIES_COLORS.length],
                points: chartRows.map(r => ({ v: r.values[s.key] ? r.values[s.key].spending || 0 : 0, label: r.label })) }))
                .concat(foundSources.length > 1 ? [{ name: "Public total", color: COMMERCIAL_SERIES_COLORS[0], points: chartRows.map(r => ({ v: r.total, label: r.label })) }] : [])
            : indexed.map(x => ({
                name: x.v.brand + (x.i === 0 ? "" : " (analog)") + (x.points[0].launchPredatesData ? " — already selling before the data starts" : ""),
                color: COMMERCIAL_SERIES_COLORS[x.i % COMMERCIAL_SERIES_COLORS.length],
                points: x.points.map(p => ({ v: p.spending, label: (views.length > 1 ? "Y" + (p.periodsSinceFirst + 1) : p.label) }))
              }));
          return h("div", null,
            h(ExportableBlock, { title: primary.brand + " — " + payerName + " spending" },
              h(RevenueChart, { xPrefix: "", xAxisPrefix: "", series, height: 220, showLegend: true })),
            left.length > 0 && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
              "Left off the chart because part of the total cannot be read yet: " + left.join(", ") + " (see the table)."),
            predating.length > 0 && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--warn)", lineHeight: 1.6, marginTop: 6 } },
              predating.map(x => x.v.brand).join(" and ") + (predating.length === 1 ? " was" : " were")
                + " already selling when this record begins, so “year 1” here is the first year CMS covers, not the launch year. "
                + (predating.length === 1 ? "That curve is a plateau" : "Those curves are plateaus")
                + " sitting where a ramp should be, which makes the comparison read backwards — use an analog launched inside the data window for a like-for-like ramp."),
            views.some(v => v.series.some(p => p.floor)) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--warn)", marginTop: 4 } },
              "One or more points is a floor — part of it hidden under CMS's small-count rule — so the line is at least that high there.")
          );
        })(),
        views.length > 1 && h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
          h(LaunchShapeRows, { rows: views.map(v => Object.assign({}, v, { series: v.series.filter(p => !p.floor) })), activeCase, updateCase, sourceLabel: payerName }),
          "Indexed to each drug's first year of " + payerName + " spending, so launches from different years sit on the same axis. Year 1 is almost never a full commercial year — a drug approved in March shows nine months of it — so the first point understates every curve by a different amount depending on approval date. A mature analog's later years are its plateau, not its ramp."),
        views.some(v => v.found && v.series.some(p => !p.isFullYear)) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--warn)", marginTop: 4 } },
          "One or more points is a partial period plotted at its reported value, not annualized — the line dips there for a reporting reason, not a commercial one.")
      ])
    )
  );
}

// ── Actual vs modelled ─────────────────────────────────────────────────────
function ActualVsModelTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [caseId, setCaseId] = useActiveCaseId(activeCase);
  const theCase = (cases || []).find(c => c.id === caseId);
  const [draft, setDraft] = React.useState({ year: "", quarters: "4", revenueM: "" });

  const actuals = (theCase && theCase.actualRevenue) || [];
  const yearZero = (theCase && theCase.modelYearZero) || String(new Date().getFullYear());

  const save = (patch) => { if (theCase) updateCase(Object.assign({}, theCase, patch, { updatedAt: Date.now() })); };

  // Rebuilt exactly the way the Workspace builds it, so the numbers compared
  // here are the same ones the valuation used rather than a second derivation
  // that could drift.
  const calendar = React.useMemo(() => {
    if (!theCase || !theCase.programs || !theCase.programs.length) return [];
    const results = theCase.programs.map(p => {
      const offset = resolveLaunchYearOffset(p);
      try { return { id: p.id, name: programLabel(p, theCase.programs), launchYearOffset: offset, revenueResult: getProgramRevenueResult(p, Math.max(20, COMPANY_CALENDAR_YEARS - offset + 2)) }; }
      catch (e) { return null; }
    }).filter(Boolean);
    return results.length ? aggregateCompanyRevenue(results, COMPANY_CALENDAR_YEARS) : [];
  }, [theCase]);

  const series = actualVsModelSeries(calendar, actuals, yearZero);
  const cmp = series.comparison || compareActualToModel(calendar, actuals, yearZero);

  const addEntry = () => {
    const revenueUsd = parseFloat(String(draft.revenueM).replace(/[$,]/g, "")) * 1e6;
    const entry = normalizeActualEntry({ year: draft.year, quarters: draft.quarters, revenueUsd });
    if (!entry) return;
    save({ actualRevenue: actuals.filter(a => !(String(a.year) === String(entry.year) && String(a.quarters) === String(entry.quarters))).concat([entry]) });
    setDraft({ year: "", quarters: "4", revenueM: "" });
  };
  const removeEntry = (i) => save({ actualRevenue: actuals.filter((_, j) => j !== i) });

  const inputStyle = { padding: "8px 10px", borderRadius: 6, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 };

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Reported revenue against your own model"),
      h(Note, { summary: "Why a partial year needs saying so" },
        h("div", { style: { lineHeight: 1.6 } },
          "Three quarters of reported revenue against a full modeled year shows a 25% miss on a drug that is exactly on plan. That mistake is easy to make by hand and impossible to spot afterwards, so this only computes a direct comparison once four quarters are in — a partial year is compared on an explicitly-labeled run rate instead. ",
          "And the gap is a statement about your model as much as about the drug: a launch beating a conservative model and a launch beating a realistic one look identical from here.")),
      h("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 } },
        h(CasePicker, { cases, selectedId: caseId, onChange: setCaseId, placeholder: "Pick a case…" }),
        theCase && h("label", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6 } },
          "Model Year 0 =",
          h("input", { type: "text", value: yearZero, "aria-label": "Calendar year of model Year 0",
            onChange: e => save({ modelYearZero: e.target.value }),
            style: Object.assign({}, inputStyle, { width: 74 }) })))
    ]),

    theCase && calendar.length === 0 && toolCard(h, h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } },
      "This case has no program that produces a revenue projection yet, so there is nothing to compare against. Fill in a program's revenue build on the Workspace first.")),

    theCase && calendar.length > 0 && h("div", null,
      toolCard(h, [
        toolLabel(h, "Reported periods"),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 } },
          h("input", { type: "text", value: draft.year, placeholder: "year", "aria-label": "Calendar year",
            onChange: e => setDraft(Object.assign({}, draft, { year: e.target.value })), style: Object.assign({}, inputStyle, { width: 80 }) }),
          h("select", { value: draft.quarters, "aria-label": "Quarters reported",
            onChange: e => setDraft(Object.assign({}, draft, { quarters: e.target.value })), style: inputStyle },
            [1, 2, 3, 4].map(q => h("option", { key: q, value: String(q) }, q + (q === 4 ? " quarters (full year)" : q === 1 ? " quarter" : " quarters")))),
          h("input", { type: "text", value: draft.revenueM, placeholder: "revenue $M", "aria-label": "Reported revenue in millions",
            onChange: e => setDraft(Object.assign({}, draft, { revenueM: e.target.value })), onKeyDown: e => { if (e.key === "Enter") addEntry(); },
            style: Object.assign({}, inputStyle, { width: 130 }) }),
          h("button", { onClick: addEntry,
            style: { padding: "8px 16px", borderRadius: 6, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, cursor: "pointer" } }, "Add")),

        actuals.length === 0
          ? h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6 } },
              "Nothing entered yet. Take the product revenue line straight from the 10-Q or 10-K — total company revenue including collaboration and milestone income is a different number and will not compare to a revenue build.")
          : h("div", { style: { overflowX: "auto" } },
              h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 620 } },
                h("thead", null, h("tr", null, ["Year", "Reported", "Basis", "Your model", "Gap", ""].map(t =>
                  h("th", { key: t, style: { padding: "6px 10px", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)", fontWeight: 500, textAlign: t === "Year" || t === "Basis" ? "left" : "right", whiteSpace: "nowrap" } }, t)))),
                h("tbody", null, cmp.rows.map((r, i) => h("tr", { key: i },
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-1)" } }, r.year),
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-1)" } },
                    fmtMoney(r.actualUsd), r.impliedAnnualUsd != null && h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "→ " + fmtMoney(r.impliedAnnualUsd) + " annualized")),
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)" } }, r.comparisonBasis),
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-2)" } },
                    r.outsideModel ? "outside the model" : r.modelPreLaunch ? "pre-launch" : fmtMoney(r.modelledUsd)),
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", fontWeight: 700,
                      color: r.deltaVsModel == null ? "var(--ink-3)" : r.deltaVsModel >= 0 ? "var(--green)" : "var(--red)" } },
                    r.deltaVsModel == null ? "—" : (r.deltaVsModel >= 0 ? "+" : "") + (r.deltaVsModel * 100).toFixed(0) + "%"),
                  h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", textAlign: "right" } },
                    h(ConfirmXButton, { label: "Remove", armedLabel: "Click again", title: "Remove this reported period", onConfirm: () => removeEntry(i) }))
                )))))
      ]),

      cmp.rows.some(r => r.outsideModel) && toolCard(h, h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--warn)", lineHeight: 1.6 } },
        "At least one reported year falls outside the model's projection window. That almost always means Model Year 0 is set to the wrong calendar year rather than that the model is wildly off — check that first.")),

      toolCard(h, [
        toolLabel(h, "Modeled against reported"),
        h(ExportableBlock, { title: (theCase.name || "Case") + " — actual vs. modeled revenue" },
          h(RevenueChart, {
            xPrefix: "", xAxisPrefix: "",
            series: [
              { name: "Your model", color: "var(--teal)", points: series.modelled },
              { name: "Reported (partial years annualized)", color: "var(--amber)", points: series.actual.map(p => ({ v: p.v == null ? 0 : p.v, label: p.label })) }
            ],
            height: 220, showLegend: true
          })),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
          "A year with nothing reported is drawn at zero on the reported line — read the table above for which years actually have data, since the chart cannot draw a gap. " + cmp.caveat)
      ])
    )
  );
}

// ── Exclusivity / Loss of Exclusivity ──────────────────────────────────────
// The app already models revenue erosion AFTER loss of exclusivity, but the
// LOE year itself was a pure user guess. This replaces the guess with the real
// patent set FDA publishes for a comparable approved drug.
//
// Deliberately does NOT collapse to a single "LOE year". The last patent to
// expire is often a formulation or method-of-use patent a generic can design
// around or challenge under Paragraph IV; the drug SUBSTANCE (compound) patent
// is the hard floor. Showing both, labelled, is honest — one number would be
// false precision dressed up as sourced data.
// ── Patent term extension estimate (October 2026) ──────────────────────────
// The 10-K says "patents expire 2039, not including any extension". This puts
// the extension rules on that date (estimatePatentTermExtension, helpers.js)
// and sets it beside the regulatory floors.
function PatentTermEstimator({ activeCase }) {
  const h = React.createElement;
  const [f, setF] = React.useState({ expiry: "", ind: "", submitted: "", approval: "", issued: "" });
  const r = estimatePatentTermExtension(f);
  const prog = activeCase && activeCase.programs && (activeCase.programs.find(p => p.currentPhase === "filed") || activeCase.programs[0]);
  const biologic = prog && prog.modality === "biologic";
  const date = (key, label) => h("div", null, h("div", { style: UI.fieldLabel }, label), h("input", { type: "date", "aria-label": label, value: f[key], onChange: e => setF({ ...f, [key]: e.target.value }), style: { ...UI.input, minHeight: 28 } }));
  return toolCard(h, [
    toolLabel(h, "Patent term extension estimate"),
    h("div", { className: "prose", style: { ...UI.intro, marginBottom: 10 } }, "A drug patent can be extended for time lost to development: half of the testing phase (IND in effect until the NDA or BLA is submitted, counted only after the patent issued) plus all of the FDA review, at most five years, and never past fourteen years after approval. Only one patent per product. Enter the key patent's expiry from the 10-K and the dates as known or expected."),
    h("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
      date("expiry", "Patent expiry before extension"), date("ind", "IND in effect"), date("submitted", "NDA or BLA submitted"), date("approval", "Approval (or expected)"), date("issued", "Patent issued (optional)")),
    r && h("div", { style: { marginTop: 12 } },
      h("div", { style: UI.stat }, "Extended to " + r.extended),
      h("div", { style: UI.caption }, "Testing phase " + r.testing.toFixed(1) + " years (half counts: " + (r.testing / 2).toFixed(1) + ") + review " + r.approvalPhase.toFixed(1) + " years = " + r.raw.toFixed(1) + " years" + (r.binding === "five-year" ? ", cut to the five-year maximum" : "") + (r.binding === "fourteen-year" ? "; the fourteen-years-after-approval cap (" + r.cap14 + ") binds, so the extension is " + r.pteYears.toFixed(1) + " years" : "") + "."),
      h(Explain, { verdict: "Regulatory floors from this approval date: biologic 12 years to " + r.floors.biologic + ", orphan 7 to " + r.floors.orphan + ", new chemical entity 5 to " + r.floors.nce + ".",
        text: "Exclusivity effectively ends at the later of the extended patent (" + r.extended + ") and whichever floor applies" + (biologic ? " — for this case's biologic, " + (r.extended > r.floors.biologic ? r.extended + ", the patent" : r.floors.biologic + ", the 12-year floor") : "") + ". A patent can still be challenged or designed around; the floors cannot. Set the program's years to LOE to match (Assumptions → Exclusivity & LOE)." }))
  ]);
}

function ExclusivityTool({ cases, updateCase, activeCase }) {
  const h = React.createElement;
  const [name, setName] = React.useState("");
  const exFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).marketedDrug, name, setName);
  const [res, setRes] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const exRef = React.useRef(null);
  // Same guard as FdaLookupTool's reqSeq. Without it, looking up one brand and
  // then another let whichever response landed last win, so one drug's patent
  // table could paint under another's name — and its dates feed the LOE year
  // (FIN-006).
  const reqSeq = React.useRef(0);

  const run = async () => {
    if (!name.trim()) return;
    const myReq = ++reqSeq.current;
    setLoading(true); setRes(null);
    let r;
    try { r = await fetchExclusivity(name); }
    catch (e) { r = { ok: false, error: e.message }; }
    if (myReq !== reqSeq.current) return; // a newer lookup has already started
    setRes(r);
    setLoading(false);
  };
  const fmtDate = d => d ? d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") : "—";
  const fmtYears = y => y == null ? "" : (y < 0 ? "expired " + Math.abs(y).toFixed(1) + "y ago" : "in " + y.toFixed(1) + "y");

  const s = res && res.ok ? res.summary : null;
  const KeyDate = ({ label, row, tone, note }) => h("div", { style: { flex: "1 1 190px" } },
    h("div", { style: UI.caption }, label),
    h("div", { style: { fontSize: 24, fontFamily: "var(--mono)", fontWeight: 800, color: tone } }, row ? fmtDate(row.expiry) : "—"),
    row && h("div", { style: UI.caption }, fmtYears(row.yearsAway), " · US", row.patentNumber),
    note && h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 4, lineHeight: 1.45, maxWidth: 230 } }, note)
  );

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Exclusivity / loss of exclusivity"),
      h("div", { style: { marginBottom: 10 } },
        h(Note, { summary: 'New here? What to look up and why' },
          h("div", { style: { lineHeight: 1.6 } }, 'Search an already-approved drug that resembles the one you are modeling — same modality, similar class. What you are after is how long its protection actually ran, which is the sourced basis for the loss-of-exclusivity year in your revenue build instead of a guess. Use the brand name (Eliquis, not apixaban) since that is how the Orange Book indexes products. Two dates come back and they can be many years apart: the substance-patent floor is the compound patent, the hardest barrier for a generic to design around, and the last-expiry date includes formulation and method-of-use patents that are far easier to challenge. The substance floor is usually the more defensible read. Biologics are not in the Orange Book at all — the tool says so rather than returning an empty result.'))),
      h("div", { style: UI.intro },
        "Live patent expiry from FDA's Orange Book — where the LOE year comes from instead of a guess. Look up an approved comparable in the same class."),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("input", { "aria-label": "Brand name", value: name, placeholder: "Brand name — e.g. Eliquis, Jardiance, Uptravi",
          onChange: e => setName(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 300px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("button", { onClick: run, disabled: loading || !name.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: name.trim() ? 1 : 0.5 } },
          loading ? "Searching…" : "Look up")
      ),
      h(CaseFilledNote, { activeCase, filled: [exFromCase && "drug name"] }),
      h("div", { style: { ...UI.caption, marginTop: 8 } },
        "Small molecules only — the Orange Book does not cover biologics.")
    ]),

    res && !res.ok && toolCard(h, [
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: res.isBiologic ? "var(--ink-1)" : "var(--warn)" } }, res.error),
      res.biologicFloor && h("div", { className: "biologic-floor", style: { marginTop: 10, padding: "10px 12px", borderRadius: 7, background: "var(--surface-2)", fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6 } },
        h("div", null, h("b", null, "Statutory exclusivity floor: " + res.biologicFloor.floor), " — 12 years from first licensure on " + res.biologicFloor.firstLicensure + " (Drugs@FDA's earliest BLA approval)."),
        h("div", { style: UI.caption }, "A floor, not a patent expiry: biosimilar patent litigation can move the real date in either direction. If you have a better-sourced date, it goes in the program's Exclusivity & LOE years."))
    ]),

    s && h("div", { ref: exRef }, toolCard(h, [
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginBottom: 14 } },
        res.brandName.toUpperCase(), " · ", s.uniquePatentCount, " distinct patent", s.uniquePatentCount === 1 ? "" : "s",
        s.pediatricExtensionCount > 0 ? " + " + s.pediatricExtensionCount + " pediatric extension" + (s.pediatricExtensionCount === 1 ? "" : "s") : "",
        " across ", res.recordCount, " Orange Book listing", res.recordCount === 1 ? "" : "s"),

      h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 } },
        h(KeyDate, { label: "Substance patent floor", row: s.latestSubstance, tone: "var(--teal)",
          note: "The compound patent — the hardest to design around. Usually the most defensible read on when generics can realistically enter." }),
        h(KeyDate, { label: "Last patent to expire", row: s.latest, tone: "var(--amber)",
          note: "Includes formulation and method-of-use patents, which a generic may design around or challenge. Treat as an upper bound, not a promise." }),
        h(KeyDate, { label: "First patent to expire", row: s.earliest, tone: "var(--ink-2)",
          note: "The earliest date any listed protection lapses." })
      ),

      !s.latestSubstance && h("div", { style: { padding: "10px 12px", borderRadius: 7, background: "var(--warn-bg)", border: "1px solid var(--warn)", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-1)", lineHeight: 1.55, marginBottom: 14 } },
        "No patent here is flagged as a drug-substance (compound) patent — every listed patent is formulation or method-of-use. That's a genuinely weaker position: those are the patents most often designed around or challenged, so the last-expiry date above is a soft ceiling."),

      h("div", { style: { ...UI.caption, marginBottom: 8 } }, "All listed patents"),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" } },
        s.all.map((r, i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "7px 11px", borderRadius: 6, background: "var(--surface-2)" } },
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-1)" } },
            "US", r.patentNumber,
            r.isSubstance && h("span", { style: { color: "var(--teal)", marginLeft: 8, fontSize: 10 } }, "substance"),
            r.pediatric && h("span", { style: { color: "var(--amber)", marginLeft: 8, fontSize: 10 } }, "+6mo pediatric"),
            r.useCode && !r.isSubstance && h("span", { style: { color: "var(--ink-3)", marginLeft: 8, fontSize: 10 } }, "method-of-use")),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", flexShrink: 0 } },
            fmtDate(r.expiry), h("span", { style: { color: "var(--ink-3)", marginLeft: 8 } }, fmtYears(r.yearsAway)))
        ))
      ),

      h("div", { style: { marginTop: 14 } },
        h(Note, { summary: "Patent expiry is not the same as loss of exclusivity" },
          h("div", { style: { lineHeight: 1.6 } },
            "A generic can challenge a patent before it expires (Paragraph IV), settle for an earlier agreed entry date, or design around a formulation patent entirely. Separately, regulatory exclusivities — new chemical entity, orphan — can run past a patent. This is the published patent landscape: a sourced starting point, not the verdict.")))
    ])),
    h(PatentTermEstimator, { activeCase })
  );
}

// Copy an analog's launch SHAPE into the open case (October 2026): the
// closest published curve and years to peak, never its dollars; offered for a
// Full revenue build, on confirmation, with the source kept on the curve.
function LaunchShapeRows({ rows, activeCase, updateCase, sourceLabel }) {
  const h = React.createElement;
  const [confirm, setConfirm] = React.useState(null);
  const shapes = (rows || []).filter(r => r.found && r.series && r.series.length).map(r => ({ r, m: matchLaunchShape(indexToLaunch(r.series, r.dataStartYear)) }));
  if (!shapes.length) return null;
  const prog = activeCase && activeCase.programs && activeCase.programs.length === 1 ? activeCase.programs[0] : null;
  const full = prog && (prog.revenueMode || "quick") === "full";
  const rb = prog ? getRevenueBuild(prog) : null;
  // The launch curves run 3 to 10 years to peak; the confirmation names the
  // figure that will actually be written.
  const ytp = m => Math.min(10, Math.max(3, m.yearsToPeak));
  return h("div", { className: "launch-shapes", style: { margin: "6px 0 10px", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.6 } },
    shapes.map(({ r, m }, i) => h("div", { key: i, style: { marginBottom: 4 } },
      h("b", null, r.brand + ": "),
      m.ok ? "closest launch shape is the " + m.profileLabel + " curve, " + m.yearsToPeak + " year" + (m.yearsToPeak === 1 ? "" : "s") + " to peak" + (m.stillRising ? " — still rising in its last full year, so that is a lower bound" : "") + " (" + m.fullYears + " full years of " + (sourceLabel || "Medicare") + " spending)." : "no shape to copy — " + m.reason + ".",
      m.ok && prog && updateCase && (full
        ? (confirm === i
            ? h("span", { "data-no-export": "" }, " Set " + (prog.drugName || prog.name) + "'s launch curve to " + m.profileLabel + ", " + ytp(m) + " years" + (ytp(m) !== m.yearsToPeak ? " (the curves' " + (m.yearsToPeak < 3 ? "shortest" : "longest") + ")" : "") + " (now " + (rb.launchCurve.profile || "median") + ", " + rb.launchCurve.yearsToPeak + ")? Timing moves the value. ",
                h("button", { type: "button", className: "link-btn", onClick: () => { updateCase({ ...activeCase, programs: [{ ...prog, revenueBuild: { ...rb, launchCurve: { ...rb.launchCurve, yearsToPeak: String(ytp(m)), profile: m.profile, source: "shape of " + r.brand + ", CMS " + (sourceLabel || "Medicare") + " spending, " + localDateStamp() } } }], updatedAt: Date.now() }); setConfirm(null); } }, "Confirm"), " ",
                h("button", { type: "button", className: "link-btn", onClick: () => setConfirm(null) }, "Cancel"))
            : h("button", { type: "button", className: "link-btn", "data-no-export": "", style: { marginLeft: 6 }, onClick: () => setConfirm(i) }, "Use this shape for " + (prog.drugName || prog.name)))
        : h("span", { style: { color: "var(--ink-3)" } }, " (a Quick revenue build has no launch curve to receive it)")))),
    h("div", { style: { color: "var(--ink-3)", fontSize: 10 } }, "A shape, not a level: copying it changes the launch curve and years to peak only, never price or patients. The spending is gross of rebates and about a quarter behind; a children's drug barely appears in Medicare, so read it from Medicaid or the public total."));
}
