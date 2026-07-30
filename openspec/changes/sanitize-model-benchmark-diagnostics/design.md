## Context

The same benchmark response/error object currently serves preview rendering, durable history, export, and analytics. Those sinks have different data needs. Result comparison needs normalized text/media metadata and timings, not an unbounded provider envelope.

## Goals / Non-Goals

- Goals: bound persisted/rendered/exported/analytic diagnostics, preserve actionable safe recovery data, and keep successful preview behavior.
- Non-Goals: claim a real credential leak, redesign all provider logging, delete the benchmark store, remove user prompts, change provider requests, or sanitize unrelated task history.

## Decisions

- Define a serializable benchmark preview DTO containing only bounded text, URL(s), format, duration, and title. `rawData` is not part of durable state.
- If a details view remains, derive a short allowlisted summary from known non-sensitive fields and redact credential/token/key/bearer patterns, URLs/query strings, markup, controls, and oversized/recursive structures.
- Normalize errors to stable stage/category/status plus an optional bounded safe recognized reason. Unknown values use localized generic guidance.
- Analytics records category/status/modality/timings and never raw error message, response object, prompt, URL, credential, or stack.
- On load, discard raw diagnostic fields from the in-memory projection. Persist their removal only during the next normal write; do not enumerate/delete IndexedDB records in the background.

## Invariants

- Provider request, routing, concurrency, retry/cancel classification, successful text/media preview, timings, cost field, ranking, prompt, and manual feedback remain unchanged.
- Sanitization never turns a failure into success or invents provider details.
- Data retained for UI/export/analytics is serializable, bounded, and free of declared unsafe sentinel classes.

## Risks / Trade-offs

- Removing raw envelopes reduces ad-hoc debugging detail; safe category/status and allowlisted summary replace it.
- Redaction can hide a useful provider reason; known safe fields remain optional, with generic fallback.
- Historical raw data remains physically present until an ordinary accepted write; UI/read boundaries must still ignore it immediately.

## Verification And Rollback

- Table tests cover nested/recursive/oversized objects, HTML, URLs/query strings, bearer/key patterns, control text, safe known fields, four successful modalities, error storage/UI/export/analytics, and historical reads.
- Browser uses local synthetic results/errors only. Run repository gates against baseline.
- Rollback the DTO/error normalizer/read filter/call sites/tests; no store deletion or migration command is needed.
