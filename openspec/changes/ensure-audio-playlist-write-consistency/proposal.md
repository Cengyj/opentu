# Change: Ensure Audio Playlist Write Consistency

## Why

Playlist membership uses whole-array read/replace writes, so two concurrent additions can read the same old array and permanently lose one accepted item. Concurrent same-name creation performs its uniqueness check before either write and can persist duplicate names. Create, delete, add, and remove update playlist metadata and item arrays in separate localForage stores; an injected second-store failure leaves a partial durable result although the UI reports the operation as failed. Concurrent Context reloads have no request owner, allowing an older snapshot to overwrite a newer one.

Controlled localForage/React diagnostics reproduced all four classes without touching real user stores. Write ordering, failure recovery, and durable operation semantics require approval.

## What Changes

- Serialize playlist mutations accepted by the service so name checks and whole-array updates use the latest committed snapshot in one app runtime.
- Journal each two-store mutation before applying it, record commitment before reporting success, and recover prepared/committed records deterministically during initialization.
- Preserve the current metadata/item stores and record schemas; add only a private recovery-journal store and exclude transient journal contents from normal user backup payloads.
- Give Context reloads a latest-request owner so an obsolete result cannot replace a newer projection; only durably completed operations receive success feedback.
- Keep playlist/favorites capabilities, visible ordering, queue semantics, asset/note reference shapes, and existing backup compatibility unchanged.

## Impact

- Affected specs: `canvas-audio-playback`, `backup-restore`
- Affected code: audio playlist service/context, environment backup replace-clear boundary, focused localForage/React tests
- Data change: additive private recovery-journal store; existing two stores and records remain readable with no destructive migration
- Rollback: first drain/recover journal entries with the new code, then remove journal/coordinator/context-owner/tests; retain legacy stores unchanged

## Evidence

- `packages/drawnix/src/services/audio-playlist-service.ts:105-124` checks names and writes metadata/items in separate steps.
- `packages/drawnix/src/services/audio-playlist-service.ts:157-170` deletes metadata before items.
- `packages/drawnix/src/services/audio-playlist-service.ts:172-205,212-232` performs whole-array membership replacement before a separate metadata timestamp write.
- `packages/drawnix/src/contexts/AudioPlaylistContext.tsx:30-43,49-83` lets every reload completion replace both UI collections without request identity.
- Isolated diagnostics: concurrent adds retained 1 of 2 items; concurrent creates persisted 2 same-name playlists; injected second-store failures left partial create/delete/add/remove results; reverse Context reload completion left the older snapshot visible. All 7 assertions passed with mocks; real IndexedDB/user data was not used.

## Approval

Implementation is blocked until the user approves serialized mutation semantics, the private recovery journal, deterministic initialization recovery, and latest-reload projection ownership.
