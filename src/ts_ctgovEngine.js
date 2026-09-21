// ════════════════════════════════════════════════════════════════════════════
// TrialSim — CLINICALTRIALS.GOV ENGINE
// Free, public v2 REST API (no key required). Direct browser/Electron fetch
// works — CT.gov sends permissive CORS headers, same as RxNPV's own
// ctgovEngine.js relies on, so no IPC bridge is needed for this one.
// Base URL: https://clinicaltrials.gov/api/v2/studies
// ════════════════════════════════════════════════════════════════════════════

const TS_CTGOV_BASE = 'https://clinicaltrials.gov/api/v2/studies';

const FETCH_FN = (typeof fetch !== 'undefined') ? fetch : null; // browser/Electron global

// Named tsCtgovFetch, NOT ctgovFetch. Both CT.gov engines previously declared
// a top-level `async function ctgovFetch`, and because this file is
// concatenated after ctgovEngine.js the definition here silently replaced the
// Tools-side one for the whole bundle. The consequence was invisible but real:
// every Tools CT.gov call — Trial Explorer, competitor landscape, Catalyst
// Calendar — ran through this implementation, which had no timeout, while its
// own source clearly specified a 15-second abort. A hung request hung forever.
// Both now have distinct names and a timeout of their own.
const TS_CTGOV_TIMEOUT_MS = 15000;
async function tsCtgovFetch(params) {
  if (!FETCH_FN) throw new Error('No fetch available in this environment (node needs a polyfill for live calls)');
  const qs = new URLSearchParams(params).toString();
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), TS_CTGOV_TIMEOUT_MS) : null;
  let res;
  try {
    res = await fetch(`${TS_CTGOV_BASE}?${qs}`, ctl ? { signal: ctl.signal } : undefined);
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw new Error(e && e.name === 'AbortError'
      ? 'ClinicalTrials.gov did not respond within 15 seconds'
      : 'Could not reach ClinicalTrials.gov: ' + ((e && e.message) || 'network error'));
  }
  if (timer) clearTimeout(timer);
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

  const data = await tsCtgovFetch(params);
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
  module.exports = { fetchHistoricalComps, fetchTrialByNctId, parseHistoricalStudy, summarizeStudiesResponse, monthsBetween, median, TS_CTGOV_BASE, extractAnalogEffects, fetchAnalogEffects, tsClassifyEffectParam };
}

// ════════════════════════════════════════════════════════════════════════════
// ANALOG EFFECT-SIZE BOARD
// The historical-comps rollup above answers "how long did trials here take and
// how did they end up". It cannot answer the more useful question: how big
// were the effects that actually got posted. That is the reference class a
// modelled hazard ratio should be read against — a plan assuming HR 0.62 in an
// indication whose last five randomised trials landed between 0.78 and 0.91 is
// making a claim worth noticing.
//
// The honesty problem here is real and is why this is built the way it is.
// CT.gov results modules are free text with arbitrary units, and a naive
// scraper would produce confident-looking nonsense. So this extracts ONLY from
// the structured `analyses` block, where the sponsor registered a recognised
// parameter type (hazard ratio, odds ratio, risk difference and so on) with a
// numeric value — and it always reports its own denominator, so the user can
// see that effect sizes came from 7 of 18 trials rather than believing the
// board is the whole picture. Anything unparseable is counted, never guessed.
// ════════════════════════════════════════════════════════════════════════════

// CT.gov paramType values worth reading, grouped by the scale they live on.
// Ratios are compared on a log scale and have a null value of 1; differences
// are linear with a null of 0. Mixing them silently would be meaningless.
// CT.gov's `paramType` is FREE TEXT, not an enum. Real registered values
// include "Hazard Ratio (HR)" and "CMH ESTIMATE OF COMMON ODDS RATIO", so an
// exact-key lookup (which is what this started as) matches nothing at all and
// the board silently reports zero extractable effects for every indication.
// Pattern-matching is therefore unavoidable — but it is kept deliberately
// narrow: a phrase has to clearly name a known effect measure, and anything on
// a transformed scale is excluded outright, because a log hazard ratio has a
// null value of 0 rather than 1 and silently mixing the two would corrupt
// every summary on the board.
const TS_EFFECT_PATTERNS = [
  { re: /hazard\s*ratio/i,                              scale: "ratio",      label: "Hazard ratio",    nullValue: 1 },
  { re: /odds\s*ratio/i,                                scale: "ratio",      label: "Odds ratio",      nullValue: 1 },
  { re: /(risk\s*ratio|relative\s*risk|rate\s*ratio)/i, scale: "ratio",      label: "Risk ratio",      nullValue: 1 },
  { re: /risk\s*difference/i,                           scale: "difference", label: "Risk difference", nullValue: 0 },
  { re: /(mean\s*difference|difference\s+in\s+mean|least\s*squares?\s*mean\s*difference)/i,
                                                        scale: "difference", label: "Mean difference", nullValue: 0 }
];
// A transformed or per-unit scale changes what the null value even is, so
// these are skipped rather than guessed at.
const TS_EFFECT_EXCLUDE = /\blog\b|\bln\b|log-?transform|per\s+unit|slope/i;

