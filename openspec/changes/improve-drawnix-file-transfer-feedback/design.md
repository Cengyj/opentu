## Context

File actions cross four layers: UI entry, JSON serialization/parsing, embedded-media cache work and browser filesystem/download. Cancellation is already normalized by `isFileSystemAbortError`; all other errors reject. The callers either ignore those Promises or only consume fulfilment. Meanwhile embedded-media helpers intentionally catch per-item errors, so the outer Promise cannot tell complete from partial.

The correction needs an explicit outcome contract without changing the persisted file. It must preserve the current board on invalid/open failure and must not discard a structurally valid file merely because some optional media cache restoration failed.

## Goals / Non-Goals

- Goals:
  - Distinguish complete, partial, cancelled and failed file actions.
  - Provide localized feedback at every reachable entry without raw URLs or file contents.
  - Preserve current structural import, cancellation, history reset, autosave and manual retry behavior.
  - Keep the version-1 file schema and cache/storage owners unchanged.
- Non-Goals:
  - Add automatic retry, rollback of a saved file, a missing-media repair wizard, file preview, migration, version negotiation, or continuous synchronization.
  - Change point-in-time snapshot semantics, media URL classification, image rasterization, board theme semantics, or selected-only image export.
  - Change backup/GitHub export/import or asset-library transactions.
  - Claim performance improvement without measurement.

## Decisions

- Change embedded-media collection/restoration to return aggregate-safe outcomes: successful items/count plus failed count/reason category. Do not return or display URLs in UI feedback. Keep per-item continuation so one bad media item does not discard all valid structural content.
- `serializeAsJSONAsync` returns or accompanies its serialized string with the export media outcome. `saveAsJSON` returns a discriminated result that includes cancelled/complete/partial and file handle without adding persisted fields. Audit package exports/callers before selecting the exact TypeScript shape.
- `loadFromBlob`/`loadFromJSON` return parsed data plus media restoration outcome, or an equivalent backward-compatible wrapper after auditing all callers. Invalid JSON/schema/filesystem failure rejects before board replacement. Cancellation remains `null`/cancelled.
- UI callers own localized messages. Use React `t` in the app menu and existing `getTranslation` for non-React hotkey/image utilities; command registry already receives language and can use the same typed keys. Avoid a new global event bus.
- Partial export may still write the file, then warns that some media was not embedded. Partial import loads the structurally valid board, then warns that some media could not be restored. Both leave the action available for manual retry.
- Keep raw error objects in existing diagnostics only if their current privacy boundary allows it; user-facing messages must be stable, localized and free of file content, URL, token, query or cache-key values.
- Correct command copy to “Save `.drawnix` File” / equivalent localized text while retaining the same command ID, shortcut and file action.

## Alternatives Considered

- Reject the entire export/import on the first media failure.
  - Rejected because a single optional media cache failure would discard otherwise recoverable structural content and already-restored items; current behavior is explicitly best-effort.
- Continue silently and rely on console output.
  - Rejected because deterministic diagnostics prove the UI cannot distinguish complete from partial and normal users do not have a recovery signal.
- Add failed URLs to `.drawnix` metadata.
  - Rejected because it changes the file schema, can expose sensitive URL data and requires version/migration policy.
- Catch all errors inside `saveAsJSON` and `loadFromJSON` with hard-coded messages.
  - Rejected because data helpers do not own language/UI and this would erase typed completion information needed by three entry families.
- Add a retry button/dialog.
  - Rejected as a new product feature. The existing action remains the manual retry path.
- Keep “Save as JSON” in the command palette.
  - Rejected because the actual file picker writes MIME `application/vnd.drawnix+json` and extension `.drawnix`; truthful copy can be corrected within the existing action.

## Risks / Trade-offs

- Internal result-type changes can break unsearched callers.
  - Mitigation: enumerate all `saveAsJSON`, `loadFromJSON`, `serializeAsJSONAsync`, `loadFromBlob`, collector and restorer callers; retain a compatibility wrapper if any public/exported consumer cannot migrate atomically.
- Warning after a partial save cannot retract a file already written.
  - Mitigation: media outcome is known before `fileSave`; the implementation may warn immediately before/after the picker while keeping the approved best-effort behavior. Tests pin one file write and one warning.
- Partial import changes the board before warning.
  - Mitigation: parsed structural data is valid and this matches current behavior; feedback must state partial media restoration and undo/history semantics must be explicit. A preview/transactional import is outside scope.
- Repeated entry-specific handlers can drift.
  - Mitigation: share only a small typed outcome-to-message helper if three callers need identical logic; do not introduce a service/event abstraction.
- Additional messages can duplicate under rapid activation.
  - Mitigation: test callback consumption exactly once; preserve native picker constraints and existing cleanup scanning guard. Do not invent a global file-action mutex without evidence.

## Verification

- Data tests: complete/no-media/missing-media/rejected-cache export; complete/partial/invalid import; abort; filesystem rejection; mixed media; no raw URL in returned user-safe outcome.
- Caller tests: menu, hotkey and command palette observe completion once; cancellation gives no error; non-abort failures give one localized error; partial outcomes give one localized warning; invalid import leaves existing children/history/selection unchanged.
- Image export: zh/en failure message and successful PNG/JPG/selected/full-board path unchanged.
- Command copy: zh/en text names `.drawnix` save while command ID, shortcut and execution target remain unchanged.
- Board/App: successful import resets history/selection as today, invokes one render/viewport change path, autosaves the imported children, and survives reload; failed/cancelled import causes no board operation/save.
- Browser: synthetic valid/invalid/partial files at 1280×720 and compact viewport, zh/en, keyboard/pointer; capture feedback, current-board preservation, reload and screenshots. No real browser storage inspection.
- Run focused tests, package/full typecheck and test comparison, cycles, build, size/startup and relevant smoke/feature/visual/responsive suites. No performance claim without five comparable samples.

## Migration and Rollback

No stored data migration or cache invalidation is required. Version-1 files remain unchanged. Rollback removes internal outcomes, caller handling, copy/translations and tests; partial/failed operations return to their current silent or fixed-language behavior.

