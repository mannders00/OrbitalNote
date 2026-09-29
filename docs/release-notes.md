# OrbitalNote 0.1.0-preview.9

Rich Org previews, saved agenda views, useful themes, and a more direct editor.
OrbitalNote is free and works locally without an account.

## What's new since preview.8

### Notes and heading actions
- Click red TODO/custom pending-state text to complete a task, and green completed-state text to reopen it. Heading checkboxes are replaced by task-state text; agenda completion uses the same visual approach.
- Heading kebab menus expose task editing, tags, individual properties, priority, scheduling, deadlines, folding, and outline movement. These actions are also available in the command palette and configurable shortcut settings.
- Metadata edits preserve unrelated properties, planning lines, descendants, and line endings.
- Folding controls float beside headings and appear on nearby hover or keyboard focus; touch devices show them directly. Removed the boxed ellipsis placeholder.
- An Insert/format menu provides common text formatting, links, timestamps, images, Mermaid, math, tables, code, quotes, and checklists.

### Rich reading previews
- Bundled, offline Mermaid diagrams and KaTeX inline/display math, including Org `src latex` math blocks.
- Rendered blocks offer source disclosure and retain editable Org source. Invalid block syntax falls back to visible source with an explanation.
- Local image attachments remain ordinary files beside the notes. Rendering does not rewrite the source.

### Agenda, calendar, and navigation
- Compact agenda filter chips and a popup builder for tag, custom task-state, file, entry-type, and date rules, with all/any matching.
- Named agenda views save the date range, text search, and compound filters per workspace on the device. Switch, update, or delete saved views from the filter control.
- Week-view weekday headers form a continuous row aligned with day columns.
- Resizable sidebars with saved widths, a connected active-tab border, and a precise tab-drag insertion marker with edge autoscroll.
- File/folder kebab menus for rename/move and deletion, plus file copying. Folder deletion applies to empty folders.
- Distinct filename/content-search icons, Enter-to-save dialog inputs, and native time controls with quick-time/duration presets.

### Appearance and examples
- Ion Blue branding across the app icon, favicon, and project artwork.
- Ten purpose-designed themes: Workbench, Paper, Focus, Nord, Field Notes, Studio, Terminal, Editorial, Soft Focus, and Blueprint. Themes change typography, density, controls, and document styling as well as colors.
- Custom CSS with the documented Theme v1 format; standalone samples in [examples/Themes](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.9/examples/Themes).
- A complete [showcase vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.9/examples/Showcase) with local imagery, diagrams, math, tables, custom task states, planning, tags, and properties. Download the source archive below and open `examples/Showcase` as a workspace.
- Public project history, Discussions, issue forms, and contribution guidance make it easier to request and contribute improvements.

Default shortcuts remain Cmd/Ctrl+, for Settings, Cmd/Ctrl+P for Run command,
and Cmd/Ctrl+O for filename search. Existing hosted Sync connections remain supported.

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

## Current scope

Mermaid and math render in reading view; their source is edited in the editor.
KaTeX supports math, not full LaTeX documents or packages. Code blocks are not
executed. Image paste/import and resize controls remain future work.
Saved views and appearance preferences are device-local.

Org repeaters are preserved but not automatically expanded. Optional end-to-end
encrypted Sync is available at https://sync.orbitalnote.org/ for $5/month or
$48/year USD, including 1 GB. macOS ↔ Android Sync has been tested on real devices.
Sync handles .org notes in one workspace; attachments and history cleanup are
not yet available. Mobile Sync runs while foregrounded. iOS device distribution
and real-device validation are still pending. The app works offline without an
account or subscription. The Android preview retains the existing GitHub release
signing configuration for update continuity. Independently signed developer builds
may differ; do not uninstall one without first preserving its notebook.

Questions or interest in Sync: **matt@masoftware.net**.
