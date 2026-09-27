// ════════════════════════════════════════════════════════════════════════════
// Backup & restore
// ════════════════════════════════════════════════════════════════════════════
// Every case, custom comp, watched trial and PDF bundle lives in this app's
// localStorage and nowhere else. Code is on GitHub; the user's own research
// was not backed up anywhere. This file gives it three ways out:
//
//   1. Export everything (or one case) to a JSON file, through a save dialog.
//   2. Import a file: ADD its cases alongside the current ones (fresh ids, so
//      nothing is overwritten), or REPLACE everything with a full backup
//      (two-step confirmation, and a safety copy first when auto-backup is on).
//   3. Automatic backups (desktop): once a folder is chosen, the app writes a
//      backup there whenever the data has changed, checked once a minute.
//      The folder and file names are the main process's business — see
//      backup:write in main.js.
//
// What is backed up: user data only, never the re-fetchable API caches.
// A key is included only if backupKeyKind() recognises it, so a restore can
// never write an arbitrary key into storage.
const BACKUP_FORMAT = "rxnpv-backup";
const CASE_FILE_FORMAT = "rxnpv-case";
const BACKUP_VERSION = 1;
const BACKUP_DATA_KEYS = ["rxnpv_cases_v1", "rxnpv_custom_ma", "rxnpv_custom_peaksales", "rxnpv_custom_licensing", "rxnpv_pdf_bundle"];
const BACKUP_PREF_KEYS = ["rxnpv_theme", "rxnpv_secnav_hidden"];
const BACKUP_SNAPSHOT_PREFIX = "rxnpv_ctgov_snapshot_";

// "data" (irreplaceable work), "pref" (a setting), or null (not ours to back
// up — caches, or anything unrecognised).
function backupKeyKind(key) {
  if (BACKUP_DATA_KEYS.indexOf(key) !== -1) return "data";
  if (BACKUP_PREF_KEYS.indexOf(key) !== -1) return "pref";
  if (typeof key === "string" && key.indexOf(BACKUP_SNAPSHOT_PREFIX) === 0 && /^[A-Za-z0-9_-]{1,40}$/.test(key.slice(BACKUP_SNAPSHOT_PREFIX.length))) return "data";
  return null;
}

// storage: anything with length / key(i) / getItem (localStorage, or a stub).
function buildBackup(storage, now) {
  const data = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (backupKeyKind(k)) { const v = storage.getItem(k); if (v != null) data[k] = v; }
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: "RxNPV", createdAt: (now || new Date()).toISOString(), data };
}

function parseJSONSafe(s) { try { return JSON.parse(s); } catch (e) { return undefined; } }

// A case worth importing: an object with an id and a programs array. The
// same shape the app itself saves; anything else is refused, not repaired.
function isCaseShape(c) {
  return !!c && typeof c === "object" && !Array.isArray(c) && typeof c.id === "string" && Array.isArray(c.programs)
    && c.programs.every(p => p && typeof p === "object" && typeof p.id === "string");
}

function summarizeBackupData(data) {
  const cases = parseJSONSafe(data["rxnpv_cases_v1"] || "[]") || [];
  const count = (k) => { const v = parseJSONSafe(data[k] || "[]"); return Array.isArray(v) ? v.length : 0; };
  return {
    cases: cases.length,
    caseNames: cases.map(c => c && c.name).filter(Boolean),
    customComps: count("rxnpv_custom_ma") + count("rxnpv_custom_peaksales") + count("rxnpv_custom_licensing"),
    watchedTrials: Object.keys(data).filter(k => k.indexOf(BACKUP_SNAPSHOT_PREFIX) === 0).length,
    bundleItems: count("rxnpv_pdf_bundle")
  };
}

