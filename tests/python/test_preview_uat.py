"""Issue #897: Preview UAT Owner receipt negative/positive contract tests."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import preview_uat
from qa_final_automated import Blocked

SHA = "a" * 40
OTHER = "b" * 40
IMAGE = "sha256:" + "c" * 64
EVIDENCE = "sha256:" + "d" * 64


def comment(comment_id, login="planner77", sha=SHA, decision="ACCEPT",
            image=IMAGE, evidence=EVIDENCE, issue=889):
    return {"id": comment_id, "user": {"login": login},
            "body": "\n".join([
                "mastergantt-preview-uat:v1", f"issue: {issue}",
                f"source_sha: {sha}", f"image_digest: {image}",
                f"evidence_sha256: {evidence}", f"decision: {decision}", ""])}


def evaluate(comments):
    return preview_uat.evaluate_receipts(
        comments, owner="planner77", issue=889, sha=SHA,
        image_digest=IMAGE, evidence_sha256=EVIDENCE)


class PreviewUatTests(unittest.TestCase):
    def test_exact_owner_receipt(self):
        result = evaluate([comment(11)])
        self.assertEqual(result["state"], "UAT_ACCEPTED")
        self.assertEqual(result["owner_comment_id"], 11)

    def test_numeric_evidence_field_name_is_accepted_but_unknown_key_is_not(self):
        receipt = preview_uat.parse_receipt(comment(11)["body"])
        self.assertIsNotNone(receipt)
        self.assertEqual(receipt["evidence_sha256"], EVIDENCE)
        self.assertIsNone(preview_uat.parse_receipt(
            comment(11)["body"].replace("source_sha:", "source_sha2:")))

    def test_later_owner_rework_overrides_accept(self):
        with self.assertRaisesRegex(Blocked, "UAT_REWORK"):
            evaluate([comment(11), comment(20, decision="REWORK")])

    def test_stale_source_is_rejected(self):
        with self.assertRaisesRegex(Blocked, "UAT_STALE"):
            evaluate([comment(11, sha=OTHER)])

    def test_stale_digest_and_manifest_rejected(self):
        for kwargs in ({"image": "sha256:" + "a" * 64},
                       {"evidence": "sha256:" + "e" * 64}):
            with self.subTest(kwargs=kwargs), self.assertRaisesRegex(Blocked, "UAT_STALE"):
                evaluate([comment(11, **kwargs)])

    def test_non_owner_and_other_issue_cannot_approve(self):
        for receipt in ([comment(11, login="untrusted")],
                        [comment(11, issue=890)]):
            with self.subTest(receipt=receipt), self.assertRaisesRegex(Blocked, "UAT_NOT_TESTED"):
                evaluate(receipt)

    def test_not_a_comment_self_claim(self):
        with self.assertRaisesRegex(Blocked, "UAT_NOT_TESTED"):
            evaluate([])

    def test_duplicate_or_incomplete_fields_rejected(self):
        original = comment(11)
        for suffix in ("decision: ACCEPT\n", "evidence_sha256: \n",
                       "decision: UNKNOWN\n"):
            bad = dict(original, body=original["body"] + suffix)
            self.assertIsNone(preview_uat.parse_receipt(bad["body"]))
            with self.assertRaisesRegex(Blocked, "UAT_NOT_TESTED"):
                evaluate([bad])
        # Ordinary prose is allowed only after a real blank line.
        self.assertIsNotNone(preview_uat.parse_receipt(
            original["body"] + "\nOwner reviewed the isolated Preview."))

    def test_validation_of_identities(self):
        for sha in ("X" * 40, "a" * 39):
            with self.assertRaises(Blocked):
                preview_uat.evaluate_receipts(
                    [comment(11)], owner="planner77", issue=889,
                    sha=sha, image_digest=IMAGE, evidence_sha256=EVIDENCE)


if __name__ == "__main__":
    unittest.main()
