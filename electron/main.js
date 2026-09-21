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

// ── Panel capture ───────────────────────────────────────────────────────────
// Uses Chromium's own compositor (webContents.capturePage) rather than
// redrawing the DOM into a canvas. That matters: a redraw approach has to
// re-implement CSS layout and inevitably drifts from what's on screen, while
// this is pixel-identical to what the user sees, at the display's real device
// pixel ratio (so 2x on a Retina panel without asking for it).
// Same capture as capture-panel, but returns the image inline instead of
// writing it to a file. Used by "Pin to report", which stores a snapshot of a
// Simulation/Tools result on the case so the PDF report can include analyses
// that are computed on demand and otherwise live only on screen.
// Downscaled deliberately: these are embedded in a report and persisted in
// localStorage alongside the user's cases, where a full-resolution PNG would
// eat the storage quota that the cases themselves need.
ipcMain.handle('capture-panel-data', async (event, rect, maxWidth) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  try {
    const bounds = mainWindow.getContentBounds();
    const r = {
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      width: Math.min(Math.round(rect.width), bounds.width - Math.max(0, Math.round(rect.x))),
      height: Math.min(Math.round(rect.height), bounds.height - Math.max(0, Math.round(rect.y)))
    };
    if (r.width <= 0 || r.height <= 0) return { ok: false, error: "Nothing visible to capture — scroll the panel into view first." };
    let image = await mainWindow.webContents.capturePage(r);
    if (image.isEmpty()) return { ok: false, error: "Capture came back empty — the panel may be scrolled off screen." };
    const cap = maxWidth || 900;
    const size = image.getSize();
    if (size.width > cap) image = image.resize({ width: cap, quality: 'good' });
    return { ok: true, dataUrl: image.toDataURL(), width: image.getSize().width, height: image.getSize().height };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('capture-panel', async (event, rect, suggestedName) => {
  if (!mainWindow) return { ok: false, error: "No window available" };
  try {
    // capturePage wants integer, in-bounds device-independent pixels; a rect
    // that runs past the viewport edge silently returns an empty image.
    const bounds = mainWindow.getContentBounds();
    const r = {
      x: Math.max(0, Math.round(rect.x)),
      y: Math.max(0, Math.round(rect.y)),
      width: Math.min(Math.round(rect.width), bounds.width - Math.max(0, Math.round(rect.x))),
      height: Math.min(Math.round(rect.height), bounds.height - Math.max(0, Math.round(rect.y)))
    };
    if (r.width <= 0 || r.height <= 0) return { ok: false, error: "Nothing visible to capture — scroll the panel into view first." };
    const image = await mainWindow.webContents.capturePage(r);
    if (image.isEmpty()) return { ok: false, error: "Capture came back empty — the panel may be scrolled off screen." };
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save image',
      defaultPath: suggestedName || 'RxNPV-panel.png',
      filters: [{ name: 'PNG image', extensions: ['png'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, image.toPNG());
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ── Save a renderer-produced asset (SVG text or a PNG data URL) ─────────────
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
