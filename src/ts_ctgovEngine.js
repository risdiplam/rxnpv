// ════════════════════════════════════════════════════════════════════════════
// TrialSim — CLINICALTRIALS.GOV ENGINE
// Free, public v2 REST API (no key required). Direct browser/Electron fetch
// works — CT.gov sends permissive CORS headers, same as RxNPV's own
// ctgovEngine.js relies on, so no IPC bridge is needed for this one.
// Base URL: https://clinicaltrials.gov/api/v2/studies
// ════════════════════════════════════════════════════════════════════════════

const TS_CTGOV_BASE = 'https://clinicaltrials.gov/api/v2/studies';

const FETCH_FN = (typeof fetch !== 'undefined') ? fetch : null; // browser/Electron global

async function ctgovFetch(params) {
  if (!FETCH_FN) throw new Error('No fetch available in this environment (node needs a polyfill for live calls)');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${TS_CTGOV_BASE}?${qs}`);
  if (!res.ok) throw new Error(`ClinicalTrials.gov API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Historical comps: trials matching condition + phase, for design context ─
// Returns raw study summaries plus a status-landscape rollup. This is a
// design/status comp set, not a "success rate" — CT.gov doesn't expose a
// clean win/loss flag, so we surface what's honestly there (status
// distribution, duration, enrollment) rather than manufacture a success
// metric from it.
// v2 has no `filter.phase` parameter (confirmed live — the API rejects it
// with a 400, "unknown parameter"); phase filtering goes through the
// aggFilters facet instead, keyed by the numeral CT.gov uses internally
// (0=Early Phase 1, 1=Phase 1, 2=Phase 2, 3=Phase 3, 4=Phase 4).
const TS_PHASE_TO_AGGFILTER = { PHASE1: '1', PHASE2: '2', PHASE3: '3', PHASE4: '4' };

async function fetchHistoricalComps(condition, phase, opts = {}) {
  const params = {
    'query.cond': condition,
    'aggFilters': 'phase:' + (TS_PHASE_TO_AGGFILTER[phase] || phase),
    'fields': 'NCTId,BriefTitle,OverallStatus,Phase,StartDate,CompletionDate,EnrollmentCount,LeadSponsorName,InterventionName,PrimaryOutcomeMeasure',
    'pageSize': String(opts.pageSize || 100),
    'format': 'json'
  };
  if (opts.intervention) params['query.intr'] = opts.intervention;

  const data = await ctgovFetch(params);
  return summarizeStudiesResponse(data, { condition, phase, intervention: opts.intervention || null });
}

function parseHistoricalStudy(s) {
  const proto = s.protocolSection || {};
  const id = proto.identificationModule || {};
  const status = proto.statusModule || {};
  const design = proto.designModule || {};
  const sponsor = proto.sponsorCollaboratorsModule || {};
  return {
    nctId: id.nctId,
    title: id.briefTitle,
    status: status.overallStatus,
    phase: (design.phases || []).join('/'),
    startDate: status.startDateStruct ? status.startDateStruct.date : null,
    completionDate: status.completionDateStruct ? status.completionDateStruct.date : null,
    enrollment: design.enrollmentInfo ? design.enrollmentInfo.count : null,
    sponsor: sponsor.leadSponsor ? sponsor.leadSponsor.name : null,
    hasResults: !!s.hasResults
  };
}

// Pure function, no network — takes a raw v2-shaped API response object and
// produces the same rollup fetchHistoricalComps returns. Kept separate so it
// can be unit-tested against a mocked response without a live API call.
function summarizeStudiesResponse(data, queryMeta) {
  const studies = (data.studies || []).map(parseHistoricalStudy);

  const statusCounts = {};
  for (const s of studies) statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  const total = studies.length;
  const statusLandscape = Object.entries(statusCounts).map(([status, count]) => ({
    status, count, share: total ? count / total : 0
  })).sort((a, b) => b.count - a.count);

  const withDurations = studies.filter(s => s.startDate && s.completionDate);
  const durationsMonths = withDurations.map(s => monthsBetween(s.startDate, s.completionDate)).filter(d => d != null && d > 0);
  const medianDurationMonths = durationsMonths.length ? median(durationsMonths) : null;

  const enrollments = studies.map(s => s.enrollment).filter(n => typeof n === 'number' && n > 0);
  const medianEnrollment = enrollments.length ? median(enrollments) : null;

  return {
    query: queryMeta,
    totalMatched: data.totalCount || total,
    sampleSize: total,
    studies,
    statusLandscape,
    medianDurationMonths,
    medianEnrollment,
    caveat: 'Status distribution and timing only — ClinicalTrials.gov does not expose a clean trial-success flag, so this is design/status context, not a win rate.'
  };
}

// ── Single-trial lookup, for pulling a specific comparator's design details ─
async function fetchTrialByNctId(nctId) {
  if (!FETCH_FN) throw new Error('No fetch available in this environment');
  const res = await fetch(`${TS_CTGOV_BASE}/${encodeURIComponent(nctId)}?format=json`);
  if (!res.ok) throw new Error(`ClinicalTrials.gov API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────────────────
function monthsBetween(startStr, endStr) {
  const start = parsePartialDate(startStr);
  const end = parsePartialDate(endStr);
  if (!start || !end) return null;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function parsePartialDate(str) {
  // CT.gov dates are sometimes "YYYY-MM" without a day.
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length === 1) return new Date(parseInt(parts[0]), 0, 1);
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
}

function median(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchHistoricalComps, fetchTrialByNctId, parseHistoricalStudy, summarizeStudiesResponse, monthsBetween, median, TS_CTGOV_BASE };
}
