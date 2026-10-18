#!/usr/bin/env bash
# Test the client against the exact public daemon binary, without server sources.
set -euo pipefail
cd "$(dirname "$0")/.."
version="${DAEMON_VERSION:-0.1.0-preview.1}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || exit 1
os="$(go env GOHOSTOS)"
arch="$(go env GOHOSTARCH)"
case "$os/$arch" in darwin/arm64|darwin/amd64|linux/amd64|linux/arm64) ;; *) echo 'Run this check on macOS or Linux.' >&2; exit 1;; esac
temporary="$(mktemp -d "${TMPDIR:-/tmp}/orbitalnote-compat.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT
asset="orbitalnote-sync-$os-$arch.tar.gz"
base="https://github.com/mannders00/orbitalnote-sync/releases/download/v$version"
curl --fail --location --retry 3 --silent --show-error "$base/$asset" -o "$temporary/$asset"
curl --fail --location --retry 3 --silent --show-error "$base/SHA256SUMS" -o "$temporary/SHA256SUMS"
(cd "$temporary" && grep -F "  $asset" SHA256SUMS | shasum -a 256 --check -)
tar -xzf "$temporary/$asset" -C "$temporary"
ORBITAL_SYNC_TEST_DAEMON=1 ORBITAL_SYNC_TEST_SERVER="$temporary/orbitalnote-sync" \
  go test -race ./internal/syncclient/... -count=1
