const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  edgarFetch: (url) => ipcRenderer.invoke('edgar:fetch', url),
  exportPDF: (suggestedName, opts) => ipcRenderer.invoke('export-pdf', suggestedName, opts),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Save text the renderer produced (an SVG, or a JSON backup) through a
  // native save dialog.
  saveAsset: (payload) => ipcRenderer.invoke('save-asset', payload),
  // A whole section — title, figures, chart, tables, notes — rendered offscreen
  // at full height to PNG or PDF. See render-section in main.js.
  renderSection: (payload) => ipcRenderer.invoke('render-section', payload),
  // Automatic backups to a folder the user picked. The renderer only ever
  // hands over the backup text; the folder and the file names live in the
  // main process, so a page cannot choose where anything is written.
  backupStatus: () => ipcRenderer.invoke('backup:status'),
  backupChooseFolder: () => ipcRenderer.invoke('backup:choose-folder'),
  backupTurnOff: () => ipcRenderer.invoke('backup:turn-off'),
  backupOpenFolder: () => ipcRenderer.invoke('backup:open-folder'),
  backupWrite: (text, opts) => ipcRenderer.invoke('backup:write', text, opts)
});
