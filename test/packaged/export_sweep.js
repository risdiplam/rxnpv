// Export sweep — every section and every chart in the app, exported through
// the REAL export buttons, and every resulting file checked.
//
// Runs the packaged app's own main.js/preload (real IPC, CSP, print engine,
// offscreen renderer) under the project's Electron; only the save dialog is
// replaced, so each file can be named and found. Network ON: live tools are
// run with real inputs so their charts exist.
//
// For every [data-export-section] and [data-export-chart] on every stop:
//   · the on-screen element is captured (captureBeyondViewport),
//   · its bar's PNG and PDF buttons are clicked (and SVG for a chart),
//   · the saved file must exist, and its visible content ("ink": pixels that
//     differ clearly from the background) must be comparable to what is on
//     screen — a faded or blank export (the September 2026 fade-in bug) fails
//     here even though the file exists and is the right size;
//   · PDFs are rendered page by page with pdf_pages (PDFKit) and checked the
//     same way.
// On screen it also checks that no view scrolls sideways, that no content runs
// out of its card, and that no chart is drawn taller than the window.
// Finally a report is built from a mix of sections and single charts, exported
// to PDF, and every page rendered. Contact sheets of everything are written to
// the output folder for review by eye.
//
//   E=electron/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
//   $E test/packaged/export_sweep.js --app=electron/dist/mac-arm64/RxNPV.app --pdfpages=<compiled pdf_pages> [--only=Simulation]
const { app, dialog, BrowserWindow, nativeImage } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync } = require("child_process");

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : true]; }));
const APP = path.resolve(args.app || "/Applications/RxNPV.app");
const OUT = args.out || path.join(os.tmpdir(), "rxnpv-export-sweep");
const PDFPAGES = args.pdfpages;
const ONLY = args.only ? String(args.only).split(",") : null;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "files"), { recursive: true });
app.setPath("userData", path.join(OUT, "profile"));

