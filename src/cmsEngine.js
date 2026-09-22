// ════════════════════════════════════════════════════════════════════════════
// RxNPV — CMS DRUG SPENDING (Medicare Part D / Part B)
//
// The app assumed pre-revenue. A user modelling an early-commercial name is
// asking a different question — "is this launch actually tracking?" — and had
// nothing to answer it with: the launch-curve benchmarks existed only as
// forward assumptions, with no way to check a real ramp against them.
//
// This was scoped as probably-useless because the lag was assumed to be one to
// two years. Checked against the live catalogue instead of assumed: the ANNUAL
// datasets do lag that much (2024 data as of September 2026), but CMS also
// publishes QUARTERLY Part D and Part B spending, and that was current to
// 2026 Q1, published 2026-07-23 — roughly one quarter behind. That is a
// genuinely usable read on uptake, not just an analog source, and it changed
// the scope decision.
//
// ── What this is not ──
// It is NOT revenue, and the distance is large in both directions:
//   · Medicare Part D only. No commercial, no Medicaid, no cash, no ex-US. For
//     a drug in an older population that is a large slice; for a paediatric or
//     young-adult indication it is close to nothing.
//   · GROSS spending. CMS's total is what was paid at the pharmacy counter
//     including ingredient cost, dispensing fee and sales tax, and it does not
//     net out manufacturer rebates — the same gross-to-net gap the revenue
//     model now has a control for, and it runs 25-50%.
//   · Counts below eleven are suppressed, so a small launch reads as blank
//     rather than as zero.
// The useful signal is the SHAPE and the DIRECTION — how a launch ramps
// quarter over quarter, and how that compares to what an analog did — not the
// level.
//
// Free, public, no key. CORS is open on the data API (confirmed live), so this
// is fetched directly rather than through the Electron bridge. Note the
// catalogue at data.cms.gov/data.json is NOT CORS-enabled, which is why the
// dataset ids below are pinned rather than resolved at runtime — and why the
// UI always states the most recent period it actually found, so a dataset that
// stops being updated is visible instead of silently freezing.
// ════════════════════════════════════════════════════════════════════════════

const CMS_API = "https://data.cms.gov/data-api/v1/dataset/";
const CMS_TIMEOUT_MS = 20000;

// Pinned dataset ids. CMS mints a new id per release, so these are checked at
// use time by reporting the newest period found — see CMS_STALENESS_MONTHS.
const CMS_DATASETS = {
  partDAnnual: { id: "7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b", label: "Medicare Part D Spending by Drug", shape: "annual", programme: "Part D" },
  partDQuarterly: { id: "4ff7c618-4e40-483a-b390-c8a58c94fa15", label: "Medicare Quarterly Part D Spending by Drug", shape: "quarterly", programme: "Part D" },
  partBAnnual: { id: "76a714ad-3a2c-43ac-b76d-9dadf8f7d890", label: "Medicare Part B Spending by Drug", shape: "annual", programme: "Part B" },
  partBQuarterly: { id: "bf6a5b3b-31ee-4abb-b1ad-2607a1e7510a", label: "Medicare Quarterly Part B Spending by Drug", shape: "quarterly", programme: "Part B" }
};
// If the newest period in a dataset is older than this, the pinned id has
// probably been superseded and the user is told rather than shown stale data
// as if it were current.
const CMS_STALENESS_MONTHS = 15;

async function cmsFetch(datasetId, params) {
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const qs = new URLSearchParams(params).toString();
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), CMS_TIMEOUT_MS) : null;
  let res;
  try {
    res = await fetch(CMS_API + datasetId + "/data?" + qs, ctl ? { signal: ctl.signal } : undefined);
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw new Error(e && e.name === "AbortError"
      ? "CMS did not respond within 20 seconds"
      : "Could not reach CMS: " + ((e && e.message) || "network error"));
  }
  if (timer) clearTimeout(timer);
  // A 404 here almost certainly means CMS has retired this dataset id for a
  // newer release, which is a different problem from the drug not being found.
  if (res.status === 404) throw new Error("This CMS dataset is no longer published at the address the app has for it, which usually means CMS released a new version. The data below cannot be refreshed until that is updated.");
  if (!res.ok) throw new Error("CMS API error: " + res.status + " " + res.statusText);
  return res.json();
}

