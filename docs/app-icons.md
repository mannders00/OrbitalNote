# Platform app icons

`app/ui/mark.svg` is the app artwork source. Regenerate every platform variant
together from the repository root (requires Playwright and a Chromium browser):

```sh
CHROMIUM=/path/to/chromium bun scripts/render-brand.mjs --app-only
bun scripts/check-icons.mjs
CHROMIUM=/path/to/chromium bun scripts/check-brand.mjs
```

Commit the generated PNGs and `app/build/icon-manifest.json` with any artwork or
renderer changes. The lightweight manifest check runs in CI and before release
builds. The browser check verifies sizes, transparency, and Android's safe circle;
its launcher preview is written to `ICON_PREVIEW_DIR` (default `/tmp/opencode`).

- **macOS:** `app/build/icon.png` is resized into the bundle's `AppIcon.icns`.
- **Windows:** `app/build/windows.json` embeds `icon.png` in the executable.
- **Linux:** the native application embeds `app/build/icon.png` as its window icon.
- **iOS:** `app/build/icon-ios.png` is opaque and full-bleed; the build creates
  iPhone/iPad icon sizes and registers them in `Info.plist`.
- **Android:** `app/build/android/res` contains adaptive background/foreground
  layers plus five legacy launcher densities. Both manifest icon references use
  `@mipmap/ic_launcher`. The APK build copies these checked-in resources.

Mobile variants omit the desktop tile edge so the OS can apply its own mask.
`--app-only` works in the public client repository without website assets.
