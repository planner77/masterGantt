#!/usr/bin/env python3
"""Issue #752: bounded provenance, non-authoritative reporting, and negative replay."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import issue_752_diagnostics as d


HEAD = "a"*40
BASE = "b"*40
MERGE = "c"*40


def row(run_id, attempt, head=HEAD, status="FAILED"):
    return {"runId":run_id, "attempt":attempt, "headSha":head, "baseSha":BASE,
            "testMergeSha":MERGE, "status":status, "shards":[],"roots":[]}


class IdentityAndHistory(unittest.TestCase):
    def test_single_canonical_issue(self):
        self.assertEqual(d.issue_from_pr({"title":"Issue #752: implementation",
                                          "body":"Refs #752\n"}),752)
        for body in ("Refs #753\n", "Refs #752\nRefs #752\n", "hello Refs #752"):
            with self.subTest(body=body), self.assertRaises(d.EvidenceError):
                d.issue_from_pr({"title":"Issue #752: implementation", "body":body})

    def test_two_distinct_full_failures_and_stale_head(self):
        rows=[row(3001,1,"d"*40),row(3003,1)]
        self.assertTrue(d.classify(rows,HEAD,3003,1)["recommended"])
        self.assertEqual(d.classify(rows,HEAD,3001,1)["status"],"NOT_RECOMMENDED")
        self.assertEqual(d.classify(rows,HEAD,3003,2)["status"],"NOT_RECOMMENDED")
        self.assertFalse(d.classify([rows[1]],HEAD,3003,1)["recommended"])

    def test_cancelled_derived_and_metadata_are_not_direct_failures(self):
        jobs={
            d.META:{"conclusion":"skipped"},
            d.PREFLIGHT:{"conclusion":"success"},
            "Chromium E2E shard 1/8 · PR":{"conclusion":"cancelled", "started_at":"2026-10-20T00:00:00Z",
                                          "completed_at":"2026-10-20T00:34:59Z","id":1},
            "Chromium end-to-end tests":{"conclusion":"failure"},
        }
        state,roots,shards=d.attempt_status(jobs)
        self.assertEqual((state,roots),("CANCELLED", []))
        self.assertEqual(len(shards),1)
        self.assertEqual(shards[0]["conclusion"],"cancelled")
        jobs[d.META]["conclusion"]="success"
        self.assertEqual(d.attempt_status(jobs)[0],"METADATA_OR_DRAFT")

    def test_one_direct_root_not_three_aggregate_failures(self):
        jobs={d.META:{"conclusion":"skipped"},
              d.PREFLIGHT:{"conclusion":"failure"},
              d.FAST_GATE:{"conclusion":"failure"},
              **{key:{"conclusion":"failure"} for key in d.AGGREGATES}}
        state,roots,_=d.attempt_status(jobs)
        self.assertEqual(state,"FAILED")
        self.assertEqual([x["job"] for x in roots],[d.PREFLIGHT])

    def test_historical_source_check_against_attempt_merge(self):
        class GH:
            repo="planner77/masterGantt"
            prefix="/repos/planner77/masterGantt"
            def get(self,route):
                return {"parents":[{"sha":BASE},{"sha":HEAD}]} if route.endswith(MERGE) else {}
        payload={"schema":"mastergantt-ci-pr-source-v1","repository":GH.repo,
                 "run_id":393933,"run_attempt":1,"pr_number":747,
                 "head_sha":HEAD,"base_sha":BASE,"test_merge_sha":MERGE,
                 "base_repository":GH.repo,"base_ref":"main",
                 "head_repository":GH.repo,"head_ref":"feature"}
        run={"id":393933,"event":"pull_request",
             "path":".github/workflows/ci.yml@refs/heads/main",
             "head_sha":MERGE,"head_branch":"feature",
             "repository":{"full_name":GH.repo}}
        with patch.object(d.qa,"source_artifact",return_value=payload):
            self.assertEqual(d.authentic_source(GH(),run,1,pr_number=747)["head_sha"],HEAD)
            run["head_sha"]="0"*40
            with self.assertRaises(d.EvidenceError):
                d.authentic_source(GH(),run,1,pr_number=747)

    def test_sanitize_file_selection_and_path_traversal_rejection(self):
        a="tests/e2e/issue-623-resource-mvp.spec.ts"
        b="tests/e2e/milestone-dashboard-state.spec.ts"
        ordered,parts=d.select_files([a],[b])
        self.assertEqual(ordered,sorted([a,b]))
        self.assertEqual(sum(map(len,parts)),2)
        with self.assertRaises(d.EvidenceError):
            d.select_files([a],["tests/e2e/../evil.spec.ts"])
        with self.assertRaises(d.EvidenceError):
            d.select_files([],[])
        self.assertEqual(d.parse_ledger("historical "+a+"\n"+a),[a])

    def test_p50_p95_cancelled_rate_observation_not_ci_pass(self):
        history=[{"shards":[{"name":"Chromium E2E shard 1/8 · PR",
                             "conclusion":"cancelled" if i==0 else "success",
                             "minutes":i+1}]} for i in range(4)]
        s=d.performance(history)["Chromium E2E shard 1/8 · PR"]
        self.assertEqual(s["p50Minutes"],2)
        self.assertEqual(s["p95Minutes"],4)
        self.assertEqual(s["cancelledRate"],.25)

    def test_stale_live_source_is_blocked(self):
        old={"headSha":HEAD,"baseSha":BASE,"testMergeSha":MERGE}
        pr={"state":"open","head":{"sha":"0"*40},"base":{"sha":BASE},
            "merge_commit_sha":MERGE}
        with self.assertRaises(d.EvidenceError):
            d.ensure_current(pr,old)



    def test_report_spec_paths_are_restricted_and_relative_paths_are_preserved(self):
        allow={"tests/e2e/example.spec.ts","tests/e2e/sub/nested.spec.ts"}
        for source in ("example.spec.ts", "tests/e2e/example.spec.ts",
                       "/home/runner/work/masterGantt/tests/e2e/example.spec.ts",
                       "./tests/e2e/example.spec.ts"):
            with self.subTest(source=source):
                self.assertEqual(d.normalize_report_spec(source,allow),
                                 "tests/e2e/example.spec.ts")
        self.assertEqual(d.normalize_report_spec("sub/nested.spec.ts",allow),
                         "tests/e2e/sub/nested.spec.ts")
        for unsafe in ("../evil.spec.ts","tests/e2e/../evil.spec.ts",
                       "/etc/evil.spec.ts","tests/e2e/not-selected.spec.ts"):
            with self.subTest(unsafe=unsafe):
                self.assertIsNone(d.normalize_report_spec(unsafe,allow))

    def test_branch_filter_prevents_repository_wide_false_truncation(self):
        branch="feat/issue-752-ci-diagnostics"
        class GH:
            repo="planner77/masterGantt"
            prefix="/repos/planner77/masterGantt"
            def __init__(self):
                self.calls=[]
            def get(self,route):
                self.calls.append(route)
                return {"total_count":2,"workflow_runs":[
                    {"id":100,"run_attempt":1,"head_branch":branch,"status":"completed"},
                    {"id":101,"run_attempt":1,"head_branch":branch,"status":"completed"}]}
        source={"head_sha":HEAD,"base_sha":BASE,"test_merge_sha":MERGE}
        jobs={d.META:{"conclusion":"skipped"},d.PREFLIGHT:{"conclusion":"failure"}}
        gh=GH()
        with patch.object(d,"authentic_source",return_value=source), patch.object(d,"attempt_jobs",return_value=jobs):
            history,unverified,truncated=d.collect_history(gh,{"head":{"ref":branch},"number":780})
        self.assertEqual((len(history),unverified,truncated),(2,[],False))
        self.assertEqual(len(gh.calls),1)
        self.assertIn("branch=feat%2Fissue-752-ci-diagnostics",gh.calls[0])

    def test_qa_final_review_block_is_not_independent_full_test_failure(self):
        jobs={d.META:{"conclusion":"skipped"},
              d.PREFLIGHT:{"conclusion":"success"},
              "QA Final — Automated":{"conclusion":"failure"},
              **{key:{"conclusion":"success"} for key in d.AGGREGATES}}
        self.assertEqual(d.attempt_status(jobs)[0:2],("NOT_FAILED",[]))

    def test_latest_ledger_is_read_from_frozen_pr_head(self):
        repo="planner77/masterGantt"
        pr={"number":780,"state":"open","title":"Issue #752 — 진단",
            "body":"Refs #752","head":{"sha":HEAD,"ref":"feat/issue-752","repo":{"full_name":repo}},
            "base":{"sha":BASE,"ref":"main","repo":{"full_name":repo}},
            "merge_commit_sha":MERGE}
        class GH:
            repo="planner77/masterGantt"
            prefix="/repos/planner77/masterGantt"
            def get(self,route):
                return pr
        history=[row(100,1),row(101,1)]
        with patch.object(d,"authorized_actor"), patch.object(d,"collect_history",return_value=(history,[],False)), \
             patch.object(d,"ledger_text",return_value="tests/e2e/example.spec.ts") as ledger, \
             patch.object(d,"changed_files",return_value=[]):
            plan=d.prepare(GH(),780,752,HEAD,"planner77","refs/heads/main")
        self.assertEqual(ledger.call_args.args[1:],(752,HEAD))
        self.assertEqual(plan["files"],["tests/e2e/example.spec.ts"])

    def test_workflow_displays_korean_without_changing_machine_identifiers(self):
        workflow=(Path(__file__).resolve().parents[2]/".github/workflows/issue-752-diagnostics.yml").read_text(encoding="utf-8")
        self.assertIn('name: "Issue #752 — 반복 PR 실패 진단"',workflow)
        self.assertIn("name: 누적 실패 집합 실행",workflow)
        self.assertIn("  bounded_e2e:",workflow)
        self.assertIn("fail-fast: false",workflow)
        self.assertIn("--retries=0 --max-failures=0",workflow)
        self.assertIn('file="tests/e2e/"+file',workflow)
        self.assertIn("$RUNNER_TEMP/issue-752-raw-$PART.json",workflow)
        self.assertNotIn("$GITHUB_WORKSPACE/part-$PART/playwright.json",workflow)


    def test_patched_next_runtime_manifest_matches_immutable_npm_lock(self):
        root=Path(__file__).resolve().parents[2]
        pkg=json.loads((root/"package.json").read_text(encoding="utf-8"))
        lock=json.loads((root/"package-lock.json").read_text(encoding="utf-8"))
        pinned=pkg["dependencies"]["next"]
        major,minor,patch_version=map(int,pinned.split("."))
        self.assertGreaterEqual((major,minor,patch_version),(16,4,1),
                                "Next.js must include October 2026 security patches")
        self.assertEqual(pkg["dependencies"]["@next/env"],pinned)
        self.assertEqual(lock["packages"][""]["dependencies"]["next"],pinned)
        self.assertEqual(lock["packages"][""]["dependencies"]["@next/env"],pinned)
        self.assertEqual(lock["packages"]["node_modules/next"]["version"],pinned)
        self.assertEqual(lock["packages"]["node_modules/@next/env"]["version"],pinned)
        self.assertEqual(lock["packages"]["node_modules/next"]["dependencies"]["@next/env"],pinned)
        swc={name:v for name,v in lock["packages"].items()
             if name.startswith("node_modules/@next/swc-")}
        self.assertGreaterEqual(len(swc),6)
        for name,meta in swc.items():
            self.assertEqual(meta["version"],pinned,name)
            key=name.removeprefix("node_modules/")
            self.assertEqual(lock["packages"]["node_modules/next"]["optionalDependencies"][key],pinned)
        self.assertEqual(lock["packages"]["node_modules/next"]["optionalDependencies"]["sharp"],
                         "^0.35.5")
        sharp=tuple(map(int,lock["packages"]["node_modules/sharp"]["version"].split(".")))
        self.assertGreaterEqual(sharp,(0,35,5))


class BoundReports(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.plan={"status":"APPROVED_BOUNDED_DIAGNOSIS",
                   "issue":752,"pr":779,"repo":"planner77/masterGantt",
                   "headSha":HEAD,"baseSha":BASE,"testMergeSha":MERGE,
                   "sourceRunId":3003,"sourceAttempt":1,
                   "runKey":"779:"+HEAD+":f00ba1",
                   "history":[row(3001,1),row(3003,1)],
                   "files":["tests/e2e/a.spec.ts"],
                   "historicalFiles":["tests/e2e/a.spec.ts"],
                   "parts":[["tests/e2e/a.spec.ts"],[],[],[]]}
        self.gh=type("GH",(),{"prefix":"/repos/planner77/masterGantt",
                              "repo":"planner77/masterGantt",
                              "get":lambda _,path:{"state":"open","head":{"sha":HEAD},
                                                     "base":{"sha":BASE},"merge_commit_sha":MERGE}})()

    def test_missing_worker_is_incomplete_without_double_count(self):
        r=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(r["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertEqual(r["counts"]["NOT RUN"],1)
        self.assertIn("PART_0_MISSING",r["missing"])

    def test_valid_redacted_worker_result_never_claims_ci_pass(self):
        target=self.root/"part-0"
        target.mkdir()
        spec="tests/e2e/a.spec.ts"
        (target/"execution.json").write_text(json.dumps({
            "part":0,"headSha":HEAD,"diagnosisRunId":44,"files":[spec],"exitCode":1}))
        (target/"playwright.json").write_text(json.dumps({"suites":[{
            "file":spec,"specs":[{"tests":[{"id":"case-1","results":[
                {"status":"failed","duration":34,"error":{"message":"secret token"}},
            ]}]}]}]}))
        r=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(r["status"],"DIAGNOSIS_READY")
        self.assertEqual(r["crossRun"][0]["status"],"RECURRING")
        self.assertEqual(r["counts"]["FAIL"],1)
        self.assertNotIn("secret",json.dumps(r))
        self.assertTrue(r["notAnApproval"])


    def test_one_missing_selected_spec_blocks_ready(self):
        a,b="tests/e2e/a.spec.ts","tests/e2e/b.spec.ts"
        self.plan["files"]=[a,b]
        self.plan["parts"]=[[a,b],[],[],[]]
        target=self.root/"part-0"
        target.mkdir()
        (target/"execution.json").write_text(json.dumps({
            "part":0,"headSha":HEAD,"diagnosisRunId":44,"files":[a,b],"exitCode":0}))
        (target/"playwright.json").write_text(json.dumps({"suites":[{
            "file":"a.spec.ts","specs":[{"tests":[{"id":"case-1","results":[
                {"status":"passed","duration":10}]}]}]}]}))
        result=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(result["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertEqual(result["counts"]["NOT RUN"],1)
        self.assertIn(f"SPEC_NOT_OBSERVED:{b}",result["missing"])

    def test_skipped_only_spec_is_incomplete(self):
        a="tests/e2e/a.spec.ts"
        target=self.root/"part-0"
        target.mkdir()
        (target/"execution.json").write_text(json.dumps({
            "part":0,"headSha":HEAD,"diagnosisRunId":44,"files":[a],"exitCode":0}))
        (target/"playwright.json").write_text(json.dumps({"suites":[{
            "file":"a.spec.ts","specs":[{"tests":[{"id":"skipped","results":[
                {"status":"skipped","duration":0}]}]}]}]}))
        result=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(result["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertIn(f"SPEC_NOT_FULLY_EXECUTED:{a}",result["missing"])

    def test_nested_relative_spec_report_keeps_file_and_discards_error_details(self):
        path=self.root/"nested-playwright.json"
        path.write_text(json.dumps({"suites":[{"suites":[{
            "file":"a.spec.ts","specs":[{"tests":[{"id":"suite:case-1",
                "results":[{"status":"failed","duration":25,
                            "error":{"message":"secret-token-value"},
                            "attachments":[{"name":"trace","path":"/tmp/sensitive.zip"}]}]}]}]}]}]}))
        rows=d.parse_worker_report(path,{"tests/e2e/a.spec.ts"})
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["file"],"tests/e2e/a.spec.ts")
        self.assertEqual(rows[0]["status"],"failed")
        self.assertNotIn("secret",json.dumps(rows))
        self.assertNotIn("sensitive",json.dumps(rows))

    def test_invalid_worker_provenance_is_not_green(self):
        t=self.root/"part-0"
        t.mkdir()
        (t/"execution.json").write_text(json.dumps({
            "part":0,"headSha":"e"*40,"diagnosisRunId":44,
            "files":["tests/e2e/a.spec.ts"],"exitCode":0}))
        (t/"playwright.json").write_text('{"suites":[]}')
        result=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(result["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertTrue(result["missing"])


if __name__ == "__main__":
    unittest.main()
