// ════════════════════════════════════════════════════════════════════════════
// TrialSim — APP.JS
// Plain vanilla-JS UI (no framework dependency) wiring the engines to a
// tabbed interface. Depends on statsEngine.js, simulationEngine.js,
// pkpdEngine.js, peakSalesEngine.js, chart.js all being loaded first,
// plain-script style.
// ════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'trialOutcome', label: 'Trial Outcome / PoS' },
  { id: 'p2p3', label: 'Phase 2→3 Translator' },
  { id: 'trialStats', label: 'Trial Statistics' },
  { id: 'metaAnalysis', label: 'Meta-Analysis' },
  { id: 'peakSales', label: 'Peak Sales' },
  { id: 'pkpd', label: 'PK/PD' }
];

// Trial Statistics consolidates four independent, previously-standalone
// tools (Fragility Index, Sample Size/Power, P-value <-> CI, Single-Arm CI)
// behind one tab with its own sub-nav — they overlapped enough in purpose
// (all read a trial result or design and answer a narrow statistical
// question about it) that four top-level tabs was clutter, not clarity.
const TRIAL_STATS_SUBTABS = [
  { id: 'fragilityIndex', label: 'Fragility Index' },
  { id: 'sampleSizePower', label: 'Sample Size / Power' },
  { id: 'pValueCI', label: 'P-value ↔ CI' },
  { id: 'singleArmCI', label: 'Single-Arm CI' },
  { id: 'outcome2x2', label: '2×2 Outcome Analysis' },
  { id: 'nonInferiority', label: 'Non-Inferiority' },
  { id: 'multiplicity', label: 'Multiplicity Adjustment' }
];

let activeTab = 'trialOutcome';
let activeStatsSubtab = 'fragilityIndex';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v == null) continue; // setAttribute(k, null) would stringify to "null" and stick
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function field(labelText, inputEl) {
  return el('label', { class: 'field' }, [el('span', {}, labelText), inputEl]);
}

// Groups fields into the responsive grid so short numeric inputs sit side by
// side instead of each claiming a full row. Pass `true` as the second arg on
// a field that needs the full width back (a long select, or a note).
function fieldGrid(fields) {
  return el('div', { class: 'fieldgrid' }, fields.filter(Boolean));
}
function wideField(labelText, inputEl) {
  return el('label', { class: 'field field-wide' }, [el('span', {}, labelText), inputEl]);
}

// Collapsed-by-default explanatory note — see the details.note styles for why
// these aren't just inline paragraphs.
function note(summaryText, bodyText) {
  return el('details', { class: 'note' }, [
    el('summary', {}, summaryText),
    el('div', { class: 'note-body' }, bodyText)
  ]);
}

function numberInput(id, value, opts = {}) {
  return el('input', { type: 'number', id, value, step: opts.step || 'any', min: opts.min, max: opts.max, placeholder: opts.placeholder });
}

function selectInput(id, options, selected) {
  const sel = el('select', { id });
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === selected) opt.setAttribute('selected', 'selected');
    sel.appendChild(opt);
  }
  return sel;
}

// Null-safe on purpose. These are read inside every run*() handler, and a
// handler can legitimately fire after its tab has been swapped out — at which
// point the element is gone and a bare .value throws an uncaught TypeError.
// The empty/NaN defaults are exactly what the existing validation already
// treats as "not filled in", so a missing element degrades into the same
// "check your inputs" path rather than crashing the view.
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function numVal(id) { const el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; }

// ── Chart export for the Simulation tab ────────────────────────────────────
// This half of the app is vanilla DOM with no React, so it can't use the
// ExportControls component the React views use. Same exportEngine underneath,
// just wired up by hand — one small function that wraps a chart element and
// appends its own export row, so every Simulation chart gets the same PNG/SVG
// options as the rest of the app without duplicating the export logic.
function appendChartWithExport(parent, chartHtml, exportName) {
  const wrap = el('div', {});
  const chartBox = el('div', { html: chartHtml });
  wrap.appendChild(chartBox);

  const row = el('div', { class: 'chart-export-row' });
  const status = el('span', { class: 'chart-export-status' });
  const mkBtn = (label, title, fn) => {
    const b = el('button', { class: 'chart-export-btn', title }, label);
    b.addEventListener('click', async () => {
      const prev = b.textContent;
      b.textContent = '…'; b.disabled = true; status.textContent = '';
      try {
        const r = await fn();
        if (r && r.ok) { status.textContent = r.viaBrowser ? 'Downloaded' : 'Saved'; status.className = 'chart-export-status ok'; }
        else if (r && r.canceled) { status.textContent = ''; }
        else { status.textContent = (r && r.error) || 'Export failed.'; status.className = 'chart-export-status err'; }
      } catch (e) { status.textContent = e.message; status.className = 'chart-export-status err'; }
      b.textContent = prev; b.disabled = false;
      setTimeout(() => { status.textContent = ''; }, 4000);
    });
    return b;
  };
  row.appendChild(el('span', { class: 'chart-export-label' }, 'Export'));
  row.appendChild(mkBtn('PNG', 'High-resolution PNG (3x) of this chart', () => exportChartAsPng(chartBox, exportName, 3)));
  row.appendChild(mkBtn('SVG', 'Vector SVG — scales to any size, editable in design tools', () => exportChartAsSvg(chartBox, exportName)));
  row.appendChild(mkBtn('Panel', 'Capture this whole result panel including its numbers (desktop app)', () => exportPanelAsImage(parent, exportName + '-panel')));
  row.appendChild(status);
  appendPinToReport(row, wrap, { title: humanizeExportName(exportName), source: 'Simulation' });
  wrap.appendChild(row);
  parent.appendChild(wrap);
  return wrap;
}

// Lighter sibling of appendChartWithExport for tools with no chart to save —
// the four Trial Statistics calculators only ever produce a numeric
// headline, so PNG/SVG vector export doesn't apply; a one-click panel
// capture (screenshot the result, including its numbers) is the same
// "get this out of the app" affordance in the only form that makes sense
// here. Previously these results had no export path at all — computed,
// then only ever visible on screen, unlike every chart-bearing tool.
// Vanilla-DOM twin of the React PinToReportButton. Simulation has no React,
// so it reads the same window.pdcfSimBridge the Peak Sales export already uses
// to reach the case list. Appended to the existing export row rather than
// given its own control block — exporting a file and pinning to a report are
// the same "get this out of here" moment.
// Export names are file slugs ("fragility-index"); a report needs a readable
// heading, so they're humanised here rather than every call site being made to
// pass a second, near-duplicate string.
function humanizeExportName(slug) {
  return String(slug || "Analysis")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase())
    .replace(/\bPkpd\b/i, "PK/PD").replace(/\bCi\b/g, "CI").replace(/\bPos\b/g, "PoS")
    .replace(/\bNnt\b/g, "NNT").replace(/\b2X2\b/i, "2x2").replace(/\bP Value\b/i, "P-value");
}

function appendPinToReport(row, resultsDiv, meta) {
  const bridge = window.pdcfSimBridge;
  if (!bridge || !bridge.cases || !bridge.cases.length) return;
  const wrap = el('span', { style: 'display:inline-flex;align-items:center;gap:6px;margin-left:8px' });
  const sel = bridge.cases.length > 1
    ? selectInput('pinCaseSel_' + Math.random().toString(36).slice(2, 7),
        bridge.cases.map(c => ({ value: c.id, label: c.name || 'Untitled' })), bridge.cases[0].id)
    : null;
  if (sel) sel.style.cssText = 'padding:3px 6px;border-radius:5px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-3);font-family:var(--mono);font-size:9px';
  const status = el('span', { class: 'chart-export-status' });
  const btn = el('button', { class: 'chart-export-btn', title: 'Attach this result to a case so it appears in that case’s PDF report' }, '📌 Pin to report');
  btn.addEventListener('click', async () => {
    const live = window.pdcfSimBridge;
    const id = sel ? sel.value : live.cases[0].id;
    const target = live.cases.find(c => c.id === id);
    if (!target) return;
    const existing = pinnedResultsOf(target);
    if (existing.length >= PINNED_MAX_PER_CASE) {
      status.textContent = 'That case is full (' + PINNED_MAX_PER_CASE + ')'; status.className = 'chart-export-status err';
      setTimeout(() => { status.textContent = ''; }, 5000); return;
    }
    btn.disabled = true; const prev = btn.textContent; btn.textContent = '…';
    const r = await buildPinnedResult(resultsDiv, meta);
    btn.textContent = prev; btn.disabled = false;
    if (!r.ok) { status.textContent = r.error; status.className = 'chart-export-status err'; setTimeout(() => { status.textContent = ''; }, 5000); return; }
    live.updateCase({ ...target, pinnedResults: existing.concat([r.pin]), updatedAt: Date.now() });
    status.textContent = 'Pinned to ' + (target.name || 'case'); status.className = 'chart-export-status ok';
    setTimeout(() => { status.textContent = ''; }, 4000);
  });
  wrap.appendChild(btn);
  if (sel) wrap.appendChild(sel);
  wrap.appendChild(status);
  row.appendChild(wrap);
}

function appendResultCapture(resultsDiv, exportName) {
  const row = el('div', { class: 'chart-export-row' });
  const status = el('span', { class: 'chart-export-status' });
  const btn = el('button', { class: 'chart-export-btn', title: 'Capture this result as a PNG (desktop app)' }, 'Capture result');
  btn.addEventListener('click', async () => {
    const prev = btn.textContent;
    btn.textContent = '…'; btn.disabled = true; status.textContent = '';
    try {
      const r = await exportPanelAsImage(resultsDiv, exportName);
      if (r && r.ok) { status.textContent = r.viaBrowser ? 'Downloaded' : 'Saved'; status.className = 'chart-export-status ok'; }
      else if (r && r.canceled) { status.textContent = ''; }
      else { status.textContent = (r && r.error) || 'Export failed.'; status.className = 'chart-export-status err'; }
    } catch (e) { status.textContent = e.message; status.className = 'chart-export-status err'; }
    btn.textContent = prev; btn.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 4000);
  });
  row.appendChild(el('span', { class: 'chart-export-label' }, 'Export'));
  row.appendChild(btn);
  row.appendChild(status);
  appendPinToReport(row, resultsDiv, { title: humanizeExportName(exportName), source: 'Simulation' });
  resultsDiv.appendChild(row);
}

// ── Root render ──────────────────────────────────────────────────────────

function renderApp() {
  const root = document.getElementById('ts-root');
  if (!root) return;  // Simulation view unmounted before this render ran
  root.innerHTML = '';

  const nav = el('div', { class: 'tabnav' }, TABS.map(t =>
    el('button', { class: 'tabbtn' + (t.id === activeTab ? ' active' : ''), onclick: () => { activeTab = t.id; renderApp(); } }, t.label)
  ));

  const header = el('div', { class: 'header' }, [
    el('div', { class: 'brand' }, [el('span', { class: 'logodot' }), 'Simulation'])
  ]);

  const content = el('div', { class: 'content', id: 'tabContent' });

  root.appendChild(header);
  root.appendChild(nav);
  root.appendChild(content);

  renderTab(content);
}

function renderTab(content) {
  content.innerHTML = '';
  const renderers = {
    trialOutcome: renderTrialOutcomeTab,
    p2p3: renderP2P3Tab,
    trialStats: renderTrialStatsTab,
    metaAnalysis: renderMetaAnalysisTab,
    peakSales: renderPeakSalesTab,
    pkpd: renderPkpdTab
  };
  renderers[activeTab](content);
}

// ── Tab: Trial Statistics (Fragility Index / Sample Size / P-value <-> CI /
// Single-Arm CI, behind a sub-nav) ──────────────────────────────────────────
function renderTrialStatsTab(content) {
  content.appendChild(el('h2', { style: 'margin:4px 0 4px 2px' }, ['Trial Statistics', el('span', { class: 'badge info' }, '← Backward-looking')]));
  content.appendChild(el('p', { class: 'subtle', style: 'margin:0 0 4px 2px' }, 'Independent statistical tools for a trial result or design you already have in hand — pick the one that answers your question.'));
  const subnav = el('div', { class: 'subtabnav' }, TRIAL_STATS_SUBTABS.map(t =>
    el('button', { class: 'subtabbtn' + (t.id === activeStatsSubtab ? ' active' : ''), onclick: () => { activeStatsSubtab = t.id; renderApp(); } }, t.label)
  ));
  content.appendChild(subnav);
  const subrenderers = {
    fragilityIndex: renderFragilityIndexTab,
    sampleSizePower: renderSampleSizeTab,
    pValueCI: renderPValueCITab,
    singleArmCI: renderSingleArmCITab,
    outcome2x2: renderOutcome2x2Tab,
    nonInferiority: renderNonInferiorityTab,
    multiplicity: renderMultiplicityTab
  };
  subrenderers[activeStatsSubtab](content);
}

// ── Tab: Trial Outcome / PoS ────────────────────────────────────────────────

