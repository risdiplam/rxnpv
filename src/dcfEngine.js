// ════════════════════════════════════════════════════════════════════════════
// RxNPV — DCF / NPV ENGINE
// Distributes risk-adjusted R&D cost across the pre-launch years it's actually
// spent in, combines with risk-adjusted post-launch product contribution, nets
// out (non-risk-adjusted) corporate G&A, and discounts to NPV.
// SIMPLIFICATION, stated plainly: EBIT is the base proxy for unlevered FCF —
// no capex or working-capital adjustment (biotech is asset-light, so both are
// small relative to the R&D and commercial lines that dominate).
//
// Tax is OPTIONAL and off by default. Left off, flows are pre-tax, which is
// defensible for a pre-revenue company that will be NOL-shielded through its
// first profitable years — and it is what every case built before taxation
// existed already assumed, so enabling it by default would silently re-price
// them. Turned on, applyTaxToCalendar models the real pattern: accumulated
// losses shield early profits, and only income beyond them is taxed.
// ════════════════════════════════════════════════════════════════════════════

// Spread each R&D stage's risk-adjusted cost evenly across the calendar years
// it occupies before launch. Returns an array of length launchYearOffset
// (index 0 = the first pre-launch year), in dollars (not $M).
function distributeRnDCostByYear(riskAdjItems, launchYearOffset) {
  const requested = Math.max(0, Math.round(launchYearOffset));
  if (!riskAdjItems.length) return new Array(requested).fill(0);

  // A program can still carry real remaining R&D cost while the user has typed
  // a launch year of 0 — which the field's own placeholder text explicitly
  // invites for "launches immediately". That used to hit an early return
  // before any allocation ran, so the entire remaining R&D spend dropped out
  // of the cash-flow calendar with no warning and NPV was overstated by its
  // full value. Cost that exists has to land somewhere: give it the current
  // year at minimum.
  const years = Math.max(1, requested);
  const out = new Array(years).fill(0);
  const totalCost = riskAdjItems.reduce((s, i) => s + i.riskAdjCostM, 0) * 1e6;

  // The R&D breakdown and the launch-year field are set independently of each
  // other — nothing keeps them in sync — so the stage timeline can run well
  // past the launch window (a Phase 2 program with an 8-year remaining
  // timeline against a typed launch year of 2). Distributing on the raw
  // timeline left every later stage with no overlap at all, and the shortfall
  // recovery below then dumped its entire cost into one year. Total dollars
  // survived that, but a DCF discounts each year separately, so the present
  // value and the cash-flow shape were both wrong. Compressing preserves each
  // stage's relative share and ordering, which is what the typed launch year
  // actually implies: if launch really is that soon, the same work has to fit
  // into the time available.
  const timelineYears = riskAdjItems.reduce((s, i) => s + i.years, 0);
  const squeeze = timelineYears > years ? years / timelineYears : 1;

  let cursor = 0, allocated = 0;
  riskAdjItems.forEach(it => {
    const cost = it.riskAdjCostM * 1e6;
    const span = it.years * squeeze;
    if (!(span > 0)) {
      // A zero-duration stage would divide by zero; bill it to the year it
      // starts in instead of producing Infinity.
      const y = Math.min(years - 1, Math.max(0, Math.floor(cursor)));
      out[y] += cost; allocated += cost;
      return;
    }
    const start = cursor, end = cursor + span;
    const costPerYear = cost / span;
    for (let y = 0; y < years; y++) {
      const overlap = Math.max(0, Math.min(end, y + 1) - Math.max(start, y));
      if (overlap > 0) { out[y] += costPerYear * overlap; allocated += costPerYear * overlap; }
    }
    cursor = end;
  });
  // If the true stage timeline (e.g. 8.15yr) runs past the rounded launch-year window
  // (e.g. 8yr), the tail would otherwise vanish. Recover any shortfall into the final year
  // so total distributed cost always equals total risk-adjusted cost — nothing gets lost.
  const shortfall = totalCost - allocated;
  if (Math.abs(shortfall) > 0.01 && years > 0) out[years - 1] += shortfall;
  return out;
}

// ── Company-level risk-adjusted cash flow by calendar year ──
// programs: [{ id, launchYearOffset, pnl, riskAdjItems, posToLaunch }]
function computeCompanyRiskAdjustedCF(programs, corporateGA, totalYears) {
  totalYears = totalYears || 22;
  const calendar = [];
  for (let cy = 0; cy < totalYears; cy++) {
    let riskAdjProductContribution = 0, riskAdjRnDCost = 0, revenue = 0;
    programs.forEach(p => {
      const prelaunchCosts = distributeRnDCostByYear(p.riskAdjItems, p.launchYearOffset || 0);
      if (cy < prelaunchCosts.length) riskAdjRnDCost += prelaunchCosts[cy];
      const idx = cy - (p.launchYearOffset || 0);
      if (idx >= 0 && p.pnl[idx]) {
        riskAdjProductContribution += p.pnl[idx].productContribution * p.posToLaunch;
        revenue += p.pnl[idx].revenue * p.posToLaunch;
      }
      // pre-launch sales-force ramp cost, risk-adjusted at the launch-stage probability
      if (idx === -1 && p.pnl.prelaunchSalesForceCost) {
        riskAdjRnDCost += p.pnl.prelaunchSalesForceCost * p.posToLaunch;
      }
    });
    calendar.push({ calendarYear: cy, revenue, riskAdjProductContribution, riskAdjRnDCost });
  }
  const gaByYear = computeCorporateGA(calendar.map(c => c.revenue), corporateGA.preCommercialAnnualM, corporateGA.gaShareOfMatureSgaPct);
  calendar.forEach((c, i) => {
    c.corporateGA = gaByYear[i];
    c.riskAdjFCF = c.riskAdjProductContribution - c.riskAdjRnDCost - gaByYear[i];
  });
  return calendar;
}

