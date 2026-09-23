#!/usr/bin/env python3
"""Regression checks for the shared safe branch-cleanup contract."""

from __future__ import annotations

import importlib.util
import pathlib
import re
import shlex
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
                if path.startswith("/compare/"):
                    return 200, {"merge_base_commit": {"sha": "1" * 40}}
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

        class WrongAncestryApi(FakeApi):
            def get(self, path, *, allowed=(200,)):
                if path.startswith("/compare/"):
                    return 200, {"merge_base_commit": {"sha": "9" * 40}}
                return super().get(path, allowed=allowed)

        with self.assertRaises(cleanup.CleanupError):
            cleanup.fetch_snapshot(
                WrongAncestryApi(valid_pr),
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
    folded_run = re.compile(r"^(?P<indent>\s*)(?P<item>-\s+)?run:\s*>(?P<header>[^#\s]*)(?:\s+#.*)?$")

    while index < len(lines):
        match = folded_run.match(lines[index])
        if not match:
            index += 1
            continue

        base_indent = len(match.group("indent")) + len(match.group("item") or "")
        index += 1
        raw_parts = []
        while index < len(lines):
            line = lines[index]
            if not line.strip():
                raw_parts.append((None, ""))
                index += 1
                continue

            indent = len(line) - len(line.lstrip(" "))
            if indent <= base_indent:
                break

            raw_parts.append((indent, line.strip()))
            index += 1

        # YAML folded scalars fold ordinary lines to spaces, but blank lines and
        # more-indented lines preserve line breaks. An explicit indentation
        # indicator (for example >2-) defines the scalar content indentation
        # relative to the run key; otherwise infer it from the first/minimum
        # non-empty content indentation.
        header = match.group("header") or ""
        explicit_indent = next((int(char) for char in header if char.isdigit()), None)
        content_indents = [indent for indent, text in raw_parts if indent is not None and text]
        if explicit_indent is not None:
            content_indent = base_indent + explicit_indent
        else:
            content_indent = min(content_indents) if content_indents else base_indent + 1
        output_lines = []
        normal = []

        def flush_normal():
            if normal:
                output_lines.append(" ".join(normal))
                normal.clear()

        for indent, text in raw_parts:
            if indent is None:
                flush_normal()
                if output_lines and output_lines[-1] != "":
                    output_lines.append("")
                continue
            if indent > content_indent:
                flush_normal()
                output_lines.append(text)
                continue
            normal.append(text)
        flush_normal()

        folded_commands.append("\n".join(output_lines))

    if folded_commands:
        normalized += "\n" + "\n".join(folded_commands)
    return normalized


def shell_command_segments(line: str) -> list[list[str]]:
    try:
        lexer = shlex.shlex(line, posix=True, punctuation_chars=";&|()!`{}")
        lexer.whitespace_split = True
        lexer.commenters = ""
        tokens = list(lexer)
    except ValueError:
        return []

    segments = []
    current = []
    for token in tokens:
        if token and all(char in ";&|()!`{}" for char in token):
            if current:
                segments.append(current)
                current = []
            continue
        current.append(token)
    if current:
        segments.append(current)
    return segments


def executable_tokens(tokens: list[str]) -> list[str]:
    index = 0
    assignment = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
    while index < len(tokens) and assignment.match(tokens[index]):
        index += 1

    if index < len(tokens) and tokens[index] == "command":
        index += 1
        while index < len(tokens) and tokens[index].startswith("-"):
            index += 1

    if index < len(tokens) and tokens[index] == "env":
        index += 1
        while index < len(tokens):
            token = tokens[index]
            if assignment.match(token):
                index += 1
                continue
            if token in ("-S", "--split-string") and index + 1 < len(tokens):
                try:
                    split_args = shlex.split(tokens[index + 1], posix=True)
                except ValueError:
                    return []
                return split_args + tokens[index + 2 :]
            if token.startswith("--split-string="):
                try:
                    split_args = shlex.split(token.split("=", 1)[1], posix=True)
                except ValueError:
                    return []
                return split_args + tokens[index + 1 :]
            if token in ("-u", "--unset", "-C", "--chdir") and index + 1 < len(tokens):
                index += 2
                continue
            if token.startswith(("--unset=", "--chdir=")):
                index += 1
                continue
            if token.startswith("-"):
                index += 1
                continue
            break

    return tokens[index:]


def command_basename(token: str) -> str:
    return token.replace("\\", "/").rsplit("/", 1)[-1]


def shell_execution_tokens(tokens: list[str]) -> list[str]:
    """Return the executable command after shell control prefixes/wrappers."""
    index = 0
    control_words = {"if", "then", "elif", "while", "until", "do", "else"}
    while index < len(tokens) and tokens[index] in control_words:
        index += 1

    remaining = executable_tokens(tokens[index:])
    while remaining:
        wrapper = command_basename(remaining[0])
        if wrapper == "time":
            wrapper_index = 1
            while wrapper_index < len(remaining):
                token = remaining[wrapper_index]
                if token == "--":
                    wrapper_index += 1
                    break
                if token.startswith("-"):
                    wrapper_index += 1
                    continue
                break
            remaining = executable_tokens(remaining[wrapper_index:])
            continue

        if wrapper == "exec":
            wrapper_index = 1
            while wrapper_index < len(remaining):
                token = remaining[wrapper_index]
                if token == "--":
                    wrapper_index += 1
                    break
                if token in ("-a", "--argv0") and wrapper_index + 1 < len(remaining):
                    wrapper_index += 2
                    continue
                if token.startswith("--argv0="):
                    wrapper_index += 1
                    continue
                if token.startswith("-"):
                    wrapper_index += 1
                    continue
                break
            remaining = executable_tokens(remaining[wrapper_index:])
            continue

        break
    return remaining


def git_push_args(tokens: list[str]) -> list[str] | None:
    tokens = shell_execution_tokens(tokens)
    if not tokens or command_basename(tokens[0]) != "git":
        return None

    value_options = {
        "-C",
        "-c",
        "--git-dir",
        "--work-tree",
        "--namespace",
        "--config-env",
        "--exec-path",
    }
    index = 1
    while index < len(tokens):
        token = tokens[index]
        if token == "--":
            index += 1
            break
        if not token.startswith("-"):
            break
        if token in value_options:
            index += 2
            continue
        if any(token.startswith(option + "=") for option in value_options if option.startswith("--")):
            index += 1
            continue
        index += 1

    if index >= len(tokens) or tokens[index] != "push":
        return None
    return tokens[index + 1 :]


def is_delete_long_option(token: str) -> bool:
    if not token.startswith("--") or token.startswith("--no-"):
        return False
    name = token[2:]
    return len(name) >= 2 and "delete".startswith(name)


def is_destructive_push_short_option(token: str) -> bool:
    if not token.startswith("-") or token.startswith("--"):
        return False
    options = token[1:]
    return "d" in options or "p" in options


def is_destructive_push_long_option(token: str) -> bool:
    if not token.startswith("--") or token.startswith("--no-"):
        return False
    name = token[2:]
    destructive = (("delete", 2), ("prune", 3), ("mirror", 1))
    return any(len(name) >= minimum and canonical.startswith(name) for canonical, minimum in destructive)


def scan_shell_command(tokens: list[str]) -> list[str]:
    tokens = shell_execution_tokens(tokens)
    if not tokens:
        return []

    findings = []
    push_args = git_push_args(tokens)
    if push_args is not None:
        if any(
            is_destructive_push_short_option(arg) or is_destructive_push_long_option(arg)
            for arg in push_args
        ):
            findings.append("git push destructive option")
        if any(re.fullmatch(r"\+?:[^\s]+", arg) for arg in push_args):
            findings.append("git push empty-source refspec")

    if command_basename(tokens[0]) == "gh" and len(tokens) >= 2 and tokens[1] == "api":
        gh_args = tokens[2:]
        for index, arg in enumerate(gh_args):
            if arg in ("-X", "--method") and index + 1 < len(gh_args):
                if gh_args[index + 1].upper() == "DELETE":
                    findings.append("gh api DELETE")
            elif arg.startswith("--method=") and arg.split("=", 1)[1].upper() == "DELETE":
                findings.append("gh api DELETE")

    return findings


def strip_yaml_trailing_comment(value: str) -> str:
    quote = None
    index = 0
    while index < len(value):
        char = value[index]
        if quote == "'":
            if char == "'" and index + 1 < len(value) and value[index + 1] == "'":
                index += 2
                continue
            if char == "'":
                quote = None
        elif quote == '"':
            if char == "\\" and index + 1 < len(value):
                index += 2
                continue
            if char == '"':
                quote = None
        else:
            if char in ("'", '"'):
                quote = char
            elif char == "#" and (index == 0 or value[index - 1].isspace()):
                return value[:index].rstrip()
        index += 1
    return value.rstrip()


def decode_inline_run_scalar(value: str) -> str:
    value = strip_yaml_trailing_comment(value.strip())
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("''", "'")
    if len(value) >= 2 and value[0] == value[-1] == '"':
        inner = value[1:-1]
        return bytes(inner, "utf-8").decode("unicode_escape")
    return value


def fold_yaml_flow_scalar_lines(parts: list[str]) -> str:
    """Fold plain/single/double-quoted YAML flow scalar continuation lines."""
    paragraphs = []
    paragraph = []
    for part in parts:
        if part.strip():
            paragraph.append(part.strip())
            continue
        if paragraph:
            paragraphs.append(" ".join(paragraph))
            paragraph = []
    if paragraph:
        paragraphs.append(" ".join(paragraph))
    return "\n".join(paragraphs)


def multiline_inline_run_commands(content: str) -> list[str]:
    """Extract multiline non-block run scalars and fold them as one YAML value."""
    lines = content.splitlines()
    commands = []
    index = 0
    run_line = re.compile(
        r"^(?P<indent>\s*)(?P<item>-\s+)?run:\s*(?![>|])(?P<value>.*)$"
    )

    while index < len(lines):
        match = run_line.match(lines[index])
        if not match:
            index += 1
            continue

        base_indent = len(match.group("indent")) + len(match.group("item") or "")
        parts = [match.group("value")]
        cursor = index + 1
        while cursor < len(lines):
            line = lines[cursor]
            if not line.strip():
                parts.append("")
                cursor += 1
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent <= base_indent:
                break
            parts.append(line.strip())
            cursor += 1

        if len(parts) > 1:
            folded = fold_yaml_flow_scalar_lines(parts)
            commands.append(decode_inline_run_scalar(folded))
            index = cursor
        else:
            index += 1

    return commands


def embedded_shell_commands(text: str) -> list[str]:
    """Extract shell command/process substitutions even when they are quoted."""
    results = []
    pending = [text]
    seen = {text}
    substitution = re.compile(r"(?:\$|<|>)\(([^()]*)\)|`([^`]*)`")

    while pending:
        current = pending.pop()
        for match in substitution.finditer(current):
            inner = next(group for group in match.groups() if group is not None).strip()
            if inner and inner not in seen:
                seen.add(inner)
                results.append(inner)
                pending.append(inner)
    return results


def find_workflow_branch_deletions(content: str) -> list[str]:
    normalized = normalize_workflow_commands(content)
    multiline_runs = multiline_inline_run_commands(content)
    if multiline_runs:
        normalized += "\n" + "\n".join(multiline_runs)
    findings = []

    # GitHub's ref-delete REST endpoint is forbidden regardless of whether a
    # workflow reaches it through gh, curl, wget, Python, or another client.
    if "/git/refs/heads/" in normalized:
        findings.append("GitHub branch ref DELETE endpoint")

    for raw_line in normalized.splitlines():
        candidates = [raw_line.strip()]
        inline_run = re.match(r"^\s*(?:-\s+)?run:\s*(?![>|])(.+)$", raw_line)
        if inline_run:
            candidates.append(decode_inline_run_scalar(inline_run.group(1)))

        expanded_candidates = []
        for candidate in candidates:
            expanded_candidates.append(candidate)
            expanded_candidates.extend(embedded_shell_commands(candidate))

        for candidate in expanded_candidates:
            for segment in shell_command_segments(candidate):
                findings.extend(scan_shell_command(segment))

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
            '/usr/bin/git push origin --delete feature/foo',
            '/usr/local/bin/git push origin :feature/foo',
            'git push --m origin',
            'git push --mi origin',
            'git push --mir origin',
            'git push --mirror origin',
            'git push origin -vd feature/foo',
            'git push origin -dv feature/foo',
            'git push origin -vp feature/foo',
            'git push --prune origin "refs/heads/*:refs/heads/*"',
            'git push --mirror origin',
            'git push --pru origin "refs/heads/*:refs/heads/*"',
            'git push --mir origin',
            '- run: "git push origin :feature/foo" # remove branch',
            "- run: 'git push origin +:feature/foo' # remove branch",
            '- run: "git push origin :feature/foo"',
            "- run: 'git push origin +:feature/foo'",
            'curl -X DELETE https://api.github.com/repos/o/r/git/refs/heads/foo',
            'curl --request DELETE https://api.github.com/repos/o/r/git/refs/heads/foo',
            'if git push origin -d feature/foo; then :; fi',
            '! git push origin :feature/foo',
            'echo "$(git push origin :feature/foo)"',
            'echo "prefix $(git push origin +:feature/foo)"',
            'cat <(git push origin :feature/foo)',
            'echo `git push origin +:feature/foo`',
            '{ git push origin :feature/foo; }',
            'time -p git push origin :feature/foo',
            'exec -a git git push origin +:feature/foo',
            'git -C "$GITHUB_WORKSPACE" push origin :feature/foo',
            'git -c protocol.version=2 push origin +:feature/foo',
            'git --git-dir=.git push origin --delete "$WORK_BRANCH"',
            'git push origin --de feature/foo',
            'git push origin --del feature/foo',
            'FOO=bar git -C "$GITHUB_WORKSPACE" push origin :feature/foo',
            'command git -c protocol.version=2 push origin +:feature/foo',
            'env FOO=bar git push origin --delete "$WORK_BRANCH"',
            "env -S 'git push origin :feature/foo'",
            "env --split-string='git push origin +:feature/foo'",
            'env -C "$GITHUB_WORKSPACE" git push origin :feature/foo',
            'env --chdir="$GITHUB_WORKSPACE" git push origin +:feature/foo',
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
        self.assertEqual(
            find_workflow_branch_deletions(
                'git status && echo push && python3 scripts/safe_branch_cleanup.py --delete --repo planner77/masterGantt'
            ),
            [],
        )
        self.assertEqual(find_workflow_branch_deletions('git push origin --dry-run main'), [])
        multiline_single_quoted_run = """steps:
  - name: multiline single quoted delete
    run: 'git push origin
      :feature/foo'
"""
        self.assertTrue(find_workflow_branch_deletions(multiline_single_quoted_run))

        multiline_double_quoted_run = """steps:
  - name: multiline double quoted delete
    run: "git push origin
      +:feature/foo"
"""
        self.assertTrue(find_workflow_branch_deletions(multiline_double_quoted_run))

        multiline_plain_run = """steps:
  - name: multiline plain delete
    run: git push origin
      :feature/foo
"""
        self.assertTrue(find_workflow_branch_deletions(multiline_plain_run))

        explicit_indent_safe = """steps:
  - name: explicitly more-indented shell text
    run: >2-
        git push origin
        :feature/foo
"""
        self.assertEqual(find_workflow_branch_deletions(explicit_indent_safe), [])

        explicit_indent_delete = """steps:
  - name: explicit indent with real deleting command
    run: >2-
      git push origin
      :feature/foo
"""
        self.assertTrue(find_workflow_branch_deletions(explicit_indent_delete))

        self.assertEqual(find_workflow_branch_deletions('echo git push origin --delete feature/foo'), [])
        self.assertEqual(find_workflow_branch_deletions("printf '%s\\n' 'git push origin :feature/foo'"), [])

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

        sibling_key_workflow = """steps:
  - run: >-
      git push origin
      :feature/foo
    env: # don't expose this
      SAFE: "1"
"""
        self.assertTrue(find_workflow_branch_deletions(sibling_key_workflow))

        more_indented_workflow = """steps:
  - name: more-indented boundary
    run: >-
      echo safe
        true
      git push origin
      :feature/foo
"""
        self.assertTrue(find_workflow_branch_deletions(more_indented_workflow))

        comment_paragraph_workflow = """steps:
  - name: comment paragraph then delete
    run: >-
      # remove branch

      git push origin :feature/foo
"""
        self.assertTrue(find_workflow_branch_deletions(comment_paragraph_workflow))

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