function cmsNum(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,]/g, ""));
  return isFinite(n) ? n : null;
}

// The quarterly dataset writes its period as free text: "2025 (Q1-Q4)" for a
// rolling full year and "2026 (Q1)" for a partial one. Comparing a quarter to
// a year as if they were the same kind of number is the single easiest way to
// produce a fake collapse in a growing launch, so the two are told apart here
// and never plotted on the same axis without saying which is which.
function parseCmsPeriodLabel(label) {
  const t = String(label || "").trim();
  const yearMatch = /(\d{4})/.exec(t);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  const qs = (t.match(/Q([1-4])/g) || []).map(q => parseInt(q.slice(1), 10));
  let quarters;
  const range = /Q([1-4])\s*-\s*Q([1-4])/.exec(t);
  if (range) {
    quarters = [];
    for (let q = parseInt(range[1], 10); q <= parseInt(range[2], 10); q++) quarters.push(q);
  } else {
    quarters = qs.length ? qs : [1, 2, 3, 4];
  }
  return {
    label: t,
    year,
    quarters,
    quarterCount: quarters.length,
    isFullYear: quarters.length === 4,
    // Sorts a mixed set of periods chronologically by their last covered quarter.
    sortKey: year * 10 + quarters[quarters.length - 1]
  };
}

// The annual dataset is wide: one row per drug with Tot_Spndng_2020,
// Tot_Spndng_2021 ... rather than one row per year.
function parseCmsAnnualRow(row) {
  if (!row) return null;
  const years = {};
  Object.keys(row).forEach(k => {
    const m = /^(.*)_(\d{4})$/.exec(k);
    if (m) (years[m[2]] = years[m[2]] || {})[m[1]] = row[k];
  });
  const periods = Object.keys(years).sort().map(y => {
    const f = years[y];
    const spending = cmsNum(f.Tot_Spndng);
    if (spending == null) return null;   // a year before launch is blank, not zero
    return {
      label: y,
      year: parseInt(y, 10),
      quarters: [1, 2, 3, 4],
      quarterCount: 4,
      isFullYear: true,
      sortKey: parseInt(y, 10) * 10 + 4,
      source: "annual",
      spending,
      beneficiaries: cmsNum(f.Tot_Benes),
      claims: cmsNum(f.Tot_Clms),
      dosageUnits: cmsNum(f.Tot_Dsg_Unts),
      avgSpendPerBene: cmsNum(f.Avg_Spnd_Per_Bene),
      // CMS's own flag for a drug whose year-over-year change was extreme
      // enough to be excluded from its trend statistics.
      outlier: String(f.Outlier_Flag || "") === "1"
    };
  }).filter(Boolean);
  const allYears = Object.keys(years).map(y => parseInt(y, 10)).filter(isFinite).sort((a, b) => a - b);
  return {
    brand: row.Brnd_Name || "",
    generic: row.Gnrc_Name || "",
    manufacturer: row.Mftr_Name || "",
    periods,
    // The first year the DATASET covers, whether or not this drug has data in
    // it. A drug whose earliest figure is this year did not necessarily launch
    // then — the record simply does not go back far enough to say.
    dataStartYear: allYears.length ? allYears[0] : null
  };
}

function parseCmsQuarterlyRow(row) {
  const p = parseCmsPeriodLabel(row.Year);
  if (!p) return null;
  const spending = cmsNum(row.Tot_Spndng);
  if (spending == null) return null;
  return Object.assign({}, p, {
    source: "quarterly",
    spending,
    beneficiaries: cmsNum(row.Tot_Benes),
    claims: cmsNum(row.Tot_Clms),
    dosageUnits: cmsNum(row.Tot_Dsg_Unts),
    avgSpendPerBene: cmsNum(row.Avg_Spnd_Per_Bene),
    outlier: false
  });
}

// CMS appends a trailing asterisk to some brand and manufacturer names as a
// footnote marker, and — this is the part that bites — it does so
// INCONSISTENTLY BETWEEN ITS OWN DATASETS. Selexipag is "Uptravi" in the
// quarterly file and "Uptravi*" in the annual one. An exact-match filter
// therefore returns the recent quarters and silently drops the entire annual
// history, which for a launch tracker means the ramp vanishes and the plateau
// is left sitting where the ramp should be. Names are compared with the marker
// stripped, everywhere.
function cmsNormalizeName(s) {
  return cmsDisplayName(s).toLowerCase();
}

