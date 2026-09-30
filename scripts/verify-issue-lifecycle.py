#!/usr/bin/env python3
"""Static contracts and pure scenarios for generic Issue lifecycle automation."""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "issue-lifecycle.yml"
AUTO_WORKFLOW = ROOT / ".github" / "workflows" / "release-finalizer.yml"
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release-image.yml"
CI_WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
IMPL = ROOT / "scripts" / "issue_lifecycle.py"
AUTO_IMPL = ROOT / "scripts" / "auto_release_finalizer.py"
WORKFLOW_DIR = ROOT / ".github" / "workflows"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


workflow = WORKFLOW.read_text(encoding="utf-8")
auto_workflow = AUTO_WORKFLOW.read_text(encoding="utf-8")
release_workflow = RELEASE_WORKFLOW.read_text(encoding="utf-8")
ci_workflow = CI_WORKFLOW.read_text(encoding="utf-8")
impl = IMPL.read_text(encoding="utf-8")
auto_impl = AUTO_IMPL.read_text(encoding="utf-8")

require("workflow_dispatch:" in workflow, "workflow_dispatch entry point is required")
require("operation:" in workflow and "verify, release, finalize, release_finalize" in workflow, "four operations are required")
require("group: issue-lifecycle-${{ inputs.issue_number }}" in workflow, "per-Issue concurrency is required")
require("queue: max" in workflow, "manual lifecycle runs must preserve queued work")
require("packages: write" not in workflow, "lifecycle workflow must not receive packages: write")
require("pull_request_target" not in workflow, "pull_request_target is forbidden")
require("merge_pull_request" not in workflow and "/merges" not in workflow, "workflow must not merge PRs")
require("scripts/safe_branch_cleanup.py" in impl, "safe branch cleanup must be reused")
require("release-image.yml" in impl, "release-image workflow must be reused")
require("merge_commit_sha" in impl, "release/finalize target must derive from PR merge_commit_sha")
require("actions/workflows/ci.yml/runs?event=push&branch=main" in impl, "exact main CI lookup is required")
require("FINAL_MARKER_PREFIX" in impl, "idempotent FINAL marker is required")
require("release_finalize" in workflow, "release_finalize workflow operation is required")
require('"release_finalize"' in impl, "release_finalize CLI operation is required")
require("if not merged:" in impl and "refs/heads/{head_branch}" in impl, "merged reruns must not require the deleted head branch")

for check in (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
):
    require(check in impl, f"required check contract missing: {check}")

require("workflow_run:" in auto_workflow, "automatic finalizer must use workflow_run")
require('workflows: ["CI"]' in auto_workflow, "automatic finalizer must subscribe only to CI")
require("branches: [main]" in auto_workflow, "automatic finalizer must filter triggering CI to main")
require("github.event.workflow_run.event == 'push'" in auto_workflow, "manual CI must not auto-finalize")
require("github.event.workflow_run.conclusion == 'success'" in auto_workflow, "failed CI must not mutate lifecycle")
require("scripts/auto_release_finalizer.py" in auto_workflow, "automatic resolver must be invoked")
require("queue: max" in auto_workflow, "automatic finalizer must retain burst events")
require("packages: write" not in auto_workflow, "automatic finalizer must delegate package writes to release-image")
require("queue: max" in release_workflow, "release image workflow must queue concurrent releases")
require("publish-commit-image:" in ci_workflow, "main temporary GHCR publish job is required")
require("always() &&" in ci_workflow, "main temporary GHCR job must defeat transitive skip propagation")
for result_check in (
    "needs.changes.result == 'success'",
    "needs.quality.result == 'success'",
    "needs.e2e.result == 'success'",
    "needs.docker.result == 'success'",
):
    require(result_check in ci_workflow, f"main temporary GHCR fail-closed result check missing: {result_check}")
