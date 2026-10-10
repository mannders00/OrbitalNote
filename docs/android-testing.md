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

Open workspace → **Link a device folder** uses Android's folder picker to grant
persistent read/write access. Notes are edited in the selected folder, and the
selection is restored after restarting the app. **Open private notebook** returns
to Test Notebook. Neither workspace requires an account.

Linked folders are scanned every five seconds while foregrounded and on resume.
External edits are reconciled with open notes; stale saves are rejected. Missing
permissions or incomplete provider listings pause Sync and show a reconnect error.
Select the same folder again to restore access, including when unsaved edits are
still open.

Provider capabilities vary. Android offers no universal atomic replace or
compare-and-swap operation. Before changing a file, OrbitalNote durably retains
the original and intended contents privately, checks the revision again, and
verifies saved bytes. Interrupted-save recovery copies can be exported through
Open workspace → **Export interrupted-save recovery copies**. Compare those
copies and restore the desired version in the original folder. Recovery copies
are app-private until exported and are lost if app data is cleared or uninstalled.
Simultaneous writes by another app during the final provider write still have a
race window; avoid actively editing the same note in two apps at once.

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

The linked-folder implementation was verified on an ARM64 Pixel 9a emulator:
real system picker, original-file writes preserving Unicode/mixed line endings,
external-edit reconciliation, stale-save rejection, file/folder creation,
rename/move/delete, hidden settings, persisted grants, and cold restart after
external changes. Repeat these checks on a physical phone and with third-party
document providers; those combinations are not yet verified.

The repeatable test uses a disposable emulator workspace:

```sh
node scripts/android-folder-smoke.mjs
```

Install the debug APK and start it first. Set `ADB` and `PLAYWRIGHT_MODULE` if
needed; the script uses Node, Playwright, and the debug WebView's CDP endpoint.

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

The updated app includes Settings → OrbitalNote Sync. Sign in to OrbitalNote,
approve the displayed device code, and connect using the recovery
key from your desktop. The app connects to `https://sync.orbitalnote.org/`
automatically; no server address is needed.
Sync uses the currently selected private notebook or linked folder, works while
the app is in the foreground, and reconciles on resume. Each workspace retains
its own Sync binding. Only `.org` files are transferred, including the root
`.orbitalnote.org` shared settings file. Provider failure and settings-conflict
handling are covered by the local two-device encrypted Sync integration test.
