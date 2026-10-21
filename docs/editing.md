# Editing, Vi keys, and search

## Reading and source views

Use **Jump to heading** in the command palette, or **Cmd+Shift+O** on macOS /
**Ctrl+Shift+O** on Windows and Linux, to search headings in the current note.
Results include parent headings and line numbers to distinguish repeated titles.
Enter jumps to the selected heading and reveals it if folded, keeping your current
source or preview mode. The shortcut can be changed in keyboard settings.

**Insert link** offers an **Existing note** dropdown. Selecting a note fills in
the correct relative `file:` link, including paths between folders. You can also
type or paste a URL or internal link directly.

In source mode, **Cmd-click** a bracketed Org link on macOS, or **Ctrl-click**
on Windows/Linux, to follow it. Ordinary clicks keep editing the text.
Links with `file:note.org::*Heading` targets jump to that heading. Task links in
agenda and calendar views display their label and can be clicked directly.

Use the document's **File actions → Open in new tab**, **Split right**, or
**Split down** to open another view of the same note. Each view has its own
source/preview mode, cursor, folds, and scroll position. Edits share a single
buffer and save to the same file. Closing one view keeps the others open.

Press **Ctrl+W**, then **h/j/k/l**, to focus the split to the left/below/above/right.
This works in source, reading, and planner views; Vim insert mode keeps Ctrl+W's
word-deletion behavior. With a split already present, clicking an Agenda or
Calendar task opens a new note tab in another pane and leaves the planner visible.

Choose **Heading actions → Focus on heading** for a new source-editor tab showing
only that heading and its subtree. Edits and undo use the same underlying file;
surrounding source is protected in that view. **Show whole file** removes the
restriction. Focused tabs restore with the layout when their heading can still be
identified. The preview toggle is disabled while focused.

Bullet lists and checklists with nested content have fold arrows in source and
reading views. Like heading arrows, these appear when you hover the row or focus
the button (and stay visible on touch devices). Folded content is indicated by
an ellipsis in both views. **Cmd-click on macOS or Ctrl-click on Windows/Linux**
folds or unfolds the item and all nested headings, bullet lists, and checklists.
A normal click changes only the parent, retaining its children's fold states.
Their fold state follows edits and mode switches. File actions
begin with **Fold all** and **Unfold all**, including headings, lists, and metadata.

On macOS, tabs share the native title area by default. Drag empty tab-bar space
to move the window; traffic-light controls remain native. Disable **Settings →
Merge tabs with title bar** for a separate draggable title area.

The document's **+ → New task…** opens the task form and inserts a TODO heading
at the cursor when you confirm. Canceling leaves the document unchanged.

The book/pencil toggle carries heading folds and the current reading location
between rendered preview and source. Nested folds remain collapsed when a
parent is reopened. Switching back without scrolling preserves the editor's
cursor/selection and exact scroll offset; scrolling in preview moves the source
view to the corresponding content when you return.

Source mode also has independent fold arrows for Properties and Logbook drawers,
custom drawers, and repeat/clock history. They start collapsed; click the arrow
or labeled ellipsis to reveal the original text. Properties expansion is shared
with rendered preview. Folding metadata never changes the file contents.

Cursor navigation skips collapsed metadata without opening it. Current-line
fold commands target the drawer or history under the cursor, and Fold all /
Unfold all includes metadata as well as headings. Explicit search and note jumps
can still reveal their destination.

Use **Toggle editor / source** (Cmd/Ctrl+E) to switch between rendered preview and
source. Its binding can be changed in Settings → Keyboard shortcuts.
The same command switches Agenda between normal and reading/minimal mode.
New task is hidden and disabled in reading/minimal Agenda.

Vim `j`/`k` counts use source-line offsets, matching the relative line-number
gutter even across folds. Use `gj`/`gk` to move by visible rows instead.

On a folded heading, `dd` cuts the full subtree, including nested headings.
Linewise `p` pastes after the destination's folded subtree; `P` pastes before it.
Moved heading folds are retained, making sibling sections easy to reorder.
Visual-line `V` selections and `yy` also include a folded heading's subtree when
copying; use `Vy` to copy or `Vd` to cut the selected folded section.

The top-right file menu includes **Fold all headings** and **Unfold all headings**
in either view. Folding is view-only. Both views leave half a pane of space below
the document so its final lines can reach the center of the screen.

## Find and replace

Use **Cmd/Ctrl F** or **Find in note** in the command palette to open the
bottom search bar. **Cmd/Ctrl Alt F** focuses the replacement field. These work
with Vi mode on or off. App shortcuts can be reassigned in Settings.

