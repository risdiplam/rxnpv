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
const cps=[];function cp(n){cps.push({n,e:errors.length});}
(async()=>{
  const w=dom.window,d=w.document;await wait(1500);
  const root=d.getElementById("root");
  const click=(el)=>el&&el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const btn=(t)=>[...d.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set;s.call(el,v);el.dispatchEvent(new w.Event("input",{bubbles:true}));};

  click(btn("+ New case")); await wait(400); cp("case created");
  setVal(findByLabel(d,"Peak worldwide revenue"),"1000"); await wait(150);
  setVal(findByLabel(d,"Fully diluted shares"),"100000000"); await wait(150);
  setVal(findByLabel(d,"Cash & equivalents"),"50"); await wait(150);
  const pi=[...d.querySelectorAll("input")].find(i=>i.placeholder==="0.00");
  setVal(pi,"2.50"); await wait(250); cp("quick revenue populated");

  let t = root.textContent;
  console.log("DCF valuation computes:", t.includes("Equity") || t.includes("Enterprise"));

  // Full/Detailed mode
  const fullBtn=[...d.querySelectorAll("button")].find(b=>b.textContent.includes("build up"));
  if(fullBtn){click(fullBtn);await wait(400);cp("Full mode");}
  const quickBtn=[...d.querySelectorAll("button")].find(b=>b.textContent.includes("peak revenue directly"));
  if(quickBtn){click(quickBtn);await wait(400);cp("back to Quick");}

  // Simple Multiple method
  const smBtn=[...d.querySelectorAll("button")].find(b=>b.textContent.trim()==="Simple Multiple");
  if(smBtn){click(smBtn);await wait(400);cp("Simple Multiple");}
  const dcfBtn=[...d.querySelectorAll("button")].find(b=>b.textContent.includes("DCF"));
  if(dcfBtn){click(dcfBtn);await wait(400);cp("back to DCF");}

  // Partnership
  const partnerCb=[...d.querySelectorAll("input[type=checkbox]")].find(c=>c.closest("label")&&c.closest("label").textContent.includes("Partnered asset"));
  if(partnerCb){click(partnerCb);await wait(300);cp("Partnership enabled");}

  // Dilution path
  const dilCb=[...d.querySelectorAll("input[type=checkbox]")].find(c=>c.closest("label")&&c.closest("label").textContent.includes("Model dilution path"));
  if(dilCb){click(dilCb);await wait(300);cp("Dilution Path enabled");}

  // Monte Carlo
  const mcBtn=[...d.querySelectorAll("button")].find(b=>b.textContent.includes("Run 3,000 trials"));
  if(mcBtn){click(mcBtn);await wait(3500);cp("Monte Carlo run");
    t=root.textContent; console.log("Monte Carlo produces results:", t.includes("P50"));}

  // All top-level views
  for(const v of ["Tools","Simulation","Portfolio","Reference Sheet"]){click(btn(v));await wait(600);cp("view: "+v);}
  click(btn("Workspace")); await wait(400);
  const rb=[...d.querySelectorAll("button")].find(b=>/report/i.test(b.textContent));
  if(rb){click(rb);await wait(700);cp("Report view");}

  console.log("\n=== CHECKPOINTS ===");
  cps.forEach(c=>console.log("  "+c.n+": "+c.e));
  console.log("\nTOTAL ERRORS:",errors.length);
  [...new Set(errors)].forEach(e=>console.log("  "+e));
  process.exit(errors.length>0?1:0);
})();