let nextName = "export";
dialog.showSaveDialog = async (w, o) => {
  const ext = path.extname((o && o.defaultPath) || "") || ".bin";
  return { canceled: false, filePath: path.join(OUT, "files", nextName + ext) };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const record = (r) => { results.push(r); if (!r.ok) console.log("FAIL " + r.stop + " · " + r.kind + " · " + r.title + " · " + r.what + (r.detail ? " — " + r.detail : "")); };

// Share of pixels that clearly differ from the background.
function inkOf(file) {
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  const r = img.resize({ width: 320 });
  const { width, height } = r.getSize();
  const b = r.toBitmap();
  // Background = the most common colour (quantised), not a corner pixel: a
  // chart block can start with a bar or a label at its very edge.
  const counts = new Map();
  for (let i = 0; i < b.length; i += 4) { const k = (b[i] >> 3) + "," + (b[i + 1] >> 3) + "," + (b[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); }
  let bestK = null, best = -1; counts.forEach((v, k) => { if (v > best) { best = v; bestK = k; } });
  const bg = bestK.split(",").map(x => (Number(x) << 3) + 4);
  let n = 0;
  for (let i = 0; i < b.length; i += 4) {
    if (Math.max(Math.abs(b[i] - bg[0]), Math.abs(b[i + 1] - bg[1]), Math.abs(b[i + 2] - bg[2])) > 40) n++;
  }
  return n / (width * height);
}
function pdfPages(file, prefix) {
  // Rendered at 2x (144 dpi) to match the Retina screen capture it is compared
  // with; at 72 dpi thin chart lines anti-alias to near-background and read as
  // missing content.
  const n = parseInt(execFileSync(PDFPAGES, [file, prefix, "2"]).toString().trim(), 10);
  return Array.from({ length: n }, (_, i) => prefix + "-" + (i + 1) + ".png");
}
async function waitFile(f, ms) { for (let t = 0; t < ms; t += 200) { if (fs.existsSync(f) && fs.statSync(f).size > 0) { await sleep(150); return true; } await sleep(200); } return false; }

const PAGE_HELPERS = `
window.__t = {
  btn: (t) => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === t),
  click: (t) => { const b = window.__t.btn(t); if (b) b.click(); return !!b; },
  setVal: (el, v) => { if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); return true; },
  byLabel: (t) => [...document.querySelectorAll("input")].filter(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); }),
  ph: (p) => document.querySelector('input[placeholder^="' + p + '"]'),
  visible: (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; },
  items: () => {
    const out = [];
    let n = 0;
    document.querySelectorAll("[data-sweep-id]").forEach(e => e.removeAttribute("data-sweep-id"));
    [...document.querySelectorAll("[data-export-section]")].filter(__t.visible).forEach(el => { el.setAttribute("data-sweep-id", String(++n)); out.push({ id: n, kind: "section", title: sectionTitleOf(el) }); });
    [...document.querySelectorAll("[data-export-chart]")].filter(__t.visible).forEach(el => { el.setAttribute("data-sweep-id", String(++n)); out.push({ id: n, kind: "chart", title: sectionTitleOf(el) }); });
    return out;
  },
  rect: (id) => { const el = document.querySelector('[data-sweep-id="' + id + '"]'); el.scrollIntoView({ block: "start" }); window.scrollBy(0, -80); const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; },
  bar: (id, kind) => { const el = document.querySelector('[data-sweep-id="' + id + '"]');
    const cls = kind === "chart" ? ".chart-export-bar" : ".section-export-bar";
    return [...el.querySelectorAll(cls)].find(b => (kind === "chart" ? closestChartBlock(b) : closestExportSection(b)) === el) || null; },
  press: (id, kind, label) => { const bar = __t.bar(id, kind); if (!bar) return "no bar";
    const b = [...bar.querySelectorAll("button")].find(x => x.textContent.trim() === label); if (!b) return "no " + label + " button"; b.click(); return "ok"; },
  layout: () => {
    const over = document.documentElement.scrollWidth - innerWidth;
    const spill = [...document.querySelectorAll("[data-export-section]")].filter(__t.visible).filter(el => {
      const cs = getComputedStyle(el); return !/auto|scroll|hidden/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2; }).map(el => sectionTitleOf(el));
    const tall = [...document.querySelectorAll("[data-export-chart] svg")].filter(__t.visible).filter(s => s.getBoundingClientRect().height > innerHeight).map(s => sectionTitleOf(s.closest("[data-export-chart]")) + " (" + Math.round(s.getBoundingClientRect().width) + "x" + Math.round(s.getBoundingClientRect().height) + ")");
    return { over, spill, tall };
  }
};
true;`;

app.whenReady().then(async () => {
  require(path.join(APP, "Contents", "Resources", "app.asar", "main.js"));
  let win; while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100);
  await new Promise(r => win.webContents.isLoading() ? win.webContents.once("did-finish-load", r) : r());
  win.setSize(1470, 920);
  await sleep(1500);
  const js = c => win.webContents.executeJavaScript(c, true);
  await js(PAGE_HELPERS);
  const dbg = win.webContents.debugger; dbg.attach("1.3");
  const click = async (t, ms) => { const r = await js(`__t.click(${JSON.stringify(t)})`); await sleep(ms || 600); return r; };
  const waitFor = async (code, ms) => { for (let t = 0; t < ms; t += 400) { if (await js(code).catch(() => false)) return true; await sleep(400); } return false; };
  const sheets = [];

  async function sweep(stop) {
    if (ONLY && !ONLY.some(o => stop.startsWith(o))) return;
    await sleep(500);
    const lay = await js("__t.layout()");
    record({ stop, kind: "view", title: "layout", what: "no sideways scroll", ok: lay.over <= 1, detail: lay.over + "px" });
    record({ stop, kind: "view", title: "layout", what: "no content running out of its card", ok: !lay.spill.length, detail: lay.spill.join("; ") });
    record({ stop, kind: "view", title: "layout", what: "no chart taller than the window", ok: !lay.tall.length, detail: lay.tall.join("; ") });
    const items = await js("__t.items()");
    const rows = [];
    for (const it of items) {
      const slug = (stop + "-" + it.id + "-" + it.kind).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const rc = await js(`__t.rect(${it.id})`); await sleep(120);
      const shot = await dbg.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
        clip: { x: rc.x, y: rc.y, width: Math.max(1, rc.w), height: Math.max(1, Math.min(rc.h, 6000)), scale: 1 } });
      const screenFile = path.join(OUT, "files", slug + "-screen.png");
      fs.writeFileSync(screenFile, Buffer.from(shot.data, "base64"));
      const screenInk = inkOf(screenFile);
      const row = { title: it.title, kind: it.kind, screen: screenFile };
      for (const fmt of ["PNG", "PDF"].concat(it.kind === "chart" ? ["SVG"] : [])) {
        nextName = slug + "-" + fmt.toLowerCase();
        const pressed = await js(`__t.press(${it.id}, ${JSON.stringify(it.kind)}, ${JSON.stringify(fmt)})`);
        if (pressed !== "ok") {
          // A chart drawn in HTML (not SVG) has no SVG button, correctly.
          if (!(fmt === "SVG" && pressed === "no SVG button")) record({ stop, kind: it.kind, title: it.title, what: fmt + " button", ok: false, detail: pressed });
          continue;
        }
        const file = path.join(OUT, "files", nextName + "." + fmt.toLowerCase());
        const got = await waitFile(file, 25000);
        if (!got) { record({ stop, kind: it.kind, title: it.title, what: fmt + " file saved", ok: false, detail: "no file after 25s" }); continue; }
        if (fmt === "SVG") {
          const t = fs.readFileSync(file, "utf8");
          record({ stop, kind: it.kind, title: it.title, what: "SVG is a chart", ok: /<svg[\s>]/.test(t) && t.length > 400, detail: t.length + " bytes" });
          continue;
        }
        let img = file;
        if (fmt === "PDF") {
          const head = fs.readFileSync(file).slice(0, 5).toString();
          const pages = pdfPages(file, file.replace(/\.pdf$/, "-page"));
          record({ stop, kind: it.kind, title: it.title, what: "PDF is valid", ok: head === "%PDF-" && pages.length >= 1, detail: pages.length + " page(s)" });
          // One section or chart is one page, sized to its content — a second
          // page means something (the footer, at least) was pushed off the first.
          const h = fs.readFileSync(file).toString("latin1");
          const heightIn = ((h.match(/\/MediaBox\s*\[\s*0\s+0\s+[\d.]+\s+([\d.]+)/) || [])[1] || 0) / 72;
          if (heightIn < 199) record({ stop, kind: it.kind, title: it.title, what: "PDF fits on one page", ok: pages.length === 1, detail: pages.length + " pages" });
          img = pages[0];
          row.pdf = img;
        } else row.png = file;
        const ink = inkOf(img);
        const ratio = screenInk > 0.002 ? ink / screenInk : null;
        // Exports drop the export rows and add a one-line footer; everything
        // else should be there, so visible content should be close to screen.
        record({ stop, kind: it.kind, title: it.title, what: fmt + " shows what the screen shows", ok: ratio == null ? ink > 0.002 : ratio > 0.6,
          detail: "ink " + (ink * 100).toFixed(1) + "% vs screen " + (screenInk * 100).toFixed(1) + "%" + (ratio != null ? " (x" + ratio.toFixed(2) + ")" : "") });
      }
      rows.push(row);
    }
    sheets.push({ stop, rows });
    const n = results.filter(r => r.stop === stop);
    console.log("stop " + stop + ": " + items.length + " items, " + n.filter(r => !r.ok).length + " failing checks");
  }

  // ── Workspace ──
  await click("+ New case", 700);
  await js(`__t.setVal(__t.byLabel("Peak worldwide revenue")[0], "1000")`); await sleep(200);
  await js(`__t.setVal(__t.byLabel("Fully diluted shares")[0], "100000000")`); await sleep(200);
  await js(`__t.setVal(document.querySelector('input[aria-label="Case name"]'), "Sweep Bio")`); await sleep(200);
  await js(`(() => { const l = [...document.querySelectorAll("span")].find(n => n.textContent.trim() === "Current price"); return __t.setVal(l.parentElement.querySelector("input"), "10"); })()`); await sleep(300);
  await click("+ Add program", 700);
  await js(`__t.setVal(__t.byLabel("Peak worldwide revenue")[1], "600")`); await sleep(300);
  await click("Run 3,000 trials", 6000);
  await sweep("Workspace");

  // ── Tools ──
  await click("Tools", 700);
  const tool = async (bench, name, setup) => { await click(bench, 400); await click(name, 800); if (setup) await setup(); await sweep("Tools · " + name); };
  await tool("Trial", "Trial Decoder", async () => {
    await js(`__t.setVal(__t.ph("NCT number"), "NCT03036124")`); await sleep(200); await click("Decode", 300);
    await waitFor(`/Design flags/i.test(document.body.innerText)`, 30000);
    await click("Load what these trials actually reported", 300);
    await waitFor(`/Safety as reported/i.test(document.body.innerText)`, 30000); });
  await tool("Trial", "Asset Program", async () => {
    await js(`__t.setVal(__t.ph("drug or intervention name"), "dapagliflozin")`); await sleep(200);
    await js(`(() => { const i = __t.ph("drug or intervention name"); const b = i && [...i.parentElement.querySelectorAll("button")][0]; if (b) b.click(); return !!b; })()`);
    await waitFor(`/randomi[sz]ed/i.test(document.body.innerText)`, 45000); });
  await tool("Trial", "Trial Explorer");
  await tool("Trial", "FDA Lookup", async () => {
    await js(`__t.setVal(document.querySelector('input[aria-label="Drug name"]'), "Farxiga")`); await sleep(200); await click("Search openFDA", 300);
    await waitFor(`!/Searching…/.test(document.body.innerText) && /approval/i.test(document.body.innerText)`, 30000); });
  await tool("Science", "Target Dossier", async () => {
    await js(`__t.setVal(__t.ph("Gene symbol"), "PCSK9")`); await sleep(200); await click("Look up target", 300);
    await waitFor(`!/Looking up…/.test(document.body.innerText)`, 30000); await sleep(800);
    await js(`(() => { const b = [...document.querySelectorAll("button")].find(x => { const s = x.querySelector("b"); return s && s.textContent.trim() === "PCSK9"; }); if (b) b.click(); return true; })()`);
    await waitFor(`/Human genetic evidence/i.test(document.body.innerText)`, 30000); });
  await tool("Science", "Literature", async () => {
    await js(`__t.setVal(__t.ph("drug, target, indication"), "dapagliflozin heart failure")`); await sleep(200); await click("Search the literature", 300);
    await waitFor(`!/Searching Europe PMC…/.test(document.body.innerText) && /review|trial/i.test(document.body.innerText)`, 30000); });
  await tool("Company", "Company Lookup", async () => {
    await js(`__t.setVal(document.querySelector('input[aria-label="Company name or ticker"]'), "VRTX")`); await sleep(200); await click("Search", 300);
    await waitFor(`/EDGAR financials/.test(document.body.innerText) && !/Searching…/.test(document.body.innerText)`, 45000); });
  await tool("Company", "Catalyst Calendar");
  await tool("Company", "Cash Runway");
  await tool("Company", "Runway vs. Catalyst");
  await tool("Commercial", "Launch & Actuals", async () => {
    await js(`__t.setVal(__t.ph("brand name — e.g. Winrevair"), "Uptravi")`); await sleep(200); await click("Track it", 300);
    await waitFor(`!/Reading CMS…/.test(document.body.innerText) && /Uptravi/i.test(document.body.innerText)`, 45000); await sleep(800); });
  await tool("Commercial", "Exclusivity / LOE", async () => {
    await js(`__t.setVal(__t.ph("Brand name — e.g. Eliquis"), "Farxiga")`); await sleep(200); await click("Look up", 300);
    await waitFor(`!/Searching…/.test(document.body.innerText)`, 30000); await sleep(600); });
  await tool("Valuation", "Sensitivity");
  await tool("Valuation", "Binary Event");
  await tool("Valuation", "Diluted Market Cap");
  await tool("Benchmarks", "M&A Premium");
  await tool("Benchmarks", "Peak Sales Comps");
  await tool("Benchmarks", "Licensing Comps");

  // ── Simulation: every tab and sub-tool, run with its defaults ──
  await click("Simulation", 1000);
  const run = async () => { await js(`(() => { document.querySelectorAll("#ts-root .runbtn").forEach(b => b.click()); return true; })()`); await sleep(2500); };
  for (const t of ["Trial Outcome / PoS", "Phase 2→3 Translator", "Meta-Analysis", "Peak Sales", "PK/PD"]) { await click(t, 700); await run(); await sweep("Simulation · " + t); }
  await click("Trial Statistics", 700);
  for (const t of ["Fragility Index", "Sample Size / Power", "P-value ↔ CI", "Single-Arm CI", "2×2 Outcome Analysis", "Non-Inferiority", "Multiplicity Adjustment"]) {
    await click(t, 700);
    // Multiplicity ships with no p-values (it needs the user's endpoints), so
    // give it three to draw its chart.
    if (t === "Multiplicity Adjustment") await js(`(() => { const ps = [...document.querySelectorAll("#ts-root input")].filter(i => /p-value/i.test((i.closest("label") || {}).textContent || ""));
      ["0.01", "0.03", "0.2"].forEach((v, i) => { if (ps[i]) ps[i].value = v; }); return ps.length; })()`);
    await run(); await sweep("Simulation · " + t); }

  // ── Reference Sheet, Portfolio ──
  await click("Reference Sheet", 800);
  for (const t of ["How This Works", "Revenue Build", "Cost Structure", "R&D & Timeline", "Probability of Success", "Discount Rate", "Valuation & Dilution", "M&A Comps", "Trial Glossary"]) { await click(t, 600); await sweep("Reference · " + t); }
  await click("Portfolio", 800); await sweep("Portfolio");

  // ── Together: a report built from sections AND single charts ──
  if (!ONLY || ONLY.includes("Report")) {
    const add = async (view, sub, kind) => {
      await click(view, 800); if (sub) { for (const s of sub) await click(s, 700); }
      if (view === "Simulation") await run();
      return await js(`(() => { const cls = ${JSON.stringify(kind === "chart" ? ".chart-export-bar" : ".section-export-bar")};
        const bar = [...document.querySelectorAll(cls)].find(__t.visible); if (!bar) return false;
        const b = [...bar.querySelectorAll("button")].find(x => x.textContent.trim() === "+ Report"); if (!b) return false; b.click(); return true; })()`);
    };
    const adds = [
      await add("Simulation", ["Trial Statistics", "Fragility Index"], "chart"),
      await add("Simulation", ["Trial Statistics", "Sample Size / Power"], "section"),
      await add("Simulation", ["Peak Sales"], "chart"),
      await add("Tools", ["Benchmarks", "M&A Premium"], "chart"),
      await add("Reference Sheet", ["Probability of Success"], "section")
    ];
    await sleep(1500);
    record({ stop: "Report", kind: "report", title: "build", what: "five items added (3 single charts, 2 sections)", ok: adds.every(Boolean), detail: JSON.stringify(adds) });
    await click("Workspace", 800);
    await js(`[...document.querySelectorAll("button")].find(b => /Generate Report/.test(b.textContent)).click()`); await sleep(2000);
    const n = await js(`document.querySelectorAll("#report-added .report-snapshot").length`);
    record({ stop: "Report", kind: "report", title: "render", what: "all five render in the report", ok: n === 5, detail: n });
    nextName = "report-together";
    await js(`window.electronAPI.exportPDF("report-together.pdf")`);
    const f = path.join(OUT, "files", "report-together.pdf");
    const ok = await waitFile(f, 20000);
    const pages = ok ? pdfPages(f, path.join(OUT, "files", "report-together-page")) : [];
    record({ stop: "Report", kind: "report", title: "PDF", what: "report PDF exported and rendered", ok: pages.length >= 2, detail: pages.length + " pages" });
    sheets.push({ stop: "Report", rows: pages.map((p, i) => ({ title: "page " + (i + 1), kind: "page", pdf: p })) });
  }

  // ── Contact sheets ──
  for (const s of sheets) {
    const cell = (label, f) => f ? '<div class="c"><div class="l">' + label + '</div><img src="' + path.relative(OUT, f) + '"></div>' : '<div class="c"><div class="l">' + label + ' — none</div></div>';
    const html = '<!doctype html><meta charset="utf-8"><style>body{font:12px -apple-system;margin:12px;background:#ddd}h2{margin:18px 0 6px}.r{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;background:#fff;padding:8px}.c img{max-width:100%;max-height:900px;border:1px solid #999;display:block}.l{font-weight:600;margin:2px 0}</style><h1>' + s.stop + '</h1>'
      + s.rows.map(r => '<h2>' + r.kind + ': ' + r.title + '</h2><div class="r">' + (r.kind === "page" ? cell("", r.pdf) : cell("on screen", r.screen) + cell("PNG export", r.png) + cell("PDF export (page 1)", r.pdf)) + '</div>').join("");
    const hf = path.join(OUT, "sheet-" + s.stop.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".html");
    fs.writeFileSync(hf, html);
    const w = new BrowserWindow({ show: false, width: 1600, height: 1000, webPreferences: { sandbox: true } });
    await w.loadFile(hf); await sleep(800);
    const d = w.webContents.debugger; d.attach("1.3");
    const m = await d.sendCommand("Page.getLayoutMetrics");
    const shot = await d.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1600, height: Math.min(Math.ceil(m.cssContentSize.height), 16000), scale: 0.6 } });
    fs.writeFileSync(hf.replace(/\.html$/, ".png"), Buffer.from(shot.data, "base64"));
    w.destroy();
  }

  const failed = results.filter(r => !r.ok);
  const items = results.filter(r => /shows what the screen shows/.test(r.what)).length;
  console.log("\n" + results.length + " checks (" + items + " exported images compared with the screen), " + failed.length + " failed. Output: " + OUT);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
  app.exit(failed.length ? 1 : 0);
});
