# F-12 Chat Agent tool-message persistence ordering diagnostic

Date: 2026-07-30 (Asia/Shanghai)

## Scope and classification

**User scenario**: an Agent response contains a tool call. Chat converts the assistant placeholder to a workflow message, starts tool execution, and persists enough workflow state that a refresh while the tool is pending can reconstruct the message and its steps.

**In scope**: the `useChatHandler` done callback, `ChatDrawer.handleToolCalls`, assistant base-message insertion, workflow `updateMessage`, current localForage storage semantics, refresh readback, and the existing `fix-chat-message-persistence-consistency` owner. **Out of scope**: MCP/task success, provider quality, F-11 task recovery, message count, terminal-write waiting, busy submissions, cross-session loads, new stop/retry UI, and implementation before approval.

The former `CHAT-TOOL-PERSIST-RACE-001` hypothesis is superseded by confirmed `CHAT-TOOL-PERSIST-RACE-002`. Evidence is strong for production invocation order plus the actual current storage service under a controlled IndexedDB implementation. Production occurrence frequency and the duration of the vulnerable interval are unmeasured.

## Forward and reverse chain

1. `useChatHandler.ts:180-195` receives provider stream events; on `done`, it parses tool calls at `:196-205`.
2. For a tool response, it constructs the workflow marker and synchronously invokes `onToolCallsRef.current(...)` at `:233-254`.
3. The production callback is `ChatDrawer.handleToolCalls` (`ChatDrawer.tsx:306-434`). It constructs full `WorkflowMessageData`, publishes it to React, and calls `chatStorageService.updateMessage(messageId, { workflow })` without awaiting at `:328-360` before its first awaited tool operation at `:363`.
4. Control returns to the still-running `done` callback, which only then constructs and starts `chatStorageService.addMessage(assistantChatMsg)` at `useChatHandler.ts:257-275`; this Promise is also not awaited.
5. `chat-storage-service.ts:127-135` implements the first update as `getItem(id)` followed by a conditional `setItem`; a missing record produces a fulfilled no-op. `addMessage` writes the complete record at `:101-113`.
6. Reverse from a refreshed workflow message: `getMessages(sessionId)` (`:116-124`) can only return the base record plus whatever `updateMessage` committed. No later read repairs a missing initial workflow. A terminal tool patch may eventually write workflow after execution, but a refresh/context termination during the pending period loses the only initial durable step snapshot.

Inputs are a complete `ChatMessage` base and `Partial<ChatMessage>{workflow}` patch sharing one ID. Outputs are two `Promise<void>` values that both fulfill even when the patch commits nothing. The message store is the durable owner; React `workflowMessages` is the visible owner. There is no timeout, cancellation, transaction spanning callback/base/patch, or retry. The diagnostic used synthetic content and no provider, network, credentials, user data or browser storage.

## [CHAT-TOOL-PERSIST-RACE-002]

**Status**: confirmed correctness/recovery defect; implementation remains blocked by the existing `fix-chat-message-persistence-consistency` approval.

**User impact**: after Chat visibly exposes a pending Agent workflow, a refresh before a later successful/failed tool patch can read an assistant marker without its workflow steps. Pending progress and recovery linkage are absent from the durable message even though both initial storage calls reported fulfilled.

**Reproduction**:

1. Use current `chat-storage-service.ts` unchanged with localForage and fake-indexeddb 6.2.5.
2. Clear both Chat stores and create one session.
3. For an absent assistant ID, start `updateMessage(id, { workflow })`.
4. Immediately start `addMessage(baseMessage)` with the same ID.
5. Await both, call `getMessages(sessionId)`, and inspect the only record.

**Current versus expected**: current readback equals the complete base message and has `workflow === undefined`. The already-proposed contract requires the base record to exist before the first workflow patch; readback after that patch must contain the workflow.

**Evidence**: fixed bundled Node 24.14.0; Vitest 3.2.4; jsdom; fake-indexeddb 6.2.5; no network or real storage. Command `pnpm --dir packages/drawnix test src/services/chat-tool-persistence-order.diagnostic.test.ts` exited 0; 1/1 file and 1/1 test passed; test 13 ms, Vitest 1.21 s, wall 2.37 s. The temporary test was removed after capture. The passing assertion describes the defect rather than desired behavior.

**Root cause**: the caller publishes a partial patch before establishing the required base-record invariant, while `updateMessage` represents “target absent” as fulfilled `void`. Two independent fire-and-forget calls therefore cannot communicate or enforce their order.

**Impact range**: current ordinary Agent tool calls using `ChatDrawer.handleToolCalls`; non-tool assistant messages do not call this patch path. Task-backed terminal recovery remains F-11. Frequency and real IndexedDB timing are not claimed.

**Evidence strength**: high for source order and deterministic service behavior; unknown for production incidence and timing.

**Candidate and alternatives**: retain the existing change design—persist/await the complete assistant base first, then apply the initial workflow patch, and keep terminal patches sequenced afterward. Upserting a partial record is rejected because it lacks required session/role/content/timestamp invariants. Fixed delays and retrying a fulfilled no-op cannot prove durability.

**Risks**: terminal UI/busy timing, tool execution beginning before required Chat persistence, storage rejection feedback, and duplicate count/session metadata writes. These are already separated into the same change's terminal/count/session requirements and must be tested together after approval.

**Validation**: a permanent red/green hook/callback test must control base and patch settlement and assert refreshed workflow bytes, plus normal success/error, storage rejection, count, session projection, attachments and privacy. The current diagnostic alone is not a long-term regression suite.

**Rollback**: revert the base-before-patch sequencing and focused tests together. No key/schema/migration or cleanup is required; the confirmed workflow-loss window returns.

## Remaining boundaries

- If tool execution completes and a later patch commits before refresh, that later full workflow can mask the initial loss. This does not negate the confirmed pending-window result.
- The browser-visible duration depends on provider/tool/storage timing and has not been measured five times; no performance claim is made.
- `CHAT-SESSION-LOAD-RACE-001` remains a separate latest-session projection hypothesis owned by `fix-chat-inflight-session-isolation`.
- No runtime/permanent test was modified in this diagnostic sub-loop.
