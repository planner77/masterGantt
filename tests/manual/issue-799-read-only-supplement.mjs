/** Complete only the two missing metric inventories; independent read-only five-query receipt. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const repository=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const output=resolve(repository,"output/playwright/issue-799/after");
await mkdir(output,{recursive:true});
const read=path=>readFile(resolve(repository,path),"utf8");
const fixture=JSON.parse(await read("output/playwright/issue-799/fixture.json"));
const before=JSON.parse(await read("output/playwright/issue-799/before/metric-details.json"));
const standardAfter=JSON.parse(await read("output/playwright/issue-799/after/dashboards-manifest.json"));
const sha=value=>createHash("sha256").update(value).digest("hex");
const sourceHashes=async()=>Object.fromEntries(await Promise.all(Object.keys(standardAfter.sourceHashes).map(async path=>[path,sha(await read(path))])));
const start=await sourceHashes();
const queries=before.results.filter(row=>row.root!=="kpi").map(row=>{const report=row.reports.at(-1);return {root:row.root,input:{spec:report.spec,filters:report.filters,...(report.sourceContext.scope?{scope:report.sourceContext.scope}:{}),projection:{kind:"report"}}};});
const filename=resolve(output,"read-only-supplement.cli.js");
await writeFile(filename,`async page=>{
 const origin='http://127.0.0.1:3199',publicId=${JSON.stringify(fixture.publicId)};const original=page;
 const snapshot=async()=>{const response=await page.request.get(origin+'/api/projects/'+publicId);if(response.status()!==200)throw Error('canonical read failed');const data=(await response.json()).data;return {revision:data.project.revision,hash:Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))).toString('hex')};};
 const canonicalBefore=await snapshot();const rawReports=[];
 for(const query of ${JSON.stringify(queries)}){const response=await page.request.post(origin+'/api/projects/'+publicId+'/resource-dashboard/views',{headers:{Origin:origin},data:query.input});if(response.status()!==200)throw Error('Read-only query '+query.root+' status '+response.status());rawReports.push({root:query.root,input:query.input,data:(await response.json()).data});}
 const inventories=[];const writes=[];const faults=[];
 for(const [root,label] of [['process','공정&WorkArea'],['resource','리소스']]){
  const context=await original.context().browser().newContext({viewport:{width:1440,height:900},locale:'ko-KR',timezoneId:'Asia/Seoul',deviceScaleFactor:1});const current=await context.newPage();
  current.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/projects/')&&!['GET','HEAD','OPTIONS'].includes(request.method())&&!(request.method()==='POST'&&new URL(request.url()).pathname.endsWith('/resource-dashboard/views')))writes.push({root,method:request.method()});});
  try{
   await current.goto(origin+'/projects/'+publicId);await current.waitForLoadState('networkidle');
   await current.getByRole('tablist',{name:'프로젝트 작업공간',exact:true}).getByRole('tab',{name:'대시보드',exact:true}).click();
   await current.getByRole('tablist',{name:'대시보드 보기',exact:true}).getByRole('tab',{name:label,exact:true}).click();
   const active=current.locator('[data-wbs-view="'+root+'"][data-ready="true"]').filter({visible:true});await active.waitFor({timeout:30000});
   const editingVisible=await current.getByText('편집 중',{exact:true}).isVisible();if(editingVisible)throw Error('Expected independent readonly context');
   const inventory=await active.evaluate(element=>{
    const visible=n=>n.checkVisibility({checkVisibilityCSS:true})&&!n.closest('[inert],[aria-hidden="true"],details:not([open]) > :not(summary)');
    const rect=n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,right:b.right};};
    return {metrics:Array.from(element.querySelectorAll('dl[aria-label]')).filter(visible).map(group=>({scope:group.getAttribute('aria-label'),items:Array.from(group.children).map(item=>{const dt=item.querySelector('dt'),dd=item.querySelector('dd');if(!dt||!dd)return null;const range=document.createRange();range.selectNodeContents(dd);const s=getComputedStyle(dd);return {label:dt.textContent,value:dd.textContent,labelRect:rect(dt),valueRect:rect(dd),contentRect:rect(range),labelStyle:{fontSize:getComputedStyle(dt).fontSize,color:getComputedStyle(dt).color},valueStyle:{fontSize:s.fontSize,fontWeight:s.fontWeight,color:s.color,numeric:s.fontVariantNumeric}};}).filter(Boolean)})),documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   const groups=active.locator('dl[aria-label]').filter({visible:true});const screenshots=[];
   for(let i=0;i<await groups.count();i++){const name=root+'-1440-readonly-metrics-'+i+'.png';await groups.nth(i).screenshot({path:${JSON.stringify(output)}+'/'+name,style:'nextjs-portal {visibility:hidden}'});screenshots.push(name);}
   inventories.push({root,width:1440,permission:'readonly; empty-cookie fresh context',editingVisible,inventory,screenshots});
  }catch(error){faults.push({root,message:error.message.split('\\n')[0]});}finally{await context.close();}
 }
 return {canonicalBefore,canonicalAfter:await snapshot(),rawReports,inventories,writes,faults};
}`);
let result;
try{result=JSON.parse(execFileSync("bash",["/home/planner/.codex/skills/playwright/scripts/playwright_cli.sh","-s=issue799metrics","run-code","--filename",filename,"--raw"],{cwd:repository,encoding:"utf8",maxBuffer:64*1024*1024,timeout:300_000}));}
finally{await unlink(filename);}
const end=await sourceHashes();
const stable=JSON.stringify(start)===JSON.stringify(end)&&JSON.stringify(end)===JSON.stringify(standardAfter.sourceHashes);
const rawEquality=result.rawReports.map(row=>({root:row.root,equal:JSON.stringify(row.data)===JSON.stringify(before.results.find(prior=>prior.root===row.root).reports.at(-1))}));
const passed=stable&&result.inventories.length===2&&!result.faults.length&&!result.writes.length&&result.canonicalBefore.hash===result.canonicalAfter.hash&&rawEquality.every(row=>row.equal);
await writeFile(resolve(output,"read-only-supplement.json"),JSON.stringify({status:passed?"PASS":"FAIL",scope:"Separate readonly1440 inventories for process/resource and independent exact same-query5 raw reports; not a clean single six-view supplemental run; standard30 same-auth geometry remains separate.",sourceStable:stable,sourceHashes:end,collectorSha256:sha(await readFile(fileURLToPath(import.meta.url))),rawEquality,...result},null,2)+'\n');
console.log(JSON.stringify({status:passed?"PASS":"FAIL",inventoryCount:result.inventories.length,rawEquality,faults:result.faults,sourceStable:stable}));
if(!passed)process.exitCode=1;
