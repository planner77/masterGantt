#!/usr/bin/env python3
"""Read-only Preview UAT receipt verifier. Never grants CI, merge, or release approval.

The repository Owner's GitHub Issue comment is the authority. A PR body,
a test artifact, or an agent-generated recommendation is never approval.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

from qa_final_automated import GitHub, Blocked, require

SHA40 = re.compile(r"[0-9a-f]{40}\Z")
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
RECEIPT = "mastergantt-preview-uat:v1"
FIELDS = ("issue", "source_sha", "image_digest", "evidence_sha256", "decision")
VALID_DECISIONS = {"ACCEPT", "REWORK"}


def parse_receipt(message: str) -> dict[str, str] | None:
    """Parse a bounded, unambiguous Owner comment without executing its contents."""
    if not isinstance(message, str) or len(message) > 16000:
        return None
    lines = message.replace("\r\n", "\n").split("\n")
    markers = [i for i, line in enumerate(lines) if line.strip() == RECEIPT]
    if len(markers) != 1:
        return None
    fields: dict[str, str] = {}
    for line in lines[markers[0] + 1:]:
        if not line.strip():
            break
        matched = re.fullmatch(r"([a-z_]+): ([A-Za-z0-9:-]+)", line)
        if not matched or matched.group(1) not in FIELDS or matched.group(1) in fields:
            return None
        fields[matched.group(1)] = matched.group(2)
    if set(fields) != set(FIELDS):
        return None
    if not re.fullmatch(r"[1-9][0-9]{0,8}", fields["issue"]):
        return None
    if not SHA40.fullmatch(fields["source_sha"]):
        return None
    if not DIGEST.fullmatch(fields["image_digest"]):
        return None
    if not DIGEST.fullmatch(fields["evidence_sha256"]):
        return None
    if fields["decision"] not in VALID_DECISIONS:
        return None
    return fields


def evaluate_receipts(comments: list[dict[str, Any]], *,
                      owner: str, issue: int, sha: str,
                      image_digest: str, evidence_sha256: str) -> dict[str, Any]:
    """Only the latest valid Owner decision for THIS issue controls the verdict.

    A later Owner REWORK overrides an earlier ACCEPT; another source SHA is stale.
    """
    require(SHA40.fullmatch(sha) is not None, "UAT source SHA 형식 오류")
    require(DIGEST.fullmatch(image_digest) is not None and
            DIGEST.fullmatch(evidence_sha256) is not None, "UAT Digest 형식 오류")
    require(bool(re.fullmatch(r"[A-Za-z0-9-]{1,39}", owner)), "Owner 식별자 오류")
    candidates: list[tuple[int, dict[str, str]]] = []
    for comment in comments:
        if not isinstance(comment, dict):
            continue
        author = comment.get("user") or {}
        if not isinstance(author, dict) or str(author.get("login", "")).lower() != owner.lower():
            continue
        receipt = parse_receipt(comment.get("body", ""))
        if receipt is None or receipt["issue"] != str(issue):
            continue
        cid = comment.get("id")
        if isinstance(cid, int) and cid > 0:
            candidates.append((cid, receipt))
    require(bool(candidates), "UAT_NOT_TESTED: 해당 Issue의 Owner 결정 증거 없음")
    ident, receipt = max(candidates, key=lambda entry: entry[0])
    require(receipt["source_sha"] == sha, "UAT_STALE: Owner 승인 이후 PR Head 변경")
    require(receipt["image_digest"] == image_digest,
            "UAT_STALE: 시험 이미지 Digest 불일치")
    require(receipt["evidence_sha256"] == evidence_sha256,
            "UAT_STALE: Visual Evidence Manifest Digest 불일치")
    require(receipt["decision"] == "ACCEPT", "UAT_REWORK: Owner 재작업 결정")
    return {"state": "UAT_ACCEPTED", "issue": issue,
            "source_sha": sha, "image_digest": image_digest,
            "evidence_sha256": evidence_sha256, "owner_comment_id": ident,
            "meaning": "사용자 Preview 수용만 확인; PR/CI/QA/Release 승인 아님"}


def verify_live(gh: GitHub, *, issue: int, pr_number: int,
                sha: str, image_digest: str, evidence_sha256: str) -> dict[str, Any]:
    repo = gh.get(gh.prefix)
    owner = repo.get("owner") or {}
    require(owner.get("type") == "User" and bool(owner.get("login")),
            "조직 저장소 UAT 승인자는 별도 Owner 정책 확정 필요")
    issue_data = gh.get(f"{gh.prefix}/issues/{issue}")
    require(issue_data.get("number") == issue and issue_data.get("state") == "open",
            "UAT Issue가 현재 열려 있지 않음")
    pr = gh.get(f"{gh.prefix}/pulls/{pr_number}")
    require(pr.get("number") == pr_number and pr.get("state") == "open" and
            (pr.get("head") or {}).get("sha") == sha and
            ((pr.get("head") or {}).get("repo") or {}).get("full_name") == gh.repo and
            (pr.get("base") or {}).get("ref") == "main",
            "UAT_STALE: PR/head/base/repository 불일치")
    comments = gh.pages(f"{gh.prefix}/issues/{issue}/comments")
    return evaluate_receipts(comments, owner=owner["login"], issue=issue,
                             sha=sha, image_digest=image_digest,
                             evidence_sha256=evidence_sha256)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issue", type=int, required=True)
    parser.add_argument("--pr", type=int, required=True)
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--image-digest", required=True)
    parser.add_argument("--evidence-sha256", required=True)
    args = parser.parse_args()
    try:
        require(0 < args.issue < 1_000_000_000 and 0 < args.pr < 1_000_000_000,
                "Issue/PR 번호 범위 오류")
        gh = GitHub(os.environ.get("GITHUB_REPOSITORY", ""),
                    os.environ.get("GH_TOKEN", ""))
        result = verify_live(gh, issue=args.issue, pr_number=args.pr,
                             sha=args.source_sha, image_digest=args.image_digest,
                             evidence_sha256=args.evidence_sha256)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except Blocked as exc:
        print(json.dumps({"state": "BLOCKED", "reason": exc.reason}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