// Reads an imported file. Returns { ok, kind: "backup" | "case", ... } or
// { ok: false, error } with a sentence a person can act on.
function parseImportFile(text) {
  const obj = parseJSONSafe(text);
  if (!obj || typeof obj !== "object") return { ok: false, error: "That file isn't readable JSON — is it an RxNPV backup?" };
  if (obj.format === CASE_FILE_FORMAT) {
    if (!isCaseShape(obj.case)) return { ok: false, error: "That case file is missing its case or programs." };
    return { ok: true, kind: "case", theCase: obj.case, createdAt: obj.createdAt || null, summary: { cases: 1, caseNames: [obj.case.name || "Untitled case"], customComps: 0, watchedTrials: 0, bundleItems: 0 } };
  }
  if (obj.format !== BACKUP_FORMAT) return { ok: false, error: "That file isn't an RxNPV backup or case file." };
  if (typeof obj.version !== "number" || obj.version > BACKUP_VERSION) return { ok: false, error: "That backup was made by a newer version of RxNPV. Update the app, then import it." };
  if (!obj.data || typeof obj.data !== "object") return { ok: false, error: "That backup has no data in it." };
  const data = {}; let dropped = 0;
  Object.keys(obj.data).forEach(k => {
    const v = obj.data[k];
    // Data keys hold JSON; preferences are short plain strings ("dark").
    const kind = backupKeyKind(k);
    const valid = typeof v === "string" && (kind === "data" ? parseJSONSafe(v) !== undefined : kind === "pref" && v.length <= 64);
    if (valid) data[k] = v; else dropped++;
  });
  const cases = data["rxnpv_cases_v1"] != null ? parseJSONSafe(data["rxnpv_cases_v1"]) : [];
  if (!Array.isArray(cases) || !cases.every(isCaseShape)) return { ok: false, error: "The cases in that backup are damaged, so nothing was imported." };
  return { ok: true, kind: "backup", data, dropped, createdAt: obj.createdAt || null, summary: summarizeBackupData(data) };
}

// A copy of an imported case that cannot collide with anything already here:
// new case and program ids, and a name marked when one is already taken.
function freshCaseCopy(c, takenNames) {
  const copy = JSON.parse(JSON.stringify(c));
  copy.id = newId("case");
  copy.programs.forEach(p => { p.id = newId("prog"); });
  if (takenNames && takenNames.indexOf(copy.name) !== -1) copy.name = (copy.name || "Case") + " (imported)";
  copy.updatedAt = Date.now();
  return copy;
}

// ADD: cases from a backup or case file, appended as fresh copies; custom
// comps appended when not already present; watched-trial baselines filled in
// only where there is none. Never deletes or overwrites. Returns the new case
// list (the caller puts it into React state) and a count of each thing added.
function mergeImport(storage, parsed, currentCases) {
  const taken = currentCases.map(c => c.name);
  const incoming = parsed.kind === "case" ? [parsed.theCase] : (parseJSONSafe(parsed.data["rxnpv_cases_v1"] || "[]") || []);
  const added = incoming.map(c => { const copy = freshCaseCopy(c, taken); taken.push(copy.name); return copy; });
  let comps = 0, trials = 0;
  if (parsed.kind === "backup") {
    ["rxnpv_custom_ma", "rxnpv_custom_peaksales", "rxnpv_custom_licensing"].forEach(k => {
      const inc = parseJSONSafe(parsed.data[k] || "[]");
      if (!Array.isArray(inc) || !inc.length) return;
      const cur = parseJSONSafe(storage.getItem(k) || "[]") || [];
      const seen = new Set(cur.map(x => JSON.stringify(x)));
      const fresh = inc.filter(x => !seen.has(JSON.stringify(x)));
      if (fresh.length) { storage.setItem(k, JSON.stringify(cur.concat(fresh))); comps += fresh.length; }
    });
    Object.keys(parsed.data).filter(k => k.indexOf(BACKUP_SNAPSHOT_PREFIX) === 0).forEach(k => {
      if (storage.getItem(k) == null) { storage.setItem(k, parsed.data[k]); trials++; }
    });
  }
  return { cases: currentCases.concat(added), addedCases: added.length, addedComps: comps, addedTrials: trials };
}

