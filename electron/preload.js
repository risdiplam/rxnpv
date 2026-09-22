const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  edgarFetch: (url) => ipcRenderer.invoke('edgar:fetch', url),
  exportPDF: (suggestedName) => ipcRenderer.invoke('export-pdf', suggestedName),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Region capture — Chromium renders the panel exactly as it appears on
  // screen, at the display's real device pixel ratio, so a "screenshot" of a
  // tool is genuinely what the user is looking at rather than a redraw that
  // might drift from it.
  capturePanel: (rect, suggestedName) => ipcRenderer.invoke('capture-panel', rect, suggestedName),
  capturePanelData: (rect, maxWidth) => ipcRenderer.invoke('capture-panel-data', rect, maxWidth),
  // Save an already-encoded asset the renderer produced (SVG text, or a PNG
  // data URL rasterised from an SVG at arbitrary scale).
  saveAsset: (payload) => ipcRenderer.invoke('save-asset', payload),
  // Vector PDF of a single chart. Needs the main process because a renderer
  // has no PDF writer — see the handler's comment in main.js.
  exportChartPdf: (payload) => ipcRenderer.invoke('export-chart-pdf', payload),
  // A whole section — title, figures, chart, tables, notes — rendered offscreen
  // at full height to PNG or PDF. See render-section in main.js.
  renderSection: (payload) => ipcRenderer.invoke('render-section', payload)
});
