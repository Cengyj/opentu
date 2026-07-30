## 1. Evidence and approval

- [x] 1.1 Trace provider lifetime, modal open, TTL guard, three source readers, local direct projection, task persistence/events and unified-cache notifications in both directions.
- [x] 1.2 Run a controlled fake-clock diagnostic for initial load, committed task/cache write, cache notification, reopen inside the TTL and reopen after expiry; record raw read/card counts and remove the temporary defective-behavior test.
- [x] 1.3 Audit `ensure-media-library-write-consistency`, selection and responsive changes and keep their commit, callback and geometry semantics outside this change.
- [x] 1.4 Create proposal, design, task list and focused `media-library` delta; mechanically verify structure, requirement names and active owners while the OpenSpec CLI is unavailable.
- [ ] 1.5 Obtain explicit user approval for visible-open freshness, scoped extra reads, failure retry and the stated non-goals.

## 2. Failing tests and measurement baseline

- [ ] 2.1 Add a failing provider/modal test proving a task/cache record committed before reopen is present on that reopen even when the prior successful load is less than eight seconds old.
- [ ] 2.2 Add failing local-source and cross-tab/external-writer-equivalent fixtures without changing storage schemas or introducing a push channel.
- [ ] 2.3 Add overlap and StrictMode/repeated-render tests proving one in-flight/source-read wave and no repeated reads while `isOpen` remains true.
- [ ] 2.4 Add refresh-failure/reopen-retry tests proving the prior usable projection remains and only success advances freshness.
- [ ] 2.5 Capture five isolated-browser baseline samples at 0, 100 and 1,000 assets with source-read counts, open-to-ready latency, long tasks and React commits.

## 3. Implementation

- [ ] 3.1 Add the smallest internal freshness intent to `AssetContext.loadAssets` while preserving public data contracts and the existing single-flight owner.
- [ ] 3.2 Request current durable data only on the modal's closed-to-open transition; do not add polling or task/cache payload projection.
- [ ] 3.3 Preserve direct upload updates, merge/dedupe/sort order, old cards on failure, existing feedback and next-open retry.
- [ ] 3.4 Keep all asset/task/cache keys, schemas, migrations, provider routes, filters, selection and canvas data unchanged.

## 4. Validation and review

- [ ] 4.1 Run focused AssetContext/modal/unit and F-13 integration tests with exact file/test counts, durations and exits.
- [ ] 4.2 Run the same five-sample browser matrix after implementation and compare raw/median/range values against the thresholds.
- [ ] 4.3 Browser-check same-state before/after at desktop, tablet and compact viewports, light/dark and Chinese/English; record that no layout/style delta occurred.
- [ ] 4.4 Run Drawnix lint/typecheck, full typecheck/test, cycles, build, size, startup and available smoke/feature/visual/responsive E2E against the recorded baseline.
- [ ] 4.5 Rewalk startup/open/reopen/failure/retry/refresh/offline/multi-tab boundaries, update the F-13 ledger/spec documentation and record remaining live-open uncertainty separately.
- [ ] 4.6 Run `openspec validate refresh-media-library-projection-on-open --strict`; while the CLI remains unavailable, retain the blocker and repeat manual operation/name/scenario/owner validation.
