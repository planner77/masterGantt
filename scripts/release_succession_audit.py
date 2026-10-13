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
# Immutable five-merge release debt source identities from #633 B2.
B2_SOURCES = (
    ("40747252c389f2a4d1203a2262a4caa49c90728d", 550, 559),
    ("c8949da48e7465db45d871887c3f55f9fb6dc743", 615, 627),
    ("6eaec3331fcbc720ab42106789a505c5ee5eefb4", 615, 628),
    ("e51b99cb25f37c8909de356a089a56b4139415a3", 550, 626),
    ("d69749753fb9db002232d92d51446237a0fe042d", 550, 632),
)
STAGE = "precondition"
# Failure context is kept separate from caller-supplied evidence and contains
# no credentials, private Owner comment text or external command stderr.
EVIDENCE_CONTEXT: dict[str, str | None] = {}
OBSERVED_INVENTORY: dict[str, Any] = {}


class AuditBlocked(policy.SuccessionBlocked):
    def __init__(self, reason: str, code: str = "EVIDENCE_INVALID") -> None:
        super().__init__(reason)
        self.code = code


def stage(
    name: str, *, version: str | None = None, tag: str | None = None,
    expected_digest: str | None = None, actual_digest: str | None = None,
) -> None:
    global STAGE, EVIDENCE_CONTEXT
    STAGE = name
    EVIDENCE_CONTEXT = dict(
        version=version, tag=tag, expected_digest=expected_digest,
        actual_digest=actual_digest,
    )


MARKER = re.compile(r"<!--\s*(mastergantt-[\w-]+:v\d+)\s+({.*?})\s*-->", re.S)


def require(value: bool, reason: str, *, code: str = "EVIDENCE_INVALID") -> None:
    if not value:
        raise AuditBlocked(reason, code)


def process(*args: str) -> str:
    # No raw stderr in the diagnostic artifact: it can contain auth details.
    try:
        p = subprocess.run(args, capture_output=True, text=True, check=False, timeout=90)
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise AuditBlocked(f"{args[0]} {args[1]} 실행 불가 또는 timeout",
                           "EXTERNAL_UNAVAILABLE") from exc
    if p.returncode != 0:
        match = re.search(r"\b(401|403|404|429)\b", p.stderr or "")
        status = match.group(1) if match else None
        code = f"HTTP_{status}" if status else "EXTERNAL_COMMAND_FAILED"
        raise AuditBlocked(
            f"{args[0]} {args[1]} 호출 실패"
            + (f" (HTTP {status})" if status else " (상태 미확인)"),
            code,
        )
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
    """Git matching-refs returns one complete, non-paginated JSON array."""
    refs = api(f"/repos/{REPO}/git/matching-refs/tags/v")
    require(isinstance(refs, list) and all(isinstance(x, dict) for x in refs),
            "Git matching-refs 전체 배열 형식 오류")
    tags: dict[str, str] = {}
    for ref in refs:
        name = ref.get("ref")
        obj = ref.get("object")
        require(isinstance(name, str)
                and re.fullmatch(r"refs/tags/v[^\s/]+", name) is not None
                and isinstance(obj, dict) and obj.get("type") in ("tag", "commit")
                and isinstance(obj.get("sha"), str)
                and bool(policy.SHA.fullmatch(obj["sha"])), "Git tag ref 형식 오류")
        require(name not in tags, "중복 Git tag")
        sha = obj["sha"]
        if obj["type"] == "tag":
            annotation = api(f"/repos/{REPO}/git/tags/{sha}")
            require(isinstance(annotation, dict) and annotation.get("sha") == sha,
                    "annotated tag object SHA 출처 불일치")
            target = annotation.get("object")
            require(isinstance(target, dict) and target.get("type") == "commit",
                    "중첩/비정상 annotated tag")
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


