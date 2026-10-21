#!/usr/bin/env python3
"""Issue #770: trusted-base, advisory-only CI impact classifier.

The script MUST be executed from the authenticated PR base checkout, never from
the PR test-merge. The PR's source/tests are read as Git object *data* only.
No plan produced here is a Required Check, PASS receipt or release authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

SCHEMA = "mastergantt-impact-plan-v1"
SHA = re.compile(r"^[0-9a-f]{40}$")
TEST = re.compile(r"^tests/.+\.(?:spec|test)\.[cm]?[jt]sx?$")
KNOWN_EXT = re.compile(r"\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|md|yml|yaml|sh|py|sql|svg|png|jpg)$", re.I)
GATES = ("Build, static checks, and unit tests", "Chromium end-to-end tests", "Docker build and runtime smoke test")
CRITICAL = re.compile(
    r"^(?:AGENTS\.md|DESIGN\.md|docs/(?:TEST_PLAN|CI_CD|REMOTE_VALIDATION|"
    r"ISSUE_LIFECYCLE|QA_REVIEW_POLICY|GITHUB_OPERATIONS)\.md|"
    r"\.github/|scripts/|db/|tests/(?:config|fixtures|e2e/(?:fixtures|helpers))/|"
    r"package(?:-lock)?\.json|tsconfig[^/]*|next\.config\.[^/]+|"
    r"eslint\.config\.[^/]+|postcss\.config\.[^/]+|deploy/|\.dockerignore$)"
)
SHARED = re.compile(
    r"^(?:src/(?:server/|contracts/|app/api/|lib/(?:security|db|auth)/|"
    r"features/(?:gantt/|milestones/|resources/|logistics/)|"
    r"domain/|components/)|db/)"
)
AUTH = re.compile(r"(?:auth|security|session|permission|revision|token|cookie|csrf|origin)", re.I)
DOCUMENT = re.compile(r"^(?:docs/|README\.md$|CHANGELOG\.md$)")
DOC_PROTECTED = re.compile(r"^(?:AGENTS\.md|DESIGN\.md|docs/(?:TEST_PLAN|CI_CD|REMOTE_VALIDATION|"
                           r"ISSUE_LIFECYCLE|QA_REVIEW_POLICY|GITHUB_OPERATIONS)\.md)$")
SCREEN_MAP = {
    "src/features/projects/project-settings-dialog.tsx": [
        "tests/e2e/project-settings-dialog-layout-unknown.spec.ts",
    ],
    "src/features/projects/project-list-filter.ts": [
        "tests/e2e/project-list-search-filter.spec.ts",
        "tests/e2e/project-search-filter.spec.ts",
        "tests/features/projects/project-list-filter.test.ts",
    ],
    "src/features/projects/project-search-filter.ts": [
        "tests/e2e/project-search-filter.spec.ts",
        "tests/e2e/project-filter-toolbar-consistency.spec.ts",
    ],
}
# List contract only verified existing IDs. Known ledger consumers are kept
# independent of the affected source: never infer that a test PASSed.
CROSS = {
    "gantt": [
        "tests/e2e/milestone-dashboard-state.spec.ts",
        "tests/e2e/project-task-delete-context.spec.ts",
        "tests/e2e/grid-task-start-reveal.spec.ts",
        "tests/e2e/project-multi-task-copy-paste.spec.ts",
        "tests/e2e/project-gantt-fullscreen.spec.ts",
        "tests/e2e/viewport-coordinator.spec.ts",
    ],
    "security": [
        "tests/server/projects/edit-authorization-handlers.test.ts",
        "tests/server/projects/edit-authorization-security.test.ts",
        "tests/e2e/project-edit-authorization.spec.ts",
        "tests/e2e/project-edit-permission-recheck.spec.ts",
    ],
    "resource": [
        "tests/e2e/issue-623-resource-mvp.spec.ts",
        "tests/e2e/issue-736-resource-dashboard.spec.ts",
        "tests/e2e/resource-dashboard-ui.spec.ts",
        "tests/e2e/resource-drill-ui.spec.ts",
    ],
    "milestone": [
        "tests/e2e/milestone-dashboard-state.spec.ts",
        "tests/e2e/issue-732-milestone-dashboard.spec.ts",
        "tests/e2e/milestone-stage-editor.spec.ts",
        "tests/e2e/project-work-calendar-preview.spec.ts",
    ],
}
LEDGERS = {
    "gantt": ["docs/ISSUE_667_FAILURE_ANALYSIS.md", "docs/ISSUE_732_FAILURE_ANALYSIS.md"],
    "security": ["docs/ISSUE_730_FAILURE_ANALYSIS.md", "docs/ISSUE_767_FAILURE_ANALYSIS.md"],
    "resource": ["docs/ISSUE_730_FAILURE_ANALYSIS.md", "docs/ISSUE_736_FAILURE_ANALYSIS.md"],
    "milestone": ["docs/ISSUE_732_FAILURE_ANALYSIS.md", "docs/ISSUE_667_FAILURE_ANALYSIS.md"],
}
# The Issue #767 source issue has not necessarily produced a failure ledger.
LEDGER_OPTIONAL = {"docs/ISSUE_767_FAILURE_ANALYSIS.md"}


def git(*args: str, binary: bool = False):
    p = subprocess.run(["git", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       check=False)
    if p.returncode:
        raise ValueError("GIT_SOURCE_UNAVAILABLE")
    return p.stdout if binary else p.stdout.decode("utf-8").strip()


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256(value: object) -> str:
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def valid_sha(value: str) -> bool:
    return isinstance(value, str) and bool(SHA.fullmatch(value))


def paths_for_commit(sha: str) -> set[str]:
    output = git("ls-tree", "-r", "--name-only", "-z", sha, "--", "tests", binary=True)
    return set(filter(None, output.decode("utf-8").split("\0")))


def diff_entries(base: str, target: str) -> list[dict]:
    raw = git("diff", "--no-ext-diff", "--name-status", "-z", "--find-renames=50%",
              base, target, "--", binary=True).decode("utf-8").split("\0")
    result: list[dict] = []
    i = 0
    while i < len(raw) and raw[i]:
        action = raw[i]
        if not re.fullmatch(r"[ACDMRTUXB][0-9]*", action):
            raise ValueError("DIFF_STATUS_UNKNOWN")
        if action[0] in "RC":
            if i + 2 >= len(raw):
                raise ValueError("DIFF_TRUNCATED")
            result.append({"status": action, "previous_path": raw[i + 1], "path": raw[i + 2]})
            i += 3
        else:
            if i + 1 >= len(raw):
                raise ValueError("DIFF_TRUNCATED")
            result.append({"status": action, "path": raw[i + 1]})
            i += 2
    if len(result) > 2500:
        raise ValueError("DIFF_TOO_LARGE")
    for item in result:
        for name in (item.get("path"), item.get("previous_path")):
            if not name or name.startswith("/") or ".." in name.split("/") or "\n" in name:
                raise ValueError("UNSAFE_DIFF_PATH")
    return sorted(result, key=lambda item: (item["path"], item["status"], item.get("previous_path", "")))


def git_file(commit: str, path: str) -> str:
    return git("show", f"{commit}:{path}")


def test_inventory(commit: str) -> dict:
    found = paths_for_commit(commit)
    unit = sorted(path for path in found if path.endswith(".test.ts"))
    browser = sorted(path for path in found if path.startswith("tests/e2e/") and path.endswith(".spec.ts"))
    unexpected = sorted(path for path in found if TEST.fullmatch(path) and path not in set(unit + browser))
    return {"unit": unit, "e2e": browser, "unexpected": unexpected, "all": sorted(set(unit + browser))}


def actual_unit_imports(commit: str, unit: list[str]) -> dict[str, list[str]]:
    """Read imports as text; never execute PR code or dynamically resolve import()."""
    out: dict[str, set[str]] = {}
    pattern = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']""")
    for file in unit:
        body = git_file(commit, file)
        parent = Path(file).parent
        for match in pattern.finditer(body):
            specifier = match.group(1)
            if specifier.startswith("@/"):
                resolved = Path("src") / specifier[2:]
            elif specifier.startswith("."):
                resolved = parent / specifier
            else:
                continue
            # pathlib does not collapse '..' lexically; normalize using posixpath.
            import posixpath
            resolved_name = posixpath.normpath(str(resolved).replace("\\", "/")).removesuffix(".js")
            if not resolved_name.startswith("src/"):
                continue
            for candidate in (resolved_name, resolved_name + ".ts", resolved_name + ".tsx",
                              resolved_name + "/index.ts"):
                out.setdefault(candidate, set()).add(file)
    return {key: sorted(value) for key, value in out.items()}


