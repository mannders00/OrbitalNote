# OrbitalNote 0.1.0-preview.11

Direct calendar editing, file properties, and refined editor interactions.
OrbitalNote is free and works locally without an account.

## What's new since preview.10

### Calendar
- Drag across empty day/week time slots to create a task with a time range.
- Move single-day events between dates and times; resize either edge to adjust the start or end.
- Move events between all-day and timed slots. Changes update the Org timestamp while preserving scheduled/deadline type and repeater metadata.
- Weekday headers and all-day events pin together directly beneath the tab bar while scrolling.
- Current-clock status is plain, centered text with vertical padding.

### Org editing and properties
- Add, edit, and remove file-level properties through the right sidebar. They are stored in a top-of-file Org property drawer; heading properties remain separate.
- Backlinks have been removed from the sidebar for now.
- Enter continues ordinary bullets and numbered lists as well as checklists, preserving indentation. Preview checkboxes align with the first line of text.
- Vi Ctrl+E/Y scroll by lines, moving the cursor only as needed to keep it visible. Ctrl+D/U move the cursor and viewport together by half a page.

### Navigation and appearance
- Agenda minimal mode is an aligned book icon beside New task.
- Running-clock status in notes is plain, centered text without a card or Stop button. Clock-out remains available in agenda and heading actions.
- Tab baselines have an actual gap beneath the active tab to avoid border bleed at fractional zoom.
- The outline sidebar connects directly to the tab bar without a strip of note background above it.

The [showcase vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.11/examples/Showcase) includes the research workflow featured in the refreshed project banner.
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
