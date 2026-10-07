# Phase 2: Spec

Turn the interview into the PRD (`spec.md`), using [assets/prd-template.md](../assets/prd-template.md).

## Steps

1. If phase 1 was skipped, create the PRD folder now (see [layout.md](layout.md)) and
   ask only the questions needed to fill Context, Goals and Non-goals.
2. Fill `author` from `git config user.email`; ask the user if it is not set.
3. Fill every section of the template from the interview notes. Write "None" in a
   section that does not apply, never leave it empty.
4. Requirements use precise language ("the system shall", "the user can"), each with
   objective acceptance criteria.
5. **Alternatives and tradeoffs**: every non-trivial choice goes in the Decisions table
   with the options considered and why the chosen one wins. Do not present a single
   option as if it were the only one.
6. Keep implementation detail out of the spec. File-level detail belongs to tasks.
7. Leave `status: Draft`. Regenerate the index (`scripts/prd_index.py`).

Then run the checkpoint from SKILL.md.

## Quality bar

- A reader who missed the interview understands why the work exists and what "done" means.
- Every goal is checkable; "improve performance" is not, "p99 below 500ms" is.
- Non-goals name the tempting things that will not be done.
