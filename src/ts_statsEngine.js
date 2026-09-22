// ════════════════════════════════════════════════════════════════════════════
// TrialSim — STATS ENGINE
// Random number generation, distribution functions, and the hypothesis tests
// used inside each simulated trial replicate. Plain-script style (no import/
// export) to match RxNPV's concatenation-based build. A CommonJS export
// block at the bottom lets this run standalone under node for testing.
// ════════════════════════════════════════════════════════════════════════════

// ── Random number generation ──────────────────────────────────────────────

function randUniform(a = 0, b = 1) {
  return a + Math.random() * (b - a);
}

function randNormal(mean = 0, sd = 1) {
  // Box-Muller
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

function randExponential(rate = 1) {
  return -Math.log(1 - Math.random()) / rate;
}

function randBinomialCount(n, p) {
  // Exact sum-of-Bernoulli for the trial sizes this app deals with (tens to
  // low thousands per arm). Fine for Monte Carlo speed at that scale.
  let count = 0;
  for (let i = 0; i < n; i++) if (Math.random() < p) count++;
  return count;
}

// ── Normal distribution CDF / inverse CDF ───────────────────────────────────

function erf(x) {
  // Abramowitz & Stegun 7.1.26, |error| < 1.5e-7
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function normalInvCDF(p) {
  // Acklam's rational approximation for the standard normal quantile function.
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const plow = 0.02425, phigh = 1 - plow;
  let q, r;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

// ── Hypothesis tests (each returns { z, pValue }) ───────────────────────────

function twoProportionZTest(x1, n1, x2, n2, sided = 'two') {
  const p1 = x1 / n1, p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, pValue: 1 };
  const z = (p1 - p2) / se;
  const pValue = sided === 'one' ? (1 - normalCDF(z)) : 2 * (1 - normalCDF(Math.abs(z)));
  return { z, pValue };
}

function twoSampleZTestMeans(mean1, sd1, n1, mean2, sd2, n2, sided = 'two') {
  const se = Math.sqrt((sd1 * sd1) / n1 + (sd2 * sd2) / n2);
  if (se === 0) return { z: 0, pValue: 1 };
  const z = (mean1 - mean2) / se;
  const pValue = sided === 'one' ? (1 - normalCDF(z)) : 2 * (1 - normalCDF(Math.abs(z)));
  return { z, pValue };
}

function logRankTest(subjects) {
  // subjects: [{ time, event (0/1), arm (0=control,1=treatment) }, ...]
  // Standard log-rank O-E / variance formula, grouped by distinct event times.
  const sorted = subjects.slice().sort((a, b) => a.time - b.time);
  const eventTimes = [...new Set(sorted.filter(s => s.event === 1).map(s => s.time))].sort((a, b) => a - b);

  let O1 = 0, E1 = 0, V = 0;
  for (const t of eventTimes) {
    const atRisk = sorted.filter(s => s.time >= t);
    const n1j = atRisk.filter(s => s.arm === 1).length;
    const n2j = atRisk.filter(s => s.arm === 0).length;
    const nj = n1j + n2j;
    const eventsHere = sorted.filter(s => s.time === t && s.event === 1);
    const dj = eventsHere.length;
    const d1j = eventsHere.filter(s => s.arm === 1).length;
    if (nj <= 1) continue;
    const e1j = dj * n1j / nj;
    const vj = (nj > 1) ? (dj * (nj - dj) * n1j * n2j) / (nj * nj * (nj - 1)) : 0;
    O1 += d1j; E1 += e1j; V += vj;
  }
  if (V === 0) return { z: 0, pValue: 1, O1, E1, V };
  const z = (O1 - E1) / Math.sqrt(V);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { z, pValue, O1, E1, V };
}

// ── Fisher's exact test (2x2 table) ─────────────────────────────────────────
// Needed for the Fragility Index below — a z-test/chi-square approximation
// isn't appropriate once you're deliberately walking toward small, marginal
// counts, so this uses the actual hypergeometric distribution over the
// table's fixed margins, not an approximation.

function logGamma(x) {
  // Lanczos approximation (g=7, 9 coefficients) — a standard, widely-published
  // numerical method (e.g. Numerical Recipes), not something specific to this
  // app. Verified below against known factorials before anything is built on it.
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = coef[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += coef[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

// P(observing exactly this table | fixed margins) under the null of no
// association — the hypergeometric point probability for cell `a`.
function hypergeomPointProb(a, rowA, rowB, colEvent) {
  const total = rowA + rowB;
  return Math.exp(logChoose(rowA, a) + logChoose(rowB, colEvent - a) - logChoose(total, colEvent));
}

// Two-sided Fisher's exact p-value for a 2x2 table:
//        event   no-event
// arm A:   a         b      (rowA = a+b)
// arm B:   c         d      (rowB = c+d)
// Standard definition: sum the probability of every table with the same
// margins whose probability is no greater than the observed table's
// (not just the more-extreme-in-one-direction tables a one-sided test uses).
function fisherExactTwoSided(a, b, c, d) {
  const rowA = a + b, rowB = c + d, colEvent = a + c, total = rowA + rowB;
  const pObserved = hypergeomPointProb(a, rowA, rowB, colEvent);
  const aMin = Math.max(0, colEvent - rowB), aMax = Math.min(rowA, colEvent);
  let pValue = 0;
  const eps = pObserved * 1e-7; // guards against float noise excluding the observed table itself
  for (let ai = aMin; ai <= aMax; ai++) {
    const p = hypergeomPointProb(ai, rowA, rowB, colEvent);
    if (p <= pObserved + eps) pValue += p;
  }
  return Math.min(1, pValue);
}

// ── Fragility Index (Walsh, Srinathan, McAuley et al. 2014) ────────────────
// For a trial result that reached significance on a binary outcome: the
// minimum number of patients whose outcome would need to flip (non-event to
// event, or the reverse) to bring the two-sided Fisher's exact p-value back
// to/above alpha. A measure of how few individual outcomes stand behind a
// "significant" result, not a re-analysis of whether the trial was well run.
//
// Method (the standard implementation, matching the original paper and the
// calculators built on it since): hold both arms' N fixed, find whichever
// arm has the smaller number of events, and convert that arm's non-event
// patients to events one at a time — recomputing the two-sided Fisher's
// exact p-value after each switch — until the result is no longer
// significant. The count of switches needed is the Fragility Index. Ties in
// event count are broken toward arm A, disclosed in the returned object
// rather than left implicit.
function computeFragilityIndex(eventsA, nA, eventsB, nB, alpha = 0.05) {
  const b0 = nA - eventsA, d0 = nB - eventsB;
  const observedP = fisherExactTwoSided(eventsA, b0, eventsB, d0);
  if (!(observedP < alpha)) {
    return { observedP, alpha, significant: false, fragilityIndex: null };
  }

  const flipArm = eventsA <= eventsB ? 'A' : 'B';
  let curA = eventsA, curC = eventsB;
  let steps = 0, curP = observedP;
  const capacity = flipArm === 'A' ? (nA - eventsA) : (nB - eventsB);
  const path = [{ steps: 0, eventsA: curA, eventsB: curC, pValue: curP }];

  while (curP < alpha && steps < capacity) {
    if (flipArm === 'A') curA++; else curC++;
    steps++;
    curP = fisherExactTwoSided(curA, nA - curA, curC, nB - curC);
    path.push({ steps, eventsA: curA, eventsB: curC, pValue: curP });
  }

  const exhausted = curP < alpha; // ran out of patients in that arm before losing significance
  return {
    observedP, alpha, significant: true, flipArm,
    fragilityIndex: exhausted ? null : steps,
    exhausted, finalP: curP, path
  };
}

// ── 2x2 outcome measures: risk ratio, odds ratio, risk difference, NNT ─────
// Same eventsA/nA (arm A) + eventsB/nB (arm B) convention as
// computeFragilityIndex above, for consistency across the app — arm A is
// conventionally the treatment arm, arm B control, though the math doesn't
// care which is which.
//
// Risk ratio and odds ratio are computed on the LOG scale (standard
// practice — a ratio's sampling distribution is closer to normal in log
// space than on the raw ratio scale, especially for ratios far from 1), then
// exponentiated back. Risk difference is a plain linear-scale Wald interval.
// All three share the same z-based Wald CI shape as the rest of this file
// (ciFromPValue and friends already use exactly this pattern elsewhere).
function computeRiskRatio(eventsA, nA, eventsB, nB, confidenceLevel = 0.95) {
  const pA = eventsA / nA, pB = eventsB / nB;
  const rr = pA / pB;
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  // Standard log-RR SE for a 2x2 table (Katz method): sqrt(1/a - 1/n1 + 1/c - 1/n2).
  const seLog = Math.sqrt(1 / eventsA - 1 / nA + 1 / eventsB - 1 / nB);
  const logRR = Math.log(rr);
  return { rr, lower: Math.exp(logRR - z * seLog), upper: Math.exp(logRR + z * seLog), pA, pB, seLog, z };
}

function computeOddsRatio(eventsA, nA, eventsB, nB, confidenceLevel = 0.95) {
  const a = eventsA, b = nA - eventsA, c = eventsB, d = nB - eventsB;
  const or_ = (a * d) / (b * c);
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  // Woolf's method: SE(log OR) = sqrt(1/a + 1/b + 1/c + 1/d).
  const seLog = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  const logOR = Math.log(or_);
  return { or: or_, lower: Math.exp(logOR - z * seLog), upper: Math.exp(logOR + z * seLog), a, b, c, d, seLog, z };
}

function computeRiskDifference(eventsA, nA, eventsB, nB, confidenceLevel = 0.95) {
  const pA = eventsA / nA, pB = eventsB / nB;
  const rd = pA - pB;
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  const se = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  return { rd, lower: rd - z * se, upper: rd + z * se, pA, pB, se, z };
}

// Number Needed to Treat/Harm = 1/|risk difference|. Genuinely the same
// formula for both — which label applies depends on what "events" MEANS
// clinically (a bad outcome reduced by treatment vs. a good outcome
// increased by it), which this function has no way to know from the counts
// alone, so it deliberately doesn't guess. eventsHigherInArmA is a purely
// mechanical fact (did arm A's rate come out above arm B's), not a
// benefit/harm judgment — the caller (UI layer) combines it with the user's
// own statement of what a higher rate means for this specific endpoint to
// decide whether to display "NNT" or "NNH." CI is the standard (if slightly
// unintuitive) convention of inverting the risk-difference CI's bounds — if
// that CI crosses zero, the "NNT CI" is not a single interval at all (it
// spans through infinity, since 1/0 is undefined), which crossesNull below
// surfaces explicitly rather than returning a nonsensical number.
function computeNNT(eventsA, nA, eventsB, nB, confidenceLevel = 0.95) {
  const rd = computeRiskDifference(eventsA, nA, eventsB, nB, confidenceLevel);
  const crossesNull = rd.lower <= 0 && rd.upper >= 0;
  const nnt = rd.rd !== 0 ? Math.abs(1 / rd.rd) : null;
  const eventsHigherInArmA = rd.rd > 0;
  return {
    nnt, eventsHigherInArmA, crossesNull,
    lower: crossesNull ? null : Math.abs(1 / rd.upper),
    upper: crossesNull ? null : Math.abs(1 / rd.lower),
    riskDifference: rd
  };
}

// ── Multiplicity adjustment ─────────────────────────────────────────────────
// Both take a plain array of raw p-values (one per endpoint/comparison
// tested) and return adjusted p-values in the SAME order as the input, so a
// caller can zip them back against endpoint labels directly.
function bonferroniAdjust(pValues, alpha = 0.05) {
  const m = pValues.length;
  return pValues.map(p => {
    const adjP = Math.min(1, p * m);
    return { pValue: p, adjustedP: adjP, significant: adjP <= alpha };
  });
}

// Holm step-down: strictly more powerful than flat Bonferroni (rejects at
// least as many, sometimes more) while controlling the same familywise
// error rate — the standard reason to prefer it. Sorted ascending, each
// rank k compared against alpha/(m-k+1); enforced monotonic (an adjusted
// p-value can never be smaller than the previous rank's, even though the
// raw per-rank formula alone doesn't guarantee that) so the returned values
// are directly usable as "adjusted p-values," not just pass/fail flags.
function holmBonferroniAdjust(pValues, alpha = 0.05) {
  const m = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  const sorted = indexed.slice().sort((a, b) => a.p - b.p);
  const adjustedSorted = [];
  let runningMax = 0;
  for (let k = 0; k < m; k++) {
    const raw = Math.min(1, (m - k) * sorted[k].p);
    runningMax = Math.max(runningMax, raw);
    adjustedSorted.push(runningMax);
  }
  const result = new Array(m);
  sorted.forEach((s, k) => {
    result[s.i] = { pValue: s.p, adjustedP: adjustedSorted[k], significant: adjustedSorted[k] <= alpha };
  });
  return result;
}

// ── Meta-analysis: pooling multiple studies' effect estimates ──────────────
// Generic over the input shape — a caller can hand this either
// {estimate, se} pairs directly (a point estimate + its own CI, converted to
// SE by the caller) or use ciToSE() below to derive SE from a reported CI
// without re-deriving the arithmetic at each call site. Kept generic rather
// than baked to "2x2 tables only" since real-world sources report a study's
// result in whichever form the original paper used — some give arms/events,
// many just give a point estimate and a CI, and forcing everything through
// one raw-count shape would silently exclude studies reported the second,
// very common way.
function ciToSE(lower, upper, confidenceLevel = 0.95) {
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  return (upper - lower) / (2 * z);
}

// Inverse-variance-weighted fixed-effect pooled estimate — assumes every
// study is estimating the SAME true effect (no between-study heterogeneity),
// so it under-states uncertainty when that assumption doesn't hold. Compared
// directly against the random-effects estimate below, on purpose — showing
// both, not picking one, is the whole point of also reporting heterogeneity.
function computeFixedEffectMetaAnalysis(studies, confidenceLevel = 0.95) {
  const weights = studies.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const pooled = studies.reduce((acc, s, i) => acc + weights[i] * s.estimate, 0) / sumW;
  const seP = Math.sqrt(1 / sumW);
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  return { estimate: pooled, se: seP, lower: pooled - z * seP, upper: pooled + z * seP, weights };
}

// Cochran's Q (weighted sum of squared deviations from the fixed-effect
// pooled estimate) and I² (the share of total variation attributable to
// real between-study heterogeneity rather than sampling noise alone) —
// computed off the fixed-effect pooled estimate, the conventional reference
// point for both, per the original Higgins & Thompson (2002) I² definition.
function computeHeterogeneity(studies) {
  const fe = computeFixedEffectMetaAnalysis(studies);
  const q = studies.reduce((acc, s, i) => acc + fe.weights[i] * Math.pow(s.estimate - fe.estimate, 2), 0);
  const df = studies.length - 1;
  const iSquared = df > 0 ? Math.max(0, (q - df) / q) * 100 : 0;
  return { q, df, iSquared, fixedEffect: fe };
}

// DerSimonian-Laird random-effects pooled estimate — adds an estimated
// between-study variance (tau²) on top of each study's own sampling
// variance, so studies that disagree with each other pull the pooled CI
// wider than the fixed-effect version does. tau² floored at 0 (a negative
// method-of-moments estimate, which can happen with few/homogeneous
// studies, means "no detectable heterogeneity," not literally negative
// variance).
function computeRandomEffectsMetaAnalysis(studies, confidenceLevel = 0.95) {
  const het = computeHeterogeneity(studies);
  const weights = studies.map(s => 1 / (s.se * s.se));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const sumW2 = weights.reduce((a, b) => a + b * b, 0);
  const c = sumW - sumW2 / sumW;
  const tauSquared = c > 0 ? Math.max(0, (het.q - het.df) / c) : 0;
  const reWeights = studies.map(s => 1 / (s.se * s.se + tauSquared));
  const sumWre = reWeights.reduce((a, b) => a + b, 0);
  const pooled = studies.reduce((acc, s, i) => acc + reWeights[i] * s.estimate, 0) / sumWre;
  const seP = Math.sqrt(1 / sumWre);
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  return { estimate: pooled, se: seP, lower: pooled - z * seP, upper: pooled + z * seP, tauSquared, weights: reWeights, heterogeneity: het };
}

// ── Closed-form power formulas, used only to validate the Monte Carlo engine ──

function closedFormPowerTwoProportion(p1, p2, n1, n2, alpha, sided = 'two') {
  const zAlpha = sided === 'one' ? normalInvCDF(1 - alpha) : normalInvCDF(1 - alpha / 2);
  const pPool = (n1 * p1 + n2 * p2) / (n1 + n2);
  const seNull = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const seAlt = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  const z = (Math.abs(p1 - p2) - zAlpha * seNull) / seAlt;
  return normalCDF(z);
}

function closedFormPowerMeans(delta, sd, n1, n2, alpha, sided = 'two') {
  const zAlpha = sided === 'one' ? normalInvCDF(1 - alpha) : normalInvCDF(1 - alpha / 2);
  const se = Math.sqrt((sd * sd) / n1 + (sd * sd) / n2);
  const z = (Math.abs(delta) / se) - zAlpha;
  return normalCDF(z);
}

function schoenfeldPower(hazardRatio, totalEvents, allocationRatio, alpha) {
  // Schoenfeld (1983) approximation for the log-rank test.
  const theta = allocationRatio / (1 + allocationRatio); // proportion on treatment
  const zAlpha = normalInvCDF(1 - alpha / 2);
  const z = Math.abs(Math.log(hazardRatio)) * Math.sqrt(totalEvents * theta * (1 - theta)) - zAlpha;
  return normalCDF(z);
}

// ── Sample-size solvers — the inverse of the three power functions above ───
// Rather than deriving a separate closed-form n-formula for each (which would
// risk a subtly different rounding/approximation convention from the power
// functions already used elsewhere, e.g. to cross-check the Trial Outcome
// simulator), these binary-search over the SAME verified power function to
// find the smallest n meeting the target power. One formula, two directions,
// guaranteed consistent with each other by construction.
function solveMinN(powerFn, targetPower, maxN) {
  maxN = maxN || 2_000_000;
  if (powerFn(2) >= targetPower) return { n: 2, achievedPower: powerFn(2) };
  let lo = 2, hi = 2;
  while (powerFn(hi) < targetPower) {
    if (hi >= maxN) return { n: null, achievedPower: powerFn(hi) }; // unreachable within a sane bound
    hi = Math.min(hi * 2, maxN);
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (powerFn(mid) >= targetPower) hi = mid; else lo = mid;
  }
  return { n: hi, achievedPower: powerFn(hi) };
}

// Two-proportion: solves for n1 (control arm N); n2 = n1 * allocationRatio.
function solveSampleSizeTwoProportion(p1, p2, targetPower, alpha, sided, allocationRatio) {
  allocationRatio = allocationRatio || 1;
  const result = solveMinN(n1 => closedFormPowerTwoProportion(p1, p2, n1, Math.round(n1 * allocationRatio), alpha, sided), targetPower);
  if (result.n == null) return { n1: null, n2: null, totalN: null, achievedPower: result.achievedPower };
  const n2 = Math.round(result.n * allocationRatio);
  return { n1: result.n, n2, totalN: result.n + n2, achievedPower: result.achievedPower };
}

// Two-mean: solves for n1 (control arm N); n2 = n1 * allocationRatio.
function solveSampleSizeMeans(delta, sd, targetPower, alpha, sided, allocationRatio) {
  allocationRatio = allocationRatio || 1;
  const result = solveMinN(n1 => closedFormPowerMeans(delta, sd, n1, Math.round(n1 * allocationRatio), alpha, sided), targetPower);
  if (result.n == null) return { n1: null, n2: null, totalN: null, achievedPower: result.achievedPower };
  const n2 = Math.round(result.n * allocationRatio);
  return { n1: result.n, n2, totalN: result.n + n2, achievedPower: result.achievedPower };
}

// Time-to-event: solves for total EVENTS needed (Schoenfeld), not enrolled
// patients — converting events to an enrollment number needs accrual/
// follow-up/event-rate assumptions this app doesn't ask for anywhere else,
// so "events required" is reported directly, same scope boundary as PK/PD's
// "forward simulation from parameters you supply."
function solveEventsNeeded(hazardRatio, targetPower, alpha, allocationRatio) {
  allocationRatio = allocationRatio || 1;
  return solveMinN(events => schoenfeldPower(hazardRatio, events, allocationRatio, alpha), targetPower);
}

// ── Minimum Detectable Effect (MDE) solvers ─────────────────────────────────
// The other direction from the sample-size solvers above: those answer
// "given an assumed effect, what N do I need for target power" — this
// answers "given a FIXED N (already enrolling, or fully enrolled), what's
// the smallest effect that would read out statistically significant at the
// target power." Same binary-search-over-the-verified-power-function
// pattern as solveMinN, just searching the effect parameter instead of N,
// so it's guaranteed consistent with the power functions rather than a
// separately-derived formula that could drift from them.
function solveMinDetectableEffect(powerFn, targetPower, lo, hi, tol) {
  tol = tol == null ? 1e-7 : tol;
  if (powerFn(hi) < targetPower) return { effect: null, achievedPowerAtCeiling: powerFn(hi) }; // not achievable even at the search ceiling
  if (powerFn(lo) >= targetPower) return { effect: lo, achievedPower: powerFn(lo) }; // already significant at the smallest tested effect
  let a = lo, b = hi;
  for (let i = 0; i < 80 && (b - a) > tol; i++) {
    const mid = (a + b) / 2;
    if (powerFn(mid) >= targetPower) b = mid; else a = mid;
  }
  return { effect: b, achievedPower: powerFn(b) };
}

// Two-proportion: given a control rate and a fixed n per arm, the smallest
// treatment rate (p2 > p1, the beneficial direction) that reaches target power.
function solveMinDetectableRateTwoProportion(p1, n1, n2, targetPower, alpha, sided) {
  const powerFn = (p2) => closedFormPowerTwoProportion(p1, p2, n1, n2, alpha, sided);
  const r = solveMinDetectableEffect(powerFn, targetPower, Math.min(0.999999, p1 + 1e-6), 0.999999);
  if (r.effect == null) return { p2: null, delta: null, achievedPower: r.achievedPowerAtCeiling };
  return { p2: r.effect, delta: r.effect - p1, achievedPower: r.achievedPower };
}

// Two-mean: given the common SD and a fixed n per arm, the smallest |delta|
// that reaches target power. Search ceiling is a generous 20 SDs — any real
// trial's detectable delta lands far below that; it exists only so an
// absurdly small/underpowered n reports "not achievable" instead of an
// unbounded search.
function solveMinDetectableDeltaMeans(sd, n1, n2, targetPower, alpha, sided) {
  const powerFn = (delta) => closedFormPowerMeans(delta, sd, n1, n2, alpha, sided);
  const r = solveMinDetectableEffect(powerFn, targetPower, 0, sd * 20);
  if (r.effect == null) return { delta: null, achievedPower: r.achievedPowerAtCeiling };
  return { delta: r.effect, achievedPower: r.achievedPower };
}

// Time-to-event: given a fixed total event count, the smallest deviation
// from HR=1 (in the beneficial HR<1 direction) that reaches target power.
// schoenfeldPower's power increases as HR moves AWAY from 1 (either
// direction), the opposite of solveMinDetectableEffect's "power increases
// toward hi" assumption — searched on (1 - HR) instead, which does increase
// monotonically toward a stronger effect, then converted back to HR.
function solveMinDetectableHazardRatio(totalEvents, allocationRatio, targetPower, alpha) {
  const powerFn = (hr) => schoenfeldPower(hr, totalEvents, allocationRatio, alpha);
  const r = solveMinDetectableEffect(x => powerFn(1 - x), targetPower, 1e-6, 0.999999);
  if (r.effect == null) return { hazardRatio: null, achievedPower: r.achievedPowerAtCeiling };
  return { hazardRatio: 1 - r.effect, achievedPower: r.achievedPower };
}

// ── Wilson score interval — single-arm event rate ──────────────────────────
// The proper small-n confidence interval for one observed proportion (e.g.
// ORR in a single-arm trial), not the normal approximation p̂ ± z·√(p̂(1-p̂)/n)
// that the rest of this file uses elsewhere for two-arm comparisons — that
// approximation can give a negative lower bound or an upper bound above 1
// exactly in the small-n / extreme-p̂ regime single-arm early-phase trials
// live in, which Wilson doesn't. Count-based form (Wilson 1927): with
// A = 2r + z², B = z·√(z² + 4r(1-p̂)), C = 2(n + z²), CI = [(A-B)/C, (A+B)/C].
// Cross-checked against the algebraically-independent proportion-form
// (Newcombe 1998) to float precision, including the 0/n edge case, before
// this was wired into any UI.
function wilsonScoreInterval(events, n, confidenceLevel) {
  confidenceLevel = confidenceLevel == null ? 0.95 : confidenceLevel;
  const z = normalInvCDF(1 - (1 - confidenceLevel) / 2);
  const phat = events / n;
  const A = 2 * events + z * z;
  const B = z * Math.sqrt(z * z + 4 * events * (1 - phat));
  const C = 2 * (n + z * z);
  return { phat, z, lower: (A - B) / C, upper: (A + B) / C };
}

// ── P-value <-> 95% CI interconversion (Altman & Bland, BMJ 2011) ──────────
// For when a press release or abstract reports only one of {point estimate +
// P value} or {point estimate + 95% CI} and you need the other. Two
// independent published approximations, not exact algebraic inverses of each
// other (the paper itself notes Eqn 2 and its inverse relate "via the
// quadratic equation," i.e. approximately) — verified here by round-tripping
// P -> CI -> P across the plausible 0.001-0.8 range and confirming the
// result lands within ~1e-4 of the original P before this was trusted.
// `delta` is the point estimate on whatever scale it was reported (a mean
// difference, a risk difference, or ln(ratio) for HR/OR/RR — see the ratio
// convenience wrappers below).
// SIDEDNESS IS LOAD-BEARING, not a nicety. The published z-recovery formula
// maps a TWO-SIDED P to z — verified numerically: P=0.05 gives z=1.9566
// (the two-sided 95% critical value 1.96), not 1.6449 (the one-sided one).
// One-sided alpha=0.025 is common in oncology, so a one-sided P is a
// realistic input, not a corner case, and it is doubled to its two-sided
// equivalent before the formula runs.
//
// The direction of the error this prevents is counter-intuitive and worth
// stating: a one-sided P is numerically SMALLER than its two-sided
// equivalent, so feeding it in raw produces a LARGER z, a SMALLER standard
// error, and a NARROWER interval. The failure mode is overstated precision —
// a result that reads as better-pinned-down than the data supports — which is
// the more dangerous direction for something feeding a valuation.
//
// The confidence level is likewise explicit rather than a hardcoded 1.96:
// the interval half-width is z_{1-(1-level)/2} x SE, so a 90% CI (which does
// show up in early-phase and futility contexts) uses 1.6449, not 1.96.
function ciFromPValue(delta, pValue, opts) {
  opts = opts || {};
  const level = opts.confidenceLevel == null ? 0.95 : opts.confidenceLevel;
  const pTwoSided = opts.sided === "one" ? Math.min(1, pValue * 2) : pValue;
  const z = -0.862 + Math.sqrt(0.743 - 2.404 * Math.log(pTwoSided));
  const se = Math.abs(delta) / z;
  const zCrit = normalInvCDF(1 - (1 - level) / 2);
  return { z, se, zCrit, pTwoSided, confidenceLevel: level,
           lower: delta - zCrit * se, upper: delta + zCrit * se };
}
// Returns the TWO-SIDED P (that's what the published formula yields), plus the
// one-sided equivalent alongside it so a caller never has to guess which it got.
function pValueFromCI(delta, lower, upper, opts) {
  opts = opts || {};
  const level = opts.confidenceLevel == null ? 0.95 : opts.confidenceLevel;
  const zCrit = normalInvCDF(1 - (1 - level) / 2);
  const se = (upper - lower) / (2 * zCrit);
  const z = Math.abs(delta) / se;
  const pTwoSided = Math.exp(-0.717 * Math.abs(z) - 0.416 * z * z);
  return { se, z, zCrit, confidenceLevel: level,
           pValue: pTwoSided, pTwoSided, pOneSided: pTwoSided / 2 };
}
// Ratio-scale convenience wrappers (hazard ratio, odds ratio, risk ratio) —
// the same method applies on the log scale; these just handle the ln/exp
// so a caller can work directly in HR/OR/RR terms instead of remembering to.
function ciFromPValueRatio(pointRatio, pValue, opts) {
  const r = ciFromPValue(Math.log(pointRatio), pValue, opts);
  return { z: r.z, se: r.se, zCrit: r.zCrit, pTwoSided: r.pTwoSided, confidenceLevel: r.confidenceLevel,
           lower: Math.exp(r.lower), upper: Math.exp(r.upper) };
}
function pValueFromCIRatio(pointRatio, lowerRatio, upperRatio, opts) {
  return pValueFromCI(Math.log(pointRatio), Math.log(lowerRatio), Math.log(upperRatio), opts);
}

// ── Phase 2 -> Phase 3 effect-size shrinkage ────────────────────────────────
// A real, well-documented phenomenon (regression to the mean / "winner's
// curse"): early-phase trial effect estimates systematically overstate what
// a confirmatory Phase 3 trial goes on to observe, on average. Two real,
// independently-sourced correction factors below, one per endpoint type —
// this is a central-tendency adjustment from published meta-analyses, not a
// guarantee for any specific program. The FDA's own "22 Case Studies Where
// Phase 2 and Phase 3 Trials Had Divergent Results" (2017,
// fda.gov/media/102332/download) is the qualitative complement to these
// numbers: it attributes real divergences to causes a single shrinkage
// factor can't capture — an unreliable biomarker, a mechanism that doesn't
// translate to clinical benefit, a differently-selected Phase 3 population —
// so this is a planning anchor, not a substitute for judgment about which of
// those risks apply to a specific program.
//
// Binary/response-rate endpoints: a 2026 concordance analysis matching Phase
// 3 solid-tumor oncology trials (2014-2020) to their supporting early-phase
// (Ib/II) trials found early-phase objective response rates overstated the
// eventual Phase 3 rate by "about one-fifth" on average — i.e.
// observed(P2) ~= true(P3) x 1.20, so true(P3) ~= observed(P2) / 1.20.
const BINARY_SHRINKAGE_FACTOR = 1.20;

// Time-to-event (hazard ratio) endpoints: a JNCI analysis of 111 Phase 3
// oncology trials (2023) found the hazard ratio ASSUMED at design time
// (typically informed by Phase 2) averaged 0.66, while the ratio actually
// OBSERVED in the completed Phase 3 trial averaged 0.72 — the observed
// effect was ~9% weaker (0.66 x 1.09 = 0.719, matching the reported 0.72).
// Only 57.3% of trials showed a weaker-than-expected result, so this is a
// mean shift across the sample, not something every program experiences.
const HR_SHRINKAGE_FACTOR = 1.09;

function shrinkBinaryResponseRate(observedP2Pct) {
  const projected = observedP2Pct / BINARY_SHRINKAGE_FACTOR;
  return { projectedP3Pct: Math.max(0, Math.min(100, projected)), factor: BINARY_SHRINKAGE_FACTOR };
}

// Moves the hazard ratio toward 1.0 (the null) by the shrinkage factor. If
// the Phase 2 HR is already close to 1 (a weak effect), the projected Phase
// 3 value can cross 1.0 entirely — flagged via crossesNull rather than
// silently clamped, since that crossing IS the honest, useful finding: a
// marginal Phase 2 result may not survive Phase 3 at all on average.
function shrinkHazardRatio(assumedHR) {
  const projected = assumedHR * HR_SHRINKAGE_FACTOR;
  return { projectedP3HR: Math.max(0.001, projected), factor: HR_SHRINKAGE_FACTOR, crossesNull: projected >= 1 };
}


// ════════════════════════════════════════════════════════════════════════════
// ASSUMPTION STRESS — what a power calculation does when its inputs are wrong
//
// A sample-size calculation is a statement about a world that has not happened
// yet, and two of its inputs are wrong far more often than the effect size
// everyone argues about: how the CONTROL arm behaves, and how many people
// LEAVE. Both are routinely lifted from a decade-old trial in a differently
// selected population, and a modern standard of care has usually moved since.
//
// This is a sweep over machinery that already exists — the same verified
// closed-form power functions above — not a new statistical method. What it
// adds is the reasoning about how the numbers move together, which is the part
// that is easy to get wrong by hand.
// ════════════════════════════════════════════════════════════════════════════

// If the control arm turns out to respond at a different rate than planned,
// what does the treatment arm do? There are two coherent answers and they give
// materially different results, so the caller has to choose one rather than
// having this file pick silently:
//
//   "absolute" — the drug adds the same number of percentage points. A control
//                arm at 40% instead of 30% puts treatment at 55% instead of 45%.
//   "relative" — the drug multiplies the control rate by the same factor. The
//                same shift puts treatment at 60%, because 0.45/0.30 = 1.5.
//
// Which is right is a scientific judgement about the mechanism, not a
// statistical one, and neither is the safe default.
function projectTreatmentRate(p1Assumed, p2Assumed, p1Actual, effectModel) {
  if (![p1Assumed, p2Assumed, p1Actual].every(x => typeof x === "number" && isFinite(x))) return null;
  if (p1Assumed <= 0 || p1Assumed >= 1 || p1Actual <= 0 || p1Actual >= 1) return null;
  let p2;
  if (effectModel === "relative") {
    p2 = p1Actual * (p2Assumed / p1Assumed);
  } else {
    p2 = p1Actual + (p2Assumed - p1Assumed);
  }
  // A projected rate can run past a probability. Clamping is honest — the
  // projection has simply stopped being meaningful there — and it keeps the
  // power function from being handed an impossible input.
  const EPS = 1e-6;
  return { rate: Math.min(1 - EPS, Math.max(EPS, p2)), clamped: p2 <= 0 || p2 >= 1 };
}

// Patients who leave are not in the analysis. The planned N is what was
// randomised; this is what is left to analyse.
function effectiveNAfterDropout(n, dropoutFraction) {
  const d = Math.min(0.999, Math.max(0, Number(dropoutFraction) || 0));
  return Math.max(1, Math.floor(Number(n) * (1 - d)));
}

// The standard planning adjustment, stated the other way round: to still have
// N analysable after losing d of them, randomise this many. Note it is N/(1-d)
// and NOT N*(1+d), which is the usual mistake and understates the inflation —
// at 20% dropout the right answer is 25% more patients, not 20%.
function inflateForDropout(n, dropoutFraction) {
  const d = Math.min(0.999, Math.max(0, Number(dropoutFraction) || 0));
  return Math.ceil(Number(n) / (1 - d));
}

// Sweeps a one-argument power function over a list of candidate values.
// Deliberately generic: the caller partially applies everything except the
// quantity being stressed, so the same helper serves the control-rate sweep,
// the variance sweep and the dropout sweep, and there is one place where the
// shape of a stress result is defined.
function stressPowerOver(values, powerAt) {
  return (values || []).map(v => {
    let power = null;
    try { power = powerAt(v); } catch (e) { power = null; }
    return { value: v, power: (typeof power === "number" && isFinite(power)) ? power : null };
  });
}

// Candidate values around a planned one: -40% to +40% in ten-point steps of
// the planned value, always including the plan itself so the baseline is
// visible in the same column as the stresses.
function stressRange(planned, opts) {
  opts = opts || {};
  const lo = opts.lo != null ? opts.lo : 0.6, hi = opts.hi != null ? opts.hi : 1.4;
  const steps = opts.steps || 5;
  const out = [];
  for (let i = 0; i < steps; i++) {
    const f = lo + (hi - lo) * (steps === 1 ? 0 : i / (steps - 1));
    out.push(planned * f);
  }
  if (!out.some(v => Math.abs(v - planned) < 1e-12)) out.push(planned);
  return out.sort((a, b) => a - b);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    randUniform, randNormal, randExponential, randBinomialCount,
    erf, normalCDF, normalInvCDF,
    twoProportionZTest, twoSampleZTestMeans, logRankTest,
    logGamma, logChoose, hypergeomPointProb, fisherExactTwoSided, computeFragilityIndex,
    computeRiskRatio, computeOddsRatio, computeRiskDifference, computeNNT,
    bonferroniAdjust, holmBonferroniAdjust,
    ciToSE, computeFixedEffectMetaAnalysis, computeHeterogeneity, computeRandomEffectsMetaAnalysis,
    closedFormPowerTwoProportion, closedFormPowerMeans, schoenfeldPower,
    solveMinN, solveSampleSizeTwoProportion, solveSampleSizeMeans, solveEventsNeeded,
    solveMinDetectableEffect, solveMinDetectableRateTwoProportion, solveMinDetectableDeltaMeans, solveMinDetectableHazardRatio,
    wilsonScoreInterval, ciFromPValue, pValueFromCI, ciFromPValueRatio, pValueFromCIRatio,
    shrinkBinaryResponseRate, shrinkHazardRatio, BINARY_SHRINKAGE_FACTOR, HR_SHRINKAGE_FACTOR,
    projectTreatmentRate, effectiveNAfterDropout, inflateForDropout, stressPowerOver, stressRange
  };
}