require("needs.changes.outputs.docs_only != 'true'" in ci_workflow, "docs-only main pushes must not publish temporary GHCR images")
require("MAIN_ARTIFACT_JOB" in impl, "lifecycle must name the main artifact job")
require("main_change_docs_only" in impl, "lifecycle must independently classify docs-only merge targets")
require("main_artifact_gate" in impl, "lifecycle must inspect exact main artifact job result")
require("filter=latest&per_page=100" in impl, "lifecycle must inspect latest-attempt main CI jobs")
require("mastergantt-release-authorization:v1" in auto_impl, "version-scoped release authorization marker is required")
require("gh_paginated(" in auto_impl, "comment and PR pagination helper is required")
require("collect_pending_work(" in auto_impl, "first-parent backlog resolver is required")
require("current_main_sha(" in auto_impl, "dispatcher must snapshot current main")
require("oldest → newest" in auto_impl, "dispatcher must document first-parent processing order")
require("head_sha=" in auto_impl, "exact main CI lookup must bind target SHA")
require("Refs" in auto_impl, "canonical Refs #Issue resolution is required")
require("author_association" in auto_impl, "release authorization must validate trusted comment association")
require("release_finalize" in auto_impl and '"finalize"' in auto_impl, "automatic lifecycle must route release and no-release paths")

legacy_pattern = re.compile(
    r"^issue-[0-9]+.*(?:release-helper|release-finalizer|finalizer|cleanup)\.ya?ml$",
    re.IGNORECASE,
)
legacy_files = sorted(
    path.name for path in WORKFLOW_DIR.iterdir()
    if path.is_file() and legacy_pattern.match(path.name)
)
require(not legacy_files, f"legacy per-Issue lifecycle workflows remain: {', '.join(legacy_files)}")

for text_value in (workflow, auto_workflow, impl, auto_impl):
    require(not re.search(r"issue-[0-9]+", text_value, re.I), "generic lifecycle source contains hard-coded Issue helper")
    require(not re.search(r"FEATURE_PR\s*=\s*[\"']?[0-9]+", text_value), "hard-coded PR detected")


def load_module(name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


module = load_module("issue_lifecycle", IMPL)
auto = load_module("auto_release_finalizer", AUTO_IMPL)

scenarios = [
    (dict(merged=False, checks_ok=False, main_ci_ok=False, main_artifact_ok=False, release_required=False, release_authorized=False, version_ok=True), "BLOCKED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, main_artifact_ok=True, release_required=False, release_authorized=False, version_ok=True), "PASS"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, main_artifact_ok=True, release_required=True, release_authorized=True, version_ok=True), "PASS"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, main_artifact_ok=True, release_required=True, release_authorized=False, version_ok=True), "BLOCKED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=False, main_artifact_ok=False, release_required=False, release_authorized=False, version_ok=True), "NOT TESTED"),
    (dict(merged=True, checks_ok=True, main_ci_ok=True, main_artifact_ok=True, release_required=True, release_authorized=True, version_ok=False), "FAIL"),
    (dict(merged=True, checks_ok=False, main_ci_ok=True, main_artifact_ok=True, release_required=False, release_authorized=False, version_ok=True), "NOT TESTED"),
]
for kwargs, expected in scenarios:
    actual = module.mutation_gate(**kwargs)
    require(actual == expected, f"scenario mismatch: {kwargs} => {actual}, expected {expected}")

artifact_missing = dict(
    merged=True,
    checks_ok=True,
    main_ci_ok=True,
    main_artifact_ok=False,
    release_required=False,
    release_authorized=False,
    version_ok=True,
)
require(module.mutation_gate(**artifact_missing) == "NOT TESTED", "missing main artifact evidence must fail closed")

require(module.docs_only_paths(["docs/CI_CD.md", "README.md"]), "docs/root Markdown must classify docs-only")
require(not module.docs_only_paths(["docs/CI_CD.md", "scripts/tool.py"]), "non-doc file must defeat docs-only classification")
require(not module.docs_only_paths([]), "empty diff must fail safe as non-docs")

artifact_success = [{"name": module.MAIN_ARTIFACT_JOB, "status": "completed", "conclusion": "success", "html_url": "https://example.invalid/job"}]
artifact_skipped = [{"name": module.MAIN_ARTIFACT_JOB, "status": "completed", "conclusion": "skipped", "html_url": "https://example.invalid/job"}]
require(module.main_artifact_gate(artifact_success, docs_only=False)[0], "non-docs main artifact SUCCESS must pass")
require(not module.main_artifact_gate(artifact_skipped, docs_only=False)[0], "non-docs skipped artifact must fail closed")
require(module.main_artifact_gate(artifact_skipped, docs_only=True)[0], "docs-only skipped artifact must be N/A/PASS")
require(not module.main_artifact_gate([], docs_only=False)[0], "missing main artifact job must fail closed")

