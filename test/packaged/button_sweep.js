// Press every ordinary button in every view of the packaged app, and check
// that none of them crashes a view or logs an error.
//
//   $E test/packaged/button_sweep.js --app=/Applications/RxNPV.app [--sample=pepgen|stoke] [--only=Tools]
//
// The export sweep already presses every export-menu button and the worked
// examples test opens every tool with real inputs; this covers everything
// else a person can press — tabs, toggles, "show more", segmented controls,
// Run and Look-up buttons, the report's section picker, dialog openers.
// Before each press the view is rebuilt from scratch (open the view, the
// case, the tab), so one button's effect never hides another's.
//
// Left alone on purpose: anything destructive (delete, remove, replace,
// clear, forget — confirm-armed buttons included), export menus (the export
// sweep's job), and native file dialogs (stubbed to "cancelled" here).
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : true]; }));
const APP = path.resolve(args.app || "/Applications/RxNPV.app");
const ONLY = args.only ? String(args.only).split(",") : null;
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "rx-buttons-")));
dialog.showSaveDialog = async () => ({ canceled: true });
dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
dialog.showMessageBox = async () => ({ response: 0 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SKIP_TEXT = /^(delete|remove|×|✕|sure\?|confirm|replace|clear|reset|forget|stop watching|delete case|remove program|restore|import|choose folder|turn off)/i;

const PAGE = `
window.__b = {
  visible: el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; },
  text: el => (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim(),
  list: () => [...document.querySelectorAll("button, [role=button], [role=tab]")]
    .filter(__b.visible)
    .filter(b => !b.disabled)
    .filter(b => !b.closest(".xm-menu, .section-export-bar, .chart-export-bar, .side-nav, nav, .app-nav, aside"))
    .filter(b => !${SKIP_TEXT}.test(__b.text(b)))
    .map(b => __b.text(b)),
  press: (label, nth) => {
    const all = [...document.querySelectorAll("button, [role=button], [role=tab]")].filter(__b.visible).filter(b => !b.disabled)
      .filter(b => !b.closest(".xm-menu, .section-export-bar, .chart-export-bar, .side-nav, nav, .app-nav, aside"))
      .filter(b => __b.text(b) === label);
    const b = all[nth]; if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true;
  },
  click: t => { const b = [...document.querySelectorAll("button, [role=tab]")].find(x => x.textContent.replace(/\\s+/g, " ").trim() === t); if (b) b.click(); return !!b; },
  crashed: () => /hit a problem and couldn't render/.test(document.body.innerText)
};
true;`;

app.whenReady().then(async () => {
  const problems = [];
  let pressed = 0;
  try {
    require(path.join(APP, "Contents/Resources/app.asar/main.js"));
    let w; while (!(w = BrowserWindow.getAllWindows()[0])) await sleep(100);
    await new Promise(r => w.webContents.isLoading() ? w.webContents.once("did-finish-load", r) : r());
    w.setSize(1470, 920); await sleep(800);
    const js = c => w.webContents.executeJavaScript(c, true);
    const errs = [];
    w.webContents.on("console-message", (e) => { if (e.level === "error") errs.push(String(e.message).slice(0, 220)); });
    // Every modal opened by a press is closed before the next one.
    const escape = async () => { w.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); w.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" }); await sleep(120); };
    await js(PAGE);
    const click = async (t, ms) => { const r = await js(`__b.click(${JSON.stringify(t)})`); await sleep(ms || 500); return r; };

    // A finished sample case, so every section has content.
    await click("Load sample case", 300);
    await click(args.sample === "stoke" ? "Stoke — Dravet, Phase 3" : "PepGen — DM1, Phase 2", 1500);
    const caseName = args.sample === "stoke" ? "Stoke Therapeutics — sample case" : "PepGen — sample case";
    const openCase = `(() => { const b = [...document.querySelectorAll("button, [role=button]")].find(x => x.textContent.includes(${JSON.stringify(caseName)})); if (b) b.click(); return !!b; })()`;

    const stops = [];
    for (const t of ["overview", "assumptions", "scenarios", "evidence", "calibration", "saved"])
      stops.push({ name: "Workspace · " + t, go: async () => { await click("Workspace", 400); await js(openCase); await sleep(400); await js(`document.getElementById("casetab-${t}").click()`); await sleep(500); } });
    const tools = [["Trial", ["Trial Decoder", "Compare Trials", "Asset Program", "Trial Explorer", "FDA Lookup"]], ["Science", ["Target Dossier", "Literature"]],
      ["Company", ["Company Lookup", "Catalyst Calendar", "Cash Runway", "Runway vs. Catalyst"]], ["Commercial", ["Launch & Actuals", "Exclusivity / LOE"]],
      ["Valuation", ["Sensitivity", "Binary Event", "Diluted Market Cap"]], ["Benchmarks", ["M&A Premium", "Peak Sales Comps", "Licensing Comps"]]];
    for (const [bench, names] of tools) for (const n of names)
      stops.push({ name: "Tools · " + n, go: async () => { await click("Workspace", 300); await js(openCase); await sleep(300); await click("Tools", 500); await click(bench, 300); await click(n, 700); } });
    for (const t of ["Trial Outcome / PoS", "Phase 2→3 Translator", "Meta-Analysis", "Peak Sales", "PK/PD"])
      stops.push({ name: "Simulation · " + t, go: async () => { await click("Simulation", 700); await click(t, 600); } });
    for (const t of ["Fragility Index", "Sample Size / Power", "P-value ↔ CI", "Single-Arm CI", "2×2 Outcome Analysis", "Non-Inferiority", "Multiplicity Adjustment"])
      stops.push({ name: "Simulation · " + t, go: async () => { await click("Simulation", 700); await click("Trial Statistics", 500); await click(t, 600); } });
    for (const t of ["How This Works", "Revenue Build", "Cost Structure", "R&D & Timeline", "Probability of Success", "Discount Rate", "Valuation & Dilution", "M&A Comps", "Trial Glossary"])
      stops.push({ name: "Reference · " + t, go: async () => { await click("Reference Sheet", 600); await click(t, 500); } });
    stops.push({ name: "Portfolio", go: async () => { await click("Portfolio", 700); } });
    stops.push({ name: "Report", go: async () => { await click("Workspace", 400); await js(openCase); await sleep(400); await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => /Generate Report/.test(x.textContent)); if (b) b.click(); return !!b; })()`); await sleep(1500); } });

    for (const st of stops) {
      if (ONLY && !ONLY.some(o => st.name.startsWith(o))) continue;
      await st.go();
      const labels = await js(`__b.list()`);
      const seen = {};
      const targets = labels.map(l => { seen[l] = (seen[l] || 0); return { label: l, nth: seen[l]++ }; });
      let n = 0;
      for (const t of targets) {
        await escape();
        await st.go();
        const before = errs.length;
        const ok = await js(`__b.press(${JSON.stringify(t.label)}, ${t.nth})`);
        if (!ok) continue; // a button that only exists in some states
        pressed++; n++;
        await sleep(450);
        const crashed = await js(`__b.crashed()`);
        const newErrs = errs.slice(before);
        if (crashed) problems.push(st.name + " · \"" + t.label + "\" → the view crashed");
        if (newErrs.length) problems.push(st.name + " · \"" + t.label + "\" → console error: " + newErrs[0]);
        if (crashed) { await js(`location.reload()`); await sleep(2500); await js(PAGE); }
      }
      console.log(st.name + ": " + n + " buttons pressed");
    }
  } catch (e) { problems.push("harness: " + e.stack); }
  console.log("\n" + pressed + " presses, " + problems.length + " problem(s)");
  problems.forEach(p => console.log("  PROBLEM " + p));
  app.exit(problems.length ? 1 : 0);
});
