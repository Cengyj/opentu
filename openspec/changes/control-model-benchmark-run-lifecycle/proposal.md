# Change: Control Model Benchmark Run Lifecycle

## Why

The workbench specification says users can start, monitor, and stop entries, but the reachable service/UI has no stop or cancellation operation. `runSession` has no per-session singleflight, so two callers can issue duplicate paid provider requests. Deleting a running session removes local tracking without stopping its external call. Persisted `running` sessions and entries are loaded unchanged after refresh even though no execution is resumed.

Controlled mock diagnostics confirmed duplicate invocation, continued provider work after deletion, and permanent-looking restored `running` state. Execution, cancellation, deletion, and recovery semantics require approval.

## What Changes

- Give each session one in-memory run owner; repeated starts join/ignore the active run instead of issuing duplicate requests.
- Add truthful stop behavior: queued entries stop immediately; in-flight work uses an existing abort boundary where supported and otherwise remains visibly stopping until it actually settles.
- Prevent deletion while a run is active/stopping so external work cannot become untracked.
- Add additive cancelled/interrupted persisted states and normalize refresh-orphaned running work to interrupted without resuming or retrying provider requests.
- Keep selected targets, concurrency cap, provider routing, prompts, results already completed, and manual feedback unchanged.

## Impact

- Affected specs: `toolbox`
- Affected code: benchmark service/types, adapter invocation boundary where cancellation is already supported, workbench controls/history, persistence sanitization, focused tests
- Data change: additive terminal status values; existing records remain readable and are normalized at load, with no key change or background provider request
- Rollback restores prior statuses/run owner/UI and tests; records with additive statuses require a tolerant read fallback before rollback

## Evidence

- `model-benchmark-service.ts:774-893` starts any existing nonempty session and has no active-run map or stop token.
- `model-benchmark-service.ts:643-674` removes sessions regardless of status and has no cancellation hook.
- `model-benchmark-service.ts:498-521` restores persisted status values unchanged and starts no recovery execution.
- Isolated diagnostic: two concurrent `runSession` calls produced two `sendChat` calls; removal during a deferred call left the call running; a persisted running session/entry loaded as running. All diagnostic assertions passed with mocks; no provider was contacted.

## Approval

Implementation is blocked until the user approves singleflight, truthful stop, active-delete guard, and interrupted recovery semantics.
