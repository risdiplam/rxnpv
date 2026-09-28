// Backup & restore, and the bundled sample case.
//
// The pure functions are checked against a stub storage with known contents;
// the UI half runs in the real built page (jsdom) — the sample case must load
// as a new, complete case without touching an existing one, and the backup
// dialog must open and close.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(__dirname + "/test_desktop.html", "utf8");
const errors = [];
let checks = 0;
const ok = (cond, what) => { checks++; if (!cond) errors.push("FAIL: " + what); };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.error = (...a) => errors.push("ERROR: " + a.join(" ").slice(0, 250));
    w.addEventListener("error", e => errors.push("UNCAUGHT: " + (e.error && e.error.stack || e.message).slice(0, 350)));
    w.fetch = async () => ({ ok: false, status: 404 });
  } });
const wait = ms => new Promise(r => setTimeout(r, ms));

// A storage stub with the Web Storage surface the functions use.
function stub(obj) {
  const m = new Map(Object.entries(obj));
  return { get length() { return m.size; }, key: i => Array.from(m.keys())[i], getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
}

(async () => {
  const w = dom.window, d = w.document; await wait(1500);
  const click = el => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const btn = t => [...d.querySelectorAll("button")].find(b => b.textContent.trim() === t);

  // ── What a backup contains ──
  const caseA = { id: "case_a", name: "Alpha", programs: [{ id: "prog_1", name: "P1" }] };
  const st = stub({
    rxnpv_cases_v1: JSON.stringify([caseA]),
    rxnpv_custom_ma: JSON.stringify([{ acquirer: "X", target: "Y" }]),
    rxnpv_ctgov_snapshot_NCT01234567: JSON.stringify({ a: 1 }),
    rxnpv_theme: "dark",
    rxnpv_edgar_cache: JSON.stringify({ big: "cache" }),
    rxnpv_cik_acme: "{}",
    someone_elses_key: "x"
  });
  const b = w.buildBackup(st, new Date("2026-09-27T12:00:00Z"));
  ok(b.format === "rxnpv-backup" && b.version === 1 && b.createdAt === "2026-09-27T12:00:00.000Z", "backup header: format, version, timestamp");
  ok(Object.keys(b.data).sort().join(",") === "rxnpv_cases_v1,rxnpv_ctgov_snapshot_NCT01234567,rxnpv_custom_ma,rxnpv_theme", "backup holds user data and prefs only — no API caches, no foreign keys (got " + Object.keys(b.data).join(",") + ")");

  // ── Reading a file ──
  const good = w.parseImportFile(JSON.stringify(b));
  ok(good.ok && good.kind === "backup" && good.summary.cases === 1 && good.summary.customComps === 1 && good.summary.watchedTrials === 1, "a backup parses and summarises (1 case, 1 comp, 1 watched trial)");
  ok(!w.parseImportFile("not json").ok, "junk is refused");
  ok(!w.parseImportFile(JSON.stringify({ format: "something-else" })).ok, "a foreign JSON file is refused");
  ok(/newer version/.test(w.parseImportFile(JSON.stringify({ format: "rxnpv-backup", version: 99, data: {} })).error), "a backup from a newer version is refused with a reason");
  const tampered = JSON.parse(JSON.stringify(b)); tampered.data.evil_key = "\"x\""; tampered.data.rxnpv_edgar_cache = "{}";
  const tp = w.parseImportFile(JSON.stringify(tampered));
  ok(tp.ok && tp.dropped === 2 && !("evil_key" in tp.data) && !("rxnpv_edgar_cache" in tp.data), "unrecognised keys in a backup are dropped, never restored");
  const broken = JSON.parse(JSON.stringify(b)); broken.data.rxnpv_cases_v1 = JSON.stringify([{ name: "no id" }]);
  ok(!w.parseImportFile(JSON.stringify(broken)).ok, "damaged cases stop the whole import");
  const cf = w.parseImportFile(JSON.stringify(w.caseFileFor(caseA)));
  ok(cf.ok && cf.kind === "case" && cf.theCase.name === "Alpha", "a single-case file parses");

  // ── Add: nothing overwritten ──
  const target = stub({ rxnpv_custom_ma: JSON.stringify([{ acquirer: "X", target: "Y" }]), rxnpv_ctgov_snapshot_NCT01234567: JSON.stringify({ mine: true }) });
  const r = w.mergeImport(target, good, [caseA]);
  ok(r.cases.length === 2 && r.addedCases === 1, "add: the imported case is appended");
  ok(r.cases[1].id !== "case_a" && r.cases[1].programs[0].id !== "prog_1", "add: the copy gets fresh case and program ids");
  ok(r.cases[1].name === "Alpha (imported)", "add: a clashing name is marked (imported)");
  ok(r.addedComps === 0 && JSON.parse(target.getItem("rxnpv_custom_ma")).length === 1, "add: a comp already present is not duplicated");
  ok(JSON.parse(target.getItem("rxnpv_ctgov_snapshot_NCT01234567")).mine === true && r.addedTrials === 0, "add: an existing watched-trial baseline is kept, not overwritten");

  // ── Replace: exactly the backup's data ──
  const rep = stub({ rxnpv_cases_v1: JSON.stringify([{ id: "case_z", name: "Zed", programs: [] }]), rxnpv_custom_peaksales: "[1]", rxnpv_edgar_cache: "{\"keep\":1}", rxnpv_secnav_hidden: "1" });
  w.replaceWithBackup(rep, good);
  ok(JSON.parse(rep.getItem("rxnpv_cases_v1"))[0].name === "Alpha", "replace: cases are the backup's");
  ok(rep.getItem("rxnpv_custom_peaksales") == null, "replace: user data absent from the backup is removed");
  ok(rep.getItem("rxnpv_edgar_cache") === "{\"keep\":1}", "replace: caches are left alone");
  ok(rep.getItem("rxnpv_secnav_hidden") === "1" && rep.getItem("rxnpv_theme") === "dark", "replace: backup prefs applied, other prefs kept");

  // ── The sample case ──
  const sc = w.sampleCaseStoke();
  ok(sc.ticker === "STOK" && sc.programs.length === 1 && sc.programs[0].drugName === "Zorevunersen", "sample: Stoke, one program, zorevunersen");
  ok(w.caseMissingInputs(sc).length === 0, "sample: nothing required is missing (" + w.caseMissingInputs(sc).join(", ") + ")");
  ok(sc.programs[0].evidenceLog.length >= 15 && sc.programs[0].evidenceLog.every(e => e.source && e.date && e.thesis && ["fact", "inference", "speculation"].includes(e.classification) && ["high", "moderate", "low"].includes(e.confidence)), "sample: every evidence entry has a source, date, reasoning and valid labels");
  ok(sc.programs[0].calibrationLog.length === 1 && sc.programs[0].calibrationLog[0].outcome === "pending", "sample: a pending calibration entry for the readout");
  ok(w.sampleCaseStoke().id !== sc.id, "sample: each load gets a fresh id");
  const fv = w.baseCaseFairValue(sc);
  ok(isFinite(fv) && fv > 0, "sample: produces a positive base fair value (" + fv + ")");
  ok(Number(sc.capitalStructure.cash) > 1e8 && Number(sc.futureRaise.amountM) > 1e7, "sample: dollar fields are in dollars, not millions");
  // The model counts whole years from today, so a fractional launch year is
  // rounded — an earlier version typed 1.5, which valued a launch a full year
  // later than the company guides.
  ok(Number.isInteger(Number(sc.programs[0].launchYearOffset)), "sample: launch year is a whole number (" + sc.programs[0].launchYearOffset + ")");
  // The snapshot entry quotes the case's own results; hold them to the engine
  // so a later input change can't leave the write-up describing another case.
  const snap = sc.programs[0].evidenceLog.find(e => /snapshot/.test(e.label)).thesis;
  const quoted = k => Number((snap.match(new RegExp(k + "[^$]*~\\$([0-9.]+)")) || [])[1]);
  ["Bear", "Base", "Bull"].forEach(k => {
    const key = k.toLowerCase();
    const r = w.computeCaseValuation(sc, w.getEffectiveScenarioPreset(sc, key), key, Number(sc.discountRatePct), sc.terminalValue);
    ok(Math.abs(quoted(k) - r.equity.perShare) < 0.005, "sample: snapshot's " + k + " ($" + quoted(k) + ") matches the engine ($" + r.equity.perShare.toFixed(2) + ")");
  });
  const imp = w.solveImpliedPoSMultiplier(sc, Number(sc.discountRatePct), sc.terminalValue);
  ok(Math.round(imp.impliedAbsolutePct) === sc.programs[0].calibrationLog[0].marketImpliedPoS, "sample: calibration's market-implied PoS matches the reverse-solve (" + imp.impliedAbsolutePct.toFixed(1) + ")");

  // The sample case: every row's parts sum to its cash flow, and the running
  // total ends exactly at the engine's explicit NPV.
  const rBase = w.computeCaseValuation(sc, w.getEffectiveScenarioPreset(sc, "base"), "base", 12, sc.terminalValue);
  const pr = w.computeProjectionRows(rBase, sc);
  ok("sample projection: each row's revenue - costs - tax = its cash flow", pr.every(x => Math.abs(x.revenue - x.commercialCosts - x.rnd - x.ga - x.tax - x.fcf) < 1));
  ok("sample projection: running total = explicit NPV", Math.abs(pr[pr.length - 1].runningPV - rBase.npvResult.explicitNPV) < 1);
  // Launch year 1 (sample), five-year ramp, LOE 12 years after launch -> index 13.
  ok("sample projection: phases follow launch year, ramp and LOE", pr[0].phase === "Before launch" && pr[1].isLaunch && pr[1].phase === "Launch ramp" && pr[6].phase === "Peak years" && pr[13].isLOE && pr[13].phase === "After LOE");
  // Failure floor: cash less what the readout and a wind-down cost, over the
  // shares that exist at that price. Stoke: $420M cash, no debt, G&A $95M/yr.
  // Options strike $13.84 are out of the money at ~$1.40, so shares = basic
  // 68,229,972 + 2,157,698 zero-strike RSUs = 70,387,670.
  const fl = w.computeFailureFloor(sc);
  ok(fl && Math.abs(fl.equity - (420e6 - fl.trialCost - fl.gaToReadout - fl.windDown)) < 1, "floor: equity = cash − trial cost − G&A to readout − wind-down");
  ok(fl && Math.abs(fl.gaToReadout - 95e6 * fl.readoutYears) < 1 && fl.windDown === 95e6 && fl.windDownYears === 1, "floor: G&A to readout at $95M/yr; one year of wind-down by default");
  ok(fl && fl.shares === 70387670, "floor: shares at the floor price exclude out-of-the-money options (" + (fl && fl.shares) + ")");
  ok(fl && Math.abs(fl.perShare - fl.equity / 70387670) < 1e-9 && fl.perShare > 1 && fl.perShare < 2, "floor: about $1.40 a share (" + (fl && fl.perShare.toFixed(2)) + ")");
  const fl2 = w.computeFailureFloor(Object.assign({}, sc, { corporateGA: Object.assign({}, sc.corporateGA, { windDownYears: "2" }) }));
  ok(Math.abs((fl.equity - fl2.equity) - 95e6) < 1, "floor: a second wind-down year costs exactly one more year of G&A");
  ok(w.computeFailureFloor(Object.assign({}, sc, { programs: [sc.programs[0], sc.programs[0]] })) === null, "floor: none for more than one program");

  // Outcome tree: the gates multiply back to the Base PoS, the endings sum to
  // one, and a rejection at the FDA is valued after the Phase 3 and the review
  // have been paid for.
  const tr = w.computeOutcomeTree(sc, 12, sc.terminalValue);
  ok(tr && tr.gates.length === 2 && tr.gates[0].label === "Phase 3 readout" && tr.gates[1].label === "FDA decision", "tree: two gates, Phase 3 readout then FDA decision");
  ok(tr && Math.abs(tr.gates[0].pass * tr.gates[1].pass - 0.65) < 1e-9, "tree: passing both gates = the case's 65%");
  ok(tr && Math.abs(tr.leaves.reduce((a, l) => a + l.prob, 0) - 1) < 1e-9, "tree: the endings' chances sum to 1");
  ok(tr && Math.abs(tr.weighted - tr.leaves.reduce((a, l) => a + l.prob * l.value, 0)) < 1e-9 && Math.abs(tr.gates[0].failValue - fl.perShare) < 1e-9, "tree: weighted value is the sum of chance × value; the first failure is the floor");
  const fda = tr && tr.gates[1].failDetail;
  ok(fda && Math.abs(fda.equity - (420e6 - fda.trialCost - 95e6 * fda.readoutYears - 95e6)) < 1 && fda.trialCost > fl.trialCost && fda.readoutYears > fl.readoutYears, "tree: an FDA rejection is valued after both stages' cost and time");

  // Resubmission branch: 30% of FDA rejections move to "approved a year late",
  // valued with launch one year later at certain odds; chances still sum to 1
  // and the gates (the case's own odds) are unchanged.
  const trL = w.computeOutcomeTree(Object.assign({}, sc, { outcomeTree: { resubmitFixPct: "30" } }), 12, sc.terminalValue);
  const lateV = w.computeCaseValuation(Object.assign({}, sc, { programs: [Object.assign({}, sc.programs[0], { posOverridePct: "100", launchYearOffset: "2" })] }), { label: "Base", shareMultiplierPct: 100, posMultiplierPct: 100, discountRateAddPct: 0 }, "base", 12, sc.terminalValue).equity.perShare;
  ok(trL && trL.late && Math.abs(trL.late.prob - tr.gates[1].failProb * 0.3) < 1e-12 && Math.abs(trL.late.value - lateV) < 1e-9, "tree: resubmission takes 30% of FDA rejections, valued a year late");
  ok(trL && Math.abs(trL.leaves.reduce((a, l) => a + l.prob, 0) - 1) < 1e-9 && trL.gates.every((g, i) => g.pass === tr.gates[i].pass) && lateV < tr.success, "tree: chances still sum to 1, gates unchanged, a late approval is worth less");
  ok(tr.late === null, "tree: the branch is off by default");

  // Before the readout: odds after a positive readout = 0.65 / 0.8023 = 81.02%;
  // a clear win closes 40% of the gap: 81.02 + 0.4 × 18.98 = 88.61%. Chances:
  // 0.8023 × 0.6 = 0.4814, 0.8023 × 0.4 = 0.3209, miss 0.1977 (the floor).
  const rsx = w.computeReadoutScenarios(sc, 12, sc.terminalValue);
  ok(rsx && Math.abs(rsx.conditionalPosPct - 65 / tr.gates[0].pass) < 1e-9 && Math.abs(rsx.defaults.clearPosPct - (rsx.conditionalPosPct + 0.4 * (100 - rsx.conditionalPosPct))) < 1e-9, "readout: default odds after a modest / clear win");
  ok(rsx && Math.abs(rsx.rows[0].prob - tr.gates[0].pass * 0.6) < 1e-9 && Math.abs(rsx.rows[1].prob - tr.gates[0].pass * 0.4) < 1e-9 && Math.abs(rsx.rows[2].prob - (1 - tr.gates[0].pass)) < 1e-9, "readout: chances from the case's own odds, split 60/40");
  ok(rsx && rsx.rows[2].value === fl.perShare && rsx.rows[0].value > rsx.rows[1].value && Math.abs(rsx.weighted - rsx.rows.reduce((a, x) => a + x.prob * x.value, 0)) < 1e-9, "readout: miss = floor, clear > modest, weighted = sum");
  const rs2 = w.computeReadoutScenarios(Object.assign({}, sc, { readoutScenarios: { clearOfWinsPct: "50", modestPosPct: "70" } }), 12, sc.terminalValue);
  ok(rs2 && Math.abs(rs2.rows[0].prob - rs2.rows[1].prob) < 1e-12 && rs2.settings.modestPosPct === 70 && rs2.rows[1].value < rsx.rows[1].value, "readout: edits are honoured (50/50 split, lower modest odds lower its value)");

  // Approved programs: the glance has no odds to draw, the tree has no gate,
  // and the failure floor has nothing left to fail.
  const appr = Object.assign({}, sc, { programs: [Object.assign({}, sc.programs[0], { currentPhase: "approved", launchYearOffset: "0", posOverridePct: "", rndOverride: { totalYears: "", totalCostM: "" } })] });
  ok(w.computeOutcomeTree(appr, 12, sc.terminalValue) === null && w.computeFailureFloor(appr) === null, "approved: no outcome tree and no failure floor");

  // ── In the app ──
  click(btn("+ New case")); await wait(300);
  const before = JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]");
  click(btn("Load sample case")); await wait(500);
  const after = JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]");
  ok(after.length === before.length + 1 && after.some(c => c.name === "Stoke Therapeutics — sample case"), "Load sample case adds one case");
  ok(before.every(bc => after.some(ac => ac.id === bc.id && JSON.stringify(ac) === JSON.stringify(bc))), "loading the sample leaves existing cases byte-for-byte unchanged");
  ok(/Stoke Therapeutics/.test(d.body.textContent) && !!d.querySelector(".secnav"), "the sample opens in the Workspace");
  // A fractional launch year says which whole year the model uses.
  click(d.getElementById("casetab-assumptions")); await wait(300);
  const launch = d.querySelector('input[aria-label="Launch in year (from today)"]');
  const setVal = (el, v) => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new w.Event("input", { bubbles: true })); };
  // (body text includes the inline script, so read the rendered notes only)
  const launchNote = () => [...d.querySelectorAll('[role="note"]')].map(n => n.textContent).find(t => /valued as a launch in year/.test(t)) || "";
  ok(!!launch && !launchNote(), "launch field: no rounding note for a whole year");
  if (launch) { setVal(launch, "1.5"); await wait(300); }
  ok(/valued as a launch in year 2\./.test(launchNote()), "launch field: 1.5 says it is valued as year 2");
  if (launch) { setVal(launch, "1"); await wait(300); }
  const link = [...d.querySelectorAll("button.side-link")].find(b => /Backup & restore/.test(b.textContent));
  ok(!!link, "sidebar shows Backup & restore");
  click(link); await wait(200);
  ok(!!d.querySelector('[role="dialog"][aria-label="Backup and restore"]'), "the backup dialog opens");
  ok(!!btn("Export everything…") && !!btn("Open a file…"), "the dialog offers export and import");
  d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); w.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" })); await wait(200);
  ok(!d.querySelector('[role="dialog"][aria-label="Backup and restore"]'), "Escape closes it");

  if (errors.length) { console.log(errors.slice(0, 40).join("\n")); console.log("\n" + errors.length + " FAILURE(S) across " + checks + " checks"); process.exit(1); }
  console.log("ALL BACKUP & SAMPLE CHECKS PASSED — " + checks + " checks");
  process.exit(0);
})();
