## Context

The component has one synchronous localStorage key and one shared helper for pin and pointer position. Synchronous storage rejection is swallowed inside a React state updater, so callers cannot distinguish a durable commit from a session-only false success. Pointer movement also invokes storage on every move event, coupling transient geometry to persistence.

## Goals / Non-Goals

- Goals: honest durable outcome, deterministic rollback, one drag-end commit, localized safe retry feedback, and compatible records.
- Non-Goals: introduce a global settings service, queue synchronous writes, synchronize tabs, change thresholds/layout, guarantee storage availability, or claim a measured speedup.

## Decisions

- Keep an explicit durable settings snapshot initialized from the existing parser/default.
- Pin/unpin computes the next complete record, calls `localStorage.setItem`, and only then publishes it to React/durable state. A throw leaves both at the previous durable value.
- Pointer drag updates a transient React position only. Pointer-up/cancel computes one complete record and attempts one write. Success promotes it to durable; failure restores the prior durable position.
- Present one localized non-sensitive status with retry guidance per rejected interaction; do not include storage payload, coordinates, browser exception text, URL, or diagnostic record.
- Reusing the same action is the retry path. No automatic timer or infinite retry is added.

## Alternatives considered

- Keep optimistic state and show a warning: rejected because refresh still contradicts a UI represented as saved.
- Write/revert on every pointer move: rejected because a single drag can emit many failures and feedback events, and intermediate positions are not user commit points.
- Move the key into shared SettingsManager: rejected because no cross-feature owner or reuse benefit is proven and it would broaden migration/failure semantics.

## Invariants

- Key `drawnix_performance_panel_settings`, JSON shape `{ position: {x,y}, pinned }`, defaults, malformed-read fallback, viewport clamping, visibility thresholds, callbacks, close-session behavior, and z-index remain unchanged.
- Storage errors do not escape render/event callbacks and feedback contains no serialized setting or raw exception.
- Synchronous localStorage requires no mutation queue; any future asynchronous backend would need separate evidence and approval.

## Risks / Trade-offs

- Failed drag snaps back at release; explicit feedback explains why.
- One drag-end write changes the timing of durability versus current per-move writes; page termination during an active drag can lose only the uncommitted transient position.
- A storage implementation can accept a write then fail later only outside the synchronous localStorage contract; this change does not invent verification reads.

## Verification and rollback

- Component tests cover existing/missing/malformed record, successful pin/unpin, quota/security failure, drag transient state, pointer-up success/failure, cancel, clamp, feedback deduplication, retry, and refresh rehydrate.
- Assert at most one storage write per completed drag and zero serialized/raw error data in feedback/log/analytics.
- Run focused tests/typecheck/lint and repository gates against baseline; browser-check pointer/keyboard and responsive positions after the related accessibility change is approved.
- Rollback state split/drag commit/feedback/tests only; no data cleanup.
