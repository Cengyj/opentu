# Change: Sanitize Suno Provider Error Feedback

## Why

The Suno submit and fetch paths append the complete HTTP response body to `Error.message` and also attach it as `apiErrorBody`. Task execution stores the message, and Music Analyzer Create/Lyrics surfaces render that task error directly. Therefore any provider-controlled response body can become user-visible and durable task data.

No real provider error sample or credential was used, so this change does not claim that a current provider body contains a secret. The confirmed defect is the absence of an allowlist/redaction boundary: arbitrary provider body text, HTML, request echoes, or internal details is propagated unchanged to UI/storage/logging.

Changing user-visible errors and diagnostic retention is an observability/security policy change and requires approval.

## What Changes

- Replace raw Suno response bodies in thrown user-facing messages with a stable safe category, action, and HTTP status.
- Parse only an allowlisted bounded provider reason when it passes redaction and safety checks; otherwise use localized generic guidance.
- Do not persist `apiErrorBody`, raw HTML/JSON, request payloads, credentials, prompts, media URLs, or stacks in task error messages.
- Keep a privacy-safe diagnostic summary in the existing LLM log path; raw provider error bodies are not required for user recovery.
- Preserve routing, status classification, retry, cancellation, task schema compatibility, and successful response handling.

## Impact

- Affected specs: `audio-generation`
- Affected code: Suno audio API error normalization/logging, task error writeback, Music Analyzer error consumers, tests
- Related changes: task-creation feedback covers rejection before execution; task cancellation covers terminal ownership; neither sanitizes provider execution responses
- User-visible trade-off: users receive a concise actionable status/category instead of the provider's unbounded raw body; diagnostics retain a safe summary rather than exact raw error payload
- Rollback: restore raw-body concatenation and prior tests; no migration, but already persisted historical task messages are not rewritten by this change

## Evidence

- `audio-api-service.ts:917-930` appends the full submit response text to `Error.message` and `apiErrorBody`.
- `audio-api-service.ts:977-984` repeats the same behavior for polling/fetch.
- `task-queue-service.ts:1163-1173` stores thrown messages in task error state.
- `CreatePage.tsx:541-545,583-591` and `LyricsPage.tsx:305-310` render the stored message.
- No bounded allowlist or redaction occurs on this forward chain.

