## 1. Evidence And Approval

- [x] 1.1 Trace canvas, media-library, tool, reading, overlay, cache, media-element, state, error, and teardown paths in both directions.
- [x] 1.2 Reproduce older cache completion replacing the latest selected track with deferred mocks.
- [x] 1.3 Reproduce an older play rejection overwriting the newer active track.
- [x] 1.4 Reproduce pending playback reactivation after `stopAndClear`.
- [ ] 1.5 Obtain user approval for latest-intent ownership and stop/clear invalidation.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add red tests for cache completion orders, stale play settlement, and current-owner failure.
- [ ] 2.2 Add red tests for stop/clear/unmount and audio/reading switch invalidation.
- [ ] 2.3 Implement the minimum monotonic audio intent owner and checks at every proven async mutation boundary.
- [ ] 2.4 Preserve queue, cache fallback, metadata, analysis, modes/rates/volume, and public control contracts.

## 3. Verification

- [ ] 3.1 Run focused playback service/component tests with exact counts and exit codes in node and jsdom classifications.
- [ ] 3.2 Browser-check synthetic rapid A/B, stop, close, teardown, reading switch, minimize/restore, error, and retry flows.
- [ ] 3.3 Run five ordering samples and report final-owner/request-count results plus any latency trade-off.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
