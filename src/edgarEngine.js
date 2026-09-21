// ════════════════════════════════════════════════════════════════════════════
// RxNPV — EDGAR INTEGRATION (desktop-only: uses the Electron main-process
// bridge in preload.js, which has no CORS restriction, so no proxy is needed).
// Ported from RxNPV's already-tested EDGAR logic; network layer swapped from
// browser fetch+CORS-proxy to window.electronAPI.edgarFetch.
// ════════════════════════════════════════════════════════════════════════════

// ── Cache (unchanged from RxNPV — pure logic, no network specifics) ──
// Bounded by BYTES as well as entry count. Entry count alone was not a real
// bound: a single EDGAR companyfacts response runs to megabytes, so a 200-entry
// cap allowed the persisted blob to reach ~12MB — at or past the localStorage
// quota. That did not lose user data (saveCases sacrifices these caches and
// retries), but it meant routine case saves were quietly running through their
// failure path, and a genuinely full quota was one API call away.
class TTLCache {
  constructor(opts={}) {
    this.max = opts.max || 100;
    this.maxBytes = opts.maxBytes || 1_500_000;
    this.ttl = opts.ttl || 3600_000;
    this.persistKey = opts.persistKey || null;
    this.lastPersistOk = true;
    this.mem = new Map();
    if (this.persistKey) {
      try {
        const raw = localStorage.getItem(this.persistKey);
        if (raw) {
          const obj = JSON.parse(raw);
          Object.entries(obj).forEach(([k, v]) => { if (v && v.expires > Date.now()) this.mem.set(k, v); });
        }
      } catch (e) {}
    }
  }
  get(key) {
    const v = this.mem.get(key);
    if (!v) return null;
    if (v.expires <= Date.now()) { this.mem.delete(key); return null; }
    return v.data;
  }
  ageMs(key) { const v = this.mem.get(key); return v ? Date.now() - (v.expires - this.ttl) : null; }
  delete(key) { this.mem.delete(key); if (this.persistKey) this._persist(); }
  set(key, data, customTTL) {
    if (this.mem.size >= this.max) { const firstKey = this.mem.keys().next().value; this.mem.delete(firstKey); }
    this.mem.set(key, { data, expires: Date.now() + (customTTL || this.ttl) });
    if (this.persistKey) this._persist();
  }
  // Serialize, then evict oldest-first until the blob fits the byte budget.
  // A failed write is recorded rather than silently swallowed — a cache miss is
  // harmless on its own, but a cache that can never persist means every lookup
  // re-hits the network, which is worth being able to see.
  _persist() {
    try {
      let entries = [...this.mem.entries()];
      let payload = JSON.stringify(Object.fromEntries(entries));
      while (payload.length > this.maxBytes && entries.length > 1) {
        entries = entries.slice(1); // Map preserves insertion order: oldest first
        payload = JSON.stringify(Object.fromEntries(entries));
      }
      if (entries.length !== this.mem.size) this.mem = new Map(entries);
      if (payload.length > this.maxBytes) { // a single entry over budget: do not persist it
        localStorage.removeItem(this.persistKey);
        this.lastPersistOk = true;
        return;
      }
      localStorage.setItem(this.persistKey, payload);
      this.lastPersistOk = true;
    } catch (e) {
      // Quota hit despite trimming — drop this cache entirely rather than
      // leaving a stale oversized blob occupying space the user's cases need.
      try { localStorage.removeItem(this.persistKey); } catch (e2) {}
      this.lastPersistOk = false;
    }
  }
}

// Per-endpoint rate limiter (SEC's own fair-access guidance: keep well under 10 req/sec)
class RateLimiter {
  constructor(maxPerSec) { this.maxPerSec = maxPerSec; this.queue = []; this.timestamps = []; }
  async acquire() { return new Promise(resolve => { this.queue.push(resolve); this._tick(); }); }
  _tick() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 1000);
    while (this.timestamps.length < this.maxPerSec && this.queue.length > 0) {
      this.timestamps.push(now);
      this.queue.shift()();
    }
    if (this.queue.length > 0) setTimeout(() => this._tick(), 100);
  }
}
const _edgarLimit = new RateLimiter(8);

