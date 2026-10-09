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
      detail: "There is no control group, so the result has to be read against an external expectation of how untreated patients behave. That can be legitimate in a setting with no effective therapy, and misleading in one where randomized trials already exist. Worth checking what the standard of care in this indication is now. If patients were enrolled because their disease was bad at the time — a minimum seizure count, a high symptom score — part of any improvement is expected from regression to the mean alone (Motulsky ch. 1, 33), and a single-arm trial cannot separate it from the drug." });
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
    // Stopped for benefit (October 2026; Goldacre ch. 4): trials stopped early
    // for benefit overstate it — about 25% on average in a 2010 review of ~100
    // such trials against ~400 that ran to the end. Shown as context only.
    const forBenefit = /efficacy|benefit|positive|overwhelming|met (its|the) primary|success/i.test(study.whyStopped) && !/lack of efficacy|futility|no benefit|insufficient efficacy/i.test(study.whyStopped);
    flags.push({ severity: "high", label: forBenefit ? "Trial stopped early for benefit" : "Trial stopped early",
      detail: "CT.gov records a reason: “" + study.whyStopped + "”. " + (forBenefit
        ? "A trial stopped early for benefit tends to overstate the benefit: a 2010 review of about 100 such trials against about 400 that ran their course found the early-stopped ones overstated it by roughly a quarter on average. Treat the reported effect as an upper estimate, and check whether the stop followed a pre-specified boundary (Trial Statistics → Interim Analysis)."
        : "Early termination can be for futility, safety, enrollment, or business reasons — they are not remotely equivalent, and the registered wording is often the only public account.") });
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
  return (a.paramType || "Estimate") + ": " + a.value + ci + (a.pValue ? ", " + formatRegisteredP(a.pValue) : "");
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

