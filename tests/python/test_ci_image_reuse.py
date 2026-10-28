#!/usr/bin/env python3
"""Issue #836: OCI byte/manifest and Main trust-boundary regression fixtures."""
from __future__ import annotations

import hashlib
import io
import json
import pathlib
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import ci_image_reuse as selection
import verified_oci as oci

REPO = "planner77/masterGantt"
MAIN = "a" * 40
BASE = "b" * 40
HEAD = "c" * 40
PR_MERGE = "d" * 40
TREE = "e" * 40
VERSION = "0.136.0"


def packed(doc: dict) -> bytes:
    return json.dumps(doc, sort_keys=True, separators=(",", ":")).encode()


def blob(contents: bytes, entries: dict[str, bytes]) -> dict:
    digest = "sha256:" + hashlib.sha256(contents).hexdigest()
    entries["blobs/sha256/" + digest[7:]] = contents
    return {"digest": digest, "size": len(contents)}


def fixture(*, attested: bool = True, revision: str = MAIN, wrapped: bool = False,
            include_dirs: bool = False) -> bytes:
    entries: dict[str, bytes] = {"oci-layout": packed({"imageLayoutVersion": "1.0.0"})}
    layer = blob(b"layer", entries) | {"mediaType": "application/vnd.oci.image.layer.v1.tar+gzip"}
    config = blob(packed({"os": "linux", "architecture": "amd64",
                          "config": {"Labels": {
                              "org.opencontainers.image.source": "https://github.com/" + REPO,
                              "org.opencontainers.image.revision": revision,
                              "org.opencontainers.image.version": VERSION}}}), entries)
    config["mediaType"] = oci.IMAGE_CONFIG
    main_desc = blob(packed({"schemaVersion": 2, "config": config, "layers": [layer]}), entries)
    main_desc["mediaType"] = oci.IMAGE_MANIFEST
    main_desc["platform"] = {"os": "linux", "architecture": "amd64"}
    manifests = [main_desc]
    if attested:
        preds = [
            ("https://slsa.dev/provenance/v0.2", "provenance"),
            ("https://spdx.dev/Document", "sbom"),
        ]
        attestation_layers = []
        for predicate_type, name in preds:
            layer = blob(packed({"predicateType": predicate_type,
                                 "subject": [{"name": name,
                                              "digest": {"sha256": main_desc["digest"][7:]}}]}), entries)
            layer["mediaType"] = "application/vnd.in-toto+json"
            attestation_layers.append(layer)
        attest_config = blob(packed({"architecture": "unknown", "os": "unknown"}), entries)
        attest_config["mediaType"] = oci.IMAGE_CONFIG
        attestation = blob(packed({"schemaVersion": 2, "config": attest_config,
                                   "layers": attestation_layers}), entries)
        attestation["mediaType"] = oci.IMAGE_MANIFEST
        attestation["platform"] = {"os": "unknown", "architecture": "unknown"}
        attestation["annotations"] = {
            "vnd.docker.reference.type": "attestation-manifest",
            "vnd.docker.reference.digest": main_desc["digest"],
        }
        manifests.append(attestation)
    subject_index = packed({"schemaVersion": 2, "mediaType": oci.IMAGE_INDEX,
                            "manifests": manifests})
    if wrapped:
        descriptor = blob(subject_index, entries)
        descriptor["mediaType"] = oci.IMAGE_INDEX
        descriptor["annotations"] = {"org.opencontainers.image.ref.name": "latest"}
        entries["index.json"] = packed({"schemaVersion": 2, "mediaType": oci.IMAGE_INDEX,
                                         "manifests": [descriptor]})
    else:
        entries["index.json"] = subject_index
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as tar:
        if include_dirs:
            for directory in ("blobs/", "blobs/sha256/"):
                member = tarfile.TarInfo(directory)
                member.type = tarfile.DIRTYPE
                tar.addfile(member)
        for name, contents in entries.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(contents)
            tar.addfile(info, io.BytesIO(contents))
    return output.getvalue()


class OciSubjectContract(unittest.TestCase):
    def check(self, contents, **kwargs):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "image.tar"
            path.write_bytes(contents)
            return oci.validate_archive(str(path), repository=REPO, revision=MAIN,
                                        version=VERSION, **kwargs)

    def test_valid_exact_index_child_and_config_are_distinct(self):
        report = self.check(fixture())
        self.assertEqual(report["attestations"], ["provenance", "sbom"])
        self.assertRegex(report["index_digest"], r"^sha256:[a-f0-9]{64}$")
        self.assertNotEqual(report["index_digest"], report["image_manifest_digest"])
        self.assertNotEqual(report["config_digest"], report["image_manifest_digest"])

    def test_buildx_oci_layout_wrapper_has_distinct_subject_digest(self):
        report = self.check(fixture(wrapped=True))
        self.assertNotEqual(report["index_digest"], report["layout_index_digest"])
        self.assertNotEqual(report["index_digest"], report["image_manifest_digest"])
        self.assertEqual(report["attestations"], ["provenance", "sbom"])

    def test_oci_exporter_directory_entries_are_not_attack_paths(self):
        report = self.check(fixture(include_dirs=True, wrapped=True))
        self.assertEqual(report["attestations"], ["provenance", "sbom"])

    def test_wrong_revision_cannot_relabel_same_digest(self):
        with self.assertRaisesRegex(oci.OciError, "revision"):
            self.check(fixture(revision=PR_MERGE))

    def test_missing_provenance_or_sbom_fails_closed(self):
        with self.assertRaisesRegex(oci.OciError, "provenance/SBOM"):
            self.check(fixture(attested=False))

    def test_modified_blob_and_traversal_rejected(self):
        data = fixture()
        modified = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(data), mode="r") as source, \
             tarfile.open(fileobj=modified, mode="w") as out:
            for member in source:
                content = source.extractfile(member).read()
                if member.name.startswith("blobs/sha256/"):
                    content += b"x"
                member.size = len(content)
                out.addfile(member, io.BytesIO(content))
        with self.assertRaisesRegex(oci.OciError, "hash mismatch"):
            self.check(modified.getvalue())
        malicious = io.BytesIO()
        with tarfile.open(fileobj=malicious, mode="w") as out:
            data = b"x"
            member = tarfile.TarInfo("../evil")
            member.size = len(data)
            out.addfile(member, io.BytesIO(data))
        with self.assertRaisesRegex(oci.OciError, "unexpected OCI archive path"):
            self.check(malicious.getvalue())


