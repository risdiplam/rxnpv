// Fill a case through the packaged app's own inputs, then check what it stored.
//
//   $E test/packaged/case_fill.js --app=/Applications/RxNPV.app --plan=<plan.json> --out=<dir>
//
// A plan is a list of steps a person would take: open a tab, press a button,
// type into a field found by its label, tick a box, pick an option, add an
// Evidence Log or Calibration entry through its form. After the last step the
// harness reads the case back out of localStorage and checks every
// `expect` against it — so a field that silently fails to save, saves in the
// wrong unit ($M typed, dollars stored), or lands on the wrong key is caught.
// It also writes the stored case to <out>/case.json and a screenshot of every
// Workspace tab.
//
// Step types:
//   { "tab": "assumptions" }                     open a Workspace tab
//   { "click": "Full model", "prefix": true }    press a button by its text
//   { "set": "Discount rate (%)", "value": "14", "nth": 0 }   type into a field
//   { "check": "Include ex-US revenue", "value": true }        tick / untick
//   { "select": "Therapeutic area", "value": "Neurology" }
//   { "setPlaceholder": "e.g. Phase 3 initiation", "value": "…" }  a field labelled only by its placeholder
//   { "header": "name" | "ticker" | "price", "value": "…" }
//   { "openAll": true }                           expand every collapsed card
//   { "wait": 500 }
//   { "expectNow": "programs.0.x", "value": … }  check a stored value mid-plan
//   { "clickLabel": "Delete this milestone" }   (a button by its aria-label)
//   { "evidence": { label, classification, confidence, source, date, thesis } }
//   { "calibration": { catalystLabel, catalystDate, yourPoS, marketImpliedPoS, outcome, notes } }
//   { "editEvidence": "<label of an existing entry>", "evidence": { …fields to set } }  (its Edit button)
//   { "editCalibration": "<catalyst label of an existing entry>", "calibration": { … } }
//
// --userdata=<dir> runs on that profile (e.g. the user's real data, backed up
// first) and leaves the theme alone; --case="<name>" opens that existing case
// instead of starting a new one, and the read-back finds it by that name
// (--readname="<name>" if the plan renames it). --minutes=N raises the time limit.
//   { "expect": "programs.0.revenueBuild.population.prevalence", "value": "40000" }
// A field is found by: its aria-label, else the text of the <label> around
// it, else the text just above it — the same way a person reads the form.
const { app, BrowserWindow } = require("electron");
const path = require("path"), fs = require("fs"), os = require("os");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v == null ? true : v]));
const appPath = args.app || "/Applications/RxNPV.app";
const plan = JSON.parse(fs.readFileSync(args.plan, "utf8"));
const OUT = args.out || fs.mkdtempSync(path.join(os.tmpdir(), "rx-fill-"));
fs.mkdirSync(OUT, { recursive: true });
app.setPath("userData", args.userdata ? path.resolve(String(args.userdata)) : fs.mkdtempSync(path.join(os.tmpdir(), "rx-fill-profile-")));
const sleep = ms => new Promise(r => setTimeout(r, ms));
setTimeout(() => { console.error("timed out"); app.exit(2); }, (Number(args.minutes) || 10) * 60000);
const READ_NAME = args.readname || args.case || null;
// The case the plan works on: the named one, else the newest.
const pickCase = `(cs => ${READ_NAME ? `cs.find(c => c.name === ${JSON.stringify(String(READ_NAME))})` : `cs[cs.length - 1]`})`;

