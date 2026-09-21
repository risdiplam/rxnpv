// ════════════════════════════════════════════════════════════════════════════
// RxNPV — OPEN TARGETS INTEGRATION
// Answers one question the rest of the app cannot: "is this target real?"
//
// Human genetic evidence linking a target to a disease is the best-published
// predictor of whether a drug against it survives the clinic — Nelson et al.
// (Nature Genetics, 2015) found genetically-supported targets roughly twice
// as likely to make it through, and later replications have held that up. The
// app's PoS benchmarks adjust for phase, area, modality and biomarker
// selection, but have no axis for whether the underlying biology has human
// evidence behind it at all.
//
// This is deliberately a CONTEXT tool, not a scoring engine, and it is not
// wired into the valuation. An Open Targets association score is a weighted
// aggregate over very heterogeneous evidence; presenting it as a probability
// input would be exactly the false precision this project avoids. What it
// gives you is: does human genetics point here, what else is already in the
// clinic against this target, and how far did those get.
//
// Free public GraphQL API, no key, no auth.
// ════════════════════════════════════════════════════════════════════════════

const OPENTARGETS_API = "https://api.platform.opentargets.org/api/v4/graphql";
const OT_TIMEOUT_MS = 15000;

async function openTargetsQuery(query, variables) {
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), OT_TIMEOUT_MS) : null;
  let res;
  try {
    res = await fetch(OPENTARGETS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: ctl ? ctl.signal : undefined
    });
  } catch (e) {
    if (timer) clearTimeout(timer);
    // Same discipline as every other integration here: a reachability problem
    // must never be presentable as "no evidence found". Those are opposite
    // conclusions and the difference matters more here than almost anywhere.
    throw new Error(e && e.name === "AbortError"
      ? "Open Targets did not respond within 15 seconds"
      : "Could not reach Open Targets: " + ((e && e.message) || "network error"));
  }
  if (timer) clearTimeout(timer);
  if (!res.ok) throw new Error("Open Targets API error: " + res.status + " " + res.statusText);
  const body = await res.json();
  if (body.errors && body.errors.length) throw new Error("Open Targets rejected the query: " + body.errors[0].message);
  return body.data;
}

// ── Resolve a free-text gene/target name to an Ensembl ID ──────────────────
const OT_SEARCH_QUERY = `
  query SearchTarget($q: String!) {
    search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 5 }) {
      hits { id name description entity }
    }
  }`;

