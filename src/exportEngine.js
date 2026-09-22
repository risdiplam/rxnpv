// ════════════════════════════════════════════════════════════════════════════
// RxNPV — EXPORT ENGINE
//
// Three ways to get a visual out of the app, each using the mechanism that's
// actually right for it rather than forcing one approach everywhere:
//
//   1. SVG  — every chart in this app is inline SVG, so serialising it gives a
//             true vector file: infinitely scalable, tiny, editable in
//             Illustrator/Figma. The best option when it applies.
//   2. PNG  — the same SVG rasterised through a canvas at an arbitrary scale
//             factor (default 3x), for slide decks and anywhere vector isn't
//             accepted.
//   3. Panel capture — Chromium's own compositor via the desktop bridge, for
//             a whole tool panel including its text, tables and layout. Only
//             this one can capture things that aren't SVG.
//
// ── The load-bearing detail: CSS custom properties ──────────────────────────
// Every chart colour in this app is written as var(--teal) / var(--ink-1) etc.
// Those resolve against :root inside the running document. A serialised SVG
// has no :root, so opened as a standalone file EVERY var() reference collapses
// to its fallback — which is nothing — and the chart renders as black shapes
// on transparent, or vanishes entirely. So before serialising we walk the
// cloned tree and bake every var() reference down to the concrete colour the
// browser actually computed. Same reason fonts get inlined as literal family
// names. This is why the exporter clones rather than serialising in place.
// ════════════════════════════════════════════════════════════════════════════

// Attributes that can legitimately carry a var() reference in these charts.
const EXPORT_STYLED_ATTRS = ["fill", "stroke", "stop-color", "color"];
// Presentation attributes worth copying off the computed style so the standalone
// file keeps its typography instead of falling back to a default serif.
const EXPORT_COMPUTED_PROPS = ["font-family", "font-size", "font-weight", "text-anchor", "opacity", "fill-opacity", "stroke-opacity", "stroke-width"];
// Elements that either contain other elements or are stroke-only — copying a
// computed fill onto these is never useful and is actively misleading.
const EXPORT_NON_PAINTED_TAGS = new Set(["svg", "g", "defs", "clippath", "lineargradient", "radialgradient", "stop", "line", "title", "desc"]);

function resolveCssVar(value, computedRoot) {
  if (typeof value !== "string" || value.indexOf("var(") === -1) return value;
  // Handles both var(--x) and var(--x, fallback), including nesting one deep,
  // which is all these charts ever use.
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (match, name, fallback) => {
    const resolved = computedRoot.getPropertyValue(name).trim();
    if (resolved) return resolved;
    return (fallback || "").trim() || "#000000";
  });
}

// Returns a detached <svg> clone with all styling baked in, safe to serialise.
function inlineSvgStyles(sourceSvg) {
  const clone = sourceSvg.cloneNode(true);
  const computedRoot = getComputedStyle(document.documentElement);
  const srcNodes = [sourceSvg, ...sourceSvg.querySelectorAll("*")];
  const dstNodes = [clone, ...clone.querySelectorAll("*")];

  for (let i = 0; i < srcNodes.length; i++) {
    const src = srcNodes[i], dst = dstNodes[i];
    if (!src || !dst || !dst.setAttribute) continue;
    const cs = getComputedStyle(src);

    EXPORT_STYLED_ATTRS.forEach(attr => {
      const attrVal = dst.getAttribute(attr);
      if (attrVal && attrVal.indexOf("var(") !== -1) {
        dst.setAttribute(attr, resolveCssVar(attrVal, computedRoot));
      } else if (attrVal == null && !EXPORT_NON_PAINTED_TAGS.has(String(dst.tagName).toLowerCase())) {
        // A colour can also arrive via CSS rather than an attribute, so fall
        // back to the computed value — but skip containers and stroke-only
        // shapes. getComputedStyle().fill returns the CSS initial value
        // rgb(0,0,0) for anything that never set one, so copying blindly
        // stamps a black fill onto <svg>, <g> and <line>. Harmless today
        // (children set their own fill; lines aren't filled) but it bloats
        // the file and would genuinely break a future filled shape that
        // relied on inheritance.
        const computed = cs.getPropertyValue(attr);
        if (computed && computed !== "none" && computed !== "rgba(0, 0, 0, 0)") {
          dst.setAttribute(attr, computed);
        }
      }
    });

    EXPORT_COMPUTED_PROPS.forEach(prop => {
      const existing = dst.getAttribute(prop);
      if (existing && existing.indexOf("var(") !== -1) {
        dst.setAttribute(prop, resolveCssVar(existing, computedRoot));
      } else if (!existing && (prop === "font-family" || prop === "font-size") && dst.tagName === "text") {
        const computed = cs.getPropertyValue(prop);
        if (computed) dst.setAttribute(prop, computed);
      }
    });

    // Inline style attributes can carry var() too.
    const styleAttr = dst.getAttribute("style");
    if (styleAttr && styleAttr.indexOf("var(") !== -1) {
      dst.setAttribute("style", resolveCssVar(styleAttr, computedRoot));
    }
  }
  return clone;
}

