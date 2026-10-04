# RxNPV — trial guide

For the hands-on trial that started in October 2026: using the app as the finished product over a few days or weeks and noting anything that is wrong, confusing or missing. The automated checks (see `test/README.md`) cover crashes, layout, exports and the math. This trial is for what they cannot judge: whether the app is right, clear and worth using.

## Before you start

1. **Turn on automatic backup.** Sidebar → *Backup & restore* → choose a folder (`~/Documents/RxNPV-backups` already holds the manual backups). From then on the app writes a fresh copy whenever your data changes, and the sidebar line says when it last did. Until a folder is chosen the line reads "Automatic backup is off".
2. **Note the build.** The foot of the sidebar names it, e.g. `RxNPV 1.0.0 · 468576f · built 2026-10-03`. That names the exact code you are running.

## Reporting what you find

One line each is enough. A screenshot helps whenever the problem is something you can see.

- **The build** (foot of the sidebar)
- **Where:** the view and tab, e.g. Workspace → Scenarios, or Tools → Company → Cash Runway
- **What you did, what you expected, what happened**
- **How bad:** a wrong number > a crash or a lost edit > confusing > cosmetic

A number that looks wrong is the most valuable report, even when you are not sure. Say what you expected and why.

## Things worth trying

Roughly in order of how much they would matter if broken.

1. **Build a case from scratch for a company you know.** New case → Company Lookup → export the financials to the case → fill the program on Assumptions. Check that the cash, shares and burn match the latest 10-Q.
2. **Check one number by hand.** For example, peak revenue = patients × diagnosed × treated × share × net price. If the app disagrees with your arithmetic, that is a report.
3. **Change one input at a time and watch Live impact.** Every move should go the way you expect: higher odds raise the value, a later launch lowers it.
4. **Napkin vs Full model.** Flip between them on a case and see whether the red flags tell you clearly why the values differ.
5. **Scenarios tab:** edit Bear and Bull, and use "Before the next readout".
6. **Evidence tab:** add an entry, mark a flag considered, press "Snapshot from the model".
7. **Tools and Simulation with a case open.** They should fill from that case and say so. Try each workbench once.
8. **Generate Report → Export as PDF.** Open the PDF and read it as if someone sent it to you.
9. **Backup & restore:** export one case, then import it back as an addition. Your other cases must be untouched.
10. **Run it offline** (Wi-Fi off). The workspace, Reference Sheet and Simulation should all work. Live lookups should say they could not connect, not that there is no data.

## What is deliberately not there

`RxNPV_Feature_Map.md` lists every feature considered and declined, with the reason (13F holdings, versioned snapshots, code signing and others). If you miss one of them in use, that is worth saying, as a reason to reopen it rather than as a bug.

## Known and expected

- The first launch after an install can show macOS's "unidentified developer" prompt on another Mac. On this Mac a locally built app opens directly.
- Live lookups depend on free public services (ClinicalTrials.gov, openFDA, SEC EDGAR, Europe PMC, Open Targets, CMS). They retry automatically. A rare outage is shown as an outage.
- Both sample cases are dated (`SAMPLE_CASE_AS_OF`) and do not change day to day. Your own Stoke case uses the June 30, 2026 balance sheet until it is refreshed from the Q3 10-Q (Stoke files November 3).
