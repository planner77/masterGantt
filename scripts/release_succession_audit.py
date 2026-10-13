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


def stage(name: str) -> None:
    global STAGE
    STAGE = name

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
        # The immutable PR's primary issue is cross-checked via its canonical
        # body rather than accepting a bot marker's independently typed issue.
        body = pr.get("body") or ""
        refs = re.findall(r"(?im)^\\s*Refs\\s+#([1-9][0-9]*)\\s*$", body)
        require(refs == [str(issue)],
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
    require(policy.PUBLISHED_SHA in chain
            and tags.get("refs/tags/v0.106.1") == policy.PUBLISHED_SHA
            and "v0.106.1" in ghcr
            and digests.get("v0.106.1") == policy.PUBLISHED_DIGEST,
            "v0.106.1 Git/OCI exact release 누락")
    pr = api(f"/repos/{REPO}/pulls/635")
    require(isinstance(pr, dict) and pr.get("number") == 635
            and pr.get("merged") is True
            and pr.get("merge_commit_sha") == policy.PUBLISHED_SHA
            and (pr.get("base") or {}).get("ref") == "main",
            "v0.106.1 병합 PR/source 검증 실패")
    require(bool(decision_url), "#633 Owner B2 원장 부재")
    candidate = f"ci-{policy.PUBLISHED_SHA}"
    require(candidate in ghcr, "v0.106.1 Main 검증 이미지 tag 누락")
    raw = process("docker", "buildx", "imagetools", "inspect",
                  f"ghcr.io/planner77/mastergantt:{candidate}")
    match = re.search(r"(?m)^Digest:\s*(sha256:[0-9a-f]{64})\s*$", raw)
    require(match is not None and match.group(1) == policy.PUBLISHED_DIGEST,
            "Main verified candidate / v0.106.1 OCI digest 불일치")
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
    stage("GHCR")
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
    stage("release lifecycle")
    main_run = run_verified(*RELEASE_MAIN, policy.PUBLISHED_SHA)
    release_run = run_verified(*RELEASE_RUN, policy.PUBLISHED_SHA)
    lifecycle = release_lifecycle_verified(chain, tags, ghcr, digests, decision_url)
    stage("retirement")
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
    except (policy.SuccessionBlocked, KeyError, TypeError, ValueError,
            subprocess.TimeoutExpired, OSError) as exc:
        result["reason"] = str(exc)[:350]
    result["stage"] = STAGE
    Path("release-succession-audit.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    def clean(value: Any) -> str:
        return re.sub(r"[\r\n|<>]", " ", str(value or ""))[:350]
    summary = (
        "### Release succession read-only audit · #655\n"
        f"- Decision: **{clean(result['decision'])}**\n"
        f"- Stage: `{clean(result['stage'])}`\n"
        f"- Reason: {clean(result.get('reason', 'policy evidence complete'))}\n"
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
