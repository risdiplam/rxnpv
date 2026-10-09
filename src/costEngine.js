// ════════════════════════════════════════════════════════════════════════════
// RxNPV — COST ENGINE (pure functions)
// Per-program: COGS, sales force, marketing → product contribution.
// Case-level: corporate G&A → EBIT.
// Produces a per-year P&L: Revenue → COGS → Gross Profit → Sales & Marketing
//   → Product Contribution → (less corporate G&A) → EBIT
// ════════════════════════════════════════════════════════════════════════════

// ── COGS: % of revenue, modality-driven ──
function computeCOGS(revenueByYear, cogsPct) {
  const pct = (numOr(cogsPct, 0)) / 100;
  return revenueByYear.map(r => Math.round(r * pct));
}

// The 4 modalities the app has sourced benchmark data for — every dropdown
// and every COGS/exclusivity lookup reads from this one list, so adding a
// 5th modality later means editing it here plus its COGS_BENCHMARKS/
// EXCLUSIVITY_BENCHMARKS.erosion entries, not hunting down every ternary.
const MODALITY_OPTIONS = [
  { value: "smallMolecule", label: "Small molecule" },
  { value: "biologic", label: "Biologic" },
  { value: "cellTherapy", label: "Cell therapy" },
  { value: "geneTherapy", label: "Gene therapy" }
];

// Single shared lookup for the COGS % benchmark + its source citation, used
// by both the Program Editor and CaseView's revenue-rollup gross-profit
// calc — previously two separate `modality === "biologic" ? ... : ...`
// ternaries that only ever distinguished 2 of the now-4 modalities.
function getCogsBenchmark(modality) {
  const c = COGS_BENCHMARKS;
  if (modality === "biologic") return { value: c.biologic, source: c.source + " — biologics median (all-drugs median " + c.all + "%)" };
  if (modality === "cellTherapy") return { value: c.cellTherapy, source: c.cellTherapyNote };
  if (modality === "geneTherapy") return { value: c.geneTherapy, source: c.geneTherapyNote };
  return { value: c.smallMolecule, source: c.source + " — small molecules median (all-drugs median " + c.all + "%)" };
}

// ── Sales force: reps × fully-loaded cost/rep. ──
// Source-stated conventions, all explicit (Ch. 10):
//  - Pre-launch: ~30% staffed the year before launch, ramping to 100% at launch.
//  - Post-LOE: "you typically model a complete elimination of sales force expenses."
//  - Compensation grows at the same 2%/yr CAGR used for drug pricing.
const SALES_FORCE_PRELAUNCH_RAMP_PCT = 30;
const SALES_FORCE_COMP_GROWTH_PCT = 2;
function computeSalesForceCost(years, reps, yearsToLOE, launchYearOffset) {
  const perRepTotalY1 =
    (numOr(reps.primaryCare, 0)) * SALES_REP_COST.primaryCare.total +
    (numOr(reps.specialty, 0)) * SALES_REP_COST.specialty.total +
    (numOr(reps.hospital, 0)) * SALES_REP_COST.hospital.total;
  const loe = yearsToLOE !== "" && yearsToLOE != null ? Number(yearsToLOE) : 999;
  return years.map(y => {
    if (y > loe) return 0; // complete elimination at LOE, per source
    const grown = perRepTotalY1 * Math.pow(1 + SALES_FORCE_COMP_GROWTH_PCT / 100, Math.max(0, y - 1));
    return Math.round(grown);
  });
}
// Pre-launch cost for the single year before launch (30% of the full team, at year-1 comp level)
function computePrelaunchSalesForceCost(reps) {
  const perRepTotalY1 =
    (numOr(reps.primaryCare, 0)) * SALES_REP_COST.primaryCare.total +
    (numOr(reps.specialty, 0)) * SALES_REP_COST.specialty.total +
    (numOr(reps.hospital, 0)) * SALES_REP_COST.hospital.total;
  return Math.round(perRepTotalY1 * (SALES_FORCE_PRELAUNCH_RAMP_PCT / 100));
}

