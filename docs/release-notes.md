# OrbitalNote 0.1.0-preview.16

Polished reading, synchronized document views, stronger Vim editing, and paired light/dark themes.
OrbitalNote is free and works locally without an account.

## What's new since preview.15

### Reading and source, together
- Refine rendered typography, headings, task badges, planning dates, tables, code, quotes, and checklists.
- Open task editing directly from rendered Scheduled and Deadline dates.
- Group Properties, Logbook, and repeat history into collapsible metadata; fold drawers and history independently in source mode too.
- Share heading folds, Properties expansion, and reading position between source and preview, retaining nested folds and cursor position on round trips.
- Add Fold all / Unfold all to the file menu, with batched updates for large notes, and space below the last line in both modes.
- Show Mermaid diagrams and LaTeX output without a Source dropdown in rendered preview.

### Vim and search
- Expand Vim support with composed counts/operators, text objects, visual-line selection, character finds, dot-repeat, and session-local macros.
- Make counted `j`/`k` motions match relative source-line offsets across folds; `gj`/`gk` move by visible rows.
- Add a bottom find/replace bar with regular expressions, capture replacements, case/word options, match counts, and selection scope.
- Preserve untouched mixed line endings across multi-range edits and replacements.

### Themes and Agenda
- Add Aurora (indigo/mint), Ember (charcoal/copper), and Iris (violet/lavender).
- Pair all thirteen themes with light/dark palettes and a separate System / Light / Dark appearance setting.
- Align Agenda state labels, task text, and tag-color bars across rows.
- Give the filter popup a clear heading, spaced active-filter chips, consistent fields, and a separate Clear filters action.

The [Systems notebook example](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.16/examples/Engineer) includes the worker-capacity notes, LaTeX, Mermaid diagram, Go instrumentation, and everyday tasks shown in the README. The [rich Org showcase](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.16/examples/Showcase) is also included.
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
