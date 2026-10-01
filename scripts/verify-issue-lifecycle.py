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
TRACE_IMPL = ROOT / "scripts" / "verify-ci-run-trace.py"
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
trace_impl = TRACE_IMPL.read_text(encoding="utf-8")

require(re.search(r"^name: CI$", ci_workflow, re.MULTILINE) is not None, "Finalizer가 참조하는 CI workflow 이름을 유지해야 합니다")
run_name = next((line for line in ci_workflow.splitlines() if line.startswith("run-name:")), "")
require("github.event.pull_request.title" in run_name, "PR CI 실행 제목에 Issue 번호를 포함한 PR 제목이 필요합니다")
require("github.event.head_commit.message" in run_name and "github.ref_name" in run_name, "main·수동 CI 실행 제목의 대체값이 필요합니다")

require("run-name:" in ci_workflow, "CI workflow run-name is required")
require("github.event.pull_request.title" in ci_workflow, "PR CI run-name must carry the PR title/Primary Issue trace")
require("github.event.pull_request.number" in ci_workflow, "PR CI run-name must carry the PR number")
require("github.event.head_commit.message" in ci_workflow, "main CI run-name must carry merge commit trace metadata")
require("inputs.issue_number" in ci_workflow, "manual CI run-name must support an optional Primary Issue")
require("github.run_number" in ci_workflow and "github.run_attempt" in ci_workflow, "CI run-name must distinguish run and re-run attempt")
require("scripts/verify-ci-run-trace.py" in ci_workflow, "CI must validate Primary Issue trace metadata before heavy jobs")

require("run-name:" in workflow, "Issue lifecycle run-name is required")
for token in ("inputs.issue_number", "inputs.pr_number", "inputs.operation", "github.run_number", "github.run_attempt"):
    require(token in workflow, f"Issue lifecycle run-name trace token missing: {token}")

require("run-name:" in auto_workflow, "automatic finalizer run-name is required")
require("github.event.workflow_run.display_title" in auto_workflow, "finalizer must inherit the triggering Main CI display title")
require("github.run_number" in auto_workflow and "github.run_attempt" in auto_workflow, "finalizer run-name must distinguish attempts")

require("run-name:" in release_workflow, "release image run-name is required")
for token in ("inputs.issue_number", "inputs.pr_number", "github.ref_name", "github.run_number", "github.run_attempt"):
    require(token in release_workflow, f"release run-name trace token missing: {token}")
require("issue_number:" in release_workflow and "pr_number:" in release_workflow, "release workflow_dispatch trace inputs are required")
require('"inputs[issue_number]"' in impl and '"inputs[pr_number]"' in impl, "lifecycle release dispatch must forward Issue/PR trace inputs")
require("REF_RE" in trace_impl and "BRANCH_ISSUE_RE" in trace_impl and "TITLE_ISSUE_RE" in trace_impl, "CI trace validator contracts are required")

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
require("actions/workflows/ci.yml/runs" in impl, "exact main CI lookup is required")
require("head_sha={sha}" in impl, "exact main CI query must bind head_sha server-side")
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
require("coalesce_consecutive_issue_retries(" in auto_impl, "same-Issue corrective merge convergence is required")
require("supersede_failed_issue_retries(" in auto_impl, "non-adjacent same-Issue retry supersession is required")
require("validation_docs_only" in auto_impl, "coalescing must preserve validation scope")
require("--cleanup-pr" in auto_impl and "--cleanup-pr" in impl, "coalesced PR cleanup identities must reach lifecycle finalize")
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
trace = load_module("verify_ci_run_trace", TRACE_IMPL)

trace_pr_payload = {
    "number": 362,
    "pull_request": {
        "number": 362,
        "title": "[Issue #361] ci: Workflow 실행 추적 표준화",
        "body": "요약\n\nRefs #361\n",
        "head": {"ref": "ci/issue-361-workflow-run-trace"},
    },
}
require(trace.validate_pull_request(trace_pr_payload) == (361, 362), "valid PR trace metadata must pass")
try:
    trace.validate_pull_request(
        {
            "number": 362,
            "pull_request": {
                "number": 362,
                "title": "[Issue #360] 잘못된 추적",
                "body": "Refs #361\n",
                "head": {"ref": "ci/issue-361-workflow-run-trace"},
            },
        }
    )