// ── Marketing: % of peak revenue, from launch until loss of exclusivity ──
// Source: "we typically model marketing expenditure to start in the year of
// launch and last until the loss of exclusivity" — explicitly stops at LOE,
// not simply "while revenue > 0" (which would run indefinitely under partial erosion).
function computeMarketingCost(years, peakRevenue, marketingPctOfPeak, yearsToLOE) {
  const pct = (numOr(marketingPctOfPeak, 0)) / 100;
  const spend = Math.round(peakRevenue * pct);
  const loe = yearsToLOE !== "" && yearsToLOE != null ? Number(yearsToLOE) : 999;
  return years.map(y => y <= loe ? spend : 0);
}

// ── Full per-year P&L for one program (before corporate G&A) ──
// ── What an in-licensing company owes its licensor (October 2026) ─────────
// Many small biotechs in-license their lead asset and owe the licensor on
// it: a royalty on their own net sales, a milestone on approval, milestones
// when annual sales first cross set levels, and often a share of whatever a
// partner pays them (a "sublicense fee"). lic: program.licensor. All of it is
// a cost that exists only once the drug sells, so it comes out of product
// contribution and is weighted by the odds of launch with the revenue.
//   royaltyPct      — % of the company's OWN net sales (commercialRevenue);
//                     a tiered royalty can be its blended rate, or:
//   tiers           — [{ upToM, pct }] (October 2026), marginal like tax
//                     bands: pct applies to the slice of annual sales up to
//                     upToM ($M a year); a blank upToM is the top band. When
//                     any tier carries a rate, tiers replace royaltyPct.
//   shared          — the terms cover every program of the same drug (a
//                     licence is per molecule): see drugLicenceExpectedByYear
//   sublicensePct   — % of partner royalty income (partnerRoyalty) owed on
//                     (upfronts and milestones received: computePartnershipContribution)
//   approvalMilestoneM — paid in the first launch year
//   salesMilestones — [{ thresholdM, paymentM }], each paid once, in the first
//                     year the company's own net sales reach the threshold
function licensorObligationsByYear(commercialRevenue, partnerRoyalty, lic) {
  const n = commercialRevenue.length;
  const zeros = () => new Array(n).fill(0);
  if (!lic || !lic.enabled) return { royalty: zeros(), share: zeros(), milestones: zeros(), total: zeros() };
  const pct = v => Math.min(100, Math.max(0, numOr(v, 0))) / 100;
  const royalty = commercialRevenue.map(r => Math.round(licenceRoyaltyOn(r, lic)));
  const share = (partnerRoyalty || zeros()).map(r => Math.round(r * pct(lic.sublicensePct)));
  const milestones = zeros();
  const approval = Math.max(0, numOr(lic.approvalMilestoneM, 0)) * 1e6;
  if (approval > 0 && n > 0) milestones[0] += Math.round(approval);
  (lic.salesMilestones || []).forEach(m => {
    const threshold = Math.max(0, numOr(m.thresholdM, 0)) * 1e6, pay = Math.max(0, numOr(m.paymentM, 0)) * 1e6;
    if (!(pay > 0)) return;
    const at = commercialRevenue.findIndex(r => r > 0 && r >= threshold);
    if (at >= 0) milestones[at] += Math.round(pay);
  });
  return { royalty, share, milestones, total: royalty.map((v, i) => v + share[i] + milestones[i]) };
}
// The royalty on one year's own net sales: marginal tiers when any carries a
// rate, else the flat royaltyPct. Tiers are sorted by their ceiling, blank
// ceiling last; sales past the last ceiling pay the last tier's rate.
function licenceTiers(lic) {
  const t = ((lic && lic.tiers) || []).filter(x => x && x.pct !== "" && x.pct != null && isFinite(Number(x.pct)))
    .map(x => ({ upTo: x.upToM !== "" && x.upToM != null && Number(x.upToM) > 0 ? Number(x.upToM) * 1e6 : Infinity, pct: Math.min(100, Math.max(0, Number(x.pct))) / 100 }));
  return t.sort((a, b) => a.upTo - b.upTo);
}
function licenceRoyaltyOn(sales, lic) {
  const r = Math.max(0, sales || 0);
  const tiers = licenceTiers(lic);
  if (!tiers.length) return r * Math.min(100, Math.max(0, numOr(lic && lic.royaltyPct, 0))) / 100;
  let owed = 0, floor = 0;
  for (const t of tiers) {
    if (r <= floor) break;
    owed += (Math.min(r, t.upTo) - floor) * t.pct;
    floor = t.upTo;
  }
  if (r > floor) owed += (r - floor) * tiers[tiers.length - 1].pct;
  return owed;
}

