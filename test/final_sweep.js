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
  const toolTabs = ["M&A Premium","Company Lookup","Diluted Market Cap","Cash Runway","Runway vs. Catalyst","Binary Event","Peak Sales Comps","Licensing Comps","Catalyst Calendar","Trial Explorer","FDA Lookup","Exclusivity / LOE","Sensitivity","Trial Decoder","Target Dossier"];
  for (const name of toolTabs) {
    const tb = [...d.querySelectorAll("button")].find(b => b.textContent.trim() === name);
    if (!tb) { console.log("MISSING TAB:", name); continue; }
    click(tb); await wait(400);
  }
  console.log("All " + toolTabs.length + " Tools tabs visited without error");

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
