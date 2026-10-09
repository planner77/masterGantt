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


    def test_protected_rename_paths_and_policy_files(self):
        changed = [{"filename":"docs/note.md","status":"renamed",
                    "previous_filename":"scripts/qa_final_automated.py"}]
        paths, protected = qa.protected_paths(changed)
        self.assertIn("scripts/qa_final_automated.py", paths)
        self.assertIn("scripts/qa_final_automated.py", protected)
        for path in (".github/workflows/ci.yml", ".github/workflows/qa-final-trusted.yml",
                     "docs/QA_REVIEW_POLICY.md", "docs/SECURITY.md",
                     ".codex/agents/infra.toml", "AGENTS.md"):
            self.assertIn(path, qa.protected_paths(
                [{"filename":path,"status":"modified"}])[1])
        self.blocked(lambda:qa.protected_paths(
            [{"filename":"docs/note.md","status":"renamed"}]))

    def test_metadata_full_ci_requires_matching_base(self):
        class Stub:
            prefix="/repos/planner77/masterGantt"
            base="a"*40
            def collection(self, url, name):
                if name == "workflow_runs":
                    return [{"id":88,"event":"pull_request","head_sha":"h"*40,
                             "display_title":"PR CI [전체 검증]",
                             "status":"completed","conclusion":"success","run_number":55,
                             "pull_requests":[{"number":587,"head":{"sha":"h"*40},
                                               "base":{"sha":self.base}}]}]
                return [{"name":name,"conclusion":status} for name,status in (
                    ("Build, static checks, and unit tests","success"),
                    ("Chromium end-to-end tests","success"),
                    ("Docker build and runtime smoke test","success"),
                    ("PR metadata가 기존 전체 CI 증거를 보존하는지 검증","skipped"))]
        s=Stub()
        self.assertEqual(qa.verify_same_base_full_run(
            s,587,"h"*40,"a"*40,99),88)
        s.base="b"*40
        self.blocked(lambda:qa.verify_same_base_full_run(
            s,587,"h"*40,"a"*40,99))

    def test_default_branch_workflow_run_has_distinct_trust_source(self):
        from unittest.mock import patch
        class Stub:
            repo="planner77/masterGantt"
            prefix="/repos/planner77/masterGantt"
            def get(self,path):
                if path.endswith("/actions/runs/88"):
                    return {"id":88,"event":"pull_request","head_sha":"h"*40,
                            "path":".github/workflows/ci.yml","status":"completed",
                            "conclusion":"success","run_attempt":1,
                            "repository":{"full_name":self.repo},
                            "display_title":"PR CI [전체 검증]",
                            "pull_requests":[{"number":587,"head":{"sha":"h"*40},
                                              "base":{"sha":"b"*40}}]}
                return {"head":{"sha":"h"*40},"base":{"sha":"b"*40},
                        "merge_commit_sha":"m"*40}
            def collection(self,path,name):
                return [{"name":name,"conclusion":result} for name,result in (
                    ("변경 경로 판정","success"),
                    ("Build, static checks, and unit tests","success"),
                    ("Chromium end-to-end tests","success"),
                    ("Docker build and runtime smoke test","success"),
                    ("PR metadata가 기존 전체 CI 증거를 보존하는지 검증","skipped"))]
        env={"GITHUB_RUN_ID":"99"}
        with patch.object(qa,"check",return_value={"automated_qa":"PASS"}) as check:
            out=qa.trusted_source(env,{"workflow_run":{"id":88}},Stub())
        self.assertEqual(out["trusted_source"],"PROTECTED_DEFAULT_BRANCH_WORKFLOW_RUN")
        self.assertEqual(out["source_ci_run_id"],88)
        self.assertEqual(check.call_args.args[0]["GITHUB_RUN_ID"],"88")

    def test_trusted_workflow_definition_never_checks_out_pr_code(self):
        from pathlib import Path
        src=(Path(__file__).resolve().parents[1]/".github/workflows/qa-final-trusted.yml").read_text()
        self.assertIn('workflows: ["CI"]',src)
        self.assertIn("ref: main",src)
        self.assertIn("persist-credentials: false",src)
        self.assertIn("github.event.workflow_run.event == 'pull_request'",src)
        self.assertNotIn("pull_request_target:",src)
        self.assertNotIn("github.event.workflow_run.head_sha",src)
        self.assertNotIn("checks: write",src)
        self.assertNotIn("contents: write",src)


if __name__=="__main__":
    unittest.main(verbosity=2)
