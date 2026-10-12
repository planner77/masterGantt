#!/usr/bin/env python3
"""Issue #633 B2 Owner approval, real-first-parent and release-after cleanup tests.

Synthetic fixtures never contact GHCR or mutate GitHub. Old failed Main CI is
never converted to PASS; malformed authority and stale SHA are fail-closed.
"""
import json
import sys
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0,str(Path(__file__).resolve().parent))
import auto_release_finalizer as auto
import release_debt_audit as audit
import release_debt_recovery as b2

def ok(expr,msg):
    if not expr: raise AssertionError(msg)
def blocked(callback,msg):
    try: callback()
    except auto.AutoFinalizerBlocked: return
    raise AssertionError(msg)

old_items=[
    auto.WorkItem(sha, "0"*40 if i==0 else b2.SOURCES[i-1][0],
                  pr,issue,old,new,False)
    for i,(sha,issue,pr,old,new) in enumerate(b2.SOURCES)
]
z=auto.WorkItem("a"*40,old_items[-1].target_sha,630,629,"0.106.0","0.106.0",False)
audit_pr=auto.WorkItem("b"*40,z.target_sha,634,633,"0.106.0","0.106.0",False)
new=auto.WorkItem("c"*40,audit_pr.target_sha,700,633,"0.106.0","0.106.1",False)
chain=[*old_items,z,audit_pr,new]
plan_payload={
"authorized":True,"mode":"B2_RETIRE_BOTH",
"source_550_sha":b2.SOURCES[0][0],"source_615_sha":b2.SOURCES[1][0],
"verified_615_sha":b2.SOURCES[2][0],"verified_550_sha":b2.SOURCES[4][0],
"recovery_issue":633,"recovery_pr":700,"recovery_sha":new.target_sha,
"expected_version":"0.106.1","note":"Owner approves exact B2 retirement and versioned replacement"
}
def comment(payload, *, comment_id=99, login="planner77",association="OWNER"):
    return {"id":comment_id,"user":{"login":login},
            "author_association":association,"html_url":"https://github.com/planner77/masterGantt/issues/633#issuecomment-99",
            "body":"<!-- mastergantt-release-debt-authorization:v2 "
                   +json.dumps(payload,ensure_ascii=False)+" -->"}
def v1(version,approved):
    return {"id":200 if not approved else 50,
            "user":{"login":"planner77"},"author_association":"OWNER",
            "body":"<!-- mastergantt-release-authorization:v1 "
                   +json.dumps({"authorized":approved,"expected_version":version,"note":"version-scoped decision"})+" -->"}
comments={
633:[comment(plan_payload),v1("0.106.1",True)],
550:[v1("0.105.0",False)],
615:[v1("0.106.0",False)],
}
main_ci_results={t.target_sha:(t.pr_number in (628,632,630,634,700),"test-run") for t in chain}
base_states={version:audit.VersionState("ABSENT","ABSENT","ABSENT") for version in
             ("0.105.0","0.106.0","0.106.1")}
def mocked_source(issue):
    return comments.get(issue,[])
api_calls=[]
def mock_gh(path,*,method="GET",fields=None):
    api_calls.append((method,path,fields))
    if path.startswith("/repos/planner77/masterGantt/pulls/"):
        n=int(path.split("/")[-1]); item=next(i for i in chain if i.pr_number==n)
        return {"merged":True,"merge_commit_sha":item.target_sha,
                "base":{"ref":"main"},"head":{"repo":{"full_name":b2.REPO},"ref":f"feature/{n}"}}
    if path.startswith("/repos/planner77/masterGantt/issues/") and method=="GET":
        return {"state":"open"}
    return {}
