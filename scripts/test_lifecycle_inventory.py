#!/usr/bin/env python3
"""Issue #711: read-only test-suite discovery and candidate inventory.

Never runs test bodies, edits test files, skips a check, or decides to delete a test.
--mode discover needs the repository's installed Vitest/Playwright packages.
--mode static records file counts but explicitly leaves executable case counts UNKNOWN.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter, defaultdict
import csv
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
E2E_LINE = re.compile(r"^\s*\[(?P<project>[^\]]+)\]\s*›\s*(?P<file>.+?\.spec\.ts):\d+:\d+\s*›\s*(?P<title>.+?)\s*$")
E2E_TOTAL = re.compile(r"Total:\s*(\d+)\s+tests?\s+in\s+(\d+)\s+files?")
POLICY_RUN = re.compile(r"^\s+run:\s*(.+?)\s*$", re.MULTILINE)
POLICY_JOB = re.compile(r"(?ms)^  policy:\s*\n(.*?)(?=^  [a-zA-Z_][\w-]*:\s*(?:\n|$)|\Z)")
ANSI = re.compile(r"\x1b\[[0-9;]*m")


class InventoryError(RuntimeError):
    """Failure or ambiguous discovery. UNKNOWN, never an invented zero."""


def repo_path(value: str | Path, root: Path) -> str:
    path = Path(value)
    absolute = (path if path.is_absolute() else root / path).resolve()
    try:
        return absolute.relative_to(root.resolve()).as_posix()
    except ValueError as error:
        raise InventoryError(f"Test path outside repository: {value}") from error


def collect_files(root: Path, pattern: str) -> list[str]:
    return sorted(p.relative_to(root).as_posix() for p in root.glob(pattern) if p.is_file())


def listed_test_path(value: str, root: Path, expected: list[str]) -> str:
    """Normalize absolute/repo-relative/testDir-relative collector paths.

    Never guess when two distinct test files share the same basename.
    """
    direct = repo_path(value, root)
    candidates = {direct}
    if not Path(value).is_absolute():
        candidates.add(repo_path(Path("tests/e2e") / value, root))
    matches = sorted(path for path in expected if path in candidates)
    if len(matches) != 1:
        raise InventoryError(f"Ambiguous or unexpected listed test path: {value}")
    return matches[0]


def run_list(root: Path, args: list[str]) -> str:
    result = subprocess.run(
        ["node", *args],
        cwd=root,
        encoding="utf-8",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=240,
        env={**os.environ, "NO_COLOR": "1", "FORCE_COLOR": "0"},
        check=False,
    )
    if result.returncode != 0:
        raise InventoryError(f"Test discovery failed ({result.returncode}): {result.stderr[-3000:] or result.stdout[-3000:]}")
    return ANSI.sub("", result.stdout).strip()


def parse_playwright_listing(output: str, root: Path, files: list[str]) -> list[dict[str, str]]:
    total = E2E_TOTAL.search(output)
    if total is None:
        raise InventoryError("Playwright --list did not report a case/file total")
    cases = []
    for line in output.splitlines():
        match = E2E_LINE.match(line)
        if match:
            cases.append({
                "layer": "E2E",
                "path": listed_test_path(match.group("file"), root, files),
                "scenario": match.group("title").strip(),
                "environment": match.group("project"),
                "count_basis": "playwright --list (collected cases)",
            })
    file_set = set(files)
    reported = {x["path"] for x in cases}
    if len(cases) != int(total.group(1)) or len(reported) != int(total.group(2)):
        raise InventoryError(f"Playwright listing mismatch: parsed {len(cases)} cases/{len(reported)} files, total says {total.groups()}")
    if reported != file_set:
        raise InventoryError(f"Playwright paths disagree with filesystem (missing={sorted(file_set - reported)[:5]}, extra={sorted(reported - file_set)[:5]})")
    return cases


def _file_name(node: dict, inherited: str | None) -> str | None:
    for key in ("file", "filepath", "filePath", "testFilePath"):
        value = node.get(key)
        if isinstance(value, str) and value.endswith(".test.ts"):
            return value
        if isinstance(value, dict):
            for sub in ("filepath", "filePath", "path", "name"):
                child = value.get(sub)
                if isinstance(child, str) and child.endswith(".test.ts"):
                    return child
    return inherited


def parse_vitest_listing(output: str, root: Path, files: list[str]) -> list[dict[str, str]]:
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as error:
        raise InventoryError("Vitest list --json output was not valid JSON") from error
    if isinstance(payload, dict) and isinstance(payload.get("tests"), list):
        payload = payload["tests"]
    if not isinstance(payload, list):
        raise InventoryError("Vitest list --json schema is not an array of test entries")
    cases = []

    def visit(node: object, inherited_file: str | None = None, prefix: str = "") -> None:
        if not isinstance(node, dict):
            raise InventoryError("Vitest test entry is not an object")
        file_name = _file_name(node, inherited_file)
        nested = node.get("tasks", node.get("children"))
        if isinstance(nested, list):
            name = node.get("name")
            next_prefix = " > ".join(x for x in (prefix, name) if isinstance(x, str) and x)
            for child in nested:
                visit(child, file_name, next_prefix)
            return
        if file_name is None:
            raise InventoryError(f"Vitest test entry has no file: {str(node)[:250]}")
        title = node.get("fullName") or node.get("full_name") or node.get("name") or node.get("title")
        if not isinstance(title, str) or not title:
            raise InventoryError("Vitest test entry has no test title")
        cases.append({
            "layer": "VITEST",
            "path": listed_test_path(file_name, root, files),
            "scenario": title if node.get("fullName") or node.get("full_name") else " > ".join(filter(None, (prefix, title))),
            "environment": "node/vitest config",
            "count_basis": "vitest list --json (collected declarations)",
        })

    for entry in payload:
        visit(entry)
    file_set = set(files)
    discovered = {x["path"] for x in cases}
    if not cases or discovered != file_set:
        raise InventoryError(f"Vitest paths/cases incomplete (cases={len(cases)}, missing={sorted(file_set - discovered)[:5]}, extra={sorted(discovered - file_set)[:5]})")
    return cases


def policy_inventory(root: Path) -> tuple[list[dict[str, str]], int]:
    workflow = root / ".github/workflows/ci.yml"
    if not workflow.is_file():
        raise InventoryError("CI workflow is missing; cannot inventory policy run conditions")
    match = POLICY_JOB.search(workflow.read_text(encoding="utf-8"))
    if not match:
        raise InventoryError("CI policy job is missing or unrecognizable")
    runs = []
    for cmd in POLICY_RUN.findall(match.group(1)):
        if cmd in ("|", ">") or not any(s in cmd for s in ("python3", "verify-test-discovery", "audit", "version:check", "check-markdown")):
            continue
        runs.append({
            "layer": "POLICY",
            "path": ".github/workflows/ci.yml",
            "scenario": cmd,
            "environment": "CI policy job (conditional inputs and failure gating apply)",
            "count_basis": "workflow command declaration (not executed test cases)",
        })
    if not runs:
        raise InventoryError("No policy commands identified; do not report zero")
    declared_methods = 0
    for name in sorted(set(collect_files(root, "tests/python/test_*.py") + collect_files(root, "scripts/test_*.py")) - {"scripts/test_lifecycle_inventory.py"}):
        try:
            tree = ast.parse((root / name).read_text(encoding="utf-8"), filename=name)
        except (SyntaxError, OSError) as error:
            raise InventoryError(f"Could not inspect policy file {name}: {error}") from error
        declared_methods += sum(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_")
            for node in ast.walk(tree)
        )
    return runs, declared_methods


def candidate_groups(cases: list[dict[str, str]]) -> list[dict[str, object]]:
    groups: dict[tuple[str, str], set[str]] = defaultdict(set)
    for case in cases:
        if case["layer"] not in ("VITEST", "E2E"):
            continue
        title = unicodedata.normalize("NFKC", case["scenario"]).casefold()
        title = re.sub(r"\s+", " ", title).strip()
        if title:
            groups[(case["layer"], title)].add(case["path"])
    return [
        {"layer": layer, "title": title, "files": sorted(paths), "decision": "CANDIDATE_ONLY"}
        for (layer, title), paths in sorted(groups.items())
        if len(paths) > 1
    ]


def build(root: Path, mode: str) -> tuple[dict, list[dict[str, str]]]:
    unit_files = collect_files(root, "tests/**/*.test.ts")
    browser_files = collect_files(root, "tests/e2e/**/*.spec.ts")
    if not unit_files or not browser_files:
        raise InventoryError("Vitest or E2E test files are missing; cannot invent a zero baseline")
    policy, method_count = policy_inventory(root)
    cases: list[dict[str, str]] = []
    if mode == "discover":
        vitest = run_list(root, [
            str(root / "node_modules/vitest/vitest.mjs"), "list",
            "--config", str(root / "tests/config/vitest.config.ts"), "--json",
        ])
        playwright = run_list(root, [
            str(root / "node_modules/@playwright/test/cli.js"), "test",
            "--config", str(root / "tests/config/playwright.config.ts"), "--list", "--reporter=list",
        ])
        cases.extend(parse_vitest_listing(vitest, root, unit_files))
        cases.extend(parse_playwright_listing(playwright, root, browser_files))
    else:
        for layer, paths in (("VITEST", unit_files), ("E2E", browser_files)):
            for path in paths:
                cases.append({
                    "layer": layer, "path": path, "scenario": "UNKNOWN",
                    "environment": "not collected", "count_basis": "files only; case count UNKNOWN",
                })
    cases.extend(policy)
    candidates = candidate_groups(cases) if mode == "discover" else []
    counts = Counter(x["layer"] for x in cases)
    version = json.loads((root / "package.json").read_text(encoding="utf-8")).get("version", "UNKNOWN")
    shard_config = json.loads((root / "tests/config/e2e-shard-plan.json").read_text(encoding="utf-8"))
    summary = {
        "schema_version": 1, "issue": 711, "mode": mode, "package_version": version,
        "vitest_files": len(unit_files), "e2e_files": len(browser_files),
        "vitest_collected_cases": counts["VITEST"] if mode == "discover" else "UNKNOWN",
        "e2e_collected_cases": counts["E2E"] if mode == "discover" else "UNKNOWN",
        "policy_workflow_commands": len(policy),
        "policy_python_declared_methods_static_only": method_count,
        "policy_executed_case_count": "UNKNOWN",
        "e2e_shards_planned": shard_config.get("shardCount", "UNKNOWN"),
        "duplicate_title_candidates": candidates,
        "execution_durations_p50_p90_runner_minutes": "UNKNOWN: use authenticated CI runs",
        "flaky_rate": "UNKNOWN: use authenticated failure ledger",
        "deletion_decisions": "NONE: human contract review and Owner approval required",
    }
    return summary, cases


def markdown_summary(summary: dict) -> str:
    lines = [
        "# Issue #711 — Test Lifecycle Inventory (generated, read-only)",
        "",
        "소스: 이 보고서를 생성한 checkout. CI Run/Attempt/HEAD는 외부 증거와 별도 기록.",
        f"- 모드: {summary['mode']}; 제품 버전: {summary['package_version']}",
        f"- Vitest: {summary['vitest_files']} files / {summary['vitest_collected_cases']} collected cases",
        f"- Playwright Chromium: {summary['e2e_files']} files / {summary['e2e_collected_cases']} collected cases",
        f"- CI policy: {summary['policy_workflow_commands']} static commands; Python test_* definitions {summary['policy_python_declared_methods_static_only']} (not executed cases)",
        f"- E2E shard plan: {summary['e2e_shards_planned']} (실제 실행/성공 확인은 별도 CI)",
        f"- 동명 타 파일 중복 후보: {len(summary['duplicate_title_candidates'])} (제목만으로 의미 중복 판정/삭제 금지)",
        "- 실행시간, flaky, 폐기 영향: UNKNOWN (정확한 Run/Attempt의 실제 CI 증거 필요)",
        "- 모든 신규·통합·폐기 제안은 docs/TEST_PLAN.md의 Test Lifecycle Gate를 통과해야 한다.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("static", "discover"), default="discover")
    parser.add_argument("--output-dir", help="Optional report directory; test source is never modified")
    args = parser.parse_args()
    try:
        summary, rows = build(ROOT, args.mode)
        if args.output_dir:
            directory = Path(args.output_dir).resolve()
            directory.mkdir(parents=True, exist_ok=True)
            fields = ("layer", "path", "scenario", "environment", "count_basis")
            with (directory / "inventory.csv").open("w", encoding="utf-8", newline="") as fp:
                writer = csv.DictWriter(fp, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)
            (directory / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (directory / "summary.md").write_text(markdown_summary(summary), encoding="utf-8")
        print(markdown_summary(summary))
    except (InventoryError, OSError, subprocess.TimeoutExpired, ValueError, json.JSONDecodeError) as error:
        print(f"TEST_LIFECYCLE_INVENTORY=UNKNOWN/FAIL: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
