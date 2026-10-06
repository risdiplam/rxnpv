# RxNPV — hands-on checklist

Work top to bottom over a few sessions; tick as you go. Part 1 builds **Spruce (SPRB)** from scratch, using [`RxNPV_SPRB_Reference.md`](RxNPV_SPRB_Reference.md) for every figure. Part 2 visits every remaining feature. The two sample cases are the reference: anything you are unsure about, open the same screen on Stoke or PepGen and compare.

**For each item:** does it work, is the number right (or at least defensible), and is it clear? Report anything wrong, confusing or missing as one line: **build** (foot of the sidebar) · **where** · **what you did / expected / got** · **how bad** (wrong number > crash or lost edit > confusing > cosmetic).

---

## 0. Before you start

- [ ] Sidebar → **Backup & restore** → choose a folder. The status line should change from "Automatic backup is off" to a time.
- [ ] Note the build at the foot of the sidebar (e.g. `RxNPV 1.0.0 · b07a10d · built 2026-10-05`).
- [ ] Your two real cases: retype each price (or set its date beside the price box). Until you do, the Overview's freshness line says "date not recorded".

## 1. Build SPRB from scratch

### Start the case
- [ ] **+ New case**. Name it, ticker `SPRB`, price `45.52`. The date beside the price fills with today. A new, incomplete case opens on **Assumptions**.
- [ ] **Napkin** vs **Full model** (top of Assumptions): flip once each way. DCF-only inputs hide in Napkin and come back in Full. Stay on **Full model**.

### Pull the company's filings
- [ ] **Tools → Company → Company Lookup**, search `SPRB`. Check against the reference sheet: 2,874,013 basic shares, $96.3M cash, debt **$7.1M on the balance sheet ($16.6M face)**, and the amber note about untagged options and warrants (409,850 excluded from EPS).
- [ ] **Export financials to case →** on SPRB. The message says shares are basic only. In Assumptions → Capital structure, cash, debt, cash date, monthly burn and the source line should all be filled.
- [ ] Switch Capital structure to **Detailed**. Enter options 127,084 at $0 (the RSUs) and warrants 64,000 at $50. Decide on debt ($7.1M or the $16.6M face) and note the choice in the Evidence Log.
- [ ] **Load insider activity (Form 4)**: no open-market buys or sells; awards on the second tab. "Bought & sold" must not show grants.
- [ ] **Undrawn ATM, debt, milestones and shelf** (Capital structure): ATM $75M. Fair value must **not** move; "reachable" appears in the summary.

### The program
- [ ] Drug name, indication (MPS IIIB), therapeutic area. Modality: Biologic. **Current phase: Filed (NDA/BLA)**. Launch in year: 1.
- [ ] Trial IDs (all five NCTs) and target `NAGLU`. These are tool-only fields; the value must not change when you type them.
- [ ] **PoS attributes:** rare disease; biomarker as appropriate. Watch the program card say how they combine. Then type your own cumulative odds and see Bear/Bull scale from it.
- [ ] **Revenue build (Full):** patients (prevalence or incidence), diagnosed, treated, share, price and basis. Check one number by hand: peak revenue ≈ patients × diagnosed × treated × share × net price. If it disagrees, report it.
- [ ] **Price basis:** try WAC vs ASP and see the conversion note; then set what your source quotes.
- [ ] **Exclusivity & LOE:** biologic defaults. Open **Medicare price negotiation (IRA)**: it should warn that rare-disease-only drugs are largely excluded. Leave it off.
- [ ] **Cost Structure:** COGS % (benchmark, or your own figure).
- [ ] **In-licensed asset (royalties or milestones owed to a licensor):** BioMarin, ~10% royalty, $25.5M on approval, one or two sales milestones you judge. The summary line shows what's owed, the section list gains a dot, and fair value falls. On the Overview's year-by-year table, the cost column becomes "COGS, S&M + licensor". Add a sales milestone, then delete it (two clicks). Untick the section and check the value returns exactly.
- [ ] **PRV:** on (TA-ERT is eligible); the bridge gains a voucher line.
- [ ] **Corporate G&A:** pre-commercial G&A (Q2 run rate × 4); wind-down years.
- [ ] **Section list** (left of Assumptions): dots mark sections you changed or that still need input. Clicking one jumps there.
- [ ] **Live impact** (right): change one input at a time. Every move should go the way you expect (higher odds → higher value, later launch → lower), and the top four drivers should look sensible.

