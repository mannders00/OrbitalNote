# Editing, Vi keys, and search

## Reading and source views

The book/pencil toggle carries heading folds and the current reading location
between rendered preview and source. Nested folds remain collapsed when a
parent is reopened. Switching back without scrolling preserves the editor's
cursor/selection and exact scroll offset; scrolling in preview moves the source
view to the corresponding content when you return.

Source mode also has independent fold arrows for Properties and Logbook drawers,
custom drawers, and repeat/clock history. They start collapsed; click the arrow
or labeled ellipsis to reveal the original text. Properties expansion is shared
with rendered preview. Folding metadata never changes the file contents.

Vim `j`/`k` counts use source-line offsets, matching the relative line-number
gutter even across folds. Use `gj`/`gk` to move by visible rows instead.

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
