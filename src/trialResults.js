// ════════════════════════════════════════════════════════════════════════════
// RxNPV — TRIAL RESULTS READER
//
// The moment that matters most to an investor is the readout, and until now
// the app's answer to it was a hyperlink. ctgovEngine.js parses the protocol
// and deliberately stops at `hasResults: true` — the right call when nothing
// here could read a results section safely. The analog effect-size board
// changed that: it already reads the same schema, narrowly and with stated
// denominators, and that discipline is what this file extends.
//
// Three things get read, and nothing else:
//   1. OUTCOMES     — what the registered endpoints actually returned, with
//                     the sponsor's own registered analysis (effect size, CI,
//                     p-value, and whether it was a superiority or a
//                     non-inferiority comparison).
//   2. PARTICIPANT  — who finished and who left, by arm, with death separated
//      FLOW           out from every other reason for leaving. Differential
//                     dropout is the single most important thing a decoder
//                     structurally cannot see before results exist.
//   3. ADVERSE      — for an investigational drug this is the only real safety
//      EVENTS         data that exists anywhere. FAERS has no denominator and
//                     labels only exist after approval.
//
// The honesty rules, which are the whole reason this is safe to build:
//   · Nothing is inferred about which arm is "the drug". CT.gov does not state
//     it reliably, so groups are reported by their registered titles and any
//     difference is signed and labelled, never editorialised as good or bad.
//   · A measure reported across strata or categories is NOT collapsed into one
//     number. It says how it was reported and points at the record.
//   · Deaths are never counted as dropout. In oncology most of an arm can be
//     "not completed — death", and treating that as attrition would produce a
//     confident, meaningless 80% dropout rate.
//   · Every rate carries its own denominator, and the safety denominators are
//     the safety population, which is not the randomised population.
//   · Non-serious adverse events are subject to the sponsor's registered
//     frequency threshold, so that list is a floor, never a census.
//
// Pure functions, no network, no DOM. Unit-tested in test/math_verification.js
// against real CT.gov response shapes.
// ════════════════════════════════════════════════════════════════════════════

