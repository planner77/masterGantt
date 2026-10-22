#!/usr/bin/env python3
"""Issue #772: base-trusted LOW policy for optional authoritative targeted Chromium.

No PR metadata or PR-controlled scripts are executable decision inputs. Activation
requires a repository Owner-controlled variable, proven shadow runs and a separate
Owner decision. Until then the only executable policy is FULL_REQUIRED.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

import ci_impact_plan as impact

SCHEMA = "mastergantt-low-e2e-policy-v1"
CANDIDATE = "TARGETED_POLICY_CANDIDATE"
TARGETED = "TARGETED_POLICY_VERIFIED"
FULL = "FULL_REQUIRED"
DOCS = "DOCS_ONLY_VERIFIED"
# A single, noninteractive paragraph inside an existing screen. Do not widen
# to arbitrary JSX literals, controls, CSS, accessibility names or new paths.
ALLOW_COPY = "src/features/projects/project-settings-dialog.tsx"
PARAGRAPH = re.compile(
    r"(<div className=\{styles\.sessionCard\}>\s*"
    r"<h4>편집 세션 관리</h4>\s*<p>\s*)([^<>{}\r\n]+)(\s*</p>)"
)
WORK_PACKET = re.compile(r"^docs/exec-plans/active/ISSUE_[1-9]\d*\.md$")
# All three are base-inventoried, known negative/adjacent browser contracts;
# #770 independently adds its mapped direct and other inferred tests.
ADJACENT_NEGATIVE = (
    "tests/e2e/project-settings-layout-490.spec.ts",
    "tests/e2e/project-edit-authorization.spec.ts",
    "tests/e2e/project-edit-permission-recheck.spec.ts",
)
HEX40 = re.compile(r"^[a-f0-9]{40}$")
HEX64 = re.compile(r"^[a-f0-9]{64}$")


class Refused(ValueError):
    pass


def require(ok: bool, reason: str):
    if not ok:
        raise Refused(reason)


def digest(obj: object) -> str:
    return hashlib.sha256(
        json.dumps(obj, ensure_ascii=False, sort_keys=True,
                   separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def pure_paragraph_edit(old: str, new: str) -> bool:
    """Require exactly one plain-text paragraph changed; exact rest of file equal."""
    before, after = list(PARAGRAPH.finditer(old)), list(PARAGRAPH.finditer(new))
    if len(before) != 1 or len(after) != 1:
        return False
    a, b = before[0], after[0]
    old_text, new_text = a.group(2), b.group(2)
    if (old_text == new_text or not (15 <= len(old_text.strip()) <= 250) or
            not (15 <= len(new_text.strip()) <= 250) or
            "\u2028" in new_text or "\u2029" in new_text):
        return False
    return (old[:a.start(2)] == new[:b.start(2)] and
            old[a.end(2):] == new[b.end(2):])


def classify(entries: list[dict], before: dict, after: dict,
             recommendation: dict, old_text: str, new_text: str,
             *, same_repo: bool, enabled: bool) -> tuple[str, list[str], list[str]]:
    """An independent LOW allowlist layered over #770's trusted impact union."""
    reasons: list[str] = []
    if not enabled:
        return FULL, [], ["OWNER_FLAG_OFF"]
    if not same_repo:
        return FULL, [], ["FORK_OR_REPOSITORY_UNVERIFIED"]
    if not entries:
        return FULL, [], ["EMPTY_DIFF"]
    if before["all"] != after["all"] or before["unexpected"] or after["unexpected"]:
        return FULL, [], ["TEST_RENAME_REMOVAL_OR_INVENTORY_DRIFT"]
    changes = [item for item in entries if not WORK_PACKET.fullmatch(item["path"])]
    if not changes:
        if entries and all(
            impact.DOCUMENT.match(row["path"]) and
            not impact.DOC_PROTECTED.match(row["path"]) and
            row["status"] in ("A", "M") and not row.get("previous_path")
            for row in entries
        ):
            return DOCS, [], ["DOCS_ONLY_NON_PROTECTED"]
        return FULL, [], ["DOCS_ONLY_UNTRUSTED"]
    # Explicit scope: ONE screen and accompanying Work Packet only.
    if (len(changes) != 1 or changes[0].get("path") != ALLOW_COPY or
            changes[0].get("status") != "M" or changes[0].get("previous_path")):
        return FULL, [], ["PATH_OUTSIDE_STRICT_LOW_ALLOWLIST"]
    if not pure_paragraph_edit(old_text, new_text):
        return FULL, [], ["NOT_EXACT_NONINTERACTIVE_PARAGRAPH_EDIT"]
    if (recommendation.get("mode_recommendation") != "FAST_TARGETED" or
            recommendation.get("ambiguity") != "NONE_FOUND" or
            recommendation.get("risk") == "HIGH"):
        return FULL, [], ["TRUSTED_IMPACT_MAP_NOT_TARGETABLE"]
    selected = {
        row.get("id") for row in recommendation.get("selected_test_ids", [])
        if row.get("kind") == "CHROMIUM"
    }
    actual = set(after["e2e"])
    required = set(ADJACENT_NEGATIVE)
    if (not selected or not required <= actual or
            not selected <= actual or not selected <= set(before["e2e"])):
        return FULL, [], ["DIRECT_ADJACENT_NEGATIVE_COVERAGE_MISSING"]
    selected |= required
    reasons.extend(["EXACT_NONINTERACTIVE_COPY_ONLY",
                    "BASE_MAPPED_DIRECT_PLUS_ADJACENT_NEGATIVE"])
    return CANDIDATE, sorted(selected), reasons


