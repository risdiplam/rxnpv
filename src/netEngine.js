// ════════════════════════════════════════════════════════════════════════════
// Network — one fetch every external integration goes through
// ════════════════════════════════════════════════════════════════════════════
// Before this, eight integrations each had their own fetch wrapper, and seven
// of them never retried: a single 500 from openFDA, a 503 from Europe PMC or
// a 500 from EDGAR's search became a failed lookup on screen, although the
// same request a second later succeeded (each of those happened live while
// the Stoke sample was being built). The eighth, EDGAR, retried everything
// once — including a 404, which will never succeed.
//
// The rule here: retry what a second attempt can fix, never what it cannot.
//   · retried: no connection, a timeout, 408/425/429 and 5xx
//   · not retried: every other status — 400, 403, 404 are answers, and each
//     integration decides what they mean (openFDA's 404 is "no matches")
// Up to two retries, waiting ~0.7s then ~1.8s (with jitter), or the server's
// own Retry-After when it sends one (capped at 8s). A timeout is retried once
// only, so a service that is down costs two timeouts, not three.
//
// Returns the Response (or throws with a plain-English reason); status
// handling stays with each caller, which is why every existing error message
// in the app reads exactly as before.
const NET_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

function netBackoffMs(attempt) {
  return Math.round(700 * Math.pow(2.5, attempt) * (0.85 + Math.random() * 0.3));
}

function netRetryAfterMs(res) {
  const h = res && res.headers && typeof res.headers.get === "function" ? res.headers.get("Retry-After") : null;
  if (!h) return null;
  const secs = Number(h);
  if (isFinite(secs)) return Math.min(8000, Math.max(0, secs * 1000));
  const when = Date.parse(h);
  return isFinite(when) ? Math.min(8000, Math.max(0, when - Date.now())) : null;
}

async function resilientFetch(url, opts) {
  opts = opts || {};
  if (typeof fetch === "undefined") throw new Error("No fetch available in this environment");
  const retries = opts.retries != null ? opts.retries : 2;
  const timeoutMs = opts.timeoutMs || 15000;
  const label = opts.label || (() => { try { return new URL(url).hostname; } catch (e) { return "the server"; } })();
  const init = { method: opts.method || "GET" };
  if (opts.headers) init.headers = opts.headers;
  if (opts.body != null) init.body = opts.body;
  let timeouts = 0;
  for (let attempt = 0; ; attempt++) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res = null, err = null;
    try {
      res = await fetch(url, ctl ? Object.assign({}, init, { signal: ctl.signal }) : init);
    } catch (e) {
      err = e;
    }
    if (timer) clearTimeout(timer);
    const isTimeout = !!err && err.name === "AbortError";
    if (isTimeout) timeouts++;
    const retryable = err ? (!isTimeout || timeouts < 2) : NET_RETRY_STATUSES.indexOf(res.status) !== -1;
    if (!retryable || attempt >= retries) {
      if (!err) return res;
      throw new Error(isTimeout
        ? label + " did not respond within " + Math.round(timeoutMs / 1000) + " seconds"
        : "Could not reach " + label + ": " + ((err && err.message) || "network error"));
    }
    const wait = (res && netRetryAfterMs(res)) || netBackoffMs(attempt);
    await new Promise(r => setTimeout(r, wait));
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { resilientFetch, netBackoffMs, netRetryAfterMs, NET_RETRY_STATUSES };
}