function renderTrialOutcomeTab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, ['Trial-outcome assurance (Bayesian PoS)', el('span', { class: 'badge info' }, '→ Forward-looking')]),
    el('p', { class: 'subtle' }, 'Simulates thousands of possible trials under an uncertain true effect, then reports the share that would read out positive.'),
    note('New here? What this tool actually answers', 'A concrete walkthrough: say you’re modeling a Phase 3 binary endpoint, control response rate 30%, and you genuinely believe the true treatment rate is "around 45%, but could reasonably be anywhere from 35% to 55%." That belief is a Normal prior with mean 0.45 and SD roughly 0.05 (about two-thirds of a normal distribution falls within 1 SD of the mean, so SD 0.05 means "most of my belief sits between 40% and 50%, tapering off toward 35%/55%"). Run the simulation and the headline is the share of simulated replicate trials, drawn from that belief, that would read out statistically significant — a single number combining "is my effect estimate about right" with "is my sample size big enough to detect it," which is exactly what a real trial’s actual probability of success depends on. If you instead have total conviction in one specific number (no real uncertainty), use "Fixed value" for the prior instead — see the field below.'),
    field('Endpoint type', selectInput('endpointType', [
      { value: 'binary', label: 'Binary (response rate)' },
      { value: 'continuous', label: 'Continuous (mean change)' },
      { value: 'timeToEvent', label: 'Time-to-event (hazard ratio)' }
    ], 'binary')),
    el('div', { id: 'endpointFields' }),
    fieldGrid([
      field('Alpha', numberInput('alpha', 0.05, { step: '0.01' })),
      field('Sided', selectInput('sided', [{ value: 'two', label: 'Two-sided' }, { value: 'one', label: 'One-sided' }], 'two'))
    ]),
    note('What "two-sided" means for this number', 'A two-sided p-value carries no direction, so a replicate landing significantly WORSE than control counts toward the assurance figure exactly like one landing better. That’s standard statistical convention and the right default for a regulatory-style test, but it means the headline is "probability of a statistically significant result," not strictly "probability of a good one." At realistic effect sizes the wrong-direction share is tiny; for a marginal or unfavourable prior it isn’t. Switch to one-sided for directional success only.'),
    el('h3', {}, 'Effect-size prior'),
    fieldGrid([
      field('Prior type', selectInput('priorType', [{ value: 'point', label: 'Fixed value (no uncertainty)' }, { value: 'normal', label: 'Normal (mean + SD)' }], 'normal')),
      field('Iterations', numberInput('iterations', 10000, { step: '1000' }))
    ]),
    note('Fixed value vs. Normal — which should I pick?', '"Fixed value" treats your prior mean as certain — every simulated replicate draws its true effect from that exact number, so the only randomness left is sampling noise from running a trial of that size. Use this when you want to isolate "given this effect size is real, what’s my chance of a significant readout purely from sample size" — a cleaner question, but one that ignores that you might just be wrong about the effect size itself. "Normal (mean + SD)" additionally draws a different true effect for each replicate from around your prior mean, so the result also reflects your own uncertainty about whether the effect is really there at all — usually the more honest choice for a drug that hasn’t read out yet, since "the drug works exactly this well" is rarely something you actually know for certain.'),
    el('div', { id: 'priorFields' }),
    el('button', { class: 'runbtn', onclick: runTrialOutcome }, 'Run simulation'),
    el('div', { id: 'trialOutcomeResults', class: 'results' }),
    note('Before setting your prior, check the placebo floor', 'For placebo-controlled indications (depression, chronic/neuropathic pain, IBS, migraine, dermatology are the best-documented) a meaningful share of the placebo arm’s own improvement is baked in regardless of drug effect — see Reference Sheet → Probability of Success → Placebo response benchmarks. A prior set without accounting for that floor overstates the achievable treatment effect (active minus placebo), not just the trial’s raw response rate.')
  ]);
  content.appendChild(form);
  document.getElementById('endpointType').addEventListener('change', renderEndpointFields);
  renderEndpointFields();
}

// ── Tab: Phase 2 → 3 Translator ─────────────────────────────────────────────
// The genuinely both-directions tool in this section: reads a real,
// already-observed Phase 2 result (backward-looking) and projects a more
// realistic Phase 3 planning assumption from it (forward-looking), using two
// real, independently-sourced correction factors — see ts_statsEngine.js for
// the citations and exact derivation. Deliberately its own tab rather than a
// fifth Trial Statistics sub-tool: Trial Statistics is entirely
// backward-looking (a result you already have, full stop), while this one's
// whole point is to feed a forward assumption.
function renderP2P3Tab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, ['Phase 2 → 3 Translator', el('span', { class: 'badge info' }, '↔ Backward + Forward')]),
    el('p', { class: 'subtle' }, 'Early-phase trial results systematically overstate what a confirmatory Phase 3 trial goes on to observe, on average — a well-documented regression-to-the-mean effect, not a claim about any single program. Enter an observed or assumed Phase 2 result and get a shrinkage-adjusted Phase 3 planning assumption, sourced from published concordance analyses rather than an arbitrary haircut.'),
    field('Endpoint type', selectInput('p2p3EndpointType', [
      { value: 'binary', label: 'Binary (response rate)' },
      { value: 'timeToEvent', label: 'Time-to-event (hazard ratio)' }
    ], 'binary')),
    el('div', { id: 'p2p3Fields' }),
    el('button', { class: 'runbtn', onclick: runP2P3 }, 'Translate to Phase 3'),
    el('div', { id: 'p2p3Results', class: 'results' }),
    note('Why this isn’t just a fixed haircut applied blindly', 'The FDA’s own review of 22 real cases where Phase 2 and Phase 3 diverged (2017) attributes the gap to causes a single number can’t capture: a biomarker that didn’t reliably predict clinical outcome, a mechanism of action that didn’t translate to real benefit, or a Phase 3 population that differed from who was actually studied in Phase 2. Treat this projection as a planning anchor to sanity-check your own assumption against — not a replacement for judging whether those specific risks apply to your program.')
  ]);
  content.appendChild(form);
  document.getElementById('p2p3EndpointType').addEventListener('change', renderP2P3Fields);
  renderP2P3Fields();
}

function renderP2P3Fields() {
  const type = val('p2p3EndpointType');
  const container = document.getElementById('p2p3Fields');
  if (!container) return;  // tab changed before this ran — nothing to write into
  container.innerHTML = '';
  container.className = 'fieldgrid';
  if (type === 'binary') {
    container.appendChild(field('Observed Phase 2 response rate (%)', numberInput('p2p3ObservedRate', 45, { step: '0.1', min: 0, max: 100 })));
    container.appendChild(el('p', { class: 'subtle field-wide' }, 'A 2026 concordance analysis matching Phase 3 solid-tumor oncology trials (2014–2020) to their supporting Phase 1b/2 trials found early-phase objective response rates overstated the eventual Phase 3 rate by about one-fifth, on average.'));
  } else {
    container.appendChild(field('Assumed hazard ratio (from Phase 2 / design assumption)', numberInput('p2p3ObservedHR', 0.66, { step: '0.01', min: 0.01 })));
    container.appendChild(el('p', { class: 'subtle field-wide' }, 'A JNCI analysis of 111 Phase 3 oncology trials (2023) found the hazard ratio assumed at design time — typically informed by Phase 2 — averaged 0.66, while the ratio actually observed in the completed Phase 3 trial averaged 0.72: about 9% weaker, on average. Only 57% of trials came in weaker than expected, so this is a mean shift across the sample, not a universal one.'));
  }
}

function runP2P3() {
  const type = val('p2p3EndpointType');
  const resultsDiv = document.getElementById('p2p3Results');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (type === 'binary') {
    const observed = numVal('p2p3ObservedRate');
    if (!isFinite(observed) || observed < 0 || observed > 100) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Response rate must be between 0 and 100%.'));
      return;
    }
    const r = shrinkBinaryResponseRate(observed);
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.projectedP3Pct.toFixed(1) + '%'),
      el('span', { class: 'sublabel' }, `shrinkage-adjusted Phase 3 planning assumption (observed ${observed.toFixed(1)}% ÷ ${r.factor.toFixed(2)})`)
    ]));
    resultsDiv.appendChild(el('p', { class: 'subtle' }, `Your raw ${observed.toFixed(1)}% Phase 2 result, unadjusted, is the optimistic case — useful as an upper bound, not the planning default.`));
    const compareSvg = renderForestPlot([
      { label: 'Observed Phase 2', estimate: observed, lower: observed, upper: observed, color: 'var(--amber)' },
      { label: 'Shrinkage-adjusted Phase 3', estimate: r.projectedP3Pct, lower: r.projectedP3Pct, upper: r.projectedP3Pct }
    ], { scale: 'linear', xLabel: 'Response rate (%)' });
    appendChartWithExport(resultsDiv, compareSvg, 'phase2-3-translator');
  } else {
    const hr = numVal('p2p3ObservedHR');
    if (!isFinite(hr) || hr <= 0) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Hazard ratio must be a positive number.'));
      return;
    }
    const r = shrinkHazardRatio(hr);
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.projectedP3HR.toFixed(3)),
      el('span', { class: 'sublabel' }, `shrinkage-adjusted Phase 3 planning assumption (${hr.toFixed(3)} × ${r.factor.toFixed(2)})`)
    ]));
    if (r.crossesNull) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `This shrinks past HR = 1.0 — on average, a Phase 2 result this close to the null doesn't survive Phase 3 as a statistically meaningful effect. Worth treating as a real caution, not just an unlucky roundoff.`));
    } else {
      resultsDiv.appendChild(el('p', { class: 'subtle' }, `Your raw ${hr.toFixed(3)} Phase 2 assumption, unadjusted, is the optimistic case — useful as a lower bound on the hazard ratio, not the planning default.`));
    }
    const compareSvg = renderForestPlot([
      { label: 'Assumed Phase 2 HR', estimate: hr, lower: hr, upper: hr, color: 'var(--amber)' },
      { label: 'Shrinkage-adjusted Phase 3', estimate: r.projectedP3HR, lower: r.projectedP3HR, upper: r.projectedP3HR }
    ], { scale: 'log', referenceLine: 1, xLabel: 'Hazard ratio (log scale)' });
    appendChartWithExport(resultsDiv, compareSvg, 'phase2-3-translator');
  }
}

// ── Tab: Fragility Index ────────────────────────────────────────────────────
// Its own standalone tab, not a section bolted onto Trial Outcome/PoS — this
// operates on a trial result that has ALREADY happened (backward-looking:
// how robust is this readout), not the hypothetical future trial the
// assurance simulator above models (forward-looking: will a future trial
// succeed). Genuinely complementary, not a duplicate.
function renderFragilityIndexTab(content) {
  const fragForm = el('div', { class: 'panel' }, [
    el('h2', {}, 'Fragility Index'),
    el('p', { class: 'subtle' }, 'Walsh, Srinathan, McAuley et al. 2014 — for a binary-outcome result that already reached significance, the minimum number of patients whose outcome would need to flip (non-event ↔ event) to erase that significance. A measure of how few individual outcomes a "significant" result actually rests on, not a re-analysis of trial conduct.'),
    note('New here? What to enter and how to read it', 'Enter the headline 2x2 from a readout: how many patients had the event in each arm, and how many were in each arm. "Events" is whatever the trial counted — responders, deaths, relapses — just keep it consistent across both arms. The output is a count of patients, and small numbers are the warning: a Fragility Index of 2 on a 500-patient trial means the entire significant result turns on two individuals, which is thin regardless of how impressive the p-value looked. There is no universal "safe" threshold, but a Fragility Index smaller than the number of patients who dropped out is a well-known red flag, because the missing patients could have swung it either way. This only applies to results that already cleared significance; a non-significant result has nothing to erase, and the tool says so instead of returning a number.'),
    fieldGrid([
      field('Arm A label', el('input', { type: 'text', id: 'fiLabelA', value: 'Treatment' })),
      field('Arm A events', numberInput('fiEventsA', 5)),
      field('Arm A total N', numberInput('fiNA', 50)),
      field('Arm B label', el('input', { type: 'text', id: 'fiLabelB', value: 'Control' })),
      field('Arm B events', numberInput('fiEventsB', 20)),
      field('Arm B total N', numberInput('fiNB', 50)),
      field('Alpha (significance threshold)', numberInput('fiAlpha', 0.05, { step: '0.01' }))
    ]),
    el('button', { class: 'runbtn', onclick: runFragilityIndex }, 'Calculate'),
    el('div', { id: 'fragilityResults', class: 'results' })
  ]);
  content.appendChild(fragForm);
}

// ── Tab: Sample Size / Power ────────────────────────────────────────────────
// Also standalone — the inverse question from the assurance simulator ("what
// N do I need for a given target power," not "given N, what's my
// assurance"). Own endpoint-type state, deliberately not shared with the
// assurance simulator's — a design's planning-stage sample size and its
// post-hoc assurance are different questions asked at different times.
function renderSampleSizeTab(content) {
  const ssForm = el('div', { class: 'panel' }, [
    el('h2', {}, 'Sample size / power'),
    el('p', { class: 'subtle' }, 'Two directions of one relationship. Sample size: given an assumed effect, what N do I need? Minimum detectable effect: given an N already fixed, what is the smallest effect that would read out significant?'),
    note('How both directions are solved', 'Both search over the same verified closed-form power functions already used to cross-check the Monte Carlo simulator on Trial Outcome/PoS, rather than separate hand-derived inverse formulas — so the two directions are guaranteed to agree with each other by construction rather than by coincidence.'),
    field('Solve for', selectInput('ssSolveMode', [
      { value: 'sampleSize', label: 'Sample size (given an assumed effect)' },
      { value: 'minDetectableEffect', label: 'Minimum detectable effect (given a fixed N)' }
    ], 'sampleSize')),
    field('Endpoint type', selectInput('ssEndpointType', [
      { value: 'binary', label: 'Binary (response rate)' },
      { value: 'continuous', label: 'Continuous (mean change)' },
      { value: 'timeToEvent', label: 'Time-to-event (hazard ratio)' }
    ], 'binary')),
    el('div', { id: 'ssEndpointFields' }),
    fieldGrid([
      field('Target power', numberInput('ssPower', 0.80, { step: '0.01' })),
      field('Alpha', numberInput('ssAlpha', 0.05, { step: '0.01' })),
      field('Sided (binary/continuous only)', selectInput('ssSided', [{ value: 'two', label: 'Two-sided' }, { value: 'one', label: 'One-sided' }], 'two')),
      field('Allocation ratio (arm 2 : arm 1)', numberInput('ssAllocation', 1, { step: '0.1' }))
    ]),
    note('Target power, Sided, and Allocation ratio — what these mean', '"Target power" is the chance the trial detects a real effect of the size you assumed, if that effect is genuinely real — 80% is the near-universal industry default (90% is used for higher-stakes confirmatory trials, at the cost of needing more patients). "Sided" should almost always stay Two-sided — that’s the standard regulatory convention and matches how most trials are actually designed and reported; One-sided is a smaller, easier bar to hit, appropriate only when a worse-than-control outcome is genuinely not a possibility worth guarding against. "Allocation ratio" is how many patients are in arm 2 for every 1 in arm 1 — most trials use a 1:1 (equal) split, the most statistically efficient use of a fixed total N; a company might use 2:1 favoring the treatment arm for recruitment/ethical reasons (more patients get the experimental drug), which needs a larger total N to reach the same power as an equal split.'),
    el('button', { class: 'runbtn', onclick: runSampleSize }, 'Calculate'),
    el('div', { id: 'sampleSizeResults', class: 'results' })
  ]);
  content.appendChild(ssForm);
  document.getElementById('ssSolveMode').addEventListener('change', renderSsEndpointFields);
  document.getElementById('ssEndpointType').addEventListener('change', renderSsEndpointFields);
  renderSsEndpointFields();
}

