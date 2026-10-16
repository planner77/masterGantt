import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const prefix="tests/fixtures/gantt-axis-transaction";
const wrapper=process.env.PLAYWRIGHT_CLI_WRAPPER??resolve(homedir(),".codex/skills/playwright/scripts/playwright_cli.sh");
const fingerprint=JSON.parse(await readFile(root+"output/playwright/issue-666/build-fingerprint.json","utf8"));
const checkSources=async()=>{for(const [path,expected]of Object.entries(fingerprint.sha256)){if(createHash("sha256").update(await readFile(root+path)).digest("hex")!==expected)throw new Error(`Source changed after bundle: ${path}`);}};
await checkSources();
const command=(args)=>execFileSync("bash",[wrapper,"-s=axis666",...((args[0] === "run-code") ? ["run-code", `async (page) => { ${args[1]} }`] : args)],{cwd:root,encoding:"utf8",maxBuffer:8*1024*1024});
const base=new URL("output/playwright/issue-666/axis.html",new URL(`file://${root}`)).href;
const rows=[];
const summarize=`const compact = s => ({core:{left:s.core.left,top:s.core.top,originMs:s.core.originMs,endMs:s.core.endMs,scaleWidth:s.core.scaleWidth,chartWidth:s.core.chartWidth,selected:s.core.selected},physical:s.geometry.ok?{left:s.geometry.value.left,top:s.geometry.value.top,chartWidth:s.geometry.value.chartWidth,scrollWidth:s.geometry.value.scrollWidth,chartHeight:s.geometry.value.chartHeight,scrollHeight:s.geometry.value.scrollHeight,verticalClientHeight:s.geometry.value.verticalClientHeight}:null,apiInstance:s.apiInstance,writes:s.writes});`;
for(const mode of ["A","B","C","U1"]){
  const code=`const records=[];
for(const width of [390,768,1024,1440,1920])for(const scale of ["day","week"]){
 await page.setViewportSize({width,height:900});await page.goto(${JSON.stringify(base)}+"?mode=${mode}&scale="+scale);await page.waitForFunction(()=>window.${mode==="U1"?"__axis666":"__issue569"});
 records.push(await page.evaluate(async()=>{${summarize}const c=window.${mode==="U1"?"__axis666":"__issue569"};await c.settle();await c.scroll(${mode==="U1"?"100,80":"{left:100,top:80}"});const trials=[];for(let repeat=0;repeat<3;repeat++){if(${mode==="U1"}){const s=c.sample();if(s.geometry.ok)await c.scroll(Math.max(0,s.geometry.value.scrollWidth-s.geometry.value.chartWidth-20),80);}const r=await c.${mode==="U1"?'run("PRESERVE")':"extend()"};trials.push({repeat:repeat+1,result:r.result,checks:r.checks,supported:r.supported,before:compact(r.before),after:compact(r.after)});if(${mode==="U1"?'r.result.outcome!=="SETTLED"':"!r.supported"})break;}return {trials};}).then(value=>({mode:${JSON.stringify(mode)},width,scale,range:"large",variant:"normal",...value})));
} return records;`;
  const output=command(["run-code",code]);
  const match=output.match(/### Result\n([^\n]+)/);
  if(!match)throw new Error("Missing browser evidence");
  rows.push(...JSON.parse(match[1]));
  console.log(`${mode}: ${rows.filter(r=>r.mode===mode).length} cases`);
}
const extraCode=`const records=[];
for(const width of [390,1440])for(const scale of ["day","week"])for(const variant of ["normal","empty","no-match","milestone"]){
 await page.setViewportSize({width,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1&range=short&scale="+scale+"&variant="+variant);await page.waitForFunction(()=>window.__axis666);
 records.push(await page.evaluate(async variant=>{${summarize}const c=window.__axis666;await c.settle();const tasksBefore=c.canonical();const filter=variant==="no-match"?await c.filterNoMatch():null;const r=await c.run("ORIGIN");return {result:r.result,before:compact(r.before),after:compact(r.after),filter,canonicalUnchanged:JSON.stringify(tasksBefore)===JSON.stringify(c.canonical())};},variant).then(value=>({mode:"U1",width,scale,range:"short",variant,...value})));
} return records;`;
rows.push(...JSON.parse(command(["run-code",extraCode]).match(/### Result\n([^\n]+)/)[1]));
const interruptions=`const records=[];
for(const interruption of ["abort","wheel","query","reveal","layout","hidden"]){
 await page.setViewportSize({width:1440,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1");await page.waitForFunction(()=>window.__axis666);
 records.push(await page.evaluate(async interruption=>{${summarize}const c=window.__axis666;await c.settle();await c.scroll(100,0);if(interruption==="hidden")c.hidden(true);const r=await c.run("PRESERVE",interruption);const writes=r.after.writes;await c.settle();return {result:r.result,before:compact(r.before),after:compact(r.after),lateWrites:c.sample().writes-writes};},interruption).then(value=>({mode:"U1",width:1440,scale:"day",range:"large",interruption,...value})));
}return records;`;
rows.push(...JSON.parse(command(["run-code",interruptions]).match(/### Result\n([^\n]+)/)[1]));
const actualInputs=`const records=[];
for(const action of ["wheel","task-reveal","milestone-reveal","filter-no-match","columns","physical-resize"]){
 await page.setViewportSize({width:1440,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1");await page.waitForFunction(()=>window.__axis666);
 await page.evaluate(async()=>{const c=window.__axis666;await c.settle();await c.scroll(100,80);c.start();});
 await page.waitForFunction(()=>document.getElementById("fixture").dataset.pending==="true");
 const held=await page.evaluate(()=>window.__axis666.sample().writes);
 let actionObservation=null;
 if(action==="wheel"){await page.mouse.move(700,250);await page.mouse.wheel(137,77);await page.waitForFunction(()=>window.__axis666.sample().leaseEpoch>0);}
 else actionObservation=await page.evaluate(async action=>{const c=window.__axis666;return action==="task-reveal"?c.reveal("fixture-30"):action==="milestone-reveal"?c.reveal("fixture-5"):action==="filter-no-match"?c.filterNoMatch():action==="columns"?c.columns():c.resize();},action);
 const observed=await page.evaluate(async()=>{${summarize}const c=window.__axis666;const r=await c.finish();const writes=c.sample().writes;await c.settle();return {result:r.result,before:compact(r.before),after:compact(r.after),lateWrites:c.sample().writes-writes};});
 records.push({mode:"U1",width:1440,scale:"day",range:"large",stage:"AFTER_EXTENT_COMMIT",action,heldWrites:held,actionObservation:action==="filter-no-match"?actionObservation:null,...observed});
} return records;`;
rows.push(...JSON.parse(command(["run-code",actualInputs]).match(/### Result\n([^\n]+)/)[1]));
const cancelledSynthetic=`await page.setViewportSize({width:1440,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1");await page.waitForFunction(()=>window.__axis666);return await page.evaluate(async()=>{${summarize}const c=window.__axis666;await c.settle();await c.scroll(100,80);const r=await c.syntheticCancel();return {mode:"C",stage:"CANCEL_AFTER_SYNTHETIC_WRITE",width:1440,scale:"day",before:compact(r.before),afterCancel:compact(r.afterCancel),afterNaturalResize:compact(r.afterNaturalResize),result:r.result,retryResult:r.retryResult,syntheticWrites:r.syntheticWrites,restoringWrites:r.restoringWrites};});`;
rows.push(JSON.parse(command(["run-code",cancelledSynthetic]).match(/### Result\n([^\n]+)/)[1]));
const capacityCode=`const records=[];
for(const allowClamp of [false,true]){
 await page.setViewportSize({width:1440,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1");await page.waitForFunction(()=>window.__axis666);
 records.push(await page.evaluate(async allowClamp=>{${summarize}const c=window.__axis666;await c.settle();await c.scroll(100,80);const s=c.sample();const capacity=s.geometry.value.scrollWidth-s.geometry.value.chartWidth;const requested={left:capacity+100,top:80};const r=await c.position(requested,allowClamp);return {mode:"U1",stage:"CAPACITY_POLICY",width:1440,scale:"day",allowClamp,requested,physicalCapacity:capacity,lateWrites:r.lateWrites,result:r.result,before:compact(r.before),after:compact(r.after)};},allowClamp));
}return records;`;
rows.push(...JSON.parse(command(["run-code",capacityCode]).match(/### Result\n([^\n]+)/)[1]));
const completedWheel=`await page.setViewportSize({width:1440,height:900});await page.goto(${JSON.stringify(base)}+"?mode=U1");await page.waitForFunction(()=>window.__axis666);
const completed=await page.evaluate(async()=>{${summarize}const c=window.__axis666;await c.settle();await c.scroll(100,80);const r=await c.run();return {result:r.result,before:compact(r.after)};});
await page.mouse.move(700,250);await page.mouse.wheel(137,0);await page.waitForFunction(()=>window.__axis666.sample().leaseEpoch>0);
const after=await page.evaluate(async()=>{${summarize}const c=window.__axis666;await c.settle();return compact(c.sample());});
return {mode:"U1",stage:"WHEEL_AFTER_SETTLED",width:1440,scale:"day",...completed,after};`;
rows.push(JSON.parse(command(["run-code",completedWheel]).match(/### Result\n([^\n]+)/)[1]));
const environment=JSON.parse(command(["eval","() => ({browser:navigator.userAgent,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})","--raw"]));
const files=["package.json","package-lock.json",`${prefix}/browser.tsx`,`${prefix}/prepare-browser.mjs`,`${prefix}/record-browser.mjs`,"src/features/gantt/viewport/axis-transaction.ts","src/features/gantt/diagnostics/gantt-adapter-fixture.tsx","src/features/gantt/adapter/gantt-adapter.ts"];
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash("sha256").update(await readFile(root+p)).digest("hex")])));
const read=async p=>JSON.parse(await readFile(root+p,"utf8"));
const evidence={schemaVersion:1,collection:"SYNTHETIC_CORE_AXIS_BROWSER",capturedAt:new Date().toISOString(),sourceBase:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),installed:{wrapper:(await read("node_modules/@svar-ui/react-gantt/package.json")).version,store:(await read("node_modules/@svar-ui/gantt-store/package.json")).version},environment,sha256:hashes,commands:["node tests/fixtures/gantt-axis-transaction/prepare-browser.mjs","bash <playwright-skill>/scripts/playwright_cli.sh -s=axis666 open <synthetic-fixture> --config output/playwright/issue-666/cli-config.json","node tests/fixtures/gantt-axis-transaction/record-browser.mjs"],originalFailures:[{stage:"SETUP",outcome:"BLOCKED",reason:"Skill wrapper lacks executable bit; invoked through bash without modifying it."},{stage:"FIXTURE_LAYOUT",outcome:"FAIL",reason:"Initial Willow descendant lacked bounded height. Core top36 differed from native0. Discarded as support evidence; bounded 500px child added before final capture."},{stage:"BASELINE_SCROLL",outcome:"FAIL",reason:"Initial A/B/C runner passed two numbers to object-only scroll port, leaving left0. initial-zero-baseline.json preserves this rejected support evidence; final comparison uses object argument."},{stage:"ACTUAL_CAPACITY_CLAMP",outcome:"FAIL",reason:"Explicit allowed clamp targets native capacity5293 but Core caps5292; exact-target confirmation yields TIMED_OUT. Recorded as DEFER; no tolerance or timeout changed."}],notTested:["Production wiring; readonly/editable HTTP/SQLite; full PR CI/Trusted QA; main/GHCR/release","Actual app-level query/reveal/layout integration (actual Core commands tested only in isolated fixture)","Actual horizontal clamp support: native/Core maximum differs1px and is DEFER (TIMED_OUT)","Screen reader, native125 zoom and actual devices"],cases:rows};
await checkSources();
await writeFile(root+`${prefix}/actual-core-2.7.3.json`,JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify({cases:rows.length,sha256:hashes}));
