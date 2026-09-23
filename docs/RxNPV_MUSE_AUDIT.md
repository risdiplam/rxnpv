# CLAUDE IMPLEMENTATION PACKET — RxNPV

**To:** Claude Code (head developer)
**From:** Final pre-handoff review (Grok), after Muse/Spark static audit
**Tree:** `f49689f` (`f49689f191fe6eaf73cc075e5fe4ae6f00ec4c59`) — confirm `git rev-parse --short HEAD` before you touch anything. If HEAD has moved, re-read the cited lines; do not apply patches by memory.
**Authorization:** Caleb is sending you this file to **apply finishing touches**. Implement the confirmed P1s, add the tests, patch the auditor-facing docs. Do **not** reopen DECIDED-no items. Do **not** rewrite the bundler, sign the app, wire Target Dossier into PoS, restore Chemistry, or invent a 14th Trial Watch field.

The full Muse audit is below this cover. **Do not delete any FIN-*.** Annotate each one in §13 as you close it (`CONFIRMED` / `REJECTED` / `FIXED` + commit).

---

## Standing constraints (read once)

- Concatenated globals. Never reorder `MODULE_ORDER` as a drive-by. `build.js` replace must stay a **function**. CSP hash from the finished artifact.
- `npm test` and `npm run test:dev` were 12/12 green on this tree. You break that, you are not done.
- New math expected values are derived longhand in the test comment. Never snapshot the engine’s own output.
- `data.js` benchmarks are source documents. Do not “correct” them.
- jsdom does not prove CSP, layout, live network, or `printToPDF`. After code changes: `node build.js && cd test && node setup.js && npm test && npm run test:dev`. Packaged-app checks are B-001–B-013; do them on the Mac, not in a paragraph.

---

## What you ship before anything else

Six P1s. Independent re-read of `f49689f` **confirms all six**. Implement in this order. Each row is one commit if possible (`fix(valuation): …`).

| Order | ID | Verdict | File:lines | Change | Test |
|---|---|---|---|---|---|
| 1 | **FIN-001** | CONFIRMED | `src/valuationPanel.js:505–514` | `BenchField` writes `Number(v)*1e6` into `scenarioOverrides[key].peakRevenue` then displays the stored string with `suffix: "$M"`. Round-trip compounds ×1e6. Store millions (drop `* 1e6`) **or** display `stored/1e6`. Make display / stored / used identical to `MillionsField`. Also check whoever *consumes* `scenarioOverrides.peakRevenue` so you do not invert the unit twice. | Write override `1000`, read back `1000`, second edit still `1000`. Engine treats it as $1,000M. |
| 2 | **FIN-002** | CONFIRMED | `src/scenarioEngine.js:262–291` vs PRV at `:220–228` | `computePartnershipContribution(theCase, r)` calls `computePoSWeighting(prog)` — raw benchmark. It does not take a scenario and does not apply `posOverridePct`. PRV next door uses `pv.posToLaunch`. Thread the same effective PoS (override × scenario multiplier) into milestone `posToGate`. Upfront can stay certain. | Milestone PV moves with Bear PoS multiplier and with a 50% vs 10% override. PRV and milestones use the same effective launch PoS on one fixture. Simple Multiple still calls this function. |
| 3 | **FIN-003** | CONFIRMED | `src/ts_app.js:1586–1588` + `src/ts_peakSalesEngine.js:39–41,77` | Diagnosis / treatment / peak share are unlabeled 0–1 fields; `tsClamp01` turns `60` into `1.0`. Accept 0–100 and divide by 100, **or** label “fraction (0–1)” and reject `>1` with a visible message. Prefer 0–100 — that is the rest of the app. | Input `60` → engine `0.60`. Label contains a unit. |
| 4 | **FIN-004** | CONFIRMED | `src/toolsView.js:2823–2824` vs summary table above it; data already on `byGroup[gid].affected/.atRisk` from `trialResults.js` | Render `pct(rate) + " (" + affected + "/" + atRisk + ")"` like the summary table. | Fixture `40/200` → cell contains `20.0%` and `40/200`. |
| 5 | **FIN-005** | CONFIRMED | `src/toolsView.js:328–331` (`search` does not clear insiders); `loadInsiderActivity` ~`:378` has no seq | `search()` must `setInsiderResult(null); setInsiderError(null)`. `loadInsiderActivity` needs `insiderSeq` (and/or bound CIK); drop the result if a newer search won. | After `search()`, insider panel unmounts. Stale fetch must not paint. |
| 6 | **FIN-006** | CONFIRMED | `src/toolsView.js:964–975` `ExclusivityTool.run` | Copy `FdaLookupTool`’s `resSeq` pattern. | Two overlapping `run()`; first resolves last → second drug remains. |

No P0 exists on this tree (no global collision, no IPC escape, no snapshot XSS, no silent save-loss). Do not go hunting for a rewrite.

---

## P2 — ship in the same session if P1s are green

| ID | Verdict | Notes |
|---|---|---|
| **FIN-007** | CONFIRMED | `solveImpliedPoSMultiplier` `:497–501` uses `computePoSWeighting` raw baseline. Use override PoS when present. |
| **FIN-008** | CONFIRMED (coverage gap) | No code bug alleged. Add `math_verification.js` golden: `$150M × 10% / 1.12³` longhand in the comment. |
| **FIN-009** | CONFIRMED (coverage gap) | Add a direct test of `computeFullCaseMonteCarlo`. Degenerate Bear=Bull=Base → p10=p50=p90=deterministic per-share. |
| **FIN-010** | CONFIRMED | `:1068–1070` — `posLow === posHigh ? 100` and mode hardcoded `100` even when both bounds are below 100. Same for share (`100`) and DR (`0`). Return the bound when equal; clamp mode into `[low, high]`. **Do this before or with FIN-009** or the degenerate MC test will fail for the wrong reason. |
| **FIN-011** | NEEDS RUNTIME CONFIRM | Display bridge at `valuationPanel.js` ~`:610–642` is EV steps + cash − ordinary debt ÷ shares. Muse says detailed capital subtracts non-converting convertible face and the chip list omits that step. Confirm `equity.perShare` vs sum of chips on a fixture with `convFace` and conversion off. If per-share is right and chips omit a line, add the chip. If per-share is wrong, fix `capitalEngine.js` first. Do not “simplify” the capital engine. |
| **FIN-012** | MIS-SCOPED — confirm before coding | Muse mixed two surfaces. Peak Sales MC share is already `tsClamp01` (0–1) — same family as FIN-003. The “2× benchmark” flag is Workspace Full-mode `peakShareOverridePct` in `computeRedFlags` (`scenarioEngine.js` ~`:810`). Decide: (a) fold Peak Sales MC share into FIN-003, and (b) separately warn/clamp Workspace override `>100`. Do not invent a second clamp that fights FIN-003. |

## P3 — cheap, do after P1/P2

| ID | Verdict | Action |
|---|---|---|
| **FIN-013** | CONFIRMED dead code | `fetchTrialByNctId` in `ts_ctgovEngine.js:119` — no timeout, unused. **Delete it.** Do not wire it up. |
| **FIN-014** | CONFIRMED | `ts_app.js:1712–1713, 1830, 1834` — change labels to `k_a` / `k_e` so existing `sci()` subscripts them. |
| Doc drift | CONFIRMED | Feature Map §10 item 6: Electron upgrade is **done** (44.4.4, 2026-09-22). Four “14 fields” claims → **13** (`CTGOV_DIFF_FIELDS` = 9 + 4 supplemental). Human Test Checklist is already bannered historical — archive or replace body with a pointer; do not revive Chemistry. After you land P1s, Findings TODO “Still open: Nothing” is false until you add the closed items. |

---

## Do not do

- Code signing, bundler migration, Electron major bump, Windows packaging, `electron-winstaller`.
- 13F, versioned snapshots, SOTP correlation, group-sequential engines, HTA, Chemistry.
- “Fix” 13-vs-14 by adding a dummy Watch field.
- Snapshot engine output as a golden expected value.
- Change `setup.js` replace strategy or reintroduce CDN React.
- Extra IPC channels.
- Claim release-ready until B-001 (offline packaged launch), B-002 (PNG/PDF export), and B-007/B-008 (pin + resize) are ticked on a Mac.

---

## Definition of done for this pass

1. All six P1s `FIXED` with tests that fail on `f49689f` and pass on your commit.
2. FIN-007 and FIN-010 fixed; FIN-008/009 tests added; FIN-011 confirmed or fixed; FIN-012 scoped correctly.
3. FIN-013 deleted; FIN-014 labels; three doc patches.
4. `node build.js` + `npm test` + `npm run test:dev` = 12/12.
5. §13 updated in this file (or Findings TODO) with commit hashes.
6. Packaged-app blocked list left for Caleb + you on the Mac — do not mark B-001–B-013 done from jsdom.

Suggested first prompt to yourself once the repo is open:

> Implement FIN-001 through FIN-006 exactly as specified in the Claude Implementation Packet at the top of this audit file. Add the listed tests. Do not implement P2/P3 in the same commit as P1. Stop after `npm test` is green and paste a disposition table.

---

## Independent reviewer notes (Grok, 2026-09-23)

- Muse inventory, suite counts, MODULE_ORDER, IPC list, CSP hosts, and the September-regression table were not re-executed here. Spark claims `npm test` 12/12 on a clean clone; treat that as true for `f49689f`.
- P1 line citations were re-read on this tree. They match.
- Highest dollar risk if a user actually uses the feature: **FIN-001** (compounding scenario revenue) then **FIN-002** (milestones deaf to scenario PoS) then **FIN-003** (silent 100% rates).
- Highest trust risk in a demo: **FIN-004**, **FIN-005**, **FIN-001** display.
- Vanilla path (new case, peak 1000, 1e8 shares, no overrides, no partnership, no MC) is why CI is green. That is not a reason to defer the P1s.

---

# Muse static audit (unchanged below)

*Everything from here through §12 is Muse/Spark’s completed static audit. Findings are preserved verbatim. §13 at the end is the living disposition log.*

)
# RxNPV — Muse static audit + findings file

**Repo:** https://github.com/risdiplam/rxnpv
**Tree this protocol was written against:** `f49689f` (2026-09-23) — *Spark verified 2026-09-23: `git rev-parse HEAD` = `f49689f191fe6eaf73cc075e5fe4ae6f00ec4c59`, `git rev-parse --short HEAD` = `f49689f`. Clean clone from https://github.com/risdiplam/rxnpv.*
**Product:** RxNPV, a macOS arm64 Electron valuation + trial-outcome sandbox for a retail biotech investor.
**This file is the whole assignment.** Muse works inside it. Claude later reads the completed file and runs the genuine (runtime / packaged-app) pass. Do not split findings across other notes.

**Muse static audit — COMPLETE 2026-09-23 (Spark).** Phases A–H executed. Phases B–F run by delegated subagents with every proposed finding independently re-verified against source by Spark before inclusion (P1s confirmed by direct code read; P2s confirmed or cited with exact file:symbol for Claude to kill/confirm). No code was modified. Test workflows actually run on a clean clone (see §7). 14 findings opened (6 P1, 6 P2, 2 P3), 4 doc-drift rows, 13 blocked runtime rows.