// ~1.5MB and ~400KB budgets: comfortably inside a 5MB origin quota even
// together, leaving the large majority of it for the user's own cases.
const _edgarCache = new TTLCache({ max: 200, maxBytes: 1_500_000, ttl: 24*3600_000, persistKey: "pdcf_edgar_cache" });
const _cikCache = new TTLCache({ max: 500, maxBytes: 400_000, ttl: 30*24*3600_000, persistKey: "pdcf_cik_cache" });

// ── The only network primitive: routes through the Electron bridge, which has
// no CORS restriction and sets a proper SEC-compliant User-Agent server-side.
// Falls back to a clear error if run outside the desktop app (e.g. this file
// loaded in a plain browser tab by mistake) rather than failing silently. ──
async function edgarFetch(url, retries) {
  retries = retries == null ? 1 : retries;
  if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.edgarFetch) {
    throw new Error("EDGAR features require the RxNPV desktop app (no browser CORS workaround is used here).");
  }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await window.electronAPI.edgarFetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

// Raw-text variant of edgarFetch — same IPC bridge, same rate limiting, same
// sec.gov-only restriction, but returns the response body as text rather
// than parsed JSON. The main-process handler already falls back to `text`
// whenever a response isn't valid JSON (see electron/main.js), so this
// needed no changes there — only a renderer-side function that actually
// reads that field, for XML documents like Form 4 filings.
async function edgarFetchText(url, retries) {
  retries = retries == null ? 1 : retries;
  if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.edgarFetch) {
    throw new Error("EDGAR features require the RxNPV desktop app (no browser CORS workaround is used here).");
  }
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await window.electronAPI.edgarFetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text != null ? res.text : (res.json != null ? JSON.stringify(res.json) : "");
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

// ── CIK lookup (company name/ticker → CIK) ──
let _cikMaster = null, _cikMasterFetching = null;
async function getCIKMaster() {
  if (_cikMaster) return _cikMaster;
  if (_cikMasterFetching) {
    try { const r = await _cikMasterFetching; if (r) return r; } catch (e) {}
    _cikMasterFetching = null;
  }
  _cikMasterFetching = (async () => {
    await _edgarLimit.acquire();
    const urls = ["https://www.sec.gov/files/company_tickers.json", "https://www.sec.gov/files/company_tickers_exchange.json"];
    let data = null;
    for (const url of urls) {
      try { const d = await edgarFetch(url, 2); if (d && Object.keys(d).length > 50) { data = d; break; } }
      catch (e) { console.warn("getCIKMaster url failed:", url, e.message); }
    }
    if (!data) { _cikMasterFetching = null; throw new Error("CIK master unavailable"); }
    const byName = new Map(), byTicker = new Map();
    Object.values(data).forEach(row => {
      if (!row || !row.cik_str) return;
      const cik = String(row.cik_str).padStart(10, "0");
      if (row.ticker) byTicker.set(row.ticker.toLowerCase(), { cik, ticker: row.ticker, name: row.title });
      if (row.title) byName.set(row.title.toLowerCase(), { cik, ticker: row.ticker || "", name: row.title });
    });
    _cikMaster = { byName, byTicker };
    _cikMasterFetching = null;
    return _cikMaster;
  })();
  try { return await _cikMasterFetching; }
  catch (e) { _cikMasterFetching = null; console.warn("getCIKMaster failed:", e.message); return null; }
}

