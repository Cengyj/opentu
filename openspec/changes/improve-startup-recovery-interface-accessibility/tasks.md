## 1. Evidence and approval

- [x] 1.1 Trace HTML boot loading/error/ready writers and all React crash/init/render/lazy-chunk recovery callers in both directions
- [x] 1.2 Record current roles, focus, disclosure and memory semantics with controlled fixtures
- [x] 1.3 Confirm current retry/safe-mode/debug/export routes and preserve crash/storage/diagnostic ownership
- [x] 1.4 Separate update prompt delivery and update prompt UI into independent changes
- [x] 1.5 Classify remote QR privacy as unproven and exclude it
- [ ] 1.6 Obtain user approval for failure semantics/actions, focus, responsive behavior and language bridge

## 2. Tests first

- [ ] 2.1 Add failing synthetic HTML tests for terminal error role, progress removal, controls, focus and exact actions
- [ ] 2.2 Add failing ErrorFallback role/name/description/focus tests for crash/init/render/chunk variants
- [ ] 2.3 Add failing disclosure and memory progress tests with clamped values and non-live raw details
- [ ] 2.4 Add callback-count and no-auto-action tests for every current recovery route
- [ ] 2.5 Add known zh/en, missing-language and sentinel-data preservation tests
- [ ] 2.6 Add inline-style-only compact/zoom/long-text/QR-failure/reduced-motion fixtures

## 3. Implementation

- [ ] 3.1 Separate HTML loading and terminal failure semantics without adding dependencies
- [ ] 3.2 Add explicit retry, safe-mode and debug controls wired to current routes
- [ ] 3.3 Add ErrorFallback alertdialog naming, concise description and deterministic initial focus
- [ ] 3.4 Add disclosure relationship and bounded memory progress semantics
- [ ] 3.5 Make the inline recovery layout compact/touch/zoom/motion safe
- [ ] 3.6 Bridge only an already-known runtime zh/en value without persistence or root-barrel regression
- [ ] 3.7 Update startup/recovery documentation without changing diagnostic privacy ownership

## 4. Verification

- [ ] 4.1 Run focused HTML controller, ErrorBoundary and App tests with exact counts/durations/exits
- [ ] 4.2 Run keyboard/screen-reader semantic snapshots for every recovery variant and language boundary
- [ ] 4.3 Capture same-state before/after screenshots at 1280/768/390/320 and 100%/200% zoom
- [ ] 4.4 Run focused lint, Web/full typecheck, full tests, cycles, build:web, size and verify:startup
- [ ] 4.5 Compare HTML/bootstrap bytes and five normal-startup samples; report raw values/median/range
- [ ] 4.6 Rewalk normal ready, resource failure, initialization failure, repeated crash, render error, lazy-chunk recovery, safe mode and debug/export paths
