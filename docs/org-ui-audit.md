# Org UI audit — preview.9

This is an 80/20 workflow audit, not a promise to reproduce every Emacs Org
feature. This audit describes the scope of 0.1.0-preview.9.

| Everyday workflow | Current coverage | This iteration / remaining gap |
| --- | --- | --- |
| Notes and outlines | Source-preserving editor, reading view, heading commands, subtree moves and folding | Heading kebab exposes structure/task/metadata actions |
| Tasks | Custom TODO sequences, agenda completion, scheduling, deadlines, time ranges | Click the task-state text to complete/reopen; red pending, green done; no separate heading checkbox |
| Tags and properties | Parsed/indexed, tag colors, properties visible in preview/sidebar | Heading menu and configurable palette commands edit tags, an individual property, or priority without rewriting the subtree |
| Agenda views | Date presets, text/type search, clickable compound rules | Compact filter-chip group with rule popup, all/any matching, and workspace-local saved named views |
| Navigation | Filename picker, content search, tabs/splits, outline and backlinks | Distinct icons, tab insertion marker, file/folder action menus |
| Text formatting | Org bold, italic, code, underline, strike, lists, checkboxes and tables render | Insert/format menu plus assignable commands for common formatting and starter blocks; table cell tooling and list auto-continuation still merit follow-up |
| Images | Confined local image loading in reading preview | Image insertion dialog; image paste/import, resize/caption UI and encrypted attachment Sync remain follow-ups |
| Diagrams | Previously showed source only | Bundled offline Mermaid rendering in reading preview, source disclosure, insertion command, visible fallback on syntax errors |
| Math | Previously retained source text | Bundled offline KaTeX inline/display math and `src latex` math blocks; insertion commands. Full LaTeX documents/packages are not supported by KaTeX |
| Code | Syntax-highlighted Org source blocks | Insert code/quote blocks. Code execution/Babel is not part of this iteration |
| Ownership | Source spans, native files, undo, conflict-buffer retention | Metadata edits preserve unrelated drawers, planning, descendants and line endings |

## Interaction contract

Every new heading action and insertion action appears in the command palette and
can receive a shortcut in Settings. Hover controls are also keyboard reachable;
touch devices show them without hover. Commands operate on the current heading.
Menus expose common actions; raw Org remains available for advanced syntax.

## Next high-value work

1. Accessibility and mobile-device validation of the new menus/popups.
2. Saved-view management refinements based on real workflows.
3. Image paste/import and caption/size controls; attachment Sync separately.
4. Table editing, list continuation, repeater semantics, and event resizing.
5. Footnote/citation insertion and better link-to-heading selection if user
   workflows demonstrate demand.

Clocking, habits, full Babel execution, export pipelines, and advanced Org query
languages remain outside the everyday UI baseline. Unknown source is preserved.
