// ════════════════════════════════════════════════════════════════════════════
// RxNPV — CMS DRUG SPENDING (Medicare Part D / Part B, and Medicaid)
//
// Medicaid joined in October 2026 (see "Medicaid" further down): Medicare is
// close to empty for a children's drug, and rare-disease investing is full of
// them.
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
//   · Public payers only. No commercial insurance, no cash, no ex-US. Medicare
//     is a large slice for a drug in an older population and close to nothing
//     for a paediatric one; Medicaid (below) covers much of that gap, and
//     commercial insurance is in neither.
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
  partBQuarterly: { id: "bf6a5b3b-31ee-4abb-b1ad-2607a1e7510a", label: "Medicare Quarterly Part B Spending by Drug", shape: "quarterly", programme: "Part B" },
  // CMS's own annual Medicaid summary, on the same API as Medicare's. It is
  // built from the state file below but totalled before CMS hides small
  // counts, so a one-dose gene therapy that is blank in every quarter of the
  // state file has its full yearly spend here.
  medicaidAnnual: { id: "be64fce3-e835-4589-b46b-024198e524a6", label: "Medicaid Spending by Drug", shape: "annual", programme: "Medicaid" }
};
// If the newest period in a dataset is older than this, the pinned id has
// probably been superseded and the user is told rather than shown stale data
// as if it were current.
const CMS_STALENESS_MONTHS = 15;

