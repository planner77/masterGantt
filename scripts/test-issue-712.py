#!/usr/bin/env python3
"""Issue #712: deterministic post-merge source, Full-CI lineage and negative fixtures."""
import unittest
from unittest.mock import patch
import qa_final_automated as qa
import issue_lifecycle as lifecycle

REPO = "planner77/masterGantt"
HEAD, BASE, TEST, MERGE, TREE = ("a"*40, "b"*40, "c"*40, "d"*40, "e"*40)
CHECKS = lifecycle.REQUIRED_CHECKS
META = "PR metadata가 기존 전체 CI 증거를 보존하는지 검증"


def source(run_id=1, attempt=2):
    return {"schema":"mastergantt-ci-pr-source-v1", "repository":REPO,
            "run_id":run_id, "run_attempt":attempt, "pr_number":712,
            "head_sha":HEAD, "base_sha":BASE, "test_merge_sha":TEST,
            "head_ref":"ci/issue-712-safe-provenance", "base_ref":"main",
            "head_repository":REPO, "base_repository":REPO}


def run(run_id=1, attempt=2, number=2892, status="completed", conclusion="success",
        marker="[전체 검증]"):
    return {"id":run_id,"run_attempt":attempt,"run_number":number,
            "head_sha":HEAD,"head_branch":"ci/issue-712-safe-provenance",
            "event":"pull_request","path":".github/workflows/ci.yml",
            "status":status,"conclusion":conclusion,
            "display_title":"PR CI "+marker+" #712",
            "repository":{"full_name":REPO},"head_repository":{"full_name":REPO},
            "pull_requests":[],"html_url":f"https://github.com/{REPO}/actions/runs/{run_id}"}


def full_jobs():
    return [{"name":n,"status":"completed","conclusion":"success"} for n in CHECKS] + [
        {"name":META,"status":"completed","conclusion":"skipped"},
        {"name":"변경 경로 판정","status":"completed","conclusion":"success"}]


class FakeGitHub:
    repo = REPO
    prefix = "/repos/" + REPO
    def __init__(self):
        self.live = {
            "number":712,"state":"closed","merged":True,
            "merged_at":"2026-10-17T10:31:43Z",
            "title":"[Issue #712] Full source proof", "body":"Refs #712",
            "merge_commit_sha":MERGE,
            "head":{"sha":HEAD,"ref":"ci/issue-712-safe-provenance",
                    "repo":{"full_name":REPO}},
            # GitHub may expose a *new* base SHA after merge: use immutable parents.
            "base":{"sha":"f"*40,"ref":"main","repo":{"full_name":REPO}},
        }
        self.commits = {
            TEST:{"sha":TEST,"parents":[{"sha":BASE},{"sha":HEAD}],
                  "tree":{"sha":TREE}},
            MERGE:{"sha":MERGE,"parents":[{"sha":BASE},{"sha":HEAD}],
                   "tree":{"sha":TREE}},
        }
        self.runs = [run(2,attempt=1,number=2898,conclusion="failure",
                         marker="[메타데이터 검증]"),run()]
        self.attempt_jobs = {1:full_jobs(), 2:[
            {"name":"QA Final — Automated","status":"completed","conclusion":"success"}]}
    def get(self, path):
        if path == self.prefix+"/pulls/712":
            return self.live
        for sha, commit in self.commits.items():
            if path == self.prefix+"/git/commits/"+sha:
                return commit
        raise qa.Blocked("BLOCKED", "Git source not found: "+path)
    def pages(self, path):
        assert path == self.prefix+"/commits/"+HEAD+"/pulls",path
        return [{"number":712}]
    def collection(self, path, name):
        if name == "workflow_runs":
            assert path.startswith(self.prefix+"/actions/workflows/ci.yml/runs?"),path
            return self.runs
        assert name == "jobs", (path,name)
        for attempt in (1,2):
            if path == self.prefix+f"/actions/runs/1/attempts/{attempt}/jobs":
                return self.attempt_jobs[attempt]
        if path == self.prefix+"/actions/runs/3/attempts/1/jobs":
            return full_jobs()
        raise AssertionError("Unexpected collection: "+path)


