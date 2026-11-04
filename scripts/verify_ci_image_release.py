#!/usr/bin/env python3
"""Issue #836: reauthenticate PR-origin OCI revision before Release promotion.

The only alternative to the existing revision==final Main SHA contract is an
independent GitHub/OCI proof that the immutable Main candidate digest was
PR-smoked and *Main*-smoked/published after the full Main required gates.
Any absent or conflicting evidence rejects release. No GHCR writes.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import sys

from ci_image_reuse import (Blocked, Ineligible, REQUIRED, download_artifact,
                            git, page_items, verify_source)
from ci_image_contract import ContractError, verify as verify_build_contract

MAIN_IMAGE_JOB = "Main 임시 commit 이미지 게시·검증·정리"
MAIN_DOCKER_JOB = "Docker smoke 구현"


def main_job_evidence(jobs: list[dict]) -> bool:
    """Require unique Main publish evidence and an actual Main Docker SUCCESS.

    Main CI also lists a PR-only, skipped job under the same Docker smoke
    display name. Accept only one SUCCESS or exactly one SUCCESS plus one
    SKIPPED for that name. Every Required aggregate and Main publisher must
    remain uniquely successful; other duplicate statuses fail closed.
    """
    by_name: dict[str, list[dict]] = {}
    for job in jobs:
        by_name.setdefault(job.get("name") or "", []).append(job)
    for name in (*REQUIRED, MAIN_IMAGE_JOB):
        found = by_name.get(name, [])
        if len(found) != 1 or found[0].get("conclusion") != "success":
            return False
    smoke = by_name.get(MAIN_DOCKER_JOB, [])
    if len(smoke) == 1:
        return smoke[0].get("conclusion") == "success"
    if len(smoke) == 2:
        return sorted(job.get("conclusion") or "" for job in smoke) == [
            "skipped", "success",
        ]
    return False


def validate_release_source(repo: str, sha: str, version: str, revision: str,
                            digest: str, token: str, tempdir: pathlib.Path) -> dict:
    if (not re.fullmatch(r"[a-f0-9]{40}", sha) or
        not re.fullmatch(r"[a-f0-9]{40}", revision) or
        not re.fullmatch(r"sha256:[a-f0-9]{64}", digest)):
        raise Blocked("INVALID_RELEASE_SOURCE_INPUT")
    if revision == sha:
        raise Blocked("DIRECT_MAIN_LABEL_DOES_NOT_REQUIRE_PR_MAPPING")
    # First establish the original Main push authority. Release's runner
    # ImageVersion is NOT an input to PR/Main image equality.
    runs = page_items(repo,
        f"actions/workflows/ci.yml/runs?event=push&head_sha={sha}",
        "workflow_runs", token, pages=3)
    exact = [r for r in runs if r.get("head_sha") == sha and
             r.get("event") == "push" and
             str(r.get("path", "")).split("@")[0] == ".github/workflows/ci.yml" and
             r.get("status") == "completed" and
             r.get("conclusion") == "success"]
    if not exact:
        raise Blocked("VERIFIED_MAIN_PUSH_CI_NOT_FOUND")
    main_evidence = []
    for run in exact:
        run_id = int(run["id"])
        attempt = int(run.get("run_attempt") or 0)
        if attempt < 1 or attempt > 10:
            continue
        jobs = page_items(repo,
            f"actions/runs/{run_id}/attempts/{attempt}/jobs",
            "jobs", token, pages=2)
        if main_job_evidence(jobs):
            main_evidence.append((run_id, attempt))
    if len(main_evidence) != 1:
        raise Blocked("MAIN_PUBLISH_RUN_ATTEMPT_NOT_UNIQUE_OR_INCOMPLETE")
    run_id, attempt = main_evidence[0]
    # This artifact is emitted only after the actual Main Docker smoke of the
    # exact OCI subject, by a trusted Main checkout. A successful Main publish
    # job from this same Run/Attempt separately proves registry publication;
    # Release has already pulled the live digest from GHCR before invoking us.
    try:
        receipt_bytes = download_artifact(repo, run_id,
            f"ci-main-build-contract-{run_id}-{attempt}", token,
            "ci-image-build-contract.json", 120_000)
    except Ineligible as error:
        raise Blocked(f"MAIN_BUILDER_RECEIPT_UNAVAILABLE:{error}") from error
    try:
        main_receipt = json.loads(receipt_bytes)
    except (ValueError, UnicodeError, TypeError) as error:
        raise Blocked("MAIN_BUILDER_RECEIPT_INVALID_JSON") from error
    if not isinstance(main_receipt, dict):
        raise Blocked("MAIN_BUILDER_RECEIPT_INVALID")
    main_builder = main_receipt.get("build")
    if not isinstance(main_builder, dict):
        raise Blocked("MAIN_BUILDER_RECEIPT_INVALID")
    # Revalidate immutable Git parents/tree, exact PR Full jobs and the
    # archive ZIP/index/child/SBOM/provenance and original PR receipt.
    # The PR builder is compared to the certified MAIN builder, never to
    # tools or host ImageVersion on this independent Release runner.
    try:
        source = verify_source(repo, sha, token, tempdir, version,
                               certified_main_builder=main_builder)
    except Ineligible as error:
        raise Blocked(f"PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:{error}") from error
    if source["index_digest"] != digest or source["source_revision"] != revision:
        raise Blocked("GHCR_AND_PR_OCI_SUBJECT_OR_LABEL_MISMATCH")
    # Independently bind the Main build contract to this exact Run/Attempt,
    # Main Git tree, same immutable archive bytes, version and GHCR index.
    try:
        verify_build_contract(main_receipt, root=pathlib.Path.cwd(),
            repository=repo, run_id=run_id, attempt=attempt, revision=revision,
            version=version, digest=digest,
            archive_sha256=source["archive_sha256"], main_tree=source["main_tree"],
            certified_main_builder=main_builder)
    except ContractError as error:
        raise Blocked(f"MAIN_BUILD_CONTRACT_CONFLICT:{error}") from error
    source.update({"main_run_id": run_id, "main_run_attempt": attempt,
                   "main_build_contract_sha256": hashlib.sha256(receipt_bytes).hexdigest()})
    return source

def main() -> int:
    try:
        env = os.environ
        report = validate_release_source(
            repo=env["GITHUB_REPOSITORY"], sha=env["EXPECTED_MAIN_SHA"],
            version=env["EXPECTED_VERSION"],
            revision=env["CANDIDATE_REVISION"],
            digest=env["CANDIDATE_DIGEST"],
            token=env["GH_TOKEN"],
            tempdir=pathlib.Path(env["RUNNER_TEMP"]))
        with open(env["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write(
                "\n## Issue #836 independently authenticated PR-origin release image\n"
                f"- Exact immutable subject: {report['index_digest']}\n"
                f"- PR Full run/attempt: {report['source_run_id']}.{report['source_run_attempt']}\n"
                f"- Main Full run/attempt: {report['main_run_id']}.{report['main_run_attempt']}\n"
                f"- Main builder receipt SHA256: {report['main_build_contract_sha256']}\n"
                f"- Main source SHA: {report['main_sha']}; PR build revision: {report['source_revision']}\n"
                "- Release Main verified candidate still undergoes unchanged runtime gates.\n")
    except (Blocked, Ineligible, OSError, KeyError, TypeError, ValueError) as error:
        print("BLOCKED: cannot authenticate a PR-built Main release candidate: "
              + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
