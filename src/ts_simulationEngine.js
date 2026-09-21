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

  const subjects = [];
  const totalN = design.nControl + design.nTreat;
  for (let i = 0; i < totalN; i++) {
    const arm = i < design.nTreat ? 1 : 0; // 1 = treatment, 0 = control
    const entryTime = STATS.randUniform(0, design.accrualPeriod);
    const rate = arm === 1 ? rateTreat : rateControl;
    const survivalTime = STATS.randExponential(rate);
    const studyEnd = design.accrualPeriod + design.followupPeriod;
    const observedTime = Math.min(survivalTime, Math.max(0, studyEnd - entryTime));
    const event = survivalTime <= (studyEnd - entryTime) ? 1 : 0;
    subjects.push({ time: observedTime, event, arm });
  }
  const { pValue, O1, E1 } = STATS.logRankTest(subjects);
  const observedHR = (O1 > 0 && E1 > 0) ? (O1 / E1) : NaN; // rough observed-vs-expected ratio, directional only
  return { pValue, observedEffect: observedHR, totalEvents: subjects.filter(s => s.event === 1).length };
}

const REPLICATORS = {
  binary: simulateBinaryReplicate,
  continuous: simulateContinuousReplicate,
  timeToEvent: simulateTimeToEventReplicate
};

// ── The Monte Carlo loop itself ─────────────────────────────────────────────

function runAssuranceSimulation(config) {
  const { endpointType, design, prior, alpha, sided = 'two', iterations = 10000 } = config;
  const replicate = REPLICATORS[endpointType];
  if (!replicate) throw new Error('Unknown endpoint type: ' + endpointType);
  design.sided = sided; // threaded through to the test functions

  let hits = 0;
  const observedEffects = [];
  for (let i = 0; i < iterations; i++) {
    const trueEffect = samplePrior(prior);
    const { pValue, observedEffect } = replicate(design, trueEffect);
    const isHit = alpha ? (pValue < alpha) : false;
    if (isHit) hits++;
    observedEffects.push(observedEffect);
  }

  const pos = hits / iterations;
  const posStdErr = Math.sqrt(pos * (1 - pos) / iterations);

  // Conditional power at fixed prior quantiles, as a closed-form cross-check
  // context (not itself simulated) — helps show *why* the assurance landed
  // where it did relative to the assumed uncertainty.
  const conditional = {};
  for (const q of [0.1, 0.5, 0.9]) {
    conditional[q] = priorQuantile(prior, q);
  }

  return {
    pos,
    posStdErr,
    iterations,
    conditionalEffectQuantiles: conditional,
    observedEffects // caller bins this into a histogram for display
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    samplePrior, priorQuantile,
    simulateBinaryReplicate, simulateContinuousReplicate, simulateTimeToEventReplicate,
    runAssuranceSimulation
  };
}
