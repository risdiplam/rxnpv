// ════════════════════════════════════════════════════════════════════════════
// RxNPV — ClinicalTrials.gov integration
// CT.gov API v2 is CORS-enabled — works in-browser or desktop, no proxy needed.
// Two uses: (1) pull up trials for the program's own drug, (2) search the
// competitive landscape by indication, cross-referenced against EDGAR (when
// running as the desktop app) to flag whether each competitor sponsor is a
// publicly traded company or not.
// ════════════════════════════════════════════════════════════════════════════
const CTGOV_BASE = "https://clinicaltrials.gov/api/v2/studies";

async function ctgovFetch(params) {
  const qs = new URLSearchParams(params).toString();
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(CTGOV_BASE + "?" + qs, { signal: ctl.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw new Error("ClinicalTrials.gov fetch failed: " + e.message);
  }
}

function parseStudy(study) {
  const p = study.protocolSection || {};
  const id = p.identificationModule || {};
  const status = p.statusModule || {};
  const design = p.designModule || {};
  const sponsor = p.sponsorCollaboratorsModule || {};
  const cond = p.conditionsModule || {};
  const desc = p.descriptionModule || {};
  const arms = p.armsInterventionsModule || {};
  const outcomes = p.outcomesModule || {};
  return {
    nctId: id.nctId,
    title: id.briefTitle || id.officialTitle || "",
    sponsor: sponsor.leadSponsor ? sponsor.leadSponsor.name : "",
    sponsorClass: sponsor.leadSponsor ? sponsor.leadSponsor.class : "", // INDUSTRY, NIH, OTHER, etc.
    phase: (design.phases && design.phases.length) ? design.phases.join("/") : "N/A",
    status: status.overallStatus || "",
    conditions: cond.conditions || [],
    interventions: (arms.interventions || []).map(i => i.name).filter(Boolean),
    enrollment: design.enrollmentInfo ? design.enrollmentInfo.count : null,
    startDate: status.startDateStruct ? status.startDateStruct.date : null,
    primaryCompletionDate: status.primaryCompletionDateStruct ? status.primaryCompletionDateStruct.date : null,
    briefSummary: desc.briefSummary || "",
    // Primary endpoint text — used for the snapshot/diff watch below to catch
    // silent endpoint changes. Kept as plain measure strings (not the fuller
    // description/timeFrame detail) since that's what changing would actually
    // mean something to a reader comparing two snapshots.
    primaryOutcomes: (outcomes.primaryOutcomes || []).map(o => o.measure).filter(Boolean),
    // Whether CT.gov has posted actual outcome data for this trial — surfaced
    // as a flag + link only, deliberately NOT parsed/summarized here. The
    // resultsSection (participant flow, outcome measures, adverse events)
    // has genuinely complex, variable statistical structure; getting an
    // extraction or summary subtly wrong in a valuation tool is a real risk,
    // not a cosmetic one, so this points the user to read it themselves.
    hasResults: !!study.hasResults
  };
}

// ── Search trials for a specific drug/intervention name ──
async function searchTrialsForDrug(drugName, limit) {
  limit = limit || 10;
  if (!drugName || !drugName.trim()) return { ok: false, error: "Enter a drug name first." };
  try {
    const data = await ctgovFetch({
      "query.intr": drugName.trim(),
      "pageSize": String(limit),
      "fields": "NCTId,BriefTitle,OfficialTitle,OverallStatus,Phase,LeadSponsorName,LeadSponsorClass,Condition,InterventionName,EnrollmentCount,StartDate,PrimaryCompletionDate,BriefSummary"
    });
    const studies = (data.studies || []).map(parseStudy);
    return { ok: true, studies, totalCount: data.totalCount || studies.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Search a company's own pipeline: all trials where they're the lead sponsor.
// Used by the Reference Sheet's combined EDGAR + CT.gov company lookup. ──
async function searchTrialsBySponsor(companyName, limit) {
  limit = limit || 20;
  if (!companyName || !companyName.trim()) return { ok: false, error: "Enter a company name first." };
  try {
    const data = await ctgovFetch({
      "query.spons": companyName.trim(),
      "pageSize": String(limit),
      "fields": "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,LeadSponsorClass,Condition,InterventionName,EnrollmentCount,StartDate,PrimaryCompletionDate"
    });
    const studies = (data.studies || []).map(parseStudy);
    return { ok: true, studies, totalCount: data.totalCount || studies.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Search the competitive landscape by indication/condition, optionally
// excluding a drug name (your own program) so results are truly competitors. ──
async function searchCompetitorLandscape(condition, excludeDrugName, limit) {
  limit = limit || 15;
  if (!condition || !condition.trim()) return { ok: false, error: "Enter an indication/condition first." };
  try {
    const data = await ctgovFetch({
      "query.cond": condition.trim(),
      "pageSize": String(limit),
      "fields": "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,LeadSponsorClass,Condition,InterventionName,EnrollmentCount,StartDate"
    });
    let studies = (data.studies || []).map(parseStudy);
    if (excludeDrugName && excludeDrugName.trim()) {
      const excl = excludeDrugName.trim().toLowerCase();
      studies = studies.filter(s => !s.interventions.some(i => i.toLowerCase().includes(excl)) && !s.title.toLowerCase().includes(excl));
    }
    // Dedupe by sponsor+intervention (CT.gov often has multiple trial records per drug/sponsor pair)
    const seen = new Set();
    studies = studies.filter(s => {
      const key = (s.sponsor || "") + "::" + (s.interventions[0] || s.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ok: true, studies, totalCount: data.totalCount || studies.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Enrich competitor sponsors with public/private status via EDGAR CIK lookup.
// Desktop-only (needs the Electron EDGAR bridge); on a plain-browser open of this
// file it's skipped gracefully — callers should check window.electronAPI first. ──
async function enrichSponsorsWithPublicStatus(studies) {
  const uniqueSponsors = [...new Set(studies.map(s => s.sponsor).filter(Boolean))];
  const statusBySponsor = {};
  for (const sponsor of uniqueSponsors) {
    if (sponsor.length < 3) { statusBySponsor[sponsor] = { isPublic: null }; continue; }
    try {
      const cik = await findCIK(sponsor, false);
      statusBySponsor[sponsor] = cik ? { isPublic: true, ticker: cik.ticker, cik: cik.cik } : { isPublic: false };
    } catch (e) {
      statusBySponsor[sponsor] = { isPublic: null }; // lookup failed, not necessarily private
    }
  }
  return studies.map(s => ({ ...s, publicStatus: s.sponsor ? statusBySponsor[s.sponsor] : { isPublic: null } }));
}

// ── Trial snapshot & diff — direct single-study lookup by NCT ID, stored
// locally and compared against on each subsequent check. Pure local storage
// and diffing of data the app already fetches; no new API, no new
// dependency. Catches the tells live-only fetching can't, since there's
// nothing to compare against until a snapshot exists to compare to.
async function fetchStudyByNctId(nctId) {
  const id = String(nctId || "").trim().toUpperCase();
  if (!/^NCT\d{8}$/.test(id)) return { ok: false, error: "That doesn't look like a valid NCT ID (expected format: NCT followed by 8 digits)." };
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(CTGOV_BASE + "/" + id, { signal: ctl.signal });
    clearTimeout(timeout);
    if (res.status === 404) return { ok: false, error: "No study found for " + id + " on ClinicalTrials.gov." };
    if (!res.ok) throw new Error("HTTP " + res.status);
    const study = await res.json();
    return { ok: true, study: parseStudy(study) };
  } catch (e) {
    clearTimeout(timeout);
    return { ok: false, error: "ClinicalTrials.gov fetch failed: " + e.message };
  }
}

const CTGOV_SNAPSHOT_PREFIX = "pdcf_ctgov_snapshot_";

function loadTrialSnapshot(nctId) {
  try {
    const raw = localStorage.getItem(CTGOV_SNAPSHOT_PREFIX + nctId);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveTrialSnapshot(nctId, study) {
  try { localStorage.setItem(CTGOV_SNAPSHOT_PREFIX + nctId, JSON.stringify({ study, checkedAt: Date.now() })); }
  catch (e) { /* localStorage full or unavailable — snapshot just won't persist this time */ }
}

function listWatchedTrials() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(CTGOV_SNAPSHOT_PREFIX) === 0) {
        try {
          const snap = JSON.parse(localStorage.getItem(key));
          out.push({ nctId: key.slice(CTGOV_SNAPSHOT_PREFIX.length), study: snap.study, checkedAt: snap.checkedAt });
        } catch (e) {}
      }
    }
  } catch (e) {}
  return out.sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
}

function forgetTrialSnapshot(nctId) {
  try { localStorage.removeItem(CTGOV_SNAPSHOT_PREFIX + nctId); } catch (e) {}
}

// Compares two parsed studies field by field. Array fields (primaryOutcomes)
// diff as added/removed entries rather than a single before/after string,
// since a single new arm's endpoint added to a list isn't the same kind of
// change as the whole endpoint being replaced.
function diffTrialSnapshots(oldStudy, newStudy) {
  const changes = [];
  const scalarFields = [
    { key: "status", label: "Status" },
    { key: "phase", label: "Phase" },
    { key: "enrollment", label: "Enrollment" },
    { key: "primaryCompletionDate", label: "Primary completion date" }
  ];
  scalarFields.forEach(f => {
    const from = oldStudy[f.key], to = newStudy[f.key];
    if (from !== to && !(from == null && to == null)) changes.push({ field: f.key, label: f.label, from, to });
  });
  const oldOutcomes = oldStudy.primaryOutcomes || [], newOutcomes = newStudy.primaryOutcomes || [];
  const added = newOutcomes.filter(o => !oldOutcomes.includes(o));
  const removed = oldOutcomes.filter(o => !newOutcomes.includes(o));
  if (added.length || removed.length) changes.push({ field: "primaryOutcomes", label: "Primary endpoint(s)", added, removed });
  return changes;
}

// The main entry point: fetch current state, compare against whatever's
// stored, update the stored snapshot to the new current state either way
// (so the next check compares against this one, not the original baseline).
async function checkTrialForChanges(nctId) {
  const id = String(nctId || "").trim().toUpperCase();
  const result = await fetchStudyByNctId(id);
  if (!result.ok) return result;
  const prior = loadTrialSnapshot(id);
  saveTrialSnapshot(id, result.study);
  if (!prior) return { ok: true, isFirstSnapshot: true, study: result.study };
  const changes = diffTrialSnapshots(prior.study, result.study);
  return { ok: true, isFirstSnapshot: false, study: result.study, changes, previousCheckedAt: prior.checkedAt };
}
