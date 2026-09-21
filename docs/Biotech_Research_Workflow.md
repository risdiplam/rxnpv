# Biotech Research Workflow

## Purpose

Use this checklist to run a disciplined, evidence-first research process for a biotech company, clinical catalyst, or long-form article.

**Core rule:** Do not ask the agent for a definitive opinion before it has built and cited an evidence record.

> Question → Evidence Sourcing & Verification → Dossier → Interpretation → Event Update → Article

This document is self-contained — every prompt referenced below is given in full, in place. `Biotech_Prompts_1-5.md` is no longer needed as a separate attachment; everything it contained now lives at the step where it's actually used.

---

# Phase 0 — New Chat Setup

## 0.1 Attach Agent Context

- [ ] Attach `BiotechAgent.md`
- [ ] Send the prompt below
- [ ] Do not attach the per-ticker request or company materials yet

```other
The attached Agent Context file is governing instruction, not background reading. Apply all relevant requirements in it throughout this conversation.

Do not conduct substantive research yet. First provide only the required Context Compliance Report under the Agent Context's Tiered Workflow Addendum.

Specifically:

1. Confirm whether the full attached context was available and reviewed.
2. List the 8–12 governing requirements most relevant to future biotech research and identify the exact context-file section for each.
3. Provide a requirement-to-deliverable map.
4. State the source hierarchy, direct-link citation standard, and Fact/Inference/Speculation standard you will use.
5. Identify universally applicable requirements, conditionally applicable requirements, access limitations, and ambiguities.
6. Confirm that no substantive research or investment conclusion has yet been reached.

Wait for my per-ticker request after completing this report.
```

**Purpose:** Make the model treat the Agent Context as governing instruction, not background reading.

**Required output:** Context Compliance Report only.

## 0.2 Review Compliance Report

Confirm that the model identifies:

- [ ] Direct inline links for material factual claims
- [ ] Fact / Inference / Speculation distinction
- [ ] Primary-source hierarchy
- [ ] "Not verified from available sources" requirement
- [ ] Source limitations and uncertainty standards
- [ ] Mandatory red-team review
- [ ] No forced definitive investment conclusion
- [ ] Relevant `BiotechAgent.md` sections
- [ ] Tool, source, document, or length limitations

**If acceptable:**

```other
Context Compliance Report approved. I will now provide the per-ticker assignment.
```

**Purpose:** Confirm the model processed the governing standards before research begins.

---

# Phase 1 — Research Mandate

## 1.1 Attach Assignment Materials

- [ ] Attach or paste completed Per-Ticker Research Request
- [ ] Attach relevant company documents, posters, papers, filings, transcripts, notes, or links
- [ ] State research data cutoff
- [ ] State project type: screen, deep diligence, catalyst review, clinical-data analysis, article research package, etc.

**If this round of research is specifically to populate or refresh a RxNPV case** (rather than a full diligence memo), use `RxNPV_Interaction_Request.md` (Mode A) in place of the standard Per-Ticker Research Request, and also attach `RxNPV_Field_Reference.md` alongside `BiotechAgent.md` in Phase 0.1.

**Purpose:** Define the assignment, decision question, boundaries, and desired output.

## 1.2 Request Assignment Intake Plan

- [ ] Send the prompt below
- [ ] Require the model to stop after its plan unless immediate research is explicitly authorized

```other
Using the attached Per-Ticker Research Request, provide an assignment intake plan only. Do not begin substantive research yet.

Provide:

1. A restatement of the company, asset(s), indication(s), scope, and data cutoff, confirming you have understood the assignment correctly.
2. The single decisive scientific and investment question this research must resolve.
3. Which diligence modules from the Agent Context apply to this assignment, and which do not, with a brief reason for each exclusion.
4. A primary-source acquisition plan — which source categories and specific source types you intend to search first.
5. The five highest-value unknowns that most affect the investment case.
6. Preliminary bull and bear hypotheses only — not conclusions, and not yet supported by citations.
7. Any missing documents, data, access, or source limitations that would affect the plan.

Stop after this plan. Do not proceed to full research unless I explicitly approve it.
```

**Required output:**

- [ ] Restatement of company, asset, indication, scope, and data cutoff
- [ ] Decisive scientific and investment question
- [ ] Applicable diligence modules
- [ ] Modules not applicable and why
- [ ] Primary-source acquisition plan
- [ ] Five highest-value unknowns
- [ ] Preliminary bull and bear hypotheses only
- [ ] Missing documents, data, access, or source limitations

## 1.3 Approve or Correct Plan

- [ ] Confirm question, assets, competitors, scope, and data cutoff
- [ ] Add must-use sources or remove irrelevant modules
- [ ] Correct unsupported assumptions
- [ ] Approve plan

