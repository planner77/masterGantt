#!/usr/bin/env python3
"""Static contract and pure scenario checks for the generic lifecycle workflow."""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "issue-lifecycle.yml"
IMPL = ROOT / "scripts" / "issue_lifecycle.py"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


workflow = WORKFLOW.read_text(encoding="utf-8")
impl = IMPL.read_text(encoding="utf-8")

require("workflow_dispatch:" in workflow, "workflow_dispatch entry point is required")
require("operation:" in workflow and "verify, release, finalize" in workflow, "three operations are required")
require("group: issue-lifecycle-${{ inputs.issue_number }}" in workflow, "per-Issue concurrency is required")
require("packages: write" not in workflow, "lifecycle workflow must not receive packages: write")
require("pull_request_target" not in workflow, "pull_request_target is forbidden")
require("merge_pull_request" not in workflow and "/merges" not in workflow, "workflow must not merge PRs")
require("scripts/safe_branch_cleanup.py" in impl, "safe branch cleanup must be reused")
require("release-image.yml" in impl, "release-image workflow must be reused")
require("merge_commit_sha" in impl, "release/finalize target must derive from PR merge_commit_sha")
require("actions/workflows/ci.yml/runs?event=push&branch=main" in impl, "exact main CI lookup is required")
require("FINAL_MARKER_PREFIX" in impl, "idempotent FINAL marker is required")
for check in (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
):
    require(check in impl, f"required check contract missing: {check}")

# Prevent the old per-Issue helper pattern from leaking into the generic source.
for text in (workflow, impl):
    require(not re.search(r"issue-[0-9]+", text, re.I), "generic lifecycle source contains hard-coded Issue helper")
    require(not re.search(r"FEATURE_PR\s*=\s*[\"']?[0-9]+", text), "hard-coded PR detected")

spec = importlib.util.spec_from_file_location("issue_lifecycle", IMPL)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = module
spec.loader.exec_module(module)

scenarios = [
    (dict(merged=False, checks_ok=False, main_ci_ok=False, release_required=False, release_authorized=False, version_ok=True), "BLOCKED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, release_required=False, release_authorized=False, version_ok=True), "PASS"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, release_required=True, release_authorized=True, version_ok=True), "PASS"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, release_required=True, release_authorized=False, version_ok=True), "BLOCKED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, release_required=True, release_authorized=True, version_ok=False), "FAIL"),
    (dict(merged=True, checks_ok=False, main_ci_ok=True, release_required=False, release_authorized=False, version_ok=True), "NOT TESTED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=False, release_required=False, release_authorized=False, version_ok=True), "NOT TESTED"),
]
for kwargs, expected in scenarios:
    actual = module.mutation_gate(**kwargs)
    require(actual == expected, f"scenario mismatch: {kwargs} => {actual}, expected {expected}")

# Input authorization boundary scenarios.
for expected_error, values in [
    (True, ("1", "2", True, False, "", "")),
    (True, ("1", "2", False, True, "", "approved")),
    (True, ("1", "2", True, True, "1.2.3", "")),
    (False, ("1", "2", False, False, "", "")),
    (False, ("1", "2", True, True, "1.2.3", "maintainer approval")),
]:
    try:
        module.validate_inputs(*values)
        failed = False
    except module.LifecycleError:
        failed = True
    require(failed == expected_error, f"input scenario mismatch: {values}")

print("issue-lifecycle contract/scenario checks: PASS")
