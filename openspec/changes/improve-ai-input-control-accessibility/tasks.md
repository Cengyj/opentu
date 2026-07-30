## 1. Evidence and approval

- [x] 1.1 Confirm the reachable icon-only controls, shared attachment-removal control, and Chat Drawer equivalents
- [x] 1.2 Record browser names, exact target geometry, non-hover visibility, affected callers, and rollback boundary
- [ ] 1.3 Obtain approval for the user-observable screen-reader behavior change

## 2. Implementation

- [ ] 2.1 Add localized accessible names to upload, media-library, and send controls
- [ ] 2.2 Add a localized, distinguishable accessible name to each removable attachment and mark non-submit controls as `type="button"`
- [ ] 2.3 Make attachment removal visible on keyboard focus and non-hover/coarse-pointer input with a target of at least 24×24 CSS px, without changing attachment state or outer toolbar/input geometry
- [ ] 2.4 Add focused regression coverage without changing submission behavior

## 3. Verification

- [ ] 3.1 Verify upload, library, send, and repeated-attachment removal controls by role and accessible name in Chinese and English
- [ ] 3.2 Verify keyboard focus visibility, Enter/Space activation, coarse-pointer visibility, at least 24×24 targets, and adjacent-preview hit testing at desktop/tablet/mobile viewports
- [ ] 3.3 Run the F-07/F-12 focused test clusters, Drawnix typecheck, and lint for touched files
- [ ] 3.4 Verify the browser accessibility tree and same-state screenshots; do not claim the separate outer mobile-overlap change is fixed
