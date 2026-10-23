#!/usr/bin/env python3
"""Issue #659: PR-only quick-check prerequisite, not an approval or merge gate.

Required jobs must be successful. Irrelevant jobs must be skipped; unknown route
outputs, missing results, and cancellation are never treated as PASS.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def assess(values: dict[str, str]) -> list[str]:
    errors: list[str] = []
    for name in ("CHANGES_RESULT", "PREFLIGHT_RESULT"):
        if values.get(name) != "success":
            errors.append(f"{name}는 success 필수: {values.get(name, '<missing>')}")

    for flag, jobs in (
        ("POLICY_REQUIRED", ("POLICY_RESULT",)),
        ("NODE_REQUIRED", ("TYPECHECK_RESULT", "LINT_RESULT", "UNIT_RESULT")),
    ):
        value = values.get(flag, "")
        if value not in ("true", "false"):
            errors.append(f"{flag} 판정이 명확하지 않습니다: {value!r}")
            continue
        expected = "success" if value == "true" else "skipped"
        for job in jobs:
            actual = values.get(job, "<missing>")
            if actual != expected:
                errors.append(f"{job}={actual}: {flag}={value}, 예상={expected}")
    return errors


def main() -> int:
    names = (
        "CHANGES_RESULT", "PREFLIGHT_RESULT", "POLICY_REQUIRED", "POLICY_RESULT",
        "NODE_REQUIRED", "TYPECHECK_RESULT", "LINT_RESULT", "UNIT_RESULT",
    )
    values = {name: os.environ.get(name, "") for name in names}
    errors = assess(values)
    report = [
        "## #659 PR 빠른 검사 판정",
        "- 결과: " + ("FAIL" if errors else "PASS"),
        "- 정책 검사 필요: " + values["POLICY_REQUIRED"],
        "- Node 검사 필요: " + values["NODE_REQUIRED"],
    ]
    report.extend(f"- 차단: {error}" for error in errors)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a", encoding="utf-8") as handle:
            handle.write("\n".join(report) + "\n")
    for line in report:
        print(line, file=sys.stderr if errors else sys.stdout)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
