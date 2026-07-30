## Context

The internal benchmark tool reuses one primary instance by default, while the handoff owner is process-global and survives that instance being closed. `launchedAt` distinguishes requests but does not remove one after use.

## Goals / Non-Goals

- Goals: each shortcut is applied once, stale requests cannot replay after close/reopen, and delayed discovery remains supported.
- Non-Goals: close the settings window, redesign tool-window geometry, auto-run a benchmark, change provider discovery, persist launch requests, or add a new product entry point.

## Decisions

- Attach an explicit request ID to each published shortcut request.
- Clear by identity-checked compare-and-ack after prefill is actually applied. If discovery is still loading, retain the request; if the target becomes terminally unavailable, show safe feedback then acknowledge.
- A generic toolbox open creates no request and therefore uses current default builder state.
- Analytics records request/instance IDs and selection metadata already present, never API key, prompt, raw response, or URL.

## Invariants

- One shortcut is applied once by the reachable reused/new workbench and never starts a provider call unless `autoRun` was explicitly authorized by existing behavior.
- Delayed discovery cannot cause premature loss or replay.
- Tool ID, multi-instance behavior, provider/model selection rules, compare-mode fallback, window maximize behavior, and benchmark storage remain unchanged.

## Risks / Trade-offs

- Window opening can fail after publishing a request; failure must clear only that request and report existing safe launch feedback.
- Multiple mounts/StrictMode can race to acknowledge; compare-and-ack must be idempotent.
- Workbench remount and request acknowledgement can overlap; identity checks must prevent an older cleanup from clearing a newer shortcut.

## Verification And Rollback

- Tests cover old-request replay, sequential shortcuts, StrictMode remount, delayed/failed discovery, plain toolbox open, launch failure, and no-auto-run.
- Browser verification requires at least one mock/configured model entry but no credential or provider call.
- Rollback request identity/ack/effect/tests; no shared window context, stored data, or cache changes.
