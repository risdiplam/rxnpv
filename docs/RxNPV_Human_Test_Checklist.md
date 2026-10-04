# RxNPV — Human Test Checklist (retired)

This file used to hold a manual checklist written for the early Simulation build. It described an app that no longer exists — a Chemistry tab that was later removed, four top-level views instead of six, and a Gatekeeper workaround that no longer works on current macOS — so a reader following it would test the wrong things. Its body was removed in September 2026, after the external audit flagged that a "historical" banner alone was a weak guard.

**Use instead:**

- **Hands-on use as the finished product:** [`RxNPV_Trial_Guide.md`](RxNPV_Trial_Guide.md) — what to try, and how to report what you find.

- **Manual test steps:** "Feature overview, and how to test each feature" in the root [`README.md`](../README.md).
- **What only the packaged app can confirm** (offline launch, PNG/PDF export, report pin/reorder/retheme, window resize): `test/packaged/packaged_check.js` — `cd test && npm run packaged -- --mode=offline|reopen|live`, described in [`test/README.md`](../test/README.md). (The September B-001 – B-013 worklist in the Muse audit is the historical record it replaced.)

The old text is in git history if it is ever needed.
