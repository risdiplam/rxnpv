# RxNPV test suite

Read this before trusting or extending these tests — what they verify is real, but narrower than it might look.

## What this actually is

Every test here runs the *entire app* inside jsdom — a JavaScript DOM implementation with no real browser or Electron behind it. That means these tests genuinely exercise the real component tree, real event handling, real state updates, and the real valuation math. They are not mocks of the app; they're the actual app, running headless.

## What jsdom cannot do — read this before assuming something is "verified"

- **No real network calls.** Every EDGAR, ClinicalTrials.gov, and openFDA call in every test here is mocked, and the `fetch()` calls inside the running app never execute inside a test. Note this is a statement about *this suite*, not about the app: the integrations have separately been exercised against the live APIs by hand, outside these tests. Both claims are true and they are not in conflict — `CLAUDE.md` describes the manual verification, this file describes what the automated suite covers.
- **No CSP enforcement.** jsdom ignores `Content-Security-Policy` entirely, so a policy that would block the real app in Electron will not fail anything here. A CSP change must be verified against the packaged app — a broken one produces a blank window while this whole suite stays green.
- **No real visual rendering.** jsdom does no layout and no CSS. These tests can tell you a value is present in the DOM; they cannot tell you it looks right, is positioned sensibly, or is legible. A UI/UX pass has never been done with these tests, and can't be — that needs eyes on a real screen.

## Setup

```bash
node build.js          # from the project root, first
cd test
npm install
npm test               # runs setup.js, then all 13 suites; exits 1 if any fail
npm run test:dev       # the same against React's development build (stricter)
```

Every suite exits non-zero on failure. Until September 2026 eight of them always exited 0 and only printed their results, so an automated runner read them as passing whatever they printed. Two had in fact been failing silently since the project rename and the Tools regrouping: a storage test simulating a full disk on the pre-rename key, and a smoke test clicking a tool without opening its workbench.

You must run `node build.js` from the project root first — `setup.js` reads `electron/rxnpv.html`, which `build.js` produces. Re-run `setup.js` after every `build.js` run; it doesn't auto-detect staleness.

## Why setup.js exists and what it's protecting against

`setup.js` swaps the app's React `<script src>` tags (which point at the vendored copies in `electron/vendor/`, a path jsdom does not resolve) for the npm-installed React build, so tests can run with no network access. This sounds trivial and isn't — see the comments inside `setup.js` and `build.js` for the full story of two real bugs this exact process caught: React's own production build contains a literal `</script>` inside an internal error-message string (an HTML-parsing gotcha when embedding arbitrary JS as inline script content), and a separate, more serious bug in `build.js` itself, where JavaScript's `String.prototype.replace()` silently reinterprets `$`-prefixed sequences in a plain-string replacement argument — and the app's own source code contains such a sequence (ordinary currency-formatting code: `'$' + formatNumber(...)`). Both are fixed, both fixes are load-bearing, and both are exactly the kind of thing that looks like it should be safe until you actually run it against real content at real scale. If either script ever needs modifying, understand why the current approach works before changing it.

## The lost coverage — now substantially rebuilt

This project's original, deepest test coverage — a 38-check suite covering hand-verified DCF math to the cent — did not survive an earlier sandbox reset during development. `final_regression_pass.js` is a leaner behavioural replacement covering the core valuation paths plus every top-level view, but it asserts "nothing crashed and the right text appeared," not "the arithmetic is right."

**`math_verification.js` (1,130 checks) now covers that gap** and goes wider than the original did — every numerical primitive in the app checked against an independently-derived value.

### What it does and does not check — read this before adding to it

It verifies that the code **computes what it claims to compute**. It deliberately does **not** assert that any benchmark value is the *correct* one. Every benchmark in `data.js` was hand-derived from the source document (see `docs/`) and is authoritative — nothing in the test suite may override or "correct" those numbers. The tests assert that whatever a benchmark says, it then composes, discounts, and risk-adjusts correctly downstream.

