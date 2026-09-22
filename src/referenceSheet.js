// ════════════════════════════════════════════════════════════════════════════
// Reference Sheet — every benchmark used in the engine, with sources, plus
// forward-looking tables (PoS, discount rate) not yet wired into calculations
// but needed for judgment calls today and for the next build phases.
// ════════════════════════════════════════════════════════════════════════════
function ReferenceSheet({ activeCase }) {
  const h = React.createElement;
  const [tab, setTab] = React.useState("guide");
  const [rampYears, setRampYears] = React.useState(6);

  const card = (children) => h.apply(null, ["div", { style: { background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 10, padding: "18px 20px", marginBottom: 16 } }].concat(Array.isArray(children) ? children : [children]));
  const label = (t) => h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 } }, t);
  const src = (t) => h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 } }, t);
  const table = (headers, rows) => h("div", { style: { overflowX: "auto" } },
    h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--mono)" } },
      h("thead", null, h("tr", null, headers.map((hd, i) => h("th", { key: i, style: { textAlign: i === 0 ? "left" : "right", padding: "6px 10px", borderBottom: "1px solid var(--rule)", color: "var(--ink-3)", fontSize: 10, textTransform: "uppercase" } }, hd)))),
      h("tbody", null, rows.map((r, i) => h("tr", { key: i, style: { borderBottom: "1px solid var(--rule)" } },
        r.map((c, j) => h("td", { key: j, style: { padding: "7px 10px", textAlign: j === 0 ? "left" : "right", color: j === 0 ? "var(--ink-1)" : "var(--ink-2)" } }, c)))))
    ));

  // Running text is capped to a comfortable measure rather than the full
  // container width. At 12-13px the 880px column ran to roughly 95-105
  // characters per line; the readable range is about 65-80, and this page is
  // the one place in the app people actually read paragraphs rather than scan
  // numbers. Tables, charts and benchmark rows deliberately keep the full
  // width — a wide column helps a table and hurts prose.
  const PROSE = 660;
  // Progressive disclosure, applied once here rather than by rewriting every
  // entry: a feature's first sentence stays inline so the guide can be
  // SCANNED, and everything after it moves behind a toggle so nothing is lost.
  // The guide is where detail belongs — the problem was never that it existed,
  // only that all of it was visible at once, which turned a reference page
  // into a wall of prose.
  const featureBodyStyle = { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: PROSE };
  const FEATURE_INLINE_MAX = 190;
  const feature = (name, body) => {
    const wrap = (children) => h("div", { style: { marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--rule)" } },
      h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-1)", marginBottom: 3 } }, name),
      children);
    if (typeof body !== "string" || body.length <= FEATURE_INLINE_MAX) {
      return wrap(h("div", { style: featureBodyStyle }, body));
    }
    // Split on the first real sentence end that leaves a worthwhile remainder.
    // Naively splitting on any ".<space>" cut "…if success were certain vs."
    // mid-thought, because "vs." is an abbreviation, not a sentence end. A
    // sentence end here must be followed by a capital letter or digit AND not
    // be preceded by a short abbreviation-shaped token.
    const ABBREV = /(?:^|[\s(])(?:vs|cf|al|e\.g|i\.e|Ch|No|Fig|Dr|Mr|St|Inc|Co|approx|est|incl|Tbl|Eq)\.$/i;
    let split = null;
    const re = /[.?!]\s+(?=[A-Z0-9"'\u201C])/g;
    let mm;
    while ((mm = re.exec(body)) !== null) {
      const end = mm.index + 1;                       // include the punctuation
      if (end < 40) continue;                          // lead too short to stand alone
      if (ABBREV.test(body.slice(0, end))) continue;   // abbreviation, not a sentence end
      const rest = body.slice(mm.index + mm[0].length);
      if (rest.length < 60) break;                     // remainder too small to be worth hiding
      split = [body.slice(0, end), rest];
      break;
    }
    const m = split ? [null, split[0], split[1]] : null;
    if (!m) return wrap(h("div", { style: featureBodyStyle }, body));
    return wrap(h("div", null,
      h("div", { style: featureBodyStyle }, m[1]),
      h("details", { className: "note", style: { marginTop: 4 } },
        h("summary", null, "More on this"),
        h("div", { className: "note-body", style: { maxWidth: PROSE } }, m[2]))
    ));
  };

  const guideTab = () => h("div", null,
    card([
      label("What this is"),
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-1)", lineHeight: 1.7, maxWidth: PROSE } },
        "A bottoms-up rNPV (risk-adjusted net present value) valuation tool for pre-revenue and early-commercial biotech. The core idea: build revenue up from population → pricing → market share, then discount it by both time (a discount rate) AND probability of success — because most clinical-stage assets don't reach approval, so the model should reflect that directly rather than papering over it with an inflated discount rate. Every benchmark on every field is sourced and hoverable — this page is the map, not the sources themselves.")
    ]),
    card([
      label("Program Editor — building one asset"),
      feature("Quick vs. Detailed revenue build", "Quick: type in your own peak revenue estimate directly — a few minutes. Detailed: build revenue up from prevalence/incidence → diagnosed → treated → eligible → market share → pricing — a real bottoms-up model, more involved. Switch anytime; Cost Structure and Exclusivity sections auto-collapse in Quick mode (benchmarks still apply, just not shown) and auto-expand in Detailed."),
      feature("Cumulative PoS to launch", "The one major benchmark that isn't drug-specific by default — computed from phase-by-phase area benchmarks. Override it when you have a specific view (a validated biomarker, a concerning readout) that this asset differs from its area's average."),
      feature("Priority Review Voucher (PRV)", "Tied to this specific program's approval, risk-adjusted by its own PoS and discounted back from its launch year — a PRV is only real once the drug is approved, so it isn't treated as free money today."),
      feature("Exclusivity & Loss of Exclusivity", "When generic/biosimilar competition arrives and how much revenue and price it erodes. Small molecule vs. biologic timelines and erosion curves differ — both are benchmarked separately."),
      feature("Cost Structure", "COGS, sales force build-out, marketing — produces per-year product contribution before corporate G&A gets applied at the case level."),
      feature("Risk waterfall (bottom of the page)", "Shows this one asset's value if success were certain vs. its actual risk-adjusted value. For early-stage assets the \"certain\" number can come out lower — that's not a bug, it means paying the full R&D cost with certainty outweighs a distant, heavily-discounted payoff. A real feature of rNPV.")
    ]),
    card([
      label("Case Valuation — the whole company"),
      feature("Napkin vs. Full model", "Two presets, one click. Napkin: type a peak revenue directly, value it off a comp multiple — a fast sanity check. Full model: build peak revenue from epidemiology, then a bottoms-up DCF with real cost structure and timing. Both are still reachable a la carte (e.g. an epidemiology build valued off a multiple instead of a DCF) — the presets are the recommended default path, not the only path."),
      feature("DCF vs. Simple Multiple", "DCF is the full bottoms-up build everything else assumes. Simple Multiple is peak revenue × a comp multiple (2x/3x/5x, overridable per scenario), still PoS-risked and time-discounted the same way, but skips cost structure and year-by-year cash flows entirely — good for a quick cross-check, not a replacement. Cost Structure, R&D cost, Terminal Value, and Tax are all hidden or marked unused while Simple Multiple is active, since none of them feed that number; switching back to DCF brings them back. The precedent multiples are mostly post-approval deals, so applying one to a pre-approval program is flagged directly on the tab — a raw post-approval multiple is the wrong starting point for an early asset even after PoS-risking it."),
      feature("Bear / Base / Bull scenario cards", "Each scenario scales peak revenue, PoS, and discount rate together by preset multipliers — override any of them per case."),
      feature("Case-level Base-PoS adjustment", "A third, distinct PoS lever alongside the per-program override and the Bear/Bull multipliers above — an overarching multiplier on the whole case's odds (e.g. a management-team view, an area-wide headwind) that applies to Base too, not just Bear/Bull. Composes multiplicatively with everything else: a program's own override still sets its baseline, this shifts that baseline for the whole case, and Bear/Bull's 70%/130% still scale relative to wherever that leaves Base."),
      feature("Terminal value (optional)", "Off by default. Exit-multiple method models an acquisition at peak revenue, discounting back from the peak year — the growth-rate method usually overstates value for a single asset and fits an ongoing multi-program platform better."),
      feature("Capital structure & future capital raise", "Cash, debt, and diluted shares get you from enterprise value to per-share value. The future raise toggle models issuing new shares at an assumed price — applied to every scenario. Deliberately excluded from the Implied PoS solver, since that question is about what today's price implies, not a hypothetical future one."),
      feature("Implied PoS", "Solves backward from the case's current price: what probability of success would the market need to believe to justify today's valuation, given your revenue and cost assumptions. DCF mode only."),
      feature("Sum-of-the-Parts (SOTP)", "For multi-program cases — which program is actually driving total value, run standalone, with corporate G&A shown separately. DCF mode only, and reconciles exactly with the Base-case enterprise value shown above it."),
      feature("EV → Per-Share bridge", "Walks from enterprise value through PRV, cash, and debt to a final per-share number — works in either valuation method.")
    ]),
    card([
      label("Reference Sheet — the other 7 tabs"),
      feature("Revenue Build, Cost Structure, R&D & Timeline, Probability of Success, Discount Rate", "Every benchmark the engine uses, with the source table and methodology behind each one — the same numbers shown as hover tooltips throughout the Workspace, laid out in full here."),
      feature("Valuation & Dilution", "DCF mechanics reference plus dilution-related benchmarks (options, warrants, converts)."),
      feature("M&A Comps", "Real acquisitions, filterable, exportable to CSV — plus your own custom deal comps (see below).")
    ]),
    card([
      label("Tools — calculators and live lookups"),
      feature("M&A Premium", "What premium would a case need to be acquired at, benchmarked against real deals — includes a deal-value-vs-premium scatter chart with your case highlighted."),
      feature("Peak Sales Comps, Licensing Comps", "Real drugs' actual (or clearly-labeled consensus) peak sales, and real licensing/royalty deal terms — both exportable straight into a program (peak revenue, or the Partnership Economics overlay), both with an on-demand real FDA approval lookup where relevant, and both with your own custom entries (see below). Peak Sales Comps also ranks your own case's modeled peak revenue against the comps nearest it, so you can see at a glance what that assumption is implicitly claiming to be comparable to."),
      feature("Diluted Market Cap (FDMC)", "Fully-diluted market cap accounting for options, warrants, and convertible debt — exportable straight into a case's capital structure."),
      feature("Cash Runway", "Two distinct numbers, not one: trailing runway from real EDGAR burn data, and forward-looking runway projected from this case's own modeled R&D costs — deliberately unrisked, since \"when do we run out of money\" is a cash-forecasting question, not a valuation one."),
      feature("Runway vs. Catalyst", "Crosses the runway this case already models against the dated catalysts in its calibration log, to answer the question a fair-value number can't: does the company actually reach the readout without financing first? Three states rather than a yes/no — funded, tight (reaches it, but with less than your required cushion left), and gap (runs out first) — because a company cannot realistically raise on fumes, so \"technically reaches it\" and \"funded through it\" are different claims. Undated catalysts are excluded and counted, never guessed at."),
      feature("Binary Event", "For a company trading into one binary readout. Given the success-case value, the failure-case value and today's price, the probability the market is already pricing solves exactly — p = (current − fail) ÷ (success − fail) — and that figure is also your breakeven. Enter your own PoS to see the gap, which is the actual thesis. An implied probability outside 0–100% is reported rather than clamped, because that's the most informative outcome: it means the market disputes one of your two anchors, not your odds."),
      feature("Sensitivity", "A tornado chart (one driver at a time) plus a full price-target grid (Peak Revenue × PoS, every combination at once) — the two-way sensitivity table."),
      feature("Company Lookup", "Pulls real financials and insider (Form 4) transactions from SEC EDGAR (desktop only), and searches ClinicalTrials.gov for a company's trials or a whole indication's competitive landscape."),
      feature("Catalyst Calendar", "Estimated trial completion dates from ClinicalTrials.gov, plus a search of each company's own SEC filings for catalyst language (PDUFA, topline results, advisory committee) — finds where a company has already mentioned a catalyst, not a calendar of unannounced dates."),
      feature("Trial Explorer", "A condition/phase search of ClinicalTrials.gov's real design and status landscape (not a win rate — CT.gov doesn't expose one) for comparable trials, with direct links to each one, plus a snapshot-and-diff watchlist for any specific trial by NCT ID — checks its status, enrollment, completion date, and endpoints against whatever was saved last time."),
      feature("FDA Lookup", "Live openFDA search: Drugs@FDA approval history (every submission, not just the original), full label sections (indications, boxed warning, warnings/precautions, adverse reactions), and FAERS adverse-event report volume — a real signal of reporting activity, not confirmed incidence."),
      feature("Exclusivity / LOE", "Live patent expiry from FDA's Orange Book, so the loss-of-exclusivity year feeding the erosion model comes from published data instead of a guess. Deliberately shows two dates rather than one: the drug-substance (compound) patent, which is the hard floor, and the last patent of any kind to expire, which is an upper bound a generic may design around or challenge. Eliquis illustrates why one number would mislead — its substance patent and its last patent are fifteen years apart. Small molecules only; a biologic lookup says so explicitly rather than returning nothing, since biologics sit in the Purple Book and get 12 years of BLA data exclusivity instead.")
    ]),
    card([
      label("Simulation — stress-testing clinical data, forward and backward"),
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: PROSE, marginBottom: 12 } },
        "Workspace is the DCF sandbox — it assumes you already have a PoS, a peak revenue, a timeline. Simulation is where those assumptions come from: a workbench for stress-testing clinical data you already have (backward-looking — how robust is a result that already read out) and for projecting what an upcoming trial might do (forward-looking — will it succeed, and on what timeline). Every tool here is a standalone calculator, not tied to any case."),
      feature("Trial Outcome / PoS", "Forward-looking. Given a trial design and an assumed true effect (with uncertainty, if you have a view on it), simulates thousands of replicate trials and reports the share that would read out statistically significant — a Bayesian assurance figure, not the single-point \"power\" a protocol usually quotes. On a time-to-event endpoint it also draws the two survival curves your assumed hazard ratio implies, so \"HR 0.65\" becomes a readable median-survival gain rather than an abstract number."),
      feature("Phase 2 → 3 Translator", "Both directions at once. Early-phase results systematically overstate what Phase 3 goes on to confirm — a real, published regression-to-the-mean effect, not a guess. Enter an observed Phase 2 response rate or hazard ratio and get a shrinkage-adjusted Phase 3 planning assumption, sourced from two independent published analyses (one per endpoint type) rather than an arbitrary haircut — with an explicit warning if a hazard ratio shrinks past 1.0, since a marginal Phase 2 result may not survive Phase 3 as a real effect at all."),
      feature("Trial Statistics", "Seven backward-looking tools for a result you already have in hand, grouped under one tab since they all answer a narrow question about already-reported data. Fragility Index (how many patients' outcomes would need to flip to erase a significant result's significance). Sample Size/Power (the inverse of Trial Outcome/PoS — solve for N given a target power, rather than assurance given N — or flip the direction: given an N that's already fixed, what's the minimum effect it could actually detect; both directions plot a power curve so you can see how steeply power changes around your answer). P-value↔95% CI (recover whichever of the two a press release didn't report). Single-Arm CI (a Wilson score interval for one observed proportion — e.g. an ORR — more reliable than the normal approximation at the small n and extreme rates single-arm early trials usually report). 2×2 Outcome Analysis (risk ratio, odds ratio, risk difference and NNT/NNH from one 2×2 table, all with real confidence intervals — leads with an icon array showing NNT as \"out of every 100 treated\" before the full CI detail). Non-Inferiority (checks whether an entire reported confidence interval clears a pre-specified margin — the actual regulatory rule, not just whether the point estimate points the right way). Multiplicity Adjustment (Bonferroni and Holm side by side, so a p<0.05 secondary endpoint out of several tested can be checked against the higher bar it actually had to clear)."),
      feature("Meta-Analysis", "Both directions at once, and its own tab because it takes MULTIPLE studies rather than one. Pools 2-8 trials into a single combined estimate — fixed-effect and DerSimonian-Laird random-effects side by side — with Cochran's Q and I² stated plainly, so you can see whether the studies actually agree with each other or are quietly telling different stories. Centred on a forest plot with a pooled diamond. Accepts raw 2×2 tables or point-estimate-plus-CI on either a ratio or linear scale, whichever form the trials reported."),
      feature("Peak Sales", "Forward-looking. Monte Carlo peak-sales estimate from population/diagnosis/treatment-rate/share/price distributions — exports its median straight into a program's Quick Revenue, the same sourced-starting-point pattern used throughout the app."),
      feature("PK/PD", "Forward-looking. Projects a concentration-time profile from published PK parameters (dose, absorption/elimination rates, volume of distribution), optionally bridges to receptor occupancy, then maps exposure through a dose-response (Eₘₐₓ) curve — a forward projection from parameters you supply, not a fit to patient data. A collapsed note on the tab explains where each parameter is actually published (FDA label, Phase 1 PK paper) and how to derive the ones that usually aren't stated directly. Carries a standalone Receptor Occupancy Calculator underneath for when you already have a concentration in hand and don't need the full dosing simulation to get to a % occupied.")
    ]),
    card([
      label("Custom comps"),
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: PROSE } },
        "Both M&A Comps and Peak Sales Comps support adding, editing, and deleting your own entries (✦ marks a custom one) — saved on this device, not tied to any case. Add M&A deals from the Reference Sheet's M&A Comps tab; add drug comps from Tools → Peak Sales Comps. A custom entry behaves identically to a built-in one everywhere — same list, same charts, same CSV export.")
    ]),
    card([
      label("Worth remembering"),
      h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: PROSE } },
        "M&A Comps, Peak Sales Comps, and the market-context stats are compiled from public sources and refreshed periodically — not a live feed. EDGAR, ClinicalTrials.gov, and FDA lookups are real-time. PDF and CSV export live in the top toolbar wherever you see them; PDF needs the desktop app, CSV works anywhere.")
    ]),
    card([
      label("Getting results out — export, pinning, and the PDF report"),
      feature("Per-chart export", "Every chart carries PNG, SVG and Panel buttons. PNG is a high-resolution raster for slides; SVG stays sharp at any size and is editable in design tools; Panel captures the whole result block including its numbers and tables, not just the graphic."),
      feature("Pin to report", "Simulation and Tools results are computed on demand and would otherwise never reach the PDF, which historically covered Workspace only. Pinning captures the rendered result and attaches it to a case, so a trial-statistics readout or an exclusivity lookup travels with that case's report. Up to 12 per case, managed from the report's Sections menu. Captures keep whatever theme was active, so pin in the same mode the report is set to — the report flags a mismatch if you don't."),
      feature("PDF report", "Section-by-section picker with Everything / Summary only / Charts only presets. Sections that don't apply to a case stay hidden even when ticked — Sum-of-the-parts needs more than one program, and the year-by-year charts need DCF rather than Simple Multiple.")
    ]),
    card([
      label("Your data — where it lives and how it's protected"),
      feature("Local only", "Cases are saved in this device's browser storage. Nothing is uploaded, and there is no account or sync — which also means clearing site data or moving machines loses them. Export anything you'd hate to lose."),
      feature("Storage headroom", "A banner warns at roughly 60% of the assumed quota and escalates past 85%, split into your own cases versus disposable API caches, with a one-click option to drop the caches (they re-fetch in seconds). If a save ever does fail outright, a separate red banner says so rather than losing work silently. The EDGAR and CIK caches are byte-capped so an API response can never crowd out your cases."),
      feature("Delete protection", "Deleting a case or a program opens a confirmation dialog. Smaller removals — a custom comp, a milestone, an evidence-log entry, a watched trial — use a two-step button instead: the first click arms it (\"Sure?\"), the second confirms, and it disarms itself after three seconds or on Escape.")
    ])
  );

  const revenueTab = () => h("div", null,
    card([
      label("Launch curve — % of peak by year (6yr median)"),
      table(["Year", "25th pctile", "Median", "75th pctile"], [1,2,3,4,5,6].map(y => [
        "Y" + y, LAUNCH_CURVE.years6_p25[y-1] + "%", LAUNCH_CURVE.years6[y-1] + "%", LAUNCH_CURVE.years6_p75[y-1] + "%"
      ]))
    ]),
    card([
      label("Exact published curve for any ramp length (3-10yr)"),
      h("select", {
        "aria-label": "Ramp length in years",
        value: rampYears, onChange: e => setRampYears(Number(e.target.value)),
        style: { padding: "6px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 12, marginBottom: 12 }
      }, [3,4,5,6,7,8,9,10].map(n => h("option", { key: n, value: n }, n + "-year ramp"))),
      table(["Year"].concat(Array.from({length: rampYears}, (_,i) => "Y" + (i+1))),
        [["25th pctile"].concat(LAUNCH_CURVE_EXACT[rampYears].lo.map(v => v + "%")),
         ["Median"].concat(LAUNCH_CURVE_EXACT[rampYears].median.map(v => v + "%")),
         ["75th pctile"].concat(LAUNCH_CURVE_EXACT[rampYears].hi.map(v => v + "%"))]
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, maxWidth: PROSE } }, "These are the real published values (Figure 6-2), not interpolated — used directly by the engine for any \"years to peak\" setting from 3-10. Outside that range, the tool falls back to proportionally interpolating the 6yr curve above.")
    ]),
    card([
      label("Market share by order of entry"),
      table(["Market size", "1st", "2nd", "3rd", "4th", "5th"], [2,3,4,5].map(n => {
        const row = MARKET_SHARE_TABLE[n];
        return [n + "-drug market", ...row.map(v => v + "%"), ...Array(5 - row.length).fill("—")].slice(0,6);
      }))
    ]),
    card([
      label("Adherence / persistence benchmarks"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.8 } },
        h("div", null, "Acute therapies: ", h("b", null, ADHERENCE_BENCHMARKS.acuteAvg + "% avg"), " (range ", ADHERENCE_BENCHMARKS.acuteRange.join("-"), "%)"),
        h("div", null, "Chronic ambulatory base case: ", h("b", null, ADHERENCE_BENCHMARKS.chronicAmbulatoryBase + "%")),
        h("div", null, "Asymptomatic conditions (hyperlipidemia, HTN, GERD): ", h("b", null, ADHERENCE_BENCHMARKS.byFactor.asymptomatic.join("-") + "%")),
        h("div", null, "High-severity/efficacy perception (leukemia, MS): can exceed ", h("b", null, ADHERENCE_BENCHMARKS.byFactor.highSeverityOrEfficacy + "%")),
        h("div", null, "Bipolar (special case): ", h("b", null, "most values <50%"))
      )
    ]),
    card([
      label("Pricing definitions"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, h("b", null, "ASP"), " — ", PRICING_DEFS.ASP),
        h("div", null, h("b", null, "WAC"), " — ", PRICING_DEFS.WAC),
        h("div", null, h("b", null, "AWP"), " — ", PRICING_DEFS.AWP),
        h("div", null, h("b", null, "Retail"), " — ", PRICING_DEFS.Retail),
        h("div", { style: { marginTop: 8 } }, "US annual growth: ", h("b", null, PRICING_DEFS.usAnnualGrowth.join("-") + "%"), " base case, up to ", PRICING_DEFS.usAnnualGrowthHighCase + "%", " in high-pricing-power scenarios"),
        h("div", null, "Ex-US price factor: ", h("b", null, PRICING_DEFS.exUSPriceFactor + "% of US"), " typical (see country table below)")
      )
    ]),
    card([ label("Exact price interconversion (Table 4-1)"),
      table(["Metric", "% of AWP", "% of Retail", "% of WAC", "% of ASP"], [
        ["AWP", PRICING_CONVERSION_MATRIX.refAWP100.AWP, PRICING_CONVERSION_MATRIX.refRetail100.AWP, PRICING_CONVERSION_MATRIX.refWAC100.AWP, PRICING_CONVERSION_MATRIX.refASP100.AWP],
        ["Retail", PRICING_CONVERSION_MATRIX.refAWP100.Retail, PRICING_CONVERSION_MATRIX.refRetail100.Retail, PRICING_CONVERSION_MATRIX.refWAC100.Retail, PRICING_CONVERSION_MATRIX.refASP100.Retail],
        ["WAC", PRICING_CONVERSION_MATRIX.refAWP100.WAC, PRICING_CONVERSION_MATRIX.refRetail100.WAC, PRICING_CONVERSION_MATRIX.refWAC100.WAC, PRICING_CONVERSION_MATRIX.refASP100.WAC],
        ["ASP", PRICING_CONVERSION_MATRIX.refAWP100.ASP, PRICING_CONVERSION_MATRIX.refRetail100.ASP, PRICING_CONVERSION_MATRIX.refWAC100.ASP, PRICING_CONVERSION_MATRIX.refASP100.ASP]
      ]),
      h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.7, marginTop: 10 } },
        "This table is what the Workspace's price-basis control uses. Enter whatever price you have, say which basis it is on, and the revenue build converts it to ASP before multiplying by patients — so a list price no longer silently inflates peak revenue by roughly a quarter. ",
        h("b", null, "Treat these as a floor on the deduction, not a forecast of it."),
        " They are averages across every drug in the source. US gross-to-net has widened a great deal since, and for a modern specialty or rare-disease brand, deductions of 40-50% off list are ordinary. If you have a real figure for a close comparable, enter it as the net price realisation and it overrides the table.")
    ]),
    card([ label("Ex-US price factor by country (vs. US = 1.00)"),
      table(["Country", "Factor"], Object.entries(EXUS_COUNTRY_PRICE_FACTORS).filter(([k]) => k !== "source").map(([k,v]) => [k, v.toFixed(2)]))
    ]),
    card([
      label("Exclusivity / loss of exclusivity"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "US patent term: ", h("b", null, EXCLUSIVITY_BENCHMARKS.patentTermYears + "yr from filing"), " (not from launch — clinical + regulatory time eats into this)"),
        h("div", null, "Hatch-Waxman extension: +", h("b", null, EXCLUSIVITY_BENCHMARKS.hatchWaxmanExtensionYears + "yr")),
        h("div", null, "Orphan drug exclusivity: ", h("b", null, EXCLUSIVITY_BENCHMARKS.orphanExclusivityYears + "yr"), " (vs 5yr standard)"),
        h("div", null, "Pediatric extension: +", h("b", null, EXCLUSIVITY_BENCHMARKS.pediatricExtensionMonths + "mo")),
        h("div", null, "Average launch-to-competition: ", h("b", null, EXCLUSIVITY_BENCHMARKS.avgLaunchToCompetitionYears + "yr")),
        h("div", { style: { marginTop: 8, fontWeight: 700 } }, "Small molecule erosion:"),
        h("div", null, "Volume retained after ~1yr: ", h("b", null, EXCLUSIVITY_BENCHMARKS.erosion.smallMolecule.volumeRetainedAfter1yrDefault + "% (default)"), " — range ", EXCLUSIVITY_BENCHMARKS.erosion.smallMolecule.volumeRetainedAfter1yrRange.join("-") + "%"),
        h("div", null, "US price decline: ", h("b", null, EXCLUSIVITY_BENCHMARKS.erosion.smallMolecule.usPriceDeclineDefault + "% (default)"), " — range ", EXCLUSIVITY_BENCHMARKS.erosion.smallMolecule.usPriceDeclineRange.join("-") + "%"),
        h("div", { style: { marginTop: 8, fontWeight: 700 } }, "Biologic erosion:"),
        h("div", null, "Volume lost over 1-5yr biosimilar entry: ~", EXCLUSIVITY_BENCHMARKS.erosion.biologic.volumeLostOverYears1to5 + "% (explicitly stated)"),
        h("div", null, "USD value lost by 5yr: ", EXCLUSIVITY_BENCHMARKS.erosion.biologic.usDollarValueLostBy5yr.join("-") + "% (~half from price → ", h("b", null, EXCLUSIVITY_BENCHMARKS.erosion.biologic.priceDeclineDefault + "% default"), ")"),
        h("div", { style: { fontSize: 10, color: "var(--red)", marginTop: 6, lineHeight: 1.5, maxWidth: PROSE } }, "⚠ " + EXCLUSIVITY_BENCHMARKS.erosion.biologic.tensionNote),
        h("div", { style: { marginTop: 8, fontWeight: 700 } }, "Cell / gene therapy erosion:"),
        h("div", null, "Volume retained after ~1yr: ", h("b", null, EXCLUSIVITY_BENCHMARKS.erosion.cellTherapy.volumeRetainedAfter1yrDefault + "% (default)"), " for both — deliberately near-zero, not a smaller version of the curves above"),
        h("div", { style: { fontSize: 10, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5, maxWidth: PROSE } }, EXCLUSIVITY_BENCHMARKS.erosion.geneTherapy.note)
      )
    ])
  );

  const costTab = () => h("div", null,
    card([ label("COGS as % of revenue"),
      h("div", { style: { fontSize: 13, fontFamily: "var(--mono)", color: "var(--ink-1)", display: "flex", gap: 24, flexWrap: "wrap" } },
        h("div", null, h("div", { style: { fontSize: 20, fontWeight: 700 } }, COGS_BENCHMARKS.all + "%"), h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "all drugs")),
        h("div", null, h("div", { style: { fontSize: 20, fontWeight: 700, color: "var(--teal)" } }, COGS_BENCHMARKS.biologic + "%"), h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "biologics")),
        h("div", null, h("div", { style: { fontSize: 20, fontWeight: 700, color: "var(--amber)" } }, COGS_BENCHMARKS.smallMolecule + "%"), h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "small molecules")),
        h("div", null, h("div", { style: { fontSize: 20, fontWeight: 700, color: "var(--slate)" } }, COGS_BENCHMARKS.cellTherapy + "%"), h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "cell therapy")),
        h("div", null, h("div", { style: { fontSize: 20, fontWeight: 700, color: "var(--red)" } }, COGS_BENCHMARKS.geneTherapy + "%"), h("div", { style: { fontSize: 10, color: "var(--ink-3)" } }, "gene therapy"))
      ),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 10, maxWidth: PROSE } }, COGS_BENCHMARKS.note),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6, maxWidth: PROSE } }, "Cell therapy: " + COGS_BENCHMARKS.cellTherapyNote),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 6, lineHeight: 1.6, maxWidth: PROSE } }, "Gene therapy: " + COGS_BENCHMARKS.geneTherapyNote)
    ]),
    card([ label("SG&A benchmarks"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "Mature SG&A/revenue (>$" + SGA_BENCHMARKS.maturityRevenueThresholdM + "M): ", h("b", null, SGA_BENCHMARKS.matureSgaPctOfRevenue + "%"), " (range ", SGA_BENCHMARKS.matureSgaRange.join("-"), "%)"),
        h("div", null, "Large-cap pharma: ", h("b", null, SGA_BENCHMARKS.largeCapSgaPctOfRevenue + "%"), " (range ", SGA_BENCHMARKS.largeCapSgaRange.join("-"), "%)"),
        h("div", { style: { marginTop: 8 } }, "Pre-commercial G&A: ", h("b", null, "$" + SGA_BENCHMARKS.preCommercialGA.medianM + "M median"), " (IQR $", SGA_BENCHMARKS.preCommercialGA.iqrM.join("-"), "M)"),
        h("div", null, "G&A per employee: $", SGA_BENCHMARKS.gaPerEmployee.medianK, "K median"),
        h("div", null, "By phase: Ph1 $", SGA_BENCHMARKS.gaByPhaseM.phase1, "M · Ph2 $", SGA_BENCHMARKS.gaByPhaseM.phase2, "M · Ph3 $", SGA_BENCHMARKS.gaByPhaseM.phase3, "M"),
        h("div", null, "By headcount: ≤20 employees $", SGA_BENCHMARKS.gaByHeadcountM.upTo20employees, "M · ≥70 employees $", SGA_BENCHMARKS.gaByHeadcountM.employees70Plus, "M (median headcount ", SGA_BENCHMARKS.medianHeadcount, ", IQR ", SGA_BENCHMARKS.medianHeadcountIQR.join("-"), ")")
      )
    ]),
    card([ label("Sales rep cost (fully loaded, annual)"),
      table(["Call type", "Comp+bonus", "Employment exp", "Other exp", "Total"], [
        ["Primary care", "$" + SALES_REP_COST.primaryCare.comp.toLocaleString(), "$" + SALES_REP_COST.primaryCare.employment.toLocaleString(), "$" + SALES_REP_COST.primaryCare.other.toLocaleString(), "$" + SALES_REP_COST.primaryCare.total.toLocaleString()],
        ["Specialty", "$" + SALES_REP_COST.specialty.comp.toLocaleString(), "$" + SALES_REP_COST.specialty.employment.toLocaleString(), "$" + SALES_REP_COST.specialty.other.toLocaleString(), "$" + SALES_REP_COST.specialty.total.toLocaleString()],
        ["Hospital-based", "$" + SALES_REP_COST.hospital.comp.toLocaleString(), "$" + SALES_REP_COST.hospital.employment.toLocaleString(), "$" + SALES_REP_COST.hospital.other.toLocaleString(), "$" + SALES_REP_COST.hospital.total.toLocaleString()]
      ])
    ]),
    card([ label("Typical launch sales-force size"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "Hospital-based or specialty product: ", h("b", null, "~" + SALES_FORCE_SIZE_BENCHMARKS.hospitalOrSpecialty + " reps")),
        h("div", null, "Primary care product, no partner: ", h("b", null, "~" + SALES_FORCE_SIZE_BENCHMARKS.primaryCareNoPartner + " reps")),
        h("div", { style: { marginTop: 6 } }, "Observed across 13 launches: median ", SALES_FORCE_SIZE_BENCHMARKS.observedMedian, ", average ", SALES_FORCE_SIZE_BENCHMARKS.observedAverage)
      ),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 10, lineHeight: 1.7, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 6 } },
        h("b", null, "How the model applies this: "),
        "30% of the team staffs the year before launch, ramping to 100% at launch. Compensation grows ", SALES_FORCE_COMP_GROWTH_PCT + "%/yr (same CAGR as drug pricing). At loss of exclusivity, sales force cost is fully eliminated the following year — not phased down."
      )
    ]),
    card([ label("Marketing spend"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)" } },
        "Base case: ", h("b", null, MARKETING_BENCHMARKS.baseCasePctOfPeakRevenue + "% of peak revenue"), ". Competitive scenarios: ", h("b", null, MARKETING_BENCHMARKS.competitiveScenarioRange.join("-") + "%"), "."),
      h("ul", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, paddingLeft: 18, lineHeight: 1.7 } },
        MARKETING_BENCHMARKS.competitiveDrivers.map((d,i) => h("li", { key: i }, d)))
    ])
  );

  const rdTab = () => h("div", null,
    card([ label("Per-patient trial cost by phase & therapeutic area ($K)"),
      table(["Area", "Phase 1", "Phase 2", "Phase 3"], Object.entries(TRIAL_COST_BY_AREA.byArea).map(([a,v]) => [a, v.phase1||"—", v.phase2, v.phase3])),
      h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8, maxWidth: PROSE } }, "Weighted avg: Ph1 $" + TRIAL_COST_BY_AREA.weightedAvg.phase1 + "K · Ph2 $" + TRIAL_COST_BY_AREA.weightedAvg.phase2 + "K · Ph3 $" + TRIAL_COST_BY_AREA.weightedAvg.phase3 + "K. Typical full-asset cost: Ph1 $" + TRIAL_COST_BY_AREA.typicalAssetTotalM.phase1 + "M, Ph2 $" + TRIAL_COST_BY_AREA.typicalAssetTotalM.phase2 + "M, Ph3 $" + TRIAL_COST_BY_AREA.typicalAssetTotalM.phase3 + "M (1 Ph1 + 1 Ph2 + 2 Ph3 trials).")
    ]),
    card([ label("Trial duration by phase & therapeutic area (initiation → results, yrs)"),
      table(["Area", "Phase 2", "Phase 3"], Object.entries(TRIAL_DURATION_BY_AREA.byArea).map(([a,v]) => [a, v.phase2, v.phase3])),
      h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)", marginTop: 8, maxWidth: PROSE } }, "Phase 1 base: " + TRIAL_DURATION_BY_AREA.phase1BaseYears + "yr. Nonclinical add-on: +" + TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase2 + "yr (Ph2), +" + TRIAL_DURATION_BY_AREA.nonclinicalAddYears.phase3 + "yr (Ph3). All-area total dev benchmark: " + TRIAL_DURATION_BY_AREA.totalDevBenchmarkYears + "yr."),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-1)", marginTop: 10, padding: "8px 12px", background: "var(--amber-bg)", borderRadius: 6 } },
        h("b", null, "Breakthrough Therapy Designation: "), TRIAL_DURATION_BY_AREA.breakthroughDesignation.withBTD + "yr median vs " + TRIAL_DURATION_BY_AREA.breakthroughDesignation.withoutBTD + "yr without — the only expedited pathway found to shorten duration (priority review, accelerated approval, fast track showed no significant difference). ",
        h("span", { style: { color: "var(--ink-3)", fontStyle: "italic" } }, "(" + TRIAL_DURATION_BY_AREA.breakthroughDesignation.source + ")"))
    ]),
    card([ label("Regulatory"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "Review duration: ", h("b", null, REGULATORY_BENCHMARKS.reviewDurationYears.join("-") + "yr"), " (shorter end for priority/fast-track)"),
        h("div", null, "US filing fee: ", h("b", null, "$" + REGULATORY_BENCHMARKS.usFilingFeeM + "M")),
        h("div", null, "EU / Japan filing fee: ", h("b", null, "~$" + REGULATORY_BENCHMARKS.euJapanFilingFeeK + "K each"))
      )
    ])
  );

  const placeboResponseCard = () => card([
    label("Placebo response benchmarks — by indication"),
    h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.6, maxWidth: PROSE, marginBottom: 12 } },
      PLACEBO_RESPONSE_BENCHMARKS.note),
    table(["Indication", "Placebo rate", "Endpoint"],
      Object.entries(PLACEBO_RESPONSE_BENCHMARKS.areas).map(([name, v]) =>
        [name, v.rate + "%" + (v.range ? " (" + v.range[0] + "-" + v.range[1] + "%)" : ""), v.endpoint])),
    h("div", { style: { marginTop: 12, display: "flex", flexDirection: "column", gap: 10 } },
      Object.entries(PLACEBO_RESPONSE_BENCHMARKS.areas).map(([name, v]) =>
        h("div", { key: name, style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.5 } },
          h("b", { style: { color: "var(--ink-1)" } }, name + ": "), v.note, " ",
          h("span", { style: { fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "(" + v.source + ")")
        )
      )
    )
  ]);

  const posTab = () => h("div", null,
    // ── The critical clarification: cumulative vs. regulatory-only PoS ──
    card([ label("⚠ Overall vs. regulatory-stage probability of success — read this first"),
      h("div", { style: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 } },
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "CUMULATIVE (Phase 1 → Launch)"),
          h("div", { style: { fontSize: 28, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--teal)" } },
            (POS_BY_AREA.allIndications.phase1/100 * POS_BY_AREA.allIndications.phase2/100 * POS_BY_AREA.allIndications.phase3/100 * POS_REGULATORY.median/100 * 100).toFixed(1) + "%"),
          h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "This is the real answer to \"what's the chance this Phase 1 drug reaches market?\"")
        ),
        h("div", null,
          h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" } }, "REGULATORY-ONLY (Phase 3 done → Launch)"),
          h("div", { style: { fontSize: 28, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, POS_REGULATORY.median + "%"),
          h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, "This is CONDITIONAL on already succeeding through Phase 3 — not an overall figure")
        )
      ),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.6, padding: "10px 14px", background: "var(--amber-bg)", border: "1px solid var(--amber)", borderRadius: 8, maxWidth: PROSE } },
        "These two numbers get confused easily because they're both called \"probability of success.\" The 88% one only covers the last mile (filed → approved), given the drug already survived Phase 1/2/3. Multiply all four stage probabilities together to get the real end-to-end odds — about ",
        h("b", null, (POS_BY_AREA.allIndications.phase1/100 * POS_BY_AREA.allIndications.phase2/100 * POS_BY_AREA.allIndications.phase3/100 * POS_REGULATORY.median/100 * 100).toFixed(0) + "%"),
        " for an all-indications Phase 1 asset, per this source.")
    ]),
    card([ label("Base-case PoS by phase — the document's stated recommendation"),
      table(["Phase", "Base case"], [
        ["Phase 1 → 2", POS_MASTER_RECONCILIATION.median.phase1 + "%"],
        ["Phase 2 → 3", POS_MASTER_RECONCILIATION.median.phase2 + "%"],
        ["Phase 3 → filing", POS_MASTER_RECONCILIATION.median.phase3 + "%"],
        ["Filing → Launch (regulatory)", POS_REGULATORY.median + "%"]
      ])
    ]),
    card([ label("Nonscientific-failure-adjusted alternative"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.8 } },
        "~" + POS_NONSCIENTIFIC_ADJUSTED.nonscientificTerminationRate.phase1 + "% of Phase 1 and ~" + POS_NONSCIENTIFIC_ADJUSTED.nonscientificTerminationRate.phase2 +
        "% of Phase 2 terminations are for non-scientific reasons (portfolio rationalization, budget) — not drug failure. Adjusting for this: Phase 1 ",
        h("b", null, POS_NONSCIENTIFIC_ADJUSTED.phase1 + "%"), ", Phase 2 ", h("b", null, POS_NONSCIENTIFIC_ADJUSTED.phase2 + "%"), " (Phase 3 unchanged — source gives no adjusted figure)."),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, fontStyle: "italic", maxWidth: PROSE } }, "Use when: " + POS_NONSCIENTIFIC_ADJUSTED.useWhen + ".")
    ]),
    card([ label("Probability of success by phase & therapeutic area (%)"),
      table(["Area", "Phase 1", "Phase 2", "Phase 3"], [["All indications (base case)", POS_BY_AREA.allIndications.phase1, POS_BY_AREA.allIndications.phase2, POS_BY_AREA.allIndications.phase3]]
        .concat(Object.entries(POS_BY_AREA.byArea).map(([a,v]) => [a, v.phase1, v.phase2, v.phase3]))),
      h("div", { style: { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", marginTop: 4, maxWidth: PROSE } }, "By-area rows use Thomas(2016) specifically, for internal consistency (Thomas provides the most complete area coverage). \"All indications\" row is the cross-study base case above, not Thomas's individual figure.")
    ]),
    card([ label("PoS by molecule type (%)"),
      table(["", "Phase 1", "Phase 2", "Phase 3"], [
        ["All", POS_BY_MOLECULE.all.phase1, POS_BY_MOLECULE.all.phase2, POS_BY_MOLECULE.all.phase3],
        ["NME (small molecule)", POS_BY_MOLECULE.nme.phase1, POS_BY_MOLECULE.nme.phase2, POS_BY_MOLECULE.nme.phase3],
        ["Biologic", POS_BY_MOLECULE.biologic.phase1, POS_BY_MOLECULE.biologic.phase2, POS_BY_MOLECULE.biologic.phase3]
      ])
    ]),
    card([ label("PoS modifiers — precise per-phase deltas (not a flat multiplier)"),
      table(["Cohort", "Phase 1", "Phase 2", "Phase 3"], [
        ["Baseline", POS_MODIFIERS.baseline.phase1, POS_MODIFIERS.baseline.phase2, POS_MODIFIERS.baseline.phase3],
        ["Rare disease", POS_MODIFIERS.rareDisease.phase1, POS_MODIFIERS.rareDisease.phase2, POS_MODIFIERS.rareDisease.phase3],
        ["Chronic high-prevalence", POS_MODIFIERS.chronicHighPrevalence.phase1, POS_MODIFIERS.chronicHighPrevalence.phase2, POS_MODIFIERS.chronicHighPrevalence.phase3],
        ["Selection biomarkers", POS_MODIFIERS.selectionBiomarkers.phase1, POS_MODIFIERS.selectionBiomarkers.phase2, POS_MODIFIERS.selectionBiomarkers.phase3],
        ["No biomarkers", POS_MODIFIERS.noBiomarkers.phase1, POS_MODIFIERS.noBiomarkers.phase2, POS_MODIFIERS.noBiomarkers.phase3]
      ])
    ]),
    card([ label("Regulatory PoS — Phase 3 completion → Launch (conditional, not overall)"),
      h("div", { style: { fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, POS_REGULATORY.median + "% median"),
      h("div", { style: { fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", maxWidth: PROSE } }, "Range across 6 sources: " + POS_REGULATORY.range.join("-") + "%. " + POS_REGULATORY.definition + ".")
    ]),
    card([ label("Regulatory-stage-specific modifiers (distinct from clinical-phase modifiers above)"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", { style: { fontWeight: 700, marginTop: 4 } }, "Thomas (2016):"),
        h("div", null, "Selection biomarkers: ", h("b", { style: { color: "var(--green)" } }, "+" + POS_REGULATORY_MODIFIERS.thomas2016.selectionBiomarkers + "%"), " · No biomarkers: ", h("b", { style: { color: "var(--amber)" } }, POS_REGULATORY_MODIFIERS.thomas2016.noBiomarkers + "%")),
        h("div", null, "Chronic high-prevalence: ", h("b", { style: { color: "var(--green)" } }, "+" + POS_REGULATORY_MODIFIERS.thomas2016.chronicHighPrevalence + "%"), " · Rare disease: ", h("b", { style: { color: "var(--green)" } }, "+" + POS_REGULATORY_MODIFIERS.thomas2016.rareDisease + "%")),
        h("div", { style: { fontWeight: 700, marginTop: 8 } }, "Hay (2014):"),
        h("div", null, "Special Protocol Assessment: ", h("b", { style: { color: "var(--amber)" } }, POS_REGULATORY_MODIFIERS.hay2014.specialProtocolAssessment + "%"), " · Orphan designation: ", h("b", { style: { color: "var(--amber)" } }, POS_REGULATORY_MODIFIERS.hay2014.orphanDesignation + "%"))
      ),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, fontStyle: "italic" } }, POS_REGULATORY_MODIFIERS.hay2014.note)
    ]),
    h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-3)", padding: "10px 4px", maxWidth: PROSE } }, "The PoS modifiers above (biomarker use, disease type) are wired into the actual PoS calculation via each program's Biomarker Use / Disease Type fields. The molecule-type table is wired in too, applied automatically from each program's Modality — composed as a ratio against its own all-molecules baseline, the same method used for the modifiers. Cell and gene therapy deliberately receive no molecule-type adjustment: these sources run 2010-2016 and their \"biologic\" cohort is antibodies and proteins, so applying it to a gene therapy would be inventing a datapoint. The base-case and regulatory tables remain reference-only and are not auto-selected by the engine."),
    placeboResponseCard()
  );

  const discountTab = () => h("div", null,
    card([ label("Discount rate guidance"),
      h("div", { style: { display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" } },
        h("div", null, h("div", { style: { fontSize: 24, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--amber)" } }, DISCOUNT_RATE_GUIDANCE.earlyBiotechSelfView.join("-") + "%"),
          h("div", { style: { fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", maxWidth: 220 } }, "Pre-commercial biotech (this tool's default) — document's own words: \"up to 20%, depending on the stage of the portfolio\"")),
        h("div", null, h("div", { style: { fontSize: 24, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--teal)" } }, "~" + DISCOUNT_RATE_GUIDANCE.largePharmaOrAcquirerLens + "%"),
          h("div", { style: { fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", maxWidth: 220 } }, "Large-pharma / acquirer lens — evaluating an asset from a large, diversified buyer's cost of capital, not this tool's default"))
      ),
      h("div", { style: { padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.6, marginBottom: 14 } },
        h("b", { style: { color: "var(--red)" } }, "Don't double-count risk: "), DISCOUNT_RATE_GUIDANCE.warning),
      h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-2)" } }, label("Survey ranges")),
      Object.entries(DISCOUNT_RATE_GUIDANCE.surveyRanges).map(([k,v],i) => h("div", { key: i, style: { display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--mono)", padding: "5px 0", borderBottom: "1px solid var(--rule)" } },
        h("span", { style: { color: "var(--ink-2)" } }, k), h("span", { style: { color: "var(--ink-1)", fontWeight: 700 } }, Array.isArray(v) ? v.join("-")+"%" : v+"%")))
    ]),
    card([ label("Internal rate of return (IRR) — an alternate hurdle-rate floor"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "Theoretical IRR (2010 model): small molecule ", h("b", null, DISCOUNT_RATE_GUIDANCE.irr.theoreticalSmallMolecule + "%"), ", biologic ", h("b", null, DISCOUNT_RATE_GUIDANCE.irr.theoreticalBiologic + "%")),
        h("div", null, "Historical trend (12 pharma cos): ", h("b", null, DISCOUNT_RATE_GUIDANCE.irr.historicalTrend.y2010 + "%"), " (2010) → ", h("b", null, DISCOUNT_RATE_GUIDANCE.irr.historicalTrend.y2015 + "%"), " (2015)"),
        h("div", null, "2013-2015 range across companies: ", h("b", null, DISCOUNT_RATE_GUIDANCE.irr.y2013to2015Range.join("% to ") + "%"))
      ),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, fontStyle: "italic" } }, DISCOUNT_RATE_GUIDANCE.irr.note)
    ])
  );

  const valuationTab = () => h("div", null,
    card([ label("Quick mode vs. Full mode"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, h("b", null, "Quick"), " — enter a single peak revenue estimate directly. Fastest way to a number; good for a first pass or when you just want a sanity check against a comparable drug's peak sales."),
        h("div", { style: { marginTop: 6 } }, h("b", null, "Full"), " — builds revenue up from population → diagnosis/treatment rate → adherence → market share → launch curve → pricing. Slower to fill in, but every assumption is visible and independently sourced."),
        h("div", { style: { marginTop: 6, maxWidth: PROSE } }, "Both modes run through the exact same downstream pipeline below — R&D costing, PoS risk-adjustment, discounting, and dilution don't change based on which one you pick. Loss-of-exclusivity timing and erosion apply identically either way. Switch anytime per program; your inputs for the mode you're not using are preserved.")
      )
    ]),
    card([ label("How the pieces combine — the full pipeline"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("ol", { style: { paddingLeft: 18, margin: 0 } },
          h("li", null, "Revenue build — either Quick (direct peak estimate) or Full (population → price → share → launch curve → LOE erosion) — produces a year-by-year revenue curve per program."),
          h("li", null, "Cost structure (COGS, sales force, marketing) turns that into product contribution; corporate G&A is netted at the company level."),
          h("li", null, "R&D-to-launch cost & timeline estimates what's left to spend, and how long, from the program's current phase."),
          h("li", null, "PoS risk-adjustment weights every pre-launch R&D cost by the probability of reaching it, and every post-launch cash flow by the cumulative probability of reaching launch at all."),
          h("li", null, "The risk-adjusted cash flow stream is discounted at your chosen rate to get Enterprise Value (rNPV)."),
          h("li", null, "Capital structure (cash, debt, dilutive securities) bridges Enterprise Value to Equity Value, then divides by diluted shares for a per-share figure.")
        )
      ),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)", lineHeight: 1.7 } },
        h("b", null, "On terminology: "), "this is rNPV (risk-adjusted / probability-adjusted NPV) — the standard methodology for valuing pre-revenue biotech assets, since step 4 above weights every cash flow by the probability it actually happens before step 5 discounts it. Neither source document uses the literal term \"rNPV\" — they describe the mechanics (\"risk-adjusting the cash flows,\" separately, from choosing a discount rate) without the shorthand. The methodology has been rNPV throughout; the app's labels now say so explicitly rather than just \"NPV.\"")
    ]),
    card([ label("Simplifications, stated plainly") ,
      h("ul", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9, paddingLeft: 18, margin: 0 } },
        h("li", null, "EBIT is used as a proxy for unlevered free cash flow — no tax, capex, or working-capital adjustment. Defensible for early-stage biotech (often NOL-shielded pre-profitability), but worth knowing if you're used to a fuller FCF build."),
        h("li", null, "The flat pre-commercial G&A baseline is NOT risk-adjusted per-program — it's a real cost incurred during the trial period regardless of eventual outcome (standard rNPV practice: near-certain near-term costs aren't discounted by long-run success odds). The portion of G&A that scales toward mature commercial levels DOES respond to risk-adjusted revenue, so a low-probability asset correctly never gets modeled as scaling up to full commercial overhead."),
        h("li", null, "Terminal value is off by default. Exit Multiple (the default method when turned on) truncates cash flows at the peak-revenue year and discounts peak revenue x multiple back from that year — modeling an acquisition, not an indefinite continuation. Perpetuity Growth instead grows the final modeled year's cash flow forever, which usually overstates value for a single-asset case whose explicit window already runs through loss-of-exclusivity — better suited to an ongoing multi-program platform company."),
        h("li", null, "Sales force cost doesn't scale with the Bear/Bull share multiplier (team size is treated as a separate staffing decision) — only revenue, COGS, and marketing (tied to peak revenue) rescale.")
      )
    ]),
    card([ label("Treasury stock method (options & warrants)"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.8, maxWidth: PROSE } },
        "Options/warrants only add dilutive shares if they're in the money (strike below current price). The company is assumed to use the exercise proceeds to buy back shares at the current price, so net new shares = count − (count × strike ÷ price). Out-of-the-money securities add zero shares — standard treatment, same convention used across public-company diluted EPS reporting."
      )
    ]),
    card([ label("If-converted method (convertible notes)"),
      h("div", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.8, maxWidth: PROSE } },
        "A convertible note converts to shares (face value ÷ conversion price) only if that's favorable — i.e. the conversion price is below the current share price. If not, the face value stays counted as debt instead. Enter \"debt\" excluding any convertible tracked separately here, so it isn't double-counted either way."
      )
    ]),
    card([ label("Scenario multipliers (Bear / Base / Bull)"),
      table(["Scenario", "Peak share", "PoS", "Discount rate"], Object.values(SCENARIO_PRESETS).map(s => [
        s.label, s.shareMultiplierPct + "%", s.posMultiplierPct + "%", (s.discountRateAddPct >= 0 ? "+" : "") + s.discountRateAddPct + "pp"
      ])),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 8, lineHeight: 1.6, maxWidth: PROSE } },
        "Peak share and PoS multipliers are applied to the computed base-case figures, not re-entered from scratch — this keeps three scenarios from requiring three full sets of inputs. Revenue is rescaled exactly (patient counts scale linearly with market share by construction), then costs and risk-adjustment are recomputed fresh on the rescaled figures.")
    ])
  );

  const [maFilter, setMaFilter] = React.useState("");
  const [customMa, setCustomMa] = React.useState(() => loadCustomComps(CUSTOM_MA_KEY));
  const [showAddMa, setShowAddMa] = React.useState(false);
  const [editingMaIdx, setEditingMaIdx] = React.useState(null);
  const [customSaveFailed, setCustomSaveFailed] = React.useState(false);

  const parseMaVals = (vals) => ({
    acquirer: vals.acquirer, target: vals.target,
    year: parseInt(vals.year) || new Date().getFullYear(),
    valueB: parseFloat(vals.valueB) || 0,
    area: vals.area || "Other", stage: vals.stage || "",
    asset: vals.asset || undefined, premiumPct: vals.premiumPct ? parseFloat(vals.premiumPct) : undefined,
    note: vals.note || undefined, _custom: true
  });
  const addCustomMa = (vals) => {
    const u = [...customMa, parseMaVals(vals)];
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    setShowAddMa(false);
  };
  const updateCustomMa = (idx, vals) => {
    const u = customMa.map((e, i) => i === idx ? parseMaVals(vals) : e);
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    setEditingMaIdx(null);
  };
  const deleteCustomMa = (idx) => {
    const u = customMa.filter((_, i) => i !== idx);
    setCustomMa(u); setCustomSaveFailed(!saveCustomComps(CUSTOM_MA_KEY, u));
    if (editingMaIdx === idx) setEditingMaIdx(null);
  };

  const maTab = () => {
    const allDeals = [...MA_COMPS.deals, ...customMa];
    const q = maFilter.trim().toLowerCase();
    const filtered = allDeals
      .filter(d => !q || [d.acquirer, d.target, d.area, d.asset, d.stage].some(f => f && f.toLowerCase().includes(q)))
      .sort((a, b) => b.valueB - a.valueB);
    const premiums = allDeals.map(d => d.premiumPct).filter(p => p != null);
    const medianPremium = premiums.length ? [...premiums].sort((a,b)=>a-b)[Math.floor(premiums.length/2)] : null;

    return h("div", null,
    card([
      label("Market context (" + MA_COMPS.asOf + ")"),
      h("div", { style: { display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9 } },
        h("div", null, "2025 total deal value: ", h("b", null, "$" + MA_COMPS.marketContext.dealValue2025B + "B"), " (+", MA_COMPS.marketContext.dealValue2025GrowthPct + "% YoY)"),
        h("div", null, "2025 deals >$1B: ", h("b", null, MA_COMPS.marketContext.dealsOver1B2025 + "+")),
        h("div", null, "Avg premium 2025: ", h("b", null, MA_COMPS.marketContext.avgPremium2025Range.join("-") + "%"), " over unaffected price"),
        h("div", null, "2026 Q1 deal value: ", h("b", null, "$" + MA_COMPS.marketContext.q1_2026DealValueB + "B+"), " (", MA_COMPS.marketContext.q1_2026DealsOver1B, " deals >$1B)"),
        medianPremium != null && h("div", null, "Median premium (this list): ", h("b", null, medianPremium + "%"))
      )
    ]),
    card([
      label("Valuation heuristics"),
      h("ul", { style: { fontSize: 12, fontFamily: "var(--sans)", color: "var(--ink-1)", lineHeight: 1.9, paddingLeft: 18, margin: 0 } },
        MA_COMPS.heuristics.map((t, i) => h("li", { key: i }, t))),
      h("div", { style: { fontSize: 11, fontFamily: "var(--sans)", color: "var(--ink-2)", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--rule)" } },
        "Looking for the M&A Target Premium calculator? It's moved to the ", h("b", null, "Tools"), " tab, where it can pull a starting value from any open case.")
    ]),
    card([
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 } },
        label("Deals (" + filtered.length + " of " + allDeals.length + ")"),
        h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
          h("input", { type: "text", value: maFilter, placeholder: "Filter by company, area, or stage…", onChange: e => setMaFilter(e.target.value),
            style: { padding: "5px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink-1)", fontFamily: "var(--mono)", fontSize: 11, width: 220 } }),
          h("button", { onClick: () => downloadCSV("RxNPV-MA-Comps.csv",
              ["Acquirer", "Target", "Year", "Deal Value ($B)", "Premium (%)", "Area", "Stage", "Asset", "Note"],
              filtered.map(d => [d.acquirer, d.target, d.year, d.valueB, d.premiumPct, d.area, d.stage, d.asset || "", d.note || ""])),
            style: { padding: "5px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, cursor: "pointer" } }, "Export CSV")
        )
      ),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" } },
        filtered.map((d, i) => h("div", { key: i, style: { padding: "9px 14px", borderRadius: 8, background: "var(--surface-2)" } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 } },
            h("div", { style: { fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" } },
              d._custom && h("span", { style: { color: "var(--amber)", marginRight: 6 } }, "✦"), d.acquirer + " → " + d.target),
            h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              h("div", { style: { fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--teal)" } }, "$" + d.valueB + "B", d.premiumPct ? h("span", { style: { color: "var(--amber)", marginLeft: 8, fontSize: 11 } }, d.premiumPct + "% premium") : null),
              d._custom && h("button", { onClick: () => { setEditingMaIdx(customMa.indexOf(d)); setShowAddMa(false); }, style: { padding: "4px 10px", borderRadius: 5, border: "1px solid var(--rule)", background: "transparent", color: "var(--ink-2)", fontSize: 10, fontFamily: "var(--mono)", cursor: "pointer" } }, "Edit"),
              d._custom && h(ConfirmXButton, { onConfirm: () => deleteCustomMa(customMa.indexOf(d)), title: "Delete this custom deal" })
            )
          ),
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", marginTop: 3, maxWidth: PROSE } },
            d.year, " · ", d.area, " · ", d.stage, d.asset ? " · " + d.asset : "", d.perShare ? " · $" + d.perShare + "/share" : ""),
          d.note && h("div", { style: { fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", marginTop: 2, maxWidth: PROSE } }, d.note)
        )),
        filtered.length === 0 && h("div", { style: { fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-3)", padding: "12px 0" } }, "No deals match that filter.")
      ),
      h("div", { style: { marginTop: 10, borderTop: "1px dashed var(--rule)", paddingTop: 10 } },
        customSaveFailed && h("div", { style: { fontSize: 11, fontFamily: "var(--mono)", color: "var(--red)", padding: "8px 10px", borderRadius: 6, background: "var(--red-bg)", marginBottom: 10, maxWidth: PROSE } },
          "⚠ Couldn't save that to this device's storage — it'll work for the rest of this session but won't be there next time you open the app. Your storage may be full; removing old cases or comps can free up space."),
        editingMaIdx != null
          ? h(CustomCompForm, {
              initialValues: customMa[editingMaIdx], saveLabel: "Save changes",
              fields: [
                { key: "acquirer", label: "Acquirer", placeholder: "e.g. Pfizer" },
                { key: "target", label: "Target", placeholder: "e.g. Seagen" },
                { key: "year", label: "Year", placeholder: "2025", numeric: true },
                { key: "valueB", label: "Deal Value ($B)", placeholder: "5.2", numeric: true },
                { key: "premiumPct", label: "Premium (%)", placeholder: "60", numeric: true },
                { key: "area", label: "Area", placeholder: "Oncology / ADC" },
                { key: "stage", label: "Stage", placeholder: "Approved" },
                { key: "asset", label: "Asset", placeholder: "Lead drug/program" },
                { key: "note", label: "Note", placeholder: "Context, CVR structure…" }
              ],
              onSave: (vals) => updateCustomMa(editingMaIdx, vals), onCancel: () => setEditingMaIdx(null)
            })
        : !showAddMa
          ? h("button", { onClick: () => setShowAddMa(true), style: { padding: "5px 14px", borderRadius: 6, border: "1px dashed var(--ink-3)", background: "transparent", color: "var(--ink-2)", fontSize: 11, fontFamily: "var(--mono)", cursor: "pointer" } }, "+ Add custom deal comp")
          : h(CustomCompForm, {
              fields: [
                { key: "acquirer", label: "Acquirer", placeholder: "e.g. Pfizer" },
                { key: "target", label: "Target", placeholder: "e.g. Seagen" },
                { key: "year", label: "Year", placeholder: "2025", numeric: true },
                { key: "valueB", label: "Deal Value ($B)", placeholder: "5.2", numeric: true },
                { key: "premiumPct", label: "Premium (%)", placeholder: "60", numeric: true },
                { key: "area", label: "Area", placeholder: "Oncology / ADC" },
                { key: "stage", label: "Stage", placeholder: "Approved" },
                { key: "asset", label: "Asset", placeholder: "Lead drug/program" },
                { key: "note", label: "Note", placeholder: "Context, CVR structure…" }
              ],
              onSave: addCustomMa, onCancel: () => setShowAddMa(false)
            })
      ),
      h("div", { style: { fontSize: 10, fontFamily: "var(--sans)", color: "var(--ink-3)", marginTop: 10, lineHeight: 1.6, maxWidth: PROSE } },
        "Compiled from public deal announcements and SEC filings, refreshed periodically — not a live feed. Use these to sanity-check whether your DCF's implied value is in the neighborhood of what the market has actually paid for comparable-stage/comparable-asset companies recently, not as a precise appraisal method on its own. ✦ = your own custom entry, saved on this device only.")
    ])
  );
  };

  // ── Glossary tab: the vocabulary the Trial Decoder assumes you have ──────
  const glossaryTab = () => h("div", null,
    card([
      label("Reading a trial, in the terms trials are actually written in"),
      h("div", { style: { fontSize: 12.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.7 } },
        "Everything below is vocabulary, not a benchmark — no number here feeds the model. It exists because the Trial Decoder in Tools is only useful if the words on a trial record mean something to you, and a press release will rarely define them. The “why it matters” column is the part worth reading: most of these terms are perfectly well explained elsewhere, but what makes one endpoint stronger evidence than another rarely is.")
    ]),
    ENDPOINT_GLOSSARY.map(group => card([
      label(group.group),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
        group.items.map(it => h("div", { key: it.term, style: { borderLeft: "2px solid var(--rule)", paddingLeft: 12 } },
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink-1)" } },
            it.term, h("span", { style: { color: "var(--ink-3)", fontWeight: 400 } }, " — " + it.full)),
          h("div", { style: { fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.6 } }, it.plain),
          h("div", { style: { fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.6 } }, it.why)
        )))
    ])),
    card([
      label("What each phase can and cannot establish"),
      h("div", { style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.6 } },
        "Framed as what the architecture supports, not how likely it is to succeed. The single most expensive mistake in reading early data is treating a Phase 2 effect size as an estimate of the Phase 3 result — see the Phase 2→3 Translator in Simulation for what the published shrinkage actually looks like."),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 16 } },
        PHASE_CAPABILITIES.map(p => h("div", { key: p.phase },
          h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--teal)", marginBottom: 6 } }, p.phase),
          h("div", { style: { display: "flex", gap: 18, flexWrap: "wrap" } },
            h("div", { style: { flex: "1 1 260px" } },
              h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Can establish"),
              h("ul", { style: { margin: 0, paddingLeft: 16 } }, p.canShow.map((t, i) => h("li", { key: i, style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 3 } }, t)))),
            h("div", { style: { flex: "1 1 260px" } },
              h("div", { style: { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 } }, "Cannot"),
              h("ul", { style: { margin: 0, paddingLeft: 16 } }, p.cannotShow.map((t, i) => h("li", { key: i, style: { fontSize: 11.5, fontFamily: "var(--sans)", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 3 } }, t))))
          )
        )))
    ])
  );

  const tabs = [["guide","How This Works"],["revenue","Revenue Build"],["cost","Cost Structure"],["rd","R&D & Timeline"],["pos","Probability of Success"],["discount","Discount Rate"],["valuation","Valuation & Dilution"],["ma","M&A Comps"],["glossary","Trial Glossary"]];

  return h("div", { style: { maxWidth: 880, margin: "0 auto", padding: "24px 20px 60px" } },
    h("div", { style: { fontFamily: "var(--display)", fontSize: 24, fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 } }, "Reference Sheet"),
    h("div", { style: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-3)", marginBottom: 20 } }, "Every benchmark the engine uses (and a few it will use next), sourced. This is what stands in for napkin math."),
    h("div", { style: { display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" } },
      tabs.map(([id,lbl]) => h("button", { key: id, onClick: () => setTab(id),
        style: { padding: "6px 14px", borderRadius: 7, border: "1px solid var(--rule)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12,
          background: tab === id ? "var(--teal-bg)" : "transparent", color: tab === id ? "var(--teal)" : "var(--ink-2)", fontWeight: tab === id ? 700 : 400 }
      }, lbl))),
    tab === "guide" ? guideTab() : tab === "revenue" ? revenueTab() : tab === "cost" ? costTab() : tab === "rd" ? rdTab() : tab === "pos" ? posTab() : tab === "discount" ? discountTab() : tab === "valuation" ? valuationTab() : tab === "glossary" ? glossaryTab() : maTab()
  );
}
