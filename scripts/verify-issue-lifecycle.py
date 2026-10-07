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
RESUME_WORKFLOW = ROOT / ".github" / "workflows" / "release-finalizer-resume.yml"
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
resume_workflow = RESUME_WORKFLOW.read_text(encoding="utf-8")
release_workflow = RELEASE_WORKFLOW.read_text(encoding="utf-8")
ci_workflow = CI_WORKFLOW.read_text(encoding="utf-8")
impl = IMPL.read_text(encoding="utf-8")
auto_impl = AUTO_IMPL.read_text(encoding="utf-8")
trace_impl = TRACE_IMPL.read_text(encoding="utf-8")

require(re.search(r"^name: CI$", ci_workflow, re.MULTILINE) is not None, "Finalizer가 참조하는 CI workflow 이름을 유지해야 합니다")
require("github.event.pull_request.title" in ci_workflow, "PR CI 실행 제목에 Issue 번호를 포함한 PR 제목이 필요합니다")
require("github.event.head_commit.message" in ci_workflow and "github.ref_name" in ci_workflow, "main·수동 CI 실행 제목의 대체값이 필요합니다")

require("run-name:" in ci_workflow, "CI workflow run-name is required")
require("github.event.pull_request.title" in ci_workflow, "PR CI run-name must carry the PR title/Primary Issue trace")
require("github.event.pull_request.number" in ci_workflow, "PR CI run-name must carry the PR number")
require("github.event.head_commit.message" in ci_workflow, "main CI run-name must carry merge commit trace metadata")
require("inputs.issue_number" in ci_workflow, "manual CI run-name must support an optional Primary Issue")
require("github.run_number" in ci_workflow and "github.run_attempt" in ci_workflow, "CI run-name must distinguish run and re-run attempt")
require("scripts/verify-ci-run-trace.py" in ci_workflow, "CI must validate Primary Issue trace metadata before heavy jobs")
require("types: [opened, reopened, synchronize, edited]" in ci_workflow, "pull_request edited event must rerun trace validation")
require("github.event.action != \'edited\'" in ci_workflow, "PR metadata edits must not route heavy CI jobs")
require("format('ci-pr-{0}-{1}'" in ci_workflow and "'metadata' || 'full'" in ci_workflow, "metadata edits must use a separate concurrency group from full PR CI")
require("metadata_evidence:" in ci_workflow, "metadata-only CI must verify prior full-run evidence")
require("PR metadata가 기존 전체 CI 증거를 보존하는지 검증" in ci_workflow, "metadata evidence job name is required")
require("metadata_only" in ci_workflow, "CI summary must expose metadata-only routing")
require('CI_E2E_FULLY_PARALLEL: "true"' in ci_workflow, "PR/Main E2E shards must use balanced test-level distribution")

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
require("packages: write" in workflow, "lifecycle finalize operations need scoped packages: write for temporary GHCR cleanup")
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
require('workflows: ["Publish release image"]' in resume_workflow, "release completion resume must keep release-image workflow_run fallback")
require("workflow_dispatch:" in resume_workflow and "target_sha:" in resume_workflow and "release_run_id:" in resume_workflow, "release completion resume must accept exact target_sha and release_run_id workflow_dispatch")
require("github.event.workflow_run.conclusion == 'success'" in resume_workflow, "failed release completion must not mutate lifecycle")
require("packages: write" in auto_workflow, "automatic finalizer needs scoped packages: write for temporary GHCR cleanup")
require("packages: write" in resume_workflow, "release completion finalizer needs scoped packages: write for backlog cleanup")
require("actions: write" in auto_workflow, "automatic finalizer needs actions: write to dispatch release-image workflows")
require("actions: write" in resume_workflow, "release completion finalizer needs actions: write to dispatch the next release-image workflow")
require("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}" in auto_workflow, "automatic finalizer must expose the job-scoped package token to cleanup helper")
require("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}" in resume_workflow, "release completion finalizer must expose the job-scoped package token to cleanup helper")
require(workflow.count("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}") >= 3, "manual release/finalize operations must expose the job-scoped token for authenticated git/package mutations")
release_job = workflow.split("  release:", 1)[1].split("\n  finalize:", 1)[0]
require("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}" in release_job, "manual release job must expose GITHUB_TOKEN for authenticated SemVer tag push")
require("ref: main" in resume_workflow, "release completion resume must execute trusted main code")
require("ref: ${{ github.event.workflow_run.head_sha }}" not in resume_workflow, "release completion resume must not execute triggering tag/manual ref code")
require("actions/runs/$RELEASE_RUN_ID" in resume_workflow, "explicit release resume must wait on the exact source release run")
require('"$status" == "completed"' in resume_workflow and '"$conclusion" == "success"' in resume_workflow, "explicit release resume must require completed successful source evidence")
require('"$head_sha" == "$TARGET_SHA"' in resume_workflow, "explicit release resume must bind source run head SHA to target SHA")
require('"$workflow_path" == ".github/workflows/release-image.yml"' in resume_workflow, "explicit release resume must bind source run to release-image workflow")
require("scripts/auto_release_finalizer.py" in resume_workflow, "release completion resume must invoke the generic resolver")
require("group: mastergantt-release-finalizer" in resume_workflow, "release resume must share finalizer serialization")
require("queue: max" in resume_workflow, "release resume must preserve queued completion events")
require("github.event.workflow_run.event == 'push'" in auto_workflow, "manual CI must not auto-finalize")
require("github.event.workflow_run.conclusion == 'success'" in auto_workflow, "failed CI must not mutate lifecycle")
require("scripts/auto_release_finalizer.py" in auto_workflow, "automatic resolver must be invoked")
require("queue: max" in auto_workflow, "automatic finalizer must retain burst events")
require("packages: write" in auto_workflow, "automatic finalizer needs scoped package write for temporary candidate cleanup")
require("docker/build-push-action@" not in auto_workflow and "docker buildx imagetools create" not in auto_workflow, "automatic finalizer must not build or promote formal release images")
require("release-image.yml" in auto_impl and "dispatch_release(" in impl, "formal release publication must remain delegated to release-image")
require("queue: max" in release_workflow, "release image workflow must queue concurrent releases")
require("release_e2e_shard:" in release_workflow, "release E2E must be sharded")
require("Release Chromium E2E shard ${{ matrix.shard }}/6" in release_workflow, "release E2E must keep six shards")
require('CI_E2E_FULLY_PARALLEL: "true"' in release_workflow, "release E2E must use balanced test-level distribution")
require("needs: [prepare, quality_static, release_e2e_shard]" in release_workflow, "release aggregate must wait for static and E2E gates")
require("Main verified candidate exact digest 확인" in release_workflow, "release must consume the verified main candidate")
require("target_sha:" in release_workflow and 'git rev-parse "refs/tags/${GITHUB_REF_NAME}^{commit}"' in release_workflow, "release candidate must bind to annotated tag target commit")
require("EXPECTED_SHA: ${{ needs.prepare.outputs.target_sha }}" in release_workflow, "release candidate lookup must use the exact tag target SHA")
require("docker buildx imagetools create" in release_workflow, "release must promote an existing verified digest")
require("--prefer-index=false" in release_workflow, "single-source digest promotion must preserve manifest format")
require("Digest promotion changed the verified digest" in release_workflow, "release must fail if promotion changes the verified digest")
require("릴리스 후보 Project·Task API persistence 검증" in release_workflow, "candidate API persistence must pass before publication")
require("verified candidate digest GitHub Attestation" in release_workflow, "optional attestation must target the verified candidate before tag publication")
require("최종 exact·rolling tag를 verified digest로 promotion" in release_workflow, "exact and rolling tags must be created only in the final publication step")
require("release-finalizer-resume.yml/dispatches" in release_workflow, "successful release must explicitly dispatch lifecycle resume")
require("inputs[target_sha]" in release_workflow, "release resume dispatch must bind exact target_sha")
require("inputs[release_run_id]" in release_workflow and "GITHUB_RUN_ID" in release_workflow, "release resume dispatch must identify the exact source release run")
require("needs.publish.result == 'success'" in release_workflow, "release resume handoff must run only after successful publication")
require("continue-on-error: true" in release_workflow, "post-publication lifecycle handoff must not invalidate immutable release success")
require(release_workflow.index("릴리스 후보 Project·Task API persistence 검증") < release_workflow.index("최종 exact·rolling tag를 verified digest로 promotion"), "candidate API smoke must precede exact tag publication")
require(release_workflow.index("verified candidate digest GitHub Attestation") < release_workflow.index("최종 exact·rolling tag를 verified digest로 promotion"), "attestation must precede exact tag publication")
require(release_workflow.index("최종 exact·rolling tag를 verified digest로 promotion") < release_workflow.index("release-finalizer-resume.yml/dispatches"), "lifecycle handoff must occur only after publication")
require("docker/build-push-action@" not in release_workflow, "release workflow must not rebuild the container")
require("version_changed:" in ci_workflow and "current_version:" in ci_workflow, "main CI must classify release candidate version changes")
require("verified ci-${GITHUB_SHA} retained until Generic Release Finalizer resolves release or cleanup" in ci_workflow, "successful non-docs main CI must hand the verified candidate to Generic Finalizer")
handoff_index = ci_workflow.index("GHCR main commit image lifecycle handoff")
failed_cleanup_index = ci_workflow.index('node scripts/delete-ghcr-package-version-by-tag.mjs "ci-${GITHUB_SHA}"')
retention_index = ci_workflow.index("verified ci-${GITHUB_SHA} retained until Generic Release Finalizer resolves release or cleanup")
require(handoff_index < failed_cleanup_index < retention_index, "main CI must clean failed pushed candidates before successful lifecycle handoff")
require('if [[ "${{ job.status }}" != "success" ]]' in ci_workflow, "main CI candidate cleanup must be restricted to failed validation")
require("GHCR_OWNER_TYPE: ${{ github.event.repository.owner.type }}" in ci_workflow, "main failed-candidate cleanup must bind repository owner type")
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
require("cleanup_temporary_main_candidate" in impl, "lifecycle finalize must own temporary GHCR cleanup")
require("scripts/delete-ghcr-package-version-by-tag.mjs" in impl, "lifecycle cleanup must reuse the fail-closed GHCR delete helper")
require("GHCR_OWNER_TYPE" in impl and "GHCR_PACKAGE_NAME" in impl, "lifecycle cleanup must bind repository owner/package identity")
require("main_change_docs_only" in impl, "lifecycle must independently classify docs-only merge targets")
require("main_artifact_gate" in impl, "lifecycle must inspect exact main artifact job result")
require("filter=latest&per_page=100" in impl, "lifecycle must inspect latest-attempt main CI jobs")
require("mastergantt-release-authorization:v1" in auto_impl, "version-scoped release authorization marker is required")
require("gh_paginated(" in auto_impl, "comment and PR pagination helper is required")
require("collect_pending_work(" in auto_impl, "first-parent backlog resolver is required")
require("def is_closed_issue(" in auto_impl, "closed Issue skip classifier is required")
require("replace(item, actionable=False)" in auto_impl, "closed unmarked Issue must remain as a non-actionable ordering barrier")
require("coalesced[-1].actionable" in auto_impl and "item.actionable" in auto_impl, "retry coalescing must not cross non-actionable closed barriers")
require("pending_with_barriers" in auto_impl and "if item.actionable" in auto_impl, "closed ordering barriers must be filtered only after adjacency-sensitive coalescing")
require("return issue.get(\"state\") == \"closed\"" not in auto_impl.split("def is_finalized_boundary", 1)[1].split("def is_closed_issue", 1)[0], "closed Issue must not be treated as an exact finalized boundary")
require("coalesce_consecutive_issue_retries(" in auto_impl, "same-Issue corrective merge convergence is required")
require("supersede_failed_issue_retries(" in auto_impl, "non-adjacent same-Issue retry supersession is required")
require("exact_release_state(" in auto_impl, "formal release evidence classification is required")
require("def run_git_remote(" in impl, "lifecycle remote Git operations must use process-scoped authentication")
require('run_git_remote("ls-remote"' in impl and 'run_git_remote("fetch"' in impl, "lifecycle tag lookup/fetch must use authenticated Git remote helper")
require("def run_git_remote(" in auto_impl, "automatic finalizer remote Git evidence must use process-scoped authentication")
require('run_git_remote(' in auto_impl and '"ls-remote"' in auto_impl and 'run_git_remote("fetch"' in auto_impl, "automatic finalizer tag lookup/fetch must use authenticated Git remote helper")
require("validation_docs_only" in auto_impl, "coalescing must preserve validation scope")
require("--cleanup-pr" in auto_impl and "--cleanup-pr" in impl, "coalesced PR cleanup identities must reach lifecycle finalize")
require("current_main_sha(" in auto_impl, "dispatcher must snapshot current main")
require("oldest → newest" in auto_impl, "dispatcher must document first-parent processing order")
require("head_sha=" in auto_impl, "exact main CI lookup must bind target SHA")
require("Refs" in auto_impl, "canonical Refs #Issue resolution is required")
require("author_association" in auto_impl, "release authorization must validate trusted comment association")
require("release_start" in auto_impl and "release_finalize" in auto_impl and '"finalize"' in auto_impl, "automatic lifecycle must route release start, release completion, and no-release paths")
require('release_state in {"not-started", "tagged"}' in auto_impl, "not-started and tagged-without-run states must route to asynchronous release_start")
require('release_state in {"in-progress", "failed"}' in auto_impl, "only active/failed release states may defer without cleanup")
require("release_runs(" in impl and "REDISPATCHED" in impl, "existing exact tag without release run evidence must be safely redispatched")

