// Regression tests for the September 2026 Muse audit (docs/RxNPV_MUSE_AUDIT.md).
//
// One section per finding, each written to FAIL on f49689f (the audited tree)
// and pass once the finding is fixed. Engine math with hand-derived expected
// values lives in math_verification.js as usual; this file covers what needs
// the running UI — a field's display/stored/used round trip, a rendered
// denominator, a stale async result that must not paint.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(__dirname + "/test_desktop.html", "utf8");
const errors = [];
let checks = 0;
const ok = (cond, what) => { checks++; if (!cond) errors.push("FAIL: " + what); };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.warn = (...a) => { const s = a.join(" "); if (!s.includes("EDGAR")) errors.push("WARN: " + s.slice(0, 200)); };
    w.console.error = (...a) => errors.push("ERROR: " + a.join(" ").slice(0, 250));
    w.addEventListener("error", e => errors.push("UNCAUGHT: " + (e.error && e.error.stack || e.message).slice(0, 350)));
    w.fetch = async () => ({ ok: false, status: 404 });
  } });
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = dom.window, d = w.document; await wait(1500);
  const click = el => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const btn = t => [...d.querySelectorAll("button")].find(b => b.textContent.trim() === t);
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new w.Event("input", { bubbles: true })); };
  const inputsByLabel = t => [...d.querySelectorAll("input")].filter(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); });
  const stored = () => JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]")[0];

  click(btn("+ New case")); await wait(400);
  setVal(inputsByLabel("Peak worldwide revenue")[0], "1000"); await wait(150);
  setVal(inputsByLabel("Fully diluted shares")[0], "100000000"); await wait(200);

  // ── FIN-001 — Bear/Bull peak-revenue override: display = stored = used ──
  // The field is labelled $M. Typing 1000 means $1,000M = $1,000,000,000,
  // which is how quickRevenue.peakRevenue is stored and what the engine reads.
  // On f49689f the field then displayed "1000000000" beside "$M", and typing
  // over it multiplied by 1e6 again.
  {
    const header = [...d.querySelectorAll("div")].find(n => n.textContent.trim() === "Edit Bear / Bull assumptions");
    click(header); await wait(300);
    const field = () => inputsByLabel("peak revenue override")[0];
    ok(!!field(), "FIN-001: the Bear peak-revenue override field is present");
    setVal(field(), "1000"); await wait(250);
    const bear = () => stored().programs[0].quickRevenue.scenarioOverrides.bear.peakRevenue;
    ok(bear() === "1000000000", "FIN-001: typing 1000 ($M) stores $1,000,000,000 (got " + bear() + ")");
    ok(field().value === "1000", "FIN-001: the field reads back 1000, not the stored dollars (got " + field().value + ")");
    // Editing what the field shows — here, typing a 0 on the end — must scale
    // the assumption by exactly 10. On f49689f the field showed 1000000000, so
    // the same keystroke stored 10000000000 × 1e6 = $1e16.
    setVal(field(), field().value + "0"); await wait(250);
    ok(bear() === "10000000000", "FIN-001: appending a digit to the displayed value gives $10,000M, not a compounded figure (got " + bear() + ")");
    ok(field().value === "10000", "FIN-001: and the field reads 10000");
    setVal(field(), "1500"); await wait(250);
    ok(bear() === "1500000000", "FIN-001: a new value of 1500 stores $1.5B (got " + bear() + ")");
    // Used: the Bear valuation's peak revenue is the override, not a multiple of Base.
    const c = stored();
    const pv = w.computeProgramValuation(c.programs[0], w.getEffectiveScenarioPreset(c, "bear"), "bear");
    ok(Math.abs(pv.peakRevenue - 1.5e9) < 1, "FIN-001: the engine values Bear at $1,500M peak (got " + pv.peakRevenue + ")");
    setVal(field(), ""); await wait(250);
    ok(bear() === "", "FIN-001: clearing the field clears the override");
  }

  // ── FIN-003 — Peak Sales rates: labelled %, 60 reaches the engine as 0.60 ──
  {
    click(btn("Simulation")); await wait(700);
    click(btn("Peak Sales")); await wait(500);
    const labelOf = id => { const f = d.getElementById(id); const box = f && f.closest(".field"); return box ? box.textContent : ""; };
    ok(/Diagnosis rate \(%\)/.test(d.getElementById("ts-root").textContent), "FIN-003: the diagnosis rate label carries a unit");
    ok(/Peak market share \(%\)/.test(d.getElementById("ts-root").textContent), "FIN-003: the peak share label carries a unit");
    ok(d.getElementById("dxA").value === "60", "FIN-003: the diagnosis default reads 60 (percent), not 0.6 (got " + d.getElementById("dxA").value + ")");
    // Spy on what the form hands the engine.
    let seen = null;
    const real = w.runPeakSalesSimulation;
    w.runPeakSalesSimulation = (inputs, n) => { seen = inputs; return real(inputs, n); };
    const setNum = (id, v) => { d.getElementById(id).value = v; };
    const sel = d.getElementById("shareType"); sel.value = "point"; sel.dispatchEvent(new w.Event("change", { bubbles: true }));
    setNum("dxA", "60"); setNum("txA", "50"); setNum("shareA", "25");
    click(btn("Run simulation")); await wait(600);
    ok(seen && Math.abs(seen.diagnosisRate.value - 0.60) < 1e-12, "FIN-003: typing 60 hands the engine 0.60 (got " + (seen && seen.diagnosisRate.value) + ")");
    ok(seen && Math.abs(seen.peakShare.value - 0.25) < 1e-12, "FIN-003: typing 25 share hands the engine 0.25");
    // A share above 100% is refused on screen, and the engine is not run.
    seen = null;
    setNum("shareA", "150");
    click(btn("Run simulation")); await wait(400);
    const res = d.getElementById("peakSalesResults").textContent;
    ok(seen === null, "FIN-003/FIN-012: a 150% share does not run the simulation");
    ok(/between 0 and 100%/.test(res), "FIN-003/FIN-012: it shows why (" + res.slice(0, 80) + ")");
    w.runPeakSalesSimulation = real;
    click(btn("Workspace")); await wait(400);
  }

  // ── FIN-004 — per-event adverse-event rates carry their denominators ──
  // Fixture from math_verification's AE section: Neutropenia 40/200 = 20.0%
  // vs 5/100 = 5.0%; Nausea 10/200 = 5.0% vs 12/100 = 12.0%.
  {
    const aeSection = { adverseEventsModule: {
      frequencyThreshold: 5, timeFrame: "Up to 24 months",
      eventGroups: [
        { id: "EG000", title: "Drug", seriousNumAffected: 60, seriousNumAtRisk: 200, otherNumAffected: 190, otherNumAtRisk: 200, deathsNumAffected: 40, deathsNumAtRisk: 200 },
        { id: "EG001", title: "Placebo", seriousNumAffected: 20, seriousNumAtRisk: 100, otherNumAffected: 80, otherNumAtRisk: 100, deathsNumAffected: 10, deathsNumAtRisk: 100 }
      ],
      seriousEvents: [
        { term: "Neutropenia", organSystem: "Blood", stats: [
          { groupId: "EG000", numEvents: 90, numAffected: 40, numAtRisk: 200 },
          { groupId: "EG001", numEvents: 6, numAffected: 5, numAtRisk: 100 }] },
        { term: "Nausea", organSystem: "GI", stats: [
          { groupId: "EG000", numEvents: 10, numAffected: 10, numAtRisk: 200 },
          { groupId: "EG001", numEvents: 12, numAffected: 12, numAtRisk: 100 }] }
      ],
      otherEvents: []
    } };
    const host = d.createElement("div"); d.body.appendChild(host);
    const results = w.parseTrialResults({ resultsSection: aeSection });
    const root = w.ReactDOM.createRoot(host);
    root.render(w.React.createElement(w.TrialResultsPanels, { results, study: { protocolSection: {} } }));
    await wait(400);
    const row = [...host.querySelectorAll("tr")].find(tr => /Neutropenia/.test(tr.textContent));
    const cells = row ? [...row.querySelectorAll("td")].map(td => td.textContent.trim()) : [];
    ok(!!row, "FIN-004: the Neutropenia event row renders");
    ok(cells.some(c => /20\.0%/.test(c) && /40\/200/.test(c)), "FIN-004: the drug-arm cell shows 20.0% with 40/200 (" + cells.join(" | ") + ")");
    ok(cells.some(c => /5\.0%/.test(c) && /5\/100/.test(c)), "FIN-004: the placebo cell shows 5.0% with 5/100");
    const nausea = [...host.querySelectorAll("tr")].find(tr => /Nausea/.test(tr.textContent));
    ok(nausea && /12\/100/.test(nausea.textContent), "FIN-004: every event row carries its denominators");
    root.unmount(); host.remove();
  }

  // ── FIN-005 — Company Lookup: the Form 4 panel never outlives its company ──
  // SEC calls are stubbed. Company A's insider is "Alice Alpha"; after a search
  // for company B her trades must not appear — neither from a panel left
  // standing (the reported bug) nor from a Form 4 fetch that lands late.
  {
    const saved = { e: w.electronAPI, pull: w.pullEdgarFinancials, ins: w.fetchInsiderTransactions, tr: w.searchTrialsBySponsor };
    w.electronAPI = Object.assign({}, w.electronAPI || {}, { isDesktop: true });
    const edgar = (q) => ({ ok: true, name: q === "AAA" ? "Alpha Bio" : "Beta Bio", ticker: q, cik: q === "AAA" ? "1" : "2",
      cash: 1e8, debt: 0, basicShares: 1e7, dilutedShares: 1.1e7, options: null, warrants: null,
      sourceFilingUrl: "https://www.sec.gov/x", sourceFilingLabel: "10-Q" });
    w.pullEdgarFinancials = async (q) => edgar(q);
    w.searchTrialsBySponsor = async () => ({ ok: true, studies: [], totalCount: 0 });
    const txns = [{ ownerName: "Alice Alpha", role: "Chief Executive Officer", filingDate: "2026-09-01", sourceUrl: "https://www.sec.gov/f",
      date: "2026-09-01", code: "P", codeLabel: "Open-market purchase", securityTitle: "Common Stock",
      shares: 1000, pricePerShare: 10, acquiredDisposed: "A", valueUsd: 10000, sharesOwnedAfter: 5000 }];
    const insiders = { ok: true, filingsChecked: 1, transactions: txns, derivativeTransactions: [], openMarketSummary: w.summarizeOpenMarketActivity(txns) };
    let release = null;
    w.fetchInsiderTransactions = async () => insiders;

    click(btn("Tools")); await wait(400); click(btn("Company")); await wait(300); click(btn("Company Lookup")); await wait(400);
    const q = d.querySelector('input[aria-label="Company name or ticker"]');
    const searchFor = async (t) => { setVal(q, t); await wait(100); click(btn("Search")); await wait(500); };
    const shown = () => /Alice Alpha/.test(d.body.textContent);

    await searchFor("AAA");
    click(btn("Load insider activity (Form 4)")); await wait(500);
    ok(shown(), "FIN-005: company A's Form 4 insiders load");
    await searchFor("BBB");
    ok(/Beta Bio/.test(d.body.textContent), "FIN-005: company B's EDGAR block is showing");
    ok(!shown(), "FIN-005: a new search unmounts company A's insider panel");

    // The late-landing fetch: load A's Form 4s, search B before they arrive.
    await searchFor("AAA");
    w.fetchInsiderTransactions = () => new Promise(res => { release = () => res(insiders); });
    click(btn("Load insider activity (Form 4)")); await wait(200);
    ok(typeof release === "function", "FIN-005: after a fresh search for A, its Form 4 load can be started (no stale panel in the way)");
    await searchFor("BBB");
    if (release) release();
    await wait(400);
    ok(!shown(), "FIN-005: a Form 4 fetch that lands after a newer search is dropped");
    ok(/Beta Bio/.test(d.body.textContent), "FIN-005: and company B is still what is shown");

    Object.assign(w, { pullEdgarFinancials: saved.pull, fetchInsiderTransactions: saved.ins, searchTrialsBySponsor: saved.tr });
    w.electronAPI = saved.e;
    click(btn("Workspace")); await wait(400);
  }

  // ── FIN-006 — Exclusivity / LOE: a slow earlier lookup cannot overwrite a newer one ──
  // The Look up button is disabled while loading, but Enter in the field runs
  // a new lookup regardless — the realistic way two requests overlap. Eliquis
  // is looked up first and its response is made to land LAST.
  {
    const saved = w.fetchExclusivity;
    const pending = {};
    w.fetchExclusivity = (name) => new Promise(res => { pending[name] = () => res({ ok: false, error: "Orange Book result for " + name }); });
    click(btn("Tools")); await wait(400); click(btn("Commercial")); await wait(300); click(btn("Exclusivity / LOE")); await wait(400);
    const input = d.querySelector('input[placeholder^="Brand name"]');
    const enter = () => input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    setVal(input, "Eliquis"); await wait(100); enter(); await wait(100);
    setVal(input, "Jardiance"); await wait(100); enter(); await wait(100);
    ok(!!pending.Eliquis && !!pending.Jardiance, "FIN-006: two overlapping lookups were started");
    pending.Jardiance(); await wait(200);
    pending.Eliquis(); await wait(300);
    const text = d.body.textContent;
    ok(/Orange Book result for Jardiance/.test(text), "FIN-006: the newer lookup (Jardiance) is what remains on screen");
    ok(!/Orange Book result for Eliquis/.test(text), "FIN-006: the older response, landing last, is dropped");
    w.fetchExclusivity = saved;
    click(btn("Workspace")); await wait(400);
  }

  // ── FIN-011 — the bridge on screen (and in the report) shows the convertible ──
  // Detailed capital: $100M cash, $20M debt, $50M convertible at a $100
  // conversion price against a $10 share price, so it does not convert and is
  // a debt claim the per-share value already subtracts. The bridge must show
  // it, or its chips do not add up to the Equity Value chip.
  {
    click(btn("Workspace")); await wait(400);
    const priceLabel = [...d.querySelectorAll("span")].find(n => n.textContent.trim() === "Current price");
    const price = priceLabel && priceLabel.parentElement.querySelector("input");
    setVal(price, "10"); await wait(150);
    click(btn("Detailed")); await wait(300);
    setVal(inputsByLabel("Basic shares outstanding")[0], "10000000"); await wait(100);
    setVal(inputsByLabel("Cash & equivalents")[0], "100"); await wait(100);
    setVal(inputsByLabel("Debt")[0], "20"); await wait(100);
    setVal(inputsByLabel("Convertible face value")[0], "50"); await wait(100);
    setVal(inputsByLabel("Conversion price")[0], "100"); await wait(400);
    const bridge = d.getElementById("ws-bridge");
    ok(bridge && /Convertible notes \(not converting\)/.test(bridge.textContent), "FIN-011: the Workspace bridge shows the non-converting convertible");
    [...d.querySelectorAll("button")].find(b => /Generate Report/.test(b.textContent)).click(); await wait(700);
    ok(/- Convertible notes \(not converting\)/.test(d.body.textContent), "FIN-011: so does the report's bridge");
    click(btn("← Back to Workspace")); await wait(400);
    click(btn("Simple")); await wait(300);
  }

  // ── FIN-014 — PK/PD rate constants render as k-sub-a / k-sub-e everywhere ──
  // The field labels already did (sci() maps the tokens "Ka"/"Ke" to lower-case
  // k with a subscript), so that half of FIN-014 was a false positive, locked
  // in here. The validation message did not go through sci().
  {
    click(btn("Simulation")); await wait(700);
    click(btn("PK/PD")); await wait(500);
    const kaLabel = d.getElementById("ka").closest("label").querySelector("span");
    ok(kaLabel && /^ka/.test(kaLabel.textContent) && kaLabel.querySelector("sub") && kaLabel.querySelector("sub").textContent === "a",
      "FIN-014: the absorption field reads k with subscript a (" + (kaLabel && kaLabel.innerHTML.slice(0, 40)) + ")");
    d.getElementById("ke").value = "";
    click([...d.querySelectorAll("#ts-root .runbtn")][0]); await wait(400);
    const err = d.querySelector("#pkpdResults .error");
    ok(err && /ke \(elimination rate\)/.test(err.textContent) && [...err.querySelectorAll("sub")].some(n => n.textContent === "e"),
      "FIN-014: the validation message reads k with subscript e, not a capital Ke (" + (err && err.innerHTML.slice(0, 80)) + ")");
    click(btn("Workspace")); await wait(400);
  }

  // ── Found in the packaged-app review — money on the reverse-solve panel ──
  // "What else … price implies" printed peak revenue as $14,417,500,064; every
  // other figure on the panel is compact ($14.42B). With a price set on a
  // single Quick program the panel is showing; no figure may run to 10+ digits.
  {
    click(btn("Workspace")); await wait(400);
    const val = d.getElementById("ws-valuation");
    const box = val && [...val.querySelectorAll("[data-export-section]")].find(n => /What else .* price implies/.test(n.getAttribute("data-export-section") || ""));
    ok(!!box, "Reverse-solve: the panel is showing for this case");
    ok(box && !/\$\d{1,3}(,\d{3}){3,}/.test(box.textContent), "Reverse-solve: money is shown compactly, not as a 10+ digit figure (" + (box && box.textContent.match(/\$[\d,.]+[BMK]?/g) || []).slice(0, 4).join(" ") + ")");
  }

  // ── Doc drift — the documented Trial Watch field count is held to the code ──
  // Four docs said "14 fields"; the code diffs 13 (nine CTGOV_DIFF_FIELDS
  // entries plus four list comparisons). Counted from the source, so a new
  // field updates the expected number and the docs must follow it.
  {
    const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
    const src = fs.readFileSync(path.join(root, "src", "ctgovEngine.js"), "utf8");
    const table = src.slice(src.indexOf("const CTGOV_DIFF_FIELDS"), src.indexOf("];", src.indexOf("const CTGOV_DIFF_FIELDS")));
    const fn = src.slice(src.indexOf("function diffTrialSnapshots"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const n = (table.match(/\{ key: "/g) || []).length + (body.match(/listDiff\("/g) || []).length + (body.match(/field: "/g) || []).length;
    ok(n === 13, "Doc drift: the code diffs " + n + " Trial Watch fields (the docs say 13)");
    const words = { 13: "thirteen" };
    [["README.md", /diff (\d+) fields/], ["CLAUDE.md", /snapshot diff covers (\w+) fields/], [path.join("docs", "RxNPV_Feature_Map.md"), /Diffs (\d+) fields/]].forEach(([f, re]) => {
      const m = fs.readFileSync(path.join(root, f), "utf8").match(re);
      ok(m && (m[1] === String(n) || m[1] === words[n]), "Doc drift: " + f + " states the Trial Watch field count as " + (m && m[1]) + ", the code has " + n);
    });
  }

  // ── NOL field → engine: an NOL typed as $M is a $M shield, not $M x 1e6 ──
  {
    click([...d.querySelectorAll(".case-tab")].find(b => b.textContent.startsWith("Assumptions"))); await wait(200);
    const taxBox = [...d.querySelectorAll("input[type=checkbox]")].find(i => /cash tax/i.test((i.parentElement || {}).textContent || ""));
    if (taxBox && !taxBox.checked) { click(taxBox); await wait(200); }
    const nolInput = [...d.querySelectorAll("input")].find(i => (i.getAttribute("aria-label") || "").startsWith("Existing NOL carryforward"))
      || inputsByLabel("Existing NOL carryforward")[0];
    ok(!!nolInput, "NOL: the Existing NOL carryforward field is on the page");
    if (nolInput) {
      setVal(nolInput, "300"); await wait(200);
      const tax = stored().taxation;
      ok(Number(tax.startingNOLM) === 300e6, "NOL: typing 300 in the $M field stores $300M in dollars (got " + tax.startingNOLM + ")");
      const cal = [{ calendarYear: 0, riskAdjFCF: 500e6 }];
      const out = w.applyTaxToCalendar(cal, tax);
      ok(Math.abs(out[0].tax - 200e6 * 0.21) < 1, "NOL: a $300M shield against $500M profit leaves $200M taxed at 21% = $42M (got " + (out[0].tax / 1e6).toFixed(2) + "M)");
      setVal(nolInput, ""); await wait(100);
    }
  }

  // ── Projections card: table ends at the enterprise value; view toggle remembered ──
  {
    click([...d.querySelectorAll("button")].find(b => b.textContent.trim() === "Load sample case")); await wait(500);
    click(d.getElementById("casetab-overview")); await wait(300);
    const panel = d.getElementById("casepanel-overview");
    const table = panel && panel.querySelector(".proj-table");
    ok(!!table && table.querySelectorAll("tbody tr").length === 16, "Projections: the table shows the first 16 years");
    ok(!!table && /Enterprise value \$1\.65B/.test(table.querySelector("tfoot").textContent), "Projections: the table ends at the Base enterprise value");
    const lastRun = table && [...table.querySelectorAll("tbody tr")].pop().lastChild.textContent;
    ok(!!panel.querySelector('svg[aria-label^="Year-by-year"]'), "Projections: the chart renders");
    const showAll = [...panel.querySelectorAll("button")].find(b => /^Show all \d+ years/.test(b.textContent));
    ok(!!showAll, "Projections: offers the remaining years");
    if (showAll) { click(showAll); await wait(200); }
    ok(table && table.querySelectorAll("tbody tr").length > 16, "Projections: Show all expands the table (" + lastRun + ")");
    click([...panel.querySelectorAll(".proj-toggle button")].find(b => b.textContent === "Chart")); await wait(200);
    ok(!panel.querySelector(".proj-table") && w.localStorage.getItem("rxnpv_proj_view") === "chart", "Projections: Chart hides the table and remembers");
    click([...panel.querySelectorAll(".proj-toggle button")].find(b => b.textContent === "Chart + table")); await wait(200);
    ok(!!panel.querySelector(".proj-table") && !!panel.querySelector('svg[aria-label^="Year-by-year"]'), "Projections: Chart + table shows both again");

    // The case at a glance: facts first, then the least certain judgment call.
    const E = (label, classification, confidence) => ({ label, classification, confidence });
    const pickd = w.pickGlanceEvidence([E("a", "inference", "moderate"), E("b", "fact", "moderate"), E("c", "fact", "high"), E("d", "inference", "low"), E("e", "fact", "high"), E("f", "speculation", "low"), E("g", "fact", "low")], 5).map(e => e.label);
    // Facts by confidence then log order: c, e (high), b (moderate), g (low) -> four;
    // the least certain judgment: d and f are both low; speculation ranks as less
    // certain than inference -> f.
    ok(JSON.stringify(pickd) === '["c","e","b","g","f"]', "Glance: facts by confidence, then the least certain judgment (" + pickd.join(",") + ")");
    ok(w.pickGlanceEvidence([E("x", "inference", "high"), E("y", "inference", "low")], 5).map(e => e.label).join(",") === "y,x", "Glance: with no facts, judgments fill in, least certain first");
    // Bear $13.78, Bull $46.84, price $24.80: midpoint $30.31 -> lower half.
    const rg = w.readGlance(20, 48.75, 78, 13.78, 46.84, 24.80, "PoS");
    ok(rg && rg.text.includes("20 logged pieces of evidence sit behind odds of 49–78% of reaching launch") && rg.text.includes("$13.78 to $46.84 a share, and today's $24.80 sits in the lower half") && rg.text.endsWith("PoS moves the value most."), "Glance: the reading states the ranges and where the price sits");
    ok(w.readGlance(3, 40, 60, 10, 20, 25, null).text.includes("above even your Bull case"), "Glance: a price above Bull says so");
    const gl = [...panel.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "The case at a glance");
    const gt = gl ? [...gl.querySelectorAll("svg text")].map(t => t.textContent) : [];
    ok(!!gl && ["WHAT THE EVIDENCE SAYS", "ODDS OF REACHING LAUNCH", "65%", "price implies 55%", "Base $29.05", "today $24.80"].every(t => gt.includes(t)) && gt.some(t => /^\+\d+ more in the Evidence Log$/.test(t)), "Glance: evidence, odds and value panels render (" + gt.slice(0, 12).join(" | ") + ")");
    ok(!!gl && gt.includes("Lead asset and mechanism") && gt.includes("Diagnosed 75%, treated 60%"), "Glance: the sample's high-confidence facts and its least certain judgment are shown");
    click([...gl.querySelectorAll("button")].find(b => b.textContent === "Hide")); await wait(200);
    ok(![...panel.querySelectorAll("[data-export-section]")].some(e => e.getAttribute("data-export-section") === "The case at a glance") && w.localStorage.getItem("rxnpv_glance_hidden") === "1", "Glance: Hide removes it and remembers");
    click([...panel.querySelectorAll("button")].find(b => b.textContent === "Show the case at a glance")); await wait(300);
    ok([...panel.querySelectorAll("[data-export-section]")].some(e => e.getAttribute("data-export-section") === "The case at a glance"), "Glance: Show brings it back");

    // Outcome tree reading: failures 0.30 at "A readout" and 0.10 at the FDA ->
    // 0.30 / 0.40 = 75% at A -> "most of the risk".
    const rt2 = w.readOutcomeTree([{ label: "A readout", failProb: 0.3 }, { label: "FDA decision", failProb: 0.1 }], 20, 21);
    ok(rt2 && rt2.verdict === "The A readout is most of the risk." && rt2.text.startsWith("75% of the failures in this case happen at the A readout.") && rt2.text.includes("$20.00, against the model's Base of $21.00"), "Tree: the reading names where the failures sit");
    ok(w.readOutcomeTree([{ label: "A", failProb: 0.2 }, { label: "B", failProb: 0.15 }], 1, 1).verdict === "The risk is spread across 2 gates.", "Tree: under 60% at one gate reads as spread");
    const tree = [...panel.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "How the catalysts play out");
    const tt = tree ? [...tree.querySelectorAll("svg text, .tree-list")].map(t => t.textContent).join(" | ") : "";
    ok(!!tree && ["Launches", "$43.24 a share", "≈$1.40 a share", "≈$0.74 a share", "positive · 80%", "approved · 81%"].every(t => tt.includes(t)) || (!!tree && /Phase 3 readout.*positive 80%.*≈\$1\.40/.test(tt)), "Tree: gates, odds and endings render (" + tt.slice(0, 160) + ")");
    ok(!!tree && /0\.65 × \$43\.24/.test(tree.textContent), "Tree: the weighted sum is written out");

    // Readout scenarios reading: price $20; clear $30 (+50%), modest $22 (+10%),
    // miss $2 (-90%); weighted $24 = +20%; miss chance 0.25 -> "one time in four".
    const rr = w.readReadoutScenarios([{ value: 30, prob: 0.45 }, { value: 22, prob: 0.3 }, { value: 2, prob: 0.25 }], 24, 20, 25);
    ok(rr && rr.verdict === "A win is worth +10% to +50%; a miss costs 90%." && rr.text.includes("$24.00 — 20% above today's price, against the Base case's $25.00") && rr.text.includes("one time in four"), "Readout: the reading states the moves and the weighted value");
    click(d.getElementById("casetab-scenarios")); await wait(300);
    const rsSec = [...d.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "Before the next readout");
    ok(!!rsSec && /EMPEROR Phase 3 topline: what each result would do to the value/.test(rsSec.textContent) && /≈\$1\.40/.test(rsSec.textContent), "Readout: the table renders on Scenarios, named from the Calibration Log");
    const splitIn = rsSec && rsSec.querySelector('input[aria-label="Clear wins as a share of all wins (%)"]');
    ok(!!splitIn && splitIn.placeholder === "60", "Readout: blank inputs show their defaults");
    if (splitIn) { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(splitIn, "50"); splitIn.dispatchEvent(new w.Event("input", { bubbles: true })); await wait(300); }
    const stored = JSON.parse(w.localStorage.getItem("rxnpv_cases_v1")).find(c => c.name === "Stoke Therapeutics — sample case");
    const rsNow = [...d.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "Before the next readout");
    ok(stored && stored.readoutScenarios && stored.readoutScenarios.clearOfWinsPct === "50" && /40%[\s\S]*40%[\s\S]*20%/.test(rsNow.querySelector("tbody").textContent), "Readout: an edit is saved on the case and splits wins 40/40");
    click(d.getElementById("casetab-overview")); await wait(300);

    // The whole range on one line, with the failure floor.
    const rng = [...panel.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "The whole range, on one line");
    const rt = rng ? [...rng.querySelectorAll("svg text")].map(t => t.textContent) : [];
    ok(!!rng && ["If it fails", "≈$1.40", "If it works", "Today", "Bear", "Base", "Bull"].every(t => rt.includes(t)), "Range strip: floor, scenarios, today and success all marked (" + rt.join(" | ") + ")");
    ok(!!rng && /paying 56% of the way from failure to success/.test(rng.textContent), "Range strip: the reading places the price between failure and success");
    ok(!!rng && /1 year of wind-down G&A \$95\.0M/.test(rng.textContent), "Range strip: the floor's arithmetic is written out");

    // Break-even and the value bridge, side by side.
    const beSec = [...panel.querySelectorAll("[data-export-section]")].find(e => e.getAttribute("data-export-section") === "Break-even peak revenue");
    ok(!!beSec && /The price needs about \$1\.1\dB of peak revenue/.test(beSec.textContent) && !!beSec.querySelector('svg[aria-label^="Fair value per share at each peak"]'), "Break-even: headline and chart (" + (beSec && beSec.textContent.slice(0, 60)) + ")");
    const br = d.getElementById("ws-bridge");
    ok(!!br && /The price is \$3\d\d\.\dM below what this case finds/.test(br.textContent) && !!br.querySelector('svg[aria-label^="Value bridge"]'), "Bridge: gap headline and waterfall");
    ok(!!br && /= Equity value \$2\.35B ÷ [\d,]+ diluted shares = \$29\.05 a share/.test(br.textContent), "Bridge: the exact one-line version ends at the Base per-share value");
    ok(!!br && /A 10-point gap/.test(br.textContent), "Bridge: the reading states the odds gap");

    // Monte Carlo: a histogram of every trial with labelled markers, not five bars.
    click([...panel.querySelectorAll("button")].find(b => b.textContent.includes("Run 3,000 trials"))); await wait(4000);
    const hist = panel.querySelector('svg[aria-label^="Histogram of 3,000"]');
    ok(!!hist && hist.querySelectorAll("rect").length >= 8, "Monte Carlo: histogram of every trial renders");
    const labels = hist ? [...hist.querySelectorAll("text")].map(t => t.textContent) : [];
    ok(["P10 ", "Median ", "P90 ", "Today $24.80", "Base $29.05"].every(l => labels.some(t => t.startsWith(l))), "Monte Carlo: P10, median, P90, today and Base are all marked (" + labels.filter(t => /\s\$/.test(t)).join(" | ") + ")");
    ok(/Above today's price/.test(panel.textContent), "Monte Carlo: states the share of trials above today's price");
  }

  // ── Assumptions section list: states come from the data, links are live ──
  {
    const find = (groups, id) => { for (const g of groups) for (const i of g.items) if (i.id === id) return i; return null; };
    const c0 = w.newCase(), p0 = c0.programs[0];
    let g = w.assumptionNavSections(c0, p0);
    ok(find(g, "capital").state === "todo", "Section list: a fresh case's capital structure should need an input");
    ok(find(g, "revenue").state === "todo", "Section list: a fresh program's quick revenue should need an input");
    ok(["company", "ga", "rnd", "loe", "cost", "pos", "prv", "partner"].every(id => find(g, id).state === ""), "Section list: a fresh case should show no changed sections");
    ok(find(g, "output").state === "result" && find(g, "waterfall").state === "result", "Section list: outputs are marked as results");
    // "13" and 13 are the same number; a blank never counts as a change.
    const p1 = JSON.parse(JSON.stringify(p0));
    p1.revenueBuild.exclusivity.yearsToLOE = 13; p1.revenueBuild.exclusivity.modality = "biologic"; p1.costStructure.cogsPct = "";
    g = w.assumptionNavSections(c0, p1);
    ok(find(g, "loe").state === "" && find(g, "cost").state === "", "Section list: an equal number, a synced modality or a blank must not count as a change");
    p1.revenueBuild.exclusivity.yearsToLOE = "11"; p1.costStructure.reps.specialty = "80";
    const c1 = Object.assign({}, c0, { corporateGA: { preCommercialAnnualM: "40", gaShareOfMatureSgaPct: "50" }, valuationMethod: "multiple" });
    g = w.assumptionNavSections(c1, p1);
    ok(find(g, "loe").state === "set" && find(g, "ga").state === "set" && find(g, "company").state === "set", "Section list: real changes mark their sections");
    ok(find(g, "cost").state === "unused", "Section list: Simple Multiple marks Cost Structure as not used");
    p1.revenueMode = "full";
    g = w.assumptionNavSections(c0, p1);
    ok(!find(g, "revenue") && find(g, "pop").state === "todo" && find(g, "price").state === "todo", "Section list: Detailed mode lists the five steps, with population and price required");
    ok(w.differsFromDefault([], []) === false && w.differsFromDefault([{ a: 1 }], []) === true, "Section list: arrays compare by whether anything was added");

    // In the UI: every listed section exists on the page, a click opens a
    // collapsed card, and Hide is remembered.
    click([...d.querySelectorAll(".case-tab")].find(b => b.textContent.startsWith("Assumptions"))); await wait(300);
    const nav = d.querySelector(".secnav");
    ok(!!nav, "Section list: rendered on the Assumptions tab");
    const items = nav ? [...nav.querySelectorAll(".secnav-item")] : [];
    ok(items.length >= 12, "Section list: expected at least 12 sections, found " + items.length);
    const cost = items.find(b => b.textContent.startsWith("Cost structure"));
    const card = d.querySelector('#casepanel-assumptions [data-nav="cost"]');
    ok(card && card.querySelector('[aria-expanded="false"]'), "Section list: Cost Structure starts collapsed");
    click(cost); await wait(200);
    ok(card && card.querySelector('[aria-expanded="true"]'), "Section list: clicking a collapsed section opens it");
    ok(cost.getAttribute("aria-current") === "location", "Section list: the clicked section is marked current");
    click(nav.querySelector(".secnav-hide")); await wait(200);
    ok(!d.querySelector(".secnav") && w.localStorage.getItem("rxnpv_secnav_hidden") === "1", "Section list: Hide removes it and remembers");
    click(btn("Show section list")); await wait(200);
    ok(!!d.querySelector(".secnav") && w.localStorage.getItem("rxnpv_secnav_hidden") === "0", "Section list: Show section list brings it back");
  }

  if (errors.length) { console.log(errors.slice(0, 40).join("\n")); console.log("\n" + errors.length + " FAILURE(S) across " + checks + " checks"); process.exit(1); }
  console.log("ALL AUDIT REGRESSION CHECKS PASSED — " + checks + " checks");
  process.exit(0);
})();