def local_prepr(paths: list[str], inv: dict, direct: dict) -> dict:
    """Reuse #699's base-only risk and direct/adjacent/negative impact map."""
    source = (
        "import { selectImpact } from './scripts/prepr-core.mjs';"
        "const request=JSON.parse(process.argv[1]);"
        "const result=selectImpact({changed:request.paths,tests:request.tests,risk:'HIGH'});"
        "console.log(JSON.stringify(result));"
    )
    payload = {"paths": paths, "tests": {"unit": inv["unit"], "e2e": inv["e2e"],
                                         "directBySource": direct}}
    r = subprocess.run(["node", "--input-type=module", "-e", source, canonical(payload)],
                       capture_output=True, text=True, check=False, timeout=30)
    if r.returncode:
        raise ValueError("TRUSTED_PREPR_MAP_UNAVAILABLE")
    output = json.loads(r.stdout)
    if not isinstance(output.get("selected"), list):
        raise ValueError("TRUSTED_PREPR_MAP_INVALID")
    return output


def impact_plan(entries: list[dict], old: dict, current: dict, prepr: dict,
                base: str, head: str, merge: str, policy_sha: str,
                run: dict | None = None) -> dict:
    """Pure, deterministic classification. PR metadata cannot lower its risk."""
    paths = sorted({p for item in entries for p in (item["path"], item.get("previous_path")) if p})
    available = set(current["all"])
    before = set(old["all"])
    after = set(current["all"])
    picked: dict[str, set[str]] = {}
    reasons: list[str] = []
    basis: set[str] = set()
    risk = "LOW"
    force_full = False
    unknown = False

    def raise_risk(level: str, reason: str, *, full: bool = False, ambiguous: bool = False):
        nonlocal risk, force_full, unknown
        if {"LOW": 0, "MEDIUM": 1, "HIGH": 2}[level] > {"LOW": 0, "MEDIUM": 1, "HIGH": 2}[risk]:
            risk = level
        force_full |= full
        unknown |= ambiguous
        reasons.append(reason)

    def select(path: str, reason: str):
        nonlocal unknown, force_full
        if path not in available:
            unknown = True
            force_full = True
            reasons.append("MAPPED_TEST_NOT_PRESENT:" + path)
            return
        picked.setdefault(path, set()).add(reason)

    if not paths:
        raise_risk("HIGH", "EMPTY_OR_UNVERIFIED_DIFF", full=True, ambiguous=True)
    if before != after or old["unexpected"] or current["unexpected"]:
        delta = sorted(before ^ after)
        raise_risk("HIGH", "TEST_INVENTORY_CHANGED_OR_UNDISCOVERED", full=True, ambiguous=True)
        for name in delta:
            if name in available:
                select(name, "ADDED_TEST")
    for item in entries:
        path = item["path"]
        previous = item.get("previous_path")
        if item["status"][0] not in "M" or previous:
            raise_risk("HIGH", "NON_MODIFY_CHANGE:" + item["status"] + ":" + path, full=True)
        if path in available and not previous:
            select(path, "MODIFIED_TEST")
            raise_risk("MEDIUM", "TEST_CHANGE_UNVERIFIED_ASSERTIONS:" + path)
            continue
        if TEST.fullmatch(path) or (previous and TEST.fullmatch(previous)):
            raise_risk("HIGH", "REMOVED_RENAMED_OR_NONDISCOVERED_TEST:" + path,
                       full=True, ambiguous=True)
            continue
        if DOC_PROTECTED.match(path) or CRITICAL.match(path):
            raise_risk("HIGH", "TRUSTED_POLICY_OR_RUNTIME:" + path, full=True)
        elif SHARED.match(path):
            raise_risk("HIGH", "SHARED_STATE_CONTRACT_OR_RUNTIME:" + path, full=True)
        elif path.endswith(".module.css") and path.startswith("src/features/projects/"):
            # Visual source changes need adjacent browser coverage; do not
            # mark unknown CSS as safe without an explicit screen mapping.
            related = path.removesuffix(".module.css") + ".tsx"
            if related in SCREEN_MAP:
                raise_risk("MEDIUM", "LOCAL_STYLE_CONSUMER:" + path)
                for candidate in SCREEN_MAP[related]:
                    select(candidate, "LOCAL_STYLE_CONSUMER")
            else:
                raise_risk("HIGH", "UNMAPPED_STYLE_DEPENDENCIES:" + path,
                           full=True, ambiguous=True)
        elif path in SCREEN_MAP:
            raise_risk("MEDIUM", "EXPLICIT_SCREEN_CONSUMERS:" + path)
            for candidate in SCREEN_MAP[path]:
                select(candidate, "EXPLICIT_SCREEN_CONSUMER")
        elif DOCUMENT.match(path):
            # Documentation-only is allowed only when no protected/unknown
            # path is present in the entire change.
            reasons.append("NON_POLICY_DOCUMENT:" + path)
        elif path.startswith("src/") or path.startswith("tests/") or KNOWN_EXT.search(path):
            raise_risk("HIGH", "UNMAPPED_CODE_OR_CONSUMER:" + path,
                       full=True, ambiguous=True)
        else:
            raise_risk("HIGH", "UNKNOWN_FILE_TYPE:" + path,
                       full=True, ambiguous=True)
        if AUTH.search(path):
            raise_risk("HIGH", "SECURITY_OR_REVISION_BOUNDARY:" + path, full=True)

    for row in prepr.get("selected", []):
        select(row["path"], "LOCAL_PREPR_699:" + ",".join(row.get("reasons", [])[:2]))
    if prepr.get("unknown") or prepr.get("missing") or prepr.get("state") != "READY":
        # Existing #699 fail-closed mapping is a hard upper bound. Documents
        # alone are intentionally excluded from this blocker.
        raise_risk("HIGH", "LOCAL_PREPR_UNMAPPED_OR_MISSING", full=True, ambiguous=True)

    if any(p.startswith("src/") or p.startswith("tests/") for p in paths):
        # Identify only literal test imports. Dynamic imports and shared
        # environment/config are conservatively Full, not falsely uncovered.
        for p in paths:
            if p.startswith("src/server/") and p not in prepr.get("matched", []):
                # #699 itself records missing direct server imports in unknown.
                pass
    categories = set()
    if any("gantt" in p or "viewport" in p or "canonical" in p for p in paths):
        categories.add("gantt")
    if any(AUTH.search(p) for p in paths):
        categories.add("security")
    if any("resource" in p or "assignment" in p for p in paths):
        categories.add("resource")
    if any("milestone" in p or "calendar" in p for p in paths):
        categories.add("milestone")
    for category in sorted(categories):
        for file in CROSS[category]:
            select(file, "CROSS_LEDGER:" + category)
        for ledger in LEDGERS[category]:
            basis.add(ledger)
    # A source imported by shared contract code cannot be proven independent
    # simply because only a single changed path is visible.
    doc_only = bool(paths) and all(DOCUMENT.match(p) and not DOC_PROTECTED.match(p) for p in paths)
    if doc_only and not force_full and not unknown and not picked:
        recommendation = "DOCS_VERIFIED"
    elif force_full or unknown or risk == "HIGH":
        recommendation = "FULL_REQUIRED"
    elif picked:
        recommendation = "FAST_TARGETED"
    else:
        recommendation = "FULL_REQUIRED"
        unknown = True
        reasons.append("NO_VERIFIED_DIRECT_TEST_CONSUMER")
    selected = [{"id": p, "kind": "CHROMIUM" if p.startswith("tests/e2e/") else "UNIT",
                 "reasons": sorted(picked[p])} for p in sorted(picked)]
    excluded = [{"id": p, "reason": "ADVISORY_ONLY_NOT_IN_IMPACT_UNION"}
                for p in sorted(available - set(picked))]
    plan_core = {
        "schema": SCHEMA,
        "policy_schema_version": 1,
        "trusted_policy_blob_sha": policy_sha,
        "source": {"base_sha": base, "head_sha": head, "test_merge_sha": merge,
                   **(run or {})},
        "input_diff_fingerprint": sha256(entries),
        "changes": entries,
        "risk": risk,
        "mode_recommendation": recommendation,
        "ambiguity": "UNKNOWN" if unknown else "NONE_FOUND",
        "selected_test_ids": selected,
        "excluded_test_ids": excluded,
        "selection_basis": sorted(set(reasons)),
        "failure_ledger_basis": sorted(basis),
        "prepr_699": {"state": prepr.get("state"), "matched_rules":
                      sorted({e.get("rule", "") for e in prepr.get("matched", [])}),
                      "unknown_count": len(prepr.get("unknown", [])),
                      "missing_count": len(prepr.get("missing", []))},
        "test_inventory": {"base_unit": len(old["unit"]), "base_e2e": len(old["e2e"]),
                           "merge_unit": len(current["unit"]), "merge_e2e": len(current["e2e"])},
    }
    plan_core["test_plan_sha256"] = sha256(plan_core)
    return plan_core