except trace.TraceError:
    pass
else:
    raise SystemExit("mismatched PR title/Primary Issue must fail")

trace_push_payload = {
    "ref": "refs/heads/main",
    "head_commit": {
        "message": (
            "Merge pull request #362 from planner77/ci/issue-361-workflow-run-trace\n\n"
            "[Issue #361] ci: Workflow 실행 추적 표준화"
        )
    },
}
require(trace.validate_push(trace_push_payload) == (361, 362), "merge commit trace metadata must resolve Issue/PR")
require(trace.validate_dispatch({"inputs": {"issue_number": "361"}}) == (361, None), "manual CI Primary Issue must validate")
require(trace.validate_dispatch({"inputs": {}}) == (None, None), "manual CI without Issue must use fallback")


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
# exact_main_ci must bind the SHA in the API query and reject wrong-SHA data.
test_repo = "owner/repo"
test_sha = "a" * 40
saved_lifecycle_gh = module.gh
requested_paths = []
def fake_lifecycle_gh(path: str, *, method: str = "GET", fields=None):
    requested_paths.append(path)
    if "/actions/workflows/ci.yml/runs" in path:
        return {
            "workflow_runs": [
                {
                    "id": 77,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "success",
                    "created_at": "2026-09-30T00:00:00Z",
                    "html_url": "https://example.invalid/run/77",
                }
            ]
        }
    if "/actions/runs/77/jobs" in path:
        return {
            "jobs": [
                {
                    "name": module.MAIN_ARTIFACT_JOB,
                    "status": "completed",
                    "conclusion": "success",
                    "html_url": "https://example.invalid/job/77",
                }
            ]
        }
    return {}
module.gh = fake_lifecycle_gh
try:
    ci_ok, ci_url, artifact_ok, artifact_evidence = module.exact_main_ci(
        test_repo, test_sha, docs_only=False
    )
    require(ci_ok and artifact_ok, "exact SHA main CI/artifact evidence must pass")
    require(ci_url.endswith("/run/77"), "exact main CI URL must be preserved")
    require(any(f"head_sha={test_sha}" in path for path in requested_paths), "exact main CI request must include head_sha")
finally:
    module.gh = saved_lifecycle_gh

saved_lifecycle_gh = module.gh
def fake_wrong_sha(path: str, *, method: str = "GET", fields=None):
    if "/actions/workflows/ci.yml/runs" in path:
        return {
            "workflow_runs": [
                {
                    "id": 78,
                    "head_sha": "b" * 40,
                    "status": "completed",
                    "conclusion": "success",
                    "created_at": "2026-09-30T00:00:00Z",
                    "html_url": "https://example.invalid/run/78",
                }
            ]
        }
    return {}
module.gh = fake_wrong_sha
try:
    ci_ok, ci_url, artifact_ok, _ = module.exact_main_ci(test_repo, test_sha, docs_only=False)
    require(not ci_ok and ci_url is None and not artifact_ok, "wrong SHA main CI must fail closed")
finally:
    module.gh = saved_lifecycle_gh


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

