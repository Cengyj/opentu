## 1. Evidence and approval

- [x] 1.1 Trace menu/hotkey/command entries through file, JSON, media cache, board and feedback boundaries.
- [x] 1.2 Reproduce Promise observation, export cache miss and import cache-write rejection with synthetic diagnostics; record counts and delete probes.
- [x] 1.3 Search i18n, tests, specs, active changes and every current helper caller; record non-overlap and compatibility risks.
- [ ] 1.4 Obtain explicit user approval before changing runtime outcome types, UI feedback, copy, translations or permanent tests.

## 2. Typed file/media outcomes

- [ ] 2.1 Add aggregate-safe embedded-media collect/restore outcomes without persisted URLs or schema changes.
- [ ] 2.2 Propagate complete/partial/cancelled/failed outcomes through save/open helpers with compatibility for all audited callers.
- [ ] 2.3 Keep invalid/open failure and cancellation non-mutating; preserve current successful import history/reset/render/autosave behavior.
- [ ] 2.4 Preserve the version-1 file fields, MIME, extension, cache keys and migration-free import compatibility.

## 3. Entry feedback and copy

- [ ] 3.1 Consume save/open completion exactly once in the application menu with localized error/partial feedback.
- [ ] 3.2 Consume save completion exactly once in hotkey and command-palette paths without duplicate messages.
- [ ] 3.3 Localize image-export failure and correct command-palette save copy while preserving IDs, shortcuts and execution.
- [ ] 3.4 Keep cancellation silent and leave each existing action available for manual retry.

## 4. Tests and verification

- [ ] 4.1 Add data tests for complete/partial/failure/cancel/mixed media and invalid files without raw URL leakage.
- [ ] 4.2 Add menu/hotkey/command/image caller tests for zh/en, exactly-once outcomes and current-board preservation.
- [ ] 4.3 Run focused tests and Drawnix typecheck/lint comparison, recording commands, exit codes and statistics.
- [ ] 4.4 Run synthetic browser complete/partial/invalid/cancel paths at desktop/compact widths in zh/en; record board state, reload and screenshots.
- [ ] 4.5 Run full typecheck/test comparison, cycles, build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.6 Update F-29 evidence/ledger and documentation; rewalk all entries, rollback and remaining risks.

