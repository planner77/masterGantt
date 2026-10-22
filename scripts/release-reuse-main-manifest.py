#!/usr/bin/env python3
"""Issue #773: immutable, non-authoritative Main candidate observation.

The receipt is DATA, not a signature or permission. The trusted Release verifier
independently authenticates the originating GitHub run/attempt, job steps,
artifact uniqueness, source commit and digest before it can use this receipt.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = "mastergantt-release-reuse-main-v1"
SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
DIGEST_RE = re.compile(r"sha256:[0-9a-f]{64}\Z")

def sha256(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()

def list_cases(payload):
    """Playwright --list --reporter=json includes suites/specs/tests but no executions."""
    if not isinstance(payload, dict) or not isinstance(payload.get("suites"), list):
        raise ValueError("PLAYWRIGHT_LIST_INVALID")
    files = set()
    count = 0
    def walk(node):
        nonlocal count
        if not isinstance(node, dict):
            raise ValueError("PLAYWRIGHT_SUITE_INVALID")
        for spec in node.get("specs", []):
            tests = spec.get("tests")
            file = spec.get("file")
            if not isinstance(tests, list) or not tests or not isinstance(file, str):
                raise ValueError("PLAYWRIGHT_SPEC_INVALID")
            # Playwright --list JSON may provide paths relative to testDir
            # or repository root. Normalize only within the known testDir.
            # Reject .. and unrelated absolute paths instead of silently
            # inflating coverage with arbitrary or duplicate inputs.
            source = Path(file)
            if ".." in source.parts:
                raise ValueError("PLAYWRIGHT_FILE_TRAVERSAL")
            if source.is_absolute():
                try:
                    relative = source.resolve().relative_to(ROOT.resolve()).as_posix()
                except ValueError:
                    raise ValueError("PLAYWRIGHT_FILE_OUTSIDE_ROOT") from None
            else:
                relative = source.as_posix()
            if not relative.startswith("tests/e2e/"):
                relative = "tests/e2e/" + relative
            if not relative.startswith("tests/e2e/") or not relative.endswith(".spec.ts"):
                raise ValueError("PLAYWRIGHT_FILE_INVALID")
            files.add(relative)
            count += len(tests)
        for child in node.get("suites", []):
            walk(child)
    for suite in payload["suites"]:
        walk(suite)
    if count <= 0:
        raise ValueError("PLAYWRIGHT_LIST_EMPTY")
    return files, count

def validate_plan(plan, files):
    count = plan.get("shardCount")
    shards = plan.get("shards")
    if type(count) is not int or count < 2 or count > 16 or not isinstance(shards, list) or len(shards) != count:
        raise ValueError("SHARD_PLAN_INVALID")
    assigned = []
    for position, shard in enumerate(shards, 1):
        if shard.get("shard") != position or not isinstance(shard.get("files"), list) or not shard["files"]:
            raise ValueError("SHARD_PLAN_INDEX_MISMATCH")
        assigned.extend(shard["files"])
    if len(set(assigned)) != len(assigned) or set(assigned) != set(files):
        raise ValueError("SHARD_PLAN_SPEC_COVERAGE_UNKNOWN")
    return count

def make_receipt(args):
    sha = git("rev-parse", "HEAD")
    if not SHA_RE.fullmatch(sha) or sha != args.source_sha or os.environ.get("GITHUB_SHA") != sha:
        raise ValueError("MAIN_SOURCE_MISMATCH")
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("NOT_MAIN_PUSH")
    if not DIGEST_RE.fullmatch(args.digest):
        raise ValueError("CANDIDATE_DIGEST_INVALID")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    lock = json.loads((ROOT / "package-lock.json").read_text())
    if version != args.version or lock.get("version") != version or lock.get("packages", {}).get("", {}).get("version") != version:
        raise ValueError("LOCK_VERSION_MISMATCH")
    plan = json.loads((ROOT / "tests/config/e2e-shard-plan.json").read_text())
    listed, total = list_cases(json.loads(Path(args.playwright_list).read_text()))
    discovered = {p.relative_to(ROOT).as_posix() for p in (ROOT / "tests/e2e").rglob("*.spec.ts")}
    if listed != discovered:
        raise ValueError("PLAYWRIGHT_LIST_DISCOVERY_MISMATCH")
    shards = validate_plan(plan, discovered)
    run_id = int(os.environ["GITHUB_RUN_ID"])
    attempt = int(os.environ["GITHUB_RUN_ATTEMPT"])
    if run_id < 1 or attempt < 1:
        raise ValueError("RUN_ID_ATTEMPT_INVALID")
    return {
        "schema": SCHEMA, "receipt_status": "COLLECTED",
        "repository": os.environ.get("GITHUB_REPOSITORY"),
        "event": "push", "branch": "main", "source_sha": sha,
        "run_id": run_id, "run_attempt": attempt,
        "version": version, "candidate_digest": args.digest,
        "candidate_reference": f"ghcr.io/{os.environ['GITHUB_REPOSITORY'].lower()}:ci-{sha}",
        "test_inventory": {
            "spec_count": len(discovered), "case_count": total, "shard_count": shards,
            "files_sha256": hashlib.sha256("\n".join(sorted(discovered)).encode()).hexdigest(),
        },
        "source_fingerprints": {
            name: sha256(name) for name in (
                "package.json", "package-lock.json", "tests/config/e2e-shard-plan.json",
                "tests/config/playwright.config.ts", "tests/config/e2e-timing-reporter.cjs",
                "scripts/e2e-shard-planner.mjs", ".github/workflows/ci.yml",
                ".github/workflows/release-image.yml", ".github/actions/node-setup/action.yml",
                ".github/actions/playwright-setup/action.yml", "deploy/docker/Dockerfile",
                "node_modules/playwright-core/browsers.json",
            )
        },
        "profile": {
            "runner_os": os.environ.get("RUNNER_OS"), "runner_arch": os.environ.get("RUNNER_ARCH"),
            "image_os": os.environ.get("ImageOS"), "image_version": os.environ.get("ImageVersion"),
            "node": subprocess.check_output(["node", "--version"], text=True).strip(),
            "npm": subprocess.check_output(["npm", "--version"], text=True).strip(),
            "playwright": json.loads((ROOT / "node_modules/@playwright/test/package.json").read_text())["version"],
            "platform": "linux/amd64", "fully_parallel": True, "workers": 1,
            "max_failures": 0, "retries": 0,
        },
        "supply_chain": {"buildkit_provenance": "mode=max", "sbom": True,
                         "digest_source": "docker/build-push-action output; reverify registry independently"},
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-sha", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--digest", required=True)
    parser.add_argument("--playwright-list", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    # No invented green observation. Receipt generation failures can be
    # diagnosed but MUST NOT change pre-existing Main Full CI gate outcomes.
    try:
        result = make_receipt(args)
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as error:
        result = {"schema": SCHEMA, "receipt_status": "INVALID",
                  "reason": str(error)[:160], "source_sha": args.source_sha,
                  "run_id": os.environ.get("GITHUB_RUN_ID", ""),
                  "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT", "")}
    Path(args.out).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(result["receipt_status"], result.get("reason", ""))
    return 0

if __name__ == "__main__":
    sys.exit(main())
