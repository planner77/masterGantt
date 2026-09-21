import copy
import subprocess
import types
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# PR 코드는 read-only validation job에서만 검증한다.
ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/issue-87-branch-cleanup.yml'
if not WORKFLOW.exists():
    WORKFLOW = Path(__file__).with_name('cleanup.yml')
text = WORKFLOW.read_text(encoding='utf-8')
embedded = text.split("          python3 - <<'PY'\n", 1)[1].split('          PY\n', 1)[0]
source = '\n'.join(line[10:] if line.startswith('          ') else line for line in embedded.splitlines()) + '\n'
mod = types.ModuleType('cleanup_under_test')
exec(compile(source, str(WORKFLOW), 'exec'), mod.__dict__)
HEAD, MERGE = 'a' * 40, 'b' * 40
NAMES = ['Build, static checks, and unit tests', 'Chromium end-to-end tests', 'Docker build and runtime smoke test', 'Main 임시 commit 이미지 게시·검증·정리']

class CleanupTests(unittest.TestCase):
    def scenario(self, change=None, absent=False):
        repo = {'full_name': mod.REPO}
        data = {
            'run': {'id': 7, 'event': 'push', 'head_branch': 'main', 'repository': repo, 'head_repository': repo, 'path': '.github/workflows/ci.yml', 'status': 'completed', 'conclusion': 'success', 'run_attempt': 1, 'head_sha': MERGE, 'html_url': 'https://github.com/planner77/masterGantt/actions/runs/7'},
            'pr': {'merged': True, 'merge_commit_sha': MERGE, 'base': {'ref': 'main', 'repo': repo}, 'head': {'ref': mod.BRANCH, 'repo': repo, 'sha': HEAD}},
            'jobs': {'total_count': 4, 'jobs': [{'name': name, 'status': 'completed', 'conclusion': 'success'} for name in NAMES]},
            'branch': {'protected': False, 'commit': {'sha': HEAD}},
            'ref': {'object': {'sha': HEAD}}, 'commit': {'parents': [{'sha': 'c'*40}, {'sha': HEAD}]}, 'head_prs': [], 'base_prs': [], 'ancestor': True,
        }
        if change:
            change(data)
        deletes = []
        deleted = absent
        def api(path, method='GET', allowed=(200,)):
            nonlocal deleted
            self.assertEqual(method, 'GET', 'REST 무조건 삭제 금지')
            if path == '/actions/runs/7': return 200, data['run']
            if path.startswith('/actions/runs/7/jobs'): return 200, data['jobs']
            if path == '/git/commits/' + MERGE: return 200, data['commit']
            if path == '/pulls/88': return 200, data['pr']
            if path.startswith('/pulls?'):
                return 200, data['head_prs'] if 'head=' in path else data['base_prs']
            if path.startswith('/compare/'):
                base = path.split('/compare/')[1].split('...')[0]
                return 200, {'merge_base_commit': {'sha': base if data['ancestor'] else 'c' * 40}}
            if path.startswith('/branches/'):
                return (404, None) if deleted else (200, data['branch'])
            if path.startswith('/git/ref/'):
                status, obj = (404, None) if deleted else (200, data['ref'])
                mod.require(status in allowed, 'wrong final status')
                return status, obj
            self.fail(path)
        def leased_delete(head_sha):
            nonlocal deleted
            self.assertEqual(head_sha, HEAD)
            deletes.append(mod.BRANCH)
            deleted = True
        with tempfile.TemporaryDirectory() as td:
            event = Path(td)/'event.json'; summary = Path(td)/'summary.md'
            event.write_text(json.dumps({'workflow_run': {'id': 7, 'run_attempt': 1}}))
            env = {'GITHUB_REPOSITORY': mod.REPO, 'GITHUB_EVENT_NAME': 'workflow_run', 'GITHUB_EVENT_PATH': str(event), 'GITHUB_STEP_SUMMARY': str(summary)}
            with patch.dict(os.environ, env), patch.object(mod, 'api', api), patch.object(mod, 'delete_verified_ref', leased_delete), patch('builtins.print'):
                error = None
                try: mod.main()
                except (SystemExit, KeyError, TypeError) as exc: error = exc
            return deletes, error, summary.exists()

    def test_success(self):
        deletes, error, summary = self.scenario()
        self.assertEqual(len(deletes), 1); self.assertIsNone(error); self.assertTrue(summary)

    def test_already_absent(self):
        deletes, error, summary = self.scenario(absent=True)
        self.assertEqual(deletes, []); self.assertIsNone(error); self.assertTrue(summary)

    def test_non_target_run_is_noop(self):
        for change in (lambda d: d['pr'].update(merged=False), lambda d: d['pr'].update(merge_commit_sha='c'*40)):
            deletes, error, summary = self.scenario(change)
            self.assertEqual(deletes, []); self.assertIsNone(error); self.assertFalse(summary)

    def test_guards_prevent_deletion(self):
        changes = {
            'manual CI': lambda d: d['run'].update(event='workflow_dispatch'),
            'wrong branch': lambda d: d['run'].update(head_branch='other'),
            'foreign source': lambda d: d['run'].update(head_repository={'full_name':'someone/fork'}),
            'wrong workflow': lambda d: d['run'].update(path='other.yml'),
            'CI failed': lambda d: d['run'].update(conclusion='failure'),
            'CI running': lambda d: d['run'].update(status='in_progress'),
            'new attempt': lambda d: d['run'].update(run_attempt=2),
            'bad merge SHA': lambda d: d['run'].update(head_sha='HEAD'),
            'wrong PR head': lambda d: d['pr']['head'].update(ref='main'),
            'new branch commit': lambda d: d['branch']['commit'].update(sha='c'*40),
            'changed before delete': lambda d: d['ref']['object'].update(sha='c'*40),
            'protected branch': lambda d: d['branch'].update(protected=True),
            'GHCR skipped': lambda d: d['jobs']['jobs'][-1].update(conclusion='skipped'),
            'missing GHCR': lambda d: d['jobs']['jobs'].pop(),
            'too many jobs': lambda d: d['jobs'].update(total_count=101),
            'squash merge': lambda d: d['commit'].update(parents=[{'sha':'c'*40}]),
            'wrong merge parent': lambda d: d['commit']['parents'][1].update(sha='c'*40),
            'not ancestor': lambda d: d.update(ancestor=False),
            'open head PR': lambda d: d.update(head_prs=[{'number':89}]),
            'open base PR': lambda d: d.update(base_prs=[{'number':89}]),
        }
        for name, change in changes.items():
            with self.subTest(name=name):
                deletes, error, summary = self.scenario(change)
                self.assertEqual(deletes, []); self.assertIsNotNone(error); self.assertFalse(summary)

