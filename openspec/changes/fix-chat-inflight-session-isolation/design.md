## Context

`ChatDrawer` owns one `useChatHandler` instance whose React state and refs persist when `activeSessionId` changes. The hook has a single in-flight lock, and `chatService` has one module-level AbortController. This establishes a global single-request limit, but the composer and session projection do not know that limit. Session messages and workflow messages are loaded by separate unguarded async paths.

## Goals / Non-Goals

### Goals

- A submission rejected because Chat is busy SHALL retain the user's draft and provide an explicit state.
- A late read for an older session SHALL never replace the current session's visible or model-history state.
- Stream and terminal callbacks SHALL update only the session that accepted the request.
- Session switching SHALL remain possible while a request runs, without enabling a second normal provider request or contaminating the selected session.

### Non-Goals

- Do not add queued Chat messages, parallel Chat requests, background request management UI, a stop button, or regenerate UI.
- Do not change provider protocols, model selection, MCP/task execution, Chat storage schema, session CRUD rules, or workflow recovery ownership.
- Do not silently cancel the origin request merely because the user views another session.
- Do not claim lower latency or render cost without measurements.

## Decisions

### 1. Use monotonically increasing load identities

The ordinary-message load and ChatDrawer workflow-message load each capture a request identity and requested session ID. A completion commits only if both still match the latest active selection. Cleanup invalidates earlier requests; IndexedDB cancellation is not required.

Alternative: depend on IndexedDB requests completing in selection order. Rejected because the code issues independent asynchronous iterations and provides no ordering contract across different session sizes.

### 2. Expose busy submission separately from composer editability

The composer may retain/edit a draft while a request is active, but its submit action is unavailable. The send contract reports whether a message was accepted; a programmatic or same-frame busy rejection leaves text/attachments intact and produces safe feedback.

Alternative: disable the entire composer with the existing `disabled` prop. Rejected because it also prevents drafting, attachment removal, and model inspection even though only submission conflicts with the single in-flight owner.

Alternative: automatically queue the second message. Rejected because that adds a new product capability and ordering/recovery semantics outside this bug fix.

### 3. Bind asynchronous callbacks to the accepting session

Each accepted send captures its session ID and request generation. UI and `rawMessagesRef` mutations are conditional on that session still being active. Durable writes continue to target the captured origin session. Until that request reaches its terminal durability boundary, another normal Chat send remains busy even if the user views a different session.

Alternative: silently abort on session selection. Rejected because current visible UI has no cancellation contract and the hidden stop path persists partial output as success.

## Invariants

- The active session ID, visible messages, raw provider history, and workflow-message map refer to the same selected session.
- A stale load may finish and be discarded but cannot clear the current loading state or overwrite current data.
- A rejected send does not mutate storage, visible messages, prompt history, input text, or attachments.
- An origin-session stream never appends content or raw history to a later active session.
- Only one ordinary Chat provider request remains active globally; this change does not add queuing or parallelism.
- Busy/error feedback contains no prompt, attachment, API key, token, provider credential, or raw response payload.

## Risks / Trade-offs

- Allowing draft composition while submit is busy requires a distinct submit-disabled/acceptance contract instead of reusing the broad `disabled` prop.
- The origin request can finish while another session is visible; the session list metadata must update without replacing the selected session's message list.
- The current module-level AbortController remains a global boundary; any later parallel-request feature would require a separate proposal.
- Request identity guards must cover success, error, tool-call, session deletion, new session creation, and unmount paths.

## Verification and Performance Thresholds

- Controlled deferred promises resolve A after B and prove B remains the only visible/raw/workflow session in 10/10 event-order permutations.
- A delayed provider test submits a second message while the first is pending and proves the second draft and attachments remain, storage/API call counts stay unchanged, and explicit busy feedback is emitted once.
- A switch-during-stream test proves all durable writes target origin A while selected B receives no A content or raw history.
- Run at least five samples of A→B session switching with 0, 100, and 1,000 fixture messages; record raw selection-to-render latency, median, min/max, discarded completion count, and any additional commit cost. No budget increase is permitted.
- Focused tests, typecheck, cycles, build, size, startup checks, and available keyboard/responsive/visual Chat flows add no failures relative to baseline.

## Rollback

Revert load identities, request/session ownership guards, composer submit availability, acceptance results, and focused tests together. No persistent data is migrated or deleted, so existing Chat records remain readable by the prior implementation.

