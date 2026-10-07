import contextlib
import io
import tempfile
import unittest
from pathlib import Path

import prd_index

SPEC = """---
id: {id}
title: "{title}"
status: {status}
mode: full
phase: {phase}
created_at: 2026-10-07
author: "alice@example.com"
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
        self.assertIn("| [PRD-20261007-retry](./PRD-20261007-retry/spec.md) | Retry \\| backoff | alice@example.com | 2026-10-07 | In Progress | implement | 1/2 done: TASK-001, TASK-002 |", api)
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

    def test_status_lists_phase_and_progress(self):
        code, out, _ = self.run_index("--status")
        self.assertEqual(code, 0)
        self.assertIn("PRD-20261007-retry  In Progress  phase=implement  1/2 done", out)


if __name__ == "__main__":
    unittest.main()
