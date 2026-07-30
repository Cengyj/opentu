## Context

Provider transport returns an untrusted HTTP body. The audio API currently uses one error object for internal diagnostics, durable task state, and end-user display. Those consumers have different privacy and recovery needs and require an explicit safe boundary.

## Goals / Non-Goals

- Goals:
  - Keep user/task errors bounded, localized, actionable, and independent of arbitrary provider payloads.
  - Retain HTTP status, operation stage, and a safe normalized reason for diagnosis.
  - Apply the same policy to submit and fetch/poll failures.
- Non-Goals:
  - Hide the HTTP status, change retry/cancellation classification, add telemetry, or alter successful provider payload logging in this change.
  - Claim a specific secret leak without a provider sample.
  - Redesign error policy for every provider or historical task record.

## Decisions

- Introduce a Suno error normalizer that receives stage/status/content-type/body and returns separate `userMessage` and `diagnosticSummary` values.
- Allowlist short plain-text or known JSON message/code fields only after stripping markup/control characters, bounding length, and redacting credential/token/key/bearer patterns plus URLs/query strings.
- Unknown, oversized, binary, HTML, or unsafe bodies use localized generic text containing only action/stage and HTTP status.
- Thrown errors carry a stable internal category/status, not the raw body. Task persistence stores only the safe user message/category.
- LLM failure logging receives only the diagnostic summary. Tests inspect the logger argument to prevent raw body regression.

## Invariants

- Submit/fetch URL, headers, body, provider routing, polling attempts, terminal classification, and retry eligibility remain unchanged.
- A safe recognized provider reason can still help correction, but user/task/log text never includes disallowed content.
- Error normalization never throws and never converts an HTTP failure to success.

## Risks / Trade-offs

- Redaction can remove a useful provider reason.
  - Preserve status/action/category and allow only explicitly safe known fields.
- Localization can diverge across Create/Lyrics/task panel.
  - Store one safe task message and use existing surface-local fallback labels.
- Existing logs may already contain raw data.
  - This change is forward-only; historical log cleanup requires separate authorization and retention evidence.

## Verification And Rollback

- Table tests cover plain text, known JSON, nested message, HTML, huge body, URLs/query tokens, bearer/key patterns, invalid Unicode/control text, empty body, and logger/task/UI propagation.
- Assert submit/fetch request count, status/retry classification, and successful paths are unchanged.
- Browser-check safe generic/recognized states with mocked local responses only; do not call a paid provider.
- Rollback normalizer/call sites/tests; no data migration or cache action.

