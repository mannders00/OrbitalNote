# Disposable WebAssembly demo

The marketing hero embeds **the real app** on an isolated static origin. The Go
workspace service, Org parser, structured editing, indexing, Agenda and Calendar
are imported directly. The frontend JS/CSS/vendor assets are copied byte-for-byte
from `app/ui` on every build. No fork, hand-maintained mock API or app-source edits.

## Local preview

The full website checkout includes the two-origin hero preview and browser tests:

```sh
go test -race ./demo
python3 scripts/build_demo.py
python3 scripts/serve_demo.py
```

- Website: http://127.0.0.1:9270 — the live demo loads automatically.
- Static demo: http://127.0.0.1:9271.
- Browser checks: `node scripts/demo-smoke.mjs` (Playwright installed).
  Set `BROWSER=webkit` for WebKit; `CHROMIUM` can override the Chrome executable.

In the public app-only checkout (which excludes the marketing site), build with
`python3 scripts/build_demo.py` and preview the standalone app with
`python3 -m http.server 9271 --bind 127.0.0.1 --directory bin/demo`.
CI rebuilds and uploads the static demo artifact on every app push/PR.

`bin/demo` is generated, ignored output. Build again after app changes. Only the
generated HTML shell changes: its script entry point bootstraps the worker and
then imports the original `app.js`; its CSP permits WASM; demo-only CSS hides
unavailable native controls. `source-manifest.json` records the source asset hashes.

## Runtime / disposal

- Each iframe gets a new worker, Go service, and revision-checked memory store.
- The unchanged `/api` fetch transport is intercepted in the iframe before app
  startup. Requests go through worker messages, **never an HTTP API**.
- `localStorage` and `sessionStorage` are shadowed by per-document memory stores
  before app imports. Existing website/browser storage is not read or cleared.
- Refresh, Reset, or a new tab seeds the original notes and fresh preferences.
  Refresh also discards an edit still waiting for autosave, without the native
  app's unsaved-edit leave prompt. Back/forward-cache restoration also reloads. Closing/removing an iframe discards
  its worker. No IndexedDB, service worker, persisted vault, account, or server data.
- Dates use the visitor's local civil day, so sample tasks remain relevant.
- Demo limits: 4 MiB of note contents, 128 files/folders, bounded queued requests,
  startup timeout and operation timeout (terminate worker and offer reset).
- File selection, Sync and account APIs are not exposed. Drops of browser files,
  external links and popups are blocked. Clipboard permissions are not granted.
  Ordinary editor paste may still work through browser user gestures; it is local
  and disposable. This is not a place to import or keep valuable notes.
- No network services run in WASM. The iframe's CSP limits resource requests to
  its static origin and data images; the host iframe disallows top navigation,
  popups, downloads and native device permissions.

The host exchanges only `ready`, `failed`, and `escape` messages, checks origin
and frame identity, and never receives document contents. Expand uses a page
overlay with a visible exit button; Escape exits unless an app popover/dialog
needs it. The demo loads automatically without scrolling the homepage. The
screenshot stays visible until the app is ready, and remains with a retry action
on load failure.

## Publishing

Build in CI alongside the app, and deploy **the generated `bin/demo` directory**
to `https://demo.orbitalnote.org/`. Use a dedicated origin without auth cookies or
other applications. Do not host this sandbox on the marketing site's own origin:
the iframe allows scripts and same-origin so workers/modules run normally, while
cross-origin isolation protects the parent website. `demo/Caddyfile` is an example
static-host configuration, not an automatic production change.

Serve `.wasm` as `application/wasm`, enable compression, and publish the directory
atomically so `wasm_exec.js` always matches the Go toolchain used for the engine.
The checked-in hero points to that origin; the local preview rewrites only the
served hero URL to the second local port. The website's checked-in Caddy template
permits that origin in `frame-src`. No COOP/COEP or cross-origin shared memory is required.

Keep the app's GPL license, NOTICE and dependency notices with the bundle; publish
the corresponding source revision with releases (including demo code and build
scripts). The binary is larger than a screenshot, so compression matters.
Browser support is verified in Chromium and WebKit; actual
low-memory phones and slow-network startup still deserve device testing before
public release. No production configuration or deployment is performed by these
scripts.