// ── Tab: P-value ↔ CI ───────────────────────────────────────────────────────
// Altman & Bland (BMJ 2011) interconversion — for when a press release or
// abstract reports only one of {point estimate + P value} or {point estimate
// + 95% CI} and you need the other to actually judge precision, not just
// significance. Two independent published approximations, verified in
// ts_statsEngine.js by round-tripping P -> CI -> P before this was built.
function renderPValueCITab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, 'P-value ↔ 95% CI'),
    el('p', { class: 'subtle' }, 'Altman & Bland, BMJ 2011. Approximate, not exact — the paper\'s own two directions aren\'t perfect algebraic inverses of each other, just very close in practice. Needs a point estimate either way; a P value or CI alone, with no effect size, can\'t be converted.'),
    note('New here? When you would use this', 'Press releases and abstracts routinely report one half of what you need and omit the other. "Hazard ratio 0.65, p=0.02" tells you it was significant but not how precisely the effect is known; "HR 0.65 (95% CI 0.45-0.94)" tells you the precision but not the exact p. This converts between the two so you can judge both. The practical use is spotting a result that is technically significant but barely so: a confidence interval whose upper bound nearly touches 1.0 (for a ratio) or 0 (for a difference) is a result that would not survive much additional data going the wrong way, even at p<0.05. Enter the point estimate the release quoted, pick the matching scale — ratio for hazard/odds/risk ratios, linear for a mean or risk difference — and read off whichever half was missing.'),
    fieldGrid([
      field('Direction', selectInput('pciDirection', [
        { value: 'pToCI', label: 'P-value → 95% CI' },
        { value: 'ciToP', label: '95% CI → P-value' }
      ], 'pToCI')),
      field('Scale', selectInput('pciScale', [
        { value: 'linear', label: 'Linear (mean difference, risk difference)' },
        { value: 'ratio', label: 'Ratio (hazard ratio, odds ratio, risk ratio)' }
      ], 'linear'))
    ]),
    el('div', { id: 'pciFields' }),
    el('button', { class: 'runbtn', onclick: runPValueCI }, 'Calculate'),
    el('div', { id: 'pciResults', class: 'results' })
  ]);
  content.appendChild(form);
  document.getElementById('pciDirection').addEventListener('change', renderPciFields);
  document.getElementById('pciScale').addEventListener('change', renderPciFields);
  renderPciFields();
}

function renderPciFields() {
  const direction = val('pciDirection');
  const scale = val('pciScale');
  const container = document.getElementById('pciFields');
  if (!container) return;  // tab changed before this ran — nothing to write into
  container.innerHTML = '';
  container.className = 'fieldgrid';
  const pointLabel = scale === 'ratio' ? 'Point estimate (HR/OR/RR)' : 'Point estimate (Δ)';
  const pointDefault = scale === 'ratio' ? 0.65 : 5;
  container.appendChild(field(pointLabel, numberInput('pciPoint', pointDefault, { step: '0.01' })));
  if (direction === 'pToCI') {
    container.appendChild(field('P value', numberInput('pciP', 0.03, { step: '0.001' })));
    // Not cosmetic: the underlying formula assumes a two-sided P. A one-sided
    // P entered as-is would be read as a far weaker result and widen the CI.
    container.appendChild(field('This P value is', selectInput('pciSided', [
      { value: 'two', label: 'Two-sided (most common)' },
      { value: 'one', label: 'One-sided (doubled before conversion)' }
    ], 'two')));
  } else {
    const lowerLabel = scale === 'ratio' ? 'CI lower bound (ratio)' : 'CI lower bound';
    const upperLabel = scale === 'ratio' ? 'CI upper bound (ratio)' : 'CI upper bound';
    container.appendChild(field(lowerLabel, numberInput('pciLower', scale === 'ratio' ? 0.45 : 0.5, { step: '0.01' })));
    container.appendChild(field(upperLabel, numberInput('pciUpper', scale === 'ratio' ? 0.94 : 9.9, { step: '0.01' })));
  }
  // Applies in both directions — the interval half-width is z x SE, and z
  // depends on the level (1.96 at 95%, 1.6449 at 90%).
  container.appendChild(field('Confidence level', selectInput('pciLevel', [
    { value: '0.95', label: '95% (standard)' },
    { value: '0.90', label: '90%' },
    { value: '0.99', label: '99%' }
  ], '0.95')));
}

function runPValueCI() {
  const direction = val('pciDirection');
  const scale = val('pciScale');
  const point = numVal('pciPoint');
  const resultsDiv = document.getElementById('pciResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (!isFinite(point) || (scale === 'ratio' && point <= 0)) {
    resultsDiv.appendChild(el('p', { class: 'error' }, scale === 'ratio' ? 'Point estimate must be a positive ratio.' : 'Enter a point estimate.'));
    return;
  }

  const level = parseFloat(val('pciLevel')) || 0.95;
  const levelPct = (level * 100).toFixed(0);

  if (direction === 'pToCI') {
    const p = numVal('pciP');
    if (!isFinite(p) || p <= 0 || p >= 1) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'P value must be between 0 and 1.'));
      return;
    }
    const sided = val('pciSided') || 'two';
    const opts = { sided, confidenceLevel: level };
    const r = scale === 'ratio' ? ciFromPValueRatio(point, p, opts) : ciFromPValue(point, p, opts);
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.lower.toFixed(3) + ' to ' + r.upper.toFixed(3)),
      el('span', { class: 'sublabel' }, `implied ${levelPct}% CI (SE ${r.se.toFixed(4)}, z ${r.z.toFixed(3)}, critical z ${r.zCrit.toFixed(4)})`)
    ]));
    if (sided === 'one') {
      resultsDiv.appendChild(el('p', { class: 'subtle' },
        `Converted your one-sided P = ${p} to its two-sided equivalent (${r.pTwoSided}) first — the published method is defined on two-sided P values. Using a one-sided value directly would have made the result look more extreme than it is, producing an interval that's too narrow and overstating how precisely the effect is known.`));
    }
    const forestSvg = renderForestPlot([
      { label: 'Implied CI', estimate: point, lower: r.lower, upper: r.upper }
    ], { scale: scale === 'ratio' ? 'log' : 'linear', referenceLine: scale === 'ratio' ? 1 : 0, xLabel: (scale === 'ratio' ? 'Ratio (log scale)' : 'Difference') });
    appendChartWithExport(resultsDiv, forestSvg, 'p-value-to-ci');
  } else {
    const lower = numVal('pciLower'), upper = numVal('pciUpper');
    if (![lower, upper].every(isFinite) || upper <= lower || (scale === 'ratio' && lower <= 0)) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Upper bound must exceed lower bound' + (scale === 'ratio' ? ', and both must be positive.' : '.') ));
      return;
    }
    const opts = { confidenceLevel: level };
    const r = scale === 'ratio' ? pValueFromCIRatio(point, lower, upper, opts) : pValueFromCI(point, lower, upper, opts);
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.pTwoSided < 0.001 ? '<0.001' : r.pTwoSided.toFixed(3)),
      el('span', { class: 'sublabel' }, `implied two-sided P (SE ${r.se.toFixed(4)}, z ${r.z.toFixed(3)}, from a ${levelPct}% CI)`)
    ]));
    resultsDiv.appendChild(el('p', { class: 'subtle' },
      `One-sided equivalent: ${r.pOneSided < 0.0005 ? '<0.001' : r.pOneSided.toFixed(3)}. Stated explicitly because "P" in a press release is usually two-sided but not always, and the two differ by exactly a factor of two.`));
    const forestSvg = renderForestPlot([
      { label: 'Reported CI', estimate: point, lower, upper }
    ], { scale: scale === 'ratio' ? 'log' : 'linear', referenceLine: scale === 'ratio' ? 1 : 0, xLabel: (scale === 'ratio' ? 'Ratio (log scale)' : 'Difference') });
    appendChartWithExport(resultsDiv, forestSvg, 'ci-to-p-value');
  }
}

// ── Tab: Single-Arm CI ──────────────────────────────────────────────────────
// Wilson score interval for one observed proportion (e.g. ORR in a
// single-arm trial) — the regime the normal approximation p̂±z·SE breaks
// down in (small n, extreme p̂), which single-arm early-phase oncology
// trials live in constantly. Verified against an algebraically-independent
// form of the same interval in ts_statsEngine.js before this was built.
function renderSingleArmCITab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, 'Single-arm event rate — confidence interval'),
    el('p', { class: 'subtle' }, 'Wilson score interval (Wilson, 1927) for one observed proportion — e.g. an objective response rate reported as "9/20 patients." More reliable than the normal approximation at the small sample sizes and extreme rates single-arm early-phase trials usually report.'),
    note('When would I use this?', 'Any time a press release or abstract reports a single-arm rate (an objective response rate, a biomarker-positive rate, an adverse-event rate) as a bare percentage or "X of Y patients," with no confidence interval attached. A 20-patient Phase 1 reporting "45% ORR" sounds concrete, but the true underlying rate could plausibly be anywhere from about 26% to 66% at that sample size — this tool puts the real uncertainty band around a small-trial headline number instead of taking it at face value. Confidence level controls how wide that band is; 95% (the default, and by far the most common in published trials) means the true rate falls inside the reported interval 95% of the time under repeated sampling — leave it at 95% unless you have a specific reason to want a narrower (90%) or wider (99%) band.'),
    fieldGrid([
      field('Events (e.g. responders)', numberInput('saEvents', 9)),
      field('Total N', numberInput('saN', 20)),
      field('Confidence level', numberInput('saConfidence', 0.95, { step: '0.01' }))
    ]),
    el('button', { class: 'runbtn', onclick: runSingleArmCI }, 'Calculate'),
    el('div', { id: 'saResults', class: 'results' })
  ]);
  content.appendChild(form);
}

function runSingleArmCI() {
  const events = numVal('saEvents'), n = numVal('saN'), confidence = numVal('saConfidence');
  const resultsDiv = document.getElementById('saResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![events, n, confidence].every(isFinite) || n <= 0 || events < 0 || events > n || confidence <= 0 || confidence >= 1) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Check the inputs — events must be between 0 and N, confidence level between 0 and 1.'));
    return;
  }

  const r = wilsonScoreInterval(events, n, confidence);
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, (r.phat * 100).toFixed(1) + '%'),
    el('span', { class: 'sublabel' }, `observed rate — ${(confidence*100).toFixed(0)}% CI: ${(r.lower*100).toFixed(1)}% to ${(r.upper*100).toFixed(1)}%`)
  ]));
  resultsDiv.appendChild(el('p', { class: 'subtle' }, `${events}/${n} patients.`));
  const forestSvg = renderForestPlot([
    { label: `${events}/${n}`, estimate: r.phat * 100, lower: r.lower * 100, upper: r.upper * 100 }
  ], { scale: 'linear', xLabel: 'Rate (%)' });
  appendChartWithExport(resultsDiv, forestSvg, 'single-arm-ci');
}

// ── Tab: 2×2 Outcome Analysis ───────────────────────────────────────────────
// Same 2x2 input shape as Fragility Index (arm A/B events and N), answering
// a different, complementary question — not "how fragile is this result"
// but "how big is the effect, read every standard way an investor might
// see it reported": risk ratio, odds ratio, risk difference, and NNT/NNH,
// all with real confidence intervals from the SAME table. Leads with NNT as
// an icon array (out of every N people treated, this many more benefit) —
// the intuitive, beginner-accessible framing — before the full RR/OR/RD
// detail with confidence intervals underneath, so one tool serves both a
// reader with no stats background and one who wants to see the actual CIs.
function renderOutcome2x2Tab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, '2×2 outcome analysis'),
    el('p', { class: 'subtle' }, 'Four standard ways of reading one 2×2 table — risk ratio, odds ratio, risk difference, NNT/NNH — all with real confidence intervals.'),
    note('New here? Try a real, famous example', 'The default numbers below already show what this looks like — but try a real published result: ISIS-2 (1988), one of the most-cited cardiology trials ever, found aspirin reduced vascular mortality vs. placebo. Enter Arm A "Aspirin" events 804, N 8587; Arm B "Placebo" events 1016, N 8600; "A HIGHER rate means A worse outcome" (since the endpoint here is death). You should get RR ≈ 0.79 and NNT ≈ 41 — meaning treating about 41 patients with aspirin prevented one additional vascular death compared to placebo, matching the trial’s own widely-cited figures. That’s the general pattern for using this tool: take the events/N straight from a trial’s reported results table (often in the abstract or a summary table), not something you calculate yourself first.'),
    fieldGrid([
      field('Arm A label', el('input', { type: 'text', id: 'o2LabelA', value: 'Treatment' })),
      field('Arm A events', numberInput('o2EventsA', 20)),
      field('Arm A total N', numberInput('o2NA', 100)),
      field('Arm B label', el('input', { type: 'text', id: 'o2LabelB', value: 'Control' })),
      field('Arm B events', numberInput('o2EventsB', 40)),
      field('Arm B total N', numberInput('o2NB', 100)),
      field('Confidence level', numberInput('o2Confidence', 0.95, { step: '0.01' })),
      field('A HIGHER rate in this endpoint means', selectInput('o2HigherMeans', [
        { value: 'worse', label: 'A worse outcome (e.g. an adverse event, relapse)' },
        { value: 'better', label: 'A better outcome (e.g. response, survival)' }
      ], 'worse'))
    ]),
    el('button', { class: 'runbtn', onclick: runOutcome2x2 }, 'Calculate'),
    el('div', { id: 'o2Results', class: 'results' })
  ]);
  content.appendChild(form);
}

