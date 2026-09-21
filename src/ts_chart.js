// ════════════════════════════════════════════════════════════════════════════
// TrialSim — CHART.JS
// Minimal, dependency-free SVG chart rendering. Theme-aware via CSS var()
// references so charts adapt to light/dark automatically, same approach
// RxNPV uses (and the same bug class to avoid — never hardcode a hex
// that happens to match one theme's token).
// ════════════════════════════════════════════════════════════════════════════

// "Nice" axis tick values — rounds a raw [min,max] span out to human-readable
// step sizes (1/2/5 x a power of ten) rather than showing whatever arbitrary
// decimals the data happens to produce. Without this, a y-axis reading
// "0, 3333, 6667" is technically correct and practically unreadable.
function niceTicks(min, max, targetCount = 5) {
  if (!isFinite(min) || !isFinite(max) || max <= min) return [min];
  const rawStep = (max - min) / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  // Geometric-midpoint thresholds (the standard "nice numbers" rule), not
  // exact-value thresholds. With `norm <= 2 ? 2 : ... 5`, a raw step of 0.209
  // (norm 2.09) jumped all the way to 0.5, so a 0..1 power axis labelled only
  // 0 / 0.5 / 1 — too coarse to see where the 80% power target actually sits.
  const niceStep = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / niceStep) * niceStep; v <= max + niceStep * 1e-9; v += niceStep) {
    ticks.push(Math.abs(v) < niceStep * 1e-9 ? 0 : v);
  }
  return ticks.length ? ticks : [min, max];
}

// Formats an axis tick to the precision the step size actually warrants —
// formatNumber's flat 2 decimals turns a p-value axis of 0.001/0.01/0.05 into
// "0.00, 0.01, 0.05", silently collapsing two distinct ticks to the same label.
function formatTick(v, step) {
  if (Math.abs(v) >= 1000) return formatNumber(v);
  if (!isFinite(step) || step <= 0) return String(v);
  const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step)) + 1));
  const s = v.toFixed(decimals);
  // Strip trailing zeros ONLY after a decimal point. A naive /\.?0+$/ (the
  // first version of this line) also ate the zero in whole numbers, turning
  // an axis tick of 20 into "2" and 100 into "1" — caught by the tick tests.
  return s.indexOf('.') >= 0 ? (s.replace(/0+$/, '').replace(/\.$/, '') || '0') : s;
}