def github_jobs(repo: str, run_id: int, attempt: int) -> list[dict]:
    token = os.environ.get("GH_TOKEN", "")
    if not token or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("GITHUB_API_AUTH_UNKNOWN")
    url = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100"
    request = urllib.request.Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "masterGantt-impact-shadow-v1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)
    jobs = payload.get("jobs")
    if not isinstance(jobs, list) or payload.get("total_count", 101) > 100:
        raise ValueError("GITHUB_JOB_PAGINATION_UNKNOWN")
    return jobs


def observed_ci(repo: str, run_id: int, attempt: int, event: str,
                e2e_required: bool, results: dict) -> dict:
    """Aggregate identities/attempts, not fictional test-by-test PASS values."""
    observation = {"status": "UNKNOWN", "gate_results": results,
                   "executed_test_ids": "NOT_VERIFIED",
                   "reason": "INCOMPLETE_CI_EVIDENCE", "shard_jobs": []}
    if not all(x in {"success", "failure", "cancelled", "skipped"} for x in results.values()):
        return observation
    try:
        jobs = github_jobs(repo, run_id, attempt)
    except (ValueError, urllib.error.URLError, TimeoutError, OSError):
        return observation
    by_name: dict[str, list[dict]] = {}
    for job in jobs:
        if job.get("run_attempt") != attempt:
            continue
        by_name.setdefault(job.get("name", ""), []).append(job)
    if any(len(by_name.get(gate, [])) != 1 for gate in GATES):
        observation["reason"] = "REQUIRED_GATE_JOB_MISSING_OR_DUPLICATE"
        return observation
    for gate, value in zip(GATES, ("quality", "e2e", "docker")):
        if by_name[gate][0].get("conclusion") != results[value]:
            observation["reason"] = "REQUIRED_GATE_RESULT_MISMATCH"
            return observation
    suffix = " · PR" if event == "pull_request" else ""
    expected = [f"Chromium E2E shard {n}/6{suffix}" for n in range(1, 7)]
    for name in expected:
        rows = by_name.get(name, [])
        if len(rows) != 1 or rows[0].get("status") != "completed":
            if e2e_required:
                observation["reason"] = "E2E_SHARD_MISSING_OR_PENDING"
                return observation
            continue
        row = rows[0]
        observation["shard_jobs"].append({
            "id": row["id"], "name": name, "conclusion": row.get("conclusion"),
            "started_at": row.get("started_at"), "completed_at": row.get("completed_at")})
    if e2e_required and (len(observation["shard_jobs"]) != 6 or
                         any(j["conclusion"] != "success" for j in observation["shard_jobs"])):
        observation["reason"] = "E2E_NOT_SIX_SUCCEEDED_SHARDS"
        return observation
    if any(x != "success" for x in results.values()):
        observation["status"] = "NOT_TESTED"
        observation["reason"] = "REQUIRED_CHECK_NON_SUCCESS"
    else:
        observation["status"] = "FULL_GATES_OBSERVED" if e2e_required else "SKIPPED_GATES_OBSERVED"
        observation["reason"] = "PER_TEST_EXECUTION_NOT_IN_JOB_METADATA"
    return observation


