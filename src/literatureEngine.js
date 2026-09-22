// ════════════════════════════════════════════════════════════════════════════
// RxNPV — LITERATURE SHELF (Europe PMC)
//
// Previously declined as "duplicating Google Scholar", and that was the wrong
// read for one specific reason: a general search engine cannot tell you what
// KIND of paper it just handed you. Europe PMC returns MEDLINE's own
// publication types on every record, so a primary randomised trial report, a
// meta-analysis, a narrative review and a preprint arrive already
// distinguished — and the difference between "three RCTs" and "three reviews
// of the same RCT" is most of what a reader is trying to establish.
//
// ON THE NAME, because it misleads: "Europe PMC" is not a European literature
// database. Its `MED` source is MEDLINE/PubMed in full — the same index
// PubMed searches — plus PMC full text, plus preprints from bioRxiv, medRxiv
// and Research Square, plus patents and clinical guidelines. Verified live: a
// broad query returns 96 of 100 records from MED, NEJM and JAMA articles are
// there, and preprints come back under SRC:PPR. So this is a superset of
// PubMed with typing and citation counts attached, not a regional slice of it,
// and adding a second general literature API alongside it would return the
// same MEDLINE records twice.
//
// What it deliberately does NOT do: score a paper, rank quality, or summarise
// findings. Citation counts are reported because they are the only cheap way
// to surface a trial's own primary report out of the hundreds of papers that
// merely cite it — and they are labelled as an age-biased popularity measure,
// which is what they are.
//
// Free public REST API, no key, no auth. CORS-enabled, so it is fetched
// directly rather than through the Electron bridge.
// ════════════════════════════════════════════════════════════════════════════

const EUROPEPMC_API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const EPMC_TIMEOUT_MS = 15000;

async function europePmcFetch(params) {
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const qs = new URLSearchParams(params).toString();
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), EPMC_TIMEOUT_MS) : null;
  let res;
  try {
    res = await fetch(EUROPEPMC_API + "?" + qs, ctl ? { signal: ctl.signal } : undefined);
  } catch (e) {
    if (timer) clearTimeout(timer);
    // Same rule as every other integration here: a reachability failure must
    // never be presentable as "no papers found".
    throw new Error(e && e.name === "AbortError"
      ? "Europe PMC did not respond within 15 seconds"
      : "Could not reach Europe PMC: " + ((e && e.message) || "network error"));
  }
  if (timer) clearTimeout(timer);
  if (!res.ok) throw new Error("Europe PMC API error: " + res.status + " " + res.statusText);
  return res.json();
}

