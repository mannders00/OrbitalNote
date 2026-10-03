# OrbitalNote 0.1.0-preview.15

Quantum branding, better Android icon sizing, reliable Outline state, and clearer calendar history.
OrbitalNote is free and works locally without an account.

## What's new since preview.14

### Quantum Confident branding
- Adopt the selected Quantum outline mark across the app and platform icons.
- Reduce Android adaptive foreground size by 20% so the note and orbit fit comfortably inside circular launcher masks.
- Regenerate legacy Android launcher sizes and full-bleed iOS artwork.

### Tasks and Calendar
- Undated task dialogs default to today; existing dates and the No date option are preserved.
- Completed repeating occurrences stay on their original scheduled/deadline dates and time ranges. Actual completion timestamps remain in the log.
- Older completion logs without original occurrence dates remain in the note instead of appearing on misleading calendar dates.
- Remove calendar clock/done action buttons while retaining running-clock display.
- Align timed entry edges with their blocks and hour grid.

### Outline, keyboard navigation, and layout
- Preserve nested Outline fold selections when edits insert headings or shift line numbers.
- Restore editor focus and retained cursor/selection when activating tabs, with keyboard targets for reading and built-in views.
- Match line-number gutters to the app theme.
- Remove the extra gap around split dividers while keeping a comfortable resize target.

The [engineer example](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.15/examples/Engineer) includes the backend project and everyday tasks shown in the README's workspace screenshot, matching the website hero. The [rich Org showcase](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.15/examples/Showcase) is also included.
See the [changelog](CHANGELOG.md) and [interaction notes](docs/interaction-update.md) for details.

Default shortcuts remain Cmd/Ctrl+, for Settings, Cmd/Ctrl+P for Run command,
and Cmd/Ctrl+O for filename search. Existing hosted Sync connections remain supported.

## Downloads

- **macOS Apple Silicon:** `darwin-arm64.zip`
- **macOS Intel:** `darwin-amd64.zip`
- **Windows x64:** `windows-amd64.zip` (requires Microsoft WebView2)
- **Linux x64:** `linux-amd64.tar.gz` (Ubuntu 24.04-compatible; requires GTK4 and WebKitGTK 6.0)
- **Android ARM64:** `android-arm64.apk` (Android 7+, signed preview; private notebook)
- **iOS ARM64 Simulator:** available separately in the release workflow's artifacts (developers only; not installable on iPhone)

Extract the archive before opening the app. Each download has a SHA-256 checksum
and includes GPLv3 and third-party license notices. The exact client source is
available at this release's tag and in GitHub's source archives.

These are **preview builds**. macOS builds are ad-hoc signed, not Apple-notarized;
macOS may require allowing the app in System Settings → Privacy & Security after
the first launch attempt. Windows builds are not Authenticode-signed and may
show SmartScreen's unrecognized-app prompt. Download only from this repository.

## Current scope

Mermaid and math render in reading view; their source is edited in the editor.
KaTeX supports math, not full LaTeX documents or packages. Code blocks are not
executed. Image paste/import and resize controls remain future work.
Saved views and appearance preferences are device-local.

Repeater history shows recorded completions, not invented past occurrences.
Calendar drag/resize currently edits single-day events; multi-day ranges require
source editing. Optional end-to-end
encrypted Sync is available at https://sync.orbitalnote.org/ for $5/month or
$48/year USD, including 1 GB. macOS ↔ Android Sync has been tested on real devices.
Sync handles .org notes in one workspace; attachments and history cleanup are
not yet available. Mobile Sync runs while foregrounded. iOS device distribution
and real-device validation are still pending. The app works offline without an
account or subscription. The Android preview retains the existing GitHub release
signing configuration for update continuity. Independently signed developer builds
may differ; do not uninstall one without first preserving its notebook.

Questions or interest in Sync: **matt@masoftware.net**.