function runOutcome2x2() {
  const labelA = val('o2LabelA').trim() || 'Arm A', labelB = val('o2LabelB').trim() || 'Arm B';
  const eventsA = numVal('o2EventsA'), nA = numVal('o2NA');
  const eventsB = numVal('o2EventsB'), nB = numVal('o2NB');
  const confidence = numVal('o2Confidence');
  const higherIsWorse = val('o2HigherMeans') === 'worse';
  const resultsDiv = document.getElementById('o2Results');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![eventsA, nA, eventsB, nB, confidence].every(isFinite) || nA <= 0 || nB <= 0 || eventsA < 0 || eventsB < 0 || eventsA > nA || eventsB > nB || confidence <= 0 || confidence >= 1) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Check the inputs — event counts must be between 0 and that arm’s total N.'));
    return;
  }
  if (eventsA === 0 || eventsB === 0 || eventsA === nA || eventsB === nB) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Risk ratio and odds ratio are undefined at 0% or 100% event rates in either arm (division by zero) — this needs at least one event and at least one non-event in each arm.'));
    return;
  }

  const rr = computeRiskRatio(eventsA, nA, eventsB, nB, confidence);
  const or_ = computeOddsRatio(eventsA, nA, eventsB, nB, confidence);
  const rd = computeRiskDifference(eventsA, nA, eventsB, nB, confidence);
  const nnt = computeNNT(eventsA, nA, eventsB, nB, confidence);

  // "Benefit" here means arm A came out favorably relative to arm B, given
  // what the user said a higher rate means for this endpoint — purely a
  // display label built from the engine's neutral eventsHigherInArmA fact,
  // not a judgment the engine itself makes.
  const armAIsBetter = higherIsWorse ? !nnt.eventsHigherInArmA : nnt.eventsHigherInArmA;
  const measureLabel = nnt.crossesNull ? null : (armAIsBetter ? 'NNT' : 'NNH');

  if (nnt.crossesNull) {
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum small' }, 'No significant difference'),
      el('span', { class: 'sublabel' }, `the risk-difference confidence interval crosses zero (${(rd.lower*100).toFixed(1)}pp to ${(rd.upper*100).toFixed(1)}pp) — NNT/NNH isn't meaningfully defined here`)
    ]));
  } else {
    const pct100 = (100 / nnt.nnt);
    const iconArraySvg = renderIconArray(pct100 / 100, {
      highlightColor: armAIsBetter ? 'var(--teal)' : 'var(--red)',
      title: `${measureLabel} = ${Math.ceil(nnt.nnt)}`,
      subtitle: `out of every 100 treated with ${labelA}, about ${pct100.toFixed(1)} more ${armAIsBetter ? 'benefit' : 'are harmed'} than would have with ${labelB}`
    });
    appendChartWithExport(resultsDiv, iconArraySvg, '2x2-nnt-icon-array');
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, measureLabel + ' = ' + nnt.nnt.toFixed(1)),
      el('span', { class: 'sublabel' }, `${(confidence*100).toFixed(0)}% CI: ${nnt.lower.toFixed(1)} to ${nnt.upper.toFixed(1)} — round up (never down) when using this to plan how many patients you'd need`)
    ]));
  }

  resultsDiv.appendChild(el('h3', {}, 'Risk ratio & odds ratio'));
  const ratioForestSvg = renderForestPlot([
    { label: 'Risk ratio', estimate: rr.rr, lower: rr.lower, upper: rr.upper },
    { label: 'Odds ratio', estimate: or_.or, lower: or_.lower, upper: or_.upper }
  ], { scale: 'log', referenceLine: 1, xLabel: 'Ratio (log scale) — left of the line favors ' + labelA });
  appendChartWithExport(resultsDiv, ratioForestSvg, '2x2-risk-odds-ratio');
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    `RR ${rr.rr.toFixed(3)} (${(confidence*100).toFixed(0)}% CI ${rr.lower.toFixed(3)}-${rr.upper.toFixed(3)}) · OR ${or_.or.toFixed(3)} (${(confidence*100).toFixed(0)}% CI ${or_.lower.toFixed(3)}-${or_.upper.toFixed(3)}). OR is always further from 1 than RR for the same table when the event isn't rare — a real property of the two measures, not a discrepancy to worry about.`));

  resultsDiv.appendChild(el('h3', {}, 'Risk difference'));
  const rdForestSvg = renderForestPlot([
    { label: 'Risk difference', estimate: rd.rd, lower: rd.lower, upper: rd.upper }
  ], { scale: 'linear', referenceLine: 0, xLabel: 'Difference in event rate (' + labelA + ' minus ' + labelB + ')' });
  appendChartWithExport(resultsDiv, rdForestSvg, '2x2-risk-difference');
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    `${labelA}: ${eventsA}/${nA} (${(rd.pA*100).toFixed(1)}%) · ${labelB}: ${eventsB}/${nB} (${(rd.pB*100).toFixed(1)}%) · RD ${(rd.rd*100).toFixed(1)}pp (${(confidence*100).toFixed(0)}% CI ${(rd.lower*100).toFixed(1)}pp to ${(rd.upper*100).toFixed(1)}pp).`));
}

// ── Tab: Non-Inferiority ────────────────────────────────────────────────────
// A real, common gap: every other tool in this section assumes a
// superiority design (is the new treatment BETTER). A lot of real trials —
// especially in crowded indications where a placebo-controlled design isn't
// ethical anymore — are non-inferiority designs instead: is the new
// treatment not meaningfully WORSE than an active comparator, by more than a
// pre-specified margin. Takes an already-reported point estimate + CI
// directly (the way a press release states it), not raw counts — the
// analysis a non-inferiority trial actually reports is exactly this.
function renderNonInferiorityTab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, 'Non-inferiority assessment'),
    el('p', { class: 'subtle' }, 'Checks whether the ENTIRE confidence interval clears a pre-specified margin — the standard rule. Pointing the right way is not enough.'),
    note('New here? What "non-inferiority" means and when you’ll see it', 'Most trial readouts you’ll encounter are superiority trials — "is the new drug BETTER." Non-inferiority trials ask a different question: "is the new drug not meaningfully WORSE than an existing active treatment," common when a placebo-controlled design would be unethical (e.g. testing a new anticoagulant against one already known to work — you can’t ethically give some patients no anticoagulant at all). You won’t compute the inputs here yourself — a company’s press release or trial paper directly states the point estimate, its CI, and the pre-specified margin (usually agreed with FDA before the trial even started); this tool just applies the pass/fail rule to numbers you copy in. A real-world read: "hazard ratio 0.95 (95% CI 0.80-1.12), non-inferiority margin 1.30" is a PASS, since the entire CI — even its worst case, 1.12 — stays below the 1.30 margin.'),
    fieldGrid([
      field('Scale', selectInput('niScale', [
        { value: 'ratio', label: 'Ratio (hazard ratio, risk ratio, odds ratio)' },
        { value: 'difference', label: 'Difference (risk difference, mean difference)' }
      ], 'ratio')),
      field('Point estimate', numberInput('niPoint', 0.95, { step: '0.01' })),
      field('CI lower bound', numberInput('niLower', 0.80, { step: '0.01' })),
      field('CI upper bound', numberInput('niUpper', 1.12, { step: '0.01' })),
      field('Non-inferiority margin', numberInput('niMargin', 1.30, { step: '0.01' })),
      field('Non-inferiority requires the estimate to stay', selectInput('niDirection', [
        { value: 'below', label: 'BELOW the margin (typical when higher = worse, e.g. hazard/risk ratio for an adverse outcome)' },
        { value: 'above', label: 'ABOVE the margin (typical when lower = worse, e.g. a beneficial-effect ratio or difference)' }
      ], 'below'))
    ]),
    el('button', { class: 'runbtn', onclick: runNonInferiority }, 'Assess'),
    el('div', { id: 'niResults', class: 'results' })
  ]);
  content.appendChild(form);
}

function runNonInferiority() {
  const scale = val('niScale');
  const point = numVal('niPoint'), lower = numVal('niLower'), upper = numVal('niUpper');
  const margin = numVal('niMargin'), direction = val('niDirection');
  const resultsDiv = document.getElementById('niResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![point, lower, upper, margin].every(isFinite) || upper <= lower || (scale === 'ratio' && (point <= 0 || lower <= 0))) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Check the inputs — upper bound must exceed lower bound' + (scale === 'ratio' ? ', and ratio-scale values must be positive.' : '.')));
    return;
  }

  const established = direction === 'below' ? upper < margin : lower > margin;
  const marginZone = direction === 'below'
    ? { from: margin, to: Math.max(upper, margin) * 1.15 }
    : { from: Math.min(lower, margin) * (scale === 'ratio' ? 0.85 : 1) - (scale === 'ratio' ? 0 : Math.abs(margin) * 0.15), to: margin };

  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum small', style: established ? 'color:var(--teal)' : 'color:var(--red)' }, established ? 'Non-inferiority established' : 'Non-inferiority NOT established'),
    el('span', { class: 'sublabel' }, `${(point).toFixed(3)} (CI ${lower.toFixed(3)} to ${upper.toFixed(3)}) against a margin of ${margin.toFixed(3)}, requiring the estimate to stay ${direction} the margin`)
  ]));

  const forestSvg = renderForestPlot([
    { label: 'Observed', estimate: point, lower, upper }
  ], { scale: scale === 'ratio' ? 'log' : 'linear', marginZone, xLabel: (scale === 'ratio' ? 'Ratio' : 'Difference') + ' — shaded region is outside the non-inferiority margin' });
  appendChartWithExport(resultsDiv, forestSvg, 'non-inferiority');

  resultsDiv.appendChild(el('p', { class: 'subtle' },
    established
      ? `The full confidence interval stays ${direction} ${margin.toFixed(3)} — the worst case within the CI still clears the pre-specified margin.`
      : `Part of the confidence interval falls on the wrong side of ${margin.toFixed(3)} — even though the point estimate itself may look fine, the trial can't rule out a true effect worse than the margin allows.`));
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    "A margin is a clinical judgment call made BEFORE a trial reads out, not something this tool derives — always check the trial's own pre-specified margin (usually in its protocol or a prior regulatory agreement) rather than picking one after the fact."));
}

// ── Tab: Multiplicity Adjustment ────────────────────────────────────────────
// Addresses a real, common misread: "p<0.05 on a secondary endpoint" out of
// several tested means less than it looks — the more hypotheses tested, the
// higher the chance at least one clears 0.05 by chance alone. Up to 8 fixed
// p-value slots (blank ones ignored) rather than a dynamic list — a single
// trial's primary + key secondary endpoints rarely exceeds a handful, unlike
// meta-analysis's genuinely open-ended study count.
const MULTIPLICITY_MAX_ENDPOINTS = 8;
function renderMultiplicityTab(content) {
  const rows = [];
  for (let i = 0; i < MULTIPLICITY_MAX_ENDPOINTS; i++) {
    rows.push(fieldGrid([
      field('Endpoint ' + (i + 1) + ' label', el('input', { type: 'text', id: 'mpLabel' + i, value: i === 0 ? 'Primary endpoint' : (i === 1 ? 'Key secondary' : '') })),
      field('p-value', numberInput('mpP' + i, '', { step: '0.001', placeholder: i < 2 ? undefined : 'leave blank if not used' }))
    ]));
  }
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, 'Multiplicity adjustment'),
    el('p', { class: 'subtle' }, 'Testing more endpoints raises the real bar for significance. Enter every endpoint tested and see it adjusted two ways.'),
    note('Bonferroni vs. Holm', 'Flat Bonferroni is the simple, conservative correction. Holm step-down is the standard improvement: it rejects at least as many hypotheses as Bonferroni, sometimes more, while controlling exactly the same overall false-positive rate — so there is rarely a reason to prefer plain Bonferroni.'),
    note('New here? Why this matters for reading a press release', 'A company announces "the trial hit its primary endpoint, and also showed a statistically significant improvement on a key secondary endpoint (p=0.04)." That secondary p-value looks like a real win on its own — but if the trial tested, say, 4 secondary endpoints total, there was a meaningfully higher chance that AT LEAST ONE would clear p<0.05 by chance alone, even if the drug did nothing extra on any of them. This tool makes that concrete: enter every endpoint that was actually tested (not just the one being highlighted in the press release — check the trial’s pre-specified endpoint list, usually in the protocol or a prior clinicaltrials.gov registration) and see whether the "win" survives correction. A raw p=0.04 that becomes non-significant after adjustment is a real, common way a secondary-endpoint headline overstates what actually happened.'),
    ...rows,
    field('Alpha (significance threshold)', numberInput('mpAlpha', 0.05, { step: '0.01' })),
    el('button', { class: 'runbtn', onclick: runMultiplicity }, 'Adjust'),
    el('div', { id: 'mpResults', class: 'results' })
  ]);
  content.appendChild(form);
}

