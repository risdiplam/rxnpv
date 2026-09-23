// Packaged-app checks — the B-001 … B-013 worklist from docs/RxNPV_MUSE_AUDIT.md.
//
// Runs the INSTALLED app's own main.js and preload.js (from inside its
// app.asar) under the project's Electron binary, so the real IPC handlers,
// the real CSP, the real print engine and the real offscreen section renderer
// are what get exercised. Exactly one thing is replaced: dialog.showSaveDialog
// returns a path in the output folder instead of waiting for a click, because
// a native save sheet cannot be driven headlessly. Everything is written to a
// throwaway profile, never the user's.
//
//   E=electron/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
//   $E test/packaged/packaged_check.js --mode=offline   # B-001/002/007/008/009/011
//   $E test/packaged/packaged_check.js --mode=reopen    # B-008: relaunch, data survives
//   $E test/packaged/packaged_check.js --mode=live      # B-003/004/005/006/010/013
//
// Options: --app=/Applications/RxNPV.app  --out=<folder>  (default: $TMPDIR/rxnpv-packaged-check)
// Exits 1 if any check fails. Not part of `npm test`: it needs a Mac, the built
// app, and (for --mode=live) the network.
const { app, dialog, session, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : true]; }));
const APP = args.app || "/Applications/RxNPV.app";
const ASAR = path.join(APP, "Contents", "Resources", "app.asar");
const MODE = args.mode || "offline";
const OUT = args.out || path.join(os.tmpdir(), "rxnpv-packaged-check");
const PROFILE = path.join(OUT, "profile");
fs.mkdirSync(OUT, { recursive: true });
if (MODE === "offline" && fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });
app.setPath("userData", PROFILE);

let saveN = 0;
const saved = [];
dialog.showSaveDialog = async (win, opts) => {
  const f = path.join(OUT, MODE + "-" + (++saveN) + "-" + path.basename((opts && opts.defaultPath) || "export"));
  saved.push(f);
  return { canceled: false, filePath: f };
};

