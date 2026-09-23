const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const EDGAR_USER_AGENT = 'RxNPV Research contact@rxnpv.local'; // SEC asks filers/tools to self-identify

// A one-time userData migration from this app's earlier names lived here.
// It already ran successfully on the machine that needed it — confirmed live
// via its own log line before this code was removed — so it's gone rather
// than carried forward as dead code that would otherwise need to name this
// project's prior names in public source for no remaining functional reason.

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'RxNPV',
    backgroundColor: '#14171C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'rxnpv.html'));
  win.setMenuBarVisibility(false);
  mainWindow = win;
}

// ── PDF export ──────────────────────────────────────────────────────────────
// Uses Chromium's real print engine (via webContents.printToPDF), so the
// existing SVG charts render exactly as they already look on screen — no
// separate PDF library or chart re-implementation needed. The renderer
// switches to a dedicated print-friendly "Report" layout immediately before
// calling this, and switches back after.
ipcMain.handle('export-pdf', async (event, suggestedName) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report as PDF',
    defaultPath: suggestedName || 'RxNPV-Report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      landscape: false,
      pageSize: 'Letter',
      margins: { marginType: 'default' }
    });
    fs.writeFileSync(filePath, data);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});


// ── Save a renderer-produced asset (SVG text or a PNG data URL) ─────────────
// ── Chart → PDF ─────────────────────────────────────────────────────────────
// PNG and SVG are produced entirely in the renderer: serialise the <svg>, or
// rasterise it through a canvas. Neither can write a PDF, because a browser
// renderer has no PDF writer — PDF needs Chromium's print engine, which lives
// in the main process. That is the whole reason chart export stopped at PNG
// and SVG, and it is a plumbing gap rather than a decision.
//
// The SVG arrives already standalone (styles inlined, explicit width/height,
// background rect) from svgToStandaloneString(), so this only has to put it on
// a correctly-sized page and print it. It stays VECTOR through Chromium's
// print path, which is the point — a PDF of a rasterised chart would be no
// better than the PNG.
//
// Fonts are read straight out of the packaged rxnpv.html rather than shipped
// through IPC: the app embeds its typefaces as base64 @font-face rules, and an
// offscreen window would otherwise fall back to a system face and quietly
// produce a PDF that does not match what is on screen.
let _fontFaceCache = null;
function embeddedFontFaces() {
  if (_fontFaceCache !== null) return _fontFaceCache;
  try {
    const html = fs.readFileSync(path.join(__dirname, 'rxnpv.html'), 'utf8');
    _fontFaceCache = (html.match(/@font-face\s*\{[^}]*\}/g) || []).join('\n');
  } catch (e) { _fontFaceCache = ''; }
  return _fontFaceCache;
}

// ── Section → PNG / PDF ────────────────────────────────────────────────────
// A section arrives as standalone, sanitised HTML (serializeSection in the
// renderer). It is laid out in an offscreen window with the app's own
// stylesheet and the same theme, then either printed (PDF: vector, selectable
// text, links stay clickable) or captured at full height (PNG).
//
// Full height is the point. The old "Panel" export was a capture of the
// visible SCREEN, so anything taller than the window was cut off. An offscreen
// window has no such limit: the PNG is taken with captureBeyondViewport, the
// same technique that proved necessary when the app window was on another
// Space, and the PDF page is sized to the content itself.
let _appStylesCache = null;
function appStyles() {
  if (_appStylesCache !== null) return _appStylesCache;
  try {
    const html = fs.readFileSync(path.join(__dirname, 'rxnpv.html'), 'utf8');
    _appStylesCache = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [])
      .map(block => block.replace(/^<style[^>]*>/, '').replace(/<\/style>$/, ''))
      .join('\n');
  } catch (e) { _appStylesCache = ''; }
  return _appStylesCache;
}