// ── One licence across several programs of the same drug (October 2026) ──
// A licence is per molecule: Akeso's royalty and its $3.5B of sales milestones
// run on total ivonescimab sales, whichever indication they come from.
// Programs are "the same drug" when their drug names match (case-insensitive).
// A program whose licensor is enabled and marked shared leads; every other
// program of that drug is covered by it. Inert with one program of the drug.
function licenceDrugKey(p) { return String((p && p.drugName) || "").trim().toLowerCase(); }
function sharedLicenceFor(program, programs) {
  const key = licenceDrugKey(program);
  if (!key || !programs) return null;
  const same = programs.filter(q => licenceDrugKey(q) === key);
  if (same.length < 2) return null;
  const lead = same.find(q => q.licensor && q.licensor.enabled && q.licensor.shared);
  return lead ? { lead, members: same, key } : null;
}
// The licence a program's own P&L carries. Covered by a shared licence: only
// its own approval milestone and the sublicense share of partner income stay
// per program; the royalty and sales milestones move to the drug level.
function effectiveLicensor(program, programs) {
  const g = sharedLicenceFor(program, programs);
  if (!g) return program.licensor;
  const L = g.lead.licensor, own = program.licensor || {};
  return { enabled: true, name: L.name, royaltyPct: "0", tiers: [], sublicensePct: L.sublicensePct, salesMilestones: [],
    approvalMilestoneM: program.id === g.lead.id ? L.approvalMilestoneM : own.approvalMilestoneM, _covered: g.lead.id };
}
// The drug-level royalty and sales milestones, by calendar year, as expected
// values. pvs: program valuations (each with its program, posToLaunch,
// launchYearOffset and pnl rows carrying commercialRevenue); programs: the
// case's programs. A group counts only when every member is in pvs (a
// stand-alone program in the SOTP is valued without the drug-level terms,
// which are shown as their own line). Exact under the valuation's own
// assumption that programs succeed independently: every combination of
// members working or not is enumerated (2^m, m capped at 10), its own-sales
// total built year by year, the royalty and the first year each sales level
// is reached computed on that total, and weighted by the combination's
// probability. A flat royalty with no milestones gives exactly the
// per-program answer (linear); tiers and thresholds do not.
function drugLicenceExpectedByYear(pvs, programs, totalYears) {
  const out = { royalty: new Array(totalYears).fill(0), milestones: new Array(totalYears).fill(0), total: new Array(totalYears).fill(0), groups: [] };
  const seen = new Set();
  (programs || []).forEach(p => {
    const g = sharedLicenceFor(p, programs);
    if (!g || seen.has(g.key)) return;
    seen.add(g.key);
    const members = g.members.map(m => pvs.find(v => v.id === m.id)).filter(Boolean);
    if (members.length !== g.members.length || members.length > 10) return;
    const L = g.lead.licensor;
    const salesAt = (v, cy) => { const row = v.pnl && v.pnl[cy - (v.launchYearOffset || 0)]; return row ? row.commercialRevenue || 0 : 0; };
    const roy = new Array(totalYears).fill(0), mil = new Array(totalYears).fill(0);
    const m = members.length;
    for (let mask = 0; mask < (1 << m); mask++) {
      let prob = 1;
      for (let i = 0; i < m; i++) prob *= (mask >> i) & 1 ? members[i].posToLaunch : 1 - members[i].posToLaunch;
      if (!(prob > 0)) continue;
      const total = [];
      for (let cy = 0; cy < totalYears; cy++) {
        let s = 0;
        for (let i = 0; i < m; i++) if ((mask >> i) & 1) s += salesAt(members[i], cy);
        total.push(s);
        roy[cy] += prob * licenceRoyaltyOn(s, L);
      }
      (L.salesMilestones || []).forEach(ms => {
        const threshold = Math.max(0, numOr(ms.thresholdM, 0)) * 1e6, pay = Math.max(0, numOr(ms.paymentM, 0)) * 1e6;
        if (!(pay > 0)) return;
        const at = total.findIndex(s => s > 0 && s >= threshold);
        if (at >= 0) mil[at] += prob * pay;
      });
    }
    for (let cy = 0; cy < totalYears; cy++) { out.royalty[cy] += roy[cy]; out.milestones[cy] += mil[cy]; out.total[cy] += roy[cy] + mil[cy]; }
    out.groups.push({ key: g.key, leadId: g.lead.id, licensor: L.name || "", memberIds: g.members.map(x => x.id) });
  });
  return out;
}
// Applies the drug-level terms to a company calendar (computeCompanyRiskAdjustedCF's
// output): they come out of product contribution and free cash flow, before tax.
function applyDrugLicences(calendar, pvs, programs) {
  const owed = drugLicenceExpectedByYear(pvs, programs, calendar.length);
  if (!owed.groups.length) return calendar;
  return calendar.map((c, i) => ({ ...c, drugLicence: owed.total[i], riskAdjProductContribution: c.riskAdjProductContribution - owed.total[i], riskAdjFCF: c.riskAdjFCF - owed.total[i] }));
}

