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
  const productContribution = grossProfit.map((gp, i) => gp - salesForce[i] - marketing[i]);
  const rows = years.map((y, i) => ({
    year: y, revenue: revenue[i], cogs: cogs[i], grossProfit: grossProfit[i],
    salesForce: salesForce[i], marketing: marketing[i], productContribution: productContribution[i]
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
    let revenue = 0, cogs = 0, grossProfit = 0, salesForce = 0, marketing = 0, productContribution = 0;
    programPnLs.forEach(p => {
      const idx = cy - (p.launchYearOffset || 0);
      const row = idx >= 0 ? p.pnl[idx] : null;
      if (row) {
        revenue += row.revenue; cogs += row.cogs; grossProfit += row.grossProfit;
        salesForce += row.salesForce; marketing += row.marketing; productContribution += row.productContribution;
      }
      // Pre-launch sales force ramp: incurred the calendar year immediately before launch
      if (idx === -1 && p.pnl.prelaunchSalesForceCost) {
        salesForce += p.pnl.prelaunchSalesForceCost;
        productContribution -= p.pnl.prelaunchSalesForceCost;
      }
    });
    calendar.push({ calendarYear: cy, revenue, cogs, grossProfit, salesForce, marketing, productContribution });
  }
  const gaByYear = computeCorporateGA(calendar.map(c => c.revenue), corporateGA.preCommercialAnnualM, corporateGA.gaShareOfMatureSgaPct);
  calendar.forEach((c, i) => { c.corporateGA = gaByYear[i]; c.ebit = c.productContribution - gaByYear[i]; });
  return calendar;
}
