## Context

External iframe availability belongs to another origin and can be slow, offline, blocked by policy, or visually empty. Same-origin inspection cannot be assumed. The runtime therefore needs honest observable states based only on local lifecycle signals and elapsed time, without claiming to diagnose the remote cause.

## Goals / Non-Goals

- Goals:
  - Make initial loading and known/extended failure states visible and accessible in WinBox and canvas.
  - Give the user one safe retry path without losing the surrounding tool/window/canvas state.
  - Keep multiple iframe instances and stale callbacks isolated.
- Non-Goals:
  - Speed up or modify third-party pages, bypass CSP/`X-Frame-Options`, inspect cross-origin content, or guarantee failure detection.
  - Add an external-browser launch, offline copy, service-worker cache, new permission, or background polling capability.
  - Change outer WinBox geometry/focus/title controls or canvas selection/drag behavior.

## Decisions

- Represent external iframe content with local `loading`, `slow`, `loaded`, and `error` states. `slow` means the load signal has not arrived by the threshold; it does not assert that loading failed.
- Render status as an absolute overlay above the iframe. Keep the iframe mounted while loading/slow so navigation continues; hide or make it non-interactive until loaded when necessary to keep the feedback operable.
- Start one bounded timer per iframe instance. Clear it on load, error, retry, URL/tool change, close/unmount, or canvas cleanup. Ignore stale callbacks with an attempt token.
- Use a 10-second default slow threshold, covered by fake-timer tests. It exceeds the initial 3-second blank evidence and produces guidance rather than a failure verdict.
- On retry, recompute the URL through the approved safe template boundary, increment the attempt token, reset state/timer, and navigate the existing/new iframe once. Do not log or render the URL.
- Use `role=status` with polite loading/slow announcements and `role=alert` for an actual error signal. The retry control has a localized name, visible focus, and at least 44×44 CSS px hit area in compact touch layouts.
- Keep WinBox and canvas presentation code local to their existing renderers; share only a small pure lifecycle contract if tests demonstrate duplication risk. Do not introduce a new repository/event bus/runtime layer.

## Invariants

- A successful first attempt issues the same one external navigation as before and presents the same iframe URL, sandbox, feature permission, geometry, and content.
- Slow guidance never cancels the in-flight navigation; a later load signal transitions to `loaded`.
- Only explicit retry can issue an additional request or reset remote iframe state.
- Closing/removing one instance leaves no timer/callback that can update another instance.
- Feedback and diagnostics contain no raw URL, fragment, key, prompt, tool instance ID, or third-party body.

## Risks / Trade-offs

- `load` can fire for an unusable browser-generated error document.
  - Keep the bounded slow/error contract honest and do not claim complete cross-origin failure detection; verify known reachable and synthetic error paths.
- An overlay can block a page that has visually rendered before `load`.
  - Keep it lightweight, remove immediately on load, and record transition timing/visual state in browser tests.
- Retry discards in-frame state.
  - Require explicit activation, describe the action as reload, and preserve outer window/canvas state.
- Multiple instances can race timers.
  - Use per-instance attempt identity and fake-timer/unmount tests.

## Verification And Rollback

- Unit/component tests: initial/loading/load/error/slow/retry, late load after slow, stale events, unmount/close cleanup, multiple instances, privacy-safe text, sandbox/allow preservation, one request without retry.
- Canvas tests assert status stacking above the iframe and selection/overlay behavior; WinBox tests assert external branch semantics independently of internal Suspense.
- Browser: synthetic delayed/success/error pages plus Banana/Pose at desktop/tablet/mobile, light/dark, Chinese/English, 100%/200%, keyboard/focus, reduced motion.
- Capture same-state before/after screenshots and rectangles. Do not report faster loading unless at least five controlled samples are measured.
- Roll back lifecycle state/styles/tests together; no data migration, cache deletion, or remote action is involved.

