#!/usr/bin/env python3
"""Read-only on-demand sampling of last successful main CI timing artifacts."""
import argparse
import json
import math
import os
import pathlib
import re
import subprocess
import tempfile
from collections import defaultdict

def call(*args):
    return subprocess.run(["gh",*args],check=True,capture_output=True,text=True,timeout=75).stdout

def pct(values,rate):
    v=sorted(values)
    return v[max(0,math.ceil(len(v)*rate)-1)]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--repository",default=os.getenv("GITHUB_REPOSITORY",""))
    p.add_argument("--limit",type=int,default=20)
    p.add_argument("--output",required=True)
    p.add_argument("--summary",required=True)
    a=p.parse_args()
    if not re.fullmatch(r"[\w.-]+/[\w.-]+",a.repository) or not 1<=a.limit<=30:
        raise SystemExit("BLOCKED: invalid repository/limit")
    found=json.loads(call("api","repos/"+a.repository+"/actions/workflows/ci.yml/runs?event=push&branch=main&status=success&per_page=50"))
    runs=[r for r in found.get("workflow_runs",[]) if r.get("event")=="push" and r.get("conclusion")=="success" and r.get("head_branch")=="main"][:a.limit]
    groups=defaultdict(list); missing=[]; valid=0
    with tempfile.TemporaryDirectory(prefix="issue751-") as temp:
        for run in runs:
            run_id=run["id"]
            for shard in range(1,7):
                name="e2e-timing-ci-shard-"+str(shard)
                dest=pathlib.Path(temp)/str(run_id)/str(shard)
                dest.mkdir(parents=True,exist_ok=True)
                try:
                    call("run","download",str(run_id),"--repo",a.repository,"--name",name,"--dir",str(dest))
                    item=json.loads((dest/("e2e-timing-shard-"+str(shard)+".json")).read_text())
                    if (item.get("schemaVersion")!=1 or item.get("runId")!=str(run_id)
                        or item.get("runAttempt")!=run.get("run_attempt") or item.get("headSha")!=run.get("head_sha")
                        or item.get("eventName")!="push" or item.get("status")!="passed"
                        or item.get("shard")!=shard or item.get("shardCount")!=6):
                        raise ValueError("source mismatch")
                    valid+=1
                    env=item.get("environment") or {}
                    for receipt in item.get("receipts") or []:
                        source=receipt.get("source") or {}
                        if (receipt.get("schemaVersion")!=2 or receipt.get("resultStatus")!="passed"
                            or receipt.get("status")!="ok" or source.get("retry")!=0
                            or source.get("checkoutSha")!=run.get("head_sha")):
                            continue
                        for stage in receipt.get("stages",[]):
                            duration=stage.get("durationMs")
                            if stage.get("outcome")!="ok" or not isinstance(duration,(int,float)) or not math.isfinite(duration) or duration<0: continue
                            key=(env.get("os"),env.get("node"),env.get("fullyParallel"),shard,
                                 source.get("project"),source.get("testId"),stage.get("stage"))
                            groups[key].append(duration)
                except (subprocess.CalledProcessError,subprocess.TimeoutExpired,FileNotFoundError,OSError,ValueError,KeyError,TypeError):
                    missing.append({"runId":run_id,"shard":shard,"reason":"MISSING_INVALID_OR_EXPIRED"})
    rows=[]
    for key,values in sorted(groups.items(),key=lambda x:str(x[0])):
        enough=len(values)>=10
        rows.append({"context":list(key),"count":len(values),"p50Ms":pct(values,.5) if enough else None,
                     "p95Ms":pct(values,.95) if enough else None,"status":"OBSERVED" if enough else "INSUFFICIENT_DATA"})
    result={"schemaVersion":1,"warningOnly":True,"runsConsidered":len(runs),"validShardArtifacts":valid,
            "missing":missing,"rows":rows,"minimumSamples":10,"causalAttribution":"NOT TESTED"}
    pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    with open(a.summary,"a",encoding="utf8") as output:
        output.write("## Issue #751 performance trend (warning only)\n\n")
        output.write("- Recent successful main CI runs: "+str(len(runs))+", valid shard artifacts: "+str(valid)+"\n")
        output.write("- Missing/expired/incomplete: "+str(len(missing))+"; never interpret as PASS\n")
        output.write("- Same OS/Node/shard/fullyParallel/stable test ID/stage; minimum 10 successful samples\n")
        for row in rows[:30]:
            output.write("- "+str(row["context"][-1])+": n="+str(row["count"])+", P50="+str(row["p50Ms"])+", P95="+str(row["p95Ms"])+" "+row["status"]+"\n")
        if not rows: output.write("- INSUFFICIENT_DATA\n")

if __name__=="__main__": main()