core=SimpleNamespace(
    AutoFinalizerBlocked=auto.AutoFinalizerBlocked,
    issue_comments=lambda repo,issue:mocked_source(issue),
    select_authorization=auto.select_authorization,
    parse_authorization_marker=auto.parse_authorization_marker,
    exact_main_ci_success=lambda repo,sha:main_ci_results[sha],
    exact_release_state=lambda repo,item:("not-started",None),
    current_main_sha=lambda repo:new.target_sha,
    gh=mock_gh, run=lambda *args,**kw:None,
    write_summary=lambda lines:None,
)
saved_states=audit.version_states
try:
    audit.version_states=lambda repo,versions:{v:base_states[v] for v in versions}
    good=b2.plan_b2(core,b2.REPO,new.target_sha,chain)
    ok(good is not None and good.sha==new.target_sha and
       good.retired_shas==frozenset(row[0] for row in b2.SOURCES),
       "B2 must skip ONLY explicitly authorized exact old merges")
    ok(len(good.previous_items)==5,"cleanup debt must include all five PRs")
    # Incomplete cleanup after the first old Issue closes must be restartable.
    # Arbitrarily closed historical Issues remain blockers without the exact
    # github-actions[bot] immutable RETIRED source/target evidence.
    closed_sources=[
        replace(t,actionable=False) if t.issue_number==550 else t
        for t in chain
    ]
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,closed_sources),
            "closed old Issue without authenticated retirement marker")
    retirement={
        "issue":550,
        "original_shas":[row[0] for row in b2.SOURCES if row[1]==550],
        "original_prs":[row[2] for row in b2.SOURCES if row[1]==550],
        "unissued_version":"0.105.0",
        "replacement_sha":new.target_sha,"replacement_version":b2.VERSION,
        "replacement_digest":"sha256:"+"f"*64,
        "decision_url":"https://github.com/planner77/masterGantt/issues/633#issuecomment-99",
    }
    bot_proof={
        "id":201,"user":{"login":"github-actions[bot]"},
        "author_association":"CONTRIBUTOR",
        "body":"<!-- mastergantt-release-debt-retired:v1 "
               +json.dumps(retirement,sort_keys=True,separators=(",",":"))+" -->",
    }
    comments[550].append(bot_proof)
    recovered=b2.plan_b2(core,b2.REPO,new.target_sha,closed_sources)
    ok(recovered is not None and len(recovered.previous_items)==5,
       "verified partial retirement replay must preserve all old PR obligations")
    comments[550].pop()
    # Default remains unchanged until Owner's explicit v2 scope.
    comments[633]=[v1("0.106.1",True)]
    ok(b2.plan_b2(core,b2.REPO,new.target_sha,chain) is None,
       "missing Owner B2 must never authorize retirement")
    comments[633]=[comment({**plan_payload,"authorized":False}),v1("0.106.1",True)]
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "latest explicit B2 revocation")
    comments[633]=[comment({**plan_payload,"recovery_sha":"d"*40}),v1("0.106.1",True)]
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "stale approved SHA")
    comments[633]=[comment(plan_payload,login="attacker"),v1("0.106.1",True)]
    ok(b2.plan_b2(core,b2.REPO,new.target_sha,chain) is None,
       "foreign owner marker must be ignored")
    comments[633]=[comment(plan_payload),v1("0.106.1",True)]
    comments[550]=[v1("0.105.0",True)]
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "previous publication authorization must be explicitly revoked")
    comments[550]=[v1("0.105.0",False)]
    comments[615]=[v1("0.106.0",True)]
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "other Issue's old-version grant cannot be reused")
    comments[615]=[v1("0.106.0",False)]
    main_ci_results[old_items[0].target_sha]=(True,"unsafe retroactive success")
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "old failed Main CI cannot be silently reinterpreted")
    main_ci_results[old_items[0].target_sha]=(False,"retained failure")
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain+[replace(new,target_sha="e"*40)]),
            "extra source or ambiguous first parent")
    audit.version_states=lambda repo,versions:{
        v:(audit.VersionState("ABSENT","ABSENT","UNKNOWN") if v=="0.105.0" else base_states[v])
        for v in versions
    }
    blocked(lambda:b2.plan_b2(core,b2.REPO,new.target_sha,chain),
            "UNKNOWN registry state must prohibit retirement")
finally:
    audit.version_states=saved_states

ok(not api_calls,"plan must never mutate registry/Issue")
# Positive FINAL requires successful exact new Release and digest identity.
audit.version_states=lambda repo,versions:{
 v:(audit.VersionState("PRESENT","ABSENT","PRESENT","sha256:"+"f"*64)
    if v=="0.106.1" else base_states[v]) for v in versions
}
saved_digest=audit.ghcr_digest
saved_branch=b2._branch_cleanup
saved_candidate=b2._candidate_cleanup
events=[]
try:
    audit.ghcr_digest=lambda name:("PRESENT","sha256:"+"f"*64)
    b2._branch_cleanup=lambda core,repo,item,sha,*,delete:events.append(
        ("branch",item.pr_number,"delete" if delete else "preflight"))
    b2._candidate_cleanup=lambda core,sha,*,delete:events.append(
        ("candidate",sha,"delete" if delete else "preflight"))
    core.exact_release_state=lambda repo,item:("in-progress",None)
    blocked(lambda:b2.finalize_b2(core,b2.REPO,new.target_sha,good),
            "in-progress release can never close historical issues")
    ok(not events and not api_calls,"no premature mutation or cleanup")
    core.exact_release_state=lambda repo,item:("success","https://example.invalid/release")
    b2.finalize_b2(core,b2.REPO,new.target_sha,good)
    ok(sum(x[0]=="branch" and x[-1]=="preflight" for x in events)==5 and
       sum(x[0]=="branch" and x[-1]=="delete" for x in events)==5,
       "safe branch preflight + delete required for every historical PR")
    ok(sum(x[0]=="candidate" and x[-1]=="preflight" for x in events)==2 and
       sum(x[0]=="candidate" and x[-1]=="delete" for x in events)==2,
       "two verified old candidates must be safely cleaned after new release")
    ok(sum(x[0]=="PATCH" and x[1].endswith(("/550","/615")) for x in api_calls)==2,
       "only old Issues close after new Release, no earlier")
    ok(sum(x[0]=="POST" and x[1].endswith("/comments") for x in api_calls)==2,
       "separate immutable retirement audit evidence for each old Issue")
    ok(all(x[0]!="DELETE" for x in api_calls),
       "no direct tag/ref/image write bypass in old Issue audit")
finally:
    audit.version_states=saved_states
    audit.ghcr_digest=saved_digest
    b2._branch_cleanup=saved_branch
    b2._candidate_cleanup=saved_candidate
print("Issue #633 B2 exact Owner/CI/GHCR/cleanup fixtures: PASS")
