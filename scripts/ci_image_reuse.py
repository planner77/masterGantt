#!/usr/bin/env python3
"""Issue #836: independent, trusted Main PR→OCI source gate.

Run only from the final Main SHA in a read-only job. PR data/artifacts are never
executed as scripts. Default SHADOW observes and rebuilds; opt-in requires an
independent Owner decision. BLOCKED evidence never silently becomes a rebuild.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from typing import Any

from verified_oci import OciError, validate_archive, require
from ci_image_contract import ContractError, verify as verify_build_contract

REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SHA_RE = re.compile(r"^[a-f0-9]{40}$")
MAX_ZIP = 3 * 1024**3
SENSITIVE_INPUTS = (
    ".github/workflows/ci.yml", ".github/workflows/release-image.yml",
    "scripts/verified_oci.py", "scripts/ci_image_contract.py",
    "scripts/ci_image_reuse.py", "scripts/verify_ci_image_release.py",
    "scripts/verify-image-policy.sh", "scripts/verify-transport-smoke.sh",
    "scripts/verify-compose-smoke.sh", "scripts/qa_final_automated.py",
    "scripts/verify-ci-run-trace.py",
)
REQUIRED = (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
)
PR_DOCKER = "Docker smoke 구현"


class Ineligible(Exception):
    """Normal source/input/artifact absence; rebuild Main."""
    pass


class Blocked(Exception):
    """Possible trust, integrity or authorization failure; do not promote."""
    pass


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()


def github(path: str, token: str, *, binary: bool = False) -> Any:
    url = "https://api.github.com/" + path.lstrip("/")
    request = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "masterGantt-issue-836",
    })
    # Prevent credentials from crossing the host boundary on redirected blob URLs.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, hdrs, newurl):
            return None
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
            data = response.read()
    except urllib.error.HTTPError as error:
        if error.code in (302, 303, 307) and binary:
            location = error.headers.get("Location", "")
            if not location.startswith("https://"):
                raise Blocked("ARTIFACT_INSECURE_REDIRECT")
            req = urllib.request.Request(location, headers={"User-Agent": "masterGantt-issue-836"})
            with urllib.request.urlopen(req, timeout=180) as download:
                content = io.BytesIO()
                size = 0
                while True:
                    chunk = download.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_ZIP:
                        raise Blocked("ARTIFACT_ZIP_TOO_LARGE")
                    content.write(chunk)
            return content.getvalue()
        if error.code == 404:
            raise Ineligible("GITHUB_SOURCE_OR_ARTIFACT_ABSENT") from error
        raise Blocked(f"GITHUB_API_HTTP_{error.code}") from error
    except (OSError, ValueError) as error:
        raise Blocked("GITHUB_API_UNKNOWN") from error
    if binary:
        return data
    try:
        return json.loads(data)
    except (ValueError, UnicodeError) as error:
        raise Blocked("GITHUB_JSON_INVALID") from error


def page_items(repo: str, endpoint: str, key: str, token: str, *, pages: int = 3) -> list[dict]:
    results: list[dict] = []
    for page in range(1, pages + 1):
        sep = "&" if "?" in endpoint else "?"
        response = github(f"repos/{repo}/{endpoint}{sep}per_page=100&page={page}", token)
        items = response.get(key) if isinstance(response, dict) else response
        if not isinstance(items, list):
            raise Blocked("GITHUB_PAGINATION_INVALID")
        results.extend(items)
        if len(items) < 100:
            return results
    raise Ineligible("SOURCE_SEARCH_WINDOW_EXCEEDED")


def artifact_metadata(repo: str, run_id: int, name: str, token: str) -> dict:
    artifacts = page_items(repo, f"actions/runs/{run_id}/artifacts",
                           "artifacts", token, pages=2)
    selected = [a for a in artifacts if a.get("name") == name]
    if not selected:
        raise Ineligible("ARTIFACT_MISSING_OR_EXPIRED")
    if len(selected) != 1:
        raise Blocked("DUPLICATE_ARTIFACT_NAME")
    artifact = selected[0]
    if artifact.get("expired") is not False or artifact.get("digest") is None:
        raise Ineligible("ARTIFACT_EXPIRED_OR_NO_DIGEST")
    if ((artifact.get("workflow_run") or {}).get("id") not in (None, run_id)):
        raise Blocked("ARTIFACT_RUN_SPOOF")
    return artifact


def download_artifact(repo: str, run_id: int, name: str, token: str,
                      expected_file: str, max_file: int) -> bytes:
    artifact = artifact_metadata(repo, run_id, name, token)
    digest = artifact["digest"]
    if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
        raise Blocked("ARTIFACT_DIGEST_INVALID")
    zip_bytes = github(f"repos/{repo}/actions/artifacts/{artifact['id']}/zip",
                       token, binary=True)
    if hashlib.sha256(zip_bytes).hexdigest() != digest[7:]:
        raise Blocked("ARTIFACT_ZIP_DIGEST_MISMATCH")
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
            members = archive.infolist()
            if len(members) != 1 or members[0].filename != expected_file:
                raise Blocked("ARTIFACT_UNEXPECTED_MEMBERS")
            member = members[0]
            if member.is_dir() or member.file_size > max_file:
                raise Blocked("ARTIFACT_ENTRY_INVALID")
            return archive.read(member)
    except (zipfile.BadZipFile, RuntimeError, OSError) as error:
        raise Blocked("ARTIFACT_ZIP_INVALID") from error


def verify_source(repo: str, main_sha: str, token: str, tempdir: pathlib.Path,
                  version: str) -> dict:
    if not SHA_RE.fullmatch(main_sha):
        raise Blocked("MAIN_SHA_INVALID")
    if git("rev-parse", "HEAD") != main_sha:
        raise Blocked("CHECKOUT_NOT_MAIN_SHA")
    parents = git("rev-list", "--parents", "-n", "1", main_sha).split()
    if len(parents) != 3:
        raise Ineligible("NON_TWO_PARENT_MERGE")
    first, second = parents[1:]
    if git("diff", "--name-only", first, second, "--", *SENSITIVE_INPUTS):
        raise Ineligible("PR_TRUSTED_WORKFLOW_OR_VERIFIER_CHANGED")
    attached = github(f"repos/{repo}/commits/{main_sha}/pulls", token)
    if not isinstance(attached, list) or len(attached) != 1:
        raise Ineligible("MERGED_PR_NOT_UNIQUE")
    number = attached[0].get("number")
    if not isinstance(number, int):
        raise Blocked("PR_NUMBER_INVALID")
    pr = github(f"repos/{repo}/pulls/{number}", token)
    if (pr.get("merged_at") is None or pr.get("merge_commit_sha") != main_sha or
        (pr.get("base") or {}).get("ref") != "main" or
        (pr.get("head") or {}).get("sha") != second or
        (pr.get("head") or {}).get("repo", {}).get("full_name") != repo):
        raise Ineligible("PR_MERGE_PARENTS_OR_ORIGIN_MISMATCH")
    runs = page_items(repo, "actions/workflows/ci.yml/runs?event=pull_request",
                      "workflow_runs", token, pages=3)
    exact = [r for r in runs
             if r.get("event") == "pull_request" and
             str(r.get("path", "")).split("@")[0] == ".github/workflows/ci.yml" and
             r.get("head_sha") in (second,) and
             "[전체 검증]" in str(r.get("display_title", "")) and
             "METADATA_ONLY" not in str(r.get("display_title", ""))]
    if not exact:
        raise Ineligible("EXACT_PR_FULL_RUN_MISSING")
    exact.sort(key=lambda r: (r.get("run_number", 0), r.get("id", 0)), reverse=True)
    run = exact[0]
    run_id, attempt = int(run["id"]), int(run["run_attempt"])
    if run.get("status") != "completed" or run.get("conclusion") != "success":
        raise Ineligible("LATEST_PR_FULL_NOT_SUCCESS")
    jobs = page_items(repo, f"actions/runs/{run_id}/attempts/{attempt}/jobs",
                      "jobs", token, pages=2)
    by_name: dict[str, list] = {}
    for job in jobs:
        by_name.setdefault(job.get("name") or "", []).append(job)
    for name in (*REQUIRED, PR_DOCKER):
        matches = by_name.get(name) or []
        if len(matches) != 1 or matches[0].get("conclusion") != "success":
            raise Ineligible("PR_REQUIRED_OR_DOCKER_JOB_NOT_SUCCESS")
    source_name = f"ci-pr-source-{run_id}-{attempt}"
    source_json = download_artifact(repo, run_id, source_name, token,
                                    "ci-pr-source.json", 100_000)
    try:
        source = json.loads(source_json)
    except (ValueError, TypeError) as error:
        raise Blocked("PR_SOURCE_JSON_INVALID") from error
    if (source.get("schema") != "mastergantt-ci-pr-source-v1" or
        source.get("repository") != repo or
        source.get("run_id") != run_id or
        source.get("run_attempt") != attempt or
        source.get("pr_number") != number or
        source.get("head_sha") != second or
        source.get("base_sha") != first or
        source.get("base_ref") != "main" or
        source.get("head_repository") != repo or
        source.get("base_repository") != repo):
        raise Blocked("PR_SOURCE_ATTESTATION_MISMATCH")
    test_merge = source.get("test_merge_sha")
    if not isinstance(test_merge, str) or not SHA_RE.fullmatch(test_merge):
        raise Blocked("TEST_MERGE_SHA_INVALID")
    test_tree = github(f"repos/{repo}/git/commits/{test_merge}", token).get("tree", {}).get("sha")
    main_tree = git("rev-parse", main_sha + "^{tree}")
    if test_tree != main_tree:
        raise Ineligible("MAIN_AND_PR_TEST_MERGE_TREE_DIFFER")
    # Trusted Main's immutable SHA/Tree and version are bound to the exact PR
    # run/attempt before downloading (and validating) the untrusted OCI archive.
    archive_bytes = download_artifact(repo, run_id,
            f"ci-oci-pr-{run_id}-{attempt}", token,
            "mastergantt-verified.oci.tar", MAX_ZIP)
    archive_path = tempdir / "mastergantt-verified.oci.tar"
    archive_path.write_bytes(archive_bytes)
    try:
        inspected = validate_archive(str(archive_path), repository=repo,
                                     revision=test_merge, version=version)
    except (OciError, ValueError, TypeError, OSError) as error:
        raise Blocked("PR_OCI_INTEGRITY_OR_PROVENANCE_CONFLICT") from error
    receipt_bytes = download_artifact(repo, run_id,
        f"ci-pr-build-contract-{run_id}-{attempt}", token,
        "ci-image-build-contract.json", 120_000)
    try:
        receipt = json.loads(receipt_bytes)
    except (ValueError, UnicodeError, TypeError) as error:
        raise Blocked("BUILD_CONTRACT_JSON_INVALID") from error
    try:
        verify_build_contract(receipt, root=pathlib.Path.cwd(), repository=repo,
            run_id=run_id, attempt=attempt, revision=test_merge,
            version=version, digest=inspected["index_digest"],
            archive_sha256=inspected["archive_sha256"], main_tree=main_tree)
    except ContractError as error:
        if str(error) in ("BUILD_INPUT_OR_BUILDER_DRIFT",
                          "GitHub runner image version unavailable",
                          "unexpected runner platform") or str(error).startswith("builder unavailable"):
            raise Ineligible("PR_MAIN_BUILDER_OR_INPUT_DRIFT") from error
        raise Blocked("PR_BUILD_CONTRACT_SOURCE_CONFLICT") from error
    return {
        "schema": "mastergantt-ci-image-source-v1",
        "main_sha": main_sha,
        "main_tree": main_tree,
        "source_revision": test_merge,
        "base_sha": first,
        "pr_head_sha": second,
        "pr_number": number,
        "source_run_id": run_id,
        "source_run_attempt": attempt,
        "index_digest": inspected["index_digest"],
        "archive_sha256": inspected["archive_sha256"],
        "build_version": version,
    }


def decide(*, active: bool, recover: bool, source: dict | None,
           ineligible: str | None = None, blocked: str | None = None) -> tuple[str, str]:
    if recover:
        return "REBUILD_MAIN_VERIFIED", "HISTORICAL_RECOVERY_NOT_ELIGIBLE"
    if blocked:
        return "BLOCKED", blocked
    if ineligible:
        return "REBUILD_MAIN_VERIFIED", ineligible
    if not source:
        return "REBUILD_MAIN_VERIFIED", "NO_MATCHING_PR"
    if not active:
        return "REBUILD_MAIN_VERIFIED", "SHADOW_PR_REUSE_ELIGIBLE"
    return "PR_REUSE_VERIFIED", "CERTIFIED_PR_SOURCE_AND_OCI"


def main() -> int:
    env = os.environ
    tempdir = pathlib.Path(env["RUNNER_TEMP"]) / "mastergantt-ci-oci"
    tempdir.mkdir(parents=True, exist_ok=True)
    active = env.get("PR_IMAGE_REUSE_ENABLED") == "true"
    recover = env.get("MAIN_RECOVERY_AUTHORIZED") == "true"
    result: dict[str, Any] | None = None
    ineligible = blocked = None
    try:
        if not recover:
            repo = env["GITHUB_REPOSITORY"]
            if not REPO_RE.fullmatch(repo):
                raise Blocked("REPOSITORY_INVALID")
            result = verify_source(repo, env["MAIN_SOURCE_SHA"], env["GH_TOKEN"],
                                   tempdir, env["MAIN_VERSION"])
    except Ineligible as error:
        ineligible = str(error)
    except (Blocked, OciError, OSError, ValueError, TypeError, KeyError,
            subprocess.CalledProcessError) as error:
        blocked = str(error) if isinstance(error, Blocked) else "SOURCE_VERIFIER_UNKNOWN"
    decision, reason = decide(active=active, recover=recover, source=result,
                              ineligible=ineligible, blocked=blocked)
    report: dict[str, Any] = {
        "schema": "mastergantt-ci-image-selection-v1",
        "decision": decision,
        "reason_code": reason,
        "active": active,
        "shadow_only": not active,
        "source": result,
        "main_sha": env.get("MAIN_SOURCE_SHA"),
        "run_id": env.get("GITHUB_RUN_ID"),
        "run_attempt": env.get("GITHUB_RUN_ATTEMPT"),
    }
    (tempdir / "ci-image-selection.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    # Shadow must never change required/Main production outcomes. In active
    # mode a trust-boundary violation fails BEFORE any new build or publish.
    with open(env["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        stream.write(f"decision={decision if active else 'REBUILD_MAIN_VERIFIED'}\n")
        stream.write(f"reason_code={reason}\n")
        stream.write(f"source_revision={result['source_revision'] if result and active else env['MAIN_SOURCE_SHA']}\n")
        stream.write(f"candidate_digest={result['index_digest'] if result else ''}\n")
    with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
        stream.write(f"\n## Issue #836 image selection ({'OPT-IN' if active else 'SHADOW'})\n\n")
        stream.write(f"- Decision: {decision}; reason_code: {reason}\n")
        stream.write(f"- Source: {result['source_run_id']}.{result['source_run_attempt']}\n"
                     if result else "- Source: unverified / unavailable\n")
        stream.write("- PR Full PASS is not Main PASS; Main Full8 and Docker smoke remain mandatory.\n")
    if active and decision == "BLOCKED":
        print(f"BLOCKED: {reason}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
