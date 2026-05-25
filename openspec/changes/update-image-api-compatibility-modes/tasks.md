## 1. Compatibility Model

- [x] 1.1 Remove `for-gpt-image` from the supported `ImageApiCompatibility` union.
- [x] 1.2 Keep `auto`, `openai-gpt-image`, and `openai-compatible-basic` as supported stored values.
- [x] 1.3 Treat `for-gpt-image`, `tuzi-gpt-image`, and `tuzi-compatible` as read-time migration aliases to `openai-gpt-image`.

## 2. Defaults And Migration

- [x] 2.1 Default newly created provider profiles to `openai-gpt-image`.
- [x] 2.2 Default built-in managed/default profiles to `openai-gpt-image` when no stored override exists.
- [x] 2.3 Preserve explicit supported overrides such as `auto` and `openai-compatible-basic`.
- [x] 2.4 Persist migrated removed For GPT compatibility values as `openai-gpt-image`.

## 3. Routing And Adapters

- [x] 3.1 Resolve ForOpenCode GPT Image `auto` to `openai-gpt-image`.
- [x] 3.2 Remove `for.image.*` and `tuzi.image.*` request schemas.
- [x] 3.3 Remove `for-gpt-image-adapter` registration/export/source file.
- [x] 3.4 Route GPT Image generation through `openai.image.gpt-generation-json` and `gpt-image-adapter`.
- [x] 3.5 Route GPT Image edit through `openai.image.gpt-edit-form` and `gpt-image-adapter`.

## 4. Settings UI

- [x] 4.1 Remove `For GPT 兼容` from the image API compatibility option list.
- [x] 4.2 Normalize removed compatibility values to `OpenAI GPT Image` for display/hints.
- [x] 4.3 Keep `auto` and `openai-compatible-basic` available for advanced/fallback scenarios.

## 5. Verification

- [x] 5.1 Update settings normalization tests for migration from removed For GPT values to `openai-gpt-image`.
- [x] 5.2 Update provider routing tests for ForOpenCode GPT Image auto resolution to official GPT mode.
- [x] 5.3 Update adapter registry/routing tests to remove the dedicated For GPT adapter path.
- [x] 5.4 Update MCP/media edit-schema tests to prefer only the official GPT edit schema.
- [x] 5.5 Run targeted Vitest coverage and `drawnix:typecheck`.
- [ ] 5.6 Run targeted lint to zero errors; currently blocked by the pre-existing `default-adapters.ts` `@nx/enforce-module-boundaries` lint error.
- [ ] 5.7 Run `openspec validate update-image-api-compatibility-modes --strict`; currently blocked because the `openspec` CLI is unavailable in this workspace.
