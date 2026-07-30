## 1. Evidence And Approval

- [x] 1.1 Trace music-player/media-library/overlay Context calls through both localForage stores and backup/restore in both directions.
- [x] 1.2 Reproduce concurrent whole-array addition losing one item.
- [x] 1.3 Reproduce concurrent same-name creation persisting duplicates.
- [x] 1.4 Inject second-store failures for create/delete/add/remove and prove partial durable results.
- [x] 1.5 Reproduce reverse Context reload completion replacing a newer projection with an older snapshot.
- [ ] 1.6 Obtain user approval for serialized mutations, recovery journal, initialization recovery, and latest reload ownership.

## 2. Failing Tests And Implementation (Approval Required)

- [ ] 2.1 Add red concurrent create/rename/add/remove/favorite/cleanup ordering tests.
- [ ] 2.2 Add red journal prepare/commit/store/rollback failure and startup recovery/idempotence tests.
- [ ] 2.3 Add red Context latest-reload, overlapping mutation, feedback, and unmount tests.
- [ ] 2.4 Implement one accepted-order mutation owner and privacy-safe prepared/committed journal.
- [ ] 2.5 Recover journal state before favorites/read availability and expose truthful failure/recovery feedback.
- [ ] 2.6 Add latest-request ownership to Context reload projection without changing its public value contract.
- [ ] 2.7 Clear but do not export transient journal records in replace backup/restore; preserve existing backup fields.
- [ ] 2.8 Preserve playlist/item schemas, favorites, ordering, queue semantics, asset/note refs, and media-library cleanup ownership.

## 3. Verification

- [ ] 3.1 Run focused service/Context/music-player/media-library/backup tests with exact counts and exit codes.
- [ ] 3.2 Browser-check isolated create/rename/delete/add/remove/favorite/failure/retry/reload/restore flows.
- [ ] 3.3 Measure five runs of concurrent mutation durability, mutation latency, journal size, and recovery time; report median/range and serialization cost.
- [ ] 3.4 Run Drawnix/full typecheck and lint, full tests/cycles/build/size/startup, and available E2E against baseline.
- [x] 3.5 Run OpenSpec strict validation; CLI unavailable (exit 127), then complete manual format/name/conflict validation.
