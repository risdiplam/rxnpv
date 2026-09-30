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
ipcMain.handle('export-pdf', async (event, suggestedName, opts) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report as PDF',
    defaultPath: suggestedName || 'RxNPV-Report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    // The page margins are painted with the WINDOW's background colour, not
    // the page's — the app window is dark, so every report printed with a dark
    // frame round each page. For the print only, the window takes the
    // document's own background (a #rrggbb the renderer passes), then goes back.
    const bg = opts && /^#[0-9a-f]{6}$/i.test(String(opts.background || '')) ? opts.background : null;
    const prevBg = mainWindow.getBackgroundColor ? mainWindow.getBackgroundColor() : null;
    if (bg) mainWindow.setBackgroundColor(bg);
    let data;
    try {
      data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'Letter',
        margins: { marginType: 'default' }
      });
    } finally { if (bg && prevBg) mainWindow.setBackgroundColor(prevBg); }
    fs.writeFileSync(filePath, data);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});


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
    // The app sets its base text colour and font on its root container, not on
    // body, and much of the app's text (table cells, subheadings) inherits
    // them. Without this the export fell back to the browser's near-black on
    // the dark theme's background, and whole table columns all but vanished.
    + 'body { color: var(--ink-1); font-family: var(--sans); }'
    + '[data-no-export] { display: none !important; }'
    // The app fades results in (.results, .fade-in, .content). This page is
    // captured the moment it loads, so an animation here meant the capture
    // caught content at or near zero opacity: section PDFs showed the inputs
    // and a blank space where the result and every chart should be.
    + '*, *::before, *::after { animation: none !important; transition: none !important; }'
    + '@page { margin: 0; }'
    // The app's own print CSS whitens the page for the report (body: white);
    // here the page must keep the theme's background, or a chart exported on
    // its own prints the dark theme's pale text on white and all but vanishes.
    + '@media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: var(--bg) !important; } }'
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
    const measure = () => win.webContents.executeJavaScript(
      '(() => { const r = document.getElementById("rxnpv-export-root").getBoundingClientRect();'
      + ' return { w: Math.ceil(r.width) + ' + (pad * 2) + ', h: Math.ceil(r.height) + ' + (pad * 2) + ' }; })()');
    let dims = await measure();

    if (format === 'pdf') {
      // Size the page from the PRINT layout, not the screen one: print media
      // lays the same content out a few pixels taller, and a page cut to the
      // screen height pushed the last line (the footer) onto a near-empty
      // second page in 38 of the app's section and chart exports. A small
      // margin on top absorbs sub-pixel rounding.
      const pdbg = win.webContents.debugger;
      try {
        pdbg.attach('1.3');
        await pdbg.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
        const printed = await measure();
        dims = { w: dims.w, h: Math.max(dims.h, printed.h) + 6 };
        await pdbg.sendCommand('Emulation.setEmulatedMedia', { media: '' });
      } catch (e) { dims = { w: dims.w, h: dims.h + 6 }; }
      finally { try { pdbg.detach(); } catch (e) {} }
      // And then check the result rather than trust the measurement: a very
      // tall section can still lay out a little longer in print. One section
      // is one page, so if the PDF came out with more, the page is enlarged
      // and it is printed again. (Sections past the 200in page cap do run to
      // several pages, by design.)
      const pageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
      let h = dims.h, pdf = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        pdf = await win.webContents.printToPDF({
          printBackground: true,
          pageSize: { width: dims.w / 96, height: Math.min(SECTION_PDF_MAX_IN, h / 96) },
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });
        if (pageCount(pdf) <= 1 || h / 96 >= SECTION_PDF_MAX_IN) break;
        h = Math.ceil(h * 1.04) + 24;
      }
      return pdf;
    }
    // The limit is in DEVICE pixels, and the capture is taken at the display's
    // pixel ratio on top of `scale` (2x on a Retina panel). Counting only CSS
    // pixels let a tall section (Peak Sales Comps with its full drug list,
    // ~5,400px) reach 21,672 device pixels, past Chromium's ~16,384 texture
    // limit, and the capture repeated its own top half at the bottom.
    const dpr = Number(await win.webContents.executeJavaScript('window.devicePixelRatio || 1')) || 1;
    const scale = Math.max(0.2, Math.min(2, SECTION_PNG_MAX_DEVICE_PX / (Math.max(1, dims.h) * dpr), SECTION_PNG_MAX_DEVICE_PX / (Math.max(1, dims.w) * dpr)));
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

