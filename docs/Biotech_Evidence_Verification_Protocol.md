# Biotech Evidence Verification Protocol

Governing instruction for how sources get found, how claims get checked against them, and how the running record is kept — for whatever ticker, question, or research report is currently active in this conversation. This file is not filled in per assignment; it applies as-is, the same way BiotechAgent does. Company, ticker, and question come from whatever Per-Ticker Request or RxNPV Interaction Request is already attached — this file doesn't restate them.

Use alongside BiotechAgent, which remains the governing source on citation standards, the Fact/Inference/Speculation distinction, and source quality. This file does not restate those rules — it operationalizes them into a sweep, a verification pass, and a running log.

---

## 1. Source Sweep

Search broadly before narrowing. Cover disease biology and natural history, target/mechanism, modality and delivery, preclinical evidence, human clinical evidence, regulatory path and precedent, CMC and manufacturing, competition and standard of care, and corporate/financial/legal/governance — BiotechAgent's full diligence framework applies; this is the search phase for it, not a separate standard.

Rank what's found using BiotechAgent's own six-tier source hierarchy — regulatory primary sources at the top, specialist journalism and secondary literature at the bottom. Do not restate that hierarchy here; apply it directly.

From everything found, keep only sources that are genuinely load-bearing for a material claim. Discard duplicates, tangential hits, and low-quality sources without extended discussion.

## 2. Claim Verification

For every material claim currently in the research output — a report in progress, a dossier update, an article draft, anything with factual assertions in it — test it against the sources in the running log below:

- Confirm the cited source actually says what the claim says it says. A citation that's merely adjacent to a claim, rather than directly supporting it, does not pass.
- Confirm the Fact / Inference / Speculation label is still correct once checked against the source, not just as originally written.
- Flag any claim that doesn't hold up, has no source in the log, relies on a weaker source than is actually available, or is stated more strongly than its source supports.
- Flag contradictions between sources rather than silently picking one.

This is an explicitly invokable pass, not something that only happens once at the end — run it whenever a batch of claims needs checking, including mid-research, not just before publication.

## 3. Running Source-to-Claim Log

Maintain one continuous log for as long as this ticker is being covered. Add an entry the moment a source earns a place in it; update entries as verification happens or new sources supersede old ones.

One entry per source:

**Source:** [Author/organization, year, title, publisher or journal — full APA-ready citation elements, not just a link]

- **Direct link:** [URL]
- **Source type:** [Regulatory / peer-reviewed / SEC filing / registry / conference material / other — per BiotechAgent's hierarchy]
- **Claims it supports:**
  - [Claim] — [Fact / Inference / Speculation] — [Verified / Not yet verified / Does not hold up]
  - [Additional claim, if this source supports more than one] — [Fact / Inference / Speculation] — [Verified / Not yet verified / Does not hold up]
- **Limitation, if material:** [One line — only if genuinely relevant]

### APA Quick Reference for Common Source Types

Use these shapes to keep the Source field above genuinely citation-ready, not just a bare link:

- **SEC filing:** Company Name. (Year, Month Day). *Filing type* [Form type]. U.S. Securities and Exchange Commission. URL
- **FDA document:** U.S. Food and Drug Administration. (Year). *Document title*. URL
- **ClinicalTrials.gov record:** Sponsor Name. (Year). *Trial title* (Identifier No. NCTXXXXXXXX). ClinicalTrials.gov. URL
- **Peer-reviewed journal article:** Author, A. A., & Author, B. B. (Year). Title of article. *Journal Name*, *Volume*(Issue), pages. DOI or URL
- **Conference abstract or poster:** Author, A. A. (Year, Month). *Title of presentation* [Conference presentation]. Conference Name, Location. URL
- **Company press release or disclosure:** Company Name. (Year, Month Day). *Title of release*. URL

If a source type doesn't fit cleanly into one of these shapes, use the closest analog and note the deviation rather than guessing at a nonstandard format.