// The same strip, without the lowercasing — what to actually show a reader,
// since CMS's footnote marker is not part of the drug's name.
function cmsDisplayName(s) {
  return String(s == null ? "" : s).trim().replace(/\*+$/, "").trim();
}

// Both datasets repeat every drug once per manufacturer plus an "Overall" row
// carrying the same totals. Summing the rows would double-count every
// single-manufacturer drug exactly twice.
function pickOverallRows(rows, brandName) {
  const needle = cmsNormalizeName(brandName);
  const matching = (rows || []).filter(r => !needle || cmsNormalizeName(r.Brnd_Name) === needle);
  const overall = matching.filter(r => cmsNormalizeName(r.Mftr_Name) === "overall");
  return overall.length ? overall : matching;
}

// Two attempts, because the API filter is exact-match and CMS's own asterisk
// is part of the stored value. Cheap: the second call only happens when the
// first finds nothing.
async function cmsFetchByBrand(datasetId, brandName, size) {
  const name = String(brandName || "").trim();
  const first = await cmsFetch(datasetId, { size: String(size), "filter[Brnd_Name]": name });
  if (Array.isArray(first) && first.length) return first;
  const starred = await cmsFetch(datasetId, { size: String(size), "filter[Brnd_Name]": name + "*" });
  return Array.isArray(starred) ? starred : [];
}

// Merges the annual history with the newer quarterly periods into one ordered
// series. Where both cover the same full year the annual row wins, since it is
// the finalised one; the quarterly dataset's value for a completed year is a
// rolling figure that can still move.
function mergeDrugSpendSeries(annualPeriods, quarterlyPeriods) {
  const byKey = {};
  (quarterlyPeriods || []).forEach(p => { byKey[p.sortKey + ":" + p.quarterCount] = p; });
  (annualPeriods || []).forEach(p => { byKey[p.sortKey + ":" + p.quarterCount] = p; });
  const merged = Object.keys(byKey).map(k => byKey[k]).sort((a, b) => a.sortKey - b.sortKey);
  // Drop a rolling full-year row that duplicates a finalised annual one.
  const seenFullYears = {};
  return merged.filter(p => {
    if (!p.isFullYear) return true;
    if (seenFullYears[p.year]) return false;
    seenFullYears[p.year] = true;
    return true;
  });
}

// Year-over-year growth is only computed between two periods covering the same
// number of quarters. Comparing 2026 Q1 to 2025's full year would show a 64%
// collapse in a drug that is actually tripling, which is exactly the mistake
// this whole file is arranged to prevent.
function addComparablePeriodGrowth(series) {
  return (series || []).map((p, i) => {
    let prior = null;
    for (let j = i - 1; j >= 0; j--) {
      if (series[j].quarterCount === p.quarterCount) { prior = series[j]; break; }
    }
    const growth = (prior && prior.spending > 0) ? (p.spending / prior.spending - 1) : null;
    return Object.assign({}, p, {
      comparableTo: prior ? prior.label : null,
      growthVsComparable: growth
    });
  });
}

// An explicitly-labelled run-rate for a partial period. Offered because a
// reader wants it, and separated because it assumes the remaining quarters
// look exactly like the ones reported — no seasonality, no growth, no
// inventory effects — which for a ramping launch understates and for a
// declining one overstates.
function impliedAnnualRunRate(period) {
  if (!period || period.isFullYear || !period.quarterCount) return null;
  return period.spending * (4 / period.quarterCount);
}

// Months between the end of the newest period and now, so a pinned dataset id
// that CMS has quietly superseded shows up as stale rather than as current.
function cmsSeriesFreshness(series, now) {
  if (!series || !series.length) return null;
  const last = series[series.length - 1];
  const endMonth = last.quarters[last.quarters.length - 1] * 3;   // Q1 -> March
  const ref = now || new Date();
  const months = (ref.getFullYear() - last.year) * 12 + (ref.getMonth() + 1 - endMonth);
  return { latestPeriod: last.label, monthsBehind: months, stale: months > CMS_STALENESS_MONTHS };
}

