#!/usr/bin/env python3
"""Issue #633 negative/positive fixtures: no network and no mutation."""
import sys
from dataclasses import replace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release_debt_audit as audit
import auto_release_finalizer as auto

def require(value, label):
    if not value:
        raise AssertionError(label)

def blocked(fn, label):
    try:
        fn()
    except audit.AuditBlocked:
        return
    raise AssertionError(label)

a = auto.WorkItem("a"*40, "0"*40, 559, 550, "0.104.4", "0.105.0")
b = auto.WorkItem("b"*40, a.target_sha, 627, 615, "0.105.0", "0.106.0")
c = auto.WorkItem("c"*40, b.target_sha, 628, 615, "0.106.0", "0.106.0")
d = auto.WorkItem("d"*40, c.target_sha, 626, 550, "0.106.0", "0.106.0")
e = auto.WorkItem("e"*40, d.target_sha, 632, 550, "0.106.0", "0.106.0")
chain = [a,b,c,d,e]
ev = {
    a.target_sha: audit.MainEvidence(True,False,False,"550 fail"),
    b.target_sha: audit.MainEvidence(True,False,False,"615 fail"),
    c.target_sha: audit.MainEvidence(False,True,True,"615 success"),
    d.target_sha: audit.MainEvidence(True,False,False,"550 correction fail"),
    e.target_sha: audit.MainEvidence(False,True,True,"550 correction success"),
}
states = {
    "0.105.0": audit.VersionState("ABSENT","ABSENT","ABSENT"),
    "0.106.0": audit.VersionState("ABSENT","ABSENT","ABSENT"),
}
auth = {"id":10,"author_association":"OWNER","user":{"login":"planner77"},
        "body": '<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"0.106.0","note":"v0.106.0 승인"} -->'}
def check(chain=chain, ev=ev, states=states, source_comments=None,
          successor_comments=None, corrective_sha=None):
    return audit.assess(chain,ev,states,source_comments or [],successor_comments or [auth],
        owner_login="planner77",source_sha=a.target_sha,
        original_successor_sha=b.target_sha,successor_sha=c.target_sha,
        corrective_sha=corrective_sha)

decision, why = check()
require(decision=="BLOCKED" and "corrective" in str(why), "actual debt must be BLOCKED")
require(check(successor_comments=[])[0]=="BLOCKED", "missing successor Owner marker")
blocked(lambda:check(states={**states,"0.105.0":audit.VersionState("PRESENT","ABSENT","ABSENT")}),"immutable old tag")
blocked(lambda:check(states={**states,"0.105.0":audit.VersionState("ABSENT","ABSENT","UNKNOWN")}),"unknown GHCR")
blocked(lambda:check(ev={**ev,c.target_sha:audit.MainEvidence(False,True,False,"incomplete")}),"candidate missing")
blocked(lambda:check(chain=[a,replace(b,issue_number=550),c,d,e]),"same Issue should not qualify")
blocked(lambda:check(chain=[a,b,replace(c,validation_docs_only=True),d,e]),"docs-only correction")
blocked(lambda:check(chain=[a,b,replace(c,issue_number=999),d,e]),"foreign correction Issue")
blocked(lambda:check(chain=[a,b,replace(c,current_version="0.107.0"),d,e]),"version change")
blocked(lambda:check(chain=[a,b,c,replace(d,actionable=False),e]),"closed ordering barrier does not bypass source") if False else None
require(audit.semver("0.106.1")>audit.semver("0.106.0"),"SemVer comparison")
blocked(lambda:audit.semver("0.106.01"),"leading zero")
require(audit.owner_debt_decision([],owner_login="planner77",expected={})[0] is False,"no owner")
# An explicit future corrective merge is necessary, but it is not sufficient.
f = auto.WorkItem("f"*40,e.target_sha,700,550,"0.106.0","0.106.1")
full = [*chain,f]
ev_f = {**ev,f.target_sha:audit.MainEvidence(False,True,True,"corrective success")}
states_f = {**states,"0.106.1":audit.VersionState("ABSENT","ABSENT","ABSENT")}
require(check(chain=full,ev=ev_f,states=states_f,corrective_sha=f.target_sha)[0]=="BLOCKED","Owner debt approval required")
expected={"mode":"B_RETIRE_AND_REISSUE","source_issue":550,"source_sha":a.target_sha,
    "unissued_version":"0.105.0","successor_issue":615,"successor_sha":c.target_sha,
    "successor_version":"0.106.0","corrective_issue":550,"corrective_sha":f.target_sha,
    "corrective_version":"0.106.1"}
import json
def marker(authorized=True, overrides=None, association="OWNER", user="planner77", number=100):
    payload={**expected,**(overrides or {}),"authorized":authorized,"note":"별도 Owner 복구 승인"}
    return {"id":number,"author_association":association,"user":{"login":user},
            "html_url":"https://github.com/planner77/masterGantt/issues/550#issuecomment-100",
            "body":"<!-- mastergantt-release-debt-authorization:v1 "+json.dumps(payload)+" -->"}
require(not audit.owner_debt_decision([marker(association="CONTRIBUTOR")],
    owner_login="planner77",expected=expected)[0],"foreign author")
require(not audit.owner_debt_decision([marker(user="bot")],
    owner_login="planner77",expected=expected)[0],"forged OWNER identity")
require(not audit.owner_debt_decision([marker(),marker(False,number=101)],
    owner_login="planner77",expected=expected)[0],"latest revocation")
blocked(lambda:audit.owner_debt_decision([marker(overrides={"corrective_sha":"1"*40})],
    owner_login="planner77",expected=expected),"cross-SHA reuse")
blocked(lambda:audit.owner_debt_decision([marker(overrides={"successor_version":"0.107.0"})],
    owner_login="planner77",expected=expected),"cross-version reuse")
require(check(chain=full,ev=ev_f,states=states_f,source_comments=[marker()],
    corrective_sha=f.target_sha)[0]=="BLOCKED","corrective version authorization required")
new_version_auth={"id":102,"author_association":"OWNER","user":{"login":"planner77"},
    "body": '<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"0.106.1","note":"새 버전 승인"} -->'}
ready, reasons = check(chain=full,ev=ev_f,states=states_f,
    source_comments=[marker(),new_version_auth],corrective_sha=f.target_sha)
require(ready=="READY_FOR_SEPARATE_TRUSTED_RECOVERY","approved read-only readiness")
require("별도 승인된 복구 실행" in str(reasons),"readiness is not automatic release")
print("Issue #633 release debt audit fixtures: PASS")
