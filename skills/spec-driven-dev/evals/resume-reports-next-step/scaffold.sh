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
status: In Progress
mode: full
phase: implement
created_at: 2026-10-07
author: "alice@example.com"
tasks:
  - TASK-001
  - TASK-002
  - TASK-003
---

# PRD-20261007-retry — Retry with backoff in the HTTP client
MD
task() {
  cat > "$prd/$1.md" <<MD
---
id: ${1%%-[a-z]*}
prd_id: PRD-20261007-retry
title: "$2"
status: $3
depends_on: [$4]
branch: task/PRD-20261007-retry/${1%%-[a-z]*}
prs: []
---
MD
}
task TASK-001-policy "Retry policy type" Done ""
task TASK-002-client "Wire retries into Client.Get" "In Progress" TASK-001
task TASK-003-tests "Tests for retry and backoff" Todo TASK-002
