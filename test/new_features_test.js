// Coverage for the features added on top of the existing engine across the
// last two sessions: the "Price vs. model" summary card, and five standalone
// Simulation tabs — Trial Outcome/PoS, Fragility Index, Sample Size/Power,
// P-value <-> CI, and Single-Arm CI (originally Fragility Index and Sample
// Size/Power were bolted onto Trial Outcome/PoS as extra sections; split
// into their own tabs alongside the two brand-new ones for consistency).
// Same jsdom harness and conventions as the rest of this suite (see
// test/README.md) — not a re-test of the core valuation math, which the
// other files already cover.
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html","utf8");
const errors=[];
// Checks print as "label: true|false". Any false, or any caught app error,
// fails the run with a non-zero exit code — this file used to always exit 0,
// so an automated runner read it as passing whatever it printed.
let failedChecks = 0;
const printCheck = console.log;
console.log = (...a) => { if (a.length > 1 && a[a.length - 1] === false) failedChecks++; printCheck(...a); };
const dom = new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://localhost/",
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.console.warn=(...a)=>{const s=a.join(" ");if(!s.includes("EDGAR")&&!s.includes("RDKit"))errors.push("WARN: "+s.slice(0,200));};
  w.console.error=(...a)=>errors.push("ERROR: "+a.join(" ").slice(0,250));
  w.addEventListener("error",e=>errors.push("UNCAUGHT: "+(e.error&&e.error.stack||e.message).slice(0,350)));
  w.fetch=async()=>({ok:false,status:404});
  }});
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function findByLabel(d,t){return [...d.querySelectorAll("input")].find(i=>{const o=i.parentElement&&i.parentElement.parentElement;return o&&o.children[0]&&o.children[0].textContent.includes(t);});}
// Current price is a header field (span+span+input siblings in one wrapper,
// not the field()-component shape findByLabel expects) — its own finder.
function findCurrentPriceInput(d){return [...d.querySelectorAll("input[type=number]")].find(i=>{const p=i.parentElement;return p && [...p.children].some(c=>c.tagName==="SPAN"&&c.textContent.trim()==="Current price");});}
(async()=>{
  const w=dom.window,d=w.document;await wait(1500);
  const root=d.getElementById("root");
  const click=(el)=>el&&el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const btn=(t)=>[...d.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  const clickBtn=(t)=>click(btn(t));
  const setVal=(el,v)=>{const proto=el.tagName==="SELECT"?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype;const s=Object.getOwnPropertyDescriptor(proto,"value").set;s.call(el,v);el.dispatchEvent(new w.Event("input",{bubbles:true}));el.dispatchEvent(new w.Event("change",{bubbles:true}));};
  const setById=(id,v)=>setVal(d.getElementById(id),v);
  const tabContent=()=>d.getElementById("tabContent").textContent;

  console.log("=== Price vs. model card ===");
  click(btn("+ New case")); await wait(400);
  setVal(findCurrentPriceInput(d),"10"); await wait(150);
  setVal(findByLabel(d,"Peak worldwide revenue"),"1000"); await wait(150);
  setVal(findByLabel(d,"Fully diluted shares"),"100000000"); await wait(150);
  setVal(findByLabel(d,"Cash & equivalents"),"200"); await wait(200);

  let t = root.textContent;
  console.log("Card present:", t.includes("Price vs. model"));
  console.log("Shows current price $10.00:", t.includes("$10.00"));
  console.log("Shows all three scenario fair values:", t.includes("Bear fair value") && t.includes("Base fair value") && t.includes("Bull fair value"));
  console.log("Shows upside/downside:", t.includes("Base upside/downside"));

  clickBtn("Simulation"); await wait(500);

  console.log("\n=== Trial Outcome / PoS: assurance simulator (own standalone tab now) ===");
  clickBtn("Trial Outcome / PoS"); await wait(400);
  clickBtn("Run simulation"); await wait(500);
  t = tabContent();
  console.log("Assurance result present:", /assurance \(PoS\)/.test(t));
  console.log("Fragility Index / Sample size fields NOT on this tab:", !d.getElementById("fiEventsA") && !d.getElementById("ssPower"));

  clickBtn("Trial Statistics"); await wait(400);

  console.log("\n=== Fragility Index tab (hand-verified case: 5/50 vs 20/50, alpha=0.05 -> FI=6) ===");
  clickBtn("Fragility Index"); await wait(400);
  setById("fiEventsA","5"); setById("fiNA","50");
  setById("fiEventsB","20"); setById("fiNB","50");
  setById("fiAlpha","0.05");
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("Fragility Index = 6 found:", t.includes("6patients in Treatment would need to flip"));
  console.log("Observed p correct (~0.0010):", t.includes("p = 0.0010"));

  console.log("\n=== Sample Size / Power tab (defaults: 30% vs 45%, 80% power -> n1=n2=163) ===");
  clickBtn("Sample Size / Power"); await wait(400);
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("Sample size 163 per arm found:", t.includes("163"));

  console.log("\n=== P-value <-> CI tab (hand-verified: delta=5, P=0.03 -> CI [0.477, 9.523]) ===");
  clickBtn("P-value ↔ CI"); await wait(400);
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("Default P->CI matches hand calc:", t.includes("0.477 to 9.523"));
  setVal(d.getElementById("pciDirection"), "ciToP"); await wait(200);
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("CI->P round trip produces a P value:", /implied two-sided P/.test(t));
  setVal(d.getElementById("pciDirection"), "pToCI"); await wait(200);
  setVal(d.getElementById("pciScale"), "ratio"); await wait(200);
  setById("pciPoint","0.65"); setById("pciP","0.02");
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("Ratio scale (HR=0.65, P=0.02) matches hand calc [0.452, 0.935]:", t.includes("0.452 to 0.935"));

  console.log("\n=== Single-Arm CI tab (hand-verified: 9/20 -> [25.8%, 65.8%]; 0/20 edge -> [0.0%, 16.1%]) ===");
  clickBtn("Single-Arm CI"); await wait(400);
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("Default 9/20 matches hand calc:", t.includes("25.8% to 65.8%"));
  setById("saEvents","0"); setById("saN","20");
  clickBtn("Calculate"); await wait(300);
  t = tabContent();
  console.log("0/20 edge case matches hand calc, no negative/NaN bound:", t.includes("0.0% to 16.1%"));

  console.log("\nErrors:", errors.length);
  [...new Set(errors)].forEach(e=>console.log("  "+e));
  if (failedChecks) printCheck("\n" + failedChecks + " CHECK(S) FAILED");
  process.exit(errors.length || failedChecks ? 1 : 0);
})();
