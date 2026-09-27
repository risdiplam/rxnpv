// Static checks over the app's source, the way the app actually runs it:
// every src/ file concatenated in MODULE_ORDER into one script (see build.js),
// so a function defined in one file and called in another is not flagged, and
// a name no file defines is. Reports each finding at its own file and line.
//
// Run: npm run lint   (from test/)
//
// What it catches: a reference to something no file defines (the class of bug
// that white-screens a view at runtime and that jsdom only finds if a test
// happens to render that path), variables and functions nothing uses,
// unreachable code, duplicate object keys and switch cases, and NaN compares.
const fs = require("fs"), path = require("path");
const { ESLint } = require("eslint");
const globals = require("globals");

const root = path.join(__dirname, "..");
const buildSrc = fs.readFileSync(path.join(root, "build.js"), "utf8");
const listText = buildSrc.slice(buildSrc.indexOf("const MODULE_ORDER = ["));
const order = (listText.slice(0, listText.indexOf("];")).match(/'[^']+\.js'/g) || []).map(s => s.slice(1, -1));

let combined = "", line = 1;
const starts = [];
for (const f of order) {
  const text = fs.readFileSync(path.join(root, "src", f), "utf8") + "\n";
  starts.push([line, f]); combined += text; line += text.split("\n").length - 1;
}
const where = (l) => { let s = starts[0]; for (const st of starts) if (st[0] <= l) s = st; return "src/" + s[1] + ":" + (l - s[0] + 1); };

(async () => {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [{
    languageOptions: { ecmaVersion: 2023, sourceType: "script",
      globals: { ...globals.browser, React: "readonly", ReactDOM: "readonly", module: "readonly", require: "readonly" } },
    rules: {
      // vars: "all" — a top-level function nothing calls is dead code too.
      "no-unused-vars": ["error", { vars: "all", args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-undef": "error", "no-unreachable": "error", "no-dupe-keys": "error", "no-redeclare": "error",
      "no-self-assign": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error",
      "no-constant-binary-expression": "error", "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "no-shadow-restricted-names": "error", "no-loss-of-precision": "error", "use-isnan": "error", "valid-typeof": "error"
    }
  }] });
  const [res] = await eslint.lintText(combined, { filePath: "rxnpv-combined.js" });
  const msgs = res.messages;
  msgs.forEach(m => console.log(where(m.line) + "  " + m.message + "  (" + (m.ruleId || "parse") + ")"));
  console.log(msgs.length ? "\n" + msgs.length + " finding(s) across " + order.length + " files" : "Lint clean — " + order.length + " files, " + (line - 1) + " lines");
  process.exit(msgs.length ? 1 : 0);
})();
