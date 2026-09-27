# Native mobile previews

GitHub Actions builds the same pinned Wails application for desktop, Android
ARM64 and iOS ARM64 Simulator. `Checks` uploads development artifacts on pushes
and pull requests. `Native preview release` builds all platforms on a version tag
and publishes desktop and Android downloads after their builds succeed. iOS
Simulator builds remain separate Actions artifacts and do not block downloads.

## Android release signing

Configure these GitHub repository Actions secrets before tagging a release:

For the current sideloadable preview, these are configured using the existing
development signing key so APK updates can preserve the device-testing notebook.
No Play Store enrollment is required. A dedicated distribution key can be adopted
later alongside the official release process.

- `ANDROID_KEYSTORE_BASE64`: base64-encoded persistent release keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep an offline backup of the key and passwords. Never commit them. The release
job intentionally fails if signing is missing instead of publishing a debug APK.
The APK uses application ID `com.orbitalnote.preview`, with the release workflow
run number as its monotonically increasing version code. Keep that numbering
when migrating workflows. A release-key APK cannot update a developer-debug-key
installation in place. Preserve/recover the notebook through Sync before changing
signing identities; do not uninstall a user's debug app as part of deployment.

Local builds: `bash scripts/build-android.sh`; `--install` updates a connected
phone without uninstalling. For release packaging set `ANDROID_BUILD_TYPE=release`,
`VERSION`, `ANDROID_VERSION_CODE`, `ANDROID_KEYSTORE` (absolute path) and the three
signing credentials above. CI pins SDK 35, build tools 35.0.0 and NDK 28.2.13676358.

## iOS

`bash scripts/build-ios.sh` requires Xcode and creates an ad-hoc-signed ARM64
Simulator `.app` ZIP. Install the extracted app with:

```sh
xcrun simctl install booted bin/ios-simulator/OrbitalNote.app
xcrun simctl launch booted com.orbitalnote.preview
```

The native UIKit entry point opens a persistent private notebook, uses native
Safari for account authorization and Keychain for Sync credentials, and pauses
Sync while backgrounded. Linked Files-provider folders are not implemented.

This is not an iPhone-installable IPA. Apple Developer enrollment, a registered
bundle ID, signing/provisioning, and App Store Connect/TestFlight configuration
are still needed for device distribution. Do not advertise simulator ZIPs as
consumer iOS downloads. Real-device iOS Sync remains to be validated.

## Website release handoff

The platform picker resolves actual assets from GitHub releases, including
prereleases; it never sends customers to the GitHub Assets list. If GitHub's API
is unavailable, verified pinned desktop downloads remain available, explicitly
labelled as older builds without Sync. Android is only offered once a matching
signed release asset exists. iOS currently explains its availability status.

Publish the new client release before promoting the Sync purchase funnel.
Deploy `web/` via the normal Gitea pull workflow. The Caddy CSP needs
`connect-src 'self' https://api.github.com` for fresh release discovery; ask for
authorization before changing production Caddy configuration.

The interactive website demonstration is in-memory only. It sends no note content
to Sync and resets on reload. Native Sync and Stripe signup remain real services.