// True when a program owes anything to a licensor (labels and notes read it).
function hasLicensorObligations(program) {
  const lic = program && program.licensor;
  return !!(lic && lic.enabled && (numOr(lic.royaltyPct, 0) > 0 || licenceTiers(lic).some(t => t.pct > 0) || numOr(lic.sublicensePct, 0) > 0 || numOr(lic.approvalMilestoneM, 0) > 0 || (lic.salesMilestones || []).some(m => numOr(m.paymentM, 0) > 0)));
}

function computeProgramPnL(revenueResult, cost) {
  const years = revenueResult.years.map(y => y.year);
  const revenue = revenueResult.years.map(y => y.totalRevenue);
  // Royalty income is not the company's own commercial revenue, and charging
  // the company's own COGS and marketing against it is simply wrong: in a
  // licensed-out territory the PARTNER manufactures and sells, which is the
  // whole economic point of the deal — less revenue, but close to pure margin
  // and no commercial infrastructure to fund. Charging both against a royalty
  // understated a partnered asset's contribution by about a third on a typical
  // 15% deal. COGS and marketing therefore apply only to the commercial
  // portion. Sales force is deliberately NOT adjusted here: it is an explicit
  // headcount the user enters rather than a figure derived from revenue, so
  // zeroing it silently would override a deliberate input — a fully licensed-out
  // programme should simply have no reps entered against it.
  const royaltyRevenue = revenueResult.years.map(y => y.royaltyRevenue || 0);
  const commercialRevenue = revenue.map((r, i) => Math.max(0, r - royaltyRevenue[i]));
  const peakCommercial = revenueResult.peakCommercialRevenue != null
    ? revenueResult.peakCommercialRevenue
    : revenueResult.peakTotalRevenue;
  const cogs = computeCOGS(commercialRevenue, cost.cogsPct);
  const grossProfit = revenue.map((r, i) => r - cogs[i]);
  const salesForce = computeSalesForceCost(years, cost.reps, cost.yearsToLOE, cost.launchYearOffset);
  const marketing = computeMarketingCost(years, peakCommercial, cost.marketingPctOfPeak, cost.yearsToLOE);
  const owed = licensorObligationsByYear(commercialRevenue, royaltyRevenue, cost.licensor);
  const productContribution = grossProfit.map((gp, i) => gp - salesForce[i] - marketing[i] - owed.total[i]);
  const rows = years.map((y, i) => ({
    year: y, revenue: revenue[i], commercialRevenue: commercialRevenue[i], cogs: cogs[i], grossProfit: grossProfit[i],
    salesForce: salesForce[i], marketing: marketing[i],
    licensorRoyalty: owed.royalty[i], licensorShare: owed.share[i], licensorMilestones: owed.milestones[i], licensorTotal: owed.total[i],
    productContribution: productContribution[i]
  }));
  rows.prelaunchSalesForceCost = computePrelaunchSalesForceCost(cost.reps);
  return rows;
}