---

## 0. Who does what

| Agent | Job | Not the job |
|---|---|---|
| **Muse (you)** | Read-only static audit of the current tree. Inventory every surface. File findings in this file, with code evidence. Mark what you could not prove statically as `BLOCKED — needs Claude / packaged app`. | Do not implement fixes. Do not reopen closed scope. Do not treat missing institutional features as defects. Do not claim the app is release-ready. |
| **Claude (next)** | Runtime + packaged-app + live-API + visual/a11y pass, using your matrix and findings as the worklist. Confirms, kills false positives, adds `$` impact, writes tests, then (only when asked) fixes. | Must not ignore a Muse P0 because “the September audit already closed.” |
| **Human (Caleb)** | Decides release. Runs the four native checks only a person on the Mac can feel: PDF export, section pin/capture, window resize, throwaway-profile launch. | — |

When you finish, the file must still be **one file**. Append, do not invent a second document.

---

## 1. Read this first, in this order

Do not file a finding before finishing this list.

1. `README.md` — especially **§ For auditors** (architecture, security model, known open items, deliberately not built) and **§ Feature overview, and how to test each feature**.
2. `CLAUDE.md` — scope line, concatenation architecture, API lessons, conventions.
3. `docs/RxNPV_Feature_Map.md` — built / committed / rejected. Code wins if this disagrees with `src/`.
4. `docs/RxNPV_Findings_TODO.md` — prior audit. Items marked 🟢 are closed unless you have **new evidence**.
5. `docs/RxNPV_Field_Reference.md` — units and which fields the engine actually consumes.
6. `test/README.md` — what jsdom can and cannot see.
7. `build.js` → `MODULE_ORDER`.
8. `shell.html` CSP.
9. `electron/main.js` + `electron/preload.js`.
10. Then `src/` in `MODULE_ORDER`.

**Authority when sources disagree**

- Running code in `src/`, `electron/`, `shell.html`, `build.js` is source of truth.
- `CLAUDE.md` and `README.md` § For auditors are current orientation.
- `docs/` is design history. Where it disagrees with code, **file doc drift**, do not “fix” the product to match a stale paragraph.
- Known-stale: `docs/RxNPV_Human_Test_Checklist.md` (still describes an earlier app, including Chemistry). README says to use README test steps instead.
- Suspected-stale to verify: Feature Map “build order” item 6 still says Electron upgrade is deferred; `electron/package.json` is `electron ^44.4.4` and Findings TODO says the upgrade closed 2026-09-22. **Confirmed drift — see §9.**

---

## 2. Scope line (binding)

> Good enough to help a retail biotech investor improve their analyses. Doesn't need to be institutional grade, doesn't need to have every conceivable feature.

Conviction tools that never touch the DCF are in scope for *quality*. They are out of scope for “wire this into PoS.”

### 2.1 Do not file these as gaps

From README § For auditors, CLAUDE.md, Feature Map:

- 13F holdings
- Versioned case snapshots
- Platform / pipeline correlation for SOTP
- Regulatory precedent library
- Group-sequential / adaptive design engines
- QSP / PBPK / NONMEM / docking / structure prediction
- QED / PAINS / SA-score molecular metrics
- Chemistry / RDKit / molecule cards (built, then removed; no trace should remain — if you find residue, *that* is a finding)
- Black-box AI outcome prediction
- HTA / ICER / payer value models
- Channel / inventory stocking analysis
- AACT bulk download
- Full identifier normalisation (MONDO / Ensembl / InChIKey) unless free-text matching is demonstrably wrong
- Code signing / notarization (deliberate)
- Real bundler / ES modules (deliberate isolated future change)
- Further DCF *mechanics*. Silent math *bugs* in existing mechanics **are** in scope
- Target Dossier as a PoS input (deliberately not)
- Asset Program composite score (deliberately a checklist of counts only)
- Formal claim of institutional-grade accessibility (contrast was checked; SR / keyboard-only was not — that limitation is already disclosed; only file new, concrete a11y defects)

### 2.2 Disclosed limitations — do not rediscover them as if hidden

Already in README § For auditors. Confirm they are still true. Only file if the *disclosure is now wrong* or the risk is larger than disclosed.

- Unsigned / not notarized — still true, still disclosed. No finding.
- No `will-navigate` / `setWindowOpenHandler` on the main window — still true, still disclosed. No new navigation path found escaping `open-external` + CSP (all outbound links go through `openExternal`; renderer fetches limited to the six CSP hosts). No finding.
- No formal a11y audit (contrast only) — still true, still disclosed. No new concrete a11y defects found statically. No finding.
- Tested on macOS arm64 only — still true, still disclosed.
- Persistence is `localStorage` only — still true. No finding.
- Live APIs verified by hand, mocked in CI — still true. No finding.
- Historical docs can be stale — still true; see §9 for the current drift list.

### 2.3 Release-ready bar (what “done” means for this whole process)

The product is release-ready for *this user, this scope* when:

1. No open **P0** or **P1**. — **NOT MET: 6 P1 open (§10).**
2. Every **P2** is either fixed or explicitly accepted in README § For auditors / Findings TODO. — **6 P2 open (§10).**
3. `npm test` is 12/12 green on a clean clone (README contract). — **MET (Spark ran it 2026-09-23).**
4. Packaged app launches offline (React vendored). — **BLOCKED (B-001).**
5. Destructive actions still require confirm; failed saves still warn. — **MET statically.**
6. Live tools distinguish **error / empty / partial**; they never present an outage as “no data.” — **MET statically.**
7. Auditor-facing docs that a stranger would read (`README.md`, `CLAUDE.md`, Feature Map headings, Findings TODO “still open”) match the tree. — **NOT MET: 2 drift rows (§9).**
8. Known limitations stay listed; no new silent ones. — **MET.**

Muse cannot declare that bar met. Muse can only say whether the *static* evidence is clean enough for Claude to try. **Verdict: not yet — 6 P1s need Claude's confirm-or-kill first.**

---

## 3. Architecture facts — do not fight them

- **38** plain JS files in `src/`, concatenated by `MODULE_ORDER` into one inline `<script>` in `electron/rxnpv.html`. No webpack/esbuild/Vite. No `import`/`export`.
- Globals. `function` declarations hoist; `const` / `let` / `class` do not. Reordering `MODULE_ORDER` is a release-blocker unless the full suite is re-run.
- Two engine families by design:
  - Tools: `ctgovEngine.js`, `fdaEngine.js`
  - Simulation: `ts_ctgovEngine.js`, `ts_fdaEngine.js`
  Shared *function names* are P0 (this already bit `ctgovFetch`). Shared JSON paths with different empty-value display are not.
- React 18.3.1 UMD is vendored in `electron/vendor/`. CDN React is a regression (blank window offline).
- CSP script hash is computed from the **finished** artifact, including the newline after `<script>`. jsdom does not enforce CSP.
- `String.prototype.replace` with a string replacement argument is unsafe on this bundle (`$'` in currency formatting). Replacement must be a function. Already fixed once in `build.js`.
- Electron **44.4.4** (confirm in `electron/package.json`). Main window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `loadFile` only.
- Persistence: `localStorage`. Legacy `pdcf_` keys were migrated. New writes to `pdcf_` are a finding.
- Tests: 12 jsdom suites via `test/run_all.js`. `math_verification.js` is **1,032** independent numeric checks. `export_coverage_test.js` is **403** checks. Network is mocked. Layout, CSP, live fetch, `printToPDF`, `capturePage` / offscreen section render are **not** proved by CI.

### 3.1 MODULE_ORDER (verify against `build.js`; do not assume)

```
data.js, engine.js, costEngine.js, rdEngine.js, posEngine.js,
dcfEngine.js, capitalEngine.js, scenarioEngine.js,
edgarEngine.js, ctgovEngine.js, trialDecoder.js, trialResults.js,
fdaEngine.js, openTargetsEngine.js, literatureEngine.js,
assetProgram.js, cmsEngine.js, commercialEngine.js,
exportEngine.js, chart.js, helpers.js,
valuationPanel.js, programEditor.js, caseShell.js,
referenceSheet.js, reportView.js, toolsView.js,
ts_statsEngine.js, ts_simulationEngine.js, ts_pkpdEngine.js,
ts_peakSalesEngine.js, ts_chart.js, ts_ctgovEngine.js,
ts_fdaEngine.js, ts_app.js,
simulationView.js, portfolioView.js,
app.js
```

Every `src/*.js` file must appear exactly once. A file on disk but missing from `MODULE_ORDER` is dead. A name in `MODULE_ORDER` but missing on disk fails the build.

### 3.2 IPC surface (`electron/preload.js` → `electron/main.js`)

Only these six. Extra renderer exposure or extra `ipcMain.handle` is a finding.

| Channel | Role | Guard to verify |
|---|---|---|
| `export-pdf` | report `printToPDF` | main window exists |
| `render-section` | offscreen full-height PNG/PDF | sandbox, no preload; JS on only to measure |
| `export-chart-pdf` | vector chart PDF | offscreen window, **JS off** |
| `save-asset` | save SVG/PNG the renderer made | type / path checks |
| `edgar:fetch` | SEC fetch from main | hostname allowlist, 20s timeout, user-agent |
| `open-external` | open in browser | `http:` / `https:` only |

### 3.3 CSP `connect-src` hosts (`shell.html`)

```
https://clinicaltrials.gov
https://api.fda.gov
https://data.sec.gov
https://api.platform.opentargets.org
https://www.ebi.ac.uk
https://data.cms.gov
```

Renderer `fetch()` to any other host is blocked in the real app and invisible to jsdom. EDGAR traffic that goes through `electronAPI.edgarFetch` is not subject to renderer `connect-src`, but `edgar:fetch` must still allowlist hostnames.

**Static check required:** every URL string in `src/` vs those six hosts vs the EDGAR IPC path. Pay special attention to `www.sec.gov`, `efts.sec.gov`, `europepmc.org`, `doi.org`, `pubmed.ncbi.nlm.nih.gov` — outbound *navigation* via `open-external` is fine; renderer *fetch* is not.

---

## 4. How Muse works

### 4.1 Method

1. Inventory from code, not from memory of the docs. Fill §8 matrix first.
2. Separate **FACT** (what the code does) / **INTERPRETATION** (why it is a problem) / **FIX** (suggestion only).
3. Every finding cites `path` + `symbol` + a short quoted snippet or exact behavior.
4. One issue per finding. Stable IDs: `FIN-001`, `FIN-002`, …
5. Prefer a 20-line Node reproduction or “add this assert to `math_verification.js`” over a paragraph.
6. For globals, search both `function` and `async function`, plus `const X =` / `let X =` / `class X` at top level. A grep that misses `async` already produced a false all-clear.
7. Do not snapshot the app’s own output as an expected math value.
8. Do not “correct” `data.js` benchmarks. They are sourced tables. You may only flag composition bugs downstream, or a table cell that contradicts its own cited source *if you actually open that source*.
9. If you cannot prove it statically, `BLOCKED` + exact next action for Claude. A blocked row is useful. A guessed P0 is not.

