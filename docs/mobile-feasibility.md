# Mobile folder feasibility gate

Wails version inspected: **v3.0.0-beta.25**, September 24, 2026.

## Verified from upstream documentation and published APIs

- The same Wails services and frontend have iOS/Android build paths.
- iOS uses WKWebView and a custom in-process asset scheme.
- Android uses WebViewAssetLoader and a Go C shared library built with the NDK.
- iOS dialogs import selected files/directories into the sandbox.
- Android file dialogs import cache copies; directory/save dialogs are unsupported.
- Therefore stock dialogs cannot deliver this product's persistent linked-folder
  semantics. A copy is not a linked workspace.

References: [iOS](https://v3.wails.io/guides/mobile/ios/),
[Android](https://v3.wails.io/guides/mobile/android/).

## Required proof before committing to a mobile release

Implement one minimal platform adapter at a time against `workspace.Store`:

### Android

1. Launch `ACTION_OPEN_DOCUMENT_TREE` from a native host integration.
2. Retain the granted read/write URI permissions via
   `takePersistableUriPermission`; persist the tree URI outside notes.
3. Traverse and operate through DocumentsContract/ContentResolver, not an
   invented POSIX path. Respect provider capability flags.
4. Verify that changes are written to the selected provider's original files.
5. Kill/relaunch, suspend/resume, revoke the grant, rename the folder externally,
   and exercise a provider that cannot atomically replace a document.

### iOS

1. Select a folder using a document picker configured for access rather than copy.
2. Persist/resolve a security-scoped bookmark and balance access calls.
3. Coordinate file operations with the document provider. Handle files that
   must be downloaded, unavailable providers and revoked access without replacing
   originals with empty content.
4. Repeat the same lifecycle and external-change tests on a physical device.

### Shared acceptance test

Open → read → edit in place → verify with another application → restart → retain
access → external edit while suspended → resume/reconcile → preserve both sides
of a conflicting change. Reconcile rather than promising desktop watcher
semantics. A denied/expired grant should produce an actionable reconnect state.

`Store.Write`'s conditional revision is required on both platforms. Atomicity is
capability-dependent: adapters must report failure and retain a recovery copy
when a provider cannot safely replace a document. Do not silently implement
write as truncate-then-write against the only authoritative copy.

## Current evidence and decision

The Linux native host and shared core are implemented. On September 27, 2026,
an ARM64 Android debug APK was built and installed on a physical Pixel 9a.
Native service calls, note creation, editor input, saving, rendered preview,
and persistence across a force-stop/cold relaunch were verified using the app's
private test notebook. See [Android testing](android-testing.md).

This does not pass the linked-folder gate: no Android document-provider adapter,
iOS device proof, or signed store release has been implemented. The local Android
build uses the standard debug signing key. An iOS proof still needs macOS/Xcode.

Keep Wails v3 provisionally. The gate remains **open**, not passed. Failure to
establish a maintainable native integration is a reason to revisit the host
before declaring mobile support. This is independent of desktop MVP progress.