# Adjacent corrective merges for the same Issue converge only when their
# validation scope is equivalent. Collapsed PR identities remain cleanup
# obligations. Different Issue or docs-only/non-docs scope prevents convergence.
retry_one = auto.WorkItem("4" * 40, old_sha, 10, 344, "0.58.3", "0.58.4", False)
retry_two = auto.WorkItem("5" * 40, "4" * 40, 11, 344, "0.58.4", "0.58.5", False)
collapsed = auto.coalesce_consecutive_issue_retries([retry_one, retry_two])
require(len(collapsed) == 1, "adjacent same-Issue retries with equal scope must converge")
require(collapsed[0].target_sha == retry_two.target_sha, "latest retry target must win")
require(collapsed[0].pr_number == retry_two.pr_number, "latest retry PR must win")
require(collapsed[0].cleanup_pr_numbers == (retry_one.pr_number,), "earlier retry PR must remain a cleanup obligation")
require(collapsed[0].first_parent_sha == retry_one.first_parent_sha, "version span must start before first retry")
require(collapsed[0].previous_version == "0.58.3" and collapsed[0].current_version == "0.58.5", "version span must cover all adjacent retries")
docs_followup = auto.WorkItem("6" * 40, retry_one.target_sha, 12, 344, "0.58.4", "0.58.4", True)
scope_split = auto.coalesce_consecutive_issue_retries([retry_one, docs_followup])
require(len(scope_split) == 2, "docs-only/non-docs validation scope mismatch must prevent convergence")
other_issue = auto.WorkItem("7" * 40, retry_one.target_sha, 13, 999, "0.58.4", "0.58.4", False)
not_collapsed = auto.coalesce_consecutive_issue_retries([retry_one, other_issue, retry_two])
require(len(not_collapsed) == 3, "different Issue boundary must prevent convergence")
cleanup_command = auto.lifecycle_command(
    operation="finalize",
    issue_number=344,
    pr_number=11,
    release_required=False,
    release_authorized=False,
    expected_version="",
    authorization_note="",
    cleanup_pr_numbers=(10,),
)
require(cleanup_command[-2:] == ["--cleanup-pr", "10"], "collapsed cleanup PR must be forwarded to lifecycle")
parsed_cleanup = module.build_parser().parse_args(
    ["finalize", "--issue", "344", "--pr", "11", "--cleanup-pr", "10", "--cleanup-pr", "9"]
)
require(parsed_cleanup.cleanup_pr == [10, 9], "lifecycle must accept repeated cleanup PR identities")

# A failed older attempt may be superseded by a later Green corrective merge
# for the same Issue even when independent Issues are in between. Intervening
# work keeps first-parent order and the older branch becomes cleanup debt of
# the corrective target.
failed_344 = auto.WorkItem("8" * 40, "0" * 40, 20, 344, "0.58.3", "0.58.4", False)
middle_356 = auto.WorkItem("9" * 40, "8" * 40, 21, 356, "0.58.4", "0.58.5", False)
fixed_344 = auto.WorkItem("a" * 40, "9" * 40, 22, 344, "0.58.5", "0.58.6", False)
planned, superseded = auto.supersede_failed_issue_retries(
    [failed_344, middle_356, fixed_344],
    {failed_344.target_sha: False, middle_356.target_sha: True, fixed_344.target_sha: True},
)
require([item.issue_number for item in planned] == [356, 344], "intervening Issue order must be preserved")
require(len(superseded) == 1 and superseded[0] == (failed_344, fixed_344), "failed attempt must map to later corrective target")
require(planned[-1].cleanup_pr_numbers == (20,), "superseded PR must become corrective cleanup obligation")

docs_repair = auto.WorkItem("b" * 40, "9" * 40, 23, 344, "0.58.5", "0.58.5", True)
not_planned, not_superseded = auto.supersede_failed_issue_retries(
    [failed_344, middle_356, docs_repair],
    {failed_344.target_sha: False, middle_356.target_sha: True, docs_repair.target_sha: True},
)
require(not_superseded == [], "docs-only corrective target must not cover failed non-docs attempt")
require(not_planned[0] == failed_344, "uncovered failed attempt must remain the first blocker")

waiting_planned, waiting_superseded = auto.supersede_failed_issue_retries(
    [failed_344, middle_356, fixed_344],
    {failed_344.target_sha: False, middle_356.target_sha: True, fixed_344.target_sha: False},
)
require(waiting_superseded == [], "non-Green corrective target must not supersede earlier failure")
require(waiting_planned[0] == failed_344, "failed attempt must remain until corrective exact main CI succeeds")

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
