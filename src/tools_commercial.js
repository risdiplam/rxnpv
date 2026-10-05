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

// ── Launch tracker: Medicare spending as an uptake proxy ───────────────────
function LaunchTrackerTool({ activeCase, updateCase }) {
  const h = React.createElement;
  const [brand, setBrand] = React.useState("");
  const brandFromCase = useCasePrefill(activeCase, caseToolDefaults(activeCase).marketedDrug, brand, setBrand);
  const [programme, setProgramme] = React.useState("Part D");
  const [analogInput, setAnalogInput] = React.useState("");
  const [rows, setRows] = React.useState([]);        // [{result}] — the drug first, then analogs
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const seq = React.useRef(0);

  const run = async () => {
    if (!brand.trim()) return;
    const mine = ++seq.current;
    setLoading(true); setError(null); setRows([]);
    const names = [brand.trim()].concat(
      analogInput.split(",").map(s => s.trim()).filter(Boolean).slice(0, 3));
    const results = await Promise.all(names.map(n => fetchDrugSpending(n, { programme })));
    if (mine !== seq.current) return;      // superseded by a newer lookup
    const failed = results.find(r => !r.ok);
    if (failed) { setError(failed.error); setLoading(false); return; }
    setRows(results);
    setLoading(false);
  };

  const primary = rows[0];
  const money = (v) => v == null ? "—" : fmtMoney(v);

  return h("div", null,
    toolCard(h, [
      toolLabel(h, "Is the launch tracking?"),
      h(Note, { summary: "What Medicare spending is, and the three ways it is not revenue" },
        h("div", { style: { lineHeight: 1.6 } },
          "CMS publishes what Medicare paid for every drug, by brand, and — the part that makes this usable rather than historical — it publishes it quarterly, about one quarter behind. That is the only free, current, drug-level read on real-world uptake there is. ",
          h("b", null, "It is not revenue, and the gap is large in three directions: "),
          "it is Medicare only, so nothing commercial, Medicaid, cash or ex-US appears; it is gross of manufacturer rebates, the same 25–50% gap the revenue model's price-basis control exists for; and counts below eleven are suppressed, so a small launch reads blank rather than zero. Read the shape and the direction, never the level.")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 } },
        h("input", { type: "text", value: brand, placeholder: "brand name — e.g. Winrevair",
          "aria-label": "Brand name", onChange: e => setBrand(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
          style: { flex: "1 1 200px", padding: "9px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 13 } }),
        h("select", { value: programme, onChange: e => setProgramme(e.target.value), "aria-label": "Medicare program",
          style: { padding: "9px 10px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } },
          h("option", { value: "Part D" }, "Part D — pharmacy dispensed"),
          h("option", { value: "Part B" }, "Part B — clinic administered")),
        h("button", { onClick: run, disabled: loading || !brand.trim(),
          style: { padding: "9px 18px", borderRadius: 7, border: "1px solid var(--teal)", background: "var(--teal-bg)", color: "var(--teal)", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: brand.trim() ? 1 : 0.5 } },
          loading ? "Reading CMS…" : "Track it")),
      h("input", { type: "text", value: analogInput, placeholder: "optional: up to 3 analog brands to compare, comma separated",
        "aria-label": "Analog brand names", onChange: e => setAnalogInput(e.target.value), onKeyDown: e => { if (e.key === "Enter") run(); },
        style: { width: "100%", boxSizing: "border-box", marginTop: 8, padding: "8px 12px", borderRadius: 7, border: "1.5px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12 } }),
      h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
        "Part B covers what a clinician administers — infusions, injections given in a clinic. Part D covers what a pharmacy dispenses. A drug appears in one or the other, occasionally both, and picking the wrong one returns nothing rather than a zero."),
      h(CaseFilledNote, { activeCase, filled: [brandFromCase && "drug name"] })
    ]),

    error && toolCard(h, h("div", { style: UI.warnNote },
      error + " This is a connection problem, not a finding that the drug has no Medicare spending.")),

    primary && !primary.found && toolCard(h, h("div", { className: "prose", style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6 } }, primary.error)),

    primary && primary.found && h("div", null,
      toolCard(h, [
        toolLabel(h, primary.brand + (primary.generic ? " (" + primary.generic + ")" : "") + " — Medicare " + primary.programme),
        primary.freshness && primary.freshness.stale && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--warn)", lineHeight: 1.6, marginBottom: 8 } },
          "The newest period in this dataset is " + primary.freshness.latestPeriod + ", which is " + primary.freshness.monthsBehind
            + " months old. CMS mints a new dataset address for each release, so this is most likely the app pointing at a version that has stopped being updated rather than CMS having gone quiet."),
        h("div", { style: { overflowX: "auto" } },
          h("table", { style: { borderCollapse: "collapse", fontFamily: "var(--mono)", minWidth: 560 } },
            h("thead", null, h("tr", null, ["Period", "Medicare spend", "Beneficiaries", "Claims", "Spend/beneficiary", "vs like period"].map(t =>
              h("th", { key: t, style: { padding: "6px 10px", background: "var(--surface-2)", borderBottom: "1px solid var(--rule)", fontSize: 10, color: "var(--ink-3)", fontWeight: 500, textAlign: t === "Period" ? "left" : "right", whiteSpace: "nowrap" } }, t)))),
            h("tbody", null, primary.series.map((p, i) => h("tr", { key: i },
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-1)", whiteSpace: "nowrap" } },
                p.label, !p.isFullYear && h("span", { style: { color: "var(--warn)", fontSize: 10, marginLeft: 6 } }, "partial")),
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-1)" } }, money(p.spending)),
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-2)" } }, p.beneficiaries != null ? p.beneficiaries.toLocaleString() : "suppressed"),
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-2)" } }, p.claims != null ? p.claims.toLocaleString() : "—"),
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: "var(--ink-2)" } }, money(p.avgSpendPerBene)),
              h("td", { style: { padding: "6px 10px", borderBottom: "1px solid var(--rule)", fontSize: 11, textAlign: "right", color: p.growthVsComparable == null ? "var(--ink-3)" : p.growthVsComparable >= 0 ? "var(--green)" : "var(--red)" } },
                p.growthVsComparable == null ? "—" : (p.growthVsComparable >= 0 ? "+" : "") + (p.growthVsComparable * 100).toFixed(0) + "% vs " + p.comparableTo)
            ))))),
        primary.impliedAnnual != null && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8 } },
          "Implied annual run rate from " + primary.latest.label + ": " + money(primary.impliedAnnual)),
        h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 8 } },
          "The last column only ever compares periods covering the same number of quarters — a single quarter against a full year would show a collapse in a drug that is tripling. A run rate assumes the remaining quarters look exactly like the reported ones, which for a ramping launch understates it. " + primary.caveat)
      ]),

      toolCard(h, [
        toolLabel(h, rows.length > 1 ? "Against its analogs, indexed to first Medicare year" : "Trajectory"),
        (() => {
          const indexed = rows.filter(r => r.found && r.series.length).map((r, i) => ({
            result: r, i, points: indexToLaunch(r.series, r.dataStartYear)
          })).filter(x => x.points.length);
          const predating = indexed.filter(x => x.points[0].launchPredatesData);
          return h("div", null,
            h(ExportableBlock, { title: primary.brand + " — Medicare spending" },
              h(RevenueChart, {
                xPrefix: "", xAxisPrefix: "",
                series: indexed.map(x => ({
                  name: x.result.brand + (x.i === 0 ? "" : " (analog)") + (x.points[0].launchPredatesData ? " — already selling before the data starts" : ""),
                  color: COMMERCIAL_SERIES_COLORS[x.i % COMMERCIAL_SERIES_COLORS.length],
                  points: x.points.map(p => ({ v: p.spending, label: (rows.length > 1 ? "Y" + (p.periodsSinceFirst + 1) : p.label) }))
                })),
                height: 220, showLegend: true
              })),
            predating.length > 0 && h("div", { style: { fontSize: 10.5, fontFamily: "var(--sans)", color: "var(--warn)", lineHeight: 1.6, marginTop: 6 } },
              predating.map(x => x.result.brand).join(" and ") + (predating.length === 1 ? " was" : " were")
                + " already selling when this dataset begins, so “year 1” here is the first year CMS covers, not the launch year. "
                + (predating.length === 1 ? "That curve is a plateau" : "Those curves are plateaus")
                + " sitting where a ramp should be, which makes the comparison read backwards — use an analog launched inside the data window for a like-for-like ramp.")
          );
        })(),
        rows.length > 1 && h("div", { className: "prose", style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 } },
          h(LaunchShapeRows, { rows, activeCase, updateCase }),
          "Indexed to each drug's first year of Medicare spending, so launches from different years sit on the same axis. Year 1 is almost never a full commercial year — a drug approved in March shows nine months of it — so the first point understates every curve by a different amount depending on approval date. A mature analog's later years are its plateau, not its ramp."),
        rows.some(r => r.found && r.series.some(p => !p.isFullYear)) && h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--warn)", marginTop: 4 } },
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
      try { return { id: p.id, name: p.drugName || p.name, launchYearOffset: offset, revenueResult: getProgramRevenueResult(p, Math.max(20, COMPANY_CALENDAR_YEARS - offset + 2)) }; }
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
    ]))
  );
}

