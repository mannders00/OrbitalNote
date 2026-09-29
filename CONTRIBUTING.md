# Contributing to OrbitalNote

Thank you for helping make local-first tools more approachable.

## Join the conversation

- [Discussions](https://github.com/mannders00/OrbitalNote/discussions): questions,
  workflows, ideas, and sharing how you use OrbitalNote.
- [Issues](https://github.com/mannders00/OrbitalNote/issues): reproducible bugs and
  concrete improvements. Templates help capture the context needed to act.
- [Work history and roadmap](docs/roadmap.md): delivered features, work in local
  testing, and open problems. Retrospective issues document earlier work.

Search existing issues before opening a new one. Add a reaction to an existing
request, or comment with your workflow and examples. No coding is needed to help:
try preview builds, improve documentation, report accessibility problems, or
share small synthetic Org examples that expose compatibility gaps.

## Working on a change

For a substantial change, discuss the approach in an issue first. For a small fix,
feel free to open a pull request directly. Keep each PR focused, link its issue,
explain the user-visible change, and list what you tested. Include screenshots for
visual changes and identify the platform used for native behavior changes.

Issues marked `help wanted` welcome contributions. `good first issue` is reserved
for small, well-scoped tasks. Ask for context if an issue is unclear. Maintainer
review is asynchronous; an open request is not a promised release date.

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

The public repository contains the desktop and mobile clients. The marketing
site, billing, and hosted Sync service are maintained separately. Sync is not
required to build or use the app. Android APK previews are available; iOS builds
currently target the Simulator.
