#!/usr/bin/env python3
"""Issue #651: strict READ-ONLY successor eligibility, never release authority.

Only scripts/release_succession_audit.py (trusted main, live Git/GitHub/GHCR)
may produce operational input. Calling evaluate() with a hand-written JSON
record is only a unit test and does NOT authenticate that record.
"""
from __future__ import annotations

import re
from typing import Any

SHA = re.compile(r"^[0-9a-f]{40}$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
ORIGINAL = "b97709df8b5c0974f3c8252ac97819f45f73a5b9"
CORRECTION = "f8d0036ab4a5566df418a09f2eb9b5e1b918d08b"
PUBLISHED_SHA = "09bee924032b4126ff794ec7a485542fd72dd7bf"
PUBLISHED_DIGEST = "sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f"
VERSIONS = ("0.105.0", "0.106.0", "0.106.1", "0.107.0")
CANDIDATE = "0.108.0"
ROW_FIELDS = {"git_tag", "git_sha", "github_release", "ghcr_tag", "ghcr_digest"}


class SuccessionBlocked(ValueError):
    """No mutation/retirement/publication authority is granted."""


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise SuccessionBlocked(reason)


def _sha(value: Any) -> bool:
    return type(value) is str and SHA.fullmatch(value) is not None


def evaluate(record: dict[str, Any]) -> dict[str, Any]:
    """Fail closed on incomplete evidence; success means *preparation only*."""
    fields = {
        "source_sha", "correction_sha", "main_sha", "candidate_sha",
        "candidate_version", "first_parent", "contains_f2", "contains_correction",
        "original_ci", "original_owner_marker_preserved", "release_inventory",
        "evidence", "owner_new_version_authorized",
    }
    require(type(record) is dict and set(record) == fields, "감사 레코드 필드 누락/추가")
    require(all(_sha(record[name]) for name in (
        "source_sha", "correction_sha", "main_sha", "candidate_sha")),
        "원본/교정/후보 immutable full SHA 필요")
    require(record["source_sha"] == ORIGINAL and record["correction_sha"] == CORRECTION,
            "#616 원본 또는 #647 교정 SHA 불일치")
    require(record["candidate_sha"] == record["main_sha"] != ORIGINAL,
            "후보는 실조회한 현재 main SHA로만 제한")
    require(record["candidate_version"] == CANDIDATE,
            "신규 별도 승인 전 후보 v0.108.0만 가능")
    chain = record["first_parent"]
    require(type(chain) is list and bool(chain)
            and all(_sha(item) for item in chain)
            and len(set(chain)) == len(chain), "first-parent 계보 중복/손상")
    require(all(value in chain for value in (PUBLISHED_SHA, ORIGINAL, CORRECTION))
            and chain.index(PUBLISHED_SHA) < chain.index(ORIGINAL)
            < chain.index(CORRECTION) and chain[-1] == record["main_sha"],
            "v0.106.1 → #616 → #647 → main 계보 확인 실패")
    require(record["contains_f2"] is True and record["contains_correction"] is True,
            "F2/교정 포함 검증 실패")
    require(record["original_ci"] == "FAIL"
            and record["original_owner_marker_preserved"] is True,
            "#616 실패 복구와 기존 Owner marker를 불변으로 보존")

    evidence = record["evidence"]
    require(type(evidence) is dict and set(evidence) == {
        "collector", "repository", "main_sha", "git_complete",
        "github_releases_complete", "ghcr_packages_complete",
        "authenticated_registry", "release_main_run", "release_run",
        "release_lifecycle_verified", "source_633_owner_verified",
        "retired_550", "retired_615", "revoked_550",
        "revoked_615", "revoked_616", "successor_prepare_owner",
    }, "출처 검증 필드/범위 불충분")
    require(evidence["collector"] == "trusted-main-read-only-v1"
            and evidence["repository"] == "planner77/masterGantt"
            and evidence["main_sha"] == record["main_sha"]
            and all(evidence[k] is True for k in (
                "git_complete", "github_releases_complete",
                "ghcr_packages_complete", "authenticated_registry")),
            "신뢰된 main·완전 페이지·인증 GHCR 출처 증명 실패")
    require(evidence["release_main_run"] == "38215065244:1:SUCCESS"
            and evidence["release_run"] == "38221400193:2:SUCCESS"
            and all(evidence[k] is True for k in (
                "release_lifecycle_verified", "source_633_owner_verified")),
            "v0.106.1 원본 Main/Release CI·Owner·수명주기 증거 불충분")
    require(all(evidence[k] is True for k in (
        "revoked_550", "revoked_615", "retired_550", "retired_615")),
        "#550/#615 독립 철회 및 완료된 퇴역 원장 불충분")

    inventory = record["release_inventory"]
    require(type(inventory) is dict and set(inventory) == set(VERSIONS) | {CANDIDATE},
            "과거 4개 및 신규 후보 1개 버전의 inventory 모두 필요")
    for version, row in inventory.items():
        require(type(row) is dict and set(row) == ROW_FIELDS,
                f"{version}: exact inventory schema 누락/추가")
        for key in ("git_tag", "github_release", "ghcr_tag"):
            require(type(row[key]) is str and row[key] in ("PRESENT", "ABSENT"),
                    f"{version}: {key} UNKNOWN/권한 오류")
        require(row["git_sha"] is None or _sha(row["git_sha"]),
                f"{version}: Git tag SHA 미확인")
        digest = row["ghcr_digest"]
        require(digest is None or (type(digest) is str and DIGEST.fullmatch(digest)),
                f"{version}: GHCR digest 미확인")
        require((row["git_tag"] == "PRESENT") == (row["git_sha"] is not None),
                f"{version}: 태그/peeled commit SHA 불일치")
        require((row["ghcr_tag"] == "PRESENT") == (digest is not None),
                f"{version}: GHCR tag/digest 불일치")
        if version == "0.106.1":
            require(row["git_tag"] == "PRESENT" and row["git_sha"] == PUBLISHED_SHA
                    and row["ghcr_tag"] == "PRESENT"
                    and digest == PUBLISHED_DIGEST,
                    "정식 v0.106.1 tag SHA 또는 원본 digest 위변조/충돌")
            # COMPLETE GitHub Releases listing may establish ABSENT even when
            # an annotated tag, Release workflow, GHCR and lifecycle DID finish.
            # A single by-tag API 404 is NOT proof of any registry/tag absence.
        else:
            require(row["git_tag"] == row["github_release"] ==
                    row["ghcr_tag"] == "ABSENT"
                    and row["git_sha"] is None and digest is None,
                    f"{version}: 퇴역 전 게시 흔적 또는 신규 게시 충돌")

    require(evidence["revoked_616"] is True
            and evidence["successor_prepare_owner"] is True,
            "#616 v0.107.0 별도 Owner 철회·v0.108.0 준비 결정 전 BLOCKED")
    require(record["owner_new_version_authorized"] is False,
            "신규 게시 승인은 준비 검증과 독립된 보호된 release gate에서만 처리")
    return {
        "decision": "PREPARE_ONLY", "candidate_sha": record["candidate_sha"],
        "candidate_version": CANDIDATE,
        "recognized_prior_release": {"version": "0.106.1", "sha": PUBLISHED_SHA,
                                     "digest": PUBLISHED_DIGEST},
        "release_authorized": False, "publish": False,
        "retire": False, "close_issue_616": False,
    }