class GitLeaseTests(unittest.TestCase):
    def test_real_git_atomic_delete(self):
        # 외부 통신 없이 실제 bare Git 원격으로 성공/오래된 SHA/서버 경합을 검증한다.
        real_run = subprocess.run
        for mode in ('success', 'stale_before_push', 'race_after_advertisement'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as td:
                root = Path(td)
                remote, writer = root/'remote.git', root/'writer'
                def git(*args):
                    return real_run(['git', *map(str, args)], check=True,
                                    capture_output=True, text=True, timeout=15).stdout.strip()
                git('init', '--bare', '--object-format=sha1', remote)
                git('init', '--object-format=sha1', writer)
                git('-C', writer, 'config', 'user.name', 'Cleanup test')
                git('-C', writer, 'config', 'user.email', 'cleanup@example.invalid')
                (writer/'fixture').write_text('first')
                git('-C', writer, 'add', 'fixture')
                git('-C', writer, 'commit', '-m', 'first')
                first = git('-C', writer, 'rev-parse', 'HEAD')
                ref = 'refs/heads/' + mod.BRANCH
                git('-C', writer, 'push', remote, 'HEAD:' + ref)
                (writer/'fixture').write_text('second')
                git('-C', writer, 'commit', '-am', 'second')
                second = git('-C', writer, 'rev-parse', 'HEAD')
                git('-C', writer, 'push', remote, 'HEAD:refs/heads/fixture-new-tip')
                if mode == 'stale_before_push':
                    git('--git-dir=' + str(remote), 'update-ref', ref, second, first)
                if mode == 'race_after_advertisement':
                    hook = remote/'hooks/pre-receive'
                    hook.write_text(
                        '#!/bin/sh\n'
                        'unset GIT_QUARANTINE_PATH GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES\n'
                        + "git --git-dir='" + str(remote) + "' update-ref '" + ref + "' '" + second + "' '" + first + "'\n"
                    )
                    hook.chmod(0o700)
                token = 'mock-credential-not-a-real-token'
                seen_push = []
                def intercept(command, **kwargs):
                    command = list(command)
                    if 'push' in command:
                        seen_push.append(command)
                        self.assertIn('--force-with-lease=' + ref + ':' + first, command)
                        self.assertEqual(command[-1], ':' + ref)
                        self.assertNotIn('--force', command)
                        self.assertFalse(any(token in arg for arg in command))
                        self.assertEqual(kwargs['env']['GIT_CONFIG_KEY_0'], 'http.https://github.com/.extraheader')
                        self.assertEqual(kwargs['env']['GIT_CONFIG_GLOBAL'], os.devnull)
                        self.assertNotIn('GIT_TRACE_CURL', kwargs['env'])
                        # 테스트에서만 고정 HTTPS 목적지를 격리된 bare 원격으로 치환한다.
                        self.assertEqual(command[-2], 'https://github.com/' + mod.REPO + '.git')
                        command[-2] = str(remote)
                    return real_run(command, **kwargs)
                with patch.dict(os.environ, {'GH_TOKEN':token, 'GIT_TRACE_CURL':'1'}), patch.object(mod.subprocess, 'run', intercept):
                    if mode == 'success':
                        mod.delete_verified_ref(first)
                    else:
                        with self.assertRaises(SystemExit):
                            mod.delete_verified_ref(first)
                self.assertEqual(len(seen_push), 1)
                tip = real_run(['git', '--git-dir=' + str(remote), 'rev-parse', '--verify', ref], capture_output=True, text=True)
                if mode == 'success':
                    self.assertNotEqual(tip.returncode, 0)
                else:
                    self.assertEqual(tip.stdout.strip(), second)
                self.assertEqual(git('--git-dir=' + str(remote), 'rev-parse', 'refs/heads/fixture-new-tip'), second)

if __name__ == '__main__': unittest.main(verbosity=2)