def build_plan(event: dict, env: dict) -> dict:
    """Run only from the immutable PR base checkout with git object data."""
    # #770 authenticates checkout/base/head/test-merge and correct parent order.
    ctx = impact.source_context(event, "pr")
    pr = event["pull_request"]
    require(pr.get("draft") is False and
            event.get("action") in ("opened", "reopened", "synchronize",
                                     "ready_for_review"), "NOT_READY_FINAL_PR")
    require(pr.get("base", {}).get("ref") == "main", "BASE_NOT_MAIN")
    base, merge = ctx["base"], ctx["merge"]
    entries = impact.diff_entries(base, merge)
    old, current = impact.test_inventory(base), impact.test_inventory(merge)
    # The required per-Issue Work Packet is provenance documentation, not a
    # runtime/selection dependency. Authenticate its path then exclude it only
    # from the #770 technical dependency classifier (not the full diff hash).
    dependency_entries = [row for row in entries if not WORK_PACKET.fullmatch(row["path"])]
    paths = sorted({x for row in dependency_entries for x in
                    (row["path"], row.get("previous_path")) if x})
    direct = impact.actual_unit_imports(merge, current["unit"])
    prepr = impact.local_prepr(paths, current, direct)
    hazards = impact.detect_hazards(merge, entries)
    policy_sha = impact.git("rev-parse", f"{base}:scripts/ci_low_policy.py")
    selector_sha = impact.git("rev-parse", f"{base}:scripts/ci_impact_plan.py")
    full_patch = impact.git("diff", "--no-ext-diff", "--binary", base, merge,
                            "--", binary=True)
    selection = impact.impact_plan(
        dependency_entries, old, current, prepr, base, ctx["head"], merge, selector_sha,
        run={"repository": ctx["repo"], "event": "pull_request",
             "run_id": ctx["run_id"], "run_attempt": ctx["attempt"],
             "pr_number": ctx["pr"]}, hazards=hazards,
        diff_fingerprint=hashlib.sha256(full_patch).hexdigest()
    )
    same_repo = (pr.get("head", {}).get("repo", {}).get("full_name") == ctx["repo"] and
                 pr.get("base", {}).get("repo", {}).get("full_name") == ctx["repo"])
    eligible = any(row["path"] == ALLOW_COPY for row in entries)
    old_text = impact.git_file(base, ALLOW_COPY) if eligible else ""
    new_text = impact.git_file(merge, ALLOW_COPY) if eligible else ""
    enabled = env.get("LOW_TARGETED_POLICY_ENABLED") == "true"
    mode, specs, reasons = classify(
        entries, old, current, selection, old_text, new_text,
        same_repo=same_repo, enabled=enabled
    )
    result = {
        "schema": SCHEMA, "mode": mode, "authority": "BASE_TRUSTED_PLAN_NOT_PASS",
        "source": {"repository": ctx["repo"], "pr_number": ctx["pr"],
                   "run_id": ctx["run_id"], "run_attempt": ctx["attempt"],
                   "base_sha": base, "head_sha": ctx["head"],
                   "test_merge_sha": merge},
        "policy_blob_sha": policy_sha, "selector_blob_sha": selector_sha,
        "diff_sha256": hashlib.sha256(full_patch).hexdigest(),
        "shadow_plan_sha256": selection["test_plan_sha256"],
        "selected_test_ids": specs, "selected_count": len(specs),
        "excluded_test_ids": [
            row["id"] for row in selection["excluded_test_ids"]
            if row["kind"] == "CHROMIUM" and row["id"] not in specs
        ],
        "selection_reasons": reasons,
        # #770 classifies entire screen paths as MEDIUM. The stricter #772
        # byte-for-byte paragraph whitelist alone can resolve semantic LOW.
        "shadow_risk": selection["risk"],
        "effective_risk": "LOW" if mode == CANDIDATE else selection["risk"],
        "shadow_mode": selection["mode_recommendation"],
        "trusted_test_inventory": len(current["e2e"]),
        "activation": "OWNER_OPT_IN" if enabled else "OFF",
        "verification": "NOT_RUN"
    }
    result["plan_sha256"] = digest(result)
    return result


