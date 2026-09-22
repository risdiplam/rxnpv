// ════════════════════════════════════════════════════════════════════════════
// RxNPV — ASSET PROGRAM VIEW
//
// Every registered trial for one drug, in one place, with the shape of its
// evidence base stated up front.
//
// The app could already search trials, decode one, watch one for changes and
// read one's results — all of it one NCT number at a time. But nobody holds a
// thesis about a trial; they hold one about an asset, and an asset is usually
// eight to forty trials with different sponsors, phases, indications and fates.
// The three things that are invisible when you look at them one at a time are:
// how much of the programme is randomised rather than single-arm, whether it is
// one focused indication or a platform being tried everywhere, and which trials
// were quietly stopped.
//
// ── The evidence-base checklist, and why it is not a score ──
// This deliberately reports "6 of 19 randomised · 4 blinded · 2 with posted
// results · largest n=740" and never a single number. A composite
// "evidence strength: 62" would be exactly the false precision this project
// exists to avoid: the weights would be invented, and a reader would anchor on
// the number instead of the four facts that produced it. The checklist form is
// the point — it is a description of what exists, not a judgement of it.
//
// ── The matching problem, handled honestly ──
// CT.gov's `query.intr` is a loose text search: asking for pembrolizumab
// returns single-arm nivolumab studies that merely mention it. So every result
// is re-checked against its own registered intervention names (including
// `otherNames`, which is where brand names live), and anything that does not
// actually list the drug is dropped — and COUNTED, so the denominator is
// visible rather than the filter being silent.
// ════════════════════════════════════════════════════════════════════════════

// Ordered worst-to-best so "highest phase reached" is a simple max.
const ASSET_PHASE_ORDER = ["NA", "EARLY_PHASE1", "PHASE1", "PHASE1/PHASE2", "PHASE2", "PHASE2/PHASE3", "PHASE3", "PHASE4"];
const ASSET_PHASE_LABEL = {
  "NA": "Not applicable / not stated",
  "EARLY_PHASE1": "Early Phase 1",
  "PHASE1": "Phase 1",
  "PHASE1/PHASE2": "Phase 1/2",
  "PHASE2": "Phase 2",
  "PHASE2/PHASE3": "Phase 2/3",
  "PHASE3": "Phase 3",
  "PHASE4": "Phase 4"
};
// A trial that stopped is a fact about the programme, not noise to filter out.
const ASSET_STOPPED_STATUSES = ["TERMINATED", "WITHDRAWN", "SUSPENDED"];

function assetPhaseRank(phase) {
  const i = ASSET_PHASE_ORDER.indexOf(String(phase || "NA"));
  return i === -1 ? 0 : i;
}

// Does this study actually list the drug, or did the text search merely find
// the word somewhere in it? Checks intervention names and their registered
// other names (where brand names live), then the title as a last resort.
function studyNamesIntervention(study, drugName) {
  const needle = String(drugName || "").trim().toLowerCase();
  if (!needle) return true;
  const names = [];
  (study.interventionsDetailed || []).forEach(i => {
    if (i.name) names.push(i.name);
    (i.otherNames || []).forEach(n => names.push(n));
  });
  (study.interventions || []).forEach(n => names.push(n));
  if (names.some(n => String(n).toLowerCase().indexOf(needle) !== -1)) return true;
  // A title match is weaker evidence but real — some sponsors register the drug
  // only in the official title. Everything else is dropped.
  return String(study.title || "").toLowerCase().indexOf(needle) !== -1;
}

