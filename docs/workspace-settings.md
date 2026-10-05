# Shared workspace settings and planning

## Settings sync

In **Settings → Shared workspace settings**, select the categories this device
should share and apply:

- Calendar/tag colors and 12/24-hour time format.
- Built-in theme and System/Light/Dark appearance.
- Reading indentation, footer visibility, monospace mode, and line numbers.

Select the same categories on your other devices. The category selection itself
is device-local. Unselected categories, keybindings, Vim mode, pane layouts,
sidebar widths, credentials, and custom CSS remain local.

Settings live in `OrbitalNote-settings.org` at the workspace root, inside a
versioned JSON source block. This dedicated file uses the existing encrypted note
Sync protocol, so it works without a server upgrade. It is omitted from the note
tree and task file picker. Nothing in the source block is executed.

If the shared file already contains a selected category, enabling it applies the
shared values. Otherwise the device publishes its current values. Later changes
to selected categories update the file using revision-checked saves, preserving
other categories. Normal Sync must be configured to transfer the file to another
device; selecting a checkbox alone does not connect a Sync account.

Disabling a category keeps the device's current values and stops sharing/applying
that category. It does not erase values needed by other devices. Concurrent offline
changes use the existing Sync conflict-copy behavior; conflicting settings remain
recoverable in the generated conflict note.

## Reading layout

**Indent nested sections** is enabled by default. Reading-view child sections
indent 20 pixels per level, without vertical lines. Disable it for flat alignment.
**Hide editor footer** hides the document save/cursor/Vim status bar.

## Future repeating tasks

Calendar and Agenda display **projected** occurrences beyond the task's current
timestamp. Projections cover the next 90 days, the calendar year being viewed,
and a specifically selected future Agenda day. Calendar navigation extends the
projection range without creating intervening years of rows. Each expansion is
bounded to 20,000 iterations per repeating timestamp.

Daily, weekly, monthly, yearly, and timed hourly repeaters are supported. Month
ends clamp to valid dates, matching completion advancement. `++` and `.+`
projections are estimates: actual completion can change the next date. Recorded
completion history continues to show actual occurrences, not invented past events.

Projected rows cannot be completed, clocked, dragged, or resized individually.
They open the underlying note; their Edit action edits the repeating task itself.
No new headings or timestamps are written merely by browsing a calendar.

## Task destination picker

New task offers a searchable file dropdown, with open files first, then recently
used files, then remaining files alphabetically. Type to filter, choose with the
mouse or arrow keys/Enter, or enter a new `.org` path.

The selected file's heading list is loaded when the form opens and when the file
changes. Choose **Top level** to append, or select a parent to create the task one
heading level deeper. A child is inserted after its parent's own prose/metadata
and before existing children, keeping that prose attached to the parent. If the
parent file changes while the form is open, reopen the form to refresh the selection.