function tsClassifyEffectParam(paramType) {
  const t = String(paramType || "");
  if (!t.trim() || TS_EFFECT_EXCLUDE.test(t)) return null;
  for (const p of TS_EFFECT_PATTERNS) if (p.re.test(t)) return p;
  return null;
}


// Pure function, no network — unit-tested against mocked response shapes.
function extractAnalogEffects(data, queryMeta) {
  const studies = (data && data.studies) || [];
  const rows = [];
  let withResults = 0, withExtractable = 0;

  studies.forEach(s => {
    const proto = s.protocolSection || {};
    const id = proto.identificationModule || {};
    const status = proto.statusModule || {};
    const design = proto.designModule || {};
    const results = s.resultsSection || {};
    const measures = (results.outcomeMeasuresModule || {}).outcomeMeasures || [];
    if (!measures.length) return;
    withResults++;

    // Primary outcomes only. A secondary endpoint's effect size is not a
    // comparable reference point for a primary endpoint assumption, and
    // mixing them would quietly inflate the sample.
    const primaries = measures.filter(m => (m.type || "").toUpperCase() === "PRIMARY");
    let found = null;
    for (const m of primaries) {
      for (const a of (m.analyses || [])) {
        const spec = tsClassifyEffectParam(a.paramType);
        const value = parseFloat(a.paramValue);
        if (!spec || !isFinite(value)) continue;
        const lower = parseFloat(a.ciLowerLimit), upper = parseFloat(a.ciUpperLimit);
        found = {
          nctId: id.nctId,
          title: id.briefTitle || "",
          status: status.overallStatus || "",
          enrollment: design.enrollmentInfo ? design.enrollmentInfo.count : null,
          completionDate: status.completionDateStruct ? status.completionDateStruct.date : null,
          outcomeTitle: m.title || "",
          paramType: a.paramType || "",
          scale: spec.scale,
          paramLabel: spec.label,
          nullValue: spec.nullValue,
          value,
          lower: isFinite(lower) ? lower : null,
          upper: isFinite(upper) ? upper : null,
          pValue: a.pValue != null ? String(a.pValue) : null,
          // "Favourable" is direction only, decided by which side of the null
          // the estimate sits on. It is NOT a judgement that the trial won —
          // a ratio below 1 can still be a miss if the interval crosses it.
          favoursTreatment: spec.scale === "ratio" ? value < spec.nullValue : value > spec.nullValue,
          crossesNull: (isFinite(lower) && isFinite(upper))
            ? (spec.nullValue >= Math.min(lower, upper) && spec.nullValue <= Math.max(lower, upper))
            : null
        };
        break;
      }
      if (found) break;
    }
    if (found) { rows.push(found); withExtractable++; }
  });

  // Group by scale — a hazard ratio and a mean difference cannot share an axis.
  const byScale = {};
  rows.forEach(r => { (byScale[r.scale] = byScale[r.scale] || []).push(r); });
  Object.keys(byScale).forEach(k => byScale[k].sort((a, b) => a.value - b.value));

  const summarize = (arr) => {
    if (!arr.length) return null;
    const vals = arr.map(r => r.value).sort((a, b) => a - b);
    const conclusive = arr.filter(r => r.crossesNull === false).length;
    return {
      n: vals.length,
      min: vals[0],
      max: vals[vals.length - 1],
      median: median(vals),
      // How many had an interval that actually excluded no-effect. This is the
      // closest honest proxy for "how many were clean wins" available from
      // registered data, and it is deliberately not called a success rate.
      intervalExcludesNull: conclusive,
      intervalReported: arr.filter(r => r.crossesNull !== null).length
    };
  };

  return {
    query: queryMeta,
    // The denominators, always. Without these the board reads as the whole
    // landscape when it is often a small and non-random slice of it.
    totalMatched: (data && data.totalCount) || studies.length,
    sampleSize: studies.length,
    withPostedResults: withResults,
    withExtractableEffect: withExtractable,
    rows,
    byScale,
    summaryByScale: Object.keys(byScale).reduce((acc, k) => { acc[k] = summarize(byScale[k]); return acc; }, {}),
    caveat: "Effect sizes are read only from CT.gov's structured analysis fields, where a sponsor registered a recognised parameter type with a numeric value. Trials that posted results in narrative form, used an unrecognised parameter, or reported nothing are counted in the denominators above but cannot appear on the board. This is a floor on what exists, not a census."
  };
}

async function fetchAnalogEffects(condition, phase, opts = {}) {
  const params = {
    'query.cond': condition,
    'aggFilters': 'phase:' + (TS_PHASE_TO_AGGFILTER[phase] || phase) + ',results:with',
    'pageSize': String(opts.pageSize || 50),
    'format': 'json'
  };
  if (opts.intervention) params['query.intr'] = opts.intervention;
  const data = await tsCtgovFetch(params);
  return extractAnalogEffects(data, { condition, phase, intervention: opts.intervention || null });
}
