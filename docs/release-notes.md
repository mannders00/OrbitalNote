# OrbitalNote 0.1.0-preview.21

Focused heading views, list folding, and smoother split-pane planning.
OrbitalNote is free and works locally without an account.

## What's new since preview.20

### Editing and navigation
- Fold nested bullet lists and checklists in source and reading views, retaining fold state across mode switches.
- Put **Fold all** and **Unfold all** first in file actions, covering headings, lists, and metadata.
- Fix Vim `O` inserting a new line above a heading when the preceding section is folded.
- Use **Ctrl+W, then h/j/k/l** to focus the split to the left/below/above/right. Vim insert mode retains its word-deletion behavior.
- Choose **Heading actions → Focus on heading** to open an isolated source-editor tab. Edits and saves use the original file, surrounding text is protected, and **Show whole file** exits focus. Focused tabs restore when their heading can still be identified.

### Window, mobile, and planning
- Merge macOS tabs with the draggable native title area by default; disable **Merge tabs with title bar** in Settings for a separate title area.
- Prevent mobile pinch gestures from magnifying the application UI, including disabling Android WebView zoom controls.
- When a split exists, clicking an Agenda/Calendar task opens a new tab in another pane and keeps the planner visible, including for previously unopened files.
- Respect the 12/24-hour setting in editor and Calendar running-clock labels; make calendar event text nonselectable.
- Remember the last task file and selected parent heading per workspace/device, and offer **Top level (beginning of file)** alongside end-of-file insertion.

Validation includes Go tests/vet, JavaScript unit tests, heading-workflow browser checks, Vim regressions, multiple-view checks, and source/preview folding checks. Native macOS dragging and physical-device pinch behavior still need hands-on verification.

See the [editing guide](https://github.com/mannders00/OrbitalNote/blob/v0.1.0-preview.21/docs/editing.md) for the new workflows.

## Also included from preview.20

### Faster input and multiple views
- Remove whole-document scans and repeated DOM searches from Vim motions; coalesce cursor-status updates.
- Incrementally highlight ordinary prose edits, defer hidden previews, and avoid rebuilding unchanged tab layouts and outlines.
- Open the same file in multiple tabs or split panes, sharing edits and saves while retaining independent reading modes, cursors, folds, and scroll positions.
- Include a reproducible performance benchmark and regression checks. On a 1,000-heading fixture with 4× Chrome CPU throttling, median unfolded Vim motion time fell from 11.0 to 1.8 ms. This is a synthetic measurement, not a guarantee for every device.

### Easier planning
- Put **New task…** first in each document's + menu, inserting at the cursor after the task form is confirmed.
- Add a searchable open/recent-first file picker and parent-heading selector to New task. Child tasks preserve the parent's prose and metadata.
- Show projected repeating occurrences in Agenda and Calendar without adding duplicate headings or invented completion history. Completion-relative repeaters remain estimates.
- Align a prominent full-date heading and the pencil control across the top of minimal Agenda.

### Reading and shared preferences
- Indent nested reading sections without vertical guides by default; choose flat alignment in Settings.
- Add an option to hide the editor footer.
- Add opt-in settings-sync categories for calendar/tag colors and time format, theme/appearance, and editor-display preferences. Enable matching categories on each device.
- Store shared settings in a versioned JSON block in `OrbitalNote-settings.org`, using existing encrypted note Sync without a server upgrade. Keybindings and custom CSS remain device-local.
- Refresh README and website screenshot assets with the left app ribbon visible.

See [workspace settings and planning](https://github.com/mannders00/OrbitalNote/blob/v0.1.0-preview.20/docs/workspace-settings.md) and [editor performance](https://github.com/mannders00/OrbitalNote/blob/v0.1.0-preview.20/docs/editor-performance.md) for details.

Open the [Connected sample vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.20/examples/Connected) and start with Dispatch.org to explore the graph, or Systems-notebook.org for the theme showcase. The Engineer and Showcase examples are also included.
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
Saved views remain device-local. Selected appearance and display preferences can now be shared through workspace settings.

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
