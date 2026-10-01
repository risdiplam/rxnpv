// UI / UX audit of the packaged app — every view, tool, tab and sub-tool, in
// both themes, at a full-screen width and at the 900px minimum.
//
// Measures what can be measured and captures what has to be looked at:
//   · text contrast against the colour actually behind it (walking up to the
//     first opaque background, compounding ancestor opacity), WCAG AA:
//     4.5:1 normal, 3:1 large (>= 24px, or >= 18.66px bold)
//   · text smaller than 10px (and chart text drawn smaller than 8px)
//   · text clipped by its box without an ellipsis
//   · click targets under 24x24 (WCAG 2.2 AA minimum) and unnamed buttons
//   · inputs/selects with no label, an input font under 12px, controls under
//     28px tall
//   · charts with no accessible name
//   · sideways scrolling, console errors
// Screenshots of every stop go to the output folder for review by eye.
//
//   $E test/packaged/ui_audit.js --app=electron/dist/mac-arm64/RxNPV.app [--out=…] [--only=Tools] [--sample=stoke|pepgen]
const { app, dialog, BrowserWindow } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : true]; }));
const APP = path.resolve(args.app || "/Applications/RxNPV.app");
const OUT = args.out || path.join(os.tmpdir(), "rxnpv-ui-audit");
const ONLY = args.only ? String(args.only).split(",") : null;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "shots"), { recursive: true });
app.setPath("userData", path.join(OUT, "profile"));
dialog.showSaveDialog = async () => ({ canceled: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const consoleErrors = [];
app.on("web-contents-created", (e, wc) => wc.on("console-message", ev => { if (ev.level === "error" || ev.level === 3) consoleErrors.push(ev.message.slice(0, 200)); }));

const PAGE = `
window.__t = {
  btn: (t) => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === t),
  click: (t) => { const b = window.__t.btn(t); if (b) b.click(); return !!b; },
  setVal: (el, v) => { if (!el) return false; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; s.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); return true; },
  byLabel: (t) => [...document.querySelectorAll("input")].filter(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); }),
  ph: (p) => document.querySelector('input[placeholder^="' + p + '"]'),
  audit: () => {
    const out = [];
    const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none"; };
    const rgb = s => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(",").map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const bgOf = el => { let n = el; while (n && n.nodeType === 1) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; n = n.parentElement; } return rgb(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255 }; };
    const opacityOf = el => { let o = 1, n = el; while (n && n.nodeType === 1) { o *= parseFloat(getComputedStyle(n).opacity) || 1; n = n.parentElement; } return o; };
    const blend = (fg, bg, a) => ({ r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) });
    const label = el => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 60);
    const where = el => { const s = el.closest("[data-export-section]"); return s ? (s.getAttribute("data-export-section") || (s.querySelector("h1,h2,h3,[data-section-title]") || {}).textContent || "").slice(0, 40) : ""; };
    const inQuietBar = el => !!el.closest(".section-export-bar, .chart-export-bar");

    // Text: every element with its own visible text.
    document.querySelectorAll("body *").forEach(el => {
      if (el.closest("svg")) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own || !vis(el)) return;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
      const fg = rgb(cs.color); if (!fg) return;
      const bg = bgOf(el);
      const eff = blend(fg, bg, (fg.a == null ? 1 : fg.a) * opacityOf(el));
      const r = ratio(eff, bg);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;
      const disabled = el.closest("button:disabled, [disabled], [aria-disabled=true]");
      if (!disabled && r < need) out.push({ type: inQuietBar(el) ? "contrast (export row, faded until hover)" : "contrast", text: el.textContent.trim().slice(0, 50), detail: r.toFixed(2) + ":1 < " + need + " · " + size + "px · " + cs.color, where: where(el) });
      // Sub/superscripts (the "max" in Cmax, the "d" in Kd) are small by
      // design — a fraction of the surrounding line — and are exempt.
      if (size < 10 && !el.closest("sub, sup")) out.push({ type: "text under 10px", text: el.textContent.trim().slice(0, 50), detail: size + "px", where: where(el) });
      // .sr-only text is clipped to 1px on purpose: it is read aloud, never seen.
      if (!el.closest(".sr-only") && (cs.overflow === "hidden" || cs.overflowX === "hidden") && cs.textOverflow !== "ellipsis" && el.scrollWidth > el.clientWidth + 2 && cs.whiteSpace === "nowrap")
        out.push({ type: "text clipped without ellipsis", text: el.textContent.trim().slice(0, 50), detail: el.scrollWidth + ">" + el.clientWidth, where: where(el) });
    });
    // Buttons and links.
    document.querySelectorAll("button, [role=button], a[href], summary").forEach(el => {
      if (!vis(el)) return;
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
      if (!name) out.push({ type: "button with no name", text: el.outerHTML.slice(0, 80), where: where(el) });
      if ((r.height < 24 || r.width < 24) && el.tagName !== "A" && el.tagName !== "SUMMARY")
        out.push({ type: inQuietBar(el) ? "small target (export row)" : "small target", text: label(el), detail: Math.round(r.width) + "x" + Math.round(r.height), where: where(el) });
    });
    // Form controls.
    document.querySelectorAll("input, select, textarea").forEach(el => {
      if (!vis(el) || el.type === "hidden") return;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const labelled = (el.labels && el.labels.length) || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.closest("label");
      if (!labelled) out.push({ type: "control with no programmatic label", text: label(el), detail: el.tagName.toLowerCase() + (el.type ? ":" + el.type : ""), where: where(el) });
      if (el.type !== "checkbox" && el.type !== "radio") {
        if (parseFloat(cs.fontSize) < 12) out.push({ type: "control text under 12px", text: label(el), detail: cs.fontSize, where: where(el) });
        if (r.height < 28) out.push({ type: "control under 28px tall", text: label(el), detail: Math.round(r.height) + "px", where: where(el) });
      }
    });
    // Charts.
    // A graphic marked aria-hidden is decorative on purpose (its values are
    // written out beside it, as in the readout table's bars), so it needs no name.
    [...document.querySelectorAll("svg")].filter(s => vis(s) && s.getBoundingClientRect().width >= 120 && s.getAttribute("aria-hidden") !== "true").forEach(s => {
      const named = s.getAttribute("aria-label") || s.getAttribute("aria-labelledby") || s.querySelector("title") || s.getAttribute("role") === "img" && s.getAttribute("aria-label");
      if (!named) out.push({ type: "chart with no accessible name", text: (s.closest("[data-export-chart]") || {}).getAttribute ? s.closest("[data-export-chart]").getAttribute("data-export-chart") : "", where: where(s) });
      s.querySelectorAll("text").forEach(t => { const h = t.getBoundingClientRect().height; if (h > 0 && h < 8) out.push({ type: "chart text drawn under 8px", text: t.textContent.slice(0, 30), detail: h.toFixed(1) + "px", where: where(s) }); });
    });
    // Mouse-only: looks clickable (pointer cursor, set on the element itself,
    // not inherited from a real control around it) but Tab can never reach it.
    document.querySelectorAll("div, span, td, tr, li, svg, g, rect, circle, path, p").forEach(el => {
      if (!vis(el)) return;
      const cs = getComputedStyle(el);
      if (cs.cursor !== "pointer") return;
      const parentCursor = el.parentElement ? getComputedStyle(el.parentElement).cursor : "";
      if (parentCursor === "pointer") return;                       // inherited — the ancestor is the one checked
      if (el.closest("button, a[href], label, summary, [tabindex]")) return;
      if (el.tabIndex >= 0) return;
      out.push({ type: "clickable but not keyboard-reachable", text: label(el), detail: el.tagName.toLowerCase(), where: where(el) });
    });
    // The section Export button sits in the section's top-right corner; it
    // must never cover the section's own text, controls or charts.
    document.querySelectorAll(".section-export-bar").forEach(bar => {
      if (!vis(bar)) return;
      const sec = bar.closest(".export-section");
      if (!sec) return;
      const boxes = [...bar.children].filter(c => vis(c) && !c.classList.contains("xm-menu")).map(c => c.getBoundingClientRect()).filter(r => r.width > 0);
      const hit = (r) => boxes.some(b => Math.min(b.right, r.right) - Math.max(b.left, r.left) > 2 && Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 2);
      for (const el of sec.querySelectorAll("*")) {
        if (bar.contains(el) || !vis(el)) continue;
        const leaf = /^(INPUT|SELECT|TEXTAREA|BUTTON|IMG|svg)$/.test(el.tagName) || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!leaf || el.closest("svg") && el.tagName !== "svg") continue;
        // Text: measure the text itself, not a block that stretches across.
        let r = el.getBoundingClientRect();
        if (!/^(INPUT|SELECT|TEXTAREA|BUTTON|IMG|svg)$/.test(el.tagName)) { const rg = document.createRange(); rg.selectNodeContents(el); r = rg.getBoundingClientRect(); }
        if (r.width > 0 && hit(r)) { out.push({ type: "export button overlaps content", text: (el.textContent || el.tagName).trim().slice(0, 50), detail: el.tagName.toLowerCase(), where: where(el) }); break; }
      }
    });
    const over = document.documentElement.scrollWidth - innerWidth;
    if (over > 1) out.push({ type: "sideways scroll", text: "", detail: over + "px" });
    return out;
  }
};
true;`;

app.whenReady().then(async () => {
  require(path.join(APP, "Contents", "Resources", "app.asar", "main.js"));
  let win; while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100);
  await new Promise(r => win.webContents.isLoading() ? win.webContents.once("did-finish-load", r) : r());
  await sleep(1500);
  const js = c => win.webContents.executeJavaScript(c, true);
  await js(PAGE);
  const dbg = win.webContents.debugger; dbg.attach("1.3");
  const click = async (t, ms) => { const r = await js(`__t.click(${JSON.stringify(t)})`); await sleep(ms || 600); return r; };
  const waitFor = async (code, ms) => { for (let t = 0; t < ms; t += 400) { if (await js(code).catch(() => false)) return true; await sleep(400); } return false; };
  const findings = [];
  let pass = "";

  async function stop(name) {
    if (ONLY && !ONLY.some(o => name.startsWith(o))) return;
    await sleep(400);
    await js("window.scrollTo(0,0)");
    const f = await js("__t.audit()");
    f.forEach(x => findings.push(Object.assign({ pass, stop: name }, x)));
    // A real keyboard walk (first pass only — focus styling doesn't change
    // with theme width): press Tab through the view and, at each stop, check
    // that something visibly marks focus. Keyboard modality matters —
    // :focus-visible only fires for real key events, not element.focus().
    if (pass === "dark-1470") {
      // Text sweep: open every expander on the view — <details> notes and any
      // collapsed toggle (aria-expanded="false") — then keep all visible text
      // for a spelling pass. Collected text lands in text/<stop>.txt.
      await js(`(() => { document.querySelectorAll("details:not([open])").forEach(d => d.open = true);
        document.querySelectorAll('[aria-expanded="false"]:not(.xm-trigger)').forEach(b => { try { b.click(); } catch (e) {} }); return true; })()`);
      await sleep(500);
      await js(`document.querySelectorAll("details:not([open])").forEach(d => d.open = true)`);
      const text = await js("document.body.innerText");
      fs.mkdirSync(path.join(OUT, "text"), { recursive: true });
      fs.writeFileSync(path.join(OUT, "text", name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".txt"), text);
      await js("document.activeElement && document.activeElement.blur && document.activeElement.blur()");
      const seen = new Set();
      for (let i = 0; i < 40; i++) {
        await dbg.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        await dbg.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
        const st = await js(`(() => { const el = document.activeElement; if (!el || el === document.body) return { none: true };
          const cs = getComputedStyle(el);
          const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
          const r = el.getBoundingClientRect();
          return { key: el.tagName + "|" + (el.getAttribute("aria-label") || el.textContent || el.placeholder || "").trim().slice(0, 50), ring, offscreen: r.width < 1 || r.height < 1 };
        })()`);
        if (st.none) continue;
        if (seen.has(st.key)) continue; seen.add(st.key);
        if (!st.ring) findings.push({ pass, stop: name, type: "keyboard focus not visible", text: st.key.split("|")[1] || st.key, detail: st.key.split("|")[0].toLowerCase() });
        if (st.offscreen) findings.push({ pass, stop: name, type: "keyboard focus lands on an invisible element", text: st.key.split("|")[1] || st.key, detail: st.key.split("|")[0].toLowerCase() });
      }
      await js("document.activeElement && document.activeElement.blur && document.activeElement.blur()");
      // What a screen reader actually reads: Chromium's accessibility tree, not
      // the DOM. Any interactive node whose computed name is empty is announced
      // as a bare "button" / "edit text".
      try {
        await dbg.sendCommand("Accessibility.enable");
        const { nodes } = await dbg.sendCommand("Accessibility.getFullAXTree");
        const interactive = new Set(["button", "textbox", "combobox", "checkbox", "radio", "link", "spinbutton", "slider", "switch", "tab", "menuitem", "searchbox", "listbox"]);
        let named = 0;
        nodes.forEach(n => {
          const role = n.role && n.role.value;
          if (!interactive.has(role) || n.ignored) return;
          const nm = (n.name && n.name.value || "").trim();
          if (nm) { named++; return; }
          findings.push({ pass, stop: name, type: "screen reader: control announced with no name", text: role, detail: "AX node " + n.nodeId });
        });
        console.log("ax tree · " + name + ": " + named + " named interactive nodes");
      } catch (e) { console.log("ax tree failed on " + name + ": " + e.message); }
      // Logged so a clean result can be told apart from a walk that never ran.
      console.log("keyboard walk · " + name + ": " + seen.size + " distinct focus stops");
    }
    const m = await dbg.sendCommand("Page.getLayoutMetrics");
    const shot = await dbg.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.ceil(m.cssVisualViewport.clientWidth), height: Math.min(Math.ceil(m.cssContentSize.height), 5000), scale: 1 } });
    fs.writeFileSync(path.join(OUT, "shots", (pass + "-" + name).replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png"), Buffer.from(shot.data, "base64"));
  }

  // One case with two programs, a price, a Monte Carlo run — or, with
  // --sample=stoke|pepgen, one of the finished sample cases, so every chart
  // and tool is checked against a real, fully filled case.
  if (args.sample) {
    await click("Load sample case", 400);
    await click(args.sample === "pepgen" ? "PepGen — DM1, Phase 2" : "Stoke — Dravet, Phase 3", 1500);
    await js(`document.getElementById("casetab-overview") && document.getElementById("casetab-overview").click()`); await sleep(500);
  } else {
    await click("+ New case", 700);
    await js(`__t.setVal(__t.byLabel("Peak worldwide revenue")[0], "1000")`); await sleep(200);
    await js(`__t.setVal(__t.byLabel("Fully diluted shares")[0], "100000000")`); await sleep(200);
    await js(`__t.setVal(document.querySelector('input[aria-label="Case name"]'), "Audit Bio")`); await sleep(200);
    await js(`(() => { const l = [...document.querySelectorAll("span")].find(n => n.textContent.trim() === "Current price"); return __t.setVal(l.parentElement.querySelector("input"), "10"); })()`); await sleep(300);
    await click("+ Add program", 700);
  }
  await click("Run 3,000 trials", 5000);

  const run = async () => { await js(`(() => { document.querySelectorAll("#ts-root .runbtn").forEach(b => b.click()); return true; })()`); await sleep(2200); };
  const visitAll = async () => {
    // The Workspace is five sub-tabs; each is its own stop. Tabs are clicked by
    // id because a tab's text can carry a count badge ("Evidence 3").
    await click("Workspace", 700);
    for (const t of ["overview", "assumptions", "scenarios", "evidence", "calibration", "saved"]) {
      await js(`document.getElementById("casetab-${t}").click()`); await sleep(500);
      await stop("Workspace " + t);
    }
    await js(`document.getElementById("casetab-overview").click()`);
    await click("Tools", 700);
    const tools = [["Trial", ["Trial Decoder", "Compare Trials", "Asset Program", "Trial Explorer", "FDA Lookup"]], ["Science", ["Target Dossier", "Literature"]],
      ["Company", ["Company Lookup", "Catalyst Calendar", "Cash Runway", "Runway vs. Catalyst"]], ["Commercial", ["Launch & Actuals", "Exclusivity / LOE"]],
      ["Valuation", ["Sensitivity", "Binary Event", "Diluted Market Cap"]], ["Benchmarks", ["M&A Premium", "Peak Sales Comps", "Licensing Comps"]]];
    for (const [bench, names] of tools) for (const n of names) {
      await click(bench, 350); await click(n, 700);
      if (n === "Trial Decoder" && !(await js(`/Design flags/i.test(document.body.innerText)`))) {
        await js(`__t.setVal(__t.ph("NCT number"), "NCT03036124")`); await sleep(200); await click("Decode", 300);
        await waitFor(`/Design flags/i.test(document.body.innerText)`, 30000);
        await click("Load what these trials actually reported", 300); await waitFor(`/Safety as reported/i.test(document.body.innerText)`, 30000);
      }
      if (n === "Compare Trials" && !(await js(`!!document.querySelector(".cmp-table")`))) {
        await js(`__t.setVal(document.querySelector('input[aria-label="ClinicalTrials.gov IDs to compare"]'), "NCT06872125, NCT02682927, NCT02091375")`); await sleep(200); await click("Compare 3 trials", 300);
        await waitFor(`!!document.querySelector(".cmp-table")`, 45000);
      }
      await stop("Tools " + n);
    }
    await click("Simulation", 900);
    for (const t of ["Trial Outcome / PoS", "Phase 2→3 Translator", "Meta-Analysis", "Peak Sales", "PK/PD"]) { await click(t, 600); await run(); await stop("Simulation " + t); }
    await click("Trial Statistics", 600);
    for (const t of ["Fragility Index", "Sample Size / Power", "P-value ↔ CI", "Single-Arm CI", "2×2 Outcome Analysis", "Non-Inferiority", "Multiplicity Adjustment"]) { await click(t, 600); await run(); await stop("Simulation " + t); }
    await click("Reference Sheet", 700);
    for (const t of ["How This Works", "Revenue Build", "Cost Structure", "R&D & Timeline", "Probability of Success", "Discount Rate", "Valuation & Dilution", "M&A Comps", "Trial Glossary"]) { await click(t, 500); await stop("Reference " + t); }
    await click("Portfolio", 700); await stop("Portfolio");
    await click("Workspace", 600);
    await js(`[...document.querySelectorAll("button")].find(b => /Generate Report/.test(b.textContent)).click()`); await sleep(1200); await stop("Report");
    await js(`[...document.querySelectorAll("button")].find(b => /PDF bundle/.test(b.title || "")).click()`); await sleep(800); await stop("Bundle");
    await click("← Back", 500);
  };
  const setTheme = async (want) => js(`(() => { const cur = document.documentElement.getAttribute("data-theme"); if (cur !== ${JSON.stringify(want)}) document.querySelector('button[title="Toggle theme"]').click(); return true; })()`);

  for (const [theme, w] of [["dark", 1470], ["light", 1470], ["dark", 900]]) {
    pass = theme + "-" + w;
    win.setSize(w, 920); await setTheme(theme); await sleep(600);
    await visitAll();
  }

  // Summary: counts by type, then the distinct findings per type.
  const byType = {};
  findings.forEach(f => { (byType[f.type] = byType[f.type] || []).push(f); });
  const lines = [];
  Object.keys(byType).sort((a, b) => byType[b].length - byType[a].length).forEach(t => {
    const uniq = {};
    byType[t].forEach(f => { const k = f.text + "|" + (f.detail || "").split(" · ")[0]; (uniq[k] = uniq[k] || { f, n: 0, passes: new Set() }); uniq[k].n++; uniq[k].passes.add(f.pass); });
    lines.push("\n== " + t + " — " + byType[t].length + " occurrences, " + Object.keys(uniq).length + " distinct");
    Object.values(uniq).sort((a, b) => b.n - a.n).slice(0, 40).forEach(u => lines.push("  " + u.n + "×  [" + [...u.passes].join(",") + "] " + u.f.stop + " · " + (u.f.where ? u.f.where + " · " : "") + JSON.stringify(u.f.text) + (u.f.detail ? "  — " + u.f.detail : "")));
  });
  lines.push("\n== console errors: " + consoleErrors.length); [...new Set(consoleErrors)].slice(0, 20).forEach(e => lines.push("  " + e));
  fs.writeFileSync(path.join(OUT, "summary.txt"), lines.join("\n"));
  fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 1));
  console.log(lines.join("\n").slice(0, 20000));
  app.exit(0);
});