### Evidence and catalysts
- [ ] **Evidence tab → + Add evidence:** at least the patient count (verify the deck slide), the price analog and your odds, each with source, confidence and fact/judgment. Edit one; delete one (two clicks).
- [ ] **What would change my mind:** fill two of the four fields.
- [ ] **Calibration tab → + Add prediction:** "TA-ERT BLA submission", date `2026-Q4`, **Pin this as the catalyst's date**, type Other, source "Q2 2026 results release". Add a second, unpinned prediction for the FDA decision (`2027-Q3`) with your odds and the market-implied odds from the Overview.
- [ ] Try a bad date (e.g. `next summer`): it should say it stays undated. Try `2027-02-31`: the same.

### Read the Overview
- [ ] **Headline:** Bear / Base / Bull / If it works, your odds vs what the price implies, and the gap in points. Press **held fixed**: does the list match your inputs?
- [ ] **Freshness line:** price date (today), cash 2026-06-30 with its age, next catalyst "2026-Q4 (pinned)", odds source. A newer filing check runs in the background (none expected until Spruce's Q3 10-Q in November).
- [ ] **The case at a glance:** your evidence → odds curve → value fan.
- [ ] **What each outcome is worth:** both failure floors side by side, the one in use marked; if one is $0, it says why. Open "How 'if it fails' is worked out" and check its arithmetic against your cash, the filing cost and G&A.
- [ ] **Outcome tree:** with Filed, one gate (the FDA). Branch odds multiply back to your odds. Try the resubmission option.
- [ ] **Full-case Monte Carlo → Run 3,000 trials:** histogram with P10 / median / P90, today and Base marked, no overlapping labels.
- [ ] **Year by year:** toggle × odds / If it works; Chart / Table. The running total ends at the enterprise value.
- [ ] **What else the price implies, break-even, value bridge:** each reading in plain English. Bridge steps should be cash, debt, PRV, raise.
- [ ] **Red flags** (Evidence tab): read each; **Mark considered** on one, then change the input it names, and it should reopen.
- [ ] **Snapshot from the model** (Evidence): a dated entry appears. Take it again: today's entry is replaced, not duplicated.

### Scenarios tab
- [ ] Edit Bear and Bull; the discount rate stays the same in every scenario.
- [ ] **Before the next readout:** with Filed it frames the FDA decision; edit a result's odds or share.

## 2. Every other feature

### Tools (with SPRB open; each should say what it filled from the case)
- [ ] **Trial Decoder** `NCT07579910`: design in plain English, red flags, no results. Then `NCT03036124` (DAPA-HF), then **Load what these trials actually reported**: the hazard ratio with its interval. Then **Use as a simulator starting point →**, which opens Simulation with the prior filled and asks for the control median.
- [ ] **Compare Trials:** two to four NCTs; only design and time point are shaded as differences.
- [ ] **Asset Program** "tralesinidase alfa, TA-ERT, AX 250, BMN 250": 5 trials, the dropped testosterone study counted, "Phase 4" as registered. Select two condition names → **Merge**; the checklist count updates; unmerge.
- [ ] **Trial Explorer:** condition "Sanfilippo" (or "MPS III"), any phase → **Who reads out first**. Save it to the case; it then appears under SPRB's catalyst in **Portfolio**. Trial Watch: snapshot NCT07579910, later **Check for changes**. Analog effect board on a disease with posted hazard ratios (e.g. "heart failure"), then use a prior preset.
- [ ] **FDA Lookup** (an approved drug, e.g. `Brineura`): approvals, label date, boxed warning yes/none, limitations of use quoted, adverse events.
- [ ] **Target Dossier** `NAGLU`; **Literature** `tralesinidase alfa` (12 records, split by publication type).
- [ ] **Catalyst Calendar:** your pinned catalysts first, then registry completions labelled "not a readout"; **Pull events**.
- [ ] **Cash Runway:** EDGAR pull (~$15.4M a quarter); forward runway "from today, on the 2026-06-30 cash"; with facilities beside it.
- [ ] **Runway vs. Catalyst:** your Q4 2026 window on the timeline; funded or not, with months of cash at the window's end; the financing bridge if short. Raise the cushion until it binds, try **Model this raise** (it asks first), then put it back.
- [ ] **Launch & Actuals:** `Brineura` should say no Medicare record (a children's drug). Try `Lamzede` in Part B with analogs `Vimizim, Elaprase` and read the launch-shape line. On a Full-build case it offers **Use this shape for …** (confirm, then undo by retyping).
- [ ] **Exclusivity / LOE** `Brineura`: biologic floor 2029-04-27. `Farxiga`: Orange Book patents.
- [ ] **Sensitivity:** tornado and price grid; the readings match.
- [ ] **Binary Event:** today / if it works / if it fails per share, then in market cap. **What the options price:** type a straddle; it should read the case's price, not the market cap.
- [ ] **Diluted Market Cap:** matches your capital structure.
- [ ] **M&A Premium, Peak Sales Comps, Licensing Comps:** add Brineura as a **custom drug comp** (peak $186.4M, 2025), check it's labelled custom, then delete it (two clicks).

### Simulation
- [ ] **Trial Outcome / PoS:** binary, continuous, time-to-event. For time-to-event set **Effect starts at month** 6: the delay comparison line appears. Target event count plus trial start, then **Pin … as a catalyst window** (confirm). **Use as this case's odds** on a Phase 2/3 case (try PepGen): the conversion lines add up, the run is recorded on the program card, and typing over the odds removes the record.
- [ ] **Phase 2→3 Translator:** change the discount factor; the sublabel says it's yours.
- [ ] **Trial Statistics:** each of the 7 sub-tools once; Sample Size's stress panel.
- [ ] **Meta-Analysis, Peak Sales** (export to a case), **PK/PD** (and receptor occupancy).

### Reference Sheet, Portfolio, report and export
- [ ] **Reference Sheet:** all 9 tabs; the Trial Glossary.
- [ ] **Portfolio:** summary table, **Upcoming catalysts** (pins only, funding state, competitor completions, show/hide), PoS bars, runway list, the scatter.
- [ ] **Generate Report → Sections → Decision memo:** read it as a stranger would. Then **Everything** → **Export as PDF** → open the PDF. (This save dialog is the one step no automated check covers.)
- [ ] **Export** on any section: PNG, PDF, SVG; **+ Report**; **+ Bundle**; **Save to case** (Tools and Simulation only). Open each file you export.
- [ ] **Saved tab:** reopen a save in Tools; open a sample's worked example.
- [ ] **Bundle:** merged PDF and separate PDFs.

### Data safety
- [ ] **Backup & restore:** export one case, import it as an addition; your other cases untouched.
- [ ] **Duplicate case**, then **Delete case** on the copy (a confirmation modal).
- [ ] **Offline** (Wi-Fi off): Workspace, Reference and Simulation work; live lookups say they could not connect.
- [ ] Quit and reopen: everything is where you left it.

## 3. Known and expected — not bugs

- The samples are dated (Stoke 2026-09-25, PepGen 2026-09-29); their freshness line goes amber after a week. That's correct.
- Runways count from today: a filing's cash ages until the next 10-Q (Stoke and PepGen file in November).
- Registry "Phase 4" for an unapproved drug, and completion dates, are shown as registered.
- Short text-only sections export with more margin than the screen; that's by design.