function renderHistogram(values, opts = {}) {
  const {
    width = 640, height = 280, bins = 30,
    color = 'var(--teal)', markerValue = null, markerLabel = '',
    xLabel = '', title = '', valueFormatter = null
  } = opts;

  if (!values.length) return '<svg></svg>';
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const binWidth = range / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const maxCount = Math.max(...counts, 1);
  const fmt = valueFormatter || formatNumber;

  const marginLeft = 56, marginBottom = 40, marginTop = title ? 34 : 14, marginRight = 14;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;
  const barW = plotW / bins;

  // Y axis is scaled to a "nice" ceiling rather than the raw max count, so
  // the topmost gridline is a round number the reader can actually anchor on.
  const yTicks = niceTicks(0, maxCount, 4);
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : maxCount;
  const yMax = Math.max(maxCount, yTicks[yTicks.length - 1] || maxCount);
  const sy = c => marginTop + plotH - (c / (yMax || 1)) * plotH;

  const gridlines = yTicks.map(t =>
    `<line x1="${marginLeft}" y1="${sy(t).toFixed(1)}" x2="${(marginLeft + plotW).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="var(--rule)" stroke-width="1" opacity="0.5" />`
  ).join('');
  const yTickLabels = yTicks.map(t =>
    `<text x="${marginLeft - 8}" y="${(sy(t) + 3.5).toFixed(1)}" fill="var(--ink-2)" font-size="10" text-anchor="end">${formatTick(t, yStep)}</text>`
  ).join('');

  const total = values.length;
  let bars = '';
  for (let i = 0; i < bins; i++) {
    const barH = (counts[i] / (yMax || 1)) * plotH;
    const x = marginLeft + i * barW;
    const y = marginTop + (plotH - barH);
    const binLo = min + i * binWidth, binHi = binLo + binWidth;
    // Native SVG <title> tooltip: hover a bar to read its exact bin range and
    // count. Zero JS, survives SVG/PNG export, no event wiring to leak.
    const tip = `${fmt(binLo)} to ${fmt(binHi)}: ${counts[i].toLocaleString()} of ${total.toLocaleString()} (${((counts[i] / total) * 100).toFixed(1)}%)`;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 1).toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" opacity="0.85"><title>${escapeXml(tip)}</title></rect>`;
  }

  let marker = '';
  if (markerValue != null && markerValue >= min && markerValue <= max) {
    const mx = marginLeft + ((markerValue - min) / range) * plotW;
    marker = `<line x1="${mx.toFixed(1)}" y1="${marginTop}" x2="${mx.toFixed(1)}" y2="${marginTop + plotH}" stroke="var(--amber)" stroke-width="2" stroke-dasharray="4,3" />` +
             `<text x="${mx.toFixed(1)}" y="${marginTop - 6}" fill="var(--amber)" font-size="11" text-anchor="middle">${escapeXml(markerLabel)}</text>`;
  }

  const axisLine = `<line x1="${marginLeft}" y1="${marginTop + plotH}" x2="${marginLeft + plotW}" y2="${marginTop + plotH}" stroke="var(--ink-2)" stroke-width="1" opacity="0.5" />`;
  // When every value is identical, `range` falls back to 1 purely to keep the
  // binning arithmetic from dividing by zero — but using that fallback for the
  // labels too printed a midpoint half a unit above a max equal to the min
  // ("100, 100.5, 100"), a non-monotonic axis implying a spread that does not
  // exist. Label the single real value instead.
  const xTicks = (max === min
    ? [{ v: min, i: 1 }]
    : [min, min + range / 2, max].map((v, i) => ({ v, i }))
  ).map(({ v, i }) => {
    const x = marginLeft + (i / 2) * plotW;
    return `<text x="${x.toFixed(1)}" y="${marginTop + plotH + 18}" fill="var(--ink-2)" font-size="10" text-anchor="middle">${fmt(v)}</text>`;
  }).join('');

  const titleText = title ? `<text x="${width / 2}" y="18" fill="var(--ink-1)" font-size="13" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>` : '';
  const xLabelText = xLabel ? `<text x="${width / 2}" y="${height - 6}" fill="var(--ink-2)" font-size="11" text-anchor="middle">${escapeXml(xLabel)}</text>` : '';
  const yAxisTitle = `<text x="13" y="${marginTop + plotH / 2}" fill="var(--ink-2)" font-size="11" text-anchor="middle" transform="rotate(-90 13 ${marginTop + plotH / 2})">Count</text>`;

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${titleText}${gridlines}${bars}${axisLine}${yTickLabels}${xTicks}${marker}${xLabelText}${yAxisTitle}</svg>`;
}

function renderLineChart(series, opts = {}) {
  // series: [{ name, color, points: [{x, y}, ...] }, ...]
  const {
    width = 640, height = 280, xLabel = '', yLabel = '', title = '',
    markerX = null, markerLabel = '', xFormatter = null, yFormatter = null
  } = opts;
  const marginLeft = 62, marginBottom = 40, marginTop = title ? 34 : 14, marginRight = 20;
  const plotW = width - marginLeft - marginRight;
  const plotH = height - marginTop - marginBottom;

  const allX = series.flatMap(s => s.points.map(p => p.x));
  const allY = series.flatMap(s => s.points.map(p => p.y));
  if (!allX.length) return '<svg></svg>';
  const xMin = Math.min(...allX), xMax = Math.max(...allX);
  // yMin was hard-coded to 0, so any negative value mapped below the plot area
  // — clipped by the SVG bounds and invisible, with the axis giving no hint it
  // had gone off the bottom. chart.js's revenueChartYScale already handles this
  // by flooring at min(0, ...) rather than assuming non-negative data.
  const yLo = Math.min(0, ...allY), yHi = Math.max(...allY);
  const ySpan = yHi - yLo;
  const yMin = yLo;
  const yMax = yHi + (ySpan > 0 ? ySpan * 0.1 : Math.max(Math.abs(yHi) * 0.1, 1));

  const sx = x => marginLeft + ((x - xMin) / ((xMax - xMin) || 1)) * plotW;
  const sy = y => marginTop + plotH - ((y - yMin) / ((yMax - yMin) || 1)) * plotH;

  const yTicks = niceTicks(yMin, yMax, 5);
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : yMax;
  const xTicks = niceTicks(xMin, xMax, 5);
  const xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : (xMax - xMin);
  const fmtY = yFormatter || (v => formatTick(v, yStep));
  const fmtX = xFormatter || (v => formatTick(v, xStep));

  const gridlines = yTicks.map(t =>
    `<line x1="${marginLeft}" y1="${sy(t).toFixed(1)}" x2="${(marginLeft + plotW).toFixed(1)}" y2="${sy(t).toFixed(1)}" stroke="var(--rule)" stroke-width="1" opacity="0.5" />`
  ).join('') + xTicks.map(t =>
    `<line x1="${sx(t).toFixed(1)}" y1="${marginTop}" x2="${sx(t).toFixed(1)}" y2="${(marginTop + plotH).toFixed(1)}" stroke="var(--rule)" stroke-width="1" opacity="0.3" />`
  ).join('');
  const yTickLabels = yTicks.map(t =>
    `<text x="${marginLeft - 8}" y="${(sy(t) + 3.5).toFixed(1)}" fill="var(--ink-2)" font-size="10" text-anchor="end">${fmtY(t)}</text>`
  ).join('');
  const xTickLabels = xTicks.map(t =>
    `<text x="${sx(t).toFixed(1)}" y="${(marginTop + plotH + 16).toFixed(1)}" fill="var(--ink-2)" font-size="10" text-anchor="middle">${fmtX(t)}</text>`
  ).join('');

  let paths = '';
  for (const s of series) {
    // A one-point series is just "M x y" with nothing to draw to, so the path
    // renders as literally nothing and the series looks like missing data.
    // Draw the point itself instead.
    if (s.points.length === 1) {
      const p = s.points[0];
      paths += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.5" fill="${s.color}" />`;
      continue;
    }
    const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
    paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" />`;
  }

  // Invisible hover targets along each curve — a native <title> tooltip per
  // sampled point, so a reader can pull an exact (x, y) off the curve instead
  // of estimating it against the gridlines. Kept to a capped sample count so a
  // 500-point PK profile doesn't emit 500 DOM nodes per chart.
  let hoverDots = '';
  const MAX_HOVER_POINTS = 60;
  for (const s of series) {
    const stride = Math.max(1, Math.ceil(s.points.length / MAX_HOVER_POINTS));
    for (let i = 0; i < s.points.length; i += stride) {
      const p = s.points[i];
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      const tip = `${s.name}  ${fmtX(p.x)} → ${fmtY(p.y)}`;
      hoverDots += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="5" fill="${s.color}" opacity="0"><title>${escapeXml(tip)}</title></circle>`;
    }
  }

  let marker = '';
  if (markerX != null && markerX >= xMin && markerX <= xMax) {
    const mx = sx(markerX);
    marker = `<line x1="${mx.toFixed(1)}" y1="${marginTop}" x2="${mx.toFixed(1)}" y2="${marginTop + plotH}" stroke="var(--amber)" stroke-width="2" stroke-dasharray="4,3" />` +
      (markerLabel ? `<text x="${mx.toFixed(1)}" y="${marginTop - 6}" fill="var(--amber)" font-size="11" text-anchor="middle">${escapeXml(markerLabel)}</text>` : '');
  }

  const axisX = `<line x1="${marginLeft}" y1="${marginTop + plotH}" x2="${marginLeft + plotW}" y2="${marginTop + plotH}" stroke="var(--ink-2)" stroke-width="1" opacity="0.5" />`;
  const axisY = `<line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${marginTop + plotH}" stroke="var(--ink-2)" stroke-width="1" opacity="0.5" />`;

  const titleText = title ? `<text x="${width / 2}" y="18" fill="var(--ink-1)" font-size="13" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>` : '';
  const xLabelText = xLabel ? `<text x="${width / 2}" y="${height - 6}" fill="var(--ink-2)" font-size="11" text-anchor="middle">${escapeXml(xLabel)}</text>` : '';
  const yLabelText = yLabel ? `<text x="13" y="${marginTop + plotH / 2}" fill="var(--ink-2)" font-size="11" text-anchor="middle" transform="rotate(-90 13 ${marginTop + plotH / 2})">${escapeXml(yLabel)}</text>` : '';

  // Legend is only meaningful with more than one series — a single-series
  // chart already says what it is in its title/axis labels, and the fixed
  // right-edge placement can collide with the curve itself.
  let legend = '';
  if (series.length > 1) {
    series.forEach((s, i) => {
      const ly = marginTop + i * 14;
      legend += `<rect x="${marginLeft + plotW - 100}" y="${ly}" width="10" height="10" fill="${s.color}" />` +
                `<text x="${marginLeft + plotW - 86}" y="${ly + 9}" fill="var(--ink-2)" font-size="10">${escapeXml(s.name)}</text>`;
    });
  }

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${titleText}${gridlines}${axisX}${axisY}${paths}${hoverDots}${marker}${legend}${yTickLabels}${xTickLabels}${xLabelText}${yLabelText}</svg>`;
}

// Tornado chart — horizontal bars from a zero baseline, one per driver,
// ranking each driver's influence on one output (e.g. Peak Sales' per-
// assumption correlation with the final peak-sales distribution). Bar color
// signals direction (teal = pushes the output up, red = pushes it down)
// since sign is exactly the information a tornado chart exists to surface
// at a glance — magnitude alone would lose which drivers you'd actually want
// to tighten vs. which ones you'd want to stress in the other direction.
// rows: [{label, value}], typically pre-sorted by |value| descending by the
// caller (driverSensitivity already does this).
function renderTornadoChart(rows, opts = {}) {
  const {
    width = 640, title = '', xLabel = '', labelWidth = 150,
    positiveColor = 'var(--teal)', negativeColor = 'var(--red)'
  } = opts;

  const rowHeight = 32;
  const marginTop = title ? 34 : 14;
  const marginBottom = xLabel ? 40 : 26;
  const plotH = rows.length * rowHeight;
  const height = marginTop + plotH + marginBottom;
  const plotW = width - labelWidth - 30;
  const plotLeft = labelWidth;

  const maxAbs = Math.max(...rows.map(r => Math.abs(r.value)), 1e-9);
  const domainPad = maxAbs * 0.2;
  const plotLo = -maxAbs - domainPad, plotHi = maxAbs + domainPad;
  const sx = v => plotLeft + ((v - plotLo) / ((plotHi - plotLo) || 1)) * plotW;
  const zeroX = sx(0);

  let rowsSvg = '';
  rows.forEach((r, i) => {
    const cy = marginTop + i * rowHeight + rowHeight / 2;
    const barH = 14;
    const xVal = sx(r.value);
    const x = Math.min(zeroX, xVal), w = Math.abs(xVal - zeroX);
    const color = r.value >= 0 ? positiveColor : negativeColor;
    const label = `<text x="${(labelWidth - 10).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="var(--ink-1)" font-size="11" text-anchor="end">${escapeXml(r.label)}</text>`;
    const tip = `${r.label}: ${r.value.toFixed(3)}${r.value >= 0 ? ' (pushes the outcome up)' : ' (pushes the outcome down)'}`;
    const bar = `<rect x="${x.toFixed(1)}" y="${(cy - barH / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" opacity="0.85"><title>${escapeXml(tip)}</title></rect>`;
    const valLabel = `<text x="${(xVal + (r.value >= 0 ? 6 : -6)).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="var(--ink-2)" font-size="10" text-anchor="${r.value >= 0 ? 'start' : 'end'}">${r.value.toFixed(2)}</text>`;
    rowsSvg += label + bar + valLabel;
  });

  const zeroLine = `<line x1="${zeroX.toFixed(1)}" y1="${marginTop}" x2="${zeroX.toFixed(1)}" y2="${marginTop + plotH}" stroke="var(--ink-2)" stroke-width="1" opacity="0.6" />`;
  const axisY = marginTop + plotH;
  const axisLine = `<line x1="${plotLeft}" y1="${axisY}" x2="${plotLeft + plotW}" y2="${axisY}" stroke="var(--ink-2)" stroke-width="1" opacity="0.5" />`;

  const titleText = title ? `<text x="${(labelWidth + plotW / 2).toFixed(1)}" y="18" fill="var(--ink-1)" font-size="13" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>` : '';
  const xLabelText = xLabel ? `<text x="${(labelWidth + plotW / 2).toFixed(1)}" y="${height - 6}" fill="var(--ink-2)" font-size="11" text-anchor="middle">${escapeXml(xLabel)}</text>` : '';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${titleText}${axisLine}${zeroLine}${rowsSvg}${xLabelText}</svg>`;
}

// Icon array / pictogram — the beginner-facing complement to a plain
// percentage: "X out of 100" is far more intuitive than "X%" to a reader
// without a stats background, especially for NNT ("for every 100 patients
// treated, this many more benefit than would have anyway"). Deliberately
// plain circles, not illustrated figures — same "minimal, dependency-free"
// commitment as the rest of this file, and circles stay crisp at the small
// sizes a 100-icon grid needs, where a detailed figure glyph would blur.
function renderIconArray(fraction, opts = {}) {
  const {
    width = 400, height = 300, cols = 10, rows = 10,
    highlightColor = 'var(--teal)', baseColor = 'var(--rule)',
    title = '', subtitle = ''
  } = opts;
  const total = cols * rows;
  const highlighted = Math.max(0, Math.min(total, Math.round(fraction * total)));

  const marginTop = title ? 30 : 10;
  const marginBottom = subtitle ? 28 : 10;
  const marginSide = 20;
  const plotW = width - marginSide * 2;
  const plotH = height - marginTop - marginBottom;
  const cellW = plotW / cols, cellH = plotH / rows;
  const r = Math.min(cellW, cellH) * 0.36;

  let dots = '';
  for (let i = 0; i < total; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = marginSide + col * cellW + cellW / 2;
    const cy = marginTop + row * cellH + cellH / 2;
    const isHighlighted = i < highlighted;
    dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${isHighlighted ? highlightColor : baseColor}" opacity="${isHighlighted ? '0.95' : '0.4'}" />`;
  }

  const titleText = title ? `<text x="${width / 2}" y="18" fill="var(--ink-1)" font-size="13" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>` : '';
  const subtitleText = subtitle ? `<text x="${width / 2}" y="${height - 8}" fill="var(--ink-2)" font-size="11" text-anchor="middle">${escapeXml(subtitle)}</text>` : '';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${titleText}${dots}${subtitleText}</svg>`;
}

// Forest plot — one flexible primitive covering three uses across the new
// biostats tools: a single CI whisker against a null/reference line (RR/OR/
// RD), a CI whisker against a shaded "unacceptable" margin zone (non-
// inferiority), and multiple stacked study rows plus a pooled diamond
// (meta-analysis). rows: [{label, estimate, lower, upper}]. Optional pooled:
// {label, estimate, lower, upper} rendered as a diamond below the study rows
// — width spans its own CI, height is fixed, the standard forest-plot
// convention for a pooled estimate. scale 'log' is used for ratio measures
// (RR/OR) since their CIs are symmetric on the log scale, not the linear one
// — plotting a ratio's CI on a linear axis visually distorts which side of 1
// carries more uncertainty.
function renderForestPlot(rows, opts = {}) {
  const {
    width = 640, pooled = null, scale = 'linear', referenceLine = null,
    marginZone = null, title = '', xLabel = '', labelWidth = 150
  } = opts;

  // With no rows and no reference line or margin zone to anchor a domain,
  // Math.min/max of an empty list give Infinity/-Infinity, the pad computes to
  // -Infinity (which is truthy, so the `|| 0.1` fallback never fires), and
  // every axis tick ends up with x="NaN" — invalid SVG the browser silently
  // drops, plus literal "NaN"/"Infinity" label text. Not reachable from any
  // current caller, but this is an exported shared primitive.
  const hasAnchor = (rows && rows.length) || pooled || referenceLine != null || marginZone;
  if (!hasAnchor) return '<svg></svg>';

  const allRows = pooled ? (rows || []).concat([{ ...pooled, isPooled: true }]) : (rows || []);
  const rowHeight = 34;
  const marginTop = title ? 34 : 14;
  const marginBottom = xLabel ? 40 : 26;
  const plotH = allRows.length * rowHeight;
  const height = marginTop + plotH + marginBottom;
  const plotW = width - labelWidth - 30;
  const plotLeft = labelWidth;

  const toPlotX = scale === 'log' ? (v => Math.log(Math.max(v, 1e-9))) : (v => v);
  const allVals = allRows.flatMap(r => [r.lower, r.upper])
    .concat(referenceLine != null ? [referenceLine] : [])
    .concat(marginZone ? [marginZone.from, marginZone.to] : []);
  let domainLo = Math.min(...allVals), domainHi = Math.max(...allVals);
  const domainPad = (toPlotX(domainHi) - toPlotX(domainLo)) * 0.1 || 0.1;
  const plotLo = toPlotX(domainLo) - domainPad, plotHi = toPlotX(domainHi) + domainPad;
  const sx = v => plotLeft + ((toPlotX(v) - plotLo) / ((plotHi - plotLo) || 1)) * plotW;

  let marginZoneRect = '';
  if (marginZone) {
    const zFrom = sx(marginZone.from), zTo = sx(marginZone.to);
    marginZoneRect = `<rect x="${Math.min(zFrom, zTo).toFixed(1)}" y="${marginTop}" width="${Math.abs(zTo - zFrom).toFixed(1)}" height="${plotH}" fill="var(--red)" opacity="0.08" />`;
  }

  let refLine = '';
  if (referenceLine != null) {
    const rx = sx(referenceLine);
    refLine = `<line x1="${rx.toFixed(1)}" y1="${marginTop}" x2="${rx.toFixed(1)}" y2="${marginTop + plotH}" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6" />`;
  }

  const tickVals = [domainLo, (domainLo + domainHi) / 2, domainHi];
  const tickStep = Math.abs(tickVals[1] - tickVals[0]) || Math.abs(domainHi) || 1;
  const fmtVal = v => formatTick(v, tickStep);

  let rowsSvg = '';
  allRows.forEach((r, i) => {
    const cy = marginTop + i * rowHeight + rowHeight / 2;
    // A malformed row with lower > upper is harmless for a plain whisker (an
    // SVG line doesn't care which end is which) but turns the pooled diamond
    // into a self-intersecting bowtie, since the polygon assumes x1 is left of
    // x2. Order the endpoints so the glyph stays a diamond either way.
    const xa = sx(r.lower), xb = sx(r.upper);
    const x1 = Math.min(xa, xb), x2 = Math.max(xa, xb), xEst = sx(r.estimate);
    const label = `<text x="${(labelWidth - 10).toFixed(1)}" y="${(cy + 4).toFixed(1)}" fill="var(--ink-1)" font-size="11" text-anchor="end">${escapeXml(r.label)}</text>`;
    // Zero-width rows (a bare point estimate with no interval, e.g. the
    // Phase 2->3 before/after comparison) shouldn't claim a confidence
    // interval they don't have.
    const hasInterval = r.upper !== r.lower;
    const tip = hasInterval
      ? `${r.label}: ${fmtVal(r.estimate)} (${fmtVal(r.lower)} to ${fmtVal(r.upper)})`
      : `${r.label}: ${fmtVal(r.estimate)}`;
    const titleEl = `<title>${escapeXml(tip)}</title>`;
    if (r.isPooled) {
      // Diamond: width spans the pooled CI, fixed half-height — the
      // standard forest-plot glyph for a pooled/summary estimate, visually
      // distinct from the box-and-whisker rows above it.
      const halfH = 7;
      const diamond = `<polygon points="${x1.toFixed(1)},${cy.toFixed(1)} ${xEst.toFixed(1)},${(cy - halfH).toFixed(1)} ${x2.toFixed(1)},${cy.toFixed(1)} ${xEst.toFixed(1)},${(cy + halfH).toFixed(1)}" fill="var(--amber)" opacity="0.9">${titleEl}</polygon>`;
      rowsSvg += label + diamond;
    } else {
      const whisker = `<line x1="${x1.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="var(--ink-2)" stroke-width="1.5" />`;
      const box = `<rect x="${(xEst - 4).toFixed(1)}" y="${(cy - 4).toFixed(1)}" width="8" height="8" fill="${r.color || 'var(--teal)'}" />`;
      // Full-row invisible hover strip, so the tooltip is reachable anywhere
      // along the row rather than only on the 8px estimate box.
      const hoverStrip = `<rect x="${plotLeft}" y="${(cy - rowHeight / 2).toFixed(1)}" width="${plotW.toFixed(1)}" height="${rowHeight}" fill="transparent">${titleEl}</rect>`;
      rowsSvg += label + whisker + box + hoverStrip;
    }
  });

  const axisY = marginTop + plotH;
  const axisLine = `<line x1="${plotLeft}" y1="${axisY}" x2="${plotLeft + plotW}" y2="${axisY}" stroke="var(--ink-2)" stroke-width="1" opacity="0.5" />`;
  const ticks = tickVals.map(v => {
    const x = sx(v);
    return `<text x="${x.toFixed(1)}" y="${(axisY + 16).toFixed(1)}" fill="var(--ink-2)" font-size="10" text-anchor="middle">${fmtVal(v)}</text>`;
  }).join('');

  const titleText = title ? `<text x="${(labelWidth + plotW / 2).toFixed(1)}" y="18" fill="var(--ink-1)" font-size="13" text-anchor="middle" font-weight="600">${escapeXml(title)}</text>` : '';
  const xLabelText = xLabel ? `<text x="${(labelWidth + plotW / 2).toFixed(1)}" y="${height - 6}" fill="var(--ink-2)" font-size="11" text-anchor="middle">${escapeXml(xLabel)}</text>` : '';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${titleText}${marginZoneRect}${axisLine}${refLine}${rowsSvg}${ticks}${xLabelText}</svg>`;
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function formatNumber(n) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderHistogram, renderLineChart, renderIconArray, renderForestPlot, renderTornadoChart, niceTicks, formatTick, escapeXml, formatNumber };
}
