# RxNPV Interaction Request

Attach alongside BiotechAgent and RxNPV Field Reference. Pick one mode and fill in that section only — the two modes serve different purposes and aren't meant to be used together in the same request.

**Mode for this request:**

- [ ] Mode A — New field research. I need specific values researched to enter into RxNPV.
- [ ] Mode B — Case review. I want the agent to sanity-check a case's current assumptions and output against evidence.

---

## Mode A — Field Research Request

Use once BiotechAgent and RxNPV Field Reference are both attached and the Context Compliance Report has been approved, in place of (or alongside) the standard Per-Ticker Research Request when the goal is specific values to enter into a RxNPV case rather than a full diligence memo.

### Assignment

- **Company:** [Name]
- **Ticker / exchange:** [Ticker]
- **Asset(s) / indication(s) this request covers:** [Name(s)]
- **RxNPV case name:** [As named in the app, for your own tracking]
- **Data cutoff:** [Date, time, time zone]

### Fields Requested

Check only the fields actually needed this round — a small, focused request produces better-sourced answers than a request for everything at once.

**Program-level:**

- [ ] Current phase / classification confirmation
- [ ] PoS override
- [ ] PRV eligibility and value
- [ ] Launch timing
- [ ] Peak revenue (Quick mode)
- [ ] Population/funnel inputs (Detailed mode)
- [ ] Pricing inputs (Detailed mode)
- [ ] Market share / competitive positioning (Detailed mode)
- [ ] Exclusivity / LOE timing
- [ ] Cost structure (COGS %, sales force, marketing)
- [ ] R&D-to-launch override (cost and/or timeline)

**Case-level:**

- [ ] Current price
- [ ] Cash and debt
- [ ] Diluted shares outstanding
- [ ] Corporate G&A
- [ ] Discount rate
- [ ] Terminal value / exit multiple
- [ ] Peak-revenue multiple (if case uses Simple Multiple mode)
- [ ] Bear/Bull scenario override reasoning

### What's Already Known

List anything already set in the case, so the agent isn't re-deriving it — and flag anything you specifically want re-checked against current sources despite already having a value.

**Already set** (no need to re-research unless flagged):
[Field: value — or "n/a, first pass"]

**Re-check specifically:**
[Field and why — e.g., "cash balance, last set from a filing that's now two quarters old"]

### Context Specific to This Request

**Known facts or company claims requiring independent verification:**
[Anything from a press release, deck, or call that needs a primary-source check before it goes in as a Fact]

**Sources to prioritize for this round:**
[e.g., "the Q2 10-Q specifically," "the most recent trial registry update," "the AdCom briefing document"]

**Anything explicitly out of scope for this request:**
[Optional]

### Required Output

For each field researched, provide:

1. **The value, in RxNPV's exact input convention** per RxNPV Field Reference (state units explicitly — e.g., "Peak revenue: $850M" not a bare number).
2. **Fact / Inference / Speculation** label, per BiotechAgent.
3. **Direct source(s)** with link, date, and the exact supporting passage or figure.
4. **Reasoning**, for anything labeled Inference — the facts it rests on and the main uncertainty.
5. **A stated range**, not just a point estimate, wherever the underlying evidence supports one (e.g., PoS as 55–70%, not a bare "62").

End with a short summary list — field name, proposed value, Fact/Inference/Speculation, confidence (high/moderate/low), and one-line source summary — so the whole round can be scanned before anything gets typed in.

---

## Mode B — Case Snapshot for Review

A quick, fill-by-hand snapshot of a case's current assumptions and output, for pasting in when the goal is a sanity check or critique against real evidence — not a request for new research. There's no export button in RxNPV for this; copy the values straight off the screen. Only fill in what's actually set or overridden — leave benchmark-default fields out rather than re-stating every default.

### Case

- **Company / ticker:** [Name / Ticker]
- **Current price:** [$ per share, as of date]
- **Valuation method:** [DCF / Simple Multiple]

### Program(s)

Copy one section per asset. Skip any line left at RxNPV's default/benchmark.

**Asset:** [Drug name — indication]

- **Phase:** [ ]
- **Modality:** [ ]
- **PoS override:** [ % , if set — otherwise "using benchmark"]
- **Peak revenue assumption:** [$ , Quick or Detailed mode]
- **Launch timing:** [years from now, if overridden]
- **PRV modeled:** [yes/no, value if yes]

### Case-Level Assumptions

- **Cash / Debt:** [$ / $]
- **Diluted shares:** [count]
- **Discount rate:** [%]
- **Corporate G&A:** [$M pre-commercial / G&A split %]
- **Terminal value:** [off, or exit multiple / growth rate used]

### Current RxNPV Output

- **Bear / Base / Bull fair value per share:** [$ / $ / $]
- **Base case enterprise value:** [$]
- **Implied PoS** (if current price is set, DCF mode only): [market implies X% vs. your Y% assumption]
- **Sum-of-the-Parts** (multi-asset cases, DCF mode only): [per-program value: Asset A $X / Asset B $Y — total $Z]

### What You Want From This

[Pick one or state your own — e.g.: "Sanity-check the PoS assumption against current clinical evidence." / "Is the peak revenue estimate defensible given the competitive landscape?" / "Does the market's implied PoS make sense given what's actually known?"]
