// Press every ordinary button in every view of the packaged app, and check
// that none of them crashes a view or logs an error.
//
//   $E test/packaged/button_sweep.js --app=/Applications/RxNPV.app [--sample=pepgen|stoke] [--only=Tools] [--parallel=4] [--timeout=20] [--max-minutes=30]
//   $E test/packaged/button_sweep.js --userdata=<profile dir> --case="<case name>"   (a copy of an existing profile)
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
//
// Speed and hangs (October 2026). A run once took five hours and never
// finished: one call into the page never answered and the harness waited on
// it forever. Now:
//   · every call into the page has a time limit (--timeout, default 20s); a
//     press that does not answer is reported by name, the page is reloaded,
//     and the sweep goes on;
//   · the window's timers are never throttled (a hidden or occluded window
//     otherwise runs its timers once a minute);
//   · --parallel=N (default 4) runs N copies of the app at once, each
//     pressing every Nth button, and merges their results; --parallel=1 is
//     the old single run;
//   · --max-minutes (default 30) stops everything and reports what ran if a
//     run goes over, so a stuck run can never sit for hours;
//   · every view prints how many presses it took and how long.
const { app, BrowserWindow, dialog } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : true]; }));
const APP = path.resolve(args.app || "/Applications/RxNPV.app");
const ONLY = args.only ? String(args.only).split(",") : null;
const PARALLEL = Math.max(1, Number(args.parallel || 4));
const SHARD = args.shard ? String(args.shard).split("/").map(Number) : null;   // [k, n]
const TIMEOUT_MS = Number(args.timeout || 20) * 1000;
const MAX_MINUTES = Number(args["max-minutes"] || 30);

