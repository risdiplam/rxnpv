const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html","utf8");
const errors=[];
const dom = new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://localhost/",
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.console.warn=()=>{};w.console.error=(...a)=>errors.push("ERROR: "+a.join(" ").slice(0,250));
  w.addEventListener("error",e=>errors.push("UNCAUGHT: "+(e.error&&e.error.stack||e.message).slice(0,350)));
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
  click([...d.querySelectorAll("button")].find(b=>b.textContent.trim()==="Licensing Comps")); await wait(400);

  console.log("=== Baseline: no warning before any save attempt ===");
  let t = root.textContent;
  console.log("No warning shown initially:", !t.includes("Couldn't save that"));

  console.log("\n=== Simulate a full storage quota, then try to add a custom entry ===");
  // Override localStorage.setItem for JUST this key to throw, simulating quota exceeded
  const origSetItem = w.localStorage.setItem.bind(w.localStorage);
  w.localStorage.setItem = (key, val) => {
    if (key === "pdcf_custom_licensing") throw new Error("QuotaExceededError");
    return origSetItem(key, val);
  };

  click(btn("+ Add custom deal")); await wait(300);
  const form = d;
  setVal(findLeafInput(form,"Licensor"),"Test Co");
  setVal(findLeafInput(form,"Licensee"),"Test Pharma");
  await wait(200);
  click(btn("Add")); await wait(400);

  t = root.textContent;
  console.log("Entry still appears in UI (React state updated regardless):", t.includes("Test Co"));
  console.log("Warning now shown:", t.includes("Couldn't save that"));

  console.log("\n=== Restore storage, add another entry, confirm warning clears ===");
  w.localStorage.setItem = origSetItem;
  click(btn("+ Add custom deal")); await wait(300);
  setVal(findLeafInput(form,"Licensor"),"Second Co");
  setVal(findLeafInput(form,"Licensee"),"Second Pharma");
  await wait(200);
  click(btn("Add")); await wait(400);
  t = root.textContent;
  console.log("Warning cleared after a successful save:", !t.includes("Couldn't save that"));
  console.log("Second entry saved correctly:", t.includes("Second Co"));

  console.log("\nErrors:", errors.length);
  [...new Set(errors)].forEach(e=>console.log("  "+e));
  process.exit(0);
})();