- Enter finds the next match; Shift+Enter finds the previous match. Search wraps.
- Match case, Whole word, and Regex control matching. Matches are highlighted
  and the bar reports the match count. Invalid expressions disable replacement.
- **Replace** replaces the selected match, or first navigates to a match when
  one is not selected. **Replace all** applies one undoable transaction.
- To limit search and replacement, select a range before opening the bar and
  check **In selection**. That range stays fixed while navigating matches and
  adjusts to replacement lengths. Closing the bar clears the selection scope.
- Escape closes the bar and returns keyboard focus to the editor.

Regex uses JavaScript pattern syntax, without enclosing `/` delimiters.
Replacement supports numbered captures (`$1`, `$2`), the whole match (`$&`),
and `$$` for a literal dollar sign. In regex mode, `\n` and `\t` insert a
newline and tab. For example, find `ticket-(\d+)` and replace with `issue-$1`.
With Regex off, search and replacement are literal text.

Edits retain untouched Org source, including mixed line endings between
replacement sites. Finding text inside a folded heading opens the necessary
folds to show the match.

## Vi mode

Enable **Vi mode** in Settings. Each note starts in Normal mode; Escape returns
to Normal. The status bar shows the current mode. This is an editor-integrated
Vim experience, rather than a terminal Vim installation or plugin environment.

| Action | Keys |
| --- | --- |
| Move | `h j k l`, arrows, `w b e`, `W B E` |
| Line boundaries | `0`, `^`, `$` |
| Document / line number | `gg`, `G`, `12G`, `12gg` |
| Paragraphs / matching brackets | `{`, `}`, `%` |
| Find a character / stop before it | `f`, `F`, `t`, `T`, then the character |
| Repeat character find / reverse | `;`, `,` |
| Insert | `i a I A o O` |
| Delete / change / yank | `d`, `c`, `y` followed by a motion or text object |
| Whole lines | `dd`, `cc`, `yy` |
| Paste after / before | `p`, `P` |
| Visual / visual lines | `v`, `V` |
| Replace character / continuous replace | `r`, `R` |
| Substitute / join / indent | `s`, `S`, `J`, `>>`, `<<` |
| Undo / redo / repeat change | `u`, `Ctrl R`, `.` |
| Half-page down / up | `Ctrl D`, `Ctrl U` |
| Center / top / bottom of viewport | `zz`, `zt`, `zb` |
| Search forward / backward | `/`, `?`, then Enter |
| Repeat search / reverse | `n`, `N` |
| Search word under cursor | `*`, `#` |
| Toggle / open / close Org heading | `za`, `zo`, `zc` |
| Open / close all Org headings | `zR`, `zM` |

Counts compose: `3w` moves three words, `2dd` deletes two lines, and `2d3w`
deletes six words. Common text objects include `iw`/`aw` (word), `ip`/`ap`
(paragraph), quotes, and bracket pairs. For example, `ciw` changes a word,
`ci"` changes quoted text, and `di(` deletes inside parentheses. `.` repeats
the last change, including text entered in Insert mode.

The bottom Vim `/` and `?` prompts support regular expressions and integrate
with `n`/`N` and macros. Use Cmd/Ctrl F for the full find/replace interface,
explicit options, and selection scope. These are separate search interfaces;
`n`/`N` repeat the last Vim search.

### Basic macros

1. Type `qa` in Normal mode to record into register **a** (choose `a`–`z`).
2. Perform your edits and movements. Inserted text is recorded too.
3. Return to Normal mode and press `q` to stop recording.
4. Type `@a` to replay, `@@` to replay the last macro, or `3@a` to replay it
   three times.

The bottom prompt displays **recording @a** while recording. Registers are
shared between open notes for this app session and reset when the app reloads.
Macros operate on editor commands and text; app dialogs and toolbar actions
are outside their scope. Use Cmd/Ctrl S to save. App-level keyboard shortcuts
take priority over conflicting Vim bindings.
## Managing files and folders

**New note** asks for a name and a destination folder. You can leave off `.org`;
it is added automatically. The default destination is the current note's folder.
The folder's **⋮** menu offers **New note…** and **New subfolder…**, with that
folder already selected. The prompt shows the resulting path and flags names
that already exist in the destination.

Use **Rename or move…** in a file or folder menu to change its name or choose a
different folder. **Save a copy…** uses the same name-and-folder picker.

To move an item by dragging, drop anywhere inside the destination folder's
expanded area, including over one of its files. The highlighted boundary shows
which folder will receive it; a nested folder takes precedence over its parent.
Drop on **Workspace** or empty file-sidebar space to move to the workspace root.
An item cannot be dropped into itself or one of its descendants.
