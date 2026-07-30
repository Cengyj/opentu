# Tasks: Localize the knowledge-base interface

## 1. Evidence and approval

- [x] 1.1 Confirm application `zh/en` support and trace language ownership to reachable tool adapters/components.
- [x] 1.2 Inventory knowledge-base visible/accessibility strings without treating comments/data identifiers as defects.
- [x] 1.3 Identify canonical stored directory names, default titles, dates, errors, and import/export boundaries.
- [x] 1.4 Confirm existing user data, schemas, routing identifiers, and backup formats require no migration.
- [ ] 1.5 Obtain user approval for localized surfaces, display aliases, date formatting, and active-language defaults for new notes.

## 2. Implementation

- [ ] 2.1 Add typed zh/en knowledge-base message keys and missing-key/interpolation tests.
- [ ] 2.2 Localize tree/editor/tag/search/sort/import/export/status/related/extraction surfaces.
- [ ] 2.3 Add canonical default-directory display mapping without changing stored names or routing.
- [ ] 2.4 Localize newly created default note titles and locale formatting while preserving existing data.
- [ ] 2.5 Reuse keys for accessibility and compact controls without duplicate literal sources.

## 3. Verification

- [ ] 3.1 Run focused i18n/component tests with exact counts, duration, and exit code.
- [ ] 3.2 Verify every knowledge-base state in zh/en, including long strings, mixed-language user data, dates, counts, and errors.
- [ ] 3.3 Capture identical desktop/tablet/mobile light/dark screenshots and accessibility snapshots in both languages.
- [ ] 3.4 Record bundle delta and run Drawnix/full typecheck, full tests, cycles, build, size, startup, and available visual/responsive flows.
- [ ] 3.5 Rewalk create/search/edit/import/export/details and update the F-23 ledger/spec documentation.
