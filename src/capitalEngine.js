// ════════════════════════════════════════════════════════════════════════════
// RxNPV — CAPITAL STRUCTURE / DILUTION ENGINE
// Converts Enterprise Value (NPV of risk-adjusted cash flows) into per-share
// equity value. Two modes: 'simple' (one flat diluted share count) or
// 'detailed' (basic shares + treasury-method options/warrants + if-converted
// convertible notes) — same pattern as RxNPV's valuation tool.
// ════════════════════════════════════════════════════════════════════════════

// ── Treasury stock method: options/warrants only add shares if in-the-money.
// Net new shares = count - (proceeds from exercise) / currentPrice. ──
function treasuryMethodShares(count, strike, currentPrice) {
  const n = numOr(count, 0), k = numOr(strike, 0), p = numOr(currentPrice, 0);
  if (n <= 0 || p <= 0 || k >= p) return 0; // out of the money or no price to test against
  // A negative strike is not a real instrument, but nothing upstream rejects
  // one (the strike inputs are bare number fields, and an EDGAR-pulled value
  // isn't sanitised either). Left unguarded it inverts the arithmetic below:
  // negative proceeds mean a negative buyback, so the function would return
  // MORE net new shares than the option pool even contains, silently
  // overstating dilution. Treat it as "no exercise proceeds" — full dilution,
  // capped at the pool size — matching how ifConvertedShares already guards
  // its own equivalent case.
  const proceeds = n * Math.max(0, k);
  const buybackShares = proceeds / p;
  return Math.max(0, n - buybackShares);
}

// ── If-converted method for convertible notes: adds shares only if conversion
// is favorable (conversion price below current price); otherwise stays as debt. ──
function ifConvertedShares(faceValue, convPrice, currentPrice) {
  const face = numOr(faceValue, 0), cp = numOr(convPrice, 0), p = numOr(currentPrice, 0);
  if (face <= 0 || cp <= 0 || p <= 0 || cp >= p) return { shares: 0, converts: false };
  return { shares: face / cp, converts: true };
}

// ── Full diluted share count + capital structure summary ──
// capStruct = { mode: 'simple'|'detailed', dilutedSharesSimple, basicShares, currentPrice,
//               cash, debt, opts, optK, war, warK, convFace, convPrice }
function computeCapitalStructure(capStruct) {
  const price = numOr(capStruct.currentPrice, 0);
  if (capStruct.mode === "simple") {
    return {
      dilutedShares: numOr(capStruct.dilutedSharesSimple, 0),
      basicShares: numOr(capStruct.dilutedSharesSimple, 0),
      optionShares: 0, warrantShares: 0, convertShares: 0, convertsInTheMoney: false,
      netCash: (numOr(capStruct.cash, 0)) - (numOr(capStruct.debt, 0))
    };
  }
  const basic = numOr(capStruct.basicShares, 0);
  const optionShares = treasuryMethodShares(capStruct.opts, capStruct.optK, price);
  const warrantShares = treasuryMethodShares(capStruct.war, capStruct.warK, price);
  const conv = ifConvertedShares(capStruct.convFace, capStruct.convPrice, price);
  // Convention: "debt" entered by the user should EXCLUDE any convertible note tracked separately
  // here. If the convertible doesn't convert to equity, its face value counts as debt (subtracted
  // from net cash below); if it does convert, it becomes shares instead and drops out of net cash.
  return {
    dilutedShares: basic + optionShares + warrantShares + conv.shares,
    basicShares: basic, optionShares, warrantShares, convertShares: conv.shares, convertsInTheMoney: conv.converts,
    netCash: (numOr(capStruct.cash, 0)) - (numOr(capStruct.debt, 0)) - (conv.converts ? 0 : (numOr(capStruct.convFace, 0)))
  };
}

// ── Enterprise Value → Equity Value → Per-share ──
function computeEquityValue(enterpriseValue, capStructResult) {
  const equityValue = enterpriseValue + capStructResult.netCash;
  const perShare = capStructResult.dilutedShares > 0 ? equityValue / capStructResult.dilutedShares : null;
  return { enterpriseValue, equityValue, dilutedShares: capStructResult.dilutedShares, perShare };
}

// ── Future capital raise overlay: models issuing new shares at an assumed
// price to raise a set amount, applied on top of the existing capital
// structure. Deliberately simple — no explicit future-year timing/discount,
// since the core question this answers ("if we raise $X at $Y/share, what
// happens to my per-share value") doesn't need that nuance to be useful, and
// adding it would imply a false precision about exactly when a raise would
// happen. No underwriting fee assumed (raised amount = cash added, in full).
// Applied identically across Bear/Base/Bull so dilution risk shows up
// consistently in every scenario, not just Base.
// ── Cash as of the valuation date, not the filing date ──
// A case's cash comes from the last 10-Q, but the valuation charges costs
// from today. Without an adjustment the months between the two were paid for
// twice: once out of the filed cash figure (which is still counted in full)
// and again in the year-one costs. With capitalStructure.cashAsOf (the
// balance-sheet date) and monthlyBurn (dollars a month, as MillionsField
// stores it), cash becomes: filed cash − burn × months to the valuation date
// (theCase.valuationDate, blank = today), never below zero. Either field
// blank leaves the case exactly as it was. Every engine read of the capital
// structure goes through here, so the adjustment cannot apply in one place
// and not another.
function parseIsoDay(s) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(s || "").trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : 1);
}
function effectiveCapitalStructure(theCase) {
  const cap = (theCase && theCase.capitalStructure) || { mode: "simple", dilutedSharesSimple: "" };
  const burn = numOr(cap.monthlyBurn, 0);
  const asOf = parseIsoDay(cap.cashAsOf);
  if (!(burn > 0) || asOf == null || cap.cash === "" || cap.cash == null) return cap;
  const now = new Date();
  const at = parseIsoDay(theCase.valuationDate) != null ? parseIsoDay(theCase.valuationDate) : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const months = Math.max(0, (at - asOf) / (86400000 * 365.25 / 12));
  const filed = numOr(cap.cash, 0);
  const spent = Math.min(Math.max(0, filed), burn * months);
  if (!(spent > 0)) return cap;
  return { ...cap, cash: String(filed - spent), _cashFiled: filed, _spentSinceFiling: spent, _monthsSinceFiling: months };
}

function applyFutureRaise(capResult, futureRaise, fallbackPrice) {
  if (!futureRaise || !futureRaise.enabled) return capResult;
  const amountRaised = numOr(futureRaise.amountM, 0); // MillionsField already stores the raw dollar value, not millions
  const raisePrice = futureRaise.priceOverride !== "" && futureRaise.priceOverride != null
    ? numOr(futureRaise.priceOverride, 0) : numOr(fallbackPrice, 0);
  if (amountRaised <= 0 || raisePrice <= 0) return capResult;
  const newShares = amountRaised / raisePrice;
  return {
    ...capResult,
    dilutedShares: capResult.dilutedShares + newShares,
    netCash: capResult.netCash + amountRaised,
    _futureRaiseNewShares: newShares, _futureRaiseAmount: amountRaised
  };
}
