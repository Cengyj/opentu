# Change: Stabilize `.drawnix` file export snapshots

## Why

`serializeAsJSONAsync` starts embedded-media collection from `board.children`, awaits cache reads and conversions, and only then reads `board.children` and `board.viewport` for the exported JSON. A deterministic diagnostic paused the first media-cache read, added a second virtual-media element, and resumed serialization. The resulting file contained both elements but embedded only the first media URL. The file therefore combined two board moments and could reference a device-local virtual URL whose bytes were never included.

This changes exported user data and cross-device recovery semantics, so the runtime correction requires approval even though the public `.drawnix` schema remains unchanged.

## What Changes

- Capture one serialization-safe snapshot of elements and viewport synchronously when `.drawnix` export begins.
- Collect embedded media from that same element snapshot and write exactly that snapshot into the file after asynchronous cache work completes.
- Preserve the existing `.drawnix` type, version, source, viewport, elements and optional `embeddedMedia` fields and their JSON-compatible value semantics.
- Define the saved file as the board state accepted at export start; later edits remain on the live board and belong to a later save.
- Do not block editing, mutate board state, add a lock, change autosave, change cache keys, or add background synchronization.
- Add focused race, round-trip, failure, abort and compatibility tests plus a browser save/edit/import verification using synthetic local media only.

## Impact

- Affected specs: new `drawnix-file-export-consistency`
- Affected code: `packages/drawnix/src/data/json.ts`, possibly a small serialization-snapshot helper, and focused F-29 tests/evidence
- Related boundaries: F-03 workspace backup/export has its own snapshot service and is not changed; F-06/F-13 own media cache production; `prevent-network-failure-media-cleanup` owns cleanup classification, not file serialization
- Data/API impact: no `.drawnix` version or field change, no board/workspace/cache/backup/task/asset schema change, and no migration. The behavioral change is that all fields in one newly saved file describe one board moment.
- Rollback: revert the snapshot capture and focused tests. No migration or cache cleanup is required, but rollback restores the verified mixed-moment export risk.

## Evidence

- `packages/drawnix/src/data/json.ts:15-37` calls the asynchronous serializer before the file picker/save boundary.
- `packages/drawnix/src/data/json.ts:75-87` awaits `collectEmbeddedMediaFromElements(board.children)` at line 76, then reads live `board.children` and `board.viewport` at lines 82-83.
- `packages/drawnix/src/data/embedded-media.ts:28-55,97-139` extracts the passed URLs synchronously and awaits per-URL cache/blob work; later live-board additions are not part of that URL set.
- `packages/drawnix/src/data/types.ts:3-32` states that embedded media makes a file usable on another device and defines a single elements/viewport/media record.
- Diagnostic environment: Node `v24.14.0`, Vitest `3.2.4`, jsdom, two synthetic virtual image URLs, a deferred first `getCachedBlob`, and no real network/storage/user data. Result: exported element IDs `['first','second']`; embedded URLs `['/__aitu_cache__/image/a.png']`; cache reads `1`. Command exit 0, 1/1 file and 1/1 test, 5 ms test, 1.25 s process report.
- Permanent-test search found no direct `serializeAsJSONAsync`, `loadFromJSON`, `.drawnix` round-trip or app-menu file-flow test. The diagnostic file was deleted after recording the result.

