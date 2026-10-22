#!/usr/bin/env python3
"""Issue #773: trusted default-main, read-only Release evidence verifier.

Do not execute or trust code, policy, or a manifest from the Release tag as
authority. The exact tag checkout is data; this module runs from a separate
trusted default-main checkout. A successful Main aggregate alone is NEVER
sufficient to select REUSED_VERIFIED. All API, identity, artifact, timing,
test-inventory, profile and candidate-digest checks must succeed.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile

SCHEMA = "mastergantt-release-reuse-verdict-v1"
MAIN_SCHEMA = "mastergantt-release-reuse-main-v1"
SHA = re.compile(r"[a-f0-9]{40}\Z")
DIGEST = re.compile(r"sha256:[a-f0-9]{64}\Z")
VERSION = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?\Z")
OWNER_MARKER = re.compile(r"<!--\s*mastergantt-release-authorization:v1\s+(\{[^<>]*\})\s*-->")
FILES = (
    "package.json", "package-lock.json", "tests/config/e2e-shard-plan.json",
    "tests/config/playwright.config.ts", "tests/config/e2e-timing-reporter.cjs",
    "scripts/e2e-shard-planner.mjs", ".github/workflows/ci.yml",
    ".github/workflows/release-image.yml", ".github/actions/node-setup/action.yml",
    ".github/actions/playwright-setup/action.yml", "deploy/docker/Dockerfile",
    "node_modules/playwright-core/browsers.json",
)

class Ineligible(Exception):
    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)

def require(condition, reason):
    if not condition:
        raise Ineligible(reason)

def fingerprint(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def git(cwd, *args):
    return subprocess.check_output(["git", *args], cwd=cwd, text=True, stderr=subprocess.DEVNULL).strip()

def assert_coverage(plan, specs):
    shards = plan.get("shards")
    count = plan.get("shardCount")
    require(plan.get("schemaVersion") == 1 and type(count) is int and 2 <= count <= 16,
            "SHARD_PLAN_SCHEMA")
    require(isinstance(shards, list) and len(shards) == count, "SHARD_PLAN_COUNT")
    groups = []
    for index, shard in enumerate(shards, 1):
        require(isinstance(shard, dict) and shard.get("shard") == index and
                isinstance(shard.get("files"), list) and bool(shard["files"]), "SHARD_PLAN_INDEX")
        groups.extend(shard["files"])
    require(len(groups) == len(set(groups)) and set(groups) == specs, "SHARD_PLAN_COVERAGE")
    return count

def select_jobs(jobs, shard_count, attempt):
    """Real implementation jobs AND their mandatory steps, not aggregate green."""
    base = {
        "병렬 quality 결과 집계": "Build, static checks, and unit tests",
        "정책·저장소 계약 검사": "Main policy",
        "TypeScript 타입 검사": "npm run typecheck",
        "ESLint": "npm run lint",
        "Vitest 단위·통합 테스트": "npm test",
        "Next.js production build": "npm run build",
        "Docker smoke 구현": "Docker",
        "Docker build and runtime smoke test": "Docker",
        "Main 임시 commit 이미지 게시·검증·정리": "Main digest",
        "Chromium end-to-end tests": "Chromium",
    }
    expected = set(base) | {f"Chromium E2E shard {i}/{shard_count}"
                            for i in range(1, shard_count + 1)}
    found = {}
    for job in jobs:
        name = job.get("name")
        if name not in expected:
            continue
        require(name not in found, "DUPLICATE_JOB_NAME")
        require(job.get("run_attempt") == attempt and job.get("status") == "completed"
                and job.get("conclusion") == "success", "MAIN_JOB_NOT_ACTUALLY_SUCCESS")
        found[name] = job
    require(set(found) == expected, "MAIN_FULL_JOB_MISSING_OR_SKIPPED")
    mandatory = {
        "정책·저장소 계약 검사": ["범용 Issue Lifecycle 계약·시나리오 검증",
                           "Issue #773 Release reuse fail-closed 출처·샤드·Owner 회귀"],
        "TypeScript 타입 검사": ["npm run typecheck"],
        "ESLint": ["npm run lint"],
        "Vitest 단위·통합 테스트": ["npm test"],
        "Next.js production build": ["npm run build"],
        "Docker smoke 구현": ["Docker image build"],
        "Main 임시 commit 이미지 게시·검증·정리": [
            "임시 commit 이미지 빌드·게시", "exact published digest pull",
            "게시 image policy 검증", "게시 image readiness 검증",
            "게시 image SQLite persistence 검증", "Project·Task API persistence 검증",
            "게시 digest HTTP·HTTPS browser 검증", "GHCR main commit image lifecycle handoff",
            "Main reuse candidate receipt 업로드",
        ],
    }
    for i in range(1, shard_count + 1):
        mandatory[f"Chromium E2E shard {i}/{shard_count}"] = [
            "E2E shard 실행", "E2E timing artifact 업로드"
        ]
    for name, steps in mandatory.items():
        recorded = found[name].get("steps")
        require(isinstance(recorded, list), "MAIN_STEP_LIST_UNAVAILABLE")
        for step in steps:
            matches = [s for s in recorded if step in str(s.get("name", ""))]
            require(len(matches) == 1 and matches[0].get("conclusion") == "success",
                    "MAIN_MANDATORY_STEP_NOT_EXECUTED")
    return found

def verify_timing(rows, run_id, attempt, sha, n, manifest):
    seen = set()
    skipped = set()
    test_count = 0
    expected_environment = manifest["profile"]
    all_files = set(manifest["_specs"])
    for shard in range(1, n + 1):
        name = f"e2e-timing-ci-shard-{shard}"
        row = unique_artifact(rows, name)
        payload = zip_json(row["_zip"], f"e2e-timing-shard-{shard}.json")
        require(payload.get("schemaVersion") == 1 and payload.get("runId") == str(run_id)
                and payload.get("runAttempt") == attempt and payload.get("headSha") == sha
                and payload.get("eventName") == "push" and payload.get("status") == "passed"
                and payload.get("shard") == shard and payload.get("shardCount") == n,
                "TIMING_SOURCE_OR_ATTEMPT_MISMATCH")
        files = payload.get("skippedFiles")
        skip = payload.get("skippedCaseCount")
        require(isinstance(files, list) and type(skip) is int
                and skip >= len(files) and not files and skip == 0, "TIMING_SKIPPED_TEST")
        env = payload.get("environment")
        require(isinstance(env, dict) and env.get("fullyParallel") is True
                and env.get("os") == "linux"
                and env.get("imageVersion") == expected_environment["image_version"]
                and env.get("runnerOS") == expected_environment["runner_os"]
                and env.get("imageOS") == expected_environment["image_os"]
                and env.get("runnerArch") == expected_environment["runner_arch"]
                and "v" + env.get("node", "") == expected_environment["node"],
                "TIMING_RUNTIME_PROFILE_MISMATCH")
        entries = payload.get("entries")
        require(isinstance(entries, list) and entries, "TIMING_CASES_MISSING")
        for item in entries:
            file = item.get("file") if isinstance(item, dict) else None
            duration = item.get("durationMs") if isinstance(item, dict) else None
            require(isinstance(file, str) and file in all_files and
                    type(duration) in (int, float) and 0 <= duration < 3_000_000,
                    "TIMING_UNKNOWN_CASE_OR_DURATION")
            seen.add(file)
            test_count += 1
    require(seen == all_files, "TIMING_FILE_COVERAGE_MISMATCH")
    require(test_count == manifest["test_inventory"]["case_count"], "TIMING_CASE_COUNT_MISMATCH")
    return test_count

def zip_json(blob, filename):
    require(len(blob) <= 4_000_000, "ARTIFACT_OVERSIZE")
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        entries = archive.infolist()
        require(len(entries) == 1 and entries[0].filename == filename and
                entries[0].file_size <= 1_500_000 and not entries[0].is_dir(),
                "ARTIFACT_ZIP_CONTENTS")
        return json.loads(archive.read(filename))

def unique_artifact(rows, name):
    matches = [row for row in rows if row.get("name") == name]
    require(len(matches) == 1 and not matches[0].get("expired")
            and type(matches[0].get("id")) is int, "ARTIFACT_MISSING_DUPLICATE_OR_EXPIRED")
    return matches[0]

def verify_static_contract(target):
    ci = (target / ".github/workflows/ci.yml").read_text()
    release = (target / ".github/workflows/release-image.yml").read_text()
    playwright = (target / "tests/config/playwright.config.ts").read_text()
    for token in ("needs.quality.result == 'success'", "needs.e2e.result == 'success'",
                  "needs.docker.result == 'success'", "needs.changes.outputs.docs_only != 'true'",
                  "sbom: true", "provenance: mode=max",
                  "E2E_TIMING_SHARD_COUNT: \"8\"", "CI_E2E_FULLY_PARALLEL: \"true\""):
        require(token in ci, "MAIN_WORKFLOW_PROFILE_DRIFT")
    for token in ("npm run typecheck", "npm run lint", "npm test", "npm run build",
                  "npm audit --omit=dev", "check-markdown-links.mjs",
                  "E2E_TIMING_SHARD_COUNT: \"8\"", "CI_E2E_FULLY_PARALLEL: \"true\"",
                  "verify-transport-smoke.sh", "verify-registry-api-smoke.mjs",
                  "Main verified candidate exact digest 확인"):
        require(token in release, "RELEASE_WORKFLOW_PROFILE_DRIFT")
    for token in ("workers: 1", "CI_E2E_FULLY_PARALLEL", "trace: \"retain-on-failure\""):
        require(token in playwright, "PLAYWRIGHT_PROFILE_DRIFT")
    main_e2e = ci.split("\n  e2e_shard:", 1)[1].split("\n  pr_e2e_shard:", 1)[0]
    release_e2e = release.split("\n  release_e2e_shard:", 1)[1].split("\n  quality:", 1)[0]
    # Same native dependency build and Chromium runner setup; weaker
    # release setup would silently violate the reused execution profile.
    require('use-local-node-headers: "true"' in main_e2e
            and 'use-local-node-headers: "true"' in release_e2e,
            "E2E_NODE_HEADERS_PROFILE_DRIFT")
    require("--max-failures=1" in ci and "PR_E2E_STOP_ON_FAILURE" in ci
            and "--max-failures=1" not in release, "MAIN_RELEASE_E2E_MODE_DRIFT")

def latest_owner_approval(rows, owner, version):
    decisions = []
    for row in rows:
        user = row.get("user") or {}
        if user.get("login") != owner or row.get("author_association") != "OWNER":
            continue
        for found in OWNER_MARKER.finditer(str(row.get("body", ""))):
            try:
                payload = json.loads(found.group(1))
            except ValueError:
                continue
            if payload.get("expected_version") == version and type(payload.get("authorized")) is bool:
                decisions.append((row.get("id", 0), payload["authorized"]))
    return sorted(decisions)[-1][1] if decisions else False

class GitHub:
    def __init__(self, repo, token):
        require(re.fullmatch(r"[\w.-]+/[\w.-]+", repo) and token, "GITHUB_READ_TOKEN_MISSING")
        self.repo, self.token = repo, token

    def request(self, path, binary=False):
        require(path.startswith("/repos/" + self.repo + "/"), "FOREIGN_REPOSITORY")
        url = "https://api.github.com" + path
        request = urllib.request.Request(url, headers={
            "Authorization": "Bearer " + self.token,
            "Accept": "application/octet-stream" if binary else "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mastergantt-release-reuse-verifier-v1",
        })
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read((4_000_000 if binary else 2_000_000) + 1)
        require(len(raw) <= (4_000_000 if binary else 2_000_000), "API_RESPONSE_SIZE_UNKNOWN")
        return raw if binary else json.loads(raw)

    def one(self, route):
        return self.request("/repos/" + self.repo + route)

    def all(self, route):
        result = []
        for page in range(1, 11):
            data = self.one(f"{route}{'&' if '?' in route else '?'}per_page=100&page={page}")
            require(isinstance(data, list), "API_PAGE_FORMAT")
            result.extend(data)
            if len(data) < 100:
                return result
        raise Ineligible("API_PAGINATION_UNBOUNDED")

    def artifacts(self, run_id):
        payload = self.one(f"/actions/runs/{run_id}/artifacts?per_page=100")
        rows = payload.get("artifacts", [])
        require(isinstance(rows, list) and payload.get("total_count") == len(rows),
                "ARTIFACT_PAGINATION_OR_RESPONSE_UNKNOWN")
        for row in rows:
            row["_zip"] = None
        return rows

    def artifact_zip(self, row):
        return self.request(f"/repos/{self.repo}/actions/artifacts/{row['id']}/zip", binary=True)

def authenticated_source(api, args, target, trusted):
    require(VERSION.fullmatch(args.version) and args.tag == "v" + args.version
            and SHA.fullmatch(args.target_sha), "RELEASE_TARGET_INVALID")
    require(git(target, "rev-parse", "HEAD") == args.target_sha,
            "RELEASE_CHECKOUT_SHA_MISMATCH")
    ref = api.one("/git/ref/tags/" + args.tag)
    require(ref.get("object", {}).get("type") == "tag", "TAG_NOT_ANNOTATED")
    tag = api.one("/git/tags/" + ref["object"]["sha"])
    require(tag.get("tag") == args.tag and tag.get("object", {}).get("type") == "commit"
            and tag["object"]["sha"] == args.target_sha, "ANNOTATED_TAG_PEELED_SHA_MISMATCH")
    package = json.loads((target / "package.json").read_text())
    lock = json.loads((target / "package-lock.json").read_text())
    require(package["version"] == args.version and lock.get("version") == args.version
            and lock.get("packages", {}).get("", {}).get("version") == args.version,
            "TAG_PACKAGE_LOCK_VERSION_MISMATCH")
    require(args.target_sha in git(trusted, "rev-list", "--first-parent", "HEAD").splitlines(),
            "MERGE_SHA_NOT_DEFAULT_MAIN_FIRST_PARENT")
    require(args.issue.isdigit() and args.pr.isdigit() and int(args.issue) > 0 and int(args.pr) > 0,
            "ISSUE_PR_TRACE_MISSING")
    pr = api.one("/pulls/" + args.pr)
    commit = api.one("/commits/" + args.target_sha)
    parents = [x.get("sha") for x in commit.get("parents", [])]
    require(pr.get("merged") is True and pr.get("merge_commit_sha") == args.target_sha
            and pr.get("base", {}).get("ref") == "main"
            and len(parents) == 2 and pr.get("head", {}).get("sha") == parents[1],
            "PR_MAIN_MERGE_PROVENANCE_MISMATCH")
    issue = api.one("/issues/" + args.issue)
    require(issue.get("number") == int(args.issue) and
            ("#" + args.issue) in (str(pr.get("title", "")) + " " + str(pr.get("body", ""))),
            "ISSUE_PR_ATTRIBUTION_MISMATCH")
    owner = api.repo.split("/")[0]
    require(latest_owner_approval(api.all("/issues/" + args.issue + "/comments"),
                                  owner, args.version), "OWNER_EXACT_VERSION_AUTH_MISSING")
    return parents

def verify_main(api, args, target):
    workflow = api.one("/actions/workflows/ci.yml")
    require(workflow.get("path") == ".github/workflows/ci.yml" and isinstance(workflow.get("id"), int),
            "MAIN_WORKFLOW_IDENTITY")
    runs = api.one("/actions/workflows/ci.yml/runs?event=push&branch=main&head_sha=" + args.target_sha + "&per_page=100")
    require(isinstance(runs.get("workflow_runs"), list) and runs.get("total_count", 101) <= 100,
            "MAIN_RUN_PAGINATION_UNKNOWN")
    candidates = [run for run in runs["workflow_runs"] if run.get("event") == "push"
                  and run.get("head_branch") == "main" and run.get("head_sha") == args.target_sha
                  and run.get("workflow_id") == workflow["id"]
                  and run.get("path") == ".github/workflows/ci.yml"]
    require(len(candidates) == 1, "MAIN_EXACT_RUN_MISSING_OR_AMBIGUOUS")
    run = candidates[0]
    require(run.get("status") == "completed" and run.get("conclusion") == "success"
            and isinstance(run.get("run_attempt"), int), "MAIN_FULL_RUN_NOT_SUCCESS")
    age = (datetime.now(timezone.utc) -
           datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))).total_seconds() / 3600
    require(age >= 0 and args.max_age_hours.isdigit()
            and 1 <= int(args.max_age_hours) <= 720
            and age <= int(args.max_age_hours), "MAIN_REUSE_AGE_POLICY_NOT_APPROVED_OR_EXPIRED")
    run_id, attempt = run["id"], run["run_attempt"]
    result = api.one(f"/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100")
    require(isinstance(result.get("jobs"), list) and result.get("total_count") == len(result["jobs"]),
            "MAIN_JOB_PAGINATION_UNKNOWN")
    specs = {p.relative_to(target).as_posix() for p in (target / "tests/e2e").rglob("*.spec.ts")}
    shards = assert_coverage(json.loads((target / "tests/config/e2e-shard-plan.json").read_text()), specs)
    selected = select_jobs(result["jobs"], shards, attempt)
    rows = api.artifacts(run_id)
    receipt = unique_artifact(rows, f"main-reuse-manifest-{run_id}-{attempt}")
    require(receipt.get("workflow_run", {}).get("id") == run_id
            and receipt.get("workflow_run", {}).get("head_sha") == args.target_sha,
            "MAIN_MANIFEST_WRONG_WORKFLOW")
    manifest = zip_json(api.artifact_zip(receipt), "release-reuse-main-manifest.json")
    require(manifest.get("schema") == MAIN_SCHEMA and manifest.get("receipt_status") == "COLLECTED"
            and manifest.get("source_sha") == args.target_sha
            and manifest.get("repository") == api.repo and manifest.get("event") == "push"
            and manifest.get("branch") == "main" and manifest.get("run_id") == run_id
            and manifest.get("run_attempt") == attempt and manifest.get("version") == args.version
            and DIGEST.fullmatch(str(manifest.get("candidate_digest", "")))
            and manifest.get("candidate_reference") == f"ghcr.io/{api.repo.lower()}:ci-{args.target_sha}",
            "MAIN_MANIFEST_PROVENANCE_INVALID")
    require(manifest.get("test_inventory", {}).get("shard_count") == shards
            and manifest["test_inventory"].get("spec_count") == len(specs)
            and type(manifest["test_inventory"].get("case_count")) is int
            and manifest["test_inventory"]["case_count"] > 0
            and manifest["test_inventory"].get("files_sha256") ==
            hashlib.sha256("\n".join(sorted(specs)).encode()).hexdigest(),
            "MAIN_TEST_INVENTORY_INVALID")
    require(manifest.get("source_fingerprints") == {
        filename: fingerprint(target / filename) for filename in FILES
    }, "SOURCE_OR_LOCKFILE_FINGERPRINT_DRIFT")
    env = manifest.get("profile", {})
    require(isinstance(env, dict) and bool(env.get("runner_os")) and bool(env.get("runner_arch"))
            and bool(env.get("image_os")) and bool(env.get("image_version"))
            and env.get("runner_os") == os.environ.get("RUNNER_OS")
            and env.get("runner_arch") == os.environ.get("RUNNER_ARCH")
            and env.get("image_os") == os.environ.get("ImageOS")
            and env.get("image_version") == os.environ.get("ImageVersion")
            and env.get("node") == subprocess.check_output(["node", "--version"], text=True).strip()
            and env.get("npm") == subprocess.check_output(["npm", "--version"], text=True).strip()
            and env.get("playwright") == json.loads(
                (target / "node_modules/@playwright/test/package.json").read_text())["version"]
            and env.get("workers") == 1 and env.get("fully_parallel") is True
            and env.get("max_failures") == 0 and env.get("retries") == 0
            and env.get("platform") == "linux/amd64", "MAIN_RELEASE_RUNNER_PROFILE_DRIFT")
    require(manifest.get("supply_chain") == {
        "buildkit_provenance": "mode=max", "sbom": True,
        "digest_source": "docker/build-push-action output; reverify registry independently"
    }, "CANDIDATE_SUPPLY_CHAIN_UNVERIFIED")
    manifest["_specs"] = sorted(specs)
    for shard in range(1, shards + 1):
        row = unique_artifact(rows, f"e2e-timing-ci-shard-{shard}")
        require(row.get("workflow_run", {}).get("id") == run_id
                and row.get("workflow_run", {}).get("head_sha") == args.target_sha,
                "E2E_ARTIFACT_WRONG_SOURCE")
        row["_zip"] = api.artifact_zip(row)
    count = verify_timing(rows, run_id, attempt, args.target_sha, shards, manifest)
    return {"run_id": run_id, "attempt": attempt, "sha": args.target_sha,
            "case_count": count, "spec_count": len(specs), "shard_count": shards,
            "digest": manifest["candidate_digest"], "runner_image": env["image_version"],
            "main_run_url": run.get("html_url"), "jobs_checked": len(selected)}

def decide(args):
    record = {"schema": SCHEMA, "verdict": "REUSE_INELIGIBLE",
              "release_execution_mode": "FULL_EXECUTED", "mode": "FULL",
              "reason": "EVIDENCE_NOT_CHECKED", "target_sha": args.target_sha,
              "version": args.version, "tag": args.tag,
              "release_run": os.environ.get("GITHUB_RUN_ID"),
              "release_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
              "policy_source": "TRUSTED_DEFAULT_MAIN", "main_evidence": None,
              "shadow": not args.allow_reuse}
    try:
        api = GitHub(args.repository, os.environ.get("GH_TOKEN", ""))
        target, trusted = Path(args.target_root).resolve(), Path(args.trusted_root).resolve()
        # This script is executed from trusted/main, NOT from the release tag.
        require(Path(__file__).resolve().parent.parent == trusted, "VERIFIER_NOT_FROM_TRUSTED_MAIN")
        authenticated_source(api, args, target, trusted)
        verify_static_contract(target)
        evidence = verify_main(api, args, target)
        record["main_evidence"] = evidence
        record["verdict"] = "REUSE_ELIGIBLE"
        record["reason"] = "ALL_EXACT_EVIDENCE_VERIFIED"
        if args.allow_reuse:
            record["mode"] = "REUSED_VERIFIED"
            record["release_execution_mode"] = "REUSED_VERIFIED"
    except (Ineligible, ValueError, KeyError, IndexError, TypeError,
            OSError, urllib.error.URLError, subprocess.CalledProcessError,
            zipfile.BadZipFile, json.JSONDecodeError) as error:
        record["reason"] = error.reason if isinstance(error, Ineligible) else "EVIDENCE_UNAVAILABLE_OR_INVALID"
    return record

def main():
    p = argparse.ArgumentParser()
    for name in ("repository", "tag", "version", "target-sha",
                 "target-root", "trusted-root", "issue", "pr", "max-age-hours",
                 "out"):
        p.add_argument("--" + name, required=True)
    p.add_argument("--allow-reuse", action="store_true")
    a = p.parse_args()
    decision = decide(a)
    Path(a.out).write_text(json.dumps(decision, sort_keys=True, indent=2) + "\n")
    print(json.dumps({k: decision[k] for k in ("verdict", "mode", "reason", "shadow")}, sort_keys=True))
    outputs = os.environ.get("GITHUB_OUTPUT")
    if outputs:
        with open(outputs, "a", encoding="utf-8") as stream:
            stream.write(f"mode={decision['mode']}\n")
            stream.write(f"verdict={decision['verdict']}\n")
            stream.write(f"reason={decision['reason']}\n")
            stream.write(f"main_run_id={(decision['main_evidence'] or {}).get('run_id', '')}\n")
            stream.write(f"candidate_digest={(decision['main_evidence'] or {}).get('digest', '')}\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as stream:
            stream.write("## Issue #773 trusted Release evidence\n\n")
            stream.write(f"- Verification: `{decision['verdict']}` — `{decision['reason']}`\n")
            stream.write(f"- Execution: `{decision['mode']}` (Shadow flag: {decision['shadow']})\n")
            stream.write("- Main evidence is read-only; no original CI outcome is rewritten.\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
