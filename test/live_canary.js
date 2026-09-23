#!/usr/bin/env node
// Live canary for the ClinicalTrials.gov parsers (B-012, docs/RxNPV_MUSE_AUDIT.md).
//
// The unit fixtures encode the API shape as it was when they were written, so
// they cannot notice CT.gov changing under the app — which has happened (a
// filtered query silently dropping hasResults; paramType turning out to be free
// text). This fetches three reference trials through the app's OWN
// fetchStudyByNctId, runs the same parse -> decode -> results path the Trial
// Decoder uses, and compares a compact summary with test/live_canary_baseline.json.
//
//   node test/live_canary.js                   # compare; exit 1 on any drift
//   node test/live_canary.js --write-baseline  # accept the current output
//
// A difference is not automatically a bug: a sponsor can amend a record. It is
// a prompt to look before trusting the decoder on new trials. Needs Node 18+
// and the network; not part of `npm test`.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const FILES = ["data.js", "ts_ctgovEngine.js", "ctgovEngine.js", "trialDecoder.js", "trialResults.js"];
global.window = {}; global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const combined = FILES.map(f => fs.readFileSync(path.join(SRC, f), "utf8")).join("\n\n");
const api = new Function(combined + "\nreturn { fetchStudyByNctId, decodeTrial };")();

const TRIALS = ["NCT03036124", "NCT02578680", "NCT04368728"];
const BASELINE = path.join(__dirname, "live_canary_baseline.json");

function summarise(r) {
  const s = r.study || {}, res = r.results || null;
  const dec = api.decodeTrial(s) || {};
  const prim = res ? res.primaryOutcomes : [];
  const firstEffect = prim.map(o => (o.analyses || []).find(a => a.value != null && a.scale)).find(Boolean) || null;
  return {
    phase: s.phase || null,
    allocation: s.allocation || null,
    masking: s.masking || null,
    armCount: s.armCount != null ? s.armCount : null,
    registeredPrimaryEndpoints: (s.primaryOutcomes || []).length,
    hasResults: !!s.hasResults,
    parsedPrimaryResults: prim.length,
    firstEffect: firstEffect ? { paramType: firstEffect.paramType, scale: firstEffect.scale,
      value: firstEffect.value, lower: firstEffect.lower, upper: firstEffect.upper } : null,
    safetyGroups: res && res.safety ? res.safety.groups.length : null,
    safetyPrimaryGroups: res && res.safety ? res.safety.primaryGroups.length : null,
    safetyComparable: res && res.safety ? !!res.safety.comparable : null,
    seriousTerms: res && res.safety ? res.safety.seriousTermCount : null,
    flowGroups: res && res.flow && res.flow.groups ? res.flow.groups.length : null,
    designFlags: (dec.redFlags || []).map(f => f.label).sort()
  };
}

// Sanity rules that must hold whatever the baseline says — each is a lesson
// already paid for once (see "API lessons" in CLAUDE.md).
function invariants(nct, sum) {
  const out = [];
  const need = (c, msg) => { if (!c) out.push(msg); };
  if (nct === "NCT03036124") {
    need(sum.hasResults, "DAPA-HF must read as having posted results (the hasResults field-list lesson)");
    need(sum.firstEffect && sum.firstEffect.scale && sum.firstEffect.value > 0 && sum.firstEffect.value < 1, "DAPA-HF's primary hazard ratio must parse, on a ratio scale, below 1");
    need(sum.firstEffect && sum.firstEffect.lower < sum.firstEffect.value && sum.firstEffect.value < sum.firstEffect.upper, "and sit inside its own interval");
  }
  if (nct === "NCT02578680") {
    need(sum.hasResults && sum.safetyGroups >= 3, "KEYNOTE-189 registers crossover cohorts as extra AE groups");
    need(sum.safetyComparable === false, "which must not be presented as a clean two-arm comparison");
  }
  if (nct === "NCT04368728") {
    need(sum.registeredPrimaryEndpoints >= 40, "NCT04368728 registers dozens of primary endpoints (the mega-trial lesson)");
    need(sum.armCount >= 10, "and many arms");
  }
  return out;
}

(async () => {
  const write = process.argv.includes("--write-baseline");
  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};
  const now = {};
  let problems = 0;
  for (const nct of TRIALS) {
    const r = await api.fetchStudyByNctId(nct);
    if (!r.ok) { console.log("FAIL " + nct + ": " + r.error); problems++; continue; }
    const sum = summarise(r);
    now[nct] = sum;
    const broken = invariants(nct, sum);
    broken.forEach(m => { console.log("FAIL " + nct + ": " + m); problems++; });
    if (!write && baseline[nct]) {
      const diffs = Object.keys(sum).filter(k => JSON.stringify(sum[k]) !== JSON.stringify(baseline[nct][k]));
      diffs.forEach(k => { console.log("DRIFT " + nct + "." + k + ": baseline " + JSON.stringify(baseline[nct][k]) + " -> now " + JSON.stringify(sum[k])); problems++; });
      if (!diffs.length && !broken.length) console.log("OK   " + nct + " matches the baseline");
    } else if (!write) { console.log("NEW  " + nct + " has no baseline yet (run with --write-baseline)"); }
  }
  if (write) {
    fs.writeFileSync(BASELINE, JSON.stringify(Object.assign({ _written: new Date().toISOString().slice(0, 10) }, now), null, 2) + "\n");
    console.log("Baseline written: " + BASELINE);
  }
  console.log(problems ? "\n" + problems + " problem(s) — look before trusting the decoder on new trials" : "\nCanary clean");
  process.exit(problems ? 1 : 0);
})();