def source_context(event: dict, mode: str) -> dict:
    repo = os.environ["GITHUB_REPOSITORY"]
    run = int(os.environ["GITHUB_RUN_ID"])
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    if run < 1 or attempt < 1 or event.get("repository", {}).get("full_name") != repo:
        raise ValueError("GITHUB_EVENT_SOURCE_INVALID")
    if mode == "pr":
        pr = event["pull_request"]
        if event.get("action") not in ("opened", "reopened", "synchronize"):
            raise ValueError("NOT_FULL_PR_EVENT")
        base, head, merge = pr["base"]["sha"], pr["head"]["sha"], os.environ["GITHUB_SHA"]
        if not all(valid_sha(s) for s in (base, head, merge)):
            raise ValueError("INVALID_SOURCE_SHA")
        if git("rev-parse", "HEAD") != base:
            raise ValueError("UNTRUSTED_POLICY_CHECKOUT")
        git("fetch", "--no-tags", "origin", merge)
        parents = git("rev-list", "--parents", "-n", "1", merge).split()
        if parents != [merge, base, head]:
            raise ValueError("TEST_MERGE_PARENT_MISMATCH")
        number = int(pr["number"])
        return {"repo": repo, "run_id": run, "attempt": attempt, "base": base,
                "head": head, "merge": merge, "target": merge,
                "pr": number, "issue_observed": None}
    sha = os.environ["GITHUB_SHA"]
    if not valid_sha(sha) or git("rev-parse", "HEAD") != sha:
        raise ValueError("MAIN_SOURCE_MISMATCH")
    parents = git("rev-list", "--parents", "-n", "1", sha).split()
    if len(parents) < 2:
        raise ValueError("MAIN_PARENT_UNKNOWN")
    return {"repo": repo, "run_id": run, "attempt": attempt, "base": parents[1],
            "head": sha, "merge": "", "target": sha, "pr": None, "issue_observed": None}


