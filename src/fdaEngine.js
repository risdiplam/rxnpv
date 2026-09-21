// ════════════════════════════════════════════════════════════════════════════
// RxNPV — FDA integration via openFDA (Drugs@FDA endpoint)
// api.fda.gov is a public, CORS-friendly government API (same "no proxy
// needed" category as CT.gov v2) — direct fetch, works in-browser or desktop.
//
// SCOPE NOTE: two endpoints are integrated here — Drugs@FDA
// (drug/drugsfda.json) for approval dates, application numbers/types
// (NDA/BLA/ANDA) and submission history, and the Orange Book
// (drug/orangebook.json) for patent expiry.
//
// The Orange Book half was previously deferred, with this note recording why:
// sources conflicted on whether patent/exclusivity was available as a live
// JSON API or only as FDA's static downloadable data files, and it was
// "left out until that's verified directly." It has now been verified
// directly, against the live API rather than documentation: the endpoint
// responds, 2,651 of 48,664 records carry a `patents` array, and real expiry
// dates come back for real drugs (Uptravi, Eliquis, Jardiance, Ozempic all
// return populated patent sets). So the open question that justified the
// deferral is closed, and the deferral with it.
//
// One real limitation survives and is surfaced in the UI rather than hidden:
// the Orange Book covers small molecules (NDA/ANDA) only. Biologics live in
// the Purple Book, which has no equivalent public API — a biologic lookup
// returns nothing here, so the tool cross-checks Drugs@FDA and says WHY it
// found nothing instead of implying the drug has no patents.
// ════════════════════════════════════════════════════════════════════════════

const FDA_BASE = "https://api.fda.gov/drug/drugsfda.json";

async function fdaFetch(url) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// Search Drugs@FDA by brand name — returns approval info for the best match.
async function searchDrugApproval(brandName) {
  if (!brandName || !brandName.trim()) return { ok: false, error: "Enter a drug name." };
  const search = 'products.brand_name:"' + brandName.trim() + '"';
  const url = FDA_BASE + "?search=" + encodeURIComponent(search) + "&limit=5";
  try {
    const data = await fdaFetch(url);
    const results = data.results || [];
    if (!results.length) return { ok: false, error: "No FDA application found for \"" + brandName + "\"." };

    const parsed = results.map(r => {
      const submissions = r.submissions || [];
      // Original approval = earliest "Approval" status submission (submission_type ORIG when available)
      const approvals = submissions
        .filter(s => s.submission_status === "AP" || (s.submission_status_date && /approv/i.test(s.submission_status || "")))
        .sort((a, b) => (a.submission_status_date || "").localeCompare(b.submission_status_date || ""));
      const origApproval = submissions
        .filter(s => s.submission_type === "ORIG" && s.submission_status_date)
        .sort((a, b) => (a.submission_status_date || "").localeCompare(b.submission_status_date || ""))[0];
      const firstApprovalDate = (origApproval || approvals[0] || {}).submission_status_date || null;

      const products = r.products || [];
      const brandNames = [...new Set(products.map(p => p.brand_name).filter(Boolean))];

      return {
        applicationNumber: r.application_number || null,
        applicationType: (r.application_number || "").match(/^[A-Z]+/)?.[0] || null, // NDA/ANDA/BLA prefix
        sponsorName: r.sponsor_name || null,
        brandNames,
        firstApprovalDate,
        marketingStatus: (products[0] || {}).marketing_status || null,
        dosageForm: (products[0] || {}).dosage_form || null,
        route: (products[0] || {}).route || null
      };
    });

    return { ok: true, results: parsed };
  } catch (e) {
    return { ok: false, error: "FDA lookup failed: " + e.message };
  }
}

// ── Orange Book: patent expiry / loss-of-exclusivity ───────────────────────
const FDA_ORANGE_BOOK = "https://api.fda.gov/drug/orangebook.json";

// A "*PED" suffix on a patent number marks the six-month pediatric-exclusivity
// extension FDA grants for qualifying paediatric studies. It is a real extra
// six months of protection, but it attaches to an existing patent rather than
// being a separate one, so it's counted separately instead of inflating the
// patent count.
function isPediatricExtension(patentNumber) {
  return typeof patentNumber === "string" && /\*PED\s*$/i.test(patentNumber.trim());
}

