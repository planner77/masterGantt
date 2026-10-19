#!/usr/bin/env node
/* Warning-only, sanitized Issue #751 performance summary. No network or secrets. */
import fs from "node:fs";
import process from "node:process";
const files=process.argv.slice(2);
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]};
export function summarize(payloads) {
  const groups=new Map(), errors=[];
  for(const p of payloads) {
    if(p.schemaVersion!==1 || !Array.isArray(p.receipts) || !p.environment) {errors.push("INVALID_SOURCE");continue;}
    for(const r of p.receipts) {
      if(r.schemaVersion!==2 || !r.source || !Array.isArray(r.stages)) {errors.push("INVALID_RECEIPT");continue;}
      if(r.resultStatus!=="passed" || r.status!=="ok" || r.source.retry!==0) continue;
      for(const stage of r.stages) {
        if(stage.outcome!=="ok" || !Number.isFinite(stage.durationMs) || stage.durationMs<0) continue;
        const key=[p.environment.os,p.environment.node,p.environment.fullyParallel,p.shard,p.shardCount,r.source.project,r.source.testId,stage.stage].join("|");
        const group=groups.get(key)||{stage:stage.stage,values:[],testTimeoutMs:r.timeoutBudgets?.testMs};
        group.values.push(stage.durationMs);groups.set(key,group);
      }
    }
  }
  const rows=[...groups.values()].map(g=>{
    const count=g.values.length, enough=count>=10, p50=enough?percentile(g.values,0.5):null,p95=enough?percentile(g.values,0.95):null;
    return {stage:g.stage,count,p50,p95,verdict:!enough?"INSUFFICIENT_DATA":g.testTimeoutMs && p95>g.testTimeoutMs*0.8?"WARNING_PROVISIONAL_80_PERCENT":"OBSERVED"};
  });
  return {schemaVersion:1,warningOnly:true,minimumSamples:10,rows,errors};
}
const payloads=files.map(file=>{try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch{return {}}});
const result=summarize(payloads);
process.stdout.write("## Issue #751 performance (warning only)\n\n");
process.stdout.write("- Sources: "+files.length+"; invalid: "+result.errors.length+"; min samples per same environment/test/stage: 10\n");
for(const row of result.rows.slice(0,20)) process.stdout.write("- "+row.stage+" n="+row.count+" p50="+(row.p50??"N/A")+"ms p95="+(row.p95??"N/A")+"ms "+row.verdict+"\n");
if(!result.rows.length) process.stdout.write("- INSUFFICIENT_DATA\n");
