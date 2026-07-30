# Change: Scope Model Benchmark Launch Handoff

## Why

Settings shortcuts publish benchmark prefill context to one global Jotai atom before opening or reusing the benchmark tool window. The request is never cleared. A newly mounted workbench starts with an empty local signature guard, so it consumes the old shortcut again after close/reopen.

An isolated launcher diagnostic confirmed repeated reads return the same request after consumption. The settings browser path could not be clicked safely because both configured provider groups expose zero model entries; no models or credentials were added to manufacture evidence. Changing the handoff is user-observable and crosses tool-window instance ownership, so it requires approval.

## What Changes

- Give each shortcut request an identity and acknowledge/clear it only after the reachable workbench applies the compatible modality/provider/model prefill or resolves a terminal unavailable target.
- Ensure a plain toolbox open has no stale prefill and an already-open different workbench does not change selection.
- Preserve no-auto-run default, model discovery wait, comparison-mode fallback, the internal tool's default reuse behavior, and analytics fields excluding private values.

## Impact

- Affected specs: `toolbox`
- Affected code: benchmark launcher atom/handoff, workbench prefill effect, settings shortcut tests
- No benchmark session/storage/provider request change; no key/migration/canvas insertion
- Rollback restores the global atom behavior and tests; no data recovery is required

## Evidence

- `model-benchmark-launcher.ts:16-18,40-49` writes a global atom before opening a window and has no clear/ack path.
- The internal benchmark manifest does not enable multiple windows; `tool-window-service.ts:318-323,616-624` therefore reuses its primary instance by default. `ModelBenchmarkWorkbench.tsx:401,431,842-886` deduplicates only against a component-local signature ref that resets after close/remount.
- Isolated launcher diagnostic read the same non-null request twice after one open; temporary test was deleted.
- Browser at 1280×720 confirmed both settings groups have zero model entries, so the shortcut button is absent in this environment. This is an external-data blocker, not evidence that the shortcut UI is defective.

## Approval

Implementation is blocked until the user approves identity-checked one-shot handoff semantics.