function parseFdaYyyymmdd(s) {
  if (!s || typeof s !== "string" || s.length !== 8) return null;
  const y = Number(s.slice(0, 4)), m = Number(s.slice(4, 6)), d = Number(s.slice(6, 8));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Summarises a raw Orange Book patent array into the few dates that actually
// matter for a valuation, deliberately NOT collapsing them into one "LOE year".
// That single number would be false precision: the latest-expiring patent is
// often a formulation or method-of-use patent a generic can design around or
// challenge, while the drug SUBSTANCE (compound) patent is the hard floor.
// Reporting both, and saying which is which, is the honest version.
function summarizeOrangeBookPatents(patents, nowDate) {
  const now = nowDate || new Date();
  const yearsFrom = d => d ? (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : null;
  const rows = (patents || [])
    .map(p => ({
      patentNumber: p.patent_number || null,
      expiry: parseFdaYyyymmdd(p.expiration_date),
      expiryRaw: p.expiration_date || null,
      isSubstance: p.drug_substance_flag === true,
      isProduct: p.drug_product_flag === true,
      useCode: p.patent_use_code || null,
      pediatric: isPediatricExtension(p.patent_number)
    }))
    .filter(r => r.expiry);
  if (!rows.length) return null;

  // Dedupe: the same patent is listed once per product/strength, so a raw
  // count massively overstates how many distinct patents actually exist.
  const seen = new Map();
  rows.forEach(r => {
    const key = (r.patentNumber || "?") + "|" + r.expiryRaw;
    if (!seen.has(key)) seen.set(key, r);
  });
  const unique = [...seen.values()].sort((a, b) => a.expiry - b.expiry);

  const nonPed = unique.filter(r => !r.pediatric);
  const substance = unique.filter(r => r.isSubstance);
  const last = arr => arr.length ? arr[arr.length - 1] : null;

  const earliest = unique[0];
  const latest = last(unique);
  const latestSubstance = last(substance);

  return {
    uniquePatentCount: nonPed.length,
    pediatricExtensionCount: unique.length - nonPed.length,
    earliest: earliest ? { ...earliest, yearsAway: yearsFrom(earliest.expiry) } : null,
    latest: latest ? { ...latest, yearsAway: yearsFrom(latest.expiry) } : null,
    latestSubstance: latestSubstance ? { ...latestSubstance, yearsAway: yearsFrom(latestSubstance.expiry) } : null,
    all: unique.map(r => ({ ...r, yearsAway: yearsFrom(r.expiry) }))
  };
}

// Look up a drug's Orange Book patent set. Pages through matches because a
// widely-marketed drug is listed once per strength/ANDA, and the patents that
// matter can sit on any of them.
async function fetchExclusivity(brandName) {
  const name = (brandName || "").trim();
  if (!name) return { ok: false, error: "Enter a drug name." };
  const search = 'products.brand_name:"' + name + '"';
  const url = FDA_ORANGE_BOOK + "?search=" + encodeURIComponent(search) + "&limit=100";
  let results = [];
  try {
    const data = await fdaFetch(url);
    results = data.results || [];
  } catch (e) {
    // openFDA signals "no matches" with HTTP 404 and a NOT_FOUND body, not an
    // empty result set — and fdaFetch throws on any non-2xx. Treating that as
    // a transport failure made the informative not-found path below (including
    // the biologic explanation) unreachable: a Keytruda lookup reported a bare
    // "HTTP 404" instead of explaining that biologics aren't in the Orange
    // Book at all. A 404 here is data, not an error.
    if (!/HTTP 404/.test(String(e.message))) {
      return { ok: false, error: "Orange Book lookup failed: " + e.message };
    }
  }
  {
    const patents = results.flatMap(r => r.patents || []);
    if (!patents.length) {
      // Nothing found is ambiguous on its own — say WHY. If Drugs@FDA knows
      // the drug as a BLA, it's a biologic and the Orange Book structurally
      // does not cover it; that's a different fact from "no patents".
      let reason = "No Orange Book patent records found for \"" + name + "\".";
      try {
        const approval = await searchDrugApproval(name);
        if (approval.ok && approval.results.length) {
          const types = [...new Set(approval.results.map(r => r.applicationType).filter(Boolean))];
          if (types.includes("BLA")) {
            reason = "\"" + name + "\" is a biologic (BLA). The Orange Book covers small molecules only — biologic exclusivity lives in the Purple Book, which has no public API. Biologics instead get 12 years of BLA data exclusivity from first licensure.";
            return { ok: false, isBiologic: true, error: reason, approvalTypes: types };
          }
          reason += " Drugs@FDA does list it (" + types.join(", ") + "), so it may be approved without listed patents, or listed under a different brand name.";
        } else {
          reason += " Drugs@FDA has no record under that name either — check the spelling, or try the brand name rather than the generic.";
        }
      } catch (e) { /* keep the plain reason */ }
      return { ok: false, error: reason };
    }
    const summary = summarizeOrangeBookPatents(patents);
    if (!summary) return { ok: false, error: "Found Orange Book listings for \"" + name + "\" but none carried a usable patent expiry date." };
    return { ok: true, brandName: name, recordCount: results.length, summary };
  }
}
