# Contributing to OrbitalNote

Thank you for helping make local-first tools more approachable.

- Open an issue with steps to reproduce, OS, version and a minimal **synthetic**
  `.org` example. Please do not post private notes.
- For a feature, describe the workflow before proposing an implementation.
- Keep Org source intact: never round-trip user files through an HTML renderer
  or AST exporter. Preserve unknown syntax and untouched line endings.
- Run `scripts/check.sh` with your platform's native dependencies installed.
  `go test ./internal/...` works without the desktop toolkit.
- If changing the bundled editor, follow `app/editor/README.md` and include the
  generated bundle and dependency notices.

Contributions are made under GPL-3.0-only. Third-party code must have compatible
licensing and retain its notices. No CLA or copyright assignment is required.

The public repository contains the complete desktop client. The marketing site,
billing and future hosted Sync service are maintained separately. Sync is not
required to build or use the app. Native mobile clients are not available yet.
