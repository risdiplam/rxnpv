// ════════════════════════════════════════════════════════════════════════════
// TrialSim — PK/PD ENGINE
// Forward simulation only — given published PK parameters (from an FDA label,
// a paper, or a comparable drug), simulate concentration-time profiles and
// pair them with a dose-response (Emax/Hill) model. This is deliberately NOT
// population PK model-fitting (that needs patient-level data we don't have,
// and is what nlmixr2/mrgsolve/NONMEM are actually for) — it's the much
// smaller, entirely self-contained problem of projecting from known/assumed
// parameters, which is what an outside investor can realistically do with
// only public information.
// ════════════════════════════════════════════════════════════════════════════

// ── One-compartment concentration-time functions (single dose) ─────────────

function concIVBolus(t, dose, ke, Vd) {
  if (t < 0) return 0;
  return (dose / Vd) * Math.exp(-ke * t);
}

function concOralFirstOrder(t, dose, ka, ke, Vd, F = 1) {
  if (t < 0) return 0;
  if (Math.abs(ka - ke) < 1e-9) {
    // Flip-flop edge case where ka≈ke: use the limiting form to avoid /0.
    return (F * dose * ke * t / Vd) * Math.exp(-ke * t);
  }
  return (F * dose * ka) / (Vd * (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

// ── Multi-dose steady-state profile via linear superposition ───────────────

function simulateProfile(config) {
  // config: { route: 'iv'|'oral', dose, ka (oral only), ke, Vd, F (oral only),
  //           tau (dosing interval, hours), numDoses, tEnd, dt }
  const { route, dose, ka, ke, Vd, F = 1, tau = 0, numDoses = 1, tEnd, dt = 0.1 } = config;
  const points = [];
  const nSteps = Math.ceil(tEnd / dt);
  for (let i = 0; i <= nSteps; i++) {
    const t = i * dt;
    let c = 0;
    for (let d = 0; d < numDoses; d++) {
      const doseTime = d * tau;
      if (t < doseTime) continue;
      const tSinceDose = t - doseTime;
      c += route === 'iv'
        ? concIVBolus(tSinceDose, dose, ke, Vd)
        : concOralFirstOrder(tSinceDose, dose, ka, ke, Vd, F);
    }
    points.push({ t, c });
  }
  return points;
}

// ── PK metrics derived from a simulated profile ─────────────────────────────

function computePKMetrics(profile) {
  let cMax = -Infinity, tMax = null;
  for (const p of profile) {
    if (p.c > cMax) { cMax = p.c; tMax = p.t; }
  }
  // Trapezoidal AUC over the simulated window.
  let auc = 0;
  for (let i = 1; i < profile.length; i++) {
    const dt = profile[i].t - profile[i - 1].t;
    auc += dt * (profile[i].c + profile[i - 1].c) / 2;
  }
  return { cMax, tMax, aucLastWindow: auc };
}

function halfLife(ke) {
  return Math.log(2) / ke;
}

// Ke = 0 (a drug with literally no elimination) is a legitimate input, and
// ln(2)/0 = Infinity is the mathematically correct answer — but string-
// concatenating that raw value printed "half-life Infinityhr". Formatting
// lives here rather than at the call site so the degenerate case can't be
// reintroduced by a future caller doing its own .toFixed().
function formatHalfLife(ke) {
  const t = halfLife(ke);
  if (!isFinite(t)) return 'none (Ke = 0, no elimination modelled)';
  return t.toFixed(2) + 'hr';
}

function keFromClearance(clearance, Vd) {
  return clearance / Vd;
}

// ── Analytical single-dose AUC (0→∞), for validating the numerical version ──

function analyticalAUC_IV(dose, ke, Vd) {
  return dose / (Vd * ke);
}

function analyticalAUC_Oral(dose, ke, Vd, F = 1) {
  return (F * dose) / (Vd * ke);
}

// ── Dose-response: sigmoidal Emax (Hill equation) ──────────────────────────

function emaxEffect(conc, { E0 = 0, Emax, EC50, hill = 1 }) {
  if (conc <= 0) return E0;
  const cH = Math.pow(conc, hill);
  const ec50H = Math.pow(EC50, hill);
  return E0 + (Emax * cH) / (ec50H + cH);
}

// ── Receptor occupancy — the Hill-Langmuir equation, bridging plasma
// concentration to target engagement before it's mapped through the Emax
// effect curve. Genuinely optional: leaving K_D blank skips this and the
// tool behaves exactly as before (concentration -> Emax directly). When
// set, it's the actual mechanistic link most Phase 1/2 proof-of-mechanism
// biomarker readouts are built around — "did we hit the target enough,"
// not just "what's the effect." Same hill coefficient the Emax curve uses.
function receptorOccupancy(conc, kd, hill = 1) {
  if (conc <= 0 || !kd || kd <= 0) return 0;
  const cH = Math.pow(conc, hill);
  const kdH = Math.pow(kd, hill);
  return 100 * cH / (kdH + cH);
}

function simulateDoseResponseCurve(doses, pkConfigTemplate, pdParams, metric = 'cMax') {
  // For each candidate dose, simulate the PK profile, take the requested
  // exposure metric (Cmax or AUC), then map it through the Emax model.
  return doses.map(dose => {
    const profile = simulateProfile({ ...pkConfigTemplate, dose });
    const pk = computePKMetrics(profile);
    const exposure = metric === 'auc' ? pk.aucLastWindow : pk.cMax;
    return { dose, exposure, effect: emaxEffect(exposure, pdParams) };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    concIVBolus, concOralFirstOrder, simulateProfile, computePKMetrics,
    halfLife, formatHalfLife, keFromClearance, analyticalAUC_IV, analyticalAUC_Oral,
    emaxEffect, simulateDoseResponseCurve, receptorOccupancy
  };
}