// ── Driver: spawn the shards, merge their results ──────────────────────────
if (!SHARD && PARALLEL > 1) {
  const { spawn } = require("child_process");
  const started = Date.now();
  const forward = process.argv.slice(2).filter(a => !/^--(parallel|shard|result)=/.test(a));
  const kids = [];
  for (let k = 0; k < PARALLEL; k++) {
    const result = path.join(os.tmpdir(), "rx-buttons-result-" + process.pid + "-" + k + ".json");
    const child = spawn(process.execPath, [__filename, ...forward, "--shard=" + k + "/" + PARALLEL, "--result=" + result], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", d => String(d).split("\n").filter(Boolean).forEach(l => console.log("[" + (k + 1) + "/" + PARALLEL + "] " + l)));
    child.stderr.on("data", () => {});
    kids.push({ child, result, done: new Promise(r => child.on("exit", code => r(code))) });
  }
  const watchdog = setTimeout(() => { console.log("\nOVER " + MAX_MINUTES + " MINUTES — stopping every shard"); kids.forEach(k => { try { k.child.kill("SIGKILL"); } catch (e) {} }); }, MAX_MINUTES * 60000);
  Promise.all(kids.map(k => k.done)).then(() => {
    clearTimeout(watchdog);
    let pressed = 0; const problems = [], stops = {};
    kids.forEach((k, i) => {
      let r = null; try { r = JSON.parse(fs.readFileSync(k.result, "utf8")); fs.unlinkSync(k.result); } catch (e) {}
      if (!r) { problems.push("shard " + (i + 1) + " did not finish (killed or crashed)"); return; }
      pressed += r.pressed; problems.push(...r.problems);
      r.stops.forEach(st => { const t = stops[st.name] || (stops[st.name] = { presses: 0, secs: 0 }); t.presses += st.presses; t.secs = Math.max(t.secs, st.secs); });
    });
    const slow = Object.entries(stops).sort((a, b) => b[1].secs - a[1].secs).slice(0, 5).map(([n, t]) => n + " " + Math.round(t.secs) + "s");
    console.log("\n" + pressed + " presses across " + Object.keys(stops).length + " views, " + problems.length + " problem(s), " + Math.round((Date.now() - started) / 1000) + "s with " + PARALLEL + " in parallel");
    console.log("slowest views: " + slow.join(" · "));
    problems.forEach(p => console.log("  PROBLEM " + p));
    app.exit(problems.length ? 1 : 0);
  });
  return;
}

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
// --userdata=<dir> --case="<name>": sweep an existing profile's case (a copy
// of the user's real data — cases saved before newer fields existed) instead
// of a freshly loaded sample. Each copy of the app works on its own copy of
// the profile, so the original is never written to.
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "rx-buttons-"));
if (args.userdata) fs.cpSync(path.resolve(String(args.userdata)), PROFILE, { recursive: true });
app.setPath("userData", PROFILE);
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
  const problems = [], stopTimes = [];
  let pressed = 0;
  try {
    require(path.join(APP, "Contents/Resources/app.asar/main.js"));
    let w; while (!(w = BrowserWindow.getAllWindows()[0])) await sleep(100);
    await new Promise(r => w.webContents.isLoading() ? w.webContents.once("did-finish-load", r) : r());
    w.setSize(1470, 920); await sleep(800);
    w.webContents.setBackgroundThrottling(false);
    // Every call into the page answers within TIMEOUT_MS or throws.
    const js = c => Promise.race([w.webContents.executeJavaScript(c, true),
      new Promise((_, rej) => setTimeout(() => rej(new Error("no answer in " + TIMEOUT_MS / 1000 + "s")), TIMEOUT_MS))]);
    const recover = async () => {
      w.webContents.reload();
      await Promise.race([new Promise(r => w.webContents.once("did-finish-load", r)), sleep(15000)]);
      await sleep(1500);
      try { await js(PAGE); } catch (e) {}
    };
    const errs = [];
    w.webContents.on("console-message", (e) => { if (e.level === "error") errs.push(String(e.message).slice(0, 220)); });
    // Every modal opened by a press is closed before the next one.
    const escape = async () => { w.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); w.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" }); await sleep(120); };
    await js(PAGE);
    const click = async (t, ms) => { const r = await js(`__b.click(${JSON.stringify(t)})`); await sleep(ms || 500); return r; };

    // A finished sample case, so every section has content.
    if (!args.case) {
      await click("Load sample case", 300);
      await click(args.sample === "stoke" ? "Stoke — Dravet, Phase 3" : "PepGen — DM1, Phase 2", 1500);
    }
    const caseName = args.case ? String(args.case) : args.sample === "stoke" ? "Stoke Therapeutics — sample case" : "PepGen — sample case";
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

    // Presses are numbered across the whole run; a shard takes every Nth, so
    // the shards share the work evenly whatever the views hold.
    let global = 0;
    const mine = () => { const i = global++; return !SHARD || i % SHARD[1] === SHARD[0]; };
    for (const st of stops) {
      if (ONLY && !ONLY.some(o => st.name.startsWith(o))) continue;
      const t0 = Date.now();
      let n = 0;
      try {
        await st.go();
        const labels = await js(`__b.list()`);
        const seen = {};
        const targets = labels.map(l => { seen[l] = (seen[l] || 0); return { label: l, nth: seen[l]++ }; }).filter(mine);
        for (const t of targets) {
          try {
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
            if (crashed) await recover();
          } catch (e) {
            problems.push(st.name + " · \"" + t.label + "\" → hung: " + e.message);
            await recover();
          }
        }
      } catch (e) {
        problems.push(st.name + " → could not open the view: " + e.message);
        await recover();
      }
      const secs = (Date.now() - t0) / 1000;
      stopTimes.push({ name: st.name, presses: n, secs });
      console.log(st.name + ": " + n + " buttons pressed, " + Math.round(secs) + "s");
    }
  } catch (e) { problems.push("harness: " + e.stack); }
  if (args.result) fs.writeFileSync(args.result, JSON.stringify({ pressed, problems, stops: stopTimes }));
  else {
    console.log("\n" + pressed + " presses, " + problems.length + " problem(s)");
    problems.forEach(p => console.log("  PROBLEM " + p));
  }
  app.exit(problems.length ? 1 : 0);
});