// Re-indexes a series to "periods since the drug first appears", so two
// launches from different years can be read on the same axis.
function indexToLaunch(series, dataStartYear) {
  const nonEmpty = (series || []).filter(p => p.spending > 0);
  if (!nonEmpty.length) return [];
  const first = nonEmpty[0];
  // A drug whose first figure is the dataset's own first year was almost
  // certainly selling before that, and aligning it as if year one were its
  // launch year puts a mature drug's plateau where a new drug's ramp is. The
  // comparison is then not just imprecise but backwards, so it is flagged
  // rather than quietly drawn.
  const predates = dataStartYear != null && first.year <= dataStartYear;
  return nonEmpty.map(p => Object.assign({}, p, {
    periodsSinceFirst: p.year - first.year,
    // The first year in Medicare data is almost never a full commercial year —
    // a drug approved in March shows nine months of it — so year 1 is labelled
    // as partial rather than treated as a clean baseline.
    isFirstPeriod: p === first,
    launchPredatesData: predates
  }));
}

async function fetchDrugSpending(brandName, opts) {
  opts = opts || {};
  const name = String(brandName || "").trim();
  if (!name) return { ok: false, error: "Enter a brand name — CMS indexes by brand, not by generic or company." };
  const programme = opts.programme === "Part B" ? "B" : "D";
  const annualSet = programme === "B" ? CMS_DATASETS.partBAnnual : CMS_DATASETS.partDAnnual;
  const quarterlySet = programme === "B" ? CMS_DATASETS.partBQuarterly : CMS_DATASETS.partDQuarterly;

  try {
    const [annualRaw, quarterlyRaw] = await Promise.all([
      cmsFetchByBrand(annualSet.id, name, 20),
      cmsFetchByBrand(quarterlySet.id, name, 40)
    ]);
    const annualRows = pickOverallRows(annualRaw, name);
    const quarterlyRows = pickOverallRows(quarterlyRaw, name);
    if (!annualRows.length && !quarterlyRows.length) {
      return {
        ok: true, found: false, brand: name, programme: annualSet.programme,
        error: "No Medicare " + annualSet.programme + " record for “" + name + "”. CMS indexes by BRAND name, so try the trade name rather than the molecule. A drug with no record here is not necessarily unsold — it may be administered under the other programme (Part B covers what is given in a clinic, Part D what is dispensed by a pharmacy), used mostly outside Medicare, or below the reporting threshold."
      };
    }
    const annual = annualRows.length ? parseCmsAnnualRow(annualRows[0]) : { brand: name, generic: "", manufacturer: "", periods: [], dataStartYear: null };
    const quarterly = quarterlyRows.map(parseCmsQuarterlyRow).filter(Boolean);
    const series = addComparablePeriodGrowth(mergeDrugSpendSeries(annual.periods, quarterly));
    const latest = series.length ? series[series.length - 1] : null;
    return {
      ok: true, found: true,
      brand: cmsDisplayName(annual.brand || (quarterlyRows[0] || {}).Brnd_Name || name),
      generic: cmsDisplayName(annual.generic || (quarterlyRows[0] || {}).Gnrc_Name || ""),
      manufacturer: cmsDisplayName((quarterlyRows[0] || {}).Mftr_Name || annual.manufacturer || ""),
      programme: annualSet.programme,
      dataStartYear: annual.dataStartYear,
      series,
      latest,
      impliedAnnual: impliedAnnualRunRate(latest),
      freshness: cmsSeriesFreshness(series, opts.now),
      caveat: "Medicare " + annualSet.programme + " only, and gross of manufacturer rebates. This is not revenue and is not a fixed share of it — treat the shape and direction as the signal, never the level."
    };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fetchDrugSpending, parseCmsPeriodLabel, parseCmsAnnualRow, parseCmsQuarterlyRow,
    pickOverallRows, cmsNormalizeName, cmsDisplayName, cmsFetchByBrand, mergeDrugSpendSeries, addComparablePeriodGrowth, impliedAnnualRunRate,
    cmsSeriesFreshness, indexToLaunch, cmsNum, CMS_DATASETS, CMS_STALENESS_MONTHS
  };
}
