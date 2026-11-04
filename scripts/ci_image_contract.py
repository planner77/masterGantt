#!/usr/bin/env python3
"""Issue #836: exact PR/Main Docker input and builder fingerprint contract.

The receipt alone cannot authorize reuse: the trusted Main selector verifies
GitHub run/attempt/job provenance and the OCI archive itself independently.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

CONTEXT_INPUTS = (
    "deploy/docker/Dockerfile", ".dockerignore",
    "package.json", "package-lock.json", "next.config.ts",
    "deploy/docker/container-entrypoint.sh",
)
SOURCE_VERSION = "mastergantt-ci-build-contract-v1"


class ContractError(ValueError):
    pass


def capture(*args: str) -> str:
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError) as error:
        raise ContractError(f"builder unavailable: {args[0]}") from error


def source_fingerprint(root: pathlib.Path) -> dict:
    """Recheck immutable Git/tree/build inputs without reading this runner's Docker."""
    files: dict[str, str] = {}
    for relative in CONTEXT_INPUTS:
        path = root / relative
        if not path.is_file():
            raise ContractError(f"required build file absent: {relative}")
        files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    dockerfile = (root / CONTEXT_INPUTS[0]).read_text(encoding="utf-8")
    base_images = re.findall(r"(?im)^FROM\s+node:[^\s@]+@sha256:([a-f0-9]{64})\s+AS\s+\S+", dockerfile)
    if len(base_images) != 2 or base_images[0] != base_images[1]:
        raise ContractError("base image immutable digest not uniquely pinned across stages")
    return {
        "git_tree": capture("git", "rev-parse", "HEAD^{tree}"),
        "files_sha256": files,
        "base_image_digest": "sha256:" + base_images[0],
    }


# Both PR and Main produce this exact builder schema on their build runners.
# Release is a verifier, not a builder; it must never substitute its host
# ImageVersion, Buildx or Docker version for these immutable receipts.
BUILDER_FIELDS = frozenset((
    "git_tree", "files_sha256", "base_image_digest", "platform",
    "buildx_version", "docker_version", "runner_image_version",
    "runner_os", "runner_arch", "provenance", "sbom",
))


def fingerprint(root: pathlib.Path) -> dict:
    """Strict PR↔Main builder match (not the Release runner environment)."""
    source = source_fingerprint(root)
    runner_image = os.getenv("ImageVersion")
    if not runner_image:
        raise ContractError("GitHub runner image version unavailable")
    if os.getenv("RUNNER_OS") != "Linux" or os.getenv("RUNNER_ARCH") != "X64":
        raise ContractError("unexpected runner platform")
    return {
        **source,
        "platform": "linux/amd64",
        "buildx_version": capture("docker", "buildx", "version"),
        "docker_version": capture("docker", "version", "--format", "{{.Server.Version}}"),
        "runner_image_version": runner_image,
        "runner_os": os.getenv("RUNNER_OS"),
        "runner_arch": os.getenv("RUNNER_ARCH"),
        "provenance": "mode=max",
        "sbom": True,
    }

def produce(root: pathlib.Path, *, revision: str, version: str,
            index_digest: str, archive_sha256: str, run_id: str,
            attempt: str, repository: str) -> dict:
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ContractError("source revision invalid")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", index_digest):
        raise ContractError("subject digest invalid")
    if not re.fullmatch(r"[a-f0-9]{64}", archive_sha256):
        raise ContractError("archive digest invalid")
    return {
        "schema": SOURCE_VERSION,
        "repository": repository,
        "run_id": int(run_id),
        "run_attempt": int(attempt),
        "source_revision": revision,
        "version": version,
        "oci_index_digest": index_digest,
        "archive_sha256": archive_sha256,
        "build_arg_version": version,
        "build": fingerprint(root),
    }


def verify(receipt: dict, *, root: pathlib.Path, repository: str, run_id: int,
           attempt: int, revision: str, version: str,
           digest: str, archive_sha256: str, main_tree: str,\n           certified_main_builder: dict | None = None) -> None:
    expected = {
        "schema": SOURCE_VERSION,
        "repository": repository,
        "run_id": run_id,
        "run_attempt": attempt,
        "source_revision": revision,
        "version": version,
        "build_arg_version": version,
        "oci_index_digest": digest,
        "archive_sha256": archive_sha256,
    }
    for key, value in expected.items():
        if receipt.get(key) != value:
            raise ContractError(f"PR_BUILD_RECEIPT_{key}_MISMATCH")
    observed = receipt.get("build")
    if not isinstance(observed, dict) or observed.get("git_tree") != main_tree:
        raise ContractError("PR_BUILD_GIT_TREE_MISMATCH")
    if certified_main_builder is None:
        # Main selection: compare PR receipt with this actual Main build runner.
        current = fingerprint(root)
    else:
        # Release: the independently authenticated Main Docker job receipt
        # supplies the original builder. Never compare a NEW release host.
        current = certified_main_builder
        if (not isinstance(current, dict) or set(current) != BUILDER_FIELDS or
            current.get("platform") != "linux/amd64" or
            current.get("runner_os") != "Linux" or
            current.get("runner_arch") != "X64" or
            current.get("provenance") != "mode=max" or
            current.get("sbom") is not True or
            any(not isinstance(current.get(k), str) or not current[k]
                for k in ("buildx_version", "docker_version", "runner_image_version"))):
            raise ContractError("TRUSTED_MAIN_BUILD_FINGERPRINT_INVALID")
        # Release checkout still independently hashes every build input,
        # Git tree and pinned base; the Main receipt alone cannot bypass them.
        source = source_fingerprint(root)
        if any(current.get(key) != value or observed.get(key) != value
               for key, value in source.items()):
            raise ContractError("BUILD_SOURCE_INPUT_DRIFT")
    if current != observed:
        raise ContractError("BUILD_INPUT_OR_BUILDER_DRIFT")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("write",))
    parser.add_argument("--version", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--digest", required=True)
    parser.add_argument("--archive-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        record = produce(pathlib.Path.cwd(), revision=args.revision,
            version=args.version, index_digest=args.digest,
            archive_sha256=args.archive_sha256, run_id=os.environ["GITHUB_RUN_ID"],
            attempt=os.environ["GITHUB_RUN_ATTEMPT"],
            repository=os.environ["GITHUB_REPOSITORY"])
    except (ContractError, KeyError, ValueError, OSError) as error:
        print("BLOCKED: build-input fingerprint unavailable: " + str(error), file=sys.stderr)
        return 1
    pathlib.Path(args.output).write_text(
        json.dumps(record, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
