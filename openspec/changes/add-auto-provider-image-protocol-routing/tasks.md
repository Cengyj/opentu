## 1. Specification And Investigation

- [x] 1.1 Review project instructions, current provider/image specifications, related active changes, and the implemented invocation chain.
- [x] 1.2 Record the approved design, compatibility boundary, ambiguity policy, authentication ownership, testing, and rollback plan.
- [ ] 1.3 Validate this change with strict OpenSpec validation. (Blocked: the `openspec` CLI is unavailable in the current environment and exits 127.)

## 2. Settings And Types

- [x] 2.1 Add and normalize `ProviderType:auto` without migrating existing profiles.
- [x] 2.2 Add the “自动（按模型）” settings option and explanation while preserving explicit authentication and headers.
- [x] 2.3 Add save/reload and legacy/default-profile snapshot tests.
- [x] 2.4 Make `auto` the settings-page default for newly created provider profile drafts without changing profile loading or routing behavior.

## 3. Runtime Routing

- [x] 3.1 Build model-scoped auto image bindings for GPT generation/edit, Gemini generation, and existing specialized protocols.
- [x] 3.2 Reject missing or ambiguous auto bindings and prevent adapter fallback after an explicit plan exists.
- [x] 3.3 Make query authentication key naming derive from the selected binding contract.
- [x] 3.4 Preserve final model and binding identity in direct and task-backed snapshots, retries, and recovery.

## 4. Verification

- [x] 4.1 Add unit, integration, and full direct/task contract coverage.
- [x] 4.2 Run focused provider, settings, adapter, executor, queue, MCP, discovery, and modality tests.
- [x] 4.3 Run typecheck, lint, cycle detection, diff checks, and the permitted build/check suites.
- [x] 4.4 Validate the local `default 分组` profile, persistence, GPT Image call, Gemini Image call, result delivery, and restored model selection.
- [x] 4.5 Review the final diff and confirm protected user changes remain untouched.
- [x] 4.6 Run the focused new-profile draft test, manual-provider routing regressions, typecheck, and final diff checks after changing the default.
