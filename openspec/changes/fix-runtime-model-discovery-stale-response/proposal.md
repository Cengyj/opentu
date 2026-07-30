# Change: Fix Runtime Model Discovery Stale Responses

## Why

同一供应商 profile 可以在前一次模型发现尚未返回时启动新凭据的发现。当新请求先成功、旧请求后返回时，当前 `RuntimeModelDiscoveryStore` 会用旧凭据目录覆盖新凭据目录并持久化。

受控 Vitest 让第二个请求先返回 `new-key-model`，再让第一个请求返回 `old-key-model`；最终 state 实际为 `old-key-model`，与最新凭据相反。修复会改变失序响应的用户可见和持久化语义，必须先审批。

## What Changes

- 为每个 provider profile 的发现请求建立最新所有权；只有仍为最新的请求可以提交 success/error 状态。
- 新发现、凭据变更导致的 catalog 失效或显式清空，均使该 profile 既有 in-flight 请求过期。
- 过期请求的迟到成功不得覆盖最新 catalog；迟到失败不得将新成功状态改为 error 或弹出误导性错误。
- 不改变模型分类、选择、排序、profile 存储 schema、API endpoint 或 auth 格式。

## Impact

- Affected specs: `runtime-model-discovery`
- Affected code: `packages/drawnix/src/utils/runtime-model-discovery.ts`, settings discovery error handling if a typed stale outcome is required, runtime discovery tests
- User-visible trade-off: 用户切换凭据或重新获取模型后，迟到的旧响应将被忽略，不再恢复旧目录或错误提示