// Runs in the page: find a visible field by its label and act on it.
const PAGE_HELPERS = `
window.__f = {
  labelOf(el) {
    let l = el.getAttribute("aria-label") || "";
    if (!l) { const lab = el.closest("label"); if (lab) l = lab.textContent.trim(); }
    if (!l) { const p = el.parentElement && el.parentElement.parentElement; const t = p && p.querySelector("span, div"); l = t ? t.textContent.trim() : ""; }
    return l.replace(/\\s+/g, " ").trim();
  },
  visible(el) { return el.offsetParent !== null && !el.closest("[data-no-export]") && !el.closest(".xm-menu"); },
  find(label, nth) {
    const all = [...document.querySelectorAll("input, select, textarea")].filter(e => this.visible(e));
    const hits = all.filter(e => this.labelOf(e) === label);
    const loose = hits.length ? hits : all.filter(e => this.labelOf(e).indexOf(label) === 0);
    return loose[nth || 0] || null;
  },
  setValue(el, v) {
    const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  },
  button(text, prefix) {
    // Visible buttons first; a control on a hidden tab still works when pressed.
    const all = [...document.querySelectorAll("button")].filter(b => !b.closest(".xm-menu"));
    const match = b => { const t = b.textContent.replace(/\\s+/g, " ").trim(); return prefix ? t.indexOf(text) === 0 : t === text; };
    return all.filter(b => b.offsetParent !== null).find(match) || all.find(match) || null;
  },
  openAll() {
    let n = 0;
    document.querySelectorAll("[aria-expanded=false]").forEach(b => { if (!b.closest(".xm-menu") && !b.closest("[data-no-export]") && b.offsetParent !== null) { b.click(); n++; } });
    document.querySelectorAll("details:not([open])").forEach(d => { if (d.offsetParent !== null || d.parentElement.offsetParent !== null) { d.open = true; n++; } });
    return n;
  }
}; true;`;

