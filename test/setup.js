#!/usr/bin/env node
// Generates test_desktop.html from the built electron/rxnpv.html by
// substituting the CDN-hosted React <script src> tags for the local,
// npm-installed React build — so the test scripts (which run entirely
// through jsdom, with no network access) actually have React available.
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

let out = html.replace(
  /<script[^>]*src="https:\/\/unpkg\.com\/react@18[^"]*"[^>]*><\/script>/,
  () => `<script>${escapeForInlineScript(react)}</script>`
);
out = out.replace(
  /<script[^>]*src="https:\/\/unpkg\.com\/react-dom@18[^"]*"[^>]*><\/script>/,
  () => `<script>${escapeForInlineScript(reactDom)}</script>`
);

fs.writeFileSync(path.join(__dirname, 'test_desktop.html'), out);
console.log(`✅ test_desktop.html generated (React ${variant} build)`);
