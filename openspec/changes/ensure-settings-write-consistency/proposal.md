# Change: Ensure primary settings write consistency

## Why

The shared settings manager mutates its in-memory settings before saving. Its primary `localStorage` save catches failures and resolves instead of reporting them, after which callers are notified as though the new value committed. A reachable TTS settings caller also updates its local UI before awaiting that result. If the primary write fails, the current page therefore retains the new value with no retry feedback, while refresh restores the previous durable value.

Changing the shared persistence outcome affects all settings-manager consumers, including provider settings, and requires approval plus focused cross-caller verification.

## What Changes

- Give shared settings updates an explicit primary-storage success/failure contract.
- Commit in-memory settings and notify listeners only after the primary serialized settings record is written successfully.
- On primary write failure, preserve/restore the last committed settings snapshot, reject with a bounded safe error, and let reachable user-initiated callers retain or restore an editable state with retry feedback.
- Adapt TTS and other audited settings callers so an awaited save cannot produce an unhandled rejection or a false-success UI.
- Keep the existing settings key, serialized shape, normalization, encryption policy, provider routes, and best-effort Service Worker IndexedDB mirror boundary unchanged.

## Impact

- Affected specs: `settings-storage-consistency` (new delta)
- Affected code: `settings-manager.ts`, TTS settings caller, audited settings-dialog/provider callers, tests
- Adjacent functions: F-09 provider configuration and F-26 TTS/settings share this manager; implementation must be reviewed against both, not applied as a TTS-only workaround
- Data/migration impact: no key or schema change and no background rewrite
- Rollback: restore the prior void-success contract and caller handling; no stored-data migration is required, but false-success behavior returns

## Evidence

- `packages/drawnix/src/utils/settings-manager.ts:1282-1288` replaces in-memory settings before awaiting storage and then notifies listeners.
- `packages/drawnix/src/utils/settings-manager.ts:1110-1128` catches serialization/primary `localStorage.setItem` failures without rethrowing, so callers receive fulfillment.
- `packages/drawnix/src/components/project-drawer/TtsSettingsPanel.tsx:232-235` updates component state before awaiting `ttsSettings.update` and has no failure branch.
- `packages/drawnix/src/utils/settings-manager.ts:1770-1780` routes TTS writes through the shared manager.
- `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx:1732-1819` awaits the same manager and then updates its persisted baseline, emits `settings_saved` analytics, optionally closes, and returns success; its failure branch at `:1820-1833` is unreachable for a swallowed primary write failure.
- Current behavior is statically deterministic for a throwing `localStorage.setItem`: memory/listener/UI can contain the proposed value, the durable primary record remains old, the returned promise fulfills, and refresh reloads the old record.
- `settings-dialog.tsx:1126-1144` provides an existing local contrast: its direct canvas-setting write catches failure, restores UI, and displays retry feedback.
- The IndexedDB mirror catches its own failures at `settings-manager.ts:1135-1163`; this proposal does not silently redefine that F-09/SW mirror policy.

## Approval

Implementation is blocked until the user approves primary-storage commit-before-notify semantics and safe failure propagation across the shared settings manager and its reachable callers.
