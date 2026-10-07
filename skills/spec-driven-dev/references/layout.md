# Layout, IDs, statuses and index

## Where files go

Detect the layout once per repo, then keep it.

1. If `docs/prd/` exists, follow the pattern already there.
2. Otherwise inspect the repo root:
   - Several components under `packages/`, `apps/`, `services/`, `modules/` → **component-scoped**.
   - A single source tree (`src/`, `lib/`, `cmd/`) → **flat**.
3. When in doubt, ask once.

**Component-scoped**

```
docs/prd/
├── {component}/                      # mirrors the repo's directory name
│   ├── README.md                     # generated index
│   └── PRD-YYYYMMDD-slug/
│       ├── spec.md
│       └── TASK-001-slug.md
└── shared/                           # work spanning several components
    ├── README.md
    └── PRD-YYYYMMDD-slug/
```

**Flat**

```
docs/prd/
├── README.md
└── PRD-YYYYMMDD-slug/
    ├── spec.md
    └── TASK-001-slug.md
```

Remove the `component:` frontmatter field in flat repos. Status lives in the frontmatter,
never in folder names, so files never move.

## IDs

- PRD: `PRD-YYYYMMDD-slug`, creation date plus a lowercase hyphenated slug.
- Task: `TASK-NNN`, sequential within its PRD, starting at `TASK-001`.

## Statuses (exact, case-sensitive)

PRD: `Draft → Approved → In Progress → Completed`, or `Cancelled` from Draft or Approved.

| Status | Meaning |
|---|---|
| `Draft` | Being written or awaiting approval |
| `Approved` | User approved it; ready to implement |
| `In Progress` | At least one task started |
| `Completed` | Every task `Done` or `Cancelled` |
| `Cancelled` | Abandoned |

Task: `Todo → In Progress → Done`, with `Blocked` reachable from and back to `In Progress`, and
`Cancelled` reachable from any state except `Done`.

| Status | Meaning |
|---|---|
| `Todo` | Not started |
| `In Progress` | Being implemented |
| `Blocked` | Waiting on a dependency or decision (`blocked_reason` filled) |
| `Done` | Implemented and every acceptance criterion verified |
| `Cancelled` | Dropped, superseded or absorbed by another task (`cancelled_reason` filled) |

Any other value (`WIP`, `done`, `Pending`) is invalid. Transitions follow the arrows.

A PRD is `Completed` when every task is `Done` or `Cancelled`, with at least one `Done`.

PRD `phase` (for resuming): `interview`, `spec`, `overview`, `tasks`, `implement`, `done`.

## Index

`scripts/prd_index.py` rebuilds every `README.md` index from the frontmatter. Run it from
the repo root after any change:

```bash
python3 path/to/spec-driven-dev/scripts/prd_index.py            # write indexes
python3 path/to/spec-driven-dev/scripts/prd_index.py --check    # fail if an index is stale or a status is invalid
python3 path/to/spec-driven-dev/scripts/prd_index.py --status   # print every PRD with phase and task progress
```

Never edit an index by hand; it is overwritten.