def write_report(report: dict, output: str):
    path = Path(output)
    path.write_text(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                    encoding="utf-8")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("## Issue #770 — 영향 분석 SHADOW / OBSERVE (비차단)\n")
            stream.write(f"- 상태: **{report.get('evidence_status', 'UNKNOWN')}**; "
                         f"추천: **{report.get('mode_recommendation', 'FULL_REQUIRED')}**; "
                         f"위험: {report.get('risk', 'UNKNOWN')}\n")
            source = report.get("source", {})
            stream.write(f"- Source run/attempt: {source.get('run_id', 'UNKNOWN')}."
                         f"{source.get('run_attempt', 'UNKNOWN')} / head "
                         f"{source.get('head_sha', 'UNKNOWN')}\n")
            stream.write(f"- Plan SHA256: {report.get('test_plan_sha256', 'UNKNOWN')}; "
                         f"선정: {len(report.get('selected_test_ids', []))} / "
                         f"제외: {len(report.get('excluded_test_ids', []))}\n")
            stream.write(f"- 실제 검사 결과: {report.get('observed_ci', {}).get('status', 'UNKNOWN')} "
                         "(per-test PASS 판정 아님)\n")
            stream.write("- 이 추천은 기존 세 Required Check·QA·Owner/릴리스 승인에 영향을 주지 않습니다.\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("pr", "main"), required=True)
    parser.add_argument("--output", default="ci-impact-shadow.json")
    args = parser.parse_args()
    report: dict = {"schema": SCHEMA, "evidence_status": "UNKNOWN",
                    "mode_recommendation": "FULL_REQUIRED", "risk": "UNKNOWN"}
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        ctx = source_context(event, args.mode)
        base, head, merge = ctx["base"], ctx["head"], ctx["merge"]
        policy_blob = git("rev-parse", f"{base}:scripts/ci_impact_plan.py") \
            if args.mode == "pr" else git("rev-parse", f"{head}:scripts/ci_impact_plan.py")
        entries = diff_entries(base, ctx["target"])
        old, current = test_inventory(base), test_inventory(ctx["target"])
        paths = sorted({p for item in entries for p in (item["path"], item.get("previous_path")) if p})
        direct = actual_unit_imports(ctx["target"], current["unit"])
        prepr = local_prepr(paths, current, direct)
        run = {"repository": ctx["repo"], "event": "pull_request" if args.mode == "pr" else "push",
               "run_id": ctx["run_id"], "run_attempt": ctx["attempt"],
               "pr_number": ctx["pr"]}
        report = impact_plan(entries, old, current, prepr, base, head, merge, policy_blob, run)
        required = os.environ.get("E2E_REQUIRED", "").lower() == "true"
        results = {"quality": os.environ.get("NEED_QUALITY", ""),
                   "e2e": os.environ.get("NEED_E2E", ""),
                   "docker": os.environ.get("NEED_DOCKER", "")}
        report["observed_ci"] = observed_ci(ctx["repo"], ctx["run_id"], ctx["attempt"],
                                             run["event"], required, results)
        report["evidence_status"] = "OBSERVE_ONLY" if report["observed_ci"]["status"] != "UNKNOWN" else "UNKNOWN"
        report["tool_versions"] = {"python": sys.version.split()[0],
                                   "policy_blob": policy_blob,
                                   "local_prepr": "scripts/prepr-core.mjs"}
        report["authority"] = "ADVISORY_NOT_REQUIRED_NOT_QA_NOT_RELEASE"
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError,
            subprocess.TimeoutExpired) as exc:
        # Don't leak untrusted paths, tokens, request body, raw artifacts or
        # stderr. A failure is UNKNOWN rather than an implicit passing plan.
        report["error_code"] = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        report["authority"] = "ADVISORY_NOT_REQUIRED_NOT_QA_NOT_RELEASE"
    write_report(report, args.output)
    return 0  # Shadow remains nonblocking; required CI never calls this report.


if __name__ == "__main__":
    raise SystemExit(main())
