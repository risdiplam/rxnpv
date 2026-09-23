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
  w.console.warn=()=>{};w.console.error=(...a)=>errors.push("ERROR: "+a.join(" ").slice(0,250));
  w.addEventListener("error",e=>errors.push("UNCAUGHT: "+(e.error&&e.error.stack||e.message).slice(0,350)));
  w.fetch=async()=>({ok:false,status:404});
  }});
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function findByLabel(d,t){return [...d.querySelectorAll("input")].find(i=>{const o=i.parentElement&&i.parentElement.parentElement;return o&&o.children[0]&&o.children[0].textContent.includes(t);});}
(async()=>{
  const w=dom.window,d=w.document;await wait(1500);
  const root=d.getElementById("root");
  const click=(el)=>el&&el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const btn=(t)=>[...d.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set;s.call(el,v);el.dispatchEvent(new w.Event("input",{bubbles:true}));};

  console.log("App loaded, root has content:", root.textContent.length > 0);
  click(btn("+ New case")); await wait(400);
  console.log("Case created:", root.textContent.includes("New Case"));

  setVal(findByLabel(d,"Peak worldwide revenue"),"1000"); await wait(150);
  setVal(findByLabel(d,"Fully diluted shares"),"100000000"); await wait(150);
  let t = root.textContent;
  console.log("Valuation computes (shows Enterprise/Equity Value):", t.includes("Equity") || t.includes("Enterprise"));

  console.log("\n=== Verify all major views load ===");
  for (const v of ["Tools","Simulation","Portfolio","Reference Sheet","Workspace"]) {
    click(btn(v)); await wait(500);
  }
  console.log("All views navigated without crash");

  console.log("\n=== Verify the M&A additions from the lost session ===");
  click(btn("Tools")); await wait(400);
  // A tool button only exists once its workbench is open.
  click(btn("Benchmarks")); await wait(350);
  click([...d.querySelectorAll("button")].find(b=>b.textContent.trim()==="M&A Premium")); await wait(500);
  t = root.textContent;
  console.log("AbbVie/Apogee present:", t.includes("Apogee"));
  console.log("GSK/Nuvalent present:", t.includes("Nuvalent"));

  console.log("\n=== Verify error boundary still works ===");
  console.log("(will check separately with a deliberate crash test)");

  console.log("\nTotal errors:", errors.length);
  [...new Set(errors)].forEach(e=>console.log("  "+e));
  if (failedChecks) printCheck("\n" + failedChecks + " CHECK(S) FAILED");
  process.exit(errors.length || failedChecks ? 1 : 0);
})();