function escapeHtmlText(t) {
  return String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// PDF pages cannot be taller than 200 inches; beyond that Chromium paginates
// onto further pages of the same size, which is an acceptable degradation for
// a section that long.
const SECTION_PDF_MAX_IN = 200;
// Keeps a PNG inside what the GPU can hand back in one piece.
const SECTION_PNG_MAX_DEVICE_PX = 16000;

async function renderSectionToBuffer(payload) {
  const { html, width, theme, format, title, context } = payload || {};
  if (!html || typeof html !== 'string') throw new Error('Nothing to export.');
  const pad = 24;
  const w = Math.min(3000, Math.max(320, Math.round(Number(width) || 900)));
  const stamp = new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  // A one-line footer saying what this is and when it was taken. A section
  // pulled out of the app loses its surroundings, and a reader handed the
  // file has no other way to know where the numbers came from or how old
  // they are.
  const footer = '<div style="margin-top:14px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);letter-spacing:0.02em">'
    + 'RxNPV' + (context ? ' · ' + escapeHtmlText(context) : '') + (title ? ' · ' + escapeHtmlText(title) : '') + ' · exported ' + escapeHtmlText(stamp)
    + '</div>';
  const doc = '<!doctype html><html data-theme="' + (theme === 'light' ? 'light' : 'dark') + '"><head><meta charset="utf-8">'
    // Nothing in here may run or fetch. Sanitised at capture already; this is
    // the second wall, and it holds even for a snapshot tampered with on disk.
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:">'
    + '<style>' + appStyles() + '</style>'
    + '<style>'
    + 'html, body { margin: 0; padding: 0; background: var(--bg); }'
    + 'body { width: ' + w + 'px; padding: ' + pad + 'px; box-sizing: content-box; }'
    + '[data-no-export] { display: none !important; }'
    + '@page { margin: 0; }'
    + '@media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'
    + '</style></head><body><div id="rxnpv-export-root">' + html + footer + '</div></body></html>';

  const tmpFile = path.join(app.getPath('temp'), 'rxnpv-section-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.html');
  let win = null;
  try {
    fs.writeFileSync(tmpFile, doc, 'utf8');
    win = new BrowserWindow({
      show: false, width: w + pad * 2, height: 900,
      // JavaScript is enabled only so the main process can measure the page
      // with executeJavaScript; the page's own CSP forbids any script it might
      // contain, and the content was sanitised before it got here.
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, webSecurity: true }
    });
    await win.loadFile(tmpFile);
    await win.webContents.executeJavaScript('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true');
    // Measured from the content wrapper, not the document: the document is
    // never shorter than the window, so measuring it left a band of empty
    // background under every short section.
    const dims = await win.webContents.executeJavaScript(
      '(() => { const r = document.getElementById("rxnpv-export-root").getBoundingClientRect();'
      + ' return { w: Math.ceil(r.width) + ' + (pad * 2) + ', h: Math.ceil(r.height) + ' + (pad * 2) + ' }; })()');

    if (format === 'pdf') {
      return await win.webContents.printToPDF({
        printBackground: true,
        pageSize: { width: dims.w / 96, height: Math.min(SECTION_PDF_MAX_IN, dims.h / 96) },
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
    }
    const scale = Math.max(0.5, Math.min(2, SECTION_PNG_MAX_DEVICE_PX / Math.max(1, dims.h)));
    const dbg = win.webContents.debugger;
    dbg.attach('1.3');
    try {
      const shot = await dbg.sendCommand('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: dims.w, height: dims.h, scale }
      });
      return Buffer.from(shot.data, 'base64');
    } finally { try { dbg.detach(); } catch (e) {} }
  } finally {
    if (win) { try { win.destroy(); } catch (e) {} }
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

ipcMain.handle('render-section', async (event, payload) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const format = payload && payload.format === 'pdf' ? 'pdf' : 'png';
  try {
    const buf = await renderSectionToBuffer(Object.assign({}, payload, { format }));
    // Used by the automated checks, and by nothing that writes anywhere.
    if (payload && payload.returnData) return { ok: true, format, bytes: buf.length, data: buf.toString('base64') };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: format === 'pdf' ? 'Save section as PDF' : 'Save section as PNG',
      defaultPath: (payload && payload.suggestedName) || ('RxNPV-section.' + format),
      filters: [format === 'pdf' ? { name: 'PDF document', extensions: ['pdf'] } : { name: 'PNG image', extensions: ['png'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, buf);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export-chart-pdf', async (event, payload) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const { svg, suggestedName, widthPx, heightPx } = payload || {};
  if (!svg || typeof svg !== 'string') return { ok: false, error: "Nothing to export." };

  // Page sized to the chart's own aspect at 96 CSS px per inch, so there is no
  // band of empty paper around it. Clamped so a malformed viewBox cannot ask
  // for a 400-inch page.
  const w = Math.min(40, Math.max(1, (Number(widthPx) || 800) / 96));
  const h = Math.min(40, Math.max(1, (Number(heightPx) || 400) / 96));

  const html = '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>' + embeddedFontFaces()
    + '@page { margin: 0; } html, body { margin: 0; padding: 0; }'
    + 'svg { display: block; width: 100%; height: auto; }</style>'
    + '</head><body>' + svg + '</body></html>';

  const tmpFile = path.join(app.getPath('temp'), 'rxnpv-chart-' + Date.now() + '.html');
  let win = null;
  try {
    fs.writeFileSync(tmpFile, html, 'utf8');
    // Deliberately inert: no preload, no node, sandboxed, scripts off. It
    // renders one SVG this app just produced and nothing else.
    win = new BrowserWindow({
      show: false, width: 1200, height: 800,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false, webSecurity: true }
    });
    await win.loadFile(tmpFile);
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: w, height: h },
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save chart as PDF',
      defaultPath: suggestedName || 'RxNPV-chart.pdf',
      filters: [{ name: 'PDF document', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, pdf);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (win) { try { win.destroy(); } catch (e) {} }
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
});

ipcMain.handle('save-asset', async (event, payload) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const { data, encoding, suggestedName, filterName, extensions } = payload || {};
  if (!data) return { ok: false, error: "Nothing to save." };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save',
      defaultPath: suggestedName || 'RxNPV-export',
      filters: [{ name: filterName || 'File', extensions: extensions || ['txt'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    if (encoding === 'dataurl') {
      const base64 = String(data).replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    } else {
      fs.writeFileSync(filePath, data, 'utf8');
    }
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── EDGAR fetch bridge ──────────────────────────────────────────────────────
// Runs in the main process, which is not a browser — no CORS restriction, and
// (unlike a browser) allowed to set a real User-Agent identifying this tool,
// which is what SEC's own API guidance actually asks callers to do.
ipcMain.handle('edgar:fetch', async (event, url) => {
  // Only ever allow requests to sec.gov hosts — this bridge has real network
  // access, so keep it scoped to exactly what it's for.
  let parsed;
  try { parsed = new URL(url); } catch (e) { throw new Error('Invalid URL'); }
  if (!/(^|\.)sec\.gov$/.test(parsed.hostname)) {
    throw new Error('edgar:fetch only allows sec.gov URLs, got: ' + parsed.hostname);
  }
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': EDGAR_USER_AGENT, 'Accept-Encoding': 'gzip, deflate' }
    });
    clearTimeout(timeout);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* some endpoints return non-JSON; caller handles */ }
    return { ok: res.ok, status: res.status, json, text: json ? null : text };
  } catch (e) {
    clearTimeout(timeout);
    throw new Error('EDGAR fetch failed: ' + e.message);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Open a link in the user's actual default browser (not inside the app) ──
ipcMain.handle('open-external', async (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only http(s) links can be opened');
    await shell.openExternal(url);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
