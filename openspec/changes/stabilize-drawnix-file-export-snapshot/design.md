## Context

The live Plait board remains editable while `serializeAsJSONAsync` performs cache reads, Blob-to-base64 conversion and metadata reads. Current serialization uses the entry-time children only as the input to media URL extraction, then reads live children and viewport after the await. An insertion, deletion, property change, pan or zoom during that interval can therefore make the exported structural fields and embedded-media set describe different moments.

The final format is JSON. Snapshot capture must preserve the same JSON-compatible semantics and must not retain mutable references that a later Plait operation can replace or alter.

## Goals / Non-Goals

- Goals:
  - Make `elements`, `viewport` and `embeddedMedia` in one file derive from one export-start snapshot.
  - Preserve current schema/version and valid legacy imports.
  - Keep the UI editable and avoid changing workspace autosave or cache ownership.
  - Make the snapshot boundary deterministic and directly testable.
- Non-Goals:
  - Add document locking, collaborative export, incremental serialization, a new file format, or automatic resave.
  - Change what counts as a virtual media URL or how missing cache media is reported; that requires separate evidence/approval.
  - Change image export, backup export, GitHub sync, workspace storage, board history, or theme semantics.
  - Claim speed or memory improvement without measurements.

## Decisions

- Capture elements and viewport before the first await by applying the same JSON-serialization boundary the final file already uses. A JSON-compatible deep snapshot is preferred over retaining live references; `structuredClone` alone is not used because final JSON has established omission/coercion semantics that clone does not exactly match.
- Pass the captured element snapshot to `collectEmbeddedMediaFromElements` and write the same captured elements/viewport to `DrawnixExportedData` after media work completes.
- Keep `type`, `version` and `source` generated at export start with the existing constants.
- Do not freeze or mutate the board. Edits accepted after capture remain live and are intentionally absent from that save, matching a conventional point-in-time file operation.
- Keep abort handling and `fileSave` unchanged. Serialization failure continues to reject through the existing boundary; user-facing failure recovery is a separate F-29 issue because current callers do not consume all rejections.

## Alternatives Considered

- Read live elements again and run a second media scan before writing.
  - Rejected because edits can continue between scans and the file still lacks a single point-in-time definition.
- Block canvas editing until save finishes.
  - Rejected because it changes interaction semantics, can stall on large media and is unnecessary for a snapshot.
- Capture only the array reference.
  - Rejected because it does not prove nested JSON values are stable across in-place/plugin changes; the final artifact is already a value snapshot.
- Capture after media collection.
  - Rejected because it reproduces the verified mismatch for URLs added during the await.
- Add a new file version or timestamp field.
  - Rejected because consistency can be restored without a schema or migration change.

## Risks / Trade-offs

- JSON snapshotting elements before media work may add one stringify/parse allocation for large boards.
  - Mitigation: use the smallest helper that establishes identical JSON semantics and measure five saves on representative small/large synthetic boards before making any performance claim. If overhead is material, compare a proven immutable Plait snapshot method without weakening consistency.
- A non-JSON runtime value may be omitted at capture rather than final write.
  - This matches the existing final JSON contract. Add compatibility fixtures for the current supported element shapes and viewport values.
- Media cache content can change after snapshot capture.
  - The element URL set is fixed; cache reads retrieve the best available bytes for those URLs. Cache-version atomicity is outside this change and must not be implied.
- Missing cache media can still be omitted by the current collector.
  - Keep this explicitly recorded as a separate F-29 recovery/feedback investigation; do not broaden the snapshot correction without evidence and approval.

## Verification

- Unit: deferred media lookup plus live insert, delete, property edit and viewport change; exported elements/viewport and requested/embedded URL set remain from entry time.
- Unit: no-media board, multiple virtual URL fields, duplicate URLs, media lookup rejection, Blob conversion rejection and JSON-serialization rejection.
- Round-trip: serialize current schema, load it through `loadFromBlob`, restore synthetic embedded media, and compare supported element/viewport values.
- Compatibility: existing version-1 fixture without `embeddedMedia`, version-1 fixture with media metadata, abort from save picker, and unchanged MIME/extension.
- Browser: start local save with delayed synthetic cache, edit the board, complete save, import into an isolated board, verify only the export-start state/media, undo/return to the live edited board, and record reload behavior. Do not inspect real browser storage or clipboard.
- Measure at least five comparable small/large serializations before stating any latency or memory change; record median and range.
- Run focused tests, package/full typecheck and test comparison, cycles, build, size/startup and relevant E2E/visual/responsive gates.

## Migration and Rollback

No migration or cache invalidation is required. Old files continue through the existing loader, and new files retain version 1 and the same fields. Rollback removes the snapshot helper/tests; files already produced remain ordinary valid `.drawnix` files.

