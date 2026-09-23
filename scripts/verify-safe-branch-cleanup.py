#!/usr/bin/env python3
"""Regression checks for the shared safe branch-cleanup contract."""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "safe_branch_cleanup.py"
SPEC = importlib.util.spec_from_file_location("safe_branch_cleanup", MODULE_PATH)
assert SPEC and SPEC.loader
cleanup = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = cleanup
SPEC.loader.exec_module(cleanup)

RETIRED_ISSUE_HELPERS = (
    "issue-68-release-helper.yml",
    "issue-72-release-helper.yml",
    "issue-75-release-helper.yml",
    "issue-76-release-helper.yml",
    "issue-80-release-helper.yml",
    "issue-83-release-helper.yml",
    "issue-84-release-helper.yml",
    "issue-87-branch-cleanup.yml",
    "issue-96-release-helper.yml",
    "issue-97-release-helper.yml",
    "issue-104-release-helper.yml",
    "issue-108-release-helper.yml",
)


def valid_snapshot(**changes):
    values = dict(
        pr_merged=True,
        pr_base="main",
        pr_head_branch="fix/issue-124",
        pr_head_repo="planner77/masterGantt",
        pr_head_sha="1" * 40,
        branch_sha="1" * 40,
        branch_protected=False,
        target_sha="2" * 40,
        merge_base_sha="1" * 40,
        open_head_prs=0,
        open_base_prs=0,
        current_ref_sha="1" * 40,
    )
    values.update(changes)
    return cleanup.CleanupSnapshot(**values)


class CleanupContractTest(unittest.TestCase):
    def test_accepts_exact_merged_head(self):
        cleanup.validate_snapshot(
            valid_snapshot(),
            repo="planner77/masterGantt",
            branch="fix/issue-124",
        )

    def test_rejects_unmerged_or_wrong_branch_tip(self):
        for snapshot in (
            valid_snapshot(pr_merged=False),
            valid_snapshot(branch_sha="3" * 40),
            valid_snapshot(current_ref_sha="3" * 40),
        ):
            with self.subTest(snapshot=snapshot):
                with self.assertRaises(cleanup.CleanupError):
                    cleanup.validate_snapshot(snapshot, repo="planner77/masterGantt", branch="fix/issue-124")

    def test_rejects_missing_ancestry_protection_or_open_pr_reference(self):
        for snapshot in (
            valid_snapshot(merge_base_sha="4" * 40),
            valid_snapshot(branch_protected=True),
            valid_snapshot(open_head_prs=1),
            valid_snapshot(open_base_prs=1),
        ):
            with self.subTest(snapshot=snapshot):
                with self.assertRaises(cleanup.CleanupError):
                    cleanup.validate_snapshot(snapshot, repo="planner77/masterGantt", branch="fix/issue-124")

    def test_rejects_wrong_pr_identity(self):
        for snapshot in (
            valid_snapshot(pr_base="release"),
            valid_snapshot(pr_head_branch="other"),
            valid_snapshot(pr_head_repo="planner77/other"),
        ):
            with self.subTest(snapshot=snapshot):
                with self.assertRaises(cleanup.CleanupError):
                    cleanup.validate_snapshot(snapshot, repo="planner77/masterGantt", branch="fix/issue-124")


    def test_absent_branch_still_requires_matching_merged_pr_identity(self):
        class FakeApi:
            def __init__(self, pr):
                self.pr = pr

            def get(self, path, *, allowed=(200,)):
                if path == "/pulls/124":
                    return 200, self.pr
                if path.startswith("/branches/"):
                    return 404, None
                raise AssertionError(path)

        repo = {"full_name": "planner77/masterGantt"}
        valid_pr = {
            "merged": True,
            "base": {"ref": "main"},
            "head": {"ref": "fix/issue-124", "repo": repo, "sha": "1" * 40},
        }
        self.assertIsNone(
            cleanup.fetch_snapshot(
                FakeApi(valid_pr),
                repo="planner77/masterGantt",
                pr_number=124,
                branch="fix/issue-124",
                target_sha="2" * 40,
            )
        )

        wrong_branch = {
            **valid_pr,
            "head": {**valid_pr["head"], "ref": "fix/other"},
        }
        with self.assertRaises(cleanup.CleanupError):
            cleanup.fetch_snapshot(
                FakeApi(wrong_branch),
                repo="planner77/masterGantt",
                pr_number=124,
                branch="fix/issue-124",
                target_sha="2" * 40,
            )


def normalize_workflow_commands(content: str) -> str:
    """Return workflow text plus shell commands represented by folded YAML run scalars."""
    normalized = content.replace("\\\n", " ")
    lines = content.splitlines()
    folded_commands = []
    index = 0
    folded_run = re.compile(r"^(?P<indent>\s*)(?:-\s+)?run:\s*>[^#]*?(?:\s+#.*)?$")

    while index < len(lines):
        match = folded_run.match(lines[index])
        if not match:
            index += 1
            continue

        base_indent = len(match.group("indent"))
        index += 1
        parts = []
        while index < len(lines):
            line = lines[index]
            if not line.strip():
                parts.append("")
                index += 1
                continue

            indent = len(line) - len(line.lstrip(" "))
            if indent <= base_indent:
                break

            parts.append(line.strip())
            index += 1

        # YAML folded scalars replace ordinary content line breaks with spaces.
        # Joining the scalar body is intentionally conservative for policy scanning:
        # a deletion command split across folded lines must not bypass detection.
        folded_commands.append(" ".join(part for part in parts if part))

    if folded_commands:
        normalized += "\n" + "\n".join(folded_commands)
    return normalized