def authenticated_manifest_digest(tag: str) -> str:
    """Read the canonical top-level manifest/index digest for an exact tag.

    docker/buildx uses the previously authenticated GHCR credentials. The
    descriptor must identify the requested image and an OCI/Docker manifest;
    a child platform digest, malformed output or a 404 is never proof of
    absence. Do not combine a format query and a second racing inspect.
    """
    image = f"ghcr.io/planner77/mastergantt:{tag}"
    raw = process("docker", "buildx", "imagetools", "inspect", image)
    header = raw.split("Manifests:", 1)[0]
    names = re.findall(r"(?m)^Name:\s*(\S+)\s*$", header)
    media = re.findall(r"(?m)^MediaType:\s*(\S+)\s*$", header)
    digests = re.findall(r"(?m)^Digest:\s*(\S+)\s*$", header)
    valid_media = {
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
        "application/vnd.docker.distribution.manifest.v2+json",
    }
    require(names == [image] and len(media) == 1 and media[0] in valid_media
            and len(digests) == 1 and policy.DIGEST.fullmatch(digests[0]) is not None,
            "인증 OCI manifest의 name/mediaType/top-level digest 누락 또는 손상",
            code="OCI_MANIFEST_INVALID")
    return digests[0]


def registry_inventory() -> tuple[set[str], dict[str, str]]:
    """Canonical GHCR tags are bare SemVer; historical CI tags are separate.

    Only a complete authenticated GitHub Packages inventory can establish an
    ABSENT tag. Manifest lookup failure for an existing tag is UNKNOWN/BLOCKED.
    """
    stage("GHCR exact SemVer tag")
    versions = pages(
        "/users/planner77/packages/container/mastergantt/versions?state=active",
    )
    tags: set[str] = set()
    seen_ids: set[int] = set()
    wanted = set(VERSIONS) | {f"ci-{policy.PUBLISHED_SHA}"}
    for version in versions:
        metadata = version.get("metadata")
        require(isinstance(metadata, dict), "GHCR package metadata 누락",
                code="PACKAGE_METADATA_INVALID")
        container = metadata.get("container")
        require(isinstance(container, dict), "GHCR container metadata 누락",
                code="PACKAGE_METADATA_INVALID")
        values = container.get("tags")
        require(isinstance(values, list)
                and all(isinstance(v, str) and
                        re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", v)
                        for v in values),
                "인증 GHCR tag 형식/목록 불명확", code="PACKAGE_METADATA_INVALID")
        version_id = version.get("id")
        require(type(version_id) is int and version_id > 0
                and version_id not in seen_ids,
                "GHCR package version ID 누락/중복", code="PACKAGE_DUPLICATE")
        seen_ids.add(version_id)
        for tag in values:
            require(tag not in tags, "GHCR package tag 중복",
                    code="PACKAGE_DUPLICATE")
            tags.add(tag)

    digest_map: dict[str, str] = {}
    for tag in sorted(tags & wanted):
        version = "0.106.1" if tag.startswith("ci-") else tag
        expected = (policy.PUBLISHED_DIGEST
                    if tag in ("0.106.1", f"ci-{policy.PUBLISHED_SHA}") else None)
        stage("Main verified ci-SHA candidate" if tag.startswith("ci-")
              else "authenticated OCI digest",
              version=version, tag=tag, expected_digest=expected)
        digest = authenticated_manifest_digest(tag)
        EVIDENCE_CONTEXT["actual_digest"] = digest
        require(expected is None or digest == expected,
                f"{tag}: 인증 OCI exact digest가 보존된 게시 증거와 불일치",
                code="OCI_DIGEST_MISMATCH")
        digest_map[tag] = digest
    return tags, digest_map

def run_verified(run_id: int, attempt: int, conclusion: str, expected_sha: str) -> str:
    run = api(f"/repos/{REPO}/actions/runs/{run_id}")
    path = ".github/workflows/ci.yml" if run_id == RELEASE_MAIN[0] else ".github/workflows/release-image.yml"
    event = "push" if run_id == RELEASE_MAIN[0] else "workflow_dispatch"
    require(isinstance(run, dict) and type(run.get("id")) is int
            and run["id"] == run_id and run.get("run_attempt") == attempt
            and run.get("status") == "completed"
            and run.get("conclusion") == conclusion
            and run.get("head_sha") == expected_sha
            and run.get("path") == path and run.get("event") == event
            and ((run.get("repository") or {}).get("full_name") == REPO),
            "원본 릴리스 CI/attempt/SHA/source 출처 불일치")
    jobs = pages(f"/repos/{REPO}/actions/runs/{run_id}/attempts/{attempt}/jobs", key="jobs")
    require(bool(jobs) and all(type(job.get("id")) is int
            and job.get("status") == "completed"
            and job.get("conclusion") in ("success", "skipped") for job in jobs)
            and len({job["id"] for job in jobs}) == len(jobs),
            "CI job 누락·중복·미완료 또는 실패")
    success = {job.get("name") for job in jobs if job["conclusion"] == "success"}
    required = ({"정책·저장소 계약 검사", "Docker smoke 구현"}
                if run_id == RELEASE_MAIN[0] else {
                    "Release quality gates", "Main verified digest 릴리스 후보 재검증",
                    "Verified digest attestation·최종 tag promotion",
                    "Release 완료 lifecycle handoff",
                })
    require(required <= success, "원본 릴리스 CI 필수 job 성공 증거 누락")
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
            require(row["id"] > 0 and row.get("html_url") ==
                    f"https://github.com/{REPO}/issues/{issue}#issuecomment-{row['id']}",
                    "Owner marker 출처 댓글 URL 불일치")
            result.append((row["id"], match.group(1), data))
    return result


