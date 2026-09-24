# RxNPV

A desktop valuation sandbox and trial-outcome simulator for retail biotech investing: build a risk-adjusted NPV for a drug program, stress it, and check it against clinical trial data, FDA and SEC filings, comparable deals and the literature. It is an Electron app for macOS on Apple Silicon, and it is unsigned.

**Scope, which governs every decision in this repo:** it should be *good enough to help a retail biotech investor improve their analyses*. It is not meant to be institutional grade or to have every conceivable feature. Several reasonable-sounding features were turned down on purpose. [`docs/RxNPV_Feature_Map.md`](docs/RxNPV_Feature_Map.md) lists what exists, what's committed, and what was rejected and why. Read it before flagging something as missing.

**If you're Claude Code:** read [`CLAUDE.md`](CLAUDE.md) first. It carries the full project context, the architecture constraints and the lessons learned. This file is the overview for people, including auditors.

---

## Contents

1. [Quick start](#quick-start)
2. [Feature overview, and how to test each feature](#feature-overview-and-how-to-test-each-feature)
3. [Automated tests](#automated-tests)
4. [For auditors: architecture, security model, known open items](#for-auditors)
5. [Rebuilding and installing](#rebuilding-and-installing)
6. [Project structure and where the docs are](#project-structure-and-where-the-docs-are)

---

## Quick start

### From a clean clone (any OS, for the test suite)

The automated suite runs the whole app headless in jsdom. It needs a recent **Node.js** (verified on Node 24; Node 20+ should work) and no Mac.

```bash
git clone https://github.com/risdiplam/rxnpv.git
cd rxnpv
node build.js              # assembles src/ into electron/rxnpv.html
cd test
npm install                # jsdom + React, for the test harness only
npm test                   # regenerates the harness, runs all 13 suites
```

Expected output ends with `All 13 suites passed`, and the exit code is 0. Any failure exits 1 and prints the failing suite's last 25 lines. `npm run test:dev` runs the same suite against React's development build. That run is stricter: warnings the production build hides, such as missing list keys, fail it.

### Running the app itself

**macOS, Apple Silicon, the real target:**

```bash
cd electron && npm install && cd ..
node build.js --package    # builds electron/dist/mac-arm64/RxNPV.app
open electron/dist/mac-arm64/RxNPV.app
```

**Development mode** (no packaging, any OS Electron supports):

```bash
node build.js
cd electron && npm install && npx electron .
```

Development mode loads `electron/rxnpv.html` straight from disk. On Linux or Windows it is **untested**. Nothing in the app is deliberately macOS-only apart from packaging and one window-lifecycle line, but nobody has run it there. Treat a problem found there as a portability finding, not necessarily a bug.

The app needs internet access for its live-data features (ClinicalTrials.gov, openFDA, SEC EDGAR, Open Targets, Europe PMC, CMS). Everything else works offline. React is bundled with the app, not fetched.

**Where data lives:** cases, logs and custom comps are stored in the app's own `localStorage`. There is no account, sync or telemetry. Rebuilding never touches saved data. To test without touching real data, launch with a throwaway profile:

```bash
electron/dist/mac-arm64/RxNPV.app/Contents/MacOS/RxNPV --user-data-dir=/tmp/rxnpv-test-profile
```

**Gatekeeper:** a copy built locally opens normally, because only downloaded files carry the `com.apple.quarantine` flag. A downloaded copy will be blocked because the app is not notarized. Unblock it under **System Settings → Privacy & Security → Open Anyway**. Not signing is deliberate; see "Code signing" in `CLAUDE.md`.

---

## Feature overview, and how to test each feature

The app has six top-level areas: **Workspace**, **Reference Sheet**, **Tools**, **Simulation**, **Portfolio**, and the **Report** reached from Workspace. For each feature below:

- **Test:** steps a person can follow in the running app.
- **Automated:** which suite covers it.

Suggested real-world inputs, most of them the cases used against the live services during development:
- Trials: NCT03036124 (DAPA-HF), NCT02578680 (KEYNOTE-189), NCT04368728 (a mega-trial with 64 primary endpoints and 20 arms; it breaks naive rendering)
- Drugs: dapagliflozin / Farxiga, sotatercept / Winrevair
- Genes: PCSK9, TTR
- Companies: a ticker such as VRTX

### Workspace: the valuation model

| Feature | What it does | Test |
|---|---|---|
| **Cases and programs** | A case is a company. It holds one or more drug programs, each with its own revenue build, costs, timeline and probability of success (PoS). | Click **+ New case**. Type a peak revenue (e.g. 1000) into *Peak worldwide revenue* and 100000000 into *Fully diluted shares*. A valuation should appear straight away. |
| **Revenue modes** | *Quick*: you enter a peak revenue yourself. *Full*: epidemiology → diagnosed → treated → share → price, with a launch curve and loss of exclusivity. The price basis can be ASP, WAC, AWP or Retail, converted to ASP. | Switch the program to Full. Fill in steps 1–5 and watch the revenue output card update. |
| **Napkin / Full model presets** | One click pairs revenue mode with valuation method: Napkin = Quick + Simple Multiple, Full = Full + DCF. Inputs the chosen method never reads are hidden or marked. | Click Napkin, then Full model. DCF-only inputs should disappear, then come back. |
| **Two valuation methods** | Full DCF (risk-adjusted cash flows, discount rate, optional terminal value and cash tax) or Simple Multiple. | Toggle *DCF / Simple Multiple* and compare per-share values. |
| **Bear / Base / Bull scenarios** | Multipliers on share, PoS and discount rate, overridable per case. | Open *Edit Bear / Bull assumptions* and change the Bear PoS multiplier. The Bear card should move. |
| **Capital structure and dilution** | Cash, debt and diluted shares. Optional future raise and a dilution path to launch; the two combine correctly. | Enable *Model dilution path to launch*. The per-share value should fall and the preview line should show the shares growing. |
| **PRV, partnership economics** | Priority review voucher; royalty, milestone, upfront and cost-sharing overlay. Links to Licensing Comps. | Enable partnership. The EV→per-share bridge gains a line. |
| **Full-case Monte Carlo** | 3,000 trials sampling PoS, share and discount rate between the Bear and Bull bounds. | Click **Run 3,000 trials**. A fair-value distribution appears. |
| **Implied PoS and reverse-solve** | Given the current price, what PoS (or peak revenue, share or timing) the market is pricing in. | Set a current price. *What [case]'s price implies* appears. |
| **Red flags** | Checks your own inputs against benchmarks, including a warning when post-approval M&A multiples are applied to a pre-approval asset. | Set a very high peak share. A flag appears. |
| **Evidence Log, Calibration Log** | Sources behind judgement calls; your PoS call against the market's, Brier-scored after the outcome. | Add an entry to each, then delete one. Deletion needs two clicks. |
| **Sum-of-the-parts, risk waterfalls** | Per-program value contribution (needs 2+ programs); unrisked → risked NPV. | Add a second program. The SOTP and pipeline waterfall appear. |

**Automated:** `final_regression_pass.js` covers the core valuation paths. `math_verification.js` (1,137 checks) covers every formula against hand-derived values.

### Tools: six workbenches, 18 tools, grouped by the question being asked

| Workbench | Tools | Test |
|---|---|---|
| **Trial** | **Trial Decoder**: paste an NCT and get the design in plain English, what it can and can't establish, design red flags, then the posted results, dropout by arm and adverse events. **Asset Program**: every trial for one drug by phase, with stopped trials and an evidence-base checklist of counts (deliberately no composite score). **Trial Explorer**: search, competitor landscape, Trial Watch (snapshot, then diff 13 fields ranked by significance), an analog effect-size board and positioning. **FDA Lookup**: approvals, labels, adverse event reports (FAERS). | Decode NCT03036124, click *Load what these trials actually reported*, and check that the hazard ratio shows with its interval. Decode NCT04368728: it should render without layout breakage. In Asset Program, search `dapagliflozin`. |
| **Science** | **Target Dossier** (Open Targets): genetic support, disease associations, existing drugs. Deliberately *not* wired into PoS. **Literature** (Europe PMC, which is all of MEDLINE plus preprints): results split by publication type. | Look up `PCSK9`. Search the literature for `NCT03036124`. |
| **Company** | **Company Lookup** (SEC EDGAR financials, full-text search, Form 4 insider transactions split into market buys/sells and awards/vesting). **Catalyst Calendar**. **Cash Runway**. **Runway vs. Catalyst**: does modelled cash reach the next catalyst? | Search a ticker, then *Load insider activity (Form 4)*. Only P/S transaction codes should appear under "bought & sold". |
| **Commercial** | **Launch & Actuals**: CMS Medicare Part D/B spend as a quarterly uptake proxy with analogs, and reported revenue against your model. It never compares a partial year to a full one. **Exclusivity / LOE** (Orange Book). | Launch tracker: `Uptravi`. It needs the asterisk-name fallback to get annual history. Exclusivity: `Farxiga`. |
| **Valuation** | **Sensitivity** (tornado), **Binary Event** (implied readout probability), **Diluted Market Cap**. | Run Sensitivity on a case. |
| **Benchmarks** | **M&A Premium**, **Peak Sales Comps**, **Licensing Comps**. Each database is multi-source verified as of August 2026 and supports custom add, edit and delete. | Add a custom M&A comp, then delete it. Deletion needs two clicks. |

**Automated:** `final_sweep.js` opens every workbench and tool. `export_coverage_test.js` checks each tool's sections. Engines are unit-covered in `math_verification.js`. Network calls are mocked in the suite; the integrations were verified against the live services by hand (see "Six API lessons" in `CLAUDE.md`).

### Simulation

| Tab | What it does |
|---|---|
| **Trial Outcome / PoS** | Bayesian assurance: thousands of simulated trials under an uncertain true effect. Binary, continuous or time-to-event, with drawn survival curves. |
| **Phase 2→3 Translator** | Shrinks a Phase 2 effect to a Phase 3 planning assumption using published concordance factors. |
| **Trial Statistics** (7 sub-tools) | Fragility Index · Sample Size / Power (with an assumption-stress panel) · P-value ↔ CI · Single-Arm CI · 2×2 Outcome Analysis · Non-Inferiority · Multiplicity Adjustment |
| **Meta-Analysis** | Pooled effect across trials. |
| **Peak Sales** | Monte Carlo over the revenue-build inputs, with driver ranking and export to a case. |
| **PK/PD** | Dosing simulation and a standalone receptor occupancy calculator. |

**Test:** run each tab with its defaults, then with one input changed; every result should update without errors, and each carries notes explaining its assumptions. **Automated:** `new_features_test.js` checks statistics outputs against hand calculations, and `math_verification.js` checks every statistical formula.

### Reference Sheet

Nine tabs, including How This Works (a guide to every feature), Revenue Build, Cost Structure, R&D & Timeline, Probability of Success, Discount Rate, Valuation & Dilution, M&A Comps and Trial Glossary. These hold every benchmark the model uses, with sources. **Test:** open each tab. **Automated:** `final_sweep.js`, `export_coverage_test.js`.

### Portfolio

A cross-case summary: fair value against price, runway, modelled against implied PoS, and PoS dispersion. **Test:** create two cases with prices set, then open Portfolio.

### Export and the PDF report

- **Every section exports in full, and every chart exports on its own.** Each card, tool, Simulation panel, Reference Sheet card and Portfolio card has an **Export section** row; each chart has its own **Export chart** row directly under it.
  - **Export section → PNG / PDF** saves the *whole* section at full height, even when it is taller than the window: title, inputs as set, results, every chart, tables and any open notes, plus a footer naming where it came from. The PDF is vector with selectable text.
  - **Export chart → PNG / PDF / SVG** saves just that chart, with its title. SVG is editable in design tools.
  - Either row's **+ Report** adds that section, or just that chart, to a case's report.
  - Either row's **+ Bundle** collects it into your **PDF bundle** (no case needed). **Bundle (N)** in the top bar opens it: tick what to include, reorder, remove, preview, then **Export as one PDF** (optionally one item per page) or **Export as separate PDFs** (a folder chosen once; files numbered in bundle order).
- **+ Report** adds a section to a case's PDF report.
  - For sections the report already builds live from the model (revenue chart, cash flow, bridge, SOTP, scenarios), it toggles them on or off instead of copying them.
  - Everything else is stored as a sanitised HTML snapshot.
  - After clicking, it says which case the section went to and links to the report.
- **The report** (**Generate Report** in Workspace):
  - **Sections ▼** chooses the built-in sections and each added section individually, with ↑ ↓ to reorder and ✕ to remove. The PDF contains exactly what is ticked.
  - Added sections re-theme to the report's light or dark setting.
  - **Export as PDF** and **Export CSV**.

**Test:**
1. Export the Workspace *Valuation* card as PNG. It should be complete even though it is taller than the window.
2. In Tools → Benchmarks → M&A Premium, click **+ Report**, then **Open report →**.
3. In **Sections ▼**, untick the added section. It should leave the report.
4. Add a second section, reorder the two, then **Export as PDF**.

**Automated:** `export_test.js` (serialiser and sanitiser) and `export_coverage_test.js` (403 checks):
- every section in every view has its own export bar
- + Report works both ways
- the report renders the snapshot's real content with nothing executable in it
- include/exclude and reordering are saved

**Not automatable in jsdom:** the actual PNG/PDF output, and anything else that depends on layout. Those were verified in the packaged app over the Chrome DevTools Protocol (see `docs/RxNPV_External_Suggestions_Tracker.md`, Phase 29).

### Resilience and data safety

- **Error boundary** in two layers: a crash in one view or case degrades to a fallback, and the case list stays usable.
- **Destructive actions** need a confirmation modal (whole case or program) or a two-click confirm (smaller items).
- **Storage headroom banner** warns before `localStorage` fills up. It separates your own data from re-fetchable API caches and has a one-click cache clear. The API caches are byte-capped.
- **A failed save always warns the user**; it is never silently swallowed.

**Automated:**
- `recovery_errorboundary_test.js` deliberately crashes a case.
- The four `storage_warning_*` suites simulate a full disk.

---

## Automated tests

| Suite | Covers |
|---|---|
| `math_verification.js` | 1,137 checks of engine math against values derived by hand, from closed forms or from published constants. Never against the app's own output. Needs no DOM. |
| `export_test.js` | Section serialiser: form state carried over, export controls removed, truncated text restored, sanitiser strips scripts, handlers, remote resources and `javascript:` URLs. |
| `audit_regressions_test.js` | The UI-level fixes from the September 2026 Muse audit ([`docs/RxNPV_MUSE_AUDIT.md`](docs/RxNPV_MUSE_AUDIT.md)): override display round-trip, percent inputs, AE denominators, stale Form 4 / Exclusivity responses, the bridge convertible line, PK/PD notation, and the documented Trial Watch field count held to the code. Each check was confirmed to fail on the audited tree. |
| `export_coverage_test.js` | Every section in every view has its own export bar; + Report (snapshot and live toggle); report rendering, include/exclude, reorder. |
| `final_regression_pass.js` | Core valuation paths and every top-level view, with zero console errors. |
| `final_sweep.js` | Every Tools workbench and tool, Simulation tab and sub-tool, and Reference Sheet tab. |
| `new_features_test.js` | Statistics tools against hand calculations. |
| `full_recovery_verify.js` | End-to-end smoke test. |
| `recovery_errorboundary_test.js` | A crashing case is contained by the error boundary. |
| `storage_warning_*.js` (4) | A failed save warns the user and is not shown as saved elsewhere. |

**What the suite cannot see.** It runs in jsdom, so it has:
- no layout
- no CSS rendering
- no Content-Security-Policy enforcement
- no real network

A CSP mistake can blank the real app while the whole suite stays green. [`test/README.md`](test/README.md) spells out exactly what is and isn't verified. Read it before trusting coverage.

**Beyond jsdom — two checks that need a Mac or the network** (neither is part of `npm test`):

```bash
cd test && npm run packaged -- --mode=offline   # then --mode=reopen, --mode=live
```

Drives the installed app's real main process, IPC, CSP and print engine (only the save dialog is replaced), against a throwaway profile: offline launch, PNG/PDF/SVG export, the report builder, resize and relaunch, and the live integrations. Needs `cd electron && npm install` once.

```bash
cd test && npm run canary
```

Checks the ClinicalTrials.gov parsers against three live reference trials and a stored baseline, so an API change is noticed before it misleads the decoder.

**Running one suite:**

```bash
cd test && node setup.js && node export_coverage_test.js
```

Re-run `node setup.js` after every `node build.js`. `npm test` does this for you.

---

## For auditors

### Architecture: unusual on purpose

- **No bundler, no modules.**
  - `build.js` concatenates 38 plain JS files from `src/`, in the order set by `MODULE_ORDER`, into one inline `<script>` inside `shell.html`. The result is `electron/rxnpv.html`.
  - Everything shares global scope. Function declarations hoist across files, but `const`, `let` and `class` do not, so the order matters.
  - This dates from the app being built in a chat sandbox with no tooling. Moving to a real bundler is a legitimate improvement, but it should be its own change, with full re-verification.
- **Syntax checks.** `build.js` checks every file's syntax before concatenating.
- **Script hash.** It fills the CSP's script hash from the finished output, covering the exact script text.
- **React 18.3.1 is vendored** in `electron/vendor/`, so the app starts offline.
- **`electron/rxnpv.html`, `electron/dist/` and both `node_modules/` are build artifacts**, gitignored. `test/test_desktop.html` is generated by `setup.js`.

### Security model: what is in place

- **Main window:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, with a preload exposing a fixed `electronAPI`.
- **CSP** (in `shell.html`):
  - `default-src 'none'`
  - scripts only by sha256 hash, plus `'self'`/`file:` for the vendored React
  - `connect-src` limited to the six data hosts
  - `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`
- **IPC surface**, six handlers in `electron/main.js`:

  | Handler | What it does |
  |---|---|
  | `export-pdf` | prints the report |
  | `render-section` | offscreen section render (below) |
  | `export-chart-pdf` | vector PDF of one chart |
  | `save-asset` | saves an SVG or PNG the renderer produced |
  | `edgar:fetch` | hostname must match `sec.gov`, 20-second timeout |
  | `open-external` | `http:` and `https:` only |

- **Offscreen export windows:** sandboxed, no preload, and a CSP of `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:`. The chart-PDF window runs with JavaScript off. The section window needs JavaScript on, but only to measure the page.
- **Stored report snapshots** are sanitised when captured and again when rendered:
  - elements removed: script, iframe, object, embed, link, meta, base and template
  - also stripped: `on*` attributes, `javascript:` URLs, `expression()`, and any resource that isn't a `data:image/`
- **The one `dangerouslySetInnerHTML`** in the app is `ReportSnapshot` in `src/reportView.js`. It is bounded to that sanitised, app-serialised content, with the CSP as a backstop.

### Known open items, disclosed up front

These are real, and none is hidden:

- **Unsigned and not notarized.** A deliberate cost decision for a personal tool; see `CLAUDE.md`.
- **No navigation guards.** The main window sets no `will-navigate` or `setWindowOpenHandler` restriction. Links go through `open-external`, and the CSP limits what can load, but the Electron security checklist recommends both guards.
- **No formal accessibility audit.** Contrast has been checked against WCAG in both themes. Screen reader support and keyboard-only navigation have not been audited.
- **Tested on macOS arm64 only.** Intel Macs, Linux and Windows are unverified.
- **`localStorage` is the only persistence.** Clearing site data or changing machines loses cases unless they have been exported.
- **Live-API integrations are verified by hand, not in CI**, because the suite mocks all network calls.
- **Historical docs.** `docs/` contains design history written at the time. Where it disagrees with the code, the code and `CLAUDE.md` are current. `docs/RxNPV_Human_Test_Checklist.md` in particular predates most of the app; use this README's test steps instead.

### Deliberately not built: please don't file these as gaps

13F holdings, versioned snapshots, platform correlation for SOTP, a regulatory precedent library, group-sequential trial modelling, QED/PAINS/SA molecular metrics, chemistry/RDKit (built, then removed), code signing. [`docs/RxNPV_Feature_Map.md`](docs/RxNPV_Feature_Map.md) and `CLAUDE.md` give the reasons. The Target Dossier is deliberately not a PoS input, and the Asset Program checklist deliberately has no composite score. Both would be false precision.

---

## Rebuilding and installing

```bash
node build.js              # reassemble src/ → electron/rxnpv.html (fast; checks syntax)
node build.js --package    # + electron-builder → electron/dist/mac-arm64/RxNPV.app
node build.js --install    # + copy into /Applications/RxNPV.app (quit the app first)
```

- `electron/dist/` is not cleaned between builds; old artifacts can linger until you delete them by hand.
- On the development Mac, Node lives at `~/.local/nodejs/current/bin`. If `node` isn't found, add it to your PATH:

```bash
export PATH="$HOME/.local/nodejs/current/bin:$PATH"
```

---

## Project structure and where the docs are

```
src/        38 source modules — MODULE_ORDER in build.js is the authoritative list and order
shell.html  HTML template: styles, CSP (with __SCRIPT_HASH__), __SCRIPT__ placeholder
build.js    assembles src/ into electron/rxnpv.html; --package / --install
electron/   main.js, preload.js, package.json (electron-builder config), vendor/ (React), icons
test/       jsdom suite: npm test runs everything (see test/README.md)
docs/       design history and decisions
```

| Document | Read it for |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Full orientation: architecture, conventions, API lessons, scope decisions |
| [`docs/RxNPV_Feature_Map.md`](docs/RxNPV_Feature_Map.md) | The decided scope: built, committed, rejected with reasons |
| [`docs/RxNPV_External_Suggestions_Tracker.md`](docs/RxNPV_External_Suggestions_Tracker.md) | The build log: every phase, what was verified, every bug found |
| [`docs/RxNPV_Findings_TODO.md`](docs/RxNPV_Findings_TODO.md) | The running audit and fix list, including what is deliberately still open |
| [`docs/RxNPV_MUSE_AUDIT.md`](docs/RxNPV_MUSE_AUDIT.md) | The September 2026 external static audit, with the disposition of every finding in its §13 |
| [`test/README.md`](test/README.md) | What the automated suite does and does not verify |
| [`docs/RxNPV_Field_Reference.md`](docs/RxNPV_Field_Reference.md) | Every model input explained |
