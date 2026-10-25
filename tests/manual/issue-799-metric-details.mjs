/** Opt-in metric-region inventory and raw report receipts for the paired #799 capture. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const phase = process.env.METRICS_CAPTURE ?? "before";
const widths = (process.env.METRICS_WIDTHS ?? "1440").split(",").map(Number);
if(!widths.length || widths.some(width=>![390,768,1024,1440,1920].includes(width)))throw Error("Unsupported width");
if (!["before", "after"].includes(phase)) throw Error("Use before or after");
const directory = resolve(repository, "output/playwright/issue-799", phase);
await mkdir(directory, {recursive:true});
const fixture = JSON.parse(await readFile(resolve(repository,"output/playwright/issue-799/fixture.json"),"utf8"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sourcePaths = execFileSync("git",["ls-files","src"],{cwd:repository,encoding:"utf8"}).trim().split("\n");
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(resolve(repository,p)))])));
const sourceStart = await hashes();
const filename = resolve(directory,"metric-details.cli.js");
const output = resolve(directory,"metric-details.json");
const roots = {kpi:"KPI",milestone:"Milestone",process:"공정&WorkArea",equipment:"설비",system:"물류 시스템",resource:"리소스"};
await writeFile(filename,`async page => {
 const original=page;const results=[];const writes=[];const faults=[];const origin='http://127.0.0.1:3199';
 const readQuery=request=>request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/resource-dashboard/views')&&['report','details','scope'].includes(request.postDataJSON()?.projection?.kind);
 const fingerprint=async()=>{const r=await original.request.get(origin+'/api/projects/${fixture.publicId}');if(r.status()!==200)throw Error('canonical read failed');const data=(await r.json()).data;return {revision:data.project.revision,tasks:data.tasks.length,assignments:data.assignments?.length??0,hash:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))).toString('hex')};};
 const canonicalBefore=await fingerprint();
 for(const width of ${JSON.stringify(widths)})for(const [root,label] of Object.entries(${JSON.stringify(roots)})){
  const context=await original.context().browser().newContext({storageState:{cookies:await original.context().cookies(),origins:[]},viewport:{width,height:900},locale:'ko-KR',timezoneId:'Asia/Seoul',deviceScaleFactor:1});
  const current=await context.newPage();const reports=[];
  current.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/projects/')&&!['GET','HEAD','OPTIONS'].includes(request.method())&&!readQuery(request))writes.push({root,width,method:request.method()});});
  current.on('response',async response=>{if(response.url().endsWith('/resource-dashboard/views')&&response.status()===200&&response.request().postDataJSON()?.projection?.kind==='report')reports.push((await response.json()).data);});
  try {
   await current.goto(origin+'/projects/${fixture.publicId}');await current.waitForLoadState('networkidle');await current.getByText('편집 중',{exact:true}).waitFor({timeout:30000});
   await current.getByRole('tablist',{name:'프로젝트 작업공간',exact:true}).getByRole('tab',{name:'대시보드',exact:true}).click();
   await current.getByRole('tablist',{name:'대시보드 보기',exact:true}).getByRole('tab',{name:label,exact:true}).click();
   const active=current.locator(root==='kpi'?'[data-testid="logistics-dashboard-view"]':'[data-wbs-view="'+root+'"][data-ready="true"]').filter({visible:true});
   await active.waitFor({timeout:30000});if(root==='kpi')await active.locator('[class*="kpiGrid"]').waitFor({timeout:30000});
   const inventory=await active.evaluate(element=>{
    const visible=n=>n.checkVisibility({checkVisibilityCSS:true})&&!n.closest('[inert],[aria-hidden="true"],details:not([open]) > :not(summary)');
    const rect=n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right};};
    return {headings:Array.from(element.querySelectorAll('h3,h4')).filter(visible).map(n=>({text:n.textContent,...rect(n)})),metrics:Array.from(element.querySelectorAll('dl[aria-label]')).filter(visible).map(group=>({scope:group.getAttribute('aria-label'),...rect(group),items:Array.from(group.children).map(item=>{const dt=item.querySelector('dt'),dd=item.querySelector('dd');if(!dt||!dd)return null;const range=document.createRange();range.selectNodeContents(dd);const s=getComputedStyle(dd);return {label:dt.textContent,value:dd.textContent,labelRect:rect(dt),valueRect:rect(dd),contentRect:rect(range),labelStyle:{fontSize:getComputedStyle(dt).fontSize,color:getComputedStyle(dt).color},valueStyle:{fontSize:s.fontSize,fontWeight:s.fontWeight,color:s.color,numeric:s.fontVariantNumeric},lines:Array.from(range.getClientRects()).map(b=>({x:b.x,y:b.y,width:b.width,height:b.height}))};}).filter(Boolean)})),states:Array.from(element.querySelectorAll('[role="status"],[role="alert"]')).filter(visible).map(n=>({role:n.getAttribute('role'),text:n.textContent})),actions:Array.from(element.querySelectorAll('button,summary')).filter(visible).map(n=>({tag:n.tagName,text:n.getAttribute('aria-label')??n.textContent})),documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   const groups=active.locator('dl[aria-label]').filter({visible:true});const screenshots=[];
   if(root!=='kpi')for(let i=0;i<await groups.count();i++) {const name=root+'-'+width+'-metrics-'+i+'.png';await groups.nth(i).screenshot({style:'nextjs-portal { visibility: hidden; }',path:${JSON.stringify(directory)}+'/'+name});screenshots.push(name);}
   if(root!=='kpi'&&!reports.length)throw Error('report receipt missing');
   results.push({root,width,inventory,reports,screenshots});
  }catch(error){faults.push({root,width,message:error.message.slice(0,500)});}finally{await context.close();}
 }
 const canonicalAfter=await fingerprint();return {results,writes,faults,canonicalBefore,canonicalAfter};
}`);
let receipt;
try {
 const raw=execFileSync("bash",[process.env.UI_AUDIT_CLI??"/home/planner/.codex/skills/playwright/scripts/playwright_cli.sh","-s=issue799metrics","run-code","--filename",filename,"--raw"],{cwd:repository,encoding:"utf8",maxBuffer:64*1024*1024,timeout:600_000});
 receipt=JSON.parse(raw);
}finally{await unlink(filename);}
const sourceEnd=await hashes();
const stable=JSON.stringify(sourceStart)===JSON.stringify(sourceEnd);

await writeFile(output,JSON.stringify({phase,widths,sourceStable:stable,sourceHashes:sourceEnd,collectorSha256:sha(await readFile(fileURLToPath(import.meta.url))),...receipt},null,2)+'\n');
const valid=stable&&receipt.results.length===widths.length*6&&!receipt.writes.length&&!receipt.faults.length&&receipt.canonicalBefore.hash===receipt.canonicalAfter.hash;
console.log(JSON.stringify({phase,samples:receipt.results.length,mutations:receipt.writes.length,faults:receipt.faults,sourceStable:stable,result:valid?"PASS":"FAIL"}));
if(!valid)process.exitCode=1;
