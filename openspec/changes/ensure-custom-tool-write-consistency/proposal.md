# Change: Ensure Custom Tool Write Consistency

## Why

Every custom-tool mutation changes the in-memory array before awaiting localForage. If `setItem` fails, the promise rejects and existing UI/sync callers report failure, but the changed catalog remains authoritative for the session. A controlled diagnostic forced an add write to reject: `addCustomTool` rejected while `getToolById` still returned the allegedly failed tool.

This creates user-visible state reversals and can make a later mutation or GitHub sync persist an operation that the UI already reported as failed. Fixing commit order and concurrent write semantics changes storage timing, so implementation requires approval.

## What Changes

- Serialize persisted custom-tool mutations in their accepted order.
- Build each mutation against the last successfully committed catalog snapshot.
- Commit a new in-memory catalog only after its localForage write succeeds.
- Preserve the prior in-memory and persisted catalog when add, update, remove, clear, or import persistence fails.
- Keep existing caller messages/logs and success return shapes, while ensuring they describe the committed result.

## Impact

- Affected specs: `toolbox-plugin-runtime`
- Affected code: `packages/drawnix/src/services/toolbox-service.ts`, focused service/custom-dialog/GitHub-sync tests
- Related change: `ensure-toolbox-initialization-consistency` establishes readiness before this ordered write boundary; the two requirements are independently testable and revertible
- Preserved data/API: `aitu:custom-tools`, version `1.0`, tool schema, GitHub format, URLs/permissions, analytics, and UI layout remain unchanged

## Evidence

- `packages/drawnix/src/services/toolbox-service.ts:146-148`, `:153-160`, `:180-184`, `:233-235`, and `:260-275` mutate `customTools` before awaiting `saveCustomTools()`.
- `packages/drawnix/src/services/toolbox-service.ts:96-109` rethrows storage failure without restoring memory.
- `packages/drawnix/src/components/custom-tool-dialog/CustomToolDialog.tsx:129-151` reports add failure from the rejected promise, while the service catalog can already contain the tool.
- `packages/drawnix/src/services/github-sync/tool-sync-service.ts:75-112` reports an import failure as zero changes, while the current service can retain the imported entries.
- Controlled Node 24.14.0 / Vitest 3.2.4 diagnostic: mocked `setItem` rejected, `addCustomTool` rejected, then `getToolById` still returned the added tool; 1/1 test passed, exit 0. The temporary diagnostic was deleted.

## Approval

Implementation is blocked until the user approves durable-before-visible commit ordering and serialized mutation semantics.

