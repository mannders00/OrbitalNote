# OrbitalNote 0.1.0-preview.25

## Consistent modal selectors

- Focused headings now support source and reading modes with the normal preview
  controls, limited to the selected subtree. **Show whole file** is a quiet
  control beside the filename. Focused editing protects the root marker and
  expands shallow headings to child level.

- Add a **Prepend / Append** toggle below Parent heading. It remembers your
  choice per workspace/device and inserts at the start or end of that nesting
  level, preserving parent notes and existing child subtrees.

- Standardize selectors on the **New task → Org file** combobox, with inline
  search and a floating results list.
- Place the chevron inside the field, vertically centered.
- Use one component for task files, parent headings, folders, internal-link
  destinations, and priorities, with consistent keyboard navigation.
- Keep free-form task file paths supported; fixed-choice selectors restore the
  selected value if a search is dismissed.

Includes the file-management, navigation, and folding improvements from preview.24:

## File management and navigation

- Move files by dropping anywhere inside an expanded folder, with a full-folder
  destination highlight. Empty sidebar space targets the workspace root.
- Create, copy, rename, and move notes with separate name and folder fields,
  automatic `.org` extensions, destination previews, and duplicate-name feedback.
- Folder menus offer new notes and subfolders. Sidebar file menus focus on file
  operations; folding and split-view actions remain in the open note's menu.
- Shared searchable modal pickers replace native dropdowns. Folder chevrons are
  aligned with their labels and have no animation.
- Jump to headings with **Cmd/Ctrl+Shift+O**, with parent context and line numbers.
  Folded targets are revealed in source and preview modes.
- Insert internal links using an existing-note picker that generates relative paths.
- Follow bracketed source links with **Cmd-click on macOS** or **Ctrl-click on
  Windows/Linux**, including cross-file heading targets. Agenda and calendar task
  links display clickable labels.

## Folding and outline fixes

- Consistent heading, list, and checklist fold controls in source and preview,
  with hover/focus visibility, aligned controls, and folded-content ellipses.
- Cmd-click on macOS or Ctrl-click on Windows/Linux recursively folds or unfolds
  nested headings and lists. Ordinary clicks retain descendant fold states.
- Fix #60: empty headings no longer clear the outline. They appear as
  **Untitled heading**, with working hierarchy and navigation.

See the [editing guide](https://github.com/mannders00/OrbitalNote/blob/main/docs/editing.md)
and [changelog](https://github.com/mannders00/OrbitalNote/blob/main/CHANGELOG.md).
Local validation includes project checks and browser regressions for navigation,
file management, task links, pickers, folding, and empty headings.

## Self-hosted encrypted Sync

Includes the self-hosted server selector introduced in preview.23. Choose
**Settings → OrbitalNote Sync → Sync service → Self-hosted server** and enter
your server's HTTPS origin. Hosted OrbitalNote Sync remains available.

This client is tested by the release workflow against
[OrbitalNote Sync daemon 0.1.0-preview.1](https://github.com/mannders00/orbitalnote-sync/releases/tag/v0.1.0-preview.1).
The products have independent versions and licenses: GPL-3.0-only for the client,
Sustainable Use License 1.0 for the daemon. Self-hosted accounts need no subscription.
See the [self-hosting guide](https://github.com/mannders00/OrbitalNote/blob/main/docs/self-hosted-sync.md).

## Downloads

- **macOS Apple Silicon:** `darwin-arm64.zip`
- **macOS Intel:** `darwin-amd64.zip`
- **Windows x64:** `windows-amd64.zip` (requires Microsoft WebView2)
- **Linux x64:** `linux-amd64.tar.gz` (Ubuntu 24.04-compatible; GTK4 and WebKitGTK 6.0)
- **Android ARM64:** `android-arm64.apk` (Android 7+, linked folders or private notebook)
- **iOS ARM64 Simulator:** workflow artifact for developers, not installable on iPhone.

Extract archives before opening the app. Downloads include SHA-256 checksums and
license notices. macOS previews are ad-hoc signed, not Apple-notarized; Windows
previews are not Authenticode-signed. OS approval prompts may appear.

Android retains the existing release signing configuration for update continuity.
See [Android testing](https://github.com/mannders00/OrbitalNote/blob/main/docs/android-testing.md)
and [shared settings](https://github.com/mannders00/OrbitalNote/blob/main/docs/workspace-settings.md).
Physical-device linked-folder and third-party-provider checks remain pending.

The app works offline without an account. Optional hosted encrypted Sync is
available at https://sync.orbitalnote.org/ for $5/month or $48/year USD, including
1 GB. Sync handles `.org` notes in one workspace; attachment sync and history
cleanup are not yet available. Mobile Sync runs while foregrounded.
