## Context

`SettingsManager` is both the in-memory settings owner and the serializer for one `localStorage` record. Update methods currently mutate that owner, call a save function that swallows primary failures, and notify path listeners. Callers therefore cannot distinguish durable success from failure. A separate IndexedDB projection exists for Service Worker configuration and intentionally catches its own error; its reliability semantics belong to the provider/task boundary and are not broadened here.

## Goals / Non-Goals

- Goals: define primary durable commit, prevent false-success memory/listener state, expose a safe rejected result, and give existing interactive settings callers truthful retry feedback.
- Non-Goals: new settings, language persistence, provider routing changes, IndexedDB mirror redesign, distributed/multi-tab locking, settings schema changes, encryption redesign, or generic toast infrastructure.

## Decisions

- Treat the serialized `DRAWNIX_SETTINGS_KEY` record as the primary commit boundary for this change. Snapshot the last committed normalized in-memory settings before applying an update.
- Prepare/normalize the candidate without publishing it. After primary serialization and `localStorage.setItem` succeed, publish the candidate and notify listeners once. A primary failure leaves the committed snapshot active and rejects with a typed/bounded error that contains no value, key material, URL, provider body, or serialized record.
- Preserve the current best-effort IndexedDB mirror behavior. A mirror failure must not be mislabeled as a primary-write failure in this change; its logging/privacy and provider availability remain subject to F-09/F-27 review.
- Callers that optimistically render a candidate either revert to the manager's committed value or keep an explicitly unsaved editable draft. They must show one retryable, localized message and avoid unhandled promise rejections.
- Do not infer or promise ordering for overlapping writes until the existing rapid-write hypothesis is measured. Focused tests here cover sequential accepted writes and primary failure; a later concurrency change requires its own evidence and approval.

## Invariants

- `DRAWNIX_SETTINGS_KEY`, normalized `AppSettings`, provider profile/catalog/preset data, TTS data, and backup format remain compatible.
- A successful update notifies existing listeners once with the same logical old/new values.
- Error surfaces and analytics never include settings payloads, credentials, provider URLs/bodies, encrypted text, or storage snapshots.
- No settings value is deleted or background-migrated.

## Risks / Trade-offs

- Some callers may rely on immediate in-memory visibility before the async encryption/storage step. Inventory and tests must identify them before implementation; the candidate may need caller-local pending state rather than early manager publication.
- Restoring a snapshot after externally overlapping writes could revert a newer value, which is why unmeasured concurrency is not solved with blind rollback.
- Existing tests may mock only the fulfilled void contract; mocks must preserve behavior rather than be relaxed.

## Verification And Rollback

- Add failure-injection tests for serialization and `localStorage.setItem`, asserting rejected result, unchanged committed manager state, no listener false commit, and safe error text.
- Test TTS and audited settings-dialog/provider callers for success, failure, retry, disabled/pending state, and refresh recovery.
- Re-run backup/restore, provider routing/discovery, TTS, settings, task/SW configuration, typecheck, lint, build, and baseline suites.
- Rollback restores prior manager/caller methods and tests. No migration is needed because the storage key and value shape never change.
