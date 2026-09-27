# Android device preview

This is a native ARM64 debug APK, using the pinned Wails Android WebView host
and an in-process Go backend. It runs offline without a development server.

## Build and install

Requirements: Go 1.26+, Android SDK platform 35 and build-tools 35.0.0, an Android
NDK, and Java 21. On macOS the script automatically uses Android Studio's bundled
Java and `~/Library/Android/sdk`. Override `JAVA_HOME`, `ANDROID_HOME`, or
`ANDROID_NDK_HOME` when needed. The first build downloads Gradle and its Maven
dependencies.

Enable USB debugging on the phone, connect it, and accept the authorization prompt.
From the repository root:

```sh
bash scripts/build-android.sh --install
# Select a particular device when more than one is connected:
DEVICE_ID=<serial> bash scripts/build-android.sh --install
# Build without installing:
bash scripts/build-android.sh
```

Output: `bin/OrbitalNote-android-debug.apk`.
Android package: `com.orbitalnote.preview`.
The installer uses `adb install -r` to preserve existing app data.

## Workspace and limitations

The app creates **Test Notebook** inside its private persistent storage, with a
`Welcome.org` note. Edits survive app restarts and APK updates. Uninstalling the
app or clearing its data deletes this notebook. It is intended for disposable
testing, and is independent of your desktop workspace.

The folder chooser reports that external Android folders are not supported yet.
Persistent linked-folder access through Android's Storage Access Framework
remains a separate implementation (see [mobile feasibility](mobile-feasibility.md)).

Test opening a note, editing with the soft keyboard, saving, preview, search,
creating notes, agenda/calendar, rotation, background/resume, and relaunch.
Some interactions are still desktop-oriented; this is a device preview.

The native activity reserves space for status/navigation bars, display cutouts,
rounded screen corners (Android 12+), and the onscreen keyboard. The build also
works around the pinned Wails host's incorrect MIME type for `/wails/runtime.js`.
The status/gesture-area backgrounds follow the app's selected light/dark theme,
with contrasting system icons.

Verified on a physical Pixel 9a: native bridge, note creation, editor input,
saving, rendered preview, persistence after force-stop/cold relaunch, keyboard
resizing, safe screen insets, and light/dark system-area colors.

## Inspect or copy test notes

The debug package allows inspection with `run-as`:

```sh
adb shell "run-as com.orbitalnote.preview ls 'files/Test Notebook'"
adb exec-out "run-as com.orbitalnote.preview cat 'files/Test Notebook/Welcome.org'" > Welcome-android.org
```

Use `adb -s <serial>` if multiple devices are connected. On macOS, `adb` is normally
at `~/Library/Android/sdk/platform-tools/adb` if it is not on your `PATH`.
Chrome's `chrome://inspect/#devices` can inspect the debug WebView over USB.

## Encrypted Sync preview

The updated app includes Settings → OrbitalNote Sync. Sign in on your private
Sync service, approve the displayed device code, and connect using the recovery
key from your desktop. See [server setup and the two-device test](../server/README.md).
Sync uses the private notebook, works while the app is in the foreground, and
reconciles on resume. For this first slice, only `.org` notes are transferred.
