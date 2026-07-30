## Context

The production entry is `Drawnix → ChatDrawer → ChatDrawerTrigger/SessionList/ChatMessagesArea/EnhancedChatInput`. `ChatDrawer` owns open state, preferred width, active session, title editing, and session CRUD callbacks. `useChatHandler` owns ordinary visible messages and request status; the storage and in-flight correctness changes are already isolated in `fix-chat-message-persistence-consistency` and `fix-chat-inflight-session-isolation`.

Controlled browser observations on the current production build established:

- At 390 × 844, closing the full-screen Drawer leaves the only `ChatDrawerTrigger` at `display: none` and no visible named Chat control.
- At 1280 × 720 the initial Drawer is 640 CSS pixels. The current resize listener writes 260 pixels at a 320-pixel viewport; mobile CSS masks that state with `100vw`, but returning to 1280 renders the Drawer at 260 pixels.
- The Drawer has no role/name; the trigger has no `aria-controls`; Escape from a Drawer textarea closes it and leaves focus on `body`.
- The title is a click-only `h2`; its editing input has no accessible name. Escape cancels the edit and also reaches the global close handler.
- A session row is a `role=button` containing edit/delete `<button>` descendants, handles Enter but not Space, and exposes no active state. The action group is opacity zero until hover.
- Compact action rectangles were 36 × 32.1 (close), 34 × 32.1 (upload), 34 × 32.1 (library), 39.6 × 39.4 (send), and 22 × 32 (session edit/delete). The desktop side trigger was 18 × 48.
- `ChatMessagesArea` renders loading and error text without a bounded live/status role. Existing Chat translation keys are defined for both languages but most Drawer components render literals; `EnhancedChatInput` passes `language="zh"` to previews and labels send in Chinese.

The application intentionally forces a light palette and already has a global reduced-motion rule. This change does not add dark mode, alter the palette broadly, or change motion semantics.

## Goals / Non-Goals

### Goals

- Preserve ordinary Chat reachability across desktop, tablet, mobile, close, reopen, and orientation/viewport round trips.
- Give each existing Drawer/session/composer operation pointer, keyboard, touch, and assistive-technology parity.
- Keep focus and Escape behavior deterministic without turning the desktop Drawer into a modal or trapping focus away from the canvas.
- Localize application-owned copy from the existing global language owner.
- Announce only bounded lifecycle feedback, never user/provider payloads.

### Non-Goals

- Do not change normal Chat request acceptance, busy state, stream ownership, session isolation, terminal persistence, message counts, or session metadata ordering.
- Do not change Chat records, localForage stores, drawer-state keys, width-cache key, backup format, or migrations.
- Do not change provider routing, model selection rules, tasks, workflows, MCP, attachment conversion, media-library semantics, or canvas insertion.
- Do not implement the pending startup Chat controller or alter initial/lazy mounting.
- Do not add queued messages, stop/regenerate controls, parallel sessions, new navigation destinations, or dark mode.

## Decisions

### 1. Preserve a preferred desktop width separately from compact rendering

The existing cached/preferred desktop width remains the state that is synchronized to desktop layout. Compact CSS may render the Drawer full-screen, but a narrow viewport SHALL NOT overwrite the preferred width with `innerWidth - 60`. Returning to a desktop viewport restores a value within the existing minimum/maximum bounds.

Alternative: expand any undersized width to 375 pixels after the viewport grows. Rejected because it prevents the 260-pixel failure but still discards the user's prior width.

### 2. Keep the Drawer non-modal and expose a named region

The desktop Drawer remains a non-modal canvas side panel. Its existing trigger references the Drawer with `aria-controls` and `aria-expanded`; the Drawer is a named complementary region labelled by the current title. Closing with Escape or the close control returns focus to the user-visible opener when focus was inside the Drawer. Programmatic workflow auto-open does not steal focus.

Alternative: use a modal dialog and focus trap at every viewport. Rejected because the current desktop panel intentionally allows continued canvas/navigation interaction and workflow updates.

### 3. Use native, non-nested controls for title and sessions

Title edit receives a named native control. Session selection becomes its own native button, with edit/delete controls as siblings rather than descendants. The active session uses one explicit semantic state. Enter and Space behavior comes from native controls.

Escape in a title/session editing field cancels only that edit, restores focus to its edit trigger, and does not also close the Drawer. Drawer-level Escape remains available outside a nested edit/dialog boundary.

Alternative: add more key listeners to the current clickable `h2` and nested `role=button` row. Rejected because it retains invalid nested interaction ownership and duplicate activation risk.

### 4. Expose the existing resize operation as one input owner

The visual resize handle becomes a vertical separator with a name, current/min/max values, visible focus, and Arrow-key adjustment using the same clamp/update path as pointer drag. Pointer drag remains supported. Compact full-screen mode does not expose an inapplicable resize handle.

Alternative: add separate hidden keyboard resize buttons. Rejected because it creates a second width owner and additional UI not present in the existing feature.