// ── Cash tax with net-operating-loss carryforward ──────────────────────────
// A biotech spends years loss-making before (if ever) turning profitable, and
// those accumulated losses shield the first profitable years from cash tax.
// Applying a flat rate to every profitable year would overstate tax badly for
// exactly the companies this app models; ignoring tax entirely overstates
// value once a product is actually selling — which matters most in terminal
// value, typically the majority of a DCF's total.
//
// Deliberately simple in two ways, both stated rather than hidden:
//   * It taxes the RISK-ADJUSTED flow, consistent with how every other line in
//     this model is probability-weighted. Taxing an unrisked flow and then
//     risk-adjusting would double-count the probability.
//   * It ignores the 80%-of-taxable-income annual cap on post-2017 federal NOL
//     usage, and any expiry of pre-2018 losses. Both would slightly ACCELERATE
//     tax, so this is the mildly optimistic direction — noted so it isn't
//     mistaken for precision.
// Returns a new calendar; never mutates the input.
function applyTaxToCalendar(calendar, taxation) {
  if (!taxation || !taxation.enabled) return calendar;
  const rate = (numOr(taxation.effectiveRatePct, 21)) / 100;
  if (!(rate > 0)) return calendar;
  let nolPool = Math.max(0, numOr(taxation.startingNOLM, 0)) * 1e6;
  return calendar.map(c => {
    const preTax = c.riskAdjFCF;
    if (!(preTax > 0)) {
      // A loss year adds to the shield rather than generating a refund.
      nolPool += -preTax;
      return { ...c, preTaxFCF: preTax, nolUsed: 0, tax: 0, nolPoolEnd: nolPool };
    }
    const nolUsed = Math.min(preTax, nolPool);
    nolPool -= nolUsed;
    const tax = (preTax - nolUsed) * rate;
    return { ...c, preTaxFCF: preTax, nolUsed, tax, nolPoolEnd: nolPool, riskAdjFCF: preTax - tax };
  });
}

// ── Discount a cash flow stream to NPV. cashFlowByYear[i] = flow in year i+1 (i.e. index 0 = 1yr out). ──
// terminalValueParams: { enabled, method: 'exitMultiple' | 'perpetuityGrowth', growthPct, exitMultiple }
// revenueByYear: parallel array to cashFlowByYear (risk-adjusted revenue) — the exitMultiple
// method needs this to find the actual peak year, not just the peak value, because the
// terminal value has to be discounted back from WHEN peak happens, not from the end of the
// full window. (An earlier version discounted "peak revenue x multiple" back from the final
// modeled year — but by then the explicit cash flows already reflect post-LOE decline, so
// that silently double-counted value instead of representing a real exit.)
function computeNPV(cashFlowByYear, discountRatePct, terminalValueParams, revenueByYear) {
  const r = (numOr(discountRatePct, 0)) / 100;

  const useExitMultiple = terminalValueParams && terminalValueParams.enabled && (terminalValueParams.method || "exitMultiple") === "exitMultiple";

  if (useExitMultiple) {
    // Find the peak-revenue year, then treat that as the acquisition point: cash flows
    // after it belong to the (hypothetical) acquirer, not to this DCF.
    const revs = revenueByYear || [];
    let peakIdx = 0, peakRev = -Infinity;
    revs.forEach((rev, i) => { if (rev > peakRev) { peakRev = rev; peakIdx = i; } });
    if (peakRev <= 0) peakIdx = cashFlowByYear.length - 1; // no revenue at all modeled — fall back to full window, TV will be 0
    const truncated = cashFlowByYear.slice(0, peakIdx + 1);
    const pvByYear = truncated.map((cf, i) => cf / Math.pow(1 + r, i + 1));
    const explicitNPV = pvByYear.reduce((s, v) => s + v, 0);
    const mult = numOr(terminalValueParams.exitMultiple, 3);
    const terminalValue = Math.max(0, peakRev) * mult;
    const terminalValuePV = terminalValue / Math.pow(1 + r, peakIdx + 1);
    return { pvByYear, explicitNPV, terminalValue, terminalValuePV, npv: explicitNPV + terminalValuePV, exitYearIndex: peakIdx };
  }

  const pvByYear = cashFlowByYear.map((cf, i) => cf / Math.pow(1 + r, i + 1));
  const explicitNPV = pvByYear.reduce((s, v) => s + v, 0);

  let terminalValue = 0, terminalValuePV = 0;
  if (terminalValueParams && terminalValueParams.enabled) {
    const finalCF = cashFlowByYear[cashFlowByYear.length - 1] || 0;
    const g = (numOr(terminalValueParams.growthPct, 0)) / 100;
    if (r > g && finalCF > 0) {
      terminalValue = (finalCF * (1 + g)) / (r - g);
      terminalValuePV = terminalValue / Math.pow(1 + r, cashFlowByYear.length);
    }
  }

  return { pvByYear, explicitNPV, terminalValue, terminalValuePV, npv: explicitNPV + terminalValuePV };
}