// REPLACE: storage becomes exactly the backup's user data. Preferences in the
// backup are applied; current preferences the backup lacks are left alone.
function replaceWithBackup(storage, parsed) {
  const remove = [];
  for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (backupKeyKind(k) === "data") remove.push(k); }
  remove.forEach(k => storage.removeItem(k));
  Object.keys(parsed.data).forEach(k => storage.setItem(k, parsed.data[k]));
}

function caseFileFor(theCase, now) {
  return { format: CASE_FILE_FORMAT, version: BACKUP_VERSION, app: "RxNPV", createdAt: (now || new Date()).toISOString(), case: theCase };
}

function describeBackupAge(ms, now) {
  if (!ms) return "never";
  const mins = Math.round(((now || Date.now()) - ms) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " min ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + " hr ago";
  return new Date(ms).toLocaleDateString();
}

const hasDesktopBackup = () => typeof window !== "undefined" && window.electronAPI && typeof window.electronAPI.backupWrite === "function";

// Writes an automatic backup whenever the data has changed. Checks once a
// minute rather than on every keystroke: a backup is a few hundred KB, and the
// point is "never lose more than a minute", not a write per character.
function useAutoBackup(enabled) {
  const lastRef = React.useRef(null);
  const [status, setStatus] = React.useState(null);
  const refresh = React.useCallback(() => {
    if (!hasDesktopBackup()) return;
    window.electronAPI.backupStatus().then(setStatus).catch(() => {});
  }, []);
  React.useEffect(() => { refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!enabled || !hasDesktopBackup() || !status || !status.folder) return;
    // The first check after launch always writes, so each day the app is
    // opened gets its own dated file even if nothing changes that day.
    const tick = async () => {
      let b, sig;
      try { b = buildBackup(localStorage); sig = JSON.stringify(b.data); } catch (e) { return; }
      if (sig === lastRef.current) return;
      const r = await window.electronAPI.backupWrite(JSON.stringify(b)).catch(e => ({ ok: false, error: e.message }));
      if (r && r.ok) lastRef.current = sig;
      refresh();
    };
    const first = setTimeout(tick, 3000);
    const iv = setInterval(tick, 60000);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [enabled, status && status.folder, refresh]);
  return { status, refresh };
}

function BackupDialog({ cases, activeCase, onClose, onCasesChange, autoStatus, refreshAutoStatus }) {
  const h = React.createElement;
  const panelRef = React.useRef(null);
  const closeRef = React.useRef(onClose); closeRef.current = onClose;
  const stableClose = React.useCallback(() => closeRef.current(), []);
  useDialogKeys(panelRef, stableClose);
  const fileRef = React.useRef(null);
  const [msg, setMsg] = React.useState(null);            // { tone, text }
  const [pending, setPending] = React.useState(null);    // parsed import awaiting a choice
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const desktop = hasDesktopBackup();

  const exportAll = async () => {
    const text = JSON.stringify(buildBackup(localStorage), null, 1);
    const r = await saveTextAsset(text, "RxNPV backup " + localDateStamp() + ".json", "RxNPV backup", ["json"]);
    if (r && r.ok) setMsg({ tone: "ok", text: r.viaBrowser ? "Backup downloaded." : "Backup saved." });
    else if (!(r && r.canceled)) setMsg({ tone: "err", text: (r && r.error) || "Couldn't save the backup." });
  };
  const exportCase = async () => {
    if (!activeCase) return;
    const text = JSON.stringify(caseFileFor(activeCase), null, 1);
    const r = await saveTextAsset(text, slugifyExportName(activeCase.name || "case") + ".rxnpv-case.json", "RxNPV case", ["json"]);
    if (r && r.ok) setMsg({ tone: "ok", text: "“" + (activeCase.name || "Case") + "” saved." });
    else if (!(r && r.canceled)) setMsg({ tone: "err", text: (r && r.error) || "Couldn't save the case." });
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 100e6) { setMsg({ tone: "err", text: "That file is too large to be an RxNPV backup." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportFile(String(reader.result || ""));
      if (!parsed.ok) { setPending(null); setMsg({ tone: "err", text: parsed.error }); return; }
      setMsg(null); setConfirmReplace(false); setPending(parsed);
    };
    reader.onerror = () => setMsg({ tone: "err", text: "Couldn't read that file." });
    reader.readAsText(f);
  };
  const doAdd = () => {
    const r = mergeImport(localStorage, pending, cases);
    onCasesChange(r.cases, r.cases.length > cases.length ? r.cases[cases.length].id : null);
    const bits = [r.addedCases + " case" + (r.addedCases === 1 ? "" : "s")];
    if (r.addedComps) bits.push(r.addedComps + " custom comp" + (r.addedComps === 1 ? "" : "s"));
    if (r.addedTrials) bits.push(r.addedTrials + " watched trial" + (r.addedTrials === 1 ? "" : "s"));
    setPending(null);
    setMsg({ tone: "ok", text: "Added " + bits.join(", ") + ". Nothing already here was changed." + (r.addedComps || r.addedTrials ? " Reopen a tool to see new comps or trials." : "") });
  };
  const doReplace = async () => {
    // A safety copy of what is about to be replaced, when there is somewhere
    // to put it. Without auto-backup the confirmation says so plainly.
    if (desktop && autoStatus && autoStatus.folder) {
      const safety = await window.electronAPI.backupWrite(JSON.stringify(buildBackup(localStorage)), { reason: "pre-restore" }).catch(e => ({ ok: false, error: e.message }));
      if (!safety || !safety.ok) { setMsg({ tone: "err", text: "Couldn't save a safety copy first (" + ((safety && safety.error) || "unknown error") + "), so nothing was replaced." }); return; }
    }
    replaceWithBackup(localStorage, pending);
    // Tools read their comps and baselines when they open, so a full reload is
    // the only way every view shows the restored data at once.
    window.location.reload();
  };

  const card = (title, children) => h("div", { style: { padding: "14px 16px", border: "1px solid var(--rule)", borderRadius: 10, marginBottom: 12, background: "var(--surface)" } },
    h("div", { style: { font: "600 13.5px var(--sans)", color: "var(--ink-1)", marginBottom: 6 } }, title), children);
  const btn = (label, onClick, primary, extra) => h("button", Object.assign({ type: "button", onClick, className: primary ? "bk-btn primary" : "bk-btn" }, extra || {}), label);
  const p = (t) => h("p", { style: { margin: "0 0 10px", font: "400 12.5px/1.55 var(--sans)", color: "var(--ink-2)" } }, t);

  const s = pending && pending.summary;
  // Portalled to <body>: it is opened from the sidebar, which is sticky and so
  // its own stacking context — rendered in place, the Workspace tab row
  // painted over the dialog whatever its z-index.
  return ReactDOM.createPortal(h("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }, onClick: stableClose },
    h("div", { ref: panelRef, role: "dialog", "aria-modal": "true", "aria-label": "Backup and restore", onClick: e => e.stopPropagation(),
      style: { background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: 12, padding: "20px 22px", width: "min(560px, 92vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
        h("div", { style: { font: "700 17px var(--display)", color: "var(--ink-1)" } }, "Backup & restore"),
        h("button", { type: "button", onClick: stableClose, className: "bk-btn", "aria-label": "Close" }, "Close")),
      p("Your cases, custom comps, watched trials and PDF bundle live only inside this app on this Mac. Keep a copy somewhere else."),

      desktop && card("Automatic backups",
        autoStatus && autoStatus.folder
          ? h("div", null,
              p((autoStatus.folderExists ? "On. Saving to " : "Paused: can't find ") + autoStatus.folder + (autoStatus.folderExists ? " whenever something changes." : " — was it moved, or on a drive that isn't connected?")),
              h("div", { style: { font: "400 12px var(--sans)", color: autoStatus.lastError ? "var(--red)" : "var(--ink-3)", marginBottom: 10 } },
                autoStatus.lastError ? autoStatus.lastError : "Last backup: " + describeBackupAge(autoStatus.lastAt) + ". One file per day is kept for 30 days, plus the latest."),
              h("div", { className: "bk-row" },
                btn("Open folder", () => window.electronAPI.backupOpenFolder()),
                btn("Change folder…", async () => { await window.electronAPI.backupChooseFolder(); refreshAutoStatus(); }),
                btn("Turn off", async () => { await window.electronAPI.backupTurnOff(); refreshAutoStatus(); })))
          : h("div", null,
              p("Pick a folder and the app keeps a backup there, updated within a minute of any change. A folder in iCloud Drive or Dropbox also puts it off this Mac."),
              h("div", { className: "bk-row" }, btn("Choose a folder…", async () => { await window.electronAPI.backupChooseFolder(); refreshAutoStatus(); }, true)))),

      card("Save a copy now",
        h("div", null,
          p("Everything in one file, or just the open case — handy for sharing a case with someone else."),
          h("div", { className: "bk-row" },
            btn("Export everything…", exportAll, !desktop || !(autoStatus && autoStatus.folder)),
            activeCase && btn("Export “" + (activeCase.name || "this case") + "”…", exportCase)))),

      card("Restore or import",
        h("div", null,
          !pending && p("Open a backup or a case file. You'll see what's in it before anything changes."),
          h("input", { ref: fileRef, type: "file", accept: ".json,application/json", onChange: onFile, style: { display: "none" }, "aria-label": "Choose a backup or case file" }),
          !pending && h("div", { className: "bk-row" }, btn("Open a file…", () => fileRef.current && fileRef.current.click())),
          pending && h("div", null,
            h("div", { style: { padding: "10px 12px", borderRadius: 8, background: "var(--surface-2)", font: "400 12.5px/1.6 var(--sans)", color: "var(--ink-2)", marginBottom: 10 } },
              h("b", { style: { color: "var(--ink-1)" } }, pending.kind === "case" ? "One case" : "Backup" + (pending.createdAt ? " from " + new Date(pending.createdAt).toLocaleString() : "")),
              h("div", null, s.cases + " case" + (s.cases === 1 ? "" : "s") + (s.caseNames.length ? ": " + s.caseNames.slice(0, 6).join(", ") + (s.caseNames.length > 6 ? "…" : "") : "")),
              pending.kind === "backup" && h("div", null, s.customComps + " custom comps · " + s.watchedTrials + " watched trials · " + s.bundleItems + " bundle items"),
              pending.dropped > 0 && h("div", { style: { color: "var(--warn)" } }, pending.dropped + " unrecognised entr" + (pending.dropped === 1 ? "y was" : "ies were") + " skipped.")),
            !confirmReplace && h("div", { className: "bk-row" },
              btn("Add " + (s.cases === 1 ? "this case" : "these " + s.cases + " cases") + " alongside mine", doAdd, true),
              pending.kind === "backup" && btn("Replace everything…", () => setConfirmReplace(true), false, { className: "bk-btn danger" }),
              btn("Cancel", () => { setPending(null); setConfirmReplace(false); })),
            confirmReplace && h("div", { style: { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--red)", background: "var(--red-bg)" } },
              p("This replaces your " + cases.length + " current case" + (cases.length === 1 ? "" : "s") + ", custom comps, watched trials and bundle with what's in this backup. " +
                (desktop && autoStatus && autoStatus.folder ? "A safety copy of your current data is saved to your backup folder first." : "There's no automatic backup set up, so export your current data first if you might want it back.")),
              h("div", { className: "bk-row" },
                btn("Yes, replace everything", doReplace, false, { className: "bk-btn danger" }),
                btn("Go back", () => setConfirmReplace(false))))))),

      msg && h("div", { role: "status", style: { marginTop: 4, font: "500 12.5px var(--sans)", color: msg.tone === "ok" ? "var(--green)" : "var(--red)" } }, msg.text)
    )), document.body);
}
