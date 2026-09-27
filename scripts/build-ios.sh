#!/usr/bin/env bash
# Pinned Wails UIKit host, ARM64 simulator bundle. Device distribution needs Apple signing.
set -euo pipefail
cd "$(dirname "$0")/.."
version="${VERSION:-0.1.0-preview}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || exit 1
sdk="$(xcrun --sdk iphonesimulator --show-sdk-path)"
target=arm64-apple-ios15.0-simulator
out="$PWD/bin/ios-simulator"
mkdir -p "$out/OrbitalNote.app"
go mod download
wails="$(go list -m -f '{{.Dir}}' github.com/wailsapp/wails/v3)"
export CGO_ENABLED=1 GOOS=ios GOARCH=arm64 CC="$(xcrun --sdk iphonesimulator --find clang)"
export CGO_CFLAGS="-isysroot $sdk -target $target -mios-simulator-version-min=15.0"
export CGO_LDFLAGS="-isysroot $sdk -target $target"
go build -buildmode=c-archive -tags production,ios -trimpath -o "$out/OrbitalNote.a" ./app
xcrun --sdk iphonesimulator clang -target "$target" -isysroot "$sdk" \
  -framework Foundation -framework UIKit -framework WebKit -framework Security \
  -framework CoreFoundation -framework UniformTypeIdentifiers -framework LocalAuthentication \
  -framework UserNotifications -framework AVFoundation -framework CoreLocation \
  -framework CoreMotion -framework SystemConfiguration -lresolv \
  "$wails/internal/commands/build_assets/ios/main.m" -Wl,-force_load,"$out/OrbitalNote.a" \
  -o "$out/OrbitalNote.app/orbitalnote"
python3 - "$out/OrbitalNote.app" "$version" <<'PY'
import pathlib, plistlib, sys
bundle=pathlib.Path(sys.argv[1])
with (bundle/'Info.plist').open('wb') as f:
    plistlib.dump(dict(CFBundleIdentifier='com.orbitalnote.preview', CFBundleName='OrbitalNote',
        CFBundleDisplayName='OrbitalNote', CFBundleExecutable='orbitalnote', CFBundlePackageType='APPL',
        CFBundleShortVersionString=sys.argv[2].split('-')[0], CFBundleVersion='1',
        MinimumOSVersion='15.0', LSRequiresIPhoneOS=True, UIDeviceFamily=[1,2],
        UILaunchScreen={}, UISupportedInterfaceOrientations=['UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight']), f)
PY
bash scripts/mobile-notices.sh "$out/OrbitalNote.app/licenses"
codesign --force --sign - "$out/OrbitalNote.app"
archive="bin/orbitalnote-$version-ios-simulator-arm64.zip"
ditto -c -k --keepParent "$out/OrbitalNote.app" "$archive"
shasum -a 256 "$archive" > "$archive.sha256"
echo "Ready: $archive (simulator only)"