async function findCIK(companyName, force) {
  const cacheKey = "cik::" + companyName.toLowerCase().trim();
  if (force) _cikCache.delete(cacheKey);
  const cached = _cikCache.get(cacheKey);
  if (cached) return cached;
  try {
    const master = await getCIKMaster();
    if (!master) return null;
    const cn = companyName.toLowerCase().trim();
    const cnNoSuffix = cn.replace(/\s+(inc\.?|corp\.?|corporation|ltd\.?|llc|plc|holdings|therapeutics|pharma(ceuticals)?|bio(sciences|pharma)?|sa)$/i, "").trim();
    let match = master.byTicker.get(cn) || master.byTicker.get(cnNoSuffix);
    if (!match) match = master.byName.get(cn) || master.byName.get(cnNoSuffix);
    if (!match) {
      for (const [name, info] of master.byName.entries()) {
        if (name.startsWith(cnNoSuffix) || name.replace(/[^a-z0-9]/g, "").startsWith(cnNoSuffix.replace(/[^a-z0-9]/g, ""))) { match = info; break; }
      }
    }
    if (!match) {
      try {
        const eftsD = await edgarFetch("https://efts.sec.gov/LATEST/search-index?q=" + encodeURIComponent('"' + cnNoSuffix + '"') + "&forms=10-K", 0);
        const hit = (eftsD.hits?.hits || []).find(h => h._source?.entity_name);
        if (hit) {
          const src = hit._source;
          const cidMatch = (src.display_names?.[0] || "").match(/CIK\s*0*(\d+)/i);
          const cidNum = cidMatch ? cidMatch[1] : src.entity_id;
          if (cidNum) match = { cik: String(cidNum).padStart(10, "0"), name: src.entity_name || companyName, ticker: "" };
        }
      } catch (e2) {}
    }
    // Manual CIK override remains available as a convenience (not a CORS workaround
    // this time) — useful when fuzzy name matching just doesn't find the right company.
    if (!match) {
      try {
        const manCIK = localStorage.getItem("pdcf_cik_" + companyName.toLowerCase().trim());
        if (manCIK && /^\d+$/.test(manCIK.trim())) match = { cik: manCIK.trim().padStart(10, "0"), name: companyName, ticker: "" };
      } catch (e3) {}
    }
    if (match) _cikCache.set(cacheKey, match);
    return match;
  } catch (e) { console.warn("findCIK failed:", e.message); return null; }
}

async function fetchSubmissions(cik, force) {
  const key = "sub::" + cik;
  if (force) _edgarCache.delete(key);
  const cached = _edgarCache.get(key);
  if (cached) return cached;
  await _edgarLimit.acquire();
  try {
    const data = await edgarFetch("https://data.sec.gov/submissions/CIK" + cik + ".json");
    _edgarCache.set(key, data, 6*3600_000);
    return data;
  } catch (e) { console.warn("fetchSubmissions failed for", cik, ":", e.message); return null; }
}

async function fetchCompanyFacts(cik, force) {
  const key = "facts::" + cik;
  if (force) _edgarCache.delete(key);
  const cached = _edgarCache.get(key);
  if (cached) return cached;
  await _edgarLimit.acquire();
  try {
    const data = await edgarFetch("https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json");
    _edgarCache.set(key, data, 24*3600_000);
    return data;
  } catch (e) { console.warn("fetchCompanyFacts failed for", cik, ":", e.message); return null; }
}

function calcRunwayFromFacts(facts) {
  if (!facts || !facts.facts || !facts.facts["us-gaap"]) return null;
  const ug = facts.facts["us-gaap"];
  const cashTags = ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"];
  const investmentTags = ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesCurrent"];
  const opLossTags = ["OperatingIncomeLoss", "NetIncomeLoss"];
  const pickLatest = (tag) => {
    const fact = ug[tag];
    if (!fact || !fact.units || !fact.units.USD) return null;
    const all = fact.units.USD.filter(p => p.form === "10-Q" || p.form === "10-K");
    if (!all.length) return null;
    all.sort((a, b) => (b.end || "").localeCompare(a.end || ""));
    return { value: all[0].val, end: all[0].end, form: all[0].form };
  };
  let cash = null, invest = null;
  for (const t of cashTags) { cash = pickLatest(t); if (cash) break; }
  for (const t of investmentTags) { invest = pickLatest(t); if (invest) break; }
  const totalCash = (cash?.value || 0) + (invest?.value || 0);
  if (!totalCash) return null;
  let opLoss = null;
  for (const t of opLossTags) {
    const fact = ug[t];
    if (!fact || !fact.units?.USD) continue;
    const quarterly = fact.units.USD.filter(p => p.form === "10-Q" && p.fp && p.fp.startsWith("Q"));
    if (!quarterly.length) continue;
    quarterly.sort((a, b) => (b.end || "").localeCompare(a.end || ""));
    opLoss = { value: quarterly[0].val, end: quarterly[0].end };
    break;
  }
  if (!opLoss || opLoss.value >= 0) return { cashUSD: totalCash, debtUSD: extractDebt(ug), runwayMonths: null, asOf: cash?.end || invest?.end, note: "operating loss not available" };
  const quarterlyBurn = Math.abs(opLoss.value);
  const monthlyBurn = quarterlyBurn / 3;
  return { cashUSD: totalCash, debtUSD: extractDebt(ug), quarterlyBurnUSD: quarterlyBurn, runwayMonths: totalCash / monthlyBurn, asOf: cash?.end || invest?.end };
}

