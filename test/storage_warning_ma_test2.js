const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html","utf8");
const dom = new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://localhost/",
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.console.warn=()=>{};w.console.error=()=>{};
  w.fetch=async()=>({ok:false,status:404});
  }});
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
function findLeafInput(container, labelText) {
  const labelDiv = [...container.querySelectorAll("div")].find(dv => dv.children.length === 0 && dv.textContent.trim().replace(" *","") === labelText);
  return labelDiv ? labelDiv.nextElementSibling : null;
}
(async()=>{
  const w=dom.window,d=w.document;await wait(1500);
  const root=d.getElementById("root");
  const click=(el)=>el&&el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const btn=(t)=>[...d.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,"value").set;s.call(el,v);el.dispatchEvent(new w.Event("input",{bubbles:true}));};

  click(btn("+ New case")); await wait(400);
  click(btn("Tools")); await wait(400);
  // Tools is organised into workbenches now, so a tool button only exists once
  // its workbench is open. Selecting the workbench first is what a user does
  // too — this is not a test-only step.
  click([...d.querySelectorAll("button")].find(b=>b.textContent.trim()==="Benchmarks")); await wait(350);
  click([...d.querySelectorAll("button")].find(b=>b.textContent.trim()==="M&A Premium")); await wait(400);

  w.saveCustomComps = () => false;
  click(btn("+ Add custom deal comp")); await wait(300);
  setVal(findLeafInput(d,"Acquirer"),"Test Acquirer");
  setVal(findLeafInput(d,"Target"),"Test Target");
  await wait(200);
  click(btn("Add")); await wait(400);

  console.log("Entry visible in the SAME tab (its own React state, unaffected by persistence):", root.textContent.includes("Test Acquirer"));
  console.log("Warning still visible in this tab:", root.textContent.includes("Couldn't save that"));
  process.exit(0);
})();
