#!/bin/bash
set -e
mkdir -p src
cat > src/client.go <<'GO'
package client

import "net/http"

type Client struct {
	HTTP *http.Client
	Base string
}

func (c *Client) Get(path string) (*http.Response, error) {
	return c.HTTP.Get(c.Base + path)
}
GO
printf 'module example.com/client\n\ngo 1.22\n' > go.mod
prd=docs/prd/PRD-20261007-retry
mkdir -p "$prd"
cat > "$prd/spec.md" <<'MD'
---
id: PRD-20261007-retry
title: "Retry with backoff in the HTTP client"
status: Draft
mode: full
phase: overview
created_at: 2026-10-07
author: "alice"
tasks: []
---

# PRD-20261007-retry — Retry with backoff in the HTTP client

## Context and Problem

`Client.Get` fails on the first transient error (a 503 or a reset connection), and callers retry by hand.

## Functional Requirements

### FR-001 — Retry transient failures

`Client.Get` retries a 502, 503, 504 or a connection error up to 3 times, waiting 100 ms, 200 ms and 400 ms.

**Acceptance criteria:**
- A 503 followed by a 200 returns the 200.
- A 404 is returned at once, without retrying.

## Overview

## Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Exponential backoff in the client | Retry in each caller | One place to tune it |

## Open Questions

- None
MD