// File name from a title: lower-case letters, digits and dashes only, so a
// bundle item can never carry a path separator or a dot-dot into a filename.
function safeFileBase(s) {
  const b = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return b || 'section';
}

ipcMain.handle('render-section', async (event, payload) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const format = payload && payload.format === 'pdf' ? 'pdf' : 'png';
  // Batch: the PDF bundle's "separate files" export. One folder is chosen,
  // once, and each item is rendered exactly as a single section export would
  // be and written into it, numbered in bundle order. Same channel, same
  // renderer, same sanitised input as a single export — no new capability.
  if (payload && Array.isArray(payload.batch)) {
    const items = payload.batch.slice(0, 60);
    if (!items.length) return { ok: false, error: "Nothing to export." };
    try {
      const pick = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose a folder for ' + items.length + ' ' + format.toUpperCase() + (items.length === 1 ? ' file' : ' files'),
        buttonLabel: 'Save here', properties: ['openDirectory', 'createDirectory']
      });
      if (pick.canceled || !pick.filePaths || !pick.filePaths[0]) return { ok: false, canceled: true };
      const dir = path.resolve(pick.filePaths[0]);
      const files = [], used = new Set();
      for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        let name = String(i + 1).padStart(2, '0') + '-' + safeFileBase(it.fileName || it.title) + '.' + format;
        while (used.has(name)) name = name.replace('.' + format, '-2.' + format);
        used.add(name);
        const target = path.join(dir, name);
        if (path.dirname(target) !== dir) continue; // never outside the chosen folder
        const buf = await renderSectionToBuffer(Object.assign({}, it, { format }));
        fs.writeFileSync(target, buf);
        files.push(target);
      }
      return { ok: true, folder: dir, files };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
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

