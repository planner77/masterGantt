#!/usr/bin/env python3
"""QA Final Automated: fail-closed unit scenarios (no network)."""
import unittest
import qa_final_automated as qa


class Cases(unittest.TestCase):
    def blocked(self, f, status="BLOCKED"):
        with self.assertRaises(qa.Blocked) as cm:
            f()
        self.assertEqual(cm.exception.status, status)

    def snapshot(self):
        a, b, c = "a"*40, "b"*40, "c"*40
        return ({"pull_request":{"head":{"sha":a},"base":{"sha":b}}},
                {"state":"open","head":{"sha":a},"base":{"sha":b},
                 "mergeable":True,"merge_commit_sha":c},
                {"id":11,"run_attempt":1,"event":"pull_request",
                 "head_sha":a,"status":"in_progress"},
                {"EVENT_HEAD_SHA":a,"EVENT_BASE_SHA":b,"TEST_MERGE_SHA":c,
                 "GITHUB_RUN_ID":"11","GITHUB_RUN_ATTEMPT":"1"})

    def jobs(self):
        return {"changes":"success","quality":"success","e2e":"success",
                "docker":"success","metadata":"skipped","metadata_only":"false",
                "e2e_required":"true","docker_required":"false"}

    def test_head_and_merge(self):
        qa.snapshot(*self.snapshot())
        for mode in ["head","base","merge","attempt","mergeable"]:
            e,p,r,v=self.snapshot()
            if mode=="head": p["head"]["sha"]="d"*40
            if mode=="base": p["base"]["sha"]="d"*40
            if mode=="merge": p["merge_commit_sha"]="d"*40
            if mode=="attempt": r["run_attempt"]=2
            if mode=="mergeable": p["mergeable"]=None
            self.blocked(lambda:qa.snapshot(e,p,r,v))

    def test_required_jobs_and_skip(self):
        good=qa.evidence(self.jobs())
        self.assertEqual(good["e2e_evidence"],"EXECUTED")
        self.assertEqual(good["docker_evidence"],"SKIPPED_NOT_TESTED")
        for job in ["quality","e2e","docker"]:
            for status in ["failure","cancelled","skipped",""]:
                v=self.jobs();v[job]=status
                self.blocked(lambda:qa.evidence(v),"FAIL")

    def test_metadata_evidence(self):
        v=self.jobs();v.update(metadata_only="true",metadata="success")
        self.assertEqual(qa.evidence(v)["e2e_evidence"],"PREVIOUS_FULL_CI")
        for status in ["failure","cancelled","skipped",""]:
            v["metadata"]=status
            self.blocked(lambda:qa.evidence(v),"FAIL")

    def test_primary_issue_and_injection(self):
        self.assertEqual(qa.primary_issue("[Issue #580] qa","Refs #580"),580)
        self.blocked(lambda:qa.primary_issue("[Issue #580] qa","Refs #565"))
        self.blocked(lambda:qa.pr_field("qa_method: $(curl x)","qa_method",
                                       {"AGENT","AUTOMATED_MANAGER"}))

    def test_documents_and_ac(self):
        plan="## DOCUMENTATION_SYNC\n- \x60docs/TEST_PLAN.md\x60: UPDATED\n- \x60DESIGN.md\x60: N/A(기능 계약을 변경하지 않는 테스트 관련 변경)\n## AC_TEST_COVERAGE\n- AC1: scripts/test_qa_final_automated.py test\n- AC2: scripts/test_qa_final_automated.py test\n"
        changed={"src/ui.ts","docs/TEST_PLAN.md"}
        qa.docs_gate(plan, changed, {"AC1","AC2"})
        self.blocked(lambda:qa.docs_gate(plan,changed,{"AC1","AC3"}))
        self.blocked(lambda:qa.docs_gate(plan,{"src/ui.ts"},{"AC1"}))

    def test_request_changes(self):
        reviews=[{"id":1,"submitted_at":"1","user":{"login":"alice"},
                  "state":"CHANGES_REQUESTED"},
                 {"id":2,"submitted_at":"2","user":{"login":"alice"},
                  "state":"COMMENTED"}]
        self.assertTrue(qa.blocking_reviews(reviews))
        reviews.append({"id":3,"submitted_at":"3","user":{"login":"alice"},
                        "state":"DISMISSED"})
        self.assertFalse(qa.blocking_reviews(reviews))


    def test_workflow_bootstrap_is_never_automated_pass(self):
        from pathlib import Path
        workflow = (Path(__file__).resolve().parents[1] /
                    ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
        self.assertIn("qa_bootstrap:", workflow)
        self.assertIn("name: QA Final — Automated", workflow)
        self.assertIn("present=false", workflow)
        self.assertIn("QA Final — Automated: NOT TESTED (bootstrap)", workflow)
        self.assertIn("needs.qa_bootstrap.outputs.trusted_validator == 'true'", workflow)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertNotIn("pull_request_target:", workflow)
        # Old fail-on-bootstrap step must not turn full PR CI red.
        self.assertNotIn("최초 도입 PR Bootstrap 검증", workflow)


if __name__=="__main__":
    unittest.main(verbosity=2)
