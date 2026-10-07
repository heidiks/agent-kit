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
