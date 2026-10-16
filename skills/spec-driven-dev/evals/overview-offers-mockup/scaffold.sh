#!/bin/bash
set -e
mkdir -p cmd
cat > cmd/sync.go <<'GO'
package cmd

import "fmt"

func Sync(files []string) error {
	for _, f := range files {
		if err := upload(f); err != nil {
			return err
		}
	}
	fmt.Println("done")
	return nil
}

func upload(path string) error { return nil }
GO
printf 'module example.com/drive\n\ngo 1.22\n' > go.mod
prd=docs/prd/PRD-20261012-sync-progress
mkdir -p "$prd"
cat > "$prd/spec.md" <<'MD'
---
id: PRD-20261012-sync-progress
title: "Progress line for drive sync"
status: Draft
mode: full
phase: overview
created_at: 2026-10-12
author: "alice"
tasks: []
---

# PRD-20261012-sync-progress — Progress line for drive sync

## Context and Problem

`drive sync` prints nothing until it ends, so a sync of hundreds of files looks frozen.

## Functional Requirements

### FR-001 — Progress line

While `drive sync` runs, the terminal shows one line that updates in place: `Syncing 12/40 files · report.pdf`.

**Acceptance criteria:**
- The counter and the file name update after each upload.

### FR-002 — Summary

When it ends, the line is replaced by `Synced 40 files in 1m12s`, or `Synced 39 of 40 files, 1 failed: notes.txt` on a failure.

**Acceptance criteria:**
- A failed upload is named in the summary.

## Overview

## Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| One line updated in place | A line per file | Hundreds of files would flood the terminal |

## Open Questions

- None
MD
