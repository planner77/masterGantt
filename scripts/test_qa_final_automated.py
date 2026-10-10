#!/usr/bin/env python3
"""QA Final Automated: fail-closed unit scenarios (no network)."""
import unittest
import qa_final_automated as qa
from unittest.mock import patch


def _recorded_pr_provenance(gh, run, payload):
    """Legacy attempt tests use controlled provenance; dedicated tests verify it."""
    prs = run.get("pull_requests") or []
    if len(prs) != 1:
        raise qa.Blocked("BLOCKED", "fixture PR 귀속 불명확")
    pr = prs[0]
    return pr["number"], run["head_sha"], pr["base"]["sha"], "m"*40, {}




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

    @patch.object(qa, "source_artifact", return_value={})
    @patch.object(qa, "verified_source", side_effect=_recorded_pr_provenance)
    def test_metadata_full_ci_requires_matching_base(self, mocked_verifier, mocked_artifact):
        class Stub:
            prefix="/repos/planner77/masterGantt"
            base="a"*40
            missing_attempt=False
            def collection(self, url, name):
                if name == "workflow_runs":
                    return [{"id":88,"event":"pull_request","head_sha":"h"*40,
                             "display_title":"PR CI [전체 검증]",
                             "status":"completed","conclusion":"success","run_number":55,
                             **({} if self.missing_attempt else {"run_attempt":1}),
                             "pull_requests":[{"number":587,"head":{"sha":"h"*40},
                                               "base":{"sha":self.base}}]}]
                assert name == "jobs", name
                assert url == self.prefix+"/actions/runs/88/attempts/1/jobs", url
                return [{"name":job,"conclusion":status} for job,status in (
                    ("Build, static checks, and unit tests","success"),
                    ("Chromium end-to-end tests","success"),
                    ("Docker build and runtime smoke test","success"),
                    ("PR metadata가 기존 전체 CI 증거를 보존하는지 검증","skipped"))]
        s=Stub()
        self.assertEqual(qa.verify_same_base_full_run(
            s,587,"h"*40,"a"*40,99),88)
        s.missing_attempt=True
        self.blocked(lambda:qa.verify_same_base_full_run(
            s,587,"h"*40,"a"*40,99))
        s.missing_attempt=False
        s.base="b"*40
        self.blocked(lambda:qa.verify_same_base_full_run(
            s,587,"h"*40,"a"*40,99))

    @patch.object(qa, "source_artifact", return_value={})
    @patch.object(qa, "verified_source", side_effect=_recorded_pr_provenance)
    def test_metadata_reuses_exact_full_run_after_qa_only_retry(self, mocked_verifier, mocked_artifact):
        class Stub:
            prefix="/repos/planner77/masterGantt"
            latest_e2e=None
            missing_attempt=False
            def collection(self, url, name):
                if name == "workflow_runs":
                    assert "head_sha=" + "h"*40 in url, url
                    return [{"id":88,"event":"pull_request","head_sha":"h"*40,
                             "display_title":"PR CI [전체 검증]",
                             "status":"completed","conclusion":"success","run_number":55,
                             "run_attempt":2,
                             "pull_requests":[{"number":587,
                                               "head":{"sha":"h"*40},
                                               "base":{"sha":"a"*40}}]}]
                assert name == "jobs", (name,url)
                if url == self.prefix+"/actions/runs/88/attempts/1/jobs":
                    if self.missing_attempt:
                        return []
                    return [{"name":key,"conclusion":status} for key,status in (
                        ("Build, static checks, and unit tests","success"),
                        ("Chromium end-to-end tests","success"),
                        ("Docker build and runtime smoke test","success"),
                        ("PR metadata가 기존 전체 CI 증거를 보존하는지 검증","skipped"),
                        ("QA Final — Automated","failure"))]
                assert url == self.prefix+"/actions/runs/88/attempts/2/jobs", url
                jobs=[{"name":"QA Final — Automated","conclusion":"success"}]
                if self.latest_e2e is not None:
                    jobs.append({"name":"Chromium end-to-end tests",
                                 "conclusion":self.latest_e2e})
                return jobs
        stub=Stub()
        self.assertEqual(qa.verify_same_base_full_run(
            stub,587,"h"*40,"a"*40,99),88)
        stub.latest_e2e="failure"
        self.blocked(lambda:qa.verify_same_base_full_run(
            stub,587,"h"*40,"a"*40,99), "FAIL")
        stub.latest_e2e=None
        stub.missing_attempt=True
        self.blocked(lambda:qa.verify_same_base_full_run(
            stub,587,"h"*40,"a"*40,99))

    @patch.object(qa, "source_artifact", return_value={})
    @patch.object(qa, "verified_source", side_effect=_recorded_pr_provenance)
    def test_default_branch_workflow_run_has_distinct_trust_source(self, mocked_verifier, mocked_artifact):
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

    @patch.object(qa, "source_artifact", return_value={})
    @patch.object(qa, "verified_source", side_effect=_recorded_pr_provenance)
    def test_trusted_qa_only_retry_resolves_exact_prior_aggregate_jobs(self, mocked_verifier, mocked_artifact):
        from unittest.mock import patch

        class Stub:
            repo = "planner77/masterGantt"
            prefix = "/repos/planner77/masterGantt"
            latest_e2e = None
            duplicate = False
            missing_original = False

            def get(self, path):
                if path == self.prefix+"/actions/runs/88":
                    return {
                        "id": 88, "event": "pull_request",
                        "head_sha": "h"*40, "path": ".github/workflows/ci.yml",
                        "status": "completed", "conclusion": "success",
                        "run_attempt": 2, "repository": {"full_name": self.repo},
                        "display_title": "PR CI [전체 검증]",
                        "pull_requests": [
                            {"number": 587, "head": {"sha": "h"*40},
                             "base": {"sha": "b"*40}}]
                    }
                if path == self.prefix+"/pulls/587":
                    return {
                        "head": {"sha": "h"*40}, "base": {"sha": "b"*40},
                        "merge_commit_sha": "m"*40
                    }
                raise AssertionError("Unexpected REST endpoint: "+path)

            def collection(self, path, name):
                assert name == "jobs", (path, name)
                if path == self.prefix+"/actions/runs/88/attempts/1/jobs":
                    if self.missing_original:
                        return []
                    return [
                        {"name": label, "conclusion": status,
                         "completed_at": "2026-10-10T09:00:00Z"}
                        for label, status in (
                            ("변경 경로 판정", "success"),
                            ("Build, static checks, and unit tests", "success"),
                            ("Chromium end-to-end tests", "success"),
                            ("Docker build and runtime smoke test", "success"),
                            ("Docker smoke 구현", "success"),
                            ("Chromium E2E shard 1/6", "success"),
                            ("PR metadata가 기존 전체 CI 증거를 보존하는지 검증", "skipped"),
                            ("QA Final — Automated", "failure"))]
                if path == self.prefix+"/actions/runs/88/attempts/2/jobs":
                    jobs = [{"name": "QA Final — Automated", "conclusion": "success",
                             "completed_at": "2026-10-10T10:00:00Z"}]
                    if self.latest_e2e is not None:
                        jobs.append({"name": "Chromium end-to-end tests",
                                     "conclusion": self.latest_e2e,
                                     "completed_at": "2026-10-10T10:00:00Z"})
                    if self.duplicate:
                        jobs.append(dict(jobs[0]))
                    return jobs
                raise AssertionError("Incorrect attempt provenance: "+path)

        stub = Stub()
        with patch.object(qa, "check", return_value={"automated_qa": "PASS"}) as check:
            result = qa.trusted_source(
                {"GITHUB_RUN_ID": "999"}, {"workflow_run": {"id": 88}}, stub)
        self.assertEqual(result["source_ci_run_attempt"], 2)
        self.assertEqual(result["required_job_source_attempts"], {
            "Build, static checks, and unit tests": 1,
            "Chromium end-to-end tests": 1,
            "Docker build and runtime smoke test": 1
        })
        env = check.call_args.args[0]
        for name in ("NEED_QUALITY", "NEED_E2E", "NEED_DOCKER"):
            self.assertEqual(env[name], "success")
        self.assertEqual(env["GITHUB_RUN_ATTEMPT"], "2")
        self.assertEqual(env["E2E_REQUIRED"], "true")
        self.assertEqual(env["DOCKER_REQUIRED"], "true")

        # A later attempt's failure MUST override an older successful aggregate.
        stub.latest_e2e = "failure"
        with patch.object(qa, "check", return_value={"automated_qa": "PASS"}):
            self.blocked(
                lambda: qa.trusted_source(
                    {"GITHUB_RUN_ID": "999"}, {"workflow_run": {"id": 88}}, stub),
                "FAIL")
        jobs = qa.effective_run_jobs(stub, 88, 2)
        self.assertEqual(jobs["Chromium end-to-end tests"]["source_attempt"], 2)
        self.assertEqual(jobs["Chromium end-to-end tests"]["conclusion"], "failure")

        stub.latest_e2e = None
        stub.duplicate = True
        self.blocked(lambda: qa.effective_run_jobs(stub, 88, 2))
        stub.duplicate = False
        stub.missing_original = True
        self.blocked(lambda: qa.effective_run_jobs(stub, 88, 2))
        self.blocked(lambda: qa.effective_run_jobs(stub, 88, 11))
        self.blocked(lambda: qa.effective_run_jobs(stub, 88, 0))


    def test_trusted_workflow_definition_never_checks_out_pr_code(self):
        from pathlib import Path
        src=(Path(__file__).resolve().parents[1]/".github/workflows/qa-final-trusted.yml").read_text()
        self.assertIn('workflows: ["CI"]',src)
        self.assertIn("ref: ${{ github.sha }}",src)
        self.assertIn("persist-credentials: false",src)
        self.assertIn("github.event.workflow_run.event == 'pull_request'",src)
        self.assertNotIn("pull_request_target:",src)
        self.assertNotIn("github.event.workflow_run.head_sha",src)
        self.assertIn("git rev-parse HEAD",src)
        self.assertNotIn("checks: write",src)
        self.assertNotIn("contents: write",src)


    def test_ci_execution_control_protection_rejects_composite_actions(self):
        for source in (".github/actions/node-setup/action.yml",
                       ".github/actions/playwright-setup/action.yml",
                       "scripts/verify-ci-run-trace.py",
                       "scripts/verify-issue-lifecycle.py",
                       "package.json", "package-lock.json", ".npmrc",
                       "tests/config/e2e-shard-plan.json",
                       "deploy/docker/container-entrypoint.sh"):
            paths, protected = qa.protected_paths(
                [{"filename":source,"status":"modified"}])
            self.assertIn(source, protected)
            self.assertIn(source, paths)
            changed = [{"filename":"docs/renamed.md","status":"renamed",
                        "previous_filename":source}]
            self.assertIn(source, qa.protected_paths(changed)[1])
        self.assertFalse(qa.protected_paths(
            [{"filename":"src/features/example.ts","status":"modified"}])[1])

    def test_all_tracked_ci_config_patterns_and_renames(self):
        for path in ("postcss.config.mjs", "tsconfig.runtime-tools.json",
                     "tsconfig.browser.json", "jest.config.ts",
                     "tailwind.config.js", "next.config.ts",
                     "playwright.config.ts", ".github/actions/node-setup/action.yml"):
            self.assertIn(path, qa.protected_paths(
                [{"filename":path,"status":"modified"}])[1])
            self.assertIn(path, qa.protected_paths(
                [{"filename":"docs/renamed.md","status":"renamed",
                  "previous_filename":path}])[1])
        self.assertFalse(qa.protected_paths(
            [{"filename":"src/features/project-card.tsx","status":"modified"}])[1])

    def test_high_import_and_export_no_low_disguise(self):
        for path in ("src/contracts/import.ts",
                     "src/server/imports/project-import-service-core.ts",
                     "src/server/exports/project-export-service.ts",
                     "db/migrations/0022_task_milestone_memberships.sql",
                     "src/features/gantt/scheduling.ts"):
            self.assertEqual(qa.risk_floor({path}), "HIGH", path)
        self.assertEqual(qa.risk_floor({"src/app/api/projects/route.ts"}), "HIGH")
        self.assertEqual(qa.risk_floor({"docs/README.md"}), "LOW")

    def test_high_import_low_pr_is_rejected(self):
        from unittest.mock import patch
        class Stub:
            prefix="/repos/planner77/masterGantt"
            def get(self,url):
                if "/pulls/" in url:
                    return {"title":"[Issue #580] 위험도 위장",
                            "body":"Refs #580\nrisk_level: LOW\nqa_method: AUTOMATED_MANAGER"}
                return {}
            def pages(self,url):
                if "/files" in url:
                    return [{"filename":"src/contracts/import.ts","status":"modified"}]
                return []
        env={"GITHUB_EVENT_NAME":"pull_request","PR_NUMBER":"587",
             "GITHUB_RUN_ID":"100","METADATA_ONLY":"false"}
        with patch.object(qa,"snapshot"), patch.object(qa,"evidence",return_value={}):
            self.blocked(lambda: qa.check(env, {}, Stub()))

    def test_domain_documents_union_and_missing_contract(self):
        paths={"db/migrations/0022_task_milestone_memberships.sql",
               "src/app/api/projects/route.ts",
               "src/server/imports/project-import-service-core.ts",
               "src/lib/scheduling.ts",
               "docs/TEST_PLAN.md"}
        required=qa.docs_required(paths)
        for document in ("DESIGN.md", "docs/TEST_PLAN.md", "docs/DB_SCHEMA.md",
                         "docs/API.md", "docs/SCHEDULING_ENGINE.md",
                         "docs/IMPORT_EXPORT.md", "docs/IMPORT_SCHEMA.md"):
            self.assertIn(document, required)
        plan=("## DOCUMENTATION_SYNC\n"
              "- \x60DESIGN.md\x60: N/A(이 PR은 구조 검증만 수행하며 UI 설계를 변경하지 않습니다)\n"
              "- \x60docs/TEST_PLAN.md\x60: UPDATED\n"
              "- \x60docs/DB_SCHEMA.md\x60: N/A(기존 DB 계약 그대로 유지하는 테스트 범위)\n"
              "## AC_TEST_COVERAGE\n- AC1: tests/domain/test_example.py 검증 예정\n")
        self.blocked(lambda:qa.docs_gate(plan,paths,{"AC1"}))

    def test_agent_instruction_files_always_protected(self):
        """Fifth-head P1: all agent instructions, not just infra.toml."""
        for path in (".codex/agents/qa-docs.toml",
                     ".codex/agents/infra.toml",
                     ".codex/agents/frontend.toml",
                     ".codex/agents/ui-ux.toml",
                     ".codex/agents/new-reviewer.toml",
                     ".codex/config.toml"):
            changed=[{"filename":path,"status":"modified"}]
            self.assertIn(path, qa.protected_paths(changed)[1])
            self.assertEqual("HIGH",qa.risk_floor({path}))
            renamed=[{"filename":"docs/safe.md","previous_filename":path,
                      "status":"renamed"}]
            self.assertIn(path,qa.protected_paths(renamed)[1])

    def test_auth_repository_is_high_even_without_security_filename(self):
        """Project repository hashes password/session tokens; filename alone must not downgrade."""
        for path in ("src/server/repositories/project-repository-core.ts",
                     "src/server/repositories/project-repository.ts",
                     "src/server/services/project-service.ts",
                     "src/server/auth/project-access.ts",
                     "src/server/db/project-db.ts",
                     "src/app/api/projects/route.ts"):
            self.assertEqual("HIGH", qa.risk_floor({path}), path)
        self.assertEqual("HIGH",qa.risk_floor(
            {"src/server/repositories/project-repository-core.ts",
             "docs/TEST_PLAN.md"}))

    def test_auth_repository_medium_risk_downgrade_blocked(self):
        from unittest.mock import patch
        class Stub:
            prefix="/repos/planner77/masterGantt"
            def get(self,url):
                if "/pulls/" in url:
                    return {"title":"[Issue #580] auth downgrade",
                            "body":"Refs #580\nrisk_level: MEDIUM\nqa_method: AUTOMATED_MANAGER"}
                return {}
            def pages(self,url):
                if "/files" in url:
                    return [{"filename":"src/server/repositories/project-repository-core.ts",
                             "status":"modified"}]
                return []
        with patch.object(qa,"snapshot"),patch.object(qa,"evidence",return_value={}):
            self.blocked(lambda: qa.check(
                {"GITHUB_EVENT_NAME":"pull_request","PR_NUMBER":"587",
                 "GITHUB_RUN_ID":"100","METADATA_ONLY":"false"}, {}, Stub()))

    def test_shared_public_contract_always_requires_api_documentation(self):
        """Public project DTO changes cannot structurally PASS without docs/API.md."""
        for path in ("src/contracts/projects.ts",
                     "src/contracts/resources.ts",
                     "src/server/services/project-service-core.ts",
                     "src/app/api/projects/route.ts"):
            self.assertIn("docs/API.md",qa.docs_required({path}),path)
        paths={"src/contracts/projects.ts","db/migrations/0022_x.sql",
               "src/server/repositories/project-repository-core.ts"}
        self.assertTrue({"docs/API.md","docs/DB_SCHEMA.md","DESIGN.md",
                         "docs/TEST_PLAN.md"} <= qa.docs_required(paths))
        plan=("## DOCUMENTATION_SYNC\n"
              "- \x60DESIGN.md\x60: N/A(테스트 목적이며 공개 화면 구조를 변경하지 않음)\n"
              "- \x60docs/TEST_PLAN.md\x60: UPDATED\n"
              "- \x60docs/DB_SCHEMA.md\x60: N/A(스키마 불변을 확인한 테스트 변경만 해당)\n"
              "## AC_TEST_COVERAGE\n- AC1: test_shared_public_contract_always_requires_api_documentation\n")
        self.blocked(lambda:qa.docs_gate(plan,paths,{"AC1"}))

    def test_real_project_services_are_high_and_require_api_docs(self):
        """Real project topology is domain-rooted, not src/server/services/."""
        for path in ("src/server/projects/project-service-core.ts",
                     "src/server/templates/project-template-service-core.ts",
                     "src/server/resources/resource-catalog-service-core.ts",
                     "src/server/projects/project-service.ts",
                     "src/server/repositories/project-repository-core.ts",
                     "src/server/arbitrary/future-service.ts"):
            self.assertEqual("HIGH", qa.risk_floor({path}), path)
            self.assertIn("docs/API.md", qa.docs_required({path}), path)
        combined={"src/server/projects/project-service-core.ts",
                  "src/contracts/projects.ts",
                  "db/migrations/0022_task_milestone_memberships.sql"}
        self.assertTrue({"docs/API.md", "docs/DB_SCHEMA.md", "docs/TEST_PLAN.md"}
                        <= qa.docs_required(combined))

    def test_next_env_declaration_is_protected_even_on_rename(self):
        """Ambient TypeScript declarations are a trusted typecheck input."""
        for path in ("next-env.d.ts", "global.d.ts", "env.d.ts", "types.d.ts"):
            self.assertIn(path, qa.protected_paths(
                [{"filename":path,"status":"modified"}])[1])
            self.assertIn(path, qa.protected_paths(
                [{"filename":"docs/old-declaration.md","previous_filename":path,
                  "status":"renamed"}])[1])
            self.assertEqual("HIGH", qa.risk_floor({path}))

    def test_composite_action_pr_is_not_automatically_accepted(self):
        """Protected CI execution input remains HIGH; automated QA is never Owner ACCEPT."""
        from unittest.mock import patch
        path=".github/actions/node-setup/action.yml"
        self.assertIn(path, qa.protected_paths(
            [{"filename":path,"status":"modified"}])[1])
        self.assertEqual(qa.risk_floor({path}), "HIGH")

        class Stub:
            prefix="/repos/planner77/masterGantt"
            risk="HIGH"
            def get(self, url):
                if "/pulls/" in url:
                    return {"title":"[Issue #580] 변경",
                            "body":"Refs #580\nrisk_level: "+self.risk+
                                   "\nqa_method: OWNER_MANAGED"}
                if "/issues/" in url:
                    return {"body":"AC1"}
                return {}
            def pages(self, url):
                if url.endswith("/files"):
                    return [{"filename":path,"status":"modified"}]
                return []
            def open_threads(self, number):
                return 0
            def head_text(self, *args):
                return "docs gate mocked; no external contents loaded"

        env={"GITHUB_EVENT_NAME":"pull_request","PR_NUMBER":"587",
             "GITHUB_RUN_ID":"100","GITHUB_RUN_ATTEMPT":"1",
             "EVENT_HEAD_SHA":"a"*40,"EVENT_BASE_SHA":"b"*40,
             "TEST_MERGE_SHA":"c"*40,"METADATA_ONLY":"false"}
        stub=Stub()
        with (patch.object(qa,"snapshot"),
              patch.object(qa,"evidence",return_value={}),
              patch.object(qa,"docs_gate",return_value={})):
            result=qa.check(env,{},stub)
            self.assertEqual(result["automated_qa"],"PASS")
            self.assertEqual(result["risk_level"],"HIGH")
            self.assertIn(path, result["protected_paths"])
            self.assertEqual(result["manager_decision"],"NOT TESTED")
            self.assertIn("N/A(", result["independent_qa"])
            stub.risk="LOW"
            self.blocked(lambda: qa.check(env,{},stub))

    def test_source_artifact_association_rejects_ambiguous_prs(self):
        from unittest.mock import patch
        class Stub:
            prefix="/repos/planner77/masterGantt"
            repo="planner77/masterGantt"
            def get(self, route):
                return {"number":593,"state":"open","head":{"sha":"a"*40,"ref":"ci/issue-593-x",
                                "repo":{"full_name":"planner77/masterGantt"}},
                        "base":{"sha":"b"*40,"ref":"main",
                                "repo":{"full_name":"planner77/masterGantt"}},
                        "merge_commit_sha":"c"*40}
            def pages(self, route):
                return [{"number":593}]
        source={"schema":"mastergantt-ci-pr-source-v1","repository":Stub.repo,
                "run_id":17,"run_attempt":2,"pr_number":593,
                "head_sha":"a"*40,"base_sha":"b"*40,"test_merge_sha":"c"*40,
                "base_ref":"main","head_ref":"ci/issue-593-x",
                "head_repository":Stub.repo,"base_repository":Stub.repo}
        run={"id":17,"run_attempt":2,"head_sha":"a"*40,
             "head_branch":"ci/issue-593-x","pull_requests":[]}
        self.assertEqual(qa.verified_source(Stub(),run,source)[0],593)
        class Fork(Stub):
            def get(self, route):
                pr = super().get(route)
                pr["head"]["repo"] = {"full_name":"external/masterGantt"}
                return pr
        fork_source = {**source, "head_repository":"external/masterGantt"}
        self.assertEqual(qa.verified_source(Fork(),run,fork_source)[0],593)
        self.blocked(lambda:qa.verified_source(Stub(),run,fork_source))
        self.blocked(lambda:qa.verified_source(Fork(),run,source))
        self.blocked(lambda:qa.verified_source(Fork(),run,
            {**fork_source,"base_repository":"external/masterGantt"}))
        for changed in ({"run_attempt":1},{"pr_number":594},{"base_sha":"d"*40},
                        {"test_merge_sha":"d"*40},{"head_sha":"d"*40}):
            self.blocked(lambda:qa.verified_source(Stub(),run,{**source,**changed}))
        self.blocked(lambda:qa.verified_source(Stub(),
            {**run,"pull_requests":[{"number":593},{"number":594}]},source))
        class Many(Stub):
            def pages(self,route): return [{"number":593},{"number":594}]
        self.blocked(lambda:qa.verified_source(Many(),run,source))
        class NoneFound(Stub):
            def pages(self,route): return []
        self.blocked(lambda:qa.verified_source(NoneFound(),run,source))

    def test_blocked_report_uses_current_rule_version(self):
        from pathlib import Path
        import tempfile
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(qa, "GitHub", side_effect=qa.Blocked("BLOCKED", "API 부재")), \
                 patch.dict(qa.os.environ, {"GITHUB_EVENT_PATH":str(Path(tmp)/"event.json"),
                                            "GITHUB_REPOSITORY":"planner77/masterGantt",
                                            "GITHUB_EVENT_NAME":"pull_request"}):
                Path(tmp,"event.json").write_text("{}",encoding="utf-8")
                current=Path.cwd()
                try:
                    qa.os.chdir(tmp)
                    self.assertEqual(qa.main(),1)
                    report=qa.json.loads(Path("qa-final-automated-report.json").read_text())
                    self.assertEqual(report["rule_version"],"598-593-v1")
                    self.assertEqual(report["automated_qa"],"BLOCKED")
                finally:
                    qa.os.chdir(current)

    def test_validator_revision_immutable(self):
        self.assertEqual(qa.validate_validator_sha("a"*40,"a"*40),"a"*40)
        self.blocked(lambda: qa.validate_validator_sha("a"*40,"b"*40))
        self.blocked(lambda: qa.validate_validator_sha("main","main"))

    def test_low_medium_high_merge_readiness(self):
        params={"protected":False,"doc_sync":True,"ci_pass":True,
                "reviewed":True,"independent":"NOT TESTED",
                "trusted_qa":"PASS","manager":"ACCEPT",
                "high_checklist":True,"risk_accepted":True}
        for risk in ("LOW","MEDIUM","HIGH"):
            self.assertEqual("MERGE_READY", qa.manual_merge_readiness(
                risk=risk,method="AUTOMATED_MANAGER",**params))
        for risk in ("LOW","MEDIUM","HIGH"):
            self.blocked(lambda:qa.manual_merge_readiness(
                risk=risk,method="AUTOMATED_MANAGER",
                **{**params,"manager":"NOT TESTED"}))
        self.blocked(lambda:qa.manual_merge_readiness(
            risk="HIGH",method="AUTOMATED_MANAGER",
            **{**params,"high_checklist":False}))
        self.blocked(lambda:qa.manual_merge_readiness(
            risk="HIGH",method="AUTOMATED_MANAGER",
            **{**params,"risk_accepted":False}))
        self.blocked(lambda:qa.manual_merge_readiness(
            risk="MEDIUM",method="AUTOMATED_MANAGER",
            **{**params,"trusted_qa":"NOT TESTED"}))
        self.assertEqual("MERGE_READY", qa.manual_merge_readiness(
            risk="HIGH",method="OWNER_MANAGED",
            **{**params,"protected":True}))
        self.blocked(lambda:qa.manual_merge_readiness(
            risk="HIGH",method="OWNER_MANAGED",
            **{**params,"protected":True,"trusted_qa":"BLOCKED"}))
        self.assertEqual("MERGE_READY",qa.manual_merge_readiness(
            risk="HIGH",method="AGENT",
            **{**params,"independent":"PASS","protected":True}))
        self.blocked(lambda:qa.manual_merge_readiness(
            risk="HIGH",method="AGENT",**params))

    def protected_agent_fixture(self):
        import json
        head, base = "a"*40, "b"*40
        pr = {"user":{"login":"planner77"}}
        env = {"EVENT_HEAD_SHA":head, "EVENT_BASE_SHA":base,
               "GITHUB_RUN_ID":"100", "GITHUB_RUN_ATTEMPT":"2"}
        review = {"id":19, "submitted_at":"2026-10-10T10:05:00Z",
                  "commit_id":head, "state":"APPROVED",
                  "user":{"login":"external-reviewer","type":"User"},
                  "author_association":"COLLABORATOR",
                  "body":"QA_FINAL: PASS\nI independently checked AC requirements, source changes, tests, documentation and security evidence."}
        receipt = {"authorized":True,"head_sha":head,"base_sha":base,
                   "pr":559,"issue":550,"qa_review_id":19,"ci_run_id":100,
                   "ci_attempt":1,"residual_risk_accepted":True,
                   "reason":"Human reviewer checked exact Head and the three required CI jobs. Manager accepts remaining UX risk."}
        comment = {"id":80, "created_at":"2026-10-10T10:09:00Z",
                   "user":{"login":"planner77","type":"User"},
                   "body":"<!-- mastergantt-protected-qa-accept:v1 " +
                          json.dumps(receipt, separators=(",",":")) + " -->"}
        jobs = [{"name":name,"conclusion":"success",
                 "completed_at":"2026-10-10T10:06:00Z"}
                for name in ("Build, static checks, and unit tests",
                             "Chromium end-to-end tests",
                             "Docker build and runtime smoke test")]

        class Stub:
            prefix="/repos/planner77/masterGantt"
            def get(self, path):
                assert path == self.prefix, path
                return {"owner":{"login":"planner77"}}
            def pages(self, path):
                assert path == self.prefix+"/issues/559/comments", path
                return self.comments
            def collection(self, path, name):
                assert path == self.prefix+"/actions/runs/100/attempts/1/jobs", path
                assert name == "jobs"
                return self.jobs
        stub=Stub()
        stub.comments=[comment]
        stub.jobs=jobs
        return stub, pr, env, [review], receipt

    def test_protected_agent_requires_independent_review_and_owner_accept(self):
        stub, pr, env, reviews, receipt = self.protected_agent_fixture()
        result=qa.verify_protected_agent_approval(stub,559,550,pr,env,reviews)
        self.assertEqual(result["independent_qa"],"PASS")
        self.assertEqual(result["manager_decision"],"ACCEPT")
        self.assertEqual(result["qa_review_id"],19)
        self.assertEqual(result["manager_receipt_comment_id"],80)
        self.assertEqual(result["protected_ci_attempt"],1)
        self.assertIn("원본 세 필수 CI",result["decision_reason"])
        for mutate in ("missing_review","same_author","bot","stale_head",
                       "outsider","no_attestation","comment_only","wrong_review",
                       "missing_manager","wrong_manager","stale_base","risk_not_accepted",
                       "short_reason","manager_before_jobs","wrong_ci",
                       "failed_required_ci","future_attempt","unresolved_changes"):
            stub, pr, env, reviews, receipt = self.protected_agent_fixture()
            review=reviews[0]
            if mutate=="missing_review": reviews=[]
            if mutate=="same_author": review["user"]["login"]="planner77"
            if mutate=="bot": review["user"]["type"]="Bot"
            if mutate=="stale_head": review["commit_id"]="f"*40
            if mutate=="outsider": review["author_association"]="NONE"
            if mutate=="no_attestation": review["body"]="LGTM"
            if mutate=="comment_only": review["state"]="COMMENTED"
            if mutate=="wrong_review":
                stub.comments[0]["body"]=stub.comments[0]["body"].replace(
                    '"qa_review_id":19','"qa_review_id":999')
            if mutate=="missing_manager": stub.comments=[]
            if mutate=="wrong_manager": stub.comments[0]["user"]["login"]="unknown"
            if mutate=="stale_base":
                stub.comments[0]["body"]=stub.comments[0]["body"].replace(
                    '"base_sha":"' + "b"*40 + '"','"base_sha":"' + "c"*40 + '"')
            if mutate=="risk_not_accepted":
                stub.comments[0]["body"]=stub.comments[0]["body"].replace(
                    '"residual_risk_accepted":true','"residual_risk_accepted":false')
            if mutate=="short_reason":
                import json
                data = dict(receipt)
                data["reason"]="ok"
                stub.comments[0]["body"]="<!-- mastergantt-protected-qa-accept:v1 "+json.dumps(data)+" -->"
            if mutate=="manager_before_jobs":
                stub.comments[0]["created_at"]="2026-10-10T10:05:30Z"
            if mutate=="wrong_ci":
                stub.comments[0]["body"]=stub.comments[0]["body"].replace(
                    '"ci_run_id":100','"ci_run_id":101')
            if mutate=="failed_required_ci": stub.jobs[0]["conclusion"]="failure"
            if mutate=="future_attempt": env["GITHUB_RUN_ATTEMPT"]="0"
            if mutate=="unresolved_changes":
                reviews.append({"id":20,"submitted_at":"2026-10-10T10:08:00Z",
                                "state":"CHANGES_REQUESTED",
                                "user":{"login":"second-reviewer","type":"User"}})
            with self.subTest(mutate=mutate):
                self.blocked(lambda:qa.verify_protected_agent_approval(
                    stub,559,550,pr,env,reviews))

    def test_owner_managed_protected_path_and_legacy_alias(self):
        from unittest.mock import patch
        self.assertIn("package.json", qa.protected_paths(
            [{"filename":"package.json","status":"modified"}])[1])
        self.assertEqual("HIGH", qa.risk_floor({"package.json"}))
        class Stub:
            prefix="/repos/planner77/masterGantt"
            method="OWNER_MANAGED"
            def get(self, path):
                if "/pulls/" in path:
                    return {"title":"[Issue #598] owner policy",
                            "body":"Refs #598\nrisk_level: HIGH\nqa_method: "+self.method}
                if "/issues/" in path:
                    return {"body":"AC1 AC2"}
                return {}
            def pages(self,path):
                if path.endswith("/files"):
                    return [{"filename":"package.json","status":"modified"}]
                return []
            def open_threads(self,n):
                return 0
            def head_text(self,*args):
                return "not used: mocked docs gate"
        env={"GITHUB_EVENT_NAME":"pull_request","PR_NUMBER":"598",
             "GITHUB_RUN_ID":"100","GITHUB_RUN_ATTEMPT":"1",
             "EVENT_HEAD_SHA":"a"*40,"EVENT_BASE_SHA":"b"*40,
             "TEST_MERGE_SHA":"c"*40,"METADATA_ONLY":"false"}
        stub=Stub()
        with patch.object(qa,"snapshot"), patch.object(qa,"evidence",return_value={}), \
             patch.object(qa,"docs_gate",return_value={}):
            for method in ("OWNER_MANAGED","AUTOMATED_MANAGER"):
                stub.method=method
                result=qa.check(env,{},stub)
                self.assertEqual(result["automated_qa"],"PASS")
                self.assertEqual(result["qa_method"],"OWNER_MANAGED")
                self.assertEqual(result["manager_decision"],"NOT TESTED")
                self.assertIn("N/A(",result["independent_qa"])

    def test_owner_managed_no_bypass_of_required_or_high_checks(self):
        params=dict(risk="HIGH",method="OWNER_MANAGED",protected=True,
                    doc_sync=True,ci_pass=True,reviewed=True,independent="N/A",
                    trusted_qa="PASS",manager="ACCEPT",high_checklist=True,
                    risk_accepted=True)
        for override in ({"ci_pass":False},{"reviewed":False},{"manager":"NOT TESTED"},
                         {"trusted_qa":"FAIL"},{"high_checklist":False},
                         {"risk_accepted":False}):
            self.blocked(lambda:qa.manual_merge_readiness(**{**params,**override}))

    def test_policy_ci_executes_qa_python_tests(self):
        from pathlib import Path
        workflow=(Path(__file__).resolve().parents[1]/".github/workflows/ci.yml").read_text()
        policy=workflow.split("\n  policy:",1)[1].split("\n  typecheck:",1)[0]
        self.assertIn("python3 scripts/test_qa_final_automated.py",policy)


if __name__=="__main__":
    unittest.main(verbosity=2)
