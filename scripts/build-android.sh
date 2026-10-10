#!/usr/bin/env bash
# Build the pinned Wails native Android host. No Wails CLI or npm required.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ -z "${JAVA_HOME:-}" ] && [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
if [ -n "${JAVA_HOME:-}" ]; then export PATH="$JAVA_HOME/bin:$PATH"; fi
java -version

ndk="${ANDROID_NDK_HOME:-$(find "$ANDROID_HOME/ndk" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)}"
case "$(uname -s)" in
  Darwin) host=darwin-x86_64 ;;
  Linux) host=linux-x86_64 ;;
  *) echo "Build on macOS or Linux." >&2; exit 1 ;;
esac
compiler="$ndk/toolchains/llvm/prebuilt/$host/bin/aarch64-linux-android24-clang"
if [ ! -x "$compiler" ]; then echo "Android NDK compiler not found: $compiler" >&2; exit 1; fi
if [ ! -d "$ANDROID_HOME/platforms/android-35" ]; then
  echo 'Install Android SDK platform 35 first: sdkmanager "platforms;android-35" "build-tools;35.0.0"' >&2
  exit 1
fi

go mod download
wails="$(go list -m -f '{{.Dir}}' github.com/wailsapp/wails/v3)"
out="$root/bin/android"
mkdir -p "$out"
cp -R "$wails/internal/commands/build_assets/android/." "$out/"
chmod -R u+w "$out"
cp app/build/android/app.gradle "$out/app/build.gradle"
cp app/build/android/AndroidManifest.xml "$out/app/src/main/AndroidManifest.xml"
cp app/build/android/OrbitalNoteActivity.java "$out/app/src/main/java/com/wails/app/OrbitalNoteActivity.java"
cp app/build/android/WorkspaceDocuments.java "$out/app/src/main/java/com/wails/app/WorkspaceDocuments.java"
# The pinned host labels every /wails/ response as JSON, including runtime.js.
# Let JavaScript use the asset handler, which asks Go for the correct MIME type.
activity="app/src/main/java/com/wails/app/MainActivity.java"
sed -e 's/path.startsWith("\/wails\/")/path.startsWith("\/wails\/") \&\& !path.endsWith(".js")/' \
  -e 's/bridge.initialize();/OrbitalNoteActivity.initializeDocuments(this); bridge.initialize();/' \
  "$wails/internal/commands/build_assets/android/$activity" > "$out/$activity"
# AGP 8.7.3 requires Gradle 8.9; the upstream template currently specifies 9.x.
sed 's/gradle-9.2.1-bin/gradle-8.9-bin/' \
  "$wails/internal/commands/build_assets/android/gradle/wrapper/gradle-wrapper.properties" \
  > "$out/gradle/wrapper/gradle-wrapper.properties"
# Own the launcher resources rather than letting Android wrap the padded desktop
# tile in a legacy white plate. Android 8+ applies its launcher mask to our layers.
cp -R app/build/android/res/. "$out/app/src/main/res/"
mkdir -p "$out/app/src/main/jniLibs/arm64-v8a"
echo "Compiling OrbitalNote for Android ARM64…"
variant="${ANDROID_BUILD_TYPE:-debug}"
case "$variant" in
  debug) tags=android,debug; task=assembleDebug ;;
  release)
    : "${ANDROID_KEYSTORE:?Release requires a persistent signing key}"
    : "${ANDROID_KEYSTORE_PASSWORD:?}" "${ANDROID_KEY_ALIAS:?}" "${ANDROID_KEY_PASSWORD:?}" "${ANDROID_VERSION_CODE:?}"
    tags=android,production; task=assembleRelease ;;
  *) echo 'Unknown Android build type' >&2; exit 1 ;;
esac
CGO_ENABLED=1 GOOS=android GOARCH=arm64 CC="$compiler" \
  go build -buildmode=c-shared -tags "$tags" -trimpath \
  -o "$out/app/src/main/jniLibs/arm64-v8a/libwails.so" ./app
bash scripts/mobile-notices.sh "$out/app/src/main/assets/licenses"
bash "$out/gradlew" -p "$out" --console=plain "$task"
apk="$root/bin/OrbitalNote-android-debug.apk"
if [ "$variant" = release ]; then
  version="${VERSION:?Release requires VERSION}"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || exit 1
  apk="$root/bin/orbitalnote-$version-android-arm64.apk"
fi
cp "$out/app/build/outputs/apk/$variant/app-$variant.apk" "$apk"
if [ "$variant" = release ]; then
  "$ANDROID_HOME/build-tools/35.0.0/apksigner" verify "$apk"
  (cd "$root/bin"; shasum -a 256 "$(basename "$apk")" > "$(basename "$apk").sha256")
fi
echo "Ready: $apk"

if [ "${1:-}" = "--install" ]; then
  adb="$ANDROID_HOME/platform-tools/adb"
  device="${DEVICE_ID:-$($adb devices | awk 'NR > 1 && $2 == "device" && $1 !~ /^emulator-/ {print $1; exit}')}"
  if [ -z "$device" ]; then echo "Connect a phone and authorize USB debugging, then run again." >&2; exit 1; fi
  # Replace the APK in place: do not uninstall or erase the test notebook.
  "$adb" -s "$device" install -r "$apk"
  "$adb" -s "$device" shell am start -n com.orbitalnote.preview/com.wails.app.OrbitalNoteActivity
fi
