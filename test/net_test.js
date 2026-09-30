// resilientFetch (src/netEngine.js): the retry rules every integration relies
// on, checked against a scripted fetch — no network. Each case replays a
// sequence of responses and counts the attempts the function made.
const fs = require("fs"), path = require("path");
let failed = 0;
const ok = (cond, label) => { if (!cond) failed++; console.log((cond ? "ok   " : "FAIL: ") + label); };
const code = fs.readFileSync(path.join(__dirname, "..", "src", "netEngine.js"), "utf8");
const load = () => new Function("module", code + "\nreturn { resilientFetch, netRetryAfterMs, netBackoffMs };")({ exports: null });

// A scripted fetch: each step is a status number, "net" (connection error) or
// "hang" (never answers until aborted). Records how many calls were made.
function script(steps, headers) {
  let calls = 0;
  global.fetch = (url, init) => {
    const step = steps[Math.min(calls, steps.length - 1)]; calls++;
    if (step === "net") return Promise.reject(new TypeError("fetch failed"));
    if (step === "hang") return new Promise((_, rej) => init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); }));
    return Promise.resolve({ ok: step >= 200 && step < 300, status: step, headers: { get: k => (headers && headers[k]) || null }, json: async () => ({ step }) });
  };
  return () => calls;
}
// Real waits (the backoff is ~0.7s and ~1.75s), so the suite takes ~10s.
(async () => {
  const net = load();
  let calls = script([503, 200]);
  let r = await net.resilientFetch("https://x.test/a", { label: "X" });
  ok(r.status === 200 && calls() === 2, "a 503 then 200: retried once, returns the 200");

  calls = script([500, 502, 504]);
  r = await net.resilientFetch("https://x.test/b", { label: "X" });
  ok(r.status === 504 && calls() === 3, "three server errors: 1 try + 2 retries, then the last response is returned for the caller to handle");

  calls = script([404, 200]);
  r = await net.resilientFetch("https://x.test/c", { label: "X" });
  ok(r.status === 404 && calls() === 1, "a 404 is an answer: not retried");

  calls = script([400]);
  r = await net.resilientFetch("https://x.test/d", { label: "X" });
  ok(r.status === 400 && calls() === 1, "a 400 is not retried");

  calls = script(["net", 200]);
  r = await net.resilientFetch("https://x.test/e", { label: "X" });
  ok(r.status === 200 && calls() === 2, "a dropped connection is retried");

  calls = script(["net", "net", "net"]);
  let msg = null;
  try { await net.resilientFetch("https://x.test/f", { label: "Europe PMC" }); } catch (e) { msg = e.message; }
  ok(calls() === 3 && /^Could not reach Europe PMC: /.test(msg || ""), "no connection after retries: a plain-English error naming the service (" + msg + ")");

  calls = script(["hang", "hang", 200]);
  msg = null;
  try { await net.resilientFetch("https://x.test/g", { label: "openFDA", timeoutMs: 150 }); } catch (e) { msg = e.message; }
  ok(calls() === 2 && msg === "openFDA did not respond within 0 seconds", "a timeout is retried once only — a down service costs two timeouts, not three (" + calls() + " calls)");

  calls = script([429, 200], { "Retry-After": "1" });
  const t0 = Date.now();
  r = await net.resilientFetch("https://x.test/h", { label: "X" });
  ok(r.status === 200 && calls() === 2 && Date.now() - t0 >= 950, "429 with Retry-After: 1 waits about a second, then retries");

  calls = script([503, 200]);
  r = await net.resilientFetch("https://x.test/i", { label: "X", retries: 0 });
  ok(r.status === 503 && calls() === 1, "retries: 0 turns retrying off");

  ok(net.netRetryAfterMs({ headers: { get: () => "120" } }) === 8000, "Retry-After is capped at 8 seconds");
  ok(net.netRetryAfterMs({ headers: { get: () => null } }) === null, "no Retry-After header → the app's own backoff");
  const b0 = net.netBackoffMs(0), b1 = net.netBackoffMs(1);
  ok(b0 >= 595 && b0 <= 805 && b1 >= 1487 && b1 <= 2013, "backoff ≈0.7s then ≈1.75s with ±15% jitter (" + b0 + ", " + b1 + ")");

  // POST bodies and headers reach fetch unchanged (Open Targets' GraphQL).
  let seen = null;
  global.fetch = (url, init) => { seen = init; return Promise.resolve({ ok: true, status: 200, headers: { get: () => null } }); };
  await net.resilientFetch("https://x.test/j", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"q\":1}" });
  ok(seen && seen.method === "POST" && seen.body === "{\"q\":1}" && seen.headers["Content-Type"] === "application/json" && seen.signal, "method, headers and body are passed through, with a timeout signal");

  if (failed) console.log("\n" + failed + " CHECK(S) FAILED");
  process.exit(failed ? 1 : 0);
})();