def find_workflow_branch_deletions(content: str) -> list[str]:
    normalized = normalize_workflow_commands(content)
    literal_markers = (
        "--force-with-lease=refs/heads/",
        "--method DELETE",
        "/git/refs/heads/",
        ":refs/heads/$",
    )
    command_patterns = (
        re.compile(r"\bgit\s+push\b[^\n]*(?:\s-d(?:\s|=)|\s--delete(?:\s|=))", re.IGNORECASE),
        re.compile(r"\bgit\s+push\b[^\n]*\s[\"\']?\+?:[^\s\"\']+[\"\']?(?:\s|$)", re.IGNORECASE),
        re.compile(r"\bgh\s+api\b[^\n]*(?:-X|--method)\s+DELETE\b", re.IGNORECASE),
    )
    findings = [marker for marker in literal_markers if marker in normalized]
    findings.extend(pattern.pattern for pattern in command_patterns if pattern.search(normalized))
    return findings


class RepositoryPolicyTest(unittest.TestCase):
    def test_audited_completed_cleanup_workflows_are_retired(self):
        workflow_dir = ROOT / ".github" / "workflows"
        active = [workflow_dir / name for name in RETIRED_ISSUE_HELPERS if (workflow_dir / name).exists()]
        self.assertEqual(active, [], f"retired audited cleanup workflows remain: {active}")

    def test_direct_delete_detector_covers_short_long_and_refspec_forms(self):
        for source in (
            'git push origin -d "$WORK_BRANCH"',
            'git push origin --delete "$WORK_BRANCH"',
            'git -C "$GITHUB_WORKSPACE" push origin :feature/foo',
            'git -c protocol.version=2 push origin +:feature/foo',
            'git --git-dir=.git push origin --delete "$WORK_BRANCH"',
            'git push origin :feature/foo',
            'git push origin +:feature/foo',
            'git push origin :refs/heads/feature/foo',
            'git push origin "+:refs/heads/feature/foo"',
            'git push origin ":$WORK_BRANCH"',
            'git push origin "+:$WORK_BRANCH"',
            'git push origin ":refs/heads/$WORK_BRANCH"',
            'gh api -X DELETE "/repos/example/repo/git/refs/heads/feature/foo"',
            'gh api --method DELETE "/repos/example/repo/git/refs/heads/feature/foo"',
        ):
            with self.subTest(source=source):
                self.assertTrue(find_workflow_branch_deletions(source), source)

        self.assertEqual(
            find_workflow_branch_deletions('python3 scripts/safe_branch_cleanup.py --delete'),
            [],
        )

    def test_direct_delete_detector_folds_yaml_run_scalars(self):
        folded_workflows = (
            """steps:
  - run: >-
      git push origin
      :feature/foo
""",
            """steps:
  - name: folded delete
    run: >-
      git push origin
      :feature/foo
""",
            """steps:
  - name: forced folded delete
    run: >
      git push origin
      +:feature/foo
""",
            """steps:
  - name: quoted folded delete
    run: >+
      git push origin
      "+:refs/heads/$WORK_BRANCH"
""",
        )
        for workflow in folded_workflows:
            with self.subTest(workflow=workflow):
                self.assertTrue(find_workflow_branch_deletions(workflow), workflow)

        safe_workflow = """steps:
  - name: safe cleanup
    run: >-
      python3 scripts/safe_branch_cleanup.py
      --delete
"""
        self.assertEqual(find_workflow_branch_deletions(safe_workflow), [])

    def test_workflows_do_not_embed_branch_deletion(self):
        violations = []
        workflow_dir = ROOT / ".github" / "workflows"
        paths = []
        for suffix in ("yml", "yaml"):
            paths.extend(workflow_dir.glob(f"*.{suffix}"))
        for path in paths:
            relative_path = str(path.relative_to(ROOT))
            content = path.read_text(encoding="utf-8")
            for finding in find_workflow_branch_deletions(content):
                violations.append(f"{relative_path}: {finding}")
        self.assertEqual(violations, [], "branch deletion must use scripts/safe_branch_cleanup.py")

    def test_shared_tool_keeps_required_fail_closed_guards(self):
        content = MODULE_PATH.read_text(encoding="utf-8")
        for marker in (
            "branch tip differs from merged PR head",
            "merged PR head is not an ancestor of target SHA",
            "refusing to delete a protected branch",
            "another open pull request uses the branch as head",
            "another open pull request uses the branch as base",
            "remote branch changed before deletion",
            "--force-with-lease=",
            "allowed=(404,)",
        ):
            self.assertIn(marker, content)


if __name__ == "__main__":
    unittest.main()
