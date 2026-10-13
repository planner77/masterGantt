import unittest
from unittest.mock import patch
from scripts import release_succession_audit as audit
from scripts.release_succession_preflight import SuccessionBlocked

class TestReadOnlyAudit(unittest.TestCase):
    def test_pagination_requires_complete_last_page(self):
        with patch.object(audit, "api", return_value=[{}]*100):
            with self.assertRaises(SuccessionBlocked):
                audit.pages("/repos/example/releases")

    def test_auth_error_is_not_absent(self):
        with patch.object(audit, "api", side_effect=SuccessionBlocked("HTTP 404")):
            with self.assertRaises(SuccessionBlocked):
                audit.release_inventory()

    def test_duplicate_releases_block(self):
        with patch.object(audit, "pages", return_value=[{"tag_name":"v0.106.1"}]*2):
            with self.assertRaises(SuccessionBlocked):
                audit.release_inventory()

    def test_annotated_tag_peel(self):
        refs=[{"ref":"refs/tags/v0.106.1","object":{"type":"tag","sha":"a"*40}}]
        with patch.object(audit, "pages", return_value=refs), patch.object(
            audit, "api", return_value={"object":{"type":"commit","sha":"b"*40}}
        ):
            self.assertEqual(audit.tag_inventory()["refs/tags/v0.106.1"],"b"*40)

    def test_main_stale_blocks(self):
        with patch.object(audit,"api", side_effect=[
            {"full_name":audit.REPO,"default_branch":"main"},
            {"object":{"sha":"a"*40}},
        ]),patch.object(audit,"process",return_value="b"*40):
            with self.assertRaises(SuccessionBlocked):
                audit.main_snapshot()

    def test_unconfirmed_prepare_decision_never_authorizes_release(self):
        rows = []
        self.assertFalse(audit.latest_marker(
            rows, "mastergantt-release-authorization:v1", "0.108.0", True
        ))
        self.assertFalse(audit.latest_marker(
            rows, "mastergantt-release-authorization:v1", "0.107.0", False
        ))

    def test_ghcr_missing_metadata_blocks(self):
        with patch.object(audit, "pages", return_value=[{"id": 1}]):
            with self.assertRaises(SuccessionBlocked):
                audit.registry_inventory()

    def test_jobs_api_envelope(self):
        with patch.object(audit, "api", return_value={"total_count": 1, "jobs": [{"conclusion": "success"}]}):
            self.assertEqual(len(audit.pages("/jobs", key="jobs")), 1)

    def test_conflicting_owner_markers_block(self):
        rows = [(7, "mastergantt-release-authorization:v1",
                 {"expected_version": "0.107.0", "authorized": False}),
                (7, "mastergantt-release-authorization:v1",
                 {"expected_version": "0.107.0", "authorized": True})]
        with self.assertRaises(SuccessionBlocked):
            audit.latest_marker(rows, "mastergantt-release-authorization:v1", "0.107.0", False)

    def test_latest_owner_revocation(self):
        rows=[(1,"mastergantt-release-authorization:v1",{"expected_version":"0.107.0","authorized":True}),
              (2,"mastergantt-release-authorization:v1",{"expected_version":"0.107.0","authorized":False})]
        self.assertTrue(audit.latest_marker(rows,"mastergantt-release-authorization:v1","0.107.0",False))
        self.assertFalse(audit.latest_marker(rows,"mastergantt-release-authorization:v1","0.107.0",True))

if __name__ == "__main__":
    unittest.main()
