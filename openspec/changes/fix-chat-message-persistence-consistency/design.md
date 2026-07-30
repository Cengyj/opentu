## Context

Chat sessions and messages live in separate localForage stores in the `aitu-chat` database. `addMessage()` already updates the session count and timestamp, but two production callers also maintain the same count. Normal Chat terminal writes are launched from a synchronous stream callback without being awaited. Agent tool handling is an async callback whose first workflow update can run before the assistant record exists.

The current `messageCount` field is not rendered by `SessionItem`, but it is part of durable session metadata and complete environment backups. Existing sessions can therefore contain inflated counts even though their message records remain intact.

## Goals / Non-Goals

### Goals

- A newly created or loaded session SHALL have one authoritative count equal to its persisted message records.
- A successful send boundary SHALL not complete before its terminal assistant record is durable, or before a storage failure is reported.
- Agent workflow metadata SHALL only update an existing assistant record and SHALL survive refresh.
- Old inflated counts SHALL be corrected when that session is loaded, without changing its activity timestamp.

### Non-Goals

- Do not add a message-count badge, Chat search, export UI, cloud sync, or cross-tab Chat synchronization.
- Do not scan every Chat message during app startup merely to repair unopened sessions.
- Do not change message/session schemas, backup version, storage keys, model/provider routing, MCP execution, task recovery, or workflow cancellation.
- Do not claim a performance improvement; any added IndexedDB read/write cost must be measured.

## Decisions

### 1. Make the storage service the only count owner

`addMessage()` distinguishes a new key from replacement of the same key and applies the corresponding count delta. `deleteMessage()` remains the inverse operation. Callers update titles or visible session state but never arithmetic on the durable count.

Alternative: keep caller-owned `+1`/`+2` writes. Rejected because callers already disagree with the storage service and stale snapshots make arithmetic dependent on call order.

### 2. Reconcile only sessions that are loaded

After `getMessages(sessionId)` has already produced the session's message array, the session metadata may be corrected to that length through a write that preserves the previous `updatedAt`. No all-session message scan is introduced at startup.

Alternative: rewrite every session during startup or backup. Rejected because localForage messages have no `sessionId` index and may contain large attachment payloads; a full-store migration cost is not justified for metadata that is not currently rendered.

### 3. Move terminal persistence out of fire-and-forget callbacks

The stream callback remains responsible for progressive UI content, while terminal success/error handling records a promise that the send operation awaits before it releases its in-flight owner. Persistence rejection becomes an explicit Chat error path without logging message or attachment content.

Alternative: add a fixed delay before unlocking or refresh. Rejected because timing cannot prove IndexedDB durability.

### 4. Persist the assistant base record before workflow patches

Agent tool-call conversion first establishes the assistant record with its workflow marker. Workflow creation and terminal patches are then sequenced after that insert. Task execution itself need not be held open by the Chat send promise once the durable workflow record exists.

Alternative: make `updateMessage()` create a partial record when the ID is absent. Rejected because it lacks required `sessionId`, role, content, timestamp, and attachment invariants and can manufacture malformed Chat records.

## Invariants

- A message key belongs to one session; replacing the same key does not increase the count.
- A count reconciliation never changes the session title, creation time, or activity time.
- User messages remain durable before the provider request starts.
- Success/error UI and the send completion boundary cannot claim durable completion before the terminal write resolves.
- Workflow patches never create partial ChatMessage records.
- Storage errors and logs do not expose prompt text, attachments, API keys, provider credentials, or raw payloads.

## Risks / Trade-offs

- Checking whether a message ID already exists adds one localForage read to insert semantics unless the implementation can reuse a proven existing record lookup.
- Awaiting terminal persistence can keep the busy state active slightly longer after the last visible token.
- Lazy count correction repairs opened sessions only; unopened legacy metadata remains byte-for-byte compatible until touched.
- Tool execution and workflow persistence remain separate async operations; the change guarantees an existing base record, not cross-store crash atomicity with task storage.

## Verification and Performance Thresholds

- Deterministic tests cover normal success, stream error, thrown error, workflow pair creation, same-ID replacement, deletion, legacy count correction, and injected storage rejection.
- A delayed-storage test proves the send promise and busy owner remain pending until the terminal assistant write resolves.
- A controlled tool-call test proves `addMessage(base)` completes before the first `updateMessage(workflow)` and that refresh returns the workflow field.
- Run at least five samples for two-message success with immediate storage and with an injected 25 ms storage delay; record every raw result, median, min/max, and the additional terminal-busy interval. No startup or bundle budget increase is permitted.
- Focused tests, typecheck, cycles, build, size, startup checks, and available Chat browser flows add no failures relative to baseline.

## Rollback

Revert the storage ownership, lazy reconciliation, terminal await boundary, tool-call sequencing, and focused tests together. No store deletion or schema migration is involved; all existing records remain readable by the previous implementation. Counts corrected while a session was opened remain valid integers if the code is rolled back.

