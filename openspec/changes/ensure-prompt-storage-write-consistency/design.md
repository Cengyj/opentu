## Context

Prompt storage keeps six related domains in memory and IndexedDB: general, image, and video history; preset pin/deletion state; deleted prompt contents; and history overrides. Reads are asynchronous, but most UI consumers require synchronous getters and mutators. The current fallback cache permits interaction before initialization, but there is no reconciliation with the read already in flight. Writes are fire-and-forget and backup directly rereads three domains from IndexedDB.

## Goals / Non-Goals

- Goals:
  - Preserve every accepted prompt mutation across initialization completion and reload.
  - Make persistence order match accepted mutation order.
  - Give backup/import a deterministic point at which all earlier prompt writes are durable or have reported failure.
  - Keep existing synchronous consumer contracts and startup rendering behavior.
- Non-Goals:
  - Do not move all application settings into prompt storage.
  - Do not change prompt schemas, keys, backup version, history aggregation, deletion, pinning, or edit rules.
  - Do not claim startup or write performance improvements without measurements.
  - Do not add cloud synchronization or cross-tab behavior.

## Decisions

- Decision: use one shared initialization promise and an ordered pre-initialization mutation log that is replayed against the loaded snapshot before the cache becomes ready.
  - Alternative: block the whole workbench until prompt storage initializes.
  - Rejected because: it changes startup availability and couples an optional history domain to first paint.
  - Alternative: let `ensureCacheInitialized()` mark an empty cache initialized.
  - Rejected because: it permanently skips existing IndexedDB history and confirms data loss rather than resolving it.
- Decision: persist cloned domain snapshots through an ordered write chain and expose `flushPendingWrites()`.
  - Alternative: keep independent fire-and-forget writes and make backup read only current memory.
  - Rejected because: it hides persistence failures and leaves reload/import ordering unresolved.
- Decision: backup export and import await the flush before collecting or replacing prompt data.
  - Alternative: add an arbitrary delay before backup/import.
  - Rejected because: timing cannot prove durability and would produce device-dependent failures.

## Invariants

- A mutation accepted before initialization remains visible after initialization and after a successful reload.
- Pre-initialization mutations replay exactly once in original call order against loaded data.
- For each storage key, a later accepted snapshot cannot be overwritten by an older queued snapshot.
- A successful flush means all prompt writes accepted before the flush call have completed; a failure is observable to the caller.
- Public prompt IDs, timestamps, content normalization, pin/delete/override semantics, event coalescing, storage keys, and backup schema remain unchanged.
- No raw prompt content is added to logs or analytics by the consistency layer.

## Risks / Trade-offs

- Replaying mutations across six domains must avoid duplicate IDs and duplicate change events.
- Serial writes can increase latency under rapid pin/edit activity; coalescing may be allowed only when it preserves the latest snapshot and every caller's flush semantics.
- Backup/import failure reporting must not expose prompt text, storage payloads, credentials, or stack traces to the user.
- A page close can still interrupt browser-managed IndexedDB; this change establishes in-session ordering and explicit workflow flushes, not an impossible synchronous unload write.

## Verification and Performance Thresholds

- Deterministic tests hold each initial read open, apply add/remove/pin/edit/delete operations, then resolve the read and compare memory plus reloaded persistence.
- Deterministic reverse-completion tests prove older snapshots cannot overwrite newer ones.
- Backup/export tests hold writes open and prove collection waits; injected rejection produces a safe failure rather than stale success.
- Backup import/replace tests prove an earlier pending write cannot overwrite restored prompt domains.
- Run at least five samples for initialization with 0, 100, and 1,000 prompt entries and for 1, 10, and 100 rapid writes; record raw values, median, min/max, and any startup/UI cost. No budget increase is permitted.

## Rollback

- Remove the initialization replay/write queue/flush implementation and backup/import waits while keeping existing storage data untouched.
- No data migration or cleanup is required because keys and serialized values remain compatible.

