# Change: Preserve Built-in Models After Failed Runtime Discovery

## Why

启用供应商 profile 并保存新凭据后，当前运行时会在模型发现开始前写入非空凭据签名。即使该 profile 从未成功取得目录，签名也会把全局 selector 切入 provider-only 模式；首次发现失败后，用户能看到错误消息，但文本、图片等模型候选会变为空。

Node 24.14.0、Vitest 3.2.4、无网络的确定性 401 实验中，error 状态的 `discoveredModels/models` 均为空；静态文本 fallback 期望为 `gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna`，实际为 `[]`，1/1 诊断失败，退出 1。`add-runtime-model-discovery` 要求失败后静态 fallback 保持可用；`add-multi-provider-profiles` 又只允许在没有 authoritative catalog 时显示默认模型，但未定义“仅凭据签名”是否构成 authoritative catalog。该 change 明确这项边界。

## What Changes

- 只有成功取得的 enabled provider catalog 才能使全局 selector 进入 provider-only 模式。
- 仅保存凭据、首次发现 loading 或首次发现失败时，如果没有其他 enabled profile 的成功目录，继续显示策展的内置默认模型。
- 凭据签名仍用于使旧凭据目录和旧 model ref 失效；fallback 不得重新钉回旧凭据的 provider 模型。
- 任一 enabled profile 已有成功目录时，继续只展示 enabled provider catalogs 中用户选择的模型，不混入静态 fallback。
- 不改变 provider catalog schema、模型选择、排序、路由、认证或错误消息。

## Impact

- Affected specs: `runtime-model-discovery`
- Affected code: `packages/drawnix/src/utils/runtime-model-discovery.ts`, runtime discovery tests
- Related active changes: `add-runtime-model-discovery`, `add-multi-provider-profiles`, `fix-runtime-model-discovery-stale-response`
- User-visible trade-off: 首次发现尚未成功时 selector 不再变空；成功目录的 provider-only 语义保持不变
