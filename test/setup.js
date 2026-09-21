#!/usr/bin/env node
// Generates test_desktop.html from the built electron/rxnpv.html by inlining
// the npm-installed React build in place of the app's own <script src> tags —
// so the test scripts (which run entirely through jsdom, with no network
// access and no path resolution relative to electron/) actually have React
// available. The app itself vendors React locally under electron/vendor/.
//
// Run `node build.js` from the project root FIRST — this script reads
// electron/rxnpv.html, which build.js produces.
//
// Usage: node test/setup.js [--dev]
//   --dev uses React's development build (verbose warnings, slower) instead
//   of the production build the app actually ships with. Default is
//   production, since that's what real users run.

const fs = require('fs');
const path = require('path');

const useDev = process.argv.includes('--dev');
const variant = useDev ? 'development' : 'production.min';

const htmlPath = path.join(__dirname, '..', 'electron', 'rxnpv.html');
if (!fs.existsSync(htmlPath)) {
  console.error('❌ electron/rxnpv.html not found — run `node build.js` from the project root first.');
  process.exit(1);
}

const reactPath = path.join(__dirname, 'node_modules', 'react', 'umd', `react.${variant}.js`);
const reactDomPath = path.join(__dirname, 'node_modules', 'react-dom', 'umd', `react-dom.${variant}.js`);
if (!fs.existsSync(reactPath) || !fs.existsSync(reactDomPath)) {
  console.error('❌ React not found in test/node_modules — run `npm install` inside test/ first.');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const react = fs.readFileSync(reactPath, 'utf8');
const reactDom = fs.readFileSync(reactDomPath, 'utf8');

// React's own minified source contains a literal example HTML snippet
// (part of its hydration-mismatch error message) that includes the text
// "</script>". Inlining that source as-is inside an HTML <script> block
// hits a classic gotcha: <script> content is parsed in a special raw-text
// mode that looks for the literal byte sequence "</script" to end the
// element, with no concept of JavaScript string syntax — so it terminates
// right there, corrupting everything after it. Escaping the slash keeps
// the string identical from JavaScript's point of view while breaking the
// exact byte sequence the HTML parser scans for.
//
// Using replacer FUNCTIONS below (not string replacements) for a second,
// separate reason: the replacement content here is arbitrary, huge minified
// library source, and a string replacement argument undergoes its own
// special $-pattern reinterpretation ($&, $`, $', $$) — a real bug caught
// during this handoff's own testing (see build.js's own comment on the
// same issue for the full story).
const escapeForInlineScript = (code) => code.replace(/<\/script/gi, '<\\/script');

// These used to match the app's CDN <script src> tags. React is now vendored
// locally (electron/vendor/), so the tags are relative paths instead — but the
// substitution is still needed, because jsdom loads test_desktop.html from
// test/, where "vendor/..." would not resolve. Inlining the npm-installed copy
// keeps the tests hermetic either way, and also lets --dev swap in React's
// development build, which the shipped app never uses.
let out = html.replace(
  /<script[^>]*src="(?:[^"]*\/)?vendor\/react\.production\.min\.js"[^>]*><\/script>/,
  () => `<script>${escapeForInlineScript(react)}</script>`
);
out = out.replace(
  /<script[^>]*src="(?:[^"]*\/)?vendor\/react-dom\.production\.min\.js"[^>]*><\/script>/,
  () => `<script>${escapeForInlineScript(reactDom)}</script>`
);

// A silent no-match here would produce a test_desktop.html with no React at
// all, and every test would fail in a confusing way far from the cause.
if (out.indexOf('ReactDOM') === -1 || /src="[^"]*vendor\/react/.test(out)) {
  console.error('❌ React <script> substitution did not match — shell.html\'s script tags may have changed shape. Fix the regexes above before trusting any test run.');
  process.exit(1);
}

fs.writeFileSync(path.join(__dirname, 'test_desktop.html'), out);
console.log(`✅ test_desktop.html generated (React ${variant} build)`);