// New for RxNPV: total debt, to auto-fill the Capital Structure panel's debt field
function extractDebt(ug) {
  const debtTags = ["LongTermDebtNoncurrent", "LongTermDebt", "DebtCurrent", "NotesPayableCurrent"];
  let total = 0, found = false;
  for (const t of debtTags) {
    const fact = ug[t];
    if (!fact || !fact.units?.USD) continue;
    const sorted = [...fact.units.USD].filter(p => (p.form === "10-Q" || p.form === "10-K") && p.val > 0).sort((a,b) => (b.end||"").localeCompare(a.end||""));
    if (sorted.length) { total += sorted[0].val; found = true; }
  }
  return found ? total : null;
}

function recentFilingsByType(submissions, types, limit) {
  limit = limit || 5;
  if (!submissions || !submissions.filings?.recent) return [];
  const r = submissions.filings.recent;
  const out = [];
  for (let i = 0; i < (r.form || []).length; i++) {
    if (types.includes(r.form[i])) {
      out.push({ form: r.form[i], date: r.filingDate[i], accession: r.accessionNumber[i], primaryDoc: r.primaryDocument[i], description: r.primaryDocDescription?.[i] || "" });
      if (out.length >= limit) break;
    }
  }
  return out;
}

function extractSharesOutstanding(facts) {
  if (!facts || !facts.facts) return null;
  const ug = facts.facts["us-gaap"] || {};
  const dei = facts.facts["dei"] || {};
  const shareTags = [
    { src: dei, tag: "EntityCommonStockSharesOutstanding" },
    { src: ug, tag: "CommonStockSharesOutstanding" },
    { src: ug, tag: "WeightedAverageNumberOfShareOutstandingBasicAndDiluted" },
    { src: ug, tag: "WeightedAverageNumberDilutedSharesOutstanding" },
    { src: ug, tag: "CommonStockSharesIssued" }
  ];
  for (const { src, tag } of shareTags) {
    const fact = src[tag];
    if (!fact || !fact.units) continue;
    const units = fact.units.shares || fact.units.USD;
    if (!units || !units.length) continue;
    const sorted = [...units].filter(u => u.val > 0).sort((a, b) => (b.end || "").localeCompare(a.end || ""));
    if (!sorted.length) continue;
    return { shares: sorted[0].val, asOf: sorted[0].end, form: sorted[0].form, tag };
  }
  return null;
}

function extractDilutedShares(facts) {
  if (!facts || !facts.facts) return null;
  const ug = facts.facts["us-gaap"] || {};
  const candidates = [
    { tag: "WeightedAverageNumberDilutedSharesOutstanding", label: "diluted wt.avg." },
    { tag: "WeightedAverageNumberOfDilutedSharesOutstanding", label: "diluted wt.avg." },
    { tag: "WeightedAverageNumberOfShareOutstandingBasicAndDiluted", label: "basic+diluted" }
  ];
  for (const { tag, label } of candidates) {
    const fact = ug[tag];
    if (!fact || !fact.units) continue;
    const units = fact.units.shares || fact.units["shares/"];
    if (!units || !units.length) continue;
    const sorted = [...units].filter(p => (p.form === "10-Q" || p.form === "10-K") && p.val > 0).sort((a, b) => (b.end || "").localeCompare(a.end || ""));
    if (!sorted.length) continue;
    return { shares: sorted[0].val, asOf: sorted[0].end, form: sorted[0].form, label };
  }
  return null;
}

// ── Dilutive securities: options, warrants, convertible notes ──────────────
// These are meaningfully LESS standardized in XBRL than basic shares/cash/debt
// — companies often use extension tags or leave detail in footnote text rather
// than structured data. Best-effort extraction using the most common us-gaap
// tags; every result is labeled with what was actually found so nothing is
// silently guessed. Always worth checking against the filing's own
// "Stockholders' Equity" / "Capitalization" note.
function pickLatestUnit(fact, formOk) {
  if (!fact || !fact.units) return null;
  const units = fact.units.shares || fact.units.USD || fact.units["USD/shares"] || fact.units.pure;
  if (!units || !units.length) return null;
  const sorted = [...units].filter(p => formOk(p.form) && p.val != null).sort((a, b) => (b.end || "").localeCompare(a.end || ""));
  return sorted.length ? { value: sorted[0].val, asOf: sorted[0].end, form: sorted[0].form } : null;
}
const isFilingForm = (f) => f === "10-Q" || f === "10-K";

