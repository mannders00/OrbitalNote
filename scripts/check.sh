#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -z "$(gofmt -l app internal scripts/native-smoke scripts/appicon)"
go test ./...
go vet ./...
if command -v bun >/dev/null; then
  bun test app/ui/editor.test.js app/ui/calendar.test.js app/ui/agenda-query.test.js app/editor/headings.test.js
fi
