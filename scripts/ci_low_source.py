#!/usr/bin/env python3
"""Issue #772: default-main read-only verification of genuine targeted PR CI.

Job names and two JSON files are *not* enough. The exact run/attempt source,
immutable PR/test-merge identity, base policy blobs, closed diff allowlist and
actual selected tests must agree. Unknown source/API/errors => BLOCKED.
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import urllib.error
import urllib.request
import zipfile

import ci_low_policy as low


def need(value, reason):
    if not value:
        raise low.Refused(reason)


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith("https://"):
            raise low.Refused("INSECURE_ARTIFACT_REDIRECT")
        return urllib.request.Request(newurl, headers={"User-Agent": "mastergantt-ci-low-source"})


def artifact(gh, run_id: int, attempt: int, *, kind: str, filename: str) -> dict:
    """Only the single named ZIP JSON from this exact Run+Attempt is admitted."""
    need(type(run_id) is int and run_id > 0 and
         type(attempt) is int and 1 <= attempt <= 10, "INVALID_RUN_ATTEMPT")
    name = f"ci-low-{kind}-{run_id}-{attempt}"
    all_items = gh.collection(f"{gh.prefix}/actions/runs/{run_id}/artifacts", "artifacts")
    matches = [x for x in all_items if x.get("name") == name and not x.get("expired")]
    need(len(matches) == 1, "MISSING_DUPLICATE_OR_EXPIRED_ARTIFACT")
    item = matches[0]
    size = item.get("size_in_bytes")
    need(type(size) is int and 0 < size < 98304 and
         type(item.get("id")) is int and item["id"] > 0, "ARTIFACT_SIZE_OR_ID_UNKNOWN")
    link = f"https://api.github.com{gh.prefix}/actions/artifacts/{item['id']}/zip"
    req = urllib.request.Request(link, headers={
        "Authorization": "Bearer " + gh.token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mastergantt-ci-low-source",
    })
    try:
        with urllib.request.build_opener(SafeRedirect()).open(req, timeout=20) as stream:
            raw = stream.read(98305)
        need(0 < len(raw) < 98305, "ZIP_TOO_LARGE")
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            need(z.namelist() == [filename] and
                 z.getinfo(filename).file_size < 98304, "ZIP_MEMBER_NOT_EXACT")
            body = json.loads(z.read(filename))
        need(isinstance(body, dict), "ARTIFACT_NOT_OBJECT")
        return body
    except (OSError, urllib.error.URLError, zipfile.BadZipFile, ValueError,
            KeyError, TypeError):
        raise low.Refused("ARTIFACT_CANNOT_BE_AUTHENTICATED") from None


def blob(gh, sha: str, path: str) -> tuple[str, str]:
    need(isinstance(sha, str) and low.HEX40.fullmatch(sha), "INVALID_GIT_SHA")
    payload = gh.get(f"{gh.prefix}/contents/{path}?ref={sha}")
    need(payload.get("type") == "file" and
         payload.get("encoding") == "base64" and
         isinstance(payload.get("content"), str) and
         isinstance(payload.get("sha"), str), "GIT_FILE_UNVERIFIED")
    raw = base64.b64decode(payload["content"].replace("\n", ""), validate=True)
    need(len(raw) < 131072, "GIT_FILE_TOO_LARGE")
    return raw.decode("utf-8"), payload["sha"]


def verified_targeted_source(gh, run: dict, source: dict, jobs: dict,
                             *, enabled: bool) -> dict:
    """Call only after original source_artifact + verified_source is successful."""
    need(enabled, "OWNER_FLAG_OFF_POLICY_ROLLBACK")
    need(run.get("status") == "completed" and run.get("conclusion") == "success" and
         run.get("event") == "pull_request", "NOT_SUCCESSFUL_PR_CI")
    run_id, attempt = run.get("id"), run.get("run_attempt")
    need(type(run_id) is int and type(attempt) is int, "RUN_ATTEMPT_MISSING")
    source = {**source, "run_id": run_id, "run_attempt": attempt}
    need(source.get("repository") == gh.repo and
         source.get("head_sha") != source.get("base_sha") and
         all(isinstance(source.get(n), str) and low.HEX40.fullmatch(source[n])
             for n in ("base_sha", "head_sha", "test_merge_sha")) and
         type(source.get("pr_number")) is int and source["pr_number"] > 0,
         "SOURCE_INCOMPLETE_OR_INVALID")
    plan = artifact(gh, run_id, attempt, kind="plan", filename="ci-low-plan.json")
    receipt = artifact(gh, run_id, attempt, kind="receipt", filename="ci-low-receipt.json")
    low.validate_receipt(plan, receipt, source=source, jobs=jobs)
    base, merged = source["base_sha"], source["test_merge_sha"]
    # PR cannot supply the authoritative Python source/policy selector.
    _, low_sha = blob(gh, base, "scripts/ci_low_policy.py")
    _, impact_sha = blob(gh, base, "scripts/ci_impact_plan.py")
    need((low_sha, impact_sha) ==
         (plan["policy_blob_sha"], plan["selector_blob_sha"]), "UNTRUSTED_POLICY_SHA")
    # Pure allowlist is validated a SECOND time using GitHub's authenticated Git
    # compare and both file blobs, not PR-provided plan metadata.
    compare = gh.get(f"{gh.prefix}/compare/{base}...{merged}")
    files = compare.get("files")
    need(compare.get("status") == "ahead" and
         isinstance(files, list) and 1 <= len(files) < 300 and
         type(compare.get("ahead_by")) is int and 1 <= compare["ahead_by"] < 250,
         "DIFF_UNKNOWN_TRUNCATED_OR_UNRELATED")
    source_changes = [x for x in files if not low.WORK_PACKET.fullmatch(x.get("filename", ""))]
    need(len(source_changes) == 1 and
         source_changes[0].get("filename") == low.ALLOW_COPY and
         source_changes[0].get("status") == "modified" and
         all(x.get("status") == "modified" and
             not x.get("previous_filename") for x in files),
         "PROTECTED_OR_UNKNOWN_CHANGE_IN_TARGETED_SOURCE")
    old_text, _ = blob(gh, base, low.ALLOW_COPY)
    new_text, _ = blob(gh, merged, low.ALLOW_COPY)
    need(low.pure_paragraph_edit(old_text, new_text), "NOT_PURE_NONINTERACTIVE_DIFF")
    need(plan.get("shadow_mode") == "FAST_TARGETED" and
         plan.get("shadow_risk") in ("LOW", "MEDIUM") and
         plan.get("trusted_test_inventory", 0) >= len(plan["selected_test_ids"]),
         "SHADOW_SELECTION_POLICY_UNVERIFIED")
    # The negative and direct spec IDs must exist at unchanged paths in BOTH
    # immutable trees. A missing/renamed test never obtains a synthetic PASS.
    for spec in plan["selected_test_ids"]:
        _, old_hash = blob(gh, base, spec)
        _, new_hash = blob(gh, merged, spec)
        need(old_hash == new_hash, "MISSING_RENAMED_OR_CHANGED_TEST")
    # Exact prior Full failure for this same head is a no-downgrade veto.
    prior = gh.collection(
        f"{gh.prefix}/actions/workflows/ci.yml/runs?event=pull_request&head_sha={source['head_sha']}",
        "workflow_runs")
    for candidate in prior:
        if (candidate.get("id") == run_id or
                candidate.get("event") != "pull_request" or
                candidate.get("head_sha") != source["head_sha"] or
                "[전체 검증]" not in str(candidate.get("display_title") or "")):
            continue
        if (candidate.get("conclusion") not in (None, "success") or
                candidate.get("status") != "completed"):
            raise low.Refused("PREVIOUS_FULL_FAILED_INCOMPLETE_OR_CANCELLED")
    return {
        "mode": low.TARGETED, "source": source,
        "policy_blob_sha": plan["policy_blob_sha"],
        "selected_test_ids": plan["selected_test_ids"],
        "excluded_test_ids": plan["excluded_test_ids"],
        "selection_reasons": plan["selection_reasons"],
        "actual_test_case_count": receipt["execution"]["actual_test_case_count"],
        "unexecuted_full_shards": 8,  # label, not falsely claimed PASS
        "report_mode": "TARGETED_E2E_PASS_NOT_FULL",
        "plan_sha256": plan["plan_sha256"],
        "receipt_sha256": receipt["receipt_sha256"],
    }