async function resolveTarget(nameOrSymbol) {
  const q = String(nameOrSymbol || "").trim();
  if (!q) return { ok: false, error: "Enter a gene symbol or target name." };
  try {
    const data = await openTargetsQuery(OT_SEARCH_QUERY, { q });
    const hits = ((data && data.search && data.search.hits) || []).filter(hit => hit.entity === "target");
    if (!hits.length) return { ok: false, notFound: true, error: "No target on Open Targets matches “" + q + "”. Try the HGNC gene symbol (e.g. EGFR, TTR, SOD1) rather than a protein or drug name." };
    return { ok: true, hits: hits.map(hit => ({ ensemblId: hit.id, symbol: hit.name, description: hit.description || "" })) };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

// ── The dossier itself ─────────────────────────────────────────────────────
// associatedDiseases carries the per-disease association score plus the
// datatype breakdown, which is what lets genetic evidence be separated out
// rather than buried in one aggregate number. knownDrugs gives what has
// already been tried against this target and how far it got.
const OT_TARGET_QUERY = `
  query TargetDossier($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      approvedSymbol
      approvedName
      biotype
      functionDescriptions
      associatedDiseases(page: { index: 0, size: 12 }) {
        count
        rows {
          score
          disease { id name }
          datatypeScores { id score }
        }
      }
      drugAndClinicalCandidates {
        count
        rows {
          id
          maxClinicalStage
          drug { id name mechanismsOfAction { rows { mechanismOfAction } } }
          diseases { disease { name } }
        }
      }
    }
  }`;

// Open Targets datatype ids, split into "human evidence" vs everything else.
// Genetic association and somatic mutation are direct human observations;
// animal models and pathway inference are not, and conflating them is how an
// association score ends up meaning less than it appears to.
const OT_HUMAN_EVIDENCE_TYPES = ["genetic_association", "somatic_mutation", "known_drug"];

function summarizeDossier(target) {
  if (!target) return null;
  const rows = (target.associatedDiseases && target.associatedDiseases.rows) || [];
  const diseases = rows.map(r => {
    const byType = {};
    (r.datatypeScores || []).forEach(d => { byType[d.id] = d.score; });
    return {
      id: r.disease ? r.disease.id : null,
      name: r.disease ? r.disease.name : "(unnamed)",
      overallScore: r.score,
      geneticScore: byType.genetic_association || 0,
      hasGeneticEvidence: (byType.genetic_association || 0) > 0,
      byType
    };
  });

  // Open Targets renamed this surface: `knownDrugs` no longer exists and the
  // replacement is `drugAndClinicalCandidates`, whose rows already collapse to
  // one entry per drug (so no manual de-duplication is needed) and report the
  // stage as a STRING like "Phase III" rather than a number. Confirmed by
  // introspecting the live schema rather than assuming — the previous query
  // was silently returning HTTP 400.
  const drugRows = (target.drugAndClinicalCandidates && target.drugAndClinicalCandidates.rows) || [];
  // The API returns "PHASE_3" style strings, not roman numerals. Matching only
  // roman numerals silently scored every drug as 0, which made a target with
  // four Phase 3 programmes report "0 reached Phase 3+". Handle both, and
  // check roman numerals longest-first so "PHASE II" can't match "PHASE III".
  const stageToNumber = (stage) => {
    const t = String(stage || "").toUpperCase().replace(/[_\s]+/g, " ").trim();
    if (/APPROVED|PHASE 4|PHASE IV\b/.test(t)) return 4;
    if (/PHASE 3|PHASE III\b/.test(t)) return 3;
    if (/PHASE 2|PHASE II\b/.test(t)) return 2;
    if (/PHASE 1|PHASE I\b/.test(t)) return 1;
    return 0;
  };
  // "PHASE_3" is a machine token, not something to show a reader.
  const prettyStage = (stage) => {
    const t = String(stage || "").replace(/[_\s]+/g, " ").trim().toLowerCase();
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const drugs = drugRows.map(d => ({
    name: (d.drug && d.drug.name) || d.id || "(unnamed)",
    maxPhase: stageToNumber(d.maxClinicalStage),
    stageLabel: prettyStage(d.maxClinicalStage),
    mechanism: (d.drug && d.drug.mechanismsOfAction && d.drug.mechanismsOfAction.rows && d.drug.mechanismsOfAction.rows[0])
      ? d.drug.mechanismsOfAction.rows[0].mechanismOfAction : "",
    // A clinical-candidate row's `diseases` are ClinicalDiseaseListItem, which
    // wraps the disease rather than carrying a name directly.
    indications: (d.diseases || []).map(x => x && x.disease && x.disease.name).filter(Boolean)
  })).sort((a, b) => b.maxPhase - a.maxPhase);

  return {
    ensemblId: target.id,
    symbol: target.approvedSymbol,
    name: target.approvedName,
    biotype: target.biotype,
    functions: target.functionDescriptions || [],
    diseases,
    diseaseCount: (target.associatedDiseases && target.associatedDiseases.count) || diseases.length,
    drugs,
    drugCount: (target.drugAndClinicalCandidates && target.drugAndClinicalCandidates.count) || drugs.length,
    // The headline: has ANY disease association here got direct human genetic
    // evidence behind it, and has anything reached late-stage development?
    anyGeneticEvidence: diseases.some(d => d.hasGeneticEvidence),
    approvedOrLateStage: drugs.filter(d => d.maxPhase >= 3).length
  };
}

async function fetchTargetDossier(ensemblId) {
  try {
    const data = await openTargetsQuery(OT_TARGET_QUERY, { ensemblId });
    if (!data || !data.target) return { ok: false, notFound: true, error: "Open Targets has no record for " + ensemblId + "." };
    return { ok: true, dossier: summarizeDossier(data.target) };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { resolveTarget, fetchTargetDossier, summarizeDossier, OT_HUMAN_EVIDENCE_TYPES };
}