// Serialise to a standalone SVG document string.
function svgToStandaloneString(sourceSvg, opts) {
  opts = opts || {};
  const clone = inlineSvgStyles(sourceSvg);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // A viewBox-only SVG has no intrinsic size; give it explicit width/height so
  // it opens at a sensible size instead of collapsing in some viewers.
  const vb = (clone.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const w = vb.length === 4 && vb[2] ? vb[2] : (sourceSvg.clientWidth || 800);
  const h = vb.length === 4 && vb[3] ? vb[3] : (sourceSvg.clientHeight || 400);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);

  // Charts are drawn for a dark or light app background and mostly use
  // transparent fills, so without an explicit backdrop a light-theme export
  // opened on a white page can lose its lightest strokes entirely.
  if (opts.background !== "transparent") {
    const bg = opts.background || getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", vb[0] || 0); rect.setAttribute("y", vb[1] || 0);
    rect.setAttribute("width", w); rect.setAttribute("height", h);
    rect.setAttribute("fill", bg);
    clone.insertBefore(rect, clone.firstChild);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

// Rasterise the same standalone SVG to a PNG data URL at `scale`x.
function svgToPngDataUrl(sourceSvg, scale, opts) {
  scale = scale || 3;
  return new Promise((resolve, reject) => {
    let svgString;
    try { svgString = svgToStandaloneString(sourceSvg, opts); } catch (e) { reject(e); return; }
    const vb = (sourceSvg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    const w = vb.length === 4 && vb[2] ? vb[2] : (sourceSvg.clientWidth || 800);
    const h = vb.length === 4 && vb[3] ? vb[3] : (sourceSvg.clientHeight || 400);
    // A blob URL rather than a data: URL — Safari/Chromium both refuse to load
    // large data: URLs into an <img>, and these can exceed that limit.
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not rasterise the chart.")); };
    img.src = url;
  });
}

// ── Saving ─────────────────────────────────────────────────────────────────
// Desktop gets a real Save dialog through the IPC bridge; a plain browser open
// of the built file falls back to an anchor download so the feature still
// works rather than silently doing nothing.
const isDesktopExport = () => typeof window !== "undefined" && window.electronAPI && window.electronAPI.isDesktop;

async function saveTextAsset(text, suggestedName, filterName, extensions) {
  if (isDesktopExport() && window.electronAPI.saveAsset) {
    return await window.electronAPI.saveAsset({ data: text, encoding: "utf8", suggestedName, filterName, extensions });
  }
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = suggestedName; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, viaBrowser: true };
}

async function saveDataUrlAsset(dataUrl, suggestedName, filterName, extensions) {
  if (isDesktopExport() && window.electronAPI.saveAsset) {
    return await window.electronAPI.saveAsset({ data: dataUrl, encoding: "dataurl", suggestedName, filterName, extensions });
  }
  const a = document.createElement("a");
  a.href = dataUrl; a.download = suggestedName; document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  return { ok: true, viaBrowser: true };
}

function slugifyExportName(s) {
  return String(s || "export").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";
}

// ── Public entry points ────────────────────────────────────────────────────
// Each takes the DOM element the user pointed at (a chart wrapper or a whole
// panel) and figures out what's exportable inside it.
function findExportableSvg(container) {
  if (!container) return null;
  if (container.tagName && container.tagName.toLowerCase() === "svg") return container;
  return container.querySelector("svg");
}

async function exportChartAsSvg(container, name) {
  const svg = findExportableSvg(container);
  if (!svg) return { ok: false, error: "No chart found to export here." };
  const text = svgToStandaloneString(svg);
  return await saveTextAsset(text, slugifyExportName(name) + ".svg", "SVG image", ["svg"]);
}

// Vector PDF of one chart. Desktop only, and the button is hidden otherwise
// rather than failing on click — a browser renderer genuinely cannot write a
// PDF, so there is nothing to fall back to.
async function exportChartAsPdf(container, name) {
  const svg = findExportableSvg(container);
  if (!svg) return { ok: false, error: "No chart found to export here." };
  if (!isDesktopExport() || !window.electronAPI.exportChartPdf) {
    return { ok: false, error: "PDF export needs the desktop app — it uses Chromium's print engine, which a browser page has no access to." };
  }
  const text = svgToStandaloneString(svg);
  // Dimensions come from the same viewBox the serialiser just wrote, so the
  // page matches the chart's aspect exactly.
  const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  const widthPx = (vb.length === 4 && vb[2]) ? vb[2] : (svg.clientWidth || 800);
  const heightPx = (vb.length === 4 && vb[3]) ? vb[3] : (svg.clientHeight || 400);
  return await window.electronAPI.exportChartPdf({
    svg: text, suggestedName: slugifyExportName(name) + ".pdf", widthPx, heightPx
  });
}

async function exportChartAsPng(container, name, scale) {
  const svg = findExportableSvg(container);
  if (!svg) return { ok: false, error: "No chart found to export here." };
  try {
    const dataUrl = await svgToPngDataUrl(svg, scale || 3);
    return await saveDataUrlAsset(dataUrl, slugifyExportName(name) + ".png", "PNG image", ["png"]);
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Pin to report ──────────────────────────────────────────────────────────
// Simulation and Tools results are computed on demand and live only on screen
// — the PDF report could therefore only ever contain Workspace/valuation
// content, even though a trial-statistics result or a comp lookup is often the
// evidence a valuation rests on. Pinning captures the rendered panel and
// stores it on the case, so the report can include analyses from any section.
//
// Capped and downscaled on purpose: these are persisted in localStorage
// alongside the user's cases, and an uncapped pile of full-resolution PNGs
// would consume the quota the cases themselves need.
const PINNED_MAX_PER_CASE = 12;
const PINNED_CAPTURE_MAX_WIDTH = 900;

async function capturePanelDataUrl(container, maxWidth) {
  if (!isDesktopExport() || !window.electronAPI.capturePanelData) {
    return { ok: false, error: "Pinning a result needs the desktop app (it captures the rendered panel)." };
  }
  if (!container) return { ok: false, error: "Nothing to capture." };
  const r = container.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { ok: false, error: "Nothing visible to capture — scroll the result into view first." };
  return await window.electronAPI.capturePanelData(
    { x: r.left, y: r.top, width: r.width, height: r.height },
    maxWidth || PINNED_CAPTURE_MAX_WIDTH
  );
}

function pinnedResultsOf(theCase) {
  return (theCase && Array.isArray(theCase.pinnedResults)) ? theCase.pinnedResults : [];
}

// Returns { ok, error?, pinnedResults? } — never mutates; the caller commits.
async function buildPinnedResult(container, meta) {
  const cap = await capturePanelDataUrl(container);
  if (!cap.ok) return cap;
  return {
    ok: true,
    pin: {
      id: "pin_" + Math.random().toString(36).slice(2, 9),
      title: meta.title || "Analysis",
      source: meta.source || "",
      note: meta.note || "",
      capturedAt: Date.now(),
      // Captures are pixels of the live screen, so they carry whatever theme
      // was active. Recorded so the report can flag a dark capture sitting on
      // a light (print-oriented) page rather than leaving the user to wonder.
      theme: (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || "unknown",
      dataUrl: cap.dataUrl,
      width: cap.width,
      height: cap.height
    }
  };
}

// Whole-panel capture, including text/tables — desktop only, since it needs
// Chromium's compositor. Reports that plainly rather than failing silently.
async function exportPanelAsImage(container, name) {
  if (!isDesktopExport() || !window.electronAPI.capturePanel) {
    return { ok: false, error: "Full-panel capture needs the desktop app. The chart itself can still be saved as SVG or PNG." };
  }
  if (!container) return { ok: false, error: "Nothing to capture." };
  const r = container.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { ok: false, error: "Nothing visible to capture." };
  return await window.electronAPI.capturePanel(
    { x: r.left, y: r.top, width: r.width, height: r.height },
    slugifyExportName(name) + ".png"
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION EXPORT — a whole card, not just its chart
//
// Every export in the app used to stop at a chart's edge. The export wrapper
// sat around the <svg> only, so a PNG of "Company revenue rollup" came out
// without the title, without "Peak: $2.50B in year 6", and without the notes
// under it — a picture a reader had no way to interpret. Even "Panel" was a
// screenshot of the SCREEN, so a section taller than the window, or one
// scrolled partly out of view, came out cut off, and a scrolling list (Form 4
// filings, literature results) came out showing only its visible rows.
//
// This serialises the section itself instead. The clone is taken with the live
// form values written in, every scroll box expanded to its full height, every
// truncated title restored to its full text, and the export chrome removed.
// The result is standalone HTML that can be rendered offscreen at full height
// (to PNG or PDF — see render-section in main.js) or stored on a case and laid
// out inside the report. React styles inline, so outerHTML already carries
// nearly all of the look; the app stylesheet supplies the rest.
// ════════════════════════════════════════════════════════════════════════════

// Tags that could run code or fetch something, and are never legitimately part
// of a section. Stripped at capture AND again at render, so a snapshot edited
// in storage cannot smuggle anything in either.
const SNAPSHOT_DROP_TAGS = ["script", "iframe", "object", "embed", "link", "meta", "base", "noscript", "template", "frame", "frameset"];
// Two different kinds of URL, with two different rules. A LINK is only
// followed if a reader chooses to click it, so an ordinary web address is fine
// and keeping it means links in an exported PDF still work. A RESOURCE is
// fetched the moment the page renders — a remote image is a tracking pixel —
// so only an embedded data: image is allowed there. The page CSP would block a
// remote fetch anyway; the sanitiser does not rely on that.
const SNAPSHOT_LINK_ATTRS = ["href", "xlink:href"];
const SNAPSHOT_RESOURCE_ATTRS = ["src", "poster", "background", "srcset", "action", "formaction", "data"];

function snapshotLinkAllowed(v) {
  const t = String(v || "").trim().toLowerCase();
  return t === "" || t.charAt(0) === "#" || t.indexOf("https:") === 0 || t.indexOf("http:") === 0;
}
function snapshotResourceAllowed(v) {
  const t = String(v || "").trim().toLowerCase();
  return t === "" || t.indexOf("data:image/") === 0;
}

// Whitelist by exclusion: drop dangerous elements, event handlers and non-web
// URLs; keep style, class, SVG presentation and aria attributes, which is
// everything a section needs to look like itself.
function sanitizeSnapshotTree(root) {
  if (!root || !root.querySelectorAll) return root;
  root.querySelectorAll(SNAPSHOT_DROP_TAGS.join(",")).forEach(n => n.parentNode && n.parentNode.removeChild(n));
  const all = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
  all.forEach(n => {
    if (!n.attributes) return;
    Array.prototype.slice.call(n.attributes).forEach(a => {
      const name = a.name.toLowerCase();
      if (name.indexOf("on") === 0 || name === "srcdoc" || name === "formtarget") n.removeAttribute(a.name);
      else if (SNAPSHOT_LINK_ATTRS.indexOf(name) !== -1 && !snapshotLinkAllowed(a.value)) n.removeAttribute(a.name);
      else if (SNAPSHOT_RESOURCE_ATTRS.indexOf(name) !== -1 && !snapshotResourceAllowed(a.value)) n.removeAttribute(a.name);
      else if (name === "style" && /expression\s*\(|javascript:/i.test(a.value)) n.removeAttribute(a.name);
    });
  });
  return root;
}

function sanitizeSnapshotHtml(html) {
  if (typeof document === "undefined") return "";
  const box = document.createElement("div");
  // A <template> parses without executing or loading anything, so the string
  // can be inspected before any of it touches the live document.
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  box.appendChild(tpl.content.cloneNode(true));
  sanitizeSnapshotTree(box);
  return box.innerHTML;
}

function serializeSection(root, opts) {
  opts = opts || {};
  if (!root || !root.cloneNode) return { ok: false, error: "Nothing to export." };
  const clone = root.cloneNode(true);
  // cloneNode preserves structure exactly, so the two lists line up one to one
  // and each clone node can be corrected from its live counterpart.
  const live = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
  const copy = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll("*")));
  const canvases = [];
  let extraWidth = 0;
  for (let i = 0; i < live.length && i < copy.length; i++) {
    const L = live[i], C = copy[i];
    const tag = L.tagName;
    // Form state lives in properties, not attributes, so outerHTML would show
    // every input as its initial value rather than what the user typed.
    if (tag === "INPUT") {
      if (L.type === "checkbox" || L.type === "radio") { if (L.checked) C.setAttribute("checked", ""); else C.removeAttribute("checked"); }
      else C.setAttribute("value", L.value);
    } else if (tag === "TEXTAREA") {
      C.textContent = L.value;
    } else if (tag === "SELECT") {
      Array.prototype.forEach.call(C.options || [], (o, j) => {
        if (L.options[j] && L.options[j].selected) o.setAttribute("selected", ""); else o.removeAttribute("selected");
      });
    } else if (tag === "CANVAS") {
      canvases.push([L, C]);
    }
    // A truncated title carries its full text; an export restores it, because
    // "…" in a PDF is information the reader simply cannot get back.
    const full = L.getAttribute && L.getAttribute("data-full-text");
    if (full != null) C.textContent = full;

    if (typeof getComputedStyle === "function" && L.nodeType === 1) {
      const cs = getComputedStyle(L);
      // A scroll box shows a window onto its content. In an export there is no
      // scrollbar to reach the rest, so the box is opened to its full height.
      const vClipped = L.scrollHeight > L.clientHeight + 1 && /auto|scroll|hidden/.test(cs.overflowY);
      if (vClipped && tag !== "BODY" && tag !== "HTML") {
        C.style.maxHeight = "none"; C.style.height = "auto"; C.style.overflowY = "visible";
      }
      // Horizontally scrolling tables are widened instead of clipped, and the
      // export page grows to fit the widest of them.
      if (L.scrollWidth > L.clientWidth + 1 && /auto|scroll/.test(cs.overflowX)) {
        C.style.overflowX = "visible";
        extraWidth = Math.max(extraWidth, L.scrollWidth - L.clientWidth);
      }
      // Single-line ellipsis truncation done in CSS rather than in text.
      if (cs.textOverflow === "ellipsis" && L.scrollWidth > L.clientWidth + 1) {
        C.style.whiteSpace = "normal"; C.style.textOverflow = "clip"; C.style.overflow = "visible";
      }
    }
  }
  // Canvas pixels are not part of the DOM, so they are carried across as an
  // image. (Every chart here is SVG today; this keeps a future canvas honest.)
  canvases.forEach(pair => {
    try {
      const img = document.createElement("img");
      img.src = pair[0].toDataURL("image/png");
      img.setAttribute("style", pair[0].getAttribute("style") || "");
      img.width = pair[0].width; img.height = pair[0].height;
      pair[1].parentNode.replaceChild(img, pair[1]);
    } catch (e) { /* a tainted canvas cannot be read; leave it blank rather than fail the export */ }
  });
  // Export chrome — the export bar itself, pin controls — never belongs in the
  // exported picture of a section.
  Array.prototype.slice.call(clone.querySelectorAll("[data-no-export]")).forEach(n => n.parentNode && n.parentNode.removeChild(n));
  sanitizeSnapshotTree(clone);
  // The clone's own margin would otherwise add an off-colour band around it.
  clone.style.margin = "0";

  const rect = root.getBoundingClientRect ? root.getBoundingClientRect() : { width: 0, height: 0 };
  const width = Math.max(320, Math.ceil((rect.width || root.offsetWidth || 800) + extraWidth));
  const html = clone.outerHTML;
  return {
    ok: true,
    html,
    width,
    title: opts.title || sectionTitleOf(root),
    theme: (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || "dark",
    bytes: html.length
  };
}

// The name a reader would use for a section: its declared export name, else
// its first heading-like line. Used for file names and report headings.
function sectionTitleOf(root) {
  if (!root) return "Section";
  const declared = root.getAttribute && root.getAttribute("data-export-section");
  if (declared) return declared;
  const heading = root.querySelector && root.querySelector("h1,h2,h3,h4,[data-section-title]");
  if (heading && heading.textContent.trim()) return heading.textContent.trim().slice(0, 90);
  const first = (root.textContent || "").trim().split("\n")[0];
  return (first || "Section").slice(0, 90);
}

// Nearest enclosing section of an element — how an export button finds the
// card it belongs to without every card having to pass a ref down.
function closestExportSection(el) {
  let n = el;
  while (n && n !== document.body) {
    if (n.hasAttribute && n.hasAttribute("data-export-section")) return n;
    n = n.parentNode;
  }
  return null;
}

async function exportSectionAs(root, format, opts) {
  opts = opts || {};
  if (!isDesktopExport() || !window.electronAPI.renderSection) {
    return { ok: false, error: "Section export needs the desktop app — it renders the section offscreen, which a browser page cannot do." };
  }
  const snap = serializeSection(root, opts);
  if (!snap.ok) return snap;
  return await window.electronAPI.renderSection({
    html: snap.html, width: snap.width, theme: snap.theme, format: format,
    title: snap.title, context: opts.context || "",
    suggestedName: slugifyExportName(opts.fileName || snap.title) + (format === "pdf" ? ".pdf" : ".png"),
    returnData: !!opts.returnData
  });
}

// ── Text compression for stored snapshots ──
// Snapshots live in localStorage beside the user's cases, where the quota is
// shared and small. HTML full of repeated inline styles compresses roughly
// tenfold. Falls back to plain text anywhere the streams API is missing, and
// records which was used so a snapshot is always readable back.
async function compressSnapshotText(text) {
  if (typeof CompressionStream === "undefined" || typeof Blob === "undefined") return { enc: "plain", data: text };
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { enc: "gzip-b64", data: btoa(bin) };
  } catch (e) { return { enc: "plain", data: text }; }
}

async function decompressSnapshotText(enc, data) {
  if (enc !== "gzip-b64") return String(data || "");
  const bin = atob(data);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

// Builds a stored report item from a live section.
async function buildSectionSnapshot(root, meta) {
  meta = meta || {};
  const snap = serializeSection(root, meta);
  if (!snap.ok) return snap;
  const packed = await compressSnapshotText(snap.html);
  return {
    ok: true,
    pin: {
      id: "pin_" + Math.random().toString(36).slice(2, 9),
      kind: "html",
      title: meta.title || snap.title,
      source: meta.source || "",
      note: meta.note || "",
      capturedAt: Date.now(),
      theme: snap.theme,
      width: snap.width,
      enc: packed.enc,
      html: packed.data,
      included: true
    }
  };
}
