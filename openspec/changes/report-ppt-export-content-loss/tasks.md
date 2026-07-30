## 1. Evidence And Approval

- [x] 1.1 Trace primary image conversion, slide creation, file write/download, caller feedback, and analytics in both directions.
- [x] 1.2 Reproduce a primary image HTTP 404 with synthetic local data and confirm no image is embedded while `writeFile` and success resolution still occur.
- [x] 1.3 Confirm the current image-first specification makes the primary slide image page-defining content.
- [ ] 1.4 Obtain user approval for blocking missing-primary-image downloads and warning on non-critical legacy omissions.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add failing tests for primary URL/conversion failure, no write/download, safe page identification, and unchanged source board.
- [ ] 2.2 Introduce typed per-page/export results that distinguish required-content failure from tolerated omission.
- [ ] 2.3 Propagate required-content failure before file write and preserve current successful export/transition behavior.
- [ ] 2.4 Show explicit failure or partial-success feedback and record privacy-safe analytics categories/counts.
- [ ] 2.5 Preserve filename, page order, media options/fallbacks, board/cache/task data, and repeated-click guard.

## 3. Verification

- [ ] 3.1 Run focused PPT export, transition, page-order, panel feedback, and analytics tests with exact counts and exit codes.
- [ ] 3.2 Render synthetic success and tolerated-partial PPTX files, run overflow tests, and inspect every slide.
- [ ] 3.3 Verify success/failure/partial/retry/offline-cached behavior in Chinese and English without real provider requests.
- [ ] 3.4 Run targeted lint, Drawnix/full typecheck, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
