#!/usr/bin/env bash
# Build on macOS with Apple's SDK. No Wails CLI, npm, or frontend build required.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/go/bin:/usr/local/bin:$PATH"

if [ "$(uname -s)" != Darwin ]; then
  echo "This build needs macOS and Apple's SDK. Run it on your MacBook or a macOS runner." >&2
  exit 1
fi
if ! command -v go >/dev/null; then
  echo "Install Go 1.26 or newer from https://go.dev/dl/ (macOS ARM64), then run again." >&2
  exit 1
fi
if ! xcrun --sdk macosx --show-sdk-path >/dev/null 2>&1; then
  echo "Install Apple's command-line tools with: xcode-select --install" >&2
  exit 1
fi

version="${VERSION:-0.1.0-preview}"
if [[ ! "$version" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "VERSION may only contain letters, numbers, dots, underscores and hyphens." >&2
  exit 1
fi
host_arch="$(go env GOHOSTARCH)"
export GOOS=darwin GOARCH="${ARCH:-arm64}" CGO_ENABLED=1
case "$GOARCH" in arm64|amd64) ;; *) echo "Unsupported Mac architecture" >&2; exit 1;; esac
export SDKROOT="$(xcrun --sdk macosx --show-sdk-path)"
export CC="$(xcrun --find clang)"
export MACOSX_DEPLOYMENT_TARGET=11.0
out="bin/orbitalnote-${version}-darwin-${GOARCH}"
bundle="$out/OrbitalNote.app"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"

echo "Building OrbitalNote for macOS ${GOARCH} with $(go env GOVERSION)…"
go mod download
GOARCH="$host_arch" go test ./internal/...
go build -trimpath -tags production -ldflags='-s -w' \
  -o "$bundle/Contents/MacOS/orbitalnote" ./app
cp app/build/Info.plist "$bundle/Contents/Info.plist"

icons="$(mktemp -d "${TMPDIR:-/tmp}/orbitalnote-icons.XXXXXX")"
trap 'rm -rf "$icons"' EXIT
mkdir -p "$icons/AppIcon.iconset"
GOARCH="$host_arch" go run ./scripts/appicon "$icons/master.png"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$icons/master.png" --out "$icons/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  doubled=$((size * 2))
  sips -z "$doubled" "$doubled" "$icons/master.png" --out "$icons/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns --output "$bundle/Contents/Resources/AppIcon.icns" "$icons/AppIcon.iconset"

# Local testing does not require an Apple developer account. This is ad-hoc
# signing, not Developer ID signing or notarization for public distribution.
codesign --force --sign - "$bundle"
codesign --verify --deep --strict --verbose=2 "$bundle"
xcrun lipo -verify_arch "$GOARCH" "$bundle/Contents/MacOS/orbitalnote"
plutil -lint "$bundle/Contents/Info.plist"

cp docs/macos-testing.md "$out/TESTING.md"
cp README.md "$out/README.md"
cp LICENSE NOTICE TRADEMARKS.md "$out/"
mkdir -p "$out/licenses"
cp app/ui/vendor/LICENSES.txt "$out/licenses/editor-LICENSES.txt"
mkdir -p "$out/Examples"
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

archive="$out.zip"
ditto -c -k --sequesterRsrc --keepParent "$out" "$archive"
shasum -a 256 "$archive" > "$archive.sha256"
echo "Ready: $bundle"
echo "Archive: $archive"
echo "Launch: open \"$bundle\""
