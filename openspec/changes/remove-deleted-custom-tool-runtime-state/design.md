## Context

Catalog, window, pin, and canvas state have separate owners. A custom tool definition can be copied into a canvas element, so deleting the catalog entry cannot safely delete all representations. The stale toolbar launcher is caused specifically by catalog deletion not coordinating runtime/pin ownership.

## Goals / Non-Goals

- Goals:
  - Remove nonfunctional window/launcher state only after durable catalog deletion.
  - Preserve board data and prevent a failed/cancelled deletion from closing anything.
  - Prevent a canvas-derived, no-longer-cataloged definition from creating another persistent ghost launcher.
- Non-Goals:
  - Do not delete canvas elements, iframe/cache data, generated media, or unrelated windows.
  - Do not persist full custom URLs in the pin localStorage record or add tombstones/migrations.
  - Do not redesign toolbar context menus or add restore/undo capability.

## Decisions

- Decision: expose one tool-ID runtime cleanup operation that closes every instance and removes pinned metadata/preferences, called only after successful catalog persistence.
  - Alternative: only unpin and leave windows open.
  - Rejected because: open/minimized instances continue to expose a deleted definition and can reintroduce stale pin state.
- Decision: preserve canvas elements and their embedded definition.
  - Alternative: delete matching canvas elements with the catalog entry.
  - Rejected because: that is destructive user-data removal beyond the delete dialog's current scope and would require board-wide migration/undo semantics.
- Decision: a canvas-derived tool absent from registry/catalog can open as a transient instance but cannot be newly pinned.
  - Alternative: persist its full definition with the pin.
  - Rejected because: this changes the pin schema and copies potentially sensitive custom URLs into localStorage.
- Decision: remove the deleted ID's explicit pin preference rather than recording an unpin preference for a non-existent entity.

## Invariants

- Cancelled, missing, or failed deletion changes no runtime/pin state.
- Successful deletion leaves no open/minimized instance or launcher for that tool ID.
- Built-in tools cannot enter this deletion path.
- Existing canvas elements and board serialization remain byte/schema compatible.
- Re-adding/importing the same ID starts with no stale pin preference.
- Cleanup logs/analytics do not expose raw URLs or credentials.

## Risks / Trade-offs

- Successful deletion closes active tool windows and their ephemeral iframe/React state; the confirmation text and tests must make this consequence explicit.
- A canvas element can still retain and execute its stored URL after catalog deletion; this preserves board data but must be documented as a remaining representation.
- Cross-service ordering must not clean runtime state if persistence rejects.

## Verification

- Cover cancel, missing tool, durable failure, and success with open/minimized/multi-instance/pinned/launcher states.
- Verify pin IDs, metadata, preferences, toolbar observable emissions, and localStorage after cleanup and reload.
- Verify matching canvas elements remain and can open a transient, non-pinnable window.
- Verify other tool IDs and built-ins remain untouched.
- Run browser flows at desktop/mobile widths and the wider F-15 verification set.

## Rollback

- Remove the successful-delete cleanup call, runtime cleanup method, transient pin eligibility check, and focused tests.
- No IndexedDB, localStorage, or board migration is needed; cleanup only removes state for a tool the user deleted.

