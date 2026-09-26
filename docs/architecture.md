# Org workspace architecture

Status: implementation plan and decisions, 2026-09-24. The release checklist in
`docs/roadmap.md` distinguishes working functionality from future work.

## Investigation and decisions

### Wails v3

Pin `github.com/wailsapp/wails/v3` to `v3.0.0-beta.25` (released September 22,
2026). Inspected the published module and current documentation, rather than
assuming v2 APIs. Services use `application.NewService`; windows use
`app.Window.NewWithOptions`; dialogs belong to `app.Dialog`. The bundled ES
module `/wails/runtime.js` exposes `Call.ByName` and events, so our vanilla
frontend needs no npm build or third-party JS dependency.

Desktop paths: Go + Xcode command-line tools on macOS; Go + WebView2 on Windows;
Go + GTK4 and WebKitGTK 6.0 on Linux (the optional `gtk3` build tag selects
GTK3/WebKitGTK 4.1). `go run ./app` is the development entrypoint. Native builds
must be checked on each target before claiming support. This implementation uses
Go 1.26 and its confined `os.Root` filesystem APIs. Linux ARM64 native build,
WebView loading and JS-to-Go calls have now passed a real integration probe.

Current upstream mobile tasks are `wails3 task ios:run` and
`wails3 task android:run`, in a generated project containing upstream build
tasks. iOS needs macOS, full Xcode, SDKs and signing; device distribution uses
`ios:package:ipa IOS_PLATFORM=device`. Android needs JDK, SDK API 35, NDK
26.3.11579264 and Gradle; `android:bundle:fat` builds a store AAB. These are
upstream paths, not yet installed project release targets.

Important limitation: iOS open dialogs import sandbox copies; Android open
dialogs import cache copies and its directory/save dialogs return errors.
**Neither is a persistent, writable arbitrary-folder workspace adapter.**
Use security-scoped bookmarks/document coordination on iOS and persisted SAF
tree grants on Android. Do not present an imported copy as a linked folder.
Mobile is experimental; lifecycle suspension invalidates continuous watching.
Reconcile on resume. `ios` implies `darwin`, `android` implies `linux`: desktop
build constraints must explicitly exclude their mobile counterparts.

Sources inspected:
- https://v3.wails.io/tutorials/03-notes-vanilla/
- https://v3.wails.io/guides/mobile/
- https://v3.wails.io/guides/mobile/ios/
- https://v3.wails.io/guides/mobile/android/
- Wails beta.25 `pkg/application` and bundled runtime source.

### Org parser

Choose `niklasfasching/go-org v1.9.1`, a mature parser also used by Hugo.
`goorgeous` is explicitly deprecated and is primarily an HTML converter.
Inspected go-org's document, headline, inline, drawer and HTML writer APIs.

| Construct | go-org support | Workspace approach |
|---|---|---|
| Headings/hierarchy | AST and outline | AST semantics + source line coordinates |
| TODO keywords | `#+TODO`, fast keys | Default TODO/DONE plus configured states |
| Properties/tags | Structured nodes | Index properties even after planning lines |
| Timestamps | Limited active timestamp node | Dedicated civil-date parser |
| SCHEDULED/DEADLINE | No dedicated planning node | Small source-aware metadata scanner |
| Links | Structured regular links | Index targets and resolve local backlinks |
| Drawers | Structured nodes | Preserve bytes; expose properties |
| Lists/checkboxes/tables | Supported | HTML export |
| Source/quote blocks | Supported | Never execute code |
| Inline markup | Supported | Sanitized HTML export |

The AST has no complete byte spans, and OrgWriter pretty-prints. It is **not a
lossless editor serializer**. Retain the original source independently. Save
the user's exact source; structured commands splice verified source spans.
Never write an AST export back over a note. A small lexical scanner only finds
source positions and planning metadata, skipping literal blocks/drawers; it
does not attempt a second complete Org implementation. Fail closed if positions
cannot be associated with semantics reliably.

Unsupported/partial: Babel execution, Lisp, diary expressions, complex repeat
completion semantics, inherited agenda settings, multiple TODO sequences,
clock reports, dynamic blocks, encrypted subtrees, remote includes, transclusion,
LaTeX rendering and custom exporters. All survive unrelated source edits.
Unknown constructs may be absent from preview; edit mode always exposes them.
go-org's default scanner has a 64 KiB line limit: preview failure must never
block source access or saving. Includes are disabled; parsing cannot read files
outside the opened document.

## Boundaries and repository

`app/` is the native Wails host, frontend and a loopback-only development host.
`internal/workspace/` owns storage, index, search and application services.
`internal/orgdoc/` owns rendering, source coordinates and semantic metadata.
`internal/orgdate/` owns civil dates, times and timestamp interpretation.
`server/` will be an independent module containing optional paid sync.
Deleting `server/` must not affect client tests, builds or local use.

No account, network, subscription or database is on the local read/write path.
Platform dialogs stay in the host. Business logic receives a folder store,
not Wails, UIKit, JNI, S3 or browser objects. Avoid interfaces for services with
only one implementation; storage is the intentionally narrow exception.

## Filesystem and ownership

The frontend keeps one buffer and one editor surface per open file. Built-in
views use the same persistent tab/group layout as notes. `app/ui/tab-layout.js`
owns the split tree, drag/drop, resizing, and per-workspace layout restoration.
Surfaces keep a stable DOM parent while their bounds change. The locally bundled
CodeMirror editor (`app/editor/source.js`) owns selection, wrapping and undo;
decorations style Org syntax and supply task checkboxes without changing source.
See `app/editor/README.md` for rebuilding the checked-in bundle and licenses.
Each document scopes its editor, preview, cursor, timers and asynchronous results
to its own surface. Preview heading IDs are namespaced across open documents.

