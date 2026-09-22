const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html","utf8");
const errors=[];
const dom = new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://localhost/",
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.console.warn=(...a)=>{const s=a.join(" ");if(!s.includes("EDGAR")&&!s.includes("RDKit"))errors.push("WARN: "+s.slice(0,200));};
  w.console.error=(...a)=>errors.push("ERROR: "+a.join(" ").slice(0,250));
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

  click(btn("+ New case")); await wait(400);
  setVal(findByLabel(d,"Peak worldwide revenue"),"1000"); await wait(150);
  setVal(findByLabel(d,"Fully diluted shares"),"100000000"); await wait(150);

  click(btn("Tools")); await wait(400);
  // Tools is now six workbenches, each holding two to four tools on a second
  // row. Every workbench is opened and then every tool inside it, so a tool
  // that exists in the render chain but was left out of a workbench (or put in
  // two) shows up here as an unreachable tab rather than as nothing at all.
  const workbenches = [
    ["Trial",       ["Trial Decoder", "Asset Program", "Trial Explorer", "FDA Lookup"]],
    ["Science",     ["Target Dossier", "Literature"]],
    ["Company",     ["Company Lookup", "Catalyst Calendar", "Cash Runway", "Runway vs. Catalyst"]],
    ["Commercial",  ["Launch & Actuals", "Exclusivity / LOE"]],
    ["Valuation",   ["Sensitivity", "Binary Event", "Diluted Market Cap"]],
    ["Benchmarks",  ["M&A Premium", "Peak Sales Comps", "Licensing Comps"]]
  ];
  let toolsVisited = 0, missing = 0;
  for (const [bench, tools] of workbenches) {
    const bb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === bench);
    if (!bb) { console.log("MISSING WORKBENCH:", bench); missing++; continue; }
    click(bb); await wait(350);
    for (const name of tools) {
      const tb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === name);
      if (!tb) { console.log("MISSING TOOL:", bench + " / " + name); missing++; continue; }
      click(tb); await wait(350);
      toolsVisited++;
    }
  }
  console.log("All " + workbenches.length + " Tools workbenches and " + toolsVisited + " tools visited without error"
    + (missing ? " (" + missing + " MISSING)" : ""));
  if (missing) errors.push("ERROR: " + missing + " Tools workbench/tool button(s) not found");

  // The two sub-tools inside the Commercial workbench, which are their own
  // switch rather than top-level tabs.
  const commBench = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === "Commercial");
  if (commBench) {
    click(commBench); await wait(350);
    for (const name of ["Launch tracker", "Actual vs modelled"]) {
      const tb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === name);
      if (!tb) { console.log("MISSING COMMERCIAL SUBTOOL:", name); errors.push("ERROR: missing Commercial sub-tool " + name); continue; }
      click(tb); await wait(300);
    }
  }

  click(btn("Simulation")); await wait(600);
  const simTabs = ["Trial Outcome / PoS","Phase 2→3 Translator","Trial Statistics","Meta-Analysis","Peak Sales","PK/PD"];
  for (const name of simTabs) {
    const tb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === name);
    if (!tb) { console.log("MISSING SIM TAB:", name); continue; }
    click(tb); await wait(400);
  }
  const statsSubTabs = ["Fragility Index","Sample Size / Power","P-value ↔ CI","Single-Arm CI","2×2 Outcome Analysis","Non-Inferiority","Multiplicity Adjustment"];
  const statsTab = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === "Trial Statistics");
  click(statsTab); await wait(400);
  for (const name of statsSubTabs) {
    const tb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === name);
    if (!tb) { console.log("MISSING STATS SUBTAB:", name); continue; }
    click(tb); await wait(400);
  }
  console.log("All 6 Simulation tabs + 7 Trial Statistics subtabs visited without error");

  click(btn("Portfolio")); await wait(500);
  click(btn("Reference Sheet")); await wait(500);
  // Every Reference Sheet tab, including the trial glossary added alongside
  // the decoder — pure content, but it still has to render.
  const refTabs = ["How This Works","Revenue Build","Cost Structure","R&D & Timeline","Probability of Success","Discount Rate","Valuation & Dilution","M&A Comps","Trial Glossary"];
  for (const name of refTabs) {
    const b = btn(name);
    if (!b) { console.log("  MISSING Reference Sheet tab: " + name); continue; }
    click(b); await wait(150);
  }
  console.log("Portfolio + all " + refTabs.length + " Reference Sheet tabs visited without error");

  const licensingCb = [...d.querySelectorAll("input[type=checkbox]")].find(c => c.closest("label") && c.closest("label").textContent.includes("Partnered asset"));
  console.log("\nErrors:", errors.length);
  [...new Set(errors)].forEach(e=>console.log("  "+e));
  process.exit(0);
})();
