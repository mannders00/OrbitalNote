# Changelog

## Unreleased

## 0.1.0-preview.20 — 2026-10-05

- Indent nested reading sections by default without vertical guides, with a
  flat-hierarchy setting and an option to hide the editor footer.
- Display projected repeating occurrences in Calendar and Agenda without
  creating duplicate source tasks or completion history.
- Add a searchable, open/recent-first file picker and parent-heading selector
  to New task; insert child tasks after the parent's own text and metadata.
- Add opt-in sharing of calendar colors/time format, theme/appearance, and
  editor-display preferences through a versioned workspace settings note.
- Refresh website and README app screenshots with the left app ribbon visible.

- Remove whole-document heading scans and repeated DOM searches from Vim motions;
  coalesce cursor-status updates and use indexed source positions.
- Re-tokenize only the edited prose line for ordinary single-line changes;
  keep full rebuilding for structural edits and block/drawer contexts.
- Defer hidden reading-view rendering, reuse unchanged outlines, and avoid
  rebuilding tab layout on every character.

- Open the same file in multiple tabs or split views with a shared buffer and
  independent reading modes, selections, folds, and scroll positions.
- Add New task as the first document insertion-menu action, inserting a task at
  the cursor with the existing task form.
- Align the extended date and pencil control across the top of minimal Agenda.

## 0.1.0-preview.19 — 2026-10-04

- Remove the blue tint from Workbench's light-mode backgrounds and text,
  using neutral whites and grays while retaining blue accents.

## 0.1.0-preview.18 — 2026-10-03

- Add Calendar-style previous day / Today / next day navigation to Agenda.
  Show the selected date in the heading and use it for new tasks.
- Insert new completion and clock logbooks after planning/properties metadata,
  before paragraph text, preserving body content and line endings.

## 0.1.0-preview.17 — 2026-10-03

- Add Default, Terminal, and Editorial screenshots showing rich Org notes and
  local graphs, with documentation for custom CSS themes.
- Make the calendar current-time line and dot consistently red.

- Make Vim linewise deletion include folded heading subtrees, paste after folded
  destinations, preserve moved heading folds, and keep the normal cursor before
  the fold ellipsis.
- Include folded subtrees in visual-line cut/copy, and constrain selection
  highlights to the centered editor column instead of the full pane margins.

- Preserve .org destinations in rendered internal links instead of rewriting
  them to .html export paths.

- Create calendar blocks from the highlighted half-hour cells, avoiding a shifted
  start when clicking or dragging in the lower half of a slot.

- Align Vim command/search prompt prefixes with their input text.

- Keep collapsed preview Properties compact beside planning metadata; show the
  bordered card only when expanded.

- Add a clickable Local graph at the bottom of the right sidebar, showing
  incoming links, outgoing links, and notes linked both ways. Include the
  Connected sample vault for exploring the graph.
- Align Outline disclosure arrows using consistent geometry and explicitly hide
  collapsed descendants to prevent stale blank layout space.

- Apply the shared 12/24-hour time preference to Agenda as well as Calendar.

- Focus New task when activating normal Agenda/Calendar so Enter opens task
  creation immediately. Minimal Agenda uses a neutral book/pencil toggle and
  hides and disables New task; the preview pencil also stays neutral. The shared
  editor/source toggle shortcut also switches Agenda reading mode.

- Keep metadata folds closed during cursor navigation; include them in Fold all /
  Unfold all. Add a configurable Toggle editor / source command (Cmd/Ctrl+E).

- Make nested headings and TODOs clearer in rendered preview with child-section
  indentation and subtle hierarchy guides, including in monospace mode.

- Restyle Terminal with Base16 Default-inspired neutral surfaces and muted syntax
  accents, with a coordinated light palette.

- Remove the remaining source metadata fold-label margin and let current-line
  fold commands target drawers/history instead of their enclosing heading.

## 0.1.0-preview.16 — 2026-10-03

- Add Aurora, Ember, and Iris themes, and matching light/dark palettes for every
  theme with an independent System/Light/Dark appearance setting.
- Give Agenda filters a clear header, spaced active-filter chips, and a separate
  Clear filters action inside the popup.

- Align Agenda state labels, task text, and continuous tag-color bars across rows.
- Show rendered Mermaid and LaTeX blocks without a Source disclosure in preview.

- Batch Fold all/Unfold all in rendered mode and cache folded metadata labels to
  avoid repeated full-document work on large notes.

- Make Vim `j`/`k` counts match relative source-line numbers across folded text;
  `gj`/`gk` retain visible-row movement.

- Collapse Properties, Logbook, custom drawers, and repeat/clock history in source
  mode, with Properties expansion shared with rendered preview.

