# OrbitalNote 0.1.0-preview.19

Neutral whites and grays for Workbench's light appearance.
OrbitalNote is free and works locally without an account.

## What's new since preview.18

- Remove the blue tint from Workbench's light-mode backgrounds, sidebars, and text.
- Retain blue for links and accent controls.

## Also included from preview.18

- Add Calendar-style **previous day / Today / next day** navigation to Agenda.
- Display the selected day in the Agenda heading and use it for new tasks.
- Place new completion and clock logbooks after planning/properties metadata,
  before your paragraphs, preserving body text and line endings.
- Repeating tasks continue to record completed occurrences and advance their dates;
  the heading remains open for the next occurrence.

## Also included from preview.17

### Connected notes and richer examples
- Add a clickable Local graph as the last section of the right sidebar, showing incoming, outgoing, and mutual note links.
- Include the Connected sample vault with engineering notes, a journal, a decision record, and a rich Systems notebook.
- Fix rendered internal links opening nonexistent .html exports instead of the original .org notes.
- Showcase Default, Terminal, and Editorial with real screenshots and a guide to custom CSS themes.

### Folding and Vim
- Cut a folded heading's whole subtree with `dd` and paste after another folded subtree with `p`, retaining nested heading folds. `P`, named registers, and undo are supported.
- Keep the normal cursor on visible heading text before the fold ellipsis.
- Include folded subtrees in visual-line cut/copy and keep selection highlights within the editor column.
- Keep metadata folds closed during navigation; include them in Fold all / Unfold all and current-line folding commands.
- Remove the remaining metadata-label indentation and align Vim `:` and `/` prompt text.
- Add a configurable Toggle editor / source command, default Cmd/Ctrl+E, which also switches Agenda reading mode.

### Reading, Agenda, and Calendar
- Distinguish nested headings and TODOs with indentation and hierarchy guides, including in monospace mode.
- Show collapsed Properties as a compact disclosure beneath planning metadata, with a bordered card only when expanded.
- Align Outline arrows and explicitly hide collapsed descendants to prevent stale blank space.
- Keep reading/editing icons neutral. Focus New task on entering normal Agenda/Calendar; hide and disable it in minimal Agenda.
- Apply the same 12/24-hour preference to Agenda and Calendar.
- Create calendar blocks from the highlighted half-hour cells, fixing lower-half pointer rounding. Use a red current-time line and dot.
- Restyle Terminal with Base16 Default-inspired neutral surfaces and muted accents, including a matching light palette.

Open the [Connected sample vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.17/examples/Connected) and start with Dispatch.org to explore the graph, or Systems-notebook.org for the theme showcase. The Engineer and Showcase examples are also included.
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
