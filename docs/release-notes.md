# OrbitalNote 0.1.0-preview.26

## Events, calmer dialogs, and editing polish

- Add **Event** beside Scheduled and Deadline, plus **Set event date…** in
  heading actions. Event dates use plain active Org timestamps and work for
  regular headings as well as TODOs. Existing events can be edited from Agenda
  or the heading menu; unrelated text, drawers, and timestamps are preserved.
- Refine task-dialog padding, column spacing, and the separate time-control row.
- Allow zoom in/out and actual-size shortcuts while dialogs are open, including
  the shifted Cmd/Ctrl-plus spelling. Add space below the task title and around
  the Event / Scheduled / Deadline selector.

- Refresh the native app icon with the selected Electric sky artwork.
- Collapse or expand the all-day section in day/week calendars. The control
  shows the number of entries and remembers the choice on this device.
- Replace the clocked heading's blue edge with a compact clock-status badge.
- Refresh checklist fold bindings reliably when a checked item's rendered label
  is reused after source offsets change, including compact list markup.
- Keep Vim navigation inside a focused heading's visible line range. Preserve
  the final empty line's caret so opening a new line at the focused boundary
  does not redirect typing to the preceding line.
- Make Vim linewise deletion at a focused heading's end remove the actual line
  while preserving the following hidden heading, including empty lines and counts.
- Use matching segmented controls for task placement and planning type, with
  spacing between the two groups.
- Contain dropdown scrolling at list boundaries. Keyboard option navigation
  scrolls only the option list rather than the surrounding modal or page.
- Arrange task dialogs into location and planning columns on laptops, with an
  always-visible calendar at the top right and on-demand repeat-syntax help. Dialog headers and actions stay
  visible while long bodies scroll; narrow screens use a single column.
- Show shared dropdown lists in a top-layer overlay anchored to their input.
  Lists can extend beyond the modal, size to the app viewport, and open upward
  when there is more room above the field.
- Vim `o` on a folded heading or list opens a visible line after the complete
  subtree, preserving the original fold and any nested folds.
- Update the repository README with first-use documentation, current downloads,
  and clearer paths for users and contributors arriving from the website.

## Included from earlier previews

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
