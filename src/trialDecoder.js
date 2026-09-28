// ════════════════════════════════════════════════════════════════════════════
// RxNPV — TRIAL DECODER
// Turns a parsed ClinicalTrials.gov study into plain English: what the design
// actually is, what it can prove, what it cannot, and which design choices are
// worth a second look.
//
// This is the part of the app that has nothing to do with the valuation and
// does not need to. A retail investor who has just read a press release has
// nowhere else to ask "is this trial any good" — the rest of the app could
// search trials and watch them for changes, but never explain one.
//
// Everything here is DERIVED FROM REPORTED FIELDS ONLY. Nothing is inferred
// from the sponsor, the drug, or anything about how likely the trial is to
// succeed. Where CT.gov does not state something, the decoder says so rather
// than guessing — an unregistered masking field means "not stated", never
// "open label". Pure functions, no network, no DOM: all of this is unit-tested
// against real study shapes in test/math_verification.js.
// ════════════════════════════════════════════════════════════════════════════

// Endpoint measures whose assessment is a judgement call rather than a
// hard event. Matched case-insensitively against the primary outcome text.
// These matter because a subjective endpoint in an unblinded trial is the
// single most common soft spot in a retail-visible readout.
const SUBJECTIVE_ENDPOINT_PATTERNS = [
  "response rate", "orr", "objective response", "investigator", "assessed by the investigator",
  "quality of life", "qol", "patient reported", "patient-reported", "pro ", "questionnaire",
  "scale", "score", "rating", "symptom", "pain", "fatigue", "global impression",
  "clinician", "physician", "assessment", "improvement", "satisfaction"
];

// Endpoints that are hard events or objective measurements — used to say
// plainly when blinding matters less, not to bless the trial.
const OBJECTIVE_ENDPOINT_PATTERNS = [
  "overall survival", " os ", "mortality", "death", "all-cause",
  "hospitalization", "laboratory", "concentration", "pharmacokinetic",
  "viral load", "hba1c", "blood pressure", "ldl", "progression-free survival by bicr",
  "blinded independent", "bicr", "independent review"
];

const TIME_TO_EVENT_PATTERNS = [
  "survival", "time to", "progression-free", "pfs", "event-free", "duration of",
  "recurrence", "relapse-free", "disease-free"
];

function matchesAny(text, patterns) {
  const t = " " + String(text || "").toLowerCase() + " ";
  return patterns.some(p => t.indexOf(p) !== -1);
}

// ── Design classification ──────────────────────────────────────────────────
// Each returns a value plus whether CT.gov actually stated it, so the UI can
// distinguish "single arm" from "the sponsor did not register an allocation".
function classifyAllocation(study) {
  const a = study.allocation;
  const model = study.interventionModel;
  if (model === "SINGLE_GROUP") return { value: "single-arm", randomized: false, stated: true };
  if (a === "RANDOMIZED") return { value: "randomized", randomized: true, stated: true };
  if (a === "NON_RANDOMIZED") return { value: "non-randomized, multi-arm", randomized: false, stated: true };
  if (study.armCount === 1) return { value: "single-arm", randomized: false, stated: true };
  return { value: "not stated", randomized: null, stated: false };
}

function classifyMasking(study) {
  const m = study.masking;
  if (m === "NONE") return { value: "open label", blinded: false, stated: true, who: [] };
  if (!m) return { value: "not stated", blinded: null, stated: false, who: [] };
  const who = study.whoMasked || [];
  const label = { SINGLE: "single blind", DOUBLE: "double blind", TRIPLE: "triple blind", QUADRUPLE: "quadruple blind" }[m] || m.toLowerCase();
  return { value: label, blinded: true, stated: true, who };
}

// A placebo or active comparator arm is what makes a control a control.
function classifyComparator(study) {
  const types = study.armTypes || [];
  if (types.indexOf("PLACEBO_COMPARATOR") !== -1) return { value: "placebo-controlled", controlled: true, stated: true };
  if (types.indexOf("ACTIVE_COMPARATOR") !== -1) return { value: "active comparator", controlled: true, stated: true };
  if (types.indexOf("SHAM_COMPARATOR") !== -1) return { value: "sham-controlled", controlled: true, stated: true };
  if (types.indexOf("NO_INTERVENTION") !== -1) return { value: "untreated control", controlled: true, stated: true };
  if (types.length && types.every(t => t === "EXPERIMENTAL")) return { value: "no control arm registered", controlled: false, stated: true };
  return { value: "not stated", controlled: null, stated: false };
}