Typing schedules a conditional save after 600 ms of inactivity. Saves serialize
per file and schedule another pass if edits arrive during a write. All open
Agenda/Calendar views refresh from saved workspace data. External revisions and
write failures preserve the local buffer; native quit waits for pending writes.

`Service.Calendar` retains completed entries and their start/end times, while
`Service.Agenda` excludes completed tasks. Day/week grids place timed appointments
in duration-sized blocks and allocate separate lanes for overlapping events.
Task dialogs call the source-splicing `task` heading operation; completion uses
the document's configured pending/done keywords. Neither operation serializes
an AST over the original file.

A workspace is a normal directory. Opening it indexes existing `.org` files
without import or migration. `Store` provides list/read/conditional-write,
mkdir, rename and remove. Paths are relative, slash-separated identifiers;
`os.Root` confines desktop access. Reject symlinks, traversal and internal
temporary names. Preserve file modes. Writes use same-directory temporary
files, flush, revision recheck, rename and directory sync where supported.

Revisions are SHA-256 of actual file bytes, not mtime. Reads return a revision;
writes require it. Stale writes return a conflict and leave the editor buffer
intact. No silent last-writer-wins. A final check narrows but cannot eliminate
the filesystem race with uncooperative external writers; portable filesystems
offer no atomic compare-and-swap. Release hardening includes recovery history
and cross-process tests. Delete is explicit and confirmed in the UI; do not
recursively remove nonempty directories.

fsnotify watches every directory, debounces duplicate events, and reconciles
content hashes after atomic saves and moves. Periodic full scans recover missed
events. Reconcile watcher registrations after directory changes. Self-writes
are naturally deduplicated by revision. Clean editor buffers reload; dirty
buffers retain their content and show a conflict. Never overwrite on reload.
External Git, Emacs, Syncthing, Dropbox and rsync remain ordinary peers.

## Document/index/editor

The in-memory index maps relative paths to source revisions, headings, hierarchy,
states, tags, properties, links and dates. It can be deleted and rebuilt from
the files. No persistence needed initially. Search scans this snapshot and
returns file/line/context. Backlinks resolve relative `file:` links; stable
`ID:` resolution is an explicit later milestone.

Use vanilla JS modules and semantic HTML. Start with a native textarea and a
synchronized highlighting layer: browser input, selection, IME and undo stay
native. Source remains visible and authoritative. Preview uses go-org plus an
HTML allowlist; raw HTML/script cannot run. Chroma supplies source-block token
classes with local CSS; it adds no frontend dependency. Local raster images are
rewritten to inert placeholders, then loaded as data URIs through the confined
store after MIME checks. Remote images do not load. Tabs keep independent buffers and
revision tokens; async responses must never replace a newer edit or another
tab. Explicit save is initially preferable to unsafe auto-save. Commands edit
source, not a shadow rich-text document. Mobile layout collapses side panels.

## Agenda/date architecture

Store dates as `YYYY-MM-DD` civil dates, with optional local wall-clock times;
do not round-trip all-day dates through UTC JavaScript Date. Central Go parsing
validates calendar dates and times, captures source spans, distinguishes active
and inactive timestamps, planning kinds, ranges and repeaters. Agenda derives
from the index; completed tasks do not count as overdue. Initial repeaters are
preserved and displayed, not silently advanced. DST-sensitive recurrence and
completion policies require tests before automated edits ship.

List and calendar share entries and filters, and navigate to exact source
headings. Calendar editing is a conditional source splice. Ambiguous ranges,
repeaters or overlapping source spans must stay read-only until semantics are
defined. Calendar never stores independent events.

## Optional hosted sync (planned, not a local prerequisite)

One independent Go HTTP service, SQLite WAL for accounts/workspaces/revisions,
S3-compatible storage for content-addressed blobs, Stripe Billing for paid
entitlements. Server-rendered account/billing pages, minimal JS. No Redis,
queues, microservices or Kubernetes. SQLite backups and object retention need
a documented, tested joint restore procedure.

Protocol: authenticated devices exchange manifests (path, hash, parent revision,
size, tombstone). Upload blobs first, then commit manifest with compare-and-swap
against server revision in a SQLite transaction. Retry operations are idempotent.
Three-way merge only when edits are demonstrably disjoint; otherwise preserve
both plaintext versions as clearly named conflict files and offer resolution.
Retain tombstones for offline devices. Renames carry identity where known;
external delete/create pairs remain valid. Never conflate a billing failure with
permission to alter local files. Cancellation disables hosted transport only.

Do not run hosted and third-party sync over one folder without explicit user
choice; both remain optional. Encryption/key management must be decided and
implemented before hosting real user notes. Do not claim end-to-end encryption
on the basis of TLS or S3 server-side encryption.

## Security and release

Untrusted notes are data. No Babel, shell, Lisp, includes or unrestricted HTML.
Sanitize preview; deny remote image fetches by default. External links require
an allowed scheme and host-mediated opening. Never expose arbitrary absolute
paths through bindings. Native mode uses in-process assets/bindings. The dev
HTTP host binds loopback, checks request origin and requires JSON for mutations.
Credentials eventually live in platform secure storage, not workspaces.

Sync must authenticate/authorize every workspace operation, bound upload sizes,
verify hashes and Stripe webhook signatures, use expiring sessions and protect
browser forms against CSRF. Logs must not contain notes or secrets.

Release gates: race-tested filesystem/conflict/date behavior; keyboard and
screen-reader UX; performance on real large workspaces; native smoke tests on
each desktop OS; mobile persistent-access/resume/device tests; signed macOS and
Windows packages, Linux bundles; mobile store signing; tested upgrades and
rollback. Architecture compatibility is not evidence of a working release.