**If acceptable:**

```other
Research plan approved. Proceed with the full research report using the approved plan.

Apply every relevant requirement in the Agent Context and Tiered Workflow Addendum. Do not silently omit applicable domains. Provide direct inline source links for every material factual claim, clearly label material conclusions Fact, Inference, or Speculation, state source limitations, complete the mandatory red-team review, and end with the Instruction Compliance Check.
```

**Purpose:** Prevent wasted effort on an incorrectly scoped project.

---

# Phase 2 — Evidence Sourcing and Verification

## 2.1 Run the Protocol

- [ ] Attach `Biotech_Evidence_Verification_Protocol.md` (blanket — no per-ticker edits needed)
- [ ] Do not request article drafting or a final investment conclusion yet
- [ ] Do not request a full per-document deep-dive by default — that's a one-off ask for a specific source later, not the standard here

**Purpose:** One document handles the whole evidence lifecycle — cast a wide net, keep only what's load-bearing, test every claim in the current research output against what was found, and maintain one continuous log connecting sources to the claims they support, structured for clean APA citations.

## 2.2 Keep It Current

- [ ] Update the running log as sources are added or superseded, for as long as this ticker is being covered
- [ ] Run a verification pass whenever a batch of claims needs checking — this can happen mid-research, not just once at the end
- [ ] Request the full extraction treatment (exact quotes, denominators, bias-risk breakdown) only for a specific source that turns out to be genuinely thesis-deciding

**Purpose:** One living record and one repeatable verification pass, instead of a growing pile of separate per-document write-ups and a separately-maintained ledger.

---

# Phase 3 — Living Ticker Dossier

## 3.1 Create or Update Dossier

- [ ] Use Biotech Ticker Dossier Template
- [ ] Complete Phase 0 Triage and Phase 1 Foundation first
- [ ] Keep top-of-document summary concise and current

**Required top-level information:**

- [ ] One-minute thesis
- [ ] Evidence status
- [ ] Valuation status
- [ ] Dominant risk
- [ ] Key open question
- [ ] Thesis invalidation trigger
- [ ] Next decisive catalyst
- [ ] Latest data cutoff

**Purpose:** Maintain one date-stamped source of truth for each company.

## 3.2 Promotion Decision

Advance to full diligence only if the company has:

- [ ] Scientifically credible premise
- [ ] Interpretable or potentially decision-grade evidence
- [ ] Genuine upcoming catalyst
- [ ] Plausible financing path to that catalyst
- [ ] Material uncertainty that can be resolved
- [ ] Potential mismatch between evidence and market expectations

**Decision:**

- [ ] Reject
- [ ] Monitor
- [ ] Continue targeted research
- [ ] Advance to full diligence
- [ ] Prepare for catalyst

**Purpose:** Allocate deep work to the highest-value ideas.

---

# Phase 4 — Full Diligence

## 4.1 Scientific and Clinical

- [ ] Mechanism and translational plausibility
- [ ] Preclinical-model relevance
- [ ] Clinical-trial design and statistics
- [ ] Dose-response analysis
- [ ] Safety review
- [ ] Biomarker and surrogate validity
- [ ] Natural-history and external-control audit
- [ ] Trial operations and enrollment realism

## 4.2 Regulatory, CMC, and Legal

- [ ] Regulatory path and precedent
- [ ] Accelerated-approval viability, if relevant
- [ ] CMC and comparability risk
- [ ] Long-term follow-up requirements, if relevant
- [ ] IP, patent, licensing, and royalty analysis
- [ ] Material agreement and deal-term review

## 4.3 Equity and Commercial

- [ ] Competitive landscape
- [ ] Standard-of-care evolution
- [ ] Market access and payer evidence requirements
- [ ] Treatment-center and diagnostic capacity
- [ ] Cash runway and financing need
- [ ] Fully diluted capitalization
- [ ] Dilution scenarios
- [ ] Management, governance, and disclosure quality
- [ ] Sanity-check key valuation assumptions against evidence

**If a RxNPV case already exists for this company,** use `RxNPV_Interaction_Request.md` (Mode B) to bring its current assumptions and output into this review rather than re-describing them from scratch.

**Purpose:** Determine whether scientific potential can realistically become equity value.

---

# Phase 5 — Pre-Catalyst Preparation

Complete before material data, FDA events, financing, competitor readouts, or conference presentations.

## 5.1 Lock Pre-Event Expectations