def latest_marker(rows: list[tuple[int, str, dict[str, Any]]],
                  prefix: str, version: str, authorized: bool) -> bool:
    candidates = [(n, d) for n, name, d in rows
                  if name == prefix and d.get("expected_version") == version]
    if not candidates:
        return False
    ids = [n for n, _ in candidates]
    require(len(ids) == len(set(ids)), "동일 Owner 댓글의 중복·충돌 marker")
    decision = max(candidates, key=lambda item: item[0])[1]
    require(type(decision.get("authorized")) is bool
            and isinstance(decision.get("note"), str)
            and bool(decision["note"].strip()), "최신 Owner marker schema 오류")
    return decision["authorized"] is authorized


def b2_decision(rows: list[tuple[int, str, dict[str, Any]]],
                chain: list[str]) -> str | None:
    found = [(n, d) for n, kind, d in rows
             if kind == "mastergantt-release-debt-authorization:v2"]
    if not found:
        return None
    require(len({n for n, _ in found}) == len(found), "Owner B2 marker 중복")
    number, decision = max(found, key=lambda row: row[0])
    expected = {
        "authorized": True, "mode": "B2_RETIRE_BOTH",
        "source_550_sha": B2_SOURCES[0][0],
        "source_615_sha": B2_SOURCES[1][0],
        "verified_615_sha": B2_SOURCES[2][0],
        "verified_550_sha": B2_SOURCES[4][0],
        "recovery_issue": 633, "recovery_pr": 635,
        "recovery_sha": policy.PUBLISHED_SHA, "expected_version": "0.106.1",
    }
    require(type(decision) is dict and set(decision) == set(expected) | {"note"}
            and all(decision[k] == v for k, v in expected.items())
            and isinstance(decision["note"], str)
            and len(decision["note"].strip()) >= 20,
            "Owner B2 정확한 승인·SHA·버전 원장 부적합")
    require(all(sha in chain for sha, _, _ in B2_SOURCES)
            and [chain.index(sha) for sha, _, _ in B2_SOURCES]
            == sorted(chain.index(sha) for sha, _, _ in B2_SOURCES)
            and chain.index(B2_SOURCES[-1][0]) < chain.index(policy.PUBLISHED_SHA),
            "B2 원본 5개 first-parent 순서 위반")
    return f"https://github.com/{REPO}/issues/633#issuecomment-{number}"


def historical_prs_verified(chain: list[str]) -> bool:
    """Independent REST authentication of every immutable B2 PR / merge-SHA.

    A signed retirement comment alone is not proof that a listed SHA belongs
    to its claimed merged PR. Check both GitHub PR identity and main ancestry.
    """
    require(len(chain) == len(set(chain)), "historical first-parent SHA 중복")
    for sha, issue, number in B2_SOURCES:
        require(sha in chain, f"historical PR #{number} first-parent SHA 누락")
        pr = api(f"/repos/{REPO}/pulls/{number}")
        require(isinstance(pr, dict)
                and type(pr.get("number")) is int and pr["number"] == number
                and pr.get("state") == "closed" and pr.get("merged") is True
                and pr.get("merge_commit_sha") == sha
                and (pr.get("base") or {}).get("ref") == "main"
                and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == REPO
                and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == REPO,
                f"historical PR #{number} 병합/저장소/main/SHA 출처 불일치")
        # Validate exactly one standalone Refs #issue line (including CRLF); never
        # trust a retirement bot's independently typed Issue number or an inline
        # prose mention. Repeated/conflicting Refs fail closed.
        body = pr.get("body")
        require(isinstance(body, str),
                f"historical PR #{number} Issue refs 본문 미인증/누락")
        refs = re.findall(r"(?m)^[ \t]*Refs[ \t]+#([1-9][0-9]*)[ \t]*\r?$", body)
        # A valid line must not coexist with a spoofed inline/quoted Refs.
        mentions = re.findall(r"(?i)\bRefs[ \t]+#[0-9]+", body)
        require(refs == [str(issue)] and len(mentions) == 1,
                f"historical PR #{number} Issue #{issue} 귀속 불일치")
    return True