### 5. Localize application copy, not stored or generated data

Existing `chat.*` keys are reused and missing focused keys are added to the current i18n table. Session titles, prompts, messages, workflow/model names, provider errors, attachment names, and generated results remain byte-for-byte data. `SelectedContentPreview` receives the active language instead of a fixed `zh` value, and session time formatting uses the active locale.

Alternative: translate all rendered strings, including stored content and provider text. Rejected because it would mutate or reinterpret user/provider data.

### 6. Announce bounded lifecycle states only

The ordinary request loading state and lazy Chat-loading fallback expose concise localized status. A terminal ordinary error exposes a concise safe alert once. The streaming message container and full transcript are not live regions, avoiding repeated token announcements and sensitive payload exposure.

Alternative: put `aria-live` on the full message list. Rejected because every stream update could be re-announced and may expose prompts/provider output unexpectedly.

### 7. Enlarge hit boxes without enlarging glyphs or hiding actions

At compact or pointer-coarse boundaries, the existing close, session, upload, library, send, and reopen actions use at least 44 × 44 CSS-pixel hit boxes. Session actions are visible under `:focus-within` and on non-hover/pointer-coarse surfaces. Glyph size and action callbacks remain unchanged.

Alternative: keep the current invisible buttons and rely on their tappable layout boxes. Rejected because a control that cannot be perceived cannot be reliably targeted, and the measured boxes remain below the project convention.

## Invariants

- Opening/closing does not create, select, rename, delete, load, or persist a session unless the same existing user action already does so.
- A compact reopen control performs the same `handleToggle/open` operation as the current trigger; it is not a new Chat destination.
- Preferred width remains bounded and uses the existing cache key; no storage migration or cache clearing is performed.
- Session CRUD callbacks, deletion confirmation, analytics event names, message rendering, provider calls, and generation submission remain unchanged.
- Stored/user/provider content is not placed into accessible status text or translation keys.
- Automatic workflow opens do not unexpectedly move keyboard focus.

## Risks / Trade-offs

- A visible compact reopen target can overlap the mobile toolbar or canvas controls. Mitigation: validate 320, 390, 768, safe-area insets, toolbar docking, and z-index ownership.
- Restoring preferred desktop width can affect `ViewNavigation` offset after orientation changes. Mitigation: assert Drawer rect and context-derived navigation offset together.
- Separating session controls can alter flex sizing and ellipsis. Mitigation: long 50-character zh/en titles, timestamps, active state, and action geometry tests.
- Focus return can conflict with nested dialogs or programmatic auto-open. Mitigation: capture the actual user opener, do not steal focus on auto-open, and let the deletion dialog own focus while open.
- Larger compact hit boxes can crowd the composer. Mitigation: retain glyph size and measure overflow/overlap at 320 CSS pixels and 200% zoom.
- Status semantics can become noisy. Mitigation: announce lifecycle transitions only and test unchanged rerenders for zero duplicate announcements.

## Verification and Acceptance Thresholds

- At 320 × 568, 390 × 844, and 768-pixel width, close the Drawer and verify one visible named reopen control; reopen it by pointer, Enter, and Space.
- Repeat 1280 → 320 → 1280 at least 10 times. The restored desktop Drawer width equals the pre-round-trip preferred width within 1 CSS pixel and never falls below 375 pixels when the viewport can accommodate that minimum.
- Verify pointer drag and Arrow-key resize share min/max constraints and width/context projection, with no new localStorage key or write on a mere viewport resize.
- Verify Drawer region name/control relationship; Escape/close focus return; auto-open no-focus-steal; title/session edit cancellation; dialog focus; and no nested interactive controls.
- Verify zh/en initial render and language switching for Drawer, sessions, loading/error/empty copy, composer names/placeholders, previews, and time locale while sentinel user/provider strings remain unchanged.
- At compact/pointer-coarse conditions, every scoped action hit box is at least 44 × 44 CSS pixels with zero Drawer/body horizontal overflow and no overlap.
- Verify loading/status and one safe terminal error announcement; unchanged rerenders and stream chunks produce zero duplicate transcript announcements.
- Run focused tests, Drawnix/full typecheck, focused lint, full tests, cycles, production build, size, startup verification, and Chat smoke/feature/visual/responsive flows against the recorded baseline. This change must not alter startup or bundle budgets to manufacture a pass.

No performance improvement is claimed by this proposal. If implementation claims render, input, or resize performance changes, record at least five before/after samples under identical conditions.

## Rollback

Revert the Drawer entry/width state, semantic/focus markup, native session/title structure, localized labels, bounded status nodes, compact hit-box styles, and their focused tests as one change. Keep the existing width cache key and all Chat stores untouched; no user data deletion, cache reset, or migration rollback is required. Because this workspace has no Git metadata, rollback must be maintained as an explicit file patch rather than described as `git revert`.

