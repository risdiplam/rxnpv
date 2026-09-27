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

  // ── In the app ──
  click(btn("+ New case")); await wait(300);
  const before = JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]");
  click(btn("Load sample case")); await wait(500);
  const after = JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]");
  ok(after.length === before.length + 1 && after.some(c => c.name === "Stoke Therapeutics — sample case"), "Load sample case adds one case");
  ok(before.every(bc => after.some(ac => ac.id === bc.id && JSON.stringify(ac) === JSON.stringify(bc))), "loading the sample leaves existing cases byte-for-byte unchanged");
  ok(/Stoke Therapeutics/.test(d.body.textContent) && !!d.querySelector(".secnav"), "the sample opens in the Workspace");
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