function extractOptions(facts) {
  if (!facts || !facts.facts) return null;
  const ug = facts.facts["us-gaap"] || {};
  const count = pickLatestUnit(ug["ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingNumber"], isFilingForm);
  const price = pickLatestUnit(ug["ShareBasedCompensationArrangementByShareBasedPaymentAwardOptionsOutstandingWeightedAverageExercisePrice"], isFilingForm);
  if (!count) return null;
  return { count: count.value, avgStrike: price ? price.value : null, asOf: count.asOf, priceFound: !!price };
}

function extractWarrants(facts) {
  if (!facts || !facts.facts) return null;
  const ug = facts.facts["us-gaap"] || {};
  const count = pickLatestUnit(ug["ClassOfWarrantOrRightOutstanding"], isFilingForm);
  const price = pickLatestUnit(ug["ClassOfWarrantOrRightExercisePriceOfWarrantsOrRights"], isFilingForm);
  if (!count) return null;
  return { count: count.value, avgStrike: price ? price.value : null, asOf: count.asOf, priceFound: !!price };
}

function extractConvertibleNotes(facts) {
  if (!facts || !facts.facts) return null;
  const ug = facts.facts["us-gaap"] || {};
  const faceTags = ["ConvertibleNotesPayable", "ConvertibleNotesPayableNoncurrent", "ConvertibleNotesPayableCurrent", "ConvertibleDebtNoncurrent"];
  let face = null;
  for (const t of faceTags) { face = pickLatestUnit(ug[t], isFilingForm); if (face) break; }
  if (!face) return null;
  // Conversion price is almost never a clean XBRL numeric tag — it's typically
  // footnote text. We don't guess at it; the UI will ask for it manually.
  return { faceValue: face.value, asOf: face.asOf, conversionPriceFound: false };
}

// ── Top-level orchestrator: everything the Capital Structure "Pull from EDGAR"
// button needs, in one call. ──
async function pullEdgarFinancials(companyName, force) {
  const cikInfo = await findCIK(companyName, force);
  if (!cikInfo) return { ok: false, error: "Could not find a CIK for \"" + companyName + "\". Try the exact legal name, ticker, or enter a CIK manually." };
  const [subs, facts] = await Promise.all([fetchSubmissions(cikInfo.cik, force), fetchCompanyFacts(cikInfo.cik, force)]);
  if (!facts) return { ok: false, error: "Found CIK " + cikInfo.cik + " but couldn't retrieve financial data (XBRL facts)." };
  const shares = extractSharesOutstanding(facts);
  const diluted = extractDilutedShares(facts);
  const runway = calcRunwayFromFacts(facts);
  const options = extractOptions(facts);
  const warrants = extractWarrants(facts);
  const converts = extractConvertibleNotes(facts);
  const recentFilings = subs ? recentFilingsByType(subs, ["10-K", "10-Q", "8-K"], 5) : [];
  const cikNumeric = String(Number(cikInfo.cik)); // strip leading zeros for the Archives URL format
  // Link straight to the actual filing document most likely to be the source of
  // the extracted numbers (most recent 10-K or 10-Q), so it's one click to verify.
  const mostRecentFinancialFiling = recentFilings.find(f => f.form === "10-Q") || recentFilings.find(f => f.form === "10-K");
  const sourceFilingUrl = mostRecentFinancialFiling
    ? "https://www.sec.gov/Archives/edgar/data/" + cikNumeric + "/" + mostRecentFinancialFiling.accession.replace(/-/g, "") + "/" + mostRecentFinancialFiling.primaryDoc
    : null;
  const edgarCompanyPageUrl = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=" + cikInfo.cik + "&type=10-K&dateb=&owner=include&count=40";
  return {
    ok: true, cik: cikInfo.cik, ticker: cikInfo.ticker, name: subs?.name || cikInfo.name,
    basicShares: shares ? shares.shares : null, basicSharesAsOf: shares ? shares.asOf : null,
    dilutedShares: diluted ? diluted.shares : null, dilutedSharesAsOf: diluted ? diluted.asOf : null,
    cash: runway ? runway.cashUSD : null, debt: runway ? runway.debtUSD : null,
    asOf: runway ? runway.asOf : null,
    quarterlyBurnUSD: runway ? runway.quarterlyBurnUSD : null,
    runwayMonths: runway ? runway.runwayMonths : null,
    runwayNote: runway ? runway.note : null,
    options: options ? { count: options.count, avgStrike: options.avgStrike, priceFound: options.priceFound } : null,
    warrants: warrants ? { count: warrants.count, avgStrike: warrants.avgStrike, priceFound: warrants.priceFound } : null,
    convertibleFace: converts ? converts.faceValue : null,
    recentFilings, sourceFilingUrl,
    sourceFilingLabel: mostRecentFinancialFiling ? mostRecentFinancialFiling.form + " filed " + mostRecentFinancialFiling.date : null,
    edgarCompanyPageUrl
  };
}