def assert_plan(current: dict, uploaded: dict):
    require(current == uploaded, "STALE_OR_TAMPERED_PLAN")
    require(uploaded.get("mode") == CANDIDATE and
            uploaded.get("verification") == "NOT_RUN" and
            uploaded.get("authority") == "BASE_TRUSTED_PLAN_NOT_PASS",
            "NOT_A_TARGETED_CANDIDATE")
    require(type(uploaded.get("selected_count")) is int and
            uploaded["selected_count"] >= 3 and
            len(uploaded.get("selected_test_ids", [])) == uploaded["selected_count"],
            "INVALID_SELECTED_TEST_SET")
    require(all(isinstance(x, str) and x.startswith("tests/e2e/") and
                x.endswith(".spec.ts") and ".." not in x.split("/")
                for x in uploaded["selected_test_ids"]), "UNSAFE_TEST_PATH")


def normalize_spec(name: str) -> str:
    safe = name.replace("\\", "/")
    require(safe and not safe.startswith("/") and ".." not in safe.split("/"),
            "REPORT_FILE_OUTSIDE_E2E")
    # Playwright JSON uses testDir-relative paths; other versions use repo-
    # relative paths. Both are matched to an authenticated base selection.
    if "/tests/e2e/" in safe:
        result = "tests/e2e/" + safe.rsplit("/tests/e2e/", 1)[1]
    else:
        result = safe if safe.startswith("tests/e2e/") else "tests/e2e/" + safe
    require(".." not in result.split("/"), "UNSAFE_REPORT_PATH")
    return result


def reporter_coverage(report: dict, specs: list[str]) -> dict:
    """Validate actual Playwright JSON, not job success/skipped step or --list."""
    stats = report.get("stats") or {}
    for field in ("expected", "unexpected", "flaky", "skipped"):
        require(type(stats.get(field)) is int and stats[field] >= 0,
                "REPORT_STATS_NOT_AUTHENTICATED")
    require(stats["expected"] > 0 and not any(stats[x] for x in
            ("unexpected", "flaky", "skipped")), "TEST_NOT_ALL_PASS")
    actual_files: set[str] = set()
    case_count = 0
    def visit(suites):
        nonlocal case_count
        for suite in suites:
            for spec in suite.get("specs", []):
                file = normalize_spec(str(spec.get("file") or suite.get("file") or ""))
                actual_files.add(file)
                tests = spec.get("tests")
                require(isinstance(tests, list) and bool(tests), "UNEXECUTED_TEST_SPEC")
                for test in tests:
                    results = test.get("results") or []
                    require(len(results) == 1 and
                            results[0].get("status") == "passed" and
                            test.get("expectedStatus") == "passed" and
                            test.get("status") == "expected",
                            "FAILED_RETRIED_SKIPPED_OR_UNKNOWN_CASE")
                    case_count += 1
            visit(suite.get("suites", []))
    visit(report.get("suites") or [])
    require(case_count == stats["expected"] and
            actual_files == set(specs), "SELECTED_COVERAGE_MISMATCH")
    return {"actual_test_case_count": case_count,
            "actual_test_file_count": len(actual_files), "skipped": 0,
            "failed": 0, "flaky": 0, "not_run": 0,
            "actual_test_ids": sorted(actual_files)}


def attest(plan: dict, actual: dict, reporter: dict) -> dict:
    assert_plan(plan, actual)
    coverage = reporter_coverage(reporter, plan["selected_test_ids"])
    receipt = {
        "schema": SCHEMA, "mode": TARGETED,
        "authority": "BASE_TRUSTED_EXECUTION_ATTESTED_NOT_OWNER_APPROVAL",
        "source": plan["source"],
        "plan_sha256": plan["plan_sha256"],
        "policy_blob_sha": plan["policy_blob_sha"],
        "selector_blob_sha": plan["selector_blob_sha"],
        "diff_sha256": plan["diff_sha256"],
        "shadow_plan_sha256": plan["shadow_plan_sha256"],
        "selected_test_ids": plan["selected_test_ids"],
        "excluded_test_ids": plan["excluded_test_ids"],
        "selection_reasons": plan["selection_reasons"],
        "execution": coverage
    }
    receipt["receipt_sha256"] = digest(receipt)
    return receipt


