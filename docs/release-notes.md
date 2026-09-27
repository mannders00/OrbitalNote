OrbitalNote is free. Your notes are plaintext files on your computer. No account required.

This native preview brings a source-preserving Org editor, live Agenda and
Calendar, timed tasks, draggable split panes, and a local folder workspace.
Open an existing Org folder or start with the included example files.
Mark tasks done directly in the agenda. Cmd+W closes the focused tab on macOS,
using the existing save/discard handling.
Sync connects directly to OrbitalNote's hosted service. Sign in, approve the
device in your browser, and return to the app; sign-in completes automatically.
There is no server URL to configure. Existing hosted connections keep working.

## Downloads

- **macOS Apple Silicon:** `darwin-arm64.zip`
- **macOS Intel:** `darwin-amd64.zip`
- **Windows x64:** `windows-amd64.zip` (requires Microsoft WebView2)
- **Linux x64:** `linux-amd64.tar.gz` (Ubuntu 24.04-compatible; requires GTK4 and WebKitGTK 6.0)
- **Android ARM64:** `android-arm64.apk` (Android 7+, signed preview; private notebook)
- **iOS ARM64 Simulator:** `ios-simulator-arm64.zip` (developers only; not installable on iPhone)

Extract the archive before opening the app. Each download has a SHA-256 checksum
and includes GPLv3 and third-party license notices. The exact client source is
available at this release's tag and in GitHub's source archives.

These are **preview builds**. macOS builds are ad-hoc signed, not Apple-notarized;
macOS may require allowing the app in System Settings → Privacy & Security after
the first launch attempt. Windows builds are not Authenticode-signed and may
show SmartScreen's unrecognized-app prompt. Download only from this repository.

Org repeaters are preserved but not automatically expanded. Optional end-to-end
encrypted Sync is available at https://sync.orbitalnote.org/ for $5/month or
$48/year USD, including 1 GB. macOS ↔ Android Sync has been tested on real devices.
Sync handles .org notes in one workspace; attachments and history cleanup are
not yet available. Mobile Sync runs while foregrounded. iOS device distribution
and real-device validation are still pending. The app works offline without an
account or subscription. Android release signing may differ from developer builds;
do not uninstall a debug build without first preserving its notebook.

Questions or interest in Sync: **matt@masoftware.net**.
