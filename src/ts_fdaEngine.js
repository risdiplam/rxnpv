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

async function tsFdaFetch(path, params) {
  if (typeof fetch === 'undefined') throw new Error('No fetch available in this environment');
  const qs = tsFdaQueryString(params);
  const res = await fetch(`${FDA_API_ROOT}${path}?${qs}`);
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
    boxedWarning: firstOrNull(r.boxed_warning),
    adverseReactionsSummary: firstOrNull(r.adverse_reactions),
    warningsAndPrecautions: firstOrNull(r.warnings_and_precautions)
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
  module.exports = { fetchApprovalHistory, fetchDrugLabel, fetchAdverseEventSummary, parseApprovalResponse, FDA_API_ROOT };
}
