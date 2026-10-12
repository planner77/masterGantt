#!/usr/bin/env python3
"""Issue #633 B2: explicitly retire TWO unissued releases, never a failed CI.

This module is *only* invoked by the trusted main generic first-parent
Finalizer. Absence of an authenticated Owner marker is a no-op. No retirement
or Issue closure is allowed before the replacement SemVer release succeeded.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any

import release_debt_audit as audit

REPO = "planner77/masterGantt"
OWNER = "planner77"
ISSUE = 633
VERSION = "0.106.1"
# Immutable historical first-parent identity; NEVER reconstruct from PR titles.
SOURCES = (
    ("40747252c389f2a4d1203a2262a4caa49c90728d", 550, 559, "0.104.4", "0.105.0"),
    ("c8949da48e7465db45d871887c3f55f9fb6dc743", 615, 627, "0.105.0", "0.106.0"),
    ("6eaec3331fcbc720ab42106789a505c5ee5eefb4", 615, 628, "0.106.0", "0.106.0"),
    ("e51b99cb25f37c8909de356a089a56b4139415a3", 550, 626, "0.106.0", "0.106.0"),
    ("d69749753fb9db002232d92d51446237a0fe042d", 550, 632, "0.106.0", "0.106.0"),
)
RECOVERY_MARKER = re.compile(
    r"<!--\s*mastergantt-release-debt-authorization:v2\s+({.*?})\s*-->", re.S
)
RETIRED_MARKER = re.compile(
    r"<!--\s*mastergantt-release-debt-retired:v1\s+({.*?})\s*-->", re.S
)
MARKER_FIELDS = frozenset((
    "authorized", "mode", "source_550_sha", "source_615_sha",
    "verified_615_sha", "verified_550_sha", "recovery_issue",
    "recovery_pr", "recovery_sha", "expected_version", "note",
))


@dataclass(frozen=True)
class Plan:
    sha: str
    pr: int
    marker_url: str
    previous_items: tuple[Any, ...]
    target: Any

    @property
    def retired_shas(self) -> frozenset[str]:
        return frozenset(row[0] for row in SOURCES)


def require(core: Any, valid: bool, reason: str) -> None:
    if not valid:
        raise core.AutoFinalizerBlocked("Issue #633 B2 fail-closed: " + reason)


def authenticated_comments(core: Any, repo: str, issue: int) -> list[dict[str, Any]]:
    return [
        c for c in core.issue_comments(repo, issue)
        if c.get("author_association") == "OWNER"
        and ((c.get("user") or {}).get("login")) == OWNER
    ]


def read_approval(core: Any, repo: str, latest_main: str) -> dict[str, Any] | None:
    """Only the last OWNER v2 decision with an immutable main SHA has authority."""
    trusted = authenticated_comments(core, repo, ISSUE)
    found: list[tuple[int, dict[str, Any], str]] = []
    for c in trusted:
        matches = RECOVERY_MARKER.findall(c.get("body") or "")
        require(core, len(matches) <= 1, "중복 Owner B2 marker")
        if not matches:
            continue
        try:
            payload = json.loads(matches[0])
        except (TypeError, ValueError) as exc:
            raise core.AutoFinalizerBlocked("Issue #633 B2 Owner JSON 손상") from exc
        require(core, isinstance(payload, dict) and set(payload) == MARKER_FIELDS,
                "B2 Owner marker schema 누락/추가")
        require(core, type(payload["authorized"]) is bool, "authorized boolean 필요")
        require(core, payload["mode"] == "B2_RETIRE_BOTH", "B2 이외의 전략 거절")
        for key in ("source_550_sha","source_615_sha","verified_615_sha",
                    "verified_550_sha","recovery_sha"):
            require(core, isinstance(payload[key], str) and
                    re.fullmatch(r"[0-9a-f]{40}", payload[key]) is not None,
                    f"{key} full SHA 필요")
        require(core, type(payload["recovery_issue"]) is int
                and payload["recovery_issue"] == ISSUE, "Issue 번호 불일치")
        require(core, type(payload["recovery_pr"]) is int
                and payload["recovery_pr"] > 0, "교정 PR 번호 불일치")
        require(core, payload["expected_version"] == VERSION, "버전 불일치")
        require(core, isinstance(payload["note"], str) and len(payload["note"].strip()) >= 20,
                "정확한 폐기·승계 승인 사유 필요")
        require(core, payload["source_550_sha"] == SOURCES[0][0] and
                payload["source_615_sha"] == SOURCES[1][0] and
                payload["verified_615_sha"] == SOURCES[2][0] and
                payload["verified_550_sha"] == SOURCES[4][0],
                "원본/교정 SHA 불변 원장 불일치")
        number = c.get("id")
        require(core, type(number) is int and number > 0, "Owner comment ID가 없음")
        found.append((number,payload,str(c.get("html_url") or "")))
    if not found:
        return None
    _n, selected, url = max(found, key=lambda v: v[0])
    require(core, selected["authorized"], "최신 B2 승인 철회")
    require(core, selected["recovery_sha"] == latest_main,
            "B2 승인 대상 main SHA와 현재 HEAD 불일치")
    return {**selected, "evidence_url":url}


def require_revoked(core: Any, repo: str, issue: int, version: str) -> None:
    """A publication grant is NEVER an authorization to abandon a release."""
    relevant = []
    for c in authenticated_comments(core,repo,issue):
        marker = core.parse_authorization_marker(c.get("body") or "")
        if marker and marker["expected_version"] == version:
            relevant.append((int(c["id"]),marker))
    require(core, bool(relevant), f"Issue #{issue} v{version} Owner release 원장 없음")
    last = max(relevant,key=lambda row:row[0])[1]
    require(core, last["authorized"] is False,
            f"Issue #{issue} v{version} 릴리스 승인 철회(authorized=false)가 필요")


def exact_first_parent(core: Any, items: list[Any]) -> list[Any]:
    indexed={item.target_sha:item for item in items}
    require(core, len(indexed)==len(items), "first-parent 중복 SHA")
    expected=[]
    for sha,issue,pr,previous,current in SOURCES:
        item=indexed.get(sha)
        require(core, item is not None and item.issue_number==issue
                and item.pr_number==pr and item.previous_version==previous
                and item.current_version==current and not item.validation_docs_only
                and item.actionable, f"원본 SHA/Issue/PR/version 구간 변조: {sha}")
        expected.append(item)
    same_issues=[item for item in items if item.issue_number in {550,615}]
    require(core,[item.target_sha for item in same_issues]==[t[0] for t in SOURCES],
            "과거 #550/#615의 추가 merge 또는 변경된 순서")
    # No cross-Issue automatic supersession of version-changing failed targets.
    return expected


def plan_b2(core: Any, repo: str, latest_main: str, pending_raw: list[Any]) -> Plan | None:
    if repo != REPO:
        raise core.AutoFinalizerBlocked("B2 복구 허용 저장소가 아님")
    marker=read_approval(core,repo,latest_main)
    if marker is None:
        return None
    originals=exact_first_parent(core,pending_raw)
    current=[w for w in pending_raw if w.target_sha==latest_main]
    require(core,len(current)==1,"B2 교정 merge는 현재 main의 first-parent여야 함")
    target=current[0]
    require(core,target.issue_number==ISSUE and
            target.pr_number==marker["recovery_pr"] and
            target.current_version==VERSION and
            target.previous_version=="0.106.0" and
            target.release_required and not target.validation_docs_only and
            target.actionable,"별도 검증된 version-bump PR/SHA 필요")
    require(core,marker["recovery_sha"]==target.target_sha,"B2 릴리스 SHA 불일치")
    require(core,target.target_sha not in [row[0] for row in SOURCES],
            "복구 SHA와 과거 SHA 동일")
    require(core,all(item.current_version=="0.106.0" and
                item.previous_version=="0.106.0"
                for item in pending_raw[pending_raw.index(originals[-1])+1:-1]),
            "과거 수정과 새 교정 사이에 다른 버전 변경 존재")

    require_revoked(core,repo,550,"0.105.0")
    require_revoked(core,repo,615,"0.106.0")
    current_owner=core.select_authorization(core.issue_comments(repo,ISSUE),
                                            expected_version=VERSION)
    require(core,current_owner is not None and current_owner.actor==OWNER,
            "Issue #633 새 SemVer Owner release 승인 없음")
    for item in originals:
        successful,_url=core.exact_main_ci_success(repo,item.target_sha)
        if item.pr_number in (559,627,626):
            require(core,not successful,
                    "과거 실패 SHA에 새 success evidence가 있어 복구 재판정 필요")
        else:
            require(core,successful, "기존 성공한 교정 SHA의 Main CI 증거 누락")
    success,_run=core.exact_main_ci_success(repo,target.target_sha)
    require(core,success, "B2 교정 SHA의 Main CI SUCCESS 미확인")

    states=audit.version_states(repo,{"0.105.0","0.106.0",VERSION})
    for version in ("0.105.0","0.106.0"):
        state=states[version]
        require(core,state.git_tag==state.github_release==state.ghcr_tag=="ABSENT",
                f"v{version}은 Git tag / GitHub Release / GHCR가 전부 ABSENT여야 함")
    release_state,_=core.exact_release_state(repo,target)
    proposed=states[VERSION]
    if release_state=="not-started":
        require(core,proposed.git_tag==proposed.github_release==proposed.ghcr_tag=="ABSENT",
                "새 SemVer가 승인된 dispatch 전에 이미 사용됨")
    elif release_state=="success":
        require(core,proposed.git_tag=="PRESENT" and
                proposed.ghcr_tag=="PRESENT" and
                bool(proposed.ghcr_digest),"Release 성공 후 exact tag/digest 필요")
    else:
        require(core, release_state in {"tagged","in-progress"},
                f"새 릴리스 상태가 복구 불가능: {release_state}")
    return Plan(sha=target.target_sha,pr=target.pr_number,
                marker_url=marker["evidence_url"],
                previous_items=tuple(originals),target=target)


def _branch_cleanup(core: Any, repo: str, item: Any, current_sha: str,
                    *, delete: bool) -> None:
    pr=core.gh(f"/repos/{repo}/pulls/{item.pr_number}")
    require(core,pr.get("merged") and pr.get("merge_commit_sha")==item.target_sha
            and ((pr.get("base") or {}).get("ref"))=="main"
            and ((pr.get("head") or {}).get("repo") or {}).get("full_name")==repo,
            "수동 복구 대상 PR identity 불일치")
    branch=((pr.get("head") or {}).get("ref") or "")
    require(core,bool(branch),"후속 cleanup 브랜치 ID 없음")
    cmd=("python3","scripts/safe_branch_cleanup.py","--repo",repo,
         "--pr",str(item.pr_number),"--branch",branch,
         "--target-sha",current_sha)
    core.run(*cmd,*(() if not delete else ("--delete",)))


def _candidate_cleanup(core: Any, merge_sha: str, *, delete: bool) -> None:
    env=os.environ.copy()
    env.update({"GHCR_OWNER_TYPE":"User","GHCR_PACKAGE_NAME":"mastergantt"})
    core.run("node","scripts/delete-ghcr-package-version-by-tag.mjs",
             f"ci-{merge_sha}",*(("--check-only",) if not delete else ()),env=env)


def finalize_b2(core: Any, repo: str, latest_main: str, plan: Plan) -> None:
    """After EXACT new release success: cleanup, immutable retirement, close.

    Cannot run early, even if the Owner marker is valid. If cleanup fails,
    leave old Issues open and retry idempotently (never rewrite old CI).
    """
    require(core,repo==REPO and latest_main==plan.sha,
            "B2 Finalize는 approved current main에만 가능")
    state,_url=core.exact_release_state(repo,plan.target)
    require(core,state=="success","신규 릴리스의 정확한 성공 실행 결과 필요")
    versions=audit.version_states(repo,{"0.105.0","0.106.0",VERSION})
    for version in ("0.105.0","0.106.0"):
        value=versions[version]
        require(core,value.git_tag==value.github_release==value.ghcr_tag=="ABSENT",
                f"퇴역 후에도 기존 버전 v{version}은 미발행이어야 함")
    new=versions[VERSION]
    require(core,new.git_tag=="PRESENT" and new.ghcr_tag=="PRESENT"
            and audit.DIGEST_RE.fullmatch(new.ghcr_digest or "") is not None,
            "신규 정식 GHCR digest 미확인")
    candidate, digest=audit.ghcr_digest(
        f"ghcr.io/{repo.lower()}:ci-{plan.sha}"
    )
    require(core,candidate=="PRESENT" and digest==new.ghcr_digest,
            "새 정식 이미지가 Main 검증 후보 digest와 다름")
    require(core,core.current_main_sha(repo)==plan.sha,
            "retirement 처리 중 main SHA 이동")

    # Every known branch and old verified candidate must preflight before
    # any destructive operation. Never treat failed CI as green.
    for item in plan.previous_items:
        _branch_cleanup(core,repo,item,plan.sha,delete=False)
    for item in plan.previous_items:
        if item.pr_number in (628,632):
            _candidate_cleanup(core,item.target_sha,delete=False)

    for item in plan.previous_items:
        require(core,core.current_main_sha(repo)==plan.sha,
                "branch cleanup 중 main 변경")
        _branch_cleanup(core,repo,item,plan.sha,delete=True)
    for item in plan.previous_items:
        if item.pr_number in (628,632):
            require(core,core.current_main_sha(repo)==plan.sha,
                    "candidate cleanup 중 main 변경")
            _candidate_cleanup(core,item.target_sha,delete=True)

    for issue in (550,615):
        original=[i for i in plan.previous_items if i.issue_number==issue]
        proof={
            "issue":issue, "original_shas":[i.target_sha for i in original],
            "original_prs":[i.pr_number for i in original],
            "unissued_version":"0.105.0" if issue==550 else "0.106.0",
            "replacement_sha":plan.sha,"replacement_version":VERSION,
            "replacement_digest":new.ghcr_digest,
            "decision_url":plan.marker_url,
        }
        marker="<!-- mastergantt-release-debt-retired:v1 "+json.dumps(
            proof,sort_keys=True,separators=(",",":"))+" -->"
        existing=[]
        for c in core.issue_comments(repo,issue):
            if RETIRED_MARKER.search(c.get("body") or ""):
                require(core,(c.get("user") or {}).get("login")=="github-actions[bot]",
                        "퇴역 완료 증거의 작성자 불일치")
                existing.append(c.get("body") or "")
        require(core,len(existing)<=1 and (not existing or marker in existing[0]),
                "퇴역 완료 증거 충돌")
        if not existing:
            core.gh(f"/repos/{repo}/issues/{issue}/comments",method="POST",
                fields={"body":"\n".join((
                    marker, f"## Release debt RETIRED · Issue #{issue}",
                    "",
                    "- 이전 Main CI 실패 기록: FAIL 그대로 보존",
                    "- 과거 SemVer 정식 발행: 의도적으로 수행하지 않음",
                    f"- 신규 검증 release: v{VERSION} / {plan.sha}",
                    f"- verified GHCR digest: {new.ghcr_digest}",
                    f"- Owner version-scoped B2 decision: {plan.marker_url}",
                    "- 원본/교정 PR 브랜치 cleanup: PASS",
                    "- 기존 verified ci-SHA candidate cleanup: PASS (해당 시)",
                    "- original FINAL marker 위장 없음",
                ))})
        require(core,core.current_main_sha(repo)==plan.sha,"Issue 종료 중 main 이동")
        existing_issue=core.gh(f"/repos/{repo}/issues/{issue}")
        if existing_issue.get("state")!="closed":
            require(core,existing_issue.get("state")=="open","미상 Issue state")
            core.gh(f"/repos/{repo}/issues/{issue}",method="PATCH",
                    fields={"state":"closed","state_reason":"completed"})
    core.write_summary([
        "### B2 미발행 원장 정리 PASS",
        f"- 신규 정식 Release: v{VERSION} / {plan.sha}",
        f"- exact digest: {new.ghcr_digest}",
        "- v0.105.0 및 v0.106.0: 불변 실패·미발행 기록 보존",
        "- #550/#615: RETIRED 증거/안전 정리/종료 확인",
    ])