- [ ] Event and expected timing
- [ ] Company guidance
- [ ] Existing evidence
- [ ] Likely market expectations
- [ ] Bull outcome
- [ ] Base outcome
- [ ] Mixed outcome
- [ ] Bear outcome
- [ ] Required efficacy signal
- [ ] Required safety signal
- [ ] Required dose-response signal
- [ ] Required durability signal
- [ ] Material omitted-data risk
- [ ] Expected financing/dilution implications
- [ ] Expected thesis impact by scenario

**Purpose:** Prevent hindsight bias. Do not modify this section after the event.

---

# Phase 6 — Event Teardown

## 6.1 Gather New Materials

- [ ] Press release
- [ ] Slide deck
- [ ] Conference poster/oral presentation
- [ ] Call transcript
- [ ] SEC filing
- [ ] Registry update
- [ ] Regulatory document
- [ ] Relevant competitor disclosure

## 6.2 Compare With Locked Expectations

- [ ] What was disclosed
- [ ] What was omitted
- [ ] Comparison with each pre-event expectation
- [ ] Exact efficacy, safety, dose, durability, and endpoint findings
- [ ] Fact / Inference / Speculation designation
- [ ] Strongest bull interpretation
- [ ] Strongest bear interpretation
- [ ] Updated confidence by diligence category
- [ ] Updated timing, financing, competition, and dilution implications
- [ ] Next decisive unresolved question

**Update:**

- [ ] Monitoring log
- [ ] Evidence verification log
- [ ] Assumption registry
- [ ] Catalyst calendar
- [ ] Kill file
- [ ] Thesis status: strengthened / unchanged / weakened / invalidated

**Purpose:** Update the thesis transparently instead of rewriting history.

---

# Phase 7 — Article Research Package

## 7.1 Assemble Materials

- [ ] Current ticker dossier
- [ ] Evidence verification log (sources, claims, and citations)
- [ ] Key charts, tables, and figures
- [ ] Your valuation output
- [ ] Intended article thesis and audience

## 7.2 Build Article Architecture

- [ ] Use Biotech Article Development and Pre-Publication Audit — Stage 1
- [ ] Ask for outline only, not a full draft

**Required output:**

- [ ] Proposed article sections
- [ ] Central claim for each section
- [ ] Supporting claim IDs
- [ ] Essential sources
- [ ] Required caveats
- [ ] Claims to remove because evidence is insufficient
- [ ] Most challengeable statements
- [ ] Missing evidence to obtain before writing

**Purpose:** Produce a sourced writing blueprint while preserving your voice and judgment.

---

# Phase 8 — Your Writing

- [ ] Write the article yourself
- [ ] Use the evidence verification log as source of truth
- [ ] Add citations while drafting, not afterward
- [ ] Separate fact from interpretation
- [ ] Include limitations beside favorable evidence
- [ ] Do not write beyond available evidence
- [ ] Preserve uncertainty where it remains

**Purpose:** Retain authorship, thesis expression, judgment, and credibility.

---

# Phase 9 — Pre-Publication Audit

## 9.1 Run Audit

- [ ] Attach article draft
- [ ] Attach evidence verification log
- [ ] Attach key sources if necessary
- [ ] Use Biotech Article Development and Pre-Publication Audit — Stage 3

## 9.2 Required Review

- [ ] Every material claim has an adequate citation
- [ ] Citations directly support the claim made
- [ ] Scientific language is calibrated
- [ ] Trial data, endpoints, denominators, and statistics are correct
- [ ] Regulatory terminology is correct
- [ ] Company claims are qualified appropriately
- [ ] Counterarguments and conflicting evidence are fairly presented
- [ ] Mechanism, biomarker movement, and clinical benefit are not conflated
- [ ] Commercial or valuation claims do not exceed available evidence
- [ ] Links work and sources are high quality

**Publication status:**

- [ ] Ready to publish
- [ ] Ready after minor revisions
- [ ] Requires substantial revision
- [ ] Do not publish yet

**Purpose:** Protect scientific accuracy, credibility, and publication quality.

---

# Ongoing Maintenance

## After Every Material Event

- [ ] Update ticker dossier
- [ ] Update catalyst calendar
- [ ] Update evidence verification log
- [ ] Update assumption registry
- [ ] Update kill file
- [ ] Update confidence and thesis status
- [ ] Record what changed and why
- [ ] Preserve prior views rather than overwrite them

## Periodic Review

- [ ] Recheck trial status and completion dates
- [ ] Recheck competitor pipeline and data events
- [ ] Recheck cash runway and securities issuance
- [ ] Recheck regulatory precedent
- [ ] Recheck highest-impact valuation assumptions
- [ ] Reassess whether the company still deserves research attention

**Purpose:** Keep work current, falsifiable, and useful rather than allowing a thesis to become stale.
