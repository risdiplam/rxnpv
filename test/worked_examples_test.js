// The sample case's worked examples (sampleCase.js): one saved item per tool
// and simulation, holding its inputs, the button that runs it and a sourced
// note. This opens every one from the case's Saved tab and checks that each
// input lands where it was aimed, that the example ran, and that examples
// stay out of the PDF report. An input whose label or id drifts in a tool
// would otherwise leave the example half-filled with no error anywhere.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html", "utf8");
const errors = [];
let failedChecks = 0;
const ok = (cond, label) => { if (!cond) failedChecks++; console.log((cond ? "ok   " : "FAIL: ") + label); };
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.warn = () => {};
    w.console.error = (...a) => errors.push("ERROR: " + a.join(" ").slice(0, 250));
    w.addEventListener("error", e => errors.push("UNCAUGHT: " + (e.error && e.error.stack || e.message).slice(0, 350)));
    w.fetch = async () => ({ ok: false, status: 404 });
  } });
const wait = ms => new Promise(r => setTimeout(r, ms));

// What each simulation shows once it has run (text from its result panel).
const SIM_RESULT = {
  trialOutcome: /assurance/i, p2p3: /Phase 3/, metaAnalysis: /Pooled/, peakSales: /P50|median/i, pkpd: /Cmax|peak/i,
  fragilityIndex: /Fragility Index/, sampleSizePower: /detect/i, pValueCI: /implied two-sided P/, singleArmCI: /8 of 10|40\.0%|to 1\d\d?\.?\d*%|%/,
  outcome2x2: /NNT|relative/i, multiplicity: /Holm|Bonferroni/
};
// Diluted Market Cap is skipped: jsdom's CSS parser throws cloning a style
// with a background shorthand (a jsdom bug; the packaged app renders it with
// no console error — see test/packaged/ui_audit.js).
const SKIP = new Set(["fdmc"]);

(async () => {
  const w = dom.window, d = w.document; await wait(1500);
  const click = el => el && el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  const btn = (t, root) => [...(root || d).querySelectorAll("button")].find(b => b.textContent.trim() === t);

  click(btn("Load sample case")); await wait(900);
  const theCase = () => JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]").find(c => /sample case/.test(c.name));
  const examples = (theCase().pinnedResults || []).filter(p => p.kind === "example");
  ok(examples.length >= 30, "the sample ships a worked example for every tool and simulation (" + examples.length + ")");
  const tools = new Set(examples.filter(p => p.reopen.view === "tools").map(p => p.reopen.tool));
  const all19 = w.eval("TOOL_WORKBENCHES").reduce((a, b) => a.concat(b.tools.map(t => t[0])), []);
  ok(all19.every(t => tools.has(t)), "every Tools tool has an example" + (all19.some(t => !tools.has(t)) ? " (missing: " + all19.filter(t => !tools.has(t)).join(", ") + ")" : " (" + all19.length + ")"));
  ok(examples.every(p => p.included === false && p.note && p.note.length > 80 && p.reopen), "every example is out of the report, carries a note and a reopen");

  // The Saved tab lists them, apart from the case's own saves, with no report tick box.
  click(d.getElementById("casetab-saved")); await wait(400);
  const panel = d.getElementById("casetab-saved") && [...d.querySelectorAll("[role=tabpanel], div")].find(x => /Worked examples/.test(x.textContent) && x.querySelector(".saved-item"));
  ok(!!panel && /Worked examples/.test(panel.textContent), "Saved tab shows the Worked examples group");
  const items = panel ? [...panel.querySelectorAll(".saved-item")] : [];
  ok(items.length === examples.length, "one row per example (" + items.length + ")");
  ok(items.every(it => !it.querySelector('input[type="checkbox"]')), "examples have no 'In the PDF report' tick box");
  const why = items[0] && btn("Why these inputs", items[0]); click(why); await wait(150);
  ok(!!why && items[0].querySelector(".saved-preview") && items[0].querySelector(".saved-preview").textContent === examples[0].note, "'Why these inputs' shows the example's note");

  // Open each one and check it landed.
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i], r = ex.reopen;
    if (r.view === "tools" && SKIP.has(r.tool)) { console.log("skip " + ex.title); continue; }
    click(d.getElementById("casetab-saved")); click(btn("Workspace")); await wait(250);
    click(d.getElementById("casetab-saved")); await wait(200);
    const row = [...d.querySelectorAll(".saved-item")].find(it => it.querySelector(".saved-title").textContent === ex.title);
    const open = row && [...row.querySelectorAll("button")].find(b => /^Open in /.test(b.textContent));
    click(open); await wait(r.view === "tools" ? 1100 : 700);
    const root = r.view === "tools" ? d.querySelector("[data-view=tools]") : d.getElementById("ts-root");
    const find = f => f.id ? root && root.querySelector("#" + w.CSS.escape(f.id)) : root && [...root.querySelectorAll("input, select, textarea")].find(e => e.getAttribute("aria-label") === f.label);
    const misses = r.inputs.filter(f => { const el = find(f); return !el || String(el.value) !== String(f.value); }).map(f => (f.id || f.label) + "=" + (find(f) ? find(f).value : "missing"));
    const where = r.view === "tools" ? root && root.getAttribute("data-tool-id") === r.tool : w.eval("activeTab") === r.simTab && (!r.simSub || w.eval("activeStatsSubtab") === r.simSub);
    let ran = true, note = "";
    if (r.view === "simulation") {
      const errs = root ? [...root.querySelectorAll(".error")].map(e => e.textContent) : ["no root"];
      const pat = SIM_RESULT[r.simSub || r.simTab];
      ran = errs.length === 0 && (!pat || pat.test(root.textContent));
      note = errs.length ? " errors: " + errs.join("; ").slice(0, 160) : (ran ? "" : " no result text");
    } else if (r.run) {
      ran = !!(root && [...root.querySelectorAll("button")].some(b => b.textContent.trim().indexOf(r.run) === 0));
      if (!ran) note = " no '" + r.run + "' button";
    }
    ok(where && misses.length === 0 && ran, ex.source + " — " + ex.title + (misses.length ? " [not set: " + misses.join(", ") + "]" : "") + (where ? "" : " [wrong place]") + note);
  }

  // Examples never reach the report or its section picker.
  click(btn("Workspace")); await wait(300);
  const gen = [...d.querySelectorAll("button")].find(b => /Generate Report/.test(b.textContent)); click(gen); await wait(1500);
  if (!d.getElementById("report-added-picker")) { click([...d.querySelectorAll("button")].find(b => /^Sections \(/.test(b.textContent.trim()))); await wait(300); }
  const picker = d.getElementById("report-added-picker");
  ok(!d.getElementById("report-added"), "no worked example renders in the report");
  const listed = picker ? examples.filter(ex => picker.textContent.includes(ex.title)).map(ex => ex.title) : ["no picker"];
  ok(!!picker && /\(0 of 0 in the report/.test(picker.textContent), "the picker counts no saved sections (" + (picker ? picker.textContent.slice(0, 60) : "") + ")");
  ok(!!picker && listed.length === 0, "the report's section picker does not list them" + (listed.length ? " (" + listed.slice(0, 3).join(" | ") + " … " + (picker ? picker.textContent.slice(0, 200) : "") + ")" : ""));

  console.log("\nErrors:", errors.length);
  [...new Set(errors)].forEach(e => console.log("  " + e));
  if (failedChecks) console.log("\n" + failedChecks + " CHECK(S) FAILED");
  process.exit(errors.length || failedChecks ? 1 : 0);
})();