### 4.2 Severity

- **P0** — wrong money on a normal case; data loss; white screen; global name collision; executable snapshot in the report; secret / IPC escape; CSP that blanks the packaged app; NaN/Infinity in a fair value.
- **P1** — wrong money on a documented path (Quick vs Full, DCF vs Simple Multiple, partnership, dilution-path + manual raise, launchYear 0, price basis / NPR, royalty territory, CMS partial-year compare); live API empty-vs-error collapse; stale/cross-ticker race; generation-unguarded search; units display ≠ stored ≠ used.
- **P2** — edge math; confusing empty state; tab-state loss; operator-error copy; font/number formatting that can be misread as a different magnitude.
- **P3** — polish, alignment, stale secondary docs, copy nits.
- **P4** — nits.

Also tag with the Findings TODO colors when a row should later be copied there: 🔴 P0/P1 · 🟡 P2 · 🔵 unconfirmed · 🟢 would-be-fixed (Muse never marks 🟢 for its own new items).

### 4.3 Finding template (use verbatim)

```
### FIN-XXX — short title
- Severity:
- Surface: view / module / function
- Status: OPEN | BLOCKED | FALSE-POSITIVE-CANDIDATE
- Evidence: `file:symbol` + what you saw
- Repro (static): how to see it in source
- Repro (Claude): clicks / inputs / NCT / ticker if runtime needed
- Expected:
- Actual:
- Why it matters ($ or decision risk):
- Blast radius:
- Suggested fix (do not apply):
- Test to add:
```

---

## 5. Work order — complete every phase before the next

Update §8–§11 as you go. Do not skip to “executive brief.”

### Phase A — Tree and contract (no quality opinions) — DONE 2026-09-23

- `git rev-parse HEAD`, file counts (`src/` = 38?), `MODULE_ORDER` ↔ disk. — done, §8.1
- README “12 suites” ↔ `test/run_all.js` ↔ files on disk. — 12/12, §8.1
- README “1,032 checks” ↔ actual count / banner inside `math_verification.js`. — 1,032, §8.1
- README “403” export checks ↔ `export_coverage_test.js`. — 403, §8.1
- Electron version, builder target (`zip` / arm64 only). — ^44.4.4, §8.1
- Doc drift table in §9. — done, §9

### Phase B — Backbone, globals, persistence, security — DONE 2026-09-23

- Duplicate globals: **0 found** (async-aware scan: `function`, `async function`, top-level `const`/`let`/`class` across all 38 files). §8.5
- `window.*` bridges: only intentional `window.rxnpvSimBridge` (`simulationView.js`). §8.5
- `pdcf` residue: migration table + comments only; `migrateLegacyStorageKeys()` migrate-then-delete; no new writes. ✅
- Two-layer error boundary present; `programs: null` contained (regression suite). ✅
- Destructive actions: modal confirm for case/program delete; two-click + 3s auto-disarm + Escape for smaller ones. ✅
- Failed saves return failure and warn. ✅
- API caches/snapshots/pins byte-capped. ✅
- CSP vs fetch URLs: renderer fetches only the six CSP hosts; `www.sec.gov`/`efts.sec.gov` via EDGAR IPC; DOI/PubMed/EuropePMC-article/Open-Targets pages are outbound links, not fetches. ✅
- IPC: exactly six handlers; EDGAR allowlists `sec.gov` + 20s timeout + EDGAR user-agent; `open-external` http(s) only. ✅
- Offscreen export windows: section window sandboxed, no preload, JS on only to measure; chart-PDF window sandboxed, JS off. ✅
- Snapshot sanitiser matches README claims (script/iframe/object/embed/link/meta/base/template out; `on*`, `javascript:`, `expression()`, non-`data:image` out). ✅
- Single `dangerouslySetInnerHTML`: `ReportSnapshot` at `src/reportView.js:479`, sanitised at capture and render. ✅
- `build.js` function replacers (lines 105, 130); CSP hash from finished script text (line 129). ✅
- **No new Phase B defect opened.** Disclosed missing `will-navigate`/`setWindowOpenHandler`: no new escape path found.

### Phase C — Every input and unit convention — DONE 2026-09-23

- Units contract holds display/stored/used on the audited inputs except: **FIN-001** (Bear/Bull peak-revenue override), **FIN-003** (Peak Sales MC 0–1 fractions), **FIN-012** (peak-share >100%).
- Input table in §8.4.

### Phase D — Math and model composition — DONE 2026-09-23

- Re-derived from source. Findings: FIN-001, FIN-002, FIN-007, FIN-008, FIN-009, FIN-010, FIN-011.
- Independently re-verified by Spark: FIN-001 (`valuationPanel.js:505-511`), FIN-002 (`scenarioEngine.js:262-269` vs PRV block at 220-228), FIN-010 (`scenarioEngine.js:1068-1070`).

### Phase E — Conviction tools and API engines — DONE 2026-09-23

- All 25 checklist items inspected; 23 clean with one-line evidence each (see notes below §8.2), 2 checklist gaps became findings: **FIN-004** (AE denominators), **FIN-005** (Form 4 stale race), **FIN-006** (Exclusivity race guard).
- Fixtures in `test/math_verification.js` are defensible (encode real-world quirks: string numerics, free-text milestone types, DAPA-HF-style single-group HRs, log-HR refusal) but cannot detect CT.gov schema drift → **B-012** (live-canary pack).

### Phase F — UI structure, export, copy, type (static only) — DONE 2026-09-23

- Export mechanism verified as declared boundaries (`data-export-section`), not just CSS classes; `+ Report` live-toggle vs snapshot path both covered by tests; no view README claims lacks a section declaration.
- Copy: PoS "70%" misreading already remediated; FAERS/Form 4 empty-state copy clean; Bear/Base/Bull not color-only (text labels + chart legend names); Simulation uses theme tokens exclusively (no ad-hoc palette); tabular figures via mono stack.
- Findings: **FIN-013** (dead no-timeout fetcher), **FIN-014** (Ka/Ke labels). No P0/P1/P2 in Phase F.

### Phase G — Tests and release contract — DONE 2026-09-23

- `test/run_all.js`: 12 suites ↔ README “12 suites” ↔ 12 files on disk. ✅
- `npm test` (clean clone, Node v24.20.0): **12/12 passed.**
- `npm run test:dev` (stricter, React dev build): **12/12 passed.**
- `math_verification.js`: **1,032/1,032 checks passed.**
- `export_coverage_test.js`: **403/403 checks passed** (Workspace 10 sections, Tools 27, Simulation 13, Reference Sheet 52).
- `node build.js`: passed — "Reassembled 38 modules → electron/rxnpv.html (1593 KB)".
- Every P0/P1 mapped to a missing test in §10. No P0 filed.
- `electron-winstaller` optional-script warning: not reopened (no Windows packaging).

### Phase H — Synthesize — DONE 2026-09-23 (§10, §11, §12 filled below).

---

## 6. Suggested live fixtures (for Claude; Muse only notes if parsers special-case them)

- Trials: NCT03036124 (DAPA-HF), NCT02578680 (KEYNOTE-189), NCT04368728 (mega-trial)
- Drugs: dapagliflozin / Farxiga, sotatercept / Winrevair, selexipag / Uptravi (CMS asterisk)
- Genes: PCSK9, TTR
- Company: VRTX
- Workspace smoke (README): New case → peak revenue `1000` → diluted shares `100000000` → a valuation appears immediately

---

## 7. Prior bugs that must still be true in code (regression scan)

Do not treat the September 2026 close-out as proof. Verify the *fix still exists*. If the fix is gone, that is a P0/P1, not a history note.

*Spark regression verification 2026-09-23 (full sweep via delegated subagents + direct code reads; no fix implemented):*

| Closed item | What must still be true | Observed |
|---|---|---|
| `ctgovFetch` collision | Tools and Simulation use distinct names; Tools path has a timeout | ✅ `ctgovEngine.js` defines `ctgovFetch` (15s abort); `ts_ctgovEngine.js` defines `tsCtgovFetch` (15s abort). No collision. |
| `pdcf_` keys | migrate-then-delete; no new writes | ✅ `migrateLegacyStorageKeys()` (`app.js:23`) copies-then-deletes; no new `pdcf_` writes in `src/` (migration table + comments only). |
| Vendored React | no unpkg/cdn script tags in `shell.html` / packaged html | ✅ no unpkg/cdn tags; `electron/vendor/` present; `shell.html` loads vendored copies. |
| Partnership COGS | royalty-tagged revenue not loaded with licensor COGS/marketing | ✅ no regression found. |
| Quick royalty | Quick treats the deal as global | ✅ no regression found. |
| Simple Multiple partnership | `computePartnershipContribution` used by both methods | ✅ still called by both (comment at `scenarioEngine.js:255-261` documents the prior silent-$170M bug). |
| R&D vs launch year 0 | remaining cost never dropped; long timelines compress, not pile | ✅ no regression found. |
| Live outage ≠ empty | FDA, CIK, Catalyst, and any new host | ✅ `Promise.allSettled` + distinct zero/error/partial states; all fetchers abort (15s renderer, 20s EDGAR IPC). |
| Search generation guards | Lookup / explorer / competitor / comps | ⚠️ **2 exceptions filed**: FIN-005 (Form 4 stale panel), FIN-006 (ExclusivityTool no guard). All other surfaces guarded. |
| EDGAR cash / converts / shares | periodMonths; sum notes; point-in-time shares | ✅ no regression found (shortest-periodMonths cash, tranche-summed converts, point-in-time shares before EPS averages). |
| Price basis default | ASP + no NPR ≡ old cases | ✅ no regression found. |
| Report snapshots | sanitised twice; only one `dangerouslySetInnerHTML` | ✅ exactly one, `ReportSnapshot` (`reportView.js:479`), sanitised at capture and render. |
| `build.js` replace | function replacer, not string | ✅ replacer functions at `build.js:105, 130`. |
| CSP hash | from finished artifact | ✅ `crypto.createHash('sha256')` at `build.js:129` on exact finished script text. |

---

## 8. Surface inventory (Muse fills)

### 8.1 Tree

| Item | Expected (at f49689f) | Observed | Notes |
|---|---|---|---|
| HEAD | fill | `f49689f` / `f49689f191fe6eaf73cc075e5fe4ae6f00ec4c59` | `git rev-parse` on clean clone 2026-09-23; matches protocol tree |
| `src/*.js` count | 38 | 38 | `ls src/*.js` = 38 files |
| `MODULE_ORDER` length | 38, matches disk | 38, matches disk | `build.js` MODULE_ORDER = 38 quoted entries; `node build.js` → "Reassembled 38 modules → electron/rxnpv.html (1593 KB)"; every `src/*.js` on disk appears exactly once |
| Electron | ^44.4.4 | ^44.4.4 | `electron/package.json` devDeps; builder `mac.target: zip`, `arch: [arm64]` only |
| Test suites in `run_all.js` | 12 | 12 | SUITES array in `test/run_all.js` = 12 entries (math, export, export_coverage, final_regression_pass, final_sweep, new_features, full_recovery_verify, recovery_errorboundary, storage_warning ×4) |
| `math_verification.js` checks | 1032 | 1032 | Ran `node math_verification.js`: "ALL MATH VERIFICATION PASSED — 1032 checks" |
| `export_coverage_test.js` checks | 403 | 403 | Ran `node export_coverage_test.js` (after `node setup.js`): "ALL EXPORT COVERAGE CHECKS PASSED — 403 checks"; sections audited — Workspace 10, Tools 27, Simulation 13, Reference Sheet 52 |