function runMultiplicity() {
  const alpha = numVal('mpAlpha');
  const resultsDiv = document.getElementById('mpResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  const entries = [];
  for (let i = 0; i < MULTIPLICITY_MAX_ENDPOINTS; i++) {
    const raw = val('mpP' + i).trim();
    if (raw === '') continue;
    const p = Number(raw);
    if (!isFinite(p) || p <= 0 || p >= 1) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `"${val('mpLabel' + i).trim() || 'Endpoint ' + (i + 1)}": p-value must be between 0 and 1.`));
      return;
    }
    entries.push({ label: val('mpLabel' + i).trim() || 'Endpoint ' + (i + 1), p });
  }
  if (entries.length < 2) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Enter at least 2 endpoints — multiplicity adjustment only matters when more than one hypothesis is being tested.'));
    return;
  }
  if (!isFinite(alpha) || alpha <= 0 || alpha >= 1) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Alpha must be between 0 and 1.'));
    return;
  }

  const pValues = entries.map(e => e.p);
  const bonf = bonferroniAdjust(pValues, alpha);
  const holm = holmBonferroniAdjust(pValues, alpha);

  const survivedRaw = pValues.filter(p => p <= alpha).length;
  const survivedHolm = holm.filter(h => h.significant).length;
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, survivedHolm + ' / ' + entries.length),
    el('span', { class: 'sublabel' }, `endpoints still significant after adjustment (Holm) — vs. ${survivedRaw} that looked significant using raw, unadjusted p-values alone`)
  ]));

  const table = el('table', { class: 'desctable' }, [
    el('tr', {}, [el('td', { style: 'font-weight:700' }, 'Endpoint'), el('td', { style: 'font-weight:700' }, 'Raw p'), el('td', { style: 'font-weight:700' }, 'Bonferroni'), el('td', { style: 'font-weight:700' }, 'Holm')]),
    ...entries.map((e, i) => el('tr', {}, [
      el('td', {}, e.label),
      el('td', {}, e.p.toFixed(4)),
      el('td', { style: bonf[i].significant ? 'color:var(--teal)' : 'color:var(--ink-3)' }, bonf[i].adjustedP.toFixed(4) + (bonf[i].significant ? ' ✓' : '')),
      el('td', { style: holm[i].significant ? 'color:var(--teal)' : 'color:var(--ink-3)' }, holm[i].adjustedP.toFixed(4) + (holm[i].significant ? ' ✓' : ''))
    ]))
  ]);
  resultsDiv.appendChild(table);

  resultsDiv.appendChild(el('p', { class: 'subtle' },
    holm.filter(h => h.significant).length > bonf.filter(b => b.significant).length
      ? 'Holm found at least one endpoint significant that flat Bonferroni missed — this is expected and is exactly why Holm is generally preferred: same guaranteed false-positive control, strictly more power.'
      : 'Bonferroni and Holm agree on which endpoints survive here — they don’t always, but when the smaller p-values are clustered closely together like this, the two methods often land on the same answer.'));

  const dotRows = entries.flatMap((e, i) => [
    { label: e.label + ' — raw', estimate: e.p, lower: e.p, upper: e.p, color: 'var(--ink-3)' },
    { label: e.label + ' — Bonferroni', estimate: bonf[i].adjustedP, lower: bonf[i].adjustedP, upper: bonf[i].adjustedP, color: bonf[i].significant ? 'var(--teal)' : 'var(--red)' },
    { label: e.label + ' — Holm', estimate: holm[i].adjustedP, lower: holm[i].adjustedP, upper: holm[i].adjustedP, color: holm[i].significant ? 'var(--teal)' : 'var(--red)' }
  ]);
  const dotPlotSvg = renderForestPlot(dotRows, { scale: 'linear', referenceLine: alpha, xLabel: 'p-value — dashed line is α = ' + alpha, labelWidth: 180 });
  appendChartWithExport(resultsDiv, dotPlotSvg, 'multiplicity-adjustment');
}

// ── Tab: Meta-Analysis ───────────────────────────────────────────────────
// The one genuinely different tool in Simulation: every other tool here
// reads ONE trial's result (backward) or projects ONE forward assumption —
// this pools MULTIPLE studies' results into a single combined estimate, the
// real basis for "does the totality of evidence across every readout so far
// support this thesis," not just the most recent trial. Own top-level tab
// rather than a Trial Statistics sub-tool for that reason — same logic that
// gave Phase 2->3 Translator its own tab despite reading a single result.
// A dynamic study list — genuinely open-ended, unlike a single trial's
// handful of endpoints — using module-level id tracking rather than a
// reactive framework, the same pattern this whole vanilla-DOM section
// already uses for its other stateful bits (activeTab, activeStatsSubtab).
let metaStudyIds = [1, 2];
let metaNextStudyId = 3;
let metaMode = 'twoByTwo'; // 'twoByTwo' | 'ciRatio' | 'ciLinear'

function addMetaStudy() {
  metaStudyIds.push(metaNextStudyId++);
  renderApp();
}
function removeMetaStudy(id) {
  if (metaStudyIds.length <= 2) return; // meta-analysis needs at least 2 studies to mean anything
  metaStudyIds = metaStudyIds.filter(x => x !== id);
  renderApp();
}

function renderMetaStudyRow(id, index) {
  const mode = metaMode;
  const fields = mode === 'twoByTwo'
    ? fieldGrid([
        field('Arm A events', numberInput('meta_eventsA_' + id, 20)),
        field('Arm A N', numberInput('meta_nA_' + id, 100)),
        field('Arm B events', numberInput('meta_eventsB_' + id, 30)),
        field('Arm B N', numberInput('meta_nB_' + id, 100))
      ])
    : fieldGrid([
        field('Point estimate' + (mode === 'ciRatio' ? ' (ratio)' : ''), numberInput('meta_point_' + id, mode === 'ciRatio' ? 0.7 : 5, { step: '0.01' })),
        field('CI lower', numberInput('meta_lower_' + id, mode === 'ciRatio' ? 0.5 : 2, { step: '0.01' })),
        field('CI upper', numberInput('meta_upper_' + id, mode === 'ciRatio' ? 0.95 : 8, { step: '0.01' }))
      ]);
  return el('div', { style: 'padding:10px 12px;border-radius:8px;background:var(--surface-2);margin-bottom:8px' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' }, [
      field('Study label', el('input', { type: 'text', id: 'meta_label_' + id, value: 'Study ' + (index + 1) })),
      metaStudyIds.length > 2 ? el('button', { style: 'margin-left:10px;padding:5px 10px;border-radius:6px;border:1px solid var(--red);background:transparent;color:var(--red);font-family:var(--mono);font-size:11px;cursor:pointer;white-space:nowrap', onclick: () => removeMetaStudy(id) }, '× Remove') : null
    ]),
    fields
  ]);
}

function renderMetaAnalysisTab(content) {
  content.appendChild(el('h2', { style: 'margin:4px 0 4px 2px' }, ['Meta-Analysis', el('span', { class: 'badge info' }, '↔ Backward + Forward')]));
  content.appendChild(el('p', { class: 'subtle', style: 'margin:0 0 10px 2px' }, 'Pools multiple studies into one combined estimate, fixed-effect and random-effects side by side — so you can see whether the studies actually agree, not just what the average says.'));

  const form = el('div', { class: 'panel' }, [
    note('New here? When would I actually use this', 'Use this when a thesis rests on more than one trial — a drug class with 3 different companies’ readouts, or one company’s Phase 2 plus an earlier related compound’s Phase 3. Rather than eyeballing "these all look roughly positive," pooling gives an actual combined estimate and, just as importantly, tells you whether the studies genuinely agree (I² near 0%, tight forest-plot whiskers clustered together) or are quietly telling different stories (I² high, whiskers scattered wide) — the latter is a real signal that averaging them into one number may be hiding more than it reveals. Pick "Study data entry" based on what you actually have for each trial: raw event counts (e.g. "12/80 vs 20/82") use 2×2 tables; a hazard/risk/odds ratio already stated with its CI (as most press releases report it) uses ratio scale; a mean or risk difference already stated with its CI uses linear scale. All studies in one pooling run must use the same mode.'),
    field('Study data entry', selectInput('metaModeSelect', [
      { value: 'twoByTwo', label: '2×2 event tables (pools as risk ratio)' },
      { value: 'ciRatio', label: 'Point estimate + CI — ratio scale (HR, RR, OR already reported)' },
      { value: 'ciLinear', label: 'Point estimate + CI — linear scale (mean difference, risk difference already reported)' }
    ], metaMode)),
    el('div', { id: 'metaStudiesContainer' }, metaStudyIds.map((id, i) => renderMetaStudyRow(id, i))),
    el('button', { class: 'runbtn', style: 'background:transparent;border:1px dashed var(--ink-3);color:var(--ink-2);margin-right:8px', onclick: addMetaStudy }, '+ Add study'),
    el('button', { class: 'runbtn', onclick: runMetaAnalysis }, 'Pool studies'),
    el('div', { id: 'metaResults', class: 'results' })
  ]);
  content.appendChild(form);
  document.getElementById('metaModeSelect').addEventListener('change', (e) => { metaMode = e.target.value; renderApp(); });
}

function runMetaAnalysis() {
  const mode = metaMode;
  const resultsDiv = document.getElementById('metaResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';
  const isRatioScale = mode === 'twoByTwo' || mode === 'ciRatio';

  const studies = [];
  for (const id of metaStudyIds) {
    const label = val('meta_label_' + id).trim() || ('Study ' + id);
    if (mode === 'twoByTwo') {
      const eventsA = numVal('meta_eventsA_' + id), nA = numVal('meta_nA_' + id);
      const eventsB = numVal('meta_eventsB_' + id), nB = numVal('meta_nB_' + id);
      if (![eventsA, nA, eventsB, nB].every(isFinite) || nA <= 0 || nB <= 0 || eventsA <= 0 || eventsB <= 0 || eventsA >= nA || eventsB >= nB) {
        resultsDiv.appendChild(el('p', { class: 'error' }, `"${label}": check the event counts — each must be between 1 and N-1 (0% and 100% event rates can't produce a risk ratio).`));
        return;
      }
      const rr = computeRiskRatio(eventsA, nA, eventsB, nB);
      studies.push({ label, estimate: Math.log(rr.rr), se: rr.seLog, displayEstimate: rr.rr, displayLower: rr.lower, displayUpper: rr.upper });
    } else {
      const point = numVal('meta_point_' + id), lower = numVal('meta_lower_' + id), upper = numVal('meta_upper_' + id);
      if (![point, lower, upper].every(isFinite) || upper <= lower || (isRatioScale && (point <= 0 || lower <= 0))) {
        resultsDiv.appendChild(el('p', { class: 'error' }, `"${label}": check the estimate and CI — upper must exceed lower` + (isRatioScale ? ', and ratio-scale values must be positive.' : '.')));
        return;
      }
      const scaledPoint = isRatioScale ? Math.log(point) : point;
      const scaledLower = isRatioScale ? Math.log(lower) : lower;
      const scaledUpper = isRatioScale ? Math.log(upper) : upper;
      const se = ciToSE(scaledLower, scaledUpper);
      studies.push({ label, estimate: scaledPoint, se, displayEstimate: point, displayLower: lower, displayUpper: upper });
    }
  }
  if (studies.length < 2) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Need at least 2 studies to pool.'));
    return;
  }

  const fe = computeFixedEffectMetaAnalysis(studies);
  const re = computeRandomEffectsMetaAnalysis(studies);
  const het = re.heterogeneity;
  const toDisplay = v => isRatioScale ? Math.exp(v) : v;

  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, toDisplay(re.estimate).toFixed(isRatioScale ? 3 : 2)),
    el('span', { class: 'sublabel' }, `pooled estimate, random-effects (${(0.95*100).toFixed(0)}% CI ${toDisplay(re.lower).toFixed(isRatioScale ? 3 : 2)} to ${toDisplay(re.upper).toFixed(isRatioScale ? 3 : 2)})`)
  ]));
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    `Fixed-effect estimate: ${toDisplay(fe.estimate).toFixed(isRatioScale ? 3 : 2)} (CI ${toDisplay(fe.lower).toFixed(isRatioScale ? 3 : 2)} to ${toDisplay(fe.upper).toFixed(isRatioScale ? 3 : 2)}). ${het.iSquared < 25 ? 'Low heterogeneity (I² = ' + het.iSquared.toFixed(0) + '%) — the studies broadly agree, so fixed and random-effects land close together.' : het.iSquared < 75 ? 'Moderate heterogeneity (I² = ' + het.iSquared.toFixed(0) + '%) — real disagreement between studies exists; lean on the random-effects estimate, which is wider precisely to account for that.' : 'High heterogeneity (I² = ' + het.iSquared.toFixed(0) + '%) — these studies disagree substantially. A single pooled number may be masking real, meaningful differences between them (different populations, doses, or endpoints) rather than just sampling noise.'}`));

  const forestRows = studies.map(s => ({ label: s.label, estimate: s.displayEstimate, lower: s.displayLower, upper: s.displayUpper }));
  const forestSvg = renderForestPlot(forestRows, {
    scale: isRatioScale ? 'log' : 'linear',
    referenceLine: isRatioScale ? 1 : 0,
    pooled: { label: 'Pooled (random-effects)', estimate: toDisplay(re.estimate), lower: toDisplay(re.lower), upper: toDisplay(re.upper) },
    title: 'Forest plot',
    xLabel: isRatioScale ? 'Ratio (log scale)' : 'Difference'
  });
  appendChartWithExport(resultsDiv, forestSvg, 'meta-analysis');
}

function renderSsEndpointFields() {
  const mode = val('ssSolveMode');
  const type = val('ssEndpointType');
  const container = document.getElementById('ssEndpointFields');
  if (!container) return;  // tab changed before this ran — nothing to write into
  container.innerHTML = '';
  container.className = 'fieldgrid';
  if (mode === 'sampleSize') {
    if (type === 'binary') {
      container.appendChild(field('Control response rate', numberInput('ssControlRate', 0.30, { step: '0.01' })));
      container.appendChild(field('Assumed treatment response rate', numberInput('ssTreatRate', 0.45, { step: '0.01' })));
    } else if (type === 'continuous') {
      container.appendChild(field('Assumed mean difference', numberInput('ssDelta', 5)));
      container.appendChild(field('Assumed common SD', numberInput('ssSd', 10)));
    } else {
      container.appendChild(field('Assumed hazard ratio', numberInput('ssHazardRatio', 0.7, { step: '0.01' })));
      container.appendChild(el('p', { class: 'subtle field-wide' }, 'Solves for total events required (Schoenfeld), not enrolled patients — converting events to enrollment needs accrual/follow-up assumptions this calculator doesn’t ask for.'));
    }
  } else {
    // Minimum Detectable Effect mode — N is the given, fixed quantity (already
    // enrolling or fully enrolled), and the tool solves for the smallest
    // effect that would actually read out significant at the target power.
    if (type === 'binary') {
      container.appendChild(field('Control response rate', numberInput('mdeControlRate', 0.30, { step: '0.01' })));
      container.appendChild(field('N per arm (already fixed)', numberInput('mdeN', 150, { step: '1' })));
    } else if (type === 'continuous') {
      container.appendChild(field('Assumed common SD', numberInput('mdeSd', 10)));
      container.appendChild(field('N per arm (already fixed)', numberInput('mdeN', 85, { step: '1' })));
    } else {
      container.appendChild(field('Total events (already fixed)', numberInput('mdeEvents', 200, { step: '1' })));
      container.appendChild(el('p', { class: 'subtle field-wide' }, 'Solves for the smallest hazard ratio your event count could actually detect — the same Schoenfeld approximation as the sample-size direction, just inverted.'));
    }
  }
}

