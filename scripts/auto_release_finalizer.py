#!/usr/bin/env python3
"""Resolve and execute lifecycle for main merges in first-parent order."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
REF_RE = re.compile(r"(?im)^\s*Refs\s+#\s*([1-9][0-9]*)\s*$")
AUTH_MARKER_RE = re.compile(
    r"<!--\s*mastergantt-release-authorization:v1\s+({.*?})\s*-->",
    re.DOTALL,
)
FINAL_MARKER_PREFIX = "<!-- issue-lifecycle-final:"
TRUSTED_ASSOCIATIONS = {"OWNER"}
MAX_BACKLOG_DEPTH = 100


class AutoFinalizerError(RuntimeError):
    pass


class AutoFinalizerBlocked(AutoFinalizerError):
    pass


@dataclass(frozen=True)
class Authorization:
    authorized: bool
    expected_version: str
    note: str
    actor: str
    evidence_url: str


@dataclass(frozen=True)
class WorkItem:
    target_sha: str
    first_parent_sha: str
    pr_number: int
    issue_number: int
    previous_version: str
    current_version: str
    validation_docs_only: bool = False
    cleanup_pr_numbers: tuple[int, ...] = ()


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, text=True, capture_output=True)
    if check and result.returncode != 0:
        raise AutoFinalizerError(
            f"command failed ({result.returncode}): {' '.join(args)}\n{result.stderr.strip()}"
        )
    return result


def gh(path: str) -> Any:
    result = run("gh", "api", path)
    text_value = result.stdout.strip()
    return json.loads(text_value) if text_value else None


def gh_paginated(path: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        batch = gh(f"{path}{separator}per_page=100&page={page}")
        if not isinstance(batch, list):
            raise AutoFinalizerError(f"paginated GitHub API response is not a list: {path}")
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1
        if page > 1000:
            raise AutoFinalizerError(f"pagination safety limit exceeded: {path}")


def write_summary(lines: list[str]) -> None:
    text_value = "\n".join(lines)
    print(text_value)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fp:
            fp.write(text_value + "\n")


def select_exact_pull_request(
    pulls: list[dict[str, Any]], *, repo: str, target_sha: str
) -> dict[str, Any] | None:
    matches = [
        pr
        for pr in pulls
        if pr.get("merged_at")
        and pr.get("merge_commit_sha") == target_sha
        and (pr.get("base") or {}).get("ref") == "main"
        and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo
    ]
    if not matches:
        return None
    if len(matches) != 1:
        numbers = ", ".join(f"#{pr.get('number')}" for pr in matches)
        raise AutoFinalizerError(
            f"target SHA에 정확히 일치하는 merged PR이 여러 개입니다: {numbers}"
        )
    return matches[0]


def resolve_issue_number(body: str) -> int:
    matches = REF_RE.findall(body or "")
    unique = sorted(set(matches))
    if len(unique) != 1 or len(matches) != 1:
        raise AutoFinalizerError(
            "자동 finalize에는 정확히 하나의 canonical 'Refs #<Issue>' 줄이 필요합니다"
        )
    return int(unique[0])


def parse_authorization_marker(body: str) -> dict[str, Any] | None:
    matches = AUTH_MARKER_RE.findall(body or "")
    if not matches:
        return None
    if len(matches) != 1:
        raise AutoFinalizerError("승인 comment에는 v1 marker가 정확히 하나만 있어야 합니다")
    try:
        payload = json.loads(matches[0])
    except json.JSONDecodeError as exc:
        raise AutoFinalizerError(f"release 승인 marker JSON이 올바르지 않습니다: {exc}") from exc

    authorized = payload.get("authorized")
    expected_version = payload.get("expected_version")
    note = payload.get("note")
    if not isinstance(authorized, bool):
        raise AutoFinalizerError("승인 marker의 authorized는 boolean이어야 합니다")
    if not isinstance(expected_version, str) or not expected_version.strip():
        raise AutoFinalizerError("승인 marker에 expected_version이 필요합니다")
    if not isinstance(note, str) or not note.strip():
        raise AutoFinalizerError("승인 marker에 note가 필요합니다")
    return {
        "authorized": authorized,
        "expected_version": expected_version.strip(),
        "note": note.strip(),
    }


def select_authorization(
    comments: list[dict[str, Any]], *, expected_version: str
) -> Authorization | None:
    trusted_markers: list[tuple[int, dict[str, Any], dict[str, Any]]] = []
    for comment in comments:
        if comment.get("author_association") not in TRUSTED_ASSOCIATIONS:
            continue
        marker = parse_authorization_marker(comment.get("body") or "")
        if marker is None:
            continue
        trusted_markers.append((int(comment.get("id") or 0), comment, marker))

    if not trusted_markers:
        return None

    _, comment, marker = sorted(trusted_markers, key=lambda item: item[0])[-1]
    actor = ((comment.get("user") or {}).get("login") or "unknown").strip()
    evidence_url = (comment.get("html_url") or "").strip()
    authorization = Authorization(
        authorized=bool(marker["authorized"]),
        expected_version=str(marker["expected_version"]),
        note=str(marker["note"]),
        actor=actor,
        evidence_url=evidence_url,
    )
    if authorization.expected_version != expected_version:
        raise AutoFinalizerBlocked(
            "최신 신뢰 승인 marker의 대상 version이 "
            f"{authorization.expected_version}이며 현재 {expected_version}과 다릅니다"
        )
    if not authorization.authorized:
        raise AutoFinalizerBlocked(
            f"최신 신뢰 승인 marker가 {expected_version} release 승인을 명시적으로 철회했습니다"
        )
    return authorization


def git_json(sha: str, path: str) -> dict[str, Any]:
    raw = run("git", "show", f"{sha}:{path}").stdout
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AutoFinalizerError(f"{path} at {sha} is not valid JSON") from exc
    if not isinstance(value, dict):
        raise AutoFinalizerError(f"{path} at {sha} is not a JSON object")
    return value


def resolve_versions(target_sha: str) -> tuple[str, str, str]:
    parents = run("git", "rev-list", "--parents", "-n", "1", target_sha).stdout.strip().split()
    if len(parents) < 3:
        raise AutoFinalizerError("자동 finalizer는 두 parent를 가진 merge commit을 요구합니다")
    first_parent = parents[1]

    previous = str(git_json(first_parent, "package.json").get("version") or "")
    current = str(git_json(target_sha, "package.json").get("version") or "")
    if not previous or not current:
        raise AutoFinalizerError("package.json version을 확인할 수 없습니다")
    return first_parent, previous, current


def docs_only_paths(paths: list[str]) -> bool:
    if not paths:
        return False
    return all(
        path.startswith("docs/") or ("/" not in path and path.endswith(".md"))
        for path in paths
    )


def validation_scope_docs_only(first_parent_sha: str, target_sha: str) -> bool:
    raw = run(
        "git",
        "diff",
        "--name-only",
        "-z",
        first_parent_sha,
        target_sha,
    ).stdout
    return docs_only_paths([path for path in raw.split("\0") if path])


def resolve_work_item(repo: str, target_sha: str) -> WorkItem | None:
    pulls = gh_paginated(f"/repos/{repo}/commits/{target_sha}/pulls")
    pr = select_exact_pull_request(pulls, repo=repo, target_sha=target_sha)
    if pr is None:
        return None
    pr_number = int(pr["number"])
    issue_number = resolve_issue_number(pr.get("body") or "")
    first_parent, previous_version, current_version = resolve_versions(target_sha)
    return WorkItem(
        target_sha=target_sha,
        first_parent_sha=first_parent,
        pr_number=pr_number,
        issue_number=issue_number,
        previous_version=previous_version,
        current_version=current_version,
        validation_docs_only=validation_scope_docs_only(first_parent, target_sha),
        cleanup_pr_numbers=(),
    )


def final_marker(issue_number: int, target_sha: str) -> str:
    return f"{FINAL_MARKER_PREFIX}{issue_number}:{target_sha} -->"


def issue_comments(repo: str, issue_number: int) -> list[dict[str, Any]]:
    return gh_paginated(f"/repos/{repo}/issues/{issue_number}/comments")


def is_finalized_boundary(repo: str, item: WorkItem) -> bool:
    issue = gh(f"/repos/{repo}/issues/{item.issue_number}")
    if not isinstance(issue, dict):
        raise AutoFinalizerError(f"Issue #{item.issue_number} 응답 형식이 올바르지 않습니다")
    comments = issue_comments(repo, item.issue_number)
    marker = final_marker(item.issue_number, item.target_sha)
    if any(
        line.strip() == marker
        for comment in comments
        for line in (comment.get("body") or "").splitlines()
    ):
        return True

    # Legacy lifecycle before #350 may have closed an Issue without the generic
    # marker. Treat a closed Issue as a historical boundary and never reopen it.
    return issue.get("state") == "closed"


def collect_pending_work(
    repo: str, latest_main_sha: str, *, max_depth: int = MAX_BACKLOG_DEPTH
) -> list[WorkItem]:
    pending_newest_first: list[WorkItem] = []
    cursor = latest_main_sha

    for _ in range(max_depth):
        item = resolve_work_item(repo, cursor)
        if item is None:
            # A non-PR main commit is a safe historical boundary. The repository
            # ruleset normally prevents this, but the dispatcher must fail closed
            # rather than inventing an Issue identity.
            return list(reversed(pending_newest_first))
        if is_finalized_boundary(repo, item):
            return list(reversed(pending_newest_first))
        pending_newest_first.append(item)
        cursor = item.first_parent_sha

    raise AutoFinalizerError(
        f"최근 {max_depth}개의 first-parent merge 안에서 finalized boundary를 찾지 못했습니다"
    )


def coalesce_consecutive_issue_retries(items: list[WorkItem]) -> list[WorkItem]:
    """Collapse adjacent same-Issue retries only when validation scope matches.

    The latest target can stand in for earlier attempts only when both merges
    require the same docs-only/non-docs main validation scope. This prevents a
    docs-only follow-up from masking an earlier code merge whose exact main CI
    never produced the required E2E/Docker/GHCR evidence. Every collapsed PR
    identity is retained so all merged branches can be safely cleaned before
    FINAL/Issue close.
    """
    coalesced: list[WorkItem] = []
    for item in items:
        if (
            coalesced
            and coalesced[-1].issue_number == item.issue_number
            and coalesced[-1].validation_docs_only == item.validation_docs_only
        ):
            previous = coalesced[-1]
            cleanup_pr_numbers = tuple(
                dict.fromkeys(
                    (
                        *previous.cleanup_pr_numbers,
                        previous.pr_number,
                        *item.cleanup_pr_numbers,
                    )
                )
            )
            coalesced[-1] = WorkItem(
                target_sha=item.target_sha,
                first_parent_sha=previous.first_parent_sha,
                pr_number=item.pr_number,
                issue_number=item.issue_number,
                previous_version=previous.previous_version,
                current_version=item.current_version,
                validation_docs_only=item.validation_docs_only,
                cleanup_pr_numbers=cleanup_pr_numbers,
            )
            continue
        coalesced.append(item)
    return coalesced


def validation_scope_covers(older: WorkItem, replacement: WorkItem) -> bool:
    """Return whether replacement CI scope can validate the older attempt."""
    if not replacement.validation_docs_only:
        return True
    return older.validation_docs_only


def supersede_failed_issue_retries(
    items: list[WorkItem],
    ci_success: dict[str, bool],
) -> tuple[list[WorkItem], list[tuple[WorkItem, WorkItem]]]:
    """Defer a failed attempt to a later Green merge for the same Issue.

    Unlike adjacent coalescing, this keeps intervening Issues in first-parent
    order. The failed attempt is omitted only when a later same-Issue target
    already has exact main CI SUCCESS and its validation scope is at least as
    strong. The superseded PR remains a cleanup obligation of that later target.
    """
    superseded_indices: set[int] = set()
    cleanup_by_index: dict[int, list[int]] = {}
    superseded: list[tuple[WorkItem, WorkItem]] = []

    for index, item in enumerate(items):
        if ci_success.get(item.target_sha, False):
            continue
        replacement_index: int | None = None
        for candidate_index in range(index + 1, len(items)):
            candidate = items[candidate_index]
            if candidate.issue_number != item.issue_number:
                continue
            if not ci_success.get(candidate.target_sha, False):
                continue
            if not validation_scope_covers(item, candidate):
                continue
            replacement_index = candidate_index
            break
        if replacement_index is None:
            continue

        replacement = items[replacement_index]
        superseded_indices.add(index)
        cleanup_by_index.setdefault(replacement_index, []).extend(
            [*item.cleanup_pr_numbers, item.pr_number]
        )
        superseded.append((item, replacement))

    planned: list[WorkItem] = []
    for index, item in enumerate(items):
        if index in superseded_indices:
            continue
        extra_cleanup = cleanup_by_index.get(index, [])
        if extra_cleanup:
            cleanup = tuple(
                dict.fromkeys((*item.cleanup_pr_numbers, *extra_cleanup))
            )
            item = WorkItem(
                target_sha=item.target_sha,
                first_parent_sha=item.first_parent_sha,
                pr_number=item.pr_number,
                issue_number=item.issue_number,
                previous_version=item.previous_version,
                current_version=item.current_version,
                validation_docs_only=item.validation_docs_only,
                cleanup_pr_numbers=cleanup,
            )
        planned.append(item)
    return planned, superseded


def current_main_sha(repo: str) -> str:
    data = gh(f"/repos/{repo}/git/ref/heads/main")
    sha = ((data or {}).get("object") or {}).get("sha", "")
    if SHA_RE.fullmatch(sha) is None:
        raise AutoFinalizerError("현재 main SHA를 확인할 수 없습니다")
    return sha


def exact_main_ci_success(repo: str, sha: str) -> tuple[bool, str | None]:
    data = gh(
        f"/repos/{repo}/actions/workflows/ci.yml/runs"
        f"?event=push&branch=main&head_sha={sha}&per_page=100"
    )
    if not isinstance(data, dict):
        raise AutoFinalizerError("main CI 조회 응답 형식이 올바르지 않습니다")
    runs = [run_data for run_data in data.get("workflow_runs", []) if run_data.get("head_sha") == sha]
    if not runs:
        return False, None
    latest = sorted(runs, key=lambda run_data: run_data.get("created_at", ""))[-1]
    ok = latest.get("status") == "completed" and latest.get("conclusion") == "success"
    return ok, latest.get("html_url")


def lifecycle_command(
    *,
    operation: str,
    issue_number: int,
    pr_number: int,
    release_required: bool,
    release_authorized: bool,
    expected_version: str,
    authorization_note: str,
    cleanup_pr_numbers: tuple[int, ...] = (),
) -> list[str]:
    command = [
        "python3",
        "scripts/issue_lifecycle.py",
        operation,
        "--issue",
        str(issue_number),
        "--pr",
        str(pr_number),
        "--release-required",
        str(release_required).lower(),
        "--release-authorized",
        str(release_authorized).lower(),
        "--expected-version",
        expected_version,
        "--authorization-note",
        authorization_note,
    ]
    for cleanup_pr_number in cleanup_pr_numbers:
        command.extend(["--cleanup-pr", str(cleanup_pr_number)])
    return command


def process_item(repo: str, item: WorkItem) -> None:
    release_required = item.previous_version != item.current_version
    operation = "finalize"
    release_authorized = False
    authorization_note = ""
    evidence = "N/A"

    if release_required:
        comments = issue_comments(repo, item.issue_number)
        authorization = select_authorization(
            comments, expected_version=item.current_version
        )
        if authorization is None:
            raise AutoFinalizerBlocked(
                f"Issue #{item.issue_number}: application version이 "
                f"{item.previous_version} -> {item.current_version}으로 변경됐지만 "
                f"{item.current_version}에 대한 신뢰 가능한 release 승인 marker가 없습니다"
            )
        release_authorized = True
        operation = "release_finalize"
        evidence = authorization.evidence_url or "Issue comment"
        authorization_note = (
            f"{authorization.note} | actor={authorization.actor} | evidence={evidence}"
        )

    write_summary(
        [
            "### Lifecycle target",
            "",
            f"- main SHA: `{item.target_sha}`",
            f"- first parent: `{item.first_parent_sha}`",
            f"- PR: #{item.pr_number}",
            f"- Issue: #{item.issue_number}",
            f"- application version: `{item.previous_version}` → `{item.current_version}`",
            f"- validation scope docs-only: `{str(item.validation_docs_only).lower()}`",
            f"- additional cleanup PRs: {', '.join(f'#{number}' for number in item.cleanup_pr_numbers) or 'none'}",
            f"- release_required: `{str(release_required).lower()}`",
            f"- release_authorized: `{str(release_authorized).lower()}`",
            f"- 승인 근거: {evidence}",
            f"- operation: `{operation}`",
        ]
    )

    result = run(
        *lifecycle_command(
            operation=operation,
            issue_number=item.issue_number,
            pr_number=item.pr_number,
            release_required=release_required,
            release_authorized=release_authorized,
            expected_version=item.current_version if release_required else "",
            authorization_note=authorization_note,
            cleanup_pr_numbers=item.cleanup_pr_numbers,
        ),
        check=False,
    )
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0:
        raise AutoFinalizerError(
            f"Issue #{item.issue_number} lifecycle command failed with {result.returncode}"
        )


def execute(trigger_sha: str) -> int:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if not repo:
        raise AutoFinalizerError("GITHUB_REPOSITORY가 필요합니다")
    if SHA_RE.fullmatch(trigger_sha) is None:
        raise AutoFinalizerError("trigger SHA는 40자리 SHA여야 합니다")

    latest_main = current_main_sha(repo)
    pending_raw = collect_pending_work(repo, latest_main)
    pending_coalesced = coalesce_consecutive_issue_retries(pending_raw)
    ci_evidence = {
        item.target_sha: exact_main_ci_success(repo, item.target_sha)
        for item in pending_coalesced
    }
    pending, superseded = supersede_failed_issue_retries(
        pending_coalesced,
        {sha: evidence[0] for sha, evidence in ci_evidence.items()},
    )

    if not pending:
        write_summary(
            [
                "## 범용 Release Finalizer",
                "",
                f"- triggering CI SHA: `{trigger_sha}`",
                f"- dispatcher main snapshot: `{latest_main}`",
                "- 결과: `SKIPPED`",
                "- 사유: 처리할 미완료 first-parent lifecycle이 없습니다.",
            ]
        )
        return 0

    write_summary(
        [
            "## 범용 Release Finalizer",
            "",
            f"- triggering CI SHA: `{trigger_sha}`",
            f"- dispatcher main snapshot: `{latest_main}`",
            f"- pending first-parent merges: `{len(pending_raw)}`",
            f"- targets after adjacent same-Issue convergence: `{len(pending_coalesced)}`",
            f"- superseded failed attempts: `{len(superseded)}`",
            f"- lifecycle targets: `{len(pending)}`",
            "- 처리 순서: oldest → newest; intervening Issues retain their position",
        ]
    )

    for older, replacement in superseded:
        _, older_ci_url = ci_evidence[older.target_sha]
        _, replacement_ci_url = ci_evidence[replacement.target_sha]
        write_summary(
            [
                "### SUPERSEDED ATTEMPT",
                "",
                f"- failed SHA: `{older.target_sha}`",
                f"- Issue: #{older.issue_number}",
                f"- failed exact main CI: {older_ci_url or 'N/A'}",
                f"- corrective SHA: `{replacement.target_sha}`",
                f"- corrective exact main CI: {replacement_ci_url or 'N/A'}",
                f"- validation scope: older docs-only={str(older.validation_docs_only).lower()}, corrective docs-only={str(replacement.validation_docs_only).lower()}",
                f"- cleanup deferred to PR #{replacement.pr_number}",
                "- release/finalize mutation: 없음 (corrective target 처리 시 수행)",
            ]
        )

    for item in pending:
        ci_ok, ci_url = ci_evidence.get(
            item.target_sha,
            exact_main_ci_success(repo, item.target_sha),
        )
        if not ci_ok:
            write_summary(
                [
                    "### DEFERRED",
                    "",
                    f"- SHA: `{item.target_sha}`",
                    f"- Issue: #{item.issue_number}",
                    f"- exact main CI: {ci_url or 'N/A'}",
                    "- 사유: first-parent 순서상 선행 target의 exact main CI SUCCESS를 기다립니다.",
                    "- mutation: 없음",
                ]
            )
            return 0
        process_item(repo, item)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-sha", required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return execute(args.target_sha)
    except AutoFinalizerBlocked as exc:
        write_summary(
            [
                "## 범용 Release Finalizer",
                "",
                "- 결과: `BLOCKED`",
                f"- 사유: {exc}",
                "- mutation: 없음",
                "- 복구: 신뢰 가능한 version-scoped release 승인 marker를 기록한 뒤 이 failed job을 재실행합니다.",
            ]
        )
        print(f"범용 finalizer BLOCKED: {exc}", file=sys.stderr)
        return 1
    except AutoFinalizerError as exc:
        write_summary(
            [
                "## 범용 Release Finalizer",
                "",
                "- 결과: `FAIL`",
                f"- 사유: {exc}",
                "- 이후 target mutation: 중단",
            ]
        )
        print(f"범용 finalizer FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
