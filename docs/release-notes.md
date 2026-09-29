# OrbitalNote 0.1.0-preview.10

Safer tab focus, Org task clocks, clickable checklists, and repeating tasks.
OrbitalNote is free and works locally without an account.

## What's new since preview.9

### Editor and focus
- Inactive tabs relinquish focus and become inert, preventing invisible typing in hidden notes.
- Absolute or relative line numbers, plus a monospace setting that preserves heading sizes.
- Click checklist markers in source or reading view. Enter continues the checklist and its indentation.
- Outline sections collapse individually or together. Moving the cursor no longer opens folds.
- Vi Ctrl+D/U scroll the viewport without moving the cursor; R/r replaces characters or selections.

### Tasks and planning
- Clock in/out beside agenda task states or through heading actions. Standard Org LOGBOOK entries record time; running tasks appear in a Clocked agenda section and in note/calendar status areas.
- Completing a task stops its clock and adds CLOSED. Reopening removes CLOSED.
- Edit task repeaters using +, ++, or .+ intervals. Repeating completion advances the date, retains the pending task, and records a completed occurrence in LOGBOOK for calendar history.
- Minimal agenda mode hides its controls while retaining the query. Select saved agenda views in Calendar.
- Drag deadlines to another date in month or day/week views. The current day is highlighted.

### Navigation and appearance
- Ctrl+N/P moves through command/file pickers and action menus. Click outside the picker to close it; action menus no longer initially select their first item.
- Nested files are visibly indented. Split dividers are thinner, the active-tab seam stays connected at fractional zoom, and mobile fold/sidebar spacing is improved.
- Hide app ribbon command; the ribbon remains visible when the left sidebar is open.
- Android uses a full-bleed adaptive launcher icon instead of a padded desktop image, avoiding legacy launcher white surrounds. Older Android versions receive properly sized opaque icons.

The [showcase vault](https://github.com/mannders00/OrbitalNote/tree/v0.1.0-preview.10/examples/Showcase) includes the research workflow featured in the refreshed project banner.
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
Multi-day repeating ranges still require source editing. Optional end-to-end
encrypted Sync is available at https://sync.orbitalnote.org/ for $5/month or
$48/year USD, including 1 GB. macOS ↔ Android Sync has been tested on real devices.
Sync handles .org notes in one workspace; attachments and history cleanup are
not yet available. Mobile Sync runs while foregrounded. iOS device distribution
and real-device validation are still pending. The app works offline without an
account or subscription. The Android preview retains the existing GitHub release
signing configuration for update continuity. Independently signed developer builds
may differ; do not uninstall one without first preserving its notebook.

Questions or interest in Sync: **matt@masoftware.net**.
