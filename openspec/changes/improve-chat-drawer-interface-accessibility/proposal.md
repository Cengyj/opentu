# Change: Improve Chat Drawer interface accessibility and responsive continuity

## Why

Current-source tracing and controlled browser observations confirm that the existing Chat Drawer loses its only ordinary-chat entry after it is closed at compact viewports, collapses its desktop width to 260 CSS pixels after a 1280 → 320 → 1280 viewport round trip, and exposes several existing operations only through pointer/hover behavior. The same reachable UI also leaves ordinary loading/error states unannounced and bypasses existing Chinese/English Chat translations.

These are changes to user-observable responsive, keyboard, focus, localization, and status behavior, so implementation requires approval. This change is limited to the existing Drawer shell, session controls, ordinary-message state UI, and composer controls.

## What Changes

- Keep an existing Chat-open control reachable after the full-screen compact Drawer is closed
- Preserve the preferred desktop Drawer width across compact viewport/orientation round trips and make the existing resize operation keyboard-operable
- Expose the Drawer as a named non-modal region, connect its disclosure control, and return focus predictably when it closes
- Make title editing and session selection/rename/delete controls valid native keyboard structures, including edit-specific Escape behavior
- Keep existing session and composer actions perceivable on keyboard/touch surfaces and meet the project's compact 44 × 44 CSS-pixel hit-target convention
- Use the current application language for application-owned Drawer, session, ordinary-message, and composer copy
- Add bounded assistive loading/error feedback without announcing prompt, attachment, model response, provider payload, or streaming content repeatedly

## Impact

- Affected specs: `chat-drawer-interface-accessibility`
- Affected code:
  - `packages/drawnix/src/components/chat-drawer/ChatDrawer.tsx`
  - `packages/drawnix/src/components/chat-drawer/ChatDrawerTrigger.tsx`
  - `packages/drawnix/src/components/chat-drawer/SessionList.tsx`
  - `packages/drawnix/src/components/chat-drawer/SessionItem.tsx`
  - `packages/drawnix/src/components/chat-drawer/ChatMessagesArea.tsx`
  - `packages/drawnix/src/components/chat-drawer/EnhancedChatInput.tsx`
  - `packages/drawnix/src/components/chat-drawer/chat-drawer.scss`
  - focused component/browser tests and F-12 evidence
- Preserved boundaries:
  - no Chat message/session storage schema, key, count, ordering, durability, or migration change
  - no busy-send, in-flight request, session-load, provider, task, workflow, retry, attachment, or generation-submission semantic change
  - no Chat lazy-mount/controller, startup bundle, cache, or Service Worker change
  - no new Chat queue, stop/regenerate UI, parallel request, or product capability

