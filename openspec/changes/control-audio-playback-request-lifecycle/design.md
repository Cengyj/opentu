## Context

Canvas nodes, media-library cards, the music-player tool, knowledge-base/card reading entry points, and the global overlay share one `CanvasAudioPlaybackService` and one `HTMLAudioElement`. Audio starts cross two asynchronous boundaries: optional remote-to-local cache resolution and `HTMLMediaElement.play()`. Reading already uses a `readingVersion` guard for speech callbacks; audio has no equivalent owner.

## Goals / Non-Goals

- Goals: make the latest audio/reading/stop intent authoritative and prevent stale cache/play settlements from changing the current shared UI.
- Non-Goals: no provider cancellation promise, cache-policy change, prefetch, new loading UI, queue redesign, service worker work, cross-tab player, audio-element replacement, or performance claim.

## Decisions

- Add one monotonic audio intent counter and capture the value at the start of every audio request, before `resolvePlaybackAudioUrl`.
- Re-check ownership after cache resolution, before media-element source mutation, and before publishing `play()` fulfillment/rejection. A stale request settles without changing shared state or surfacing its stale error.
- Advancing the intent counter is the cancellation boundary for `stopAndClear`, reading activation, and teardown. It does not claim that an already accepted remote cache/network operation was physically aborted.
- Preserve the single audio element and existing event listeners. Tests SHALL cover all proven promise-order races; attribution of historical browser media events remains outside the claim unless a deterministic browser/mock reproduction proves an additional defect.
- Keep caller-facing promises compatible: the current owning request retains current rejection behavior; an obsolete request is treated as superseded and does not create global user feedback.

## Invariants

- After two playback intents A then B, A cannot become active or change B's `playing`, error, timing, metadata, or queue state after B is accepted.
- After stop/clear or reading activation, an earlier audio request cannot reactivate audio.
- Cache key/extension/source metadata, original-URL fallback, one-active-source rule, queue ordering, modes/rates/volume, and analysis fallback remain unchanged.
- No prompt, media URL, provider ID, cache payload, credential, or raw exception is added to analytics or accessible names.

## Risks / Trade-offs

- A superseded request may continue consuming cache/network work if the current cache API has no safe abort boundary; correctness improves without a cancellation-performance claim.
- Intent checks must occur before every shared mutation; a missed settlement branch would preserve a race.
- `play()` browser behavior differs across engines; mocks and available Chromium flows must be combined without paid/provider requests.

## Verification And Rollback

- Red tests cover A/B cache completion in both orders, A rejection after B success, stop/clear/unmount during cache, audio-to-reading and reading-to-audio switches, same-track pause/resume, and current-owner failure feedback.
- Browser uses synthetic/local audio only and checks rapid selection, close, minimize/restore, reading switch, error feedback, and queue state.
- Five runs report request counts and final active owner; latency is reported only if measured under a declared environment.
- Rollback removes the counter/checks/tests as one unit; no storage, cache, playlist, task, asset, or board rollback is needed.
