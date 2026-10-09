#!/usr/bin/env python3
"""Issue #582: canonical one-line merge subject for Main CI and Finalizer."""

from __future__ import annotations

import argparse
import re

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
    if not isinstance(summary, str) or any(
        ord(character) < 32 or ord(character) == 127 for character in summary
    ):
        raise ValueError("한글 Issue 요약은 단일 행이어야 합니다")

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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Main CI 실행명을 위한 한 줄 Merge Commit 제목 생성 (실제 Merge는 수행하지 않음)"
    )
    parser.add_argument("--issue", type=int, required=True, help="Primary Issue 번호")
    parser.add_argument("--pr", type=int, required=True, help="PR 번호")
    parser.add_argument("--summary", required=True, help="이슈를 설명하는 짧은 한글 제목(최대 30자)")
    args = parser.parse_args()
    try:
        print(format_merge_title(args.issue, args.pr, args.summary))
    except ValueError as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