// CT.gov escapes a handful of characters with a backslash inside free-text
// fields ("PD-L1 \<1%"), which renders as a stray backslash if passed through.
function trUnescape(s) {
  return String(s == null ? "" : s).replace(/\\([<>&%$#_{}~^\\])/g, "$1");
}

// numSubjects / value / numAffected all arrive as STRINGS in the v2 API, and
// some are empty or "NA". Anything that isn't a finite number becomes null so
// a missing count can never be silently read as zero.
function trNum(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

function trRate(numerator, denominator) {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

// "COUNT_OF_PARTICIPANTS" -> "Count of participants". Applies to the measure's
// own paramType, which describes the point estimate (mean/median/number) and
// is a different field from an analysis's paramType (the between-group effect).
function trPretty(token) {
  const t = String(token || "").replace(/[_\s]+/g, " ").trim().toLowerCase();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Reasons for leaving a trial are free text — the v2 API registers everything
// from "Death" to "low mood and poor motivation". These three groupings are
// the ones that change how a reader should interpret the attrition.
const TR_DEATH_RE = /\b(death|died|deceased|mortality)\b/i;
const TR_AE_RE = /\b(adverse event|adverse events|ae|toxicity|side effect|tolerab)/i;
const TR_LOST_RE = /lost to follow/i;
const TR_LACK_EFFICACY_RE = /(lack of efficacy|disease progression|progressive disease|treatment failure|insufficient (therapeutic )?(response|effect))/i;
// A participant who moves from a blinded period into an open-label extension
// is registered as "not completed" for the blinded period, with a reason like
// "Participants entered open label period". They did not leave the study, and
// counting them as attrition is not a rounding error: NCT04368728 registers
// ~44,000 of them, which read as 99.8% dropout before this bucket existed.
const TR_TRANSITION_RE = /(open[- ]?label|extension|roll[- ]?over|rollover|cross(ed)?[- ]?over|transition|continued (in)?to|entered .*(period|phase|study)|moved to|next (period|phase))/i;

// ════════════════════════════════════════════════════════════════════════════
// OUTCOMES
// ════════════════════════════════════════════════════════════════════════════

// A measure's results live at classes[].categories[].measurements[]. That
// nesting exists because one registered outcome can be reported across strata
// (classes) and response categories (categories) at once — real records go up
// to 56 classes. Only the single-class/single-category case is a plain "this
// arm got this number"; anything else is reported as what it is rather than
// flattened into a headline the sponsor never claimed.
function trReadMeasurements(measurements, denomByGroup) {
  return (measurements || []).map(m => ({
    groupId: m.groupId,
    n: denomByGroup[m.groupId] != null ? denomByGroup[m.groupId] : null,
    value: trNum(m.value),
    rawValue: m.value != null ? String(m.value) : null,
    lower: trNum(m.lowerLimit),
    upper: trNum(m.upperLimit),
    spread: trNum(m.spread),
    comment: m.comment ? trUnescape(m.comment) : null
  }));
}

function parseResultOutcomes(resultsSection) {
  const measures = ((resultsSection || {}).outcomeMeasuresModule || {}).outcomeMeasures || [];
  return measures.map((m, idx) => {
    const groups = (m.groups || []).map(g => ({
      id: g.id, title: trUnescape(g.title || g.id), description: trUnescape(g.description || "")
    }));

    // denoms can carry several unit systems ("Participants", then "Events").
    // The first is the analysed population; the rest are counting something
    // else and must not be used as an n.
    const denomByGroup = {};
    const firstDenom = (m.denoms || [])[0];
    (firstDenom ? firstDenom.counts || [] : []).forEach(c => { denomByGroup[c.groupId] = trNum(c.value); });

    const classes = m.classes || [];
    const categories = classes.length === 1 ? (classes[0].categories || []) : [];
    let layout, arms = null, categoryRows = null;
    if (classes.length === 1 && categories.length === 1) {
      layout = "simple";
      arms = trReadMeasurements(categories[0].measurements, denomByGroup);
    } else if (classes.length === 1 && categories.length > 1) {
      layout = "categories";
      categoryRows = categories.map(c => ({
        title: trUnescape(c.title || ""),
        arms: trReadMeasurements(c.measurements, denomByGroup)
      }));
    } else if (classes.length > 1) {
      layout = "stratified";
    } else {
      layout = "none";
    }

    const analyses = (m.analyses || []).map(a => {
      // Reuse the analog board's effect classifier so a hazard ratio means the
      // same thing in both places. It lives in ts_ctgovEngine.js, later in the
      // concatenation order — fine, because this only runs at call time, and
      // guarded so this file still parses standalone.
      const spec = (typeof tsClassifyEffectParam === "function") ? tsClassifyEffectParam(a.paramType) : null;
      const value = trNum(a.paramValue);
      const lower = trNum(a.ciLowerLimit);
      const upper = trNum(a.ciUpperLimit);
      const crossesNull = (spec && value != null && lower != null && upper != null)
        ? (spec.nullValue >= Math.min(lower, upper) && spec.nullValue <= Math.max(lower, upper))
        : null;
      return {
        groupIds: a.groupIds || [],
        paramType: trUnescape(a.paramType || ""),
        scale: spec ? spec.scale : null,
        nullValue: spec ? spec.nullValue : null,
        value,
        lower, upper,
        ciPct: a.ciPctValue != null ? String(a.ciPctValue) : null,
        ciSides: a.ciNumSides || null,
        pValue: a.pValue != null ? String(a.pValue) : null,
        method: trUnescape(a.statisticalMethod || ""),
        // SUPERIORITY / NON_INFERIORITY / EQUIVALENCE / OTHER. Reading a
        // non-inferiority result as a superiority claim is one of the most
        // common ways a retail reader over-reads a press release, so this is
        // surfaced rather than buried.
        comparisonType: a.nonInferiorityType || null,
        nonInferiorityComment: a.nonInferiorityComment ? trUnescape(a.nonInferiorityComment) : null,
        crossesNull,
        comment: a.estimateComment ? trUnescape(a.estimateComment) : null
      };
    });

    return {
      index: idx,
      type: m.type || "",
      isPrimary: String(m.type || "").toUpperCase() === "PRIMARY",
      title: trUnescape(m.title || ""),
      description: trUnescape(m.description || ""),
      population: trUnescape(m.populationDescription || ""),
      timeFrame: trUnescape(m.timeFrame || ""),
      // "NOT_POSTED" is a real, common state: the endpoint is registered but
      // the sponsor deferred its result. Showing it as blank would read as
      // "nothing happened" rather than "this was not reported".
      posted: String(m.reportingStatus || "POSTED").toUpperCase() !== "NOT_POSTED",
      reportingStatus: m.reportingStatus || "",
      estimateType: trPretty(m.paramType),
      dispersionType: trUnescape(m.dispersionType || ""),
      unit: trUnescape(m.unitOfMeasure || ""),
      groups,
      layout,
      classCount: classes.length,
      categoryCount: categories.length,
      arms,
      categoryRows,
      analyses
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PARTICIPANT FLOW
// ════════════════════════════════════════════════════════════════════════════

// Milestone types are free text apart from three the API always uses. Anything
// else ("Safety Population", "Followed for 1 Year") is a sponsor's own
// bookkeeping step and is ignored rather than mistaken for completion.
function trMilestoneMap(period) {
  const out = {};
  (period.milestones || []).forEach(m => {
    const key = String(m.type || "").trim().toUpperCase();
    if (key !== "STARTED" && key !== "COMPLETED" && key !== "NOT COMPLETED") return;
    const byGroup = {};
    (m.achievements || []).forEach(a => { byGroup[a.groupId] = trNum(a.numSubjects); });
    out[key] = byGroup;
  });
  return out;
}

function summarizeParticipantFlow(resultsSection) {
  const pf = (resultsSection || {}).participantFlowModule;
  if (!pf) return null;
  const groups = (pf.groups || []).map(g => ({ id: g.id, title: trUnescape(g.title || g.id), description: trUnescape(g.description || "") }));

  const periods = (pf.periods || []).map(p => {
    const ms = trMilestoneMap(p);
    const started = ms["STARTED"] || {};
    const completed = ms["COMPLETED"] || {};
    const notCompleted = ms["NOT COMPLETED"] || {};

    // Bucket every registered withdrawal reason by group, and separately total
    // the ones that change how attrition should be read.
    const reasonTotals = {};   // groupId -> { deaths, adverseEvents, lostToFollowUp, lackOfEfficacy, all }
    const reasonRows = (p.dropWithdraws || []).map(w => {
      const type = trUnescape(w.type || "");
      const byGroup = {};
      (w.reasons || []).forEach(r => { byGroup[r.groupId] = trNum(r.numSubjects); });
      const bucket = TR_DEATH_RE.test(type) ? "deaths"
        : TR_TRANSITION_RE.test(type) ? "transitioned"
        : TR_AE_RE.test(type) ? "adverseEvents"
        : TR_LOST_RE.test(type) ? "lostToFollowUp"
        : TR_LACK_EFFICACY_RE.test(type) ? "lackOfEfficacy"
        : "other";
      Object.keys(byGroup).forEach(gid => {
        const n = byGroup[gid];
        if (n == null) return;
        const t = reasonTotals[gid] || (reasonTotals[gid] = { deaths: 0, transitioned: 0, adverseEvents: 0, lostToFollowUp: 0, lackOfEfficacy: 0, other: 0, all: 0 });
        t[bucket] += n;
        t.all += n;
      });
      return { type, bucket, byGroup };
    });

    // Whether a reason bucket was registered at all in this period. A sponsor
    // that never files an "Adverse Event" withdrawal row has not reported zero
    // AE withdrawals — it has reported nothing, and printing 0.0% turns a gap
    // in the record into a clean tolerability result.
    const present = { deaths: false, transitioned: false, adverseEvents: false, lostToFollowUp: false, lackOfEfficacy: false, other: false };
    reasonRows.forEach(r => { present[r.bucket] = true; });

    const rows = groups.map(g => {
      const s = started[g.id] != null ? started[g.id] : null;
      const c = completed[g.id] != null ? completed[g.id] : null;
      // Some records register STARTED and COMPLETED but not NOT COMPLETED.
      // Deriving it is arithmetic on the sponsor's own numbers, not a guess.
      let nc = notCompleted[g.id] != null ? notCompleted[g.id] : null;
      if (nc == null && s != null && c != null) nc = Math.max(0, s - c);
      const t = reasonTotals[g.id] || { deaths: 0, transitioned: 0, adverseEvents: 0, lostToFollowUp: 0, lackOfEfficacy: 0, other: 0, all: 0 };
      // The rate that actually means "people left the study". Death is a study
      // outcome in most serious indications, not attrition, and folding the two
      // together is how an oncology trial reads as 80% dropout. Moving into an
      // open-label extension is not leaving either.
      const nonDeath = (nc != null) ? Math.max(0, nc - t.deaths - t.transitioned) : null;
      return {
        groupId: g.id,
        title: g.title,
        started: s,
        completed: c,
        notCompleted: nc,
        deaths: present.deaths ? t.deaths : null,
        transitioned: present.transitioned ? t.transitioned : null,
        withdrewForAE: present.adverseEvents ? t.adverseEvents : null,
        lostToFollowUp: present.lostToFollowUp ? t.lostToFollowUp : null,
        leftForLackOfEfficacy: present.lackOfEfficacy ? t.lackOfEfficacy : null,
        nonDeathDiscontinued: nonDeath,
        completionRate: trRate(c, s),
        discontinuationRate: trRate(nc, s),
        nonDeathDiscontinuationRate: trRate(nonDeath, s),
        aeWithdrawalRate: present.adverseEvents ? trRate(t.adverseEvents, s) : null
      };
    });

    // A record spanning several periods registers ONE group list covering all
    // of them, so a group belonging to a different period shows up here with
    // nothing in it. Those rows are not "an arm where nobody enrolled" — they
    // are arms that are not part of this period at all, and leaving them in
    // fills the table with zeros and drags the flags onto empty groups.
    const active = rows.filter(r => r.started != null && r.started > 0);
    const totalStarted = rows.reduce((a, r) => a + (r.started || 0), 0);
    return {
      title: trUnescape(p.title || ""),
      rows: active.length ? active : rows,
      groupsNotInPeriod: active.length ? rows.length - active.length : 0,
      reasonRows, bucketsPresent: present, totalStarted
    };
  });

  // In a multi-period record the periods are things like screening, a run-in,
  // the randomised phase and an extension. The one worth flagging on is the
  // one most people were actually in; the rest stay visible either way.
  let primaryPeriod = null;
  periods.forEach(p => { if (!primaryPeriod || p.totalStarted > primaryPeriod.totalStarted) primaryPeriod = p; });

  return {
    preAssignmentDetails: trUnescape(pf.preAssignmentDetails || ""),
    groups,
    periods,
    primaryPeriod,
    multiPeriod: periods.length > 1
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ADVERSE EVENTS
// ════════════════════════════════════════════════════════════════════════════

function trEventRows(events, groupIds, rankIds) {
  return (events || []).map(e => {
    const byGroup = {};
    (e.stats || []).forEach(s => {
      byGroup[s.groupId] = {
        // numAffected is people; numEvents is episodes. A rate must use people
        // over people, or a single patient with six episodes becomes six.
        affected: trNum(s.numAffected),
        atRisk: trNum(s.numAtRisk),
        events: trNum(s.numEvents),
        rate: trRate(trNum(s.numAffected), trNum(s.numAtRisk))
      };
    });
    const rates = (rankIds || groupIds).map(g => (byGroup[g] ? byGroup[g].rate : null)).filter(r => r != null);
    return {
      term: trUnescape(e.term || ""),
      organSystem: trUnescape(e.organSystem || ""),
      assessmentType: e.assessmentType || "",
      byGroup,
      maxRate: rates.length ? Math.max.apply(null, rates) : null,
      // Signed as (first group − second group) and only when there are exactly
      // two groups to compare. Which of them is the drug is not stated by
      // CT.gov, so the sign is explained by the group titles, never by us
      // deciding one of them is "treatment".
      pairDiff: (groupIds.length === 2 && byGroup[groupIds[0]] && byGroup[groupIds[1]]
        && byGroup[groupIds[0]].rate != null && byGroup[groupIds[1]].rate != null)
        ? byGroup[groupIds[0]].rate - byGroup[groupIds[1]].rate : null
    };
  });
}

function summarizeAdverseEvents(resultsSection) {
  const ae = (resultsSection || {}).adverseEventsModule;
  if (!ae) return null;
  const groups = (ae.eventGroups || []).map(g => ({
    id: g.id,
    title: trUnescape(g.title || g.id),
    description: trUnescape(g.description || ""),
    serious: { affected: trNum(g.seriousNumAffected), atRisk: trNum(g.seriousNumAtRisk), rate: trRate(trNum(g.seriousNumAffected), trNum(g.seriousNumAtRisk)) },
    other: { affected: trNum(g.otherNumAffected), atRisk: trNum(g.otherNumAtRisk), rate: trRate(trNum(g.otherNumAffected), trNum(g.otherNumAtRisk)) },
    deaths: { affected: trNum(g.deathsNumAffected), atRisk: trNum(g.deathsNumAtRisk), rate: trRate(trNum(g.deathsNumAffected), trNum(g.deathsNumAtRisk)) }
  }));
  const groupIds = groups.map(g => g.id);

  // Ranking has to run over the same groups the table shows, or the top row is
  // whatever a nine-patient second-course cohort happened to report. KEYNOTE-189
  // registers five event groups, three of which are crossover and re-treatment
  // cohorts; ranking across all five put a 2-of-9 event at the top of a table
  // where every visible column read 0.0%. The groups with the largest safety
  // denominators are the randomised arms in every record checked, so ranking
  // and display both use those, in registered order.
  const denomOf = (g) => g.serious.atRisk || g.other.atRisk || g.deaths.atRisk || 0;
  const largestDenom = groups.reduce((m, g) => Math.max(m, denomOf(g)), 0);
  const primaryGroups = groups.slice()
    // A cohort an order of magnitude smaller than the main arms is a crossover
    // or re-treatment group, and its rates are built on denominators too small
    // to rank against. A genuine three- or four-arm trial has arms of similar
    // size and keeps all of them.
    .filter(g => denomOf(g) >= Math.max(1, largestDenom * 0.1))
    .sort((a, b) => denomOf(b) - denomOf(a))
    .slice(0, 4)
    .sort((a, b) => groupIds.indexOf(a.id) - groupIds.indexOf(b.id));
  const primaryIds = primaryGroups.map(g => g.id);

  const serious = trEventRows(ae.seriousEvents, groupIds, primaryIds);
  const other = trEventRows(ae.otherEvents, groupIds, primaryIds);
  const byMaxRate = (a, b) => (b.maxRate == null ? -1 : b.maxRate) - (a.maxRate == null ? -1 : a.maxRate);
  const byAbsDiff = (a, b) => Math.abs(b.pairDiff || 0) - Math.abs(a.pairDiff || 0);

  return {
    // The sponsor only has to list a non-serious event once it crosses this
    // frequency in some arm. Without saying so, a short "other events" list
    // reads as a well-tolerated drug rather than as a filtered view.
    frequencyThreshold: trNum(ae.frequencyThreshold),
    timeFrame: trUnescape(ae.timeFrame || ""),
    description: trUnescape(ae.description || ""),
    groups,
    // The subset worth putting in a table and ranking against — see above.
    primaryGroups,
    // Event groups often include crossover and extension cohorts that are not
    // the randomised arms, so a two-arm comparison is only offered when the
    // record genuinely has two.
    comparable: groups.length === 2,
    seriousEvents: serious,
    otherEvents: other,
    topSerious: serious.slice().sort(byMaxRate).slice(0, 12),
    topOther: other.slice().sort(byMaxRate).slice(0, 12),
    biggestSeriousGaps: groups.length === 2 ? serious.filter(e => e.pairDiff != null).sort(byAbsDiff).slice(0, 10) : [],
    biggestOtherGaps: groups.length === 2 ? other.filter(e => e.pairDiff != null).sort(byAbsDiff).slice(0, 10) : [],
    seriousTermCount: serious.length,
    otherTermCount: other.length
  };
}

// ════════════════════════════════════════════════════════════════════════════
// RESULTS RED FLAGS
// Separate from decodeTrialRedFlags() (which reads the registered design) and
// from computeRedFlags() (which reads the user's own modelling inputs). These
// three check different things and should not be merged.
// ════════════════════════════════════════════════════════════════════════════

const TR_DROPOUT_SPREAD_FLAG = 0.10;     // 10 percentage points between arms
const TR_HIGH_DROPOUT_FLAG = 0.20;       // 20% of an arm left, deaths excluded
const TR_AE_WITHDRAWAL_SPREAD_FLAG = 0.05;
const TR_SERIOUS_AE_SPREAD_FLAG = 0.10;

function trPct1(x) { return (x * 100).toFixed(1) + "%"; }

// Every threshold below is compared against a difference of two floating-point
// rates, and an exactly-on-the-line gap does not survive that arithmetic:
// 0.15 - 0.05 evaluates to 0.09999999999999999, so a literal `>= 0.10` silently
// declines to fire on a clean ten-point gap. The epsilon is far smaller than
// any difference these rates are reported to.
function trAtLeast(value, threshold) { return value >= threshold - 1e-9; }

function resultsRedFlags(parsed, study) {
  const flags = [];
  if (!parsed) return flags;

  // ── Endpoints registered but not reported ────────────────────────────────
  const primaries = parsed.outcomes.filter(o => o.isPrimary);
  const unreportedPrimaries = primaries.filter(o => !o.posted);
  if (unreportedPrimaries.length) {
    flags.push({
      severity: "high",
      label: unreportedPrimaries.length + " primary endpoint" + (unreportedPrimaries.length > 1 ? "s" : "") + " registered but not posted",
      detail: "The sponsor registered " + unreportedPrimaries.length + " primary outcome" + (unreportedPrimaries.length > 1 ? "s" : "")
        + " and filed the results record without reporting " + (unreportedPrimaries.length > 1 ? "them" : "it")
        + " (“" + unreportedPrimaries.map(o => o.title).slice(0, 2).join("”, “") + "”). That is a gap in the record, not a neutral result."
    });
  }
  const primariesWithAnalysis = primaries.filter(o => o.posted && o.analyses.length);
  if (primaries.length && !primariesWithAnalysis.length) {
    flags.push({
      severity: "medium",
      label: "No between-group analysis registered for the primary",
      detail: "Per-arm numbers were posted but no comparison — no effect estimate, confidence interval or p-value — was registered against the primary endpoint. Whatever the press release claimed, the size and precision of the difference is not in this record."
    });
  }

  // ── Was the primary comparison conclusive on its own terms ───────────────
  primariesWithAnalysis.forEach(o => {
    o.analyses.forEach(a => {
      if (a.crossesNull === true) {
        flags.push({
          severity: "high",
          label: "Primary interval includes no effect",
          detail: "On “" + o.title + "”, the registered " + (a.paramType || "estimate") + " of " + a.value
            + " has a " + (a.ciPct || "95") + "% interval of " + a.lower + " to " + a.upper
            + ", which spans " + a.nullValue + " — the value meaning no difference. The point estimate may still favour one arm, but this interval is consistent with no effect."
        });
      }
      if (a.comparisonType && /NON_INFERIORITY|EQUIVALENCE/.test(a.comparisonType)) {
        flags.push({
          severity: "low",
          label: "Primary comparison is " + a.comparisonType.toLowerCase().replace(/_/g, "-") + ", not superiority",
          detail: "The registered analysis on “" + o.title + "” tests whether the drug is not meaningfully worse than the comparator, within a pre-set margin. A result that passes this does not show the drug is better, and a press release describing it as a win is describing something narrower than it sounds."
        });
      }
    });
  });

  // ── Attrition ────────────────────────────────────────────────────────────
  const period = parsed.flow && parsed.flow.primaryPeriod;
  if (period) {
    const usable = period.rows.filter(r => r.started != null && r.started >= 20 && r.nonDeathDiscontinuationRate != null);
    if (usable.length >= 2) {
      const rates = usable.map(r => r.nonDeathDiscontinuationRate);
      const hi = Math.max.apply(null, rates), lo = Math.min.apply(null, rates);
      if (trAtLeast(hi - lo, TR_DROPOUT_SPREAD_FLAG)) {
        const hiRow = usable.find(r => r.nonDeathDiscontinuationRate === hi);
        const loRow = usable.find(r => r.nonDeathDiscontinuationRate === lo);
        flags.push({
          severity: "high",
          label: "Differential dropout between arms (" + trPct1(hi - lo) + " gap)",
          detail: "Excluding deaths, " + trPct1(hi) + " left “" + hiRow.title + "” against " + trPct1(lo) + " in “" + loRow.title
            + "”. When the arms lose different kinds of people at different rates, the groups being compared at the end are no longer the groups that were randomised, and randomisation stops guaranteeing what it is there to guarantee."
        });
      }
      const worst = usable.reduce((a, r) => (r.nonDeathDiscontinuationRate > a.nonDeathDiscontinuationRate ? r : a), usable[0]);
      if (trAtLeast(worst.nonDeathDiscontinuationRate, TR_HIGH_DROPOUT_FLAG)) {
        flags.push({
          severity: "medium",
          label: "High overall attrition (" + trPct1(worst.nonDeathDiscontinuationRate) + " in one arm)",
          detail: trPct1(worst.nonDeathDiscontinuationRate) + " of “" + worst.title + "” left the study for reasons other than death. At that level the analysed population depends heavily on how missing data was handled, which is a modelling choice made after the fact."
        });
      }
      const aeRates = usable.filter(r => r.aeWithdrawalRate != null).map(r => r.aeWithdrawalRate);
      if (aeRates.length >= 2) {
        const aeHi = Math.max.apply(null, aeRates), aeLo = Math.min.apply(null, aeRates);
        if (trAtLeast(aeHi - aeLo, TR_AE_WITHDRAWAL_SPREAD_FLAG)) {
          const hiRow = usable.find(r => r.aeWithdrawalRate === aeHi);
          flags.push({
            severity: "medium",
            label: "Withdrawals for adverse events differ by arm (" + trPct1(aeHi - aeLo) + ")",
            detail: "“" + hiRow.title + "” lost " + trPct1(aeHi) + " of its participants to adverse events, against " + trPct1(aeLo)
              + " in the arm that lost fewest. That is a tolerability signal and, in a blinded trial, is also a route by which patients can work out which arm they are in."
          });
        }
      }
    }
  }

  // ── Safety ───────────────────────────────────────────────────────────────
  const ae = parsed.safety;
  if (ae && ae.comparable) {
    const a = ae.groups[0], b = ae.groups[1];
    if (a.serious.rate != null && b.serious.rate != null && trAtLeast(Math.abs(a.serious.rate - b.serious.rate), TR_SERIOUS_AE_SPREAD_FLAG)) {
      const higher = a.serious.rate > b.serious.rate ? a : b, lower = a.serious.rate > b.serious.rate ? b : a;
      flags.push({
        severity: "medium",
        label: "Serious adverse events differ by " + trPct1(Math.abs(a.serious.rate - b.serious.rate)) + " between arms",
        detail: trPct1(higher.serious.rate) + " of “" + higher.title + "” had a serious adverse event, against " + trPct1(lower.serious.rate)
          + " in “" + lower.title + "”. Read which arm is which from the titles — CT.gov does not label one of them as the investigational arm."
      });
    }
    if (a.deaths.rate != null && b.deaths.rate != null && trAtLeast(Math.abs(a.deaths.rate - b.deaths.rate), 0.02)) {
      const higher = a.deaths.rate > b.deaths.rate ? a : b, lower = a.deaths.rate > b.deaths.rate ? b : a;
      flags.push({
        severity: "medium",
        label: "All-cause deaths differ between arms",
        detail: trPct1(higher.deaths.rate) + " in “" + higher.title + "” against " + trPct1(lower.deaths.rate) + " in “" + lower.title
          + "”. These are all deaths recorded in the safety window, not deaths attributed to the drug, and in a serious indication the disease itself is usually the main cause."
      });
    }
  }

  // ── Reporting behaviour ──────────────────────────────────────────────────
  // FDAAA 801 requires results within a year of primary completion for most
  // applicable trials. A long gap is a fact about the sponsor, not the drug,
  // but it is a fact worth having.
  if (study && study.primaryCompletionDate && study.resultsFirstPostDate) {
    const months = trMonthsBetweenDates(study.primaryCompletionDate, study.resultsFirstPostDate);
    if (months != null && months > 15) {
      flags.push({
        severity: "low",
        label: "Results posted " + Math.round(months) + " months after primary completion",
        detail: "Primary completion was " + study.primaryCompletionDate + " and results were first posted " + study.resultsFirstPostDate
          + ". The statutory expectation for most applicable trials is within twelve months. Delay on its own says nothing about the result, but it is part of how a sponsor behaves with its own data."
      });
    }
  }

  // A master protocol registers the same analysis shape across dozens of
  // sub-studies, so the same flag can be raised 60 times from one record. One
  // statement of a problem is the useful form of it.
  const seen = {};
  return flags.filter(f => (seen[f.label] ? false : (seen[f.label] = true)));
}

// CT.gov dates can be "YYYY-MM" with no day, which Date.parse handles
// inconsistently across engines — so parse the parts explicitly.
function trMonthsBetweenDates(startStr, endStr) {
  const parse = (s) => {
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(String(s || ""));
    return m ? { y: parseInt(m[1], 10), m: m[2] ? parseInt(m[2], 10) - 1 : 0 } : null;
  };
  const a = parse(startStr), b = parse(endStr);
  if (!a || !b) return null;
  return (b.y - a.y) * 12 + (b.m - a.m);
}

// ════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — takes the RAW v2 study object (not the parsed protocol shape)
// ════════════════════════════════════════════════════════════════════════════
function parseTrialResults(rawStudy) {
  const rs = rawStudy && rawStudy.resultsSection;
  if (!rs) return null;
  const outcomes = parseResultOutcomes(rs);
  const parsed = {
    outcomes,
    primaryOutcomes: outcomes.filter(o => o.isPrimary),
    secondaryOutcomes: outcomes.filter(o => String(o.type || "").toUpperCase() === "SECONDARY"),
    flow: summarizeParticipantFlow(rs),
    safety: summarizeAdverseEvents(rs),
    // The sponsor's own registered statement of what this dataset cannot
    // support. It is the one caveat in the record written by the people who
    // ran the trial, and it is routinely more candid than the press release.
    limitations: trUnescape(((rs.moreInfoModule || {}).limitationsAndCaveats || {}).description || ""),
    // Whether the sponsor retains a right to review or delay investigator
    // publication — context for how quickly independent analysis will appear.
    agreementRestriction: trUnescape(((rs.moreInfoModule || {}).certainAgreement || {}).restrictionType || "")
  };
  return parsed;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseTrialResults, parseResultOutcomes, summarizeParticipantFlow, summarizeAdverseEvents,
    resultsRedFlags, trUnescape, trNum, trRate, trMonthsBetweenDates
  };
}
