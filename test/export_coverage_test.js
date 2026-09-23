// Every section in every view can be exported and added to a report.
//
// Walks Workspace, every Tools workbench and tool, every Simulation tab and
// Trial Statistics sub-tool, every Reference Sheet tab and Portfolio, and at
// each stop asserts that every exportable section carries its OWN export bar —
// not merely that a bar exists somewhere on the page, which a nested section
// would satisfy while its parent had none. Also asserts that the old chart-only
// export rows are gone (they exported a chart with none of its context, which
// is the complaint this replaced), and that "+ Report" actually reaches the
// case: a snapshot for a Tools card, a live-section toggle for the bridge.
//
// What this cannot check: jsdom has no layout, so the offscreen render, the
// PDF/PNG output and the SVG-picker's chart detection (which measures width)
// are verified in the packaged app instead — see test/README.md.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(__dirname + "/test_desktop.html", "utf8");
const errors = [];
let checks = 0;
const ok = (cond, what) => { checks++; if (!cond) errors.push("FAIL: " + what); };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.warn = (...a) => { const s = a.join(" "); if (!s.includes("EDGAR") && !s.includes("RDKit")) errors.push("WARN: " + s.slice(0, 200)); };
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
  const findByLabel = t => [...d.querySelectorAll("input")].find(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); });
  const sectionOf = el => { let n = el; while (n && n !== d.body) { if (n.hasAttribute && n.hasAttribute("data-export-section")) return n; n = n.parentNode; } return null; };
  // A section's own bar: one whose nearest enclosing section is this one.
  const hasOwnBar = sec => [...sec.querySelectorAll(".section-export-bar")].some(b => sectionOf(b) === sec);
  const titleOf = sec => (w.sectionTitleOf ? w.sectionTitleOf(sec) : "?");

  // Every visible section at this stop has its own bar and a usable title,
  // and every chart block has its own "Export chart" row.
  const chartOf = el => { let n = el; while (n && n !== d.body) { if (n.hasAttribute && n.hasAttribute("data-export-chart")) return n; n = n.parentNode; } return null; };
  const audit = (where, minSections) => {
    [...d.querySelectorAll("[data-export-chart]")].forEach(ch => {
      ok([...ch.querySelectorAll(".chart-export-bar")].some(b => chartOf(b) === ch), where + ": chart “" + titleOf(ch) + "” has no export row of its own");
      ok(!/Export (section|chart)/.test(titleOf(ch)), where + ": a chart title contains export-row text");
    });
    const secs = [...d.querySelectorAll("[data-export-section]")];
    ok(secs.length >= minSections, where + ": expected at least " + minSections + " exportable section(s), found " + secs.length);
    secs.forEach(sec => {
      ok(hasOwnBar(sec), where + ": section “" + titleOf(sec) + "” has no export bar of its own");
      const t = titleOf(sec);
      ok(t && t !== "Section" && t.length > 2, where + ": a section has no usable title (" + JSON.stringify(t) + ")");
      ok(!/Export (section|chart)/.test(t), where + ": section title contains export-row text (" + t.slice(0, 60) + ")");
    });
    ok(!d.querySelector(".chart-export-row"), where + ": an old chart-only export row is still rendered");
    ok(![...d.querySelectorAll("button")].some(b => /Pin to report/.test(b.textContent)), where + ": an old “Pin to report” button is still rendered");
    return secs.length;
  };

  // ── Workspace ──
  click(btn("+ New case")); await wait(400);
  setVal(findByLabel("Peak worldwide revenue"), "1000"); await wait(150);
  setVal(findByLabel("Fully diluted shares"), "100000000"); await wait(150);
  setVal(d.querySelector('input[aria-label="Case name"]'), "Coverage Co"); await wait(200);
  const wsCount = audit("Workspace", 8);
  for (const id of ["ws-revenue", "ws-valuation", "ws-bridge"]) {
    const el = d.getElementById(id);
    ok(el && el.hasAttribute("data-export-section"), "Workspace: #" + id + " is an exportable section");
  }
  for (const t of ["Scenario comparison", "Base-case risk-adjusted cash flow by year", "Full-case Monte Carlo", "Enterprise Value → Per-Share bridge (Base case)"]) {
    ok(!!d.querySelector('[data-export-section="' + t + '"]'), "Workspace: “" + t + "” is its own section");
  }
  ok((d.querySelector("[data-export-context]") || {}).getAttribute && d.querySelector("[data-export-context]").getAttribute("data-export-context") === "Workspace · Coverage Co",
    "Workspace: exports are labelled with the case name");

  // "+ Report" on a section the report already renders live is a toggle, not a snapshot.
  const bridge = d.getElementById("ws-bridge");
  const bridgeBtn = [...bridge.querySelectorAll("button")].find(b => sectionOf(b) === bridge && /In report|\+ Report/.test(b.textContent));
  ok(bridgeBtn && /In report/.test(bridgeBtn.textContent), "Workspace: the bridge shows as already in the report (it is on by default)");
  click(bridgeBtn); await wait(300);
  const storedCase = () => JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]").find(c => c.name === "Coverage Co");
  ok(storedCase() && storedCase().reportInclusions && storedCase().reportInclusions.bridge === false, "Workspace: clicking it takes the bridge out of the report");
  ok(/\+ Report/.test(bridgeBtn.textContent), "Workspace: and the button now reads “+ Report”");
  ok(!(storedCase().pinnedResults || []).length, "Workspace: toggling a live section stores no snapshot");
  click(bridgeBtn); await wait(300);
  ok(storedCase().reportInclusions.bridge === true, "Workspace: clicking again puts it back");

  // ── Tools ──
  click(btn("Tools")); await wait(400);
  const workbenches = [
    ["Trial", ["Trial Decoder", "Asset Program", "Trial Explorer", "FDA Lookup"]],
    ["Science", ["Target Dossier", "Literature"]],
    ["Company", ["Company Lookup", "Catalyst Calendar", "Cash Runway", "Runway vs. Catalyst"]],
    ["Commercial", ["Launch & Actuals", "Exclusivity / LOE"]],
    ["Valuation", ["Sensitivity", "Binary Event", "Diluted Market Cap"]],
    ["Benchmarks", ["M&A Premium", "Peak Sales Comps", "Licensing Comps"]]
  ];
  let toolSections = 0;
  for (const [bench, tools] of workbenches) {
    click(btn(bench)); await wait(300);
    for (const name of tools) {
      click(btn(name)); await wait(350);
      toolSections += audit("Tools / " + name, 1);
      const ctx = d.querySelector("[data-export-context^='Tools']");
      ok(ctx && ctx.getAttribute("data-export-context") === "Tools · " + bench + " · " + name, "Tools / " + name + ": export context names the workbench and tool");
    }
  }

  // "+ Report" on an ordinary card stores a sanitised HTML snapshot on the case.
  click(btn("Benchmarks")); await wait(300);
  click(btn("M&A Premium")); await wait(350);
  const firstCard = d.querySelector("[data-export-context^='Tools'] [data-export-section]");
  const addBtn = [...firstCard.querySelectorAll("button")].find(b => sectionOf(b) === firstCard && b.textContent.trim() === "+ Report");
  ok(!!addBtn, "Tools: a card offers “+ Report”");
  click(addBtn); await wait(800);
  const pins = (storedCase() && storedCase().pinnedResults) || [];
  ok(pins.length === 1, "Tools: “+ Report” added exactly one section to the case (got " + pins.length + ")");
  if (pins[0]) {
    ok(pins[0].kind === "html" && typeof pins[0].html === "string" && pins[0].html.length > 50, "Tools: the added section is an HTML snapshot, not an image");
    ok(pins[0].source && /Tools/.test(pins[0].source), "Tools: the snapshot records where it came from (" + pins[0].source + ")");
    ok(pins[0].included !== false, "Tools: a newly added section is included in the report by default");
  }
  ok(/Open report/.test(firstCard.textContent), "Tools: the confirmation offers a way to open the report");
  const openLink = [...firstCard.querySelectorAll("button")].find(b => /Open report/.test(b.textContent));
  click(openLink); await wait(800);
  ok(!d.querySelector("[data-export-context^='Tools']") && !!btn("Export as PDF"), "Tools: “Open report →” goes to the report");
  // The report renders the snapshot as real content, re-themed to the page.
  const added = d.getElementById("report-added");
  const snap = added && added.querySelector(".report-snapshot");
  ok(!!snap, "Report: the added section is rendered in an “Added Sections” block");
  ok(snap && /M&A|premium/i.test(snap.textContent), "Report: it contains the card's own content, not a placeholder");
  ok(snap && (snap.classList.contains("theme-scope-light") || snap.classList.contains("theme-scope-dark")), "Report: it is wrapped in the report's theme scope");
  ok(snap && !snap.querySelector("script,iframe,[onclick],[onerror]"), "Report: nothing executable survives into the rendered snapshot");
  ok(snap && !snap.querySelector(".section-export-bar"), "Report: the export bar itself is not part of the snapshot");
  // Choosing what appears.
  const sectionsBtn = [...d.querySelectorAll("button")].find(b => /^Sections \(/.test(b.textContent.trim()));
  click(sectionsBtn); await wait(300);
  const picker = d.getElementById("report-added-picker");
  ok(picker && /1 of 1 included/.test(picker.textContent), "Report: the Sections panel lists the added section as included");
  const incBox = picker && picker.querySelector('input[type="checkbox"]');
  click(incBox); await wait(400);
  ok(!d.getElementById("report-added"), "Report: unticking it takes it out of the report");
  ok(storedCase().pinnedResults[0].included === false, "Report: that choice is saved on the case");
  click(d.getElementById("report-added-picker").querySelector('input[type="checkbox"]')); await wait(400);
  ok(!!d.getElementById("report-added"), "Report: ticking it again brings it back");
  click(btn("Workspace")); await wait(400);
  ok(/1 added/.test(d.body.textContent), "Workspace: the Generate Report button shows “1 added”");

  // ── Simulation ── (bars are mounted by a MutationObserver, one frame late)
  click(btn("Simulation")); await wait(700);
  const simTabs = ["Trial Outcome / PoS", "Phase 2→3 Translator", "Meta-Analysis", "Peak Sales", "PK/PD"];
  let simSections = 0;
  for (const name of simTabs) {
    click(btn(name)); await wait(450);
    simSections += audit("Simulation / " + name, 1);
    [...d.querySelectorAll("#ts-root .panel")].forEach(p => ok(p.hasAttribute("data-export-section"), "Simulation / " + name + ": every panel is a section"));
    [...d.querySelectorAll("#ts-root .runbtn")].forEach(b => ok(b.hasAttribute("data-no-export"), "Simulation / " + name + ": the run button is left out of exports"));
  }
  click(btn("Trial Statistics")); await wait(450);
  for (const name of ["Fragility Index", "Sample Size / Power", "P-value ↔ CI", "Single-Arm CI", "2×2 Outcome Analysis", "Non-Inferiority", "Multiplicity Adjustment"]) {
    click(btn(name)); await wait(450);
    simSections += audit("Simulation / Trial Statistics / " + name, 1);
  }
  // Leaving and coming back mounts a fresh root, which must be followed.
  click(btn("Portfolio")); await wait(400);
  audit("Portfolio", 1);
  click(btn("Simulation")); await wait(700);
  audit("Simulation (after leaving and returning)", 1);

  // ── Reference Sheet ──
  click(btn("Reference Sheet")); await wait(500);
  const refTabs = ["How This Works", "Revenue Build", "Cost Structure", "R&D & Timeline", "Probability of Success", "Discount Rate", "Valuation & Dilution", "M&A Comps", "Trial Glossary"];
  let refSections = 0;
  for (const name of refTabs) {
    const b = btn(name);
    if (!b) { errors.push("FAIL: Reference Sheet tab not found: " + name); continue; }
    click(b); await wait(350);
    refSections += audit("Reference Sheet / " + name, 1);
  }

  // Add a second section from here, then reorder the two in the report.
  const refCard = d.querySelector("[data-export-context='Reference Sheet'] [data-export-section]");
  const refAdd = [...refCard.querySelectorAll("button")].find(b => sectionOf(b) === refCard && b.textContent.trim() === "+ Report");
  click(refAdd); await wait(800);
  const before = storedCase().pinnedResults.map(p => p.id);
  ok(before.length === 2, "Reference Sheet: “+ Report” added a second section (" + before.length + ")");
  ok(/Reference Sheet/.test(storedCase().pinnedResults[1].source || ""), "Reference Sheet: its source is recorded");
  click([...refCard.querySelectorAll("button")].find(b => /Open report/.test(b.textContent))); await wait(800);
  const sb = [...d.querySelectorAll("button")].find(b => /^Sections \(/.test(b.textContent.trim()));
  if (!d.getElementById("report-added-picker")) { click(sb); await wait(300); }
  const down = d.getElementById("report-added-picker").querySelector('button[aria-label="Move down"]');
  click(down); await wait(400);
  const after = storedCase().pinnedResults.map(p => p.id);
  ok(after[0] === before[1] && after[1] === before[0], "Report: “↓” swaps the order of the added sections");
  ok(d.querySelectorAll("#report-added .report-snapshot").length === 2, "Report: both added sections render");

  console.log("Sections audited — Workspace " + wsCount + ", Tools " + toolSections + ", Simulation " + simSections + ", Reference Sheet " + refSections);
  if (errors.length) { console.log(errors.slice(0, 40).join("\n")); console.log("\n" + errors.length + " FAILURE(S) across " + checks + " checks"); process.exit(1); }
  console.log("\nALL EXPORT COVERAGE CHECKS PASSED — " + checks + " checks");
  process.exit(0);
})();
