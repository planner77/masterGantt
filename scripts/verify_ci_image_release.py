#!/usr/bin/env python3
"""Issue #836: reauthenticate PR-origin OCI revision before Release promotion.

The only alternative to the existing revision==final Main SHA contract is an
independent GitHub/OCI proof that the immutable Main candidate digest was
PR-smoked and *Main*-smoked/published after the full Main required gates.
Any absent or conflicting evidence rejects release. No GHCR writes.
"""
from __future__ import annotations

import os
import pathlib
import re
import sys

from ci_image_reuse import (Blocked, Ineligible, REQUIRED, git, github,
                            page_items, verify_source)

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
    # Revalidate Git object, exact PR Full, PR origin/two parents, strict Tree,
    # OCI index+child+config/SBOM/provenance, artifact ZIP signature/run attempt.
    try:
        source = verify_source(repo, sha, token, tempdir, version)
    except Ineligible as error:
        raise Blocked(f"PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:{error}") from error
    if source["index_digest"] != digest or source["source_revision"] != revision:
        raise Blocked("GHCR_AND_PR_OCI_SUBJECT_OR_LABEL_MISMATCH")
    # A PR Full success is not a Main success. Only a separate immutable Main
    # push run can authorize the exact source candidate. Both Main Docker
    # implementation + GHCR publish job must have completed SUCCESS.
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
        # Multiple successful attempts are not necessarily malicious, but
        # none has a cryptographic bound to the live digest yet. Block until
        # the specific publishing attempt is independently authenticated.
        raise Blocked("MAIN_PUBLISH_RUN_ATTEMPT_NOT_UNIQUE_OR_INCOMPLETE")
    source.update({"main_run_id": main_evidence[0][0],
                   "main_run_attempt": main_evidence[0][1]})
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
                f"- Main source SHA: {report['main_sha']}; PR build revision: {report['source_revision']}\n"
                "- Release Main verified candidate still undergoes unchanged runtime gates.\n")
    except (Blocked, Ineligible, OSError, KeyError, TypeError, ValueError) as error:
        print("BLOCKED: cannot authenticate a PR-built Main release candidate: "
              + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
