# OrbitalNote on macOS

Install Go 1.26+ and Apple's command-line tools (`xcode-select --install`).
No Node, Bun or Wails CLI is needed to build the checked-in client.

```sh
bash scripts/build-macos-arm64.sh
open "bin/orbitalnote-0.1.0-preview-darwin-arm64/OrbitalNote.app"
```

For Intel, run `ARCH=amd64 bash scripts/build-macos-arm64.sh`. You can set
`VERSION=0.1.0-preview.1` to match a release. Packaging verifies the architecture,
bundle plist and ad-hoc signature, and includes examples and license notices.

Public previews are **not notarized**. After extracting a GitHub release archive,
macOS may ask you to allow OrbitalNote in System Settings → Privacy & Security
following the first launch attempt. No system-wide security setting is needed.

Use a copy of `examples/Welcome` for testing. Check folder selection, save and
reload, preview, calendar/agenda updates, task checkboxes, source-preserving
editing, tab splits, native zoom and quit with pending saves. Test key repeat
and text prompts in the native app, not only a browser.

The app remembers its last folder in the macOS user configuration directory
under `OrbitalNote/preferences.json`. Notes always remain in your chosen folder.
The bundle identifier is `net.masoftware.orbitalnote`.

```sh
"bin/orbitalnote-0.1.0-preview-darwin-arm64/OrbitalNote.app/Contents/MacOS/orbitalnote" "/absolute/path/to/Notes"
```
