# Change: Fix Chat In-Flight Session Isolation

## Why

The Chat input stays enabled while `useChatHandler` owns an in-flight request. A second user submission reaches the hook, is silently ignored by `isSendingRef`, and then `EnhancedChatInput` immediately clears the text and attachments. The user's second message is neither displayed, persisted, nor sent.

Session message loading and workflow-message loading also have no request identity or cleanup guard. If the user selects session A and then B while A's larger IndexedDB read finishes last, the late A result can replace B's visible messages and raw model history. A subsequent B send can therefore build provider context from A while persisting the new user message under B. In-flight callbacks likewise share one hook state across session changes and can append an origin-session assistant result to a later active session's in-memory history.

Fixing submission acceptance, stale-load suppression, and in-flight ownership changes observable busy/session behavior and requires approval before implementation.

## What Changes

- Give every session load a current selection identity; only the latest active session may commit visible messages, raw model history, workflow messages, and loading state.
- Keep the existing single normal-Chat in-flight limit, but expose it to the composer so a busy submission is not silently accepted and cleared.
- Preserve unsent text and attachments when a submission is rejected as busy, with non-sensitive user feedback.
- Bind every stream callback and terminal persistence operation to the session that accepted the request; a later session selection cannot receive the origin session's UI/raw-history updates.
- Keep session switching available, but prevent a new normal Chat request until the existing global request reaches its terminal durable boundary; the active session must not be contaminated while waiting.
- Preserve Chat storage schemas, model/provider routing, message content, MCP/task execution, workflow retry, session CRUD semantics, and the absence of an automatic message queue.

## Impact

- Affected specs: `chat-session-isolation`
- Affected code:
  - `packages/drawnix/src/components/chat-drawer/EnhancedChatInput.tsx`
  - `packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx`
  - `packages/drawnix/src/hooks/useChatHandler.ts`
  - `packages/drawnix/src/types/chat-ui.types.ts`
  - focused composer/handler/session-race tests
- Related but separate changes:
  - `fix-chat-message-persistence-consistency` owns terminal durability and count metadata.
  - `fix-main-thread-workflow-recovery-sync` owns task-backed workflow projection, not ordinary Chat session selection.

## Evidence

- `useChatHandler.ts:128-135` returns without a result or user feedback when `isSendingRef` is already true.
- `EnhancedChatInput.tsx:304-382` invokes `onSend()` without awaiting acceptance and immediately clears input and uploaded content.
- `ChatDrawer.tsx:1696-1719` passes no busy/disabled state to the composer.
- `useChatHandler.ts:97-121` starts a load per `sessionId` and lets every completion replace visible messages and `rawMessagesRef`; there is no cleanup or request token.
- `ChatDrawer.tsx:785-821` independently loads workflow messages on every selection and lets every completion replace the shared workflow map.
- `useChatHandler.ts:166-172,185-324` reads and mutates one raw/history/UI state from async callbacks while the component itself survives `sessionId` changes.
- `SessionList.tsx:64-72` keeps all session selections reachable during streaming, and no current Chat component calls the hidden `stop()` or `regenerate()` handler methods.
- Current focused baseline passed 7/7 files and 25/25 tests, but no test controls out-of-order session reads or a second send while the first request is pending.

