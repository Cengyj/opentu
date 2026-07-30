## 1. Evidence and approval

- [x] 1.1 Trace Markdown example initialization, language effect, lazy import catch, i18n keys and mounted-session lifetime.
- [x] 1.2 Reproduce authored-draft replacement and Markdown import rejection with controlled component diagnostics.
- [x] 1.3 Search formal specs, active changes and permanent tests; record the new capability owner and neighboring F-30 boundaries.
- [ ] 1.4 Obtain explicit user approval for this change before modifying runtime code, translations or permanent tests.

## 2. Draft ownership

- [ ] 2.1 Add failing tests for pristine/edited language switches, repeated toggles, example-equal edits and close/reopen.
- [ ] 2.2 Track the last injected example and explicit user-edit state within the mounted dialog.
- [ ] 2.3 Update only untouched injected examples on locale changes and preserve all authored input.
- [ ] 2.4 Keep the draft session-only with no storage, backup or migration addition.

## 3. Failure feedback

- [ ] 3.1 Add a typed localized Markdown converter load-error key in Chinese and English.
- [ ] 3.2 Replace the Mermaid-specific Markdown import diagnostic with a Markdown-specific aggregate label without adding user content.
- [ ] 3.3 Add controlled load-failure tests for both locales and no-content logging.

## 4. Verification and documentation

- [ ] 4.1 Run focused component/i18n tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 4.2 Verify pristine/edited locale switching and load failure in the production build at desktop and compact widths.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-30 evidence, ledger and any documentation whose Markdown draft/error contract changed.
- [ ] 4.5 Rewalk language change, converter load, preview coordination, close/reopen and privacy boundaries; record rollback and remaining risks.

