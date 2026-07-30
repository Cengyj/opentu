# Change: Sanitize Model Benchmark Diagnostics

## Why

Every benchmark modality stores the adapter/client raw response in `preview.rawData`; preview sanitization copies it without allowlisting, redaction, or size bound, and the whole session is persisted. Provider `Error.message` is likewise copied into durable entry state, rendered in the workbench, and sent as analytics `errorMessage`.

No real provider payload or credential was inspected. Sentinel-only diagnostics proved the confirmed boundary defect: arbitrary response fields and credential-shaped error text reach storage/analytics unchanged. Changing diagnostic retention and user-visible error policy requires approval.

## What Changes

- Persist only the existing bounded modality preview fields required for benchmark comparison; do not persist raw provider response objects.
- Convert any optional visible diagnostic details to a bounded allowlisted redacted summary; unknown/unsafe payloads use a generic category/status.
- Normalize provider errors before storage, rendering, export, or analytics; analytics receives safe category/status, not raw message text.
- Ignore historical raw response data on read and omit it on the next ordinary accepted write; do not run a destructive background migration.
- Preserve successful generated text/URL preview, timings, routing, ranking inputs, prompts, manual feedback, and provider error classification needed for recovery.

## Impact

- Affected specs: `toolbox`
- Affected code: benchmark execution normalization, preview/session sanitization, error rendering/export/analytics, tests
- Historical raw payloads are not displayed after the safe read boundary and are removed only when an ordinary write persists that session; no store wipe or background cleanup
- Rollback restores prior raw/error fields and tests; no migration is required, but raw data omitted by an already completed safe write is not reconstructable

## Evidence

- `model-benchmark-service.ts:129-174` bounds text/URLs but copies `rawData` unchanged.
- Text and media executors at `:241-478` place full client/adapter raw responses into the preview.
- `:942-966` persists sanitized preview, while `:982-1024` copies `Error.message` to entry state and analytics.
- Sentinel mock diagnostics observed `Bearer F22_SENTINEL_ONLY` in persisted `preview.rawData` and `Bearer F22_ERROR_SENTINEL_ONLY` in durable `errorSummary` plus analytics. These were synthetic strings; no external request or real secret was used.

## Approval

Implementation is blocked until the user approves bounded allowlist/redaction, generic fallback, and forward-only historical handling.