// Copy an analog's launch SHAPE into the open case (October 2026): the
// closest published curve and years to peak, never its dollars; offered for a
// Full revenue build, on confirmation, with the source kept on the curve.
function LaunchShapeRows({ rows, activeCase, updateCase }) {
  const h = React.createElement;
  const [confirm, setConfirm] = React.useState(null);
  const shapes = (rows || []).filter(r => r.found && r.series && r.series.length).map(r => ({ r, m: matchLaunchShape(indexToLaunch(r.series, r.dataStartYear)) }));
  if (!shapes.length) return null;
  const prog = activeCase && activeCase.programs && activeCase.programs.length === 1 ? activeCase.programs[0] : null;
  const full = prog && (prog.revenueMode || "quick") === "full";
  const rb = prog ? getRevenueBuild(prog) : null;
  return h("div", { className: "launch-shapes", style: { margin: "6px 0 10px", fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", lineHeight: 1.6 } },
    shapes.map(({ r, m }, i) => h("div", { key: i, style: { marginBottom: 4 } },
      h("b", null, r.brand + ": "),
      m.ok ? "closest launch shape is the " + m.profileLabel + " curve, " + m.yearsToPeak + " year" + (m.yearsToPeak === 1 ? "" : "s") + " to peak" + (m.stillRising ? " — still rising in its last full year, so that is a lower bound" : "") + " (" + m.fullYears + " full years of Medicare spending)." : "no shape to copy — " + m.reason + ".",
      m.ok && prog && updateCase && (full
        ? (confirm === i
            ? h("span", { "data-no-export": "" }, " Set " + (prog.drugName || prog.name) + "'s launch curve to " + m.profileLabel + ", " + m.yearsToPeak + " years (now " + (rb.launchCurve.profile || "median") + ", " + rb.launchCurve.yearsToPeak + ")? Timing moves the value. ",
                h("button", { type: "button", className: "link-btn", onClick: () => { updateCase({ ...activeCase, programs: [{ ...prog, revenueBuild: { ...rb, launchCurve: { ...rb.launchCurve, yearsToPeak: String(Math.min(10, Math.max(3, m.yearsToPeak))), profile: m.profile, source: "shape of " + r.brand + ", CMS Medicare spending, " + localDateStamp() } } }], updatedAt: Date.now() }); setConfirm(null); } }, "Confirm"), " ",
                h("button", { type: "button", className: "link-btn", onClick: () => setConfirm(null) }, "Cancel"))
            : h("button", { type: "button", className: "link-btn", "data-no-export": "", style: { marginLeft: 6 }, onClick: () => setConfirm(i) }, "Use this shape for " + (prog.drugName || prog.name)))
        : h("span", { style: { color: "var(--ink-3)" } }, " (a Quick revenue build has no launch curve to receive it)")))),
    h("div", { style: { color: "var(--ink-3)", fontSize: 10 } }, "A shape, not a level: copying it changes the launch curve and years to peak only, never price or patients. Medicare spending is gross of rebates and about a quarter behind, and a children's drug barely appears in it."));
}
