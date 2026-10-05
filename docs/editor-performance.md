# Editor input performance

## October 5, 2026 investigation

A report of approximately one-second input catch-up on a 2019 MacBook prompted
profiling of the input path. Wails hosts a browser engine: synchronous JavaScript,
DOM traversal, layout, and painting can block input even when native file I/O is fast.

### Reproduction

Run `scripts/editor-performance.mjs` against `app/dev` with a **disposable workspace**.
The script creates Org fixtures containing headings, property drawers, paragraphs,
inline formatting, and links. It exercises unfolded/folded Vim j/k bursts and
single-character paragraph edits. It checks browser errors and can export Chrome
CPU profiles via `PROFILE_PREFIX=/path/to/editor-profile`.

Environment variables: `BASE_URL`, `CPU_RATE` (default 4), `SIZES` (default
`100,1000`), and optional `CHROMIUM`. Playwright must be available to the script.

Measurements use browser-side timers including synchronous handlers and their
microtasks, plus frame timing after each eight-motion burst. They exclude automation
transport time. These are synthetic measurements, not physical key-to-pixel latency.
CPU throttling does not reproduce a particular MacBook or WebKit version.

### Findings and changes

- Status updates searched the entire note surface, including hidden preview DOM,
  several times per motion. Cache fixed UI nodes, use CodeMirror's indexed line
  lookup, and coalesce selection notifications into one status update per frame.
- Every key searched the entire document for open dialogs. Use the live collection
  of dialog elements instead.
- The Vim command-completion hook reparsed every heading just to keep the cursor
  outside a fold ellipsis. Query folds at the cursor and inspect that source line.
- Selection filtering traversed every fold. Query only folds intersecting each
  selection endpoint.
- Every character rebuilt all source decorations. For nonstructural single-line
  prose changes, map existing decorations and re-tokenize the changed line. Heading,
  block, drawer, and multiline changes retain the full rebuild path. Widget actions
  resolve their current source positions rather than retaining stale offsets.
- Every character rebuilt tab layout even while dirty state was unchanged. Update
  tab layout on dirty-state transitions instead.
- Hidden reading views were rendered after source edits. Render them when entered;
  other reading-mode views still receive updates. Reuse unchanged Outline DOM.

### Same-machine results (Chrome, 4× CPU throttle)

1,000 headings / approximately 148 KB / 7,000 source lines:

| Operation | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Unfolded Vim motion | 11.0 / 15.0 ms | 1.8 / 3.1 ms |
| Folded Vim motion | 12.4 / 15.1 ms | 2.8 / 5.2 ms |
| Paragraph edit | 30.6 / 40.4 ms | 5.5 / 8.9 ms |

At 5,000 headings (approximately 748 KB), the optimized run measured unfolded
motion p95 4.7 ms, folded motion p95 14.1 ms, and paragraph-edit p95 15.7 ms.
These are single-run observations, not guaranteed latency bounds.

### Verification and remaining work

`editor-incremental-smoke.mjs` compares incremental rendered styles with a full
rebuild and exercises mapped heading widgets. Vim/search, document-view/fold, and
multiple-view browser checks cover behavior around the optimized paths.

Still measure on the reported 2019 MacBook using its actual file and native WebKit
build. Structural edits still rebuild decorations, fully folded very large files
cost more than unfolded motions, and visible preview generation/save-refresh work
can still produce pauses. Future measurements should include long lines, large
code blocks, sustained typing across autosaves, and multiple visible previews.
