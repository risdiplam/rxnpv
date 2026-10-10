#!/usr/bin/env node
// Live API health check — every external data source the app reads, through
// the app's OWN fetch-and-parse functions, several rounds each.
//
//   npm run apihealth                 # 3 rounds (default)
//   node api_health.js --rounds=5     # more rounds, a better failure rate
//   node api_health.js --only=edgar   # one integration
//
// Two different things go wrong with a live API, and this separates them:
//   · TRANSPORT — the service did not answer usably (timeout, 5xx, 429). The
//     app retries these (netEngine.js); a check that still fails after the
//     app's retries is counted here.
//   · CONTENT — the service answered, but what the app extracted is wrong or
//     missing: a renamed field, a changed shape, a parse that drifted. Every
//     check asserts values verified by hand against the primary source
//     (see the comment on each), so drift shows up as a failed assertion.
// A content failure is a bug to fix. A transport failure that repeats is a
// service or rate-limit problem worth knowing about.
//
// Needs Node 18+ and the network. Not part of `npm test`. EDGAR is reached
// through a shim of the desktop app's `edgar:fetch` bridge that sends the same
// User-Agent main.js sends; Node's own User-Agent is replaced with a browser
// one because Open Targets' server refuses Node's (the app runs in Chromium).
const fs = require("fs"), path = require("path");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v == null ? true : v]));
const ROUNDS = Math.max(1, parseInt(args.rounds || "3", 10));
const ONLY = args.only ? String(args.only).split(",") : null;

const nodeFetch = global.fetch;
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
const EDGAR_UA = "RxNPV Research contact@rxnpv.local";
// Count every request, and every retry the app makes (a repeat of the same URL).
const log = { requests: 0, byHost: {} };
global.fetch = (url, opts) => {
  const u = typeof url === "string" ? url : url.url;
  const host = new URL(u).hostname;
  log.requests++; log.byHost[host] = (log.byHost[host] || 0) + 1;
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({ "User-Agent": BROWSER_UA }, o.headers || {});
  return nodeFetch(u, o);
};
// Form 4 XML is parsed with the browser's DOMParser in the app.
global.DOMParser = new (require("jsdom").JSDOM)("").window.DOMParser;
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
global.React = { createElement: () => null, useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), Fragment: "F", Component: class {} };
global.document = { createElement: () => ({ style: {} }), getElementById: () => null, documentElement: { getAttribute: () => null } };
global.window = { electronAPI: { isDesktop: true, edgarFetch: async url => {
  // Mirrors electron/main.js 'edgar:fetch', including its retries.
  const res = await edgarMainFetch(url);
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { ok: res.ok, status: res.status, json, text: json ? null : text };
} } };

