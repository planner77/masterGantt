#!/usr/bin/env python3
"""Issue #836: bind a Docker-daemon smoke image to a verified OCI image.

An OCI index/config blob is the immutable registry subject. Skopeo's
transport into Docker may normalize daemon metadata, so Docker Image ID
alone is not a sufficient test of runtime identity. Require identical
runnable configuration and uncompressed RootFS diff IDs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tarfile

from verified_oci import hash_archive


class RuntimeImageError(ValueError):
    """Loaded daemon image is not equivalent to the verified OCI image."""


_SHA = re.compile(r"^sha256:[a-f0-9]{64}$")
_LIST_KEYS = ("Env", "Entrypoint", "Cmd", "Shell", "OnBuild")
_MAP_KEYS = ("Labels", "ExposedPorts", "Volumes")
_STRING_KEYS = ("User", "WorkingDir", "StopSignal", "Hostname", "Domainname")
_BOOL_KEYS = ("ArgsEscaped", "Tty", "OpenStdin", "StdinOnce", "AttachStdin",
              "AttachStdout", "AttachStderr")
_COMPARE_KEYS = _LIST_KEYS + _MAP_KEYS + _STRING_KEYS + _BOOL_KEYS + ("Healthcheck",)


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise RuntimeImageError(reason)


def load_original_config(archive_path: pathlib.Path, report: dict) -> dict:
    """Recover immutable OCI config by SHA, never by a loosely named tag."""
    require(isinstance(report, dict), "OCI inspection receipt unavailable")
    archive_sha = report.get("archive_sha256")
    digest = report.get("config_digest")
    require(isinstance(archive_sha, str) and re.fullmatch(r"[a-f0-9]{64}", archive_sha),
            "OCI receipt archive SHA256 invalid")
    require(isinstance(digest, str) and _SHA.fullmatch(digest) is not None,
            "OCI receipt config digest invalid")
    require(hash_archive(str(archive_path)) == archive_sha,
            "OCI archive changed since independent verification")
    wanted = "blobs/sha256/" + digest[7:]
    with tarfile.open(archive_path, "r:*") as archive:
        matched = [member for member in archive
                   if member.name.removeprefix("./") == wanted]
        require(len(matched) == 1 and matched[0].isfile(),
                "OCI config missing, duplicated or not a regular file")
        stream = archive.extractfile(matched[0])
        require(stream is not None, "OCI config not readable")
        contents = stream.read()
        require(hashlib.sha256(contents).hexdigest() == digest[7:],
                "OCI runtime config SHA256 disagrees with verified child manifest")
    try:
        config = json.loads(contents)
    except (UnicodeError, ValueError) as error:
        raise RuntimeImageError("OCI runtime config invalid JSON") from error
    require(isinstance(config, dict), "OCI runtime config not an object")
    return config


def normalized(key: str, value: object) -> object:
    if key in _LIST_KEYS:
        return [] if value is None else value
    if key in _MAP_KEYS:
        return {} if value is None else value
    if key in _STRING_KEYS:
        return "" if value is None else value
    if key in _BOOL_KEYS:
        return False if value is None else value
    return value


def verify_loaded_image(report: dict, original: dict, loaded: dict) -> dict:
    """Preserve runnable semantics even when Docker re-IDs an OCI image."""
    require(isinstance(loaded, dict) and isinstance(original, dict),
            "Docker/OCI image inspect structure invalid")
    loaded_id = loaded.get("Id")
    require(isinstance(loaded_id, str) and _SHA.fullmatch(loaded_id) is not None,
            "Docker image ID invalid")
    require(loaded.get("Os") == "linux" and loaded.get("Architecture") == "amd64",
            "Docker image platform differs from OCI linux/amd64")
    require(original.get("os") == "linux" and original.get("architecture") == "amd64",
            "OCI image platform invalid")
    rootfs = original.get("rootfs")
    loaded_rootfs = loaded.get("RootFS")
    require(isinstance(rootfs, dict) and isinstance(loaded_rootfs, dict)
            and rootfs.get("type") == "layers"
            and loaded_rootfs.get("Type") == "layers",
            "OCI/Docker rootfs type mismatch")
    diff_ids = rootfs.get("diff_ids")
    layers = loaded_rootfs.get("Layers")
    require(isinstance(diff_ids, list) and bool(diff_ids)
            and all(isinstance(s, str) and _SHA.fullmatch(s) for s in diff_ids)
            and isinstance(layers, list) and layers == diff_ids,
            "Docker RootFS diffIDs differ from verified OCI layers")
    source_config = original.get("config")
    docker_config = loaded.get("Config")
    require(isinstance(source_config, dict) and isinstance(docker_config, dict),
            "Docker runtime config missing")
    for key in _COMPARE_KEYS:
        expected = normalized(key, source_config.get(key))
        observed = normalized(key, docker_config.get(key))
        require(type(expected) == type(observed) and expected == observed,
                f"Docker runtime config differs from OCI: {key}")
    verified_labels = report.get("labels")
    require(isinstance(verified_labels, dict)
            and source_config.get("Labels") == verified_labels,
            "OCI receipt label set differs from original config")
    source_digest = report.get("config_digest")
    require(isinstance(source_digest, str) and _SHA.fullmatch(source_digest),
            "OCI source config digest missing")
    return {
        "schema": "mastergantt-oci-docker-runtime-v1",
        "source_config_digest": source_digest,
        "loaded_docker_image_id": loaded_id,
        "docker_image_id_equal_source_config": loaded_id == source_digest,
        "runtime_config_equivalent": True,
        "rootfs_diff_ids_equivalent": True,
        "platform": "linux/amd64",
        "source_index_digest": report.get("index_digest"),
        "archive_sha256": report.get("archive_sha256"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        report = json.loads(pathlib.Path(args.report).read_text(encoding="utf-8"))
        original = load_original_config(pathlib.Path(args.archive), report)
        raw = subprocess.check_output(
            ["docker", "image", "inspect", "--format", "{{json .}}", args.image],
            text=True, stderr=subprocess.PIPE, timeout=30)
        loaded = json.loads(raw)
        proof = verify_loaded_image(report, original, loaded)
        pathlib.Path(args.output).write_text(
            json.dumps(proof, sort_keys=True, indent=2) + "\n", encoding="utf-8")
        print("OCI archive ↔ Docker runtime config/RootFS verified; "
              f"source={proof['source_config_digest']}; loaded={proof['loaded_docker_image_id']}; "
              f"byte-ID-equal={proof['docker_image_id_equal_source_config']}")
    except (RuntimeImageError, KeyError, OSError, ValueError,
            subprocess.CalledProcessError, subprocess.TimeoutExpired,
            tarfile.TarError) as error:
        print("BLOCKED: OCI ↔ Docker runtime subject not proven: " + str(error),
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