function classifyPrimaryEndpoint(study) {
  const outs = study.primaryOutcomesFull && study.primaryOutcomesFull.length
    ? study.primaryOutcomesFull
    : (study.primaryOutcomes || []).map(m => ({ measure: m, timeFrame: "" }));
  if (!outs.length) return { count: 0, subjective: null, timeToEvent: false, stated: false, items: [] };
  const joined = outs.map(o => o.measure).join(" ");
  // An explicitly blinded/independent read makes an otherwise judgement-based
  // endpoint objective, so objective patterns are checked first.
  const objective = matchesAny(joined, OBJECTIVE_ENDPOINT_PATTERNS);
  const subjective = !objective && matchesAny(joined, SUBJECTIVE_ENDPOINT_PATTERNS);
  return {
    count: outs.length,
    subjective,
    objective,
    timeToEvent: matchesAny(joined, TIME_TO_EVENT_PATTERNS),
    stated: true,
    items: outs
  };
}

// ── What the trial can and cannot prove ────────────────────────────────────
// Deliberately conservative and phrased as capability, never as likelihood.
// "Can establish" means the architecture supports the claim, not that the
// trial will succeed.
function whatItCanProve(study) {
  const alloc = classifyAllocation(study);
  const comp = classifyComparator(study);
  const mask = classifyMasking(study);
  const ep = classifyPrimaryEndpoint(study);
  const can = [], cannot = [];

  if (alloc.randomized && comp.controlled) {
    can.push("A causal comparison against its control arm — randomization is what lets a difference be attributed to the drug rather than to who happened to receive it.");
  } else if (alloc.value === "single-arm") {
    can.push("Whether patients on this drug reached the endpoint, and how safe it looked.");
    cannot.push("Any causal claim about the drug versus an alternative. A single-arm trial has nothing to compare against except an external expectation, which is not the same as a control group.");
  } else if (alloc.stated && !alloc.randomized) {
    cannot.push("A clean causal comparison — without randomization, differences between arms can reflect who was assigned to each one.");
  }

  if (comp.controlled === false) {
    cannot.push("Superiority over standard of care, since no comparator arm is registered.");
  }

  if (ep.stated && ep.timeToEvent) {
    can.push("A time-to-event estimate (the primary endpoint is a survival-type measure), subject to having enough events rather than enough patients — event count, not enrollment, drives precision here.");
  }

  if (mask.blinded === false && ep.subjective) {
    cannot.push("An assessment free of expectation bias: the primary endpoint involves judgment and nobody is blinded, so both patients and assessors know who got the drug.");
  }
  if (mask.blinded && ep.subjective) {
    can.push("A reasonably protected read on a judgment-based endpoint, since assessors were masked.");
  }

  cannot.push("Regulatory approval, commercial uptake, or a usable label. A trial can hit its endpoint and still not deliver any of those.");
  return { can, cannot, alloc, comp, mask, ep };
}

