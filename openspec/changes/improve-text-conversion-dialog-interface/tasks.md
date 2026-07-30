## 1. Evidence and approval

- [x] 1.1 Trace dialog primitive, F-30 composition, labels, errors, focus manager, entry lifetimes and responsive CSS.
- [x] 1.2 Capture production desktop semantics/focus for Mermaid and Markdown plus Mermaid success/error screenshots and raw attributes.
- [x] 1.3 Measure the 390×844 success/error dialog, body and Insert geometry; confirm action clipping under locked body scroll.
- [x] 1.4 Search formal specs/active changes and separate F-30 interface ownership from F-28 evidence and F-31 palette-shell behavior.
- [ ] 1.5 Obtain explicit user approval for this change before modifying runtime code, translations, CSS or permanent tests.

## 2. Dialog semantics and focus

- [ ] 2.1 Add failing tests for localized dialog title/description, textarea label, initial focus, modal containment, Escape and each entry-family focus return/fallback.
- [ ] 2.2 Mount visible localized headings/descriptions through the existing dialog primitive without changing unrelated callers.
- [ ] 2.3 Associate each syntax label and textarea with a stable native/programmatic relationship.
- [ ] 2.4 Capture connected invocation owners and restore focus deterministically after user close without reopening ephemeral surfaces.

## 3. State feedback and compact reachability

- [ ] 3.1 Add failing tests for one narrow live error announcement and no full-preview/input announcement.
- [ ] 3.2 Wire action disabled/shortcut-hint state to the approved current-result eligibility contract.
- [ ] 3.3 Add scoped compact modal overflow/sizing so the full action is reachable while body/canvas scrolling remains locked.
- [ ] 3.4 Preserve desktop layout, theme/z-index variables, 40 px action height and unrelated generation-dialog behavior.

## 4. Verification and documentation

- [ ] 4.1 Run focused component/a11y/responsive tests and Drawnix typecheck/lint comparison with exact exits/statistics.
- [ ] 4.2 Run the documented viewport/state/locale/theme/focus browser matrix and capture same-state after screenshots plus geometry.
- [ ] 4.3 Run full typecheck/test comparison, cycles, production build, size/startup and relevant smoke/feature/visual/responsive suites.
- [ ] 4.4 Update F-30/F-28 evidence, ledger and any user/developer documentation whose dialog contract/test location changed.
- [ ] 4.5 Rewalk every entry through focus, input, conversion state, error/recovery, insertion availability and close return; record rollback and remaining risks.

