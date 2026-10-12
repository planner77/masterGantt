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
    return audit.assess(chain,ev,states,source_comments if source_comments is not None else [],
        successor_comments if successor_comments is not None else [auth],
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
blocked(lambda:check(chain=[a,b,c,replace(d,actionable=False),e]),"closed non-actionable barrier")
blocked(lambda:check(chain=[a,b,replace(c,issue_number=999),d,e]),"foreign correction Issue")
blocked(lambda:check(chain=[a,b,replace(c,current_version="0.107.0"),d,e]),"version change")
require(audit.semver("0.106.1")>audit.semver("0.106.0"),"SemVer comparison")
blocked(lambda:audit.semver("0.106.01"),"leading zero")
require(audit.owner_debt_decision([],owner_login="planner77",expected={})[0] is False,"no owner")

# Issue #633 P1: v-prefix is only for annotated Git and GitHub Release;
# Docker publishes exact unprefixed SemVer, even for private GHCR packages.
from types import SimpleNamespace
saved_registry = (audit.ghcr_digest, audit.git_tag_state, auto.gh_paginated)
inspected_images = []
def fake_registry_inspect(image):
    inspected_images.append(image)
    if image.endswith(":0.105.0"):
        return "PRESENT", "sha256:"+"f"*64
    return "ABSENT", None
try:
    audit.ghcr_digest = fake_registry_inspect
    audit.git_tag_state = lambda version: "ABSENT"
    auto.gh_paginated = lambda route: []
    observed = audit.version_states("planner77/masterGantt", {"0.106.0", "0.105.0"})
    require(inspected_images == [
        "ghcr.io/planner77/mastergantt:0.105.0",
        "ghcr.io/planner77/mastergantt:0.106.0",
    ], "GHCR exact tags must omit v-prefix and follow semantic version order")
    require(observed["0.105.0"].ghcr_digest == "sha256:"+"f"*64,
            "exact existing private-package tag must preserve immutable digest")
    blocked(lambda:check(states=observed), "published old exact GHCR image must block retirement")
finally:
    audit.ghcr_digest, audit.git_tag_state, auto.gh_paginated = saved_registry

saved_inspect_run = audit.subprocess.run
saved_registry_inventory = audit.authenticated_packages_tag_state
inspect_image = "ghcr.io/planner77/mastergantt:0.105.0"
audit.authenticated_packages_tag_state = lambda name: "UNKNOWN"
def fake_run_for_inspect(returncode, stdout, stderr):
    def invoke(args, **kwargs):
        require(args == ["docker", "buildx", "imagetools", "inspect", inspect_image],
                "read-only digest inspection must use exact tag")
        return SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)
    return invoke
try:
    audit.subprocess.run = fake_run_for_inspect(
        0, "Name: ghcr.io/planner77/mastergantt:0.105.0\nDigest: sha256:"+"a"*64+"\n", "")
    require(audit.ghcr_digest(inspect_image) == ("PRESENT", "sha256:"+"a"*64),
            "successful exact digest inspection must report PRESENT")
    audit.subprocess.run = fake_run_for_inspect(
        1, "", "ERROR: unauthorized: authentication required")
    require(audit.ghcr_digest(inspect_image)[0] == "UNKNOWN",
            "unauthenticated private GHCR image cannot be deemed absent")
    audit.subprocess.run = fake_run_for_inspect(1, "", "HTTP 404 Not Found")
    require(audit.ghcr_digest(inspect_image)[0] == "UNKNOWN",
            "ambiguous HTTP 404 cannot prove immutable image absence")
    audit.authenticated_packages_tag_state = lambda image: "ABSENT"
    require(audit.ghcr_digest(inspect_image) == ("ABSENT",None),
            "authenticated complete Packages inventory may prove absent tag")
    audit.authenticated_packages_tag_state = lambda image: "PRESENT"
    require(audit.ghcr_digest(inspect_image) == ("PRESENT",None),
            "published exact tag without digest is never absent")
    audit.authenticated_packages_tag_state = lambda image: "UNKNOWN"
    audit.subprocess.run = fake_run_for_inspect(1, "", "manifest unknown: manifest unknown")
    require(audit.ghcr_digest(inspect_image)[0] == "ABSENT",
            "explicit registry manifest-unknown may prove no tag after trusted login")
    audit.subprocess.run = fake_run_for_inspect(
        1, "", "unauthorized: manifest unknown")
    require(audit.ghcr_digest(inspect_image)[0] == "UNKNOWN",
            "authentication failure overrides ambiguous manifest-unknown text")
finally:
    audit.subprocess.run = saved_inspect_run
    audit.authenticated_packages_tag_state = saved_registry_inventory
import json

# GitHub Packages REST inventory: only a complete, authenticated 200 JSON
# page sequence can prove private GHCR's exact SemVer tag absent.
calls=[]
def pages(values):
    def run(args,**kwargs):
        require(args[:4]==["gh","api","-H","Accept: application/vnd.github+json"],
                "GHCR inventory must use authenticated gh api")
        require("/users/planner77/packages/container/mastergantt/versions?" in args[4],
                "inventory must target exact GHCR owner/container package")
        calls.append(args[4])
        page=int(args[4].split("page=")[-1])
        rc,payload=values.get(page,(1,"Unauthorized"))
        return SimpleNamespace(returncode=rc,stdout=payload,stderr="")
    return run
def package_version(tags):
    return {"metadata":{"container":{"tags":tags}}}
saved_run=audit.subprocess.run
try:
    audit.subprocess.run=pages({1:(0,json.dumps([package_version(["ci-existing"])]))})
    require(audit.authenticated_packages_tag_state(inspect_image)=="ABSENT",
            "successful complete listing without exact tag is ABSENT")
    calls.clear()
    audit.subprocess.run=pages({1:(0,json.dumps([package_version([inspect_image.split(":")[-1])]))})
    require(audit.authenticated_packages_tag_state(inspect_image)=="PRESENT",
            "known tag in Packages API cannot be deemed absent")
    audit.subprocess.run=pages({1:(1,"404 package read denied")})
    require(audit.authenticated_packages_tag_state(inspect_image)=="UNKNOWN",
            "404 from package list may be authorization or missing package")
    audit.subprocess.run=pages({1:(0,'{"message":"bad schema"}')})
    require(audit.authenticated_packages_tag_state(inspect_image)=="UNKNOWN",
            "malformed data cannot prove package absence")
    audit.subprocess.run=pages({1:(0,json.dumps([{"metadata": {}}]))})
    require(audit.authenticated_packages_tag_state(inspect_image)=="UNKNOWN",
            "untrusted missing tag metadata cannot prove absence")
    audit.subprocess.run=pages({1:(0,json.dumps([package_version([])]*100)),
                                    2:(0,json.dumps([package_version(["ci-next"])]))})
    require(audit.authenticated_packages_tag_state(inspect_image)=="ABSENT",
            "all pages must be checked before recording absence")
    require(any("page=2" in url for url in calls),
            "pagination must advance beyond first full page")
    audit.subprocess.run=pages({1:(0,json.dumps([package_version([])]*100)),
                                    2:(1,"403 token scope")})
    require(audit.authenticated_packages_tag_state(inspect_image)=="UNKNOWN",
            "mid-pagination 403 must not establish absence")
    require(audit.authenticated_packages_tag_state("ghcr.io/other/repo:0.105.0")=="UNKNOWN",
            "inventory may not be reused for another repository")
finally:
    audit.subprocess.run=saved_run

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