function runSampleSize() {
  const mode = val('ssSolveMode');
  const type = val('ssEndpointType');
  const targetPower = numVal('ssPower'), alpha = numVal('ssAlpha'), sided = val('ssSided');
  const allocationRatio = numVal('ssAllocation');
  const resultsDiv = document.getElementById('sampleSizeResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![targetPower, alpha, allocationRatio].every(isFinite) || targetPower <= 0 || targetPower >= 1 || allocationRatio <= 0) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Check target power (between 0 and 1) and allocation ratio (greater than 0).'));
    return;
  }

  if (mode === 'minDetectableEffect') { runMinDetectableEffect(type, targetPower, alpha, sided, allocationRatio, resultsDiv); return; }

  if (type === 'binary') {
    const p1 = numVal('ssControlRate'), p2 = numVal('ssTreatRate');
    if (![p1, p2].every(isFinite) || p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Response rates must be between 0 and 1.'));
      return;
    }
    const r = solveSampleSizeTwoProportion(p1, p2, targetPower, alpha, sided, allocationRatio);
    if (r.n1 == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `That effect size (${(p1*100).toFixed(0)}% vs ${(p2*100).toFixed(0)}%) is too small to reach ${(targetPower*100).toFixed(0)}% power within a realistic sample size.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.n1.toLocaleString() + ' / ' + r.n2.toLocaleString()),
      el('span', { class: 'sublabel' }, `per arm (control / treatment) — ${r.totalN.toLocaleString()} total, achieving ${(r.achievedPower*100).toFixed(1)}% power`)
    ]));
    const curvePoints = powerCurvePoints(n => closedFormPowerTwoProportion(p1, p2, n, Math.max(1, Math.round(n * allocationRatio)), alpha, sided), Math.ceil(r.n1 * 1.6));
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. sample size', xLabel: 'N (control arm)', yLabel: 'Power', markerX: r.n1, markerLabel: 'n=' + r.n1.toLocaleString()
    });
    appendChartWithExport(resultsDiv, chartHtml, 'sample-size-power-curve');
  } else if (type === 'continuous') {
    const delta = numVal('ssDelta'), sd = numVal('ssSd');
    if (![delta, sd].every(isFinite) || sd <= 0 || delta === 0) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'SD must be positive and the mean difference non-zero.'));
      return;
    }
    const r = solveSampleSizeMeans(delta, sd, targetPower, alpha, sided, allocationRatio);
    if (r.n1 == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `That effect size is too small to reach ${(targetPower*100).toFixed(0)}% power within a realistic sample size.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.n1.toLocaleString() + ' / ' + r.n2.toLocaleString()),
      el('span', { class: 'sublabel' }, `per arm (control / treatment) — ${r.totalN.toLocaleString()} total, achieving ${(r.achievedPower*100).toFixed(1)}% power`)
    ]));
    const curvePoints = powerCurvePoints(n => closedFormPowerMeans(delta, sd, n, Math.max(1, Math.round(n * allocationRatio)), alpha, sided), Math.ceil(r.n1 * 1.6));
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. sample size', xLabel: 'N (control arm)', yLabel: 'Power', markerX: r.n1, markerLabel: 'n=' + r.n1.toLocaleString()
    });
    appendChartWithExport(resultsDiv, chartHtml, 'sample-size-power-curve');
  } else {
    const hr = numVal('ssHazardRatio');
    if (!isFinite(hr) || hr <= 0 || hr === 1) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Hazard ratio must be positive and not equal to 1.'));
      return;
    }
    const r = solveEventsNeeded(hr, targetPower, alpha, allocationRatio);
    if (r.n == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `That hazard ratio is too close to 1 to reach ${(targetPower*100).toFixed(0)}% power within a realistic number of events.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, r.n.toLocaleString()),
      el('span', { class: 'sublabel' }, `total events required, achieving ${(r.achievedPower*100).toFixed(1)}% power (Schoenfeld approximation)`)
    ]));
    const curvePoints = powerCurvePoints(events => schoenfeldPower(hr, events, allocationRatio, alpha), Math.ceil(r.n * 1.6));
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. total events', xLabel: 'Total events', yLabel: 'Power', markerX: r.n, markerLabel: 'events=' + r.n.toLocaleString()
    });
    appendChartWithExport(resultsDiv, chartHtml, 'sample-size-power-curve');
  }
}

// Generates points across [0, nMax] for any single-argument power function
// (closedFormPowerTwoProportion/closedFormPowerMeans/schoenfeldPower
// partially applied to everything except the swept quantity), for the power
// curve shown alongside each Sample Size / Power result. Deliberately calls
// the SAME already-verified closed-form functions the headline number comes
// from — this is a visualization of already-checked math, not a new formula.
function powerCurvePoints(powerFn, nMax, steps = 40) {
  const points = [];
  for (let i = 1; i <= steps; i++) {
    const n = Math.max(2, Math.round((i / steps) * nMax));
    points.push({ x: n, y: powerFn(n) });
  }
  return points;
}

function runMinDetectableEffect(type, targetPower, alpha, sided, allocationRatio, resultsDiv) {
  if (type === 'binary') {
    const p1 = numVal('mdeControlRate'), n1 = Math.round(numVal('mdeN'));
    if (!isFinite(p1) || p1 <= 0 || p1 >= 1) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Control response rate must be between 0 and 1.'));
      return;
    }
    if (!isFinite(n1) || n1 < 2) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'N per arm must be at least 2.'));
      return;
    }
    const n2 = Math.round(n1 * allocationRatio);
    const r = solveMinDetectableRateTwoProportion(p1, n1, n2, targetPower, alpha, sided);
    if (r.p2 == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `Even the largest possible gap from ${(p1*100).toFixed(0)}% control can't reach ${(targetPower*100).toFixed(0)}% power at n=${n1.toLocaleString()} per arm — this N is too small for this endpoint at this control rate.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, '≥' + (r.p2 * 100).toFixed(1) + '%'),
      el('span', { class: 'sublabel' }, `minimum detectable treatment response rate — +${(r.delta * 100).toFixed(1)}pp over ${(p1*100).toFixed(0)}% control, achieving ${(r.achievedPower*100).toFixed(1)}% power at n=${n1.toLocaleString()}/${n2.toLocaleString()} per arm`)
    ]));
    resultsDiv.appendChild(el('p', { class: 'subtle' }, `If your actual observed/expected treatment rate comes in below ${(r.p2*100).toFixed(1)}%, this N isn't enough to reach ${(targetPower*100).toFixed(0)}% power for it — not that the drug doesn't work, just that this trial isn't sized to prove it at that effect size.`));
    const curvePoints = powerCurvePointsRange(p2sweep => closedFormPowerTwoProportion(p1, p2sweep, n1, n2, alpha, sided), p1 + 0.005, Math.min(0.995, r.p2 * 1.3));
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. treatment response rate', xLabel: 'Treatment response rate', yLabel: 'Power', markerX: r.p2, markerLabel: (r.p2 * 100).toFixed(1) + '%'
    });
    appendChartWithExport(resultsDiv, chartHtml, 'minimum-detectable-effect-curve');
  } else if (type === 'continuous') {
    const sd = numVal('mdeSd'), n1 = Math.round(numVal('mdeN'));
    if (!isFinite(sd) || sd <= 0) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'SD must be positive.'));
      return;
    }
    if (!isFinite(n1) || n1 < 2) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'N per arm must be at least 2.'));
      return;
    }
    const n2 = Math.round(n1 * allocationRatio);
    const r = solveMinDetectableDeltaMeans(sd, n1, n2, targetPower, alpha, sided);
    if (r.delta == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `Couldn't find a realistic detectable effect at n=${n1.toLocaleString()} per arm — this N is too small for this SD.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, '≥' + r.delta.toFixed(2)),
      el('span', { class: 'sublabel' }, `minimum detectable mean difference, achieving ${(r.achievedPower*100).toFixed(1)}% power at n=${n1.toLocaleString()}/${n2.toLocaleString()} per arm (SD ${sd})`)
    ]));
    resultsDiv.appendChild(el('p', { class: 'subtle' }, `If the true mean difference is smaller than ${r.delta.toFixed(2)}, this N isn't enough to reach ${(targetPower*100).toFixed(0)}% power for it.`));
    const curvePoints = powerCurvePointsRange(deltaSweep => closedFormPowerMeans(deltaSweep, sd, n1, n2, alpha, sided), r.delta * 0.05, r.delta * 1.5);
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. mean difference', xLabel: 'Mean difference', yLabel: 'Power', markerX: r.delta, markerLabel: '≥' + r.delta.toFixed(2)
    });
    appendChartWithExport(resultsDiv, chartHtml, 'minimum-detectable-effect-curve');
  } else {
    const events = Math.round(numVal('mdeEvents'));
    if (!isFinite(events) || events < 2) {
      resultsDiv.appendChild(el('p', { class: 'error' }, 'Total events must be at least 2.'));
      return;
    }
    const r = solveMinDetectableHazardRatio(events, allocationRatio, targetPower, alpha);
    if (r.hazardRatio == null) {
      resultsDiv.appendChild(el('p', { class: 'error' }, `Couldn't find a realistic detectable hazard ratio at ${events.toLocaleString()} events.`));
      return;
    }
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum' }, '≤' + r.hazardRatio.toFixed(3)),
      el('span', { class: 'sublabel' }, `minimum detectable hazard ratio (must be this strong or stronger), achieving ${(r.achievedPower*100).toFixed(1)}% power at ${events.toLocaleString()} events (Schoenfeld approximation)`)
    ]));
    resultsDiv.appendChild(el('p', { class: 'subtle' }, `If the true hazard ratio is closer to 1 than ${r.hazardRatio.toFixed(3)} (a weaker effect), this event count isn't enough to reach ${(targetPower*100).toFixed(0)}% power for it.`));
    const curvePoints = powerCurvePointsRange(hrSweep => schoenfeldPower(hrSweep, events, allocationRatio, alpha), Math.max(0.01, r.hazardRatio * 0.7), 0.99);
    const chartHtml = renderLineChart([{ name: 'Power', color: 'var(--teal)', points: curvePoints }], {
      title: 'Power vs. hazard ratio', xLabel: 'Hazard ratio', yLabel: 'Power', markerX: r.hazardRatio, markerLabel: '≤' + r.hazardRatio.toFixed(3)
    });
    appendChartWithExport(resultsDiv, chartHtml, 'minimum-detectable-effect-curve');
  }
}

// Generic variant of powerCurvePoints with explicit bounds — needed for the
// Minimum Detectable Effect direction, where the swept quantity is the
// EFFECT SIZE (not N, which is fixed there), so a fixed "start near 0" range
// doesn't make sense the way it does for the sample-size curves above.
function powerCurvePointsRange(powerFn, xLow, xHigh, steps = 40) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const x = xLow + (i / steps) * (xHigh - xLow);
    points.push({ x, y: powerFn(x) });
  }
  return points;
}

function runFragilityIndex() {
  const labelA = val('fiLabelA').trim() || 'Arm A';
  const labelB = val('fiLabelB').trim() || 'Arm B';
  const eventsA = numVal('fiEventsA'), nA = numVal('fiNA');
  const eventsB = numVal('fiEventsB'), nB = numVal('fiNB');
  const alpha = numVal('fiAlpha');
  const resultsDiv = document.getElementById('fragilityResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![eventsA, nA, eventsB, nB, alpha].every(isFinite) || nA <= 0 || nB <= 0 || eventsA < 0 || eventsB < 0 || eventsA > nA || eventsB > nB) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Check the inputs — event counts must be between 0 and that arm’s total N.'));
    return;
  }

  const fi = computeFragilityIndex(eventsA, nA, eventsB, nB, alpha);

  if (!fi.significant) {
    resultsDiv.appendChild(el('div', { class: 'headline' }, [
      el('span', { class: 'bignum small' }, 'p = ' + fi.observedP.toFixed(4)),
      el('span', { class: 'sublabel' }, `not significant at α=${alpha} — the Fragility Index only applies to a result that reached significance to begin with`)
    ]));
    return;
  }

  const flipLabel = fi.flipArm === 'A' ? labelA : labelB;
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, fi.exhausted || fi.fragilityIndex == null ? 'Robust' : String(fi.fragilityIndex)),
    el('span', { class: 'sublabel' }, fi.exhausted || fi.fragilityIndex == null
      ? `even flipping every remaining patient in ${flipLabel} doesn't erase significance (p stops at ${fi.finalP.toFixed(4)})`
      : `patient${fi.fragilityIndex === 1 ? '' : 's'} in ${flipLabel} would need to flip from non-event to event to bring this back above α=${alpha}`)
  ]));
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    `Observed: ${eventsA}/${nA} (${labelA}) vs. ${eventsB}/${nB} (${labelB}), two-sided Fisher's exact p = ${fi.observedP.toFixed(4)}.` +
    (fi.exhausted || fi.fragilityIndex == null ? '' : ` After the flip: p = ${fi.finalP.toFixed(4)}.`)));

  if (!fi.exhausted && fi.fragilityIndex != null) {
    const flipArmN = fi.flipArm === 'A' ? nA : nB;
    const iconArraySvg = renderIconArray(fi.fragilityIndex / flipArmN, {
      highlightColor: 'var(--amber)',
      title: `${fi.fragilityIndex} out of ${flipArmN}`,
      subtitle: `share of ${flipLabel}'s patients whose outcome would need to flip to erase significance`
    });
    appendChartWithExport(resultsDiv, iconArraySvg, 'fragility-index');
  } else {
    appendResultCapture(resultsDiv, 'fragility-index');
  }
}

// "Prior mean"/"Prior SD" mean a different thing on every axis here (an
// absolute response rate for binary, a mean difference for continuous, a
// hazard ratio for time-to-event) — found during testing that leaving them
// as one static field meant switching endpoint type kept whatever number was
// already there, silently reinterpreting it on a completely different scale
// (a leftover hazard-ratio-shaped 0.15 read as a binary response rate, or
// vice versa). Rebuilding them here alongside the rest of the endpoint's
// design fields keeps every field's default on the scale that's actually
// selected, the same way nControl/nTreat/etc. already do.
const PRIOR_DEFAULTS = {
  binary: { mean: 0.45, sd: 0.05 },
  continuous: { mean: 8, sd: 3 },
  timeToEvent: { mean: 0.7, sd: 0.1 }
};

