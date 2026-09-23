// Regression tests for the September 2026 Muse audit (docs/RxNPV_MUSE_AUDIT.md).
//
// One section per finding, each written to FAIL on f49689f (the audited tree)
// and pass once the finding is fixed. Engine math with hand-derived expected
// values lives in math_verification.js as usual; this file covers what needs
// the running UI — a field's display/stored/used round trip, a rendered
// denominator, a stale async result that must not paint.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(__dirname + "/test_desktop.html", "utf8");
const errors = [];
let checks = 0;
const ok = (cond, what) => { checks++; if (!cond) errors.push("FAIL: " + what); };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.warn = (...a) => { const s = a.join(" "); if (!s.includes("EDGAR")) errors.push("WARN: " + s.slice(0, 200)); };
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
  const inputsByLabel = t => [...d.querySelectorAll("input")].filter(i => { const o = i.parentElement && i.parentElement.parentElement; return o && o.children[0] && o.children[0].textContent.includes(t); });
  const stored = () => JSON.parse(w.localStorage.getItem("rxnpv_cases_v1") || "[]")[0];

  click(btn("+ New case")); await wait(400);
  setVal(inputsByLabel("Peak worldwide revenue")[0], "1000"); await wait(150);
  setVal(inputsByLabel("Fully diluted shares")[0], "100000000"); await wait(200);

  // ── FIN-001 — Bear/Bull peak-revenue override: display = stored = used ──
  // The field is labelled $M. Typing 1000 means $1,000M = $1,000,000,000,
  // which is how quickRevenue.peakRevenue is stored and what the engine reads.
  // On f49689f the field then displayed "1000000000" beside "$M", and typing
  // over it multiplied by 1e6 again.
  {
    const header = [...d.querySelectorAll("div")].find(n => n.textContent.trim() === "Edit Bear / Bull assumptions");
    click(header); await wait(300);
    const field = () => inputsByLabel("peak revenue override")[0];
    ok(!!field(), "FIN-001: the Bear peak-revenue override field is present");
    setVal(field(), "1000"); await wait(250);
    const bear = () => stored().programs[0].quickRevenue.scenarioOverrides.bear.peakRevenue;
    ok(bear() === "1000000000", "FIN-001: typing 1000 ($M) stores $1,000,000,000 (got " + bear() + ")");
    ok(field().value === "1000", "FIN-001: the field reads back 1000, not the stored dollars (got " + field().value + ")");
    // Editing what the field shows — here, typing a 0 on the end — must scale
    // the assumption by exactly 10. On f49689f the field showed 1000000000, so
    // the same keystroke stored 10000000000 × 1e6 = $1e16.
    setVal(field(), field().value + "0"); await wait(250);
    ok(bear() === "10000000000", "FIN-001: appending a digit to the displayed value gives $10,000M, not a compounded figure (got " + bear() + ")");
    ok(field().value === "10000", "FIN-001: and the field reads 10000");
    setVal(field(), "1500"); await wait(250);
    ok(bear() === "1500000000", "FIN-001: a new value of 1500 stores $1.5B (got " + bear() + ")");
    // Used: the Bear valuation's peak revenue is the override, not a multiple of Base.
    const c = stored();
    const pv = w.computeProgramValuation(c.programs[0], w.getEffectiveScenarioPreset(c, "bear"), "bear");
    ok(Math.abs(pv.peakRevenue - 1.5e9) < 1, "FIN-001: the engine values Bear at $1,500M peak (got " + pv.peakRevenue + ")");
    setVal(field(), ""); await wait(250);
    ok(bear() === "", "FIN-001: clearing the field clears the override");
  }

  if (errors.length) { console.log(errors.slice(0, 40).join("\n")); console.log("\n" + errors.length + " FAILURE(S) across " + checks + " checks"); process.exit(1); }
  console.log("ALL AUDIT REGRESSION CHECKS PASSED — " + checks + " checks");
  process.exit(0);
})();
