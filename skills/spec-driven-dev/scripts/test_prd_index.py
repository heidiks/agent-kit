import contextlib
import io
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import prd_index

SPEC = """---
id: {id}
title: "{title}"
status: {status}
mode: full
phase: {phase}
created_at: 2026-10-07
author: "alice"
tasks:
  - TASK-001
  - TASK-002
---
"""

TASK = """---
id: {id}
prd_id: PRD-20261007-retry
status: {status}
depends_on: []
---
"""


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class PrdIndexTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "docs" / "prd"
        prd = self.root / "api" / "PRD-20261007-retry"
        write(prd / "spec.md", SPEC.format(id="PRD-20261007-retry", title="Retry | backoff", status="In Progress", phase="implement"))
        write(prd / "TASK-001-model.md", TASK.format(id="TASK-001", status="Done"))
        write(prd / "TASK-002-client.md", TASK.format(id="TASK-002", status="In Progress"))
        write(self.root / "shared" / "PRD-20261001-ci" / "spec.md", SPEC.format(id="PRD-20261001-ci", title="CI", status="Draft", phase="spec"))

    def tearDown(self):
        self.tmp.cleanup()

    def run_index(self, *args):
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(err):
            code = prd_index.main(["--root", str(self.root), *args])
        return code, out.getvalue(), err.getvalue()

    def test_writes_one_index_per_scope_with_progress(self):
        code, _, _ = self.run_index()
        self.assertEqual(code, 0)
        api = (self.root / "api" / "README.md").read_text()
        self.assertIn("# PRD Index — api", api)
        self.assertIn("| [PRD-20261007-retry](./PRD-20261007-retry/spec.md) | Retry \\| backoff | alice | 2026-10-07 | In Progress | implement | 1/2 done: TASK-001, TASK-002 |", api)
        self.assertIn("| Draft | spec | none yet |", (self.root / "shared" / "README.md").read_text())

    def test_check_passes_after_write_and_fails_when_stale(self):
        self.assertEqual(self.run_index("--check")[0], 1)
        self.run_index()
        self.assertEqual(self.run_index("--check")[0], 0)
        task = self.root / "api" / "PRD-20261007-retry" / "TASK-002-client.md"
        task.write_text(task.read_text().replace("In Progress", "Done"))
        code, _, err = self.run_index("--check")
        self.assertEqual(code, 1)
        self.assertIn("stale index", err)

    def test_invalid_status_and_inconsistent_completion_are_reported(self):
        spec = self.root / "api" / "PRD-20261007-retry" / "spec.md"
        spec.write_text(spec.read_text().replace("status: In Progress", "status: Completed"))
        task = self.root / "api" / "PRD-20261007-retry" / "TASK-002-client.md"
        task.write_text(task.read_text().replace("In Progress", "WIP"))
        code, _, err = self.run_index()
        self.assertEqual(code, 1)
        self.assertIn("invalid task status 'WIP'", err)
        self.assertIn("Completed but TASK-002 still open", err)

    def test_cancelled_tasks_do_not_block_completion_and_are_shown(self):
        prd = self.root / "api" / "PRD-20261007-retry"
        (prd / "TASK-002-client.md").write_text(TASK.format(id="TASK-002", status="Cancelled"))
        spec = prd / "spec.md"
        spec.write_text(spec.read_text().replace("status: In Progress", "status: Completed"))
        code, _, err = self.run_index()
        self.assertEqual(code, 0, err)
        self.assertIn("1/1 done (1 cancelled): TASK-001, TASK-002", (prd.parent / "README.md").read_text())

    def test_in_review_needs_a_pull_request_and_is_counted(self):
        task = self.root / "api" / "PRD-20261007-retry" / "TASK-002-client.md"
        task.write_text(TASK.format(id="TASK-002", status="In Review"))
        code, _, err = self.run_index()
        self.assertEqual(code, 1)
        self.assertIn("In Review without a pull request in prs", err)

        task.write_text(task.read_text().replace("depends_on: []", "depends_on: []\nprs:\n  - https://github.com/acme/api/pull/42"))
        code, _, err = self.run_index()
        self.assertEqual(code, 0, err)
        self.assertIn("1/2 done (1 in review): TASK-001, TASK-002", (task.parent.parent / "README.md").read_text())

    def test_status_lists_phase_and_progress(self):
        code, out, _ = self.run_index("--status")
        self.assertEqual(code, 0)
        self.assertIn("PRD-20261007-retry  In Progress  phase=implement  1/2 done", out)



class RepoScopeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name).resolve()
        patcher = mock.patch.dict(os.environ, {"GIT_CEILING_DIRECTORIES": str(self.base)})
        patcher.start()
        self.addCleanup(patcher.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def checkout(self, name, git=True):
        repo = self.base / name
        write(repo / "docs" / "prd" / "PRD-20261007-retry" / "spec.md",
              SPEC.format(id="PRD-20261007-retry", title="Retry", status="Draft", phase="spec"))
        if git:
            self.git(repo, "init", "-q")
            self.git(repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "init")
        return repo

    def git(self, repo, *args):
        subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)

    def title(self, repo):
        with contextlib.redirect_stdout(io.StringIO()):
            prd_index.main(["--root", str(repo / "docs" / "prd")])
        return (repo / "docs" / "prd" / "README.md").read_text().splitlines()[0]

    def test_remote_name_wins_over_checkout_directory(self):
        urls = ("https://dev.azure.com/acme/proj/_git/widgets", "git@github.com:acme/widgets.git",
                "https://github.com/acme/widgets.git/")
        for index, url in enumerate(urls):
            with self.subTest(url=url):
                repo = self.checkout(f"s{index}")
                self.git(repo, "remote", "add", "origin", url)
                self.assertEqual(self.title(repo), "# PRD Index — widgets")

    def test_worktree_without_remote_uses_main_checkout_name(self):
        repo = self.checkout("widgets")
        self.git(repo, "worktree", "add", "-q", str(self.base / "widgets-t007"))
        worktree = self.base / "widgets-t007"
        write(worktree / "docs" / "prd" / "PRD-20261007-retry" / "spec.md",
              SPEC.format(id="PRD-20261007-retry", title="Retry", status="Draft", phase="spec"))
        self.assertEqual(self.title(worktree), "# PRD Index — widgets")

    def test_without_git_uses_directory_name(self):
        self.assertEqual(self.title(self.checkout("plain", git=False)), "# PRD Index — plain")


if __name__ == "__main__":
    unittest.main()