async function cmsFetch(datasetId, params) {
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const qs = new URLSearchParams(params).toString();
  const res = await resilientFetch(CMS_API + datasetId + "/data?" + qs, { timeoutMs: CMS_TIMEOUT_MS, label: "CMS" });
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
      // Part B spells its averages "Spndng" where Part D and Medicaid write
      // "Spnd" — reading only the one spelling left every Part B year's
      // spend per patient blank (found October 2026).
      avgSpendPerBene: cmsNum(f.Avg_Spnd_Per_Bene != null ? f.Avg_Spnd_Per_Bene : f.Avg_Spndng_Per_Bene),
      avgSpendPerClaim: cmsNum(f.Avg_Spnd_Per_Clm != null ? f.Avg_Spnd_Per_Clm : f.Avg_Spndng_Per_Clm),
      avgSpendPerUnit: cmsNum(f.Avg_Spnd_Per_Dsg_Unt_Wghtd != null ? f.Avg_Spnd_Per_Dsg_Unt_Wghtd : f.Avg_Spndng_Per_Dsg_Unt),
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
    dataStartYear: allYears.length ? allYears[0] : null,
    // The last year the dataset covers — where a newer source has to take over.
    dataEndYear: allYears.length ? allYears[allYears.length - 1] : null
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
    avgSpendPerClaim: cmsNum(row.Avg_Spnd_Per_Clm),
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
  // Compared on drugNameKey, so "Exondys-51" (CMS's Medicaid file) is the
  // same drug as "Exondys 51" (the FDA) — see drugNameKey below.
  const needle = drugNameKey(brandName);
  const matching = (rows || []).filter(r => !needle || drugNameKey(r.Brnd_Name) === needle);
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
// The closest published launch curve to an analog's Medicare uptake (October
// 2026): its full years, as a share of the highest, against the median /
// slow / fast curves for its years to peak (Robey & David, the curves the
// revenue build already uses). A shape, not a level — dollars never move.
// Null with a reason when the analog was selling before the data begins, or
// has fewer than three full years; stillRising when its last year is its
// highest (years to peak is then a lower bound).
function matchLaunchShape(points) {
  const pts = (points || []).filter(p => p && p.spending > 0);
  if (!pts.length) return { ok: false, reason: "no spending to read" };
  if (pts[0].launchPredatesData) return { ok: false, reason: "already selling before the data starts, so its early years are not a launch" };
  const vals = pts.filter(p => p.isFullYear !== false).sort((a, b) => a.periodsSinceFirst - b.periodsSinceFirst).map(p => p.spending);
  if (vals.length < 3) return { ok: false, reason: "fewer than three full years of spending" };
  let peakIdx = 0; vals.forEach((v, i) => { if (v > vals[peakIdx]) peakIdx = i; });
  const stillRising = peakIdx === vals.length - 1;
  const yearsToPeak = Math.max(1, peakIdx + 1);
  const pct = vals.slice(0, yearsToPeak).map(v => v / vals[peakIdx] * 100);
  let best = null;
  [["median", "median"], ["p25", "slow (25th percentile)"], ["p75", "fast (75th percentile)"]].forEach(([profile, label]) => {
    const curve = launchCurveForYears(yearsToPeak, profile);
    const sse = pct.reduce((a, v, i) => a + Math.pow(v - curve[i], 2), 0);
    if (!best || sse < best.sse) best = { profile, label, sse, curve };
  });
  return { ok: true, yearsToPeak, profile: best.profile, profileLabel: best.label, rmse: Math.sqrt(best.sse / pct.length), pct, stillRising, fullYears: vals.length };
}

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

// Several rows for one period (Part B lists a drug once per billing code,
// and a drug can have two) become one: spending, claims and units add up.
// Patients do not — one patient can sit under both codes — so a summed
// period carries no patient count and no spend per patient rather than an
// overstated one.
function combineSamePeriods(periods) {
  const byLabel = {};
  const order = [];
  (periods || []).forEach(p => {
    if (!p) return;
    const k = p.sortKey + ":" + p.quarterCount;
    if (!byLabel[k]) { byLabel[k] = Object.assign({}, p, { codes: 1 }); order.push(k); return; }
    const a = byLabel[k];
    const add = (x, y) => (x == null && y == null) ? null : (x || 0) + (y || 0);
    a.spending = add(a.spending, p.spending);
    a.claims = add(a.claims, p.claims);
    a.dosageUnits = add(a.dosageUnits, p.dosageUnits);
    a.codes += 1;
    a.beneficiaries = null;
    a.avgSpendPerBene = null;
    a.avgSpendPerUnit = null;
    a.avgSpendPerClaim = (a.claims > 0 && a.spending != null) ? a.spending / a.claims : null;
    a.outlier = a.outlier || p.outlier;
  });
  return order.map(k => byLabel[k]).sort((x, y) => x.sortKey - y.sortKey);
}

// The annual file's rows for one drug (one, unless Part B lists it under
// several codes), parsed and combined.
function parseCmsAnnualRows(rows) {
  const parsed = (rows || []).map(parseCmsAnnualRow).filter(Boolean);
  if (!parsed.length) return null;
  const first = parsed[0];
  return Object.assign({}, first, {
    periods: combineSamePeriods([].concat.apply([], parsed.map(x => x.periods))),
    dataStartYear: parsed.some(x => x.dataStartYear != null) ? Math.min.apply(null, parsed.map(x => x.dataStartYear).filter(v => v != null)) : null,
    dataEndYear: parsed.some(x => x.dataEndYear != null) ? Math.max.apply(null, parsed.map(x => x.dataEndYear).filter(v => v != null)) : null,
    codes: parsed.length
  });
}

// ── One drug, several spellings (October 2026) ──
// The same drug is "Exondys 51" at the FDA, "Exondys-51" in CMS's Medicaid
// summary and "EXONDYS 51" — cut to ten characters — in the state file. An
// exact name filter found Sarepta's PMOs in none of CMS's summaries, so names
// are compared with everything but letters and digits stripped, and every
// source is searched by the FDA's generic name when the brand finds nothing.
function drugNameKey(s) {
  return cmsDisplayName(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// FDA's NDC directory writes a product as "60923-284" (labeler-product, in
// one of three widths); the state file writes the 11-digit form, 5-4-2, zero
// padded: labeler "60923", product "0284".
function ndcProductCodes(productNdc) {
  const m = /^(\d{4,5})-(\d{3,4})$/.exec(String(productNdc || "").trim());
  if (!m) return null;
  return { labeler: m[1].padStart(5, "0"), product: m[2].padStart(4, "0") };
}

// Which drug the user meant, from the FDA directory's rows. A generic name
// with several brands behind it is never resolved to one of them — not even
// to an unbranded biosimilar sold under the generic's own name ("adalimumab"
// is a brand too, which once made a search for the molecule return a single
// biosimilar): the brands are offered as candidates. Otherwise the brand
// typed, else the one brand of the generic typed, else the only brand found.
function pickDrugIdentity(query, ndcRows) {
  const q = String(query || "").trim();
  const key = drugNameKey(q);
  const groups = {};
  (ndcRows || []).forEach(r => {
    const brand = String((r && r.brand_name) || "").trim();
    if (!brand) return;
    const k = drugNameKey(brand);
    const g = groups[k] = groups[k] || { brand, generic: String(r.generic_name || "").trim(), products: [] };
    const codes = ndcProductCodes(r.product_ndc);
    if (codes && !g.products.some(x => x.labeler === codes.labeler && x.product === codes.product)) g.products.push(codes);
  });
  const list = Object.keys(groups).map(k => groups[k]);
  // Brands whose generic is the name typed (a biosimilar's suffix allowed:
  // "adalimumab-adaz" is adalimumab).
  const byGeneric = key ? list.filter(g => drugNameKey(g.generic).indexOf(key) === 0) : [];
  let chosen = null, matchedBy = null;
  if (byGeneric.length > 1) { chosen = null; }
  else if (groups[key]) { chosen = groups[key]; matchedBy = "brand"; }
  else if (byGeneric.length === 1) { chosen = byGeneric[0]; matchedBy = "generic"; }
  else if (!byGeneric.length && list.length === 1) { chosen = list[0]; matchedBy = "partial"; }
  const pool = chosen ? [] : (byGeneric.length ? byGeneric : list);
  return {
    query: q,
    brand: chosen ? chosen.brand : null,
    generic: chosen ? chosen.generic : (byGeneric[0] ? byGeneric[0].generic : ""),
    products: chosen ? chosen.products : [],
    matchedBy,
    candidates: pool.slice(0, 8).map(g => ({ brand: g.brand, generic: g.generic }))
  };
}

const FDA_NDC_API = "https://api.fda.gov/drug/ndc.json";
async function resolveDrugIdentity(query) {
  const q = String(query || "").trim();
  const phrase = q.replace(/"/g, "");
  try {
    const url = FDA_NDC_API + "?search=" + encodeURIComponent('brand_name:"' + phrase + '" generic_name:"' + phrase + '"') + "&limit=100";
    const data = await fdaFetch(url);
    return pickDrugIdentity(q, data.results || []);
  } catch (e) {
    const none = pickDrugIdentity(q, []);
    // openFDA answers 404 for "no matches"; anything else means it could not
    // be asked, and the lookup carries on by name alone and says so.
    if (!/404/.test(String(e.message))) none.unreachable = true;
    return none;
  }
}

function uniqueNames(list) {
  const seen = {};
  return (list || []).map(n => String(n || "").trim()).filter(n => {
    const k = drugNameKey(n);
    if (!n || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

// Finds one drug's rows in a CMS dataset: by each name (with CMS's asterisk
// fallback), then by the generic name, keeping only rows whose brand is the
// same drug. Never guesses between two brands of one generic.
async function cmsFindDrugRows(datasetId, names, generic, size) {
  for (let i = 0; i < names.length; i++) {
    const rows = await cmsFetchByBrand(datasetId, names[i], size);
    if (rows.length) return { rows, matchedBy: "name", matchedName: names[i] };
  }
  if (generic) {
    const keys = names.map(drugNameKey);
    let rows = await cmsFetch(datasetId, { size: String(Math.max(size, 50)), "filter[Gnrc_Name]": generic });
    if (!Array.isArray(rows) || !rows.length) rows = await cmsFetch(datasetId, { size: String(Math.max(size, 50)), "filter[Gnrc_Name]": generic + "*" });
    const hit = (Array.isArray(rows) ? rows : []).filter(r => keys.indexOf(drugNameKey(r.Brnd_Name)) >= 0);
    if (hit.length) return { rows: hit, matchedBy: "generic", matchedName: cmsDisplayName(hit[0].Brnd_Name) };
  }
  return { rows: [], matchedBy: null, matchedName: null };
}

async function fetchDrugSpending(brandName, opts) {
  opts = opts || {};
  const name = String(brandName || "").trim();
  if (!name) return { ok: false, error: "Enter a brand name — CMS indexes by brand, not by generic or company." };
  const programme = opts.programme === "Part B" || opts.programme === "B" ? "B" : "D";
  const annualSet = programme === "B" ? CMS_DATASETS.partBAnnual : CMS_DATASETS.partDAnnual;
  const quarterlySet = programme === "B" ? CMS_DATASETS.partBQuarterly : CMS_DATASETS.partDQuarterly;

  try {
    const identity = opts.identity || null;
    const names = uniqueNames([name, identity && identity.brand]);
    const generic = identity && identity.generic;
    const [annualFound, quarterlyFound] = await Promise.all([
      cmsFindDrugRows(annualSet.id, names, generic, 20),
      cmsFindDrugRows(quarterlySet.id, names, generic, 40)
    ]);
    const annualRows = pickOverallRows(annualFound.rows, annualFound.matchedName || name);
    const quarterlyRows = pickOverallRows(quarterlyFound.rows, quarterlyFound.matchedName || name);
    if (!annualRows.length && !quarterlyRows.length) {
      return {
        ok: true, found: false, brand: name, programme: annualSet.programme,
        candidates: identity ? identity.candidates : [],
        error: "No Medicare " + annualSet.programme + " record for “" + name + "”. CMS indexes by BRAND name, so try the trade name rather than the molecule. A drug with no record here is not necessarily unsold — it may be administered under the other program (Part B covers what is given in a clinic, Part D what is dispensed by a pharmacy), used mostly outside Medicare, or below the reporting threshold."
      };
    }
    const annual = annualRows.length ? parseCmsAnnualRows(annualRows) : { brand: name, generic: "", manufacturer: "", periods: [], dataStartYear: null, dataEndYear: null };
    const quarterly = combineSamePeriods(quarterlyRows.map(parseCmsQuarterlyRow).filter(Boolean));
    const series = addComparablePeriodGrowth(mergeDrugSpendSeries(annual.periods, quarterly));
    const latest = series.length ? series[series.length - 1] : null;
    const codes = Math.max(annual.codes || 1, new Set(quarterlyRows.map(r => r.HCPCS_Cd || "")).size || 1);
    return {
      ok: true, found: true,
      brand: cmsDisplayName(annual.brand || (quarterlyRows[0] || {}).Brnd_Name || name),
      generic: cmsDisplayName(annual.generic || (quarterlyRows[0] || {}).Gnrc_Name || ""),
      manufacturer: cmsDisplayName((quarterlyRows[0] || {}).Mftr_Name || annual.manufacturer || ""),
      programme: annualSet.programme,
      dataStartYear: annual.dataStartYear,
      matchedBy: annualFound.matchedBy || quarterlyFound.matchedBy,
      billingCodes: codes,
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

// ── Medicaid (October 2026) ──
// Two sources, both free and both open to the app directly:
//   · CMS's annual "Medicaid Spending by Drug" (above, same API as Medicare):
//     whole years, totalled before small counts are hidden, about 18 months
//     behind (2024 as of October 2026). Claims, never patients.
//   · The State Drug Utilization Data on data.medicaid.gov: every state, fee
//     for service and managed care, one file per year, each quarter published
//     about three months after it ends (2026 Q1 was out by July). It has a
//     national row per package (state "XX"), so the app never adds up states.
// The state file takes over for the years after the annual one ends. What it
// does that bites:
//   · It hides any figure under eleven prescriptions — per package, per
//     quarter, per channel — and a hidden figure comes back BLANK, not zero.
//     A one-dose gene therapy sold in a dozen weight-based kits is hidden in
//     every quarter (Zolgensma, Elevidys) though the annual file has it. A
//     quarter with some packages hidden is a floor ("at least"); one with all
//     of them hidden is "hidden", never $0.
//   · It writes the drug's name cut to ten characters ("EVRYSDI (r"), so it
//     is matched by the FDA's package codes, and by name only when the FDA's
//     directory has none (and the panel says which).
//   · Its amounts are what the pharmacy or clinic was paid, before the
//     manufacturer's Medicaid rebate (at least 23.1% of list for a brand,
//     often far more). Uptake, not revenue — as for Medicare.
// Where both files cover a year they agree within a few percent (Evrysdi
// 2024: $345.3M in the annual file, $346.9M in the state file) — the annual
// one is CMS's cleaned summary.
const MEDICAID_API = "https://data.medicaid.gov/api/1/";
const SDUD_DATASETS = {
  2020: "cc318bfb-a9b2-55f3-a924-d47376b32ea3", 2021: "eec7fbe6-c4c4-5915-b3d0-be5828ef4e9d",
  2022: "200c2cba-e58d-4a95-aa60-14b99736808d", 2023: "d890d3a9-6b00-43fd-8b31-fcba4c8e2909",
  2024: "61729e5a-7aa8-448c-8903-ba3e0cd0ea3c", 2025: "158a1baa-5506-400a-8ec3-97756f0b0536",
  2026: "2957a7f9-9a15-453e-9afd-3bbdcbac8fd3"
};
const sdudLookups = { ids: {}, latestQuarter: {} };

async function medicaidFetch(path) {
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const res = await resilientFetch(MEDICAID_API + path, { timeoutMs: 30000, label: "Medicaid" });
  if (!res.ok) throw new Error("Medicaid API error: " + res.status + " " + res.statusText);
  return res.json();
}

function sdudQueryString(conditions, extra) {
  const p = new URLSearchParams();
  (conditions || []).forEach((c, i) => {
    p.append("conditions[" + i + "][property]", c.property);
    if (Array.isArray(c.value)) c.value.forEach(v => p.append("conditions[" + i + "][value][]", v));
    else p.append("conditions[" + i + "][value]", c.value);
    if (c.operator) p.append("conditions[" + i + "][operator]", c.operator);
  });
  Object.keys(extra || {}).forEach(k => p.append(k, extra[k]));
  return p.toString();
}

// A year's file: pinned for the years that exist, looked up by title for a
// newer one (CMS mints a new file each year).
async function sdudDatasetId(year) {
  if (SDUD_DATASETS[year]) return SDUD_DATASETS[year];
  if (Object.prototype.hasOwnProperty.call(sdudLookups.ids, year)) return sdudLookups.ids[year];
  let id = null;
  try {
    const title = "State Drug Utilization Data " + year;
    const r = await medicaidFetch("search?" + new URLSearchParams({ fulltext: title, "page-size": "10" }).toString());
    const items = r && r.results ? (Array.isArray(r.results) ? r.results : Object.keys(r.results).map(k => r.results[k])) : [];
    const hit = items.find(x => String(x.title || "").trim() === title);
    id = hit ? hit.identifier : null;
  } catch (e) { id = null; }
  sdudLookups.ids[year] = id;
  return id;
}

// The newest quarter a year's file holds, so a quarter with no rows for a
// drug reads as "no prescriptions" only once it has been published.
async function sdudLatestQuarter(datasetId) {
  if (sdudLookups.latestQuarter[datasetId] != null) return sdudLookups.latestQuarter[datasetId];
  const r = await medicaidFetch("datastore/query/" + datasetId + "/0?" + sdudQueryString([], {
    "sorts[0][property]": "quarter", "sorts[0][order]": "desc", limit: "1", "properties[]": "quarter", count: "false", schema: "false" }));
  const q = r && r.results && r.results[0] ? parseInt(r.results[0].quarter, 10) : 0;
  sdudLookups.latestQuarter[datasetId] = q || 0;
  return q || 0;
}

// The state file's name, as it writes it: upper case, ten characters, and
// the brand followed by anything but another letter ("EVRYSDI (r" is
// Evrysdi; "XYZAL" is not "Xyz").
function sdudNameMatches(productName, brand) {
  const norm = v => String(v || "").toUpperCase().replace(/[-\s]+/g, " ").trim();
  const pn = norm(productName), b = norm(brand).slice(0, 10);
  if (!b || pn.indexOf(b) !== 0) return false;
  if (b.length >= 10) return true;
  const next = pn.charAt(b.length);
  return !next || !/[A-Z]/.test(next);
}

async function fetchSdudYear(year, identity, name) {
  const id = await sdudDatasetId(year);
  if (!id) return { year, available: false, rows: [] };
  const latestQuarter = await sdudLatestQuarter(id);
  const products = (identity && identity.products) || [];
  const pageAll = async (conditions) => {
    const out = [];
    for (let page = 0; page < 6; page++) {
      const r = await medicaidFetch("datastore/query/" + id + "/0?" + sdudQueryString(conditions, { limit: "500", offset: String(page * 500), count: "false", schema: "false" }));
      const rows = (r && r.results) || [];
      out.push.apply(out, rows);
      if (rows.length < 500) break;
    }
    return out;
  };
  let rows = [], matchedBy;
  if (products.length) {
    matchedBy = "package codes";
    const byLabeler = {};
    products.forEach(x => { (byLabeler[x.labeler] = byLabeler[x.labeler] || []).push(x.product); });
    for (const lab of Object.keys(byLabeler)) {
      rows = rows.concat(await pageAll([
        { property: "labeler_code", value: lab },
        { property: "product_code", value: byLabeler[lab], operator: "IN" },
        { property: "state", value: "XX" }
      ]));
    }
  } else {
    matchedBy = "name";
    const brand = String(name || "").toUpperCase().replace(/[-\s]+/g, " ").trim().slice(0, 10);
    rows = (await pageAll([
      { property: "product_name", value: brand + "%", operator: "LIKE" },
      { property: "state", value: "XX" }
    ])).filter(r => sdudNameMatches(r.product_name, name));
  }
  return { year, available: true, latestQuarter, matchedBy, rows };
}

// One year's national rows → a figure per quarter. Hidden rows are counted,
// never read as zero.
function summariseSdudQuarters(rows, year) {
  const byQ = {};
  (rows || []).forEach(r => {
    if (r.state != null && String(r.state).toUpperCase() !== "XX") return;
    const q = parseInt(r.quarter, 10);
    if (!(q >= 1 && q <= 4)) return;
    const b = byQ[q] = byQ[q] || { year, quarter: q, spending: 0, prescriptions: 0, units: 0, rows: 0, hiddenRows: 0 };
    b.rows++;
    const spend = cmsNum(r.total_amount_reimbursed);
    if (String(r.suppression_used).toLowerCase() === "true" || spend == null) { b.hiddenRows++; return; }
    b.spending += spend;
    b.prescriptions += cmsNum(r.number_of_prescriptions) || 0;
    b.units += cmsNum(r.units_reimbursed) || 0;
  });
  return Object.keys(byQ).map(Number).sort((a, b) => a - b).map(q => {
    const b = byQ[q];
    b.status = b.hiddenRows === 0 ? "complete" : b.hiddenRows === b.rows ? "hidden" : "partial";
    if (b.status === "hidden") { b.spending = null; b.prescriptions = null; b.units = null; }
    return b;
  });
}

// A year of the state file as one period in the same shape as Medicare's:
// the whole year once four quarters are out, else the year so far. A
// published quarter with no rows is no prescriptions (0); a hidden one makes
// the period a floor, or hidden if nothing in it can be read.
function sdudPeriod(quarters, year, latestQuarter) {
  const n = Math.max(0, Math.min(4, latestQuarter || 0));
  if (!n) return null;
  const inRange = (quarters || []).filter(q => q.quarter <= n);
  if (!inRange.length) return null;
  const visible = inRange.filter(q => q.status !== "hidden");
  const hidden = visible.length === 0;
  const floor = !hidden && inRange.some(q => q.status !== "complete");
  const spending = hidden ? null : visible.reduce((a, q) => a + q.spending, 0);
  const prescriptions = hidden ? null : visible.reduce((a, q) => a + q.prescriptions, 0);
  const qs = [];
  for (let q = 1; q <= n; q++) qs.push(q);
  return {
    label: n === 4 ? String(year) : year + " (Q1" + (n > 1 ? "-Q" + n : "") + ")",
    year, quarters: qs, quarterCount: n, isFullYear: n === 4, sortKey: year * 10 + n,
    source: "state file",
    spending, claims: prescriptions, dosageUnits: hidden ? null : visible.reduce((a, q) => a + q.units, 0),
    beneficiaries: null, avgSpendPerBene: null,
    avgSpendPerClaim: (!floor && !hidden && prescriptions > 0) ? spending / prescriptions : null,
    hidden, floor,
    hiddenRows: inRange.reduce((a, q) => a + q.hiddenRows, 0),
    quarterDetail: inRange,
    outlier: false
  };
}

// Growth that skips a hidden or floor period: comparing a floor to a full
// figure would read as a fall that is only CMS's privacy rule.
function addComparableMedicaidGrowth(series) {
  return (series || []).map((p, i) => {
    let prior = null;
    for (let j = i - 1; j >= 0; j--) {
      if (series[j].quarterCount === p.quarterCount) { prior = series[j]; break; }
    }
    const usable = x => x && !x.hidden && !x.floor && x.spending > 0;
    const growth = (usable(prior) && p && !p.hidden && !p.floor && p.spending != null) ? (p.spending / prior.spending - 1) : null;
    return Object.assign({}, p, { comparableTo: prior ? prior.label : null, growthVsComparable: growth });
  });
}

async function fetchMedicaidSpending(brandName, opts) {
  opts = opts || {};
  const name = String(brandName || "").trim();
  if (!name) return { ok: false, error: "Enter a brand or generic name." };
  try {
    const identity = opts.identity || await resolveDrugIdentity(name);
    const names = uniqueNames([name, identity && identity.brand]);
    const generic = identity && identity.generic;
    const found = await cmsFindDrugRows(CMS_DATASETS.medicaidAnnual.id, names, generic, 20);
    const annualRows = pickOverallRows(found.rows, found.matchedName || name);
    const annual = annualRows.length ? parseCmsAnnualRows(annualRows) : null;
    const nowYear = (opts.now || new Date()).getFullYear();
    // After the annual file's last year; without it, the last three years.
    const fromYear = annual && annual.dataEndYear != null && isFinite(annual.dataEndYear) ? annual.dataEndYear + 1 : nowYear - 3;
    const years = [];
    for (let y = fromYear; y <= nowYear; y++) years.push(y);
    const stateYears = await Promise.all(years.map(y =>
      fetchSdudYear(y, identity, (identity && identity.brand) || name).catch(e => ({ year: y, available: true, error: e.message, rows: [] }))));
    const statePeriods = stateYears.map(sy => sy.error || !sy.available ? null : sdudPeriod(summariseSdudQuarters(sy.rows, sy.year), sy.year, sy.latestQuarter)).filter(Boolean);
    const stateHasRows = stateYears.some(sy => sy.rows && sy.rows.length);
    if (!annual && !stateHasRows) {
      const errors = stateYears.filter(sy => sy.error);
      if (errors.length === stateYears.length && errors.length) return { ok: false, unreachable: true, error: errors[0].error };
      return {
        ok: true, found: false, brand: name, programme: "Medicaid",
        candidates: identity ? identity.candidates : [],
        error: "No Medicaid record for “" + name + "”. Try the trade name, or the generic name — the FDA's directory is used to find the drug under either. A drug with no record may not be covered by Medicaid yet, or may be given only in hospital (inpatient drugs are paid inside the hospital's fee and never appear)."
      };
    }
    const series = addComparableMedicaidGrowth((annual ? annual.periods : []).concat(statePeriods.filter(p => p.spending != null || p.hidden)).sort((a, b) => a.sortKey - b.sortKey));
    const visible = series.filter(p => !p.hidden);
    const latest = series.length ? series[series.length - 1] : null;
    return {
      ok: true, found: true,
      brand: cmsDisplayName((annual && annual.brand) || (identity && identity.brand) || name),
      generic: cmsDisplayName((annual && annual.generic) || (identity && identity.generic) || ""),
      programme: "Medicaid",
      dataStartYear: annual ? annual.dataStartYear : (statePeriods[0] ? statePeriods[0].year : null),
      matchedBy: found.matchedBy,
      stateFile: {
        matchedBy: (stateYears.find(sy => sy.matchedBy) || {}).matchedBy || null,
        products: identity && identity.products ? identity.products.length : 0,
        years: stateYears.map(sy => ({ year: sy.year, available: sy.available, latestQuarter: sy.latestQuarter || 0, rows: (sy.rows || []).length, error: sy.error || null }))
      },
      series,
      latest,
      impliedAnnual: latest && !latest.hidden && !latest.floor ? impliedAnnualRunRate(latest) : null,
      freshness: cmsSeriesFreshness(visible.length ? visible : series, opts.now),
      caveat: "Medicaid only — fee for service and managed care, every state — and before the manufacturer's Medicaid rebate (at least 23.1% of list for a brand drug). Prescriptions, not patients. Not revenue: read the shape and direction."
    };
  } catch (e) {
    return { ok: false, unreachable: true, error: e.message };
  }
}

// ── All public payers ──
const PAYER_SOURCES = [
  { key: "partD", label: "Medicare Part D" },
  { key: "partB", label: "Medicare Part B" },
  { key: "medicaid", label: "Medicaid" }
];

function payerPeriodKey(p) {
  return p.year + ":" + p.quarterCount + ":" + p.quarters[p.quarters.length - 1];
}

// One row per period across the sources that have the drug. A source whose
// newest figure is older than a row has none for it — not published yet, or
// too few claims to report, and the app cannot tell which — so that row's
// total is incomplete: a floor, never a fall. A source whose record starts
// later than a row simply had no spending then (0). Growth only compares two
// complete rows covering the same number of quarters.
function combinePayerSeries(sources) {
  const found = (sources || []).filter(s => s && s.result && s.result.found && (s.result.series || []).length);
  const rows = {};
  found.forEach(s => s.result.series.forEach(p => {
    const k = payerPeriodKey(p);
    const r = rows[k] = rows[k] || { key: k, label: p.label, year: p.year, quarters: p.quarters, quarterCount: p.quarterCount, isFullYear: p.isFullYear, sortKey: p.sortKey, values: {} };
    if (String(p.label).length < String(r.label).length) r.label = p.label;
    r.values[s.key] = p;
  }));
  const lastKey = {};
  found.forEach(s => { lastKey[s.key] = s.result.series[s.result.series.length - 1].sortKey; });
  const list = Object.keys(rows).map(k => rows[k]).sort((a, b) => a.sortKey - b.sortKey || a.quarterCount - b.quarterCount);
  const out = list.map(r => {
    let total = 0, anyVisible = false, floor = false;
    const noFigure = [], hiddenIn = [];
    found.forEach(s => {
      const p = r.values[s.key];
      if (!p) { if (r.sortKey > lastKey[s.key]) noFigure.push(s.key); return; }
      if (p.hidden) { hiddenIn.push(s.key); floor = true; return; }
      if (p.floor) floor = true;
      total += p.spending || 0;
      anyVisible = true;
    });
    return Object.assign({}, r, {
      total: anyVisible ? total : null,
      noFigure, hiddenIn, floor,
      complete: anyVisible && !floor && !noFigure.length
    });
  });
  return out.map((r, i) => {
    let prior = null;
    for (let j = i - 1; j >= 0; j--) { if (out[j].quarterCount === r.quarterCount) { prior = out[j]; break; } }
    const growth = (r.complete && prior && prior.complete && prior.total > 0) ? r.total / prior.total - 1 : null;
    return Object.assign({}, r, { comparableTo: prior ? prior.label : null, growthVsComparable: growth });
  });
}

// The combined rows as a plain series (for the analog chart and indexing):
// only rows with a readable total.
function payerTotalSeries(combined) {
  return (combined || []).filter(r => r.total != null).map(r => ({
    label: r.label, year: r.year, quarters: r.quarters, quarterCount: r.quarterCount, isFullYear: r.isFullYear,
    sortKey: r.sortKey, spending: r.total, floor: !r.complete
  }));
}

async function fetchPublicPayerSpending(brandName, opts) {
  opts = opts || {};
  const name = String(brandName || "").trim();
  if (!name) return { ok: false, error: "Enter a brand or generic name." };
  const identity = await resolveDrugIdentity(name);
  const [partD, partB, medicaid] = await Promise.all([
    fetchDrugSpending(name, { programme: "Part D", identity, now: opts.now }),
    fetchDrugSpending(name, { programme: "Part B", identity, now: opts.now }),
    fetchMedicaidSpending(name, { identity, now: opts.now })
  ]);
  const byKey = { partD, partB, medicaid };
  const sources = PAYER_SOURCES.map(s => Object.assign({}, s, { result: byKey[s.key] }));
  const failed = sources.filter(s => !s.result || s.result.ok === false);
  if (failed.length === sources.length) return { ok: false, unreachable: true, error: (failed[0].result || {}).error || "No source could be reached." };
  const found = sources.filter(s => s.result && s.result.found);
  const combined = combinePayerSeries(found);
  const starts = found.map(s => s.result.dataStartYear).filter(v => v != null && isFinite(v));
  return {
    ok: true, found: found.length > 0, identity,
    brand: found.length ? found[0].result.brand : (identity.brand || name),
    generic: (found.find(s => s.result.generic) || { result: {} }).result.generic || identity.generic || "",
    sources, failed: failed.map(s => ({ key: s.key, label: s.label, error: (s.result || {}).error })),
    combined,
    dataStartYear: starts.length ? Math.min.apply(null, starts) : null,
    candidates: identity.candidates || []
  };
}

// ── What payers pay, as a price for the revenue build ──
// Each figure is a year of real spending divided by the people or
// prescriptions behind it, so it is what was paid per patient IN a year —
// including patients who started or stopped part way through — before
// rebates. Part B pays ASP plus 6%, so its figure is taken back to ASP.
const PART_B_ASP_ADD_ON = 1.06;
function latestFullYearWith(series, field) {
  for (let i = (series || []).length - 1; i >= 0; i--) {
    const p = series[i];
    if (p.isFullYear && !p.hidden && !p.floor && p[field] != null && isFinite(p[field]) && p[field] > 0) return p;
  }
  return null;
}
function payerPriceFigures(res, fillsPerYear) {
  const out = [];
  const pick = k => {
    const s = ((res && res.sources) || []).find(x => x.key === k);
    return s && s.result && s.result.found ? s.result : null;
  };
  const d = pick("partD"), b = pick("partB"), m = pick("medicaid");
  const dp = d && latestFullYearWith(d.series, "avgSpendPerBene");
  if (dp) out.push({ key: "partD", source: "Medicare Part D", brand: d.brand, period: dp.label, value: dp.avgSpendPerBene, raw: dp.avgSpendPerBene,
    basis: "WAC", patients: dp.beneficiaries, measure: "average paid per patient" });
  const bp = b && latestFullYearWith(b.series, "avgSpendPerBene");
  if (bp) out.push({ key: "partB", source: "Medicare Part B", brand: b.brand, period: bp.label, value: bp.avgSpendPerBene / PART_B_ASP_ADD_ON, raw: bp.avgSpendPerBene,
    basis: "ASP", patients: bp.beneficiaries, measure: "average paid per patient, taken back to ASP (Part B pays ASP + 6%)" });
  const mp = m && latestFullYearWith(m.series, "avgSpendPerClaim");
  if (mp) {
    let fills = Number(fillsPerYear), fillsFrom = "you";
    if (!(fills > 0) && dp && dp.claims > 0 && dp.beneficiaries > 0) { fills = dp.claims / dp.beneficiaries; fillsFrom = "Medicare Part D"; }
    out.push({ key: "medicaid", source: "Medicaid", brand: m.brand, period: mp.label, perClaim: mp.avgSpendPerClaim,
      fills: fills > 0 ? fills : null, fillsFrom: fills > 0 ? fillsFrom : null,
      value: fills > 0 ? mp.avgSpendPerClaim * fills : null, raw: mp.avgSpendPerClaim,
      basis: "WAC", measure: "average paid per prescription × prescriptions a year" });
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fetchDrugSpending, parseCmsPeriodLabel, parseCmsAnnualRow, parseCmsQuarterlyRow,
    pickOverallRows, cmsNormalizeName, cmsDisplayName, cmsFetchByBrand, mergeDrugSpendSeries, addComparablePeriodGrowth, impliedAnnualRunRate,
    cmsSeriesFreshness, indexToLaunch, cmsNum, CMS_DATASETS, CMS_STALENESS_MONTHS, matchLaunchShape,
    combineSamePeriods, parseCmsAnnualRows, drugNameKey, ndcProductCodes, pickDrugIdentity, resolveDrugIdentity, cmsFindDrugRows,
    fetchMedicaidSpending, sdudNameMatches, summariseSdudQuarters, sdudPeriod, addComparableMedicaidGrowth, combinePayerSeries,
    payerTotalSeries, fetchPublicPayerSpending, payerPriceFigures, PART_B_ASP_ADD_ON, SDUD_DATASETS, PAYER_SOURCES };
}