def retirement_verified(issue: int, decision_url: str | None) -> bool:
    rows = pages(f"/repos/{REPO}/issues/{issue}/comments")
    original = [row for row in B2_SOURCES if row[1] == issue]
    expected = {
        "issue": issue, "original_shas": [row[0] for row in original],
        "original_prs": [row[2] for row in original],
        "unissued_version": "0.105.0" if issue == 550 else "0.106.0",
        "replacement_sha": policy.PUBLISHED_SHA,
        "replacement_version": "0.106.1",
        "replacement_digest": policy.PUBLISHED_DIGEST,
        "decision_url": decision_url,
    }
    seen = []
    for row in rows:
        matches = [m.group(2) for m in MARKER.finditer(row.get("body") or "")
                   if m.group(1) == "mastergantt-release-debt-retired:v1"]
        if not matches:
            continue
        require(len(matches) == 1
                and ((row.get("user") or {}).get("login")) == "github-actions[bot]"
                and type(row.get("id")) is int and row["id"] > 0
                and row.get("html_url") ==
                f"https://github.com/{REPO}/issues/{issue}#issuecomment-{row['id']}",
                "RETIRED marker 작성자·중복·출처 불일치")
        try:
            value = json.loads(matches[0])
        except ValueError as exc:
            raise policy.SuccessionBlocked("RETIRED 원장 JSON 오류") from exc
        require(decision_url is not None and type(value) is dict
                and value == expected, "RETIRED 원본/대체 SHA·digest·Owner 출처 불일치")
        seen.append(row["id"])
    require(len(seen) <= 1, "RETIRED 원장 중복")
    info = api(f"/repos/{REPO}/issues/{issue}")
    require(isinstance(info, dict) and info.get("number") == issue
            and info.get("state") in ("open", "closed"), "RETIRED Issue 상태 누락")
    return len(seen) == 1 and info["state"] == "closed"


def release_lifecycle_verified(
    chain: list[str], tags: dict[str, str], ghcr: set[str],
    digests: dict[str, str], decision_url: str | None,
) -> bool:
    # The three sources have deliberately different tag names/contracts.
    stage("Git annotated tag/peeled SHA", version="0.106.1", tag="v0.106.1")
    require(policy.PUBLISHED_SHA in chain
            and tags.get("refs/tags/v0.106.1") == policy.PUBLISHED_SHA,
            "v0.106.1 Git annotated tag/peeled SHA 불일치",
            code="GIT_TAG_SHA_MISMATCH")
    stage("GHCR exact SemVer tag", version="0.106.1", tag="0.106.1")
    require("0.106.1" in ghcr, "GHCR exact tag 0.106.1 누락",
            code="GHCR_EXACT_TAG_MISSING")
    stage("authenticated OCI digest", version="0.106.1", tag="0.106.1",
          expected_digest=policy.PUBLISHED_DIGEST,
          actual_digest=digests.get("0.106.1"))
    require(digests.get("0.106.1") == policy.PUBLISHED_DIGEST,
            "GHCR 0.106.1 authenticated OCI digest 불일치",
            code="OCI_DIGEST_MISMATCH")
    stage("published PR provenance", version="0.106.1", tag="v0.106.1")
    pr = api(f"/repos/{REPO}/pulls/635")
    require(isinstance(pr, dict) and pr.get("number") == 635
            and pr.get("merged") is True
            and pr.get("merge_commit_sha") == policy.PUBLISHED_SHA
            and (pr.get("base") or {}).get("ref") == "main",
            "v0.106.1 병합 PR/source 검증 실패", code="PUBLISHED_PR_INVALID")
    stage("#633 B2 Owner/retirement provenance", version="0.106.1")
    require(bool(decision_url), "#633 Owner B2 원장 부재",
            code="OWNER_B2_MISSING")

    candidate = f"ci-{policy.PUBLISHED_SHA}"
    stage("Main verified ci-SHA candidate", version="0.106.1",
          tag=candidate, expected_digest=policy.PUBLISHED_DIGEST,
          actual_digest=digests.get(candidate))
    require(candidate in ghcr,
            "v0.106.1 당시 Main 검증 후보 ci-SHA 현재 존재 증거 누락; "
            "cleanup/lifecycle 원장 확인 필요, 자동 재게시 금지",
            code="MAIN_CANDIDATE_MISSING")
    require(digests.get(candidate) == policy.PUBLISHED_DIGEST,
            "Main verified candidate / v0.106.1 OCI digest 불일치",
            code="MAIN_CANDIDATE_DIGEST_MISMATCH")
    return True