- Use the Systems notebook screenshot for the website hero and repository README,
  with matching worker-capacity, LaTeX, Mermaid, and instrumentation examples.

- Synchronize heading folds and reading position between source and preview,
  retaining nested folds and the editor cursor on round trips. Add Fold all /
  Unfold all to file actions and half-pane trailing space below both views.

- Expand Vi mode with composed counts and motions, text objects, linewise visual
  selections, dot-repeat, character finds, paragraph and bracket navigation,
  Org folding commands, and session-local record/replay macros.
- Add a bottom find/replace bar with regex capture replacements, match counts,
  case/word options, and selection-scoped replacement. Preserve untouched mixed
  line endings across multi-range editor transactions.

- Open the task editor from rendered Scheduled and Deadline dates. Keep legacy
  repeat-state history and LOGBOOK entries inside the collapsible Properties
  table, alongside regular Org properties.

- Refine reading mode with consistent sans-serif typography, balanced headings
  and spacing, compact task badges, quieter planning metadata, lighter tables,
  and coordinated code, quote, property, and checklist styling in light and dark.

## 0.1.0-preview.15 — 2026-10-03

- Adopt Quantum Confident (outline study 04) across app, Android/iOS,
  website/account, repository banner, and social artwork. Reduce Android adaptive
  foreground size by 20% to give the note and orbit more room inside launcher masks.
- Keep completed repeater occurrences on their original scheduled/deadline dates
  and time ranges, recording those separately from the actual completion time.
  Older logs without occurrence dates remain in the note rather than appearing
  on misleading calendar dates.
- Default undated task dialogs to today while retaining existing task dates and
  the explicit No date option.
- Keep nested Outline fold selections attached to their headings when edits shift
  line numbers or add headings elsewhere in the document.
- Restore keyboard focus and the retained selection when activating document tabs;
  reading view and built-in views also receive a keyboard-navigation target.
- Match editor line-number gutters to the app theme.
- Remove extra space around split dividers while retaining their drag hit area.
- Remove calendar clock/completion action buttons, retaining running-clock display.
- Align timed event edges with their time blocks and the hour grid.
- Use the website's actual four-pane workspace screenshot at the top of the
  public README, replacing the promotional banner.

## 0.1.0-preview.14 — 2026-10-01

- Update Outline, Agenda, and Calendar incrementally, preserving stable elements
  and scroll positions rather than clearing panels during refreshes.
- Highlight jump destinations temporarily in yellow and unfold only the ancestors
  needed to reveal a target heading. Improve first-column heading caret geometry.
- Preserve scroll when checking preview checkboxes and resizing calendar entries.
- Use a clock/pause icon for clock-out and indicate running clocks in source,
  preview, and calendar entries.
- Default Calendar to 12-hour time, with a persistent 24-hour setting. Add a
  current-time line and direct clock/completion controls on calendar entries.
- Keep active filter chips inside the + Filter popup.
- Preserve tab-strip DOM, skip redundant editor measurements, and coalesce drag
  feedback to animation frames for smoother tab movement and splitting.

## 0.1.0-preview.13 — 2026-09-30

- Folded-heading ellipses inherit the heading's text styling with no background,
  border, or pill, including hover states.
- The expanded mobile file sidebar follows the actual themed tab-bar height,
  eliminating the gap caused by the old fixed 40px offset.
- Monospace mode now uses normal-sized text throughout notes, including headings,
  in both source and preview. Turning it off restores themed heading sizes.

## 0.1.0-preview.12 — 2026-09-30

- Guided File metadata dialog for title, file tags, category, author, description,
  and custom drawer properties. Available in the sidebar, file menu, and command
  palette, with a configurable Cmd/Ctrl+Alt+M shortcut.
- Collapse/Expand all stays at the right of the sticky Outline header; headings
  without children retain a right-facing chevron.

- Agenda rows include a direct Edit task button.
- Keep native insert-mode caret geometry beside heading text rather than the
  margin controls. Preserve the pane's top border while painting the active-tab
  gap with the pane background to reduce fractional-scale seams.
- Group matching clock/edit icons at the right of agenda rows and extend the
  row divider beneath both controls.

- Subtle, theme-colored ellipses indicate folded source and preview headings.
- Fix Vi movement at an empty first line and keep its cursor beside heading text,
  rather than over the heading action menu.
- Show completed tasks and recorded repeater completions in agenda views by
  default; explicit task-state filters still apply to agenda and calendar views.
- Remove the mobile file sidebar's top gap.
- Keep weekday headers and all-day events pinned together in day/week Calendar.
  Highlight today's header rather than the entire day column/cell.
- Revalidated absolute/relative line numbers and persisted monospace settings
  without changing heading sizes.

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
