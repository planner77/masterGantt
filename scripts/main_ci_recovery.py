#!/usr/bin/env python3
"""Issue #639: fail-closed manual recovery of an immutable, previously merged main SHA.

The dispatch event and artifacts are data, never trusted code. Only the
default-branch validator may authorize a recovery; push CI is unchanged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SHA = re.compile(r"^[0-9a-f]{40}$")
MARKER = re.compile(r"<!--\s*mastergantt-main-ci-recovery:v1\s+({.*?})\s*-->", re.S)
RELEASE_MARKER = re.compile(r"<!--\s*mastergantt-release-authorization:v1\s+({.*?})\s*-->", re.S)
REQUIRED = (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
)
OTHER_JOBS = (
    "정책·저장소 계약 검사", "TypeScript 타입 검사", "ESLint",
    "Vitest 단위·통합 테스트", "Next.js production build",
    "Docker smoke 구현", "Main 임시 commit 이미지 게시·검증·정리",
)
SCHEMA = "mastergantt-exact-main-recovery-v1"


class Blocked(RuntimeError):
    """No mutation is permitted when provenance or a dependency is unknown."""


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise Blocked("exact-main-recovery BLOCKED: " + reason)


def command(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(args, text=True, capture_output=True, timeout=90, check=False)
    if check and p.returncode != 0:
        raise Blocked(f"{' '.join(args[:3])}: {p.stderr.strip() or 'command failed'}")
    return p


def gh(path: str) -> Any:
    value = command("gh", "api", "-H", "Accept: application/vnd.github+json", path).stdout
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise Blocked(f"GitHub API invalid JSON: {path}") from exc


def pages(path: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for page in range(1, 101):
        sep = "&" if "?" in path else "?"
        values = gh(f"{path}{sep}per_page=100&page={page}")
        require(isinstance(values, list) and len(values) <= 100, f"API pagination invalid: {path}")
        require(all(isinstance(row, dict) for row in values), "API row type invalid")
        results.extend(values)
        if len(values) < 100:
            return results
    raise Blocked("pagination truncated")


@dataclass(frozen=True)
class Identity:
    repo: str
    issue: int
    pr: int
    sha: str
    version: str
    comment_id: int
    source_sha: str
    owner: str

    def artifact(self, run_id: int, attempt: int) -> dict[str, Any]:
        return {
            "schema": SCHEMA, "repo": self.repo, "issue": self.issue,
            "pr": self.pr, "target_sha": self.sha, "expected_version": self.version,
            "owner_comment_id": self.comment_id, "source_sha": self.source_sha,
            "run_id": run_id, "run_attempt": attempt, "mode": "manual_recovery",
        }


def inputs_identity(inputs: dict[str, Any], repo: str, source_sha: str) -> Identity:
    require(isinstance(inputs, dict), "dispatch inputs must be an object")
    required = ("target_sha", "target_issue", "target_pr", "expected_version", "owner_comment_id")
    require(all(isinstance(inputs.get(k), str) and inputs[k].strip() for k in required),
            "missing exact recovery inputs")
    sha = inputs["target_sha"].strip()
    require(SHA.fullmatch(sha) is not None, "full target SHA required")
    require(re.fullmatch(r"0|[1-9]\d*", inputs["target_issue"].strip()) is not None, "issue integer required")
    require(re.fullmatch(r"0|[1-9]\d*", inputs["target_pr"].strip()) is not None, "PR integer required")
    require(re.fullmatch(r"0|[1-9]\d*", inputs["owner_comment_id"].strip()) is not None,
            "Owner comment integer required")
    require(re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)",
                         inputs["expected_version"].strip()) is not None, "exact SemVer required")
    require(SHA.fullmatch(source_sha) is not None, "trusted source SHA missing")
    issue, pr, comment_id = (int(inputs[k]) for k in ("target_issue", "target_pr", "owner_comment_id"))
    require(issue > 0 and pr > 0 and comment_id > 0, "positive IDs required")
    return Identity(repo, issue, pr, sha, inputs["expected_version"].strip(), comment_id,
                    source_sha, "")


def trusted_marker(body: str, pattern: re.Pattern[str], fields: set[str]) -> dict[str, Any] | None:
    matches = pattern.findall(body or "")
    require(len(matches) <= 1, "duplicate owner marker")
    if not matches:
        return None
    try:
        data = json.loads(matches[0])
    except (ValueError, TypeError) as exc:
        raise Blocked("malformed owner marker JSON") from exc
    require(isinstance(data, dict) and set(data) == fields, "Owner marker schema mismatch")
    return data


def owner_decision(comments: list[dict[str, Any]], identity: Identity, owner: str) -> None:
    recoveries: list[tuple[int, dict[str, Any]]] = []
    releases: list[tuple[int, dict[str, Any]]] = []
    for comment in comments:
        if (comment.get("author_association") != "OWNER"
                or (comment.get("user") or {}).get("login") != owner):
            continue
        recovery = trusted_marker(comment.get("body") or "", MARKER,
                                  {"authorized", "issue", "pr", "merge_sha",
                                   "expected_version", "note"})
        if recovery is not None:
            require(type(recovery["authorized"]) is bool, "recovery authorized must be bool")
            require(type(recovery["issue"]) is int and type(recovery["pr"]) is int,
                    "marker issue/pr must be integers")
            require(isinstance(recovery["note"], str) and len(recovery["note"].strip()) >= 20,
                    "recovery requires an explanatory note")
            if (recovery["issue"], recovery["pr"], recovery["merge_sha"],
                    recovery["expected_version"]) == (
                    identity.issue, identity.pr, identity.sha, identity.version):
                recoveries.append((int(comment["id"]), recovery))
        release = trusted_marker(comment.get("body") or "", RELEASE_MARKER,
                                 {"authorized", "expected_version", "note"})
        if release is not None and release["expected_version"] == identity.version:
            require(type(release["authorized"]) is bool, "release authorized must be bool")
            releases.append((int(comment["id"]), release))
    require(recoveries, "no Owner recovery authorization for exact Issue/PR/SHA/version")
    selected_id, latest = max(recoveries, key=lambda v: v[0])
    require(selected_id == identity.comment_id, "superseded or incorrect Owner recovery comment")
    require(latest["authorized"] is True, "Owner recovery approval revoked")
    require(releases and max(releases, key=lambda v: v[0])[1]["authorized"] is True,
            "version-scoped Owner release authorization missing/revoked")


def repo_identity(identity: Identity) -> Identity:
    repo_info = gh(f"/repos/{identity.repo}")
    owner = (repo_info.get("owner") or {}).get("login")
    require(bool(owner) and identity.repo == repo_info.get("full_name"),
            "repository identity mismatch")
    return Identity(**{**identity.__dict__, "owner": owner})


def git(*args: str) -> str:
    return command("git", *args).stdout.strip()


def validate(identity: Identity, *, actor: str, source_event: str,
             require_local_head: bool = True) -> Identity:
    """Read-only, repeated before publication and before Finalizer mutation."""
    identity = repo_identity(identity)
    require(source_event == "workflow_dispatch" and actor == identity.owner,
            "only owner-initiated default-branch workflow_dispatch is eligible")
    main = ((gh(f"/repos/{identity.repo}/git/ref/heads/main") or {}).get("object") or {}).get("sha")
    require(main == identity.source_sha, "main advanced since trusted recovery dispatch")
    if require_local_head:
        require(git("rev-parse", "HEAD") == identity.source_sha,
                "trusted verifier must be checked out at dispatch main HEAD")
    require(identity.sha != identity.source_sha, "recovery only applies to older immutable merge")
    require(git("merge-base", "--is-ancestor", identity.sha, identity.source_sha) == "",
            "target must be an ancestor of default main")
    first_parent = git("rev-list", "--first-parent", identity.source_sha).splitlines()
    require(identity.sha in first_parent, "target not on first-parent main history")
    pr = gh(f"/repos/{identity.repo}/pulls/{identity.pr}")
    require(pr.get("merged") is True and pr.get("state") == "closed",
            "source pull request is not merged")
    require(pr.get("merge_commit_sha") == identity.sha, "PR merge SHA mismatch")
    require((pr.get("base") or {}).get("ref") == "main"
            and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == identity.repo,
            "PR repository/base mismatch")
    require(re.search(rf"(?im)^\s*Refs\s+#\s*{identity.issue}\s*$", pr.get("body") or "") is not None,
            "PR canonical issue trace mismatch")
    assigned = pages(f"/repos/{identity.repo}/commits/{identity.sha}/pulls")
    require(len(assigned) == 1 and assigned[0].get("number") == identity.pr
            and assigned[0].get("merge_commit_sha") == identity.sha,
            "commit-to-PR identity not uniquely verified")
    issue = gh(f"/repos/{identity.repo}/issues/{identity.issue}")
    require(issue.get("state") == "open" and not issue.get("pull_request"),
            "target Issue is not open")
    commit = gh(f"/repos/{identity.repo}/commits/{identity.sha}")
    parents = commit.get("parents") or []
    require(len(parents) == 2 and all(SHA.fullmatch(p.get("sha", "")) for p in parents),
            "target is not a two-parent merge")
    require(parents[0]["sha"] == git("rev-parse", identity.sha + "^1"),
            "first-parent provenance mismatch")
    def version_at(sha: str) -> str:
        return str(json.loads(git("show", sha + ":package.json")).get("version", ""))
    previous = version_at(parents[0]["sha"])
    require(previous != identity.version and version_at(identity.sha) == identity.version,
            "first-parent version transition mismatch")
    require(version_at(identity.source_sha) == identity.version,
            "later main release version advanced; recovery requires new owner decision")
    old_runs = gh(f"/repos/{identity.repo}/actions/workflows/ci.yml/runs"
                  f"?event=push&head_sha={identity.sha}&per_page=100")
    require(isinstance(old_runs, dict) and old_runs.get("total_count") == 0
            and old_runs.get("workflow_runs") == [], "original push Main CI exists; not missing-run recovery")
    comments = pages(f"/repos/{identity.repo}/issues/{identity.issue}/comments")
    owner_decision(comments, identity, identity.owner)
    return identity


def load_dispatch() -> tuple[Identity, str]:
    require(os.getenv("GITHUB_EVENT_NAME") == "workflow_dispatch"
            and os.getenv("GITHUB_REF") == "refs/heads/main",
            "only default-main manual event can request recovery")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    identity = inputs_identity(event.get("inputs") or {}, os.environ["GITHUB_REPOSITORY"],
                               os.environ["GITHUB_SHA"])
    return identity, os.environ["GITHUB_ACTOR"]


def package_tag_state(repo: str, tag: str) -> str:
    """Private GHCR tag absence needs authenticated, exhaustive inventory."""
    require(re.fullmatch(r"ci-[0-9a-f]{40}", tag) is not None, "invalid recovery candidate tag")
    owner, package = repo.split("/", 1)
    found = False
    for page in range(1, 101):
        values = gh(f"/users/{owner}/packages/container/{package.lower()}/versions"
                    f"?per_page=100&page={page}")
        require(isinstance(values, list) and len(values) <= 100, "GHCR inventory UNKNOWN")
        for row in values:
            require(isinstance(row, dict), "GHCR inventory row invalid")
            tags = ((row.get("metadata") or {}).get("container") or {}).get("tags")
            require(isinstance(tags, list) and all(isinstance(x, str) for x in tags),
                    "GHCR tags UNKNOWN")
            found = found or tag in tags
        if len(values) < 100:
            return "PRESENT" if found else "ABSENT"
    raise Blocked("GHCR inventory pagination truncated (UNKNOWN)")


def digest_for_tag(repo: str, sha: str) -> str:
    image = f"ghcr.io/{repo.lower()}:ci-{sha}"
    inspect = command("docker", "buildx", "imagetools", "inspect", image, check=False)
    require(inspect.returncode == 0, f"GHCR digest UNKNOWN for {image}")
    digests = re.findall(r"(?m)^Digest:\s*(sha256:[a-f0-9]{64})\s*$", inspect.stdout)
    require(len(digests) == 1, "unambiguous GHCR candidate digest missing")
    return digests[0]


def checked_jobs(jobs: list[dict[str, Any]]) -> None:
    names = [j.get("name") for j in jobs]
    expected = (*REQUIRED, *OTHER_JOBS,
                *(f"Chromium E2E shard {n}/6" for n in range(1, 7)))
    for name in expected:
        matches = [j for j in jobs if j.get("name") == name]
        require(len(matches) == 1, f"required main recovery job missing/duplicated: {name}")
        require(matches[0].get("status") == "completed"
                and matches[0].get("conclusion") == "success",
                f"required main recovery job not SUCCESS: {name}")
    require(len(names) == len(set(names)), "duplicate job names in the exact recovery run")


def all_jobs(repo: str, run_id: int) -> list[dict[str, Any]]:
    output = []
    for page in range(1, 101):
        data = gh(f"/repos/{repo}/actions/runs/{run_id}/jobs?filter=latest&per_page=100&page={page}")
        require(isinstance(data, dict) and isinstance(data.get("jobs"), list), "run jobs unavailable")
        output.extend(data["jobs"])
        if len(data["jobs"]) < 100:
            return output
    raise Blocked("run job pagination truncated")


def get_attestation(repo: str, run_id: int, attempt: int) -> dict[str, Any]:
    data = gh(f"/repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100")
    require(isinstance(data, dict) and isinstance(data.get("artifacts"), list)
            and data.get("total_count", 0) <= 100, "recovery artifacts unavailable/truncated")
    name = f"ci-main-recovery-source-{run_id}-{attempt}"
    matched = [a for a in data["artifacts"] if a.get("name") == name and not a.get("expired")]
    require(len(matched) == 1, "missing/duplicate exact attempt recovery attestation")
    with tempfile.TemporaryDirectory() as directory:
        command("gh", "run", "download", str(run_id), "-R", repo,
                "-n", name, "-D", directory)
        file = Path(directory, "ci-main-recovery.json")
        require(file.is_file() and file.stat().st_size < 8192, "attestation file missing/oversized")
        value = json.loads(file.read_text(encoding="utf-8"))
    require(isinstance(value, dict), "attestation JSON object required")
    return value


def completed_evidence(repo: str, run_id: int, target_sha: str | None = None) -> tuple[Identity, str, str]:
    """Independently authenticate exact original SHA; never infer it from a run title."""
    run = gh(f"/repos/{repo}/actions/runs/{run_id}")
    require(run.get("id") == run_id and run.get("path") == ".github/workflows/ci.yml"
            and run.get("name") == "CI", "source workflow identity mismatch")
    require(run.get("event") == "workflow_dispatch"
            and run.get("head_branch") == "main"
            and run.get("status") == "completed" and run.get("conclusion") == "success",
            "source run is not a successful main manual event")
    attempt = run.get("run_attempt")
    require(type(attempt) is int and attempt > 0, "source attempt missing")
    source = run.get("head_sha")
    require(isinstance(source, str) and SHA.fullmatch(source) is not None,
            "trusted controller SHA missing")
    artifact = get_attestation(repo, run_id, attempt)
    require(set(artifact) == {"schema", "repo", "issue", "pr", "target_sha",
                             "expected_version", "owner_comment_id", "source_sha",
                             "run_id", "run_attempt", "mode"}, "attestation schema mismatch")
    identity = Identity(repo, artifact["issue"], artifact["pr"], artifact["target_sha"],
                        artifact["expected_version"], artifact["owner_comment_id"], source, "")
    require(artifact == identity.artifact(run_id, attempt), "attestation source/attempt mismatch")
    require(target_sha is None or identity.sha == target_sha, "recovery requested for another SHA")
    actor = ((run.get("actor") or {}).get("login") or "")
    identity = validate(identity, actor=actor, source_event=run["event"])
    checked_jobs(all_jobs(repo, run_id))
    digest = digest_for_tag(repo, identity.sha)
    return identity, str(run.get("html_url") or ""), digest



def discover_completed_recovery(repo: str, sha: str) -> tuple[str, str] | None:
    """Find only authentic completed main manual_recovery runs, never diagnostic CI.

    Display title is only a bounded search hint, never authorization evidence.
    Each candidate is revalidated against Owner comments, first-parent history,
    exact job attempt, CI artifact, immutable SHA, GHCR digest and current main.
    """
    require(SHA.fullmatch(sha) is not None, "invalid recovery lookup SHA")
    for page in range(1, 11):
        result = gh(f"/repos/{repo}/actions/workflows/ci.yml/runs"
                    f"?event=workflow_dispatch&branch=main&per_page=100&page={page}")
        require(isinstance(result, dict) and isinstance(result.get("workflow_runs"), list),
                "manual recovery discovery UNKNOWN")
        runs = result["workflow_runs"]
        for row in runs:
            if (row.get("status") != "completed" or row.get("conclusion") != "success"
                    or row.get("head_branch") != "main"
                    or sha not in str(row.get("display_title") or "")):
                continue
            run_id = row.get("id")
            require(type(run_id) is int and run_id > 0, "candidate run ID unknown")
            identity, url, digest = completed_evidence(repo, run_id, target_sha=sha)
            require(identity.sha == sha, "discovered recovery SHA mismatch")
            return url, digest
        if len(runs) < 100:
            return None
    return None  # Fail-closed: no positive source, never infer a PASS.


def verified_recovery_from_environment(repo: str, sha: str) -> tuple[str, str] | None:
    raw_id = os.getenv("MAIN_RECOVERY_RUN_ID", "")
    target = os.getenv("MAIN_RECOVERY_TARGET_SHA", "")
    if not raw_id and not target:
        return discover_completed_recovery(repo, sha)
    require(raw_id.isdigit() and target == sha, "recovery environment SHA/run mismatch")
    identity, url, digest = completed_evidence(repo, int(raw_id), target_sha=sha)
    require(identity.sha == sha and bool(digest), "exact evidence mismatch")
    return url, digest


def execute(args: argparse.Namespace) -> None:
    if args.action in {"authorize", "prepublish"}:
        identity, actor = load_dispatch()
        approved = validate(identity, actor=actor, source_event="workflow_dispatch")
        if args.action == "prepublish":
            state = package_tag_state(approved.repo, f"ci-{approved.sha}")
            require(state == "ABSENT", f"candidate exists or GHCR state UNKNOWN: {state}")
            print(f"GHCR candidate ABSENT; exact source={approved.sha}")
        else:
            run_id, attempt = int(os.environ["GITHUB_RUN_ID"]), int(os.environ["GITHUB_RUN_ATTEMPT"])
            Path("ci-main-recovery.json").write_text(
                json.dumps(approved.artifact(run_id, attempt), sort_keys=True) + "\n",
                encoding="utf-8")
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
                f.write(f"target_sha={approved.sha}\nversion={approved.version}\nauthorized=true\n")
            print(f"manual_recovery authorized: Issue #{approved.issue} PR #{approved.pr} "
                  f"SHA {approved.sha} version {approved.version}; no publication yet")
    elif args.action == "verify-run":
        identity, url, digest = completed_evidence(os.environ["GITHUB_REPOSITORY"], args.run_id)
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as f:
            f.write(f"MAIN_RECOVERY_RUN_ID={args.run_id}\n"
                    f"MAIN_RECOVERY_TARGET_SHA={identity.sha}\n")
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"target_sha={identity.sha}\n")
        print(f"manual_recovery verified: {url} SHA={identity.sha} digest={digest}")
    else:
        raise Blocked("unknown action")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("authorize", "prepublish", "verify-run"))
    parser.add_argument("--run-id", type=int, default=0)
    args = parser.parse_args()
    try:
        execute(args)
    except (Blocked, OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"BLOCKED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