// ── Press-release reader (October 2026; Ritchie ch. 4 and 6, Goldacre ch. 4) ──
// Releases are what most investors actually read. This lists the phrases that
// usually signal a result weaker than it sounds, the p-values sitting near
// 0.05, and any ratio whose interval includes no effect — each quoted from the
// text with what it usually means. It never scores the release: a count of
// flags would be the false precision the app avoids, and context decides.
const PR_PHRASES = [
  { key: "trend", re: /\btrend(?:ing|ed)?\s+toward(?:s)?\s+(?:statistical\s+)?significan\w*/gi, label: "“trend toward significance”", meaning: "The result missed the threshold. A trend is not evidence of an effect; with more data, results like this go either way." },
  { key: "postrend", re: /\b(?:positive|favou?rable|encouraging|improving)\s+(?:OS\s+|survival\s+)?trend\b/gi, label: "a “positive” or “favourable” trend", meaning: "Usually a result that did not reach statistical significance, described by its direction." },
  { key: "numerical", re: /\bnumerical(?:ly)?\s+(?:greater|higher|lower|better|improve\w*|favou?r\w*|advantage|difference)/gi, label: "“numerically …”", meaning: "A difference in the numbers that was not statistically significant — it may be chance." },
  { key: "nominal", re: /\bnominal(?:ly)?\s+(?:p\b|p-value|p\s*[=<]|significan\w*|statistically)/gi, label: "a “nominal” p-value", meaning: "From an analysis outside the trial’s planned, error-controlled tests — a later data cut, a subgroup, longer follow-up. Supportive at most; not a confirmed result." },
  { key: "approaching", re: /\bapproach(?:ed|ing)?\s+(?:statistical\s+)?significance\b|\bmarginally\s+significant\b|\bborderline\s+(?:statistically\s+)?significan\w*/gi, label: "“approaching” or “marginal” significance", meaning: "A result that missed the threshold, described as if it nearly met it." },
  { key: "missed", re: /\b(?:did\s+not|didn['’]t|failed\s+to)\s+(?:reach|achieve|meet)\s+(?:statistical\s+)?significance\b|\bnot\s+statistically\s+significant\b|\bwithout\s+achieving\s+(?:a\s+)?statistical(?:ly)?\s+significan\w*/gi, label: "“did not reach statistical significance”", meaning: "A plain statement that the result missed. The interval says whether the miss is definitive or just imprecise (Simulation → P-value ↔ CI, with the smallest effect that matters)." },
  { key: "meaningful", re: /\bclinically\s+meaningful\b/gi, label: "“clinically meaningful”", meaning: "A judgment, not a statistic. Check that a number with an interval sits next to it, and whether that number was also statistically significant." },
  { key: "posthoc", re: /\bpost[-\s]hoc\b|\bexploratory\s+(?:analys\w*|endpoint\w*)/gi, label: "a post hoc or exploratory analysis", meaning: "Chosen after seeing the data, or outside the error-controlled plan: a hypothesis for the next trial." },
  { key: "updated", re: /\b(?:updated|additional|longer[-\s]term)\s+(?:follow[-\s]up\s+)?(?:overall\s+survival\s+|OS\s+)?analys[ie]s\b|\bdata\s+cut[-\s]?off\b|\blonger\s+follow[-\s]up\b/gi, label: "an updated analysis or a new data cut", meaning: "An analysis after the planned one. Unless the protocol pre-specified it, its p-values are nominal, and the company chose when to look." },
  { key: "subgroup", re: /\bsubgroups?\b/gi, label: "a subgroup result", meaning: "A result in part of the trial. Check that it was pre-specified, and test any claimed difference between subgroups (Simulation → Trial Statistics → Subgroup Check)." },
  { key: "consistent", re: /\bconsistent\s+(?:benefit|efficacy|results?|trend)\s+(?:was\s+observed\s+)?across\s+(?:all\s+|pre-?specified\s+|pre-?defined\s+|key\s+|important\s+|clinical\s+)?subgroups\b/gi, label: "“consistent across subgroups”", meaning: "Usually read off a forest plot. Subgroups are small; consistency is easy to claim and hard to test." },
  { key: "descriptive", re: /\bdescriptive(?:\s+only)?\b|\bnot\s+formally\s+powered\b/gi, label: "“descriptive” or “not formally powered”", meaning: "The company itself says this comparison carries no formal test." },
  { key: "prespecified", re: /\bpre-?specified\b|\bprotocol-?specified\b/gi, label: "“pre-specified”", meaning: "A good sign: planned before the data were seen. Check it is the primary or a controlled secondary, not one of many.", good: true }
];
function prSnippet(text, start, end) {
  const a = Math.max(0, start - 70), b = Math.min(text.length, end + 70);
  return (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : "");
}
function scanPressRelease(text) {
  const t = String(text || "");
  if (t.trim().length < 20) return null;
  const phrases = [];
  PR_PHRASES.forEach(p => {
    const quotes = [];
    let m; p.re.lastIndex = 0;
    while ((m = p.re.exec(t)) !== null) { quotes.push(prSnippet(t, m.index, m.index + m[0].length)); if (quotes.length >= 12) break; }
    if (quotes.length) phrases.push({ key: p.key, label: p.label, meaning: p.meaning, good: !!p.good, count: quotes.length, quotes: quotes.slice(0, 3) });
  });
  // p-values: "p=0.057", "p < 0.0001", "P-value of 0.03", "nominal p=0.0151".
  const pValues = [];
  const pre = /\b[pP](?:\s*-?\s*value)?\s*(?:of\s*)?(=|<|≤|<=|>|≥)\s*(0?\.\d+|1(?:\.0+)?)\b/g;
  let m;
  while ((m = pre.exec(t)) !== null) {
    const value = Number(m[2]), op = m[1];
    const before = t.slice(Math.max(0, m.index - 30), m.index).toLowerCase();
    pValues.push({ value, op, nominal: /nominal/.test(before), nearMiss: op === "=" && value >= 0.05 && value < 0.1, justUnder: op === "=" && value >= 0.04 && value < 0.05, quote: prSnippet(t, m.index, m.index + m[0].length) });
  }
  // Ratios with an interval: "HR 0.79 (95% CI: 0.62 – 1.01", "hazard ratio of 0.76 (95% CI: 0.61 – 0.95".
  const ratios = [];
  const rre = /\b(hazard\s+ratio|HR|odds\s+ratio|OR|risk\s+ratio|relative\s+risk|RR)\b[^0-9(]{0,25}(\d*\.\d+)[^(]{0,40}\(\s*(\d{2})%\s*CI[:\s,]*(\d*\.\d+)\s*(?:–|—|-|to|,)\s*(\d*\.\d+)/gi;
  while ((m = rre.exec(t)) !== null) {
    const est = Number(m[2]), lo = Number(m[4]), hi = Number(m[5]);
    if (!(lo > 0 && hi > lo)) continue;
    ratios.push({ kind: m[1].replace(/\s+/g, " "), est, level: Number(m[3]), lower: lo, upper: hi, includesNull: lo <= 1 && hi >= 1, quote: prSnippet(t, m.index, m.index + m[0].length) });
  }
  const flagged = phrases.filter(p => !p.good);
  return { phrases, flagged, pValues, ratios,
    nominalCount: pValues.filter(p => p.nominal).length,
    nearMissCount: pValues.filter(p => p.nearMiss || p.justUnder).length,
    nullCrossing: ratios.filter(r => r.includesNull).length };
}
function readPressRelease(scan) {
  if (!scan) return null;
  const f = scan.flagged.length, nn = scan.nullCrossing, near = scan.nearMissCount;
  if (!f && !nn && !near) return { verdict: "Nothing in the wording that usually signals a weaker result than it sounds.", text: "That is not the same as a strong result: check the numbers themselves — the interval, the endpoint, and whether it was the trial's primary analysis." };
  const parts = [];
  if (nn) parts.push(nn + " interval" + (nn === 1 ? " includes" : "s include") + " no effect");
  if (near) parts.push(near + " p-value" + (near === 1 ? " sits" : "s sit") + " close to 0.05");
  if (f) parts.push(f + " kind" + (f === 1 ? "" : "s") + " of phrasing worth a second look");
  return { verdict: parts.join("; ").replace(/^./, c => c.toUpperCase()) + ".", text: "Each is quoted below with what it usually means. None of them proves a result is weak — they mark where the release's words and its statistics may say different things, so read those numbers yourself." };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    decodeTrial, decodeTrialRedFlags, whatItCanProve,
    classifyAllocation, classifyMasking, classifyComparator, classifyPrimaryEndpoint,
    scanPressRelease, readPressRelease, PR_PHRASES
  };
}
