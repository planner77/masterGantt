#!/usr/bin/env python3
"""Issue #874: builder provenance vs release verification environment."""
import pathlib
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
import ci_image_contract as contract

TREE = "b" * 40
REVISION = "c" * 40
DIGEST = "sha256:" + "d" * 64
ARCHIVE = "e" * 64
BASE = "sha256:" + "f" * 64
SOURCE = {
    "git_tree": TREE,
    "files_sha256": {"package-lock.json": "0" * 64},
    "base_image_digest": BASE,
}
BUILDER = {
    **SOURCE,
    "platform": "linux/amd64",
    "buildx_version": "github.com/docker/buildx v0.38.1",
    "docker_version": "29.4.2",
    "runner_image_version": "20261101.186.1",
    "runner_os": "Linux",
    "runner_arch": "X64",
    "provenance": "mode=max",
    "sbom": True,
}
RECEIPT = {
    "schema": contract.SOURCE_VERSION,
    "repository": "planner77/masterGantt",
    "run_id": 1234,
    "run_attempt": 2,
    "source_revision": REVISION,
    "version": "0.141.0",
    "build_arg_version": "0.141.0",
    "oci_index_digest": DIGEST,
    "archive_sha256": ARCHIVE,
    "build": BUILDER,
}


class ReleaseBuilderProvenanceTest(unittest.TestCase):
    def verify(self, receipt=None, builder=None):
        with mock.patch.object(contract, "source_fingerprint", return_value=SOURCE), \
             mock.patch.object(contract, "fingerprint",
                               side_effect=AssertionError("Release runner must not be probed")):
            contract.verify(
                receipt if receipt is not None else RECEIPT,
                root=pathlib.Path("."), repository="planner77/masterGantt",
                run_id=1234, attempt=2, revision=REVISION, version="0.141.0",
                digest=DIGEST, archive_sha256=ARCHIVE, main_tree=TREE,
                certified_main_builder=builder if builder is not None else BUILDER,
            )

    def test_release_runner_version_mismatch_is_irrelevant_when_main_certified(self):
        # PR/Main builder 20261101; Release host 20261025 is not a builder.
        with mock.patch.dict("os.environ", {"ImageVersion": "20261025.179.1",
                                             "RUNNER_OS": "Linux", "RUNNER_ARCH": "X64"}):
            self.verify()

    def test_main_builder_mismatch_fails_closed(self):
        for key, alternate in (
            ("runner_image_version", "20261025.179.1"),
            ("buildx_version", "different buildx"),
            ("docker_version", "different docker"),
            ("base_image_digest", "sha256:" + "1" * 64),
            ("files_sha256", {"package-lock.json": "2" * 64}),
            ("git_tree", "3" * 40),
            ("provenance", "mode=min"),
            ("sbom", False),
        ):
            with self.subTest(key=key), self.assertRaises(contract.ContractError):
                self.verify(builder={**BUILDER, key: alternate})

    def test_pr_receipt_drift_fails_closed(self):
        for key, alternate in (
            ("runner_image_version", "other"), ("buildx_version", "other"),
            ("docker_version", "other"), ("git_tree", "4" * 40),
            ("files_sha256", {"package.json": "7" * 64}),
        ):
            with self.subTest(key=key), self.assertRaises(contract.ContractError):
                self.verify(receipt={**RECEIPT, "build": {**BUILDER, key: alternate}})

    def test_source_tree_or_build_inputs_changed_fails_closed(self):
        for key, value in (
            ("git_tree", "5" * 40), ("base_image_digest", "sha256:" + "6" * 64),
            ("files_sha256", {"Dockerfile": "3" * 64}),
        ):
            with self.subTest(key=key), \
                 mock.patch.object(contract, "source_fingerprint",
                                   return_value={**SOURCE, key: value}), \
                 mock.patch.object(contract, "fingerprint",
                                   side_effect=AssertionError("new runner probe")), \
                 self.assertRaisesRegex(contract.ContractError, "BUILD_SOURCE_INPUT_DRIFT"):
                contract.verify(RECEIPT, root=pathlib.Path("."),
                    repository="planner77/masterGantt", run_id=1234, attempt=2,
                    revision=REVISION, version="0.141.0", digest=DIGEST,
                    archive_sha256=ARCHIVE, main_tree=TREE,
                    certified_main_builder=BUILDER)

    def test_main_artifact_and_subject_metadata_mismatches_fail(self):
        for key, value in (
            ("run_id", 1235), ("run_attempt", 3),
            ("source_revision", "7" * 40), ("version", "0.141.1"),
            ("oci_index_digest", "sha256:" + "8" * 64),
            ("archive_sha256", "9" * 64),
        ):
            with self.subTest(key=key), self.assertRaisesRegex(
                    contract.ContractError, "PR_BUILD_RECEIPT_"):
                self.verify(receipt={**RECEIPT, key: value})

    def test_malformed_or_missing_builder_fields_rejected(self):
        for value in ({"git_tree": TREE}, [], {}, {**BUILDER, "sbom": None},
                      {**BUILDER, "runner_os": "Windows"}):
            with self.subTest(value=value), self.assertRaises(contract.ContractError):
                self.verify(builder=value)

    def test_main_verifier_still_uses_live_main_runner_and_rejects_drift(self):
        with mock.patch.object(contract, "fingerprint", return_value={
            **BUILDER, "runner_image_version": "20261025.179.1",
        }), self.assertRaisesRegex(contract.ContractError,
                                  "BUILD_INPUT_OR_BUILDER_DRIFT"):
            contract.verify(RECEIPT, root=pathlib.Path("."),
                repository="planner77/masterGantt", run_id=1234, attempt=2,
                revision=REVISION, version="0.141.0", digest=DIGEST,
                archive_sha256=ARCHIVE, main_tree=TREE)

    def test_main_ci_records_independent_builder_witness(self):
        workflow = (pathlib.Path(__file__).resolve().parents[2] /
                    ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        name = "ci-main-build-contract-" + chr(36) + "{{ github.run_id }}-" + chr(36) + "{{ github.run_attempt }}"
        self.assertIn(name, workflow)
        self.assertIn("if: success() && github.event_name == 'push' && github.ref == 'refs/heads/main'", workflow)
        self.assertIn("if-no-files-found: error", workflow)


if __name__ == "__main__":
    unittest.main()