// ── Save a renderer-produced text asset (an SVG) ───────────────────────────
ipcMain.handle('save-asset', async (event, payload) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  const { data, suggestedName, filterName, extensions } = payload || {};
  if (!data) return { ok: false, error: "Nothing to save." };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save',
      defaultPath: suggestedName || 'RxNPV-export',
      filters: [{ name: filterName || 'File', extensions: extensions || ['txt'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, String(data), 'utf8');
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

// The Dock icon, set at runtime. macOS 26 draws its own darkened version of
// a bundle icon when the system icon style is Dark or Tinted, unless the app
// ships an Icon Composer icon with its own dark look — which needs Xcode's
// actool to compile. An image set here is shown as it is, so the running
// app's Dock tile keeps the blue ℞ whatever the icon style. (Finder and
// Launchpad still show the system's version of icon.icns.)
function setDockIcon() {
  if (process.platform !== 'darwin' || !app.dock) return;
  try {
    const img = require('electron').nativeImage.createFromPath(path.join(__dirname, 'icon-dock.png'));
    if (!img.isEmpty()) app.dock.setIcon(img);
  } catch (e) { /* the bundle icon still shows */ }
}

app.whenReady().then(() => { setDockIcon(); createWindow(); });
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

// ── Automatic backups ───────────────────────────────────────────────────────
// Every case lives in this app's localStorage and nowhere else, so losing the
// Mac (or the app's data) would lose them. These handlers write the backup the
// renderer builds into ONE folder the user chose through a native dialog.
// The renderer supplies only the JSON text; the folder, the file names and the
// pruning are decided here, so nothing in the page can direct a write
// anywhere else. Files: "RxNPV backup (latest).json", one dated file per day
// (the newest 30 kept), and a stamped copy taken before any restore.
const BACKUP_KEEP_DAILY = 30;
const backupConfigPath = () => path.join(app.getPath('userData'), 'backup-config.json');
function readBackupConfig() {
  try { return JSON.parse(fs.readFileSync(backupConfigPath(), 'utf8')) || {}; } catch (e) { return {}; }
}
function writeBackupConfig(c) {
  try { fs.writeFileSync(backupConfigPath(), JSON.stringify(c)); } catch (e) {}
}
function localStamp(d) {
  const p = n => String(n).padStart(2, '0');
  return { day: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), time: p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) };
}
// Write to a temp file in the same folder, then rename over the target, so a
// crash or a full disk mid-write never leaves a half-written backup in place
// of a good one.
function writeFileAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

ipcMain.handle('backup:status', async () => {
  const c = readBackupConfig();
  return { folder: c.folder || null, folderExists: !!(c.folder && fs.existsSync(c.folder)), lastAt: c.lastAt || null, lastFile: c.lastFile || null, lastError: c.lastError || null };
});

ipcMain.handle('backup:choose-folder', async () => {
  if (!mainWindow) return { ok: false, error: 'No window available' };
  const r = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder for automatic backups',
    buttonLabel: 'Back up here',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false, canceled: true };
  const c = readBackupConfig();
  c.folder = r.filePaths[0]; delete c.lastError;
  writeBackupConfig(c);
  return { ok: true, folder: c.folder };
});

ipcMain.handle('backup:turn-off', async () => {
  const c = readBackupConfig();
  delete c.folder; delete c.lastError;
  writeBackupConfig(c);
  return { ok: true };
});

ipcMain.handle('backup:open-folder', async () => {
  const c = readBackupConfig();
  if (!c.folder || !fs.existsSync(c.folder)) return { ok: false, error: 'The backup folder is not available.' };
  await shell.openPath(c.folder);
  return { ok: true };
});

ipcMain.handle('backup:write', async (event, text, opts) => {
  const c = readBackupConfig();
  if (!c.folder) return { ok: false, error: 'No backup folder is set.' };
  if (typeof text !== 'string' || text.length > 100e6) return { ok: false, error: 'The backup was empty or too large.' };
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'The backup was not valid JSON.' }; }
  if (!parsed || parsed.format !== 'rxnpv-backup') return { ok: false, error: 'That is not an RxNPV backup.' };
  const fail = (msg) => { c.lastError = msg; writeBackupConfig(c); return { ok: false, error: msg }; };
  if (!fs.existsSync(c.folder)) return fail('The backup folder is missing — it may have been moved, renamed, or on a drive that is not connected.');
  try {
    const now = new Date(), s = localStamp(now);
    const preRestore = opts && opts.reason === 'pre-restore';
    const dated = path.join(c.folder, preRestore ? 'RxNPV backup before restore ' + s.day + ' ' + s.time + '.json' : 'RxNPV backup ' + s.day + '.json');
    writeFileAtomic(dated, text);
    if (!preRestore) writeFileAtomic(path.join(c.folder, 'RxNPV backup (latest).json'), text);
    // Keep the newest daily files; never touches anything the app did not name.
    const daily = fs.readdirSync(c.folder).filter(f => /^RxNPV backup \d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
    daily.slice(BACKUP_KEEP_DAILY).forEach(f => { try { fs.unlinkSync(path.join(c.folder, f)); } catch (e) {} });
    c.lastAt = now.getTime(); c.lastFile = dated; delete c.lastError;
    writeBackupConfig(c);
    return { ok: true, at: c.lastAt, file: dated };
  } catch (e) {
    return fail('Could not write the backup: ' + e.message);
  }
});