### 8.2 Views and tools

| Surface | Module(s) | Tests | Status | Notes |
|---|---|---|---|---|
| App shell, nav, theme | `app.js` | regression | SEEN | 6 top-level areas (`workspace \| reference \| tools \| simulation \| portfolio \| report`); two-layer error boundary; theme toggle |
| Workspace / cases | `caseShell.js` | regression | SEEN | case CRUD, modal confirm on delete |
| Program editor | `programEditor.js` | regression | SEEN | Quick/Full modes, partnership terms, PRV |
| Valuation panel | `valuationPanel.js` | regression + math | SEEN | **FIN-001** (peak-revenue override $M/dollars mismatch); **FIN-011** (bridge foot) |
| Revenue Quick | `engine.js` | math | SEEN | launch-curve path covered by math_verification |
| Revenue Full + price basis + NPR | `engine.js` | math | SEEN | Table 4-1 ASP conversion; default ASP + no NPR ≡ old cases (regression held) |
| Napkin / Full presets | `valuationPanel.js` / `programEditor.js` | regression | SEEN | presets hide inputs the method does not read |
| DCF | `dcfEngine.js` | math | SEEN | year-end discounting convention consistent |
| Simple Multiple | `dcfEngine.js` / valuation | math | SEEN | still calls `computePartnershipContribution` (prior $170M bug stays fixed) |
| Bear / Base / Bull | `scenarioEngine.js` | math | SEEN | scenario cards show absolute modeled PoS ("PoS 6.1%") or "70% of modeled PoS" — the old misreading is remediated |
| Costs / sales force / COGS | `costEngine.js` | math | SEEN | royalty-tagged revenue excluded from licensor COGS/marketing |
| R&D timeline | `rdEngine.js` | math | SEEN | launchYearOffset 0: remaining cost never dropped; long timelines compress |
| PoS + modifiers | `posEngine.js` | math | SEEN | stage composition; completed phases not re-multiplied |
| Capital / dilution path / raise | `capitalEngine.js` | math | SEEN | dilution path + manual raise compose without clobbering |
| PRV | `scenarioEngine.js` | — | SEEN | **FIN-008**: no independent math check |
| Partnership economics | `scenarioEngine.js` | math | SEEN | **FIN-002**: milestones ignore scenario PoS |
| Case Monte Carlo 3000 | `scenarioEngine.js` | — | SEEN | **FIN-009**: no independent coverage; **FIN-010**: degenerate-bound sampler defect |
| Implied PoS / reverse-solve | `scenarioEngine.js` | — | SEEN | **FIN-007**: ignores PoS override |
| Model red flags | `scenarioEngine.js` | math | SEEN | `computeRedFlags` covers user's model inputs only; separate from decoder/design flags |
| Evidence Log | `caseShell.js` | regression | SEEN | two-click delete |
| Calibration Log / Brier | `caseShell.js` | regression | SEEN | — |
| SOTP / risk waterfall | `valuationPanel.js` | math | SEEN | 2+ programs; shared G&A drag path |
| Reference Sheet (9 tabs) | `referenceSheet.js` | sweep + export | SEEN | 52 sections in export coverage; "⚠ Overall vs. regulatory-stage PoS" explainer card present |
| Tools IA (6 workbenches) | `toolsView.js` | sweep | SEEN | 27 cards in export coverage; `TOOL_WORKBENCHES` = 6 benches, 18 tools (4+2+4+2+3+3) — matches README/CLAUDE.md |
| Trial Decoder | `trialDecoder.js` | — | SEEN | "not stated" defaults; no randomized/open-label guessing; 4-arm / 5-endpoint caps; mega-trial layout bounded |
| Results reader | `trialResults.js` | — | SEEN | **FIN-004**: per-event AE rates lack denominators; deaths ≠ dropout; OLE transitions separated; no arm inference |
| Asset Program | `assetProgram.js` | — | SEEN | counts only, deliberately no composite score (UI explains why) |
| Trial Explorer + Watch + analog board | `ctgovEngine.js` `toolsView.js` | — | SEEN | Watch diffs **13** fields, not 14 → doc drift §9; phantom-diff guard present; analog board shows "k extractable of n" |
| FDA Lookup | `fdaEngine.js` | — | SEEN | `Promise.allSettled`; zero/error/partial distinct; biologic path explained; FAERS caveat shown |
| Target Dossier | `openTargetsEngine.js` | — | SEEN | `drugAndClinicalCandidates` filter; association score labelled context, not probability; not a PoS input (by design) |
| Literature | `literatureEngine.js` | — | SEEN | Europe PMC; publication-type split; empty vs error distinct |
| Company Lookup + Form 4 | `edgarEngine.js` | — | SEEN | **FIN-005**: stale insider panel race; P/S vs awards split correct; shortest-periodMonths cash; tranche-summed converts; point-in-time shares |
| Catalyst Calendar | `ts_ctgovEngine.js` | — | SEEN | per-source failures surfaced as incomplete, never silent empty |
| Cash Runway | `commercialEngine.js` | — | SEEN | — |
| Runway vs Catalyst | `commercialEngine.js` | — | SEEN | — |
| Launch & Actuals | `cmsEngine.js` `commercialEngine.js` | — | SEEN | quarterly datasets; ~1-quarter lag disclosed; partial periods tagged "partial"; asterisk-name fallback (Uptravi) |
| Exclusivity / LOE | `fdaEngine.js` | — | SEEN | **FIN-006**: no generation guard; biologic/Purple-Book path explained |
| Sensitivity | `scenarioEngine.js` | — | SEEN | tornado calls the same `computeCaseValuation` |
| Binary Event | `ts_simulationEngine.js` | math | SEEN | — |
| Diluted Market Cap | `valuationPanel.js` | math | SEEN | — |
| M&A / Peak / Licensing comps | `data.js` | — | SEEN | custom CRUD; two-click delete; `SIMPLE_MULTIPLE_PRECEDENTS` correctly not counted as M&A |
| Simulation shell | `simulationView.js` `ts_app.js` | sweep | SEEN | `window.rxnpvSimBridge` intentional bridge; theme tokens only |
| Trial Outcome / assurance | `ts_simulationEngine.js` | math | SEEN | survival curves; free-text effect-type matching; log-scale measures refused |
| Phase 2→3 | `ts_simulationEngine.js` | — | SEEN | concordance factors used as documented, not as PoS |
| Trial Statistics ×7 | `ts_statsEngine.js` | math + new_features | SEEN | incl. assumption-stress |
| Meta-analysis | `ts_statsEngine.js` | math | SEEN | — |
| Peak Sales MC | `ts_peakSalesEngine.js` | — | SEEN | **FIN-003** (0–1 fraction units); **FIN-012** (share >100%); export-to-case path present |
| PK/PD + occupancy | `ts_pkpdEngine.js` | math | SEEN | closed forms; occupancy 50% at K_D; **FIN-014** (Ka/Ke label casing) |
| Portfolio | `portfolioView.js` | — | SEEN | all cards carry export sections |
| Report + snapshots | `reportView.js` `exportEngine.js` | export* | SEEN | one `dangerouslySetInnerHTML` (`reportView.js:479`, sanitised); snapshots byte-capped; `+ Report` live-toggle vs snapshot both tested |
| Section export PNG/PDF/SVG | `exportEngine.js` + main IPC | export* | BLOCKED | jsdom has no layout → **B-002**; mechanism verified statically (declared `data-export-section` boundaries) |
| Error boundary | `app.js` | recovery_* | SEEN | two layers; `programs: null` contained |
| Storage banner | `app.js` | storage_warning_* | SEEN | user data vs API cache distinguished; caches byte-capped; failed writes warn |
| Build / CSP hash | `build.js` `shell.html` | none in jsdom | SEEN | function replacers; hash from finished artifact |
| Preload / main | `electron/*` | none | SEEN | 6 IPC handlers; sandbox/contextIsolation; EDGAR allowlist + 20s timeout + UA |

*Phase E clean-item evidence (one line each): decoder "not stated" defaults (`trialDecoder.js`); free-text effect types + log-HR refusal (`ts_ctgovEngine.js`, tests at `math_verification.js:1942–1952`); red-flag separation (`trialDecoder.js:147`, `trialResults.js`, `scenarioEngine.js:754`); AE ranking denominator guard (primaryGroups); Watch phantom-diff skip (`snapshotPredatesDesignFields`); OLE/extension transitions (`TR_TRANSITION_RE`); mega-trial caps (4 arms / 5 endpoints / 8 primaries / 12 categories / 10 secondaries, horizontal-scroll wrappers); Form 4 empty-state copy ("in the filings checked"); FAERS "no denominator" caveat.*

### 8.3 Live hosts

| Host | Used by | Renderer fetch or IPC | Timeout | Empty vs error | Generation guard | Status |
|---|---|---|---|---|---|---|
| clinicaltrials.gov | Tools (`ctgovFetch`, `ctgovEngine.js`) + Simulation (`tsCtgovFetch`, `ts_ctgovEngine.js`) | renderer fetch | 15s AbortController, both families | distinct (decoder states; Catalyst per-source failure counts) | yes (`seq`, `papersSeq`; Explorer `compsSeq`/`effectsSeq`/`checkSeq`) | SEEN |
| api.fda.gov | FDA / Orange Book / FAERS (`fdaEngine.js`; `ts_fdaEngine.js`) | renderer fetch | 15s AbortController | `Promise.allSettled` → total / partial / zero distinct | yes (`resSeq`) | SEEN |
| data.sec.gov | EDGAR facts / submissions (`edgarEngine.js`) | IPC (`edgar:fetch`) | 20s main-side | distinct | yes (`searchSeq`) | SEEN |
| www.sec.gov / efts.sec.gov | tickers, archives, full-text (`edgarEngine.js`) | IPC only | 20s main-side | distinct | yes (`searchSeq`) | SEEN |
| api.platform.opentargets.org | Target Dossier (`openTargetsEngine.js`) | renderer fetch | `OT_TIMEOUT_MS` abort | `notFound` vs `unreachable` distinct | yes (`seq`) | SEEN |
| www.ebi.ac.uk | Literature / Europe PMC (`literatureEngine.js`) | renderer fetch | `EPMC_TIMEOUT_MS` abort | empty ("Nothing indexed matches") vs amber error distinct | yes (`seq`) | SEEN |
| data.cms.gov | Launch tracker (`cmsEngine.js`) | renderer fetch | `CMS_TIMEOUT_MS` abort | partial periods tagged "partial"; ~1-quarter lag disclosed | yes (`seq`) | SEEN |

### 8.4 Inputs

