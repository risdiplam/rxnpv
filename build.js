#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// RxNPV build script
//
// This app is NOT built with a real bundler (webpack/esbuild/vite). It's
// built by concatenating 34 plain <script>-style JS files, in a specific
// order, into one giant inline <script> block inside shell.html. There are
// no import/export statements anywhere — every file relies on the global
// scope and on files earlier in MODULE_ORDER having already defined
// whatever it references. Function declarations hoist within the combined
// script, so a later-concatenated file CAN call a function defined in an
// even-later file — but const/let/class declarations do NOT hoist, so
// anything a file reads at module-eval time (not inside a function body)
// must come from something earlier in the list.
//
// This was a pragmatic choice made during the app's original development
// inside a constrained sandbox with no real bundler tooling available. It
// works, it's fully tested, and changing it is a real architecture
// decision — not something to "fix" in passing. A real bundler would be a
// legitimate future improvement, but should be a deliberate, isolated
// change with its own full verification pass, not bundled in with a
// feature change.
//
// MODULE_ORDER matters and is NOT alphabetical. Do not reorder without
// re-running the full test suite (see test/README.md).
// ════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// Explicitly node:crypto — on Node 18+ a global `crypto` exists (WebCrypto),
// and it has no createHash, so relying on the global fails at build time.
const crypto = require('node:crypto');

const MODULE_ORDER = [
  // Core valuation engine — order matters (see header comment)
  'data.js', 'engine.js', 'costEngine.js', 'rdEngine.js', 'posEngine.js',
  'dcfEngine.js', 'capitalEngine.js', 'scenarioEngine.js',
  // External data integrations (EDGAR, ClinicalTrials.gov, openFDA)
  'edgarEngine.js', 'ctgovEngine.js', 'trialDecoder.js', 'trialResults.js', 'fdaEngine.js', 'openTargetsEngine.js',
  // Export utilities — must precede the UI files that attach export controls
  'exportEngine.js',
  // Shared UI building blocks
  'chart.js', 'helpers.js',
  // Workspace view components
  'valuationPanel.js', 'programEditor.js', 'caseShell.js',
  // Other top-level views
  'referenceSheet.js', 'reportView.js', 'toolsView.js',
  // TrialSim — the Simulation section's own engine modules (originally a
  // separate app, merged in; keeps its own ts_ prefix for exactly this
  // reason, so it's traceable which functions came from where)
  'ts_statsEngine.js', 'ts_simulationEngine.js', 'ts_pkpdEngine.js', 'ts_peakSalesEngine.js',
  'ts_chart.js', 'ts_ctgovEngine.js', 'ts_fdaEngine.js', 'ts_app.js',
  // React wrapper views for Simulation and Portfolio
  'simulationView.js', 'portfolioView.js',
  // App shell — must be last; references everything above
  'app.js'
];

const ROOT = __dirname;
const SRC_DIR = path.join(ROOT, 'src');
const SHELL_PATH = path.join(ROOT, 'shell.html');
const OUTPUT_PATH = path.join(ROOT, 'electron', 'rxnpv.html');

