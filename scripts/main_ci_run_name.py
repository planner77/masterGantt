#!/usr/bin/env python3
"""Issue #582: canonical one-line merge subject for Main CI and Finalizer."""

from __future__ import annotations

import argparse
import json
import re
import unicodedata

MAX_SUMMARY_LENGTH = 30
CANONICAL_SUBJECT_RE = re.compile(
    r"Issue #([1-9][0-9]*) · PR #([1-9][0-9]*) · ([^\r\n]+)"
)


def format_merge_title(issue_number: int, pr_number: int, summary: str) -> str:
    """Produce a short, single-line GitHub merge API commit_title."""
    if type(issue_number) is not int or issue_number <= 0:
        raise ValueError("Primary Issue 번호는 양의 정수여야 합니다")
    if type(pr_number) is not int or pr_number <= 0:
        raise ValueError("PR 번호는 양의 정수여야 합니다")
    # C0/C1 controls, Unicode direction/zero-width formatting, surrogate code
    # points and Unicode line separators can spoof or split Actions display names.
    if not isinstance(summary, str) or any(
        unicodedata.category(character) in {"Cc", "Cf", "Cs", "Zl", "Zp"}
        for character in summary
    ):
        raise ValueError("한글 Issue 요약에는 제어·비표시·줄구분 문자를 사용할 수 없습니다")

    normalized = " ".join(summary.split()).strip(" .·-—")
    if not normalized or len(normalized) > MAX_SUMMARY_LENGTH:
        raise ValueError(f"한글 Issue 요약은 1~{MAX_SUMMARY_LENGTH}자여야 합니다")
    if re.search(r"[가-힣]", normalized) is None:
        raise ValueError("Issue 요약에 한글 설명이 필요합니다")
    if re.search(r"(?i)\b(?:Issue|PR)\s*#\s*[0-9]+\b", normalized):
        raise ValueError("번호는 Issue/PR prefix에서만 사용하세요")
    return f"Issue #{issue_number} · PR #{pr_number} · {normalized}"


def parse_merge_title(message: str) -> tuple[int, int, str] | None:
    """Accept only the exact one-line canonical message, without a body."""
    if not isinstance(message, str):
        return None
    match = CANONICAL_SUBJECT_RE.fullmatch(message)
    if match is None:
        return None
    issue_number, pr_number = int(match.group(1)), int(match.group(2))
    summary = match.group(3)
    try:
        expected = format_merge_title(issue_number, pr_number, summary)
    except ValueError:
        return None
    return (issue_number, pr_number, summary) if message == expected else None


def merge_api_payload(
    issue_number: int, pr_number: int, summary: str, expected_head_sha: str, *,
    api_target: str = "connector",
) -> dict[str, str]:
    """Return a lease-bound, body-free merge request for the selected API.

    A multiline merge message makes the immutable main commit fail CI trace
    validation.  Build the title and empty body together rather than relying
    on GitHub's default merge-commit message.  GitHub REST calls the head
    lease `sha`; the connected tool uses `expected_head_sha`.
    """
    title = format_merge_title(issue_number, pr_number, summary)
    if not isinstance(expected_head_sha, str) or re.fullmatch(
        r"[0-9a-f]{40}", expected_head_sha
    ) is None:
        raise ValueError("병합 대상 PR Head는 정확한 40자리 소문자 SHA여야 합니다")
    if api_target not in {"connector", "rest"}:
        raise ValueError("병합 API 대상은 connector 또는 rest여야 합니다")
    payload = {
        "merge_method": "merge",
        "commit_title": title,
        "commit_message": "",
    }
    payload["expected_head_sha" if api_target == "connector" else "sha"] = expected_head_sha
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Main CI 실행명을 위한 한 줄 Merge Commit 제목 생성 (실제 Merge는 수행하지 않음)"
    )
    parser.add_argument("--issue", type=int, required=True, help="Primary Issue 번호")
    parser.add_argument("--pr", type=int, required=True, help="PR 번호")
    parser.add_argument("--summary", required=True, help="이슈를 설명하는 짧은 한글 제목(최대 30자)")
    parser.add_argument("--as-merge-payload", action="store_true", help="병합 API 입력의 제목·빈 본문·Head SHA를 함께 JSON 출력")
    parser.add_argument("--expected-head-sha", default="", help="--as-merge-payload에서 사용할 검증된 PR Head SHA")
    parser.add_argument("--merge-api", choices=("connector", "rest"), default="connector", help="connector: expected_head_sha / REST: sha")
    args = parser.parse_args()
    try:
        if args.as_merge_payload:
            print(json.dumps(merge_api_payload(
                args.issue, args.pr, args.summary, args.expected_head_sha,
                api_target=args.merge_api,
            ), ensure_ascii=False))
        else:
            if args.expected_head_sha or args.merge_api != "connector":
                raise ValueError("--expected-head-sha 및 --merge-api는 --as-merge-payload와 함께 사용하세요")
            print(format_merge_title(args.issue, args.pr, args.summary))
    except ValueError as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
