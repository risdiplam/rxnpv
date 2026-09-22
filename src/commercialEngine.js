// ════════════════════════════════════════════════════════════════════════════
// RxNPV — ACTUAL VERSUS MODELLED REVENUE
//
// The valuation side of this app is entirely forward-looking, which is correct
// for a pre-revenue asset and leaves a hole the moment a drug launches: there
// has never been a way to put what a company actually reported next to what
// the model said it would report. That comparison is the single most direct
// test a launch-stage thesis has, and doing it in a spreadsheet is where most
// retail models quietly stop being maintained.
//
// ── The one rule that makes this honest ──
// A partial year is never compared to a full one as though they were the same
// number. Three quarters of reported revenue against a full modelled year
// shows a 25% miss on a drug that is exactly on plan, and that mistake is easy
// to make by hand and impossible to spot afterwards. A like-for-like delta is
// computed only when four quarters have been reported; for a partial year the
// tool shows the reported figure, an explicitly-labelled implied run rate, and
// the fact that the model year is not yet complete.
//
// ── What "on plan" does and does not mean here ──
// Nothing in this file judges a launch. It reports a percentage gap against
// the user's own model, which is a statement about the model as much as about
// the drug — a launch beating a conservative model and a launch beating a
// realistic one look identical from here.
// ════════════════════════════════════════════════════════════════════════════

// An entry is one reported period: which calendar year, how many of its four
// quarters have been reported, and the revenue in dollars.
function normalizeActualEntry(entry) {
  if (!entry) return null;
  const year = parseInt(entry.year, 10);
  if (!isFinite(year) || year < 1900 || year > 2200) return null;
  let quarters = parseInt(entry.quarters, 10);
  if (!isFinite(quarters) || quarters < 1) quarters = 4;
  if (quarters > 4) quarters = 4;
  const revenueUsd = typeof entry.revenueUsd === "number" ? entry.revenueUsd : parseFloat(String(entry.revenueUsd || "").replace(/[$,]/g, ""));
  if (!isFinite(revenueUsd) || revenueUsd < 0) return null;
  return { year, quarters, revenueUsd, isFullYear: quarters === 4 };
}

// Reported revenue for a partial year, scaled to a full one. Offered because a
// reader wants it and separated because it assumes the remaining quarters look
// exactly like the reported ones — no ramp, no seasonality, no stocking — which
// for a launch in its first year understates, often badly.
function impliedAnnualFromActual(entry) {
  if (!entry || entry.isFullYear) return null;
  return entry.revenueUsd * (4 / entry.quarters);
}

// Maps the model's relative calendar (Year 0, Year 1 …) onto real years. The
// model has no notion of a calendar date — it is deliberately relative — so
// the anchor is supplied rather than guessed.
function modelYearForCalendar(calendarYear, modelYearZero) {
  const z = parseInt(modelYearZero, 10);
  if (!isFinite(z)) return null;
  return calendarYear - z;
}

// calendar: the aggregateCompanyRevenue() output, index 0 = the model's Year 0.
function compareActualToModel(calendar, actuals, modelYearZero) {
  const cal = calendar || [];
  const entries = (actuals || []).map(normalizeActualEntry).filter(Boolean)
    .sort((a, b) => a.year - b.year || a.quarters - b.quarters);

  const rows = entries.map(e => {
    const idx = modelYearForCalendar(e.year, modelYearZero);
    const modelled = (idx != null && idx >= 0 && idx < cal.length) ? cal[idx].totalRevenue : null;
    const implied = impliedAnnualFromActual(e);
    // Only a completed year is compared directly. A partial year is compared
    // on its run rate, and that comparison is labelled as resting on an
    // assumption rather than on reported numbers.
    const compareValue = e.isFullYear ? e.revenueUsd : implied;
    const delta = (modelled != null && modelled > 0 && compareValue != null)
      ? (compareValue / modelled - 1) : null;
    return {
      year: e.year,
      quarters: e.quarters,
      isFullYear: e.isFullYear,
      actualUsd: e.revenueUsd,
      impliedAnnualUsd: implied,
      modelYearIndex: idx,
      modelledUsd: modelled,
      // "Outside the model" is a real and useful answer: it means the case has
      // no projection for that year at all, usually because Year 0 is set wrong.
      outsideModel: idx == null || idx < 0 || idx >= cal.length,
      // A modelled zero in a year the drug was actually selling is not a miss
      // in the ordinary sense — the model has the launch in the wrong place.
      modelPreLaunch: modelled === 0,
      comparisonBasis: e.isFullYear ? "reported full year" : "implied run rate from " + e.quarters + " of 4 quarters",
      deltaVsModel: delta
    };
  });

  // The headline is the most recent COMPLETED year, because that is the only
  // one where both sides of the comparison are a real number.
  const completed = rows.filter(r => r.isFullYear && r.modelledUsd != null && r.modelledUsd > 0);
  const latestCompleted = completed.length ? completed[completed.length - 1] : null;

  return {
    rows,
    latestCompleted,
    // Deliberately no verdict, no "on track" badge. A gap against your own
    // model is as much a statement about the model as about the drug.
    caveat: "This measures reported revenue against your own assumptions. A launch beating a conservative model and a launch beating a realistic one look exactly the same from here, so read the gap as a prompt to revisit the inputs rather than as a score."
  };
}

// Builds the two series a chart needs, on a shared calendar axis, with the
// modelled line extended past the reported periods so the shape of what is
// still assumed stays visible next to what has actually happened.
function actualVsModelSeries(calendar, actuals, modelYearZero, opts) {
  opts = opts || {};
  const cal = calendar || [];
  const cmp = compareActualToModel(cal, actuals, modelYearZero);
  const z = parseInt(modelYearZero, 10);
  if (!isFinite(z) || !cal.length) return { modelled: [], actual: [], years: [] };
  const yearsAhead = opts.yearsAhead != null ? opts.yearsAhead : 6;
  const lastActualYear = cmp.rows.length ? cmp.rows[cmp.rows.length - 1].year : z;
  const endYear = Math.min(z + cal.length - 1, lastActualYear + yearsAhead);
  const years = [];
  for (let y = z; y <= endYear; y++) years.push(y);
  const byYear = {};
  cmp.rows.forEach(r => { byYear[r.year] = r; });
  return {
    years,
    modelled: years.map(y => ({ label: String(y), v: cal[y - z] ? cal[y - z].totalRevenue : 0 })),
    // A year with nothing reported is a gap in the line, not a zero — plotting
    // it as zero would draw a collapse that never happened.
    actual: years.map(y => {
      const r = byYear[y];
      if (!r) return { label: String(y), v: null };
      return { label: String(y), v: r.isFullYear ? r.actualUsd : r.impliedAnnualUsd, partial: !r.isFullYear };
    }),
    comparison: cmp
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeActualEntry, impliedAnnualFromActual, modelYearForCalendar,
    compareActualToModel, actualVsModelSeries
  };
}