function summarizeAssetProgram(studies, drugName) {
  const all = studies || [];
  // Dedupe by NCT first: a paged or repeated query can return the same record.
  const seen = {};
  const unique = all.filter(s => (s.nctId && !seen[s.nctId]) ? (seen[s.nctId] = true) : false);
  const matched = unique.filter(s => studyNamesIntervention(s, drugName));
  const droppedForName = unique.length - matched.length;

  const byPhase = {};
  matched.forEach(s => {
    const key = String(s.phase || "NA");
    (byPhase[key] = byPhase[key] || []).push(s);
  });
  const phases = Object.keys(byPhase)
    .sort((a, b) => assetPhaseRank(b) - assetPhaseRank(a))
    .map(p => ({
      phase: p,
      label: ASSET_PHASE_LABEL[p] || p,
      trials: byPhase[p].slice().sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || ""))),
      count: byPhase[p].length,
      enrolled: byPhase[p].reduce((n, s) => n + (typeof s.enrollment === "number" ? s.enrollment : 0), 0)
    }));

  const byStatus = {};
  matched.forEach(s => { const k = s.status || "UNKNOWN"; byStatus[k] = (byStatus[k] || 0) + 1; });

  const stopped = matched.filter(s => ASSET_STOPPED_STATUSES.indexOf(String(s.status || "")) !== -1)
    .map(s => ({ nctId: s.nctId, title: s.title, phase: s.phase, status: s.status, whyStopped: s.whyStopped || null, enrollment: s.enrollment }));

  const conditions = {};
  matched.forEach(s => (s.conditions || []).forEach(c => { const k = String(c).trim(); if (k) conditions[k] = (conditions[k] || 0) + 1; }));
  const indications = Object.keys(conditions).map(k => ({ condition: k, trials: conditions[k] }))
    .sort((a, b) => b.trials - a.trials);

  const sponsors = {};
  matched.forEach(s => { if (s.sponsor) sponsors[s.sponsor] = (sponsors[s.sponsor] || 0) + 1; });

  // ── The evidence-base checklist ──
  // Every line is "n of N" against the same denominator, so a thin programme
  // and a deep one are told apart by reading, not by a number.
  const isRandomised = (s) => s.allocation === "RANDOMIZED";
  const isBlinded = (s) => !!s.masking && s.masking !== "NONE";
  const isControlled = (s) => (s.armTypes || []).some(t => t === "PLACEBO_COMPARATOR" || t === "ACTIVE_COMPARATOR" || t === "SHAM_COMPARATOR");
  const enrolments = matched.map(s => (typeof s.enrollment === "number" ? s.enrollment : 0)).filter(n => n > 0);
  const highest = matched.reduce((best, s) => assetPhaseRank(s.phase) > assetPhaseRank(best) ? String(s.phase || "NA") : best, "NA");
  // "Registered allocation" is the denominator that matters for the randomised
  // count — a trial that never registered one is not evidence that it was
  // single-arm, and folding it into either bucket would be a guess.
  const withStatedAllocation = matched.filter(s => s.allocation != null && s.allocation !== "").length;

  const evidence = {
    trials: matched.length,
    randomised: matched.filter(isRandomised).length,
    withStatedAllocation,
    blinded: matched.filter(isBlinded).length,
    withStatedMasking: matched.filter(s => s.masking != null && s.masking !== "").length,
    controlled: matched.filter(isControlled).length,
    withPostedResults: matched.filter(s => s.hasResults).length,
    completed: matched.filter(s => String(s.status || "") === "COMPLETED").length,
    stopped: stopped.length,
    totalEnrolment: enrolments.reduce((a, b) => a + b, 0),
    largestEnrolment: enrolments.length ? Math.max.apply(null, enrolments) : null,
    highestPhase: highest,
    highestPhaseLabel: ASSET_PHASE_LABEL[highest] || highest,
    indicationCount: indications.length,
    sponsorCount: Object.keys(sponsors).length
  };

  return {
    drugName: drugName || "",
    matched,
    trialCount: matched.length,
    droppedForName,
    scanned: unique.length,
    phases,
    byStatus,
    stopped,
    indications,
    sponsors: Object.keys(sponsors).map(k => ({ sponsor: k, trials: sponsors[k] })).sort((a, b) => b.trials - a.trials),
    evidence,
    // Read from the registry only, so the caveat travels with the data.
    caveat: "Registered trials only. A programme can have work that was never registered, registered under a code name this search does not match, or run outside the US registry entirely — so this is a floor on what exists, not a census of it."
  };
}

