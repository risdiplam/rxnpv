// ════════════════════════════════════════════════════════════════════════════
// TrialSim — PEAK SALES ENGINE
// Monte Carlo over the commercial assumption chain: addressable population →
// diagnosis rate → treatment rate → peak market share → annual price. Each
// input can be a point value or a distribution; sampling all of them jointly
// and propagating through the same multiplication RxNPV's revenue build
// already uses turns "here's my single peak-sales guess" into an actual
// distribution driven by which assumptions are shakiest.
// ════════════════════════════════════════════════════════════════════════════

const PEAK_STATS = (typeof module !== 'undefined' && module.exports) ? require('./ts_statsEngine.js') : this;

// input = { type: 'point', value } | { type: 'normal', mean, sd }
//       | { type: 'uniform', low, high } | { type: 'triangular', low, mode, high }
function sampleInput(input) {
  switch (input.type) {
    case 'point': return input.value;
    case 'normal': return Math.max(0, PEAK_STATS.randNormal(input.mean, input.sd));
    case 'uniform': return PEAK_STATS.randUniform(input.low, input.high);
    case 'triangular': return sampleTriangular(input.low, input.mode, input.high);
    default: throw new Error('Unknown input distribution type: ' + input.type);
  }
}

function sampleTriangular(low, mode, high) {
  const u = Math.random();
  const fc = (mode - low) / (high - low);
  if (u < fc) return low + Math.sqrt(u * (high - low) * (mode - low));
  return high - Math.sqrt((1 - u) * (high - low) * (high - mode));
}

// ── The Monte Carlo loop ────────────────────────────────────────────────────
// inputs: { addressablePopulation, diagnosisRate, treatmentRate, peakShare,
//           annualPriceUSD }, each a sampling spec as above.
function runPeakSalesSimulation(inputs, iterations = 10000) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    const population = sampleInput(inputs.addressablePopulation);
    const diagnosisRate = tsClamp01(sampleInput(inputs.diagnosisRate));
    const treatmentRate = tsClamp01(sampleInput(inputs.treatmentRate));
    const peakShare = tsClamp01(sampleInput(inputs.peakShare));
    const price = sampleInput(inputs.annualPriceUSD);

    const treatedPatientsAtPeak = population * diagnosisRate * treatmentRate * peakShare;
    const peakSalesUSD = treatedPatientsAtPeak * price;
    results.push({ peakSalesUSD, treatedPatientsAtPeak, population, diagnosisRate, treatmentRate, peakShare, price });
  }

  const sales = results.map(r => r.peakSalesUSD).sort((a, b) => a - b);
  const summary = {
    mean: sales.reduce((a, b) => a + b, 0) / sales.length,
    p10: percentile(sales, 0.10),
    p25: percentile(sales, 0.25),
    p50: percentile(sales, 0.50),
    p75: percentile(sales, 0.75),
    p90: percentile(sales, 0.90),
    min: sales[0],
    max: sales[sales.length - 1]
  };

  return { iterations, summary, samples: results };
}

// ── Driver sensitivity: correlate each input's sampled value against the ────
// output across the same simulation, so the app can show which assumption
// is actually moving the distribution (a tornado-style ranking).
function driverSensitivity(simResult) {
  const outputs = simResult.samples.map(r => r.peakSalesUSD);
  const drivers = ['population', 'diagnosisRate', 'treatmentRate', 'peakShare', 'price'];
  return drivers.map(driver => {
    const inputVals = simResult.samples.map(r => r[driver]);
    return { driver, correlation: pearsonCorrelation(inputVals, outputs) };
  }).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

// ── Helpers ──────────────────────────────────────────────────────────────
function tsClamp01(x) { return Math.min(1, Math.max(0, x)); }

function percentile(sortedArr, p) {
  const idx = p * (sortedArr.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX, dy = y[i] - meanY;
    num += dx * dy; denX += dx * dx; denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return 0;
  return num / Math.sqrt(denX * denY);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sampleInput, sampleTriangular, runPeakSalesSimulation, driverSensitivity, percentile, pearsonCorrelation };
}