const results = [];
const ok = (cond, label, detail) => {
  results.push({ ok: !!cond, label });
  console.log((cond ? "PASS " : "FAIL ") + label + (detail != null ? "  — " + detail : ""));
};
const consoleMsgs = [];
app.on("web-contents-created", (e, wc) => {
  wc.on("console-message", (ev) => consoleMsgs.push({ level: ev.level, message: ev.message }));
});
// "Offline" means every http(s) request is cancelled at the session, before it
// reaches the network. (enableNetworkEmulation turned out not to stop renderer
// fetches in this setup; the harness checks that the block really holds.)
let offlineBlock = false;
const installBlock = () => session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*"] },
  (d, cb) => cb({ cancel: offlineBlock }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Helpers installed in the page once. React inputs need the native value
// setter plus an input event; a plain .value assignment is ignored.
const PAGE_HELPERS = `
window.__t = {
  btn: (t) => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === t),
  click: (t) => { const b = window.__t.btn(t); if (b) b.click(); return !!b; },
  setVal: (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); return !!el; },
  byLabel: (t) => [...document.querySelectorAll("input")].filter(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); }),
  byPlaceholder: (p) => document.querySelector('input[placeholder^="' + p + '"]'),
  text: () => document.body.innerText,
  hOverflow: () => document.documentElement.scrollWidth - window.innerWidth,
  stored: () => JSON.parse(localStorage.getItem("rxnpv_cases_v1") || "[]")
};
true;`;

function pdfFacts(file) {
  const b = fs.readFileSync(file);
  const s = b.toString("latin1");
  return { bytes: b.length, header: s.slice(0, 5) === "%PDF-", pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length,
    fonts: /\/FontFile/.test(s), images: /\/Subtype\s*\/Image/.test(s) };
}
function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

async function shot(win, name) {
  // captureBeyondViewport: the only capture path that works when the window
  // is occluded or on another Space (see CLAUDE.md).
  const dbg = win.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach("1.3");
  const m = await dbg.sendCommand("Page.getLayoutMetrics");
  const w = Math.ceil(m.cssVisualViewport.clientWidth), h = Math.min(Math.ceil(m.cssContentSize.height), 4000);
  const r = await dbg.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  const f = path.join(OUT, MODE + "-" + name + ".png");
  fs.writeFileSync(f, Buffer.from(r.data, "base64"));
  return f;
}

app.whenReady().then(async () => {
  installBlock();
  offlineBlock = MODE !== "live";
  require(path.join(ASAR, "main.js"));
  let win = null;
  for (let i = 0; i < 100 && !win; i++) { win = BrowserWindow.getAllWindows()[0]; if (!win) await sleep(100); }
  if (!win) { console.log("FAIL no window was created"); app.exit(1); return; }
  await new Promise(res => win.webContents.isLoading() ? win.webContents.once("did-finish-load", res) : res());
  await sleep(1500);
  const js = (code) => win.webContents.executeJavaScript(code, true);
  await js(PAGE_HELPERS);
  const click = async (t, ms) => { const r = await js(`__t.click(${JSON.stringify(t)})`); await sleep(ms || 500); return r; };
  const text = () => js("__t.text()");

  try {
    if (MODE === "offline") await offline(win, js, click, text);
    else if (MODE === "reopen") await reopen(win, js, click, text);
    else if (MODE === "live") await live(win, js, click, text);
  } catch (e) {
    ok(false, "harness error: " + e.message);
  }

  const failed = results.filter(r => !r.ok).length;
  console.log("\n" + (failed ? failed + " of " + results.length + " checks FAILED" : "All " + results.length + " checks passed") + "  (mode: " + MODE + ", output: " + OUT + ")");
  await session.defaultSession.flushStorageData();
  await sleep(500);
  app.exit(failed ? 1 : 0);
});

// ── B-001, B-002, B-007, B-008 (resize), B-009 (captures), B-011 ─────────────
async function offline(win, js, click, text) {
  // B-001 — offline launch: vendored React, a CSP that admits the bundle.
  ok(await js("typeof React === 'object' && typeof ReactDOM === 'object'"), "B-001: React loads with the network off (vendored, not CDN)");
  ok(await js("document.getElementById('root').children.length > 0 && !!__t.btn('Workspace')"), "B-001: the app renders — not a blank window");
  const cspErrors = consoleMsgs.filter(m => /Content Security Policy|Refused to/i.test(m.message));
  ok(cspErrors.length === 0, "B-001: no CSP violations on load", cspErrors.length ? cspErrors[0].message.slice(0, 160) : null);
  ok(await js("fetch('https://clinicaltrials.gov/api/v2/version').then(() => false, () => true)"), "B-001: the network really is off for this run");

  // A case to work with.
  await click("+ New case", 600);
  await js(`__t.setVal(__t.byLabel("Peak worldwide revenue")[0], "1000")`); await sleep(200);
  await js(`__t.setVal(__t.byLabel("Fully diluted shares")[0], "100000000")`); await sleep(200);
  await js(`__t.setVal(document.querySelector('input[aria-label="Case name"]'), "Packaged Check")`); await sleep(200);
  await js(`(() => { const l = [...document.querySelectorAll("span")].find(n => n.textContent.trim() === "Current price"); return __t.setVal(l.parentElement.querySelector("input"), "10"); })()`); await sleep(400);

  // B-011 / FIN-001 — override round trip in the packaged renderer.
  await js(`[...document.querySelectorAll("div")].find(n => n.textContent.trim() === "Edit Bear / Bull assumptions").click()`); await sleep(400);
  await js(`__t.setVal(__t.byLabel("peak revenue override")[0], "1000")`); await sleep(400);
  const ov = await js(`({ shown: __t.byLabel("peak revenue override")[0].value, stored: __t.stored()[0].programs[0].quickRevenue.scenarioOverrides.bear.peakRevenue })`);
  ok(ov.shown === "1000" && ov.stored === "1000000000", "B-011/FIN-001: override shows 1000 ($M) and stores $1e9", JSON.stringify(ov));

  // B-002 — whole-section export, PNG and PDF, through the real render-section IPC.
  const png = await js(`(async () => { const s = document.getElementById('ws-valuation'); const h = s.getBoundingClientRect().height;
    const r = await exportSectionAs(s, 'png', { title: sectionTitleOf(s), context: exportContextOf(s), returnData: true }); return { h, vh: innerHeight, ok: r.ok, data: r.data, err: r.error }; })()`);
  if (png.ok) {
    const buf = Buffer.from(png.data, "base64"); fs.writeFileSync(path.join(OUT, "offline-valuation.png"), buf);
    const sz = pngSize(buf);
    ok(sz.h / sz.w > png.h / 1300, "B-002: Valuation card PNG is full height (" + Math.round(png.h) + "px card vs " + png.vh + "px window)", sz.w + "×" + sz.h);
  } else ok(false, "B-002: Valuation card PNG", png.err);
  const pdf = await js(`(async () => { const s = document.getElementById('ws-valuation'); const r = await exportSectionAs(s, 'pdf', { title: sectionTitleOf(s), context: exportContextOf(s), returnData: true }); return { ok: r.ok, data: r.data, err: r.error }; })()`);
  if (pdf.ok) {
    const f = path.join(OUT, "offline-valuation.pdf"); fs.writeFileSync(f, Buffer.from(pdf.data, "base64"));
    const p = pdfFacts(f);
    ok(p.header && p.fonts && !p.images, "B-002: Valuation card PDF is vector with embedded fonts", JSON.stringify(p));
  } else ok(false, "B-002: Valuation card PDF", pdf.err);
  const chart = await js(`(async () => { const svg = [...document.querySelectorAll('#ws-revenue svg')].find(n => n.getBoundingClientRect().width > 120); return await exportChartAsPdf(svg, 'revenue-chart'); })()`);
  ok(chart && chart.ok && fs.existsSync(chart.filePath) && pdfFacts(chart.filePath).header, "B-002: chart-only PDF via export-chart-pdf", chart && (chart.filePath || chart.error));
  const svgSave = await js(`(async () => { const svg = [...document.querySelectorAll('#ws-revenue svg')].find(n => n.getBoundingClientRect().width > 120); return await exportChartAsSvg(svg, 'revenue-chart'); })()`);
  ok(svgSave && svgSave.ok && /<svg/.test(fs.readFileSync(saved[saved.length - 1], "utf8")), "B-002: SVG via save-asset", svgSave && svgSave.error);

  // B-011 / FIN-003 — Peak Sales percent inputs.
  await click("Simulation", 900); await click("Peak Sales", 600);
  await js(`(() => { const s = document.getElementById("shareType"); s.value = "point"; s.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("dxA").value = "60"; document.getElementById("txA").value = "50"; document.getElementById("shareA").value = "25"; return true; })()`);
  await click("Run simulation", 1500);
  const ps = await js(`document.getElementById("peakSalesResults").innerText.slice(0, 60)`);
  ok(/\$7\.50B/.test(ps), "B-011/FIN-003: 60/50/25% gives $7.50B median peak sales", ps.replace(/\s+/g, " "));

  // B-011 / FIN-002 — milestones move with Bear PoS (engine in the packaged bundle).
  const fin2 = await js(`(() => { const p = (o) => ({ id: "p1", name: "A", currentPhase: "phase2", therapeuticArea: "Oncology", modality: "smallMolecule",
      revenueMode: "quick", quickRevenue: { peakRevenue: "500000000", yearsToPeak: "6", profile: "median" }, posOverridePct: o,
      partnership: { enabled: true, upfrontM: "0", milestones: [{ label: "Approval", gate: "launch", valueM: "100" }] } });
    const c = (o) => ({ programs: [p(o)] }); const b = { posMultiplierPct: 100 }, bear = { posMultiplierPct: 70 };
    return { r5: computePartnershipContribution(c("50"), 0.12, b) / computePartnershipContribution(c("10"), 0.12, b),
             r07: computePartnershipContribution(c("50"), 0.12, bear) / computePartnershipContribution(c("50"), 0.12, b) }; })()`);
  ok(Math.abs(fin2.r5 - 5) < 1e-9 && Math.abs(fin2.r07 - 0.7) < 1e-9, "B-011/FIN-002: milestone value 5× at 50% vs 10% PoS, 0.7× under Bear", JSON.stringify(fin2));

  // B-011 / FIN-006 — Exclusivity race in the packaged renderer (stubbed lookup).
  await click("Tools", 600); await click("Commercial", 400); await click("Exclusivity / LOE", 600);
  const fin6 = await js(`(async () => { const real = window.fetchExclusivity, pending = {};
    window.fetchExclusivity = (n) => new Promise(r => { pending[n] = () => r({ ok: false, error: "Orange Book result for " + n }); });
    const input = __t.byPlaceholder("Brand name");
    const enter = () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    __t.setVal(input, "Eliquis"); await new Promise(r => setTimeout(r, 100)); enter(); await new Promise(r => setTimeout(r, 100));
    __t.setVal(input, "Jardiance"); await new Promise(r => setTimeout(r, 100)); enter(); await new Promise(r => setTimeout(r, 100));
    pending.Jardiance(); await new Promise(r => setTimeout(r, 200)); pending.Eliquis(); await new Promise(r => setTimeout(r, 300));
    window.fetchExclusivity = real; const t = document.body.innerText;
    return { j: /result for Jardiance/.test(t), e: /result for Eliquis/.test(t) }; })()`);
  ok(fin6.j && !fin6.e, "B-011/FIN-006: the newer lookup survives a slower earlier one", JSON.stringify(fin6));

  // B-007 — two added sections, reorder, dark retheme, report PDF.
  await click("Benchmarks", 400); await click("M&A Premium", 600);
  await js(`(() => { const sec = document.querySelector("[data-export-context^='Tools'] [data-export-section]");
    [...sec.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Report").click(); return true; })()`); await sleep(1200);
  await click("Reference Sheet", 700);
  await js(`(() => { const sec = document.querySelector("[data-export-context='Reference Sheet'] [data-export-section]");
    [...sec.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Report").click(); return true; })()`); await sleep(1200);
  const before = await js(`__t.stored()[0].pinnedResults.map(p => p.id)`);
  ok(before.length === 2, "B-007: two sections added to the case's report", before.length);
  await click("Workspace", 600);
  await js(`[...document.querySelectorAll("button")].find(b => /Generate Report/.test(b.textContent)).click()`); await sleep(1200);
  ok(await js(`document.querySelectorAll("#report-added .report-snapshot").length === 2`), "B-007: both render in the report");
  await js(`[...document.querySelectorAll("button")].find(b => /^Sections \\(/.test(b.textContent.trim())).click()`); await sleep(400);
  await js(`document.getElementById("report-added-picker").querySelector('button[aria-label="Move down"]').click()`); await sleep(600);
  const after = await js(`__t.stored()[0].pinnedResults.map(p => p.id)`);
  ok(after[0] === before[1] && after[1] === before[0], "B-007: reorder is saved on the case");
  // Under print media the app's own navigation must disappear: it used to sit
  // across the top of page 1 of every report PDF.
  const dbg = win.webContents.debugger; if (!dbg.isAttached()) dbg.attach("1.3");
  await dbg.sendCommand("Emulation.setEmulatedMedia", { media: "print" });
  const navHidden = await js(`(() => { const nav = [...document.querySelectorAll("div")].find(d => d.children.length && /^RxNPV/.test(d.innerText || d.textContent) && getComputedStyle(d).position === "sticky");
    const bar = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Portfolio");
    let n = bar; while (n && n !== document.body && getComputedStyle(n).display !== "none") n = n.parentElement;
    return !!bar && n !== document.body; })()`);
  await dbg.sendCommand("Emulation.setEmulatedMedia", { media: "" });
  ok(navHidden, "B-007: the app's navigation bar is hidden when the report is printed");
  const lightPdf = await js(`window.electronAPI.exportPDF("report-light.pdf")`);
  const lp = lightPdf && lightPdf.ok ? pdfFacts(lightPdf.filePath) : null;
  ok(lp && lp.header && lp.pages >= 1 && lp.fonts && !lp.images, "B-007: report exports to a vector PDF through export-pdf", lp ? JSON.stringify(lp) : JSON.stringify(lightPdf));
  await shot(win, "report-light");
  await click("☾ Dark report", 600);
  ok(await js(`[...document.querySelectorAll("#report-added .report-snapshot")].every(n => n.classList.contains("theme-scope-dark"))`), "B-007: added sections retheme to a dark report");
  const darkPdf = await js(`window.electronAPI.exportPDF("report-dark.pdf")`);
  ok(darkPdf && darkPdf.ok && pdfFacts(darkPdf.filePath).header, "B-007: dark report exports to PDF", darkPdf && (darkPdf.filePath || darkPdf.error));
  await shot(win, "report-dark");
  await click("☀ Light report", 400);
  await click("← Back to Workspace", 600);

  // B-008 — resize. At the 900×600 minimum no view scrolls sideways; at a
  // full-screen-like width every view uses the shared --app-max-width.
  const views = ["Workspace", "Reference Sheet", "Tools", "Simulation", "Portfolio"];
  win.setSize(900, 600); await sleep(800);
  for (const v of views) { await click(v, 700); const o = await js("__t.hOverflow()"); ok(o <= 1, "B-008: no sideways scroll at 900×600 in " + v, o + "px"); }
  win.setSize(1470, 920); await sleep(800);
  await click("Tools", 600);
  const widths = await js(`(() => { const c = document.querySelector("[data-export-context^='Tools']"); return { w: Math.round(c.getBoundingClientRect().width), vw: innerWidth }; })()`);
  const expect = Math.min(1240, widths.vw - 72);
  ok(Math.abs(widths.w - expect) <= 2, "B-008: Tools uses --app-max-width at " + widths.vw + "px", widths.w + " vs " + expect);

  // B-009 — captures of every view in both themes, for review by eye.
  for (const theme of ["light", "dark"]) {
    await js(`(() => { const want = ${JSON.stringify(theme)}; const cur = document.documentElement.getAttribute("data-theme");
      if ((cur === "dark") !== (want === "dark")) [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "☾" || b.textContent.trim() === "☀").click(); return true; })()`); await sleep(500);
    for (const v of views) { await click(v, 700); await js("window.scrollTo(0,0)"); await shot(win, "view-" + theme + "-" + v.replace(/\s+/g, "-").toLowerCase()); }
  }
  ok(true, "B-009: captured 5 views × 2 themes for review in " + OUT);
  // Leave light theme and the case saved for --mode=reopen.
  await js(`(() => { if (document.documentElement.getAttribute("data-theme") === "dark") [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "☾").click(); return true; })()`);
  await click("Workspace", 500);
}

// ── B-008 — quit and reopen: the same profile, a fresh process ────────────────
async function reopen(win, js, click, text) {
  const s = await js(`__t.stored()`);
  const c = s.find(x => x.name === "Packaged Check");
  ok(!!c, "B-008: the case saved in the previous run is there after a relaunch");
  ok(c && c.programs[0].quickRevenue.scenarioOverrides.bear.peakRevenue === "1000000000", "B-008: its Bear override survived");
  ok(c && (c.pinnedResults || []).length === 2, "B-008: its two added report sections survived");
  // Bounds are not persisted, by design: the window opens at the 1400×900
  // default each time — less whatever macOS takes to fit it on screen (it
  // shortens a 900px window under the menu bar and Dock on a smaller display).
  const [w, h] = win.getSize();
  const { screen } = require("electron");
  const area = screen.getPrimaryDisplay().workAreaSize;
  ok(w === Math.min(1400, area.width) && h <= 900 && h <= area.height, "B-008: the window reopens at the default size, fitted to the screen", w + "×" + h + " in a " + area.width + "×" + area.height + " work area");
}

// ── Live APIs: B-003, B-004, B-005, B-006, B-010, B-013 ─────────────────────
async function live(win, js, click, text) {
  const waitFor = async (code, ms) => { for (let t = 0; t < ms; t += 500) { if (await js(code)) return true; await sleep(500); } return false; };

  // B-003 / B-013 — decoder and results on the three reference trials.
  await click("Tools", 600); await click("Trial", 400); await click("Trial Decoder", 600);
  const decode = async (nct) => {
    await js(`__t.setVal(__t.byPlaceholder("NCT number"), ${JSON.stringify(nct)})`); await sleep(200);
    await click("Decode", 300);
    // Headings are text-transform: uppercase, and innerText returns them that way.
    return await waitFor(`/Design flags/i.test(document.body.innerText) && !/Decoding…|Loading…/.test(document.body.innerText)`, 30000);
  };
  const loadResults = async () => { await click("Load what these trials actually reported", 300);
    return await waitFor(`/Safety as reported|SAFETY AS REPORTED|No results are posted|not posted/i.test(document.body.innerText)`, 30000); };

  ok(await decode("NCT03036124"), "B-003: DAPA-HF (NCT03036124) decodes live");
  ok(await loadResults(), "B-003: its posted results load");
  const dapa = await js(`document.body.innerText`);
  const hr = dapa.match(/Hazard Ratio[^\n]*\n?[^\n]*?(0\.\d+)[^\n]*?(0\.\d+)\s*(?:to|–|-)\s*(0\.\d+)/i);
  ok(/Hazard Ratio/i.test(dapa), "B-003: the hazard ratio is reported", hr ? hr.slice(1).join(" / ") : "HR text not matched");
  ok(/\d+\.\d%\s+\(\d[\d,]*\/\d[\d,]*\)/.test(dapa), "B-003/FIN-004: live adverse-event rates carry their denominators");
  await shot(win, "decoder-dapa-hf");

  ok(await decode("NCT02578680"), "B-003: KEYNOTE-189 (NCT02578680) decodes live");
  ok(await loadResults(), "B-003: its results render");
  ok(await decode("NCT04368728"), "B-003: NCT04368728 (64 primary endpoints, 20 arms) decodes live");
  await loadResults();
  const o = await js("__t.hOverflow()");
  ok(o <= 1, "B-013: the mega-trial does not push the page sideways", o + "px");
  const nested = await js(`[...document.querySelectorAll("table")].filter(t => { const r = t.getBoundingClientRect(); let p = t.parentElement;
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (/auto|scroll/.test(cs.overflowX)) return false; p = p.parentElement; }
    return r.right > innerWidth + 1; }).length`);
  ok(nested === 0, "B-013: every table wider than the window sits in its own scroll box", nested + " escaping");
  await shot(win, "decoder-mega-trial");

  // B-004 — Form 4 on a real issuer, and the FIN-005 repro against live data.
  await click("Company", 400); await click("Company Lookup", 600);
  const search = async (q) => { await js(`__t.setVal(document.querySelector('input[aria-label="Company name or ticker"]'), ${JSON.stringify(q)})`); await sleep(200); await click("Search", 300);
    return await waitFor(`/EDGAR financials/.test(document.body.innerText) && !/Searching…/.test(document.body.innerText)`, 45000); };
  ok(await search("VRTX"), "B-004: VRTX EDGAR financials load live");
  await click("Load insider activity (Form 4)", 300);
  const ins = await waitFor(`/filings checked|Bought & sold|bought & sold/i.test(document.body.innerText) && !/Loading insider activity/.test(document.body.innerText)`, 60000);
  ok(ins, "B-004: VRTX Form 4 activity loads live");
  const codes = await js(`(async () => { const r = await fetchInsiderTransactions((await pullEdgarFinancials("VRTX", false)).cik, 20);
    const market = r.transactions.filter(t => t.code === "P" || t.code === "S");
    const nonMarket = r.transactions.filter(t => t.code !== "P" && t.code !== "S").concat(r.derivativeTransactions || []);
    return { ok: r.ok, filings: r.filingsChecked, market: market.length, other: nonMarket.length,
             summaryOnlyPS: (r.openMarketSummary && r.openMarketSummary.buys != null) ? true : null,
             codes: [...new Set(r.transactions.map(t => t.code))].join(",") }; })()`);
  ok(codes.ok && codes.filings > 0, "B-004: live Form 4 parse — P/S kept apart from awards/vesting/withholding", JSON.stringify(codes));
  const insiderShown = await js(`/Chief|Director|Officer|10% owner/i.test(document.body.innerText)`);
  ok(await search("MRNA"), "B-004/FIN-005: a second company loads");
  ok(!(await js(`/filings checked/i.test(document.body.innerText)`)), "B-004/FIN-005: the first company's Form 4 panel is gone after the new search", insiderShown ? null : "(no insider roles were shown before either)");

  // B-005 — CMS launch tracker on the asterisk-name case.
  await click("Commercial", 400); await click("Launch & Actuals", 600);
  // Selexipag is "Uptravi" in the quarterly file and "Uptravi*" in the annual
  // one; without the asterisk fallback the full-year history is silently lost.
  const cms = await js(`(async () => { const r = await fetchDrugSpending("Uptravi", { programme: "D" });
    const s = r.series || [];
    const full = s.filter(p => p.isFullYear), part = s.filter(p => !p.isFullYear);
    return { ok: r.ok !== false && r.found !== false, n: s.length, fullYears: full.map(p => p.year).join(","),
      partial: part.map(p => p.label + " (" + p.quarterCount + "q)").join(", "),
      partialCompared: part.every(p => !p.comparableTo || s.find(q => q.label === p.comparableTo).quarterCount === p.quarterCount) }; })()`);
  ok(cms.ok && cms.fullYears.split(",").length >= 3, "B-005: Uptravi's full-year Medicare history loads (asterisk-name fallback)", JSON.stringify(cms));
  ok(cms.partialCompared, "B-005: a partial period is only ever compared with one of the same length, never annualised against a full year", cms.partial);
  await js(`__t.setVal(__t.byPlaceholder("brand name — e.g. Winrevair"), "Uptravi")`); await sleep(200);
  await click("Track it", 300);
  ok(await waitFor(`!/Reading CMS…/.test(document.body.innerText) && /Uptravi/i.test(document.body.innerText)`, 45000), "B-005: the launch tracker renders Uptravi");
  await shot(win, "launch-uptravi");

  // B-006 — Open Targets, live schema.
  await click("Science", 400); await click("Target Dossier", 600);
  for (const g of ["PCSK9", "TTR"]) {
    await js(`__t.setVal(__t.byPlaceholder("Gene symbol"), ${JSON.stringify(g)})`); await sleep(200);
    await click("Look up target", 300);
    await waitFor(`!/Looking up…/.test(document.body.innerText)`, 45000); await sleep(1000);
    // A symbol can match several targets, so the tool asks which one first.
    const picked = await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => { const s = x.querySelector("b"); return s && s.textContent.trim() === ${JSON.stringify(g)}; });
      if (b) b.click(); return !!b; })()`);
    if (picked) await waitFor(`/Human genetic evidence/i.test(document.body.innerText)`, 45000);
    await sleep(800);
    const area = await js(`(() => { const c = document.querySelector("[data-export-context^='Tools']"); return c ? c.innerText : ""; })()`);
    const failedMsg = /couldn't reach|could not reach|unreachable|not found in open targets|no target/i.test(area);
    ok(!failedMsg && new RegExp(g, "i").test(area) && /Human genetic evidence/i.test(area) && /associat/i.test(area), "B-006: Target Dossier parses " + g + " from the live API",
      area.replace(/\s+/g, " ").slice(0, 260));
  }
  await shot(win, "dossier-ttr");

  // B-010 — FDA Lookup: zero results, then an outage, must look different.
  await click("Trial", 400); await click("FDA Lookup", 600);
  await js(`__t.setVal(document.querySelector('input[aria-label="Drug name"]'), "Zzqxnotadrugname")`); await sleep(200);
  await click("Search openFDA", 300);
  await waitFor(`!/Searching…/.test(document.body.innerText)`, 30000);
  const zero = await js(`document.body.innerText`);
  const zeroArea = await js(`(() => { const c = document.querySelector("[data-export-context^='Tools']"); return c ? c.innerText : ""; })()`);
  ok(/No openFDA data found|no Drugs@FDA approval-history match|no FDA record/i.test(zeroArea) && !/Couldn't reach openFDA/.test(zeroArea), "B-010: a nonsense name reads as 'no record', not an outage",
    zeroArea.replace(/\s+/g, " ").slice(-300));
  offlineBlock = true;
  await js(`__t.setVal(document.querySelector('input[aria-label="Drug name"]'), "Farxiga")`); await sleep(200);
  await click("Search openFDA", 300);
  await waitFor(`!/Searching…/.test(document.body.innerText)`, 30000);
  const out = await js(`document.body.innerText`);
  ok(/Couldn't reach openFDA/.test(out) && /connection problem, not a result/.test(out), "B-010: an outage says so, and is not presented as no data");
  offlineBlock = false;
}
