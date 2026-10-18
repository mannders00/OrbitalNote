# Self-hosted OrbitalNote Sync

The Sync daemon is a separate source-available product under the Sustainable Use
License 1.0. The native client remains GPL-3.0-only. The products communicate over
HTTP; neither export includes the other's implementation or license.

Daemon repository: https://github.com/mannders00/orbitalnote-sync

## Compatible public builds

Download **both** components for the initial supported self-hosting combination:

- [OrbitalNote client 0.1.0-preview.23](https://github.com/mannders00/OrbitalNote/releases/tag/v0.1.0-preview.23):
  macOS Apple Silicon/Intel, Windows x64, Linux x64, and Android ARM64.
- [OrbitalNote Sync daemon 0.1.0-preview.1](https://github.com/mannders00/orbitalnote-sync/releases/tag/v0.1.0-preview.1):
  Linux amd64/arm64, macOS Apple Silicon/Intel, and Windows x64.

Install the client on each device and run one daemon on the server. Their version
numbers are independent. Older hosted-only clients do not offer the URL setting.
The client release workflow tests its sync implementation against this exact
published daemon binary before making client downloads available.

For daemon installation, invitation setup, HTTPS, and backups, follow the
[daemon README](https://github.com/mannders00/orbitalnote-sync#quick-start).

## Connect the client

Open **Settings → OrbitalNote Sync**, choose **Self-hosted server**, and enter the
HTTPS origin of your daemon, for example `https://sync.example.com`. Register on
that server using the operator's invitation, sign in from the app, and approve
the device code in your browser. Create an encrypted workspace on your first
device and save its recovery key; join with that key on subsequent devices.

The hosted OrbitalNote service remains the default. Credentials are stored with
their server origin and are only sent there. Disconnect before changing servers.
Disconnecting keeps local files. Server-side history and accounts do not migrate
when switching services. HTTP is allowed only for localhost development.

## Maintainer workflow

The internal source of truth is `server/`. The daemon uses `-tags daemon`; the
managed-hosting build uses the default build. Both share the sync protocol,
authentication, SQLite schema, and encrypted-revision implementation.

```sh
bash scripts/check-daemon.sh
bash scripts/check-sync.sh
bash server/daemon/build-daemon.sh
bash scripts/publish-daemon.sh --dry-run
bash scripts/publish-daemon.sh --release 0.1.0-preview.1
```

The publisher exports an explicit allowlist into a disposable clone, tests that
standalone snapshot, and pushes it to the daemon repository without internal Git
history. Use `--output NEW_DIRECTORY` for an offline local snapshot. The export
contains the Sustainable Use License, self-hosting documentation, packaging
script, and its own GitHub check/release workflow. Releases package Linux amd64
and arm64, macOS amd64 and arm64, and Windows amd64, with dependency notices and
SHA-256 checksums. Repository visibility is managed separately.

`scripts/publish-oss` continues publishing only the GPL client. Its export must
never include `server/`. `scripts/publish_daemon_test.py` checks this boundary.
Publish a new client release to make the server selector available to users;
older hosted-only clients cannot select a daemon URL.

### Native macOS end-to-end verification

Build the updated desktop app before testing the server selector:

```sh
VERSION=0.1.0-selfhost-test bash scripts/build-macos-arm64.sh
python3 scripts/check-native-sync.py /path/to/extracted/orbitalnote-sync
```

The native probe uses the actual production WebView, settings controller, Wails
Host bindings, Keychain implementation, and sync engine. Go build overlays add
the driver and redirect the initial workspace and preference directory to
temporary fixtures; they do not alter the shipping app or mock sync operations.
It enters a local daemon URL through the settings controls, signs in, approves
the device using the real HTTP/CSRF account flow, creates an encrypted workspace,
and exchanges notes with an independently authorized peer. It then closes and
relaunches the native app to verify the saved origin, Keychain credentials, and
automatic sync restoration, before disconnecting and cleaning up its test key.
The probe uses the visible **Check sign-in** action if automatic approval has
not completed; its wait clock uses native calls to avoid WebKit background timer
throttling while the authorization browser is in front. Screen capture is not
required. Run it in a macOS graphical session with the login Keychain available.

Verified against the downloaded `v0.1.0-preview.1` macOS arm64 daemon package
(checksum checked), including bidirectional sync and native app restart.

This GitHub publication workflow is separate from deployment of managed Sync.
For managed Sync, make and test changes locally; the user pushes to Gitea and
pulls on EC2 before authorized deployment checks.