// ── Corporate G&A: flat pre-commercial cost, ramping toward a mature level tied
// to total company revenue. IMPORTANT: the 34% "mature SG&A/revenue" benchmark
// (SGA_BENCHMARKS) bundles G&A + Sales + Marketing together — but Sales and
// Marketing are already modeled bottoms-up per-program above. Applying 34% again
// here would double-count them. We use gaShareOfMatureSga (default 50%, exposed
// as an editable assumption in the UI, NOT itself a number stated in the source)
// to carve out the G&A-only slice. Treat this split as a judgment call, not a benchmark.
function computeCorporateGA(totalRevenueByYear, preCommercialAnnualM, gaShareOfMatureSgaPct) {
  const preCommercial = (preCommercialAnnualM !== "" && preCommercialAnnualM != null ? Number(preCommercialAnnualM) : SGA_BENCHMARKS.preCommercialGA.medianM) * 1e6;
  const gaShare = (gaShareOfMatureSgaPct !== "" && gaShareOfMatureSgaPct != null ? Number(gaShareOfMatureSgaPct) : 50) / 100;
  const matureGaPct = (SGA_BENCHMARKS.matureSgaPctOfRevenue / 100) * gaShare;
  const threshold = SGA_BENCHMARKS.maturityRevenueThresholdM * 1e6;
  return totalRevenueByYear.map(rev => {
    if (rev <= 0) return Math.round(preCommercial);
    if (rev >= threshold) return Math.round(rev * matureGaPct);
    const matureAtThreshold = threshold * matureGaPct;
    const frac = rev / threshold;
    return Math.round(preCommercial + (matureAtThreshold - preCommercial) * frac);
  });
}

// ── Company-level rollup: sum program P&Ls onto calendar, subtract corporate G&A ──
function computeCompanyPnL(programPnLs, corporateGA, totalYears) {
  totalYears = totalYears || 22;
  const calendar = [];
  for (let cy = 0; cy < totalYears; cy++) {
    let revenue = 0, cogs = 0, grossProfit = 0, salesForce = 0, marketing = 0, licensor = 0, productContribution = 0;
    programPnLs.forEach(p => {
      const idx = cy - (p.launchYearOffset || 0);
      const row = idx >= 0 ? p.pnl[idx] : null;
      if (row) {
        revenue += row.revenue; cogs += row.cogs; grossProfit += row.grossProfit;
        salesForce += row.salesForce; marketing += row.marketing; licensor += row.licensorTotal || 0; productContribution += row.productContribution;
      }
      // Pre-launch sales force ramp: incurred the calendar year immediately before launch
      if (idx === -1 && p.pnl.prelaunchSalesForceCost) {
        salesForce += p.pnl.prelaunchSalesForceCost;
        productContribution -= p.pnl.prelaunchSalesForceCost;
      }
    });
    calendar.push({ calendarYear: cy, revenue, cogs, grossProfit, salesForce, marketing, licensor, productContribution });
  }
  const gaByYear = computeCorporateGA(calendar.map(c => c.revenue), corporateGA.preCommercialAnnualM, corporateGA.gaShareOfMatureSgaPct);
  calendar.forEach((c, i) => { c.corporateGA = gaByYear[i]; c.ebit = c.productContribution - gaByYear[i]; });
  return calendar;
}
