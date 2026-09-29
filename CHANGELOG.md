# Changelog

## 0.1.0-preview.11 — 2026-09-29

- Agenda minimal mode uses an aligned book icon beside New task. Running clocks
  use centered text; the calendar status has vertical padding.
- Tab baselines have an actual gap beneath the active tab at fractional zoom.
  The outline sidebar connects directly to the tab bar.
- Preview checkboxes align with the first text line. Enter continues ordinary
  bullets and numbered lists as well as checklists.
- Vi Ctrl+E/Y scroll by lines, keeping the cursor visible; Ctrl+D/U move the cursor
  and viewport together by half a page.
- Add, edit, and remove file-level Org properties from the right sidebar.
  Backlinks are removed from the sidebar.
- Day/week Calendar supports drag-to-create time ranges, event movement,
  start/end resizing, and conversion between all-day and timed events. Changes
  update Org timestamps, preserving planning type and repeater metadata.
- Weekday headers and all-day events pin together flush beneath the tab bar.

## 0.1.0-preview.10 — 2026-09-29

- Inactive tabs are inert and relinquish editor focus; delayed edits cannot focus
  a hidden editor. File-tree children are visibly indented.
- Minimal agenda view retains its filters. Calendar can select saved agenda views.
- Thin split dividers, mobile fold-control spacing, sidebar top spacing, and a
  configurable Hide app ribbon command (the ribbon stays visible with Files open).
- Absolute/relative line numbers and monospace text settings, preserving heading sizes.
- Ctrl+N/P navigation in command/file pickers and action menus; picker backdrop
  dismissal; action menus open without selecting the first item.
- Foldable outline sections with collapse/expand all. Cursor movement skips folds.
- Vi Ctrl+D/U scroll the viewport; R/r replaces a character or selection.
- Clickable checklist markers in source and reading views, with automatic list
  continuation/indentation on Enter.
- Clock in/out from the agenda or heading actions. Standard Org LOGBOOK records,
  an agenda Clocked section, and status in note/calendar toolbars.
- Completion writes CLOSED; reopening clears it. Repeating tasks advance using
  +, ++, or .+ intervals and record completed occurrences in LOGBOOK for the calendar.
- Editable repeaters in task dialogs, highlighted current calendar day, and
  deadline dragging in month and day/week views.
- Android adaptive launcher icon with a full-bleed background, separate logo
  layer, and opaque legacy icons to avoid launcher-added white surrounds.
- Active-tab seam remains connected at fractional zoom levels.

See [interaction update](docs/interaction-update.md) for validation and scope.

## 0.1.0-preview.9 — 2026-09-28

### Added
- Heading kebab menus for task editing/toggling, tags, properties, priority,
  planning, folding, and outline actions, with configurable palette commands.
- Insert/format controls and offline Mermaid/KaTeX rendering in reading view.
- Click-built compound agenda filters and named, workspace-local saved views.
- Resizable sidebars, tab insertion markers, and file/folder action menus.
- Ten workflow-based themes, standalone CSS samples, and a documented theme format.
- A showcase Org vault with images, diagrams, math, tasks, and metadata.
- Community Discussions, issue/PR templates, conduct and contribution guidance,
  and a public project board recording the development history.

### Changed
- Pending/completed task labels are directly clickable and colored red/green.
- Heading fold controls float outside text flow; removed boxed fold ellipses.
- Time selection uses native inputs and presets. Enter saves dialog inputs.
- Active tabs connect visually to the note; week headers align with day columns.
- Filename and content search use distinct icons and labels.
- Ion Blue replaces the original flat Open notebook color treatment.
- Release export keeps README direct-download links aligned with the release.

### Scope
Rich rendering preserves Org source. Local image files are supported, but
attachment Sync, full LaTeX compilation, Babel execution, and physical iPhone
distribution remain outside this preview. Saved views/themes are device-local.

See [release notes](docs/release-notes.md) for downloads and platform details.

## 0.1.0-preview.8

- Heading/subtree folding in editing and reading views, with palette commands.
- Configurable application shortcuts, conflict detection, and saved bindings.
- Defaults: Cmd/Ctrl+, Settings; Cmd/Ctrl+P Run command; Cmd/Ctrl+O Find file.
- Reading/edit controls stay left of the expanded right sidebar.
