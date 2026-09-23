const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync("test_desktop.html","utf8");
const devBuild = html.includes("react-dom.development");
const errors=[];
// Checks print as "label: true|false". Any false, or any caught app error,
// fails the run with a non-zero exit code — this file used to always exit 0,
// so an automated runner read it as passing whatever it printed.
let failedChecks = 0;
const printCheck = console.log;
console.log = (...a) => { if (a.length > 1 && a[a.length - 1] === false) failedChecks++; printCheck(...a); };
const broken = { id:"crash1", name:"Deliberately Broken", currentPrice:"3.00", programs: null,
  capitalStructure:{mode:"simple",dilutedSharesSimple:"100000000",cash:"40000000",debt:""},
  discountRatePct:"12", terminalValue:{enabled:false} };
const good = { id:"good1", name:"Healthy Case", currentPrice:"2.00", programs:[{
    id:"gp1", name:"P", drugName:"GoodDrug", indication:"NSCLC", therapeuticArea:"Oncology",
    modality:"smallMolecule", currentPhase:"phase2", posOverridePct:"", launchYearOffset:"", revenueMode:"quick",
    quickRevenue:{peakRevenue:"500000000",yearsToPeak:"6",profile:"median",scenarioOverrides:{bear:{peakRevenue:""},bull:{peakRevenue:""}}},
    costStructure:{cogsPct:"",reps:{primaryCare:"",specialty:"",hospital:""},marketingPctOfPeak:""},
    rndOverride:{totalYears:"",totalCostM:""} }],
  capitalStructure:{mode:"simple",dilutedSharesSimple:"100000000",cash:"40000000",debt:""},
  discountRatePct:"12", terminalValue:{enabled:false} };
const dom = new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,url:"https://localhost/",
  beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.console.warn=()=>{};w.console.error=()=>{};
  // React's DEVELOPMENT build re-reports an error its boundary already caught
  // to window.onerror; production does not. Under `npm run test:dev` the one
  // deliberate crash below (programs: null) is therefore expected here and is
  // not counted — anything else still is.
  w.addEventListener("error",e=>{ const m=(e.error&&e.error.message||e.message);
    if (devBuild && /reading '0'|of null/.test(m)) return;
    errors.push("UNCAUGHT: "+m); });
  w.localStorage.setItem("pdcf_cases_v1", JSON.stringify([broken, good]));
  w.fetch=async()=>({ok:false,status:404});
  }});
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  const w=dom.window,d=w.document;await wait(1500);
  const root=d.getElementById("root");
  const click=(el)=>el&&el.dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  const btn=(t)=>[...d.querySelectorAll("button")].find(b=>b.textContent.trim()===t);
  let t = root.textContent;
  console.log("Nav bar present with broken case active:", t.includes("Workspace") && t.includes("Tools"));
  console.log("Fallback shown, not white screen:", t.includes("hit a problem and couldn't render"));
  console.log("Sidebar still shows both cases:", t.includes("Deliberately Broken") && t.includes("Healthy Case"));
  const healthyRow = [...d.querySelectorAll("div")].find(dv => dv.textContent.trim() === "Healthy Case" && dv.children.length===0);
  click(healthyRow ? healthyRow.parentElement : null); await wait(500);
  t = root.textContent;
  console.log("Switching to healthy case recovers:", !t.includes("hit a problem") && t.includes("GoodDrug"));
  console.log("No window-level uncaught errors" + (devBuild ? " (dev build: deliberate crash excluded)" : "") + ":", errors.length === 0);
  if (failedChecks) printCheck("\n" + failedChecks + " CHECK(S) FAILED");
  process.exit(errors.length || failedChecks ? 1 : 0);
})();
