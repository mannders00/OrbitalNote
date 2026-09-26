# Delivery stages

Work proceeds in order. A prototype is not a release.

1. **Architecture:** inspect pinned Wails and parser APIs, record boundaries and
   preservation guarantees.
2. **Functional local MVP:** safe folder access, source/preview, in-memory index,
   search, agenda, calendar, watching, conflict handling and focused tests.
3. **Polished local application:** complete editor commands, file navigation,
   recovery history, accessibility, performance and native platform verification.
4. **Hosted sync:** protocol conflict tests first, then independent Go/SQLite/S3
   service, authentication, billing and tested backup/restore.
5. **Mobile:** persistent iOS/SAF adapters, lifecycle and touch editing, physical
   device tests. Never disguise imports as live folders.
6. **Packaging/release:** signed artifacts and CI matrix, reproducible builds,
   licensing, release notes, upgrade/rollback verification.

See README for the current implementation and actual verification results.

## Current checkpoint — September 24, 2026

- Architecture investigation and design recorded.
- Functional desktop MVP implemented; native Linux ARM64 and browser interaction
  probes pass. Source preservation, conditional writes, parser/date behavior,
  subtree edits, directory operations and watcher tests pass.
- Local polish underway, not complete. Next correctness work: durable recovery,
  the unavoidable external-writer check/rename race, richer conflict resolution,
  recurrence semantics and large-workspace profiling. Next UX work: keyboard/
  screen-reader audit, complete event resizing and native platform verification.
- Mobile feasibility gate is documented in `mobile-feasibility.md` and remains
  open. It must be proved before committing to native mobile delivery.
- Hosted sync implementation has not started. Its module boundary and protocol
  design are documented; no billing/service dependency is present in the client.
- Unsigned native packaging script and desktop CI build matrix are present.
  A Linux ARM64 artifact was built locally. CI on other operating systems,
  signing, store distribution and production release remain unverified.
