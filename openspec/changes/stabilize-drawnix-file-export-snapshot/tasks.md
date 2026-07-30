## 1. Evidence and approval

- [x] 1.1 Trace menu/hotkey/command save entry through serialization, embedded-media cache reads, file save and import restoration.
- [x] 1.2 Reproduce a live-board edit during a deferred media lookup and record exported element IDs, embedded URLs and cache-read count.
- [x] 1.3 Search specs, active changes and permanent tests; record the new capability owner and adjacent non-overlap boundaries.
- [ ] 1.4 Obtain explicit user approval before modifying runtime serialization or permanent tests.

## 2. Point-in-time serialization

- [ ] 2.1 Add a JSON-compatible element/viewport snapshot boundary before the first asynchronous media operation.
- [ ] 2.2 Collect embedded media and construct `DrawnixExportedData` from the same captured snapshot.
- [ ] 2.3 Preserve type/version/source, MIME, extension, abort, cache and import formats without a migration.
- [ ] 2.4 Keep the live board editable and avoid any board mutation, history entry, autosave write or cache rewrite during snapshot capture.

## 3. Tests and measurements

- [ ] 3.1 Add deferred insert/delete/property/viewport race tests that prove structural/media alignment.
- [ ] 3.2 Add no-media, multiple-field, duplicate, cache/blob/JSON failure and abort coverage.
- [ ] 3.3 Add version-1 round-trip fixtures with and without embedded media.
- [ ] 3.4 Measure at least five comparable small and large synthetic saves before/after; record median, range and memory evidence if available without claiming unsupported improvement.

## 4. Verification and documentation

- [ ] 4.1 Run focused tests and Drawnix typecheck/lint comparison with commands, exit codes and statistics.
- [ ] 4.2 Run the delayed-cache browser save/edit/import flow with synthetic local media and record same-state screenshots and recovery behavior.
- [ ] 4.3 Run full typecheck/test comparison, cycles, build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-29 evidence/ledger and file-format developer documentation if the snapshot boundary or tests are documented.
- [ ] 4.5 Rewalk save/import/media restoration and record rollback and remaining missing-media/error-feedback risks.