const SRC = path.join(__dirname, "..", "src");
const b = fs.readFileSync(path.join(SRC, "..", "build.js"), "utf8");
const lt = b.slice(b.indexOf("const MODULE_ORDER = ["));
const order = (lt.slice(0, lt.indexOf("];")).match(/'[^']+\.js'/g) || []).map(s => s.slice(1, -1)).filter(f => !/^ts_app|app\.js$/.test(f));
const code = order.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n");
const NAMES = ["fetchStudyByNctId", "fetchAssetProgram", "searchTrialsBySponsor", "fetchHistoricalComps", "fetchAnalogEffects",
  "searchDrugApproval", "fetchExclusivity", "fetchApprovalHistory", "fetchDrugLabel", "fetchAdverseEventSummary",
  "pullEdgarFinancials", "searchCatalystFilings", "fetchInsiderTransactions", "searchLiterature", "publicationsForTrial",
  "resolveTarget", "fetchTargetDossier", "fetchDrugSpending", "searchCompetitorLandscape", "resilientFetch",
  "fetchMedicaidSpending", "fetchPublicPayerSpending", "resolveDrugIdentity"];
const api = new Function("module", "require", code + "\nreturn {" + NAMES.map(n => n + ": typeof " + n + " !== 'undefined' ? " + n + " : null").join(",") + "};")({ exports: null }, require);
// main.js's EDGAR fetch, reproduced with the same retry rules (kept in step by hand).
async function edgarMainFetch(url) {
  return api.resilientFetch ? api.resilientFetch(url, { headers: { "User-Agent": EDGAR_UA, "Accept-Encoding": "gzip, deflate" }, timeoutMs: 20000, label: "EDGAR" })
    : nodeFetch(url, { headers: { "User-Agent": EDGAR_UA } });
}

const near = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= tol;
// Each check: [integration, name, async fn returning [[label, pass, got], ...]].
// A thrown error or { ok: false } is a transport failure; a false assertion is content.
const CHECKS = [
  ["ctgov", "EMPEROR registration (NCT06872125)", async () => {
    const r = await api.fetchStudyByNctId("NCT06872125"); must(r);
    const s = r.study;
    return [["phase 3", s.phase === "PHASE3", s.phase], ["randomised", s.allocation === "RANDOMIZED", s.allocation],
      ["quadruple-blind", s.masking === "QUADRUPLE", s.masking], ["2 arms", s.armCount === 2, s.armCount],
      ["primary at week 28", (s.primaryOutcomesFull || []).some(o => /Week 28/i.test(o.timeFrame || "")), (s.primaryOutcomesFull || []).map(o => o.timeFrame).join("; ")]];
  }],
  ["ctgov", "GWPCARE1 posted results (NCT02091375)", async () => {
    // Registered: median difference −22.79 (95% CI −41.06 to −5.43), p = 0.0123.
    const r = await api.fetchStudyByNctId("NCT02091375"); must(r);
    const a = r.results && r.results.primaryOutcomes && r.results.primaryOutcomes[0] && (r.results.primaryOutcomes[0].analyses || [])[0];
    return [["results parsed", !!a, !!a], ["estimate −22.79", a && near(Number(a.value), -22.79, 0.005), a && a.value],
      ["p = 0.0123", a && String(a.pValue) === "0.0123", a && a.pValue]];
  }],
  ["ctgov", "Asset Program: zorevunersen + code name", async () => {
    const r = await api.fetchAssetProgram("zorevunersen, STK-001"); must(r);
    const ids = r.summary.matched.map(s => s.nctId).sort();
    return [["3 trials", ids.length === 3, ids.join(",")], ["includes MONARCH (code name only)", ids.includes("NCT04442295"), ids.join(",")]];
  }],
  ["ctgov", "Sponsor search: Stoke Therapeutics", async () => {
    const r = await api.searchTrialsBySponsor("Stoke Therapeutics", 20); must(r);
    return [["at least 3 trials", r.studies.length >= 3, r.studies.length]];
  }],
  ["ctgov", "Trial Explorer: Dravet Phase 3", async () => {
    const r = await api.fetchHistoricalComps("Dravet syndrome", "PHASE3");
    return [["returns studies", r && r.studies && r.studies.length >= 20, r && r.totalMatched], ["status landscape", r && r.statusLandscape && r.statusLandscape.length > 0, r && r.statusLandscape && r.statusLandscape.length]];
  }],
  ["ctgov", "DM1 searches exclude T-DM1 (trastuzumab emtansine) trials", async () => {
    // CT.gov expands "myotonic dystrophy type 1" through "DM1" to T-DM1; on
    // 2026-09-30, 18 of 23 Phase 2 trials with results for this query were
    // breast/gastric cancer trials. Every kept hit must be about DM1.
    // (Kept hits may name DM1 only in keywords or MeSH terms, so the test is
    // for what must not be there, not for what must.)
    const dm = s => !/trastuzumab|t-dm1|emtansine|breast|gastric/i.test([s.title, (s.conditions || []).join(" ")].join(" "));
    const e = await api.fetchAnalogEffects("Myotonic dystrophy type 1", "PHASE2");
    const c = await api.fetchHistoricalComps("Myotonic dystrophy type 1", "PHASE2");
    const k = await api.searchCompetitorLandscape("Myotonic dystrophy type 1", "PGN-EDODM1", 40); must(k);
    const cancerRows = [].concat(...Object.values((e && e.byScale) || {})).filter(r => /trastuzumab|t-dm1|breast/i.test(r.outcomeTitle || "") );
    return [["analog board: cancer trials dropped", e && e.droppedUnrelated >= 10, e && e.droppedUnrelated],
      ["analog board: no breast-cancer effects left", cancerRows.length === 0, cancerRows.length],
      ["comps: nothing about trastuzumab left", c && c.studies.every(s => !/trastuzumab|t-dm1/i.test(s.title || "")), c && c.studies.filter(s => /trastuzumab|t-dm1/i.test(s.title || "")).map(s => s.nctId).join(",")],
      ["competitors: no T-DM1 or cancer trials", k.studies.every(dm), k.studies.filter(s => !dm(s)).map(s => s.nctId + " " + s.title).slice(0, 3).join("; ")]];
  }],
  ["openfda", "Drugs@FDA: Fintepla", async () => {
    // NDA212102, UCB, first approved 2020-06-25.
    const r = await api.searchDrugApproval("Fintepla"); must(r);
    const x = r.results.find(z => z.applicationNumber === "NDA212102");
    return [["NDA212102 found", !!x, r.results.map(z => z.applicationNumber).join(",")], ["approved 2020-06-25", x && x.firstApprovalDate === "20200625", x && x.firstApprovalDate]];
  }],
  ["openfda", "Orange Book: Spinraza", async () => {
    // 7 distinct patents; substance floor US8361977, 2030-12-23; last 2036-03-04.
    const r = await api.fetchExclusivity("Spinraza"); must(r);
    const s = r.summary;
    return [["7 patents", s.uniquePatentCount === 7, s.uniquePatentCount], ["substance floor 2030-12-23", s.latestSubstance && s.latestSubstance.expiryRaw === "20301223", s.latestSubstance && s.latestSubstance.expiryRaw],
      ["last expiry 2036-03-04", s.latest && s.latest.expiryRaw === "20360304", s.latest && s.latest.expiryRaw]];
  }],
  ["openfda", "Label: fenfluramine", async () => {
    const r = await api.fetchDrugLabel("fenfluramine");
    if (!r || !r.found) throw new Error("label not found");
    return [["Dravet, 2 years and older", /Dravet/.test(r.indicationsAndUsage) && /2 years of age and older/.test(r.indicationsAndUsage), (r.indicationsAndUsage || "").slice(0, 80)],
      ["boxed warning present", /VALVULAR HEART DISEASE/.test(r.boxedWarning || ""), !!r.boxedWarning],
      // openFDA's field is warnings_and_cautions; the app read a name that
      // does not exist and showed no Warnings & Precautions on any label.
      ["warnings & precautions present", /Valvular Heart Disease|Pulmonary Arterial Hypertension/i.test(r.warningsAndPrecautions || ""), (r.warningsAndPrecautions || "").slice(0, 60)]];
  }],
  ["openfda", "Label: Vyondys 53 kidney warning", async () => {
    const r = await api.fetchDrugLabel("Vyondys 53");
    if (!r || !r.found) throw new Error("label not found");
    return [["Kidney Toxicity in warnings & precautions", /Kidney Toxicity/i.test(r.warningsAndPrecautions || ""), (r.warningsAndPrecautions || "").slice(0, 60)]];
  }],
  ["openfda", "FAERS: fenfluramine", async () => {
    const r = await api.fetchAdverseEventSummary("fenfluramine");
    const top = r && r.topReportedReactions || [];
    return [["reactions returned", top.length >= 5, top.length], ["counts are numbers", top.every(t => typeof t.reportCount === "number" && t.reportCount > 0), top[0] && top[0].reportCount]];
  }],
  ["edgar", "Financials: STOK (Q2 2026 10-Q)", async () => {
    // Balance sheet Jun 30, 2026: cash $110.004M + marketable $182.814M + $61.502M = $354.320M.
    // Cover page: 64,526,242 shares at Jul 30, 2026. 10-K: 10,151,430 options at $13.84.
    const r = await api.pullEdgarFinancials("STOK", true); must(r);
    return [["cash & securities $354.32M", near(r.cash, 354320000, 1000), r.cash], ["basic shares 64,526,242", r.basicShares === 64526242, r.basicShares],
      ["options 10,151,430 @ $13.84", r.options && r.options.count === 10151430 && near(r.options.avgStrike, 13.84, 0.001), r.options && r.options.count],
      ["dated", r.asOf === "2026-06-30" && r.basicSharesAsOf === "2026-07-30", r.asOf + " / " + r.basicSharesAsOf],
      // Cash used in operations, H1 2026: $117.167M over 6 months → $58.58M a quarter, 18.1 months of runway.
      ["burn from operating cash flow, ≈$58.58M a quarter", r.burnBasis === "cash used in operations" && near(r.quarterlyBurnUSD, 58583500, 1000), r.burnBasis + " " + r.quarterlyBurnUSD],
      ["runway ≈18.1 months", near(r.runwayMonths, 18.14, 0.05), r.runwayMonths]];
  }],
  ["edgar", "Financials: PEPG (Q2 2026 10-Q)", async () => {
    // 10-Q for Jun 30, 2026: cash, equivalents and marketable securities
    // $117.238M; 69,259,517 shares at Aug 2, 2026; 8,139,082 options at a
    // $4.89 weighted strike; cash used in operations $34.232M in H1 → $17.116M
    // a quarter → 117.238 / 17.116 x 3 = 20.55 months.
    const r = await api.pullEdgarFinancials("PEPG", true); must(r);
    return [["cash & securities $117.238M", near(r.cash, 117238000, 1000), r.cash],
      ["basic shares 69,259,517 at 2026-08-02", r.basicShares === 69259517 && r.basicSharesAsOf === "2026-08-02", r.basicShares + " " + r.basicSharesAsOf],
      ["options 8,139,082 @ $4.89", r.options && r.options.count === 8139082 && near(r.options.avgStrike, 4.89, 0.001), r.options && r.options.count],
      ["burn $17.116M a quarter from operating cash flow", r.burnBasis === "cash used in operations" && near(r.quarterlyBurnUSD, 17116000, 1000), r.quarterlyBurnUSD],
      ["runway ≈20.5 months", near(r.runwayMonths, 20.55, 0.05), r.runwayMonths]];
  }],
  ["edgar", "Catalyst filings: STOK", async () => {
    const r = await api.searchCatalystFilings("0001623526", 12); must(r);
    return [["filings found", r.hits.length > 0, r.hits.length], ["every type read (no '?')", r.hits.every(h => h.formType && h.formType.indexOf("?") === -1), r.hits.map(h => h.formType).slice(0, 4).join(",")]];
  }],
  ["edgar", "Form 4 insider transactions: STOK", async () => {
    const r = await api.fetchInsiderTransactions("0001623526", 10); must(r);
    return [["filings parsed", r.filingsParsed > 0, r.filingsParsed + " of " + r.filingsChecked], ["every filing parsed", r.filingsParsed === r.filingsChecked, r.filingsParsed + " of " + r.filingsChecked],
      ["rows have codes and dates", [].concat(r.transactions, r.derivativeTransactions).every(t => t.code && t.date), (r.transactions || []).length + (r.derivativeTransactions || []).length]];
  }],
  ["europepmc", "Literature: zorevunersen", async () => {
    const r = await api.searchLiterature("zorevunersen", {}); must(r);
    return [["papers found", r.totalMatched >= 20, r.totalMatched], ["publication types read", r.rows.every(x => x.kindLabel), r.rows[0] && r.rows[0].kindLabel]];
  }],
  ["europepmc", "Publications for a trial: NCT04442295", async () => {
    const r = await api.publicationsForTrial("NCT04442295", {}); must(r);
    return [["returns a list", Array.isArray(r.rows), r.totalMatched]];
  }],
  ["opentargets", "Target: SCN1A", async () => {
    const r = await api.resolveTarget("SCN1A"); must(r);
    const id = r.hits && r.hits[0] && r.hits[0].ensemblId;
    return [["ENSG00000144285", id === "ENSG00000144285", id]];
  }],
  ["opentargets", "Dossier: SCN1A", async () => {
    const r = await api.fetchTargetDossier("ENSG00000144285"); must(r);
    const text = JSON.stringify(r);
    return [["Dravet among associations", /Dravet/i.test(text), text.length]];
  }],
  ["cms", "Medicare Part D: Fintepla", async () => {
    // CMS annual Part D: 2024 spending $40.9M, 292 beneficiaries (checked on screen, Sept 2026).
    const r = await api.fetchDrugSpending("Fintepla", { programme: "D" }); must(r);
    const y24 = r.series.find(s => s.label === "2024");
    return [["2024 row", !!y24, r.series.map(s => s.label).join(",")], ["2024 spend ≈ $40.9M", y24 && near(y24.spending, 40.9e6, 0.1e6), y24 && y24.spending],
      ["a quarterly row", r.series.some(s => s.source === "quarterly"), r.latest && r.latest.label]];
  }],
  // Medicaid (October 2026). Figures read by hand from CMS's files on 2026-10-10.
  ["cms", "Part B spend per patient: Keytruda", async () => {
    // Part B writes "Avg_Spndng_Per_Bene": 2024 $79,464.46 a patient.
    const r = await api.fetchDrugSpending("Keytruda", { programme: "Part B" }); must(r);
    const y24 = r.series.find(s => s.label === "2024");
    return [["2024 spend per patient ≈ $79,464", y24 && near(y24.avgSpendPerBene, 79464.46, 1), y24 && y24.avgSpendPerBene]];
  }],
  ["medicaid", "Annual summary + state file: Evrysdi", async () => {
    // Annual summary 2024: $345,298,729.48. State file 2025 (national rows,
    // matched by the FDA's two package codes): ≥ $398.95M, one package hidden.
    const r = await api.fetchMedicaidSpending("Evrysdi"); must(r);
    const y24 = r.series.find(s => s.label === "2024"), y25 = r.series.find(s => s.label === "2025");
    return [["2024 ≈ $345.30M", y24 && near(y24.spending, 345.30e6, 0.1e6), y24 && y24.spending],
      ["state file matched by package codes", r.stateFile && r.stateFile.matchedBy === "package codes", r.stateFile && r.stateFile.matchedBy],
      ["2025 from the state file, ≥ $390M", y25 && y25.source === "state file" && y25.spending > 390e6, y25 && y25.spending]];
  }],
  ["medicaid", "Generic-name fallback: Exondys 51", async () => {
    // CMS's summary spells it "Exondys-51"; found through eteplirsen. 2024 $257.42M.
    const r = await api.fetchMedicaidSpending("Exondys 51"); must(r);
    const y24 = r.series.find(s => s.label === "2024");
    return [["found by generic name", r.matchedBy === "generic", r.matchedBy], ["2024 ≈ $257.42M", y24 && near(y24.spending, 257.42e6, 0.1e6), y24 && y24.spending]];
  }],
  ["medicaid", "Hidden is not zero: Zolgensma", async () => {
    // Annual 2024 $118.95M; every 2025 package-quarter hidden in the state file.
    const r = await api.fetchMedicaidSpending("Zolgensma"); must(r);
    const y24 = r.series.find(s => s.label === "2024"), y25 = r.series.find(s => s.year === 2025);
    return [["2024 ≈ $118.95M", y24 && near(y24.spending, 118.95e6, 0.1e6), y24 && y24.spending],
      ["2025 hidden, spending null", y25 && y25.hidden === true && y25.spending === null, y25 && JSON.stringify({ hidden: y25.hidden, spending: y25.spending })]];
  }],
  ["medicaid", "All public payers: Fintepla", async () => {
    // 2024: Medicare Part D $40.89M + Medicaid $189.78M = $230.66M; no Part B record.
    const r = await api.fetchPublicPayerSpending("Fintepla"); must(r);
    const row = r.combined.find(c => c.year === 2024 && c.isFullYear);
    return [["2024 total ≈ $230.66M", row && near(row.total, 230.66e6, 0.15e6), row && row.total], ["2024 complete", row && row.complete, row && row.noFigure]];
  }]
];
function must(r) { if (!r) throw new Error("no response"); if (r.ok === false) throw new Error(r.error || "ok:false"); }

(async () => {
  const results = {};
  const todo = CHECKS.filter(c => !ONLY || ONLY.includes(c[0]));
  for (let round = 1; round <= ROUNDS; round++) {
    for (const [grp, name, fn] of todo) {
      const key = grp + " · " + name;
      const rec = results[key] = results[key] || { grp, runs: 0, transport: [], content: [], ms: [] };
      rec.runs++;
      const t0 = Date.now();
      try {
        const asserts = await fn();
        rec.ms.push(Date.now() - t0);
        const bad = asserts.filter(a => !a[1]);
        if (bad.length) rec.content.push(bad.map(a => a[0] + " (got " + JSON.stringify(a[2]) + ")").join("; "));
      } catch (e) {
        rec.ms.push(Date.now() - t0);
        rec.transport.push(String(e.message || e).slice(0, 160));
      }
    }
    process.stdout.write("round " + round + "/" + ROUNDS + " done\n");
  }
  let contentFails = 0, transportFails = 0;
  const byGrp = {};
  console.log("");
  for (const [key, r] of Object.entries(results)) {
    const ok = r.runs - r.transport.length - r.content.length;
    const med = r.ms.slice().sort((a, b) => a - b)[Math.floor(r.ms.length / 2)];
    const tag = r.content.length ? "CONTENT" : r.transport.length ? "FLAKY  " : "OK     ";
    console.log(tag + " " + (ok + "/" + r.runs).padEnd(6) + String(med + "ms").padStart(8) + "  " + key);
    [...new Set(r.content)].forEach(m => console.log("          content: " + m));
    [...new Set(r.transport)].forEach(m => console.log("          transport: " + m));
    contentFails += r.content.length; transportFails += r.transport.length;
    const g = byGrp[r.grp] = byGrp[r.grp] || { runs: 0, fails: 0 }; g.runs += r.runs; g.fails += r.content.length + r.transport.length;
  }
  console.log("\nBy integration: " + Object.entries(byGrp).map(([g, x]) => g + " " + (x.runs - x.fails) + "/" + x.runs).join(" · "));
  console.log("Requests: " + log.requests + " (" + Object.entries(log.byHost).map(([h, n]) => h + " " + n).join(", ") + ")");
  console.log(contentFails + " content failure(s), " + transportFails + " transport failure(s) across " + ROUNDS + " round(s).");
  process.exit(contentFails ? 1 : 0);
})();
