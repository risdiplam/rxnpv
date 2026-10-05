// ════════════════════════════════════════════════════════════════════════════
// TrialSim — SIMULATION ENGINE
// The Bayesian-assurance Monte Carlo loop: draw a true effect from the prior,
// simulate one trial dataset under that effect, run the real test, record the
// hit. Repeated many times, the hit rate is the PoS. Depends on statsEngine.js
// being loaded first (plain-script concatenation, same as RxNPV).
// ════════════════════════════════════════════════════════════════════════════

const STATS = (typeof module !== 'undefined' && module.exports) ? require('./ts_statsEngine.js') : this;

// ── Effect-size prior sampling ──────────────────────────────────────────────
// prior = { type: 'point', value } or { type: 'normal', mean, sd }
function samplePrior(prior) {
  if (prior.type === 'point') return prior.value;
  if (prior.type === 'normal') return STATS.randNormal(prior.mean, prior.sd);
  throw new Error('Unknown prior type: ' + prior.type);
}

function priorQuantile(prior, q) {
  if (prior.type === 'point') return prior.value;
  if (prior.type === 'normal') return prior.mean + prior.sd * STATS.normalInvCDF(q);
  throw new Error('Unknown prior type: ' + prior.type);
}

// ── One simulated trial replicate per endpoint type ─────────────────────────
// Each returns { pValue, observedEffect }

function simulateBinaryReplicate(design, trueEffect) {
  // trueEffect is treated as the true treatment-arm response rate; control
  // rate is fixed at design.controlRate. trueEffect is clamped to [0,1].
  const pTreat = Math.min(1, Math.max(0, trueEffect));
  const pControl = design.controlRate;
  const xTreat = STATS.randBinomialCount(design.nTreat, pTreat);
  const xControl = STATS.randBinomialCount(design.nControl, pControl);
  const { pValue } = STATS.twoProportionZTest(xTreat, design.nTreat, xControl, design.nControl, design.sided);
  return { pValue, observedEffect: (xTreat / design.nTreat) - (xControl / design.nControl) };
}

function simulateContinuousReplicate(design, trueEffect) {
  // trueEffect is the true mean difference (treatment - control); design.sd
  // is the assumed common SD, design.controlMean anchors the control arm.
  const controlMean = design.controlMean;
  const treatMean = controlMean + trueEffect;
  const sampleMean = (n, mu, sd) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += STATS.randNormal(mu, sd);
    return sum / n;
  };
  const obsControl = sampleMean(design.nControl, controlMean, design.sd);
  const obsTreat = sampleMean(design.nTreat, treatMean, design.sd);
  const { pValue } = STATS.twoSampleZTestMeans(obsTreat, design.sd, design.nTreat, obsControl, design.sd, design.nControl, design.sided);
  return { pValue, observedEffect: obsTreat - obsControl };
}

function simulateTimeToEventReplicate(design, trueEffect) {
  // trueEffect is the true hazard ratio (treatment vs control). Exponential
  // baseline hazard from design.medianControl, administrative censoring at
  // design.accrualPeriod + design.followupPeriod after each subject's entry.
  const hazardRatio = Math.max(1e-6, trueEffect);
  const rateControl = Math.log(2) / design.medianControl;
  const rateTreat = rateControl * hazardRatio;
  // Delayed separation (October 2026): for the first delayMonths after
  // randomisation the treatment arm has the control hazard; after that,
  // control × HR. The exponential is memoryless, so a treated patient still
  // event-free at the delay draws the rest of their time at the new rate.
  // 0 (or blank) is the proportional-hazards model from day one.
  const delay = Math.max(0, Number(design.delayMonths) || 0);
  const drawTreat = () => {
    if (!(delay > 0)) return STATS.randExponential(rateTreat);
    const t0 = STATS.randExponential(rateControl);
    return t0 <= delay ? t0 : delay + STATS.randExponential(rateTreat);
  };

  const subjects = [];
  const eventClock = []; // calendar time of every event if follow-up went on (readout timing)
  const totalN = design.nControl + design.nTreat;
  for (let i = 0; i < totalN; i++) {
    const arm = i < design.nTreat ? 1 : 0; // 1 = treatment, 0 = control
    const entryTime = STATS.randUniform(0, design.accrualPeriod);
    const survivalTime = arm === 1 ? drawTreat() : STATS.randExponential(rateControl);
    if (design.targetEvents > 0) eventClock.push(entryTime + survivalTime);
    const studyEnd = design.accrualPeriod + design.followupPeriod;
    const observedTime = Math.min(survivalTime, Math.max(0, studyEnd - entryTime));
    const event = survivalTime <= (studyEnd - entryTime) ? 1 : 0;
    subjects.push({ time: observedTime, event, arm });
  }
  const { pValue, O1, E1 } = STATS.logRankTest(subjects);
  // The log-rank estimate of the hazard ratio: each arm's observed/expected,
  // treatment over control. O1/E1 alone (what this was) sits between the HR
  // and 1 — ~0.84 for a true 0.70 — so the assurance histogram read as
  // trials seeing a weaker effect than the truth. Every event is expected in
  // one arm or the other, so O2 = D - O1 and E2 = D - E1.
  const D = subjects.filter(s => s.event === 1).length;
  const O2 = D - O1, E2 = D - E1;
  const observedHR = (O1 > 0 && E1 > 0 && O2 > 0 && E2 > 0) ? (O1 / E1) / (O2 / E2) : NaN;
  // Readout timing: months from the first patient in to the target'th event,
  // had the trial kept following everyone (Infinity if there are fewer
  // patients than the target).
  let timeToTarget = null;
  if (design.targetEvents > 0) {
    eventClock.sort((a, b) => a - b);
    timeToTarget = design.targetEvents <= eventClock.length ? eventClock[design.targetEvents - 1] : Infinity;
  }
  return { pValue, observedEffect: observedHR, totalEvents: D, timeToTarget };
}

