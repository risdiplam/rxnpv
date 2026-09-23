#!/usr/bin/env node
// Runs the whole suite and exits non-zero if anything fails.
//
//   node build.js            (from the project root, first)
//   cd test && npm install   (once)
//   npm test                 (or: node run_all.js [--dev])
//
// Regenerates test_desktop.html before running, every time. Running the suite
// against a stale harness is an easy mistake: setup.js does not notice when
// build.js has produced a newer app, and a full green run against the
// previous build has already happened once in this project.
//
// --dev uses React's development build, which prints warnings (missing list
// keys and the like) that the production build hides. Any warning counts as a
// failure in the files that watch console output, so --dev is the stricter run.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const here = __dirname;
const built = path.join(here, "..", "electron", "rxnpv.html");
if (!fs.existsSync(built)) {
  console.error("electron/rxnpv.html not found — run `node build.js` from the project root first.");
  process.exit(1);
}

const SUITES = [
  ["math_verification.js", "engine math against hand-derived values"],
  ["export_test.js", "section export serialiser and sanitiser"],
  ["export_coverage_test.js", "every section has an export bar; + Report and the report builder"],
  ["final_regression_pass.js", "core valuation paths and every top-level view"],
  ["final_sweep.js", "every Tools workbench and tool, Simulation tab, Reference Sheet tab"],
  ["new_features_test.js", "statistics tools against hand calculations"],
  ["full_recovery_verify.js", "end-to-end smoke test"],
  ["recovery_errorboundary_test.js", "a crashing case is contained by the error boundary"],
  ["storage_warning_test.js", "a failed save (simulated full storage) warns the user"],
  ["storage_warning_test2.js", "the same, via a failed save function"],
  ["storage_warning_ma_test.js", "failed M&A comp save: warned, and not shown as saved elsewhere"],
  ["storage_warning_ma_test2.js", "failed M&A comp save: entry kept in its own tab"]
];

const setupArgs = process.argv.includes("--dev") ? ["setup.js", "--dev"] : ["setup.js"];
const setup = spawnSync(process.execPath, setupArgs, { cwd: here, encoding: "utf8" });
process.stdout.write(setup.stdout || "");
if (setup.status !== 0) { process.stderr.write(setup.stderr || ""); console.error("setup.js failed"); process.exit(1); }

const results = [];
for (const [file, what] of SUITES) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [file], { cwd: here, encoding: "utf8", timeout: 10 * 60 * 1000 });
  const ok = r.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  results.push({ file, ok });
  console.log((ok ? "PASS " : "FAIL ") + file.padEnd(32) + secs.padStart(6) + "s  " + what);
  if (!ok) {
    const out = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-25).join("\n");
    console.log(out.replace(/^/gm, "     | "));
  }
}
const failed = results.filter(r => !r.ok);
console.log("\n" + (failed.length ? failed.length + " of " + results.length + " suites FAILED" : "All " + results.length + " suites passed"));
process.exit(failed.length ? 1 : 0);