// ── EDGAR full-text search (EFTS) — searches the actual TEXT inside filings,
// not just their type/date. Used to find catalyst-relevant language (PDUFA
// dates, topline results, advisory committee mentions) in a specific
// company's own filings — the honest gap the Catalyst Calendar previously
// had, where "recent 8-K exists" was the best available signal. Free,
// unauthenticated, same efts.sec.gov host used by SEC's own search UI.
const CATALYST_KEYWORDS = [
  "topline results", "top-line results", "PDUFA", "target action date",
  "primary endpoint", "interim analysis", "advisory committee",
  "Breakthrough Therapy", "Priority Review", "Fast Track designation",
  "New Drug Application", "Biologics License Application"
];

async function searchCatalystFilings(cik, monthsBack) {
  monthsBack = monthsBack || 12;
  const cikPadded = String(cik).replace(/\D/g, "").padStart(10, "0");
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  const fmt = d => d.toISOString().slice(0, 10);

  const q = CATALYST_KEYWORDS.map(k => `"${k}"`).join(" OR ");
  const url = "https://efts.sec.gov/LATEST/search-index?q=" + encodeURIComponent(q)
    + "&forms=8-K,10-Q,10-K&dateRange=custom&startdt=" + fmt(start) + "&enddt=" + fmt(end)
    + "&ciks=" + cikPadded;

  const data = await edgarFetch(url);
  if (!data || !data.hits || !data.hits.hits) return { ok: false, hits: [] };

  const hits = data.hits.hits.map(h => {
    const src = h._source || {};
    const idParts = String(h._id || "").split(":");
    const accessionRaw = idParts[0] || "";
    const fileName = idParts[1] || "";
    const accessionNoDashes = accessionRaw.replace(/-/g, "");
    const filingUrl = accessionNoDashes && fileName
      ? "https://www.sec.gov/Archives/edgar/data/" + parseInt(cikPadded, 10) + "/" + accessionNoDashes + "/" + fileName
      : null;
    return {
      formType: src.form_type || src.root_form || "?",
      fileDate: src.file_date || null,
      entityName: (src.display_names || [])[0] || null,
      filingUrl
    };
  }).filter(h => h.filingUrl);

  return { ok: true, totalHits: (data.hits.total || {}).value || hits.length, hits };
}

