#!/usr/bin/env python3
"""#653: default-main read-only successor evidence collector.

No tag, package, release, issue or comment mutations. Incomplete or ambiguous
API responses yield BLOCKED; collected facts alone are not release authority.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from scripts import release_succession_preflight as policy

REPO = "planner77/masterGantt"
VERSIONS = (*policy.VERSIONS, policy.CANDIDATE)
RELEASE_MAIN = (38215065244, 1, "success")
RELEASE_RUN = (38221400193, 2, "success")
MARKER = re.compile(r"<!--\s*(mastergantt-[\w-]+:v\d+)\s+({.*?})\s*-->", re.S)


def require(value: bool, reason: str) -> None:
    if not value:
        raise policy.SuccessionBlocked(reason)


def process(*args: str) -> str:
    p = subprocess.run(args, capture_output=True, text=True, check=False, timeout=90)
    require(p.returncode == 0, f"명령 실패: {args[:2]}: {p.stderr[:200]}")
    return p.stdout.strip()


def api(path: str) -> Any:
    try:
        return json.loads(process("gh", "api", "-H", "Accept: application/vnd.github+json", path))
    except (ValueError, TypeError) as exc:
        raise policy.SuccessionBlocked(f"GitHub API JSON 불명확: {path}") from exc


def pages(path: str, *, key: str | None = None) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for page in range(1, 101):
        sep = "&" if "?" in path else "?"
        response = api(f"{path}{sep}per_page=100&page={page}")
        batch = response.get(key) if key and isinstance(response, dict) else response
        require(isinstance(batch, list) and len(batch) <= 100
                and all(isinstance(x, dict) for x in batch), f"페이지 구조 오류: {path}")
        result.extend(batch)
        if len(batch) < 100:
            return result
    raise policy.SuccessionBlocked(f"전체 페이지 상한 초과: {path}")


def main_snapshot() -> str:
    info = api(f"/repos/{REPO}")
    require(info.get("full_name") == REPO and info.get("default_branch") == "main",
            "저장소/default main 출처 불일치")
    sha = api(f"/repos/{REPO}/git/ref/heads/main")["object"]["sha"]
    require(bool(policy.SHA.fullmatch(sha))
            and process("git", "rev-parse", "HEAD") == sha,
            "checkout한 trusted main SHA가 원격 main과 다름")
    return sha


def ancestry(main: str) -> list[str]:
    chain = process("git", "rev-list", "--first-parent", "--reverse", main).splitlines()
    require(bool(chain) and chain[-1] == main and len(chain) == len(set(chain)),
            "first-parent 계보 불명확")
    require(all(x in chain for x in (policy.PUBLISHED_SHA, policy.ORIGINAL, policy.CORRECTION)),
            "원본 및 교정 커밋의 first-parent 부재")
    return chain


def tag_inventory() -> dict[str, str]:
    refs = pages(f"/repos/{REPO}/git/matching-refs/tags/v")
    tags: dict[str, str] = {}
    for ref in refs:
        name = ref.get("ref")
        obj = ref.get("object") or {}
        require(isinstance(name, str) and name.startswith("refs/tags/v")
                and obj.get("type") in ("tag", "commit")
                and isinstance(obj.get("sha"), str), "Git tag ref 형식 오류")
        if name in tags:
            raise policy.SuccessionBlocked("중복 Git tag")
        sha = obj["sha"]
        if obj["type"] == "tag":
            # Annotated tag is resolved to its commit, not the tag-object SHA.
            target = api(f"/repos/{REPO}/git/tags/{sha}").get("object") or {}
            require(target.get("type") == "commit", "중첩/비정상 annotated tag")
            sha = target.get("sha")
        require(isinstance(sha, str) and bool(policy.SHA.fullmatch(sha)),
                "Git tag peeled commit 불명확")
        tags[name] = sha
    return tags


def release_inventory() -> set[str]:
    releases = pages(f"/repos/{REPO}/releases")
    names: set[str] = set()
    for release in releases:
        tag = release.get("tag_name")
        require(isinstance(tag, str) and bool(tag), "Release tag_name 불명확")
        require(tag not in names, "동일 태그 GitHub Release 중복")
        names.add(tag)
    return names


def registry_inventory() -> tuple[set[str], dict[str, str]]:
    # Authenticated GitHub Packages inventory MUST be complete. 404 is BLOCKED.
    versions = pages(
        "/users/planner77/packages/container/mastergantt/versions?state=active",
    )
    tags: set[str] = set()
    digest_map: dict[str, str] = {}
    for version in versions:
        meta = (version.get("metadata") or {}).get("container") or {}
        values = meta.get("tags")
        require(isinstance(values, list) and all(isinstance(v, str) for v in values),
                "인증 GHCR package metadata 누락")
        version_id = version.get("id")
        require(type(version_id) is int and version_id > 0, "GHCR package version ID 누락")
        for tag in values:
            require(tag not in tags, "GHCR package tag 중복")
            tags.add(tag)
            if tag in {"v" + v for v in VERSIONS}:
                # Docker manifest is fetched from authenticated registry, never
                # guessed from GitHub Release or package metadata.
                image_ref = f"ghcr.io/planner77/mastergantt:{tag}"
                manifest = process("docker", "buildx", "imagetools", "inspect",
                                   image_ref, "--format", "{{json .Manifest}}")
                obj = json.loads(manifest)
                # Buildx manifest does not assert its own top-level canonical digest.
                # Parse the authenticated raw descriptor supplied by inspect.
                raw = process("docker", "buildx", "imagetools", "inspect", image_ref)
                match = re.search(r"(?m)^Digest:\s*(sha256:[0-9a-f]{64})\s*$", raw)
                require(match is not None and isinstance(obj, dict),
                        "인증된 OCI manifest digest 조회 불가")
                digest_map[tag] = match.group(1)
    return tags, digest_map


def run_verified(run_id: int, attempt: int, conclusion: str, expected_sha: str) -> str:
    run = api(f"/repos/{REPO}/actions/runs/{run_id}")
    require(run.get("id") == run_id and run.get("run_attempt") == attempt
            and run.get("status") == "completed"
            and run.get("conclusion") == conclusion
            and run.get("head_sha") == expected_sha
            and ((run.get("repository") or {}).get("full_name") == REPO),
            "원본 릴리스 CI/attempt/SHA 출처 불일치")
    jobs = pages(f"/repos/{REPO}/actions/runs/{run_id}/attempts/{attempt}/jobs")
    require(bool(jobs) and all(job.get("conclusion") in ("success", "skipped")
            for job in jobs) and any(job.get("conclusion") == "success" for job in jobs),
            "CI job 전부 성공 증거 불충분")
    return f"{run_id}:{attempt}:SUCCESS"


def owner_markers(issue: int) -> list[tuple[int, str, dict[str, Any]]]:
    rows = pages(f"/repos/{REPO}/issues/{issue}/comments")
    result = []
    for row in rows:
        if row.get("author_association") != "OWNER" or (
            (row.get("user") or {}).get("login") != "planner77"
        ):
            continue
        for match in MARKER.finditer(row.get("body") or ""):
            try:
                data = json.loads(match.group(2))
            except ValueError as exc:
                raise policy.SuccessionBlocked("Owner marker JSON 오류") from exc
            require(isinstance(data, dict) and type(row.get("id")) is int,
                    "Owner marker 유형/ID 오류")
            result.append((row["id"], match.group(1), data))
    return result


def latest_marker(rows: list[tuple[int, str, dict[str, Any]]],
                  prefix: str, version: str, authorized: bool) -> bool:
    candidates = [(n, d) for n, name, d in rows
                  if name == prefix and d.get("expected_version") == version]
    if not candidates:
        return False
    decision = max(candidates, key=lambda item: item[0])[1]
    return type(decision.get("authorized")) is bool and decision["authorized"] is authorized


def collect() -> tuple[dict[str, Any], dict[str, Any]]:
    require(os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
            and os.environ.get("GITHUB_REF") == "refs/heads/main"
            and os.environ.get("GITHUB_REPOSITORY") == REPO,
            "default-main workflow_dispatch 전용")
    main = main_snapshot()
    chain = ancestry(main)
    tags = tag_inventory()
    releases = release_inventory()
    ghcr, digests = registry_inventory()
    inventory = {}
    for v in VERSIONS:
        key = "v" + v
        git_sha = tags.get("refs/tags/" + key)
        digest = digests.get(key)
        inventory[v] = dict(
            git_tag="PRESENT" if git_sha else "ABSENT", git_sha=git_sha,
            github_release="PRESENT" if key in releases else "ABSENT",
            ghcr_tag="PRESENT" if key in ghcr else "ABSENT",
            ghcr_digest=digest,
        )
    require(all((v not in ghcr) or (v in digests) for v in ("v" + x for x in VERSIONS)),
            "GHCR 태그의 OCI digest 누락")
    markers_616 = owner_markers(616)
    markers_633 = owner_markers(633)
    original_run = api(f"/repos/{REPO}/actions/runs/38313359094")
    require(original_run.get("conclusion") == "failure"
            and original_run.get("run_attempt") == 1, "#616 원본 실패 증거 누락")
    # Each affirmative lifecycle decision needs independently authenticated,
    # scoped evidence. Never promote a missing marker to True.
    evidence = dict(
        collector="trusted-main-read-only-v1", repository=REPO, main_sha=main,
        git_complete=True, github_releases_complete=True,
        ghcr_packages_complete=True, authenticated_registry=True,
        release_main_run=run_verified(*RELEASE_MAIN, policy.PUBLISHED_SHA),
        release_run=run_verified(*RELEASE_RUN, policy.PUBLISHED_SHA),
        release_lifecycle_verified=False,
        source_633_owner_verified=latest_marker(
            markers_633, "mastergantt-release-authorization:v1", "0.106.1", True),
        retired_550=False, retired_615=False,
        revoked_550=False, revoked_615=False,
        revoked_616=latest_marker(
            markers_616, "mastergantt-release-authorization:v1", "0.107.0", False),
        successor_prepare_owner=False,
    )
    record = dict(
        source_sha=policy.ORIGINAL, correction_sha=policy.CORRECTION,
        main_sha=main, candidate_sha=main, candidate_version=policy.CANDIDATE,
        first_parent=chain, contains_f2=True, contains_correction=True,
        original_ci="FAIL", original_owner_marker_preserved=bool(markers_616),
        release_inventory=inventory, owner_new_version_authorized=False,
        evidence=evidence,
    )
    provenance = dict(
        schema="mastergantt-release-succession-audit-v1", repository=REPO,
        collected_at=datetime.now(timezone.utc).isoformat(), main_sha=main,
        run_id=os.environ.get("GITHUB_RUN_ID"),
        run_attempt=os.environ.get("GITHUB_RUN_ATTEMPT"),
        workflow_ref=os.environ.get("GITHUB_WORKFLOW_REF"),
        # No credentials or Owner comment bodies in artifacts.
        source="GitHub REST authenticated + GHCR authenticated OCI manifest",
        tags_count=len(tags), releases_count=len(releases), packages_count=len(ghcr),
    )
    require(main_snapshot() == main, "감사 도중 main 변경")
    return record, provenance


def main() -> int:
    result: dict[str, Any] = {"decision": "BLOCKED", "publish": False}
    try:
        record, provenance = collect()
        result["provenance"] = provenance
        result["inventory"] = record["release_inventory"]
        result["result"] = policy.evaluate(record)
        result["decision"] = result["result"]["decision"]
    except (policy.SuccessionBlocked, KeyError, TypeError, ValueError,
            subprocess.TimeoutExpired, OSError) as exc:
        result["reason"] = str(exc)[:350]
    Path("release-succession-audit.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"승계 감사: {result['decision']}; 게시·퇴역·종료는 수행하지 않음")
    return 0 if result["decision"] == "PREPARE_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
