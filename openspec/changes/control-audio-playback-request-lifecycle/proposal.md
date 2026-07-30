# Change: Control Audio Playback Request Lifecycle

## Why

Remote audio playback waits for cache resolution before it records which request owns the shared player. A slower first click can therefore replace a later click after the later track is already active. A rejected `audio.play()` promise from the older request can also set the newer track to failed/paused. `stopAndClear()` clears current state but does not invalidate a request still waiting for cache resolution, so that request can reactivate playback after close or Drawnix unmount.

Three controlled deferred-mock diagnostics reproduced these outcomes without network or provider calls. Changing async ownership and stop semantics is user-observable and requires approval.

## What Changes

- Give every audio start attempt a monotonic in-memory intent identity before any asynchronous cache or play boundary.
- Permit only the current intent to assign the media source, publish active metadata, or publish `play()` success/failure.
- Invalidate pending audio intents when the user stops/clears playback, switches to reading, or the Drawnix playback owner unmounts.
- Keep queue construction, cache keys, cache fallback, audio/reading speed, playback modes, provider metadata, persistent preferences, and public control methods compatible.

## Impact

- Affected specs: `canvas-audio-playback`
- Affected code: shared playback service, focused service tests, existing callers only if return handling needs a compatibility adapter
- Storage/data: no key, schema, migration, cache deletion, playlist, task, asset, or board change
- Rollback: remove intent ownership checks and focused tests together; no stored data cleanup is required

## Evidence

- `packages/drawnix/src/services/canvas-audio-playback-service.ts:869-880` begins an audio request and awaits remote cache resolution before deciding the active track.
- `packages/drawnix/src/services/canvas-audio-playback-service.ts:882-929` assigns the shared media element/state and lets any `play()` rejection patch the current state without request identity.
- `packages/drawnix/src/services/canvas-audio-playback-service.ts:1487-1514` clears media/state without invalidating pending `startPlayback` work.
- Isolated diagnostic results: slower A cache resolution replaced already active B; A's deferred play rejection changed active B to `playing=false` with A's sentinel error; A reactivated after `stopAndClear`. All 3 assertions passed; no external request was sent.

## Approval

Implementation is blocked until the user approves latest-intent ownership and stop/clear invalidation semantics.
