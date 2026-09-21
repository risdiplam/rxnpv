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
      knownDrugs(size: 25) {
        count
        rows { drugId prefName phase status mechanismOfAction disease { name } }
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

  const drugRows = (target.knownDrugs && target.knownDrugs.rows) || [];
  // Collapse to one row per drug — knownDrugs returns a row per
  // drug x indication, so a drug in five indications would otherwise look
  // like five separate programmes.
  const byDrug = new Map();
  drugRows.forEach(d => {
    const key = d.drugId || d.prefName;
    if (!key) return;
    const existing = byDrug.get(key);
    const phase = typeof d.phase === "number" ? d.phase : parseFloat(d.phase) || 0;
    if (!existing) {
      byDrug.set(key, { name: d.prefName || key, maxPhase: phase, mechanism: d.mechanismOfAction || "", indications: d.disease ? [d.disease.name] : [], status: d.status || "" });
    } else {
      existing.maxPhase = Math.max(existing.maxPhase, phase);
      if (d.disease && d.disease.name && existing.indications.indexOf(d.disease.name) === -1) existing.indications.push(d.disease.name);
    }
  });
  const drugs = [...byDrug.values()].sort((a, b) => b.maxPhase - a.maxPhase);

  return {
    ensemblId: target.id,
    symbol: target.approvedSymbol,
    name: target.approvedName,
    biotype: target.biotype,
    functions: target.functionDescriptions || [],
    diseases,
    diseaseCount: (target.associatedDiseases && target.associatedDiseases.count) || diseases.length,
    drugs,
    drugCount: (target.knownDrugs && target.knownDrugs.count) || drugs.length,
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
