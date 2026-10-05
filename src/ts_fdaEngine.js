// ════════════════════════════════════════════════════════════════════════════
// TrialSim — FDA ENGINE
// Free, public openFDA API (api.fda.gov), no key required for reasonable
// usage volumes. Confirmed CORS-friendly for direct client-side fetch during
// RxNPV's own FDA integration work, so no IPC bridge needed here either.
// ════════════════════════════════════════════════════════════════════════════

const FDA_API_ROOT = 'https://api.fda.gov';

// Named distinctly from fdaEngine.js's own fdaFetch(url) — both files load
// into the same global scope with no module system, and a same-named
// function declaration here would silently overwrite that one (or vice
// versa, depending on concatenation order), breaking whichever caller
// expected its own signature. This one takes a path+params pair; the other
// takes a full URL — genuinely different shapes, not safe to merge blindly.
// openFDA's query language uses "+" between clauses as a separator and needs
// explicit AND/OR operators. URLSearchParams percent-encodes "+" to %2B, which
// openFDA then reads as a LITERAL plus character inside the search string
// rather than a separator — so a compound query silently matched nothing and
// every drug-label lookup returned "not found". Building the search parameter
// by hand with encodeURIComponent on the VALUES only, leaving the operators
// intact, is what openFDA's own documented examples do.
function tsFdaQueryString(params) {
  return Object.entries(params).map(([k, v]) => {
    if (k === 'search') {
      // Encode each quoted term, leave " OR "/" AND " separators readable.
      return 'search=' + String(v).split(/(\s+(?:OR|AND)\s+)/).map(part =>
        /^\s+(?:OR|AND)\s+$/.test(part) ? part.trim().replace(/\s+/g, '+') : encodeURIComponent(part)
      ).join('+');
    }
    return encodeURIComponent(k) + '=' + encodeURIComponent(v);
  }).join('&');
}

// A hung request used to leave the UI on "Searching…" indefinitely, because
// unlike its sibling fdaFetch this had no timeout at all.
const TS_FDA_TIMEOUT_MS = 15000;

async function tsFdaFetch(path, params) {
  if (typeof fetch === 'undefined') throw new Error('No fetch available in this environment');
  const qs = tsFdaQueryString(params);
  const res = await resilientFetch(`${FDA_API_ROOT}${path}?${qs}`, { timeoutMs: TS_FDA_TIMEOUT_MS, label: 'openFDA' });
  if (!res.ok) {
    if (res.status === 404) return { results: [], meta: { results: { total: 0 } } }; // openFDA 404s on zero matches
    throw new Error(`openFDA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Drugs@FDA: approval history for a given brand/generic/application ──────
async function fetchApprovalHistory(drugName) {
  const data = await tsFdaFetch('/drug/drugsfda.json', {
    search: `products.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
    limit: 10
  });
  return parseApprovalResponse(data, drugName);
}

// Pure function, no network — separated so it can be unit-tested against a
// mocked openFDA response without a live API call.
function parseApprovalResponse(data, drugName) {
  const results = (data.results || []).map(r => ({
    applicationNumber: r.application_number,
    sponsorName: r.sponsor_name,
    products: (r.products || []).map(p => ({
      brandName: p.brand_name,
      dosageForm: p.dosage_form,
      route: p.route,
      marketingStatus: p.marketing_status
    })),
    submissions: (r.submissions || []).map(s => ({
      submissionType: s.submission_type,
      submissionStatus: s.submission_status,
      submissionStatusDate: s.submission_status_date,
      reviewPriority: s.review_priority
    }))
  }));
  return { query: drugName, matches: results.length, results };
}

// "Limitations of Use" is a subsection inside the label's indications text,
// not a field of its own: the sentence(s) after the heading, up to the next
// numbered section or the end. Quoted as written; null when the label has
// none. (October 2026; deliberately no accelerated-approval flag — that is a
// regulatory-history fact, not a label fact.)
function extractLimitationsOfUse(indicationsText) {
  if (!indicationsText) return null;
  // A section break is a number then a heading in capitals ("2 DOSAGE AND
  // ADMINISTRATION"), so "18 years" in the text never ends the quote; and
  // openFDA's field often repeats the label's highlights right after the
  // limitations, starting "WEGOVY is a …" — that ends it too.
  const m = String(indicationsText).match(/[Ll]imitations?\s+[Oo]f\s+[Uu]se\s*[:.\-–]?\s*([\s\S]*?)(?=\s+\d{1,2}(?:\.\d+)?\s+[A-Z]{2,}|\s+[A-Z][A-Z0-9\u00ae-]{2,}\s+is\s+(?:a|an|indicated)\b|\s*$)/);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, " ").trim();
  return t ? (t.length > 700 ? t.slice(0, 700).replace(/\s\S*$/, "") + " …" : t) : null;
}
function labelDate(effectiveTime) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(effectiveTime || ""));
  return m ? m[1] + "-" + m[2] + "-" + m[3] : null;
}

// ── Drug label: indications, boxed warnings, adverse reactions from the ────
// approved label text (useful context when sourcing a mechanism/indication)
async function fetchDrugLabel(drugName) {
  const data = await tsFdaFetch('/drug/label.json', {
    search: `openfda.brand_name:"${drugName}" OR openfda.generic_name:"${drugName}"`,
    limit: 1
  });
  const r = (data.results || [])[0];
  if (!r) return { query: drugName, found: false };
  return {
    query: drugName,
    found: true,
    indicationsAndUsage: firstOrNull(r.indications_and_usage),
    limitationsOfUse: extractLimitationsOfUse(firstOrNull(r.indications_and_usage)),
    labelDate: labelDate(r.effective_time),
    boxedWarning: firstOrNull(r.boxed_warning),
    adverseReactionsSummary: firstOrNull(r.adverse_reactions),
    // openFDA names this section warnings_and_cautions on current-format
    // labels and warnings on older ones; "warnings_and_precautions" is not a
    // field it has, which left the section blank on every label (seen looking
    // up Vyondys 53, whose kidney-toxicity warning never showed).
    warningsAndPrecautions: firstOrNull(r.warnings_and_cautions) || firstOrNull(r.warnings)
  };
}

// ── Adverse event counts by reaction, for a rough post-market safety signal ─
async function fetchAdverseEventSummary(drugName, opts = {}) {
  const data = await tsFdaFetch('/drug/event.json', {
    search: `patient.drug.medicinalproduct:"${drugName}"`,
    count: 'patient.reaction.reactionmeddrapt.exact'
  });
  const top = (data.results || []).slice(0, opts.limit || 10).map(r => ({
    reaction: r.term,
    reportCount: r.count
  }));
  return {
    query: drugName,
    topReportedReactions: top,
    caveat: 'FAERS is a spontaneous/voluntary reporting system — counts reflect reporting volume, not confirmed incidence or causality.'
  };
}

function firstOrNull(arr) {
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchApprovalHistory, fetchDrugLabel, fetchAdverseEventSummary, parseApprovalResponse, FDA_API_ROOT, extractLimitationsOfUse, labelDate };
}
