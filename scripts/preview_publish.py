#!/usr/bin/env python3
"""Owner-only, default-main Preview GHCR authorization (Issue #703).

This module runs only from the trusted workflow checkout, never from a candidate
branch. A Preview is not a CI, QA, merge, or production release approval.
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

EXPECTED_REPO = "planner77/masterGantt"
PREVIEW_PACKAGE = "mastergantt-preview"
SHA = re.compile(r"^[a-f0-9]{40}$")
BRANCH = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,120}$")
ACCEPT = ", ".join((
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
))


class Blocked(Exception):
    """Unsafe, stale, ambiguous, or unauthorized Preview request."""


def require(ok: bool, message: str) -> None:
    if not ok:
        raise Blocked(message)


def parse_request(issue: str, branch: str, source_sha: str) -> dict[str, str]:
    require(bool(re.fullmatch(r"[1-9][0-9]{0,7}", issue)), "Issue 번호가 올바르지 않습니다")
    require(bool(SHA.fullmatch(source_sha)), "정확한 소문자 40자리 source SHA가 필요합니다")
    require(bool(BRANCH.fullmatch(branch)), "허용되지 않는 branch 이름입니다")
    require(not any(x in branch for x in ("..", "//", "@{")) and
            not branch.endswith(("/", ".lock")) and
            not branch.startswith(("-", ".")), "안전하지 않은 branch ref입니다")
    require(bool(re.search(r"(?:^|/)issue-" + re.escape(issue) + r"(?:[-/]|$)", branch, re.I)),
            "Issue 번호를 포함한 독립 작업 branch가 필요합니다")
    return {"issue": issue, "branch": branch, "sha": source_sha}


def validate_snapshot(request: dict[str, str], repo: dict, issue: dict,
                      branch: dict, default: dict, *, actor: str,
                      owner: str, event_name: str, ref: str,
                      workflow_sha: str, repository: str) -> dict[str, str]:
    require(repository == EXPECTED_REPO and repo.get("full_name") == EXPECTED_REPO,
            "허용되지 않는 저장소입니다")
    require(actor.casefold() == owner.casefold() and
            owner.casefold() == EXPECTED_REPO.split("/")[0].casefold(),
            "저장소 Owner만 수동 게시할 수 있습니다")
    require(event_name == "workflow_dispatch", "수동 Preview 실행만 허용합니다")
    default_name = repo.get("default_branch")
    require(isinstance(default_name, str) and default_name == "main",
            "신뢰할 수 있는 기본 branch가 아닙니다")
    require(ref == "refs/heads/" + default_name, "trusted main에서 실행해야 합니다")
    require(SHA.fullmatch(workflow_sha or "") is not None, "Workflow SHA가 유효하지 않습니다")
    require(default.get("name") == default_name and
            default.get("commit", {}).get("sha") == workflow_sha,
            "수동 실행 main이 현재 기본 branch와 다릅니다 (stale)")
    require(issue.get("number") == int(request["issue"]) and
            issue.get("state") == "open" and "pull_request" not in issue,
            "현재 열려 있는 실제 Issue가 아닙니다")
    require(branch.get("name") == request["branch"] and
            branch.get("commit", {}).get("sha") == request["sha"],
            "작업 branch HEAD/source SHA가 변경되거나 일치하지 않습니다")
    require(request["branch"] != default_name, "main은 Preview 원본이 될 수 없습니다")

    package = EXPECTED_REPO.split("/")[0].lower() + "/" + PREVIEW_PACKAGE
    tag = "issue-" + request["issue"] + "-" + request["sha"]
    return {
        "issue_number": request["issue"],
        "branch": request["branch"],
        "source_sha": request["sha"],
        "image_name": "ghcr.io/" + package,
        "image_tag": tag,
        "image_ref": "ghcr.io/" + package + ":" + tag,
    }


def github_json(path: str, token: str) -> dict:
    url = "https://api.github.com" + path
    req = Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mastergantt-preview-703",
    })
    try:
        with urlopen(req, timeout=15) as response:
            result = json.load(response)
            require(isinstance(result, dict), "GitHub API 응답 타입이 올바르지 않습니다")
            return result
    except (HTTPError, URLError, ValueError) as exc:
        raise Blocked("GitHub API 인증·조회 실패; 불확실한 출처는 거부: " +
                      str(getattr(exc, "code", "network"))) from None


def authorize(env: dict[str, str], fetch=github_json) -> dict[str, str]:
    request = parse_request(env.get("ISSUE_NUMBER", ""), env.get("SOURCE_BRANCH", ""),
                            env.get("SOURCE_SHA", ""))
    token = env.get("GH_TOKEN", "")
    require(bool(token), "GitHub 인증 토큰이 없습니다")
    prefix = "/repos/" + EXPECTED_REPO
    repo = fetch(prefix, token)
    issue = fetch(prefix + "/issues/" + request["issue"], token)
    branch = fetch(prefix + "/branches/" + quote(request["branch"], safe=""), token)
    default = fetch(prefix + "/branches/" + quote(repo.get("default_branch", ""), safe=""), token)
    return validate_snapshot(
        request, repo, issue, branch, default,
        actor=env.get("GITHUB_ACTOR", ""),
        owner=env.get("GITHUB_REPOSITORY_OWNER", ""),
        event_name=env.get("GITHUB_EVENT_NAME", ""),
        ref=env.get("GITHUB_REF", ""),
        workflow_sha=env.get("GITHUB_SHA", ""),
        repository=env.get("GITHUB_REPOSITORY", ""),
    )


def manifest_status(name: str, tag: str, actor: str, token: str) -> int:
    """Authenticated GHCR registry lookup; only 404 means tag is absent."""
    repository = name.removeprefix("ghcr.io/")
    require(repository == "planner77/" + PREVIEW_PACKAGE, "Preview 패키지만 조회합니다")
    require(bool(token) and bool(actor), "Registry 인증 정보가 없습니다")
    credentials = base64.b64encode((actor + ":" + token).encode()).decode()
    query = urlencode({
        "service": "ghcr.io",
        "scope": "repository:" + repository + ":pull",
    })
    auth_req = Request("https://ghcr.io/token?" + query, headers={
        "Authorization": "Basic " + credentials,
        "Accept": "application/json",
    })
    try:
        with urlopen(auth_req, timeout=15) as response:
            auth_payload = json.load(response)
        bearer = auth_payload.get("token") or auth_payload.get("access_token")
        require(isinstance(bearer, str) and bearer, "GHCR Bearer 토큰 확인 실패")
        manifest_req = Request(
            "https://ghcr.io/v2/" + repository + "/manifests/" + quote(tag, safe=""),
            headers={"Authorization": "Bearer " + bearer, "Accept": ACCEPT},
            method="GET",
        )
        try:
            with urlopen(manifest_req, timeout=15) as response:
                return response.status
        except HTTPError as exc:
            return exc.code
    except (HTTPError, URLError, ValueError, TypeError) as exc:
        raise Blocked("GHCR 인증·manifest 조회 실패 (UNKNOWN): " +
                      str(getattr(exc, "code", "network"))) from None


def assert_absent(output: dict[str, str], actor: str, token: str,
                  lookup=manifest_status) -> None:
    status = lookup(output["image_name"], output["image_tag"], actor, token)
    require(status == 404, "GHCR tag 존재 또는 인증 불확실 (HTTP " +
            str(status) + "); 덮어쓰기 금지")


def write_output(output: dict[str, str], path: str) -> None:
    require(bool(path), "GITHUB_OUTPUT 파일이 없습니다")
    with open(path, "a", encoding="utf-8") as file:
        for key, value in output.items():
            require("\n" not in value and "\r" not in value, "잘못된 출력 값")
            file.write(key + "=" + value + "\n")


def main() -> int:
    try:
        require(len(sys.argv) == 2 and sys.argv[1] in ("authorize", "check-absent"),
                "usage: preview_publish.py {authorize|check-absent}")
        output = authorize(os.environ)
        if sys.argv[1] == "check-absent":
            assert_absent(output, os.environ.get("GITHUB_ACTOR", ""),
                          os.environ.get("GH_TOKEN", ""))
        else:
            write_output(output, os.environ.get("GITHUB_OUTPUT", ""))
        print("Preview " + sys.argv[1] + ": PASS; issue=" + output["issue_number"] +
              ", source=" + output["source_sha"] + ", ref=" + output["image_ref"] +
              "; UNVERIFIED_PREVIEW (정식 CI/Release 승인 아님)")
        return 0
    except (Blocked, OSError, KeyError, TypeError) as exc:
        print("BLOCKED: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
