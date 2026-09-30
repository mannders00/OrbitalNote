# OrbitalNote 0.1.0-preview.12

Guided file metadata, direct agenda editing, and clearer editor navigation.
OrbitalNote is free and works locally without an account.

## What's new since preview.11

### Agenda and calendar
- Edit tasks directly from each agenda row without leaving the agenda.
- Matching clock and pencil icons sit together on the right, with a divider spanning the full row.
- Completed tasks and recorded repeater completions remain visible by default. Explicit task-state filters still apply in agenda and calendar views.
- Weekday headers and all-day events remain pinned together; today's highlight is limited to its header/day label rather than the entire column or cell.

### Guided file metadata
- A labeled dialog for title, file tags, category, author, and description, plus an expandable custom-properties section.
- Uses Org file keywords such as `#+TITLE` and `#+FILETAGS`; custom values use the top-level property drawer. Unrelated source and line endings are preserved.
- Open it from the right sidebar, File actions, or the **Edit file metadata** command.
- Default shortcut: **Cmd+Option+M** on Mac or **Ctrl+Alt+M** elsewhere, configurable in Settings.

### Editor, outline, and appearance
- Subtle, theme-colored ellipses indicate folded headings in source and preview.
- Collapse/Expand all stays at the right of the sticky Outline header. Headings without children retain a right-facing chevron.
- Fix Vi movement at an empty first line and native insert-mode caret placement beside heading controls.
- Preserve the pane's top border while painting the active-tab gap with the pane background to reduce fractional-scale seams.
- Remove the mobile file sidebar's top gap.
- Absolute/relative line numbers and persisted monospace settings were revalidated without changing heading sizes.

The [showcase vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.12/examples/Showcase) includes the research workflow featured in the refreshed project banner.
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
