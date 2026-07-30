## 1. Evidence And Approval

- [x] 1.1 Trace Chat-MJ manifest through URL substitution, window/canvas iframe rendering, and final third-party origin.
- [x] 1.2 Prove cross-origin fragment delivery with a mock sentinel and no real credential.
- [x] 1.3 Trace drawer, launcher, context new-window, canvas insertion/render/refresh, and canvas popup missing-key paths.
- [x] 1.4 Confirm the credential-free Chat-MJ route renders the existing external shell.
- [ ] 1.5 Obtain user approval for built-in non-delivery and cross-entry preflight semantics.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add sentinel tests for built-in non-delivery and configured/missing user-authored templates.
- [ ] 2.2 Add state/service tests proving rejection occurs before window, pin, analytics, iframe, or canvas mutation.
- [ ] 2.3 Add drawer, launcher, context new-window, canvas render/refresh, and popup feedback tests.
- [ ] 2.4 Remove the built-in Chat-MJ global-key fragment while preserving its credential-free shell.
- [ ] 2.5 Add sensitive-template preflight at state-creation and canvas-render boundaries.
- [ ] 2.6 Reorder canvas popup removal after successful window creation and keep feedback privacy-safe/localized.
- [ ] 2.7 Update coding rules and feature-flow documentation to distinguish user-authored templates from built-in external tools.

## 3. Verification

- [ ] 3.1 Run focused URL-template, manifest, tool-window, drawer, launcher, and canvas-generator tests with exact counts/exit codes.
- [ ] 3.2 Browser-check credential-free Chat-MJ plus synthetic missing/configured custom tools without reading or sending a real key.
- [ ] 3.3 Assert no secret/sentinel/raw URL reaches iframe attributes, analytics, logs, accessible names, canvas/catalog storage, or exported data outside the explicitly configured custom destination.
- [ ] 3.4 Verify open/minimize/restore/pin/new-window/canvas insertion/popup and settings-refresh behavior for all three F-21 tools.
- [ ] 3.5 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available smoke/feature/visual/responsive E2E against baseline.
- [ ] 3.6 Run OpenSpec strict validation; while unavailable, record exit 127 and complete manual structure/name/conflict validation.