// ── Design red flags ───────────────────────────────────────────────────────
// These describe the trial, not the company and not the odds. Each carries a
// severity and states the evidence it was raised on, so nothing is a bare
// assertion. Deliberately separate from computeRedFlags(), which checks the
// user's own modelling inputs rather than anything about the study.
function decodeTrialRedFlags(study, opts) {
  const o = opts || {};
  const now = o.now || new Date();
  const flags = [];
  const alloc = classifyAllocation(study);
  const mask = classifyMasking(study);
  const comp = classifyComparator(study);
  const ep = classifyPrimaryEndpoint(study);

  if (mask.blinded === false && ep.subjective) {
    flags.push({ severity: "high", label: "Open label with a judgment-based primary endpoint",
      detail: "Nobody is masked and the primary endpoint is assessed rather than measured. This is the most common way an effect gets overstated without anyone doing anything improper — expectation shifts how symptoms are reported and how responses are scored. An independent blinded review (BICR) would mitigate it; check whether one is specified." });
  }

  if (alloc.value === "single-arm" && ep.stated) {
    flags.push({ severity: "medium", label: "Single-arm trial",
      detail: "There is no control group, so the result has to be read against an external expectation of how untreated patients behave. That can be legitimate in a setting with no effective therapy, and misleading in one where randomized trials already exist. Worth checking what the standard of care in this indication is now." });
  }

  if (comp.controlled === false && alloc.randomized) {
    flags.push({ severity: "medium", label: "Randomized but no comparator arm registered",
      detail: "The allocation is randomized but every registered arm is experimental — often dose-ranging. A dose comparison does not establish benefit over standard of care." });
  }

  // Above roughly half a dozen, "co-primary" stops describing the situation: a
  // registration that large is almost always a master protocol covering several
  // sub-studies, where the alpha-splitting framing does not apply the way it
  // would to two co-primaries in one comparison. Found against a real record —
  // NCT04368728 registers 64.
  if (ep.count > 6) {
    flags.push({ severity: "medium", label: ep.count + " registered primary endpoints",
      detail: "That many primary outcomes usually means this record covers several sub-studies or phases under one NCT rather than a single comparison. Treat it as a container: work out which sub-study a given result came from before reading it as the trial's outcome, because a press release will rarely make that distinction for you." });
  } else if (ep.count > 1) {
    flags.push({ severity: "medium", label: ep.count + " co-primary endpoints",
      detail: "More than one primary endpoint raises the bar: either all must succeed, or the alpha has to be split between them. Check whether a testing hierarchy is specified — and treat a press release that celebrates one of several primaries with caution." });
  }

  if (study.enrollment != null && study.enrollment > 0 && study.enrollment < 50 && ep.timeToEvent) {
    flags.push({ severity: "high", label: "Small trial with a time-to-event primary endpoint",
      detail: "Only " + study.enrollment + " participants registered against a survival-type endpoint. Precision here is driven by the number of events, not the number of patients, and a trial this size will produce a very wide confidence interval however the point estimate lands." });
  }

  if (study.whyStopped) {
    flags.push({ severity: "high", label: "Trial stopped early",
      detail: "CT.gov records a reason: “" + study.whyStopped + "”. Early termination can be for futility, safety, enrollment, or business reasons — they are not remotely equivalent, and the registered wording is often the only public account." });
  }

  // Completed long enough ago that results were due. FDAAA requires posting
  // within a year of primary completion for applicable trials; a year is used
  // here as a plain-language threshold, not a legal determination.
  const completion = study.primaryCompletionDate || study.completionDate;
  if (completion && !study.hasResults && /COMPLET/i.test(study.status || "")) {
    const d = parsePartialDateSafe(completion);
    if (d) {
      const monthsSince = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (monthsSince >= 12) {
        flags.push({ severity: "high", label: "Completed " + Math.floor(monthsSince / 12) + "+ year(s) ago with no posted results",
          detail: "Primary completion was " + completion + " and CT.gov still shows no results module. Applicable trials are generally expected to post within a year. Absence is not proof of a bad result, but a silent completed trial is worth asking about." });
      }
    }
  }

  if (study.healthyVolunteers === true && /PHASE2|PHASE3/i.test(String(study.phase || "").replace(/[^A-Z0-9]/gi, ""))) {
    flags.push({ severity: "medium", label: "Accepts healthy volunteers at a therapeutic phase",
      detail: "Healthy-volunteer enrollment is normal in Phase 1 and unusual once a trial is meant to demonstrate benefit in patients. Worth confirming the registered phase is right." });
  }

  return flags;
}

// Local, dependency-free partial-date parse: CT.gov dates are "YYYY-MM" as
// often as "YYYY-MM-DD". Deliberately not shared with ts_ctgovEngine's parser
// — that one deliberately normalises to month granularity for duration maths,
// which is the right behaviour there and the wrong one here.
function parsePartialDateSafe(str) {
  if (!str) return null;
  const parts = String(str).split("-");
  const y = parseInt(parts[0], 10);
  if (!isFinite(y)) return null;
  const m = parts.length > 1 ? parseInt(parts[1], 10) - 1 : 0;
  const d = parts.length > 2 ? parseInt(parts[2], 10) : 1;
  const date = new Date(y, isFinite(m) ? m : 0, isFinite(d) ? d : 1);
  return isNaN(date.getTime()) ? null : date;
}

