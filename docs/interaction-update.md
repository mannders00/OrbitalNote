# Interaction update — preview.10

## Requested changes

- [x] Prevent keyboard input from editing hidden tabs.
- [x] Minimal agenda button retains the existing query.
- [x] Thin split divider lines, retaining the larger resize hit target.
- [x] Absolute and relative line numbers.
- [x] Monospace setting preserves heading sizes.
- [x] Action popovers do not initially focus/outline their first item.
- [x] Calendar selection of saved agenda views.
- [x] Ctrl+N / Ctrl+P navigation in modal lists.
- [x] Hide app ribbon command; ribbon visible with the left sidebar open.
- [x] Mobile fold control clears the ribbon.
- [x] Task clock-in/out from agenda and heading actions, with note/calendar status
  and a duplicate entry in the agenda's Clocked section.
- [x] Vi Ctrl+D / Ctrl+U scroll without moving the cursor.
- [x] Vi R/r replaces the next character or the selected characters.
- [x] Foldable outline sections with toggle all.
- [x] Click outside command/file picker to close.
- [x] Small top gap for desktop outline and mobile sidebars.
- [x] Drag calendar events to change their planning date, including deadlines.
- [x] Completion sets CLOSED; reopening removes CLOSED.
- [x] Clickable source/preview checklist markers; Enter continues indentation.
- [x] Moving the cursor does not unfold headings.
- [x] Nested file-explorer indentation (clarified request, not browser tabs).
- [x] Editable repeating tasks and completed-repeat history in calendar.

## Org semantics

Clock records use `:LOGBOOK:` with `CLOCK: [start]--[end] => H:MM`.
Clocking another task stops existing running clocks known to this workspace.
Completing a clocked task stops its clock. Unsaved or conflicting files must
finish saving before agenda clock/completion operations.

Repeaters support hours, days, weeks, months, and years. `+` advances once,
`++` advances past now, and `.+` advances from completion. Monthly/yearly
steps clamp to the last valid day. Repeating completion retains the pending
task and writes a standard state-change record to LOGBOOK instead of leaving
the next occurrence closed. Calendar shows recorded completions; it does not
invent past occurrences or mark unrecorded repeats complete. Multi-day repeated
ranges still require source editing.

Saved calendar views apply the agenda query's filters, text, and date preset.
Select All entries to include completed occurrences again. Checklists preserve
the original Org marker and use the same undo/save path as text edits.

## Validation

- `go test ./internal/orgdoc ./internal/workspace`: clock round trips,
  CRLF/source preservation, CLOSED/reopen, repeat interval semantics and history,
  checklist edits, existing document/task/workspace cases.
- `scripts/interaction-smoke.mjs`: hidden-tab typing; minimal-view query retention;
  saved calendar selection; clock status and log records; preview/source checklist
  toggling and Enter continuation; relative-number updates and reload persistence;
  Vi scroll/replace; modal keyboard/backdrop; month/week deadline drag; repeater
  editing/completion/history; file-tree indentation; outline toggles; preserved
  folds during cursor movement; mobile fold/ribbon separation.
- Existing tab/split smoke check passes, including undo, auto-save, source line
  endings, layout restoration, and conflict-buffer preservation.
