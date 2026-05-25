## Context

The current rollout target is to make `OpenAI GPT Image` the default and only first-class GPT Image compatibility mode. The previous dedicated `for-gpt-image` branch is being removed. Users with existing `for-gpt-image` or historical Tuzi compatibility values should be migrated to `openai-gpt-image` automatically.

## Decisions

- Decision: Keep compatibility on `ProviderProfile`.

  The selected provider profile still owns the image API compatibility setting.

- Decision: Reduce stored compatibility values.

  ```ts
  type ImageApiCompatibility =
    | 'auto'
    | 'openai-gpt-image'
    | 'openai-compatible-basic';
  ```

- Decision: Treat removed For GPT values as migration aliases only.

  `for-gpt-image`, `tuzi-gpt-image`, and `tuzi-compatible` are accepted only while reading older data. Normalization rewrites them to `openai-gpt-image`.

- Decision: Route GPT Image through official schemas.

  GPT Image generation uses `openai.image.gpt-generation-json`; GPT Image edit uses `openai.image.gpt-edit-form`. Both are handled by `gpt-image-adapter`.

- Decision: Keep generic fallback separate.

  `openai-compatible-basic` remains valid for broad OpenAI-compatible image providers and manual fallback. It does not own GPT Image-specific migration from For GPT.

## Compatibility Model

### Stored Values

- `auto`
- `openai-gpt-image`
- `openai-compatible-basic`

### Migration Aliases

- `for-gpt-image` -> `openai-gpt-image`
- `tuzi-gpt-image` -> `openai-gpt-image`
- `tuzi-compatible` -> `openai-gpt-image`

### Auto Resolution Rules

| Profile / model condition | Resolved mode |
| --- | --- |
| `api.openai.com` + GPT Image model | `openai-gpt-image` |
| `foropencode.com` + GPT Image model | `openai-gpt-image` |
| other profile + GPT Image model | `openai-compatible-basic` |

Manual non-`auto` values always win after normalization.

## Request Schema Mapping

| Resolved mode | Operation | Request schema | Adapter |
| --- | --- | --- | --- |
| `openai-gpt-image` | generation | `openai.image.gpt-generation-json` | `gpt-image-adapter` |
| `openai-gpt-image` | edit | `openai.image.gpt-edit-form` | `gpt-image-adapter` |
| `openai-compatible-basic` | generation / compatibility fallback | `openai.image.basic-json` | default/basic adapter |

Removed request schemas:

- `for.image.gpt-generation-json`
- `for.image.gpt-edit-json`
- `tuzi.image.gpt-generation-json`
- `tuzi.image.gpt-edit-json`

## Migration

- New profiles default to `openai-gpt-image`.
- Built-in managed/default profiles default to `openai-gpt-image` when no explicit override exists.
- Existing `for-gpt-image`, `tuzi-gpt-image`, and `tuzi-compatible` values are persisted back as `openai-gpt-image` on load/normalization.
- Explicit custom `auto` is preserved, but ForOpenCode GPT Image auto resolution now points to `openai-gpt-image`.
- `openai-compatible-basic` remains preserved for users who explicitly selected it.

## Risks

- Gateways that still expected the removed For GPT schema may need to support the official GPT Image request format.
- Removing the dedicated adapter requires test coverage to prove GPT Image generation/edit still select `gpt-image-adapter` for default and ForOpenCode profiles.
