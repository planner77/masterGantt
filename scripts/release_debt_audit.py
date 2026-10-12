#!/usr/bin/env python3
"""Read-only, main-trusted audit for an interleaved unissued release debt.

This tool does not retire a version, transfer release authority, create tags,
dispatch workflows, modify GHCR, finalize issues or clean branches. A positive
decision is only a precondition for a separately reviewed recovery operation.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

import auto_release_finalizer as finalizer
import issue_lifecycle as lifecycle

SHA_RE = re.compile(r"^[a-f0-9]{40}$")
SEMVER_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
DECISION_MARKER_RE = re.compile(
    r"<!--\s*mastergantt-release-debt-authorization:v1\s+({.*?})\s*-->",
    re.DOTALL,
)
DECISION_FIELDS = {
    "authorized", "mode", "source_issue", "source_sha", "unissued_version",
    "successor_issue", "successor_sha", "successor_version",
    "corrective_issue", "corrective_sha", "corrective_version", "note",
}


class AuditBlocked(RuntimeError):
    pass


@dataclass(frozen=True)
class VersionState:
    git_tag: str
    github_release: str
    ghcr_tag: str
    ghcr_digest: str | None = None


@dataclass(frozen=True)
class MainEvidence:
    completed_failure: bool
    success: bool
    verified_candidate: bool
    url: str | None


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AuditBlocked(message)


def semver(value: str) -> tuple[int, int, int]:
    match = SEMVER_RE.fullmatch(value)
    if not match:
        raise AuditBlocked(f"유효하지 않은 exact application SemVer: {value!r}")
    return tuple(int(part) for part in match.groups())


def owner_debt_decision(
    comments: list[dict[str, Any]],
    *,
    owner_login: str,
    expected: dict[str, Any],
) -> tuple[bool, str]:
    """Latest exact source/version OWNER marker wins; no cross-version reuse.

    Foreign Issue versions are ignored, but a marker referring to this exact
    failed SHA/version with any changed target identity is a hard error.
    """
    matches: list[tuple[int, bool, str]] = []
    for comment in comments:
        if comment.get("author_association") != "OWNER":
            continue
        if ((comment.get("user") or {}).get("login") or "") != owner_login:
            continue
        bodies = DECISION_MARKER_RE.findall(comment.get("body") or "")
        if len(bodies) > 1:
            raise AuditBlocked("하나의 Owner comment에 복구 marker가 둘 이상 있습니다")
        if not bodies:
            continue
        try:
            payload = json.loads(bodies[0])
        except (ValueError, TypeError) as exc:
            raise AuditBlocked("Owner 복구 marker JSON이 손상되었습니다") from exc
        if not isinstance(payload, dict) or set(payload) != DECISION_FIELDS:
            raise AuditBlocked("Owner 복구 marker 필드가 누락/추가되었습니다")
        if not isinstance(payload["authorized"], bool):
            raise AuditBlocked("authorized는 true/false boolean이어야 합니다")
        if not isinstance(payload["note"], str) or not payload["note"].strip():
            raise AuditBlocked("Owner 승인/철회 사유(note)가 필요합니다")
        if not all(isinstance(payload[key], int) and payload[key] > 0
                   for key in ("source_issue", "successor_issue", "corrective_issue")):
            raise AuditBlocked("Issue 번호 형식이 올바르지 않습니다")
        for key in ("source_sha", "successor_sha", "corrective_sha"):
            if not isinstance(payload[key], str) or not SHA_RE.fullmatch(payload[key]):
                raise AuditBlocked(f"Owner marker의 {key}는 full immutable SHA여야 합니다")
        for key in ("unissued_version", "successor_version", "corrective_version"):
            if not isinstance(payload[key], str):
                raise AuditBlocked(f"{key}은 exact SemVer여야 합니다")
            semver(payload[key])

        if (payload["source_sha"], payload["unissued_version"]) != (
            expected["source_sha"], expected["unissued_version"]
        ):
            continue  # Other version/source decisions cannot authorize this debt.
        for key, value in expected.items():
            if payload.get(key) != value:
                raise AuditBlocked(f"Owner marker가 검증 대상 {key}과 다릅니다")
        require(payload["mode"] == "B_RETIRE_AND_REISSUE", "유효하지 않은 복구 전략")
        number = comment.get("id")
        require(isinstance(number, int) and number > 0, "Owner comment ID가 없습니다")
        matches.append((
            number, payload["authorized"], str(comment.get("html_url") or "")
        ))

    if not matches:
        return False, "별도 Owner B_RETIRE_AND_REISSUE 승인 marker 없음"
    _number, authorized, url = max(matches, key=lambda item: item[0])
    if not authorized:
        return False, "최신 Owner marker에서 복구 승인을 철회함"
    return True, url or "Owner-authenticated Issue comment"


def assess(
    chain: list[finalizer.WorkItem],
    ci: dict[str, MainEvidence],
    states: dict[str, VersionState],
    source_comments: list[dict[str, Any]],
    successor_comments: list[dict[str, Any]],
    *,
    owner_login: str,
    source_sha: str,
    original_successor_sha: str,
    successor_sha: str,
    corrective_sha: str | None,
) -> tuple[str, list[str]]:
    """Fail-closed recovery readiness; never changes a release/lifecycle state."""
    reasons: list[str] = []
    by_sha = {item.target_sha: item for item in chain}
    require(len(by_sha) == len(chain), "first-parent 원장에 중복 SHA가 있습니다")
    for sha in (source_sha, original_successor_sha, successor_sha):
        require(sha in by_sha, f"first-parent 원장에 필수 merge SHA가 없습니다: {sha}")
    source, original, successor = (
        by_sha[source_sha], by_sha[original_successor_sha], by_sha[successor_sha]
    )
    indices = {item.target_sha: index for index, item in enumerate(chain)}
    require(indices[source_sha] < indices[original_successor_sha] < indices[successor_sha],
            "source → 다른 Issue → same-Issue corrective 순서가 아닙니다")
    require(source.issue_number != original.issue_number,
            "교차 Issue 릴리스 부채가 아닙니다")
    require(all(item.issue_number != source.issue_number for item in
                chain[indices[source_sha]+1:indices[original_successor_sha]+1]),
            "source와 후속 release 사이의 다른 merge가 원장에 존재합니다")
    require(source.current_version == original.previous_version,
            "실패 버전과 후속 release baseline이 다릅니다")
    require(original.issue_number == successor.issue_number,
            "중간 Release와 교정 PR은 동일 Issue여야 합니다")
    require(all(item.issue_number == original.issue_number and
                not item.validation_docs_only and
                item.current_version == successor.current_version and
                item.previous_version == successor.current_version
                for item in chain[indices[original_successor_sha]+1:indices[successor_sha]+1]),
            "후속 Release의 교정 구간에 다른 Issue/버전/docs-only가 있습니다")
    require(original.current_version == successor.current_version
            and successor.previous_version == successor.current_version,
            "후속 교정의 immutable version이 바뀌었습니다")
    require(not any(item.validation_docs_only for item in (source, original, successor)),
            "릴리스 대응 merge가 docs-only입니다")
    require(semver(source.previous_version) < semver(source.current_version)
            < semver(original.current_version), "릴리스 버전 순서가 증가하지 않습니다")
    require(source.target_sha != successor.target_sha, "서로 다른 릴리스 SHA가 동일합니다")

    src = ci.get(source_sha)
    original_ev = ci.get(original_successor_sha)
    next_ev = ci.get(successor_sha)
    require(src is not None and src.completed_failure and not src.success,
            "source SHA의 완료된 실패 Main CI가 검증되지 않았습니다")
    require(original_ev is not None and original_ev.completed_failure and not original_ev.success,
            "후속 Issue 최초 SHA의 완료된 실패 Main CI가 검증되지 않았습니다")
    require(next_ev is not None and next_ev.success and next_ev.verified_candidate,
            "후속 교정 SHA의 성공한 Main CI + exact candidate gate가 없습니다")

    # Independently reproduce the generic resolver's blocking policy.
    planned, superseded = finalizer.supersede_failed_issue_retries(
        chain, {key: value.success for key, value in ci.items()},
        first_parent_items=chain,
    )
    require(any(item.target_sha == source_sha for item in planned),
            "기존 실패 source의 자동 승계 차단 계약이 손상되었습니다")
    require(not any(old.target_sha == source_sha for old, _ in superseded),
            "교차 Issue 미발행 source가 무승인 자동 supersede되었습니다")
    require(any(old.target_sha == original_successor_sha
                and new.target_sha == successor_sha for old, new in superseded),
            "후속 Issue의 adjacent same-version corrective 승계가 확인되지 않았습니다")

    old = states.get(source.current_version)
    require(old is not None, "미발행 source 버전 상태가 없습니다")
    require(old.git_tag == old.github_release == old.ghcr_tag == "ABSENT",
            "source SemVer는 tag / Release / GHCR가 모두 ABSENT여야 폐기를 검토할 수 있습니다")
    next_state = states.get(successor.current_version)
    require(next_state is not None, "후속 release 버전 상태가 없습니다")
    require(next_state.git_tag == "ABSENT" and next_state.github_release == "ABSENT"
            and next_state.ghcr_tag == "ABSENT",
            "후속 정식 tag / Release / GHCR가 이미 존재합니다: 기존 원장 별도 검토 필요")

    try:
        authorization = finalizer.select_authorization(
            successor_comments, expected_version=successor.current_version
        )
    except finalizer.AutoFinalizerError as exc:
        raise AuditBlocked(f"후속 Issue release 승인: {exc}") from exc
    if authorization is None:
        reasons.append(f"Issue #{successor.issue_number} v{successor.current_version} Owner release 승인 없음")

    if corrective_sha is None:
        reasons.append("새 corrective SemVer의 exact merge SHA가 지정되지 않았습니다")
        return "BLOCKED", reasons
    require(corrective_sha in by_sha, "새 corrective SHA가 first-parent main에 없습니다")
    corrective = by_sha[corrective_sha]
    require(indices[corrective_sha] > indices[successor_sha],
            "corrective는 후속 release보다 나중에 병합되어야 합니다")
    require(corrective.issue_number == source.issue_number,
            "새 corrective가 최초 source Issue에 속하지 않습니다")
    require(not corrective.validation_docs_only and corrective.release_required,
            "새 corrective는 검증된 non-docs version-bump merge여야 합니다")
    require(semver(corrective.current_version) > semver(successor.current_version)
            and corrective.previous_version == successor.current_version,
            "새 corrective SemVer는 후속 버전보다 커야 하며 baseline이 정확해야 합니다")
    corr_ev = ci.get(corrective_sha)
    require(corr_ev is not None and corr_ev.success and corr_ev.verified_candidate,
            "새 corrective Main CI + candidate 정확 검증이 없습니다")
    corrected = states.get(corrective.current_version)
    require(corrected is not None, "새 corrective 버전 상태가 없습니다")
    require(corrected.git_tag == corrected.github_release == corrected.ghcr_tag == "ABSENT",
            "새 corrective SemVer의 불변 tag/Release/GHCR는 아직 미발행이어야 합니다")

    expected = {
        "mode": "B_RETIRE_AND_REISSUE",
        "source_issue": source.issue_number,
        "source_sha": source_sha,
        "unissued_version": source.current_version,
        "successor_issue": successor.issue_number,
        "successor_sha": successor_sha,
        "successor_version": successor.current_version,
        "corrective_issue": corrective.issue_number,
        "corrective_sha": corrective_sha,
        "corrective_version": corrective.current_version,
    }
    approved, evidence = owner_debt_decision(
        source_comments, owner_login=owner_login, expected=expected
    )
    if not approved:
        reasons.append(evidence)
    try:
        corrective_auth = finalizer.select_authorization(
            source_comments, expected_version=corrective.current_version
        )
    except finalizer.AutoFinalizerError as exc:
        raise AuditBlocked(f"corrective Issue release 승인: {exc}") from exc
    if corrective_auth is None:
        reasons.append(f"Issue #{source.issue_number} v{corrective.current_version} Owner release 승인 없음")
    if reasons:
        return "BLOCKED", reasons
    return "READY_FOR_SEPARATE_TRUSTED_RECOVERY", [
        "증거·Owner 승인 범위는 일치합니다. 원본 Main CI는 여전히 FAIL입니다.",
        "이 검증기는 release 원장을 변경하지 않습니다. 별도 승인된 복구 실행 경로가 필요합니다.",
    ]


def main_ci_evidence(repo: str, item: finalizer.WorkItem) -> MainEvidence:
    # A missing/pending/cancelled run never proves a deterministic old failure.
    response = finalizer.gh(
        f"/repos/{repo}/actions/workflows/ci.yml/runs"
        f"?event=push&branch=main&head_sha={item.target_sha}&per_page=100"
    )
    require(isinstance(response, dict), "Main CI API 응답 형식이 올바르지 않습니다")
    runs = [
        value for value in response.get("workflow_runs", [])
        if value.get("head_sha") == item.target_sha
        and value.get("event") == "push" and value.get("head_branch") == "main"
    ]
    failed = any(value.get("status") == "completed"
                 and value.get("conclusion") == "failure" for value in runs)
    ok, url, artifact_ok, _artifact_description = lifecycle.exact_main_ci(
        repo, item.target_sha, docs_only=item.validation_docs_only
    )
    return MainEvidence(failed, ok, ok and artifact_ok, url)


def git_tag_state(version: str) -> str:
    result = finalizer.run_git_remote(
        "ls-remote", "--exit-code", "--tags", "origin",
        f"refs/tags/v{version}", check=False
    )
    if result.returncode == 2:
        return "ABSENT"
    if result.returncode == 0:
        return "PRESENT"
    return "UNKNOWN"


def ghcr_digest(image: str) -> tuple[str, str | None]:
    """Read registry metadata only. Auth/timeouts/errors are UNKNOWN, not absent."""
    try:
        result = subprocess.run(
            ["docker", "buildx", "imagetools", "inspect", image],
            capture_output=True, text=True, timeout=45, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return "UNKNOWN", None
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if line.strip().startswith("Digest:"):
                digest = line.split(":", 1)[1].strip()
                if DIGEST_RE.fullmatch(digest):
                    return "PRESENT", digest
        return "UNKNOWN", None
    error = (result.stderr + result.stdout).lower()
    if "manifest unknown" in error or "not found" in error or "404" in error:
        return "ABSENT", None
    return "UNKNOWN", None


def version_states(repo: str, versions: set[str]) -> dict[str, VersionState]:
    releases = finalizer.gh_paginated(f"/repos/{repo}/releases")
    require(all(isinstance(item, dict) for item in releases), "GitHub Release 원장 형식 오류")
    release_tags = {item.get("tag_name") for item in releases}
    states = {}
    for version in sorted(versions, key=semver):
        version_tag = f"v{version}"
        presence, digest = ghcr_digest(f"ghcr.io/{repo.lower()}:{version_tag}")
        states[version] = VersionState(
            git_tag=git_tag_state(version),
            github_release="PRESENT" if version_tag in release_tags else "ABSENT",
            ghcr_tag=presence,
            ghcr_digest=digest,
        )
    return states


def first_parent_chain(repo: str, main_sha: str, source_sha: str) -> list[finalizer.WorkItem]:
    # A trusted checkout with complete history is required; do not use the
    # PR checkout or an untrusted JSON description of the ancestry.
    full_history = finalizer.run(
        "git", "rev-list", "--first-parent", main_sha
    ).stdout.splitlines()
    require(source_sha in full_history, "source SHA는 현재 main의 first-parent가 아닙니다")
    require(full_history.index(source_sha) < 100,
            "source가 안전한 first-parent backlog 검증 한도(100)를 초과했습니다")
    shas = list(reversed(full_history[:full_history.index(source_sha) + 1]))
    chain = []
    for sha in shas:
        item = finalizer.resolve_work_item(repo, sha)
        require(item is not None, f"PR/Issue를 확인할 수 없는 main merge: {sha}")
        if chain:
            require(item.first_parent_sha == chain[-1].target_sha,
                    "main first-parent SHA 연결이 끊어졌습니다")
        chain.append(item)
    return chain


def run_audit(args: argparse.Namespace) -> int:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    require(repo == "planner77/masterGantt", "허용된 저장소의 trusted main에서만 실행해야 합니다")
    for value in (args.expected_main_sha, args.source_sha,
                  args.original_successor_sha, args.successor_sha):
        require(SHA_RE.fullmatch(value) is not None, "모든 SHA는 40자리 full SHA여야 합니다")
    if args.corrective_sha:
        require(SHA_RE.fullmatch(args.corrective_sha) is not None,
                "corrective SHA는 40자리 full SHA여야 합니다")
    head = finalizer.run("git", "rev-parse", "HEAD").stdout.strip()
    live_head = finalizer.current_main_sha(repo)
    require(head == args.expected_main_sha == live_head,
            "trusted main checkout / 전달된 main SHA / 실제 ref가 일치하지 않습니다")
    chain = first_parent_chain(repo, live_head, args.source_sha)
    evidence = {item.target_sha: main_ci_evidence(repo, item) for item in chain}
    expected_versions = {item.current_version for item in chain}
    states = version_states(repo, expected_versions)
    repo_owner = repo.split("/", 1)[0]
    by_sha = {item.target_sha: item for item in chain}
    require(args.source_sha in by_sha and args.successor_sha in by_sha,
            "요청한 source/successor SHA가 main first-parent에 없습니다")
    source = by_sha[args.source_sha]
    bridge = by_sha[args.successor_sha]
    source_comments = finalizer.issue_comments(repo, source.issue_number)
    bridge_comments = finalizer.issue_comments(repo, bridge.issue_number)

    decision, reasons = assess(
        chain, evidence, states, source_comments, bridge_comments,
        owner_login=repo_owner, source_sha=args.source_sha,
        original_successor_sha=args.original_successor_sha,
        successor_sha=args.successor_sha, corrective_sha=args.corrective_sha,
    )
    report = {
        "main_sha": live_head, "mutation": "NONE", "decision": decision,
        "first_parent": [
            {"sha": item.target_sha, "pr": item.pr_number, "issue": item.issue_number,
             "from": item.previous_version, "to": item.current_version,
             "main_ci": "PASS" if evidence[item.target_sha].success else
                        ("FAIL" if evidence[item.target_sha].completed_failure else "NOT TESTED"),
             "candidate": "PASS" if evidence[item.target_sha].verified_candidate else "NOT TESTED",
             "main_ci_url": evidence[item.target_sha].url}
            for item in chain
        ],
        "versions": {
            key: {"git_tag": value.git_tag, "github_release": value.github_release,
                  "ghcr_tag": value.ghcr_tag, "ghcr_digest": value.ghcr_digest}
            for key, value in states.items()
        },
        "reasons": reasons,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as stream:
            stream.write(
                f"## Issue #633 신뢰 기반 읽기 전용 릴리스 부채 감사\n\n"
                f"- 판정: {decision}\n- main: {live_head}\n"
                f"- release/branch/Issue mutation: 없음\n"
            )
            for reason in reasons:
                stream.write(f"- {reason}\n")
    # Positive readiness still has no authority to mutate.
    return 0 if decision == "READY_FOR_SEPARATE_TRUSTED_RECOVERY" else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="신뢰된 main의 릴리스 부채 읽기 전용 감사")
    parser.add_argument("--expected-main-sha", required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--original-successor-sha", required=True)
    parser.add_argument("--successor-sha", required=True)
    parser.add_argument("--corrective-sha")
    return parser


def main() -> int:
    try:
        return run_audit(build_parser().parse_args())
    except (AuditBlocked, finalizer.AutoFinalizerError, lifecycle.LifecycleError) as exc:
        print(f"Release debt audit BLOCKED (mutation NONE): {exc}", file=sys.stderr)
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as stream:
                stream.write(f"## 릴리스 부채 감사 BLOCKED\n\n- 사유: {exc}\n- mutation: 없음\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