| Field | Units | Parser | Valid range | Invalid behavior | Displayed as | Stored as | Consumed as | Status |
|---|---|---|---|---|---|---|---|---|
| Peak worldwide revenue | $mm | numOr | ≥ 0 | empty → 0 | $M (`MillionsField`) | millions | ×1e6 in engine | SEEN |
| Fully diluted shares | raw count | numOr | > 0 | empty → per-share null | raw, placeholder "e.g. 50000000", no $M suffix | raw | raw | SEEN |
| Current price | $/sh | numOr | ≥ 0 | — | $ | dollars | dollars | SEEN |
| Discount rate | % 0–100 | numOr | 0–100 | — | % | percent | /100 | SEEN |
| PoS override | % 0–100 or blank | numOr | 0–100 / blank | blank → benchmark | % | percent | /100 | SEEN |
| US annual price | raw $ | numOr | ≥ 0 | — | $ | dollars | dollars | SEEN |
| Price basis | ASP/WAC/AWP/Retail | select | fixed set | n/a | label | key | key | SEEN (default ASP + no NPR ≡ old cases) |
| Net price realisation | % | numOr | 0–100 | — | % | percent | /100 | SEEN |
| Launch year offset | years | numOr | ≥ 0 int | 0 → remaining R&D kept, timeline compresses | years | number | years | SEEN |
| Years to LoE | years | numOr | ≥ 0 | — | years | number | years | SEEN |
| COGS | % | numOr | 0–100 | — | % | percent | /100 | SEEN |
| Bear/Bull peak-revenue override | **$M label / dollars stored** | numOr | ≥ 0 | — | **stored dollars shown verbatim + "$M" suffix** | **dollars (×1e6 on write)** | dollars | **FIN-001** |
| Peak Sales MC diagnosis / treatment / share | **0–1 fractions, unlabeled** | numOr + tsClamp01 | 0–1 | **typing 60 clamps to 1.0 silently** | fraction | fraction | fraction | **FIN-003** |
| Peak Sales MC share override | % (share) | numOr | — | **>100% accepted silently** (red flag only >2× benchmark) | % | percent | /100 | **FIN-012** |
| Scenario PoS multiplier | % | numOr | 0–100+ | — | % | percent | /100 | SEEN |
| Scenario share multiplier | % | numOr | 0–100+ | — | % | percent | /100 | SEEN |
| Discount-rate adjustment | pp | numOr | any | — | pp | number | added to base | SEEN |

Parser spot-checks (empty → 0/blank default; `$1,200.50`, `12%`, commas, `1.2e7` handled by numOr; `—` → 0): no new defects beyond the three findings above.

### 8.5 Global-collision log

| Name | Files that bind it | Safe / collide | Notes |
|---|---|---|---|
| *(all top-level bindings)* | 38 files scanned | SAFE | **0 duplicates.** Async-aware scan: `function`, `async function`, top-level `const`/`let`/`class` across all 38 `src/*.js` files. |
| `window.rxnpvSimBridge` | `simulationView.js` only | SAFE (intentional) | Only deliberate renderer bridge; no other `window.*` assignments. |
| `pdcf_*` legacy keys | `app.js` migration table only | SAFE | `migrateLegacyStorageKeys()` migrate-then-delete; no new writes anywhere in `src/` or `electron/`. |
| `dangerouslySetInnerHTML` | `reportView.js` (`ReportSnapshot`, line 479) only | SAFE | Single occurrence; HTML sanitised at snapshot capture and again at render. |
| `ctgovFetch` / `tsCtgovFetch` | `ctgovEngine.js` / `ts_ctgovEngine.js` | SAFE | Distinct names by design (the prior P0 collision stays fixed). |

---

## 9. Doc drift (Muse fills)

| Document | Claim | Code | Severity | Action |
|---|---|---|---|---|
| `docs/RxNPV_Human_Test_Checklist.md` | Chemistry tab, "All four top-level views", old Gatekeeper right-click-Open path | File now opens with "> **Historical — superseded.**" banner pointing at README test steps. Body still teaches the removed Chemistry tab and obsolete IA (verified: zero RDKit residue in `src/`/`electron/`/`shell.html`; `app.js:91` = 6 views). | P3 — expected, still stale (self-labeled) | Confirm still stale: YES, but banner is a weak guard — recommend archiving the file out of `docs/` or replacing the body with a pointer. Do not change code. |
| `docs/RxNPV_Feature_Map.md` §10 item 6 | "Electron upgrade — deferred by the user… **the only item left on this list**" (`:163`) | `electron/package.json:11` = `"electron": "^44.4.4"`; `docs/RxNPV_Findings_TODO.md:13` — "The Electron upgrade was the last item on this list, and it closed on 2026-09-22"; "Still open: Nothing." | P3 doc drift — confirmed | Strike/mark item 6 done (2026-09-22, Electron 44.4.4); remove "the only item left on this list". Do not change code. |
| Trial Watch field count | "diff 14 fields" — `README.md:106`, `docs/RxNPV_Feature_Map.md:20`, `CLAUDE.md:113`, `docs/RxNPV_External_Suggestions_Tracker.md:451` | `src/ctgovEngine.js:254` `CTGOV_DIFF_FIELDS` = 9 entries + exactly 4 supplemental comparisons in `diffTrialSnapshots` (`primaryOutcomes`, `armLabels`, `secondaryOutcomes`, `eligibilityCriteria`) = **13** | P3 doc drift — confirmed | Change the four doc locations to "13 fields". Do **not** add a field to make the number true. Consider a doc-drift lint test asserting code count == documented count. |
| README module count | 38 (`README.md:214, 285`) | 38 files on disk; 38 `MODULE_ORDER` entries; 1:1 both directions (verified by script) | — | No drift. |
| README Feature overview | 6 areas; Chemistry mentioned only as "built, then removed" (`:261`) | `app.js:91` = 6 top-level views; zero RDKit residue in `src/`/`electron/`/`shell.html`/`build.js` | — | No drift. |
| CLAUDE.md vs README tool counts | both: "six workbenches, 18 tools" (`README.md:102`, `CLAUDE.md:77`) | `TOOL_WORKBENCHES` = 6 benches; tools 4+2+4+2+3+3 = 18 | — | No drift. |
| Findings TODO "Still open: Nothing" | "Still open: Nothing. The Electron upgrade was the last item on this list, and it closed on 2026-09-22" (`:13`) | Electron `^44.4.4` installed; upgrade notes present. **However**: this audit opens 6 new P1s — the "nothing open" claim is true for the *September* scope but stale against this audit until §10 is dispositioned. | — (statement present; validity now conditional) | Claude: after dispositioning §10, update this line or move new items into the TODO. |

## 10. Findings (Muse appends FIN-001…)

14 findings. Doc-drift items live in §9 (not duplicated here). Every finding below uses the §4.3 template verbatim. P1s were independently re-verified against source by Spark on 2026-09-23.

### FIN-001 — Bear/Bull peak-revenue override displays stored dollars as `$M`
- Severity: P1 🔴
- Surface: view / Valuation panel / Bear-Base-Bull scenario overrides (`BenchField`)
- Status: OPEN
- Evidence: `src/valuationPanel.js:505-511` — `onChange: v => { … [key]: { peakRevenue: v ? String(Math.round(Number(v) * 1e6)) : "" } } }` stores **dollars**, while `value: ((p.quickRevenue || {}).scenarioOverrides || {})[key] ? … .peakRevenue : ""` renders the stored value verbatim with `suffix: "$M"`.
- Repro (static): read `valuationPanel.js:503-511`; compare with every other revenue field, which uses `MillionsField` (millions in, millions out, millions displayed).
- Repro (Claude): Workspace → Valuation → Bear/Base/Bull → type `1000` in a program's "peak revenue override" → the field shows `1000000000` next to `$M`. Save, re-open, edit again → the assumption compounds by another ×1e6.
- Expected: display / stored / used all in $M, like every other revenue field in the app.
- Actual: stored in dollars, displayed as if $M; re-editing multiplies the scenario assumption by 1e6 each time.
- Why it matters ($ or decision risk): a scenario override meant to read "$1,000M" displays as $1,000,000,000M, and a second edit silently multiplies the assumption by another million. Direct wrong-money path on a documented input; violates the protocol's units contract (display ≠ stored).
- Blast radius: any case with per-program Bear/Bull peak-revenue overrides.
- Suggested fix (do not apply): store millions (drop the ×1e6 on write) or display `stored/1e6`; either way make the round-trip identity hold.
- Test to add: jsdom or `math_verification.js` — write a scenario peak-revenue override, read it back, assert the same $M value; assert two consecutive edits do not compound.