// ── Insider transactions (Form 4) — discovers filings via the same
// full-text search pattern searchCatalystFilings above already uses
// (ciks= filter, _id-splitting for the document URL), then fetches and
// parses each filing's actual ownership XML for the structured transaction
// data (shares, price, transaction code) that search-result metadata alone
// doesn't carry. Non-derivative transactions only (direct stock buys/sells)
// — derivative transactions (options, RSUs vesting) are a real but
// substantially messier category left out of this first pass.
function parseForm4Xml(xmlText) {
  if (typeof DOMParser === "undefined") return null;
  let doc;
  try { doc = new DOMParser().parseFromString(xmlText, "text/xml"); } catch (e) { return null; }
  if (!doc || doc.querySelector("parsererror")) return null;

  const val = (parent, selector) => {
    if (!parent) return null;
    const el = parent.querySelector(selector);
    return el ? el.textContent.trim() : null;
  };
  const issuerEl = doc.querySelector("issuer");
  const ownerEl = doc.querySelector("reportingOwner");
  const relEl = ownerEl ? ownerEl.querySelector("reportingOwnerRelationship") : null;

  let role = "Other";
  if (relEl) {
    const title = val(relEl, "officerTitle");
    if (relEl.querySelector("isDirector")?.textContent.trim() === "1") role = "Director";
    else if (relEl.querySelector("isOfficer")?.textContent.trim() === "1") role = title || "Officer";
    else if (relEl.querySelector("isTenPercentOwner")?.textContent.trim() === "1") role = "10%+ Owner";
  }

  const transactions = [...doc.querySelectorAll("nonDerivativeTable > nonDerivativeTransaction")].map(t => ({
    securityTitle: val(t, "securityTitle value"),
    date: val(t, "transactionDate value"),
    code: val(t, "transactionCoding transactionCode"),
    shares: parseFloat(val(t, "transactionAmounts transactionShares value")),
    pricePerShare: parseFloat(val(t, "transactionAmounts transactionPricePerShare value")),
    acquiredDisposed: val(t, "transactionAmounts transactionAcquiredDisposedCode value"),
    sharesOwnedAfter: parseFloat(val(t, "postTransactionAmounts sharesOwnedFollowingTransaction value"))
  })).filter(t => t.date && !isNaN(t.shares));

  return {
    issuerName: val(issuerEl, "issuerName"),
    issuerCik: val(issuerEl, "issuerCik"),
    ownerName: val(ownerEl, "reportingOwnerId rptOwnerName"),
    role,
    transactions
  };
}

// Standard Section 16 transaction-code labels, the ones that actually matter
// for a "did an insider buy or sell" read — everything else falls back to
// showing the raw code rather than guessing at a label.
const FORM4_CODE_LABELS = { P: "Open-market buy", S: "Open-market sell", A: "Grant/award", M: "Option exercise", F: "Tax withholding", G: "Gift", J: "Other (per footnote)" };

async function fetchInsiderTransactions(cik, limit) {
  limit = limit || 20;
  const cikPadded = String(cik).replace(/\D/g, "").padStart(10, "0");
  const url = "https://efts.sec.gov/LATEST/search-index?q=%22Form%204%22&forms=4&ciks=" + cikPadded;

  let data;
  try { data = await edgarFetch(url); } catch (e) { return { ok: false, error: e.message }; }
  if (!data || !data.hits || !data.hits.hits) return { ok: false, error: "No response from EDGAR full-text search." };

  const filingRefs = data.hits.hits.slice(0, limit).map(h => {
    const src = h._source || {};
    const idParts = String(h._id || "").split(":");
    const accessionRaw = idParts[0] || "";
    const fileName = idParts[1] || "";
    const accessionNoDashes = accessionRaw.replace(/-/g, "");
    const docUrl = accessionNoDashes && fileName
      ? "https://www.sec.gov/Archives/edgar/data/" + parseInt(cikPadded, 10) + "/" + accessionNoDashes + "/" + fileName
      : null;
    return { docUrl, fileDate: src.file_date || null };
  }).filter(r => r.docUrl);

  if (!filingRefs.length) return { ok: true, transactions: [], filingsChecked: 0 };

  const parsed = await Promise.all(filingRefs.map(async ref => {
    try {
      const xml = await edgarFetchText(ref.docUrl);
      const doc = parseForm4Xml(xml);
      return doc ? { ...doc, filingDate: ref.fileDate, sourceUrl: ref.docUrl } : null;
    } catch (e) { return null; }
  }));

  const transactions = [];
  parsed.filter(Boolean).forEach(doc => {
    doc.transactions.forEach(t => {
      transactions.push({
        ownerName: doc.ownerName, role: doc.role, filingDate: doc.filingDate, sourceUrl: doc.sourceUrl,
        date: t.date, code: t.code, codeLabel: FORM4_CODE_LABELS[t.code] || ("Code " + t.code),
        shares: t.shares, pricePerShare: t.pricePerShare, acquiredDisposed: t.acquiredDisposed,
        valueUsd: (t.pricePerShare > 0 && t.shares > 0) ? t.shares * t.pricePerShare : null,
        sharesOwnedAfter: t.sharesOwnedAfter
      });
    });
  });
  transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return { ok: true, transactions, filingsChecked: filingRefs.length, filingsParsed: parsed.filter(Boolean).length };
}