function renderEndpointFields() {
  const type = val('endpointType');
  const container = document.getElementById('endpointFields');
  if (!container) return;  // tab changed before this ran — nothing to write into
  container.innerHTML = '';
  container.className = 'fieldgrid';
  if (type === 'binary') {
    container.appendChild(field('Control arm N', numberInput('nControl', 150)));
    container.appendChild(field('Treatment arm N', numberInput('nTreat', 150)));
    container.appendChild(field('Control response rate', numberInput('controlRate', 0.30, { step: '0.01' })));
    container.appendChild(el('p', { class: 'subtle field-wide' }, 'Prior mean/SD below describe the assumed true treatment-arm response rate.'));
  } else if (type === 'continuous') {
    container.appendChild(field('Control arm N', numberInput('nControl', 100)));
    container.appendChild(field('Treatment arm N', numberInput('nTreat', 100)));
    container.appendChild(field('Control mean', numberInput('controlMean', 20)));
    container.appendChild(field('Assumed common SD', numberInput('sd', 15)));
    container.appendChild(el('p', { class: 'subtle field-wide' }, 'Prior mean/SD below describe the assumed true mean difference (treatment minus control).'));
  } else {
    container.appendChild(field('Control arm N', numberInput('nControl', 200)));
    container.appendChild(field('Treatment arm N', numberInput('nTreat', 200)));
    container.appendChild(field('Control median survival (months)', numberInput('medianControl', 12)));
    container.appendChild(field('Accrual period (months)', numberInput('accrualPeriod', 18)));
    container.appendChild(field('Follow-up after last enrollment (months)', numberInput('followupPeriod', 12)));
    container.appendChild(el('p', { class: 'subtle field-wide' }, 'Prior mean/SD below describe the assumed true hazard ratio (treatment vs. control).'));
  }

  const priorContainer = document.getElementById('priorFields');
  if (priorContainer) {
    priorContainer.innerHTML = '';
    priorContainer.className = 'fieldgrid';
    const d = PRIOR_DEFAULTS[type] || PRIOR_DEFAULTS.binary;
    priorContainer.appendChild(field('Prior mean', numberInput('priorMean', d.mean, { step: '0.01' })));
    priorContainer.appendChild(field('Prior SD (ignored if fixed)', numberInput('priorSd', d.sd, { step: '0.01' })));
  }
}

function runTrialOutcome() {
  const endpointType = val('endpointType');
  // The engine deliberately throws on an unknown endpoint type — that is the
  // right contract for a bad call. But a handler can fire after its tab has
  // been swapped out, at which point the selector is gone and val() returns
  // "". Bail here rather than letting a legitimate engine guard surface as an
  // uncaught error in a view that no longer exists.
  if (!endpointType) return;
  const alpha = numVal('alpha');
  const sided = val('sided');
  const iterations = Math.max(1000, Math.round(numVal('iterations')));
  const priorType = val('priorType');
  const priorMean = numVal('priorMean');
  const priorSd = numVal('priorSd');
  const prior = priorType === 'point' ? { type: 'point', value: priorMean } : { type: 'normal', mean: priorMean, sd: priorSd };

  let design;
  if (endpointType === 'binary') {
    design = { nControl: numVal('nControl'), nTreat: numVal('nTreat'), controlRate: numVal('controlRate') };
  } else if (endpointType === 'continuous') {
    design = { nControl: numVal('nControl'), nTreat: numVal('nTreat'), controlMean: numVal('controlMean'), sd: numVal('sd') };
  } else {
    design = { nControl: numVal('nControl'), nTreat: numVal('nTreat'), medianControl: numVal('medianControl'), accrualPeriod: numVal('accrualPeriod'), followupPeriod: numVal('followupPeriod') };
  }

  const result = runAssuranceSimulation({ endpointType, design, prior, alpha, sided, iterations });
  const resultsDiv = document.getElementById('trialOutcomeResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, (result.pos * 100).toFixed(1) + '%'),
    el('span', { class: 'sublabel' }, `assurance (PoS)  \u00B1${(result.posStdErr * 100).toFixed(2)}pp Monte Carlo SE, ${result.iterations.toLocaleString()} iterations`)
  ]));
  const chartHtml = renderHistogram(result.observedEffects.filter(v => isFinite(v)), {
    title: 'Simulated observed effect across replicates', xLabel: 'Observed effect', markerValue: priorMean, markerLabel: 'prior mean'
  });
  appendChartWithExport(resultsDiv, chartHtml, 'trial-outcome-assurance');

  // Time-to-event only: the assumed survival curves the hazard ratio actually
  // implies. The single most standard visual in oncology trial reporting, and
  // the one this tab was missing — "HR 0.65" is abstract until you see the two
  // curves it produces and can read median survival off them directly. Uses
  // the same exponential survival model the replicate simulator itself uses
  // (S(t) = exp(-rate*t), rate = ln2/median), so this is a picture of the
  // assumption being simulated, not a second, separate model.
  if (endpointType === 'timeToEvent') {
    const medianControl = design.medianControl;
    const hr = priorMean;
    if (isFinite(medianControl) && medianControl > 0 && isFinite(hr) && hr > 0) {
      const rateControl = Math.log(2) / medianControl;
      const rateTreat = rateControl * hr;
      const tEnd = design.accrualPeriod + design.followupPeriod;
      const controlPts = [], treatPts = [];
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * tEnd;
        controlPts.push({ x: t, y: 100 * Math.exp(-rateControl * t) });
        treatPts.push({ x: t, y: 100 * Math.exp(-rateTreat * t) });
      }
      const medianTreat = Math.log(2) / rateTreat;
      const kmSvg = renderLineChart([
        { name: 'Control', color: 'var(--ink-2)', points: controlPts },
        { name: 'Treatment', color: 'var(--teal)', points: treatPts }
      ], {
        title: 'Assumed survival curves at the prior hazard ratio',
        xLabel: 'Months since randomization', yLabel: '% event-free'
      });
      appendChartWithExport(resultsDiv, kmSvg, 'trial-outcome-survival-curves');
      resultsDiv.appendChild(el('p', { class: 'subtle' },
        `At HR ${hr.toFixed(3)}, median survival goes from ${medianControl.toFixed(1)} months (control) to ${medianTreat.toFixed(1)} months (treatment) — a gain of ${(medianTreat - medianControl).toFixed(1)} months. Exponential (constant-hazard) survival, the same model the replicate simulation uses; real curves with a changing hazard over time will differ in shape while landing on the same overall hazard ratio.`));
    }
  }
}

// ── Tab: Peak Sales ──────────────────────────────────────────────────────

function renderPeakSalesTab(content) {
  const distTypes = [{ value: 'point', label: 'Fixed' }, { value: 'uniform', label: 'Uniform (low/high)' }, { value: 'normal', label: 'Normal (mean/SD)' }, { value: 'triangular', label: 'Triangular (low/mode/high)' }];
  // B/C start blank for any field whose default type doesn't need them (see
  // the field() calls below) — found during testing that picking a
  // distribution type which DOES need them (e.g. Normal) leaves B/C at that
  // blank default, so parseFloat('') = NaN flows straight into the
  // simulation with no guard, surfacing as a literal "$NaN" result. Seeding
  // a sensible value off the current A the moment a type that needs it gets
  // picked — only when the field is still blank, never overwriting a real
  // typed value — closes that without adding validation UI.
  function seedDistDefaults(prefix) {
    const type = document.getElementById(prefix + 'Type').value;
    const aEl = document.getElementById(prefix + 'A'), bEl = document.getElementById(prefix + 'B'), cEl = document.getElementById(prefix + 'C');
    const a = parseFloat(aEl.value);
    if (!isFinite(a)) return;
    const setIfBlank = (el, v) => { if (el.value.trim() === '') el.value = v; };
    if (type === 'uniform') setIfBlank(bEl, (a * 1.5).toPrecision(4));
    else if (type === 'normal') setIfBlank(bEl, (a * 0.2).toPrecision(4));
    else if (type === 'triangular') { setIfBlank(bEl, (a * 1.2).toPrecision(4)); setIfBlank(cEl, (a * 1.5).toPrecision(4)); }
  }
  function distFields(prefix, defaults) {
    const typeSelect = selectInput(prefix + 'Type', distTypes, defaults.type);
    typeSelect.addEventListener('change', () => seedDistDefaults(prefix));
    return el('div', { class: 'distfields' }, [
      typeSelect,
      numberInput(prefix + 'A', defaults.a),
      numberInput(prefix + 'B', defaults.b),
      numberInput(prefix + 'C', defaults.c)
    ]);
  }
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, ['Peak-sales Monte Carlo', el('span', { class: 'badge info' }, '→ Forward-looking')]),
    el('p', { class: 'subtle' }, 'Each input below can be a fixed value or a distribution. A: point value / low / mean. B: high / SD / mode. C: high (triangular only).'),
    note('Which distribution type should I pick?', '"Fixed" is for anything you actually know or want to hold constant — a stated price, a fixed population count. "Uniform" (low/high) says any value in that range is equally plausible — a reasonable default when you have a range but no real opinion on where within it the true value sits, like peak market share here. "Normal" (mean/SD) is for a value you have a real point estimate for plus a sense of how uncertain it is — most values cluster near the mean, symmetric in both directions. "Triangular" (low/mode/high) is for when you have a most-likely case plus a plausible low and high, but the low and high aren’t equally far from the most-likely value — common when a range is asymmetric (e.g. "probably $2B, could be as low as $1B, but a real blowout could hit $5B").'),
    field('Addressable population', distFields('pop', { type: 'point', a: 1000000, b: '', c: '' })),
    field('Diagnosis rate', distFields('dx', { type: 'point', a: 0.6, b: '', c: '' })),
    field('Treatment rate', distFields('tx', { type: 'point', a: 0.5, b: '', c: '' })),
    field('Peak market share', distFields('share', { type: 'uniform', a: 0.15, b: 0.35, c: '' })),
    field('Annual price (USD)', distFields('price', { type: 'point', a: 100000, b: '', c: '' })),
    field('Iterations', numberInput('peakIterations', 10000, { step: '1000' })),
    el('button', { class: 'runbtn', onclick: runPeakSales }, 'Run simulation'),
    el('div', { id: 'peakSalesResults', class: 'results' })
  ]);
  content.appendChild(form);
}

function readDistInput(prefix) {
  const type = val(prefix + 'Type');
  const a = numVal(prefix + 'A');
  const b = numVal(prefix + 'B');
  const c = numVal(prefix + 'C');
  if (type === 'point') return { type: 'point', value: a };
  if (type === 'uniform') return { type: 'uniform', low: a, high: b };
  if (type === 'normal') return { type: 'normal', mean: a, sd: b };
  return { type: 'triangular', low: a, mode: b, high: c };
}

function runPeakSales() {
  // Same rationale as runTrialOutcome: sampleInput() throws on an unknown
  // distribution type, which is correct, but an unmounted tab yields "".
  if (!val('popType')) return;
  const inputs = {
    addressablePopulation: readDistInput('pop'),
    diagnosisRate: readDistInput('dx'),
    treatmentRate: readDistInput('tx'),
    peakShare: readDistInput('share'),
    annualPriceUSD: readDistInput('price')
  };
  const iterations = Math.max(1000, Math.round(numVal('peakIterations')));
  const result = runPeakSalesSimulation(inputs, iterations);
  const drivers = driverSensitivity(result);

  const resultsDiv = document.getElementById('peakSalesResults');

  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, '$' + formatNumber(result.summary.p50)),
    el('span', { class: 'sublabel' }, `median peak sales  (P10 $${formatNumber(result.summary.p10)} \u2014 P90 $${formatNumber(result.summary.p90)})`)
  ]));
  const chartHtml = renderHistogram(result.samples.map(s => s.peakSalesUSD), {
    title: 'Peak sales distribution', xLabel: 'Peak sales (USD)', markerValue: result.summary.p50, markerLabel: 'median'
  });
  appendChartWithExport(resultsDiv, chartHtml, 'peak-sales-monte-carlo');

  resultsDiv.appendChild(el('h3', {}, 'What is actually driving this range'));
  resultsDiv.appendChild(el('p', { class: 'subtle' }, 'Correlation between each input’s sampled value and the resulting peak sales, across every simulated trial — the longer the bar, the more that one assumption is moving your range. Teal pushes peak sales up, red pushes it down (only meaningful for an input where you’d expect a negative relationship; here all five are naturally positive).'));
  const driverLabels = { population: 'Addressable population', diagnosisRate: 'Diagnosis rate', treatmentRate: 'Treatment rate', peakShare: 'Peak market share', price: 'Annual price' };
  const tornadoSvg = renderTornadoChart(drivers.map(d => ({ label: driverLabels[d.driver] || d.driver, value: d.correlation })), {
    xLabel: 'Correlation with peak sales'
  });
  appendChartWithExport(resultsDiv, tornadoSvg, 'peak-sales-driver-sensitivity');

  appendExportToCaseSection(resultsDiv, result.summary.p50);
}