// ── Top-level: everything the decoder card needs, in one object ────────────
function decodeTrial(study, opts) {
  if (!study || !study.nctId) return null;
  const proof = whatItCanProve(study);
  return {
    nctId: study.nctId,
    title: study.title,
    sponsor: study.sponsor,
    phase: study.phase,
    status: study.status,
    enrollment: study.enrollment,
    conditions: study.conditions || [],
    interventions: study.interventions || [],
    allocation: proof.alloc,
    masking: proof.mask,
    comparator: proof.comp,
    endpoint: proof.ep,
    armCount: study.armCount,
    armLabels: study.armLabels || [],
    canProve: proof.can,
    cannotProve: proof.cannot,
    redFlags: decodeTrialRedFlags(study, opts),
    hasResults: study.hasResults,
    // One-line architecture summary, the way a reviewer would say it out loud.
    architecture: [
      proof.alloc.stated ? proof.alloc.value : "allocation not stated",
      proof.mask.stated ? proof.mask.value : "masking not stated",
      proof.comp.stated && proof.comp.controlled ? proof.comp.value : null,
      study.enrollment ? "n=" + study.enrollment : null
    ].filter(Boolean).join(" · ")
  };
}

// ── Trials side by side ────────────────────────────────────────────────────
// entries: [{ study (parseStudy shape), results (parseTrialResults or null) }].
// Rows hold each trial's value for one question, as registered; `differs` is
// set when the first trial's value matches none of the others, which is what
// the table shades. Results are the sponsor's own first primary analysis,
// quoted with its parameter type, never re-computed or ranked — two posted
// results on different measures are not comparable numbers.
const COMPARE_PLACEBO_RE = /placebo|sham|vehicle|standard of care|best supportive/i;
function compareTrialsAge(s) {
  const clean = v => v ? String(v).replace(/\s*Years?/i, "").trim() : null;
  const lo = clean(s.minimumAge), hi = clean(s.maximumAge);
  return lo && hi ? lo + " to " + hi : lo ? lo + " and up" : hi ? "up to " + hi : "not stated";
}
function compareTrialsResult(study, results) {
  const primary = results && results.primaryOutcomes && results.primaryOutcomes[0];
  if (!primary) return study.hasResults ? "Results posted, but no primary outcome could be read" : "No results posted" + (study.primaryCompletionDate ? " (primary completion " + study.primaryCompletionDate + ")" : "");
  const a = (primary.analyses || []).find(x => x.value != null);
  if (!a) return "Primary outcome posted without a comparison statistic";
  const ci = a.lower != null && a.upper != null ? " (" + (a.ciPct ? a.ciPct + "% " : "") + "CI " + a.lower + " to " + a.upper + ")" : "";
  return (a.paramType || "Estimate") + ": " + a.value + ci + (a.pValue ? ", p = " + a.pValue : "");
}
// Weeks from a registered time frame: "Week 28", "up to 14 weeks", "Day 99",
// "6 months". The first time stated is taken; null when there is none.
function compareTrialsWeeks(timeFrame) {
  const t = String(timeFrame || "");
  let m = t.match(/week\s*(\d+(?:\.\d+)?)/i) || t.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (m) return Number(m[1]);
  m = t.match(/day\s*(\d+)/i) || t.match(/(\d+)\s*days?/i);
  if (m) return Math.round(Number(m[1]) / 7);
  m = t.match(/month\s*(\d+(?:\.\d+)?)/i) || t.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (m) return Math.round(Number(m[1]) * 4.345);
  return null;
}
function compareTrials(entries) {
  const list = (entries || []).filter(e => e && e.study);
  if (!list.length) return null;
  const cols = list.map(({ study, results }) => {
    const alloc = classifyAllocation(study), mask = classifyMasking(study), comp = classifyComparator(study), ep = classifyPrimaryEndpoint(study);
    const drugs = (study.interventions || []).filter(n => !COMPARE_PLACEBO_RE.test(n));
    const primary = ep.items || [];
    const firstA = results && results.primaryOutcomes && results.primaryOutcomes[0] && (results.primaryOutcomes[0].analyses || []).find(x => x.value != null);
    const weeks = primary.length ? compareTrialsWeeks(primary[0].timeFrame) : null;
    return {
      nctId: study.nctId, title: study.title, sponsor: study.sponsor, drugs: drugs.length ? drugs : study.interventions || [],
      design: { alloc: alloc.value, mask: mask.value, comp: comp.value }, weeks,
      values: {
        status: String(study.phase || "").replace(/PHASE(\d)/g, "Phase $1").replace(/EARLY_Phase 1/, "Early Phase 1") + " · " + String(study.status || "").replace(/_/g, " ").toLowerCase(),
        design: [alloc.value, mask.value, comp.value].join(", "),
        patients: study.enrollment != null ? study.enrollment + (study.enrollmentType === "ESTIMATED" ? " (planned)" : "") : "not stated",
        ages: compareTrialsAge(study),
        endpoint: primary.length ? primary.map(o => o.measure).join("; ") : "not stated",
        // A plain "Week 28" is already the answer; anything longer gets the
        // week it works out to first, so the column reads at a glance.
        measuredAt: primary.length ? (weeks != null && !/^\s*week\s*\d+\s*$/i.test(primary[0].timeFrame || "") ? "≈ week " + weeks + " — " : "") + primary.map(o => o.timeFrame || "not stated").join("; ") : "not stated",
        dates: (study.startDate || "?") + " → " + (study.primaryCompletionDate || "?"),
        result: compareTrialsResult(study, results)
      },
      resultMeasure: firstA ? String(firstA.paramType || "").toLowerCase() : null
    };
  });
  // Only what can be compared honestly is shaded: the design classification,
  // part by part, and the primary time point in weeks (differing by more than
  // two). Counts, ages and free-text endpoints always differ a little and
  // would shade every row, which says nothing.
  const [first, ...others] = cols;
  const designDiff = others.length > 0 && ["alloc", "mask", "comp"].some(k => others.every(o => o.design[k] !== first.design[k]));
  const timeDiff = others.length > 0 && first.weeks != null && others.every(o => o.weeks != null && Math.abs(o.weeks - first.weeks) > 2);
  const LABELS = [["status", "Phase and status"], ["design", "Design"], ["patients", "Patients"], ["ages", "Ages"], ["endpoint", "Primary endpoint"], ["measuredAt", "Measured at"], ["dates", "Start → primary completion"], ["result", "Result (sponsor's primary analysis)"]];
  const rows = LABELS.map(([key, label]) => ({ key, label, values: cols.map(c => c.values[key]), differs: key === "design" ? designDiff : key === "measuredAt" ? timeDiff : false }));
  const measures = cols.map(c => c.resultMeasure).filter(Boolean);
  return { cols, rows, designDiff, timeDiff, resultsComparable: measures.length > 1 ? measures.every(m => m === measures[0]) : null };
}
// What the first trial does differently on design and timing, and whether the
// posted results can be read against each other at all.
function readTrialComparison(cmp) {
  if (!cmp || cmp.cols.length < 2) return null;
  const [first, ...others] = cmp.cols;
  const who = first.drugs[0] ? possessive(first.drugs[0]) + " trial" : first.nctId;
  const bits = [];
  if (cmp.designDiff) {
    const parts = ["comp", "mask", "alloc"].filter(k => others.every(o => o.design[k] !== first.design[k]));
    bits.push(parts.map(k => first.design[k] + " (the " + (others.length === 1 ? "other" : "others") + ": " + others.map(o => o.design[k]).filter((v, i, a) => a.indexOf(v) === i).join(" / ") + ")").join(" and "));
  }
  if (cmp.timeDiff) {
    const wk = others.map(o => o.weeks).filter((v, i, arr) => arr.indexOf(v) === i);
    bits.push("measured at week " + first.weeks + " against " + (wk.length === 1 ? "week " + wk[0] + (others.length > 1 ? " for " + (others.length === 2 ? "both" : "all") + " the others" : "") : "weeks " + wk.slice(0, -1).join(", ") + " and " + wk[wk.length - 1]));
  }
  const verdict = bits.length ? who + " differs on " + (cmp.designDiff && cmp.timeDiff ? "design and timing" : cmp.designDiff ? "design" : "timing") + "." : who + " is registered much like the others on design and timing.";
  const res = cmp.resultsComparable === false ? " The posted results use different measures, so they are shown side by side, not ranked."
    : cmp.resultsComparable === true ? " The posted results use the same measure, though different populations and time points can still make them hard to compare." : "";
  return { verdict, text: ((bits.length ? "It is " + bits.join("; ") + "." : "Read each column against its own registered endpoint and population.") + res).trim() };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    decodeTrial, decodeTrialRedFlags, whatItCanProve,
    classifyAllocation, classifyMasking, classifyComparator, classifyPrimaryEndpoint
  };
}