class Issue712Tests(unittest.TestCase):
    def proof(self, fake, *, full_run_id=1, attempt=2):
        with patch.object(qa,"source_artifact",
                          side_effect=lambda gh,r,a: source(r,a)):
            return lifecycle.required_checks_ok(
                REPO,HEAD,pr_number=712,merge_sha=MERGE,gh_client=fake)

    def test_metadata_only_failure_does_not_mask_full_success(self):
        fake = FakeGitHub()
        good, missing, evidence = self.proof(fake)
        self.assertTrue(good,evidence)
        self.assertFalse(missing)
        self.assertIn("FULL_VERIFIED: run=1.2",evidence)
        self.assertIn("test_merge="+TEST,evidence)
        self.assertIn("merge="+MERGE,evidence)

    def test_post_merge_tree_and_parents_negative_cases(self):
        for change in ("tree","actual_first","actual_second","test_first",
                       "test_second","squash","unmerged","sha","head",
                       "repo","branch","linked","base_ref"):
            fake=FakeGitHub()
            if change=="tree": fake.commits[MERGE]["tree"]["sha"]="0"*40
            if change=="actual_first": fake.commits[MERGE]["parents"][0]["sha"]="0"*40
            if change=="actual_second": fake.commits[MERGE]["parents"][1]["sha"]="0"*40
            if change=="test_first": fake.commits[TEST]["parents"][0]["sha"]="0"*40
            if change=="test_second": fake.commits[TEST]["parents"][1]["sha"]="0"*40
            if change=="squash": fake.commits[MERGE]["parents"].pop()
            if change=="unmerged": fake.live["merged"]=False
            if change=="sha": fake.live["merge_commit_sha"]="0"*40
            if change=="head": fake.live["head"]["sha"]="0"*40
            if change=="repo": fake.live["head"]["repo"]["full_name"]="attacker/foreign"
            if change=="branch": fake.live["head"]["ref"]="ci/issue-999-other"
            if change=="linked": fake.pages=lambda path: []
            if change=="base_ref": fake.live["base"]["ref"]="other"
            with self.subTest(case=change):
                good,missing,why=self.proof(fake)
                self.assertFalse(good)
                self.assertEqual(missing,["FULL_CI_SOURCE_UNVERIFIED"],why)

    def test_provenance_mismatched_attempt_repository_number_and_missing(self):
        cases = ("attempt","repo","head_repo","run_event","workflow","missing_artifact")
        for case in cases:
            fake=FakeGitHub()
            if case=="attempt": fake.runs[1]["run_attempt"]=11
            if case=="repo": fake.runs[1]["repository"]["full_name"]="foreign/other"
            if case=="head_repo": fake.runs[1]["head_repository"]["full_name"]="foreign/other"
            if case=="run_event": fake.runs[1]["event"]="push"
            if case=="workflow": fake.runs[1]["path"]=".github/workflows/other.yml"
            with self.subTest(case=case),patch.object(
                qa,"source_artifact",
                side_effect=(qa.Blocked("BLOCKED","artifact missing")
                    if case=="missing_artifact" else (lambda gh,r,a:source(r,a)))
            ):
                good,missing,why=lifecycle.required_checks_ok(
                    REPO,HEAD,pr_number=712,merge_sha=MERGE,gh_client=fake)
                self.assertFalse(good,why)

    def test_latest_real_full_failure_or_pending_blocks_old_pass(self):
        for conclusion,status in (("failure","completed"),(None,"in_progress")):
            fake=FakeGitHub()
            fake.runs.insert(0,run(3,1,number=2900,status=status,conclusion=conclusion))
            # newest full shares the same head, but may not reuse older PASS.
            with self.subTest(status=status):
                good,missing,reason=self.proof(fake)
                self.assertFalse(good,reason)
                self.assertIn("FULL_REQUIRED_FAILURE",missing)

    def test_rerun_aggregate_failure_overrides_previous_attempt(self):
        fake=FakeGitHub()
        fake.attempt_jobs[2].append({
            "name":CHECKS[1],"status":"completed","conclusion":"failure"})
        good,missing,reason=self.proof(fake)
        self.assertFalse(good,reason)
        self.assertIn(CHECKS[1],missing)

    def test_artifact_bad_fields_are_rejected(self):
        for key,value in (
            ("pr_number",999),("repository","someone/other"),
            ("run_attempt",1),("head_sha","f"*40),
            ("base_sha","f"*40),("test_merge_sha","f"*40),
            ("head_repository","someone/other")):
            fake=FakeGitHub()
            with self.subTest(field=key), patch.object(
                qa,"source_artifact",
                side_effect=lambda gh,r,a,k=key,v=value: {**source(r,a),k:v}):
                good,missing,_=lifecycle.required_checks_ok(
                    REPO,HEAD,pr_number=712,merge_sha=MERGE,gh_client=fake)
                self.assertFalse(good)
                self.assertIn("FULL_CI_SOURCE_UNVERIFIED",missing)

    def test_trusted_post_merge_metadata_failure_is_nonauthoritative_audit(self):
        class TrustedFake(FakeGitHub):
            def get(self, path):
                if path == self.prefix+"/actions/runs/2":
                    return self.runs[0]
                return super().get(path)
        fake=TrustedFake()
        with patch.object(qa, "source_artifact",
                          side_effect=lambda gh,r,a:source(r,a)):
            result=qa.trusted_source(
                {"GITHUB_RUN_ID":"5000"},
                {"workflow_run":{"id":2}},fake)
            self.assertEqual(result["automated_qa"],"N/A")
            self.assertEqual(result["manager_decision"],"NOT TESTED")
            self.assertEqual(result["decision_reason"],
                             "POST_MERGE_METADATA_NON_AUTHORITATIVE")
            fake.live["body"]="Refs #999"
            with self.assertRaises(qa.Blocked):
                qa.trusted_source({"GITHUB_RUN_ID":"5000"},
                                  {"workflow_run":{"id":2}},fake)

    def test_merged_full_equivalence_historical_552_commit_pair(self):
        # Immutable real-world forensic values from #2892.1 and PR #561.
        old_base="4307c8cdf1cc00a87fd7bff9f5e1a0c924bb3620"
        old_head="3420e54453b43681c9634565b57f13ae8f0443a9"
        old_test="23a81e0cbb7ebf5cf28388147e09463c86e40717"
        old_merge="c0eca9ad5bfdb6c14d98dec7c5cfd7256e4619d7"
        tree="4e96ac1f52160364e35a48abfb76f89ed6b8844c"
        class Git:
            prefix="/repos/planner77/masterGantt"
            def get(self, route):
                sha=route.rsplit("/",1)[-1]
                self_sha=sha if sha in {old_test,old_merge} else None
                assert self_sha
                return {"sha":sha,"parents":[{"sha":old_base},{"sha":old_head}],
                        "tree":{"sha":tree}}
        self.assertEqual(qa.verify_merged_tree(
            Git(),{"state":"closed","merged":True,"merged_at":"2026-10-17T10:31:43Z",
                   "merge_commit_sha":old_merge},
            head=old_head,base=old_base,test_merge=old_test),old_merge)


if __name__=="__main__":
    unittest.main(verbosity=2)