// Export section — reads window.pdcfSimBridge, set by SimulationView (the
// React wrapper) on every render, since this file has no React access of
// its own. Same explicit, one-click export pattern as the Tools tab's
// comps, never automatic. Deliberately exports only the P50 (median) —
// offering P10/P90 as separate export options would suggest a precision
// this single click doesn't have, when what matters is giving the DCF a
// sane, sourced starting point the user can then adjust.
function appendExportToCaseSection(resultsDiv, p50Value) {
  resultsDiv.appendChild(el('h3', {}, 'Export to a case'));
  const bridge = window.pdcfSimBridge;
  if (!bridge || !bridge.cases || bridge.cases.length === 0) {
    resultsDiv.appendChild(el('p', { class: 'subtle' }, 'No cases yet \u2014 create one in Workspace first.'));
    return;
  }

  const caseOptions = bridge.cases.map(c => ({ value: c.id, label: c.name + (c.ticker ? ' (' + c.ticker + ')' : '') }));
  const caseSelect = selectInput('simExportCaseId', caseOptions, bridge.cases[0].id);
  const programContainer = el('div', { id: 'simExportProgramContainer' });

  function rebuildProgramOptions(caseId) {
    const c = bridge.cases.find(x => x.id === caseId);
    programContainer.innerHTML = '';
    if (c && c.programs && c.programs.length) {
      const progOptions = c.programs.map(p => ({ value: p.id, label: p.drugName || p.name }));
      programContainer.appendChild(selectInput('simExportProgramId', progOptions, c.programs[0].id));
    }
  }
  rebuildProgramOptions(bridge.cases[0].id);
  caseSelect.addEventListener('change', () => rebuildProgramOptions(caseSelect.value));

  const exportMsg = el('p', { class: 'subtle', id: 'simExportMsg' }, '');
  const doExport = () => {
    const liveBridge = window.pdcfSimBridge; // re-read, not the closed-over one — cases may have changed since this section rendered
    const caseId = val('simExportCaseId');
    const programId = document.getElementById('simExportProgramId') ? val('simExportProgramId') : null;
    const targetCase = liveBridge.cases.find(c => c.id === caseId);
    if (!targetCase || !programId) return;
    const updatedPrograms = targetCase.programs.map(p => p.id === programId
      ? { ...p, revenueMode: 'quick', quickRevenue: { ...(p.quickRevenue || {}), peakRevenue: String(Math.round(p50Value)) } }
      : p
    );
    liveBridge.updateCase({ ...targetCase, programs: updatedPrograms, updatedAt: Date.now() });
    const progName = targetCase.programs.find(p => p.id === programId);
    exportMsg.textContent = 'Exported median peak sales ($' + formatNumber(p50Value) + ') to "' + (progName ? (progName.drugName || progName.name) : 'program') + '" in "' + targetCase.name + '".';
  };

  resultsDiv.appendChild(field('Case', caseSelect));
  resultsDiv.appendChild(field('Program', programContainer));
  resultsDiv.appendChild(el('button', { class: 'runbtn', onclick: doExport }, 'Export median (P50) to program\u2019s Quick Revenue'));
  resultsDiv.appendChild(exportMsg);
}

// ── Tab: PK/PD ───────────────────────────────────────────────────────────

function renderPkpdTab(content) {
  const form = el('div', { class: 'panel' }, [
    el('h2', {}, ['PK/PD forward simulation', el('span', { class: 'badge info' }, '→ Forward-looking')]),
    el('p', { class: 'subtle' }, 'Projects a concentration-time profile from published PK parameters, then maps exposure through a dose-response (Emax) curve. Not a fit to patient data, a forward projection from parameters you supply.'),
    note('New to PK/PD modeling? Start here', 'This is the most jargon-heavy tool in the app, but the parameters below aren’t something you derive — you look them up. A drug’s FDA label (Clinical Pharmacology section), a published Phase 1 PK paper, or a comparable already-approved drug’s label are the usual sources; company investor decks sometimes state half-life and bioavailability directly too. A worked example: a label states "oral bioavailability ~80%, elimination half-life ~6 hours, volume of distribution ~50L, Tmax ~2 hours" for a 500mg dose. You’d enter F=0.8, Vd=50, Ke≈ln(2)/6≈0.116 (see the note below the fields for why), and pick a Ka that makes the simulated Tmax land near 2 hours (start around Ka=1.0 and adjust — Tmax isn’t a direct input for oral dosing, it falls out of Ka and Ke together). If you don’t have a dose-response relationship to model, you can still run just the concentration-time profile — Emax/EC50/Hill only affect the dose-response chart at the bottom, not Cmax/half-life/AUC.'),
    field('Route', selectInput('route', [{ value: 'oral', label: 'Oral (first-order absorption)' }, { value: 'iv', label: 'IV bolus' }], 'oral')),
    field('Dose (mg)', numberInput('dose', 500)),
    field('Ka — absorption rate constant (1/hr, oral only)', numberInput('ka', 1.0, { step: '0.01' })),
    field('Ke — elimination rate constant (1/hr)', numberInput('ke', 0.1, { step: '0.01' })),
    field('Vd — volume of distribution (L)', numberInput('Vd', 50)),
    field('F — bioavailability (oral only)', numberInput('F', 1, { step: '0.01', min: 0, max: 1 })),
    field('Dosing interval tau (hr, 0 = single dose)', numberInput('tau', 0)),
    field('Number of doses', numberInput('numDoses', 1)),
    field('Simulation window (hr)', numberInput('tEnd', 48)),
    note('Where these numbers actually come from', 'Ka and Ke are rarely stated directly — what’s usually published is elimination half-life (Ke = ln(2) ÷ half-life, e.g. a 6-hour half-life → Ke ≈ 0.116/hr) and, for oral drugs, Tmax (roughly when concentration peaks — Ka is typically the value you’d adjust to match a reported Tmax, since there’s no closed-form Tmax → Ka formula for the two-parameter absorption model used here). Vd is sometimes given directly (L, or L/kg × 70kg for a typical adult); if only clearance (CL) is reported, Ke = CL ÷ Vd. F (bioavailability) only matters for oral dosing — IV bolus assumes 100% by definition, which is why the field is disabled for that route.'),
    el('h3', {}, 'Receptor occupancy (optional)'),
    el('p', { class: 'subtle' }, 'Bridges concentration to target engagement before the Emax curve below — leave K_D blank to skip this and go straight to Emax, same as before.'),
    field('K_D — receptor binding affinity (same units as concentration, mg/L)', numberInput('kd', '')),
    field('Occupancy hill coefficient', numberInput('roHill', 1, { step: '0.1' })),
    note('Already have a concentration and just want occupancy?', 'If you already know a real concentration — a trough level from a paper, a Cmax reported in a label, or any single number you don’t want to re-derive by simulating dose/Ka/Ke/Vd — use the standalone Receptor Occupancy Calculator further down this page instead of running the full simulation. Same underlying Hill-Langmuir formula, just takes a concentration directly rather than deriving one from a dosing regimen.'),
    el('h3', {}, 'Dose-response (Emax)'),
    el('p', { class: 'subtle' }, 'A sigmoidal (Hill/Emax) curve mapping concentration to effect — the standard dose-response shape.'),
    note('Where E0, Emax, EC50 and Hill come from', 'E0 and Emax are usually reported directly in a paper\u2019s figure or table (the observed baseline and plateau effect). EC50 — the concentration producing half of Emax — and the Hill coefficient are typically fitted parameters reported alongside a dose-response study rather than values you would estimate from scratch. A Hill of 1 is a standard hyperbolic curve; above 1 is steeper and more switch-like.'),
    field('E0 — baseline effect', numberInput('E0', 0)),
    field('Emax — maximum effect', numberInput('Emax', 100)),
    field('EC50 — concentration at half-max effect', numberInput('EC50', 5)),
    field('Hill coefficient', numberInput('hill', 1, { step: '0.1' })),
    el('button', { class: 'runbtn', onclick: runPkpd }, 'Run simulation'),
    el('div', { id: 'pkpdResults', class: 'results' })
  ]);
  content.appendChild(form);
  content.appendChild(renderReceptorOccupancyCalculator());
  document.getElementById('route').addEventListener('change', syncPkpdRouteFields);
  syncPkpdRouteFields();
}

// Ka (absorption rate) and F (bioavailability) are meaningless for an IV
// bolus — the dose enters the bloodstream directly and completely, which is
// why concIVBolus() takes neither. They were previously left editable and
// silently ignored, and the field guidance note even claimed they were
// disabled on this route when nothing disabled them. Greying them out makes
// the model's actual behavior visible instead of asserting it in prose.
function syncPkpdRouteFields() {
  const isIV = val('route') === 'iv';
  ['ka', 'F'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.disabled = isIV;
    const wrap = input.closest('.field');
    if (wrap) {
      wrap.style.opacity = isIV ? '0.45' : '';
      wrap.title = isIV ? 'Not applicable to an IV bolus — the full dose enters circulation directly.' : '';
    }
  });
}

// ── Standalone Receptor Occupancy Calculator ───────────────────────────────────────
// receptorOccupancy() is a trivial three-number closed form (the
// Hill-Langmuir equation) — the full PK/PD tool above only ever exposes it
// wired to a simulated concentration, which means getting an occupancy
// number for a concentration you already know (a reported trough level, a
// label's stated Cmax) means reverse-engineering a dose/Ka/Ke/Vd combination
// that happens to reproduce that exact number. Real, standalone value in
// skipping straight from "concentration in hand" to "% occupied" — same
// function, genuinely independent entry point, not a duplicate UI for its
// own sake.
function renderReceptorOccupancyCalculator() {
  return el('div', { class: 'panel', style: 'margin-top:16px' }, [
    el('h2', {}, 'Receptor occupancy calculator'),
    el('p', { class: 'subtle' }, 'Standalone — skips the concentration-time simulation entirely. Use this when you already have a concentration in hand (a reported trough level, a label’s stated Cmax, an assumed steady-state exposure) rather than one this app simulated.'),
    fieldGrid([
      field('Concentration (same units as K_D, e.g. mg/L)', numberInput('roqConc', 2, { step: '0.01' })),
      field('K_D — receptor binding affinity', numberInput('roqKd', 1, { step: '0.01' })),
      field('Hill coefficient', numberInput('roqHill', 1, { step: '0.1' }))
    ]),
    el('button', { class: 'runbtn', onclick: runReceptorOccupancyCalculator }, 'Calculate occupancy'),
    el('div', { id: 'roqResults', class: 'results' })
  ]);
}

function runReceptorOccupancyCalculator() {
  const conc = numVal('roqConc'), kd = numVal('roqKd'), hill = numVal('roqHill');
  const resultsDiv = document.getElementById('roqResults');
  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';

  if (![conc, kd, hill].every(isFinite) || conc < 0 || kd <= 0 || hill <= 0) {
    resultsDiv.appendChild(el('p', { class: 'error' }, 'Concentration must be 0 or greater, and K_D and Hill coefficient must be positive.'));
    return;
  }

  const occupancy = receptorOccupancy(conc, kd, hill);
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, occupancy.toFixed(1) + '%'),
    el('span', { class: 'sublabel' }, `receptor occupancy at concentration ${conc} (K_D ${kd}, Hill ${hill})`)
  ]));
  resultsDiv.appendChild(el('p', { class: 'subtle' },
    conc === kd ? 'Concentration equals K_D exactly — by definition, occupancy is 50% here regardless of the Hill coefficient.'
      : `At K_D itself (concentration = ${kd}), occupancy would be exactly 50% — this result is ${occupancy > 50 ? 'above' : 'below'} that reference point.`));

  const xMax = Math.max(conc, kd) * 3;
  const curvePoints = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const c = (i / steps) * xMax;
    curvePoints.push({ x: c, y: receptorOccupancy(c, kd, hill) });
  }
  const chartHtml = renderLineChart([{ name: 'Occupancy', color: 'var(--teal)', points: curvePoints }], {
    title: 'Occupancy vs. concentration', xLabel: 'Concentration', yLabel: '% occupied', markerX: conc, markerLabel: conc + ' (this result)'
  });
  appendChartWithExport(resultsDiv, chartHtml, 'receptor-occupancy');
}

function runPkpd() {
  const route = val('route');
  const config = {
    route, dose: numVal('dose'), ka: numVal('ka'), ke: numVal('ke'), Vd: numVal('Vd'), F: numVal('F'),
    tau: numVal('tau'), numDoses: Math.max(1, Math.round(numVal('numDoses'))), tEnd: numVal('tEnd'), dt: Math.max(0.01, numVal('tEnd') / 500)
  };
  const profile = simulateProfile(config);
  const metrics = computePKMetrics(profile);
  const pdParams = { E0: numVal('E0'), Emax: numVal('Emax'), EC50: numVal('EC50'), hill: numVal('hill') };
  const kd = numVal('kd');
  const roHill = numVal('roHill');
  const hasRO = !isNaN(kd) && kd > 0;

  const resultsDiv = document.getElementById('pkpdResults');

  if (!resultsDiv) return;  // tab changed before this ran — nothing to write into
  resultsDiv.innerHTML = '';
  resultsDiv.appendChild(el('div', { class: 'headline' }, [
    el('span', { class: 'bignum' }, metrics.cMax.toFixed(2) + ' mg/L'),
    el('span', { class: 'sublabel' }, `Cmax at t=${metrics.tMax.toFixed(2)}hr  \u2022  half-life ${halfLife(numVal('ke')).toFixed(2)}hr  \u2022  AUC (window) ${metrics.aucLastWindow.toFixed(1)} mg\u00B7hr/L`
      + (hasRO ? `  \u2022  receptor occupancy at Cmax ${receptorOccupancy(metrics.cMax, kd, roHill).toFixed(1)}%` : ''))
  ]));
  const concChart = renderLineChart([{ name: 'Concentration', color: 'var(--teal)', points: profile.map(p => ({ x: p.t, y: p.c })) }], {
    title: 'Concentration-time profile', xLabel: 'Hours', yLabel: 'mg/L'
  });
  appendChartWithExport(resultsDiv, concChart, 'pkpd-concentration-time');

  if (hasRO) {
    const roChart = renderLineChart([{ name: 'Receptor occupancy', color: 'var(--amber)', points: profile.map(p => ({ x: p.t, y: receptorOccupancy(p.c, kd, roHill) })) }], {
      title: 'Receptor occupancy over time', xLabel: 'Hours', yLabel: '% occupied'
    });
    appendChartWithExport(resultsDiv, roChart, 'pkpd-receptor-occupancy');
  }

  const doses = [];
  const baseDose = numVal('dose');
  for (let m = 0.1; m <= 3; m += 0.1) doses.push(baseDose * m);
  const doseResponse = simulateDoseResponseCurve(doses, config, pdParams, 'cMax');
  const drChart = renderLineChart([{ name: 'Effect', color: 'var(--amber)', points: doseResponse.map(d => ({ x: d.dose, y: d.effect })) }], {
    title: 'Dose-response (effect at simulated Cmax)', xLabel: 'Dose (mg)', yLabel: 'Effect'
  });
  appendChartWithExport(resultsDiv, drChart, 'pkpd-dose-response');
}

// ── Boot ─────────────────────────────────────────────────────────────────
// Renamed from boot() and no longer self-triggering on DOMContentLoaded —
// this view is mounted inside RxNPV as a React-managed island, so
// RxNPV's own code calls bootTrialSim() explicitly the first time the
// Simulation tab is opened, rather than this file booting itself at page
// load (DOMContentLoaded fires once, well before the user ever navigates
// here). Theme is inherited from whatever RxNPV has already set on
// document.documentElement — no separate read/write of its own.

function bootTrialSim() {
  renderApp();
}