// ── The evidence-base read, in sentences rather than a score ───────────────
// Each line is a statement of fact with its own denominator attached. Nothing
// here is weighted, combined or ranked, and there is deliberately no overall
// verdict: the reader is the one holding the thesis.
function describeEvidenceBase(summary) {
  if (!summary || !summary.evidence || !summary.evidence.trials) return [];
  const e = summary.evidence;
  const lines = [];

  if (e.withStatedAllocation === 0) {
    lines.push({ key: "randomised", text: "No trial in this programme registered an allocation, so whether any of it is randomised cannot be read from the registry." });
  } else if (e.randomised === 0) {
    lines.push({ key: "randomised", tone: "thin", text: "None of the " + e.withStatedAllocation + " trials that registered an allocation is randomised. Every result here is a single-arm or non-randomised comparison, which can show what happened to patients on the drug but not that the drug caused it." });
  } else {
    lines.push({ key: "randomised", tone: e.randomised >= 2 ? "solid" : "thin",
      text: e.randomised + " of " + e.withStatedAllocation + " trials with a registered allocation " + (e.randomised === 1 ? "is" : "are") + " randomised." });
  }

  if (e.withStatedMasking > 0) {
    lines.push({ key: "blinded", tone: e.blinded === 0 ? "thin" : "solid",
      text: e.blinded === 0
        ? "Every trial that registered a masking arrangement is open label. That matters most where the endpoint involves judgement rather than a hard event."
        : e.blinded + " of " + e.withStatedMasking + " trials with registered masking " + (e.blinded === 1 ? "is" : "are") + " blinded." });
  }

  lines.push({ key: "controlled", tone: e.controlled === 0 ? "thin" : "solid",
    text: e.controlled === 0
      ? "No trial registers a placebo, active or sham comparator arm — there is nothing in this programme to measure the drug against except external expectation."
      : e.controlled + " of " + e.trials + " trials register a comparator arm." });

  lines.push({ key: "results", tone: e.withPostedResults === 0 ? "thin" : "solid",
    text: e.withPostedResults === 0
      ? "No trial has posted results to the registry yet, so nothing here has a number attached that can be checked against a press release."
      : e.withPostedResults + " of " + e.trials + " trials have posted results." });

  if (e.largestEnrolment != null) {
    lines.push({ key: "size", tone: e.largestEnrolment < 100 ? "thin" : "solid",
      text: "Largest single trial: " + e.largestEnrolment.toLocaleString() + " participants; " + e.totalEnrolment.toLocaleString() + " across the programme as registered."
        + (e.largestEnrolment < 100 ? " Nothing here is large enough to detect a modest effect reliably." : "") });
  }

  lines.push({ key: "phase", tone: assetPhaseRank(e.highestPhase) >= assetPhaseRank("PHASE3") ? "solid" : "thin",
    text: "Furthest the programme has reached: " + e.highestPhaseLabel + "." });

  if (e.stopped > 0) {
    lines.push({ key: "stopped", tone: "watch",
      text: e.stopped + " of " + e.trials + " trials " + (e.stopped === 1 ? "was" : "were") + " terminated, withdrawn or suspended. The registered reason, where there is one, is below — sponsors stop trials for business reasons as often as for scientific ones, and the two read very differently." });
  }

  if (e.indicationCount > 1) {
    lines.push({ key: "breadth", tone: "neutral",
      text: e.indicationCount + " distinct registered conditions across " + e.sponsorCount + " sponsor" + (e.sponsorCount === 1 ? "" : "s") + ". A broad spread can mean a platform with real optionality or a programme with no clear lead indication, and the registry cannot tell you which." });
  }

  return lines;
}

// The field list is a named constant, and `HasResults` is in it because it was
// once NOT in it — which is the instructive part. CT.gov v2 drops `hasResults`
// from the response entirely when `fields` is specified and it is not asked
// for, and `parseStudy` coerces the missing value to `false`. The result was
// not a blank: the evidence checklist stated, in a full sentence, that no trial
// in the programme had posted results, for a drug with sixteen that had. A
// wrong number is bad; a confident wrong sentence is worse. Anything this view
// reads has to appear here.
const ASSET_PROGRAM_FIELDS = [
  "NCTId", "BriefTitle", "OfficialTitle", "OverallStatus", "WhyStopped", "Phase",
  "LeadSponsorName", "LeadSponsorClass", "Condition",
  "InterventionName", "InterventionOtherName", "InterventionType",
  "EnrollmentCount", "StartDate", "PrimaryCompletionDate", "CompletionDate",
  "DesignInfo", "ArmGroup", "PrimaryOutcomeMeasure", "HasResults"
];

async function fetchAssetProgram(drugName, opts) {
  opts = opts || {};
  const name = String(drugName || "").trim();
  if (!name) return { ok: false, error: "Enter a drug or intervention name." };
  try {
    // A field list rather than the whole record: the unfiltered response for a
    // 50-trial programme is ~2.8MB, the filtered one is ~97KB, and everything
    // this view reads is in the filtered set.
    const data = await ctgovFetch({
      "query.intr": name,
      "pageSize": String(Math.min(opts.pageSize || 100, 200)),
      "countTotal": "true",
      "format": "json",
      "fields": ASSET_PROGRAM_FIELDS.join(",")
    });
    const studies = (data.studies || []).map(parseStudy);
    const summary = summarizeAssetProgram(studies, name);
    summary.totalMatchedByRegistry = data.totalCount || studies.length;
    summary.pageSize = studies.length;
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    summarizeAssetProgram, describeEvidenceBase, studyNamesIntervention, assetPhaseRank,
    fetchAssetProgram, ASSET_PROGRAM_FIELDS, ASSET_PHASE_ORDER, ASSET_PHASE_LABEL, ASSET_STOPPED_STATUSES
  };
}