const REPLICATORS = {
  binary: simulateBinaryReplicate,
  continuous: simulateContinuousReplicate,
  timeToEvent: simulateTimeToEventReplicate
};

// One quotable line under the assurance histogram (October 2026): the
// median simulated effect, and for a hazard ratio how often a run came out
// worse than 0.90 and than 1.00 — so two priors with the same hit rate but
// different effects read differently. Pure; the caller writes the words.
function summarizeObservedEffects(effects, endpointType) {
  const xs = (effects || []).filter(v => isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const median = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  const share = f => xs.filter(f).length / xs.length;
  return endpointType === 'timeToEvent'
    ? { median, worseThan090: share(v => v > 0.9), worseThan100: share(v => v > 1), n: xs.length }
    : { median, n: xs.length };
}

// ── The Monte Carlo loop itself ─────────────────────────────────────────────

function runAssuranceSimulation(config) {
  const { endpointType, design, prior, alpha, sided = 'two', iterations = 10000 } = config;
  const replicate = REPLICATORS[endpointType];
  if (!replicate) throw new Error('Unknown endpoint type: ' + endpointType);
  design.sided = sided; // threaded through to the test functions

  // The direction the prior expects: a treated response rate above the
  // control's, a positive mean difference, a hazard ratio below 1. A two-
  // sided test also counts a significant result the other way as a "hit";
  // posDirectional counts only wins in the expected direction, which is what
  // a trial succeeding means (and what "Use as this case's odds" reads).
  const priorMean = prior.type === 'point' ? prior.value : prior.mean;
  const expected = endpointType === 'binary' ? priorMean - design.controlRate
    : endpointType === 'continuous' ? priorMean : 1 - priorMean;
  const towardBenefit = v => (endpointType === 'timeToEvent' ? 1 - v : v);
  let hits = 0, directionalHits = 0;
  const observedEffects = [];
  const targetTimes = [];
  for (let i = 0; i < iterations; i++) {
    const trueEffect = samplePrior(prior);
    const { pValue, observedEffect, timeToTarget } = replicate(design, trueEffect);
    if (timeToTarget != null) targetTimes.push(timeToTarget);
    const isHit = alpha ? (pValue < alpha) : false;
    if (isHit) {
      hits++;
      if (expected !== 0 && isFinite(observedEffect) && Math.sign(towardBenefit(observedEffect)) === Math.sign(expected)) directionalHits++;
    }
    observedEffects.push(observedEffect);
  }

  const pos = hits / iterations;
  const posDirectional = expected !== 0 && isFinite(expected) ? directionalHits / iterations : null;
  const posStdErr = Math.sqrt(pos * (1 - pos) / iterations);

  // Conditional power at fixed prior quantiles, as a closed-form cross-check
  // context (not itself simulated) — helps show *why* the assurance landed
  // where it did relative to the assumed uncertainty.
  const conditional = {};
  for (const q of [0.1, 0.5, 0.9]) {
    conditional[q] = priorQuantile(prior, q);
  }

  // When the target event count lands: median and 10th/90th percentiles of
  // the months from first patient in, and the share of runs that do not get
  // there inside the planned accrual + follow-up.
  let readoutTiming = null;
  if (targetTimes.length) {
    const sorted = targetTimes.slice().sort((a, b) => a - b);
    const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const planEnd = design.accrualPeriod + design.followupPeriod;
    readoutTiming = { targetEvents: design.targetEvents, median: q(0.5), p10: q(0.1), p90: q(0.9),
      neverShare: sorted.filter(t => !(t <= planEnd)).length / sorted.length, planEnd };
  }

  return {
    pos,
    posStdErr,
    posDirectional,
    readoutTiming,
    iterations,
    conditionalEffectQuantiles: conditional,
    observedEffects // caller bins this into a histogram for display
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    samplePrior, priorQuantile,
    simulateBinaryReplicate, simulateContinuousReplicate, simulateTimeToEventReplicate,
    runAssuranceSimulation, summarizeObservedEffects
  };
}