### FIN-002 — Partnership milestones ignore scenario PoS multipliers and per-program PoS override
- Severity: P1 🔴
- Surface: module / `computePartnershipContribution` (`src/scenarioEngine.js`)
- Status: OPEN
- Evidence: `src/scenarioEngine.js:262-269` — `const posW = computePoSWeighting(prog);` uses the **raw benchmark** PoS; milestone gate probability `posToGate = posW.posToLaunch` (launch gate) or `stage.posToReachStage` (stage gates). The adjacent PRV block (`src/scenarioEngine.js:220-228`) correctly uses the effective, scenario-adjusted `pv.posToLaunch` ("risk-adjusted by that program's own PoS").
- Repro (static): golden check — program with a per-program PoS override of 50% vs benchmark 10%: milestone contribution is identical in both cases. Bear scenario with a 30% PoS haircut: milestone contribution unchanged.
- Repro (Claude): build a case with partnership milestones + a Bear scenario PoS multiplier → milestone contribution does not move across scenarios, while the program's own revenue does.
- Expected: milestones risk-adjusted by the same effective PoS the rest of the case uses (override-aware, scenario-scaled).
- Actual: milestones always use raw benchmark PoS.
- Why it matters ($ or decision risk): Bear/Bull scenarios and per-program PoS overrides silently do not touch milestone value — the scenario analysis misstates deal economics on a documented path (Quick × partnership × scenarios).
- Blast radius: any case with partnership milestones combined with PoS overrides or Bear/Bull PoS multipliers.
- Suggested fix (do not apply): thread the effective `posToLaunch` (scenario-scaled, override-aware, as used for the program's own valuation) into `computePartnershipContribution` instead of calling `computePoSWeighting(prog)` fresh.
- Test to add: `math_verification.js` — milestone contribution changes with a Bear PoS multiplier; milestone contribution respects a per-program PoS override; PRV and milestones use the same effective PoS on one fixture.

### FIN-003 — Peak Sales MC diagnosis/treatment/share rates are 0–1 fractions with no unit label; typing 60 silently clamps to 1.0
- Severity: P1 🔴
- Surface: Simulation / Peak Sales MC (`src/ts_app.js`, `src/ts_peakSalesEngine.js`)
- Status: OPEN
- Evidence: `src/ts_app.js:1586-1588` — defaults `a: 0.6`, `a: 0.5`, `uniform a: 0.15 b: 0.35`; `src/ts_peakSalesEngine.js:39-41` — `tsClamp01(sampleInput(...))`. Protocol units contract (§5 Phase C): percents are 0–100 whole numbers unless a specific field documents otherwise; these fields carry no unit label.
- Repro (static): read the field defs against the units contract.
- Repro (Claude): Simulation → Peak Sales MC → type `60` in Diagnosis rate → value becomes `1.0` with no warning.
- Expected: 0–100 whole percents like the rest of the app, or an explicit "fraction (0–1)" label on the field.
- Actual: 0–1 fractions; whole-number input silently clamps to 1.0.
- Why it matters ($ or decision risk): a user typing the app's normal percent convention gets a silently maxed-out rate — the entire peak-sales distribution is wrong with no signal. Units display ≠ used.
- Blast radius: Peak Sales MC tab and anything exported from it to a case.
- Suggested fix (do not apply): accept 0–100 and divide by 100 internally, or label the fields "fraction (0–1)".
- Test to add: input `60` → engine receives `0.60`, not `1.0`; label contains a unit.

### FIN-004 — Per-event adverse-event table renders rates without denominators
- Severity: P1 🔴
- Surface: view / `TrialResultsPanels` (AE event table) (`src/toolsView.js`)
- Status: OPEN
- Evidence: `src/toolsView.js:2824` — `e.byGroup[g.id] ? pct(e.byGroup[g.id].rate) : "—"` renders a bare percent. The safety-summary table directly above shows `pct(g.serious.rate) + (g.serious.atRisk ? " (" + num(g.serious.affected) + "/" + num(g.serious.atRisk) + ")" : "")`. The denominator data exists on the same object: `src/trialResults.js` `trEventRows` builds each `byGroup[gid]` as `{ affected: trNum(s.numAffected), atRisk: trNum(s.numAtRisk), events: trNum(s.numEvents), rate: trRate(...) }` — `affected`/`atRisk` are simply not rendered.
- Repro (static): read `toolsView.js:2824` against the summary table three lines up.
- Repro (Claude): Tools → Trial Decoder → `NCT03036124` → Adverse events → each per-event cell shows "x.x%" with no n/N, while the summary table above shows `(affected/atRisk)`.
- Expected: every rate has a denominator (the app's own learned lesson — the summary table follows it).
- Actual: per-event AE cells are denominator-free.
- Why it matters ($ or decision risk): a 50% event rate on n=4 reads identically to 50% on n=400; small-arm rates mislead the safety comparisons that feed risk-adjustment of valuations.
- Blast radius: every decoded trial with posted adverse events (the decoder is the flagship tool).
- Suggested fix (do not apply): render `" (affected/atRisk)"` in small grey text inside each event cell, mirroring the summary-table idiom.
- Test to add: jsdom/render check that `TrialResultsPanels` event cells include the fixture's `affected`/`atRisk` values — e.g. `numAffected: 40, numAtRisk: 200` renders "20.0% (40/200)".

### FIN-005 — Company Lookup: Form 4 insider panel survives a new company search (stale race)
- Severity: P1 🔴
- Surface: view / `CompanyLookupTool` (insider-transactions section) (`src/toolsView.js`)
- Status: OPEN
- Evidence: `src/toolsView.js:328-341` — `search()` clears `edgarResult`, `trialsResult`, errors and `exportMsg` but never calls `setInsiderResult(null)`/`setInsiderError(null)`; the only `setInsiderResult(null)` in the file is inside `loadInsiderActivity` itself (line 380). The insider panel renders at lines 424–501 under the gate `edgarResult && h("div", …)` with `insiderResult && (…)`. Additionally `loadInsiderActivity` has no sequence ref, unlike `search` (`searchSeq`) and `searchCompetitors` (`compSeq`).
- Repro (static): search company A → "Load insider activity (Form 4)" → search company B → `insiderResult` (A's filings) still truthy, so A's Form 4 panel re-renders inside B's "EDGAR financials" block.
- Repro (Claude): Tools → Company Lookup → search a company, load insider activity → search a different company → Form 4 panel still shows the first company's insiders under the second company's name.
- Expected: in-flight edit / new search cannot paint company A's data under company B's name (the comment at lines 322–324 states this exact lesson for `searchSeq`).
- Actual: the Form 4 panel is the one section the guard doesn't cover — the learned generation-guard lesson, violated on one surface.
- Why it matters ($ or decision risk): insider buying/selling is a valuation input; attributing company A's executives' trades to company B is a direct misattribution of a buy/sell signal.
- Blast radius: Company Lookup tab, desktop only (EDGAR path).
- Suggested fix (do not apply): clear `insiderResult`/`insiderError` in `search()`; capture the active CIK + a sequence number in `loadInsiderActivity` and discard the result if a newer search has superseded it.
- Test to add: jsdom — populate `insiderResult`, trigger `search()`, assert the insider panel unmounts; slow-resolve `fetchInsiderTransactions` while a newer search completes, assert the stale result is not painted.

### FIN-006 — ExclusivityTool has no generation/stale-race guard
- Severity: P1 🔴
- Surface: view / `ExclusivityTool` (`run`) (`src/toolsView.js`)
- Status: OPEN
- Evidence: `src/toolsView.js:964-975` — `const run = async () => { if (!name.trim()) return; setLoading(true); setRes(null); try { setRes(await fetchExclusivity(name)); } catch (e) { setRes({ ok: false, error: e.message }); } setLoading(false); };` — no sequence ref, unconditional `setRes`. Every sibling FDA-backed lookup has one: `FdaLookupTool` (`resSeq`), `CompanyLookupTool` (`searchSeq`/`compSeq`), `TargetDossierTool` (`seq`), `LaunchTrackerTool` (`seq`), decoder (`seq`/`papersSeq`), Trial Explorer (`compsSeq`/`effectsSeq`/`checkSeq`), literature (`seq`).
- Repro (static): `ExclusivityTool` is the only async lookup tool without `useRef` sequence tracking (the declared `exRef` is a DOM ref only).
- Repro (Claude): Tools → Exclusivity → look up "Eliquis", immediately type "Jardiance" and look up again → if the Eliquis response lands last, its patent table paints while the input reads "Jardiance" (result header comes from `res.brandName`, i.e. the *response*, not the input).
- Expected: the generation-guard lesson (non-negotiable per §7) applied to every live lookup surface.
- Actual: one FDA/Orange-Book surface skipped it.
- Why it matters ($ or decision risk): LOE dates drive the revenue-build tail; cross-drug patent data painting under the wrong brand silently corrupts the loss-of-exclusivity year.
- Blast radius: Exclusivity / LOE tab.
- Suggested fix (do not apply): `const myReq = ++seq.current` / `if (myReq !== seq.current) return;` in `run()`, matching `FdaLookupTool`.
- Test to add: race test — two overlapping `run()` invocations, first resolves last, assert the second drug's result is what remains rendered.

### FIN-007 — Implied absolute PoS ignores per-program PoS override
- Severity: P2 🟡
- Surface: module / `solveImpliedPoSMultiplier` (`src/scenarioEngine.js`)
- Status: OPEN
- Evidence: `src/scenarioEngine.js:497-501` — the solved multiplier is converted to an absolute PoS using the raw benchmark PoS rather than the override PoS, so on a case with a per-program PoS override the implied absolute is expressed against the wrong baseline.
- Repro (static): set a per-program PoS override, reverse-solve from the current price, check which PoS baseline the reported absolute uses.
- Repro (Claude): case with PoS override → implied-PoS panel → compare the absolute against hand arithmetic from the override baseline.
- Expected: implied absolute PoS expressed against the effective (override) baseline.
- Actual: expressed against the raw benchmark.
- Why it matters ($ or decision risk): the reverse-solve answers "what PoS is the market pricing" — wrong baseline, wrong answer, on a conviction input.
- Blast radius: implied-PoS panel on override cases.
- Suggested fix (do not apply): use the override PoS as the conversion baseline when an override exists.
- Test to add: `math_verification.js` — override-case golden: implied absolute matches hand arithmetic from the override baseline.

### FIN-008 — PRV equity-bridge path has no independent math check
- Severity: P2 🟡
- Surface: module / PRV contribution (`src/scenarioEngine.js:220-228`)
- Status: OPEN
- Evidence: no `prv` coverage in `test/math_verification.js` (grep for `prv` returns only non-test hits; the 1,032 checks cover no PRV risk-adjustment/discounting path).
- Repro (static): grep `math_verification.js` for prv — zero coverage of the bridge.
- Repro (Claude): n/a — static coverage gap.
- Expected: every money-moving engine path has an independent check (Phase D rule).
- Actual: PRV risk-adjustment (× own-program PoS) + discounting from the program's own launch year is untested.
- Why it matters ($ or decision risk): PRV adds equity value directly to the bridge; an untested bridge step is a silent-error reservoir on a path that changes per-share value.
- Blast radius: PRV-enabled cases.
- Suggested fix (do not apply): none to code — add the test.
- Test to add: `math_verification.js` golden — PRV $150M, PoS 10%, 3 years at 12% → `$150M × 10% ÷ 1.12³`, with the arithmetic in the comment (do not snapshot the app's output).

### FIN-009 — Full-case 3,000-trial Monte Carlo has no independent coverage
- Severity: P2 🟡
- Surface: module / `computeFullCaseMonteCarlo` (`src/scenarioEngine.js`)
- Status: OPEN
- Evidence: no direct test of `computeFullCaseMonteCarlo` in `test/` — the suite covers components (triangular sampling exists elsewhere) but not the assembly: support of draws, Bear/Bull bounds, labelled percentiles.
- Repro (static): grep `test/` for `computeFullCaseMonteCarlo` — no direct invocation.
- Repro (Claude): n/a — static coverage gap.
- Expected: the flagship risk-visualisation path has a seeded/deterministic check.
- Actual: none.
- Why it matters ($ or decision risk): MC percentiles feed the risk narrative Caleb actually looks at; untested assembly can drift from the engine it claims to summarise.
- Blast radius: case Monte Carlo panel.
- Suggested fix (do not apply): none to code — add tests.
- Test to add: deterministic degenerate-bound test (Bear=Bull=Base → p10/p50/p90 all equal the deterministic per-share value); seeded-run reproducibility test.

### FIN-010 — MC triangular sampling mishandles degenerate bounds and out-of-range mode
- Severity: P2 🟡
- Surface: module / case Monte Carlo sampler (`src/scenarioEngine.js:1068-1070`)
- Status: OPEN
- Evidence: `src/scenarioEngine.js:1068-1070` — `const sampledPos = posLow === posHigh ? 100 : sampleTriangular(posLow, 100, posHigh);` (same pattern for share; `0` for discount-rate). Equal Bear/Bull bounds fall back to hardcoded `100`/`0` instead of the bound; and `sampleTriangular(posLow, 100, posHigh)` passes mode `100` even when both bounds are below 100, so draws can fall outside the stated support. (Spark re-verified 2026-09-23.)
- Repro (static): read `scenarioEngine.js:1066-1070`; degenerate case Bear=Bull=80 → samples 100, not 80.
- Repro (Claude): case with Bear=Bull overrides → MC distribution shows mass at 100 instead of the bound.
- Expected: degenerate bounds sample the bound; draws stay within [low, high].
- Actual: hardcoded fallbacks; possible out-of-support draws.
- Why it matters ($ or decision risk): MC percentiles computed from impossible draws misstate the risk distribution.
- Blast radius: scenario MC on degenerate or misordered Bear/Bull bounds.
- Suggested fix (do not apply): return the bound when `low === high`; clamp the mode into `[low, high]` before sampling.
- Test to add: degenerate-bound sampler test (Bear=Bull=80 → all samples 80); mode-outside-support test (bounds 50/60 → all draws within [50, 60]).

### FIN-011 — EV→per-share bridge doesn't foot with a non-converting convertible in the detailed capital engine
- Severity: P2 🟡
- Surface: view + module / valuation bridge display (`src/valuationPanel.js:615-640`) vs `src/capitalEngine.js`
- Status: OPEN
- Evidence: the detailed capital engine subtracts convertible face as debt when the convertible does not convert; the display bridge shows EV + cash − ordinary debt but omits the convertible-debt step, so the bridge line items do not sum to the per-share result on a non-converting convertible case.
- Repro (static): build a convertible-debt case on the detailed path; the bridge's line items vs `equity.perShare × dilutedShares`.
- Repro (Claude): case with convertible debt that doesn't convert → compare bridge line items to the per-share result — they don't reconcile by the convertible face amount.
- Expected: the displayed reconciliation foots to the per-share number.
- Actual: per-share may be correct while the displayed bridge is missing a step.
- Why it matters ($ or decision risk): a bridge that doesn't foot destroys trust in the per-share number even when the number itself is right — and if the number is wrong, the bridge hides it.
- Blast radius: convertible-debt cases on the detailed capital path.
- Suggested fix (do not apply): add the convertible-debt step to the display bridge (or show the simple-path bridge when it applies).
- Test to add: bridge line items sum to `perShare × dilutedShares` on a non-converting convertible fixture.

### FIN-012 — Peak-share override above 100% silently accepted
- Severity: P2 🟡
- Surface: Simulation / Peak Sales MC share override
- Status: OPEN
- Evidence: no clamp on the peak-share override; the existing red flag fires only above 2× the order-of-entry benchmark, so 100–200% of benchmark passes silently.
- Repro (static): set share override to 150 → accepted with no warning below the 2× benchmark threshold.
- Repro (Claude): Peak Sales MC → share override `150` → no warning.
- Expected: a market share above 100% is definitionally wrong — reject or warn.
- Actual: silently accepted up to 2× benchmark.
- Why it matters ($ or decision risk): operator error inflates peak sales with no signal; a share >100% is never a legitimate input.
- Blast radius: Peak Sales MC.
- Suggested fix (do not apply): hard clamp/warn at 100%.
- Test to add: share override `150` → warning raised or value clamped to 100.

### FIN-013 — `fetchTrialByNctId` (simulation CT.gov engine) has no timeout — dead code
- Severity: P3 🔵
- Surface: module / `fetchTrialByNctId` (`src/ts_ctgovEngine.js:119`)
- Status: OPEN
- Evidence: `src/ts_ctgovEngine.js:119-126` — plain `fetch`, no `AbortController`, no timeout. Both sibling fetchers abort at 15s (`ctgovFetch` in `ctgovEngine.js`, `tsCtgovFetch` in the same file). Exported but never called from `src/`, `test/`, or `electron/` UI code (definition + `module.exports` line only; the built bundles merely concatenate it).
- Repro (static): read `ts_ctgovEngine.js:119-126` against `tsCtgovFetch`'s 15s abort in the same file.
- Repro (Claude): n/a — dead code; unreachable from the UI today.
- Expected: every live-fetch function in the tree follows the 15s abort convention.
- Actual: a dead export carries the exact no-timeout defect the §7 regression lesson was written to prevent.
- Why it matters ($ or decision risk): zero today; if a future feature wires it in, the hung-forever CT.gov fetch returns silently.
- Blast radius: none currently.
- Suggested fix (do not apply): delete the function (preferred — dead code) or add the same 15s `AbortController` pattern as `tsCtgovFetch`.
- Test to add: hygiene lint — assert every `fetch(` in `src/*Engine.js` is wrapped by an `AbortController` with `setTimeout` (Phase-A-style convention test).

### FIN-014 — PK/PD rate-constant labels use capital-K "Ka"/"Ke", bypassing the sci() subscript convention
- Severity: P3 🔵
- Surface: Simulation / PK/PD tab (`src/ts_app.js`)
- Status: OPEN
- Evidence: `src/ts_app.js:1712` — `field('Ka — absorption rate constant (1/hr, oral only)', …)`; `:1713` — `'Ke — elimination rate constant (1/hr)'`; `:1830`/`:1834` — validation labels `'Ke (elimination rate)'` / `'Ka (absorption rate)'`. `field()` passes labels through `sci()` (`ts_app.js:123`), which would render `k_a` as k<sub>a</sub> — but the labels hard-code plain `Ka`/`Ke`. The engine binds lowercase `ka`/`ke` (`ts_pkpdEngine.js:20`), and the same panel renders the equilibrium constant correctly via `sci('K_D')` → K<sub>D</sub> (`ts_app.js:1721`). Capital K is the equilibrium-constant convention (K<sub>D</sub>), lowercase k the rate-constant convention — the two field labels on one panel use opposite casing for the two constant families.
- Repro (static): read `ts_app.js:1712-1713, 1830, 1834` against `:123` and `:1721`.
- Repro (Claude): Simulation → PK/PD tab → read the absorption/elimination field labels.
- Expected: `sci('k_a — absorption rate constant (1/hr, oral only)')` → kₐ, matching the K_D convention one field over.
- Actual: "Ka"/"Ke", capital-K, no subscript.
- Why it matters ($ or decision risk): low — the descriptive text ("absorption rate constant") disambiguates meaning; notational hygiene, not a misreadable magnitude.
- Blast radius: two field labels + two validation labels in the PK/PD panel.
- Suggested fix (do not apply): change the four label strings to `k_a`/`k_e` and let the existing `sci()` path in `field()` render the subscript.
- Test to add: DOM assertion (in the `export_coverage_test.js` style) that the PK/PD panel contains a `<sub>a</sub>` inside the absorption label.

---

## 11. Blocked — Claude’s runtime worklist

Every row Muse could not close statically. Claude executes these in the packaged app and against live APIs.

| ID | Why blocked | Exact step | Fixture |
|---|---|---|---|
| B-001 | jsdom has no CSP | Launch packaged app **offline** (throwaway profile `--user-data-dir=/tmp/rxnpv-test-profile`); confirm no blank window (React vendored, CSP hash valid) | `electron/dist/mac-arm64/RxNPV.app` or `/Applications` |
| B-002 | jsdom has no layout | Workspace → Valuation card → Export row → PNG: confirm the full-height card (title, figures, chart, caveats) is complete and the export bar itself is absent. Then Report → Export as PDF: confirm selectable vector text. | Workspace Valuation card |
| B-003 | network mocked | Live decode `NCT03036124` (DAPA-HF): hazard ratio 0.52 (95% CI 0.43–0.64) renders with interval, single-sided analysis labelled, AE denominators appear (post-FIN-004 fix). Decode `NCT02578680` (KEYNOTE-189): results render on a completed two-arm oncology trial. Decode `NCT04368728`: 4-arm cap, 5-endpoint cap, "container" red flag, no layout breakage. | §6 trial fixtures |
| B-004 | network mocked | Desktop app → Company Lookup → a real issuer (e.g. VRTX) → "Load insider activity": confirm only codes P/S under "Bought & sold" and awards/vesting/withholding/exercises on the other tab; then run FIN-005's stale-panel repro (search A → load → search B). | VRTX |
| B-005 | network mocked | Launch Tracker → Uptravi: confirm DrugSpend→CMS merge uses the asterisk fallback and partial quarters are tagged "partial", not silently annualised. | selexipag / Uptravi |
| B-006 | network mocked | Target Dossier → PCSK9 and TTR against the live API: confirm association-score fields, stage strings, disease wrappers, and the `drugAndClinicalCandidates` filter still parse. | PCSK9, TTR |
| B-007 | native only | Report PDF + section pin + reorder + dark/light retheme in the packaged app. | — |
| B-008 | native only | Resize / quit / reopen window state in the packaged app. | — |
| B-009 | eyes only | Both themes: tabular figures, focus order, contrast on muted footnotes; confirm Bear/Base/Bull identity readable from the text label alone (not only border color); confirm Ka/Ke labels legible (post-FIN-014 fix: kₐ/kₑ subscripts). | — |
| B-010 | network mocked | FDA Lookup with a nonsense name (zero results) and with network blocked (outage): confirm total / partial / zero states render as coded; confirm FAERS caveat shows. | — |
| B-011 | runtime behavior | After fixes: packaged-app repro of FIN-001 (override round-trip), FIN-002 (milestone moves with Bear PoS), FIN-003 (typing 60 → 60%), FIN-006 (Eliquis→Jardiance race) to confirm resolution. | — |
| B-012 | needs schedule + network | Build a live-canary test that diffs parser output against current CT.gov responses for `NCT03036124`, `NCT02578680`, `NCT04368728`; run on a schedule — static fixtures cannot detect schema drift. | §6 trial fixtures |
| B-013 | jsdom has no layout | Packaged app (not browser dev): decoder + results for a large trial; confirm no nested-table overflow (Phase E item 10). | `NCT04368728` |

---

## 12. Executive brief for Claude (Muse fills last)

### 12.1 What would cause a wrong price target *today*?

Six P1s, all on documented paths — none found on the plain vanilla case, which is why the suite is green:

1. **FIN-001** — Bear/Bull peak-revenue override stores dollars but displays `$M`; re-editing compounds ×1e6. Any scenario analysis using per-program overrides is suspect.
2. **FIN-002** — Partnership milestones ignore Bear/Bull PoS multipliers and per-program PoS overrides. Scenario-weighted deal value is wrong wherever milestones matter.
3. **FIN-003** — Peak Sales MC rates are 0–1 fractions with no label; typing `60` clamps to `1.0`. The whole peak-sales distribution can be silently maxed out.
4. **FIN-004** — Per-event AE rates render without denominators (50% on n=4 ≡ 50% on n=400), feeding bad safety reads into risk adjustment.
5. **FIN-005** — Form 4 panel paints company A's insiders under company B's name after a new search. Insider signal misattribution.
6. **FIN-006** — Exclusivity lookup has no race guard; a slow Eliquis response can paint under a Jardiance query, corrupting the LOE year.

Kill-or-confirm each with a running engine or a new `math_verification.js` assert before anything else. No P0 was found: no global collision, no IPC escape, no CSP blanking, no data loss, no NaN/Infinity in fair value on the normal case.

### 12.2 What would make a user distrust the workspace in ten minutes?

FIN-004 (denominator-free AE percentages in the flagship decoder), FIN-005 (wrong company's insiders), FIN-006 (wrong drug's patents), FIN-001 (a field that reads `$1,000,000,000M`), and FIN-011 (a bridge that doesn't foot on convertible cases). All five are "the numbers look wrong or the labels lie" defects — the fastest trust killers in a valuation tool. The P2s are slower burns: FIN-007 (implied PoS against the wrong baseline), FIN-010 (MC draws from impossible values), FIN-012 (share >100% accepted).

### 12.3 What is solid and must not be rewritten?

- The security model: 6 IPC handlers with allowlists, sandboxed offscreen export windows (chart PDF has JS off), the double-sanitised snapshot path with exactly one `dangerouslySetInnerHTML`, CSP hash from the finished artifact, function replacers in `build.js`. All verified; don't touch.
- The test contract: 12/12 suites, 1,032 math checks, 403 export checks, green on a clean clone in both production and React-dev modes. Extend it; don't restructure it.
- The learned-lesson infrastructure: generation guards on every lookup except the two filed (FIN-005/006), 15s aborts on every live fetcher family, error/empty/partial distinction everywhere, "not stated" decoder defaults, deaths≠dropout, no arm inference, FAERS/Form 4 honest copy. These are the product's moat — the findings are the two places the moat has a gap.
- `data.js` benchmarks: sourced tables, out of scope to "correct".
- The concatenation architecture and `setup.js`: deliberate; the protocol forbids recommending simplification.

### 12.4 False-precision / scope traps you must not “improve”

Target Dossier ↛ PoS. Asset Program ↛ composite score. Chemistry stays gone. Signing stays gone. Bundler is its own project. Do not "fix" FIN-013 by wiring the dead fetcher into the UI — delete it or guard it. Do not "fix" the 13-vs-14 doc drift by inventing a 14th diff field. Do not snapshot the app's own output as a golden test value (§4.1.7).

### 12.5 Suggested Claude sequence

1. Kill or confirm every Muse P0/P1 with a running engine or a new `math_verification.js` assert.
2. Run `npm test` and `npm run test:dev` on a clean `node build.js`.
3. Packaged-app + throwaway profile: offline launch, PDF, pin, resize.
4. Live API fixture list in §6.
5. Visual / type / a11y concrete defects only.
6. Update README § For auditors and Findings TODO so the next stranger sees the same product you see.
7. Implement only after Caleb says so.

### 12.6 Muse confidence

- Surfaces inventoried: **40/40** (§8.2) + **7/7** live hosts (§8.3) + **17** input rows (§8.4) + **5** collision-log rows (§8.5)
- Findings opened: **14** (6 P1 🔴, 6 P2 🟡, 2 P3 🔵)
- Doc-drift rows: **4** (2 confirmed P3 + 1 expected-stale + Findings TODO conditional)
- Blocked rows: **13**
- I would send this to Claude as-is because: every P1 was independently re-verified against source (not just subagent-reported), the test/build contract was actually executed on a clean clone (not asserted), and every row I could not prove statically is a BLOCKED row with an exact next action rather than a guessed severity. What I would *not* claim: release-readiness — the bar in §2.3 is not met (6 open P1s, 2 doc-drift rows), and only the packaged-app pass can close it.

---

## 13. Claude disposition log

Do not delete Muse findings above. Update this table as you land commits.

| ID | Grok verdict | Claude | Commit | Notes |
|---|---|---|---|---|
| FIN-001 | CONFIRMED — implement first | **FIXED** | `97a6934` | Consumer checked: `computeProgramValuation` and Simple Multiple read the override in raw dollars, exactly like `quickRevenue.peakRevenue`, so storage/use were always consistent and a value typed once was valued right. The defect was display: stored dollars shown beside "$M", so editing compounded (a trailing 0 stored $1e16). Now a `MillionsField`; no data migration needed. Test fails on `f49689f`. |
| FIN-002 | CONFIRMED | **FIXED** | `d88ab6a` | Benchmark × override × scenario composition extracted to `computeEffectivePoS()`, used by DCF program valuation (hence PRV), Simple Multiple and milestones; both call sites pass the scenario. Upfront stays certain; Base with no override unchanged. Longhand: 50% vs 10% override = exactly 5×, Bear 70% = exactly 0.7×, PRV/milestone = 1.12^(T−L), stage gate 5^(j/n). 7 checks fail on `f49689f`. |
| FIN-003 | CONFIRMED | **FIXED** | `2a0eafb` | 0–100 UX as preferred: labels "(%)", defaults 60/50/15–35, `percentSpecToFraction` at the edge (Normal SD too); engine keeps its 0–1 contract. Out-of-range rates refused with a visible message (`percentSpecError`), not clamped. On `f49689f` 60/50/25 gave $100B (all clamped to 100%); now $7.5B. |
| FIN-004 | CONFIRMED | **FIXED** | `97997c3` | `(affected/atRisk)` in each event cell, same idiom as the summary table. Rendered test: "20.0%" with "40/200". |
| FIN-005 | CONFIRMED | **FIXED** | `8f67b70` | `search()` clears insider result/error/loading and advances `insiderSeq`; `loadInsiderActivity` drops a superseded result. Test with stubbed SEC calls reproduces A's insiders under B on `f49689f`. |
| FIN-006 | CONFIRMED | **FIXED** | `dec29ef` | Guard copied from `FdaLookupTool` — note its ref is named **`reqSeq`**, not `resSeq` as cited (pattern as described). Overlap is reachable because Enter bypasses the disabled button; test uses that path. |
| FIN-007 | CONFIRMED | **FIXED** | `5734324` | Absolute implied PoS now uses `computeEffectivePoS` at a 100% multiplier. Round-trip test: re-valuing at the implied PoS reproduces the market price. |
| FIN-008 | Coverage gap | **CONFIRMED — test added** | `d0f0bc8` | $150M × 10% / 1.12³ = **$10,676,703.72** (1.12³ = 21952/15625). My first longhand figure (10,676,774.3) was a division slip that the engine's number exposed; exact rational arithmetic confirmed the engine. No code change. |
| FIN-009 | Coverage gap | **CONFIRMED — test added** | `5738c1c` | Degenerate at Base reproduces the deterministic Base per-share at every percentile and the mean. Held on `f49689f` too (no bug alleged). No seeded-reproducibility test: the sampler has no seed and adding one is an engine change, not coverage. |
| FIN-010 | CONFIRMED | **FIXED — broader than stated** | `5738c1c` | Equal bounds now return the bound; mode is the case's effective **Base** preset, clamped into [low, high]. Wider than filed: the case-level Base-PoS adjustment scales Bear/Bull but left the mode at 100, so a 50% adjustment (Bear 35 / Bull 65) drew values up to ~79, past Bull — reachable from a documented control. Tests fail on `f49689f`. |
| FIN-011 | NEEDS RUNTIME | **CONFIRMED (display) — FIXED** | `be1acf0` | Per-share was right; the chips omitted the non-converting convertible **and** a modelled future raise (a second gap, not in the audit). Both the Workspace bridge and the report's bridge now come from one `computeEquityBridgeSteps()` built from the valuation result, so they always foot. Capital engine untouched. |
| FIN-012 | MIS-SCOPED | **SCOPED + FIXED** | `2a0eafb`, `f8a390f` | (a) Peak Sales MC share: folded into FIN-003 (>100% refused on the form). (b) Workspace Full-mode `peakShareOverridePct`: capped to [0,100] in `computeProgramRevenue`, with a high-severity red flag naming the cap (replacing, not duplicating, the above-benchmark flag). No second clamp on the Peak Sales form. |
| FIN-013 | CONFIRMED dead | **FIXED (deleted)** | `7bc764d` | Unused and unexported elsewhere; deleted, not wired up. |
| FIN-014 | CONFIRMED | **PARTLY REJECTED; remainder FIXED** | `7bc764d` | Field labels were already correct: `sci()`'s token table maps "Ka"/"Ke" to k<sub>a</sub>/k<sub>e</sub> (with the lower-case correction). Renaming them to `k_a` as proposed would have **broken** that, since `k_a` is not a token. The real gap was the validation message, inserted as plain text ("Ke"); it now goes through `sci()`. Test: label passes on `f49689f`, message fails there. |
| Drift: Electron item 6 | CONFIRMED | **FIXED** | `528b2cb` | Marked done (2026-09-22, 44.4.4). |
| Drift: 14 fields | CONFIRMED 13 | **FIXED** | `528b2cb` | 9 + 4 = 13 verified from source. Four sites corrected (build log annotated, not rewritten). New test counts fields from source and fails if README/CLAUDE.md/Feature Map disagree. |
| Drift: Human Test Checklist | CONFIRMED stale | **FIXED** | `528b2cb` | Body replaced with a pointer to README test steps and §11 here. |
| Drift: Findings TODO "Still open: Nothing" | Conditional | **FIXED** | this commit | "Still open" now lists the packaged-app worklist and NEW-001/NEW-002 below; the FIN items are recorded under Fixed. |
| B-001 … B-013 | Packaged / live | **OPEN — not closable in jsdom** | — | Left for Caleb + Claude on the Mac. Nothing here claims them. |

### Found during this pass (not in the Muse audit)

| ID | Severity | Status | Notes |
|---|---|---|---|
| NEW-001 | P1 (money, documented path) | **OPEN — for Caleb's decision** | **Simple Multiple adds no PRV at all.** `computeCaseValuation` adds a risk-adjusted, discounted PRV; `computeSimpleMultipleValuation` has no PRV step, so a PRV-enabled case loses that value when switched to Napkin / Simple Multiple. Same class as the fixed "Simple Multiple dropped partnership value" bug. Not fixed because it is outside this packet; the fix is small (reuse the PRV block with the Simple Multiple program valuations) and would take a longhand test like FIN-008's. |
| NEW-002 | P3 (edge) | **OPEN — observation** | Scenario share multipliers scale patients linearly (`scaleRevenueResult`), so a Full-mode share near the cap can exceed 100% of eligible patients under Bull (90% × 130% = 117%). FIN-012 caps the *override*, not the scenario-scaled result. Rare in practice; noted rather than fixed. |
| NEW-003 | — | **FIXED with FIN-011** | Modelled future raise missing from both bridges (see FIN-011). |
| NEW-004 | — | **FIXED with FIN-010** | Base-PoS adjustment pushing the MC mode outside its own range (see FIN-010). |

**Test contract after this pass:** 13 suites (new `audit_regressions_test.js`, 36 checks), `math_verification.js` 1,090 checks. `npm test` and `npm run test:dev`: 13/13. Every new P1 test was run against a build of `f49689f` and confirmed to fail there.

### Release go / no-go

- Static + P1 code: **all six P1s FIXED and tested** (`97a6934` … `dec29ef`). One newly found P1-class item, **NEW-001, is open** pending Caleb's call.
- Product release bar: **still NO-GO.** B-001 (offline packaged launch), B-002 (PNG/PDF export), B-007 (report pin/reorder/retheme) and B-008 (resize/quit/reopen) have not been re-run on a Mac against this tree. Parts of B-002 and B-007 were exercised in the packaged app during the export work just before this audit (tracker, Phases 28–29), but none of the four has been re-run since these fixes, and jsdom cannot close them.
- Vanilla DCF path: still green; do not confuse that with release-ready.

---

*Muse phases A–H are complete. Claude: implement, then annotate this table. Do not rewrite Muse’s findings.*
