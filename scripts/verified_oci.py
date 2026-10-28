#!/usr/bin/env python3
"""Issue #836: strict, offline OCI archive subject and BuildKit evidence check.

This validates bytes and image configuration, NOT producer authorization.
Only a trusted GitHub Actions source-run/job verifier can authorize PR reuse.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
import tarfile

SHA = re.compile(r"^sha256:([0-9a-f]{64})$")
IMAGE_INDEX = "application/vnd.oci.image.index.v1+json"
IMAGE_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
IMAGE_CONFIG = "application/vnd.oci.image.config.v1+json"
ATTESTATION = "attestation-manifest"


class OciError(ValueError):
    pass


def require(condition: bool, why: str) -> None:
    if not condition:
        raise OciError(why)


def descriptor_path(desc: dict) -> str:
    require(isinstance(desc, dict) and isinstance(desc.get("digest"), str),
            "OCI descriptor missing digest")
    match = SHA.fullmatch(desc["digest"])
    require(match is not None, "OCI descriptor must use SHA-256")
    require(type(desc.get("size")) is int and desc["size"] >= 0,
            "OCI descriptor invalid size")
    return "blobs/sha256/" + match.group(1)


def validate_archive(path: str, *, repository: str, revision: str,
                     version: str, require_attestations: bool = True) -> dict:
    """Verify all archive blobs, index, platform/config labels and attestation types.

    OCI index digest is sha256(index.json), distinct from child manifest digest.
    """
    require(bool(re.fullmatch(r"[a-f0-9]{40}", revision)), "revision SHA invalid")
    require(bool(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][\w.-]+)?", version)),
            "package version invalid")
    require(bool(re.fullmatch(r"[\w.-]+/[\w.-]+", repository)), "repository invalid")
    with tarfile.open(path, "r:*") as archive:
        entries = {}
        for member in archive:
            name = member.name.removeprefix("./")
            require(member.isfile() and name not in entries, "unsafe/duplicate OCI archive entry")
            require(name in {"index.json", "oci-layout"} or
                    re.fullmatch(r"blobs/sha256/[a-f0-9]{64}", name) is not None,
                    "unexpected OCI archive path")
            entries[name] = member
        require("index.json" in entries and "oci-layout" in entries, "OCI layout incomplete")
        require(len(entries) <= 10000, "OCI archive too many entries")

        def read(name: str) -> bytes:
            member = entries.get(name)
            require(member is not None, f"missing OCI blob: {name}")
            stream = archive.extractfile(member)
            require(stream is not None, "OCI member not readable")
            return stream.read()

        require(json.loads(read("oci-layout")) == {"imageLayoutVersion": "1.0.0"},
                "unexpected OCI layout version")
        index_bytes = read("index.json")
        index = json.loads(index_bytes)
        require(index.get("schemaVersion") == 2 and
                index.get("mediaType", IMAGE_INDEX) == IMAGE_INDEX,
                "OCI top-level index unsupported")
        index_digest = "sha256:" + hashlib.sha256(index_bytes).hexdigest()
        for name, member in entries.items():
            if not name.startswith("blobs/sha256/"):
                continue
            stream = archive.extractfile(member)
            require(stream is not None, "OCI blob unreadable")
            hasher = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                hasher.update(chunk)
            require(hasher.hexdigest() == name.rsplit("/", 1)[-1],
                    "OCI blob hash mismatch")

        def load(desc: dict) -> dict:
            name = descriptor_path(desc)
            data = read(name)
            require(len(data) == desc["size"], "OCI descriptor size mismatch")
            return json.loads(data)

        manifests = index.get("manifests")
        require(isinstance(manifests, list) and len(manifests) >= 1,
                "OCI index lacks manifests")
        images = []
        attestation_subjects = []
        predicates = set()
        for descriptor in manifests:
            require(descriptor.get("mediaType") == IMAGE_MANIFEST,
                    "unsupported OCI child manifest mediaType")
            manifest = load(descriptor)
            require(manifest.get("schemaVersion") == 2,
                    "child OCI manifest schema mismatch")
            platform = descriptor.get("platform") or {}
            annotations = descriptor.get("annotations") or {}
            if platform.get("os") == "linux" and platform.get("architecture") == "amd64":
                config = manifest.get("config")
                require(config.get("mediaType") == IMAGE_CONFIG,
                        "OCI image config mediaType mismatch")
                configuration = load(config)
                labels = (configuration.get("config") or {}).get("Labels") or {}
                require(configuration.get("os") == "linux" and
                        configuration.get("architecture") == "amd64",
                        "OCI image config platform mismatch")
                require(labels.get("org.opencontainers.image.source") ==
                        "https://github.com/" + repository, "OCI source label mismatch")
                require(labels.get("org.opencontainers.image.revision") == revision,
                        "OCI revision label mismatch")
                require(labels.get("org.opencontainers.image.version") == version,
                        "OCI version label mismatch")
                layers = manifest.get("layers")
                require(isinstance(layers, list) and bool(layers), "image lacks layers")
                for layer in layers:
                    require(layer.get("mediaType", "").startswith("application/vnd.oci.image.layer."),
                            "unexpected OCI image layer")
                    descriptor_path(layer)
                images.append({"manifest_digest": descriptor["digest"],
                               "config_digest": config["digest"], "labels": labels})
            elif (platform.get("os") == "unknown" and
                  platform.get("architecture") == "unknown" and
                  annotations.get("vnd.docker.reference.type") == ATTESTATION):
                bound_digest = annotations.get("vnd.docker.reference.digest")
                require(isinstance(bound_digest, str) and SHA.fullmatch(bound_digest),
                        "attestation index descriptor lacks subject digest")
                manifest_subject = manifest.get("subject")
                if manifest_subject is not None:
                    require(manifest_subject.get("digest") == bound_digest,
                            "OCI attestation manifest subject mismatch")
                attest_config = manifest.get("config")
                descriptor_path(attest_config)
                attestation_subjects.append(bound_digest)
                for layer in manifest.get("layers") or []:
                    descriptor_path(layer)
                    if "in-toto" in layer.get("mediaType", ""):
                        statement = load(layer)
                        predicate_type = statement.get("predicateType", "")
                        stmt_subjects = statement.get("subject")
                        require(isinstance(stmt_subjects, list) and
                                any(isinstance(item, dict) and
                                    (item.get("digest") or {}).get("sha256") == bound_digest[7:]
                                    for item in stmt_subjects),
                                "BuildKit statement subject not bound to image manifest")
                        if predicate_type.startswith("https://slsa.dev/provenance/"):
                            predicates.add("provenance")
                        if ("spdx" in predicate_type.lower() or
                            "cyclonedx" in predicate_type.lower()):
                            predicates.add("sbom")
            else:
                raise OciError("unexpected OCI manifest platform or unattached descriptor")
        require(len(images) == 1, "expected exactly one linux/amd64 image")
        require(all(subject == images[0]["manifest_digest"]
                    for subject in attestation_subjects),
                "BuildKit attestation does not refer to the tested image manifest")
        if require_attestations:
            require({"provenance", "sbom"} <= predicates,
                    "BuildKit provenance/SBOM not present in OCI attestation manifests")
        return {
            "schema": "mastergantt-oci-subject-v1",
            "index_digest": index_digest,
            "image_manifest_digest": images[0]["manifest_digest"],
            "config_digest": images[0]["config_digest"],
            "labels": images[0]["labels"],
            "attestations": sorted(predicates),
            "archive_sha256": hash_archive(path),
            "archive_bytes": pathlib.Path(path).stat().st_size,
        }


def hash_archive(path: str) -> str:
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        report = validate_archive(args.archive, repository=args.repository,
                                  revision=args.revision, version=args.version)
    except (OciError, ValueError, OSError, tarfile.TarError, KeyError, TypeError) as error:
        print("BLOCKED: invalid OCI image evidence: " + str(error), file=sys.stderr)
        return 1
    pathlib.Path(args.output).write_text(json.dumps(report, indent=2, sort_keys=True) + "\n",
                                        encoding="utf-8")
    print(f"Verified OCI index {report['index_digest']}; child {report['image_manifest_digest']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