// Titles and abstracts come back with markup in them ("&lt;i&gt;KRAS&lt;/i&gt;",
// "<h4>Background</h4>"). Nothing in this app renders raw HTML, so the tags are
// stripped and the handful of entities MEDLINE actually emits are decoded here
// rather than leaking into the UI as literal angle brackets.
const EPMC_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&nbsp;": " " };
function epmcClean(text) {
  let t = String(text == null ? "" : text);
  // Decode first, then strip: MEDLINE escapes its markup, so "&lt;i&gt;" has to
  // become "<i>" before a tag strip can remove it.
  t = t.replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, m => EPMC_ENTITIES[m] || m);
  t = t.replace(/<[^>]*>/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

// ── What kind of paper is this ─────────────────────────────────────────────
// MEDLINE publication types, mapped to the distinction that actually matters
// to someone building a view: is this new evidence, a synthesis of other
// people's evidence, or an opinion about it. Checked in order, because a
// single record routinely carries several types at once — the KEYNOTE-189
// report is tagged "Clinical Trial, Phase III", "Randomized Controlled Trial",
// "Multicenter Study" and "Journal Article" simultaneously.
const EPMC_KINDS = [
  { re: /randomized controlled trial|randomised controlled trial/i, kind: "rct", label: "Randomised trial report", evidence: "primary" },
  { re: /meta-analysis/i, kind: "meta", label: "Meta-analysis", evidence: "synthesis" },
  { re: /systematic review/i, kind: "systematic", label: "Systematic review", evidence: "synthesis" },
  { re: /clinical trial/i, kind: "trial", label: "Clinical trial report", evidence: "primary" },
  { re: /^review$|\breview\b/i, kind: "review", label: "Review", evidence: "secondary" },
  { re: /case reports?/i, kind: "case", label: "Case report", evidence: "anecdote" },
  { re: /editorial|comment|letter|news/i, kind: "comment", label: "Comment or editorial", evidence: "opinion" },
  { re: /practice guideline|guideline/i, kind: "guideline", label: "Guideline", evidence: "synthesis" },
  // A conference abstract is a few hundred words with no methods section and
  // no peer review worth the name. Plenty of biotech news cycles run entirely
  // on one, so it earns its own tier rather than passing as a paper.
  { re: /\babstract\b|congress|proceedings|meeting/i, kind: "abstract", label: "Conference abstract", evidence: "abstract" }
];

function classifyPublication(pubTypes, source) {
  // A preprint is a preprint whatever else it claims to be. Europe PMC files
  // them under source PPR, and that fact outranks any type label on the
  // record — an unreviewed manuscript describing an RCT is still unreviewed.
  if (String(source || "").toUpperCase() === "PPR") {
    return { kind: "preprint", label: "Preprint — not peer reviewed", evidence: "unreviewed" };
  }
  const joined = (pubTypes || []).join(" ; ");
  for (const k of EPMC_KINDS) if (k.re.test(joined)) return { kind: k.kind, label: k.label, evidence: k.evidence };
  return { kind: "article", label: "Journal article", evidence: "unclassified" };
}

function parseEpmcResult(r) {
  const journal = (r.journalInfo && r.journalInfo.journal && r.journalInfo.journal.title) || "";
  const pubTypes = (r.pubTypeList && r.pubTypeList.pubType) || [];
  const cls = classifyPublication(pubTypes, r.source);
  // The preprint server is in bookOrReportDetails rather than journalInfo.
  const venue = journal || (r.bookOrReportDetails && r.bookOrReportDetails.publisher) || (r.source === "PPR" ? "preprint server" : "");
  return {
    id: r.source + ":" + r.id,
    source: r.source,
    pmid: r.pmid || null,
    doi: r.doi || null,
    title: epmcClean(r.title),
    authors: epmcClean(r.authorString),
    venue: epmcClean(venue),
    year: r.pubYear ? String(r.pubYear) : "",
    firstPublished: r.firstPublicationDate || null,
    pubTypes,
    kind: cls.kind,
    kindLabel: cls.label,
    evidence: cls.evidence,
    // An age-biased popularity measure, and labelled as one wherever shown.
    citedBy: typeof r.citedByCount === "number" ? r.citedByCount : null,
    // Whether the full text is actually readable without a subscription, which
    // for a retail investor is the difference between a citation and a source.
    freeFullText: r.isOpenAccess === "Y" || r.inEPMC === "Y" || r.inPMC === "Y" || String(r.source).toUpperCase() === "PPR",
    abstract: epmcClean(r.abstractText).slice(0, 1200),
    url: r.doi ? "https://doi.org/" + r.doi
      : r.pmid ? "https://pubmed.ncbi.nlm.nih.gov/" + r.pmid + "/"
      : "https://europepmc.org/article/" + r.source + "/" + r.id
  };
}

// Sort keys Europe PMC accepts. "Most cited" is the default for a trial lookup
// because it is the only cheap way to lift a trial's own primary report above
// the hundreds of papers that merely cite it; "most recent" is the default for
// an open-ended topic search, where the newest work is the point.
const EPMC_SORTS = {
  cited: "CITED desc",
  recent: "P_PDATE_D desc",
  relevance: ""
};

async function searchLiterature(query, opts) {
  opts = opts || {};
  const q = String(query || "").trim();
  if (!q) return { ok: false, error: "Enter a drug, target, indication or NCT number." };
  const params = {
    query: opts.excludePreprints ? "(" + q + ") NOT SRC:PPR" : q,
    format: "json",
    resultType: "core",
    pageSize: String(Math.min(opts.pageSize || 25, 100))
  };
  const sort = EPMC_SORTS[opts.sort || "relevance"];
  if (sort) params.sort = sort;
  try {
    const data = await europePmcFetch(params);
    const rows = (((data || {}).resultList || {}).result || []).map(parseEpmcResult);
    return {
      ok: true,
      query: q,
      // The total across the whole index, not the page — so a shelf of 25
      // never reads as the entire literature.
      totalMatched: typeof data.hitCount === "number" ? data.hitCount : rows.length,
      rows,
      counts: summarizeLiterature(rows)
    };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

// The composition of what came back, which is the part worth reading before
// any individual title: twelve papers that are eleven reviews of one trial is
// a different evidence base from twelve trial reports, and a plain list of
// titles hides that completely.
function summarizeLiterature(rows) {
  const byEvidence = { primary: 0, synthesis: 0, secondary: 0, abstract: 0, anecdote: 0, opinion: 0, unreviewed: 0, unclassified: 0 };
  let freeFullText = 0;
  (rows || []).forEach(r => {
    if (byEvidence[r.evidence] != null) byEvidence[r.evidence]++;
    if (r.freeFullText) freeFullText++;
  });
  return { total: (rows || []).length, byEvidence, freeFullText };
}

// ── A trial's own papers ───────────────────────────────────────────────────
// Searching an NCT number finds every paper that MENTIONS it, which is mostly
// reviews. Sorting by citations reliably lifts the trial's own primary report
// to the top in practice — verified against KEYNOTE-189, whose NEJM report
// comes back first at 5,399 citations — but that is a heuristic, not a
// guarantee, and the caller is told so rather than being handed "the paper".
async function publicationsForTrial(nctId, opts) {
  const id = String(nctId || "").trim().toUpperCase();
  if (!/^NCT\d{8}$/.test(id)) return { ok: false, error: "That doesn't look like a valid NCT ID." };
  const r = await searchLiterature(id, Object.assign({ sort: "cited", pageSize: 25 }, opts || {}));
  if (!r.ok) return r;
  // A record that is itself a trial report AND names this NCT is the strongest
  // candidate for the trial's own publication. Flagged, never asserted.
  r.rows.forEach(row => {
    row.likelyPrimaryReport = (row.evidence === "primary");
  });
  r.likelyPrimary = r.rows.filter(row => row.likelyPrimaryReport).slice(0, 3);
  r.nctId = id;
  return r;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    searchLiterature, publicationsForTrial, classifyPublication, parseEpmcResult,
    summarizeLiterature, epmcClean, EPMC_SORTS
  };
}
