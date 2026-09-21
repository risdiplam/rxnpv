# RxNPV — orientation for Claude Code

Read this fully before making any change. It carries forward context from a long chat-based build process that has no other record — if it's not written here or in `docs/`, it doesn't exist anywhere Claude Code can see it.

## What this is, and the scope line that matters most

A desktop valuation sandbox and trial-outcome simulator for a retail biotech investor, built for one specific user's own use. The explicit, user-set scope: **"good enough to help a retail biotech investor improve their analyses. Doesn't need to be institutional grade, doesn't need to have every conceivable feature."**

This line should govern every future decision about what to build. It has already been used, explicitly, to decline several reasonable-sounding feature ideas (see "Deliberately not built" below). Treat a new feature request against this bar before starting it, and say so if something seems like it's drifting past it — that's the correct, previously-established response, not silent compliance.

macOS (Apple Silicon / arm64) only. Not tested on Intel. Not signed or notarized — deliberately deferred; see "Known limitations" below for why and what it would take.

## Standing instruction: push to GitHub continuously, not in batches

This repo previously lived only on the user's local machine for the entire build history, under an earlier project name tied to a pseudonym the user has since moved away from. That entire history was deliberately squashed into a single clean commit and force-pushed as a fresh start when the repo went public under the user's real GitHub account (`risdiplam`) — see the bottom of `docs/RxNPV_External_Suggestions_Tracker.md` for the full account of that rename and scrub.

The user has explicitly stated a standing preference, not a one-time request: **work continues to happen locally on this Mac (required — see "macOS only" above, this is a real Electron app that needs a real Mac to build/package/verify), but every meaningful unit of work gets committed and pushed to `github.com/risdiplam/rxnpv` before moving to the next thing.** The stated reason is a real, previously-articulated fear of catastrophic local data loss — losing the project entirely if something happens to this machine — and the fix is keeping GitHub continuously current rather than treating a push as an occasional, separate "let's back things up now" event.

This is durable authorization for routine commits and pushes on this project specifically (not a license to push other repos, and never a license to force-push over the public history again without being asked) — a future session does not need to re-ask before pushing ordinary work here. Still stop and ask before anything unusual: a force-push, rewriting history again, changing repo visibility, or anything that isn't just "commit and push what was just built."

Practical implication for how work should be sequenced: don't let more than one meaningful change sit uncommitted/unpushed. Build → verify → commit → push, then move to the next thing, rather than accumulating a long list of local-only changes to push at the end of a session.

## Architecture — read this before touching the build

**This is not built with a real bundler.** No webpack, no esbuild, no Vite, no ES module imports/exports anywhere. It's 32 plain JavaScript files, concatenated in a specific order into one giant inline `<script>` block inside `shell.html`, producing `electron/rxnpv.html` — the single file the Electron shell actually loads.

This was a pragmatic choice made out of necessity: the app was originally built entirely inside a Claude chat conversation, in a sandboxed environment with no real bundler tooling available. It works, it's been thoroughly tested in that form, and **changing it is a legitimate future improvement but a real, deliberate architecture decision** — not something to fix in passing while doing something else. If you do it, do it as its own isolated change with full re-verification, not bundled into a feature or bug fix.

Because there's no module system, every file relies on the global scope and on `MODULE_ORDER` (declared at the top of `build.js`) being exactly right. Function declarations hoist within the combined script, so a file can call a function defined later in the concatenation order — but `const`/`let`/`class` do not hoist, so anything read at module-evaluation time (not inside a function body) must come from something earlier in the list. **Do not reorder `MODULE_ORDER` without understanding this and re-running the full test suite.**

### Build commands

```bash
node build.js              # reassemble only -> electron/rxnpv.html
node build.js --package    # reassemble + full electron-builder package -> electron/dist/mac-arm64/RxNPV.app
```

`build.js` syntax-checks every source file individually before concatenating — a broken file gives a clear, isolated error here instead of an unreadable failure somewhere inside a 900KB combined blob.

### A real bug this project's own tooling caught, worth understanding before writing anything similar

