#!/usr/bin/env python3
"""#649 read-only successor eligibility gate; never publishes or retires releases.

All inventory fields must be sourced from authenticated, read-only queries by
the caller. This module intentionally cannot mutate GitHub or GHCR.
"""
from __future__ import annotations

import re
from typing import Any

SHA = re.compile(r"^[0-9a-f]{40}$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
SEMVER = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
ORIGINAL = "b97709df8b5c0974f3c8252ac97819f45f73a5b9"
CORRECTION = "f8d0036ab4a5566df418a09f2eb9b5e1b918d08b"
VERSIONS = ("0.105.0", "0.106.0", "0.106.1", "0.107.0")


class SuccessionBlocked(ValueError):
    """No write/publish/retirement authority is conveyed."""


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise SuccessionBlocked(reason)


def evaluate(record: dict[str, Any]) -> dict[str, Any]:
    """Check *authenticated* inputs; READY means prepare a PR, never release.

    Source queries, GHCR verification, first-parent collection, CI and Owner
    authentication must occur independently upstream. Missing data is BLOCKED.
    """
    required = {
        "source_sha", "correction_sha", "main_sha", "candidate_sha",
        "candidate_version", "first_parent", "contains_f2", "contains_correction",
        "original_ci", "original_owner_marker_preserved", "release_inventory",
        "inventory_authenticated", "owner_new_version_authorized",
    }
    require(isinstance(record, dict) and set(record) == required,
            "누락·추가된 감사 필드")
    for name in ("source_sha", "correction_sha", "main_sha", "candidate_sha"):
        require(isinstance(record[name], str) and SHA.fullmatch(record[name]) is not None,
                f"{name}: immutable full SHA 필요")
    require(record["source_sha"] == ORIGINAL, "원본 SHA 불일치")
    require(record["correction_sha"] == CORRECTION, "#647 교정 SHA 불일치")
    require(record["candidate_sha"] == record["main_sha"], "candidate는 감사 시점 main SHA와 일치해야 함")
    require(record["candidate_sha"] != ORIGINAL, "원본 SHA 재사용 금지")
    require(type(record["contains_f2"]) is bool and record["contains_f2"], "F2 검증 누락")
    require(type(record["contains_correction"]) is bool and record["contains_correction"],
            "#647 교정 포함 검증 누락")
    chain = record["first_parent"]
    require(isinstance(chain, list) and len(chain) == len(set(chain))
            and all(isinstance(s, str) and SHA.fullmatch(s) for s in chain),
            "first-parent 원장 미확인·중복·형식 오류")
    require(ORIGINAL in chain and CORRECTION in chain
            and chain.index(ORIGINAL) < chain.index(CORRECTION)
            and chain[-1] == record["main_sha"], "first-parent 계보 불일치")
    require(record["original_ci"] == "FAIL", "원본 #2621 실패는 FAIL로 유지")
    require(record["original_owner_marker_preserved"] is True, "원본 Owner marker 보존 필요")
    require(record["inventory_authenticated"] is True, "인증 기반 Git/GHCR 조회 불충분")
    inv = record["release_inventory"]
    version = record["candidate_version"]
    require(isinstance(version, str) and SEMVER.fullmatch(version) is not None,
            "명시 SemVer 필요")
    require(tuple(map(int, version.split("."))) >
            tuple(map(int, VERSIONS[-1].split("."))), "원본 v0.107.0 재사용·retag 금지")
    require(isinstance(inv, dict) and set(inv) == set(VERSIONS) | {version},
            "선행 및 신규 후보 버전 전체 inventory 필요")
    for version in (*VERSIONS, record["candidate_version"]):
        row = inv[version]
        require(isinstance(row, dict)
                and set(row) == {"git_tag", "github_release", "ghcr_tag", "ghcr_digest"},
                f"{version} inventory 구조/누락")
        for k in ("git_tag", "github_release", "ghcr_tag"):
            require(row[k] in ("ABSENT", "PRESENT"), f"{version} {k} UNKNOWN 차단")
        require(row["ghcr_digest"] is None or
                (isinstance(row["ghcr_digest"], str)
                 and DIGEST.fullmatch(row["ghcr_digest"]) is not None),
                f"{version} digest UNKNOWN/오류")
        require((row["ghcr_tag"] == "PRESENT") == (row["ghcr_digest"] is not None),
                f"{version} GHCR 태그/digest 증거 불일치")
        require(all(row[k] == "ABSENT" for k in ("git_tag", "github_release", "ghcr_tag")),
                f"{version} 기존 게시 흔적 존재: 별도 릴리스 부채 절차 필요")
    require(record["owner_new_version_authorized"] is False,
            "이 gate는 신규 게시 승인 이전 준비 전용; 승인 완료시 별도 release gate 사용")
    return {"decision": "PREPARE_ONLY", "candidate_sha": record["candidate_sha"],
            "candidate_version": version, "release_authorized": False,
            "publish": False, "retire": False, "close_issue_616": False}
