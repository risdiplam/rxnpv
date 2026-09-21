# RxNPV — Human Test Checklist for the Simulation Build

Everything below is either brand new (the Simulation tab, merged in from TrialSim) or specifically flagged as something I could not verify from my sandbox. This is not a re-test of the core valuation app — that was already tested extensively and you were already mid-testing it separately. This list is focused on what's actually new or actually unverified.

---

## 0. Before anything else

- [ ] Confirm this is an Apple Silicon (arm64) Mac — this build won't run on Intel at all, not even poorly.
- [ ] First launch will likely trigger Gatekeeper (unsigned app). Right-click → Open, rather than double-click, the first time. If macOS still refuses, check System Settings → Privacy & Security for an "Open Anyway" prompt.
- [ ] Confirm the app actually launches and the custom icon shows correctly in the Dock and Finder.

## 1. Navigation sanity

- [ ] All four top-level views load: Workspace, Reference Sheet, Tools, **Simulation**.
- [ ] Toggle the theme (sun/moon icon, top right) — confirm the Simulation tab's colors follow it too, not just the other three views. It should not have its own separate toggle anywhere.
- [ ] Switch away from Simulation to another view and back — note whether it returns you to the same sub-tab you were on, or resets to the first one. (This is a known, deliberate-for-now behavior I flagged as an open question — I want your read on whether it should actually match how Tools behaves, which does reset.)

## 2. Trial Outcome / PoS (Bayesian assurance Monte Carlo)

- [ ] Run it once with the defaults, note the result.
- [ ] Switch through all three endpoint types (Binary, Continuous, Time-to-event) — confirm the input fields change appropriately for each and each one runs.
- [ ] Try a fixed-value prior (no uncertainty) vs. a normal prior — results should differ but neither should error.
- [ ] If you have a real trial design in mind (a known Phase 2/3 you're tracking), plug its actual numbers in and sanity-check the output against your own intuition for that trial's odds.

## 3. Peak Sales Monte Carlo

- [ ] Run with defaults.
- [ ] Make more than one input uncertain at once (e.g., both diagnosis rate and peak share as distributions, not just one) and check that the driver-sensitivity list at the bottom actually ranks them differently, not just lists whichever one happens to vary.
- [ ] Try each distribution type (fixed, uniform, normal, triangular) at least once.

## 4. PK/PD

- [ ] Run both routes — Oral and IV — and confirm both produce a concentration-time chart and a dose-response chart.
- [ ] If you have a real drug's published PK parameters (half-life, Vd, etc.) handy, plug them in and see if Cmax/half-life look right against what's published.

## 5. Chemistry — the one I genuinely could not verify

This is the single most important item on this list. I confirmed RDKit's underlying chemistry math is correct (checked directly against real reference values in a plain Node environment), but I could never confirm it actually *loads and runs inside the real app*, since my testing tool can't do WASM loading the way a real browser engine can.

- [ ] Open the Chemistry tab. It should briefly show "Loading chemistry engine…" and then switch to a usable state with the Analyze button enabled. **If it stays stuck on "Loading" indefinitely, or the Analyze button never enables, that's the bug to report** — start there.
- [ ] Enter the default SMILES (aspirin) and click Analyze. Confirm you get a rendered 2D structure, a descriptor table (molecular weight, LogP, etc.), and pass/fail badges for Lipinski/Veber.
- [ ] Try the structural-similarity comparison field with a second SMILES string.
- [ ] Try an obviously invalid SMILES string (e.g., "notarealsmiles") and confirm it shows a clear error rather than crashing.

## 6. Historical Comps (live ClinicalTrials.gov)

- [ ] Run a real search (the default condition/phase, or your own). This is a genuine live network call — first real test of it outside mocked data.
- [ ] Confirm real trial data comes back, not an error.
- [ ] Confirm the text is clear that this shows status/duration/enrollment patterns, not a "win rate" (CT.gov doesn't expose one, and the tool should say so plainly).

## 7. FDA Lookup (live openFDA)

- [ ] Search a real, known approved drug. Confirm approval history, label summary (including boxed warning if the drug has one), and adverse-event counts all populate.
- [ ] Search a drug name that doesn't exist. Confirm you get a clear "no match" message, not a blank screen or a crash.

## 8. General

- [ ] Resize the window smaller and larger — does the Simulation tab's content (capped at 900px wide) look reasonable, or does anything clip/overflow oddly?
- [ ] Anything that feels slow, laggy, or just "off" — even if you can't articulate exactly why — is worth a note. Gut feel matters here as much as a clean repro.

---

**When reporting back:** for anything that breaks, the most useful thing you can give me is which tab, what you entered, and what happened instead of what you expected — that's usually enough for me to find it without needing you to dig into DevTools or logs yourself.
