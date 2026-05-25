# Change: Default image compatibility to OpenAI GPT Image and remove For GPT mode

## Why

The project should converge on a single explicit GPT Image request format. `for-gpt-image` was introduced as a separate compatibility path, but the current rollout decision is to migrate users from `for-gpt-image` to `openai-gpt-image` and delete the dedicated For GPT code path.

## What Changes

- Refine internal image compatibility modes to three stored values:
  - `auto`
  - `openai-gpt-image`
  - `openai-compatible-basic`
- Default newly created provider profiles to `openai-gpt-image`.
- Default built-in managed/default provider profiles to `openai-gpt-image` when no stored override exists.
- Preserve explicit custom `auto` choices, but resolve ForOpenCode GPT Image `auto` to `openai-gpt-image` instead of `for-gpt-image`.
- Migrate any stored `for-gpt-image`, `tuzi-gpt-image`, or `tuzi-compatible` value to `openai-gpt-image` during settings/profile normalization.
- Remove the dedicated `for-gpt-image-adapter` and `for.image.*` / `tuzi.image.*` request schemas.
- Route GPT Image generation and edit requests through the official `gpt-image-adapter` and official request schemas.
- Keep `openai-compatible-basic` as the generic fallback for non-GPT image providers and manual rollback.
- Remove `For GPT 兼容` from the settings UI options and hints.

## Non-Goals

- Do not remove `auto`.
- Do not remove `openai-compatible-basic`.
- Do not add a new MCP tool name or image task type.
- Do not change non-GPT image provider routing.

## Impact

- Affected specs:
  - `provider-profiles`
  - `provider-routing`
  - `image-generation`
- Affected code:
  - `packages/drawnix/src/utils/settings-types.ts`
  - `packages/drawnix/src/utils/settings-manager.ts`
  - `packages/drawnix/src/components/settings-dialog/settings-dialog.tsx`
  - `packages/drawnix/src/components/settings-dialog/image-api-compatibility-display.ts`
  - `packages/drawnix/src/services/provider-routing/settings-repository.ts`
  - `packages/drawnix/src/services/provider-routing/binding-inference.ts`
  - `packages/drawnix/src/services/model-adapters/default-adapters.ts`
  - `packages/drawnix/src/services/model-adapters/registry.ts`
  - `packages/drawnix/src/services/model-adapters/image-request-schemas.ts`
  - `packages/drawnix/src/services/model-adapters/for-gpt-image-adapter.ts` (removed)
  - image routing, adapter registry, MCP image, and media executor tests