app.whenReady().then(async () => {
  const problems = [];
  try {
    require(path.join(appPath, "Contents/Resources/app.asar/main.js"));
    let w; while (!(w = BrowserWindow.getAllWindows()[0])) await sleep(100);
    await new Promise(r => w.webContents.isLoading() ? w.webContents.once("did-finish-load", r) : r());
    const js = c => w.webContents.executeJavaScript(c, true);
    const dbg = w.webContents.debugger; dbg.attach("1.3");
    const errs = []; w.webContents.on("console-message", (e) => { if (e.level === "error") errs.push(String(e.message).slice(0, 200)); });
    w.setSize(1470, 1000); await sleep(500);
    if (!args.userdata) { await js(`localStorage.setItem("rxnpv_theme", "light"); location.reload()`); await sleep(1800); }
    else await sleep(1500);
    await js(PAGE_HELPERS);
    const started = args.case
      ? await js(`(() => { const b = [...document.querySelectorAll("button, [role=button]")].filter(x => x.offsetParent !== null).find(x => x.textContent.trim().indexOf(${JSON.stringify(String(args.case))}) === 0); if (!b) return "no case named " + ${JSON.stringify(String(args.case))}; b.click(); return true; })()`)
      : await js(`(() => { try { const b = __f.button("+ New case"); if (!b) return "no + New case button; buttons: " + [...document.querySelectorAll("button")].map(x => JSON.stringify(x.textContent.trim())).slice(0, 12).join(","); b.click(); return true; } catch (e) { return "error: " + e.message; } })()`);
    if (started !== true) throw new Error("could not start a case: " + started);
    await sleep(1200);
    let n = 0;
    for (const st of plan.steps) {
      n++;
      const where = "step " + n + " " + JSON.stringify(st).slice(0, 90);
      let r = true;
      try {
      if (st.tab) { r = await js(`(() => { const t = document.getElementById("casetab-${st.tab}"); if (t) t.click(); return !!t; })()`); await sleep(700); }
      else if (st.click) { r = await js(`(() => { const b = __f.button(${JSON.stringify(st.click)}, ${!!st.prefix}); if (b) b.click(); return !!b; })()`); await sleep(st.after || 600); }
      else if (st.clickLabel) { r = await js(`(() => { const b = [...document.querySelectorAll("button")].filter(x => x.offsetParent !== null).find(x => x.getAttribute("aria-label") === ${JSON.stringify(st.clickLabel)}); if (b) b.click(); return !!b; })()`); await sleep(st.after || 400); }
      else if (st.openAll) { for (let i = 0; i < 3; i++) { await js(`__f.openAll()`); await sleep(400); } }
      else if (st.wait) await sleep(st.wait);
      else if (st.header) {
        const sel = st.header === "name" ? `document.querySelector('input[aria-label="Case name"]')` : st.header === "ticker" ? `document.querySelector('input[aria-label="Ticker symbol"]')`
          : `[...document.querySelectorAll("input[type=number]")].find(i => [...i.parentElement.children].some(c => c.tagName === "SPAN" && c.textContent.trim() === "Current price"))`;
        r = await js(`(() => { const el = ${sel}; if (!el) return false; __f.setValue(el, ${JSON.stringify(st.value)}); return true; })()`); await sleep(250);
      }
      else if (st.set != null && !st.paste) {
        // Typed one key at a time into the focused field — a whole-value set
        // cannot see a field that rewrites itself between keystrokes.
        const found = await js(`(() => { const el = __f.find(${JSON.stringify(st.set)}, ${st.nth || 0}); if (!el) return false; el.scrollIntoView({ block: "center" }); el.focus(); el.select && el.select(); return true; })()`);
        if (!found) r = false;
        else {
          await sleep(60);
          await dbg.sendCommand("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
          await dbg.sendCommand("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
          for (const ch of String(st.value)) { await dbg.sendCommand("Input.insertText", { text: ch }); await sleep(25); }
          await sleep(120);
          r = await js(`(() => { const el = __f.find(${JSON.stringify(st.set)}, ${st.nth || 0}); const v = el && el.value; if (el) el.blur(); return v === ${JSON.stringify(String(st.value))} || "field shows " + JSON.stringify(v); })()`);
          await sleep(st.after || 150);
        }
      }
      else if (st.set != null || st.select != null) {
        const label = st.set != null ? st.set : st.select;
        r = await js(`(() => { const el = __f.find(${JSON.stringify(label)}, ${st.nth || 0}); if (!el) return false; __f.setValue(el, ${JSON.stringify(String(st.value))}); return el.value === ${JSON.stringify(String(st.value))} || "value is " + el.value; })()`); await sleep(st.after || 220);
      }
      else if (st.setPlaceholder) {
        r = await js(`(() => { const el = [...document.querySelectorAll("input, textarea")].filter(e => __f.visible(e)).find(e => e.placeholder === ${JSON.stringify(st.setPlaceholder)}); if (!el) return false; __f.setValue(el, ${JSON.stringify(String(st.value))}); return true; })()`); await sleep(180);
      }
      else if (st.check != null) {
        r = await js(`(() => { const el = __f.find(${JSON.stringify(st.check)}, ${st.nth || 0}); if (!el) return false; if (el.checked !== ${!!st.value}) el.click(); return true; })()`); await sleep(st.after || 400);
      }
      else if (st.evidence || st.calibration) {
        const e = st.evidence || st.calibration;
        const isEv = !!st.evidence;
        const editing = st.editEvidence || st.editCalibration || null;
        r = await js(`(async () => {
          const wait = ms => new Promise(r => setTimeout(r, ms));
          ${editing ? `
          // An existing entry: its Edit button, found by the entry's own title.
          const titleEl = [...document.querySelectorAll("div")].filter(x => x.offsetParent !== null && x.children.length === 0).find(x => x.textContent.trim() === ${JSON.stringify(String(editing))});
          if (!titleEl) return "no entry titled " + ${JSON.stringify(String(editing))};
          let box = titleEl; while (box && !box.querySelector("button")) box = box.parentElement;
          const edit = box && [...box.querySelectorAll("button")].find(b => b.textContent.trim() === "Edit");
          if (!edit) return "no Edit button by " + ${JSON.stringify(String(editing))};
          edit.click(); await wait(300);` : `
          const btn = __f.button(${JSON.stringify(isEv ? "+ Add evidence" : "+ Add prediction")}); if (!btn) return "no add button"; btn.click(); await wait(300);`}
          const byPh = ph => [...document.querySelectorAll("input, textarea")].filter(x => __f.visible(x)).find(x => x.placeholder === ph);
          const e = ${JSON.stringify(e)};
          ${isEv ? `
          const put = (el, v) => { if (v != null && el) __f.setValue(el, String(v)); };
          put(byPh("e.g. PoS override, peak share"), e.label);
          put(document.querySelector('select[aria-label="Classification"]'), e.classification);
          put(document.querySelector('select[aria-label="Confidence"]'), e.confidence);
          put(byPh("URL, filing, DOI, etc."), e.source);
          put(byPh("e.g. 2026-08-17"), e.date);
          put(byPh("The actual reasoning — what the source supports, and the main uncertainty if this isn't a plain Fact."), e.thesis);` : `
          const put = (el, v) => { if (v != null && el) __f.setValue(el, String(v)); };
          put(byPh("e.g. Phase 2 readout"), e.catalystLabel);
          put(byPh("e.g. 2026-Q4"), e.catalystDate);
          put(document.querySelector('select[aria-label="Outcome"]'), e.outcome || (${!!editing} ? null : "pending"));
          put(byPh("e.g. 40"), e.yourPoS);
          put(byPh("from Implied PoS above"), e.marketImpliedPoS);
          put(byPh("Anything worth remembering about this call."), e.notes);`}
          await wait(200);
          const save = [...document.querySelectorAll("button")].filter(b => b.offsetParent !== null).reverse().find(b => /^(Save|Add|Save entry|Add entry|Save prediction)$/.test(b.textContent.trim()));
          if (!save) return "no save button"; save.click(); await wait(300); return true;
        })()`);
      }
      else if (st.expectNow) {
        // Checked at this point in the plan, for a value a later step changes.
        await sleep(400);
        const cs = JSON.parse(await js(`localStorage.getItem("rxnpv_cases_v1")`) || "[]");
        const got = st.expectNow.split(".").reduce((o, k) => (o == null ? undefined : o[k]), eval(pickCase)(cs));
        r = JSON.stringify(got) === JSON.stringify(st.value) || "stored " + JSON.stringify(got) + ", expected " + JSON.stringify(st.value);
      }
      else if (st.expect) continue;
      } catch (e) { r = "threw: " + String(e.message).slice(0, 120); }
      if (r !== true) problems.push(where + " → " + r);
    }
    await sleep(1200);
    const cases = JSON.parse(await js(`localStorage.getItem("rxnpv_cases_v1")`) || "[]");
    const theCase = eval(pickCase)(cases);
    fs.writeFileSync(path.join(OUT, "case.json"), JSON.stringify(theCase, null, 1));
    const get = (obj, p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
    let checked = 0;
    for (const st of plan.steps.filter(s => s.expect)) {
      checked++;
      const got = get(theCase, st.expect);
      const ok = st.approx != null ? Math.abs(Number(got) - Number(st.value)) <= st.approx : JSON.stringify(got) === JSON.stringify(st.value);
      if (!ok) problems.push("expected " + st.expect + " = " + JSON.stringify(st.value) + ", stored " + JSON.stringify(got));
    }
    // A screenshot of every tab, full height, for review.
    for (const tab of ["overview", "assumptions", "scenarios", "evidence", "calibration", "saved"]) {
      await js(`document.getElementById("casetab-${tab}") && document.getElementById("casetab-${tab}").click()`); await sleep(1500);
      if (tab === "overview") { await js(`(() => { const b = __f.button("Run 3,000 trials", true); if (b) b.click(); })()`); await sleep(5000); }
      await js("scrollTo(0,0)"); await sleep(300);
      const h = Math.min(16000, await js("document.documentElement.scrollHeight"));
      const s = await dbg.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1470, height: h, scale: 0.6 } });
      fs.writeFileSync(path.join(OUT, "tab-" + tab + ".png"), Buffer.from(s.data, "base64"));
    }
    console.log((plan.steps.length - checked) + " actions, " + checked + " stored values checked, " + problems.length + " problem(s), " + errs.length + " console error(s)");
    problems.forEach(p => console.log("  PROBLEM " + p));
    errs.slice(0, 10).forEach(e => console.log("  CONSOLE " + e));
    console.log("case and screenshots: " + OUT);
  } catch (e) { console.error("ERR", e.stack); }
  app.exit(problems.length ? 1 : 0);
});