def successor_prepare(rows: list[tuple[int, str, dict[str, Any]]], main: str) -> bool:
    found = [(n, d) for n, kind, d in rows
             if kind == "mastergantt-release-succession-prepare:v1"]
    if not found:
        return False
    require(len({n for n, _ in found}) == len(found), "Owner 준비 결정 중복")
    _number, decision = max(found, key=lambda row: row[0])
    require(type(decision) is dict and set(decision) == {
        "authorized", "source_issue", "source_version", "expected_version",
        "candidate_sha", "note",
    } and type(decision.get("authorized")) is bool
            and decision.get("source_issue") == 616
            and decision.get("source_version") == "0.107.0"
            and decision.get("expected_version") == "0.108.0"
            and decision.get("candidate_sha") == main
            and isinstance(decision.get("note"), str)
            and len(decision["note"].strip()) >= 20,
            "Owner 후보 준비 원장 version/SHA/scope 부적합")
    return decision["authorized"] is True


def collect() -> tuple[dict[str, Any], dict[str, Any]]:
    require(os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
            and os.environ.get("GITHUB_REF") == "refs/heads/main"
            and os.environ.get("GITHUB_REPOSITORY") == REPO,
            "default-main workflow_dispatch 전용")
    stage("main")
    main = main_snapshot()
    stage("first-parent")
    chain = ancestry(main)
    stage("Git tags")
    tags = tag_inventory()
    stage("GitHub Releases")
    releases = release_inventory()
    stage("GHCR exact SemVer tag")
    ghcr, digests = registry_inventory()
    inventory = {}
    for v in VERSIONS:
        git_key = "v" + v
        git_sha = tags.get("refs/tags/" + git_key)
        # GHCR does NOT use the Git v-prefix. Never accept v-prefixed aliases.
        inventory[v] = dict(
            git_tag="PRESENT" if git_sha else "ABSENT", git_sha=git_sha,
            github_release="PRESENT" if git_key in releases else "ABSENT",
            ghcr_tag="PRESENT" if v in ghcr else "ABSENT",
            ghcr_digest=digests.get(v),
        )
    global OBSERVED_INVENTORY
    OBSERVED_INVENTORY = dict(inventory)
    require(all((v not in ghcr) or (v in digests) for v in VERSIONS),
            "GHCR exact tag의 인증 OCI digest 누락",
            code="OCI_DIGEST_UNKNOWN")
    historical_candidate_tag = f"ci-{policy.PUBLISHED_SHA}"
    historical_candidate = dict(
        tag=historical_candidate_tag, source_sha=policy.PUBLISHED_SHA,
        status="PRESENT" if historical_candidate_tag in ghcr else "ABSENT",
        digest=digests.get(historical_candidate_tag),
    )
    stage("Owner")
    markers_550 = owner_markers(550)
    markers_615 = owner_markers(615)
    markers_616 = owner_markers(616)
    markers_633 = owner_markers(633)
    decision_url = b2_decision(markers_633, chain)
    stage("historical PR identity")
    historical_prs_verified(chain)
    stage("original CI")
    original_run = api(f"/repos/{REPO}/actions/runs/38313359094")
    require(original_run.get("conclusion") == "failure"
            and original_run.get("run_attempt") == 1, "#616 원본 실패 증거 누락")
    stage("historical Main Run+Attempt", version="0.106.1")
    main_run = run_verified(*RELEASE_MAIN, policy.PUBLISHED_SHA)
    stage("historical Release Run+Attempt", version="0.106.1")
    release_run = run_verified(*RELEASE_RUN, policy.PUBLISHED_SHA)
    lifecycle = release_lifecycle_verified(chain, tags, ghcr, digests, decision_url)
    stage("#633 B2 Owner/retirement provenance")
    retired_550 = retirement_verified(550, decision_url)
    retired_615 = retirement_verified(615, decision_url)
    stage("Owner policy")
    # Each affirmative lifecycle decision needs independently authenticated,
    # scoped evidence. Never promote a missing marker to True.
    evidence = dict(
        collector="trusted-main-read-only-v1", repository=REPO, main_sha=main,
        git_complete=True, github_releases_complete=True,
        ghcr_packages_complete=True, authenticated_registry=True,
        release_main_run=main_run, release_run=release_run,
        release_lifecycle_verified=lifecycle,
        source_633_owner_verified=latest_marker(
            markers_633, "mastergantt-release-authorization:v1", "0.106.1", True),
        retired_550=retired_550, retired_615=retired_615,
        revoked_550=latest_marker(markers_550, "mastergantt-release-authorization:v1", "0.105.0", False),
        revoked_615=latest_marker(markers_615, "mastergantt-release-authorization:v1", "0.106.0", False),
        revoked_616=latest_marker(
            markers_616, "mastergantt-release-authorization:v1", "0.107.0", False),
        successor_prepare_owner=successor_prepare(markers_616, main),
    )
    record = dict(
        source_sha=policy.ORIGINAL, correction_sha=policy.CORRECTION,
        main_sha=main, candidate_sha=main, candidate_version=policy.CANDIDATE,
        first_parent=chain, contains_f2=True, contains_correction=True,
        original_ci="FAIL", original_owner_marker_preserved=bool(markers_616),
        release_inventory=inventory, published_candidate=historical_candidate,
        owner_new_version_authorized=False, evidence=evidence,
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
    stage("main recheck")
    require(main_snapshot() == main, "감사 도중 main 변경")
    return record, provenance


def main() -> int:
    stage("precondition")
    result: dict[str, Any] = {
        "decision": "BLOCKED", "publish": False, "retire": False,
        "close_issue_616": False, "repository": REPO,
        "run_id": os.environ.get("GITHUB_RUN_ID"),
        "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "main_sha": os.environ.get("GITHUB_SHA"),
    }
    try:
        record, provenance = collect()
        result["provenance"] = provenance
        result["inventory"] = record["release_inventory"]
        stage("policy")
        result["result"] = policy.evaluate(record)
        result["decision"] = result["result"]["decision"]
    except Exception as exc:
        result["reason"] = (str(exc) if isinstance(exc, policy.SuccessionBlocked)
                            else type(exc).__name__)[:350]
        result["reason_code"] = (exc.code if isinstance(exc, AuditBlocked)
                                 else "POLICY_BLOCKED" if isinstance(exc, policy.SuccessionBlocked)
                                 else "UNEXPECTED_EVIDENCE_ERROR")
    if OBSERVED_INVENTORY and "inventory" not in result:
        result["inventory"] = OBSERVED_INVENTORY
    result["stage"] = STAGE
    result.update(EVIDENCE_CONTEXT)
    Path("release-succession-audit.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    def clean(value: Any) -> str:
        return re.sub(r"[\r\n|<>]", " ", str(value or ""))[:350]
    summary = (
        "### Release succession read-only audit · #662\n"
        f"- Decision: **{clean(result['decision'])}**\n"
        f"- Stage: `{clean(result['stage'])}`\n"
        f"- Reason code: `{clean(result.get('reason_code', 'NONE'))}`\n"
        f"- Reason: {clean(result.get('reason', 'policy evidence complete'))}\n"
        f"- Version/tag: {clean(result.get('version'))} / {clean(result.get('tag'))}\n"
        f"- Expected digest: {clean(result.get('expected_digest'))}\n"
        f"- Actual digest: {clean(result.get('actual_digest'))}\n"
        f"- Run / attempt: {clean(result['run_id'])} / {clean(result['run_attempt'])}\n"
        f"- main SHA: `{clean(result['main_sha'])}`\n"
        "- Authority: read-only; publish/retire/close disabled.\n"
    )
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as out:
            out.write(summary)
    print(summary)
    print(f"승계 감사: {result['decision']}; 게시·퇴역·종료는 수행하지 않음")
    return 0 if result["decision"] == "PREPARE_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