class MainDecisionContract(unittest.TestCase):
    def test_workflow_enables_safe_reuse_by_default_and_preserves_false_rollback(self):
        workflow = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        self.assertIn('steps.package_version.outputs.version', workflow)
        self.assertIn('id: package_version', workflow)
        self.assertIn("vars.PR_IMAGE_REUSE_ENABLED == '' || vars.PR_IMAGE_REUSE_ENABLED == 'true'", workflow)
        self.assertIn("vars.PR_IMAGE_REUSE_ENABLED != '' && vars.PR_IMAGE_REUSE_ENABLED != 'true'", workflow)
        self.assertIn('needs.quality.result == \'success\'', workflow)
        self.assertIn('needs.e2e.result == \'success\'', workflow)
        self.assertIn('needs.docker.result == \'success\'', workflow)

    def test_explicit_false_shadow_never_uses_pr_even_when_proven(self):
        source = {"source_run_id": 1}
        self.assertEqual(selection.decide(active=False, recover=False, source=source),
                         ("REBUILD_MAIN_VERIFIED", "SHADOW_PR_REUSE_ELIGIBLE"))
        self.assertEqual(selection.decide(active=True, recover=False, source=source),
                         ("PR_REUSE_VERIFIED", "CERTIFIED_PR_SOURCE_AND_OCI"))

    def test_missing_archive_or_changed_source_rebuilds(self):
        self.assertEqual(selection.decide(active=True, recover=False, source=None,
                                         ineligible="ARTIFACT_MISSING_OR_EXPIRED")[0],
                         "REBUILD_MAIN_VERIFIED")
        self.assertEqual(selection.decide(active=True, recover=False, source=None,
                                         ineligible="MAIN_AND_PR_TEST_MERGE_TREE_DIFFER")[0],
                         "REBUILD_MAIN_VERIFIED")

    def test_trust_conflict_blocks_not_fallback(self):
        self.assertEqual(selection.decide(active=True, recover=False, source=None,
                                         blocked="ARTIFACT_ZIP_DIGEST_MISMATCH")[0],
                         "BLOCKED")
        self.assertEqual(selection.decide(active=True, recover=False, source=None,
                                         blocked="PR_SOURCE_ATTESTATION_MISMATCH")[0],
                         "BLOCKED")

    def test_manual_recovery_always_rebuilds(self):
        self.assertEqual(selection.decide(active=True, recover=True,
                         source={"source_run_id": 42}, blocked="ARTIFACT_ZIP_DIGEST_MISMATCH"),
                         ("REBUILD_MAIN_VERIFIED", "HISTORICAL_RECOVERY_NOT_ELIGIBLE"))

    def test_bad_source_merge_and_run_job_are_ineligible(self):
        pr = {"merged_at": "2026-10-28T00:00:00Z",
              "merge_commit_sha": MAIN,
              "base": {"ref": "main", "sha": BASE},
              "head": {"sha": HEAD, "repo": {"full_name": REPO}}}
        with mock.patch.object(selection, "git", side_effect=[
            MAIN, f"{MAIN} {BASE} {HEAD}", "", TREE]), \
             mock.patch.object(selection, "github", side_effect=[
                 [{"number": 836}], pr,
             ]), \
             mock.patch.object(selection, "page_items", return_value=[]):
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaisesRegex(selection.Ineligible, "FULL_RUN_MISSING"):
                    selection.verify_source(REPO, MAIN, "token", pathlib.Path(tmp), VERSION)

        altered = dict(pr, merge_commit_sha=HEAD)
        with mock.patch.object(selection, "git", side_effect=[
            MAIN, f"{MAIN} {BASE} {HEAD}", ""]), \
             mock.patch.object(selection, "github", side_effect=[
                 [{"number": 836}], altered]):
            with tempfile.TemporaryDirectory() as tmp:
                with self.assertRaisesRegex(selection.Ineligible, "PARENTS"):
                    selection.verify_source(REPO, MAIN, "token", pathlib.Path(tmp), VERSION)


if __name__ == "__main__":
    unittest.main()