function reassemble() {
  // Syntax-check every module individually first — a broken file gives a
  // far clearer error here than after concatenation into a 9,000-line blob.
  let anyFailed = false;
  for (const file of MODULE_ORDER) {
    const filePath = path.join(SRC_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Missing source file: ${file}`);
      anyFailed = true;
      continue;
    }
    try {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    } catch (e) {
      console.error(`❌ Syntax error in ${file}:\n${e.stderr}`);
      anyFailed = true;
    }
  }
  if (anyFailed) {
    console.error('\nAborting — fix the above before reassembling.');
    process.exit(1);
  }

  const shell = fs.readFileSync(SHELL_PATH, 'utf8');
  if (!shell.includes('__SCRIPT__')) {
    console.error('❌ shell.html has no __SCRIPT__ placeholder — did it get modified?');
    process.exit(1);
  }
  const combined = MODULE_ORDER.map(f => fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n\n');
  // Using a replacer FUNCTION here, not a plain string, is deliberate and
  // load-bearing: String.prototype.replace() treats $-prefixed sequences
  // in a string replacement argument as special pattern tokens ($&, $`,
  // $', $$) — even when the search pattern itself is a plain string, not a
  // regex. `combined` is hundreds of KB of real application code, and it's
  // near-certain to contain a literal $' or similar somewhere (currency
  // formatting, template literals, regex patterns) that would otherwise
  // get silently reinterpreted, splicing unrelated file content into the
  // middle of a source file. A replacer function's return value is always
  // inserted verbatim, with no such reinterpretation. Caught this exact
  // corruption during testing before it ever reached a delivered build.
  let final = shell.replace('__SCRIPT__', () => combined);

  // The app's entire bundle is ONE inline <script>, and a Content-Security-
  // Policy blocks inline script unless it is explicitly allowed. Allowing it
  // wholesale with 'unsafe-inline' would defeat most of the point of having a
  // script-src at all, so the policy instead carries the sha256 of exactly
  // this build's script content — nothing else can execute, not even another
  // inline block. The hash must be of the script's exact bytes, so it is
  // computed here, after substitution, and injected last.
  if (final.includes('__SCRIPT_HASH__')) {
    // Hash the script element's EXACT text content, extracted from the output
    // rather than reconstructed. A browser hashes every byte between the tags,
    // including the newline after `<script>` — hashing `combined` alone is off
    // by that one character, which silently blocks the bundle and yields a
    // blank window. Tests can't catch this (jsdom does not enforce CSP), so
    // the hash is taken from the real artifact to remove the guesswork.
    const open = final.indexOf('<script>\n' + combined.slice(0, 40));
    const scriptOpen = final.indexOf('>', open) + 1;
    const scriptClose = final.indexOf('</script>', scriptOpen);
    if (open === -1 || scriptClose === -1) {
      console.error('❌ Could not locate the inline bundle to hash for the CSP. Refusing to write a build that would be blocked.');
      process.exit(1);
    }
    const scriptText = final.slice(scriptOpen, scriptClose);
    const hash = crypto.createHash('sha256').update(scriptText, 'utf8').digest('base64');
    final = final.replace('__SCRIPT_HASH__', () => "'sha256-" + hash + "'");
  } else {
    console.error("❌ shell.html has no __SCRIPT_HASH__ placeholder — the CSP would block the app's own bundle. Refusing to write a build that won't start.");
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_PATH, final);
  console.log(`✅ Reassembled ${MODULE_ORDER.length} modules → electron/rxnpv.html (${(final.length / 1024).toFixed(0)} KB)`);
}

reassemble();

if (process.argv.includes('--package') || process.argv.includes('--install')) {
  console.log('\nPackaging macOS app (arm64)...');
  execSync('npx electron-builder --mac --arm64', { cwd: path.join(ROOT, 'electron'), stdio: 'inherit' });
  console.log('\n✅ Build complete — see electron/dist/mac-arm64/RxNPV.app');
}

// --install copies the freshly packaged app into /Applications so it shows up
// in Launchpad/Spotlight like any other Mac app. Worth having as a flag rather
// than a manual step: electron-builder writes into electron/dist, which is a
// build artifact that gets wiped on a clean rebuild — so the copy in
// /Applications is the stable thing to actually launch day to day.
//
// No code signing is involved (see CLAUDE.md). A locally built app carries no
// com.apple.quarantine attribute — that's applied to downloads — so this opens
// on a normal double-click. An app moved between machines WOULD be quarantined
// and would need the right-click -> Open route once.
if (process.argv.includes('--install')) {
  const src = path.join(ROOT, 'electron', 'dist', 'mac-arm64', 'RxNPV.app');
  const dest = '/Applications/RxNPV.app';
  if (!fs.existsSync(src)) {
    console.error('❌ Nothing to install — packaged app not found at ' + src);
    process.exit(1);
  }
  console.log('\nInstalling to ' + dest + '…');
  try {
    execSync(`rm -rf "${dest}" && cp -R "${src}" "${dest}"`, { stdio: 'inherit' });
    console.log('✅ Installed. Launch it from Applications, Launchpad, or Spotlight ("RxNPV").');
  } catch (e) {
    console.error('❌ Install failed: ' + e.message);
    console.error('   /Applications may not be writable — copy it across manually, or install to ~/Applications instead.');
    process.exit(1);
  }
}