legacy_pattern = re.compile(
    r"^issue-[0-9]+.*(?:release-helper|release-finalizer|finalizer|cleanup)\.ya?ml$",
    re.IGNORECASE,
)
legacy_files = sorted(
    path.name for path in WORKFLOW_DIR.iterdir()
    if path.is_file() and legacy_pattern.match(path.name)
)
require(not legacy_files, f"legacy per-Issue lifecycle workflows remain: {', '.join(legacy_files)}")

for text_value in (workflow, auto_workflow, resume_workflow, impl, auto_impl):
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

dependabot_payload = {
    "number": 900,
    "repository": {"full_name": "planner77/masterGantt"},
    "pull_request": {
        "number": 900,
        "title": "Bump docker/login-action from ...",
        "body": "Bumps docker/login-action.",
        "user": {"login": "dependabot[bot]"},
        "head": {
            "ref": "dependabot/github_actions/docker/login-action-4",
            "repo": {"full_name": "planner77/masterGantt"},
        },
    },
}
require(
    trace.validate_pull_request(dependabot_payload) == (None, 900),
    "Dependabot PR trace metadata must use the trusted automation exception",
)
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

try:
    trace.validate_pull_request(
        {
            "number": 362,
            "pull_request": {
                "number": 362,
                "title": "[Issue #361] 추적 개선 (#999)",
                "body": "Refs #361\n",
                "head": {"ref": "ci/issue-361-workflow-run-trace"},
            },
        }
    )
