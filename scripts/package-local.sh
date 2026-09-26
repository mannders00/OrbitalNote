#!/usr/bin/env bash
# Native, unsigned preview artifacts. This is not a signing/release pipeline.
set -euo pipefail
cd "$(dirname "$0")/.."
os="$(go env GOOS)"
arch="$(go env GOARCH)"
if [ "$os" = darwin ]; then
  export ARCH="$arch"
  exec bash scripts/build-macos-arm64.sh
fi
version="${VERSION:-0.1.0-preview}"
if [[ ! "$version" =~ ^[A-Za-z0-9._-]+$ ]]; then echo 'Invalid VERSION' >&2; exit 1; fi
out="bin/orbitalnote-${version}-${os}-${arch}"
mkdir -p "$out"
case "$os" in
  windows)
    go build -trimpath -tags production -ldflags='-s -w -H windowsgui' -o "$out/OrbitalNote.exe" ./app
    ;;
  linux)
    go build -trimpath -tags production -ldflags='-s -w' -o "$out/orbitalnote" ./app
    ;;
  *) echo "Unsupported native package target: $os" >&2; exit 1 ;;
esac
cp README.md "$out/README.md"
cp LICENSE NOTICE TRADEMARKS.md "$out/"
mkdir -p "$out/licenses" "$out/Examples"
cp app/ui/vendor/LICENSES.txt "$out/licenses/editor-LICENSES.txt"
cp -R examples/Welcome "$out/Examples/"
while read -r module directory; do
  if [ -z "$directory" ] || [ "$module" = github.com/mannders00/OrbitalNote ]; then continue; fi
  for notice in "$directory"/LICENSE* "$directory"/NOTICE* "$directory"/COPYING*; do
    if [ -f "$notice" ]; then
      target="$out/licenses/${module//\//_}"
      mkdir -p "$target"
      cp -f "$notice" "$target/"
    fi
  done
done < <(go list -m -f '{{.Path}} {{.Dir}}' all)
if [ "$os" = windows ]; then
  export PACKAGE_OUT="$out"
  powershell.exe -NoProfile -Command 'Compress-Archive -Path $env:PACKAGE_OUT -DestinationPath ($env:PACKAGE_OUT + ".zip") -Force'
  archive="$out.zip"
else
  archive="$out.tar.gz"
  tar -czf "$archive" -C bin "$(basename "$out")"
fi
sha256sum "$archive" > "$archive.sha256"
echo "Created unsigned preview: $archive"
