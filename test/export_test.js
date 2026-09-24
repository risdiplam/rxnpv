// ════════════════════════════════════════════════════════════════════════════
// SECTION EXPORT — serialiser and sanitiser
//
// Runs the real bundle in jsdom. jsdom does no layout (every scrollHeight is
// 0), so the scroll-box expansion and width calculation are verified live in
// Electron instead — see the Phase 29 tracker entry. What IS checked here is
// everything that does not depend on layout: form state carried across,
// export chrome removed, truncated text restored, and — the part that matters
// most, because snapshots are stored and rendered back later — that nothing
// executable or remote survives sanitising.
// ════════════════════════════════════════════════════════════════════════════
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html", "utf8");
const errors = [];
let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) pass++; else { fail++; console.log("  ✗ " + label); } };

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://localhost/",
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.console.error = (...a) => errors.push(a.join(" ").slice(0, 200));
    w.fetch = async () => ({ ok: false, status: 404 });
  } });

(async () => {
  await new Promise(r => setTimeout(r, 1200));
  const w = dom.window, d = w.document;

  // ── Form state ──
  // Values live in properties, not attributes, so without this every input
  // in an export would show its initial value rather than what was typed.
  const box = d.createElement("div");
  box.setAttribute("data-export-section", "Inputs");
  box.innerHTML = '<input type="text" value="old"><input type="checkbox"><select><option value="a">A</option><option value="b">B</option></select><textarea>old</textarea>';
  d.body.appendChild(box);
  box.querySelector('input[type=text]').value = "typed value";
  box.querySelector('input[type=checkbox]').checked = true;
  box.querySelector('select').value = "b";
  box.querySelector('textarea').value = "typed note";
  const s1 = w.serializeSection(box);
  ok("serialisation succeeds", s1.ok === true);
  ok("a typed text value is carried into the export", /value="typed value"/.test(s1.html));
  ok("a ticked checkbox exports ticked", /type="checkbox"[^>]*checked/.test(s1.html) || /checked=""[^>]*type="checkbox"/.test(s1.html));
  ok("the chosen select option exports as selected", /<option value="b" selected/.test(s1.html));
  ok("a textarea exports its typed content", />typed note<\/textarea>/.test(s1.html));
  ok("the declared section name is used as the title", s1.title === "Inputs");

  // ── Export chrome and truncation ──
  const card = d.createElement("div");
  card.setAttribute("data-export-section", "Card");
  card.innerHTML = '<div data-no-export>EXPORT PNG PDF</div><p>Body</p><span data-full-text="A very long trial title that was cut">A very long…</span>';
  d.body.appendChild(card);
  const s2 = w.serializeSection(card);
  ok("the export bar never appears inside an export", s2.html.indexOf("EXPORT PNG PDF") === -1);
  ok("ordinary content is kept", s2.html.indexOf("<p>Body</p>") !== -1);
  ok("truncated text is restored to its full form", s2.html.indexOf("A very long trial title that was cut") !== -1 && s2.html.indexOf("A very long…") === -1);
  ok("the live page is not modified by exporting it", card.querySelector("[data-no-export]") !== null);

  // ── Sanitiser ──
  // Snapshots are stored and rendered back into the report, so nothing that
  // could run or fetch may survive — at capture, and again at render.
  const nasty = '<div onclick="steal()" style="color:red">text</div>'
    + '<script>steal()</script><iframe src="https://evil.example"></iframe>'
    + '<img src="https://tracker.example/p.gif" onerror="steal()">'
    + '<img src="data:image/png;base64,iVBOR">'
    + '<a href="javascript:steal()">bad link</a><a href="https://clinicaltrials.gov/study/NCT1">good link</a>'
    + '<svg><a xlink:href="javascript:steal()"><text>x</text></a></svg>'
    + '<div style="width: expression(steal())">ie</div><object data="x"></object><meta http-equiv="refresh" content="0">';
  const clean = w.sanitizeSnapshotHtml(nasty);
  ok("script elements are removed", !/<script/i.test(clean));
  ok("iframes are removed", !/<iframe/i.test(clean));
  ok("object elements are removed", !/<object/i.test(clean));
  ok("meta refresh is removed", !/<meta/i.test(clean));
  ok("inline event handlers are stripped", !/onclick|onerror/i.test(clean));
  ok("a javascript: link is stripped", !/javascript:/i.test(clean));
  ok("a remote image source is stripped", clean.indexOf("tracker.example") === -1);
  ok("an embedded data: image is kept", clean.indexOf("data:image/png;base64,iVBOR") !== -1);
  ok("an ordinary https link is kept, so PDFs keep working links", clean.indexOf('href="https://clinicaltrials.gov/study/NCT1"') !== -1);
  ok("a CSS expression() is stripped", !/expression\s*\(/i.test(clean));
  ok("ordinary inline styling survives", /style="color:red"/.test(clean));
  ok("text content survives sanitising", clean.indexOf(">text<") !== -1 && clean.indexOf("good link") !== -1);
  ok("sanitising an empty input returns an empty string", w.sanitizeSnapshotHtml("") === "");

  // ── Titles ──
  const untitled = d.createElement("div");
  untitled.innerHTML = "<h3>Company P&amp;L — costs applied</h3><p>body</p>";
  ok("an undeclared section falls back to its heading", w.sectionTitleOf(untitled) === "Company P&L — costs applied");
  const badged = d.createElement("div");
  badged.innerHTML = '<h2>Trial-outcome assurance (Bayesian PoS)<span class="badge info">→ Forward-looking</span></h2>';
  ok("a heading's badge is not part of the title", w.sectionTitleOf(badged) === "Trial-outcome assurance (Bayesian PoS)");
  // Meta-Analysis: heading, then a description, then the headingless panel.
  // Only the immediately-preceding sibling used to be checked, and the
  // fallback then read the panel's own (uppercase-rendered) export row.
  const host = d.createElement("div");
  host.innerHTML = '<h2>Meta-Analysis<span class="badge">↔</span></h2><p class="subtle">Pools studies.</p><div class="panel"><div class="section-export-bar">EXPORT SECTION · x</div><p>body</p></div>';
  d.body.appendChild(host);
  ok("a headingless panel takes the heading above its description", w.sectionTitleOf(host.querySelector(".panel")) === "Meta-Analysis");
  host.remove();
  const rowFirst = d.createElement("div");
  // innerText is what the live fallback reads; jsdom has none, so stand one in
  // with the uppercase text a real renderer returns.
  Object.defineProperty(rowFirst, "innerText", { value: "EXPORT SECTION · Export section · x\nPNG\nPDF\nPooled estimate" });
  ok("an uppercase-rendered export row is never read back as the title", w.sectionTitleOf(rowFirst) === "Pooled estimate");
  const inner = d.createElement("span"); card.appendChild(inner);
  ok("a control finds the section it sits inside", w.closestExportSection(inner) === card);

  // ── Storage encoding ──
  // jsdom has no CompressionStream, so this exercises the plain fallback. The
  // gzip path is verified live in Electron.
  const packed = await w.compressSnapshotText("<p>hello</p>");
  ok("without streams the text is stored plain and marked so", packed.enc === "plain" && packed.data === "<p>hello</p>");
  ok("a plain snapshot reads back unchanged", (await w.decompressSnapshotText(packed.enc, packed.data)) === "<p>hello</p>");

  console.log("\n" + (fail === 0 ? "ALL EXPORT CHECKS PASSED — " + pass + " checks" : pass + " passed, " + fail + " FAILED"));
  console.log("Errors: " + errors.length);
  errors.slice(0, 5).forEach(e => console.log("  " + e));
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
})();