except trace.TraceError:
    pass
else:
    raise SystemExit("multi-Issue PR title must fail")

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

saved_lifecycle_gh = module.gh
required_check_payloads = [
    {
        "id": 201,
        "name": "Build, static checks, and unit tests",
        "status": "completed",
        "conclusion": "success",
        "app": {"slug": "github-actions"},
    },
    {
        "id": 101,
        "name": "Build, static checks, and unit tests",
        "status": "completed",
        "conclusion": "failure",
        "app": {"slug": "github-actions"},
    },
    {
        "id": 202,
        "name": "Chromium end-to-end tests",
        "status": "completed",
        "conclusion": "success",
        "app": {"slug": "github-actions"},
    },
    {
        "id": 102,
        "name": "Chromium end-to-end tests",
        "status": "completed",
        "conclusion": "cancelled",
        "app": {"slug": "github-actions"},
    },
    {
        "id": 203,
        "name": "Docker build and runtime smoke test",
        "status": "completed",
        "conclusion": "success",
        "app": {"slug": "github-actions"},
    },
    {
        "id": 103,
        "name": "Docker build and runtime smoke test",
        "status": "completed",
        "conclusion": "failure",
        "app": {"slug": "github-actions"},
    },
]
def fake_required_checks(path: str, *, method: str = "GET", fields=None):
    if "/check-runs" in path:
        return {"check_runs": required_check_payloads}
    return {}