Every expected value is derived independently — from a closed-form identity (`C(t½) = C(0)/2`, occupancy = 50% at K_D, Emax half-maximal at EC50), a published reference constant (erf, Φ, Φ⁻¹, Fisher's tea-tasting p = 17/35), or arithmetic worked out longhand in the comment above the check. **Never** by running the app and recording its output — a test that copies the implementation's own answer proves nothing.

Coverage: normal-distribution primitives and their mutual-inverse round-trip · two-proportion and two-sample z-tests · log-rank (hand-worked O−E and V on a 4-subject dataset) · Fisher's exact · Fragility Index (including monotonicity of the flip path) · Wilson score (cross-checked against the algebraically independent Newcombe form, plus [0,1] boundedness) · Altman–Bland P↔CI round-trip and its ratio-scale wrappers · closed-form power and the minimality of each sample-size solver · triangular sampling and Pearson correlation · PK/PD closed forms (IV bolus, Bateman oral, AUC identities, Emax/Hill) · NPV discounting conventions · PoS stage composition and modifier ratios · treasury-stock dilution.

When the suite was first written it reported 4 failures — all four turned out to be errors in the *tests* (a tolerance tighter than an approximation formula's own published bound, an arithmetic slip in a hand-worked comment, and a percent-vs-fraction assumption about `receptorOccupancy`). No engine bugs. That's worth knowing: the failures a verification suite reports are as likely to be wrong as the code, and each one needs diagnosing rather than "fixing" whichever side is easier to change.

## What each file does

- `audit_regressions_test.js` — one section per UI-level fix from the September 2026 Muse audit (`docs/RxNPV_MUSE_AUDIT.md`); every check was run against the audited tree (`f49689f`) and confirmed to fail there. Engine-side audit fixes are in `math_verification.js` under `FIN-0xx` section headers, derived longhand like everything else in that file
- `packaged/packaged_check.js` — **not part of `npm test`; Mac + built app only.** Runs the *installed* app's own `main.js` and preload from its `app.asar` under the project's Electron, replacing only the native save dialog (it returns a temp path), against a throwaway profile. `npm run packaged -- --mode=offline` (offline launch with every http(s) request cancelled, section/chart/report PDF + PNG + SVG through the real IPC, report add/reorder/retheme, resize, the audit fixes in the packaged renderer, captures of every view in both themes for review) · `--mode=reopen` (a fresh process on the same profile: the data survived) · `--mode=live` (the reference trials, VRTX Form 4, Uptravi, PCSK9/TTR, FDA zero-results vs outage). This is what closed the audit's B-001–B-013, and it found three things jsdom could not: box-shadows rasterised into every PDF, the navigation bar printed on page 1 of the report, and an unformatted 11-digit dollar figure
- `packaged/ui_audit.js` — **not part of `npm test`; Mac + built app.** Every view, workbench, tool, Simulation tab and sub-tool, Reference Sheet tab, Report and Bundle, in dark and light at 1470px and dark at 900px. Reports: text contrast below WCAG AA, text under 10px (sub/superscripts exempt), clipped text, targets under 24x24, unnamed buttons, unlabelled controls, control text under 12px / under 28px tall, charts without an accessible name, chart text drawn under 8px, sideways scroll, console errors. Writes `summary.txt`, `findings.json` and a full-page screenshot per view in `shots/` — **look at them**; a clean audit says nothing about whether a chart is drawn correctly. Run: `$E test/packaged/ui_audit.js --app=electron/dist/mac-arm64/RxNPV.app --out=<dir>`
- `packaged/export_sweep.js` — **not part of `npm test`; Mac + built app + network.** Every section and every chart in every view (Workspace, all 18 tools with live inputs, every Simulation tab and sub-tool, all 9 Reference Sheet tabs, Portfolio), exported through the real export buttons (only the save dialog replaced), each file compared with the on-screen element by visible content, every PDF page rendered with `pdf_pages` (compile `packaged/pdf_pages.swift` with `swiftc -O`), single-section PDFs required to fit one page, and a report built from three single charts and two sections exported and rendered. Writes contact sheets (screen · PNG · PDF side by side) — **open them**; the score flags a likely problem, the eye decides. Run: `$E test/packaged/export_sweep.js --app=electron/dist/mac-arm64/RxNPV.app --pdfpages=<compiled pdf_pages>` (`--only=Simulation` to narrow)
- `live_canary.js` — **not part of `npm test`; needs the network.** `npm run canary` fetches three reference trials through the app's own `fetchStudyByNctId`, runs decode + results, checks invariants that encode past API lessons, and diffs a compact summary against `live_canary_baseline.json`; exit 1 on drift. `--write-baseline` accepts the current output after a drift has been looked at. Worth running before trusting the decoder on new trials, or on a schedule
- `run_all.js` — what `npm test` runs: regenerates the harness, runs every suite, prints PASS/FAIL per suite and exits 1 if any failed (`--dev` for React's development build)
- `setup.js` — generates `test_desktop.html` (see above)
- `math_verification.js` — 1,090 numerical checks against independently-derived reference values; needs no DOM, runs straight against the engine source (see "The lost coverage" above for scope and rules)
- `export_test.js` — the section-export serialiser and sanitiser: form values carried into an export, export chrome removed, truncated titles restored, and — the part that matters most, since snapshots are stored and rendered back later — that nothing executable or remote survives sanitising. jsdom does no layout, so scroll-box expansion and export width are verified live in Electron instead
- `export_coverage_test.js` — every section in every view (Workspace, all 18 tools, every Simulation tab and Trial Statistics sub-tool, all 9 Reference Sheet tabs, Portfolio) carries its **own** export bar and a usable title; no old chart-only export row survives; "+ Report" stores a snapshot for an ordinary card and toggles a live section for one the report already renders; the report renders the snapshot's real content in its theme scope with nothing executable in it; include/exclude and reordering are saved on the case. Output PNG/PDF and the SVG picker's chart detection need layout, so they are verified live
- `final_regression_pass.js` — the main sweep: creates a case, exercises every core valuation path and every top-level view, asserts zero console errors
- `final_sweep.js` — navigation-only sweep across all Tools/Simulation tabs
- `recovery_errorboundary_test.js` — deliberately crashes a case (`programs: null`) and verifies the two-layer error boundary catches it, the case-list sidebar stays functional, and switching to a working case recovers cleanly
- `storage_warning_test.js` / `storage_warning_test2.js` / `storage_warning_ma_test.js` / `storage_warning_ma_test2.js` — verify that a failed `localStorage` write (simulated by overriding the app's own `saveCustomComps` function, not the native Storage API — see comments in these files for why) surfaces a visible warning instead of silently losing a custom comp entry
- `full_recovery_verify.js` — a leftover from this project's sandbox-reset recovery; kept as a working example of end-to-end smoke testing, not because it tests anything these other files don't

## Adding a new test

Copy the structure of `final_regression_pass.js`: mock `window.fetch` and `window.electronAPI` as needed, load `test_desktop.html` into jsdom with `runScripts: "dangerously"`, drive the UI via `click`/`setVal` helpers, assert on `root.textContent`. Keep `console.error`/`window.onerror` wired to fail the test on any uncaught error — that's what makes these tests catch real crashes, not just check that expected text appears.
