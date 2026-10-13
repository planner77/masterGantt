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
        with patch.object(audit, "api", side_effect=[refs, {"sha":"a"*40,"object":{"type":"commit","sha":"b"*40}}]):
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
        rows=[(1,"mastergantt-release-authorization:v1",{"expected_version":"0.107.0","authorized":True,"note":"original permission"}),
              (2,"mastergantt-release-authorization:v1",{"expected_version":"0.107.0","authorized":False,"note":"latest revocation"})]
        self.assertTrue(audit.latest_marker(rows,"mastergantt-release-authorization:v1","0.107.0",False))
        self.assertFalse(audit.latest_marker(rows,"mastergantt-release-authorization:v1","0.107.0",True))


    def test_153_matching_refs_non_paginated(self):
        refs=[{"ref":f"refs/tags/v0.0.{i}","object":{"type":"commit","sha":f"{i:040x}"}} for i in range(153)]
        with patch.object(audit,"api",return_value=refs) as call:
            self.assertEqual(len(audit.tag_inventory()),153)
            call.assert_called_once()
        with patch.object(audit,"api",return_value=refs):
            with self.assertRaises(SuccessionBlocked):audit.pages("/refs")

    def test_duplicate_malformed_and_unavailable_tags_block(self):
        ref={"ref":"refs/tags/v0.1.0","object":{"type":"commit","sha":"a"*40}}
        for response in ([ref,ref],{},[{"ref":"refs/tags/v0.1","object":{"type":"tag","sha":"bad"}}]):
            with patch.object(audit,"api",return_value=response):
                with self.assertRaises(SuccessionBlocked):audit.tag_inventory()
        with patch.object(audit,"api",side_effect=SuccessionBlocked("HTTP 404")):
            with self.assertRaises(SuccessionBlocked):audit.tag_inventory()

    def test_exact_historical_pr_source_ledger(self):
        chain = [row[0] for row in audit.B2_SOURCES] + [audit.policy.PUBLISHED_SHA]
        # Short fixtures mirror the five authenticated PR body layouts.
        # #559 has an introduction before Refs; #627/#628 use a header after
        # the first line, and #626/#632 add metadata immediately after Refs.
        bodies = {
            559: 'Milestone Dashboard에서 별도 목록에 진입합니다.\n\nRefs #550\nrisk_level: HIGH\nqa_method: OWNER_MANAGED\n',
            627: 'Refs #615\n\n## 요약\n제품 공정과 공통 목록을 정의합니다.\n',
            628: 'Refs #615\n\n## 요약\n- Main CI 회복 범위와 정책\n',
            626: 'Refs #550\nrisk_level: HIGH\nqa_method: OWNER_MANAGED\nqa_required: true\n\n## 변경 결과\n',
            632: 'Refs #550\nrisk_level: HIGH\nqa_method: OWNER_MANAGED\nqa_required: true\n\n## 배경 및 실패 증거\n',
        }
        def verified(path):
            number = int(path.rsplit('/', 1)[1])
            sha, issue, _ = next(row for row in audit.B2_SOURCES if row[2] == number)
            return {'number':number, 'state':'closed', 'merged':True,
                    'merge_commit_sha':sha,
                    'body': bodies[number],
                    'base':{'ref':'main','repo':{'full_name':audit.REPO}},
                    'head':{'repo':{'full_name':audit.REPO}}}
        with patch.object(audit, 'api', side_effect=verified) as calls:
            self.assertTrue(audit.historical_prs_verified(chain))
            self.assertEqual(calls.call_count, 5)
        for field, value in [('merge_commit_sha','f'*40), ('state','open'),
                             ('merged',False), ('body','Refs #999'), ('base', {}), ('head', {})]:
            def tampered(path):
                pr = verified(path)
                if path.endswith('/628'): pr[field] = value
                return pr
            with self.subTest(field=field), patch.object(audit, 'api', side_effect=tampered):
                with self.assertRaises(SuccessionBlocked):
                    audit.historical_prs_verified(chain)
        with patch.object(audit, 'api', side_effect=SuccessionBlocked('HTTP 403')):
            with self.assertRaises(SuccessionBlocked):
                audit.historical_prs_verified(chain)
        with self.assertRaises(SuccessionBlocked):
            audit.historical_prs_verified(chain[1:])

    def test_historical_refs_fail_closed_on_ambiguous_and_inline_text(self):
        chain = [row[0] for row in audit.B2_SOURCES] + [audit.policy.PUBLISHED_SHA]
        def pr_with_body(body):
            def fake_api(path):
                number = int(path.rsplit('/', 1)[1])
                sha, issue, _ = next(row for row in audit.B2_SOURCES if row[2] == number)
                return {
                    'number':number, 'state':'closed', 'merged':True,
                    'merge_commit_sha':sha,
                    'body':body if number == 559 else f'Refs #{issue}',
                    'base':{'ref':'main','repo':{'full_name':audit.REPO}},
                    'head':{'repo':{'full_name':audit.REPO}},
                }
            return fake_api
        # These deliberately do not assert a git-history problem: the only
        # changed evidence is the primary Issue line from a PR's live body.
        invalid = (
            '## Details\n\nRefs #550\nRefs #550\n',
            '## Details\n\nRefs #550\nRefs #615\n',
            '## Details\n\nRefs #615\n',
            '## Details\n\nThis fixes Refs #550 in prose\n',
            '- Refs #550\n',
            'Refs #550 extra words\n',
            'Refs #0\n',
            'Refs #550\n\n설명에 숨긴 Refs #615는 거부\n',
            'Refs #550\n\n> Refs #550\n',
            'Refs #550\n\n예시 refs #550과 중복\n',
            '',
        )
        for body in invalid:
            with self.subTest(body=body), patch.object(
                audit, 'api', side_effect=pr_with_body(body)
            ):
                with self.assertRaises(SuccessionBlocked):
                    audit.historical_prs_verified(chain)
        for invalid_body in (None, [], {'Refs': '#550'}):
            with self.subTest(invalid_body=invalid_body), patch.object(
                audit, 'api', side_effect=pr_with_body(invalid_body)
            ):
                with self.assertRaises(SuccessionBlocked):
                    audit.historical_prs_verified(chain)
        for invalid_response in (None, {}, {'number': 559}):
            with self.subTest(invalid_response=invalid_response), patch.object(
                audit, 'api', return_value=invalid_response
            ):
                with self.assertRaises(SuccessionBlocked):
                    audit.historical_prs_verified(chain)

        with patch.object(
            audit, 'api', side_effect=pr_with_body(
                '## Title\r\n\r\n \tRefs #550 \t\r\nOther comments\r\n'
            )
        ):
            self.assertTrue(audit.historical_prs_verified(chain))

    def test_latest_owner_note_is_required(self):
        rows=[(8,'mastergantt-release-authorization:v1',
               {'expected_version':'0.107.0','authorized':False,'note':'  '})]
        with self.assertRaises(SuccessionBlocked):
            audit.latest_marker(rows,'mastergantt-release-authorization:v1','0.107.0',False)

    def test_b2_owner_scope_authentication(self):
        chain=[x[0] for x in audit.B2_SOURCES]+[audit.policy.PUBLISHED_SHA]
        d={"authorized":True,"mode":"B2_RETIRE_BOTH","source_550_sha":chain[0],
           "source_615_sha":chain[1],"verified_615_sha":chain[2],
           "verified_550_sha":chain[4],"recovery_issue":633,"recovery_pr":635,
           "recovery_sha":audit.policy.PUBLISHED_SHA,"expected_version":"0.106.1",
           "note":"immutable and explicitly approved historical B2 retirement"}
        self.assertIsNone(audit.b2_decision([],chain))
        self.assertTrue(audit.b2_decision([(1,"mastergantt-release-debt-authorization:v2",d)],chain))
        with self.assertRaises(SuccessionBlocked):
            audit.b2_decision([(1,"mastergantt-release-debt-authorization:v2",dict(d,recovery_sha="a"*40))],chain)


    def test_ghcr_bare_semver_and_published_candidate_digest(self):
        from scripts.release_succession_preflight import PUBLISHED_SHA, PUBLISHED_DIGEST
        tags = ["0.106.1", f"ci-{PUBLISHED_SHA}"]
        packages = [{"id": 1, "metadata": {"container": {"tags": tags}}}]
        raw = lambda tag: (f"Name: ghcr.io/planner77/mastergantt:{tag}\\n"
                           "MediaType: application/vnd.oci.image.index.v1+json\\n"
                           f"Digest: {PUBLISHED_DIGEST}\\n")
        with patch.object(audit, "pages", return_value=packages), patch.object(
            audit, "process", side_effect=lambda *args: raw(args[4].split(":")[-1])
        ) as call:
            found, digests = audit.registry_inventory()
        self.assertEqual(found, set(tags))
        self.assertEqual(digests, {tag: PUBLISHED_DIGEST for tag in tags})
        self.assertEqual(call.call_count, 2)

    def test_ghcr_missing_candidate_not_silently_positive(self):
        from scripts.release_succession_preflight import PUBLISHED_SHA, PUBLISHED_DIGEST
        tag = "0.106.1"
        packages = [{"id": 1, "metadata": {"container": {"tags": [tag]}}}]
        raw = (f"Name: ghcr.io/planner77/mastergantt:{tag}\\n"
               "MediaType: application/vnd.oci.image.index.v1+json\\n"
               f"Digest: {PUBLISHED_DIGEST}\\n")
        with patch.object(audit, "pages", return_value=packages), patch.object(
            audit, "process", return_value=raw
        ):
            found, digests = audit.registry_inventory()
        self.assertNotIn(f"ci-{PUBLISHED_SHA}", found)
        with patch.object(audit, "api", return_value={
            "number": 635, "merged": True,
            "merge_commit_sha": PUBLISHED_SHA, "base": {"ref": "main"}
        }):
            with self.assertRaisesRegex(SuccessionBlocked, "후보"):
                audit.release_lifecycle_verified([PUBLISHED_SHA],
                    {"refs/tags/v0.106.1": PUBLISHED_SHA},
                    found, digests, "https://github.com/planner77/masterGantt/issues/633")

    def test_ghcr_invalid_and_duplicate_metadata_fail_closed(self):
        base = {"id": 1, "metadata": {"container": {"tags": ["0.105.0"]}}}
        cases = [[base, dict(base, id=2)],
                 [base, dict(base)],
                 [{"id": 1, "metadata": {"container": {"tags": ["invalid tag"]}}}],
                 [{"id": 1, "metadata": {"container": {"tags": "0.106.1"}}]]
        for rows in cases:
            with self.subTest(rows=rows), patch.object(audit, "pages", return_value=rows):
                with self.assertRaises(SuccessionBlocked):
                    audit.registry_inventory()
        for status in ("401", "403", "404", "429"):
            with patch.object(audit, "pages", side_effect=SuccessionBlocked("HTTP "+status)):
                with self.assertRaises(SuccessionBlocked):
                    audit.registry_inventory()

    def test_oci_manifest_exact_name_and_top_level_descriptor(self):
        from scripts.release_succession_preflight import PUBLISHED_DIGEST
        good = ("Name: ghcr.io/planner77/mastergantt:0.106.1\\n"
                "MediaType: application/vnd.oci.image.index.v1+json\\n"
                f"Digest: {PUBLISHED_DIGEST}\\n")
        invalid = [
            good.replace("0.106.1", "v0.106.1"),
            good.replace("sha256:", "sha512:"),
            good.replace("image.index", "image.layer"),
            good + f"Digest: {PUBLISHED_DIGEST}\\n",
            "",
        ]
        with patch.object(audit, "process", return_value=good):
            self.assertEqual(audit.authenticated_manifest_digest("0.106.1"), PUBLISHED_DIGEST)
        for output in invalid:
            with self.subTest(output=output), patch.object(audit, "process", return_value=output):
                with self.assertRaises(SuccessionBlocked):
                    audit.authenticated_manifest_digest("0.106.1")

if __name__ == "__main__":
    unittest.main()