module.gh = fake_required_checks
try:
    checks_ok, missing = module.required_checks_ok("owner/repo", "a" * 40)
    require(checks_ok and not missing, "latest successful duplicate required checks must pass")
    required_check_payloads.append(
        {
            "id": 301,
            "name": "Chromium end-to-end tests",
            "status": "completed",
            "conclusion": "failure",
            "app": {"slug": "github-actions"},
        }
    )
    checks_ok, missing = module.required_checks_ok("owner/repo", "a" * 40)
    require(
        not checks_ok and missing == ["Chromium end-to-end tests"],
        "newer failed required check must override older success",
    )
finally:
    module.gh = saved_lifecycle_gh

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
def fake_duplicate_main_runs(path: str, *, method: str = "GET", fields=None):
    if "/actions/workflows/ci.yml/runs" in path:
        return {
            "workflow_runs": [
                {
                    "id": 79,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "failure",
                    "created_at": "2026-09-30T00:05:00Z",
                    "html_url": "https://example.invalid/run/79",
                },
                {
                    "id": 77,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "success",
                    "created_at": "2026-09-30T00:00:00Z",
                    "html_url": "https://example.invalid/run/77",
                },
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
    if "/actions/runs/79/jobs" in path:
        return {
            "jobs": [
                {
                    "name": module.MAIN_ARTIFACT_JOB,
                    "status": "completed",
                    "conclusion": "failure",
                    "html_url": "https://example.invalid/job/79",
                }
            ]
        }
    return {}
module.gh = fake_duplicate_main_runs
try:
    ci_ok, ci_url, artifact_ok, artifact_evidence = module.exact_main_ci(
        test_repo, test_sha, docs_only=False
    )
    require(ci_ok and artifact_ok, "older exact-SHA successful main CI with valid artifact must remain authoritative")
    require(ci_url.endswith("/run/77"), "duplicate later failure must not mask successful exact-SHA main CI evidence")
    require("/job/77" in artifact_evidence, "artifact evidence must come from selected successful main CI")
finally:
    module.gh = saved_lifecycle_gh

saved_auto_gh = auto.gh
def fake_auto_duplicate_main_runs(path: str):
    if "/actions/workflows/ci.yml/runs" in path:
        return {
            "workflow_runs": [
                {
                    "id": 79,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "failure",
                    "created_at": "2026-09-30T00:05:00Z",
                    "html_url": "https://example.invalid/run/79",
                },
                {
                    "id": 77,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "success",
                    "created_at": "2026-09-30T00:00:00Z",
                    "html_url": "https://example.invalid/run/77",
                },
            ]
        }
    return {}
auto.gh = fake_auto_duplicate_main_runs
try:
    ci_ok, ci_url = auto.exact_main_ci_success(test_repo, test_sha)
    require(ci_ok and ci_url.endswith("/run/77"), "auto finalizer must preserve successful exact-SHA evidence across later duplicate failure")
finally:
    auto.gh = saved_auto_gh

saved_auto_gh = auto.gh
def fake_auto_all_failed(path: str):
    if "/actions/workflows/ci.yml/runs" in path:
        return {
            "workflow_runs": [
                {
                    "id": 78,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "failure",
                    "created_at": "2026-09-30T00:00:00Z",
                    "html_url": "https://example.invalid/run/78",
                },
                {
                    "id": 79,
                    "head_sha": test_sha,
                    "status": "completed",
                    "conclusion": "cancelled",
                    "created_at": "2026-09-30T00:05:00Z",
                    "html_url": "https://example.invalid/run/79",
                },
            ]
        }
    return {}
auto.gh = fake_auto_all_failed
try:
    ci_ok, ci_url = auto.exact_main_ci_success(test_repo, test_sha)
    require(not ci_ok and ci_url.endswith("/run/79"), "all-failure diagnostics must retain the newest exact-SHA run URL")
finally:
    auto.gh = saved_auto_gh

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
saved_closed = auto.is_closed_issue
auto.resolve_work_item = lambda _repo, target: {old_sha: old, a_sha: a_item, b_sha: b_item}.get(target)
auto.is_finalized_boundary = lambda _repo, item: item.target_sha == old_sha
auto.is_closed_issue = lambda _repo, _item: False
try:
    backlog = auto.collect_pending_work(repo, b_sha)
    require([item.target_sha for item in backlog] == [a_sha, b_sha], "first-parent backlog order failed")
finally:
    auto.resolve_work_item = saved_resolve
    auto.is_finalized_boundary = saved_boundary
    auto.is_closed_issue = saved_closed

# A new merge can reference an Issue that was already finalized/closed by an
# older exact target.  The new closed/no-marker merge must not be mutated and
# must not hide an older unfinished target behind it.
closed_sha = "f" * 40
pending_sha = "e" * 40
finalized_sha = "d" * 40
finalized_item = auto.WorkItem(finalized_sha, "0" * 40, 470, 452, "0.85.0", "0.85.1")
pending_item = auto.WorkItem(pending_sha, finalized_sha, 471, 461, "0.85.1", "0.86.0")
closed_item = auto.WorkItem(closed_sha, pending_sha, 474, 452, "0.86.0", "0.86.0")
saved_resolve = auto.resolve_work_item
saved_boundary = auto.is_finalized_boundary
saved_closed = auto.is_closed_issue
auto.resolve_work_item = lambda _repo, target: {
    finalized_sha: finalized_item,
    pending_sha: pending_item,
    closed_sha: closed_item,
}.get(target)
auto.is_finalized_boundary = lambda _repo, item: item.target_sha == finalized_sha
auto.is_closed_issue = lambda _repo, item: item.target_sha == closed_sha
try:
    backlog = auto.collect_pending_work(repo, closed_sha)
    require(
        [item.target_sha for item in backlog] == [pending_sha, closed_sha],
        "closed/no-marker latest merge must remain in traversal while older pending target stays discoverable",
    )
    require(
        [item.actionable for item in backlog] == [True, False],
        "closed/no-marker merge must be a non-actionable ordering barrier",
    )
    coalesced = auto.coalesce_consecutive_issue_retries(backlog)
    require(
        [item.target_sha for item in coalesced if item.actionable] == [pending_sha],
        "closed ordering barrier must be filtered only after adjacency-sensitive processing",
    )
finally:
    auto.resolve_work_item = saved_resolve
    auto.is_finalized_boundary = saved_boundary
    auto.is_closed_issue = saved_closed

# Two pending retries for the same Issue must not become adjacent when a
# closed/no-marker merge sits between them in first-parent order.
retry_before_barrier = auto.WorkItem("c" * 40, finalized_sha, 480, 500, "1.0.0", "1.1.0")
closed_barrier = auto.WorkItem("b" * 40, retry_before_barrier.target_sha, 481, 452, "1.1.0", "1.1.0", actionable=False)
retry_after_barrier = auto.WorkItem("a" * 40, closed_barrier.target_sha, 482, 500, "1.1.0", "1.2.0")
barrier_sequence = auto.coalesce_consecutive_issue_retries(
    [retry_before_barrier, closed_barrier, retry_after_barrier]
)
require(
    [item.target_sha for item in barrier_sequence] == [
        retry_before_barrier.target_sha,
        closed_barrier.target_sha,
        retry_after_barrier.target_sha,
    ],
    "closed ordering barrier must prevent same-Issue retry coalescing across intervening merge",
)
require(
    [item.target_sha for item in barrier_sequence if item.actionable] == [
        retry_before_barrier.target_sha,
        retry_after_barrier.target_sha,
    ],
    "barrier filtering must preserve both actionable retry targets",
)

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


# A target whose exact main CI passed but immutable formal release repeatedly
# failed may also be superseded by a later Green corrective merge for the same
# Issue. A candidate that already has failed release evidence is not eligible.
release_failed_331 = auto.WorkItem("c" * 40, "0" * 40, 30, 331, "0.65.0", "0.65.1", False)
middle_329 = auto.WorkItem("d" * 40, "c" * 40, 31, 329, "0.65.1", "0.66.0", False)
fixed_331 = auto.WorkItem("e" * 40, "d" * 40, 32, 331, "0.66.0", "0.67.1", False)
release_planned, release_superseded = auto.supersede_failed_issue_retries(
    [release_failed_331, middle_329, fixed_331],
    {
        release_failed_331.target_sha: True,
        middle_329.target_sha: True,
        fixed_331.target_sha: True,
    },
    {
        release_failed_331.target_sha: True,
        middle_329.target_sha: False,
        fixed_331.target_sha: False,
    },
)
require(
    [item.issue_number for item in release_planned] == [329, 331],
    "formal release failure supersession must preserve intervening Issue order",
)
require(
    release_superseded == [(release_failed_331, fixed_331)],
    "failed immutable release must map to later same-Issue corrective target",
)
require(
    release_planned[-1].cleanup_pr_numbers == (30,),
    "release-failed PR must become corrective cleanup obligation",
)

failed_candidate_planned, failed_candidate_superseded = auto.supersede_failed_issue_retries(
    [release_failed_331, fixed_331],
    {release_failed_331.target_sha: True, fixed_331.target_sha: True},
    {release_failed_331.target_sha: True, fixed_331.target_sha: True},
)
require(
    failed_candidate_superseded == [],
    "candidate with failed formal release evidence must not supersede an older target",
)
require(
    failed_candidate_planned[0] == release_failed_331,
    "older release failure must remain blocker without a healthy corrective target",
)

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

require('args.operation not in {"release_start", "release_finalize"}' in impl, "release_start/release_finalize input validation must share fail-closed guards")
require('f"{args.operation} requires release_required=true"' in impl, "release mutation release_required fail-closed guard missing")
require('f"{args.operation} requires release_authorized=true"' in impl, "release mutation authorization fail-closed guard missing")
require('f"{args.operation} requires expected_version"' in impl, "release mutation expected_version guard missing")
require('f"{args.operation} requires authorization_note"' in impl, "release mutation authorization_note guard missing")
require("validate_operation_inputs(args)" in impl, "release_finalize input validation must run before context resolution")

# Release tag push must preserve persist-credentials:false and inject the
# job-scoped token only into the git subprocess environment.  The token must
# never appear in command arguments.
require("def push_git_refs(" in impl, "authenticated release tag push helper is required")
require("GIT_CONFIG_KEY_0" in impl and "http.https://github.com/.extraheader" in impl, "git push must use command-scoped HTTPS auth config")
require("GIT_CONFIG_VALUE_0" in impl and "AUTHORIZATION: basic" in impl, "git push auth header contract is required")
require('push_git_refs(f"refs/tags/{tag}")' in impl, "release start/fallback paths must use authenticated tag push")
require('run("git", "push", "origin", f"refs/tags/{tag}")' not in impl, "unauthenticated release tag push must not remain")
require('"git", "ls-remote"' not in impl, "unauthenticated lifecycle tag lookup must not remain")
require('run("git", "fetch", "--force", "origin", f"refs/tags/{tag}:refs/tags/{tag}")' not in impl, "unauthenticated lifecycle tag fetch must not remain")
require("persist-credentials: false" in resume_workflow, "release completion resume must keep checkout credentials non-persistent")
require("persist-credentials: false" in auto_workflow, "automatic finalizer must keep checkout credentials non-persistent")
release_job = workflow.split("  release:", 1)[1].split("\n  finalize:", 1)[0]
finalize_job = workflow.split("  finalize:", 1)[1].split("\n\n  release_finalize:", 1)[0]
release_finalize_job = workflow.split("  release_finalize:", 1)[1]
for job_name, job_text in (
    ("release", release_job),
    ("finalize", finalize_job),
    ("release_finalize", release_finalize_job),
):
    require("persist-credentials: false" in job_text, f"manual {job_name} job must keep checkout credentials non-persistent")

saved_run = module.run
saved_token = __import__("os").environ.get("GITHUB_TOKEN")
push_calls = []
def fake_run(*args, check=True, env=None):
    push_calls.append((args, env))
    return type("Result", (), {"returncode": 0, "stdout": "", "stderr": ""})()
module.run = fake_run
__import__("os").environ["GITHUB_TOKEN"] = "test-token"
try:
    module.push_git_refs("refs/tags/v9.9.9")
    require(len(push_calls) == 1, "authenticated git push helper must invoke one git command")
    push_args, push_env = push_calls[0]
    require(push_args == ("git", "push", "origin", "refs/tags/v9.9.9"), "git push refs must remain exact")
    require("test-token" not in " ".join(push_args), "GITHUB_TOKEN must not be exposed in git command arguments")
    require(push_env is not None and push_env.get("GIT_CONFIG_COUNT") == "2", "git auth config must be process-scoped")
    require(push_env.get("GIT_CONFIG_KEY_0") == "http.https://github.com/.extraheader", "git auth reset header key mismatch")
    require(push_env.get("GIT_CONFIG_VALUE_0") == "", "inherited git auth header must be reset before injecting token")
    require(push_env.get("GIT_CONFIG_KEY_1") == "http.https://github.com/.extraheader", "git auth header key mismatch")
    require(push_env.get("GIT_CONFIG_VALUE_1", "").startswith("AUTHORIZATION: basic "), "git auth header value missing")
finally:
    module.run = saved_run
    if saved_token is None:
        __import__("os").environ.pop("GITHUB_TOKEN", None)
    else:
        __import__("os").environ["GITHUB_TOKEN"] = saved_token

saved_run = module.run
saved_token = __import__("os").environ.pop("GITHUB_TOKEN", None)
module.run = fake_run
try:
    try:
        module.push_git_refs("refs/tags/v9.9.9")
        raise SystemExit("missing GITHUB_TOKEN must fail closed before git push")
    except module.LifecycleError:
        pass
finally:
    module.run = saved_run
    if saved_token is not None:
        __import__("os").environ["GITHUB_TOKEN"] = saved_token

# Automatic finalizer tag evidence reads use the same process-scoped auth
# contract as lifecycle tag push/read paths.
saved_auto_run = auto.run
saved_auto_token = __import__("os").environ.get("GITHUB_TOKEN")
auto_calls = []
def fake_auto_run(*args, check=True, env=None):
    auto_calls.append((args, check, env))
    return type("Result", (), {"returncode": 0, "stdout": "", "stderr": ""})()
auto.run = fake_auto_run
__import__("os").environ["GITHUB_TOKEN"] = "test-token"
try:
    auto.run_git_remote("ls-remote", "--exit-code", "--tags", "origin", "refs/tags/v9.9.9", check=False)
    require(len(auto_calls) == 1, "automatic finalizer authenticated remote helper must invoke one git command")
    auto_args, auto_check, auto_env = auto_calls[0]
    require(auto_args[0:3] == ("git", "ls-remote", "--exit-code"), "automatic finalizer remote command mismatch")
    require(auto_check is False, "automatic finalizer remote helper must preserve check=False")
    require(auto_env is not None and auto_env.get("GIT_CONFIG_COUNT") == "2", "automatic finalizer auth config must be process-scoped")
    require(auto_env.get("GIT_CONFIG_VALUE_0") == "", "automatic finalizer must reset inherited auth header")
    require(auto_env.get("GIT_CONFIG_VALUE_1", "").startswith("AUTHORIZATION: basic "), "automatic finalizer auth header missing")
    require("test-token" not in " ".join(auto_args), "automatic finalizer token must not appear in command arguments")
finally:
    auto.run = saved_auto_run
    if saved_auto_token is None:
        __import__("os").environ.pop("GITHUB_TOKEN", None)
    else:
        __import__("os").environ["GITHUB_TOKEN"] = saved_auto_token

print("issue-lifecycle generic/automatic contract scenarios: PASS")
