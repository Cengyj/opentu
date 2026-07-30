# Change: Sanitize diagnostic capture and export

## Why

Crash snapshots, console/network diagnostic arrays, unified logs, and both application/SW-debug exports currently have different partial or absent sanitizers. Controlled synthetic diagnostics proved arbitrary URL, custom-data, error, console, and unified-log values can reach crash/report/export sinks; a final downloaded JSON retained an `apiKey` field sentinel.

No real credential, provider response, user database, or historical export was inspected. The confirmed defect is the missing common bounded boundary, not proof that a production record contains a secret. Changing diagnostic capture, persistence, display, and export policy requires approval.

## What Changes

- Add a shared, non-throwing, cycle-safe diagnostic projection that bounds depth, collection size, and string length and redacts declared credential/key/bearer and URL query/fragment classes.
- Sanitize future crash snapshots before localStorage, SW transport, IndexedDB, live debug broadcast, display/copy, or export.
- Normalize unified-log `message`, structured data, and Error fields before memory/IndexedDB insertion.
- Apply mandatory final sanitization to application error-log JSON and SW-debug combined/crash exports, including legacy records read from current stores.
- Keep safe diagnostic type/category, timing, status, memory/page counts, route path, and bounded stack/location context needed for recovery.
- Do not wipe or background-migrate existing databases; legacy records are filtered on read/export and disappear at rest only through existing eviction/clear or ordinary safe overwrite.

## Impact

- Affected specs: `diagnostic-privacy` (new delta)
- Affected code: security utilities, crash logger, unified log service, SW crash bridge/store/readers, application error exporter, SW-debug copy/export, tests
- Related changes: `sanitize-model-benchmark-diagnostics` and `sanitize-suno-provider-error-feedback` own domain source normalization; this change owns generic diagnostic sinks and does not preserve their raw payloads. `refactor-sw-duplex-comm` owns transport mechanics, not snapshot content.
- Data/API impact: existing store names, keys, versions, snapshot/log shapes, caps, and clear controls remain compatible; future arbitrary raw detail is intentionally omitted/redacted
- Rollback: restore projection/call sites/tests; no migration, but data already omitted by a safe future write cannot be reconstructed

## Evidence

- Crash URL/error writers: `crash-logger.ts:708-785,823-841,890-909,1281-1298`; console/raw Error collection: `:1314-1373`; unfiltered diagnostic return: `:1382-1397`.
- Crash persistence: `sw-channel/client.ts:493-505` → `channel-manager.ts:501-510` → `sw/index.ts:3587-3708`; SW-debug export copies state at `export-modal.js:239-263` and `memory-logs.js:401-410`.
- Unified logs retain raw message/Error and only partially sanitize data at `unified-log-service.ts:169-211,683-700`.
- Application export composes raw URL/current error/diagnostics/unified logs at `error-log-exporter.ts:62-90`.
- Synthetic diagnostics: crash/export 3/3, unified/page wrapper 3/3, exit 0. Existing network URL sanitizer removed its tested query sentinel, providing a positive control.
- Full evidence: `docs/evidence/f27-diagnostics-observability/diagnostics.md`.

## Approval

Implementation is blocked until the user approves bounded/redacted diagnostics, final legacy-record filtering, and forward-only non-destructive retention handling.
