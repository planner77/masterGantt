#!/usr/bin/env python3
"""Issue #771 Draft-only advisory test plan, never an authoritative CI gate."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re

SCHEMA = "mastergantt-fast-development-v1"
IMPACT_SCHEMA = "mastergantt-impact-plan-v1"
AUTHORITY = "ADVISORY_NOT_REQUIRED_NOT_QA_NOT_RELEASE"
ACTIONS_DRAFT = {"opened", "reopened", "synchronize", "converted_to_draft"}
ACTIONS_FULL = {"opened", "reopened", "synchronize", "ready_for_review"}
SHA = re.compile(r"[0-9a-f]{40}\Z")
TEST = re.compile(r"tests/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\.(?:spec|test)\.tsx?\Z")
EXTRA_PLAN_KEYS = {"test_plan_sha256", "trusted_e2e_shard_count", "observed_ci",
                   "evidence_status", "tool_versions", "authority", "error_code"}


def safe_test_id(value: object) -> bool:
    """Only repository-relative test paths; never accept '.' or '..' segments.

    A regex character class containing dots also matches the parent segment '..'.
    Validate each component after verifying the expected test-file syntax.
    """
    return (isinstance(value, str) and TEST.fullmatch(value) is not None
            and all(component not in (".", "..") for component in value.split("/")))


def pr_mode(action: str, draft: object) -> str:
    if draft is True and action in ACTIONS_DRAFT | {"edited"}:
        return "DRAFT_BLOCKED"
    if draft is False and action == "edited":
        return "METADATA_ONLY"
    if draft is False and action in ACTIONS_FULL:
        return "FINAL_FULL"
    return "UNKNOWN_BLOCKED"


def digest(body: object) -> str:
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"),
                     ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def prepared(plan: dict, event: dict, env: dict) -> dict:
    """Base-selected spec paths only, never interpret Fast as Merge Ready.

    UNKNOWN or FULL_REQUIRED deliberately select no browser tests. The separate
    official CI Required3 remain red for Draft, even after this workflow passes.
    """
    pr = event.get("pull_request") or {}
    source = plan.get("source") or {}
    head = (pr.get("head") or {}).get("sha")
    base = (pr.get("base") or {}).get("sha")
    result = {
        "schema": SCHEMA, "execution_mode": "FAST_DEVELOPMENT",
        "authority": AUTHORITY, "plan_status": "UNKNOWN",
        "recommendation": "FULL_REQUIRED", "browser_selection": [],
        "selection_status": "UNKNOWN_PLAN_E2E_NOT_RUN", "pr_number": pr.get("number"),
        "run_id": env.get("GITHUB_RUN_ID"), "run_attempt": env.get("GITHUB_RUN_ATTEMPT"),
        "head_sha": head, "base_sha": base, "test_merge_sha": env.get("GITHUB_SHA"),
        "actual_test_result": "NOT_TESTED",
    }
    if pr_mode(event.get("action"), pr.get("draft")) != "DRAFT_BLOCKED" or (
            event.get("action") not in ACTIONS_DRAFT):
        result["selection_status"] = "NON_DRAFT_OR_UNSUPPORTED_EVENT"
        return result
    try:
        source_pairs = (
            (source.get("repository"), env.get("GITHUB_REPOSITORY")),
            (source.get("pr_number"), pr.get("number")),
            (source.get("run_id"), int(env.get("GITHUB_RUN_ID", "0"))),
            (source.get("run_attempt"), int(env.get("GITHUB_RUN_ATTEMPT", "0"))),
            (source.get("head_sha"), head), (source.get("base_sha"), base),
            (source.get("test_merge_sha"), env.get("GITHUB_SHA")),
        )
    except (ValueError, TypeError):
        result["selection_status"] = "RUN_ATTEMPT_UNVERIFIED"
        return result
    if (plan.get("schema") != IMPACT_SCHEMA or
            plan.get("authority") != AUTHORITY or
            plan.get("evidence_status") != "PLAN_VERIFIED_NON_AUTHORITATIVE" or
            any(a != b for a, b in source_pairs) or
            any(not isinstance(value, str) or not SHA.fullmatch(value)
                for value in (head, base, env.get("GITHUB_SHA"))) or
            not isinstance(plan.get("test_plan_sha256"), str) or
            plan["test_plan_sha256"] != digest({
                k: v for k, v in plan.items() if k not in EXTRA_PLAN_KEYS
            })):
        result["selection_status"] = "SOURCE_OR_PLAN_HASH_UNVERIFIED"
        return result
    inventory = plan.get("test_inventory") or {}
    selected = plan.get("selected_test_ids")
    excluded = plan.get("excluded_test_ids")
    if (not isinstance(selected, list) or not isinstance(excluded, list) or
            not all(type(inventory.get(k)) is int and inventory[k] >= 0
                    for k in ("merge_unit", "merge_e2e"))):
        result["selection_status"] = "TEST_INVENTORY_UNVERIFIED"
        return result
    total = inventory["merge_unit"] + inventory["merge_e2e"]
    if len(selected) + len(excluded) != total:
        result["selection_status"] = "TEST_INVENTORY_INCOMPLETE"
        return result
    identities = []
    for item in selected:
        if (not isinstance(item, dict) or
                item.get("kind") not in ("UNIT", "CHROMIUM") or
                not safe_test_id(item.get("id")) or
                (item["kind"] == "CHROMIUM") != item["id"].startswith("tests/e2e/")):
            result["selection_status"] = "SELECTED_TEST_PATH_INVALID"
            return result
        identities.append(item["id"])
    for item in excluded:
        if (not isinstance(item, dict) or
                not safe_test_id(item.get("id"))):
            result["selection_status"] = "EXCLUDED_TEST_PATH_INVALID"
            return result
        identities.append(item["id"])
    if len(set(identities)) != total:
        result["selection_status"] = "TEST_INVENTORY_DUPLICATE_OR_MISSING"
        return result
    recommendation = plan.get("mode_recommendation")
    if recommendation not in ("FAST_TARGETED", "FULL_REQUIRED", "DOCS_VERIFIED"):
        result["selection_status"] = "UNKNOWN_RECOMMENDATION"
        return result
    result["plan_status"] = "VERIFIED_BASE_POLICY_ADVISORY"
    result["recommendation"] = recommendation
    result["test_plan_sha256"] = plan["test_plan_sha256"]
    result["risk"] = plan.get("risk", "UNKNOWN")
    result["selected_test_count"] = len(selected)
    result["excluded_test_count"] = len(excluded)
    result["trusted_e2e_shard_count"] = plan.get("trusted_e2e_shard_count")
    if recommendation == "FAST_TARGETED" and plan.get("ambiguity") == "NONE_FOUND":
        result["browser_selection"] = [x["id"] for x in selected
                                       if x["kind"] == "CHROMIUM"]
        result["selection_status"] = ("TARGETED_E2E_PLANNED_NON_AUTHORITATIVE"
                                      if result["browser_selection"]
                                      else "UNIT_ONLY_E2E_NOT_TESTED")
    elif recommendation == "DOCS_VERIFIED" and not selected:
        result["selection_status"] = "DOCS_ONLY_NO_E2E"
    else:
        result["selection_status"] = "FULL_REQUIRED_E2E_NOT_RUN"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("prepare",))
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    try:
        plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        plan = {}
    result = prepared(plan, event, os.environ)
    Path(args.output).write_text(
        json.dumps(result, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
            stream.write("node=" + ("false" if result["selection_status"] == "DOCS_ONLY_NO_E2E" else "true") + "\n")
            stream.write("browser=" + ("true" if result["browser_selection"] else "false") + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write("## FAST_DEVELOPMENT — NOT authoritative\n")
            stream.write("- Required3: BLOCKED until matching FINAL_FULL Quality/E2E8/Docker and Trusted QA\n")
            stream.write("- Source: PR #{}, run {}.{}, Head {}, Base {}, Test-Merge {}\n".format(
                result["pr_number"], result["run_id"], result["run_attempt"],
                result["head_sha"], result["base_sha"], result["test_merge_sha"]))
            stream.write("- Plan: {} / {} / {} / SHA {}\n".format(
                result["plan_status"], result["recommendation"],
                result["selection_status"], result.get("test_plan_sha256", "UNKNOWN")))
            stream.write("- Selected browser specs: {} (not yet executed)\n".format(
                len(result["browser_selection"])))
            stream.write("- Excluded tests are NOT TESTED; no Full, QA, merge or release PASS\n")
    return 0  # Advisory preparation never makes an authoritative decision.


if __name__ == "__main__":
    raise SystemExit(main())