`build.js` originally used `shell.replace('__SCRIPT__', combined)` — a plain string as the replacement argument. `String.prototype.replace()` treats certain `$`-prefixed sequences in a *string* replacement argument as special pattern tokens (`$&`, `` $` ``, `$'`, `$$`), even when the search pattern itself is a plain string, not a regex. `combined` is hundreds of KB of real application code, and it happens to contain the literal two-character sequence `$'` (from ordinary code: `'$' + formatNumber(...)` in `ts_app.js`) — which JavaScript silently reinterpreted as "everything after the match," splicing unrelated file content into the middle of a source file. The fix, now in place: pass a **function** as the replacement argument, not a string — a function's return value is always inserted verbatim. If you ever write code that does string-replaces-into-string with large, arbitrary content as the replacement, use a function. This is a real, previously-shipped-adjacent bug, not a hypothetical.

### Project layout

```
src/            32 source modules — see MODULE_ORDER in build.js for the authoritative list/order
shell.html      HTML template with a __SCRIPT__ placeholder
build.js        reassembles src/ into electron/rxnpv.html
electron/       main.js, preload.js, package.json (electron-builder config), RDKit_minimal.js/.wasm
test/           jsdom-based functional tests — see test/README.md, read it before trusting what these do and don't verify
docs/           design-decision history and feature documentation — see below
```

`electron/rxnpv.html`, `electron/dist/`, `electron/node_modules/`, and `test/node_modules/` are all build artifacts — regenerated by `build.js` / `npm install`, correctly gitignored, never hand-edited.

## What's built — full inventory

`docs/RxNPV_External_Suggestions_Tracker.md` is the authoritative, detailed build log — every feature, what was verified, and every bug found and fixed along the way, in the actual words used when each was built. Read it before assuming something is or isn't implemented. Summary:

**Core engine:** bottoms-up rNPV valuation (Quick and Detailed/Full revenue modes), Bear/Base/Bull scenarios (customizable per case), two valuation methods (full DCF and Simple Multiple), PRV, capital structure/dilution bridge, Partnership Economics (royalty/milestone/upfront/cost-sharing overlay), Dilution-Path Financing (projects future raises from cash runway), full-case Monte Carlo (3,000-trial fair-value distribution).

**Workspace tools:** Evidence Log, structured red-flag checks, Reverse-Solve (implied peak revenue/share/timing), Calibration Log with Brier scoring, Receptor Occupancy Bridge.

**Top-level views:** Workspace, Reference Sheet (8 tabs, "How This Works" guide plus benchmarks), Tools (9 tabs, grouped into Benchmarks / Your Case / Live Research), Simulation (6 tabs — Trial Outcome/PoS assurance, Peak Sales Monte Carlo, PK/PD, Chemistry via RDKit WASM, Historical Comps, FDA Lookup), Portfolio (cross-case aggregation), Report (PDF-style export).

**Comps databases (all with custom add/edit/delete):** M&A (65 deals), Peak Sales (37 drugs), Licensing/royalty (11 deals) — all dated "as of August 2026," each entry multi-source-verified against primary filings/press releases, not a third-party tracker.

**External data integrations:** SEC EDGAR (company financials, full-text search, Form 4 insider transactions), ClinicalTrials.gov (search + Trial Watch snapshot-and-diff), openFDA (approvals, labels, adverse events).

**Cross-feature connections:** Partnership Economics → Licensing Comps, Company Lookup → Trial Watch, Peak Sales Monte Carlo → case export — all explicit, one-click, never automatic.

**Resilience:** two-layer error boundary (a crash in one view degrades gracefully instead of white-screening the whole app), storage-failure warnings on every custom-comp save path (a failed `localStorage` write used to fail silently and lose data with zero indication — fixed).

## Deliberately not built — do not "fix" these as if they were oversights

Explicit, discussed, scope-line decisions, not gaps:
- 13F institutional holdings (different filing type from Form 4 insider transactions, which *is* built)
- Versioned snapshots
- Platform/pipeline correlation for Sum-of-the-Parts
- Regulatory precedent library
- Group-sequential trial modeling
- QED/PAINS/SA-score molecular metrics (also: confirmed not available in the RDKit WASM build in use — a real technical constraint, not just a scope call)
- Code signing / notarization — see "Known limitations"

If a future request seems to want one of these, say so plainly and ask before building — don't silently reopen a closed scope decision.

## Known limitations — real gaps, not modesty

- **Code signing / notarization never done.** This requires an Apple Developer account (the user's own) and macOS-native tools (`codesign`, `notarytool`) that were never available during chat-based development. **This is likely the highest-value thing Claude Code can newly do** — it runs on real macOS with real tools. Confirm with the user whether/when they want this before doing it; it has cost and account implications that aren't a code change.
- **No feature has ever executed against a real, live external API call.** Every EDGAR/ClinicalTrials.gov/openFDA test in this entire project used mocked responses. The parsing logic for each was verified against real responses fetched via web search during development, but the actual `fetch()` calls inside the running app have never fired for real in a test. **Also newly possible on a real Mac** — run the packaged app and click through Company Lookup, Trial Watch, and FDA Lookup with a real company/trial for the first genuine end-to-end verification.
- **Chemistry (RDKit WASM) has never been confirmed to actually execute.** The binary is confirmed byte-correct inside every packaged build; whether it successfully loads and analyzes a real SMILES string at runtime has never been verified — jsdom has no real WebAssembly runtime. Same story: verifiable now, wasn't before.
- **A UI/UX pass has never been done.** All prior verification is functional (does it crash, does the right value appear) — never visual (does it look right, is it well-organized, is it intuitive). This is a real, acknowledged gap, not an oversight being hidden.
- **The original 38-check core-engine regression suite did not survive a sandbox reset during development** and was never fully rebuilt — see `test/README.md`. `test/final_regression_pass.js` is a leaner replacement, not equivalent depth.

## In-flight / proposed, not yet built

- **Fragility Index** — proposed by the user, not yet built. A real, established clinical-trial statistic (Walsh et al. 2014): the minimum number of patients whose outcome would need to flip to turn a statistically significant trial result non-significant. Computable via Fisher's exact test on a 2×2 outcome table, iteratively flipping the minimum patients needed. Deliberately complementary to the existing Trial Outcome/PoS tab, not a duplicate — that tool is forward-looking (will a future trial succeed), this is backward-looking (how robust is a result that already read out). Current design lean: a clearly-separated section within the existing Trial Outcome tab rather than a new tab, but this was left as an open design question, not decided.

## Coding conventions actually followed throughout this build

- **Hand-verify new math against real, independently-computed numbers before trusting it** — not just "does it run without crashing." This caught multiple real bugs throughout the project (a units error inflating dilution by ~1,000,000x, a PoS-composition bug silently understating Bear-case burn, a fractional-launch-year bug silently zeroing cash flows). Assume the same discipline is expected of any new numeric feature.
- **Optional/possibly-missing fields are read defensively**, via a shared normalizer function where one exists (e.g. `getRevenueBuild()` in `engine.js`), not scattered inline `|| {}` guards. A real crash (missing `revenueBuild` white-screening the entire app) came from exactly this pattern being inconsistent — some call sites guarded, one wasn't.
- **Never silently swallow a failure a user would care about.** `saveCustomComps()` used to catch-and-ignore a failed `localStorage` write; fixed to return success/failure so callers can warn the user, since data was being silently lost. Apply the same standard to new persistence paths.
- **Verify inside the actual packaged binary before considering something delivered** — not just in source, not just in a test harness. Every feature in this project was confirmed present via `grep`/byte-search inside the built `.app`'s `app.asar` before being called done.
- Copyright/citation discipline (paraphrase over quoting, one short quote per source max) governed research done *during* chat-based development for comps data — not directly relevant to Claude Code's own work, but explains why comps entries are written the way they are (paraphrased deal terms, not quoted press-release language).

## Where the rest of the documentation lives

`docs/` contains the full design-decision history: `RxNPV_External_Suggestions_Tracker.md` (the authoritative build log, read this first of the docs), `RxNPV_Feature_Overview.md`, `RxNPV_Field_Reference.md`, `RxNPV_Human_Test_Checklist.md`, and the biotech-research-agent-system docs (a separate, related tool this user also uses — not part of this codebase, included for context only).