sha = "a" * 40
repo = "owner/repo"
exact = {
    "number": 10,
    "merged_at": "2026-09-30T00:00:00Z",
    "merge_commit_sha": sha,
    "base": {"ref": "main"},
    "head": {"repo": {"full_name": repo}},
}
require(auto.select_exact_pull_request([exact], repo=repo, target_sha=sha)["number"] == 10, "exact PR resolution failed")
require(auto.select_exact_pull_request([], repo=repo, target_sha=sha) is None, "zero exact PR must skip")
try:
    auto.select_exact_pull_request([exact, dict(exact, number=11)], repo=repo, target_sha=sha)
    raise SystemExit("ambiguous exact PR must fail closed")
except auto.AutoFinalizerError:
    pass

require(auto.resolve_issue_number("Summary\n\nRefs #350\n") == 350, "canonical Refs parsing failed")
for body in ("No issue", "Refs #1\nRefs #2\n", "Refs #1\nRefs #1\n"):
    try:
        auto.resolve_issue_number(body)
        raise SystemExit(f"ambiguous/missing Refs must fail closed: {body!r}")
    except auto.AutoFinalizerError:
        pass

marker = '<!-- mastergantt-release-authorization:v1 {"authorized":true,"expected_version":"1.2.3","note":"owner approved"} -->'
comments = [
    {"id": 1, "author_association": "CONTRIBUTOR", "body": marker, "user": {"login": "untrusted"}, "html_url": "https://example.invalid/untrusted"},
    {"id": 2, "author_association": "MEMBER", "body": marker, "user": {"login": "member"}, "html_url": "https://example.invalid/member"},
    {"id": 3, "author_association": "OWNER", "body": marker, "user": {"login": "owner"}, "html_url": "https://example.invalid/trusted"},
]
auth = auto.select_authorization(comments, expected_version="1.2.3")
require(auth is not None and auth.actor == "owner", "trusted authorization selection failed")

revoked = '<!-- mastergantt-release-authorization:v1 {"authorized":false,"expected_version":"1.2.3","note":"revoked"} -->'
try:
    auto.select_authorization(
        comments + [{"id": 4, "author_association": "OWNER", "body": revoked, "user": {"login": "owner"}, "html_url": "https://example.invalid/revoked"}],
        expected_version="1.2.3",
    )
    raise SystemExit("latest trusted revocation must block release")
except auto.AutoFinalizerBlocked:
    pass

# Pagination must read beyond the first 100 comments so later revocation/approval
# cannot be ignored.
saved_gh = auto.gh
def fake_gh(path: str):
    if path.endswith("page=1"):
        return [{"id": index} for index in range(1, 101)]
    if path.endswith("page=2"):
        return [{"id": 101}]
    return []
auto.gh = fake_gh
try:
    paged = auto.gh_paginated("/repos/owner/repo/issues/1/comments")
    require(len(paged) == 101 and paged[-1]["id"] == 101, "pagination beyond 100 comments failed")
finally:
    auto.gh = saved_gh

# Backlog ordering must be first-parent oldest -> newest, independent of the
# order in which main CI workflow_run events complete.
old_sha = "1" * 40
a_sha = "2" * 40
b_sha = "3" * 40
old = auto.WorkItem(old_sha, "0" * 40, 1, 1, "1.0.0", "1.0.0")
a_item = auto.WorkItem(a_sha, old_sha, 2, 2, "1.0.0", "1.1.0")
b_item = auto.WorkItem(b_sha, a_sha, 3, 3, "1.1.0", "1.2.0")
saved_resolve = auto.resolve_work_item
saved_boundary = auto.is_finalized_boundary
auto.resolve_work_item = lambda _repo, target: {old_sha: old, a_sha: a_item, b_sha: b_item}.get(target)
auto.is_finalized_boundary = lambda _repo, item: item.target_sha == old_sha
try:
    backlog = auto.collect_pending_work(repo, b_sha)
    require([item.target_sha for item in backlog] == [a_sha, b_sha], "first-parent backlog order failed")
finally:
    auto.resolve_work_item = saved_resolve
    auto.is_finalized_boundary = saved_boundary

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

require("release_finalize requires release_required=true" in impl, "release_finalize release_required fail-closed guard missing")
require("release_finalize requires release_authorized=true" in impl, "release_finalize authorization fail-closed guard missing")
require("release_finalize requires expected_version" in impl, "release_finalize expected_version guard missing")
require("release_finalize requires authorization_note" in impl, "release_finalize authorization_note guard missing")
require("validate_operation_inputs(args)" in impl, "release_finalize input validation must run before context resolution")

print("issue-lifecycle generic/automatic contract scenarios: PASS")