def validate_receipt(plan: dict, receipt: dict, *,
                     source: dict, jobs: dict) -> bool:
    """Additional default-main/Lifecycle guard; not an independently trusted flag."""
    require(plan.get("schema") == SCHEMA and plan.get("mode") == CANDIDATE,
            "LOW_SOURCE_PLAN_MISSING")
    require(plan.get("source") == source and
            receipt.get("source") == source and
            plan.get("activation") == "OWNER_OPT_IN", "LOW_SOURCE_MISMATCH")
    require(receipt.get("schema") == SCHEMA and receipt.get("mode") == TARGETED and
            receipt.get("authority") == "BASE_TRUSTED_EXECUTION_ATTESTED_NOT_OWNER_APPROVAL",
            "UNVERIFIED_TARGETED_MODE")
    require(plan.get("plan_sha256") == digest({k: v for k, v in plan.items()
                                               if k != "plan_sha256"}),
            "PLAN_HASH_MISMATCH")
    require(receipt.get("receipt_sha256") == digest({k: v for k, v in receipt.items()
                                                    if k != "receipt_sha256"}),
            "RECEIPT_HASH_MISMATCH")
    for field in ("plan_sha256", "policy_blob_sha", "selector_blob_sha",
                  "diff_sha256", "shadow_plan_sha256", "selected_test_ids",
                  "excluded_test_ids", "selection_reasons"):
        reference = plan["plan_sha256"] if field == "plan_sha256" else plan.get(field)
        require(receipt.get(field) == reference, "RECEIPT_PLAN_UNBOUND:" + field)
    selected = plan.get("selected_test_ids") or []
    evidence = receipt.get("execution") or {}
    require(len(selected) >= 3 and len(selected) == len(set(selected)) and
            all(test in selected for test in ADJACENT_NEGATIVE) and
            evidence.get("actual_test_ids") == selected and
            evidence.get("actual_test_file_count") == len(selected) and
            type(evidence.get("actual_test_case_count")) is int and
            evidence["actual_test_case_count"] > 0 and
            all(evidence.get(k) == 0 for k in ("failed", "flaky", "skipped", "not_run")),
            "UNEXECUTED_OR_INCOMPLETE_TESTS")
    require(jobs.get("Low E2E policy plan (trusted base)") == "success" and
            jobs.get("Low E2E targeted execution") == "success" and
            jobs.get("Chromium end-to-end tests") == "success" and
            not any(k.startswith("Chromium E2E shard ") and v == "success"
                    for k, v in jobs.items()), "TARGETED_JOB_TOPOLOGY_MISMATCH")
    return True


def write(path: str, body: dict):
    Path(path).write_text(json.dumps(body, sort_keys=True, indent=2,
                                     ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=("plan", "attest"), required=True)
    ap.add_argument("--plan", default="ci-low-plan.json")
    ap.add_argument("--receipt", default="ci-low-receipt.json")
    ap.add_argument("--reporter", default="ci-low-playwright.json")
    args = ap.parse_args()
    try:
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text("utf-8"))
        plan = build_plan(event, os.environ)
        if args.stage == "plan":
            write(args.plan, plan)
            output = os.environ.get("GITHUB_OUTPUT")
            if output:
                with Path(output).open("a", encoding="utf-8") as h:
                    h.write("mode=" + plan["mode"] + "\n")
            print(f"Issue #772 plan: {plan['mode']} "
                  f"specs={plan['selected_count']} reason={plan['selection_reasons']}")
            # Any uncertainty downgrades to FULL, never green Targeted.
            return 0
        uploaded = json.loads(Path(args.plan).read_text("utf-8"))
        reporter = json.loads(Path(args.reporter).read_text("utf-8"))
        receipt = attest(plan, uploaded, reporter)
        write(args.receipt, receipt)
        print(f"Issue #772: {TARGETED}; "
              f"{receipt['execution']['actual_test_case_count']} cases passed.")
        return 0
    except (Refused, ValueError, OSError, KeyError, TypeError,
            json.JSONDecodeError) as exc:
        # Planner errors cannot grant Targeted, even when the plan job failed.
        if args.stage == "plan":
            result = {"schema": SCHEMA, "mode": FULL,
                      "reason": type(exc).__name__, "verification": "NOT_RUN"}
            write(args.plan, result)
            output = os.environ.get("GITHUB_OUTPUT")
            if output:
                with Path(output).open("a", encoding="utf-8") as h:
                    h.write("mode=" + FULL + "\n")
            print("Issue #772 FULL_REQUIRED; plan unavailable: " + type(exc).__name__)
            return 0
        print("Issue #772 target execution BLOCKED: " + type(exc).__name__,
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
