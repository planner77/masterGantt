#!/usr/bin/env python3
"""Validate the Primary Issue trace metadata used by GitHub Actions run names."""

from __future__ import annotations

import json
import os
import pathlib
import re
import sys
from typing import Any

from main_ci_run_name import parse_merge_title

REF_RE = re.compile(r"(?im)^\s*Refs\s+#\s*([1-9][0-9]*)\s*$")
BRANCH_ISSUE_RE = re.compile(r"(?i)(?:^|[/_-])issue-([1-9][0-9]*)(?:$|[/_-])")
TITLE_ISSUE_RE = re.compile(r"(?i)Issue\s*#\s*([1-9][0-9]*)\b|\(#\s*([1-9][0-9]*)\s*\)")
MERGE_PR_RE = re.compile(r"^Merge (?:pull request|PR) #([1-9][0-9]*)\b", re.I)


class TraceError(RuntimeError):
    pass


def _positive_issue(value: Any) -> int:
    text = str(value or "").strip()
    if re.fullmatch(r"[1-9][0-9]*", text) is None:
        raise TraceError(f"Primary Issue 번호가 올바르지 않습니다: {text!r}")
    return int(text)


def _title_issue_numbers(title: str) -> set[int]:
    values: set[int] = set()
    for left, right in TITLE_ISSUE_RE.findall(title):
        values.add(int(left or right))
    return values


def _branch_issue_numbers(branch: str) -> set[int]:
    return {int(value) for value in BRANCH_ISSUE_RE.findall(branch)}


def _is_dependabot_pull_request(payload: dict[str, Any], pr: dict[str, Any]) -> bool:
    user = pr.get("user") or {}
    head = pr.get("head") or {}
    head_repo = head.get("repo") or {}
    repository = payload.get("repository") or {}
    return (
        user.get("login") == "dependabot[bot]"
        and str(head.get("ref") or "").startswith("dependabot/")
        and bool(repository.get("full_name"))
        and head_repo.get("full_name") == repository.get("full_name")
    )


def validate_pull_request(payload: dict[str, Any]) -> tuple[int | None, int]:
    pr = payload.get("pull_request")
    if not isinstance(pr, dict):
        raise TraceError("pull_request payload가 없습니다")

    number = int(pr.get("number") or payload.get("number") or 0)
    if number <= 0:
        raise TraceError("PR 번호를 확인할 수 없습니다")

    if _is_dependabot_pull_request(payload, pr):
        branch = str((pr.get("head") or {}).get("ref") or "")
        print(f"Dependabot PR 실행 추적 PASS: PR #{number} · branch {branch}")
        return None, number

    body = str(pr.get("body") or "")
    refs = [int(value) for value in REF_RE.findall(body)]
    if len(refs) != 1:
        raise TraceError(
            f"PR 본문에는 canonical 'Refs #<Primary Issue>'가 정확히 1개 필요합니다: {refs}"
        )
    primary = refs[0]

    head = pr.get("head") or {}
    branch = str(head.get("ref") or "")
    branch_issues = _branch_issue_numbers(branch)
    if branch_issues != {primary}:
        raise TraceError(
            f"branch의 issue-NNN과 Primary Issue가 일치해야 합니다: "
            f"branch={branch!r}, branch Issues={sorted(branch_issues)}, Primary Issue=#{primary}"
        )

    title = str(pr.get("title") or "")
    title_issues = _title_issue_numbers(title)
    if title_issues != {primary}:
        raise TraceError(
            f"PR 제목의 Issue 표기는 Primary Issue #{primary} 하나만 허용합니다: "
            f"title Issues={sorted(title_issues)}"
        )

    print(
        f"PR 실행 추적 PASS: Issue #{primary} · PR #{number} · branch {branch}"
    )
    return primary, number


def validate_push(payload: dict[str, Any]) -> tuple[int | None, int | None]:
    if payload.get("ref") != "refs/heads/main":
        print("main 이외 push: 실행명 추적 검증 N/A")
        return None, None

    head_commit = payload.get("head_commit") or {}
    message = str(head_commit.get("message") or "")
    if not message:
        raise TraceError("main push의 head commit message를 확인할 수 없습니다")

    canonical = parse_merge_title(message)
    if canonical is not None:
        primary, pr_number, _summary = canonical
        print(f"Main 표준 실행 추적 PASS: Issue #{primary} · PR #{pr_number}")
        return primary, pr_number

    subject = message.splitlines()[0]
    if subject.startswith("Issue #") and "· PR #" in subject:
        raise TraceError("표준 Merge 제목은 한 줄이어야 하며 번호·요약 형식이 정확해야 합니다")

    pr_match = MERGE_PR_RE.match(subject)
    if pr_match is None:
        print("비-PR main push: SHA 기반 짧은 fallback 실행명을 사용합니다")
        return None, None

    pr_number = int(pr_match.group(1))
    title_issues = _title_issue_numbers(message)
    branch_issues = _branch_issue_numbers(message)
    issue_numbers = title_issues | branch_issues
    if len(issue_numbers) != 1:
        raise TraceError(
            "merge commit message에서 Primary Issue를 하나로 식별할 수 없습니다: "
            f"title Issues={sorted(title_issues)}, branch Issues={sorted(branch_issues)}"
        )

    primary = next(iter(issue_numbers))
    print(f"Main 실행 추적 PASS: Issue #{primary} · PR #{pr_number}")
    return primary, pr_number


def validate_dispatch(payload: dict[str, Any]) -> tuple[int | None, None]:
    inputs = payload.get("inputs") or {}
    raw = str(inputs.get("issue_number") or "").strip()
    if not raw:
        print("수동 CI: Primary Issue 미지정 fallback 실행명을 사용합니다")
        return None, None
    primary = _positive_issue(raw)
    print(f"수동 CI 실행 추적 PASS: Issue #{primary}")
    return primary, None


def validate_event(event_name: str, payload: dict[str, Any]) -> tuple[int | None, int | None]:
    if event_name == "pull_request":
        return validate_pull_request(payload)
    if event_name == "push":
        return validate_push(payload)
    if event_name == "workflow_dispatch":
        return validate_dispatch(payload)
    print(f"{event_name}: 실행명 추적 검증 N/A")
    return None, None


def main() -> int:
    try:
        event_name = os.environ.get("GITHUB_EVENT_NAME", "")
        event_path = pathlib.Path(os.environ.get("GITHUB_EVENT_PATH", ""))
        if not event_name:
            raise TraceError("GITHUB_EVENT_NAME이 필요합니다")
        if not event_path.is_file():
            raise TraceError("GITHUB_EVENT_PATH를 읽을 수 없습니다")
        payload = json.loads(event_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise TraceError("GitHub event payload 형식이 올바르지 않습니다")
        validate_event(event_name, payload)
        return 0
    except (TraceError, json.JSONDecodeError) as exc:
        print(f"CI 실행 추적 오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
