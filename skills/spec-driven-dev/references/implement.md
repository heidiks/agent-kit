# Phases 5 and 6: Implement and Done

Only start after the user explicitly says to implement. Implement one task at a time,
in an order that respects `depends_on`.

## For each task

1. Set the PRD to `status: In Progress` (and `phase: implement`) if it is not yet.
2. Set the task to `status: In Progress`, fill `started_at`, add a progress log row.
3. Read the files listed in the task and two or three neighbors; match their style.
4. Implement. Keep the change inside the task's scope; note anything outside it as a
   new open question or a follow-up task instead of doing it.
5. Run the project's own checks (format, lint, tests) the way the repo documents them.
6. **Verify each acceptance criterion** and tick it in the task file. A criterion that
   cannot be verified blocks `Done`: either fix it or ask the user.
7. Set the task to `status: Done`, fill `completed_at`, add a progress log row.
8. Regenerate the index (`scripts/prd_index.py`).
9. Ask before starting the next task, unless the user said to continue through all of them.

## Blockers

1. Set the task to `status: Blocked` and fill `blocked_reason`.
2. Tell the user what is blocked and what would unblock it.
3. Do not start a task that depends on it without the user's go.

## Cancelling a task

When a task is dropped, superseded or absorbed by another, set `status: Cancelled`, fill
`cancelled_reason` (name the task that replaces it, if any) and tell the user. Never delete
the file; the history matters.

## Done (phase 6)

When every task is `Done` or `Cancelled`:

1. Set the PRD to `status: Completed` and `phase: done`; tick the Goals that were met.
2. If a goal was not met, say so and record why in the PRD instead of ticking it.
3. Regenerate the index and give the user a short summary: what shipped, what was
   deferred, which open questions remain.
