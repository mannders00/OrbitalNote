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

Settings live in `.orbitalnote.org` at the workspace root, inside a
versioned JSON source block. This dedicated file uses the existing encrypted note
Sync protocol, so it works without a server upgrade. It is omitted from the note
tree and task file picker. Nothing in the source block is executed.

Existing `OrbitalNote-settings.org` settings are copied byte-for-byte to the new
name, then removed only if their revision still matches. If both names already
exist, the new file takes precedence and the old file is retained for comparison.
Update all Sync clients before sharing the new filename: older clients reject
hidden document paths and may stop Sync when they encounter it. The server needs
no upgrade because filenames remain inside encrypted documents.

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

## Agenda and Calendar navigation

Agenda keeps task completion, clocks, editing, and saved filters beside readable
task titles. Overdue entries show their original dates; timed entries show their
start and end times. Day navigation shares the main toolbar on wider panes; on
phones, the controls reflow into compact rows. Task-state controls keep the same
size and alignment across days, including projected and completed entries.
The Filters panel shows active rules, all/any matching, and saved-view controls;
close it with Escape, its close button, or a click outside. Minimal view keeps the
current filters.

Calendar keeps date/view controls visible while its grid scrolls. Week headings
show the full date range, including weeks that cross a month or year. Day/week
views initially scroll to 8 AM (earlier when appointments start before then) and
retain the scroll position during live updates. Narrow month/week views scroll sideways;
navigation brings the selected date into view, and **Today** returns to today.

Busy month cells show three entries and a **+N more** button that opens the full
day. Day numbers still create tasks. In Year view, month names open that month
and dates open that day; both work with the keyboard.

On touch screens, swipe to scroll. Touch and hold an event before dragging it,
or hold its top/bottom edge to resize. Hold and drag across empty time slots to
create a range; a normal tap still creates a task in that slot. Mouse and pen
drags work immediately. The all-day section can still be collapsed or expanded.

## Task destination picker

New task shows its destination in a compact **Location** row. Expand it to choose
a file, parent heading, and insertion position. The searchable file dropdown lists
open files first, then recently used files, then remaining files alphabetically.
Type to filter, choose with the mouse or arrow keys/Enter, or enter a new `.org` path.

The selected file's heading list is loaded when the form opens and when the file
changes. Choose **Top level** or select a parent to create the task one heading
level deeper. **Beginning / End** controls placement among siblings. Beginning
keeps the parent's own prose/metadata before its children; End inserts after its
existing children. If the parent file changes while the form is open, reopen the
form to refresh the selection.

The picker remembers the last file and each file's selected parent on this device,
per workspace. It re-identifies a remembered parent by title and level when its
line moves. If the heading cannot be identified, it falls back to top level.
The insertion position is also remembered on this device, per workspace.

## Dates, repeats, and times

Pick dates directly in the task calendar; **Today** returns to today and **No date**
removes the date, times, and repeat. Calendar arrow keys move by day/week,
Page Up/Down move by month, and Enter or Space selects the focused day.

**Repeat** offers daily, weekly, monthly, and yearly presets. Choose **Custom…**
for an interval in hours, days, weeks, months, or years, and choose whether it
advances from the original date (`+`), skips past dates (`++`), or starts from
completion (`.+`). Hourly repeats require a start time.

Native start/end inputs follow your platform's time-entry conventions. Choosing
a start time adds a 30-minute end time. Adjust the end directly or use a duration
shortcut; your chosen duration follows subsequent start changes. End times must
stay on the same day, so late-night blocks are limited to 23:59. Clear the time
to keep an all-day date. Existing dates, repeats, and times are preserved when
you open a task for editing.
